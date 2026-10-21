/**
 * `ShowHtmlCard` 点击后写入的「全屏预览目标」—— 官方 store 切片 `setHtmlPreviewTarget` 的落户处。
 *
 * 官方引用点（`vendor-pkg-canvas-ChpWx5JY.js` @2358534，逐字）：
 * ```js
 * ure=a.memo(({content:e})=>{const{t}=se(),n=sn(d=>d.setHtmlPreviewTarget), ...
 *   onClick:()=>n({artifactPath:i,title:r,description:l})
 * ```
 * 消费端（@2773335 / @2774482，逐字）：
 * ```js
 * uO=ot&&x?{canvasId:x,artifactPath:ot.artifactPath,title:ot.title,description:ot.description}:null
 * s.jsx(mst,{isOpen:!!uO,onClose:()=>pt(null),target:uO})
 * ```
 *
 * ⚠️ 为什么单开一个 store：MTV 的官方 store 切片在 `src/store/*`，**属本任务文件边界之外，改动被禁止**；
 * 且 MTV 现有 store 里没有任何 `htmlPreview` / `artifactPath` 字段（已 grep，0 命中）。
 * ⇒ 这里以独立 zustand store 承载同一切片；接线时由主 agent 在 host 处读 {@link useHtmlPreviewTarget}
 * 并补上 `canvasId`（官方 `uO` 的第四个字段来自画布 store），再渲染 {@link HtmlPreview}。
 */
import { create } from 'zustand';

/** 官方 `setHtmlPreviewTarget` 的入参（`ShowHtmlCard` 逐字传入的三个字段）。 */
export interface HtmlPreviewTargetInput {
  artifactPath: string;
  title: string;
  description?: string;
}

export interface HtmlPreviewTargetState {
  /** 官方 store 里的预览目标；`null` ⇒ 预览器 `isOpen:false`。 */
  htmlPreviewTarget: HtmlPreviewTargetInput | null;
  /** 官方 `setHtmlPreviewTarget`。 */
  setHtmlPreviewTarget: (target: HtmlPreviewTargetInput) => void;
  /** 官方 `onClose:()=>pt(null)` 对应的清空动作。 */
  clearHtmlPreviewTarget: () => void;
}

export const useHtmlPreviewTargetStore = create<HtmlPreviewTargetState>((set) => ({
  htmlPreviewTarget: null,
  setHtmlPreviewTarget: (target) => set({ htmlPreviewTarget: target }),
  clearHtmlPreviewTarget: () => set({ htmlPreviewTarget: null }),
}));

/** 读当前预览目标（host 用）。 */
export function useHtmlPreviewTarget(): HtmlPreviewTargetInput | null {
  return useHtmlPreviewTargetStore((state) => state.htmlPreviewTarget);
}

/** 取 setter（`ShowHtmlCard` 用，对应官方 `sn(d=>d.setHtmlPreviewTarget)`）。 */
export function useSetHtmlPreviewTarget(): (target: HtmlPreviewTargetInput) => void {
  return useHtmlPreviewTargetStore((state) => state.setHtmlPreviewTarget);
}
