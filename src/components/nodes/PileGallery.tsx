/**
 * PileGallery —— 官方 **PILE 画廊（全屏层）** 组件 `WQe` 的逐字移植。
 *
 * 官方出处：`E:\TapNow-0.4.66\resources\web\assets\zoom-slider-3ZcFvYQO.js`
 *   · `WQe` @2955733（长度 11370） —— 全屏画廊主体（相位机 / 视口 / 拖拽交接 / portal）
 *   · `lQe` @2942621（长度 2106）  —— 画廊里的**单个成员**（本文件 `PileGalleryItem`）
 *   · `sQe` @2940688（长度 859）   —— 交接动画层（本文件 `PileGalleryDragLayer`）
 *   · `aQe` @2942401 / `ZZe` @2938157 / `XZe` @2937851 —— 成员上方标签
 *   · `EQe` @2949487（长度 3123）  —— 视口/相机 hook（本文件 `useGalleryViewport`）
 *   · `nQe` @2939750 —— 交接动画过渡表；`GP` @480329 —— 元素矩形 + 圆角；`AQe` @2952720 —— 失焦
 *
 * ★ 纯函数/常量全部来自已经逐字移植好的三个 util，**本文件不重算任何公式**：
 *   `utils/officialPileGallery.ts`      —— 源摆位 / 包围盒 / 视口夹取 / 滚轮归一 / 相邻项微移
 *   `utils/officialPileGalleryView.ts`  —— 行布局 / 相机几何 / 拖拽几何 / 交接成员 / 相位时长
 *   `utils/officialPile.ts`             —— `wC`/`qM`/`_l`/`fO` 家族 + `Vlt`(movePileMemberToFront)
 *
 * ★ 成员预览 = 官方 `TT`（`components/nodes/PileMemberPreview.tsx`），内容来自
 *   `utils/officialPilePreviewContent.ts` 的 `pilePreviewContentOf`（官方 `OYe` 的 MTV 适配）。
 *
 * ⚠️ 本文件里每条 `⚠️ MTV 偏离：…` 都是**必须读**的：官方依赖但 MTV 不存在的模块，
 *    一律保留官方控制流 + 明确记账，绝不静默删除行为。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';

import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import {
  pileDisplaySize,
  pileLastFive,
  pilePreviewExpansion,
  pileStaggerStep,
  PILE_RENDER_CLASSES,
} from '../../utils/officialPile';
import { usePileMemberActions } from './pileMemberActionsContext';
import type { AnyNode } from '../../utils/officialPile';
import { renderSizeOf } from '../../utils/officialCanvasLayout';
import { pilePreviewContentOf } from '../../utils/officialPilePreviewContent';
import {
  galleryDomGeometry,
  galleryInitialViewport,
  galleryLayout,
  galleryReadableScale,
  gallerySourceLayout,
  gallerySurroundingOffset,
  gallerySurroundingTransition,
  galleryWorldTransform,
  isGalleryDrag,
  PILE_GALLERY_Z_INDEX,
  type GalleryItem,
  type GalleryMemberSize,
  type GalleryRect,
  type GalleryViewportState,
} from '../../utils/officialPileGallery';
import {
  canvasLandingMs,
  closeDelayMs,
  GALLERY_BACKDROP,
  GALLERY_DRAG,
  GALLERY_DRAG_ACTIVATION_DISTANCE,
  GALLERY_DRAG_OVERLAY_Z_INDEX,
  GALLERY_HANDOFF,
  GALLERY_OPEN_CLOSE,
  galleryBackdropDurationSeconds,
  galleryCameraForBounds,
  galleryCanTogglePreview,
  galleryCanvasEdgesToRect,
  galleryChromeDelaySeconds,
  galleryCollapseMemberId,
  galleryCollapseTargetTransform,
  galleryContentHandoffSeconds,
  galleryDepthShadeOpacity,
  galleryDragCarry,
  galleryDragGrabPoint,
  galleryDragPhaseLabel,
  galleryDragState,
  galleryElementOrigin,
  galleryFitScale,
  galleryHandoffMembers,
  galleryInitialDepthShadeOpacity,
  galleryItemScreenRect,
  galleryLabelDelaySeconds,
  galleryLayoutTransform,
  galleryMemberOrder,
  galleryMemberTransition,
  galleryPanCamera,
  galleryPanHasMoved,
  galleryPointInBounds,
  galleryReadableScaleChanged,
  galleryRowCanvas,
  galleryViewerMembers,
  galleryViewportSize,
  galleryWheelCamera,
  galleryWorldStyle,
  handoffDelayMs,
  STACK_ENTRY,
  type GalleryDragActive,
  type GalleryDragEvent,
  type GalleryDragOrHandoff,
  type GalleryGrabPoint,
  type GalleryHandoffPlan,
  type GalleryLayoutTransform,
  type GalleryMemberTransition,
  type GalleryPhase,
  type GalleryPlacedBox,
  type GalleryTransitionSpec,
} from '../../utils/officialPileGalleryView';
import { collectNodeMediaVersions, type MediaViewerVersion } from '../../utils/mediaViewerVersions';
import { favoriteTargetOf, firstNonEmptyString, type FavoriteAsset } from '../../utils/officialFavorites';
import type { OutputHistoryEntry } from '../../types';
import PileMemberPreview from './PileMemberPreview';
import type { PilePreviewContent, PilePreviewStatus } from './PileMemberPreview';
import PileFavoriteButton from './PileFavoriteButton';
import PileGalleryViewer from './PileGalleryViewer';
import type { PileGalleryProps } from './pileGalleryTypes';

export type {
  PileGalleryMember,
  PileGalleryPreviewMode,
  PileGalleryProps,
  PileGallerySession,
  PileGallerySnapshot,
} from './pileGalleryTypes';

/* ══════════════════════════════════════════════════════════════════════════
   官方 ms 常量表里本文件单独用到的两条（`zoom-slider` @2922576）
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 官方 `ms.gallery.label = {durationSeconds:.16, ease:yu}` @2922576。
 * `yu = [.16,1,.3,1]` 与 `GALLERY_OPEN_CLOSE.rotationEase` 是同一个数组（util 里的 `EASE_EMPHASIS`）。
 */
const GALLERY_LABEL_DURATION_SECONDS = 0.16;

/* ══════════════════════════════════════════════════════════════════════════
   小工具
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 官方 `Z`（`zoom-slider` 从 `index-BiTZf8mJ.js` 导入的 `c6`，即 **clsx**）。
 * ⚠️ MTV 偏离：MTV 没有 `clsx`/`tailwind-merge` 依赖；仓库既有写法是
 * `[...].filter(Boolean).join(' ')`（`components/shared/OfficialModalContainer.tsx:59` 的 `classNames`）
 * —— 这里用同实现的本地 `joinClasses`，**语义与 clsx 一致**（falsy 丢弃、空格拼接）。
 */
function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** framer-motion 的 `ease` 只接受四元组；官方 `PQe`/`nQe` 给的是 `readonly number[]` */
type MotionEase = [number, number, number, number];
function motionEase(ease: readonly number[]): MotionEase {
  return [ease[0] ?? 0, ease[1] ?? 0, ease[2] ?? 0, ease[3] ?? 0];
}

/**
 * `GalleryLayoutTransform` 是 **interface**，TS 不会给 interface 隐式索引签名，
 * 于是 framer-motion 的 `Target`（含 `--${string}` 索引签名的那一支）拒收它。
 * 转成匿名对象字面量类型即可（`PileNode.tsx` 的 `PILE_ENTRY_ORIGIN` 同理，只是它是常量）。
 * **不改任何数值**，纯粹是为了让 motion 的 `initial`/`animate` 接受它。
 */
function toMotionTarget(t: GalleryLayoutTransform) {
  return { x: t.x, y: t.y, scale: t.scale, rotate: t.rotate };
}

/**
 * 官方 dnd-kit 的 `active.id`；util 的 `GalleryDragActive` 只声明了 `rect`
 * （它是给纯几何函数用的最小形状），这里按官方用法补上 `id`。
 */
interface PileGalleryActiveDrag {
  id: string;
  rect: GalleryDragActive['rect'];
}

/** 喂给官方四个拖拽回调的事件形状（官方 = dnd-kit `DragStartEvent/DragMoveEvent/...`） */
type PileGalleryDragEvent = Omit<GalleryDragEvent, 'active'> & { active: PileGalleryActiveDrag };

function motionSpec(spec: GalleryTransitionSpec): { duration: number; delay: number; ease: MotionEase } {
  return { duration: spec.duration, delay: spec.delay, ease: motionEase(spec.ease) };
}

/**
 * 官方 `PQe(e,t,n,s,r)` 返回值 → framer-motion `Transition` 的**纯类型适配**
 * （官方直接把 `ms` 里的数组塞进 `transition`；TS 需要四元组，这里只搬运形状、不改任何数值）。
 */
function toMotionTransition(
  value: GalleryMemberTransition | { duration: number; ease?: readonly number[] },
): Transition {
  if ('x' in value) {
    return {
      x: motionSpec(value.x),
      y: motionSpec(value.y),
      scale: motionSpec(value.scale),
      opacity: motionSpec(value.opacity),
      rotate: motionSpec(value.rotate),
    };
  }
  return { duration: value.duration, ...(value.ease ? { ease: motionEase(value.ease) } : {}) };
}

/**
 * 官方 `nQe(e, t)` @2939750 —— 交接动画层（`sQe`）的过渡表（逐字）：
 * ```js
 * if(t) return {duration:0};
 * if(e.kind==="slot")   return {duration: ms.gallery.drag.pickupDurationSeconds, ease: ms.gallery.drag.pickupEase};
 * if(e.kind==="canvas"){ const s=ms.handoff.canvasLanding; return {
 *   x/y/scaleX/scaleY:{duration:s.movementDurationSeconds, ease:s.movementEase},
 *   opacity:{delay:s.movementDurationSeconds, duration:s.contentHandoffDurationSeconds, ease:s.contentHandoffEase}}}
 * const n=ms.stack.entry; return {
 *   x/y/scaleX/scaleY:{duration:n.movementDurationSeconds, ease:n.movementEase},
 *   rotate:{duration:n.rotationDurationSeconds, delay:n.rotationDelaySeconds, ease:n.rotationEase}}
 * ```
 * ⚠️ util 的 `STACK_ENTRY` 只带时长不带 ease ⇒ 这里取 `GALLERY_OPEN_CLOSE.ease`（= `Bh=[.65,0,.35,1]`）
 * 与 `GALLERY_OPEN_CLOSE.rotationEase`（= `yu=[.16,1,.3,1]`）—— 与官方是**同一组常量数组**。
 */
function handoffMotionTransition(
  kind: GalleryHandoffPlan['kind'],
  reducedMotion: boolean,
): Transition {
  if (reducedMotion) return { duration: 0 };
  if (kind === 'slot') {
    return {
      duration: GALLERY_DRAG.pickupDurationSeconds,
      ease: motionEase(GALLERY_DRAG.pickupEase),
    };
  }
  if (kind === 'canvas') {
    const landing = GALLERY_HANDOFF.canvasLanding;
    const movement = {
      duration: landing.movementDurationSeconds,
      ease: motionEase(landing.movementEase),
    };
    return {
      x: movement,
      y: movement,
      scaleX: movement,
      scaleY: movement,
      opacity: {
        delay: landing.movementDurationSeconds,
        duration: landing.contentHandoffDurationSeconds,
        ease: 'linear',
      },
    };
  }
  const entry = STACK_ENTRY;
  const movement = {
    duration: entry.movementDurationSeconds,
    ease: motionEase(GALLERY_OPEN_CLOSE.ease),
  };
  return {
    x: movement,
    y: movement,
    scaleX: movement,
    scaleY: movement,
    rotate: {
      duration: entry.rotationDurationSeconds,
      delay: entry.rotationDelaySeconds,
      ease: motionEase(GALLERY_OPEN_CLOSE.rotationEase),
    },
  };
}

/**
 * 官方 `GP(e)` @480329 —— 元素矩形 + 左上圆角（媒体查看器的「源锚点」）：
 * ```js
 * function GP(e){const t=e.getBoundingClientRect(),
 *   n=Number.parseFloat(window.getComputedStyle(e).borderTopLeftRadius);
 *   return {rect:{left:t.left,top:t.top,width:t.width,height:t.height},
 *           borderRadius:Number.isFinite(n)?Math.max(0,n):0}}
 * ```
 */
function galleryElementAnchor(element: HTMLElement): { rect: GalleryRect; borderRadius: number } {
  const box = element.getBoundingClientRect();
  const radius = Number.parseFloat(window.getComputedStyle(element).borderTopLeftRadius);
  return {
    rect: { left: box.left, top: box.top, width: box.width, height: box.height },
    borderRadius: Number.isFinite(radius) ? Math.max(0, radius) : 0,
  };
}

/**
 * 官方 `mQe(e)` @2945320 的**副作用部分** —— 预热所有图片来源（`new Image()` + `decode()`）。
 * 官方 `WQe` 只把结果塞进 `j.current`，而 `j` 从不被读取 ⇒ 纯副作用。
 * 过滤逻辑（非 image / 无 `displaySrc` 跳过）走 util 的 `galleryPreloadImageSources` 同一份语义。
 */
function preloadGalleryImages(sources: readonly string[]): HTMLImageElement[] {
  const images: HTMLImageElement[] = [];
  for (const src of sources) {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    image.decode?.().catch(() => undefined);
    images.push(image);
  }
  return images;
}

/**
 * 官方 `AQe()` @2952720 —— `{const e=document.activeElement; e instanceof HTMLElement && e.blur()}`
 * （关闭相位把焦点挪走，避免 Esc/方向键继续被对话框吃掉）。
 */
function blurActiveElement(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

/* ══════════════════════════════════════════════════════════════════════════
   官方 `zQ(node, variant)` @2809516 —— MTV 侧的成员视图模型
   ══════════════════════════════════════════════════════════════════════════ */

/** 官方 `OYe` 的 display 模型里本组件要用到的两项（正好是 `PileMemberPreview` 的入参） */
interface PileGalleryDisplay {
  content: PilePreviewContent;
  status: PilePreviewStatus;
}

/**
 * 官方 `zQ(e,t)` 的返回值 `{node, renderSize, displaySize, displayScale, display}` 的 MTV 版本。
 * ⚠️ MTV 偏离：MTV 侧只把 `displaySize`（官方 `mh`，父工作流已算好）传进来，没有 `renderSize`
 *    （官方 `oO`，需要 React-Flow 的 measured 尺寸）⇒ `displayScale` 取 `1`，
 *    `display.content` 用 `pilePreviewContentOf(node, displaySize, 1)`。
 *    几何（`centerX/centerY/width/height/rotate/zIndex`）**完全不受影响**，只有文本预览的字号基准。
 */
interface PileGalleryEntry {
  node: AnyNode;
  displaySize: GalleryMemberSize;
  displayScale: number;
  display: PileGalleryDisplay;
}

function buildGalleryEntry(node: AnyNode, displaySize: GalleryMemberSize): PileGalleryEntry {
  const statusKind: PilePreviewStatus['kind'] =
    (node.data as { status?: unknown } | undefined)?.status === 'loading' ? 'loading' : 'ready';
  return {
    node,
    displaySize,
    displayScale: 1,
    display: {
      content: pilePreviewContentOf(node, displaySize, 1),
      status: { kind: statusKind },
    },
  };
}

/** util 的 `vJ`/`Fk` 家族入参是 `{id, displaySize}`（官方是 `{node:{id}, displaySize}`） */
function layoutInput(
  entries: readonly PileGalleryEntry[],
): ReadonlyArray<{ id: string; displaySize: GalleryMemberSize }> {
  return entries.map((entry) => ({ id: entry.node.id, displaySize: entry.displaySize }));
}

/**
 * 官方 `b8(node, {displaySrc, mode:"view", registeredFileIds})` @583457 的 **MTV 适配版**
 * —— 从画廊成员视图模型里造出「媒体查看器会话」（官方 `MQe` 的 `buildMember` 注入点）。
 *
 * ⚠️ MTV 偏离：官方 `b8` 是跨模块大构造函数（读 `node.data` / `measured` / 资源与动作表，
 *    产出 `media` / `resources` / `activeMedia` / `activeResource` / `prompt` / `model` / `actions` …）。
 *    MTV 侧只造 MTV `MediaViewer` 真能消费的那几项（映射表在 `PileGalleryViewer.tsx` 文件头）：
 *      · `media.type` / `media.src`：image → 官方 `b8` 的 `displaySrc` 入参（回落
 *        `content.displaySrc → content.fallbackSrc`）、video → 官方 `Nbe` 的播放源 `playbackSrc`；
 *        `media.title` 取官方 `OYe` 的 `Rb(data, …)` 那一档（MTV = 节点 `label`）。
 *      · `versions`：官方 `m.resources` ⇐ MTV 生成历史 `store.outputHistoryRecords`
 *        （与 `ImageNode` / `VideoNode` 的 `collectNodeMediaVersions` 同一份数据）。
 *      · `prompt` / `model` / `width` / `height` / `durationSeconds`：节点 data
 *        （官方来自会话模型 `m.prompt` / `m.model` / `m.activeResource`）。
 *    官方 `actions`（底条 `Qge` 的 copy/setAsMain/download 开关）、`mode`、`mainSrc`、
 *    注册文件 id（`registeredFileIds`，只服务官方 `favorite` 动作）**不建** —— 没有接收方。
 *
 * 返回 `null` ⇒ 官方 `MQe` 的 `o && n.set(...)` 不写入（该成员 `canOpenMedia` 保持 false）：
 *   · **文本成员**：官方走 `u8` 的文本分支（`u` → `sxe`）；MTV 的对应实现
 *     `shared/TextFullscreenViewer` 没有官方 `onClosed` 握手 ⇒ 本适配层不建会话（已记账）；
 *   · **音频 / unknown 成员**：MTV 的 `MediaViewer` 只支持 image/video；
 *   · **没有可用媒体地址**（还在生成 / 只有占位图）。
 */
function pileGalleryViewerSession(
  entry: PileGalleryEntry,
  displaySrc: string | undefined,
  historyRecords: readonly OutputHistoryEntry[] | undefined,
): PileGalleryViewerSession | null {
  /** 会话要读的 `node.data` 字段（官方 `b8` 读的是同一批；MTV 只挑这几个） */
  const data = (entry.node.data ?? {}) as unknown as {
    prompt?: string;
    model?: string;
    imageUrl?: string;
    videoUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    videoDuration?: number;
  };
  const content = entry.display.content;
  const versions = collectNodeMediaVersions(entry.node.id, historyRecords);
  /** 入口媒体的地址（按类型取，供 `createdAt` 查表用；与 `PileGalleryViewer` 的 `activeVersion` 同源） */
  const entrySrcForLookup =
    content.type === 'image'
      ? displaySrc || content.displaySrc || content.fallbackSrc
      : content.type === 'video'
        ? content.playbackSrc
        : '';
  /**
   * 官方 `b8` 末尾的 `actions` 表（逐字）：
   * ```js
   * actions: { copy:!0, download:t.downloadEnabled!==!1,
   *            favorite:p,                                   // = g8(node, registeredFileIds, src)
   *            setAsMain:t.setAsMainEnabled&&i ? {mainSrc:ur(i)} : void 0 }
   * ```
   * ⚠️ MTV 偏离：官方 `downloadEnabled` / `setAsMainEnabled` 由画廊宿主（`MQe` 的 options）给，
   *    MTV 的画廊没有这两个开关 ⇒ 与官方缺省一致：`download:true`、
   *    `setAsMain` 只要有主媒体就给（`disabled` 由「当前展示的就是主媒体」自己挡）。
   */
  const favoriteTarget = favoriteTargetOf(entry.node, undefined);
  const actions: PileGalleryViewerActions = {
    copy: true,
    download: true,
    /* ★★ **不提供 `setAsMain`** —— 官方实锤（`MQe`@2953647 逐字）：
       ```js
       function MQe(e){ … const o = b8(s.node, {displaySrc:r, mode:"view", registeredFileIds:t[s.node.id]}); … }
       ```
       它传给 `b8` 的 options **只有这三个键**，**没有 `setAsMainEnabled`**
       ⇒ 官方 `b8` 里 `setAsMain: t.setAsMainEnabled && i ? {mainSrc:ur(i)} : void 0` 求值为 `undefined`
       ⇒ `Qge` 的显示门 `y = !!(o.setAsMain && r && a)` 为假 ⇒ **官方堆叠画廊底栏压根没有「设为主图」**。
       官方底栏实际就是三件：复制提示词（`copy:!0`）/ 收藏（`favorite`）/ 下载
       （`download: t.downloadEnabled !== !1`，未传时为 `true`）。
       ⚠️ MTV 之前把自家 ImageNode 查看器的「设为主图」一并搬了进来 ⇒ 比官方多一个按钮（用户实测指出）。
       「设为主图」是 MTV **画布节点查看器**的语义（把历史版本写回节点主媒体），
       在堆叠画廊（官方 `mode:"view"` 的只读浏览语境）里官方并不提供，故此处不给。 */
    ...(favoriteTarget
      ? { favorite: { sourceFileId: favoriteTarget.sourceFileId, asset: favoriteTarget.asset } }
      : {}),
  };
  const base = {
    id: entry.node.id,
    versions,
    /** 官方 `cl(s.prompt)` */
    prompt: firstNonEmptyString(data.prompt) ?? '',
    actions,
    /* ★ 官方的 `createdAt` 来自资源对象（`b8` 里 `m.activeResource.createdAt`），facts 面板据此渲染
       **「日期」**那一段（官方实测全文：`分辨率 896 × 1200 / 模型 GPT Image 2.5 Flare / 日期 2026/3/24`）。
       ⚠️ 之前这里**漏了这个字段** ⇒ `PileGalleryViewer` 的 `activeVersion?.createdAt ?? session.createdAt`
       两边都是 undefined ⇒ 用户实测「堆叠全屏后没有时间信息」。
       取「入口媒体」那条历史版本的时间戳（与 `PileGalleryViewer` 的 `activeVersion` 同一份数据源）；
       匹配不到就保持 `undefined`（facts 面板会按官方 `loading` 语义不渲染该段，不产生空标签）。 */
    createdAt: versions.find((version) => version.src === entrySrcForLookup)?.createdAt,
  };
  if (content.type === 'image') {
    const src = displaySrc || content.displaySrc || content.fallbackSrc || '';
    if (!src) return null;
    return {
      ...base,
      media: { type: 'image', src, title: content.title },
      model: data.model,
      width: data.imageWidth,
      height: data.imageHeight,
    };
  }
  if (content.type === 'video') {
    const src = content.playbackSrc;
    if (!src) return null;
    return {
      ...base,
      media: { type: 'video', src, title: content.title },
      model: data.model,
      width: data.videoWidth,
      height: data.videoHeight,
      durationSeconds: data.videoDuration,
    };
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   官方 `EQe` @2949487 —— 视口 / 相机 hook（DOM 副作用部分；纯几何在 util 里）
   ══════════════════════════════════════════════════════════════════════════ */

interface GalleryViewportApi {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  worldRef: React.RefObject<HTMLDivElement | null>;
  worldStyle: CSSProperties;
  getCamera: () => GalleryViewportState;
  getTransform: () => { x: number; y: number; zoom: number };
  /**
   * 官方 `EQe` 的 `g(item)`。形参只用官方实际调用点**真正给到**的形状：
   * 官方 `se`（关闭查看器）传的是 `pe.items.find(...)`（`vQe` 的摆位盒，只有 center/width/height），
   * 而 `GalleryItem` 还带 `rotate`/`zIndex`（那是 `vJ` 的源摆位用的）⇒ 这里按 util 的
   * `galleryItemScreenRect(item: {centerX,centerY,width,height}, …)` 收窄到最小形状。
   */
  getItemScreenRect: (item: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  }) => GalleryRect;
  consumePanClick: () => boolean;
  handlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

interface GalleryViewportInput {
  canvasBounds: GalleryRect;
  viewportSize: { width: number; height: number };
  initialZoom: number;
  portalContainer: HTMLElement;
  enabled: boolean;
}

/** 官方 `nU()`（`index-BiTZf8mJ.js` 的 `tR` → 本地 `l_a`）：`/Mac|Macintosh/i.test(ua)` */
function isMacPlatform(): boolean {
  return /Mac|Macintosh/i.test(navigator.userAgent);
}

function useGalleryViewport({
  canvasBounds,
  viewportSize,
  initialZoom,
  portalContainer,
  enabled,
}: GalleryViewportInput): GalleryViewportApi {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<GalleryViewportState>(galleryInitialViewport(canvasBounds, initialZoom));
  const lastReadableZoomRef = useRef<number | null>(null);
  const panRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    camera: GalleryViewportState;
    hasMoved: boolean;
  } | null>(null);
  const panMovedRef = useRef(false);
  /** 官方用 `p.current` 布尔记住「`useLayoutEffect` 已经跑过一次」 */
  const cameraInitialisedRef = useRef(false);

  /** 官方 `EQe` 内部 `f(camera)`：写世界层 transform + 两条可读性 CSS 变量 */
  const applyCamera = useCallback(
    (camera: GalleryViewportState) => {
      cameraRef.current = camera;
      const world = worldRef.current;
      if (!world) return;
      const transform = galleryWorldTransform(camera, viewportSize);
      world.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.zoom})`;
      if (!galleryReadableScaleChanged(lastReadableZoomRef.current, camera.zoom)) return;
      const readable = galleryReadableScale(camera.zoom);
      world.style.setProperty('--pile-gallery-readable-scale', String(readable.scale));
      world.style.setProperty('--pile-gallery-readable-width', readable.width);
      lastReadableZoomRef.current = camera.zoom;
    },
    [viewportSize],
  );

  /** 官方：首次永远 `VG(bounds, initialZoom)`（居中），之后每次 `qb(camera, bounds)` */
  useLayoutEffect(() => {
    const first = !cameraInitialisedRef.current;
    cameraInitialisedRef.current = true;
    applyCamera(
      first
        ? galleryCameraForBounds(canvasBounds, initialZoom, null)
        : galleryCameraForBounds(canvasBounds, initialZoom, cameraRef.current),
    );
  }, [applyCamera, canvasBounds, initialZoom]);

  /** 官方 `m(zoom, point)`（= util 的 `galleryZoomAboutPoint`）只被滚轮/触控板的 `ctrlKey`
      分支调用，而 util 的 `galleryWheelCamera` 已经把该分支内联 ⇒ 这里不再单独暴露 `zoomAbout`。 */

  /** 官方 `g(item)` —— 画廊空间 → portal 视口里的屏幕矩形 */
  const getItemScreenRect = useCallback(
    (item: { centerX: number; centerY: number; width: number; height: number }): GalleryRect => {
      const origin = galleryElementOrigin(portalContainer);
      const transform = galleryWorldTransform(cameraRef.current, viewportSize);
      return galleryItemScreenRect(item, origin, transform);
    },
    [portalContainer, viewportSize],
  );

  /**
   * 官方 `b(E)` —— 背景平移的 pointerdown：命中
   * `[data-pile-gallery-item], [data-media-viewer], button, a, input` 时**不接管**；
   * 只接受左/中/右键；随后 `setPointerCapture` + `preventDefault`。
   */
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-pile-gallery-item], [data-media-viewer], button, a, input')) return;
      if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
      panRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        camera: cameraRef.current,
        hasMoved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [enabled],
  );

  /** 官方 `v(E)` —— 位移除以**按下时的** zoom；`|dx|+|dy| > 3` 记 `hasMoved` */
  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pan = panRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      if (galleryPanHasMoved(pan, event)) pan.hasMoved = true;
      applyCamera(
        galleryPanCamera(
          pan.camera,
          { x: event.clientX - pan.clientX, y: event.clientY - pan.clientY },
          canvasBounds,
        ),
      );
    },
    [applyCamera, canvasBounds],
  );

  /** 官方 `y(E)` */
  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    panMovedRef.current = pan.hasMoved;
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  /** 官方 `w()` —— 消费一次「刚刚平移过」标记（用来吃掉这次 click） */
  const consumePanClick = useCallback(() => {
    if (!panMovedRef.current) return false;
    panMovedRef.current = false;
    return true;
  }, []);

  /** 官方 `x(E)` —— ctrlKey 走以指针为锚的缩放，否则走滚轮平移（倍率 `jG = 1.2`） */
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      applyCamera(
        galleryWheelCamera(
          event,
          cameraRef.current,
          canvasBounds,
          viewportSize,
          galleryElementOrigin(portalContainer),
          isMacPlatform(),
        ),
      );
    },
    [applyCamera, canvasBounds, portalContainer, viewportSize],
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || !enabled) return;
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [enabled, handleWheel]);

  /**
   * 官方 `useMemo(()=>{…},[t])` 的 `worldStyle`：只在 `viewportSize` 变化时重算
   * （每帧更新走 `applyCamera` 的命令式写样式）。自定义 CSS 属性需要断言成 `CSSProperties`。
   */
  const initialCamera = useMemo(
    () => galleryInitialViewport(canvasBounds, initialZoom),
    [canvasBounds, initialZoom],
  );
  const worldStyle = useMemo<CSSProperties>(() => {
    const style = galleryWorldStyle(initialCamera, viewportSize);
    return {
      transformOrigin: style.transformOrigin,
      transform: style.transform,
      '--pile-gallery-readable-scale': String(style.readableScale),
      '--pile-gallery-readable-width': style.readableWidth,
    } as CSSProperties;
  }, [initialCamera, viewportSize]);

  const getCamera = useCallback(() => cameraRef.current, []);
  const getTransform = useCallback(
    () => galleryWorldTransform(cameraRef.current, viewportSize),
    [viewportSize],
  );

  return useMemo(
    () => ({
      viewportRef,
      worldRef,
      worldStyle,
      getCamera,
      getTransform,
      getItemScreenRect,
      consumePanClick,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
    }),
    [
      worldStyle,
      getCamera,
      getTransform,
      getItemScreenRect,
      consumePanClick,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
    ],
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   官方 `aQe` @2942401 / `ZZe` @2938157 / `XZe` @2937851 —— 成员上方标签
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 官方 `XZe({type, className})` @2937851 —— 按内容类型给图标（Tabler `ai`/`$o`/`Si`/`Ws`/`J3`）。
 * ⚠️ MTV 偏离：官方图标组件来自 `index-BiTZf8mJ.js` 的 Tabler 包装（`G as Ws` 等），MTV 侧没有同名导出
 *    ⇒ 用与 `PileMemberPreview`（= 官方 `TT`）**同一套手绘 path** 的本地图标；
 *    外层 span 的类名沿官方（`size-3 shrink-0 text-muted-foreground`）。这是纯图标资产差异，不是结构调整。
 */
function GalleryTypeIcon({ type, className }: { type: string; className?: string }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    className,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (type === 'video') {
    return (
      <svg {...common}>
        <path d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z" />
        <rect x="3" y="6" width="12" height="12" rx="2" />
      </svg>
    );
  }
  if (type === 'audio') {
    return (
      <svg {...common}>
        <path d="M6 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
        <path d="M9 17v-13h10v13" />
        <path d="M9 8h10" />
      </svg>
    );
  }
  if (type === 'text') {
    return (
      <svg {...common}>
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
        <path d="M9 9l1 0" />
        <path d="M9 13l6 0" />
        <path d="M9 17l6 0" />
      </svg>
    );
  }
  if (type === 'image') {
    return (
      <svg {...common}>
        <path d="M15 8h.01" />
        <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" />
        <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
        <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" />
    </svg>
  );
}

/**
 * 官方 `aQe({type,title})` @2942401 —— 把标签包进「可读性缩放」壳里（类名/内联 style 逐字）：
 * ```jsx
 * <div className="flow-root origin-bottom-left"
 *      style={{width:"var(--pile-gallery-readable-width, 100%)",
 *              transform:"scale(var(--pile-gallery-readable-scale, 1))"}}>
 *   <ZZe .../>
 * </div>
 * ```
 * 两条 CSS 变量由 `useGalleryViewport` 写在世界层元素上（官方 `EQe` 的 `zG` 分支）。
 */
function PileGalleryItemLabel({ type, title }: { type: string; title: string }) {
  return (
    <div
      className="flow-root origin-bottom-left"
      style={{
        width: 'var(--pile-gallery-readable-width, 100%)',
        transform: 'scale(var(--pile-gallery-readable-scale, 1))',
      }}
    >
      {/* 官方 `ZZe` @2938157 —— 类名逐字 */}
      <div className={PILE_RENDER_CLASSES.previewTitleRow}>
        {/* 官方 `XZe({type, className})` 把 `size-3 shrink-0 text-muted-foreground`
            **直接给图标组件**；MTV 早前多套了一层 `<span>` ✗ ⇒ 现在同样直接给图标 ✓ */}
        <GalleryTypeIcon type={type} className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{title}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   官方 `lQe` @2942621 —— 画廊里的单个成员
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 官方 `eU({id, data, disabled})`（= dnd-kit `useDraggable`）在本移植里的替代绑定。
 * 官方是 `{listeners, setNodeRef}` 两个东西；这里 `setNodeRef` 单独由父级 `onElementChange` 承担。
 */
interface PileGalleryItemDragBindings {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

interface PileGalleryItemProps {
  member: PileGalleryEntry;
  /** 官方 `Bt = pe.items.find(...)` —— `vQe` 产出的行内盒子（只有 centerX/centerY/width/height） */
  target: GalleryPlacedBox;
  initialTransform: false | GalleryLayoutTransform;
  animateTransform: GalleryLayoutTransform;
  initialDepthShadeOpacity: number | false;
  depthShadeOpacity: number;
  showDepthShade: boolean;
  zIndex: number;
  canDrag: boolean;
  isPointerDragging: boolean;
  contentHidden: boolean;
  isCollapsed: boolean;
  showLabel: boolean;
  labelDelaySeconds: number;
  actionsEnabled: boolean;
  previewEnabled: boolean;
  prefersReducedMotion: boolean;
  transition: GalleryMemberTransition | { duration: number; ease?: readonly number[] };
  viewerOffset: { x: number; y: number };
  viewerHidden: boolean;
  viewerTransition: { duration: number; delay: number; ease: readonly number[] } | null;
  canOpenMedia: boolean;
  onOpenMedia: (memberId: string, anchor: { rect: GalleryRect; borderRadius: number }) => void;
  onDismissError: (memberId: string) => void;
  onElementChange: (memberId: string, element: HTMLElement | null) => void;
  dragBindings: PileGalleryItemDragBindings;
}

function PileGalleryItem({
  member,
  target,
  initialTransform,
  animateTransform,
  initialDepthShadeOpacity,
  depthShadeOpacity,
  showDepthShade,
  zIndex,
  canDrag,
  isPointerDragging,
  contentHidden,
  isCollapsed,
  showLabel,
  labelDelaySeconds,
  actionsEnabled,
  previewEnabled,
  prefersReducedMotion,
  transition,
  viewerOffset,
  viewerHidden,
  viewerTransition,
  canOpenMedia,
  onOpenMedia,
  onDismissError,
  onElementChange,
  dragBindings,
}: PileGalleryItemProps) {
  const t = useT();
  const memberId = member.node.id;
  const surfaceRef = useRef<HTMLElement | null>(null);
  const display = member.display;
  const displaySize = member.displaySize;

  /** 官方 `z = e.node.type===he.IMAGE || e.node.type===he.VIDEO`（MTV 类型名带前缀 ⇒ 一起判） */
  const isMedia =
    member.node.type === 'image' ||
    member.node.type === 'video' ||
    member.node.type === 'ai-image' ||
    member.node.type === 'ai-video' ||
    member.node.type === 'source-image' ||
    member.node.type === 'source-video';
  const isReady = display.status.kind === 'ready';
  /** 官方 `P = b && R`（`previewEnabled && ready`） */
  const surfaceInteractive = previewEnabled && isReady;
  /** 官方 `j = g && z && R` */
  const mediaActionVisible = actionsEnabled && isMedia && isReady;
  /** 官方 `V = g && D.status.kind === "error"`。
      ⚠️ MTV 偏离：MTV 的 `PilePreviewStatus.kind` 只有 `loading|ready`（见 `PileMemberPreview.tsx`），
      没有官方的 `error` 档 ⇒ 该比较恒为 false；官方控制流（`V`/`H`/`Y`）原样保留。 */
  const errorActionVisible = actionsEnabled && (display.status.kind as string) === 'error';
  /** 官方 `H = P || V` */
  const hasPointerSurface = surfaceInteractive || errorActionVisible;

  /**
   * 官方 `$ = j ? l.jsx(oQe,{node:e.node}) : void 0` —— `oQe` @2941561 是**媒体「收藏」按钮**，
   * 由 `PileFavoriteButton` 逐字承接（`hJ` 按钮壳 + `rh`/`Rg` 图标 + `L_`/`nc` 收藏回路）。
   * 传参 `mediaSrc` 是唯一的 MTV 适配点：官方 `oQe` 内部走 `Qd.nodeToFiles[node.id]` + `g8` 自己解析，
   * MTV 没有 `nodeToFiles` 索引 ⇒ 这里把**预览实际用的那个 src** 交给它
   * （与官方 `MQe` 给 `b8` 的 `options.displaySrc` 同一来源）。
   */
  const favoriteMediaSrc = display.content.type === 'video'
    ? display.content.playbackSrc
    : display.content.type === 'image'
      ? display.content.displaySrc || display.content.fallbackSrc
      : undefined;
  const favoriteAction = mediaActionVisible
    ? <PileFavoriteButton node={member.node} mediaSrc={favoriteMediaSrc} />
    : undefined;
  /** 官方 `W = () => E(k)`（`E` = `dismissMemberError`），`Y = V ? {label,onSelect:W} : void 0` */
  const handleDismissError = useCallback(() => {
    onDismissError(memberId);
  }, [memberId, onDismissError]);
  /**
   * 官方 `Y = V ? {label:T("common.confirm"), onSelect:W} : void 0`。
   * ⚠️ MTV 偏离：MTV 的 `PileMemberPreview` 没有 `errorAction` 插槽 ⇒ 这个对象没有接收方；
   *    这里仍然按官方构造出来（`common.confirm` → MTV i18n 的 `确认`），只差最后一步注入。
   */
  const errorAction = errorActionVisible
    ? { label: t('确认'), onSelect: handleDismissError }
    : undefined;
  void errorAction;

  /** 官方 `Q = iQe(c, d)` @2942306 —— 光标类名 */
  const cursorClassName = isPointerDragging
    ? 'cursor-grabbing'
    : canDrag
      ? 'cursor-grab active:cursor-grabbing'
      : undefined;

  /** 官方 `q = (re) => { F(re); N(k, re) }` —— `setNodeRef` + `onElementChange` */
  const setElementRef = useCallback(
    (element: HTMLDivElement | null) => {
      surfaceRef.current = element;
      onElementChange(memberId, element);
    },
    [memberId, onElementChange],
  );

  /** 官方 `X` —— 打开媒体预览（`GP` 取源锚点） */
  const handleOpenMedia = useCallback(() => {
    const element = surfaceRef.current;
    if (!canOpenMedia || !element) return;
    onOpenMedia(memberId, galleryElementAnchor(element));
  }, [canOpenMedia, memberId, onOpenMedia]);

  /** 官方 `te = (re) => { re.defaultPrevented || X() }` */
  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) return;
      handleOpenMedia();
    },
    [handleOpenMedia],
  );

  /* 官方 `B/M` = 成员在**目标布局**里的左上角；再加上媒体查看器打开时的「相邻项外推」偏移 */
  const left = target.centerX - target.width / 2;
  const top = target.centerY - target.height / 2;

  return (
    <motion.div
      className={joinClasses('absolute left-0 top-0 select-none', cursorClassName)}
      style={{ width: target.width, height: target.height, zIndex }}
      /* 官方 `initial:!1` */
      initial={false}
      animate={{ x: left + viewerOffset.x, y: top + viewerOffset.y, opacity: viewerHidden ? 0 : 1 }}
      /* 官方 `transition: C ?? y`（`C` = 查看器打开时的相邻项过渡，未打开时为 `undefined`） */
      transition={toMotionTransition(viewerTransition ?? transition)}
      data-pile-gallery-item={memberId}
    >
      <div
        ref={setElementRef}
        className="relative size-full"
        style={{ touchAction: canDrag ? 'none' : undefined }}
        onPointerDown={dragBindings.onPointerDown}
        onPointerMove={dragBindings.onPointerMove}
        onPointerUp={dragBindings.onPointerUp}
        onPointerCancel={dragBindings.onPointerCancel}
        onClick={handleClick}
      >
        {/* 官方标签层：`bottom-full` 挂在成员上方 */}
        <motion.div
          className="pointer-events-none absolute bottom-full left-0 w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: showLabel ? 1 : 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : GALLERY_LABEL_DURATION_SECONDS,
            delay: prefersReducedMotion ? 0 : labelDelaySeconds,
            ease: motionEase(GALLERY_OPEN_CLOSE.rotationEase),
          }}
        >
          <PileGalleryItemLabel type={display.content.type} title={display.content.title} />
        </motion.div>

        {/* 官方表面层：`absolute left-1/2 top-1/2 origin-center` + 负 margin 居中 */}
        <motion.div
          className={joinClasses(
            'absolute left-1/2 top-1/2 origin-center',
            hasPointerSurface ? 'pointer-events-auto' : 'pointer-events-none',
            contentHidden && 'invisible',
          )}
          data-pile-gallery-surface={memberId}
          style={{
            width: displaySize.width,
            height: displaySize.height,
            marginLeft: -displaySize.width / 2,
            marginTop: -displaySize.height / 2,
            willChange: isCollapsed ? 'transform' : undefined,
          }}
          initial={initialTransform === false ? false : toMotionTarget(initialTransform)}
          animate={toMotionTarget(animateTransform)}
          transition={toMotionTransition(transition)}
        >
          {/* 官方 `l.jsx(TT, {rootRef:I, ...D, previewEnabled:P, actions:$, errorAction:Y})`
              ⚠️ MTV 偏离：`PileMemberPreview`（= 官方 `TT`/`YZe`）现在接了 `actions`（= 上面的 `$`），
                 但 `rootRef`（官方给 `oQe` 收藏按钮用）/ `previewEnabled` / `errorAction`
                 仍是空位（插槽对应行为见 `$` / `Y` 的记账）。 */}
          <PileMemberPreview content={display.content} status={display.status} actions={favoriteAction} />
          {/* 官方 `fJ` 深度遮罩（= `PILE_RENDER_CLASSES.shade`，与 `PileNode` 同一份） */}
          {showDepthShade && (
            <motion.div
              aria-hidden
              className={PILE_RENDER_CLASSES.shade}
              initial={initialDepthShadeOpacity === false ? false : { opacity: initialDepthShadeOpacity }}
              animate={{ opacity: depthShadeOpacity }}
              transition={toMotionTransition(transition)}
            />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   官方 `sQe` @2940688 —— 交接动画层（拖出去之后飞向目标的那一张）
   ══════════════════════════════════════════════════════════════════════════ */

function PileGalleryDragLayer({
  display,
  displaySize,
  plan,
  prefersReducedMotion,
}: {
  display: PileGalleryDisplay;
  displaySize: GalleryMemberSize;
  plan: GalleryHandoffPlan;
  prefersReducedMotion: boolean;
}) {
  /** 官方 `r = Px(t, n.sourceRect)` */
  const fit = galleryFitScale(displaySize, plan.sourceRect);
  const sourceCenterX = plan.sourceRect.left + plan.sourceRect.width / 2;
  const sourceCenterY = plan.sourceRect.top + plan.sourceRect.height / 2;
  const fromX = sourceCenterX - displaySize.width / 2;
  const fromY = sourceCenterY - displaySize.height / 2;
  const toX = plan.target.centerX - displaySize.width / 2;
  const toY = plan.target.centerY - displaySize.height / 2;
  const scaleX = plan.target.width / displaySize.width;
  const scaleY = plan.target.height / displaySize.height;
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-[30] origin-center"
      data-pile-gallery-drag-layer={plan.memberId}
      data-pile-gallery-drag-mode={plan.kind === 'canvas' ? 'landing' : 'returning'}
      style={{
        width: displaySize.width,
        height: displaySize.height,
        willChange: plan.kind === 'canvas' ? 'transform, opacity' : 'transform',
      }}
      initial={{
        x: fromX,
        y: fromY,
        scaleX: fit,
        scaleY: fit,
        opacity: 1,
        ...(plan.kind === 'pile' ? { rotate: 0 } : {}),
      }}
      animate={{
        x: toX,
        y: toY,
        scaleX,
        scaleY,
        opacity: plan.kind === 'canvas' ? 0 : 1,
        ...(plan.kind === 'pile' ? { rotate: plan.target.rotate } : {}),
      }}
      transition={handoffMotionTransition(plan.kind, prefersReducedMotion)}
    >
      <PileMemberPreview content={display.content} status={display.status} />
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   官方 `WQe` @2955733 —— 全屏画廊主体
   ══════════════════════════════════════════════════════════════════════════ */

/** 官方 `T`（`F.current`）—— 拖拽中 / 交接中的状态机 */
type PileGalleryDragOrHandoff =
  | {
      phase: 'dragging';
      memberId: string;
      members: PileGalleryEntry[];
      screenRect: GalleryRect;
      grabPoint: GalleryGrabPoint;
      isCollapsing: boolean;
    }
  | { phase: 'handoff'; members: PileGalleryEntry[]; plan: GalleryHandoffPlan };

/** 官方 `I.phase`（= 官方 `u8` 的 `phase` 入参） */
export type PileGalleryViewerPhase = 'opening' | 'open' | 'closing';

/** 官方 `GP(e)` @480329（= 本文件 `galleryElementAnchor`）或 `EQe` 的 `g(item)` 产出的锚点 */
export interface PileGalleryViewerAnchor {
  rect: GalleryRect;
  borderRadius: number;
}

/**
 * 官方 `MQe` → `b8(node, {displaySrc, mode:"view", registeredFileIds})` @583457 产出的
 * **媒体查看器会话**（= 官方 `u8` 的 `session` 入参）在 MTV 侧的形态。
 * ⚠️ MTV 偏离：官方会话对象还带 `activeMedia` / `activeResource` / `mode` / `media.title` 等字段；
 *    MTV 的 `MediaViewer` 只需要下面这些（逐项映射表写在 `PileGalleryViewer.tsx` 的文件头）。
 *    `actions` 已于本轮接上（底条 `Qge`）。
 */
export interface PileGalleryViewerSession {
  /** 官方 `session.id`（= 节点 id） */
  id: string;
  /**
   * 官方 `session.media`。`type` 故意留成 `string`：官方 `u8` 用它把 `media.type==="text"`
   * 分流到文本查看器 `sxe`，本文件成员渲染里的 `viewer.media.type === 'text'` 判定也要能编译。
   * MTV 侧只建 image/video 两种会话（见 `pileGalleryViewerSession`）。
   */
  media: { type: string; src: string; title: string };
  /** 官方 `m.resources`（历史版本列 `Obe` 的数据；`length<=1` 时整列不渲染） */
  versions: readonly MediaViewerVersion[];
  /** 官方 `m.actions`（`b8` @583072 的 `actions` 字段，逐字形状） */
  actions: PileGalleryViewerActions;
  /** 官方 `m.prompt`（入口版本的提示词；选中别的版本时由 `versions` 里那条覆盖） */
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  createdAt?: number;
  durationSeconds?: number;
}

/**
 * 官方 `b8` @583072 里 `actions` 表的逐字形状（`Qge` 的开关来源）：
 * ```js
 * actions: { copy:!0, download:t.downloadEnabled!==!1, favorite:g8(node,registeredFileIds,src),
 *            setAsMain:t.setAsMainEnabled&&i ? {mainSrc:ur(i)} : void 0 }
 * ```
 * `favorite` 的形状 = 官方 `g8` 的返回值（`{sourceFileId, asset}`），见 `utils/officialFavorites.ts`。
 */
export interface PileGalleryViewerActions {
  /** 官方 `copy:!0` */
  copy: boolean;
  /** 官方 `download`（`t.downloadEnabled !== !1`） */
  download: boolean;
  /** 官方 `setAsMain`（有主媒体才给） */
  setAsMain?: { mainSrc: string };
  /** 官方 `favorite`（`g8` 解析不到资产时为 `undefined` ⇒ 底条不渲染该条目，与官方一致） */
  favorite?: { sourceFileId: string; asset: FavoriteAsset };
}

/** 官方 `I` —— 媒体查看器会话（`xe` 的成员视图模型 + 源锚点） */
interface PileGalleryViewerState {
  phase: PileGalleryViewerPhase;
  viewer: PileGalleryViewerSession & { sourceAnchor?: PileGalleryViewerAnchor };
  closeTargetAnchor?: PileGalleryViewerAnchor;
}

/** 官方 `ye = I ? pe.items.find(st=>st.id===I.viewer.id) : void 0`（媒体查看器当前项） */
function viewerItemOf(
  items: readonly GalleryPlacedBox[],
  viewer: PileGalleryViewerState | null,
): GalleryPlacedBox | null {
  if (!viewer) return null;
  return items.find((item) => item.id === viewer.viewer.id) ?? null;
}

export default function PileGallery({
  pileId,
  members,
  canEdit,
  portalContainer,
  snapshot,
  initialZoom,
  previewMode,
  sourceImageVariant: _sourceImageVariant,
  onPreviewModeChange,
  onOpened,
  onClosing,
  onDragCollapseActivated,
  onClosed,
}: PileGalleryProps) {
  const t = useT();
  /** 官方 `g = Yo()`（framer-motion `useReducedMotion`） */
  const prefersReducedMotion = useReducedMotion() ?? false;

  /* ⚠️ MTV 偏离：官方 `$` 走 `sb(st.node, a)`（`Pn.SMALL` CDN 变体）、`W` 走 `LYe(st.node)`（`Pn.MEDIUM`）。
     MTV 的媒体是本地文件/直链，没有变体服务 ⇒ 两者内容等价（见 `buildGalleryEntry`），
     该入参被忽略 —— 官方 `Y = G ? W : $` 的**切换逻辑仍然保留**。 */
  void _sourceImageVariant;

  /**
   * 官方 `gJ()` @2939707 —— PILE 画廊上下文 store（`mJ` context；缺省回落 `tQe` @2939490）。
   *
   * ★★ 这里现在是**官方 `gJ()` 的真身**：官方 `WQe`@2960017 第一行就是
   *    `const {dismissMemberError:b, moveMemberToTop:v, removeMember:y} = gJ()`。
   *    真实 value 由 `PileMemberActionsScope`（= 官方 `us`，`page-DPdEgTS0.js`@1460466）注入；
   *    没有 provider 时 `usePileMemberActions()` 回落官方禁用态 `tQe`（@2939490）✓
   *    ⇒ 「把成员拖出画廊丢到画布」不再是恒 null，`_e` 能真正摘出成员 ✓
   */
  const {
    removeMember,
    moveMemberToTop,
    dismissMemberError,
  } = usePileMemberActions();
  /**
   * 官方 `up(st=>st.beginLandingNodes)` / `up(st=>st.finishLandingNodes)`
   * （`zoom-slider` @2814211 的 `Ln(...)` zustand store：`landingNodeIds: Set<string>`）。
   * ⚠️ MTV 偏离：MTV 没有「落地节点」store（`PILE_LANDING_NODE_CLASS` 的类名在，驱动它的 store 不在）
   *    ⇒ 保留官方**全部调用点与时序**（拖出/关闭/交接完成时把 id 交还），落到本地 ref 集合上；
   *    可见差异 = MTV 画布不会给这些节点加 `pile-landing-node`。已记账。
   */
  const landingIdsRef = useRef(new Set<string>());
  const beginLandingNodes = useCallback((ids: readonly string[]) => {
    for (const id of ids) landingIdsRef.current.add(id);
  }, []);
  const finishLandingNodes = useCallback((ids: readonly string[]) => {
    for (const id of ids) landingIdsRef.current.delete(id);
  }, []);

  /* ── 官方 `WQe` 的 useState/useRef 全表（顺序与官方一致，便于逐行对照） ── */
  /** 官方 `[S,_] = useState(g?"open":"opening")` */
  const [phase, setPhase] = useState<GalleryPhase>(prefersReducedMotion ? 'open' : 'opening');
  /** 官方 `[E,N] = useState(()=>GG(s))` */
  const [viewportSize, setViewportSize] = useState(() =>
    galleryViewportSize(portalContainer, { width: window.innerWidth, height: window.innerHeight }),
  );
  /** 官方 `[T,k] = useState(null)` */
  const [dragState, setDragState] = useState<PileGalleryDragOrHandoff | null>(null);
  /** 官方 `[I,D] = useState(null)` */
  const [viewer, setViewer] = useState<PileGalleryViewerState | null>(null);
  /**
   * 官方 `[G,L] = useState(!1)` + `S==="open" && L(!0)` —— 「已经进过 open」的**锁存**布尔。
   * ⚠️ MTV 偏离（纯重构，渲染结果相同）：官方用 state + effect 锁存，会触发
   * `react-hooks/set-state-in-effect`（同步 setState 引起级联渲染）。这里改成**从相位机推导**：
   * `closing` 只可能从 `open` 进入（`beginClose` 要求 `phase==="open"`，`_t` 只在拖拽=open 时触发；
   * 自动关闭那条 effect 在 `opening` 时只会把相位推到 `open`），所以 `S!=="opening"` 与官方锁存
   * **完全等价**；两者只在「reduce-motion 首帧」差一帧，而 MTV 下 `$` 与 `W` 内容相同（见下方记账）。
   */
  const hasOpened = phase !== 'opening';
  /** 官方 `F = useRef(null)` —— 同步的拖拽/交接状态（state 只服务渲染） */
  const dragStateRef = useRef<PileGalleryDragOrHandoff | null>(null);
  /** 官方 `B = useRef(new Map)` —— 成员 id → 成员 DOM（`eU` 的 `setNodeRef` 收集） */
  const elementsRef = useRef(new Map<string, HTMLElement>());
  /** 官方 `M = useRef(null)` —— 拖拽浮层里那张的 DOM（`fQe` 的 override 矩形） */
  const overlayItemRef = useRef<HTMLDivElement | null>(null);
  /** 官方 `z = useRef(new Set)` —— 「已交给画布落地」的成员 id */
  const pendingLandingRef = useRef(new Set<string>());
  /** 官方 `R = useRef([])` —— 本次关闭需要交还的 id */
  const currentLandingRef = useRef<string[]>([]);
  /** 官方 `V = useRef(!0)` —— 是否仍挂载 */
  const mountedRef = useRef(true);
  /** 官方 `H = useRef(!1)` —— 是否已经关闭过 */
  const closedRef = useRef(false);

  /* ── 官方 `$` / `W` / `Y`：三种 CDN 变体的成员视图模型（MTV 下三者等价） ── */
  /** 官方 `zQ` 里 `oO(node)` 那一层：MTV 用 `renderSizeOf(node, nodes)`（与 PileNode 同一套） */
  const storeNodes = useAppStore((state) => state.nodes);
  const sizeOfNode = useCallback(
    (node: AnyNode) => renderSizeOf(node as never, storeNodes as never),
    [storeNodes],
  );
  /**
   * 官方 `$` / `W` 的输入归一：允许 `{node, displaySize}` 与**裸成员节点**两种形态。
   * 裸节点走官方 `zQ` 的原始流程 —— `mh(node)` = `pileDisplaySize(node, oO)`。
   */
  const entries = useMemo<PileGalleryEntry[]>(
    () =>
      members.map((member) =>
        'node' in member
          ? buildGalleryEntry(member.node, member.displaySize)
          : buildGalleryEntry(member, pileDisplaySize(member, sizeOfNode)),
      ),
    [members, sizeOfNode],
  );
  /** 官方 `$ = t.map(st=>sb(st.node, a))`（`Pn.SMALL`）—— MTV 与 `W` 等价 */
  const sourceEntries = entries;
  /** 官方 `W = t.map(st=>LYe(st.node))`（`Pn.MEDIUM`） */
  const mediumEntries = entries;
  /** 官方 `Y = G ? W : $` —— 进过 `open` 之后切到 medium 变体 */
  const activeEntries = hasOpened ? mediumEntries : sourceEntries;

  /** 官方 `j.current = mQe(W)`（图片预载；`j` 从不被读取 ⇒ 纯副作用） */
  const preloadRef = useRef<HTMLImageElement[]>([]);
  useEffect(() => {
    const sources: string[] = [];
    for (const entry of mediumEntries) {
      const content = entry.display.content;
      if (content.type !== 'image') continue;
      if (!content.displaySrc) continue;
      sources.push(content.displaySrc);
    }
    preloadRef.current = preloadGalleryImages(sources);
    return () => {
      preloadRef.current = [];
    };
  }, [mediumEntries]);


  /* ── 官方派生值（行号对应 `_gallery-WQe.pretty.js`） ── */
  /** 官方 `Q = T?.members ?? Y` */
  const activeMembers: PileGalleryEntry[] = dragState?.members ?? activeEntries;
  /** 官方 `q = T?.phase==="dragging" ? T : null` */
  const dragging = dragState?.phase === 'dragging' ? dragState : null;
  /** 官方 `X = T?.phase==="handoff" ? T.plan : null` */
  const handoffPlan = dragState?.phase === 'handoff' ? dragState.plan : null;
  /** 官方 `te = q?.memberId ?? X?.memberId ?? null` */
  const draggingMemberId = dragging?.memberId ?? handoffPlan?.memberId ?? null;
  /** 官方 `re = jQe(T)` */
  const collapseMemberId = galleryCollapseMemberId(dragState as GalleryDragOrHandoff | null);
  /** 官方 `ne = q !== null` */
  const isPointerDragging = dragging !== null;
  /** 官方 `fe = re ? null : te` */
  const contentHiddenMemberId = collapseMemberId ? null : draggingMemberId;
  /** 官方 `de = Q.filter(st=>st.node.id!==re)` */
  const renderedMembers = useMemo(
    () => activeMembers.filter((entry) => entry.node.id !== collapseMemberId),
    [activeMembers, collapseMemberId],
  );

  /** 官方 `pe = vQe(Q)` —— 画廊全屏层的行布局画布 */
  const rowCanvas = useMemo(() => galleryRowCanvas(activeMembers), [activeMembers]);
  const canvasBounds = useMemo(
    () => galleryCanvasEdgesToRect(rowCanvas.canvasBounds),
    [rowCanvas.canvasBounds],
  );

  /** 官方 `r.sources` —— 源摆位表（官方 provider 在开画廊那一刻用 `vJ` 算的同一份） */
  const sourceLayout = useMemo(
    () => gallerySourceLayout(layoutInput(entries), snapshot),
    [entries, snapshot],
  );

  /** 官方 `le = EQe({canvasBounds:pe.canvasBounds, viewportSize:E, initialZoom:o, portalContainer:s, enabled:S==="open"&&T===null&&I===null})`
      拆开成独立绑定（官方是 `le.xxx`）—— 对象的成员访问会被 `react-hooks/refs` 误判成「渲染期访问 ref」。 */
  const {
    viewportRef: galleryViewportRef,
    worldRef: galleryWorldRef,
    worldStyle: galleryWorldStyleValue,
    getCamera: getGalleryCamera,
    getTransform: getGalleryTransform,
    /** 官方 `le.getItemScreenRect`（官方 `se` 关闭查看器时算回退锚点用） */
    getItemScreenRect,
    consumePanClick: consumeGalleryPanClick,
    handlePointerDown: handleViewportPointerDown,
    handlePointerMove: handleViewportPointerMove,
    handlePointerUp: handleViewportPointerUp,
  } = useGalleryViewport({
    canvasBounds,
    viewportSize,
    initialZoom,
    portalContainer,
    enabled: phase === 'open' && dragState === null && viewer === null,
  });

  /**
   * 官方 `xe = MQe(Q)` @2953647 —— 媒体查看器的成员视图模型（`nodeId → 会话`）。
   * ⚠️ MTV 偏离：官方 `MQe` 内部调 `b8`（`mediaViewerMember` @583457）那个跨模块大构造函数；
   *    util 已把这段保留为注入回调 `galleryViewerMembers(..., buildMember)` ⇒ 这里注入
   *    `pileGalleryViewerSession`（= `b8` 的 MTV 适配版，逐项记账见该函数）。
   *    官方 `MQe` 的过滤/写入条件**逐字保留**（`status.kind==="ready"`、只有 image 才给
   *    `displaySrc`、`registeredFileIds` 按 `nodeToFiles[node.id]` 取、`built` 非空才 `set`）；
   *    `nodeToFiles`（官方 `Qd` store 的媒体资产登记，只服务底条 `favorite`）MTV 没有 ⇒ 传 `{}`。
   *    结果：image/video 成员能造出会话 ⇒ 官方 `Ve`（打开）与 `Zt`（`canOpenMedia` 门）真正生效；
   *    文本/音频成员造不出会话（见 `pileGalleryViewerSession` 的返回 `null` 记账）。
   */
  const outputHistoryRecords = useAppStore((state) => state.outputHistoryRecords);
  const viewerMembers = useMemo(() => {
    const entriesById = new Map(entries.map((entry) => [entry.node.id, entry] as const));
    return galleryViewerMembers<PileGalleryViewerSession>(entries, {}, (node, options) => {
      const entry = entriesById.get(node.id);
      return entry ? pileGalleryViewerSession(entry, options.displaySrc, outputHistoryRecords) : null;
    });
  }, [entries, outputHistoryRecords]);

  /** 官方 `ze = wC(i, Ne)` → 带展开倍数的源几何 */
  const activeSourceGeometry = useMemo(
    () => ({
      ...snapshot,
      previewExpansion: pilePreviewExpansion(previewMode, snapshot.previewExpansion),
    }),
    [previewMode, snapshot],
  );

  /** 官方 `ce = BQe(Q, te, X)` —— 交接阶段的成员集合 */
  const handoffMembers = useMemo(
    () => galleryHandoffMembers(activeMembers, draggingMemberId, handoffPlan),
    [activeMembers, draggingMemberId, handoffPlan],
  );

  /** 官方 `Be = Fk(ce, {...r.sourceGeometry, previewExpansion:ze})`（塌缩/交接目标布局） */
  const collapseLayout = useMemo(
    () => galleryLayout(layoutInput(handoffMembers), activeSourceGeometry),
    [handoffMembers, activeSourceGeometry],
  );
  /** 官方 `Oe = _l(Q).length` / `Ie = _l(ce).length` */
  const activeVisibleCount = pileLastFive(activeMembers).length;
  const collapseVisibleCount = pileLastFive(handoffMembers).length;

  /** 官方 `Qe = Fk(ce, {...r.sourceGeometry, previewExpansion: wC("drop-target", Ne)})` */
  const dropTargetLayout = useMemo(
    () =>
      galleryLayout(layoutInput(handoffMembers), {
        ...snapshot,
        previewExpansion: pilePreviewExpansion('drop-target', snapshot.previewExpansion),
      }),
    [handoffMembers, snapshot],
  );

  /** 官方 `Xe = te ? Q.find(st=>st.node.id===te) : void 0` */
  const draggingEntry = draggingMemberId
    ? activeMembers.find((entry) => entry.node.id === draggingMemberId)
    : undefined;
  /** 官方 `Re = Xe?.display` / `qe = Xe?.displaySize` */
  const dragDisplay = draggingEntry?.display;
  const dragDisplaySize = draggingEntry?.displaySize;

  /** 官方 `Ce = q && qe ? hQe(qe, q.screenRect, q.grabPoint, r.sourceGeometry.zoom) : null` */
  const dragCarry =
    dragging && dragDisplaySize
      ? galleryDragCarry(dragDisplaySize, dragging.screenRect, dragging.grabPoint, snapshot.zoom)
      : null;
  /** 官方 `et = Re ? VQe(Re.content) : 0` */
  const contentHandoffSeconds = dragDisplay ? galleryContentHandoffSeconds(dragDisplay.content) : 0;

  /** 官方 `yt = q?.isCollapsing===!0 || X?.kind==="canvas" || X?.kind==="pile"` */
  const collapsingOrHandoff =
    dragging?.isCollapsing === true || handoffPlan?.kind === 'canvas' || handoffPlan?.kind === 'pile';
  /** 官方 `nt = S!=="open" || yt` */
  const showDepthShadeLayer = phase !== 'open' || collapsingOrHandoff;

  /** 官方 `ht = LQe(T)`；`vt = GQe(yt,g)`；`At = HQe(S,g)` */
  const dragPhaseLabel = galleryDragPhaseLabel(dragState as GalleryDragOrHandoff | null);
  const backdropDurationSeconds = galleryBackdropDurationSeconds(collapsingOrHandoff, prefersReducedMotion);
  const chromeDelaySeconds = galleryChromeDelaySeconds(phase, prefersReducedMotion);
  /** 官方 `gt = zQe(S,T) && I===null`；`We = n && gt` */
  const canTogglePreview =
    galleryCanTogglePreview(phase, dragState as GalleryDragOrHandoff | null) && viewer === null;
  const actionsEnabled = canEdit && canTogglePreview;
  /** 官方 `je = I!==null && I.phase!=="closing"`；`Se = IQe(I,g)`（`I` 为空时是 `undefined`） */
  const viewerChromeVisible = viewer !== null && viewer.phase !== 'closing';
  const viewerTransition = viewer
    ? gallerySurroundingTransition(viewer.phase, prefersReducedMotion)
    : null;

  /**
   * 官方 `oe = (st) => { F.current = st; k(st) }` —— 同时写 ref 与 state。
   * `F.current` 是官方**同步**判定「当前有没有拖拽/交接」的依据（`Nt` 的门、`Ve` 的门、
   * document click 监听的分支），state 只服务渲染 ⇒ 两者必须同时更新。
   */
  const setDragStateBoth = useCallback((next: PileGalleryDragOrHandoff | null) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

  /**
   * 官方 `Ue = (st, ot) => fQe(st, ot.screenRect, s, M.current?.getBoundingClientRect())`
   * —— 拖拽几何（源矩形 / 屏幕中心 / 指针）；`M.current` 是拖拽浮层里那张的 DOM。
   */
  const dragGeometryOf = useCallback(
    (event: PileGalleryDragEvent, drag: { screenRect: GalleryRect }) => {
      const overlayRect = overlayItemRef.current?.getBoundingClientRect() ?? null;
      return galleryDragState(event, drag.screenRect, portalContainer, overlayRect);
    },
    [portalContainer],
  );

  /** 官方 `ct = (st, ot) => { if(!ot){B.current.delete(st);return} B.current.set(st, ot) }` */
  const handleElementChange = useCallback((memberId: string, element: HTMLElement | null) => {
    if (!element) {
      elementsRef.current.delete(memberId);
      return;
    }
    elementsRef.current.set(memberId, element);
  }, []);

  /**
   * 官方 `Ve = (st, ot) => { if(S!=="open"||F.current||I)return; const wt=xe.get(st);
   *   wt && D({phase:"opening", viewer:{...wt, sourceAnchor:ot}}) }` —— 打开媒体查看器（逐字）。
   * `xe`（`viewerMembers`）现在是**真的**成员视图模型（见上方 `pileGalleryViewerSession`）
   * ⇒ `...wt` 展开出来的是完整会话，交给 `PileGalleryViewer`（官方 `u8` 的 `session`）。
   */
  const openMedia = useCallback(
    (memberId: string, sourceAnchor: PileGalleryViewerAnchor) => {
      if (phase !== 'open' || dragStateRef.current || viewer) return;
      const session = viewerMembers.get(memberId);
      if (!session) return;
      setViewer({
        phase: 'opening',
        viewer: { ...session, sourceAnchor },
      });
    },
    [phase, viewer, viewerMembers],
  );

  /**
   * 官方 `se` @2958144 —— 请求关闭媒体查看器（逐字）：
   * ```js
   * se = useCallback(()=>{ if(I?.phase!=="open")return;
   *   const st=I.viewer.id, ot=pe.items.find(Jt=>Jt.id===st), wt=I.viewer.sourceAnchor,
   *         Bt= ot ? {rect:le.getItemScreenRect(ot), borderRadius:wt?.borderRadius??0} : wt;
   *   D(Jt=> Jt?.phase==="open" ? {...Jt, phase:"closing", closeTargetAnchor:Bt} : Jt) },[le,pe.items,I])
   * ```
   * ⇒ 相位 `open → closing`，并把「回退锚点」交给查看器。
   * ⚠️ MTV 偏离：官方 `closeTargetAnchor` 由 `Abe`/`sxe` 消费（反向形变回那个成员）；
   *    MTV 的 `MediaViewer` 没有锚点形变 ⇒ 值照官方算好、照官方形参传下去，但没有消费点。
   */
  const requestViewerClose = useCallback(() => {
    if (viewer?.phase !== 'open') return;
    const viewerId = viewer.viewer.id;
    const item = rowCanvas.items.find((box) => box.id === viewerId);
    const sourceAnchor = viewer.viewer.sourceAnchor;
    const closeTargetAnchor: PileGalleryViewerAnchor | undefined = item
      ? { rect: getItemScreenRect(item), borderRadius: sourceAnchor?.borderRadius ?? 0 }
      : sourceAnchor;
    setViewer((current) =>
      current?.phase === 'open' ? { ...current, phase: 'closing', closeTargetAnchor } : current,
    );
  }, [getItemScreenRect, rowCanvas.items, viewer]);

  /** 官方 `be` @2958439 —— 打开形变结束：`D(st => st?.phase==="opening" ? {...st, phase:"open"} : st)` */
  const markViewerOpened = useCallback(() => {
    setViewer((current) =>
      current?.phase === 'opening' ? { ...current, phase: 'open' } : current,
    );
  }, []);

  /** 官方 `Ye` @2958519 —— 关闭形变结束：`D(null)`（卸载查看器浮层） */
  const clearViewer = useCallback(() => {
    setViewer(null);
  }, []);

  /**
   * 官方 `_e = (st, ot, wt) => {…}` —— 把成员从堆叠里摘出来摆到画布上（逐字）：
   * ```js
   * const Jt = st.length<=2 ? st.map(m=>m.node.id) : [ot];
   * x(Jt); for(const en of Jt) z.current.add(en);
   * const yn = y(e, ot, wt);
   * if(!yn){ C(Jt); for(const en of Jt) z.current.delete(en); return null }
   * R.current = yn.dissolved ? Jt.filter(en=>en!==ot) : [];
   * return yn
   * ```
   * ⚠️ 官方 `y` 就是 `gJ().removeMember`（= `wt`）；真实 value 由 `PileMemberActionsScope` 注入
   *    ⇒ 现在**不再恒 null**，成员能真正被摘出并摆到画布落点 ✓
   *    （`wt` 的第 3 参 = `Bt.screenCenter`，即官方 `_e` 的 `wt` 实参 ✓）
   */
  const detachMembersToCanvas = useCallback(
    (
      dragMembers: readonly PileGalleryEntry[],
      memberId: string,
      screenCenter: { x: number; y: number },
    ): { dissolved: boolean; remainingMemberIds: string[]; actualSize: GalleryMemberSize } | null => {
      const landingIds =
        dragMembers.length <= 2 ? dragMembers.map((entry) => entry.node.id) : [memberId];
      beginLandingNodes(landingIds);
      for (const id of landingIds) pendingLandingRef.current.add(id);
      const result = removeMember(pileId, memberId, screenCenter);
      if (!result) {
        finishLandingNodes(landingIds);
        for (const id of landingIds) pendingLandingRef.current.delete(id);
        return null;
      }
      currentLandingRef.current = result.dissolved
        ? landingIds.filter((id) => id !== memberId)
        : [];
      return result;
    },
    [beginLandingNodes, finishLandingNodes, pileId, removeMember],
  );

  /** 官方 `ke` —— `plan:{kind:"slot"}`：拖回原位 */
  const planSlotHandoff = useCallback(
    (event: PileGalleryDragEvent, drag: { members: PileGalleryEntry[]; memberId: string; screenRect: GalleryRect }) => {
      const geometry = dragGeometryOf(event, drag);
      setDragStateBoth({
        phase: 'handoff',
        members: drag.members,
        plan: {
          kind: 'slot',
          memberId: drag.memberId,
          sourceRect: geometry.sourceRect,
          target: galleryDomGeometry(drag.screenRect, portalContainer),
        },
      });
    },
    [dragGeometryOf, portalContainer, setDragStateBoth],
  );

  /** 官方 `Je` —— `plan:{kind:"pile"}`：落回堆叠（含 `v(pileId, memberId)` 的成员提层） */
  const planPileHandoff = useCallback(
    (event: PileGalleryDragEvent, drag: { members: PileGalleryEntry[]; memberId: string; screenRect: GalleryRect }) => {
      const geometry = dragGeometryOf(event, drag);
      const moved = moveMemberToTop(pileId, drag.memberId);
      const requestedIds = drag.members.map((entry) => entry.node.id);
      const finalPileMemberIds = moved?.memberIds ?? requestedIds;
      const ordered = galleryMemberOrder(drag.members, finalPileMemberIds);
      const layout = galleryLayout(layoutInput(ordered), {
        ...snapshot,
        previewExpansion: pilePreviewExpansion('interactive', snapshot.previewExpansion),
      });
      const fallback: GalleryItem = {
        centerX: snapshot.centerX,
        centerY: snapshot.centerY,
        width: drag.screenRect.width,
        height: drag.screenRect.height,
        rotate: 0,
        zIndex: 0,
      };
      onPreviewModeChange('interactive');
      setDragStateBoth({
        phase: 'handoff',
        members: drag.members,
        plan: {
          kind: 'pile',
          memberId: drag.memberId,
          finalPileMemberIds,
          sourceRect: geometry.sourceRect,
          target: layout.members.get(drag.memberId) ?? fallback,
        },
      });
    },
    [dragGeometryOf, moveMemberToTop, onPreviewModeChange, pileId, setDragStateBoth, snapshot],
  );

  /** 官方 `_t = (st) => {…isCollapsing:!0; c("compact"); _("closing"); oe(ot); p()}` */
  const activateCollapse = useCallback(
    (drag: Extract<PileGalleryDragOrHandoff, { phase: 'dragging' }>) => {
      if (drag.isCollapsing) return drag;
      const next: Extract<PileGalleryDragOrHandoff, { phase: 'dragging' }> = {
        ...drag,
        isCollapsing: true,
      };
      onPreviewModeChange('compact');
      setPhase('closing');
      setDragStateBoth(next);
      onDragCollapseActivated();
      return next;
    },
    [onDragCollapseActivated, onPreviewModeChange, setDragStateBoth],
  );

  /** 官方 `at = (st, ot) => st.isCollapsing ? st : (dQe(ot) ? _t(st) : null)` */
  const maybeCollapse = useCallback(
    (
      drag: Extract<PileGalleryDragOrHandoff, { phase: 'dragging' }>,
      delta: { x: number; y: number },
    ) => {
      if (drag.isCollapsing) return drag;
      return isGalleryDrag(delta) ? activateCollapse(drag) : null;
    },
    [activateCollapse],
  );

  /* ── 官方 `Nt` / `Qt` / `Et` / `ln` —— 四个拖拽回调（语义逐字保留） ── */

  /** 官方 `Nt(st)` —— `onDragStart`（`n`=canEdit、相位必须 open、当前无拖拽） */
  const handleDragStart = useCallback(
    (event: PileGalleryDragEvent) => {
      if (!canEdit || phase !== 'open' || dragStateRef.current) return;
      const memberId = event.active.id;
      const element = elementsRef.current.get(memberId);
      if (!element || !activeMembers.some((entry) => entry.node.id === memberId)) return;
      const box = element.getBoundingClientRect();
      const screenRect: GalleryRect = {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      };
      setDragStateBoth({
        phase: 'dragging',
        memberId,
        members: activeMembers,
        screenRect,
        grabPoint: galleryDragGrabPoint(event, screenRect),
        isCollapsing: false,
      });
    },
    [activeMembers, canEdit, phase, setDragStateBoth],
  );

  /** 官方 `Qt(st)` —— `onDragMove`：指针在 `Qe.bounds` 内 ⇒ `drop-target`，否则 `compact` */
  const handleDragMove = useCallback(
    (event: PileGalleryDragEvent) => {
      const drag = dragStateRef.current;
      if (drag?.phase !== 'dragging' || event.active.id !== drag.memberId) return;
      const next = maybeCollapse(drag, event.delta);
      if (!next) return;
      const pointer = galleryDragState(event, next.screenRect, portalContainer, null).pointer;
      onPreviewModeChange(
        galleryPointInBounds(pointer, dropTargetLayout.bounds) ? 'drop-target' : 'compact',
      );
    },
    [dropTargetLayout.bounds, maybeCollapse, onPreviewModeChange, portalContainer],
  );

  /** 官方 `Et(st)` —— `onDragEnd`：落进堆叠 ⇒ `pile`；否则尝试摘到画布（`canvas`） */
  const handleDragEnd = useCallback(
    (event: PileGalleryDragEvent) => {
      const drag = dragStateRef.current;
      if (drag?.phase !== 'dragging' || event.active.id !== drag.memberId) return;
      const next = maybeCollapse(drag, event.delta);
      if (!next) {
        planSlotHandoff(event, drag);
        return;
      }
      const geometry = dragGeometryOf(event, next);
      if (galleryPointInBounds(geometry.pointer, dropTargetLayout.bounds)) {
        planPileHandoff(event, next);
        return;
      }
      const detached = detachMembersToCanvas(next.members, next.memberId, geometry.screenCenter);
      if (!detached) {
        planPileHandoff(event, next);
        return;
      }
      onPreviewModeChange('compact');
      setDragStateBoth({
        phase: 'handoff',
        members: next.members,
        plan: {
          kind: 'canvas',
          memberId: next.memberId,
          finalPileMemberIds: detached.remainingMemberIds,
          sourceRect: geometry.sourceRect,
          target: {
            centerX: geometry.sourceRect.left + geometry.sourceRect.width / 2,
            centerY: geometry.sourceRect.top + geometry.sourceRect.height / 2,
            width: detached.actualSize.width * snapshot.zoom,
            height: detached.actualSize.height * snapshot.zoom,
            rotate: 0,
            zIndex: 30,
          },
        },
      });
    },
    [
      detachMembersToCanvas,
      dragGeometryOf,
      dropTargetLayout.bounds,
      maybeCollapse,
      onPreviewModeChange,
      planPileHandoff,
      planSlotHandoff,
      setDragStateBoth,
      snapshot.zoom,
    ],
  );

  /** 官方 `ln(st)` —— `onDragCancel`：没越过阈值 ⇒ `slot` 交接，否则落回堆叠 */
  const handleDragCancel = useCallback(
    (event: PileGalleryDragEvent) => {
      const drag = dragStateRef.current;
      if (drag?.phase !== 'dragging' || event.active.id !== drag.memberId) return;
      const next = maybeCollapse(drag, event.delta);
      if (!next) {
        planSlotHandoff(event, drag);
        return;
      }
      planPileHandoff(event, next);
    },
    [maybeCollapse, planPileHandoff, planSlotHandoff],
  );

  /* ══════════════════════════════════════════════════════════════════════
     ⚠️ MTV 偏离：dnd-kit → 指针事件（官方用 F1/kC/O1）
     ----------------------------------------------------------------------
     官方：`w = F1(kC(O1, {activationConstraint:{distance:_Qe}}))`
       · `F1 = iN = w7s = useSensors`（`index-BiTZf8mJ.js` @7479624）
       · `kC = iO = Zpt = useSensor`（@7479551）
       · `O1 = iP = bKe = PointerSensor`
       · `_Qe = 3`（= `GALLERY_DRAG_ACTIVATION_DISTANCE`）
       · 外层 `<r_>`（`r_ = iS = A9s = DndContext`，@7505124）带
         `autoScroll={false} onDragStart/onDragMove/onDragEnd/onDragCancel`
       · 浮层 `<Hse>`（`Hse = iU = XOl = DragOverlay`，@7516578）带
         `adjustScale={false} className="cursor-grabbing" dropAnimation={null} zIndex={TQe}`
       · 成员用 `eU({id, data, disabled})`（`eU = iJ = C9s = useDraggable`，@7511474）
     本仓库 `package.json` **没有** `@dnd-kit/core` ⇒ 用**指针事件**复刻同一状态机：
       `pointerdown` 起会话 → 位移 ≥ 3px（欧氏距离，与 dnd-kit `distance` 约束同义）
       → 依次派发 `handleDragStart` + `handleDragMove`；`pointerup` → `handleDragEnd`；
       `pointercancel` → `handleDragCancel`；未越过阈值 ⇒ 一次回调都不发
       （dnd-kit 同理：没起拖就没有拖拽回调）。
     喂给官方几何函数的是**合成** `GalleryDragEvent`：
       `{activatorEvent: 原始 pointerdown, delta: 指针位移, active:{id, rect:{current:{}}}}`
       —— `pQe` 在这条路径上永远走 `override` 分支（`ot.screenRect` 有面积），
       `active.rect.current` 不被读取，故合成是安全的。
     ══════════════════════════════════════════════════════════════════════ */
  const dragSessionRef = useRef<{
    memberId: string;
    pointerId: number;
    startX: number;
    startY: number;
    delta: { x: number; y: number };
    activated: boolean;
    activatorEvent: PointerEvent;
    element: HTMLElement;
  } | null>(null);
  /** `DragOverlay` 自己按 delta 平移浮层；指针路径需要自己记这个位移 */
  const [overlayDelta, setOverlayDelta] = useState<{ x: number; y: number } | null>(null);

  const makeSyntheticDragEvent = useCallback(
    (
      memberId: string,
      delta: { x: number; y: number },
      activatorEvent: PointerEvent,
    ): PileGalleryDragEvent => ({
      activatorEvent,
      delta,
      active: { id: memberId, rect: { current: { translated: null, initial: null } } },
    }),
    [],
  );

  const beginItemPointer = useCallback(
    (memberId: string, enabled: boolean, event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      if (!elementsRef.current.has(memberId)) return;
      dragSessionRef.current = {
        memberId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        delta: { x: 0, y: 0 },
        activated: false,
        activatorEvent: event.nativeEvent,
        element: event.currentTarget,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const moveItemPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const delta = { x: event.clientX - session.startX, y: event.clientY - session.startY };
      if (!session.activated) {
        if (Math.hypot(delta.x, delta.y) < GALLERY_DRAG_ACTIVATION_DISTANCE) return;
        session.activated = true;
        handleDragStart(makeSyntheticDragEvent(session.memberId, delta, session.activatorEvent));
      }
      session.delta = delta;
      setOverlayDelta(delta);
      handleDragMove(makeSyntheticDragEvent(session.memberId, delta, session.activatorEvent));
    },
    [handleDragMove, handleDragStart, makeSyntheticDragEvent],
  );

  const endItemPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      dragSessionRef.current = null;
      setOverlayDelta(null);
      if (session.element.hasPointerCapture(event.pointerId)) {
        session.element.releasePointerCapture(event.pointerId);
      }
      if (!session.activated) return;
      /* dnd-kit 起拖之后会吃掉这一次 click；指针路径靠 preventDefault 达到同一效果 */
      event.preventDefault();
      handleDragEnd(makeSyntheticDragEvent(session.memberId, session.delta, session.activatorEvent));
    },
    [handleDragEnd, makeSyntheticDragEvent],
  );

  const cancelItemPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      dragSessionRef.current = null;
      setOverlayDelta(null);
      if (session.element.hasPointerCapture(event.pointerId)) {
        session.element.releasePointerCapture(event.pointerId);
      }
      if (!session.activated) return;
      handleDragCancel(makeSyntheticDragEvent(session.memberId, session.delta, session.activatorEvent));
    },
    [handleDragCancel, makeSyntheticDragEvent],
  );

  /**
   * ★★ 窗口级兜底 —— 等价于 dnd-kit 的 document 级监听（**必须有**）。
   *
   * 官方用的是 dnd-kit：`eU = useDraggable` 收集 `listeners`，`r_ = DndContext` 在
   * **document** 上统一监听 `pointermove/pointerup/pointercancel`（`kC(O1,{activationConstraint})`）。
   * MTV 用指针事件替代，`pointerup` 只挂在**卡片元素**上、靠 `setPointerCapture` 兜住。
   * 只要 capture 失效一次（元素被替换 / 指针被别的层抢走 / 合成事件），`endItemPointer` 就永不触发：
   *   · `dragState` 永远停在 `{phase:"dragging"}`；
   *   · `collapsingOrHandoff` 恒真 ⇒ `closing` 的收尾定时器那条 effect 直接 return
   *     ⇒ **画廊永远停在 `closing` 且不卸载**；
   *   · 用户可见 = 「进全屏后按 Esc 退不出去」（实测可复现：拖一次卡片后 Esc 3s 仍在 closing）。
   * ⇒ 补上窗口级 `pointerup/pointercancel`：只收尾**当前活动会话**，卡片自身处理器先跑并清空
   *    `dragSessionRef` ⇒ 两边互斥、不会重复收尾 ✓
   */
  useEffect(() => {
    const finish = (event: PointerEvent, cancelled: boolean) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      dragSessionRef.current = null;
      setOverlayDelta(null);
      if (session.element.hasPointerCapture(event.pointerId)) {
        session.element.releasePointerCapture(event.pointerId);
      }
      if (!session.activated) return;
      const synthetic = makeSyntheticDragEvent(
        session.memberId,
        session.delta,
        session.activatorEvent,
      );
      if (cancelled) handleDragCancel(synthetic);
      else handleDragEnd(synthetic);
    };
    const onUp = (event: PointerEvent) => finish(event, false);
    const onCancel = (event: PointerEvent) => finish(event, true);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [handleDragCancel, handleDragEnd, makeSyntheticDragEvent]);

  /** 每个成员一份绑定（官方是每成员一次 `useDraggable`） */
  const dragBindingsFor = useCallback(
    (memberId: string, enabled: boolean): PileGalleryItemDragBindings => ({
      onPointerDown: (event) => beginItemPointer(memberId, enabled, event),
      onPointerMove: moveItemPointer,
      onPointerUp: endItemPointer,
      onPointerCancel: cancelItemPointer,
    }),
    [beginItemPointer, cancelItemPointer, endItemPointer, moveItemPointer],
  );

  /* ── 官方 `useLayoutEffect` 家族 ── */
  useLayoutEffect(() => {
    galleryViewportRef.current?.focus({ preventScroll: true });
  }, [galleryViewportRef]);

  /** 官方 `S==="closing" && AQe()` */
  useLayoutEffect(() => {
    if (phase === 'closing') blurActiveElement();
  }, [phase]);

  /* ── 官方 `useEffect` 家族 ── */
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setViewportSize(
        galleryViewportSize(portalContainer, { width: window.innerWidth, height: window.innerHeight }),
      );
    });
    observer.observe(portalContainer);
    return () => observer.disconnect();
  }, [portalContainer]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useLayoutEffect(() => {
    /* 官方 `s.dataset.pileGalleryPhase = S`。等价改写为 `setAttribute`：
       `react-hooks/immutability` 禁止直接给 prop 对象赋值，但允许调用它的 DOM 方法。 */
    portalContainer.setAttribute('data-pile-gallery-phase', phase);
    return () => {
      portalContainer.removeAttribute('data-pile-gallery-phase');
    };
  }, [phase, portalContainer]);

  /**
   * 官方卸载兜底（`_gallery-WQe.pretty.js` 264-279）：
   * 卸载时把「还没交还的落地节点」在**下一拍**交还（`V`/`H` 两个布尔防止重复交还）。
   */
  useEffect(() => {
    /** `react-hooks/exhaustive-deps` 要求把 ref **对象**拷进 effect 作用域再在清理里读 */
    const pendingRef = pendingLandingRef;
    /* ★★ 官方 `V.current = !0` 在**每次 effect setup** 里重设一次：
       ```js
       h.useEffect(()=>(P.current!==null&&window.clearTimeout(P.current),P.current=null),
         V.current=!0,
         ()=>{V.current=!1, P.current=window.setTimeout(…)}), [C])
       ```
       ⚠️ 这一句**不能省**：MTV 用 `<StrictMode>`（`main.tsx`）⇒ 开发期会 setup→cleanup→setup，
          cleanup 把 `mountedRef.current = false` 之后**只有 setup 里这一句能把它再置回 true**。
          少了它 ⇒ `mountedRef.current` 永远是 false ⇒ 官方 `dt`（`finishClose`）第一行
          `if(!mountedRef.current || closedRef.current) return` 直接 return ⇒
          **画廊永远停在 `closing`，`onClosed()` 永不触发、全屏层永不卸载**（实测：Esc 后 2.6s 仍是 closing）。*/
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.setTimeout(() => {
        if (mountedRef.current || closedRef.current) return;
        const pending = [...pendingRef.current];
        if (pending.length > 0) finishLandingNodes(pending);
      }, 0);
    };
  }, [finishLandingNodes]);

  /** 官方 `dt` —— 真正关闭：交还落地节点 → `H.current=!0` → `f()`（`onClosed`） */
  const finishClose = useCallback(() => {
    if (!mountedRef.current || closedRef.current) return;
    const current = currentLandingRef.current;
    if (current.length > 0) {
      finishLandingNodes(current);
      for (const id of current) pendingLandingRef.current.delete(id);
      currentLandingRef.current = [];
    }
    closedRef.current = true;
    onClosed();
  }, [finishLandingNodes, onClosed]);

  /** 官方 `tt = () => dt()` */
  const requestClose = useCallback(() => {
    finishClose();
  }, [finishClose]);

  /** 官方：`yt || S==="open"` 时不排定时器；否则 `RZe(de.length)` 后 `opening→open` 或 `tt()` */
  useEffect(() => {
    if (collapsingOrHandoff || phase === 'open') return;
    const delay = prefersReducedMotion ? 0 : closeDelayMs(renderedMembers.length);
    const timer = window.setTimeout(() => {
      if (phase === 'opening') {
        setPhase('open');
        return;
      }
      requestClose();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [requestClose, collapsingOrHandoff, phase, prefersReducedMotion, renderedMembers.length]);

  /** 官方：`S==="open" && d()`（`onOpened`）、`S==="closing" && u()`（`onClosing`） */
  useEffect(() => {
    if (phase === 'open') onOpened();
    if (phase === 'closing') onClosing();
  }, [onClosing, onOpened, phase]);

  /** 官方 `He` —— 请求关闭（`c("source")` + `_("closing")`） */
  const beginClose = useCallback(() => {
    if (phase === 'closing') return;
    onPreviewModeChange('source');
    setPhase('closing');
  }, [onPreviewModeChange, phase]);

  /** 官方 `ae` —— 点空白 / Esc 的关闭入口（拖拽中不关） */
  const dismiss = useCallback(() => {
    if (phase !== 'open' || dragStateRef.current) return;
    beginClose();
  }, [beginClose, phase]);

  /**
   * 官方 `me` @2959944（`document.fullscreenElement` 守卫在 @2959993）—— Escape 关闭（逐字）：
   * ```js
   * me = st => { st.key!=="Escape" || st.defaultPrevented || I || document.fullscreenElement ||
   *              S!=="open" || T || (st.preventDefault(), ae()) }
   * ```
   * ⚠️ MTV 偏离（**已闭合**）：这条记账原先写的是「MTV 的画廊不是靠全屏 API 撑起来的，该判定原样保留」。
   *    现在 MTV 的媒体查看器会真的进原生全屏（`PileGalleryViewer.tsx` 的全屏切换把
   *    `[data-media-viewer="media"]` 送进 `requestFullscreen()`），所以这条守卫与官方**完全同义**：
   *      · 查看器打开时（`I`）本处理器先 return ⇒ Esc 归查看器；
   *      · 查看器在原生全屏里时，查看器侧的 `document.fullscreenElement` 守卫（官方 `u8` 的 `j`）
   *        让浏览器退全屏、查看器/画廊都不动；第二次 Esc 才关查看器，第三次才关画廊。
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (viewer) return;
      if (document.fullscreenElement) return;
      if (phase !== 'open' || dragStateRef.current) return;
      event.preventDefault();
      /* ★ 堆叠全屏是**最高层**（用户明确要求：官方的堆叠全屏会盖住外侧任何弹窗，
         退出全屏后弹窗回来）⇒ 本层一旦消费 Esc，就必须**阻止继续传播**，
         否则下层的弹窗（例如素材库对话框）会同时被 Esc 关掉。 */
      event.stopPropagation();
      dismiss();
    },
    [dismiss, phase, viewer],
  );

  useEffect(() => {
    /* ★★ **capture 相位**注册，这是「最高层优先」的落点：
       · 官方 `u8`/`WQe` 的 Esc 都挂在它们各自的根元素（`onKeyDown`），层级语义由 DOM 层级天然给出；
       · MTV 的画廊是 portal 出来的浮层，之前挂在 `window` **冒泡**上 ⇒ 排在所有
         document/元素级监听**之后**，任何一层 `stopPropagation()` 都会让它收不到
         （实测：素材库对话框那条没有门控的 capture 监听吃掉了全部 Escape）。
       · 改成 `window` **capture** ⇒ 事件流的第一站，堆叠全屏开着时它先裁决；
         它**不该**接管的情形（查看器打开 / 原生全屏 / 非 open 相位 / 拖拽中）直接 return，
         不阻止传播 ⇒ 查看器（`document` capture）与浏览器全屏仍能按官方语义拿到 Esc ✓ */
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  /** 官方：`S==="closing" && de.length===0 && tt()` —— 没有成员可退场时立刻收尾 */
  useEffect(() => {
    if (phase === 'closing' && renderedMembers.length === 0) requestClose();
  }, [requestClose, phase, renderedMembers.length]);

  /**
   * 官方交接定时器 @2955952（逐字）：
   * ```js
   * if(!X) return; const st = g?0:IZe(X.kind);
   * const ot = ()=>{ X.kind==="canvas" && z.current.delete(X.memberId) && C([X.memberId]) };
   * const wt = ()=>{ ot(); if(X.kind==="slot"){ oe(null); return } if(X.kind==="canvas"){ dt(); return } dt() };
   * const Bt = g?0:kZe();
   * const Jt = X.kind==="canvas" ? setTimeout(ot, Bt) : null;
   * const yn = setTimeout(wt, st);
   * return ()=>{ Jt!==null&&clearTimeout(Jt); clearTimeout(yn) }
   * ```
   */
  useEffect(() => {
    if (!handoffPlan) return;
    const delay = prefersReducedMotion ? 0 : handoffDelayMs(handoffPlan.kind);
    const releaseLanding = () => {
      if (handoffPlan.kind !== 'canvas') return;
      if (pendingLandingRef.current.delete(handoffPlan.memberId)) {
        finishLandingNodes([handoffPlan.memberId]);
      }
    };
    const complete = () => {
      releaseLanding();
      if (handoffPlan.kind === 'slot') {
        setDragStateBoth(null);
        return;
      }
      finishClose();
    };
    const landingDelay = prefersReducedMotion ? 0 : canvasLandingMs();
    const landingTimer =
      handoffPlan.kind === 'canvas' ? window.setTimeout(releaseLanding, landingDelay) : null;
    const completionTimer = window.setTimeout(complete, delay);
    return () => {
      if (landingTimer !== null) window.clearTimeout(landingTimer);
      window.clearTimeout(completionTimer);
    };
  }, [finishClose, finishLandingNodes, handoffPlan, prefersReducedMotion, setDragStateBoth]);

  /**
   * 官方 document **capture 相位** click 监听（逐字）：
   * ① 刚刚平移过 ⇒ 吃掉这次 click；② 媒体查看器打开 ⇒ 除非点在 `[data-media-viewer]` 里，否则吃掉；
   * ③ 有拖拽/交接在跑 ⇒ 吃掉；④ 否则点到 `[data-pile-gallery-item]` 之外就关画廊。
   * ⚠️ MTV 偏离（**已闭合**）：这条记账原先写的是「`[data-media-viewer]` 不会命中任何元素（查看器未接进来）」。
   *    现在 `I`（`viewer`）非空时会渲染 `PileGalleryViewer`，命中它下面的两处标记：
   *      · `MediaViewer` 的根 —— `data-media-viewer="media"`（官方 `u8` 根的 `data-media-viewer`）；
   *      · 适配层的全屏 chrome —— `data-media-viewer="gallery-chrome"`（官方把顶栏放在 `u8` 根**内部**，
   *        而 MTV 的 chrome 与 `MediaViewer` 是 body 下两个并列的 portal ⇒ 需要自己的标记才能被放行）。
   *    ⇒ 点查看器（含它的 chrome）不关画廊，与官方一致。
   */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const target = event.target instanceof Element ? event.target : null;
      if (consumeGalleryPanClick()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (viewer) {
        if (target?.closest('[data-media-viewer]')) return;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (dragStateRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (phase === 'open' && target?.closest('[data-pile-gallery-item]')) return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dismiss, phase, viewer, consumeGalleryPanClick, galleryViewportRef]);

  /* ── 渲染 ── */

  const canDragMembers = canEdit && phase === 'open' && !handoffPlan && viewer === null;
  const overlayOffset = overlayDelta ?? { x: 0, y: 0 };

  return createPortal(
    <>
      <div
        ref={galleryViewportRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        /* 官方 `m("pile.galleryLabel")` —— i18n key `pile.galleryLabel` */
        aria-label={t('堆叠节点画廊')}
        className={joinClasses(
          'inset-0 isolate overflow-hidden',
          portalContainer === document.body ? 'fixed' : 'absolute',
          isPointerDragging && 'cursor-grabbing',
        )}
        style={{ zIndex: PILE_GALLERY_Z_INDEX }}
        data-pile-gallery-phase={phase}
        data-pile-gallery-drag-phase={dragPhaseLabel}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerUp}
        onPointerCancel={handleViewportPointerUp}
        onContextMenu={(event) => event.preventDefault()}
      >
        {/* 官方 `$n.div` 背景遮罩：`pointer-events-none absolute inset-0 bg-black` */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'closing' || collapsingOrHandoff ? 0 : 1 }}
          transition={{
            duration: backdropDurationSeconds,
            delay: chromeDelaySeconds,
            ease: motionEase(GALLERY_BACKDROP.ease),
          }}
        />

        <div className="absolute inset-0 overflow-hidden" data-pile-gallery-viewport>
          <div
            ref={galleryWorldRef}
            className="absolute left-0 top-0"
            style={galleryWorldStyleValue}
            data-pile-gallery-world
          >
            {renderedMembers.map((entry, index) => {
              const memberId = entry.node.id;
              const box = rowCanvas.items.find((item) => item.id === memberId);
              const sourceTransform = sourceLayout.get(memberId);
              const expandedTransform = collapsingOrHandoff
                ? collapseLayout.members.get(memberId)
                : sourceTransform;
              if (!box || !sourceTransform || !expandedTransform) return null;

              const transform = getGalleryTransform();
              const camera = getGalleryCamera();
              /** 官方 `qt = LG(Jt, Bt, en, st.displaySize)` —— 源摆位 → 世界变换 */
              const sourcePlacement = galleryLayoutTransform(
                sourceTransform,
                box,
                transform,
                entry.displaySize,
              );
              /** 官方 `Ct = LG(yn, Bt, en, st.displaySize)` —— 塌缩/交接目标 */
              const collapsePlacement = galleryLayoutTransform(
                expandedTransform,
                box,
                transform,
                entry.displaySize,
              );
              /** 官方 `Mt` —— 静止态：以 `box` 为目标的 cover 适配、不旋转 */
              const restPlacement: GalleryLayoutTransform = {
                x: 0,
                y: 0,
                scale: galleryFitScale(entry.displaySize, box),
                rotate: 0,
              };
              /** 官方 `zt = UQe(S, yt, qt, Ct, Mt)` */
              const targetTransform = galleryCollapseTargetTransform(
                phase,
                collapsingOrHandoff,
                sourcePlacement,
                collapsePlacement,
                restPlacement,
              );
              /** 官方 `Cn = qM(Jt.zIndex-1, Oe)` / `pn = qM(yn.zIndex-1, Ie)` */
              const sourceShade = pileStaggerStep(sourceTransform.zIndex - 1, activeVisibleCount);
              const collapseShade = pileStaggerStep(expandedTransform.zIndex - 1, collapseVisibleCount);
              /** 官方 `Xt = DQe(S, yt, Cn, pn)` / `mt = FQe(S, g, Cn)` */
              const shadeOpacity = galleryDepthShadeOpacity(
                phase,
                collapsingOrHandoff,
                sourceShade,
                collapseShade,
              );
              const shadeInitial = galleryInitialDepthShadeOpacity(
                phase,
                prefersReducedMotion,
                sourceShade,
              );

              const isViewerItem = memberId === viewer?.viewer.id;
              const isTextViewerItem = isViewerItem && viewer?.viewer.media.type === 'text';
              /** 官方 `gn = RQe(Bt, ye, je, St)` + `jn = {x:gn.x/nn.zoom, y:gn.y/nn.zoom}` */
              const surrounding = gallerySurroundingOffset(
                box,
                viewerItemOf(rowCanvas.items, viewer),
                viewerChromeVisible,
                isViewerItem,
              );
              const viewerOffset = { x: surrounding.x / camera.zoom, y: surrounding.y / camera.zoom };

              /** 官方 `gt = zQe(S,T) && I===null`（= `canTogglePreview`）与 `Zt = gt && xe.has(wt)` */
              const previewEnabled = canTogglePreview;
              const canOpenMedia = previewEnabled && viewerMembers.has(memberId);
              /** 官方 `rs = PQe(S, yt, g, ot, de.length)` / `Hn = OQe(S, ot, g)` */
              const transition = galleryMemberTransition(
                phase,
                collapsingOrHandoff,
                prefersReducedMotion,
                index,
                renderedMembers.length,
              );
              const labelDelay = galleryLabelDelaySeconds(phase, index, prefersReducedMotion);

              return (
                <PileGalleryItem
                  key={memberId}
                  member={entry}
                  target={box}
                  initialTransform={prefersReducedMotion ? false : sourcePlacement}
                  animateTransform={targetTransform}
                  initialDepthShadeOpacity={shadeInitial}
                  depthShadeOpacity={shadeOpacity}
                  showDepthShade={showDepthShadeLayer}
                  zIndex={collapsingOrHandoff ? expandedTransform.zIndex : sourceTransform.zIndex}
                  canDrag={canDragMembers}
                  isPointerDragging={isPointerDragging}
                  contentHidden={contentHiddenMemberId === memberId || (isViewerItem && !isTextViewerItem)}
                  isCollapsed={phase !== 'open' || collapsingOrHandoff}
                  showLabel={
                    phase !== 'closing' &&
                    !collapsingOrHandoff &&
                    draggingMemberId !== memberId &&
                    viewer?.viewer.id !== memberId
                  }
                  labelDelaySeconds={labelDelay}
                  actionsEnabled={actionsEnabled}
                  previewEnabled={previewEnabled}
                  prefersReducedMotion={prefersReducedMotion}
                  transition={transition}
                  viewerOffset={viewerOffset}
                  viewerHidden={viewerChromeVisible && !isTextViewerItem}
                  viewerTransition={viewerTransition}
                  canOpenMedia={canOpenMedia}
                  onOpenMedia={openMedia}
                  onDismissError={dismissMemberError}
                  onElementChange={handleElementChange}
                  dragBindings={dragBindingsFor(memberId, canDragMembers)}
                />
              );
            })}
          </div>
        </div>

        {/*
          官方 `I && l.jsx(u8, {phase:I.phase, session:I.viewer, closeTargetAnchor:I.closeTargetAnchor,
          onRequestClose:se, onOpened:be, onClosed:Ye})` @2966137 —— 官方**媒体查看器浮层**。
          **已接进来**（原「未接进来」的缺口在此闭合，6 个入参逐字对应官方）：
            · `phase` / `session` / `closeTargetAnchor` / `onRequestClose`(`se`) / `onOpened`(`be`) /
              `onClosed`(`Ye`) 全部按官方传下去；
            · 会话来源 = `viewerMembers`（官方 `xe = MQe`），造会话的 `buildMember` = 本文件
              `pileGalleryViewerSession`（官方 `b8` 的 MTV 适配版）；
            · `se`/`be`/`Ye` = 本文件的 `requestViewerClose` / `markViewerOpened` / `clearViewer`
              （相位机 `opening→open→closing→null` 与 `je`/`Se`/`Zt` 派生值、相邻项外推全部照官方跑）；
            · `data-media-viewer` 由 `MediaViewer` 根（`="media"`）与适配层 chrome（`="gallery-chrome"`）承载；
            · 适配层 `PileGalleryViewer.tsx` 里另补了官方 `u8` 的 Esc 全屏守卫与**全屏切换**
              （官方 `u8` 没有全屏按钮，写法取自官方视频播放器 `W1e` @1406277/@1406638）。
          ⚠️ MTV 偏离（仍在，逐条映射表在 `PileGalleryViewer.tsx` 文件头）：
            · 官方文本分支（`u8` 的 `u` → `sxe`）未接 —— MTV `TextFullscreenViewer` 没有官方 `onClosed`
              握手 ⇒ `pileGalleryViewerSession` 对文本成员返回 `null`（该成员 `canOpenMedia` 保持 false）；
            · 官方 `session.actions`（底条 `Qge` 的复制提示词 / 设为主图 / 下载）未接 —— 画廊没有这套宿主回调；
            · `closeTargetAnchor`（官方给 `Abe`/`sxe` 的「反向形变回成员」）没有消费点。
        */}
        {viewer && (
          <PileGalleryViewer
            phase={viewer.phase}
            session={viewer.viewer}
            closeTargetAnchor={viewer.closeTargetAnchor}
            onRequestClose={requestViewerClose}
            onOpened={markViewerOpened}
            onClosed={clearViewer}
          />
        )}

        {/* 官方 `Re && qe && X && l.jsx(sQe, {displayProps:Re, displaySize:qe, plan:X})` */}
        {dragDisplay && dragDisplaySize && handoffPlan && (
          <PileGalleryDragLayer
            display={dragDisplay}
            displaySize={dragDisplaySize}
            plan={handoffPlan}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </div>

      {/*
        官方 `<Hse adjustScale={false} className="cursor-grabbing" dropAnimation={null} zIndex={TQe}>`
        （= dnd-kit `DragOverlay`）。
        ⚠️ MTV 偏离：dnd-kit → 指针事件（官方用 F1/kC/O1）。`DragOverlay` 负责「把浮层放到拖拽起点 +
        按 delta 平移 + portal 到 body」这层壳；这里用 `position:fixed` +
        `screenRect + delta` + `GALLERY_DRAG_OVERLAY_Z_INDEX`（`TQe = xJ + 10`）复刻同一效果。
      */}
      {dragging && dragDisplay && dragDisplaySize && dragCarry ? (
        <div
          className="cursor-grabbing"
          style={{
            position: 'fixed',
            left: dragging.screenRect.left + overlayOffset.x,
            top: dragging.screenRect.top + overlayOffset.y,
            zIndex: GALLERY_DRAG_OVERLAY_Z_INDEX,
          }}
        >
          <div
            className="pointer-events-none relative"
            style={{ width: dragging.screenRect.width, height: dragging.screenRect.height }}
            data-pile-gallery-drag-overlay={dragging.memberId}
          >
            <motion.div
              ref={overlayItemRef}
              className="absolute"
              style={{
                width: dragDisplaySize.width,
                height: dragDisplaySize.height,
                left: dragCarry.left,
                top: dragCarry.top,
                transformOrigin: `${dragCarry.originX}px ${dragCarry.originY}px`,
                willChange: prefersReducedMotion ? undefined : 'transform, opacity',
              }}
              initial={{
                scale: prefersReducedMotion ? dragCarry.carryScale : dragCarry.sourceScale,
                opacity: prefersReducedMotion || contentHandoffSeconds === 0 ? 1 : 0.72,
              }}
              animate={{ scale: dragCarry.carryScale, opacity: 1 }}
              transition={{
                scale: {
                  duration: prefersReducedMotion ? 0 : GALLERY_DRAG.pickupDurationSeconds,
                  ease: motionEase(GALLERY_DRAG.pickupEase),
                },
                opacity: {
                  duration: prefersReducedMotion ? 0 : contentHandoffSeconds,
                  ease: motionEase(GALLERY_OPEN_CLOSE.ease),
                },
              }}
            >
              <PileMemberPreview content={dragDisplay.content} status={dragDisplay.status} />
            </motion.div>
          </div>
        </div>
      ) : null}
    </>,
    portalContainer,
  );
}
