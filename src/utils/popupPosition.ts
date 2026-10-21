/**
 * popupPosition — 弹出框/选择框/下拉菜单位置自动调整工具
 *
 * 当弹出元素超出屏幕边界时，自动翻转方向或偏移位置，确保始终可见。
 */

const DEFAULT_PADDING = 8;

export interface ViewportEdge {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PopupAnchorRect {
  left: number;
  top: number;
  bottom: number;
}

/**
 * 获取当前可用视口区域
 * 通常使用 window.innerWidth / innerHeight，但可传入自定义值用于测试
 */
export function getViewport(): ViewportEdge {
  return {
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    left: 0,
  };
}

/**
 * 计算 fixed 定位的弹出元素位置，确保不超出屏幕边界
 *
 * @param desiredX - 期望的 left 坐标
 * @param desiredY - 期望的 top 坐标
 * @param popupWidth - 弹出元素估算宽度
 * @param popupHeight - 弹出元素估算高度
 * @param padding - 距屏幕边缘的最小间距，默认 8px
 * @returns 调整后的 { left, top } 坐标
 */
export function calcFixedPosition(
  desiredX: number,
  desiredY: number,
  popupWidth: number,
  popupHeight: number,
  padding: number = DEFAULT_PADDING,
): { left: number; top: number } {
  const vp = getViewport();

  let left = desiredX;
  let top = desiredY;

  // 右边界溢出 → 向左偏移
  if (left + popupWidth > vp.right - padding) {
    left = vp.right - popupWidth - padding;
  }
  // 左边界溢出 → 靠左对齐
  if (left < vp.left + padding) {
    left = vp.left + padding;
  }

  // 底部溢出 → 向上偏移
  if (top + popupHeight > vp.bottom - padding) {
    top = vp.bottom - popupHeight - padding;
  }
  // 顶部溢出 → 向下偏移
  if (top < vp.top + padding) {
    top = vp.top + padding;
  }

  return { left, top };
}

/**
 * ★ 官方 `x$`（`page-DPdEgTS0.js` @18050 **逐字**）—— 选区 `+` 菜单锚点钳制。
 *
 * ```js
 * function x$(e, t, n = {}) {
 *   const { padding: s = 12, marginTop: i = 0, centerX: o = false,
 *           container: a = { width: innerWidth, height: innerHeight } } = n;
 *   const c = Math.max(0, s), d = i ?? 0;              // c = padding, d = marginTop
 *   const u = Math.max(0, t.width), f = Math.max(0, t.height);   // 弹层估算尺寸
 *   const p = Math.max(0, a.width), h = Math.max(0, a.height);   // 容器尺寸
 *   let { x: m, y: g } = e;
 *   const y = p - 2 * c, x = h - 2 * c;
 *   // X：弹层比容器还宽 → 居中/贴边；否则「m 是弹层中心」地夹住左右边
 *   u >= y ? (m = o ? p / 2 : c)
 *          : o ? (m - u / 2 < c ? m = u / 2 + c : m + u / 2 > p - c && (m = p - u / 2 - c))
 *              : (m < c ? m = c : m + u > p - c && (m = p - u - c));
 *   // Y：**预留下方 `marginTop + 高度`**（菜单本体还有 mt-4）
 *   f >= x ? g = c : (g + d + f > h - c && (g = h - f - d - c), g < c && (g = c));
 *   return { x: Number.isFinite(m) ? m : 0, y: Number.isFinite(g) ? g : 0 };
 * }
 * ```
 * 官方调用（`page-DPdEgTS0.js` @1437683 逐字）：
 *   `x$(P, {width:258, height:297}, {padding:12, marginTop:16, centerX:true,
 *        container:{width: L.width, height: L.height}})`
 *   —— 其中 `P` 是**相对于 `.react-flow` 容器**的鼠标点 ✓（`N()` = `.react-flow` 的 rect）。
 * ⇒ 返回值就是「白色 `+` 圆心」的位置，**同时也是菜单的居中锚点**
 *   （菜单 `absolute -translate-x-1/2`，锚点即中心 X；菜单顶部 = 锚点 Y + `mt-4`(16)）。
 */
export interface FloatingAnchorSize {
  width: number;
  height: number;
}

export interface FloatingAnchorOptions {
  /** 距容器边缘的最小留白（官方默认 12） */
  padding?: number;
  /** 锚点下方为菜单预留的间距（官方传 16，菜单本体还有 `mt-4`） */
  marginTop?: number;
  /** 锚点 X 是否代表弹层「中心」（官方选区 `+` 传 true） */
  centerX?: boolean;
  /** 容器尺寸（官方传 `.react-flow` 的 rect 尺寸） */
  container: FloatingAnchorSize;
}

export function clampFloatingAnchor(
  point: { x: number; y: number },
  size: FloatingAnchorSize,
  options: FloatingAnchorOptions,
): { x: number; y: number } {
  const { padding = 12, marginTop = 0, centerX = false, container } = options;
  const c = Math.max(0, padding);
  const d = marginTop ?? 0;
  const u = Math.max(0, size.width);
  const f = Math.max(0, size.height);
  const p = Math.max(0, container.width);
  const h = Math.max(0, container.height);
  let { x: m, y: g } = point;
  const availW = p - 2 * c;
  const availH = h - 2 * c;

  if (u >= availW) {
    m = centerX ? p / 2 : c;
  } else if (centerX) {
    if (m - u / 2 < c) m = u / 2 + c;
    else if (m + u / 2 > p - c) m = p - u / 2 - c;
  } else if (m < c) {
    m = c;
  } else if (m + u > p - c) {
    m = p - u - c;
  }

  if (f >= availH) {
    g = c;
  } else {
    if (g + d + f > h - c) g = h - f - d - c;
    if (g < c) g = c;
  }

  return { x: Number.isFinite(m) ? m : 0, y: Number.isFinite(g) ? g : 0 };
}

/**
 * 让弹层贴近光标或触发元素：优先显示在上方，空间不足时翻到下方，
 * 最后再执行视口边缘校正。
 */
export function calcAnchoredPosition(
  anchor: PopupAnchorRect,
  popupWidth: number,
  popupHeight: number,
  gap: number = 8,
  padding: number = DEFAULT_PADDING,
  /* ★ 官方 tippy 口径：`placement:"bottom-start"`（**优先下方**，放不下才翻上）——
     `@` 候选弹窗传 `prefer:'below'`；其它调用方不传 ⇒ 保持原有「优先上方」✓ */
  prefer: 'above' | 'below' = 'above',
): { left: number; top: number; placement: 'above' | 'below' } {
  const vp = getViewport();
  const aboveTop = anchor.top - popupHeight - gap;
  const belowTop = anchor.bottom + gap;
  const fitsAbove = aboveTop >= vp.top + padding;
  const fitsBelow = belowTop + popupHeight <= vp.bottom - padding;
  const spaceAbove = anchor.top - vp.top;
  const spaceBelow = vp.bottom - anchor.bottom;
  const placement = prefer === 'below'
    ? (fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove) ? 'below' : 'above')
    : (fitsAbove || (!fitsBelow && spaceAbove >= spaceBelow) ? 'above' : 'below');
  const safePosition = calcFixedPosition(
    anchor.left,
    placement === 'above' ? aboveTop : belowTop,
    popupWidth,
    popupHeight,
    padding,
  );

  return { ...safePosition, placement };
}

/**
 * 计算子菜单的弹出方向和位置
 *
 * @param parentMenuRect - 父级菜单当前的 DOMRect（相对视口）
 * @param submenuWidth - 子菜单估算宽度
 * @param submenuHeight - 子菜单估算高度
 * @param preferredDirection - 优先方向 'right' | 'left'
 * @param padding - 距屏幕边缘的最小间距，默认 8px
 * @returns { left, top, direction } — direction 指示实际方向
 */
export function calcSubmenuPosition(
  parentMenuRect: DOMRect,
  submenuWidth: number,
  submenuHeight: number,
  preferredDirection: 'right' | 'left' = 'right',
  padding: number = DEFAULT_PADDING,
): { left: number; top: number; direction: 'left' | 'right' } {
  const vp = getViewport();
  const spacing = 4;

  // 先尝试优先方向
  let direction = preferredDirection;
  let left: number;
  let top = parentMenuRect.top + spacing;

  if (preferredDirection === 'right') {
    left = parentMenuRect.right + spacing;
    // 右侧空间不足 → 翻转到左侧
    if (left + submenuWidth > vp.right - padding) {
      direction = 'left';
      left = parentMenuRect.left - submenuWidth - spacing;
      // 左侧也不够 → 靠左贴边
      if (left < vp.left + padding) {
        left = vp.left + padding;
      }
    }
  } else {
    left = parentMenuRect.left - submenuWidth - spacing;
    // 左侧空间不足 → 翻转到右侧
    if (left < vp.left + padding) {
      direction = 'right';
      left = parentMenuRect.right + spacing;
      // 右侧也不够 → 靠右贴边
      if (left + submenuWidth > vp.right - padding) {
        left = vp.right - submenuWidth - padding;
      }
    }
  }

  // 底部边界检查
  if (top + submenuHeight > vp.bottom - padding) {
    top = Math.max(vp.top + padding, parentMenuRect.bottom - submenuHeight);
  }

  // 顶部边界检查
  if (top < vp.top + padding) {
    top = vp.top + padding;
  }

  return { left, top, direction };
}
