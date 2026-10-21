/**
 * saveToLibrary — 「保存到素材库」的**唯一动作**（右键卡片菜单 / 节点工具栏共用）。
 *
 * 官方（`page-DPdEgTS0.js` @1430523 逐字）：
 * ```js
 * …{source_node_id:x[k]?.node.id,…} … f(_,{force:!0});
 * const N=(await p(g.space,!0)).find(I=>String(I.id)===_)?.name||"";
 * xe.success(N ? e("library.savedToFolder",{folder:N}) : e("library.saveToLibrary"))
 * }catch{ xe.error(e("library.failedToSaveToLibrary")) }
 * ```
 * ⇒ 官方流程 = **先选素材库文件夹**（`library.selectFolder` / `library.folders` =
 *    风格 / 场景 / 道具 / 其他 / 音效 / 角色）→ 建资产 → toast「已保存到「{folder}」」。
 *
 * ★ MTV 是**本地画布**：没有服务端，落盘即 `{baseDataDir}/file/<文件夹>/`（`fs/assetLibrary`），
 *   素材库面板（`AssetsPanel` 的「永久」Tab）会把它列出来 ✓。
 * ★ 官方条件 `q` 允许 IMAGE/VIDEO/TEXT/AUDIO ⇒ 文本卡也走这里（文本写成 `.md` 虚拟条目）。
 */
import { useAppStore } from '../store/useAppStore';
import { extractFilesFromNodeData } from './fileService';
import { saveAssetToPermanent, saveUrlAssetToPermanent } from './fs/assetLibrary';
import type { AssetFileEntry } from './fs/core';

/** 文本卡（`data.output`）→ 一条虚拟文本资产（`virtual://` + data URL，`saveAssetToPermanent` 会解码写盘） */
function textEntryFromNodeData(data: Record<string, unknown>): AssetFileEntry | null {
  const text = String(data.output ?? '');
  if (!text.trim()) return null;
  const label = String(data.label ?? 'Text').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Text';
  const name = `${label}.md`;
  /* `btoa` 只吃 latin1 ⇒ 先 UTF-8 编码，避免中文内容写出来是乱码 */
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return {
    name,
    path: `virtual://${name}`,
    assetUrl: `data:text/markdown;base64,${btoa(binary)}`,
    size: bytes.byteLength,
    category: 'text',
  };
}

/**
 * 把节点保存到素材库（本地）。
 * @param nodeId 要保存的节点
 * @param folder 官方素材库文件夹名（`LIBRARY_FOLDERS` 的 label）；省略 = 落根目录
 */
export async function saveNodeToLibrary(nodeId: string, folder?: string): Promise<boolean> {
  const store = useAppStore.getState();
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return false;

  const data = node.data as unknown as Record<string, unknown>;
  const entry = extractFilesFromNodeData(data) ?? textEntryFromNodeData(data);
  if (!entry) {
    /* 官方错误文案 `library.failedToSaveToLibrary` */
    store.showToast('保存到素材库失败', 'error');
    return false;
  }

  const dest = await saveAssetToPermanent(entry, folder);
  if (!dest) {
    /* ★ 兜底：条目只有 URL、没有本地文件（`path = node://…`）时，按 URL 抓字节写盘 —— 见 `saveUrlAssetToPermanent` */
    const viaUrl = await saveUrlAssetToPermanent(entry, folder);
    if (!viaUrl) {
      store.showToast('保存到素材库失败', 'error');
      return false;
    }
    store.showToast(folder ? `已保存到「${folder}」` : '保存到素材库');
    return true;
  }
  /* 官方成功文案：有文件夹名 → `library.savedToFolder`「已保存到「{folder}」」；拿不到名字 → `library.saveToLibrary`「保存到素材库」 */
  store.showToast(folder ? `已保存到「${folder}」` : '保存到素材库');
  return true;
}
