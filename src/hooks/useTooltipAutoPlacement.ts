/**
 * 将 data-tooltip 渲染到 body 下，避免被面板的 overflow 或 clip-path 截断。
 * 保留现有声明式 API，并统一处理四个方向的窗口边界碰撞。
 */
import { useEffect } from 'react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/* ⚠️ 间距 / 延迟**照官方源码**（`index-BiTZf8mJ.js` 的 TooltipContent forwardRef · 原文 ✓）：
     官方原语：`w.forwardRef(({className:t, **sideOffset:e=4**, ...n}, a) => …)` ✓
       → **默认 sideOffset = 4** ✓（MTV 上一版写 6 ✗ —— 6 在官方**没有任何出处** ✗✓ 已改正 ✓）
     官方线上实测（CDP 9222 真实鼠标 ✓）逐站点复核：
       侧栏「节点搜索」= **4** ✓ · 底部工具条「隐藏节点连线」= **4** ✓
       底部面板 model 按钮 = **8**（该站点**显式** `sideOffset:8` ✓）→ 用 `data-tooltip-offset="8"` 表达 ✓
       滑条 = **22**（源码里显式 `sideOffset:22` ✓）→ `data-tooltip-offset="22"` ✓
   官方 `delayDuration` 全包统计（`t3-delay.mjs`）：**300（28 处）最多** · 200（16）· 0（5）· 400（2）…
     → MTV 默认 **300** ✓（= 官方最常见口径 ✓）；单个控件可用 `data-tooltip-delay="200"` 覆盖 ✓ */
const TOOLTIP_GAP = 4;
const TOOLTIP_GAP_VERTICAL = 4;
const VIEWPORT_MARGIN = 8;
const SHOW_DELAY = 300;

/** 元素可通过 `data-tooltip-offset` 覆盖气泡间距（官方滑条是 sideOffset=22 ✓ / model 按钮 8 ✓）
 *  ⚠️ 与 `data-tooltip-delay` 一样用 `closest()`：**容器**（如节点工具栏）可以给整条统一一个间距 ✓
 *     —— 官方节点工具栏按钮的 tooltip 是 `sideOffset:8`，MTV 默认 4 ⇒ 纵向间距偏小（用户反馈）。 */
function getTooltipGap(element: HTMLElement, axis: 'h' | 'v'): number {
  const holder = element.closest<HTMLElement>('[data-tooltip-offset]');
  const raw = holder?.dataset.tooltipOffset;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed)) return parsed;
  return axis === 'v' ? TOOLTIP_GAP_VERTICAL : TOOLTIP_GAP;
}

/** 元素可通过 `data-tooltip-delay` 覆盖出现延迟（官方逐站点给 `delayDuration` ✓ 例：model 按钮 200 ✓）
    ⚠️ 用 `closest()` 取：**容器**也能给整段统一一个延迟 ✓
       （官方**画布竖条**那一整条 = Tooltip Provider `delayDuration:0` ✓ 见下方 showTooltip 的注释 ✓）
       单个控件自己带 `data-tooltip-delay` 时仍然优先（`closest` 先命中它自己 ✓） */
function getShowDelay(element: HTMLElement): number {
  const holder = element.closest<HTMLElement>('[data-tooltip-delay]');
  const raw = holder?.dataset.tooltipDelay;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : SHOW_DELAY;
}

function findTooltipTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>('[data-tooltip]');
  if (!el) return null;
  // 禁用态不该出提示（用户反馈：空卡时发送按钮是禁用的，不该有悬浮提示）。
  // 事件是委托在 document 上的，禁用的 button 依然会冒泡到这里，所以必须显式排除。
  if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return null;
  if (el.closest('[aria-disabled="true"], :disabled')) return null;
  return el;
}

function getPreferredPosition(element: HTMLElement): TooltipPosition {
  const position = element.dataset.tooltipPos;
  return position === 'bottom' || position === 'left' || position === 'right'
    ? position
    : 'top';
}

function getOppositePosition(position: TooltipPosition): TooltipPosition {
  switch (position) {
    case 'top': return 'bottom';
    case 'bottom': return 'top';
    case 'left': return 'right';
    case 'right': return 'left';
  }
}

function getAvailableSpace(position: TooltipPosition, targetRect: DOMRect): number {
  switch (position) {
    case 'top': return targetRect.top - VIEWPORT_MARGIN - TOOLTIP_GAP;
    case 'bottom': return window.innerHeight - targetRect.bottom - VIEWPORT_MARGIN - TOOLTIP_GAP;
    case 'left': return targetRect.left - VIEWPORT_MARGIN - TOOLTIP_GAP;
    case 'right': return window.innerWidth - targetRect.right - VIEWPORT_MARGIN - TOOLTIP_GAP;
  }
}

function resolvePosition(
  preferred: TooltipPosition,
  targetRect: DOMRect,
  tooltipBox: { width: number; height: number },
): TooltipPosition {
  const opposite = getOppositePosition(preferred);
  const requiredSpace = preferred === 'top' || preferred === 'bottom'
    ? tooltipBox.height
    : tooltipBox.width;
  const preferredSpace = getAvailableSpace(preferred, targetRect);
  const oppositeSpace = getAvailableSpace(opposite, targetRect);

  return preferredSpace >= requiredSpace || preferredSpace >= oppositeSpace
    ? preferred
    : opposite;
}

// 视口比 tooltip 还窄时 max < min，此时要收敛到 min（贴左/上边）而不是 max，
// 与 utils/num 的 clamp 行为不同，故保留本地实现。
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function positionTooltip(tooltip: HTMLDivElement, target: HTMLElement) {
  const targetRect = target.getBoundingClientRect();
  /* ★★★★★ **必须用布局盒（offsetWidth/Height）量气泡自己** ✗✓
       官方入场动画 = `zoom-in-95`（`scale(.95) → 1`，见 tooltip.css ✓）
       → 用 `getBoundingClientRect()` 会量到**缩放 95% 的盒** ✗ → 居中/贴边全都偏几 px ✗
         而 `positionTooltip` 只在显示那一瞬跑一次 → **不会再自愈** ✗✓（与比例指示块同一类坑 ✓）
       → `offsetWidth/Height` 是**布局**尺寸，不受 transform 影响 ✓（CSS 这版就是这样写的 ✓）*/
  const tooltipBox = { width: tooltip.offsetWidth, height: tooltip.offsetHeight };
  const position = resolvePosition(
    getPreferredPosition(target),
    targetRect,
    tooltipBox,
  );

  let left: number;
  let top: number;

  if (position === 'top' || position === 'bottom') {
    const gapV = getTooltipGap(target, 'v');
    left = targetRect.left + (targetRect.width - tooltipBox.width) / 2;
    top = position === 'top'
      ? targetRect.top - tooltipBox.height - gapV
      : targetRect.bottom + gapV;
  } else {
    const gapH = getTooltipGap(target, 'h');
    left = position === 'left'
      ? targetRect.left - tooltipBox.width - gapH
      : targetRect.right + gapH;
    top = targetRect.top + (targetRect.height - tooltipBox.height) / 2;
  }

  tooltip.style.left = `${Math.round(clamp(
    left,
    VIEWPORT_MARGIN,
    window.innerWidth - tooltipBox.width - VIEWPORT_MARGIN,
  ))}px`;
  tooltip.style.top = `${Math.round(clamp(
    top,
    VIEWPORT_MARGIN,
    window.innerHeight - tooltipBox.height - VIEWPORT_MARGIN,
  ))}px`;
  tooltip.dataset.position = position;
}

/* ⚠️ 气泡里可以插**内联小图标** —— 官方滑条气泡的滚轮就是**图标不是文字** ✓：
     官方源码：<span className="text-xs opacity-70">(Ctrl/⌘ + <Wre size={14} className="inline"/>)</span>
     Wre = index 里的 ur = SDn = createLucideIcon("outline","mouse","Mouse") → **lucide mouse** ✓
   本模块是纯 DOM（用不了 React 图标组件），所以把官方那条鼠标路径**内联**进来 ✓
   用法：data-tooltip="放大/缩小画布 (Ctrl/⌘ + [[mouse]])"  →  {{mouse}} 处渲染成 14px 图标 ✓ */
const TOOLTIP_ICONS: Record<string, string[]> = {
  mouse: [
    'M6 3m0 4a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-4a4 4 0 0 1 -4 -4z',
    'M12 7l0 4',
  ],
};
/** 官方气泡里图标是 14px（<Wre size={14}/>） */
const TOOLTIP_ICON_SIZE = 14;

function createTooltipIcon(name: string): SVGSVGElement | null {
  const paths = TOOLTIP_ICONS[name];
  if (!paths) return null;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(TOOLTIP_ICON_SIZE));
  svg.setAttribute('height', String(TOOLTIP_ICON_SIZE));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  // 官方是 `className="inline"` → 与文字基线对齐
  svg.setAttribute('class', 'app-tooltip__icon');
  svg.style.verticalAlign = 'text-bottom';
  for (const d of paths) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

/** 把 `...[[mouse]]...` 拆成「文本 + 图标 + 文本」写入 el；没有可识别占位符时返回 false */
function renderInto(el: HTMLElement, content: string): boolean {
  if (!content.includes('[[')) return false;
  const nodes: Node[] = [];
  const re = /\[\[(\w+)\]\]/g;
  let cursor = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const icon = createTooltipIcon(m[1]);
    if (!icon) continue;
    matched = true;
    if (m.index > cursor) nodes.push(document.createTextNode(content.slice(cursor, m.index)));
    nodes.push(icon);
    cursor = m.index + m[0].length;
  }
  if (!matched) return false;
  if (cursor < content.length) nodes.push(document.createTextNode(content.slice(cursor)));
  el.replaceChildren(...nodes);
  return true;
}

/** 单段文案（无 label/action 结构）时的渲染 */
function renderTooltipContent(tooltip: HTMLDivElement, content: string): boolean {
  if (!renderInto(tooltip, content)) return false;
  tooltip.removeAttribute('data-structured');
  return true;
}

function updateTooltipContent(tooltip: HTMLDivElement, target: HTMLElement): boolean {
  const content = target.dataset.tooltip?.trim();
  if (!content) return false;

  const label = target.dataset.tooltipLabel?.trim();
  const action = target.dataset.tooltipAction?.trim();
  if (label && action) {
    const labelElement = document.createElement('span');
    labelElement.className = 'app-tooltip__label';
    labelElement.textContent = label;
    const actionElement = document.createElement('span');
    actionElement.className = 'app-tooltip__action';
    /* 副文案同样支持内联图标：官方是 `(Ctrl/⌘ + <Wre size={14}/>)` ✓ */
    if (!renderInto(actionElement, action)) actionElement.textContent = action;
    tooltip.replaceChildren(labelElement, actionElement);
    tooltip.dataset.structured = 'true';
    return true;
  }

  if (renderTooltipContent(tooltip, content)) return true;

  tooltip.textContent = content;
  tooltip.removeAttribute('data-structured');
  return true;
}

export function useTooltipAutoPlacement() {
  useEffect(() => {
    const tooltip = document.createElement('div');
    tooltip.className = 'app-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltip);

    let hoveredTarget: HTMLElement | null = null;
    let focusedTarget: HTMLElement | null = null;
    let activeTarget: HTMLElement | null = null;
    let showTimer: number | null = null;
    const activeTargetObserver = new MutationObserver(() => {
      if (!activeTarget) return;
      if (!updateTooltipContent(tooltip, activeTarget)) {
        hideTooltip();
        return;
      }
      if (tooltip.dataset.open === 'true') positionTooltip(tooltip, activeTarget);
    });

    const clearShowTimer = () => {
      if (showTimer === null) return;
      window.clearTimeout(showTimer);
      showTimer = null;
    };

    function hideTooltip() {
      clearShowTimer();
      tooltip.removeAttribute('data-open');
      tooltip.setAttribute('aria-hidden', 'true');
    }

    const showTooltip = () => {
      showTimer = null;
      if (!activeTarget?.isConnected) {
        hideTooltip();
        return;
      }

      if (!updateTooltipContent(tooltip, activeTarget)) {
        hideTooltip();
        return;
      }

      /* 用户显式排除的那个控件（提示词/发送按钮 ✓）用旧一套取值 → CSS 的 `[data-legacy='true']` ✓ */
      if (activeTarget.dataset.tooltipLegacy === 'true') tooltip.dataset.legacy = 'true';
      else tooltip.removeAttribute('data-legacy');

      /* ★★★★★ 官方**第二套**气泡：`qr`（内部名 `K0`）= 原语 + `leading-relaxed`
            → 行高 **19.5px**（12 × 1.625 ✓ 见 `styles/tooltip.css` 的 `[data-relaxed]` ✓）
         官方源码里走这套的站点（逐字 ✓）：
            · **画布竖条**（DockBar 条目 = `$r`+`Kr`+`qr`，根节点是 Provider `delayDuration:0`）
            · **画布左下控制条**（滑条 = `l.jsx(qr,{sideOffset:22,…})` ✓；
              小地图/连线/网格/重置 = `Qg`/`fi({tooltip})`，同一个 `K0` ✓）
         ⚠️ 标记挂在**容器**上（`.sidebar-floating` / `.canvas-control-cluster`）——
            区域内所有提示一起走这套；弹层（Popover/portal）渲染在 body 下，**不会**被误伤 ✓
         ⚠️ 竖条那条**连延迟一起给**（容器 `data-tooltip-delay="0"` = 官方 Provider 0ms ✓
            官方线上实测 hover→出现 ≈28ms ✓ 见 `getShowDelay` 的 `closest()` 说明 ✓）*/
      if (activeTarget.closest('[data-tooltip-relaxed="true"]')) tooltip.dataset.relaxed = 'true';
      else tooltip.removeAttribute('data-relaxed');

      tooltip.setAttribute('data-open', 'true');
      tooltip.setAttribute('aria-hidden', 'false');
      positionTooltip(tooltip, activeTarget);
    };

    const activateTarget = (nextTarget: HTMLElement | null) => {
      if (nextTarget === activeTarget) return;

      hideTooltip();
      activeTargetObserver.disconnect();
      activeTarget = nextTarget;
      if (!activeTarget) return;

      activeTargetObserver.observe(activeTarget, {
        attributes: true,
        attributeFilter: [
          'data-tooltip', 'data-tooltip-label', 'data-tooltip-action', 'data-tooltip-pos',
          'data-tooltip-offset', 'data-tooltip-delay', 'data-tooltip-legacy',
        ],
      });
      showTimer = window.setTimeout(showTooltip, getShowDelay(activeTarget));
    };

    const syncActiveTarget = () => {
      activateTarget(hoveredTarget ?? focusedTarget);
    };

    const handlePointerOver = (event: PointerEvent) => {
      hoveredTarget = findTooltipTarget(event.target);
      syncActiveTarget();
    };

    const handlePointerOut = (event: PointerEvent) => {
      const nextTarget = findTooltipTarget(event.relatedTarget);
      if (nextTarget === hoveredTarget) return;
      hoveredTarget = nextTarget;
      syncActiveTarget();
    };

    const handleFocusIn = (event: FocusEvent) => {
      focusedTarget = findTooltipTarget(event.target);
      syncActiveTarget();
    };

    const handleFocusOut = (event: FocusEvent) => {
      focusedTarget = findTooltipTarget(event.relatedTarget);
      syncActiveTarget();
    };

    const handleClick = (event: MouseEvent) => {
      /* ★ 官方 `CopyButton`（`use-waveform-data-DMduQqB-.js` @91900 的 `rd`）行为是：
           点完按钮后 **tooltip 文案换成 `successText`（「已复制」）并保持显示**。
           MTV 原来对所有 click 一律收起 ⇒ 点完面板直接消失，"已复制"永远看不到 ✗
           ⇒ 带 `data-tooltip-keep` 的控件点完**不收起**；文案变化由上面的 MutationObserver
              （第 320 行已观察 `data-tooltip`）驱动实时刷新 ✓ */
      const keepTarget = event.target instanceof Element ? event.target.closest('[data-tooltip-keep]') : null;
      if (keepTarget) return;
      hideTooltip();
    };

    const refreshActiveTooltip = () => {
      if (!activeTarget?.isConnected) {
        hoveredTarget = null;
        focusedTarget = null;
        activateTarget(null);
        return;
      }
      if (tooltip.dataset.open === 'true') positionTooltip(tooltip, activeTarget);
    };

    document.addEventListener('pointerover', handlePointerOver);
    document.addEventListener('pointerout', handlePointerOut);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('click', handleClick, true);
    window.addEventListener('resize', refreshActiveTooltip);
    window.addEventListener('scroll', refreshActiveTooltip, true);

    return () => {
      clearShowTimer();
      activeTargetObserver.disconnect();
      document.removeEventListener('pointerover', handlePointerOver);
      document.removeEventListener('pointerout', handlePointerOut);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('resize', refreshActiveTooltip);
      window.removeEventListener('scroll', refreshActiveTooltip, true);
      tooltip.remove();
    };
  }, []);
}
