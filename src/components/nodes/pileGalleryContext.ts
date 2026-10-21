/**
 * pileGalleryContext —— 官方 **堆叠画廊会话的 context + hook**（`zoom-slider-3ZcFvYQO.js`）
 *
 * ⚠️ 为什么单独一个 `.ts`：`.tsx` 里只要导出**非组件**的东西，
 *    `react-refresh/only-export-components` 就会报错（eslint 是提交门禁）⇒
 *    官方 `EJ = h.createContext(null)` 与 `_J = usePileGallery()` 放在这里，
 *    组件（`rct` → `PileGalleryProvider`、`oct` → `PileGalleryHost`）放在 `PileGalleryProvider.tsx`。
 *    （仓库既有同类做法：`CanvasNodeLodContext` 也在 `hooks/useCanvasNodeLod.ts` 里。）
 *
 * 官方出处：
 * ```js
 * function _J(){ const e = h.useContext(EJ); if(!e) throw new Error("PileGalleryProvider is missing"); return e; }
 * ```
 */
import { createContext, useContext } from 'react';
import type { GallerySourceGeometry } from '../../utils/officialPileGallery';

/** 官方 `wC(mode)` 的四种模式（`dJe` 产出 / 画廊内切换） */
export type PileGalleryPreviewMode = 'source' | 'compact' | 'interactive' | 'drop-target';

/** 官方 `openGallery(a)` 的入参（`uJe` 的 `ne` 回调逐字）：
 *  `{pileId, canEdit, portalContainer, snapshot, initialZoom, previewMode, sourceImageVariant}` */
export interface PileGalleryOpenInput {
  pileId: string;
  canEdit: boolean;
  portalContainer: HTMLElement;
  /** 官方 `CQe({members, pileRect, portalRect, canvasZoom, previewExpansion})` 的产物 */
  snapshot: GallerySourceGeometry;
  initialZoom: number;
  previewMode: PileGalleryPreviewMode;
  sourceImageVariant?: unknown;
}

/** 官方会话对象（`openGallery` 的入参就是它） */
export type PileGallerySession = PileGalleryOpenInput;

export interface PileGalleryContextValue {
  session: PileGallerySession | null;
  openGallery: (session: PileGallerySession) => void;
  setPreviewMode: (mode: PileGalleryPreviewMode) => void;
  closeGallery: () => void;
}

/** 官方 `const EJ = h.createContext(null)` */
export const PileGalleryContext = createContext<PileGalleryContextValue | null>(null);

/** 官方 `_J` */
export function usePileGallery(): PileGalleryContextValue {
  const value = useContext(PileGalleryContext);
  if (!value) throw new Error('PileGalleryProvider is missing');
  return value;
}
