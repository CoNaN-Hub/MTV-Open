/**
 * 解析并渲染消息中的节点、模型、Skill 和快捷指令引用，提供定位画布与查看详情交互。
 */
import { useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { useAppStore, type AppState } from '../../store/useAppStore';
import { getCanvasNodeById } from '../../utils/canvasRenderProjection';
import { useT } from '../../i18n';
import { focusCanvasNode } from '../../services/chat/nodeLinkChipModel';
import {
  nodeLinkPlaceholderType,
  nodeLinkSource,
  nodeLinkThumb,
} from '../../services/chat/nodeLinkChipModel';
import { NodeMentionChip } from './NodeLinkChip';
import MentionPreviewTooltip from './MentionPreviewTooltip';
import { OfficialPlaceholderGlyph, OfficialSkillAvatarIcon } from './officialIcons';

type ReferenceTokenKind = 'node' | 'model' | 'skill' | 'drama' | 'slash';

interface ReferenceToken {
  kind: ReferenceTokenKind;
  raw: string;
  label: string;
  id?: string;
  displayId?: number;
  start: number;
  end: number;
}

interface ChatReferenceTextProps {
  value: string;
  compact?: boolean;
}

export interface ChatReferenceHandlers {
  onNodeActivate?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onModelActivate?: (modelId: string) => void;
}

type InteractiveChatReferenceTextProps = ChatReferenceTextProps & ChatReferenceHandlers;

const TOKEN_PATTERN = /@\{([^:}\r\n]+):([^}\r\n]+)\}|@model\{([^|}\r\n]+)\|([^}\r\n]*)\}|@skill\{([^|}\r\n]+)\|([^}\r\n]*)\}|@drama\{([^:}\r\n]+):([^}\r\n]+)\}|\/[^\s/]*/g;

type NodeDisplayIdMap = ReadonlyMap<string, number | undefined>;

let cachedNodeDisplayIdSource: AppState['nodes'] | undefined;
let cachedNodeDisplayIds: NodeDisplayIdMap = new Map();

/**
 * Canvas drag and selection updates replace the nodes array on every frame while
 * node ids and display ids usually remain unchanged. Keep this derived snapshot
 * stable so every rendered chat reference does not subscribe to transient canvas state.
 */
// Exported for the selector regression test; it has no module initialization side effects.
// eslint-disable-next-line react-refresh/only-export-components
export function selectNodeDisplayIds(state: Pick<AppState, 'nodes'>): NodeDisplayIdMap {
  if (state.nodes === cachedNodeDisplayIdSource) return cachedNodeDisplayIds;

  let changed = state.nodes.length !== cachedNodeDisplayIds.size;
  if (!changed) {
    changed = state.nodes.some((node) => (
      !cachedNodeDisplayIds.has(node.id)
      || cachedNodeDisplayIds.get(node.id) !== node.data.displayId
    ));
  }

  cachedNodeDisplayIdSource = state.nodes;
  if (changed) {
    cachedNodeDisplayIds = new Map(
      state.nodes.map((node) => [node.id, node.data.displayId]),
    );
  }
  return cachedNodeDisplayIds;
}

/**
 * 官方 `fwe` 的标签解码语义（严格往返才认，否则原样保留）—— 见 `mentionTokens.ts:58`。
 * `mwe` 写入时是 `encodeURIComponent(label)`，读取端必须对称。
 */
function decodeLabel(value: string): string {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.trim() && encodeURIComponent(decoded) === value ? decoded : value;
  } catch {
    return value;
  }
}

function parseReferenceTokens(
  value: string,
  nodeDisplayIds: ReadonlyMap<string, number | undefined>,
): ReferenceToken[] {
  const tokens: ReferenceToken[] = [];
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const raw = match[0];
    const start = match.index;
    if (start == null) continue;

    if (raw.startsWith('/') && start > 0 && !/\s/.test(value[start - 1])) {
      continue;
    }

    const kind: ReferenceTokenKind = raw.startsWith('@{')
      ? 'node'
      : raw.startsWith('@model{')
        ? 'model'
      : raw.startsWith('@skill{')
        ? 'skill'
      : raw.startsWith('@drama{')
        ? 'drama'
        : 'slash';
    const label = kind === 'node'
      ? decodeLabel(match[2]) || '节点'
      : kind === 'model'
        ? match[4] || '模型'
      : kind === 'skill'
        ? decodeLabel(match[6]) || 'Skill'
      : kind === 'drama'
        ? match[8] || '资产'
        : raw.slice(1);
    const id = kind === 'node'
      ? match[1]
      : kind === 'model'
        ? match[3]
        : kind === 'skill'
          ? match[5]
          : kind === 'drama'
            ? match[7]
            : undefined;
    tokens.push({
      kind,
      raw,
      label,
      id,
      displayId: kind === 'node' && id ? nodeDisplayIds.get(id) : undefined,
      start,
      end: start + raw.length,
    });
  }
  return tokens;
}

/**
 * 消息里的**节点提及 chip** 的缩略图 / 预览载荷 —— 官方 `Uve` 那一份派生。
 *
 * 官方真机 DOM（CDP 9222 实测，`app.tapnow.media` 的「可爱的小猫」提及）：
 * ```html
 * <span class="mx-0.5 inline-flex align-middle" data-state="delayed-open" aria-describedby="radix-:r5q:">
 *   <span class="mention mention-node group … h-5 min-w-[24px] max-w-[120px] p-1 …"
 *         data-mention-type="node" style="border-radius:4px; background: rgb(40,40,40)">
 *     <button type="button" tabindex="0" class="inline-flex min-w-0 items-center gap-1 …">
 *       <img src="…variant_name=small" alt="可爱的小猫" class="object-cover shrink-0"
 *            style="width:14px; height:14px; border-radius:3px">
 *       <span class="truncate text-center text-xs font-normal leading-none transition-colors">可爱的小猫</span>
 *     </button>
 *   </span>
 * </span>
 * ```
 * 这个 chip 的**逐字实现本仓库已有**（`NodeLinkChip.tsx` 的 `NodeMentionChip` = 官方 `ls`）
 * ⇒ 这里直接复用，不另写一套。以前 MTV 在消息里自造了一个蓝色 `rounded-[7px] border` token
 * （竖线 + `#displayId`），与官方完全不是同一个东西。
 *
 * ⚠️ 选择器**只返回字符串**：画布拖动时 nodes 数组每帧换引用，返回对象会让聊天面板每帧重渲染
 * （同 `selectNodeDisplayIds` 的理由）。字符串在 hook 外解析成对象并 memo。
 */
function mentionPreviewKeyOf(nodes: AppState['nodes'], nodeId: string | undefined): string {
  if (!nodeId) return '';
  const node = getCanvasNodeById(nodes, nodeId);
  if (!node) return '';
  const data = (node.data ?? {}) as Record<string, unknown>;
  const nodeType = node.type ?? (typeof data.type === 'string' ? data.type : undefined);
  const src = nodeLinkSource(data, nodeType);
  const placeholderType = nodeLinkPlaceholderType(nodeType);
  /* 官方 `Uve`：`thumb` = 缩略变体（图片 = SMALL）、`previewSrc` = 原始 src
     （预览里的 `Lwe` 再取 SMALL）；视频的预览是 `<video src={previewSrc}>`。 */
  const thumb = nodeLinkThumb(nodeType, src);
  return JSON.stringify({
    src,
    thumb,
    placeholderType,
    textContent: typeof data.output === 'string' ? data.output : (typeof data.text === 'string' ? data.text : ''),
  });
}

function useMentionPreview(nodeId: string | undefined) {
  const key = useAppStore(useCallback((state: AppState) => mentionPreviewKeyOf(state.nodes, nodeId), [nodeId]));
  return useMemo(() => {
    if (!key) return null;
    try {
      return JSON.parse(key) as { src: string; thumb: string; placeholderType: string; textContent: string };
    } catch {
      return null;
    }
  }, [key]);
}

const INPUT_TOKEN_CLASSES: Record<ReferenceTokenKind, string> = {
  node: 'rounded-[5px] bg-primary/15 text-accent-primary ring-1 ring-inset ring-primary/25',
  model: 'rounded-[5px] bg-sky-400/15 text-sky-200 ring-1 ring-inset ring-sky-400/20',
  skill: 'rounded-[5px] bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/20',
  drama: 'rounded-[5px] bg-violet-400/15 text-violet-200 ring-1 ring-inset ring-violet-400/20',
  slash: 'rounded-[4px] bg-emerald-400/10 text-emerald-200',
};

const COMPACT_TOKEN_CLASSES: Record<ReferenceTokenKind, string> = {
  node: 'border-primary/25 bg-primary/10 text-accent-primary',
  model: 'border-sky-400/25 bg-sky-400/10 text-sky-100',
  skill: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
  drama: 'border-violet-400/25 bg-violet-400/10 text-violet-100',
  slash: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
};

const ACCENT_CLASSES: Record<ReferenceTokenKind, string> = {
  node: 'bg-accent-primary/70',
  model: 'bg-sky-300/70',
  skill: 'bg-emerald-300/70',
  drama: 'bg-violet-300/70',
  slash: 'bg-emerald-300/70',
};

interface CompactTokenProps extends ChatReferenceHandlers {
  token: ReferenceToken;
  missing?: boolean;
  onMissingNode: () => void;
}

function CompactToken({
  token,
  missing = false,
  onMissingNode,
  onNodeActivate,
  onNodeHover,
  onModelActivate,
}: CompactTokenProps) {
  const t = useT();
  const label = token.label;
  const interactive = token.kind === 'node' || token.kind === 'model';
  /* ⚠️ hooks 必须无条件调用（`token.kind` 会随内容变化）。 */
  const mentionPreview = useMentionPreview(token.kind === 'node' ? token.id : undefined);
  const activate = () => {
    if (token.kind === 'node' && token.id) {
      if (missing) onMissingNode();
      else onNodeActivate?.(token.id);
    }
    if (token.kind === 'model' && token.id) onModelActivate?.(token.id);
  };

  /* ★★ 节点提及 = **官方 `ls`(`NodeMentionChip`) + 官方 `Df` hover 预览浮层**（两者都逐字，
     见 `NodeLinkChip.tsx` 与 `MentionPreviewTooltip.tsx` 的文件头）。
     · 触发壳 = 官方真机那层 `span.mx-0.5 inline-flex align-middle`（Radix Trigger asChild 把
       `data-state` / `aria-describedby` / pointer 处理器合并到它身上 —— 与官方 DOM 一致）。
     · 点击出口不变（官方 `jc()` 宿主桥 ⇒ 画布素材预览对话框，见 `ChatPanel.handleNodeActivate`）。
     · `onNodeHover` 是 MTV 自己的「画布上那个节点的已连素材条高亮」联动，额外挂在同一层上。 */
  if (token.kind === 'node') {
    const placeholderType = (mentionPreview?.placeholderType ?? 'image') as 'text' | 'video' | 'audio' | 'file' | 'image';
    return (
      <MentionPreviewTooltip
        payload={{
          previewSrc: placeholderType === 'video' ? mentionPreview?.src : (mentionPreview?.thumb || undefined),
          label,
          textContent: mentionPreview?.textContent,
          placeholderType,
          placeholderIcon: <OfficialPlaceholderGlyph placeholderType={placeholderType} size={32} />,
        }}
      >
        <span
          className="mx-0.5 inline-flex align-middle"
          onMouseEnter={() => !missing && token.id && onNodeHover?.(token.id)}
          onMouseLeave={() => onNodeHover?.(null)}
        >
          <NodeMentionChip
            label={label}
            thumb={mentionPreview?.thumb ?? ''}
            placeholderType={placeholderType}
            onClick={activate}
            disabled={missing}
            bg="#282828"
            buttonTabIndex={0}
          />
        </span>
      </MentionPreviewTooltip>
    );
  }

  const content = (
    token.kind === 'skill' || token.kind === 'slash' ? (
      /* 官方 `NodeMentionPill`（`use-chat-attachment-file-input-*.js@158688`）的技能分支**逐字**：
         `E = leadingIcon ?? (mentionType === 'skill'
                ? <qs size={leadingIconSize} skillName={skillName ?? label}/> : undefined)`   // leadingIconSize = Jn = 14
         ⇒ 技能 chip 的**缩略图 = 官方 14px 技能头像**（`qs`：背景 PNG `skill-icon-background-Cc5WbgY8.png`
         + 25% 圆角 + 官方兜底 glyph `Kt`），外层壳：
           `mention mention-node group` + `cp = "relative inline-flex items-center justify-center align-middle gap-1
             h-5 min-w-[24px] max-w-[120px] p-1 cursor-pointer transition-[filter,box-shadow,color] duration-200 ease-out"`
           + `dp = "text-white/60 hover:text-white/80 hover:brightness-110 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"`
           + inline `{ borderRadius: '4px', background: '#333333' }`
         文案：`truncate text-center text-xs font-normal leading-none transition-colors` + `font-medium leading-5 text-text-text-primary`。 */
      <>
        <OfficialSkillAvatarIcon size={14} skillName={label} />
        <span className="truncate text-center text-xs font-normal leading-none transition-colors font-medium leading-5 text-text-text-primary">
          {label}
        </span>
      </>
    ) : (
      <>
        <span
          aria-hidden="true"
          className={`mr-1.5 h-3 w-0.5 shrink-0 rounded-full ${missing ? 'bg-red-300/65' : ACCENT_CLASSES[token.kind]}`}
        />
        <span className="truncate">{label || '/'}</span>
        {missing && <Icon icon="mdi:link-variant-off" width="12" className="ml-1.5 shrink-0" />}
      </>
    )
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={activate}
        aria-label={missing ? t('{label}，节点已不存在', { label }) : t('重新选择模型，当前为 {label}', { label })}
        data-tooltip={missing ? t('节点已不存在') : t('重新选择模型')}
        className={`mx-0.5 inline-flex max-w-full items-center rounded-[7px] border px-2 py-1 align-middle text-[0.92em] font-medium leading-none shadow-sm transition-[border-color,background-color,color,transform]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[0.98]
          ${missing
            ? 'border-red-400/25 bg-red-400/10 text-red-200/80'
            : `${COMPACT_TOKEN_CLASSES[token.kind]} hover:border-current hover:bg-foreground/5`}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={token.kind === 'skill' || token.kind === 'slash'
        /* ⚠️ 注意：**这里（对话消息里的引用）与输入框里的技能 chip 不是同一条官方源码**。
           消息里走的是 `InlineSkillReferenceChip`（`page-BeI7xydN.js@672710` 的 `RL`）：
           ```js
           const RL = memo(({skillName, label}) => {
             const n = useSkillLabelClick();
             return <span className="mr-1 my-1 inline-flex align-middle">
               <hs mentionType="skill" skillName={skillName} label={label} thumb=""
                   labelClassName="font-medium leading-5 text-text-text-primary"
                   buttonClassName="text-text-text-primary" onClick={…}/></span>;
           });
           ```
           `RL` **没有传 `bg`** ⇒ 用 `we` 的默认 `bg = '#333333'`（内联样式），
           壳 = `cp`（`gap-1 h-5 min-w-[24px] max-w-[120px] p-1`）+ `dp`（`text-white/60 hover:…`）。
           输入框里那条走的是节点视图（`ox`：`bg="transparent"` + `p-0` + 无 hover）⇒ 见 `ChatComposerEditor`。 */
        ? 'mention mention-node group relative mx-0.5 mr-1 my-1 inline-flex min-w-[24px] max-w-[120px] cursor-pointer items-center justify-center gap-1 rounded-[4px] p-1 align-middle text-white/60 transition-[filter,box-shadow,color] duration-200 ease-out hover:text-white/80 hover:brightness-110 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
        : `mx-0.5 inline-flex max-w-full items-center rounded-[7px] border px-2 py-1 align-middle text-[0.92em] font-medium leading-none shadow-sm ${COMPACT_TOKEN_CLASSES[token.kind]}`}
      style={token.kind === 'skill' || token.kind === 'slash' ? { borderRadius: '4px', background: '#333333' } : undefined}
    >
      {content}
    </span>
  );
}

export default function ChatReferenceText({
  value,
  compact = false,
  onNodeActivate,
  onNodeHover,
  onModelActivate,
}: InteractiveChatReferenceTextProps) {
  const t = useT();
  const nodeDisplayIds = useAppStore(selectNodeDisplayIds);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const showToast = useAppStore((state) => state.showToast);
  const setHoveredMentionNodeId = useAppStore((state) => state.setHoveredMentionNodeId);
  const tokens = parseReferenceTokens(value, nodeDisplayIds);
  if (tokens.length === 0) return <>{value}</>;

  /* 官方这些 mention chip 的点击出口是 `Ac().fitView({nodes:[{id}]})` ⇒ 在**画布页**被宿主桥
     `Ic().focusCanvasNodes` 接住 ⇒ 弹「画布素材预览」对话框（`jc()`@152784，见
     `services/chat/canvasResourcePreview.ts`）。未注入 `onNodeActivate` 时走同一条桥。 */
  /* 官方提及 chip 的点击出口 = `ID` 的 `w`（`jc().fitView` 居中放大到该节点，见
     `ChatPanel.handleNodeActivate` 的说明）。**不**走「画布素材预览」对话框 ——
     那条桥只属于 Studio 嵌画布；主画布真机实测点 chip 无弹窗。 */
  const activateNode = onNodeActivate ?? focusCanvasNode;
  const hoverNode = onNodeHover ?? setHoveredMentionNodeId;
  const activateModel = onModelActivate ?? ((modelId: string) => {
    window.dispatchEvent(new CustomEvent('chat-open-reference-menu', {
      detail: { kind: 'model', modelId },
    }));
  });

  const content: React.ReactNode[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (token.start > cursor) content.push(value.slice(cursor, token.start));
    const missing = token.kind === 'node'
      && !!currentProjectId
      && !!token.id
      && !nodeDisplayIds.has(token.id);
    content.push(compact
      ? (
          <CompactToken
            key={`${token.start}-${token.raw}`}
            token={token}
            missing={missing}
            onMissingNode={() => showToast(t('引用的节点已不存在'), 'error')}
            onNodeActivate={activateNode}
            onNodeHover={hoverNode}
            onModelActivate={activateModel}
          />
        )
      : (
          <span
            key={`${token.start}-${token.raw}`}
            className={INPUT_TOKEN_CLASSES[token.kind]}
          >
            {/* 官方提及 pill（`fF` / `MentionNodeView`）显示的是**条目标题**，不是 token 原文。
                直接渲染 `token.raw` 会把 `@{n15:%E9%A2%9D…}` 这种内部 token 露给用户。
                （`slash` 档的 `label` 是去掉前导 `/` 的命令名，原文才是 `/命令` ⇒ 它仍走 `raw`。）
                逐字依据：`describeMentionToken`（官方 `Wie`，`mentionTokens.ts:226`）产 `title`，
                官方可见文本一律取 `title`；`renderText` 只写进 `data-render-text` 属性。 */}
            {token.kind === 'slash' ? token.raw : (token.label || token.raw)}
          </span>
        ));
    cursor = token.end;
  }
  if (cursor < value.length) content.push(value.slice(cursor));
  return <>{content}</>;
}
