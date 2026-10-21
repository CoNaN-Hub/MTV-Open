/**
 * nodeBounds — 节点包围盒计算工具，供对齐/吸附等功能复用
 */
import type { Node as RFNode } from '@xyflow/react';
import type { BaseNodeData } from '../types';

/**
 * ★★ **官方卡片尺寸规则（EXE 源码原文 + 线上实测双证）** ✓
 *
 * EXE 源码（`index-BiTZf8mJ.js`）：
 *   ```js
 *   Od  = { width: 250, height: 250 }          // 通用节点基准
 *   bvs = { width: 500,  height: 750 }         // DOC_EDITOR
 *   _vs = { width: 1000, height: 750 }         // AI_TABLE_EDITOR
 *   pR = (ratio) => {
 *     let h = Od.height, w = Od.width;
 *     if (ratio > 1) { h = Od.height; w = h * ratio; }   // 横图：**高固定 250**
 *     if (ratio < 1) { w = Od.width;  h = w / ratio; }   // 竖图：**宽固定 250**
 *     return { width: Math.round(w), height: Math.round(h) };
 *   }
 *   ```
 * 线上实测：官方面板显示「4:3·1K」时节点流坐标 = **333×250** ✓ = `pR(4/3)` ✓✓ 完全吻合
 *
 * 由此得出的全部尺寸：
 *   1:1 → 250×250 · 4:3 → **333×250** · 3:2 → 375×250 · 16:9 → **444×250**
 *   3:4 → 250×333 · 2:3 → 250×375 · 9:16 → **250×444**
 *
 * ⚠️ 此前 MTV 把图片卡片写死 **333×250** ✗ —— 那只是 **4:3 的特例**
 *    → 换比例/换模型时卡片**不变** ✗（用户："官方的卡片尺寸有很多种，随模型支持的比例变化" ✓）
 */
export const NODE_BASE_SIZE = { width: 250, height: 250 } as const;

/** 官方 `pR`：比例 → 卡片宽高（横图高固定 250 · 竖图宽固定 250 ✓）*/
export function nodeSizeForAspectRatio(ratio: number): { width: number; height: number } {
  let h = NODE_BASE_SIZE.height;
  let w = NODE_BASE_SIZE.width;
  if (ratio > 1) {
    h = NODE_BASE_SIZE.height;
    w = h * ratio;
  } else if (ratio < 1) {
    w = NODE_BASE_SIZE.width;
    h = w / ratio;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

/** '4:3' / '16:9' → 比例数值（拿不到就按 1 处理 ✓ 与官方 `Mvs` 一致 ✓）*/
export function aspectRatioValue(aspectRatio: string | undefined | null): number {
  if (!aspectRatio) return 1;
  const [w, h] = aspectRatio.split(':').map(Number);
  return w && h ? w / h : 1;
}

/** 官方模型能力表里出现过的全部比例（EXE `aspectRatios` 的并集 ✓）
 *  1:1 · 4:3 · 3:4 · 16:9 · 9:16 · 3:2 · 2:3 · 5:4 · 4:5 · 21:9 · 9:21 ✓ */
export const SUPPORTED_ASPECT_RATIOS = [
  '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '5:4', '4:5', '21:9', '9:21',
] as const;

/** 图片的像素宽高 → **最接近的官方比例字符串** ✓
 *  用途：上传图片后把卡片比例改成图片的真实比例 ✓
 *       （否则卡片永远停在旧比例 ✗ —— 用户报的"传 9:16 却永远 16:9" ✓）
 *  比较用**对数距离** ✓（比例的视觉差异是对数的：1.78↔1.6 与 0.56↔0.63 应等同看待 ✓）*/
export function nearestAspectRatioString(width: number, height: number): string {
  if (!width || !height) return '1:1';
  const target = Math.log(width / height);
  let best: string = SUPPORTED_ASPECT_RATIOS[0];
  let bestDist = Infinity;
  for (const r of SUPPORTED_ASPECT_RATIOS) {
    const [w, h] = r.split(':').map(Number);
    if (!w || !h) continue;
    const dist = Math.abs(Math.log(w / h) - target);
    if (dist < bestDist) { bestDist = dist; best = r; }
  }
  return best;
}

/** 一步到位：'4:3' → { width: 333, height: 250 } ✓（官方 `pR(Mvs(ratio))` 的等价写法 ✓）*/
export function nodeSizeForAspect(aspectRatio: string | undefined | null): { width: number; height: number } {
  return nodeSizeForAspectRatio(aspectRatioValue(aspectRatio));
}

/**
 * 上传/导入**图片**时的节点盒子（官方 `Ua(图片真实比例)` ✓ 与 `pR` 同规则 ✓）。
 *
 * ⚠️ 只回 `nodeWidth/nodeHeight`，**绝不写 `aspectRatio`** ✗✓ —— 那是**生成参数**：
 *    `QualityRatioSelector` 会把非模型合法值的 `aspectRatio` 夹回 `effectiveRatios[0]` ✗
 *    （源码 `ratioValid` → `onChangeAspectRatio(effectiveRatios[0].value)` ✓）
 *    ⇒ 原图真实比例（如 5907:6497）写进去必被夹掉 → 卡片弹回旧尺寸 ✗（用户报的 bug ✓）
 *    卡片盒子对**源图**改用 `imageWidth/imageHeight`（见 ImageNode 的 `intrinsicRatio` ✓）。
 *
 * 用法：`Object.assign(nodeData, dims, nodeBoxForImageSize(dims.imageWidth, dims.imageHeight))`
 */
export function nodeBoxForImageSize(
  width?: number,
  height?: number,
): { nodeWidth?: number; nodeHeight?: number } {
  if (!width || !height) return {};
  const sized = nodeSizeForAspectRatio(width / height);
  return { nodeWidth: sized.width, nodeHeight: sized.height };
}

/**
 * 上传/导入图片时的**比例字段**：取「官方模型合法比例表里最接近的那个」✓
 * （官方 UI 的比例只能是表内值 ✓ → 卡片 = `pR(它)` ✓ 与官方一致 ✓）
 *
 * ⚠️ 两个都别写 ✗✓：
 *   · 原图真实比例（如 `5907:6497`）→ 不在合法表里 → 被 `QualityRatioSelector` 夹回 `effectiveRatios[0]` ✗
 *   · `undefined` → 卡片按 `Mvs(undefined)` = 1 → 250×250（图片 contain 会留白 ✗ 用户不满意 ✗）
 */
export function nearestAspectRatioForImage(
  width?: number,
  height?: number,
): { aspectRatio?: string } {
  if (!width || !height) return {};
  return { aspectRatio: nearestAspectRatioString(width, height) };
}

function getDefaultNodeSize(nodeType: string | undefined): { width: number; height: number } {
  switch (nodeType) {
    /* ★ 官方基准尺寸 `Od = {250,250}`（`index-BiTZf8mJ.js` @6935951）：
           · 读节点尺寸的 `JB`/`ez` 在「节点没写宽高」时**一律回落到 `Od`**（与节点类型无关）；
           · 官方两个文本创建器（`wT` 纯文本 / `Dx` 生成文本，@2787783 起）直接写
             `width: Ha.width, height: Ha.height`，而 `Ha` = `Od` ⇒ **文本卡默认 250×250** ✓
       ⇒ `ai-text` / `ai-image` 的兜底都改回 `Od`
         （原来 `ai-text` 写 280×160、`ai-image` 写 `nodeSizeForAspect('4:3')` = 333×250 ✗ —— 那是我早先写错的）。 */
    case 'ai-text':   return { ...NODE_BASE_SIZE };
    case 'ai-image':  return { ...NODE_BASE_SIZE };
    /* §108：视频卡默认尺寸 = 官方 `ar(16/9)` = **444×250**
       （`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @735528 区写死 `ar(16/9)`；`ar` @497533；
        官方真机 CDP 9222 实测 inline `width:444px;height:250px`）。
       MTV 原来写死 280×160 ✗ —— 与官方新建卡差 164×90。 */
    case 'ai-video':  return nodeSizeForAspect('16:9');
    case 'ai-audio':  return { width: 260, height: 140 };
    default:          return { width: 280, height: 160 };
  }
}

/**
 * 生成前按画面比例预估节点框高度 —— ⚠️ 官方**没有这套「固定宽度撑高度」**的做法：
 * 官方只有 `pR(ratio)`（**短边恒 250**，见 `nodeSizeForAspect`）。保留本函数仅供 MTV 自有流程
 * （`store.dramaAssets` 预排版）使用，新代码请直接用 `nodeSizeForAspect`。
 */

/**
 * 生成前按画面比例预估节点框高度：图片还没出来，只能用比例把固定宽度的卡片撑开。
 * 4px 是卡片边框，min 保证竖排比例下不会矮到看不见标题。
 */
export function nodeHeightForAspectRatio(
  aspectRatio: string,
  nodeWidth = 333,
  min = 160,
): number {
  const [w, h] = aspectRatio.split(':').map(Number);
  const ratio = w && h ? w / h : 1;
  return Math.max(min, Math.round((nodeWidth - 4) / ratio) + 4);
}

/** Follow parentId chain to compute absolute offset from relative position */
export function getParentOffset(
  node: RFNode<BaseNodeData>,
  allNodes: RFNode<BaseNodeData>[],
): { x: number; y: number } {
  let offsetX = 0;
  let offsetY = 0;
  let pid: string | undefined = node.parentId;
  while (pid) {
    const p = allNodes.find((n) => n.id === pid);
    if (!p) break;
    offsetX += p.position.x;
    offsetY += p.position.y;
    pid = p.parentId;
  }
  return { x: offsetX, y: offsetY };
}

/** Get absolute bounds for a node (accounting for parent group offsets) */
export function getNodeBounds(
  node: RFNode<BaseNodeData>,
  allNodes: RFNode<BaseNodeData>[],
): {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  centerX: number;
  right: number;
  top: number;
  centerY: number;
  bottom: number;
} {
  const defaultSize = getDefaultNodeSize(node.type);
  const cardWidth = (node.data?.nodeWidth as number | undefined) ?? defaultSize.width;
  const cardHeight = (node.data?.nodeHeight as number | undefined) ?? defaultSize.height;
  const parentOffset = node.parentId ? getParentOffset(node, allNodes) : { x: 0, y: 0 };
  const x = node.position.x + parentOffset.x;
  const y = node.position.y + parentOffset.y;
  return {
    x,
    y,
    width: cardWidth,
    height: cardHeight,
    left: x,
    centerX: x + cardWidth / 2,
    right: x + cardWidth,
    top: y,
    centerY: y + cardHeight / 2,
    bottom: y + cardHeight,
  };
}
