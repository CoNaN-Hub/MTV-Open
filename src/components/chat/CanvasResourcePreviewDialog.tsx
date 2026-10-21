/**
 * CanvasResourcePreviewDialog —— 官方「画布素材预览」对话框（`画布素材预览` / `Canvas resource preview`）
 * 的 1:1 复刻。
 *
 * ## 官方调用点（`vendor-pkg-canvas-CvbAwZyy.js` @4564243 邻域，逐字）
 * ```js
 * s.jsx(Ko,{open:p!==null,onOpenChange:C=>!C&&m(null),children:s.jsxs(Yo,{className:"flex max-h-[90dvh] max-w-4xl flex-col",children:[
 *   s.jsxs(pl,{children:[
 *     s.jsx(ns,{children:l("画布素材预览","Canvas resource preview")}),
 *     s.jsx(qv,{children:String(u(p??"")?.data?.title??p??"")})]}),
 *   s.jsx(pIt,{node:u(p??"")}),
 *   s.jsx(Kme,{to:`/canvas/${encodeURIComponent(e)}?focus_node=${encodeURIComponent(p??"")}`,
 *              state:{openAgentPanel:!0,agentConversation:{canvasId:e,conversationId:Fe.getState().getSessionState().conversationId}},
 *              className:"self-end text-sm underline",children:l("在画布中打开","Open in Canvas")})]})})
 * ```
 * 其中 `l=(C,N)=>i.language.startsWith("zh")?C:N`（zh 取中文，否则取英文），
 * `u` = `pt().getNode`，`p` = `focusCanvasNodes` 塞进来的 nodeId（`[p,m]=a.useState(null)`）。
 *
 * ## 官方正文组件 `pIt`（@4565328，逐字）
 * ```js
 * function pIt({node:e}){const{i18n:t}=se(),n=e?.data??{},o=typeof n.src=="string"?n.src:"";
 *   return e?.type==="image"&&o ? s.jsx("img",{src:o,alt:String(n.title??""),className:"min-h-0 max-h-[65dvh] object-contain"})
 *    : ["video","videoEdit"].includes(e?.type??"")&&o ? s.jsx("video",{src:o,controls:!0,playsInline:!0,className:"min-h-0 max-h-[65dvh]"})
 *    : e?.type==="audio"&&o ? s.jsx("audio",{src:o,controls:!0})
 *    : s.jsx("div",{className:"min-h-0 overflow-y-auto whitespace-pre-wrap text-sm",
 *         children:String(n.text??n.content??(t.language.startsWith("zh")?"在画布中查看此素材。":"Open this resource in Canvas."))})}
 * ```
 *
 * ## 官方外壳符号（`_importmap.mjs` 逐字解析 ⇒ `vendor-packages-DRvCmDjR.js` 的导出表）
 * | 官方名 | 导出 | 本地实体 | 偏移 | 说明 |
 * | --- | --- | --- | --- | --- |
 * | `Ko` | `B` | `br` = `Hg` = Radix `Dialog`（Root） | 导出表 @1802767 | 提供 `open` / `onOpenChange` |
 * | `Yo` | `E` | `ha`（自定义 DialogContent 包装） | @410310 | 见下方「基类逐字」 |
 * | `ns` | `F` | `Lr`（`DialogTitle`，基类 `text-lg font-semibold leading-none tracking-tight`） | @411451 | |
 * | `qv` | `G` | `O0`（`DialogDescription`，基类 `text-sm text-muted-foreground`） | @411451 | |
 * | `pl` | `b3` | `qo`（`DialogHeader`，基类 `flex flex-col space-y-1.5 text-center sm:text-left`） | @411124 | |
 * | `Kme` | `lT` | react-router `Link` | vendor-libs | MTV 无 router，见适配点 |
 *
 * ### 基类逐字（`ha` @410310，`data-testid="common-dialog-content"`）
 * ```js
 * const ha=d.forwardRef(({className:e,children:t,showClose:n=!0,onClose:s,showOverlay:r=!0,overlayClassName:o,...i},l)=>
 *   a.jsxs(D6,{children:[ r&&a.jsx(k0,{className:o}),
 *     a.jsxs(V1,{ref:l,className:I("fixed left-[50%] top-[50%] z-50 bg-popover text-popover-foreground rounded-lg min-w-[300px] p-4 max-w-none translate-x-[-50%] translate-y-[-50%]",e),
 *       "data-testid":"common-dialog-content",...i,
 *       children:[t, n&&a.jsxs(Wg,{className:"absolute right-4 top-4 inline-flex h-6 w-6 shrink-0 aspect-square cursor-pointer items-center justify-center rounded-md p-0 ring-offset-background transition-opacity hover:bg-input/80 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10",
 *         "data-testid":"common-dialog-close-btn",onClick:s,
 *         children:[a.jsx(mu,{className:"size-4 shrink-0 text-[#CCCCCC]",strokeWidth:2,"aria-hidden":!0}),
 *                   a.jsx("span",{className:"sr-only",children:"Close"})]})]})]}));
 * ```
 * 遮罩 `k0` @409931：`fixed inset-0 z-50 bg-black/80` + `data-testid="common-dialog-container"`
 * （`F1` = Radix `Dialog.Overlay`）；`Wg` = Radix `Dialog.Close`（`zO`）；
 * `D6` = Radix `Dialog.Portal`（`zg`）；`V1` = Radix `Dialog.Content`（`dp`）。
 * ⚠️ `showClose` **默认 `true`** ⇒ 本对话框（调用点没传 `showClose`）**带那颗右上角 ✕**。
 *
 * ### 为什么**不加**入场/退场动画
 * 官方这条对话框的类串里**没有任何** `animate-in` / `animate-out` / `transition-*` 类
 * （对照：`SkillCreateDialog` 实测 DOM 那串才有 `data-[state=open]:animate-in …`）
 * ⇒ MTV 侧也**不加** framer-motion 动效，避免引入官方没有的动效。
 * 这同时回避了「带 transform 的祖先会成为 `position:fixed` 包含块」那个坑
 * （见 `SkillsManagerDialog.tsx` @368-371）：本文件的根**没有**任何 motion 包装。
 *
 * ## ⚠️ MTV 适配点（逐字之外的差异，全部集中在此并注明）
 * 1. **没有 router**：官方底部是 react-router `Link`（`Kme`）到
 *    `/canvas/<id>?focus_node=<nodeId>`（并带 `state.openAgentPanel` / `agentConversation`）。
 *    MTV 的落点 = 「关掉对话框 + 复用仓库既有的 `canvas-focus-node` 事件聚焦该节点」——
 *    该事件由 `Canvas.tsx` @1407 `handleSingleNodeFocus` 接住，落到
 *    `focusNodes([id], {maxZoom:1, duration:400})`。**这不是逐字移植**，是 MTV 等价物。
 * 2. **节点字段名**：官方读 `data.title` / `data.src` / `data.text` / `data.content`；
 *    MTV 的 `BaseNodeData` 是 `label` / `imageUrl|videoUrl|mediaUrl` / `output`
 *    ⇒ 复用 `nodeLinkChipModel.ts` 的 `nodeLinkDataTitle` / `nodeLinkSource`（官方字段优先、MTV 字段回落，
 *    同一套适配已在 `NodeLinkChip.tsx` / `ConfirmationCardParts.tsx` 落地）。
 * 3. **节点类型归一**：官方判 `node.type` 用官方字面量 `image` / `video` / `videoEdit` / `audio`；
 *    MTV 是 `ai-*` / `source-*` ⇒ **必须先过 `officialNodeTypeOf(type)`**（`nodeLinkChipModel.ts` @110）。
 * 4. **`focus:outline-hidden`**：官方 `ha` 用的是 Tailwind v4 的 `outline-hidden`，
 *    MTV 是 Tailwind v3（没有该工具类）⇒ 等价替换为 `focus:outline-none`。
 * 5. **文案**：官方 `l(zh, en)` 是「zh 取中文、否则一律英文」的**二选一**兜底（不是 i18n 词典条目）
 *    ⇒ 按仓库 i18n 约定（中文原文为 key）+ 官方「缺键回退英文」先例，ja/ko 两语取**官方英文原文**。
 */
import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useT } from '../../i18n';
import { useAppStore, type AppState } from '../../store/useAppStore';
import { getCanvasNodeById } from '../../utils/canvasRenderProjection';
import {
  OFFICIAL_NODE_TYPE,
  nodeLinkDataTitle,
  nodeLinkSource,
  officialNodeTypeOf,
} from '../../services/chat/nodeLinkChipModel';

/* 官方 `ha` 基类（@410310 逐字）。 */
const DIALOG_BASE_CLASS = 'fixed left-[50%] top-[50%] z-50 bg-popover text-popover-foreground rounded-lg min-w-[300px] p-4 max-w-none translate-x-[-50%] translate-y-[-50%]';
/* 官方**调用点** className（@4564243 邻域逐字，追加在基类之后）。 */
const DIALOG_CALLSITE_CLASS = 'flex max-h-[90dvh] max-w-4xl flex-col';
/* 官方 `k0` 遮罩（@409931 逐字）。 */
const OVERLAY_CLASS = 'fixed inset-0 z-50 bg-black/80';
/* 官方 `qo` / `Lr` / `O0` 基类（@411124 / @411451 逐字）。 */
const HEADER_CLASS = 'flex flex-col space-y-1.5 text-center sm:text-left';
const TITLE_CLASS = 'text-lg font-semibold leading-none tracking-tight';
const DESCRIPTION_CLASS = 'text-sm text-muted-foreground';
/* 官方 `ha` 内置关闭键（@410524 逐字；`focus:outline-hidden` → v3 `focus:outline-none`，见文件头适配点 4）。 */
const CLOSE_BUTTON_CLASS = 'absolute right-4 top-4 inline-flex h-6 w-6 shrink-0 aspect-square cursor-pointer items-center justify-center rounded-md p-0 ring-offset-background transition-opacity hover:bg-input/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10';

/** 官方 `pIt` 的 `node` 形状（MTV 侧只用到 `type` / `data`）。 */
export interface CanvasResourcePreviewNode {
  type?: string;
  data?: unknown;
}

/**
 * 官方 `pIt({node:e})` —— 正文分派（image / video+videoEdit / audio / 文本）。
 * 纯展示、无副作用，单独导出以便 jsdom 直测四条分支。
 */
export function CanvasResourcePreviewBody({ node }: { node: CanvasResourcePreviewNode | null | undefined }) {
  const t = useT();
  const data = (node?.data ?? {}) as Record<string, unknown>;
  /* 官方只读 `e.type`；MTV 侧有节点的业务类型落在 `data.type`（React Flow 的 `node.type` 缺省时）
     ⇒ 与 `NodeLinkChip.tsx` @246 同一条回落，再归一（适配点 3）。 */
  const nodeType = node?.type ?? (typeof data.type === 'string' ? data.type : undefined);
  /* 官方 `o = typeof n.src=="string" ? n.src : ""`；MTV 的 `src` 字段名差异见适配点 2。 */
  const src = nodeLinkSource(data, nodeType);
  /* 官方 `const i18n = se().i18n; t.language.startsWith("zh")` ⇒ MTV `t(中文原文)`（zh 无字典、原样回落）。 */
  const type = officialNodeTypeOf(nodeType);

  if (type === OFFICIAL_NODE_TYPE.IMAGE && src) {
    return (
      <img
        src={src}
        alt={String(nodeLinkDataTitle(data) ?? '')}
        className="min-h-0 max-h-[65dvh] object-contain"
      />
    );
  }
  if ((type === OFFICIAL_NODE_TYPE.VIDEO || type === OFFICIAL_NODE_TYPE.VIDEO_EDIT) && src) {
    return <video src={src} controls playsInline className="min-h-0 max-h-[65dvh]" />;
  }
  if (type === OFFICIAL_NODE_TYPE.AUDIO && src) {
    return <audio src={src} controls />;
  }
  return (
    <div className="min-h-0 overflow-y-auto whitespace-pre-wrap text-sm">
      {/* 官方 `n.text ?? n.content ?? 兜底文案`；MTV 的正文常落在 `output`（适配点 2）。 */}
      {String(data.text ?? data.content ?? data.output ?? t('在画布中查看此素材。'))}
    </div>
  );
}

export interface CanvasResourcePreviewDialogProps {
  /** 官方 `p`（`focusCanvasNodes` 塞进来的 nodeId）；`null` ⇒ 关闭（官方 `open: p !== null`）。 */
  nodeId: string | null;
  /** 官方 `onOpenChange: C => !C && m(null)`。 */
  onClose: () => void;
  /**
   * ⚠️ MTV 适配点 1（无 router）：官方这里是 `Link to="/canvas/<id>?focus_node=<nodeId>"`。
   * 传入方负责「关窗 + 走 `canvas-focus-node` 事件」。
   */
  onOpenInCanvas: (nodeId: string) => void;
}

export default function CanvasResourcePreviewDialog({
  nodeId,
  onClose,
  onOpenInCanvas,
}: CanvasResourcePreviewDialogProps) {
  /* ⚠️ `useT()` 必须在下面的提前 `return null` **之前**调用，不然 hook 顺序会随 `nodeId` 变化。 */
  const t = useT();
  /* 官方 Radix `Dialog`：Esc ⇒ `onOpenChange(false)`；点遮罩 ⇒ 同一路径（`ha` 未传
     `onInteractOutside` 的 preventDefault）⇒ 两者都关。 */
  useEffect(() => {
    if (nodeId === null) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [nodeId, onClose]);

  const node = useAppStore(
    useCallback(
      (state: AppState) => (nodeId ? getCanvasNodeById(state.nodes, nodeId) ?? null : null),
      [nodeId],
    ),
  );

  /* ⚠️ 必须 portal 到 `document.body`（官方 Radix 同样 portal 到 body）：
     `App.tsx` @508 的 `.app-shell__content` 有 `clip-path`（`base.css` @1016）⇒ 自有堆叠上下文，
     留在里面会被裁掉四角、且与本面板处于同一 z 轴（同 `OutputHistoryPanel.tsx` @1273 的实测结论）。 */
  if (typeof document === 'undefined' || !document.body || nodeId === null) return null;

  const data = (node?.data ?? {}) as Record<string, unknown>;
  /* 官方 `String(u(p??"")?.data?.title ?? p ?? "")`：取不到节点时**退化成线程 id**。 */
  const description = String(nodeLinkDataTitle(data) ?? nodeId);

  return createPortal(
    <>
      <div
        className={OVERLAY_CLASS}
        data-testid="common-dialog-container"
        data-state="open"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        data-testid="common-dialog-content"
        data-state="open"
        className={`${DIALOG_BASE_CLASS} ${DIALOG_CALLSITE_CLASS}`}
      >
        <div className={HEADER_CLASS}>
          <h2 className={TITLE_CLASS}>{t('画布素材预览')}</h2>
          <p className={DESCRIPTION_CLASS}>{description}</p>
        </div>
        <CanvasResourcePreviewBody node={node} />
        <button
          type="button"
          className="self-end text-sm underline"
          onClick={() => onOpenInCanvas(nodeId)}
        >
          {t('在画布中打开')}
        </button>
        {/* 官方 `Wg`(`Dialog.Close`) + `mu`(lucide-x) + `span.sr-only`（`showClose` 默认 true ⇒ 恒渲染）。
            ⚠️ 官方 `span.sr-only` 里的文案是**字面英文** `"Close"`（没走 i18n）⇒ 原样保留。 */}
        <button
          type="button"
          data-testid="common-dialog-close-btn"
          className={CLOSE_BUTTON_CLASS}
          onClick={onClose}
        >
          <Icon icon="lucide:x" className="size-4 shrink-0 text-[#CCCCCC]" strokeWidth={2} aria-hidden />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </>,
    document.body,
  );
}
