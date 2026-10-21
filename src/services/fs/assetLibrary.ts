/**
 * fs/assetLibrary — 全局资产库（项目无关）+ 外部文件夹 + 全局资产
 * 全局 file 目录、递归遍历外部文件夹、添加文件/文件夹、保存到永久目录、删除永久文件。
 */
import { writeFile, readFile as tauriReadFile, mkdir, exists, stat, readDir } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import {
  isTauriEnv,
  joinPath,
  getBaseDir,
  getConvertFileSrc,
  resolveUniqueDestPath,
  getFileCategory,
  CATEGORY_EXTENSIONS,
  type AssetFileEntry,
} from './core';
import { moveToTrash } from './trash';
import { convertFileSrc } from '@tauri-apps/api/core';
import { beginTransfer, finishTransfer, startTransferBatch, transferKindFromName } from '../transferReporting';
import { identifyAsset } from './assetIndex';

/** 全局文件目录：{baseDataDir}/file（手动添加的单文件落此处）*/
export async function getGlobalFilesDir(): Promise<string | null> {
  const base = await getBaseDir();
  if (!base) return null;
  return joinPath(base, 'file');
}

async function ensureGlobalFilesDir(): Promise<string | null> {
  if (!isTauriEnv()) return null;
  const dir = await getGlobalFilesDir();
  if (!dir) return null;
  try {
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
    return dir;
  } catch (err) {
    console.error('Failed to create global files dir:', dir, err);
    return null;
  }
}

/** 列出全局 file 目录中的文件。
 *  ★ 改成**递归**（浅层 maxDepth 2）：官方「保存到素材库」会把资产放进素材库文件夹
 *  （`library.folders`：风格/场景/道具/其他/音效/角色 ⇒ MTV 落成 `{baseDataDir}/file/<文件夹>/`），
 *  只列顶层的话保存进文件夹的资产在面板里看不到 ✗ */
export async function listGlobalFiles(): Promise<AssetFileEntry[]> {
  const dir = await getGlobalFilesDir();
  if (!dir) return [];
  if (!(await exists(dir).catch(() => false))) return [];
  const files = await walkDirectoryFiles(dir, { maxDepth: 2 });
  return Promise.all(files.map(async (f) => {
    const identity = await identifyAsset(f.path, { rootPath: dir, source: 'global', size: f.size });
    return { ...f, assetId: identity.assetId, relativePath: identity.relativePath, source: 'global' as const, availability: 'online' as const };
  }));
}

/**
 * 递归遍历目录收集文件（带数量/深度上限，避免超大目录卡死）。
 * 每个目录内的 stat 并行，整体用栈迭代而非深递归。
 */
export async function walkDirectoryFiles(
  rootDir: string,
  opts: { maxFiles?: number; maxDepth?: number; excludedRootDirectories?: readonly string[] } = {},
): Promise<AssetFileEntry[]> {
  if (!isTauriEnv()) return [];
  const maxFiles = opts.maxFiles ?? 3000;
  const maxDepth = opts.maxDepth ?? 8;
  const convertFileSrc = await getConvertFileSrc();
  const out: AssetFileEntry[] = [];
  const stack: { dir: string; depth: number }[] = [{ dir: rootDir, depth: 0 }];

  while (stack.length > 0 && out.length < maxFiles) {
    const { dir, depth } = stack.pop()!;
    let entries: Awaited<ReturnType<typeof readDir>>;
    try {
      entries = await readDir(dir);
    } catch {
      continue;
    }
    const fileEntries = entries.filter((e) => e.isFile);
    const subDirs = entries.filter((e) => e.isDirectory);

    const statResults = await Promise.all(
      fileEntries.map(async (e) => {
        const filePath = joinPath(dir, e.name);
        try {
          const s = await stat(filePath);
          return { name: e.name, filePath, size: s.size ?? 0, mtimeMs: s.mtime?.getTime() ?? 0 };
        } catch {
          return null;
        }
      }),
    );

    for (const r of statResults) {
      if (!r) continue;
      if (out.length >= maxFiles) break;
      const ext = `.${r.name.split('.').pop()?.toLowerCase()}`;
      let assetUrl: string | undefined;
      if (CATEGORY_EXTENSIONS.image.includes(ext) && convertFileSrc) {
        assetUrl = convertFileSrc(r.filePath);
      }
      const identity = await identifyAsset(r.filePath, {
        rootPath: rootDir,
        source: 'folder',
        size: r.size,
        mtimeMs: r.mtimeMs,
      });
      out.push({
        assetId: identity.assetId,
        name: r.name,
        path: r.filePath,
        relativePath: identity.relativePath,
        assetUrl,
        size: r.size,
        category: getFileCategory(r.name),
        availability: 'online',
      });
    }

    if (depth < maxDepth) {
      for (const d of subDirs) {
        // 项目派生缓存只占用根目录；分组和外部目录内的同名文件夹仍是用户素材。
        if (depth === 0 && opts.excludedRootDirectories?.includes(d.name)) continue;
        stack.push({ dir: joinPath(dir, d.name), depth: depth + 1 });
      }
    }
  }
  return out;
}

/** 列出登记的外部文件夹中的全部文件（递归，整体上限） */
export async function listExternalFolderFiles(
  folders: string[],
  opts: { maxFilesPerFolder?: number } = {},
): Promise<AssetFileEntry[]> {
  if (!isTauriEnv() || folders.length === 0) return [];
  const perFolder = opts.maxFilesPerFolder ?? 3000;
  const results = await Promise.all(
    folders.map(async (folder) => {
      if (!(await exists(folder).catch(() => false))) return [];
      const files = await walkDirectoryFiles(folder, { maxFiles: perFolder });
      return files.map((f) => ({ ...f, source: 'folder' as const, folderRoot: folder }));
    }),
  );
  return results.flat();
}

/** 选择本地文件（可多选）拷贝到全局 file 目录，返回拷贝数量 */
export async function addAssetFilesToGlobal(): Promise<number> {
  if (!isTauriEnv()) return 0;
  const selected = await open({ multiple: true, title: '添加文件到资产库' });
  if (!selected) return 0;
  const paths = Array.isArray(selected) ? selected : [selected];
  const destDir = await ensureGlobalFilesDir();
  if (!destDir) return 0;

  let count = 0;
  for (const src of paths) {
    try {
      const fileName = src.split(/[\\/]/).pop() || 'file';
      const destPath = await resolveUniqueDestPath(destDir, fileName);
      const data = await tauriReadFile(src);
      await writeFile(destPath, data);
      count++;
    } catch (err) {
      console.error('Failed to add file to global:', src, err);
    }
  }
  return count;
}

/**
 * 官方「添加 → 上传」的**第二步**（9444 实测 t822-C2：第一步是 `library.selectFolder`
 * 「选择文件夹」对话框 `z2`，确认后才走系统文件选择）：
 * 选择本地文件（可多选）拷贝到**指定的素材库文件夹**，返回拷贝数量。
 * @param folder 素材库内的文件夹路径（如 `角色` / `角色/主角`）；缺省 = 素材库根目录
 */

/** 图片扩展名 → MIME（缩略图用） */
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif', svg: 'image/svg+xml',
};
/** 缩略图上限（超过就不做缩略图，避免把大图塞进内存/DOM） */
const THUMB_MAX_BYTES = 8 * 1024 * 1024;

/** 把刚刚读到的文件字节编成 data URL（进度卡行首的图片缩略图用） */
function imageBytesToDataUrl(path: string, bytes: Uint8Array): string | undefined {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const mime = IMAGE_MIME[ext];
  if (!mime || bytes.length === 0 || bytes.length > THUMB_MAX_BYTES) return undefined;
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  try { return 'data:' + mime + ';base64,' + btoa(bin); } catch { return undefined; }
}

export async function addAssetFilesToLibraryFolder(
  folder?: string,
  hooks?: {
    /** 选完文件后回调（用于弹官方「上传进度浮层」：文件名/缩略图） */
    onPicked?: (paths: string[]) => void;
    /** 每个文件拷完后回调（index 从 0 起） */
    onItemDone?: (index: number, path: string) => void;
    /** 图片文件的缩略图（data URL，来自**拷贝时已读到的字节**） */
    onItemThumb?: (index: number, dataUrl: string) => void;
  },
): Promise<number> {
  if (!isTauriEnv()) return 0;
  const selected = await open({ multiple: true, title: '添加文件到素材库' });
  if (!selected) return 0;
  const paths = Array.isArray(selected) ? selected : [selected];
  const destDir = await ensureLibraryFolder(folder);
  if (!destDir) return 0;
  hooks?.onPicked?.(paths);
  /* 官方：上传都进「文件传输中心」（画布底部那张卡）⇒ 用真实的 reporting API 上报，行首带缩略图 */
  startTransferBatch(`upload:${Date.now().toString(36)}`);
  const transferIds: string[] = paths.map((p, i) => {
    const nm = p.split(/[\\/]/).pop() || 'file';
    const isImg = /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(nm);
    const id = beginTransfer({
      variant: 'upload',
      name: nm,
      kind: transferKindFromName(nm),
      thumbnail: isImg ? convertFileSrc(p) : undefined,
    });
    hooks?.onItemThumb?.(i, isImg ? convertFileSrc(p) : '');
    return id;
  });

  let count = 0;
  for (let i = 0; i < paths.length; i++) {
    const src = paths[i];
    try {
      const fileName = src.split(/[\\/]/).pop() || 'file';
      const destPath = await resolveUniqueDestPath(destDir, fileName);
      const data = await tauriReadFile(src);
      await writeFile(destPath, data);
      /* 进度卡行首缩略图：用**这次已经读到的字节**直接编 data URL（不再二次读盘、不受 readFileToDataUrl 的大小限制） */
      const thumb = imageBytesToDataUrl(src, data);
      if (thumb) hooks?.onItemThumb?.(i, thumb);
      count++;
    } catch (err) {
      console.error('Failed to add file to library folder:', src, err);
    }
    hooks?.onItemDone?.(i, src);
    finishTransfer(transferIds[i]);
  }
  return count;
}

/** 选择一个本地文件夹，返回其路径（仅登记引用，不拷贝） */
export async function pickAssetFolder(): Promise<string | null> {
  if (!isTauriEnv()) return null;
  const selected = await open({ directory: true, title: '添加本地文件夹' });
  if (!selected || Array.isArray(selected)) return typeof selected === 'string' ? selected : null;
  return selected;
}

/** 将文件拷贝到全局永久目录 {baseDataDir}/file（可选子文件夹）
 *  ★ 官方「保存到素材库」= 先选素材库文件夹再存（`library.selectFolder` / `library.savedToFolder`），
 *    官方文件夹（`library.folders` 逐字）= 风格 / 场景 / 道具 / 其他 / 音效 / 角色
 *    ⇒ MTV 本地映射为 `{baseDataDir}/file/<文件夹>/`（`folder` 省略则落根目录，行为同旧版） */
export async function saveToPermanent(filePath: string, folder?: string): Promise<string | null> {
  if (!isTauriEnv()) return null;
  const destDir = await ensureLibraryFolder(folder);
  if (!destDir) return null;

  try {
    const fileName = filePath.split(/[\\/]/).pop() || 'file';
    const destPath = await resolveUniqueDestPath(destDir, fileName);
    const data = await tauriReadFile(filePath);
    await writeFile(destPath, data);
    return destPath;
  } catch (err) {
    console.error('Failed to save file to permanent:', filePath, err);
    return null;
  }
}

/** 官方素材库文件夹（`library.folders` 逐字，key 顺序也一样） */
export const LIBRARY_FOLDERS = [
  { key: 'style', label: '风格' },
  { key: 'scene', label: '场景' },
  { key: 'item', label: '道具' },
  { key: 'others', label: '其他' },
  { key: 'sound', label: '音效' },
  { key: 'character', label: '角色' },
] as const;

/** 取/建某个素材库文件夹目录；`folder` 为空则返回根目录 */
export async function ensureLibraryFolder(folder?: string): Promise<string | null> {
  const base = await ensureGlobalFilesDir();
  if (!base) return null;
  if (!folder) return base;
  const dir = await joinPath(base, folder);
  try {
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
    return dir;
  } catch (err) {
    console.error('Failed to create library folder:', dir, err);
    return null;
  }
}

/**
 * 将 asset entry 保存到永久目录 — 支持磁盘文件和 data URL 两种来源
 * virtual:// 路径会从 entry.assetUrl（data URL）解码写入
 * `folder` = 官方素材库文件夹（见 `LIBRARY_FOLDERS`），省略则落 `{baseDataDir}/file` 根目录
 */
export async function saveAssetToPermanent(
  entry: AssetFileEntry,
  folder?: string,
): Promise<string | null> {
  if (!isTauriEnv()) return null;

  // 虚拟路径：从 data URL 解码写入
  if (entry.path.startsWith('virtual://')) {
    if (!entry.assetUrl || !entry.assetUrl.startsWith('data:')) return null;
    const destDir = await ensureLibraryFolder(folder);
    if (!destDir) return null;

    try {
      const destPath = await resolveUniqueDestPath(destDir, entry.name);

      const match = entry.assetUrl.match(/^data:(.+?);base64,(.+)$/);
      if (match) {
        const b64 = match[2];
        const binaryStr = atob(b64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        await writeFile(destPath, bytes);
      } else {
        const resp = await fetch(entry.assetUrl);
        const buffer = await resp.arrayBuffer();
        await writeFile(destPath, new Uint8Array(buffer));
      }
      return destPath;
    } catch (err) {
      console.error('Failed to save virtual asset to permanent:', entry.name, err);
      return null;
    }
  }

  // 真实磁盘路径
  return saveToPermanent(entry.path, folder);
}

/** `content-type` → 扩展名（`extractFilesFromNodeData` 给远程图卡造的 `name` 是 CDN 的 uuid，没有后缀） */
function extensionForContentType(contentType: string): string {
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (type === 'image/png') return '.png';
  if (type === 'image/jpeg') return '.jpg';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/gif') return '.gif';
  if (type === 'video/mp4') return '.mp4';
  if (type === 'video/webm') return '.webm';
  if (type === 'audio/mpeg') return '.mp3';
  if (type === 'audio/wav') return '.wav';
  if (type === 'text/markdown') return '.md';
  if (type === 'text/plain') return '.txt';
  return '';
}

/**
 * ★「只有 URL、没有本地文件」的资产（`extractFilesFromNodeData` 会给这种节点造 `node://<name>` 标识）：
 * 必须**抓字节**再写盘 —— 否则 `tauriReadFile('node://…')` 必然抛错，
 * 「保存到素材库」对「图来自远端 CDN / 生成接口」的卡片就**永远是失败**
 * （t1025 实测：AI 角色卡的 `imageUrl` 是 `files.tapnow.media/...`，点「保存到素材库」报「保存到素材库失败」）。
 */
export async function saveUrlAssetToPermanent(
  entry: AssetFileEntry,
  folder?: string,
): Promise<string | null> {
  if (!isTauriEnv() || !entry.assetUrl) return null;
  const destDir = await ensureLibraryFolder(folder);
  if (!destDir) return null;
  try {
    const resp = await fetch(entry.assetUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    /* 没有后缀就按 content-type 补一个，避免素材库里出现无后缀文件 */
    const hasExt = /\.[a-z0-9]{2,5}$/i.test(entry.name);
    const name = hasExt ? entry.name : `${entry.name}${extensionForContentType(resp.headers.get('content-type') || '')}`;
    const destPath = await resolveUniqueDestPath(destDir, name);
    await writeFile(destPath, bytes);
    return destPath;
  } catch (err) {
    console.error('Failed to save url asset to permanent:', entry.name, err);
    return null;
  }
}

/** 删除全局资产的文件（移入回收站） */
export async function deletePermanentFile(filePath: string): Promise<void> {
  await moveToTrash(filePath);
}
