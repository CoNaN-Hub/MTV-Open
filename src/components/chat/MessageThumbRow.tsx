/**
 * 官方「消息缩略行」—— `page-BeI7xydN.js`@676532 的 `DL`（`ContextThumb`）+
 * @677585 的 `BP`（`AttachmentThumb`）与 `bS`（`MessageThumbRow`）逐字。
 *
 * 官方原文（`Z0` 分派里 `item.type === 'context_nodes'` 就走这条）：
 *   `ContextThumb({nodeId})`   48×48 圆角方块；有缩略图 ⇒ `bg-white/[0.08]` + `img object-cover`，
 *                              否则 `border border-white/10` + 按节点类型给 tabler 兜底图标（18px）；
 *                              节点已不存在 ⇒ `opacity-50 cursor-default`；点击 `fitView({nodes:[{id}]})`。
 *   `AttachmentThumb({attachment})` 同尺寸；`mime_type` 以 `image/`⇒`img`、`video/`⇒帧图或 `video#t=0.1`、否则图标。
 *   `MessageThumbRow({nodeIds, attachments})` = `OverflowFade`（class `flex items-start gap-3
 *      overflow-x-auto overscroll-x-contain`，`fadeFromClassName="from-surface-secondary"`）；
 *      两者都空 ⇒ `null`。
 *
 * ⚠️ MTV 侧对应数据本来就是消息上的 `contextNodeIds` / `attachments`（`ChatMessage` 里已有），
 *    所以这条是**端到端可用**的官方 UI。节点信息用 `getState()` 惰性读（不做 selector，避免画布每次
 *    改动都重渲染消息列表），与 `ContextStrip` 里官方 `zL` 的做法一致。
 */
import { useCallback, type ReactNode } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ChatAttachment } from '../../types/chat';
import OverflowFade from './OverflowFade';
import { bestNodeThumb } from '../nodes/shared/mentionEditorDom';
import {
  OfficialFileIcon,
  OfficialFileTextIcon,
  OfficialMusicIcon,
  OfficialVideoIcon,
} from './officialIcons';

/**
 * 官方 `nT(type)`（`vendor-pkg-canvas-D-XuoEJY.js` @427246 逐字）的 MTV 版：
 * ```js
 * nT = e => { switch(e){ case X.TEXT: case X.DOC_EDITOR: return "text";
 *   case X.VIDEO: case X.VIDEO_EDIT: return "video"; case X.AUDIO: return "audio";
 *   case X.IMAGE: return "image"; default: return "file" } }
 * ```
 * ⚠️ **官方节点类型名与 MTV 不同**（官方 `X.IMAGE = "image"`、`X.VIDEO = "video"`；
 * MTV 是 `ai-image` / `source-image` / `ai-video` / …）。原来直接比 `type === 'image'` ⇒
 * **永远不匹配** ⇒ 缩略块恒为空框 + 兜底文档图标（用户截图 图1 vs 官方 图2）。
 */
function nodeThumbKind(type: string | undefined): 'image' | 'video' | 'audio' | 'text' | 'file' {
  switch (type) {
    case 'ai-image':
    case 'source-image':
    case 'ai-animation':
    case 'ai-panorama':
    case 'ai-storyboard':
    case 'ai-director':
    case 'compare':
      return 'image';
    case 'ai-video':
    case 'source-video':
      return 'video';
    case 'ai-audio':
    case 'source-audio':
      return 'audio';
    case 'ai-text':
    case 'ai-markdown':
    case 'ai-shotlist':
    case 'source-text':
    case 'canvas-note':
    case 'comment':
      return 'text';
    default:
      return 'file';
  }
}

/** 官方节点缩略方块的公共类串。 */
function thumbClass(hasThumb: boolean, missing: boolean): string {
  return [
    'relative flex h-12 w-12 items-center justify-center rounded-md overflow-hidden shrink-0',
    hasThumb ? 'bg-white/[0.08]' : 'border border-white/10',
    missing ? 'opacity-50 cursor-default' : 'cursor-pointer transition-all',
  ]
    .filter(Boolean)
    .join(' ');
}

/** 官方 `DL`：画布节点缩略块。 */
function ContextThumb({ nodeId, onActivate }: { nodeId: string; onActivate?: (nodeId: string) => void }) {
  /* 官方从画布 `nodeLookup` 取；MTV 用 `getState()` 惰性取（同 `ContextStrip`）。 */
  const node = useAppStore.getState().nodes.find((item) => item.id === nodeId);
  const data = (node?.data ?? {}) as { type?: string; label?: string; title?: string; name?: string };
  const kind = nodeThumbKind(data.type);
  /* 官方 `ND(type, data.src)`（@427153）按官方节点类型派生缩略图 URL；MTV 的节点类型名不同、
     本地资产还要过 `convertFileSrc` ⇒ 用 MTV 自己那份等价解析器 `bestNodeThumb`
     （与 `@` 提及面板、`getNodeMetaMap` 同一份，不另造一套）。 */
  const thumbUrl = node ? bestNodeThumb(node.data as { imageUrl?: unknown; thumbnailUrl?: unknown; filePath?: unknown }) : undefined;
  const hasThumb = Boolean(thumbUrl) && (kind === 'image' || kind === 'video');
  const label = data.label || data.title || data.name || `node_${nodeId.slice(0, 6)}`;

  const handleClick = useCallback(() => {
    if (!node) return;
    onActivate?.(nodeId);
  }, [node, nodeId, onActivate]);

  const fallback: ReactNode =
    kind === 'video' ? (
      <OfficialVideoIcon size={18} className="text-muted-foreground/60" />
    ) : kind === 'audio' ? (
      <OfficialMusicIcon size={18} className="text-muted-foreground/60" />
    ) : kind === 'text' ? (
      <OfficialFileTextIcon size={18} className="text-muted-foreground/60" />
    ) : (
      <OfficialFileIcon size={18} className="text-muted-foreground/60" />
    );

  return (
    <button type="button" onClick={handleClick} title={label} className={thumbClass(hasThumb, !node)}>
      {hasThumb ? <img src={thumbUrl} alt={label} className="block h-full w-full object-cover" /> : fallback}
    </button>
  );
}

/** 官方 `BP`：消息附件缩略块。 */
function AttachmentThumb({ attachment }: { attachment: ChatAttachment }) {
  const type = attachment.type;
  const hasThumb = type === 'image' || type === 'video';
  return (
    <div className={thumbClass(hasThumb && Boolean(attachment.src), false)} title={attachment.name ?? attachment.src}>
      {type === 'image' && attachment.src ? (
        <img src={attachment.src} alt={attachment.name ?? ''} className="block h-full w-full object-cover" />
      ) : type === 'video' && attachment.thumbnailUrl ? (
        <img src={attachment.thumbnailUrl} alt="" className="block h-full w-full object-cover" />
      ) : type === 'video' && attachment.src ? (
        <video
          src={`${attachment.src}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="block h-full w-full object-cover"
        />
      ) : type === 'video' ? (
        <OfficialVideoIcon size={18} className="text-muted-foreground/60" />
      ) : (
        <OfficialFileIcon size={18} className="text-muted-foreground/60" />
      )}
    </div>
  );
}

/** 官方 `bS`（`MessageThumbRow`）：引用节点 + 附件缩略行；两者都空 ⇒ 不渲染。 */
export default function MessageThumbRow({
  nodeIds,
  attachments,
  onNodeActivate,
}: {
  nodeIds?: string[];
  attachments?: ChatAttachment[];
  onNodeActivate?: (nodeId: string) => void;
}) {
  const nodes = nodeIds?.length ? nodeIds : [];
  const files = attachments?.length ? attachments : [];
  if (nodes.length === 0 && files.length === 0) return null;
  return (
    <OverflowFade
      className="flex items-start gap-3 overflow-x-auto overscroll-x-contain"
      fadeFromClassName="from-surface-secondary"
      deps={[nodes.length, files.length]}
    >
      {nodes.map((nodeId) => (
        <ContextThumb key={nodeId} nodeId={nodeId} onActivate={onNodeActivate} />
      ))}
      {files.map((attachment) => (
        <AttachmentThumb key={attachment.src} attachment={attachment} />
      ))}
    </OverflowFade>
  );
}
