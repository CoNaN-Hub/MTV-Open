/**
 * officialPileDrop —— 官方 **拖拽入堆的命中判定**（`page-DPdEgTS0.js`@char1419600 起，逐字）。
 *
 * 官方几何助手（@1422826…@1423022，**逐字**）：
 * ```js
 * function L1(e){ return { x: e.x + e.width/2, y: e.y + e.height/2 } }          // 矩形中心
 * function dme(e,t){ return t.x>=e.x && t.x<=e.x+e.width && t.y>=e.y && t.y<=e.y+e.height }  // 纯包含
 * function ume(e,t){ const n=e.x-t.x, s=e.y-t.y; return n*n + s*s }              // 平方距离
 * function fme(e,t){ …nearest pile whose bounds contain the source centre… }     // 最近的「包含」堆叠
 * ```
 * 命中方式：`P1`@1419600 遍历 `document.querySelectorAll("[data-pile-node]")` 的**屏幕矩形**。
 * ★★ **没有重叠比例、也没有距离阈值** —— 只有「源中心是否落在矩形内」+「取中心平方距离最近的那个」。
 */

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** 官方 `L1` */
export function pileRectCentre(rect: ScreenRect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** 官方 `dme` —— 纯包含（含边界） */
export function pileRectContains(rect: ScreenRect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** 官方 `ume` —— 平方欧氏距离（不做开方，只用于比较） */
export function pileCentreDistanceSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export interface PileDropCandidate {
  id: string;
  rect: ScreenRect;
}

/**
 * 官方 `fme` —— 在**包含源中心**的候选里取**中心平方距离最小**的那个。
 * 没有任何候选包含源中心 ⇒ 返回 `null`（= 不落任何堆叠）。
 */
export function findPileDropTarget(
  candidates: readonly PileDropCandidate[],
  sourceCentre: Point,
): string | null {
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (!pileRectContains(candidate.rect, sourceCentre)) continue;
    const distance = pileCentreDistanceSq(pileRectCentre(candidate.rect), sourceCentre);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = candidate.id;
    }
  }
  return bestId;
}

/**
 * 官方 `P1` 的取候选那一步：**屏幕空间**读所有 `[data-pile-node]` 的矩形。
 * 用 `getBoundingClientRect()`（已含画布缩放与工具条的 counter-scale）。
 */
export function readPileDropCandidates(root: ParentNode = document): PileDropCandidate[] {
  const out: PileDropCandidate[] = [];
  root.querySelectorAll<HTMLElement>('[data-pile-node]').forEach((element) => {
    const id = element.getAttribute('data-pile-node');
    if (!id) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    out.push({ id, rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height } });
  });
  return out;
}

/** 官方 `$G = "pile-landing-node"`（正在落地的节点类名，CSS 里整块隐形） */
export const PILE_LANDING_NODE_CLASS = 'pile-landing-node';
