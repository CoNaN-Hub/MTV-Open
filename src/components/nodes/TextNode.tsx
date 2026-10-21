/**
 * TextNode 文本节点 — 在画布上渲染文本内容，支持编辑、复制、清除空行、全屏、拖拽调整大小
 */
import { memo, useState, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { BaseNodeData } from '../../types';
import NodeLabel from './shared/NodeLabel';
import NodeError from './shared/NodeError';
import TextNodeToolbar from './shared/TextNodeToolbar';
import NodeToolbarShell from './shared/NodeToolbarShell';
import NodeResizeHandles from './shared/NodeResizeHandles';
import { useIsDirectSingleSelection } from '../../hooks/useIsDirectSingleSelection';
import GooeyBtn from './shared/GooeyBtn';
import TextFullscreenViewer, { type ViewerAnchorRect } from './shared/TextFullscreenViewer';
import { useNodeRename } from './shared/useNodeRename';
import { useAppStore } from '../../store/useAppStore';
import { uploadSourceFile } from '../../services/fileService';
import { useCompletionFlash } from '../../hooks/useCompletionFlash';
import { useNodeInPile } from '../../hooks/useNodeInPile';
import { NODE_BASE_SIZE } from '../../utils/nodeBounds';
import { renderMarkdown } from '../../utils/renderMarkdown';
import { useT } from '../../i18n';

/**
 * MTV 旧版文本卡是**按行数自撑高度**（`textNodeHeight = clamp(40+行数*20, 120, 600)`）⇒ 画布数据里
 * 存过这些算出来的值。官方是固定尺寸 ⇒ 这些历史值一并归一（只认「旧算法可能算出来的值」的并集，
 * 用户其它手工值不动）。
 */
const LEGACY_AUTO_HEIGHTS = new Set(
  Array.from({ length: 29 }, (_, i) => Math.min(600, Math.max(120, 40 + i * 20))),
);

function AITextNode({ id, data, selected, dragging }: { id: string; data: BaseNodeData; selected?: boolean; dragging?: boolean }) {
  const t = useT();
  const justCompleted = useCompletionFlash(data.status);
  const updateNodeData = useAppStore((s) => s.updateNodeData);
  const updateNodeDataTransient = useAppStore((s) => s.updateNodeDataTransient);
  const commitToHistory = useAppStore((s) => s.commitToHistory);
  const openNodeDialog = useAppStore((s) => s.openNodeDialog);
  /** ★ 官方门 `nd(id)`：`selectionSource==="direct" && 单选 && ids.has(id)`（框选不算） */
  const isDirectSingleSelection = useIsDirectSingleSelection(id);
  /* ★ 堆叠成员不显示自身工具栏（官方由堆叠工具栏统一操作成员）—— 见 `useNodeInPile` 注释。 */
  const inPile = useNodeInPile(id);
  const isSource = data.role === 'source';
  const [isUploading, setIsUploading] = useState(false);

  // ── 官方放大面板（媒体查看器）──
  /* 官方两个入口**同一个面板、同一个编辑态**：`Gee` → `H_(id,{mode:"edit"})`
     ⇒ ① 卡片双击（`Vee` 的 `onDoubleClick`）② 工具栏「全屏」（`Og` 的 `handle: onEdit`）。
     `mode` 为 `"edit"` 时面板里就是编辑器（官方 `contentClassName` 带 `!px-10 !py-8`）。
     ⚠️ MTV 原来的「卡内 textarea 就地编辑」没有官方对应物 ⇒ 已删，改走这个面板。 */
  const [viewerMode, setViewerMode] = useState<'view' | 'edit' | null>(null);
  const [viewerAnchor, setViewerAnchor] = useState<ViewerAnchorRect | null>(null);
  const viewerEditActiveRef = useRef(false);

  const openViewer = useCallback((mode: 'view' | 'edit') => {
    if (data.status === 'loading') return;
    viewerEditActiveRef.current = false;
    /* 官方 `sourceAnchor`（`Jbe(nodeId)` 登记的卡片矩形）⇒ 面板从卡片位置形变到全屏 */
    const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setViewerAnchor({ x: r.left, y: r.top, width: r.width, height: r.height });
    } else {
      setViewerAnchor(null);
    }
    setViewerMode(mode);
  }, [data.status, id]);

  const handleViewerChange = useCallback((next: string) => {
    if (!viewerEditActiveRef.current) {
      commitToHistory();
      viewerEditActiveRef.current = true;
    }
    updateNodeDataTransient(id, { output: next });
  }, [commitToHistory, id, updateNodeDataTransient]);

  const handleCloseViewer = useCallback(() => {
    if (viewerEditActiveRef.current) {
      commitToHistory();
      viewerEditActiveRef.current = false;
    }
    setViewerMode(null);
  }, [commitToHistory]);

  const handleViewerDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openViewer('edit');
  }, [openViewer]);

  // ── Copy ──
  const handleCopyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  }, []);

  /* ★ 官方文本卡默认尺寸 = `Ha` = `Od` = **250×250**（`zoom-slider-3ZcFvYQO.js` @2787783 起的两个
     文本创建器 `wT`(纯文本) / `Dx`(生成文本) 都写 `width: Ha.width, height: Ha.height`）。
     ⚠️ 旧 MTV 默认是 **333×160**（更早还写过 280×160），已持久化进画布数据 ⇒ 这两个旧默认值
        在渲染时归一到官方默认（只认这几个具体数值，用户手动改过的其它尺寸一律保持）。
     ⚠️ 官方**不按内容行数撑高卡片**：内容区 `overflow-y-auto` 自己滚动（见 nodes-text.css） */
  const storedWidth = data.nodeWidth as number | undefined;
  const storedHeight = data.nodeHeight as number | undefined;
  const nodeWidth = storedWidth === undefined || storedWidth === 280 || storedWidth === 333
    ? NODE_BASE_SIZE.width
    : storedWidth;
  const nodeHeight = storedHeight === undefined || LEGACY_AUTO_HEIGHTS.has(storedHeight)
    ? NODE_BASE_SIZE.height
    : storedHeight;

  
  // ── Toolbar actions ──
  const handleCopyToClipboardFn = useCallback(
    (text: string) => handleCopyToClipboard(text),
    [handleCopyToClipboard],
  );

  const handleClearEmptyLines = useCallback(() => {
    if (!data.output) return;
    const cleaned = data.output.replace(/\n{3,}/g, '\n\n');
    if (cleaned !== data.output) {
      updateNodeData(id, { output: cleaned });
    }
  }, [id, data.output, updateNodeData]);

  /* 官方工具栏「全屏」的 `handle` 就是 `onEdit` ⇒ 与**双击卡片**同一个入口（`H_(id,{mode:"edit"})`）*/
  const handleOpenFullscreen = useCallback(() => {
    openViewer('edit');
  }, [openViewer]);

  const handleShowPrompt = useCallback(() => {
    const nodeElement = document.querySelector(`.react-flow__node[data-id="${id}"]`);
    if (nodeElement) {
      const rect = nodeElement.getBoundingClientRect();
      openNodeDialog(id, { x: rect.left + rect.width / 2, y: rect.bottom });
      return;
    }
    openNodeDialog(id);
  }, [id, openNodeDialog]);

  // ── Upload handler for source nodes ──
  const handleUpload = useCallback(async () => {
    setIsUploading(true);
    try {
      const result = await uploadSourceFile('.txt,.md,.json,.csv,.xml,.yaml,.yml,.log');
      if (!result) return;

      // Read the text content from the data URL
      let textContent = '';
      if (result.dataUrl.startsWith('data:text/')) {
        const base64 = result.dataUrl.split(',')[1];
        try {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          textContent = new TextDecoder('utf-8').decode(bytes);
        } catch {
          textContent = atob(base64);
        }
      } else {
        // For binary files, just show the dataUrl
        textContent = result.dataUrl;
      }

      /* 官方文本卡**固定 250×250** ⇒ 上传文本只写内容，不动卡片尺寸（内容区自己滚动）*/
      updateNodeData(id, {
        output: textContent,
        fileName: result.fileName,
        label: result.fileName,
        status: 'success',
      } as Partial<BaseNodeData>);
    } catch {
      // silently ignore
    } finally {
      setIsUploading(false);
    }
  }, [id, updateNodeData]);

  const { displayLabel, handleRename } = useNodeRename(id, data, t('粘贴文本'));

  // ── Render ──
  return (
    <>
    <div className="node-wrapper relative" style={{ width: nodeWidth, height: nodeHeight }}>
      {/* ★ 官方出现门（`jl`=NodeToolbarLayer：`visible && !isLoading && nd(id)`；`eT` 再叠 `!isDragging`）
          ⚠️ 文本节点官方**不看有没有产出**：`Hee` 传的是 `visible: !!selected`（`zoom-slider` @3386111），
             只叠 `!generating`（`isLoading`）⇒ MTV 原来多写的 `&& !!data.output` 已按源码去掉；
             `nd(id)` = 直接单选（框选/多选不算）。 */}
      <NodeToolbarShell visible={isDirectSingleSelection && data.status !== 'loading' && !inPile} isDragging={dragging}>
        <TextNodeToolbar
          nodeId={id}
          data={data}
          onCopy={handleCopyToClipboardFn}
          onClearEmptyLines={handleClearEmptyLines}
          onShowPrompt={handleShowPrompt}
          onFullscreen={handleOpenFullscreen}
        />
      </NodeToolbarShell>
      <NodeLabel
        kind="ai-text"
        label={displayLabel}
        displayId={data.displayId as number | undefined}
        nodeId={id}
        onRename={handleRename}
      />
      {/* 官方文本节点是 `resizable:!0`，外壳 `yW({minWidth:250,minHeight:250})` ⇒ 最小 250×250 */}
      <NodeResizeHandles nodeId={id} />
      <div
        className={`node text-node ${selected ? 'selected' : ''} ${data.status === 'loading' ? 'loading' : ''} ${justCompleted ? 'just-completed' : ''}`}
        /* ★ 官方外壳 `gIe` @1223400：`style={{ … backgroundColor: data.color }}`
           ⇒ 文本卡「背景颜色」（工具栏第 1 格 `mQ`）直接就是**卡片底色** ✓ */
        style={{
          height: nodeHeight,
          ...(data.color ? { backgroundColor: data.color as string } : {}),
        }}
      >
        <div className="node-preview compact">
          {isSource && (
            <button
              className="node-upload-btn"
              onClick={(e) => { e.stopPropagation(); handleUpload(); }}
              data-tooltip={t('上传文本文件')}
              aria-label={t('上传文本文件')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
          )}
          {data.output ? (
            /* ★ 官方文本内容（`Vee` @3386111 + `UP` @485188）：
                 容器 `relative flex h-full w-full cursor-default flex-col overflow-y-auto px-4 py-3`
                      + `scrollbar-width: thin` / `scrollbar-color: #ffffff20 transparent`
                 内容 = **Markdown 渲染**（官方 `UP` = `<div class="canvas-text-markdown"><ReactMarkdown/></div>`）
                 排版 1rem / 段落 1.7（官方 `canvas-text-markdown` 规则，见 styles/nodes-text.css）
                 双击 = 官方 `onDoubleClick → onEdit` ⇒ 打开**放大面板**（编辑态） */
            <div
              className="text-output-content compact nowheel"
              onDoubleClick={handleViewerDoubleClick}
              title={t('双击编辑')}
            >
              {/* ★ 官方结构是**两层**（`zoom-slider-3ZcFvYQO.js` @3386148）：
                    外层 `Vee` = `relative flex h-full w-full cursor-default flex-col overflow-y-auto px-4 py-3`
                    （= MTV 的 `.text-output-content.compact`）
                    ├ 内层 `UP` = `<div className="canvas-text-markdown">` + ReactMarkdown
                    └ `UP` 是 **block** ⇒ 块之间的 margin 在里面**折叠**（官方实测块间距 16/12/7.2/8 = `max()`）
                  MTV 原来把 markdown 直接塞进外层（少一层）⇒ 外层是 flex-col（不折叠）⇒ 间距变成 `sum()` ✗
                  ⇒ 补上这层 `.canvas-text-markdown`，排版规则也由官方那一份统一驱动（卡片/编辑区共用）。 */}
              <div className="canvas-text-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(data.output) }} />
            </div>
          ) : isUploading ? (
            <div className="node-preview-loading">
              <div className="spinner" />
              <span>{t('上传中...')}</span>
            </div>
          ) : data.status === 'loading' ? (
            <div className="node-preview-loading">
              <div className="spinner" />
              <span>{t('生成中...')}</span>
            </div>
          ) : (
            <div
              className="node-preview-placeholder text-node-empty-editable"
              data-inline-edit-trigger="true"
              onDoubleClick={handleViewerDoubleClick}
              title={t('双击编辑')}
            >
              {/* 官方空卡提示（`Vee` 逐字）：`text-[15px] leading-6 text-muted-foreground/80` +
                  i18n `nodes.doubleClickToEdit` =「双击开始编辑...」 */}
              <span className="text-node-edit-hint">{t('双击开始编辑...')}</span>
            </div>
          )}
        </div>

        {data.error && <NodeError nodeId={id} message={data.error} />}

        {/* 官方文本卡**没有卡内编辑**（`Vee` 是只读视图）⇒ 这里不再隐藏手柄；
            编辑在放大面板里进行（`media-viewer__text-panel`）。 */}
        <Handle type="source" position={Position.Left} id="left" className="node-handle handle-source handle-text">
          <GooeyBtn className="gooey-btn-left" hue={234} />
        </Handle>
        <Handle type="source" position={Position.Right} id="right" className="node-handle handle-source handle-text">
          <GooeyBtn className="gooey-btn-right" hue={234} />
        </Handle>
      </div>
    </div>

    {/* 官方放大面板（媒体查看器文本分支）：卡片双击 / 工具栏「全屏」都开这个（`H_(id,{mode:"edit"})`） */}
    <TextFullscreenViewer
      open={viewerMode !== null}
      editable={viewerMode === 'edit'}
      text={(data.output as string) || ''}
      title={(data.label as string) || 'Text'}
      anchor={viewerAnchor}
      onChange={handleViewerChange}
      onClose={handleCloseViewer}
    />
    </>
  );
}

export default memo(AITextNode);
