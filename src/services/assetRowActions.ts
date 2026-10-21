/**
 * assetRowActions —— 官方素材条目「⋯」菜单的动作（MTV 本地实现）
 *
 * 官方 `O2`（`page-DPdEgTS0.js` @235714）菜单项：
 *   重命名 `library.rename` · 移动到 `library.moveTo` · 复制到 `library.copyTo` ·
 *   下载 `common.download`（**仅在传入 onDownload 时渲染** —— MTV 无下载处理器 ⇒ 官方语义下不渲染）·
 *   ── 分隔线 ── · 删除 `library.delete`（destructive）
 *
 * MTV 是本地画布 ⇒ 对应到文件系统：
 *   重命名 = `rename`（同目录改名）· 移动到 = 复制进目标文件夹 + 原文件入回收站 ·
 *   复制到 = 复制进目标文件夹 · 删除 = 入回收站（`moveToTrash`）
 */
import { rename, exists, writeFile } from '@tauri-apps/plugin-fs';
import { isTauriEnv, joinPath, resolveUniqueDestPath, readBinaryFile } from './fs/core';
import { getGlobalFilesDir, ensureLibraryFolder } from './fs/assetLibrary';
import { moveToTrash } from './fs/trash';

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() || 'file';
}

/** 重命名（同目录），返回新路径；失败返回 null */
export async function renameAssetFile(filePath: string, nextName: string): Promise<string | null> {
  if (!isTauriEnv()) return null;
  const clean = nextName.trim();
  if (!clean) return null;
  const dir = filePath.replace(/[\\/][^\\/]*$/, '');
  const dest = await joinPath(dir, clean);
  try {
    if (dest === filePath) return filePath;
    if (await exists(dest).catch(() => false)) return null;
    await rename(filePath, dest);
    return dest;
  } catch (err) {
    console.error('renameAssetFile failed:', filePath, err);
    return null;
  }
}

/** 复制到素材库文件夹（官方 6 个文件夹之一），返回新路径 */
export async function copyAssetToLibraryFolder(filePath: string, folder: string): Promise<string | null> {
  if (!isTauriEnv()) return null;
  const destDir = await ensureLibraryFolder(folder);
  if (!destDir) return null;
  try {
    const dest = await resolveUniqueDestPath(destDir, baseName(filePath));
    const bytes = await readBinaryFile(filePath);
    await writeFile(dest, bytes);
    return dest;
  } catch (err) {
    console.error('copyAssetToLibraryFolder failed:', filePath, err);
    return null;
  }
}

/** 移动到素材库文件夹 = 复制 + 原文件入回收站 */
export async function moveAssetToLibraryFolder(filePath: string, folder: string): Promise<string | null> {
  const dest = await copyAssetToLibraryFolder(filePath, folder);
  if (!dest) return null;
  /* 目标在全局 file 目录内时才算「移动」（与素材库一致）。
     ⚠️ 必须**归一化路径分隔符**再比较：UI 传来的 `file.path` 与 `getGlobalFilesDir()` 的斜杠形式
        可能不同（`\` vs `/`）⇒ 直接 `startsWith` 会判 false ⇒ 变成「只复制不删源」✗（实测踩过） */
  const globalDir = await getGlobalFilesDir();
  const norm = (p: string) => p.replace(/\\/g, '/');
  if (globalDir && norm(filePath).startsWith(norm(globalDir))) {
    try { await moveToTrash(filePath); } catch { /* 忽略 */ }
  }
  return dest;
}

/** 删除（入回收站） */
export async function trashAssetFile(filePath: string): Promise<boolean> {
  if (!isTauriEnv()) return false;
  try {
    await moveToTrash(filePath);
    return true;
  } catch (err) {
    console.error('trashAssetFile failed:', filePath, err);
    return false;
  }
}

/* ── 素材库文件夹本身的文件系统动作（官方 `EX` 的 MTV 本地实现）── */
import { mkdir, rename as renameDir, readDir } from '@tauri-apps/plugin-fs';


/** 新建素材库文件夹（`library.newFolder`）—— 目标目录 `{baseDataDir}/file/<name>` */
export async function createLibraryFolder(name: string): Promise<string | null> {
  if (!isTauriEnv()) return null;
  const clean = name.trim();
  if (!clean) return null;
  const globalDir = await getGlobalFilesDir();
  if (!globalDir) return null;
  const dir = await joinPath(globalDir, clean);
  try {
    if (await exists(dir).catch(() => false)) return null;
    await mkdir(dir, { recursive: true });
    return dir;
  } catch (err) {
    console.error('createLibraryFolder failed:', clean, err);
    return null;
  }
}

/** 重命名素材库文件夹（`library.rename`）
 *  ★ 官方**允许重命名成已存在的名字**：源码 `renameFolder(id, name)` 只有 `trim()`，没有重名校验；
 *    9444 实测 t956：把新建的文件夹改成另一个已存在的名字 → 成功、无报错、无 toast。
 *    本地文件系统不允许同级同名目录 ⇒ 目标已存在时**合并**（旧目录内容并入目标、旧目录入回收站），
 *    语义上等价于「重命名成功」，绝不因重名而失败。 */
export async function renameLibraryFolder(oldName: string, nextName: string): Promise<boolean> {
  if (!isTauriEnv()) return false;
  const clean = nextName.trim();
  if (!clean || clean === oldName) return false;
  const globalDir = await getGlobalFilesDir();
  if (!globalDir) return false;
  const from = await joinPath(globalDir, oldName);
  const to = await joinPath(globalDir, clean);
  try {
    if (!(await exists(from).catch(() => false))) return false;
    if (await exists(to).catch(() => false)) {
      const entries = await readDir(from).catch(() => [] as { name: string }[]);
      for (const en of entries) {
        const src = await joinPath(from, en.name);
        const dst = await joinPath(to, en.name);
        if (await exists(dst).catch(() => false)) continue;
        await renameDir(src, dst);
      }
      await moveToTrash(from).catch(() => undefined);
      return true;
    }
    await renameDir(from, to);
    return true;
  } catch (err) {
    console.error('renameLibraryFolder failed:', oldName, err);
    return false;
  }
}

/** 删除素材库文件夹（`library.delete`，入回收站）*/
export async function trashLibraryFolder(name: string): Promise<boolean> {
  if (!isTauriEnv()) return false;
  const globalDir = await getGlobalFilesDir();
  if (!globalDir) return false;
  const dir = await joinPath(globalDir, name);
  try {
    if (!(await exists(dir).catch(() => false))) return true;
    await moveToTrash(dir);
    return true;
  } catch (err) {
    console.error('trashLibraryFolder failed:', name, err);
    return false;
  }
}

/* ── 官方预览卡的「应用到画布」（`library.applyToCanvas`）：把素材落成画布节点 ── */
import { useAppStore, computeImageNodeDimensions } from '../store/useAppStore';
import { buildNodeData } from '../components/sidebar/nodePickerActions';
import { getCanvasPointerPosition } from './canvasPointerService';
import { getCanvasViewportController } from './canvasViewportService';
import {
  nodeBoxForImageSize,
  nodeSizeForAspectRatio,
  nearestAspectRatioForImage,
} from '../utils/nodeBounds';
import type { NodeType } from '../types';

/** 素材分类 → MTV 节点类型 */
function nodeTypeForCategory(category: string): NodeType {
  if (category === 'video') return 'ai-video';
  if (category === 'audio') return 'ai-audio';
  if (category === 'text') return 'ai-text';
  return 'ai-image';
}

/** 官方 `library.applyToCanvas`：在画布上落一个节点（位置 = 最近一次画布指针）
 *
 * ★★ 用户 2026 报的 bug：「从历史应用到画布的卡，尺寸被固定成 16:9，不是图原来的尺寸
 *   （我原本是 3:4，应用后变成 16:9）」。
 *   根因：这里只 `buildNodeData('ai-image')`（那是**新空白卡**的默认：`aspectRatio:'16:9'` +
 *   `nodeWidth/Height = pR(16/9) = 444×250`），然后只补了 `imageUrl` ⇒ 卡永远 16:9 ✗。
 *   ⇒ 应用**已有图片**时必须按这张图自己的真实比例算卡片盒子（与「上传图片」那条路同一套：
 *     `computeImageNodeDimensions` 量真实像素 → `nodeBoxForImageSize` 走官方 `pR`（短边恒 250）
 *     → `nearestAspectRatioForImage` 取官方合法比例表里最接近的，免得被比例选择器夹回）。
 *   ⚠️ 因此本函数改成 **async**（量图要 load），调用方见 `LibraryAssetPreviewCard` / `OutputHistoryPanel`。 */
export async function applyLibraryFileToCanvas(
  file: { category: string; name: string; assetUrl?: string; path: string },
): Promise<boolean> {
  const store = useAppStore.getState();
  const type = nodeTypeForCategory(file.category);
  const data = buildNodeData(type) as Record<string, unknown>;
  const media: Record<string, unknown> = {
    label: file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name,
    ...(file.path.startsWith('virtual://') ? {} : { filePath: file.path }),
    status: 'success',
    role: 'source',
  };
  if (type === 'ai-image' && file.assetUrl) {
    media.imageUrl = file.assetUrl;
    try {
      const dims = await computeImageNodeDimensions(file.assetUrl);
      Object.assign(
        media,
        dims,
        nodeBoxForImageSize(dims.imageWidth, dims.imageHeight),
        nearestAspectRatioForImage(dims.imageWidth, dims.imageHeight),
      );
    } catch { /* 量不到就退回 `buildNodeData` 的默认盒子 */ }
  }
  if (type === 'ai-video' && file.assetUrl) media.videoUrl = file.assetUrl;
  if (type === 'ai-audio' && file.assetUrl) media.audioUrl = file.assetUrl;
  store.addNode({
    id: `node-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    type,
    position: getCanvasPointerPosition(),
    data: { ...data, ...media },
  } as never);
  return true;
}

/* ── 官方 AI 角色卡「应用到画布」（`Nge` 底部按钮 → `onAddToCanvas`）──
 * 官方实测（9444，用户截图 + t956 画布状态）：点一次会在画布上新增**该角色的 4 张图**（各自的图片节点）：
 *   · 角色立绘 / 肖像特写 / 表情九宫格：3 个 `aspect-[3/4]` 节点，宽 410 → 高 548，横向间距 508（一排）
 *   · 三视图：`aspect-[43/24]` 节点，735×410，放在第一张下方（x 同第一张，y ≈ +710）
 * 且**应用后角色库与详情弹窗都关闭**。 */

/** 官方 4 张图的节点规格 —— **逐字照抄官方源码**（`page-DPdEgTS0.js` 的 `onAddToCanvas`）：
 *  ```
 *  Ke = Math.round(333.333…) = 333        // 立绘/特写/表情 的高
 *  et = 870, dt = Math.round(et*24/43) = 486   // 三视图 宽/高
 *  [full_body  w250 h333 rx0     ry0
 *   closeup    w250 h333 rx310   ry0
 *   expression w250 h333 rx310*2 ry0
 *   three_view w870 h486 rx0     ry333+100 = 433]
 *  ```
 *  ⇒ 之前 MTV 用的 410×548 / 间距 508 / dy 710 是**画布缩放 1.64× 后的渲染尺寸**，不是逻辑尺寸。 */
export function applyAiRoleCharacterToCanvas(c: {
  name: string;
  images: { full: string; three: string; expression: string; closeup: string };
}): boolean {
  const store = useAppStore.getState();
  const base = getCanvasPointerPosition();
  const H = 333;                 // 官方 Ke
  const TV_W = 870;              // 官方 et
  const TV_H = Math.round((TV_W * 24) / 43);   // 官方 dt = 486
  const specs: { url: string; w: number; h: number; dx: number; dy: number }[] = [
    { url: c.images.full, w: 250, h: H, dx: 0, dy: 0 },
    { url: c.images.closeup, w: 250, h: H, dx: 310, dy: 0 },
    { url: c.images.expression, w: 250, h: H, dx: 310 * 2, dy: 0 },
    { url: c.images.three, w: TV_W, h: TV_H, dx: 0, dy: H + 100 },
  ].filter((s) => !!s.url);
  if (!specs.length) return false;
  const stamp = Date.now().toString(36);
  const ids: string[] = [];
  /**
   * ★★ 打组：**角色库「应用到画布」不参与自动归属分组**（用户反馈「角色库应用与上传/生成应该是两套打组逻辑」）。
   *
   * 官方源码：`onAddToCanvas` 只做 `S(tt)`（= flow store 的 `addNodes`）——**没有**调 `processAutoGrouping`；
   * 而上传/生成路径才调它（官方 `Lhe().processAutoGrouping(ids)`：新节点中心落在既有分组内就挂 `parentId`）。
   * MTV 的 `store.addNode` 走的是 `insertNodeInGroup()` ⇒ **每次插入都会自动挂进包含它的分组** ✗
   * ⇒ 这里改用 `addNodesWithEdges`（官方 `S(nodes)` 的等价物：纯追加、不自动归属），
   *    并把「一次提交历史」也做成一次（旧版 4 次 `addNode` = 4 条撤销记录）。
   */
  const nextNodes = specs.map((s, i) => {
    const id = `node-${stamp}-${i}`;
    ids.push(id);
    const data = buildNodeData('ai-image') as Record<string, unknown>;
    /* ★ RF 节点盒子必须 = 卡片实际渲染尺寸，否则「选中框/拖拽区/手柄父层」和看得见的卡片对不上：
       MTV 的 `ImageNode` 用 `nodeSizeForAspectRatio(真实比例)` 定盒子（横图高 250、竖图宽 250），
       所以 3:4 卡 = 250×333（= 官方 ✓），43:24 三视图被归一成 448×250（比例 == 官方 ✓、线性尺寸是 MTV 口径）。 */
    const box = nodeSizeForAspectRatio(s.w / s.h);
    return {
      id,
      type: 'ai-image',
      position: { x: base.x + s.dx, y: base.y + s.dy },
      width: box.width,
      height: box.height,
      selected: true,          // 官方：新增后**选中这些节点**（顶部工具栏/左侧 + 因此出现）
      data: {
        ...data,
        label: c.name,
        imageUrl: s.url,
        imageAspect: s.w / s.h,
        /* ★★★ 卡片盒子必须由**官方落点尺寸**推出来：
           `ImageNode` 的盒子走 `nodeSizeForAspectRatio(intrinsicRatio ?? aspectRatio)`，
           而 `intrinsicRatio` **只在 `role === 'source'` 且 `imageWidth/imageHeight` 都在时**才生效
           （`buildNodeData('ai-image')` 默认 `aspectRatio:'16:9'` ⇒ 444×250 ⇒ 卡片错成 16:9，
           左右 `+` 手柄也跟着跑到离立绘 194px 的地方）。写入真实尺寸后卡片 = 250×333 ✓。 */
        imageWidth: s.w,
        imageHeight: s.h,
        status: 'success',
        role: 'source',
      },
    } as never;
  });
  store.addNodesWithEdges(nextNodes as never[], []);
  store.setSelectedNodeIds(ids);

  /* ★ 官方 `onAddToCanvas` 结尾的第二件事（① 的真相）：`N(tt.map(n => n.id))`，
     其中 `N = Pu().moveToPosition`（`zoom-slider-3ZcFvYQO.js` @2849020 逐字）：
       const o = (ids, opts) => {
         const duration = opts?.duration ?? 800, padding = opts?.padding ?? .2;
         setTimeout(() => { if (opts?.shouldMove && !opts.shouldMove()) return;
                            fitView({ nodes: ids.map(id => ({ id })), duration, padding }); }, 100);
       }
     ⇒ 新建节点后视口**动画飞到这批新节点**（800ms @ padding .2、延迟 100ms）——
     这就是用户看到的「入场放大」：不是节点自己 scale，而是相机推近。 */
  window.setTimeout(() => {
    void getCanvasViewportController()?.fitView({ nodeIds: ids, duration: 800, padding: 0.2 });
  }, 100);
  return ids.length > 0;
}

/* ── 素材库文件夹的**子层**（官方 `U2`/`MX` 支持任意层级；缩进 `V2=28 H2=6`）── */

/** 列出某个素材库文件夹下的**子文件夹名**与**素材文件数**
 *  （官方空态行 `DX`（`library.emptyFolder`）判定的是「该文件夹暂无素材」= **文件数为 0**，
 *    与「有没有子文件夹」无关 ⇒ 两个都要返回） */
export async function listLibraryFolderContents(folder: string): Promise<{ folders: string[]; fileCount: number }> {
  if (!isTauriEnv()) return { folders: [], fileCount: 0 };
  const globalDir = await getGlobalFilesDir();
  if (!globalDir) return { folders: [], fileCount: 0 };
  const dir = folder ? await joinPath(globalDir, folder) : globalDir;
  try {
    if (!(await exists(dir).catch(() => false))) return { folders: [], fileCount: 0 };
    const entries = await readDir(dir);
    const folders = entries
      .filter((e) => (e as { isDirectory?: boolean }).isDirectory)
      .map((e) => e.name)
      .filter((n): n is string => !!n)
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    const fileCount = entries.filter((e) => !(e as { isDirectory?: boolean }).isDirectory).length;
    return { folders, fileCount };
  } catch (err) {
    console.error('listLibraryFolderContents failed:', folder, err);
    return { folders: [], fileCount: 0 };
  }
}

/* ── 文件夹级「移动到 / 创建副本」（官方 `move-folder` / `copy-folder`）── */
/** 递归复制目录（素材库内相对路径） */
export async function copyLibraryFolderTree(srcRel: string, destRel: string): Promise<boolean> {
  if (!isTauriEnv()) return false;
  const globalDir = await getGlobalFilesDir();
  if (!globalDir) return false;
  const from = await joinPath(globalDir, srcRel);
  const to = await joinPath(globalDir, destRel);
  /* 目标不能是自己或自己的子孙（官方 `disallowedFolderIds` 同理；否则无限递归） */
  const n = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  if (n(to) === n(from) || n(to).startsWith(n(from) + '/')) return false;
  try {
    if (await exists(to).catch(() => false)) return false;
    await mkdir(to, { recursive: true });
    const entries = await readDir(from);
    for (const entry of entries) {
      const name = entry.name;
      if (!name) continue;
      const srcChild = await joinPath(from, name);
      const destChild = await joinPath(to, name);
      if ((entry as { isDirectory?: boolean }).isDirectory) {
        const ok = await copyLibraryFolderTree(`${srcRel}/${name}`, `${destRel}/${name}`);
        if (!ok) return false;
      } else {
        const bytes = await readBinaryFile(srcChild);
        await writeFile(destChild, bytes);
      }
    }
    return true;
  } catch (err) {
    console.error('copyLibraryFolderTree failed:', srcRel, destRel, err);
    return false;
  }
}

/** 移动目录 = 复制 + 源目录入回收站 */
export async function moveLibraryFolderTree(srcRel: string, parentRel: string): Promise<boolean> {
  const name = srcRel.split('/').pop() || srcRel;
  const destRel = parentRel ? `${parentRel}/${name}` : name;
  const ok = await copyLibraryFolderTree(srcRel, destRel);
  if (!ok) return false;
  await trashLibraryFolder(srcRel);
  return true;
}

/** 官方 `disallowedFolderIds` 的等价物：移动文件夹时，目标不能是它自己或它的子孙 */
export function isDisallowedMoveTarget(sourceRel: string, targetRel: string): boolean {
  const n = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  return n(targetRel) === n(sourceRel) || n(targetRel).startsWith(n(sourceRel) + '/');
}
