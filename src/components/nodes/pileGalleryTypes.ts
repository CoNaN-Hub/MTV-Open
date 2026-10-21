/**
 * pileGalleryTypes —— 官方 **PILE 画廊（全屏层）** 组件 `WQe` 的**对外公共类型**。
 *
 * 官方出处：`E:\TapNow-0.4.66\resources\web\assets\zoom-slider-3ZcFvYQO.js`
 *   组件 `WQe` @2955733（长度 11370），形参表逐字：
 *   ```js
 *   function WQe({pileId:pileId, members, canEdit, portalContainer, snapshot, initialZoom,
 *                 previewMode, sourceImageVariant,
 *                 onPreviewModeChange, onOpened, onClosing, onDragCollapseActivated, onClosed})
 *   ```
 *
 * ⚠️ 官方 `snapshot` 同时携带 `sourceGeometry` 与 `sources`（源摆位表 `Map<id, GalleryItem>`）。
 *    本组件对外只收 `sourceGeometry` 部分（父工作流约定的 API），
 *    `sources` 由组件内部用官方 `vJ`（`utils/officialPileGallery.ts` 的 `gallerySourceLayout`）
 *    从 `members + snapshot` 现算 —— 与官方 provider 在开画廊那一刻算出来的**同一份布局**。
 *
 * 单独放一个 `.ts` 文件是为了满足 `react-refresh/only-export-components`
 * （`.tsx` 里不允许出现非组件导出）。
 */
import type { AnyNode } from '../../utils/officialPile';
import type { GalleryMemberSize, GallerySourceGeometry } from '../../utils/officialPileGallery';

/**
 * 官方 `WQe` 的 `snapshot`（= 官方 `CQe` 产出的 `sourceGeometry`，见 `officialPileGallery.ts`）：
 * `{centerX, centerY, zoom, previewExpansion}` —— 堆叠节点在 portal 坐标系里的中心 + 画布 zoom。
 */
export type PileGallerySnapshot = GallerySourceGeometry;

/**
 * 官方 `dJe` / `wC(e)` 的四种预览模式（`zoom-slider` @2809723 / @2809643）：
 * `source` ⇒ 用快照自带的展开倍数；`compact|interactive|drop-target` ⇒ 固定表 `{1, 2, 2.35}`。
 */
export type PileGalleryPreviewMode = 'source' | 'compact' | 'interactive' | 'drop-target';

/**
 * MTV 侧的画廊成员 = 官方 `zQ(node, variant)`（@2809516）产出的「成员视图模型」里的两项：
 * `node`（节点本体）与 `displaySize`（官方 `mh(node)` = 文本钳制后的展示尺寸）。
 * 其余字段（`renderSize` / `displayScale` / `display`）由 `PileGallery.tsx` 内部补齐。
 */
export interface PileGalleryMember {
  node: AnyNode;
  displaySize: GalleryMemberSize;
}

/** 官方 `WQe` 会话相关入参（与官方形参名一一对应） */
export interface PileGallerySession {
  /** 官方 `pileId` —— 堆叠节点 id */
  pileId: string;
  /** 官方 `canEdit` —— 决定成员工具条/拖拽是否可用 */
  canEdit: boolean;
  /** 官方 `portalContainer` —— `createPortal` 的宿主，也是「坐标原点」参照 */
  portalContainer: HTMLElement;
  /** 官方 `snapshot.sourceGeometry` */
  snapshot: PileGallerySnapshot;
  /** 官方 `initialZoom` —— 首次 `VG(canvasBounds, initialZoom)` 用的 zoom */
  initialZoom: number;
  /** 官方 `previewMode` —— 当前展开档位（受控，由 `onPreviewModeChange` 回传） */
  previewMode: PileGalleryPreviewMode;
  /**
   * 官方 `sourceImageVariant`（`Pn.SMALL` CDN 变体，传给 `sb(node, variant)`）。
   * ⚠️ MTV 偏离：MTV 媒体是本地文件/直链，没有 CDN 变体服务 ⇒ 该字段被忽略（组件内有记账注释）。
   */
  sourceImageVariant?: unknown;
}

/** 官方 `WQe` 的全部 props（会话入参 + 成员表 + 5 个回调，回调名逐字对应） */
export interface PileGalleryProps extends PileGallerySession {
  /**
   * 官方 `members` —— MTV 侧的堆叠成员。
   *
   * 允许两种形态（组件内部都会归一成官方 `zQ(node)` 的视图模型）：
   *   · `PileGalleryMember = {node, displaySize}` —— 调用方已经算好官方 `mh(node)` 展示尺寸；
   *   · **裸成员节点** `AnyNode` —— 组件内部用官方 `zQ` 的流程自己算
   *     `pileDisplaySize(node, renderSizeOf(node, nodes))`（= 官方 `mh` / `oO`）。
   * 之所以两种都收：官方的 `members` 本来就是**节点数组**（`zQ`/`LYe` 在组件侧算尺寸），
   * 而 MTV 的父工作流约定可以预先算好 —— 两者都不需要改调用方。
   */
  members: Array<PileGalleryMember | AnyNode>;
  /** 官方 `onPreviewModeChange` */
  onPreviewModeChange: (mode: PileGalleryPreviewMode) => void;
  /** 官方 `onOpened` —— 相位机进入 `open` 时触发 */
  onOpened: () => void;
  /** 官方 `onClosing` —— 相位机进入 `closing` 时触发 */
  onClosing: () => void;
  /** 官方 `onDragCollapseActivated` —— 拖拽越出阈值触发塌缩（`_t`）时触发 */
  onDragCollapseActivated: () => void;
  /** 官方 `onClosed` —— 关闭动画结束、portal 卸载前触发 */
  onClosed: () => void;
}
