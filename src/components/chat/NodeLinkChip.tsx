/**
 * NodeLinkChip —— 官方「画布节点 chip」两支的**逐字**移植：
 *   · `DF`（`displayName = "NodeLink"`，canvas @2413267 / @2413076 邻域）
 *   · `ls`（`NodeMentionPill` 壳，canvas @155848）与其缩略图 `zR`（canvas @154295）
 *
 * 官方逐字：
 * ```js
 * // @2413267  DF：画布节点 chip（工具行详情里那一行 chips 的单元）
 * DF = a.memo(({nodeId: e, tool: t, title: n}) => {
 *   const {fitView: o} = Ac();                                   // 画布控制器（见 nodeLinkChipModel.focusCanvasNode）
 *   const {t: r} = se();
 *   const i = Zt(a.useCallback(b => e ? b.nodeLookup.get(e) ?? null : null, [e]));
 *   const [l, c] = a.useState(!0);                               // 占位态
 *   const d = a.useRef(!!i); i && (d.current = !0);
 *   a.useEffect(() => { if (!l) return; const b = window.setTimeout(() => c(!1), 400);
 *                       return () => window.clearTimeout(b); }, [l]);
 *   const u = i?.data ?? {},
 *         p = typeof u.src == "string" ? u.src : "",
 *         m = ND(i?.type, p), f = nT(i?.type),
 *         h = kot({dataTitle: u.title, payloadTitle: n, nodeExists: !!i, nodeType: i?.type, tool: t, t: r}),
 *         g = a.useCallback(() => { !i || !e || o({nodes: [{id: e}], padding: 1, maxZoom: 2, minZoom: .5, duration: 500}); },
 *                           [o, i, e]),
 *         x = d.current && !i,
 *         y = l ? !1 : x;                                        // disabled
 *   return s.jsx(ls, {label: h, thumb: m, onClick: g, disabled: y, placeholderType: f, bg: "#282828"});
 * });
 * DF.displayName = "NodeLink";
 *
 * // @155848  ls：chip 壳（本文件只保留 DF 实际会传的 6 个 props，DOM 与官方完全一致）
 * ls = a.memo(({label: e, thumb: t, onClick: n, showDelete: o = !1, onDelete: r,
 *                disabled: i = !1, placeholderType: l = "image", bg: c = "#333333", className: d,
 *                leadingIcon: u, leadingIconSize: p = zj, title: m, mentionType: f = "node",
 *                skillName: h, labelClassName: g, buttonClassName: x, buttonAriaLabel: y,
 *                buttonTabIndex: b = -1}) => {
 *   const _ = a.useCallback(N => { N.preventDefault(), N.stopPropagation(), r?.(); }, [r]),
 *         v = u ?? (f === "skill" ? s.jsx(jR, {size: p, skillName: h ?? e}) : void 0),
 *         w = !n && !o,
 *         C = z("inline-flex min-w-0 items-center gap-1",
 *                w ? "cursor-default" : "cursor-pointer border-0 bg-transparent p-0", x);
 *   const S = s.jsxs(s.Fragment, {children: [
 *     v ? s.jsx("span", {className: z("inline-flex shrink-0 items-center justify-center", i && "opacity-50"),
 *                        style: {width: p, height: p}, children: v})
 *       : s.jsx(zR, {thumb: t ?? "", label: e, placeholderType: l, disabled: i}),
 *     s.jsx("span", {className: z("truncate text-center text-xs font-normal leading-none transition-colors", g),
 *                    children: e})]});
 *   return s.jsxs("span", {
 *     className: z("mention mention-node group", Lve, i ? Ove : Fve, w && "cursor-default", d),
 *     "data-mention-type": f,
 *     title: m,
 *     style: i ? void 0 : {borderRadius: "4px", background: c},
 *     children: [
 *       w ? s.jsx("span", {className: C, children: S})
 *         : s.jsx("button", {type: "button", tabIndex: b, onClick: i ? void 0 : n, className: C,
 *                            "aria-label": y, children: S}),
 *       o && r && s.jsx("button", {…删除按钮…})]});
 * });
 *
 * // @154295  zR：缩略图
 * zR = a.memo(({thumb: e, label: t, placeholderType: n = "image", disabled: o = !1}) => {
 *   const [r, i] = a.useState(!1);
 *   return !e?.trim() || r ? s.jsx(OR, {placeholderType: n, disabled: o})
 *     : s.jsx("img", {src: e, alt: t, className: z("object-cover shrink-0", o && "opacity-50 grayscale"),
 *                     style: {width: zj, height: zj, borderRadius: "3px"}, onError: () => i(!0)});
 * });
 * ```
 *
 * 类名常量（canvas 本地，@152236 / @152336 逐字）：
 *   `zj = 14` · `Rve = 14`
 *   `Lve = "relative inline-flex items-center justify-center align-middle gap-1 h-5 min-w-[24px]
 *           max-w-[120px] p-1 cursor-pointer transition-[filter,box-shadow,color] duration-200 ease-out"`
 *   `Fve = "text-white/60 hover:text-white/80 hover:brightness-110
 *           hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"`
 *   `Ove = "bg-muted text-muted-foreground border-border"`
 *
 * 图标：`OR`（官方 `Ys`，占位 glyph）已在本仓库 `officialIcons.tsx` 以 `OfficialPlaceholderGlyph`
 *   **逐字**落地（canvas chunk 的 `OR` 与 MTV 已有的官方 `Ys` 完全同构：`size ?? 14`、`opacity = disabled ? .4 : .6`、
 *   外层 `span.inline-flex.items-center.justify-center.shrink-0` + 内层 `b3[placeholderType] ?? b3.image`），
 *   故直接复用，不重复内联 path。
 */
import { memo, useCallback, useEffect, useState } from 'react';
import { getLocale, useT } from '../../i18n';
import { getCanvasNodeById } from '../../utils/canvasRenderProjection';
import { useAppStore, type AppState } from '../../store/useAppStore';
import { OfficialPlaceholderGlyph } from './officialIcons';
import {
  focusCanvasNode,
  nodeLinkDataTitle,
  nodeLinkPlaceholderType,
  nodeLinkSource,
  nodeLinkThumb,
  officialNodeTypeOf,
  resolveNodeLinkLabel,
} from '../../services/chat/nodeLinkChipModel';

/** 官方 `zj` / `Rve`：chip 缩略图与占位 glyph 的尺寸。 */
const CHIP_THUMB_SIZE = 14;
/** 官方 `Lve`：chip 基类。 */
const CHIP_BASE_CLASS = [
  'relative inline-flex items-center justify-center align-middle gap-1 h-5 min-w-[24px] max-w-[120px] p-1',
  'cursor-pointer transition-[filter,box-shadow,color] duration-200 ease-out',
].join(' ');
/** 官方 `Fve`：chip 常态色。 */
const CHIP_ENABLED_CLASS = [
  'text-white/60 hover:text-white/80 hover:brightness-110',
  'hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
].join(' ');
/** 官方 `Ove`：chip 禁用态（同时 `style` 也为 `undefined`）。 */
const CHIP_DISABLED_CLASS = 'bg-muted text-muted-foreground border-border';

export interface NodeMentionChipProps {
  label: string;
  thumb?: string;
  onClick?: () => void;
  disabled?: boolean;
  placeholderType?: string;
  bg?: string;
  /**
   * 官方 `ls` 的 `buttonTabIndex`（默认 `b = -1`）。
   * ⚠️ **官方真机 DOM 里提及 chip 是 `tabindex="0"`**（CDP 9222 实测正文提及）⇒ 提及路径传 `0`；
   * 工具行 chip（官方 `DF` 没传）保持默认 `-1`。
   */
  buttonTabIndex?: number;
}

/**
 * 官方 `zR`：缩略图（有图出 `<img>`，无图/加载失败出官方 `OR` 占位 glyph）。
 * `ls` 里唯一的缩略图分支（本 chip 不用 `leadingIcon`）。
 */
const ChipThumbnail = memo(function ChipThumbnail({
  thumb,
  label,
  placeholderType = 'image',
  disabled = false,
}: {
  thumb: string;
  label: string;
  placeholderType?: string;
  disabled?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!thumb?.trim() || failed) {
    return <OfficialPlaceholderGlyph placeholderType={placeholderType} disabled={disabled} />;
  }
  return (
    <img
      src={thumb}
      alt={label}
      className={disabled ? 'object-cover shrink-0 opacity-50 grayscale' : 'object-cover shrink-0'}
      style={{ width: CHIP_THUMB_SIZE, height: CHIP_THUMB_SIZE, borderRadius: '3px' }}
      onError={() => setFailed(true)}
    />
  );
});

/**
 * 官方 `ls`：chip 壳（`displayName` 官方是 `NodeMentionPill`）。
 * 本文件只保留 `DF` 实际会传的 6 个 props —— 生成出的 DOM 与官方 `DF` 路径完全一致：
 *   · `leadingIcon` 恒 `undefined`（`mentionType` 默认 `"node"`，不走 `jR` 技能图标分支）
 *   · `showDelete` 默认 `false` ⇒ 不渲染右上角删除按钮
 *   · `title` 未传 ⇒ 外层 `span` 无 `title` 属性（官方 `DF` 就没传 `title`）
 *   · `mentionType` 默认 `"node"` ⇒ `data-mention-type="node"`
 *   · `buttonTabIndex` 默认 `-1`
 */
export const NodeMentionChip = memo(function NodeMentionChip({
  label,
  thumb,
  onClick,
  disabled = false,
  placeholderType = 'image',
  bg = '#333333',
  buttonTabIndex = -1,
}: NodeMentionChipProps) {
  /* 官方 `w = !n && !o`（没有 onClick、也没有删除按钮 ⇒ 壳退化成 `<span>`）。 */
  const staticShell = !onClick;
  const contentClass = `inline-flex min-w-0 items-center gap-1 ${staticShell ? 'cursor-default' : 'cursor-pointer border-0 bg-transparent p-0'}`;
  const inner = (
    <>
      <ChipThumbnail thumb={thumb ?? ''} label={label} placeholderType={placeholderType} disabled={disabled} />
      <span className="truncate text-center text-xs font-normal leading-none transition-colors">{label}</span>
    </>
  );
  return (
    <span
      className={`mention mention-node group ${CHIP_BASE_CLASS} ${disabled ? CHIP_DISABLED_CLASS : CHIP_ENABLED_CLASS}${staticShell ? ' cursor-default' : ''}`}
      data-mention-type="node"
      style={disabled ? undefined : { borderRadius: '4px', background: bg }}
    >
      {staticShell ? (
        <span className={contentClass}>{inner}</span>
      ) : (
        <button
          type="button"
          tabIndex={buttonTabIndex}
          onClick={disabled ? undefined : onClick}
          className={contentClass}
        >
          {inner}
        </button>
      )}
    </span>
  );
});

export interface NodeLinkChipProps {
  nodeId: string;
  /** 官方 `tool`（`hie` 传 `tool || "tool"`），决定节点不存在时的兜底文案。 */
  tool: string;
  /** 官方 `title`（`payloadTitle`）—— `hie` 没传，恒 `undefined`。 */
  title?: string;
  /**
   * 画布定位（官方 `Ac().fitView`，见 `nodeLinkChipModel.focusCanvasNode`）。
   * 不注入时走 MTV 现成的 `canvas-focus-nodes` 事件通道；注入时以注入值为准。
   */
  onFocusNode?: (nodeId: string) => void;
}

/**
 * 官方 `DF`：画布节点 chip（图标 + 标题，点击让画布 fitView 到该节点）。
 *
 * ⚠️ MTV 适配点（逐字之外的差异，全部集中在这里并注明）：
 *   1. 官方 `Zt(cb => cb.nodeLookup.get(nodeId))` 读的是 React Flow 的 store；MTV 的聊天面板不在
 *      `ReactFlowProvider` 内（`App.tsx` @509 `Canvas` 与 @524 `ChatPanel` 是兄弟）⇒ 改用仓库既有的
 *      「画布外读节点」入口 `useAppStore(s => getCanvasNodeById(s.nodes, id))`
 *      （同款用法见 `components/nodes/VideoNode.tsx` @383 / `NodePluginToolbarButtons.tsx` @23）。
 *   2. `u.src` / `u.title` / `i.type` 的字段名差异见 `nodeLinkChipModel.ts` 对应函数注释。
 *   3. 官方 `se().t` ⇒ MTV `useT()`（订阅语言切换）+ `agentEventString`（官方词表）。
 */
function NodeLinkChip({ nodeId, tool, title, onFocusNode }: NodeLinkChipProps) {
  useT(); // 订阅语言切换（`getLocale()` 本身不是响应式的）
  const locale = getLocale();
  const node = useAppStore(
    useCallback(
      (state: AppState) => (nodeId ? getCanvasNodeById(state.nodes, nodeId) ?? null : null),
      [nodeId],
    ),
  );

  /* 官方 `[l, c] = useState(true)` + 400ms 后关掉占位态。 */
  const [placeholder, setPlaceholder] = useState(true);
  /* 官方 `const d = useRef(!!i); i && (d.current = !0)` —— 「这个节点曾经存在过」的闩锁。
     ⚠️ 官方在 **render 期**写/读 ref；ESLint 的 `react-hooks/refs` 明令禁止（并发渲染下读 ref 不安全）
     ⇒ 改成同语义的 state 闩锁（React 官方文档认可的「render 期调整 state」写法，React 会立刻重渲染、
     不会提交中间态）：初值同样取 `!!node`（挂载那次就同步），之后出现过就一直为真。 */
  const [everFound, setEverFound] = useState(!!node);
  if (node && !everFound) setEverFound(true);
  useEffect(() => {
    if (!placeholder) return undefined;
    const timer = window.setTimeout(() => setPlaceholder(false), 400);
    return () => window.clearTimeout(timer);
  }, [placeholder]);

  const data = (node?.data ?? {}) as unknown as Record<string, unknown>;
  const nodeType = node?.type ?? (typeof data.type === 'string' ? data.type : undefined);
  const src = nodeLinkSource(data, nodeType);
  const thumb = nodeLinkThumb(nodeType, src);
  const placeholderType = nodeLinkPlaceholderType(nodeType);
  const label = resolveNodeLinkLabel({
    dataTitle: nodeLinkDataTitle(data),
    payloadTitle: title,
    nodeExists: !!node,
    /* 官方传 `i?.type`；MTV 的 `node.type` 是 `ai-*`，先归一到官方 `X` 字面量才能命中 `nodeTypes.*` 词条。 */
    nodeType: officialNodeTypeOf(nodeType),
    tool,
    locale,
  });

  const handleClick = useCallback(() => {
    if (!node || !nodeId) return;
    if (onFocusNode) onFocusNode(nodeId);
    else focusCanvasNode(nodeId);
  }, [node, nodeId, onFocusNode]);

  /* 官方 `x = d.current && !i`（曾经存在过、现在没了 ⇒ 真禁用）。 */
  const missing = everFound && !node;
  const disabled = placeholder ? false : missing;

  return (
    <NodeMentionChip
      label={label}
      thumb={thumb}
      onClick={handleClick}
      disabled={disabled}
      placeholderType={placeholderType}
      bg="#282828"
    />
  );
}

NodeLinkChip.displayName = 'NodeLink';

export default memo(NodeLinkChip);
