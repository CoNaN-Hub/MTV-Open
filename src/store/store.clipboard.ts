/**
 * Clipboard slice — copy / paste nodes including external content from OS clipboard
 */
import type { Edge, Node } from '@xyflow/react';
import type { StateCreator } from 'zustand';
import type { AppState } from './useAppStore';
import type { BaseNodeData, NodeGroup } from '../types';
import { generateId, computeImageNodeDimensions, blobToDataUrl } from './store.utils';
import { NODE_BASE_SIZE } from '../utils/nodeBounds';
import * as fileService from '../services/fileService';
import { startTransferBatch } from '../services/transferReporting';
import { copyNodeMedia, needsNodeMediaCopy, discardCopiedNodeMedia } from '../services/nodeMediaCopy';
import { registerCanvasImport, isCanvasDerivationFresh, completeCanvasDerivation } from '../services/canvasDerivationGuard';
/* ★ 粘贴图片时按**原图真实比例**设卡片比例 ✓（卡片尺寸由 `pR` 决定 ✓ 用户实测要求 ✓）
   ⚠️ 不用 `nearestAspectRatioString` ✗ —— 它会把非候选比例（如 5907:6497 ≈ 0.909）
      吸附到 **1:1** ✗ → 卡片 250×250 而原图 0.909 → `contain` 四周留白 ✗
      → 用户："尺寸不是原图的尺寸 **不贴片 不包裹**" ✓✓ */
import { nodeSizeForAspectRatio } from '../utils/nodeBounds';

export interface ClipboardSlice {
  clipboard: {
    nodes: Node<BaseNodeData>[];
    /**
     * 被复制节点**相连的边**的快照（参考 TapNow `copiedEdges`）。
     *
     * ⚠️ 之前这里**没有这个字段**，粘贴时却拿 `get().edges`（**当前/目标画布**的边）去 filter：
     *    · 跨画布粘贴时目标画布根本没有源画布的边 ⇒ 永远空集 ⇒ 「跨项复制粘贴后节点连接线没加上」✗✗
     *    · 而且判据 `idMap.has(edge.target)` 拿的是**新卡 id**（`idMap` 的 key 是源节点 id、
     *      value 才是新卡 id）⇒ 判据本身就写反了 ✗
     * 现在：复制时把边**一起快照**，粘贴时**从快照重建**（照 TapNow `she(copiedEdges, idMap, edges)`）。
     *
     * 收边规则沿用 MTV 既有契约（`clipboard.test.ts` 已锁定）：**看「目标端」**——
     *   · 目标端被复制（选区内部连线 / 外部连进来）⇒ 带上；
     *   · 只有源端被复制（连到选区外部的下游）⇒ 不带。
     *     （TapNow 的 `she` 连这种也带，但那样"复制一张卡粘到旁边"会立刻把副本接进原卡的下游链路，
     *       属于 MTV 明确不要的行为。）
     */
    edges: Edge[];
    groups: NodeGroup[];
    /** 复制时所在项目；粘贴到别的项目时需要把媒体文件复制过来 */
    projectId: string | null;
    /**
     * 已经粘贴过几次（复制时归零）。
     * 参考 TapNow `page-DPdEgTS0.js` 的 `du()` store：`pasteIteration` + `incrementPasteIteration`，
     * 每次粘贴整组偏移 `iteration * 40 / zoom`（**40 屏幕 px**）⇒ 连粘几次是整齐的阶梯，不会叠在一起。
     */
    pasteIteration: number;
  };
  copySelectedNodes: () => void;
  /** `zoom` = 当前画布缩放；给了才能把「40 屏幕 px」的阶梯换算成流坐标（TapNow 同款） */
  pasteNodes: (position: { x: number; y: number }, zoom?: number) => Promise<void>;
  pasteExternalContent: (position: { x: number; y: number }) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pasteExternalFromDataTransfer: (dt: any, position: { x: number; y: number }, maxItems?: number, actionName?: string) => Promise<void>;
}

/**
 * 复制节点时往**系统剪贴板**写的哨兵（TapNow 同款：`navigator.clipboard.writeText("__tapnow_internal_copy__")`）。
 *
 * 为什么要有它：节点数据走的是**内存剪贴板**，系统剪贴板里原本什么都没写 ⇒
 * 复制节点后切到别的应用粘贴，会粘出**上一次**留在剪贴板里的旧内容（旧图 / 旧文字），
 * 让人以为"我刚复制的卡片粘出去了"。写个哨兵就把它替换成一句人畜无害的说明。
 * 站内粘贴不读它 —— 贴节点只看 `clipboard.nodes`（与 TapNow 一致）。
 */
export const INTERNAL_COPY_SENTINEL = '__mtv_internal_copy__';

/** 把哨兵写进系统剪贴板；拿不到剪贴板权限时静默放过（不影响站内复制） */
function markInternalCopyInSystemClipboard(): void {
  try {
    void globalThis.navigator?.clipboard?.writeText?.(INTERNAL_COPY_SENTINEL)?.catch(() => {});
  } catch {
    /* 非安全上下文 / 无权限 ⇒ 忽略 */
  }
}

// ---- helper: 粘贴媒体落盘 ----

/** mime 子类型 → 文件扩展名（仅列出不一致的） */
const EXT_BY_MIME_SUBTYPE: Record<string, string> = { jpeg: 'jpg', 'svg+xml': 'svg', mpeg: 'mp3' };

/** 从 dataUrl 的 mime 推断扩展名 */
function extFromDataUrl(dataUrl: string, fallback: string): string {
  const m = dataUrl.match(/^data:\w+\/([\w+.-]+)[;,]/);
  if (!m) return fallback;
  const sub = m[1].toLowerCase();
  return EXT_BY_MIME_SUBTYPE[sub] || sub;
}

/**
 * 将粘贴的 dataUrl 媒体落盘到项目数据目录（与上传走同一套保存逻辑），
 * 返回节点媒体字段。非 Tauri 环境 / 无项目 / 写盘失败时回退为内存 dataUrl。
 */
async function persistPastedMedia(
  projectId: string | null,
  dataUrl: string,
  label: string,
  fallbackExt: string,
  /* ★ 有原始文件名时**直接用原名**（官方：粘贴本地文件落盘保持原名 ✓ 用户要求「显示名称应该是
     图片本身的名称」）—— 与「上传」路径一致（`copyFileToProjectData` 也是原名）✓
     没有原名（纯截图）才用 `buildNodeFileName(label,…)` 生成「粘贴图像--<hash>」✓ */
  preferredName?: string,
): Promise<{ url: string; filePath?: string; fileName?: string }> {
  if (projectId) {
    try {
      const fileName = preferredName
        ? preferredName
        : fileService.buildNodeFileName(label, extFromDataUrl(dataUrl, fallbackExt), 'paste');
      const saved = await fileService.saveDataUrlToProjectData(dataUrl, projectId, fileName);
      if (saved?.assetUrl) {
        const savedName = saved.filePath.replace(/\\/g, '/').split('/').pop() || fileName;
        return { url: saved.assetUrl, filePath: saved.filePath, fileName: savedName };
      }
    } catch { /* 落盘失败 → 回退内存态 */ }
  }
  return { url: dataUrl };
}

export const createClipboardSlice: StateCreator<AppState, [], [], ClipboardSlice> = (set, get) => ({
  clipboard: { nodes: [], edges: [], groups: [], projectId: null, pasteIteration: 0 },

  copySelectedNodes: () => {
    const { nodes, selectedNodeIds, groups } = get();
    if (selectedNodeIds.length === 0) return;

    // Collect all node IDs to copy: selected + descendants of selected group nodes
    const idsToCopy = new Set(selectedNodeIds);
    const q = [...selectedNodeIds];
    while (q.length > 0) {
      const pid = q.shift()!;
      const children = nodes.filter((n) => n.parentId === pid);
      for (const c of children) {
        if (!idsToCopy.has(c.id)) {
          idsToCopy.add(c.id);
          q.push(c.id); // handle nested groups
        }
      }
    }

    // data 做浅快照：不与源节点共享同一对象，之后编辑源节点不会改到剪贴板内容
    const copiedNodes = nodes
      .filter((n) => idsToCopy.has(n.id))
      .map((n) => ({ ...n, data: { ...n.data } }));
    const copiedGroups = groups.filter((g) => idsToCopy.has(g.id)).map((g) => ({ ...g }));
    /* ★ 相连的边一起快照（TapNow `copiedEdges`）：**目标端在选区里**就带上 ——
         选区内部的连线（两端都重映射）、外部连进来的连线（只重映射目标端）都会跟着走；
         只从选区连出去的连线不带（MTV 既有契约，见上方字段注释）。 */
    const copiedEdges = get()
      .edges.filter((edge) => idsToCopy.has(edge.target))
      .map((edge) => ({ ...edge }));
    set({
      clipboard: {
        nodes: copiedNodes,
        edges: copiedEdges,
        groups: copiedGroups,
        projectId: get().currentProjectId,
        /* 复制 ⇒ 阶梯归零（TapNow 的 `resetPasteIteration()`） */
        pasteIteration: 0,
      },
    });
    /* ★ 顺手往系统剪贴板写哨兵（TapNow 同款；见 `INTERNAL_COPY_SENTINEL` 的注释） */
    markInternalCopyInSystemClipboard();
  },

  pasteNodes: async (position, zoom) => {
    const { clipboard } = get();
    if (clipboard.nodes.length === 0) return;
    let copiedNodes = clipboard.nodes;
    if (copiedNodes.some((node) => needsNodeMediaCopy(node.data))) {
      const guard = registerCanvasImport(get());
      if (!guard) { get().showToast('请先创建项目再复制媒体', 'error'); return; }
      get().showToast('正在复制素材…');
      const staged: { data: BaseNodeData; source: BaseNodeData }[] = [];
      let ready = false;
      try {
        copiedNodes = [];
        for (const node of clipboard.nodes) {
          const data = needsNodeMediaCopy(node.data) ? await copyNodeMedia(node.data, guard.projectId) : node.data;
          if (data !== node.data) staged.push({ data, source: node.data });
          if (!isCanvasDerivationFresh(guard, get())) { get().showToast('画布已变化，请重新粘贴'); return; }
          copiedNodes.push({ ...node, data });
        }
        ready = true;
      } catch {
        if (get().currentProjectId === guard.projectId) get().showToast('素材复制失败，请重新粘贴', 'error');
        return;
      } finally {
        completeCanvasDerivation(guard);
        if (!ready) for (const item of staged) await discardCopiedNodeMedia(item.data, item.source);
      }
    }
    get().commitToHistory();

    /* ★★★★ 落点 + 阶梯 —— 与 **TapNow** `page-DPdEgTS0.js` 的 `k_()` 里的 `pasteCopiedNodes` 对齐：
       ① 锚点 = 调用方给的落点（视口中心 / 右键位置 / 鼠标位置）；
       ② 位置 = **被复制内容的包围盒左上角** 对齐到锚点（组内相对布局原样保留）；
       ③ 阶梯 = `pasteIteration * 40 / zoom` —— 即**每次粘贴整组右下偏移 40 个屏幕 px**，
          除以 zoom 换算成流坐标。连粘几次就是整齐的阶梯，永远不会逐像素叠在一起
          （TapNow 原文：`const J = P * 40 / F;` ← `P = pasteIteration`、`F = getZoom()`）。
       ⚠️ 别退回「按源卡片绝对坐标落」✗：跨画布时会整个落在新画布视口之外（看不见＝用户说的
          「粘贴不过去」）；同一个画布连粘几次则**逐像素重叠**（实测三组卡片坐标完全相同）。 */
    const originX = Math.min(...clipboard.nodes.map((node) => node.position.x));
    const originY = Math.min(...clipboard.nodes.map((node) => node.position.y));
    const anchorX = position?.x ?? originX;
    const anchorY = position?.y ?? originY;
    const safeZoom = zoom && zoom > 0 ? zoom : 1;
    const step = 40 / safeZoom;
    const cascade = { x: clipboard.pasteIteration * step, y: clipboard.pasteIteration * step };
    /* 用完就 +1（TapNow 的 `incrementPasteIteration()`）；下一次粘贴自动再挪一格 */
    set((s) => ({ clipboard: { ...s.clipboard, pasteIteration: s.clipboard.pasteIteration + 1 } }));

    const idMap = new Map<string, string>();

    // Build IDs for ALL copied nodes first
    clipboard.nodes.forEach((node) => {
      const newId = `node-${generateId()}`;
      idMap.set(node.id, newId);
    });

    // Prepare new nodes with remapped parentId and group ID
    const newNodes: Node<BaseNodeData>[] = copiedNodes.map((node) => {
      const newId = idMap.get(node.id)!;
      const newNode: Node<BaseNodeData> = {
        ...node,
        id: newId,
        position: {
          x: anchorX + cascade.x + (node.position.x - originX),
          y: anchorY + cascade.y + (node.position.y - originY),
        },
        selected: false,
      };
      // Remap parentId
      if (newNode.parentId && idMap.has(newNode.parentId)) {
        newNode.parentId = idMap.get(newNode.parentId);
      } else if (newNode.parentId && clipboard.projectId !== get().currentProjectId) {
        newNode.parentId = undefined;
        newNode.extent = undefined;
      }
      // Remap data.groupId for group nodes
      if (newNode.data?.groupId && idMap.has(newNode.data.groupId as string)) {
        newNode.data = { ...newNode.data, groupId: idMap.get(newNode.data.groupId as string) };
      }
      return newNode;
    });

    // Create new group entries with remapped nodeIds
    const newGroups: NodeGroup[] = clipboard.groups.map((g) => ({
      ...g,
      id: idMap.get(g.id) || g.id,
      nodeIds: g.nodeIds.map((nid) => idMap.get(nid) || nid),
      createdAt: Date.now(),
    }));
    const usedNames = new Set(get().groups.map((group) => group.name));
    for (const group of newGroups) {
      const baseName = group.name;
      let suffix = 2;
      while (usedNames.has(group.name)) group.name = `${baseName} ${suffix++}`;
      usedNames.add(group.name);
      const groupNode = newNodes.find((node) => node.id === group.id);
      if (groupNode) groupNode.data = { ...groupNode.data, label: group.name };
    }

    // Add new groups to store
    set((s) => ({
      groups: [...s.groups, ...newGroups],
    }));

    // Add nodes: group nodes first, children after (xyflow requirement)
    const groupNodes = newNodes.filter((n) => n.type === 'group');
    const childNodes = newNodes.filter((n) => n.type !== 'group');
    get().addNodesTransient([...groupNodes, ...childNodes]);

    /* ★★ 连线按**剪贴板里快照的边**重建（照 TapNow `she(copiedEdges, idMap, edges)`）：
       被复制的那一端换成新卡 id，没被复制的那一端保持原 id。
       再要求**两端在目标画布上都真实存在**才落库 —— 否则跨画布粘贴会留下
       指向"不存在的卡片"的**悬空连线**（画不出来、也删不掉，纯噪音）；TapNow 会留下它。
       注：同画布粘贴时上游原卡还在 ⇒ 外部连进来的连线照旧保留 ✓。 */
    const liveNodeIds = new Set(get().nodes.map((node) => node.id));
    const rebuiltEdges = clipboard.edges.flatMap((edge) => {
      const source = idMap.get(edge.source) ?? edge.source;
      const target = idMap.get(edge.target) ?? edge.target;
      if (!liveNodeIds.has(source) || !liveNodeIds.has(target)) return [];
      return [{ ...edge, id: `edge-${generateId()}`, source, target }];
    });
    if (rebuiltEdges.length > 0) {
      set((state) => ({ edges: [...state.edges, ...rebuiltEdges] }));
    }

    get().commitToHistory();
    get().showToast(`已粘贴 ${clipboard.nodes.length} 个节点`);

  },

  pasteExternalContent: async (position) => {
    const state = get();
    if (typeof navigator === 'undefined' || !navigator.clipboard?.read) {
      state.showToast('当前环境不支持读取剪贴板', 'error');
      return;
    }
    const currentProjectId = state.currentProjectId;
    const projectId = currentProjectId && currentProjectId !== 'default' ? currentProjectId : null;

    const offsets = [
      { x: 0, y: 0 },
      { x: 40, y: 40 },
      { x: 80, y: 80 },
      { x: -40, y: 40 },
      { x: -80, y: 80 },
    ];

    let pastedCount = 0;
    let historyCommitted = false;
    const addPastedNode = (node: Node<BaseNodeData>) => {
      if (!historyCommitted) {
        get().commitToHistory();
        historyCommitted = true;
      }
      get().addNodeTransient(node);
    };

    try {
      const items = await navigator.clipboard.read();
      if (!items || items.length === 0) {
        state.showToast('剪贴板为空', 'error');
        return;
      }

      for (let i = 0; i < items.length && i < offsets.length; i++) {
        const item = items[i];
        const offset = offsets[i];
        const nodePos = { x: position.x + offset.x, y: position.y + offset.y };

        /* ★★★★★ **优先 `text/uri-list`** ✗✓（用户实测要求 ✓ 权威 ✓）
           事故：**从资源管理器 Ctrl+C 复制文件**时，剪贴板里**同时**有
             · `image/png`（缩略图 ✓）
             · `text/uri-list`（**文件路径** ✓）
           而 MTV 原来**先判 `image/`** ✗ → **永远走像素分支** ✗✓
             → 拿不到本地文件名 ✗ → 标题变成 `粘贴图像--<uuid>` ✗
             → 用户："从本地粘贴到画布的卡片标题依旧没解决" ✓✓
           现在：**有路径就走路径分支** ✓（拿到「南京」✓）· 没路径（截图 ✓）才走像素分支 ✓
           官方行为一致 ✓（官方粘贴本地文件显示的是**文件名去扩展名** ✓ 用户实测 ✓）*/
        const hasUriList = item.types.includes('text/uri-list');
        if (!hasUriList && item.types.some((t) => t.startsWith('image/'))) {
          const imageType = item.types.find((t) => t.startsWith('image/'))!;
          const blob = await item.getType(imageType);
          const dataUrl = await blobToDataUrl(blob);
          /* ★ 名称 = **图片本身的文件名**（官方行为 ✓ 用户要求「粘贴到画布显示名称应该是图片本身的名称」）：
               优先该 DataTransferItem 的 `File.name`（从资源管理器/网页复制时 Chromium 会带上），
               退一步用整个 DataTransfer 的 `files[0].name`，都拿不到（纯截图）才退回「粘贴图像」/「Image」。 */
          /* ⚠️ 这里读的是 `navigator.clipboard.read()` 的 `ClipboardItem`，**没有 DataTransfer 对象**
             ⇒ 原来那句 `?? (dt.files && dt.files[0])` 是旧实现的残留（`dt` 未定义，运行时 ReferenceError）。
             `ClipboardItem.getAsFile()` 是 Chromium 扩展（TS lib 未收录）⇒ 显式收窄后调用。 */
          const clipItem = item as unknown as { getAsFile?: () => File | null };
          const clipFile = typeof clipItem.getAsFile === 'function' ? clipItem.getAsFile() : null;
          const clipName = clipFile?.name && clipFile.name !== 'image.png' ? clipFile.name : '';
          const imageNodeLabel = clipName ? clipName.replace(/\.[^.]+$/, '') : 'Image';
          const media = await persistPastedMedia(projectId, dataUrl, imageNodeLabel, 'png', clipName || undefined);
          const dims = await computeImageNodeDimensions(media.url);

          const newNode: Node<BaseNodeData> = {
            id: `node-${generateId()}`,
            type: 'ai-image',
            position: nodePos,
            data: {
              /* ★ 标题 = **`File.name` 去扩展名** ✓（有真名时 ✓）；无真名（截图）才是 'Image' ✓
                 + 卡片尺寸用**原图真实比例** ✓✓（不吸附到候选列表 ✗）
                   事故（用户截图 ✓）：原图 5907×6497（ratio 0.9092 ✓）
                     `nearestAspectRatioString` 把它吸附到 **1:1** ✗（候选里没有 9:10 ✓）
                     → 卡片 250×250 ✗ 而原图 0.909 ✗ → `contain` 四周留白 ✗
                     → 用户："尺寸不是原图的尺寸 **不贴片 不包裹**" ✓✓
                   官方做法 ✓：卡片尺寸 = `pR(原图真实比例)` ✓（实测：9:16 图 → 250×444 ✓ = 真实比例 ✓）
                   → 存 `'5907:6497'` 这样的**原始比** ✓（`aspectRatioValue` 能解析 `W:H` ✓）
                   → `pR` 得 **250×275** ✓ 与 `contain` 完美贴合 ✓ 零留白 ✓✓ */
              label: imageNodeLabel,
              type: 'ai-image', role: 'source', imageUrl: media.url,
              filePath: media.filePath, fileName: media.fileName, status: 'success', ...dims,
              ...(dims.imageWidth && dims.imageHeight
                ? (() => {
                  const w = dims.imageWidth as number;
                  const h = dims.imageHeight as number;
                  const sz = nodeSizeForAspectRatio(w / h);
                  return { aspectRatio: `${w}:${h}`, nodeWidth: sz.width, nodeHeight: sz.height };
                })()
                : {}),
            },
          };
          addPastedNode(newNode);
          pastedCount++;
        } else if (item.types.some((t) => t.startsWith('video/'))) {
          const videoType = item.types.find((t) => t.startsWith('video/'))!;
          const blob = await item.getType(videoType);
          const dataUrl = await blobToDataUrl(blob);
          const media = await persistPastedMedia(projectId, dataUrl, '粘贴视频', 'mp4');

          const newNode: Node<BaseNodeData> = {
            id: `node-${generateId()}`,
            type: 'ai-video',
            position: nodePos,
            data: {
              label: 'Video', type: 'ai-video', role: 'source', videoUrl: media.url,
              filePath: media.filePath, fileName: media.fileName, status: 'success',
            },
          };
          addPastedNode(newNode);
          pastedCount++;
        } else if (item.types.some((t) => t.startsWith('audio/'))) {
          const audioType = item.types.find((t) => t.startsWith('audio/'))!;
          const blob = await item.getType(audioType);
          const dataUrl = await blobToDataUrl(blob);
          const media = await persistPastedMedia(projectId, dataUrl, '粘贴音频', 'mp3');

          const newNode: Node<BaseNodeData> = {
            id: `node-${generateId()}`,
            type: 'ai-audio',
            position: nodePos,
            data: {
              label: 'Audio', type: 'ai-audio', role: 'source', audioUrl: media.url,
              filePath: media.filePath, fileName: media.fileName, status: 'success', nodeWidth: 260, nodeHeight: 140,
            },
          };
          addPastedNode(newNode);
          pastedCount++;
        } else if (item.types.includes('text/html')) {
          const htmlBlob = await item.getType('text/html');
          const html = await htmlBlob.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const img = doc.querySelector('img');
          if (img?.src) {
            let dataUrl: string | null = null;
            /* ★ 网页 <img> 复制的名称：`file://` 时取**本地文件名去扩展名** ✓；其余（data:/http）无真名 ⇒ `Image` ✓ */
            let htmlSrcName = '';
            if (img.src.startsWith('data:')) {
              dataUrl = img.src;
            } else if (img.src.startsWith('file://')) {
              const filePath = fileService.fileUriToPath(img.src);
              htmlSrcName = filePath.split(/[\\/]/).pop() || '';
              dataUrl = await fileService.readFileToDataUrl(filePath);
            } else if (img.src.startsWith('http://') || img.src.startsWith('https://')) {
              try {
                const resp = await fetch(img.src);
                const fetchedBlob = await resp.blob();
                dataUrl = await blobToDataUrl(fetchedBlob);
              } catch { /* skip */ }
            }

            if (dataUrl) {
              const htmlLabel = htmlSrcName ? htmlSrcName.replace(/\.[^.]+$/, '') : 'Image';
              const media = await persistPastedMedia(projectId, dataUrl, htmlLabel, 'png', htmlSrcName || undefined);
              const dims = await computeImageNodeDimensions(media.url);
              const newNode: Node<BaseNodeData> = {
                id: `node-${generateId()}`,
                type: 'ai-image',
                position: nodePos,
                data: {
                  /* ★ 标题 = 本地文件名去扩展名 ✓ + 写入 aspectRatio ✓（用户实测要求 ✓）*/
                  label: htmlLabel,
                  type: 'ai-image', role: 'source', imageUrl: media.url,
                  filePath: media.filePath, fileName: media.fileName, status: 'success', ...dims,
                  ...(dims.imageWidth && dims.imageHeight
                    ? (() => {
                      /* ★ 同上传路径：用**原图真实比例** ✓（不吸附到候选 ✗ 否则会留白 ✓）*/
                      const w = dims.imageWidth as number;
                      const h = dims.imageHeight as number;
                      const sz = nodeSizeForAspectRatio(w / h);
                      return { aspectRatio: `${w}:${h}`, nodeWidth: sz.width, nodeHeight: sz.height };
                    })()
                    : {}),
                },
              };
              addPastedNode(newNode);
              pastedCount++;
            }
          }
        } else if (hasUriList) {
          const uriBlob = await item.getType('text/uri-list');
          const uriText = await uriBlob.text();
          const uris = uriText.split('\n').filter((u) => u.trim().startsWith('file://'));

          for (let j = 0; j < uris.length && pastedCount < offsets.length; j++) {
            const uri = uris[j].trim();
            const filePath = fileService.fileUriToPath(uri);
            const ext = filePath.split('.').pop()?.toLowerCase() || '';

            const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
            const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
            const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac'];

            let mediaType: 'image' | 'video' | 'audio' | null = null;
            if (imageExts.includes(ext)) mediaType = 'image';
            else if (videoExts.includes(ext)) mediaType = 'video';
            else if (audioExts.includes(ext)) mediaType = 'audio';

            if (mediaType) {
              const dataUrl = await fileService.readFileToDataUrl(filePath);
              if (dataUrl) {
                const uriOffset = offsets[pastedCount] || { x: pastedCount * 40, y: pastedCount * 40 };
                const uriNodePos = { x: position.x + uriOffset.x, y: position.y + uriOffset.y };

                const srcName = filePath.split(/[\\/]/).pop() || '粘贴文件';
                const baseLabel = srcName.replace(/\.[^.]+$/, '');
                if (mediaType === 'image') {
                  const media = await persistPastedMedia(projectId, dataUrl, baseLabel, ext);
                  const dims = await computeImageNodeDimensions(media.url);
                  const newNode: Node<BaseNodeData> = {
                    id: `node-${generateId()}`,
                    type: 'ai-image',
                    position: uriNodePos,
                    data: {
                      /* ★ 标题 = 本地文件名**去扩展名** ✓（用户实测：`南京.jpg` → 「南京」✓）
                         原来用 `srcName`（含扩展名 ✗）→ 显示「南京.jpg」✗
                         + 写入 aspectRatio ✓（卡片按图片比例 ✓ 9:16 → 250×444 ✓）*/
                      label: baseLabel, type: 'ai-image', role: 'source', imageUrl: media.url,
                      filePath: media.filePath, fileName: media.fileName, status: 'success', ...dims,
                      ...(dims.imageWidth && dims.imageHeight
                        ? (() => {
                          /* ★ 用**原图真实比例** ✓（不吸附到候选 ✗ 否则会留白 ✓）*/
                          const w = dims.imageWidth as number;
                          const h = dims.imageHeight as number;
                          const sz = nodeSizeForAspectRatio(w / h);
                          return { aspectRatio: `${w}:${h}`, nodeWidth: sz.width, nodeHeight: sz.height };
                        })()
                        : {}),
                    },
                  };
                  addPastedNode(newNode);
                } else if (mediaType === 'video') {
                  const media = await persistPastedMedia(projectId, dataUrl, baseLabel, ext);
                  const newNode: Node<BaseNodeData> = {
                    id: `node-${generateId()}`,
                    type: 'ai-video',
                    position: uriNodePos,
                    data: {
                      label: baseLabel, type: 'ai-video', role: 'source', videoUrl: media.url,
                      filePath: media.filePath, fileName: media.fileName, status: 'success',
                    },
                  };
                  addPastedNode(newNode);
                } else if (mediaType === 'audio') {
                  const media = await persistPastedMedia(projectId, dataUrl, baseLabel, ext);
                  const newNode: Node<BaseNodeData> = {
                    id: `node-${generateId()}`,
                    type: 'ai-audio',
                    position: uriNodePos,
                    data: {
                      label: baseLabel, type: 'ai-audio', role: 'source', audioUrl: media.url,
                      filePath: media.filePath, fileName: media.fileName, status: 'success', nodeWidth: 260, nodeHeight: 140,
                    },
                  };
                  addPastedNode(newNode);
                }
                pastedCount++;
              }
            }
          }
        } else if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = await blob.text();

          if (!text.trim()) continue;

          /* 官方文本卡固定 250×250（内容区滚动，不按行数撑高）*/
          const newNode: Node<BaseNodeData> = {
            id: `node-${generateId()}`,
            type: 'ai-text',
            position: nodePos,
            data: { label: '粘贴文本', type: 'ai-text', role: 'source', output: text, status: 'success', nodeWidth: NODE_BASE_SIZE.width, nodeHeight: NODE_BASE_SIZE.height },
          };
          addPastedNode(newNode);
          pastedCount++;
        }
      }

      if (historyCommitted) get().commitToHistory();
      if (pastedCount > 0) {
        get().showToast(`已粘贴 ${pastedCount} 个源节点`);
      } else {
        get().showToast('剪贴板无可识别内容', 'error');
      }
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e?.name === 'NotAllowedError') {
        get().showToast('无剪贴板读取权限', 'error');
      } else {
        console.error('External clipboard paste failed:', err);
        get().showToast('无法读取剪贴板', 'error');
      }
    }
  },

  pasteExternalFromDataTransfer: async (dt, position, maxItems = 10, actionName = '粘贴') => {
    if (!dt) return;
    /* 官方：一次粘贴 = **一批**传输行（`prepareForNewBatch` 只在没有在途项时清空上一批）
       ⇒ 这一批用同一个 batchKey，批内多张图不会被互相清掉；上一批已结束的行会被新一批替换
       （用户：「上传一次就是一次，不叠加」） */
    startTransferBatch(`paste:${Date.now().toString(36)}`);
    const currentProjectId = get().currentProjectId;
    const projectId = currentProjectId && currentProjectId !== 'default' ? currentProjectId : null;

    const offsets = Array.from({ length: maxItems }, (_, i) => ({
      x: (i % 5) * 40, y: Math.floor(i / 5) * 40,
    }));

    let pastedCount = 0;
    let historyCommitted = false;
    const addPastedNode = (node: Node<BaseNodeData>) => {
      if (!historyCommitted) {
        get().commitToHistory();
        historyCommitted = true;
      }
      get().addNodeTransient(node);
    };
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
    const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac'];

    // 粘贴媒体统一先落盘到项目目录（与上传一致），失败/浏览器环境回退 dataUrl
    const addImageNode = async (dataUrl: string, idx: number, sourceName?: string) => {
      /* ★ `p.name` = 该 DataTransferItem 里 `File.name`（从资源管理器/网页复制时 Chromium 会带 ✓）
         —— 这是**图片本身的名称** ✓（用户要求：「执行粘贴到画布 显示名称应该是图片本身的名称」）
         纯截图（Chromium 造的名字是 `image.png`）没有真名 ⇒ 回退官方类型名 `Image` ✓ */
      const rawName = sourceName && sourceName !== 'image.png' ? sourceName : '';
      const baseLabel = rawName ? rawName.replace(/\.[^.]+$/, '') : 'Image';
      const media = await persistPastedMedia(projectId, dataUrl, baseLabel, 'png', rawName || undefined);
      const dims = await computeImageNodeDimensions(media.url);
      /* ★★★★ **按用户实测（权威 ✓）修粘贴图片的两处** ✓✓
         ① **标题 = 本地文件名去掉扩展名** ✓
            用户实测：本地 `南京.jpg` 粘贴到画布 → 显示 **「南京」**（不带扩展名 ✓）
            原来写 `label: '粘贴图像'` ✗ → 显示「粘贴图像」✗
            （这与「上传按钮」不同 ✓ —— 上传按钮显示 "Image" ✓ 用户也实测过 ✓ 两条路径本就不同 ✓）
            去扩展名用官方同款拆分（EXE `s1e`：`e.slice(0, e.lastIndexOf('.'))` ✓）
         ② **必须写 `aspectRatio`** ✗✓ —— 卡片尺寸完全由 `pR(data.aspectRatio)` 决定 ✓
            原来只给 `...dims`（nodeHeight）✗ → 比例没变 ✗ → 卡片比例不对 ✓（用户实测 ✓）
            → 按图片真实宽高匹配官方候选 ✓（9:16 图 → '9:16' → 卡片 250×444 ✓）*/
      const w = dims.imageWidth as number | undefined;
      const h = dims.imageHeight as number | undefined;
      /* ★ 用**原图真实比例** ✓（不吸附到候选 ✗ 否则会留白 ✓）*/
      const sized = w && h ? nodeSizeForAspectRatio(w / h) : null;
      const newNode: Node<BaseNodeData> = {
        id: `node-${generateId()}`,
        type: 'ai-image',
        position: { x: position.x + offsets[idx].x, y: position.y + offsets[idx].y },
        data: {
          label: baseLabel, type: 'ai-image', role: 'source', imageUrl: media.url,
          filePath: media.filePath, fileName: media.fileName, status: 'success', ...dims,
          ...(sized && w && h
            ? { aspectRatio: `${w}:${h}`, nodeWidth: sized.width, nodeHeight: sized.height }
            : {}),
        },
      };
      addPastedNode(newNode);
    };

    const addVideoNode = async (dataUrl: string, idx: number) => {
      const media = await persistPastedMedia(projectId, dataUrl, '粘贴视频', 'mp4');
      const newNode: Node<BaseNodeData> = {
        id: `node-${generateId()}`,
        type: 'ai-video',
        position: { x: position.x + offsets[idx].x, y: position.y + offsets[idx].y },
        data: {
          label: 'Video', type: 'ai-video', role: 'source', videoUrl: media.url,
          filePath: media.filePath, fileName: media.fileName, status: 'success',
        },
      };
      addPastedNode(newNode);
    };

    const addAudioNode = async (dataUrl: string, idx: number) => {
      const media = await persistPastedMedia(projectId, dataUrl, '粘贴音频', 'mp3');
      const newNode: Node<BaseNodeData> = {
        id: `node-${generateId()}`,
        type: 'ai-audio',
        position: { x: position.x + offsets[idx].x, y: position.y + offsets[idx].y },
        data: {
          label: 'Audio', type: 'ai-audio', role: 'source', audioUrl: media.url,
          filePath: media.filePath, fileName: media.fileName, status: 'success', nodeWidth: 260, nodeHeight: 140,
        },
      };
      addPastedNode(newNode);
    };

    const addTextNode = (text: string, idx: number) => {
      /* 官方文本卡固定 250×250（内容区滚动，不按行数撑高）*/
      const newNode: Node<BaseNodeData> = {
        id: `node-${generateId()}`,
        type: 'ai-text',
        position: { x: position.x + offsets[idx].x, y: position.y + offsets[idx].y },
        data: { label: '粘贴文本', type: 'ai-text', role: 'source', output: text, status: 'success', nodeWidth: NODE_BASE_SIZE.width, nodeHeight: NODE_BASE_SIZE.height },
      };
      addPastedNode(newNode);
    };

    const parsedItems = await parseDataTransferItems(dt);
    if (parsedItems.length === 0) return;

    for (const p of parsedItems) {
      if (pastedCount >= maxItems) break;
      const off = offsets[pastedCount] || { x: pastedCount * 40, y: pastedCount * 40 };

      if (p.kind === 'file' && p.filePath && projectId) {
        // Try to copy file to project data dir via file path
        const filePath = p.filePath;
        const fileName = filePath.split(/[\\/]/).pop() || 'file';
        const extLower = fileName.split('.').pop()?.toLowerCase() || '';

        if (imageExts.includes(extLower)) {
          const nodeId = `node-${generateId()}`;
          /* ★ 卡片标题 = **文件本身的名称去扩展名** ✓（用户要求 ✓ 与粘贴/上传其余路径统一 ✓）*/
          const imageLabel = fileName.replace(/\.[^.]+$/, '');
          const newNode: Node<BaseNodeData> = {
            id: nodeId,
            type: 'ai-image',
            position: { x: position.x + off.x, y: position.y + off.y },
            data: { label: imageLabel, type: 'ai-image', role: 'source', status: 'loading', nodeWidth: 333, nodeHeight: 160 },
          };
          addPastedNode(newNode);
          pastedCount++;

          // Copy file to project data dir asynchronously
          fileService.copyFileToProjectData(filePath, projectId).then(async (result) => {
            if (result?.assetUrl) {
              const dims = await computeImageNodeDimensions(result.assetUrl);
              get().updateNodeDataTransient(nodeId, {
                label: imageLabel, imageUrl: result.assetUrl, filePath: result.filePath,
                fileName: result.fileName, status: 'success', ...dims,
              });
            } else {
              // Fallback to in-memory data URL if copy fails
              const dataUrl = await fileService.readFileToDataUrl(filePath);
              if (dataUrl) {
                const dims = await computeImageNodeDimensions(dataUrl);
                get().updateNodeDataTransient(nodeId, {
                  imageUrl: dataUrl, fileName, label: imageLabel, status: 'success', ...dims,
                });
              } else {
                get().updateNodeDataTransient(nodeId, { status: 'error', error: '无法读取文件' });
              }
            }
          }).catch((err) => {
            get().updateNodeDataTransient(nodeId, { status: 'error', error: err instanceof Error ? err.message : '复制失败' });
          });
        } else if (videoExts.includes(extLower)) {
          const nodeId = `node-${generateId()}`;
          const newNode: Node<BaseNodeData> = {
            id: nodeId, type: 'ai-video',
            position: { x: position.x + off.x, y: position.y + off.y },
            data: { label: fileName, type: 'ai-video', role: 'source', status: 'loading', nodeWidth: 333, nodeHeight: 160 },
          };
          addPastedNode(newNode);
          pastedCount++;

          fileService.copyFileToProjectData(filePath, projectId).then((result) => {
            if (result?.assetUrl) {
              get().updateNodeDataTransient(nodeId, {
                label: result.fileName, videoUrl: result.assetUrl, filePath: result.filePath,
                fileName: result.fileName, status: 'success',
              });
            }
          }).catch((err) => {
            get().updateNodeDataTransient(nodeId, { status: 'error', error: err instanceof Error ? err.message : '复制失败' });
          });
        } else if (audioExts.includes(extLower)) {
          const nodeId = `node-${generateId()}`;
          const newNode: Node<BaseNodeData> = {
            id: nodeId, type: 'ai-audio',
            position: { x: position.x + off.x, y: position.y + off.y },
            data: { label: fileName, type: 'ai-audio', role: 'source', status: 'loading', nodeWidth: 260, nodeHeight: 140 },
          };
          addPastedNode(newNode);
          pastedCount++;

          fileService.copyFileToProjectData(filePath, projectId).then((result) => {
            if (result?.assetUrl) {
              get().updateNodeDataTransient(nodeId, {
                label: result.fileName, audioUrl: result.assetUrl, filePath: result.filePath,
                fileName: result.fileName, status: 'success',
              });
            }
          }).catch((err) => {
            get().updateNodeDataTransient(nodeId, { status: 'error', error: err instanceof Error ? err.message : '复制失败' });
          });
        }
      } else if (p.kind === 'file' && p.filePath) {
        // No projectId available — read into memory
        const dataUrl = await fileService.readFileToDataUrl(p.filePath);
        if (dataUrl) {
          const ext = (p.filePath || '').split('.').pop()?.toLowerCase() || '';
          if (imageExts.includes(ext)) {
            await addImageNode(dataUrl, pastedCount, (p.filePath || '').split(/[\\/]/).pop());
            pastedCount++;
          } else if (videoExts.includes(ext)) {
            await addVideoNode(dataUrl, pastedCount);
            pastedCount++;
          } else if (audioExts.includes(ext)) {
            await addAudioNode(dataUrl, pastedCount);
            pastedCount++;
          }
        }
      } else if (p.kind === 'image') {
        // 浏览器复制的图像走此分支：先落盘再建节点，避免 base64 常驻节点数据
        await addImageNode(p.dataUrl!, pastedCount, p.name);
        pastedCount++;
      } else if (p.kind === 'text') {
        addTextNode(p.text!, pastedCount);
        pastedCount++;
      }
    }

    if (historyCommitted) get().commitToHistory();
    if (pastedCount > 0) {
      get().showToast(`${actionName} ${pastedCount} 个源节点`);
    } else {
      get().showToast('无可识别内容', 'error');
    }
  },
});

// ---- helper: parse dataTransfer into structured items ----

interface ParsedDTItem {
  kind: 'text' | 'image' | 'file';
  text?: string;
  dataUrl?: string;
  filePath?: string;
  /* ★ 该 item 的 `File.name` = **图片本身的名称** ✓（用户要求粘贴后显示它 ✓）*/
  name?: string;
}

async function parseDataTransferItems(dt: DataTransfer): Promise<ParsedDTItem[]> {
  const items: ParsedDTItem[] = [];
  const files = Array.from(dt.files || []);
  const rawItems = Array.from(dt.items || []);

  // Process files first
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
    if (imageExts.includes(ext)) {
      try {
        const dataUrl = await blobToDataUrl(file);
        items.push({ kind: 'image', dataUrl, name: file.name });
        continue;
      } catch {
        // 读取失败时继续走下面的路径探测与兜底
      }
    }
    // Try to detect file path for Tauri drag-drop
    try {
      const dtItem = rawItems.find((ri) => ri.kind === 'file');
      if (dtItem) {
        const fileEntry = await getAsFileSystemHandle(dt);
        if (fileEntry) {
          items.push({ kind: 'file', filePath: fileEntry });
          continue;
        }
      }
    } catch {
      // 非 Tauri 环境或无路径权限时忽略，改用 dataUrl 兜底
    }
    // Fallback: try reading as dataUrl
    try {
      const dataUrl = await blobToDataUrl(file);
      if (imageExts.includes(ext)) {
        items.push({ kind: 'image', dataUrl, name: file.name });
      }
    } catch {
      // 兜底也失败则跳过该文件
    }
  }

  // Process text/uri-list/html data
  if (dt.types.includes('text/uri-list')) {
    const uriText = dt.getData('text/uri-list');
    const uris = uriText.split('\n').filter((u) => u.trim().startsWith('file://'));
    for (const uri of uris) {
      const filePath = fileService.fileUriToPath(uri.trim());
      items.push({ kind: 'file', filePath });
    }
  }

  if (dt.types.includes('text/html')) {
    const html = dt.getData('text/html');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const img = doc.querySelector('img');
    if (img?.src) {
      if (img.src.startsWith('data:')) {
        items.push({ kind: 'image', dataUrl: img.src });
      }
    }
  }

  if (dt.types.includes('text/plain')) {
    const text = dt.getData('text/plain');
    if (text.trim()) {
      items.push({ kind: 'text', text });
    }
  }

  return items;
}

/** Tauri / 宿主环境扩展出来的字段，标准 DOM 类型里没有声明 */
type FileSystemHandleCapableTransfer = DataTransfer & {
  getAsFileSystemHandle?: () => Promise<unknown>;
};
type PathBearingFile = File & { path?: string };

async function getAsFileSystemHandle(dt: DataTransfer): Promise<string | null> {
  try {
    const entries = await (dt as FileSystemHandleCapableTransfer).getAsFileSystemHandle?.();
    if (!entries) return null;
    // For multiple items, just return the first path
    const files = dt.files;
    if (files.length > 0) {
      // On Tauri/Windows, files may have a path property
      const file = files[0] as PathBearingFile;
      if (file.path) return file.path;
    }
    return null;
  } catch {
    return null;
  }
}

