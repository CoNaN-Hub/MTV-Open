/**
 * canvasResourcePreview —— 官方宿主桥 `focusCanvasNodes` 的 **MTV 事件通道**。
 *
 * 官方逐字链（`vendor-pkg-canvas-CvbAwZyy.js`）：
 * ```js
 * // @152784  jc —— 画布控制器 `Ac()` 的 `fitView` 被替换成「宿主桥」
 * function jc(){const{fitView:e}=pt(),n=Ic()?.focusCanvasNodes;
 *   return{fitView:a.useCallback(async r=>{if(!n)return e(r);
 *     const i=r?.nodes?.map(l=>l.id)??[];return i.length?(n(i),!0):!1},[e,n])}}
 *
 * // @4562700 邻域  唯一 Provider（组件 `uIt`）
 * const S={...t,focusCanvasNodes:C=>m(C[0]??null),addCanvasNodes:…,reconcileScene:…,prepareSubmission:…};
 * return s.jsxs(Qye,{value:S,children:[…]})
 * ```
 * 即：官方**画布页**里，`Ac().fitView({nodes:[{id}]})`（节点 chip / 引用缩略图 / mention 的唯一点击出口）
 * 在真实应用里**从不移动镜头**，而是把**第一个** nodeId 塞进 `useState`（`[p,m]=a.useState(null)`）
 * ⇒ `open: p !== null` ⇒ 弹「画布素材预览」对话框（见 `CanvasResourcePreviewDialog.tsx`）。
 *
 * ⚠️ **MTV 适配点（为什么需要这个事件通道）**：
 *   MTV 的聊天面板与 `Canvas` 是**兄弟节点**（`App.tsx` @508 `Canvas` / @524 `ChatPanel`），
 *   对话框状态只能由聊天面板自己持有，但有几处「官方同一条 `jc()` 桥」的调用点拿不到
 *   `ChatPanel` 注入的 `onNodeActivate`（例：`ChatReferenceText` 未注入 handler 时的默认分支）。
 *   ⇒ 用仓库既有的「window 自定义事件」约定（同 `canvas-focus-node` / `canvas-focus-nodes` /
 *   `chat-focus-composer`）把请求送到 `ChatPanel`，由它统一 `setState`。
 *
 * ⚠️ **2026 更正：主画布页的提及 chip 点击不走这条桥。**
 *   真机实测（CDP 9222，真鼠标点击官方「可爱的小猫」chip）：**没有弹窗、没有 popper**；
 *   官方那个 Provider 只在 **Studio 嵌画布**（`uIt`@4562700）里
 *   ⇒ 主画布页 `jc()` 的 `if(!n) return e(r)` 会走真正的 `fitView`（居中放大）。
 *   所以 chip 点击现在只调 `focusCanvasNode`（见 `ChatReferenceText.activateNode` /
 *   `ChatPanel.handleNodeActivate`），本文件保留给「宿主桥」那条路自己用。
 */
import { focusCanvasNode } from './nodeLinkChipModel';

/** 事件名（`detail: { nodeId: string }`）。 */
export const CANVAS_RESOURCE_PREVIEW_EVENT = 'canvas-resource-preview';

/**
 * 请求打开「画布素材预览」对话框 —— 官方 `Ic().focusCanvasNodes([nodeId])` 的 MTV 等价物。
 *
 * ★ 用户 2026 实测口径：「两个 chip 点击都可以自动定位到相关卡片到画布中央」。
 *   这半边是官方**源码**里 `jc()` 被宿主桥替掉的那一半：
 *   ```js
 *   // 官方提及节点视图 `ID`（@164859 区，逐字）
 *   const {fitView: v} = jc();
 *   const w = useCallback(() => { f && v({nodes:[{id: n}], ...jwe}) }, [v, f, n]);
 *   // @160147 区：jwe = {padding: 1, maxZoom: 2, minZoom: .5, duration: 500}
 *   // @152784 区：jc 的 fitView 被宿主桥接管 ⇒ `if(!n) return e(r)` 的 `e(r)` 永不执行
 *   ```
 *   ⇒ 官方源码是「镜头居中放大到该节点」，官方画布页把它换成了弹窗。
 *   MTV 这里**两件都做**：先按官方 `jwe` 参数把镜头居中到该节点（同一份参数见
 *   `nodeLinkChipModel.focusCanvasNode`），再发预览请求；两条出口与官方源码一致、互不冲突。
 *
 * ⚠️ 官方 `focusCanvasNodes: C => m(C[0] ?? null)` 对**不存在的节点 id 也照样生效**
 *   （`m` 恒被调用，只是弹窗里的 `getNode` 取不到 ⇒ 标题退化成 id、正文退化成文本分支）。
 *   本函数同样不做存在性校验，语义逐字一致。
 */
export function openCanvasResourcePreview(nodeId: string): void {
  if (!nodeId) return;
  focusCanvasNode(nodeId);
  window.dispatchEvent(new CustomEvent(CANVAS_RESOURCE_PREVIEW_EVENT, { detail: { nodeId } }));
}

/** 订阅预览请求；返回取消订阅函数。 */
export function onCanvasResourcePreview(handler: (nodeId: string) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ nodeId?: string }>).detail;
    if (detail?.nodeId) handler(detail.nodeId);
  };
  window.addEventListener(CANVAS_RESOURCE_PREVIEW_EVENT, listener);
  return () => window.removeEventListener(CANVAS_RESOURCE_PREVIEW_EVENT, listener);
}
