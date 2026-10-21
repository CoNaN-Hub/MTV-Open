/**
 * OfficialScrollAreaBar —— 官方 Radix ScrollArea「竖向滑条」的等价实现
 * （MTV 没有 Radix ⇒ 按官方 chunk `index-BsHyQ2qj.js` 的源码与默认值 1:1 复刻）
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 官方源码出处（逐字，偏移 = 该 chunk 内的字符偏移）
 *   · ScrollArea 包装（shadcn 预设）@2503337
 *       forwardRef(({className, children, ...props}, ref) =>
 *         <RadixScrollAreaRoot ref={ref} className={cx("relative overflow-hidden", className)} {...props}>
 *           <RadixViewport className="h-full w-full rounded-[inherit]">{children}</RadixViewport>
 *           <ScrollBar/>            // ★ 只渲染**竖向**一条（没有水平那条）
 *           <Corner/>
 *         </RadixScrollAreaRoot>)
 *   · ScrollBar 包装（shadcn 预设）@2503337
 *       forwardRef(({className, orientation="vertical", ...props}, ref) =>
 *         <RadixScrollbar ref={ref} orientation={orientation}
 *           className={cx("flex touch-none select-none transition-colors",
 *             orientation==="vertical"   && "h-full w-2.5 p-[1px]",
 *             orientation==="horizontal" && "h-2.5 flex-col p-[1px]", className)}
 *           {...props}>
 *           <RadixThumb className="relative flex-1 rounded-full bg-border dark:bg-zinc-600"/>
 *         </RadixScrollbar>)
 *   · 没传 `type` ⇒ Radix 默认 `type="hover"` + `scrollHideDelay=600` @2491351
 *       `const {__scopeScrollArea:n, type:a="hover", dir:r, scrollHideDelay:o=600, ...s}=t`
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 出现条件 —— 两级 Presence **都**成立才挂载（这才是官方真正的行为）
 *   ① hover 态：Root 上挂 pointerenter / pointerleave @2493417（逐字）
 *        const l = r.scrollArea; let c = 0;
 *        const d = () => { window.clearTimeout(c); s(!0) };                          // pointerenter
 *        const u = () => { c = window.setTimeout(() => s(!1), r.scrollHideDelay) };  // pointerleave
 *      ⇒ `<Presence present={forceMount || hovered}>` 控制**挂载与否**（@2493617）
 *      ⇒ 指针进入滚动区才出现（挂载），离开 **600ms** 后消失（卸载）；不是常显、也不是滚动时才现
 *   ② 溢出态：`lRt`（= ScrollAreaScrollbar）@2495643
 *        const [o,s]=useState(!1), l = orientation==="horizontal";
 *        const c = debounce(() => { if(viewport){ const d = vw<sw, u = vh<sh; s(l?d:u) } }, 10);
 *        MN(viewport, c); MN(content, c);            // ResizeObserver(viewport + content)
 *        <Presence present={forceMount || o}><ScrollbarImpl data-state={o?"visible":"hidden"} .../>
 *      ⇒ **没有溢出就根本不渲染**（内容装得下时连轨道都没有）
 *   ③ 最终元素上的 `data-state` = `hovered ? "visible" : "hidden"` @2493617
 *      （外层 `data-state` 在 props 里后展开、覆盖内层）⇒ 一旦挂载就恒为 "visible"。
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 几何 / 配色（逐字照官方实现，数值不自创）
 *   · 滑条本体 class：`flex touch-none select-none transition-colors h-full w-2.5 p-[1px]`
 *     + 内联 style（官方竖向分支 `aei` @2497500）
 *         top: 0, right: dir==="ltr" ? 0 : undefined,
 *         bottom: "var(--radix-scroll-area-corner-height)",
 *         "--radix-scroll-area-thumb-height": y9e(sizes) + "px"
 *       （`dRt` 另外补了 `position:"absolute"`）
 *     ⇒ 宽 10px（`w-2.5`）+ 1px padding ⇒ **可见拇指 8px**；贴在滚动区**右侧**
 *   · 拇指 class：`relative flex-1 rounded-full bg-border dark:bg-zinc-600`
 *     父容器是 `display:flex` 的**行**方向容器（竖向分支**没有** `flex-col`）
 *     ⇒ `flex-1`（`flex:1 1 0%`）决定的是**宽** = 10 − 2×1 = 8px，**高**由 CSS 变量给
 *   · 拇指高度 `y9e(sizes)` @2501280
 *       `Math.max((scrollbar.size − paddingStart − paddingEnd) × (viewport / content), 18)`
 *   · 拇指位移 `yct(scrollTop, sizes)`：把 scrollTop ∈ [0, content − viewport] 线性映射到
 *     [0, (size − padding) − thumbHeight]（`C$` = clamp）
 *   · 官方把这两者**写进 DOM 而不是 state**：高度 → 滑条内联变量 `--radix-scroll-area-thumb-height`；
 *     位移 → `lei` 的 rAF 循环里 `o.current.style.transform = translate3d(0, Ypx, 0)`
 *     （每帧比较 scrollTop，变了才写）。本组件同法（避免 effect 内 setState，也少一层重渲染）。
 *   · 拖动 / 轨道按下 `sei`：拇指可动区间 = [paddingStart + 按压偏移, size − paddingEnd − (thumbH − 按压偏移)]，
 *     指针 Y 线性反解回 scrollTop（官方 `dRt.onPointerDown` → `onDragScroll`）。
 *     ⚠️ 因此**点击轨道是会跳的**（官方默认行为：`s = e || r/2`，在轨道上按下时把拇指中心对到指针处）
 *
 * ══════════════════════════════════════════════════════════════════════════
 * MTV 侧的必要偏离（诚实记账，见交付报告）
 *   1. `data-radix-scroll-area-scrollbar` / `data-radix-scroll-area-thumb` 是**镜像属性**：
 *      对官方 assets 下 9 个 chunk 全文 grep，Radix 只产出 `data-radix-scroll-area-viewport`，
 *      scrollbar / thumb 两个属性**各 0 次命中** ⇒ 官方 DOM 里并不存在这两个属性；
 *      这里按交付要求补上，纯作验收选择器（`data-state` / `data-orientation` 是官方真有的）。
 *   2. 官方 `<Corner/>` = `hRt` @2501xxx：`return n.type!=="scroll" && a ? <Corner/> : null`，
 *      其中 `a = !!(scrollbarX && scrollbarY)`；本组件只渲染竖向条 ⇒ `scrollbarY` 恒假
 *      ⇒ **官方这边 Corner 也渲染 null** ⇒ 这里同样不渲染 Corner 节点（逐字等价，不是漏写）。
 *   3. 官方 `dark:bg-zinc-600` 在 MTV 落不到：MTV 的 Tailwind v3 是默认 `darkMode:'media'`，
 *      真机 `matchMedia('(prefers-color-scheme: dark)').matches === false`
 *      ⇒ 只有 `bg-border`（MTV `--border:#ffffff1a`）生效，实测拇指会变成半透明白 ✗。
 *      官方 dark 主题下这条的实测值是 `--color-zinc-600` = oklch(44.2% .017 285.786) = **#52525b**
 *      （同 MTV `tailwind.config.js` 第 78 行的既有注释）。类名逐字保留，
 *      另用内联 backgroundColor 把官方 dark 实测值钉死 ⇒ 实测 = #52525b。
 *   4. 官方 `onWheelScroll`（用于拦截滚轮并转成滚动量）对竖向原生滚动不需要 ⇒ 不实现。
 *   5. 官方用 `getComputedStyle(滑条)` 读 paddingTop/Bottom 得到 1px + 1px；
 *      这里直接取 `p-[1px]` 的常量 1（与官方实测同值）。
 *   6. 拇指内联只写 `height: var(--radix-scroll-area-thumb-height)`（官方还写了
 *      `width: var(--radix-scroll-area-thumb-width)`；竖向分支**从不设置**该变量 ⇒ 官方那里
 *      它同样是「无效值 → auto」再被 `flex-1` 撑成 8px，等价，故不写）。
 * ══════════════════════════════════════════════════════════════════════════
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

/** Radix `scrollHideDelay` 默认值（@2491351 `scrollHideDelay:o=600`） */
const SCROLL_HIDE_DELAY = 600;
/** 官方 `y9e` 的拇指最小高度（@2501280 `return Math.max(a,18)`） */
const MIN_THUMB_HEIGHT = 18;
/** 官方滑条 `p-[1px]`：竖向 = 上下各 1px（`y9e` 里的 paddingStart + paddingEnd） */
const SCROLLBAR_PADDING = 1;
/** 官方溢出检测的防抖（`lRt` 里 `k9e(()=>{…},10)`） */
const OVERFLOW_CHECK_DELAY = 10;

export interface OfficialScrollAreaBarProps {
  /** Radix `ScrollArea.Root` 元素（`relative overflow-hidden` 那层）—— pointerenter/leave 挂这里 */
  rootRef: RefObject<HTMLElement | null>;
  /** Radix `ScrollArea.Viewport` 元素（`data-radix-scroll-area-viewport`）—— 滚动几何都在这里读 */
  viewportRef: RefObject<HTMLElement | null>;
}

export default function OfficialScrollAreaBar({ rootRef, viewportRef }: OfficialScrollAreaBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef(0);
  /** 官方 `s.current` = 按下点相对**拇指**顶边的偏移（竖向只取 y） */
  const grabOffsetRef = useRef(0);
  /** 官方 `b.current` = 按下时滑条本体的 rect */
  const barRectRef = useRef<DOMRect | null>(null);

  const [hovered, setHovered] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  /* ── ① hovered：Root 上的 pointerenter / pointerleave（官方 @2493417 逐字） ── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const handleEnter = () => {
      window.clearTimeout(hideTimerRef.current);
      setHovered(true);
    };
    const handleLeave = () => {
      hideTimerRef.current = window.setTimeout(() => setHovered(false), SCROLL_HIDE_DELAY);
    };
    root.addEventListener('pointerenter', handleEnter);
    root.addEventListener('pointerleave', handleLeave);
    return () => {
      window.clearTimeout(hideTimerRef.current);
      root.removeEventListener('pointerenter', handleEnter);
      root.removeEventListener('pointerleave', handleLeave);
    };
  }, [rootRef]);

  /* ── ② hasOverflow：ResizeObserver(viewport + content) + 10ms 防抖（官方 `lRt` 逐字） ── */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let timer = 0;
    const check = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setHasOverflow(viewport.offsetHeight < viewport.scrollHeight);
      }, OVERFLOW_CHECK_DELAY);
    };
    check();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    observer?.observe(viewport);
    /* 官方 `MN(n.content, c)`：content = Viewport 里那个 `minWidth:100%; display:table` 的包裹层 */
    const content = viewport.firstElementChild;
    if (content) observer?.observe(content);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [viewportRef]);

  /* 挂载 ⇒ hovered（官方 @2493617：外层 data-state 覆盖内层 ⇒ 挂载时恒为 visible） */
  const mounted = hovered && hasOverflow;

  /**
   * 官方 `y9e(sizes)` + `yct(scrollTop, sizes)`：把「拇指高度 / 位移」直接写进 DOM
   * （高度 = 滑条内联 CSS 变量，位移 = 拇指 transform，与官方 `aei` / `lei` 完全同法）。
   */
  const applyThumbGeometry = useCallback(() => {
    const bar = barRef.current;
    const thumb = thumbRef.current;
    const viewport = viewportRef.current;
    if (!bar || !thumb || !viewport) return;
    const content = viewport.scrollHeight;
    const viewportSize = viewport.offsetHeight;
    const barSize = bar.clientHeight;
    if (content <= 0 || viewportSize <= 0 || barSize <= 0) return;
    /* 轨道可动长度 = scrollbar.size − (paddingStart + paddingEnd) */
    const track = Math.max(barSize - SCROLLBAR_PADDING * 2, 0);
    const height = Math.max(track * (viewportSize / content), MIN_THUMB_HEIGHT);
    const maxScroll = content - viewportSize;
    const travel = Math.max(track - height, 0);
    const clamped = Math.min(Math.max(viewport.scrollTop, 0), Math.max(maxScroll, 0));
    const offset = maxScroll > 0 ? (clamped / maxScroll) * travel : 0;
    bar.style.setProperty('--radix-scroll-area-thumb-height', `${height}px`);
    thumb.style.transform = `translate3d(0, ${offset}px, 0)`;
  }, [viewportRef]);

  /* ── ③ 挂载后：先量一次，再由 rAF 循环（官方 `lei`）与 ResizeObserver（官方 `onResize`）维护 ── */
  useLayoutEffect(() => {
    if (!mounted) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    applyThumbGeometry();
    let raf = 0;
    let lastTop = viewport.scrollTop;
    const tick = () => {
      const current = viewportRef.current;
      if (current && current.scrollTop !== lastTop) {
        lastTop = current.scrollTop;
        applyThumbGeometry();
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => applyThumbGeometry());
    observer?.observe(viewport);
    const content = viewport.firstElementChild;
    if (content) observer?.observe(content);
    const bar = barRef.current;
    if (bar) observer?.observe(bar);
    return () => {
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [applyThumbGeometry, mounted, viewportRef]);

  /**
   * 官方 `sei(pointerY, grabOffset, sizes)` —— 把指针在滑条上的 Y 反解成 scrollTop。
   * `const r=y9e(n), o=r/2, s=e||o, l=r-s,`
   * `c=n.scrollbar.paddingStart+s, d=n.scrollbar.size-n.scrollbar.paddingEnd-l,`
   * `u=n.content-n.viewport; return fRt([c,d],[0,u])(t)`
   */
  const scrollTopFromPointerY = useCallback((pointerY: number) => {
    const bar = barRef.current;
    const viewport = viewportRef.current;
    if (!bar || !viewport) return null;
    const content = viewport.scrollHeight;
    const viewportSize = viewport.offsetHeight;
    const barSize = bar.clientHeight;
    if (content <= 0 || viewportSize <= 0 || barSize <= 0) return null;
    const track = Math.max(barSize - SCROLLBAR_PADDING * 2, 0);
    const height = Math.max(track * (viewportSize / content), MIN_THUMB_HEIGHT);
    const half = height / 2;
    const grab = grabOffsetRef.current || half; // `s = e || o`
    const rest = height - grab;
    const start = SCROLLBAR_PADDING + grab;
    const end = barSize - SCROLLBAR_PADDING - rest;
    const maxScroll = content - viewportSize;
    if (end === start) return 0; // `fRt` 的退化分支返回 e[0] = 0
    return (maxScroll / (end - start)) * (pointerY - start);
  }, [viewportRef]);

  /** 官方直接写 `viewport.scrollTop = …`（越界由浏览器自行夹取） */
  const applyPointerY = (pointerY: number) => {
    const viewport = viewportRef.current;
    const next = scrollTopFromPointerY(pointerY);
    if (viewport && next !== null) viewport.scrollTop = next;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const bar = barRef.current;
    const viewport = viewportRef.current;
    if (!bar || !viewport) return;
    /* 官方 `dRt.onPointerDown`：setPointerCapture + 记录 rect + 关掉 body 选择 + scrollBehavior:auto */
    event.currentTarget.setPointerCapture(event.pointerId);
    barRectRef.current = bar.getBoundingClientRect();
    viewport.style.scrollBehavior = 'auto';
    applyPointerY(event.clientY - barRectRef.current.top);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    /* 官方 `N(T)`：只有 `b.current`（按下中）才处理 */
    const rect = barRectRef.current;
    if (!rect) return;
    applyPointerY(event.clientY - rect.top);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    barRectRef.current = null;
    grabOffsetRef.current = 0; // 官方 `onThumbPointerUp: () => s.current = 0`
    const viewport = viewportRef.current;
    if (viewport) viewport.style.scrollBehavior = '';
  };

  if (!mounted) return null;

  return (
    <div
      ref={barRef}
      dir="ltr"
      data-orientation="vertical"
      data-state={hovered ? 'visible' : 'hidden'}
      /* ⚠️ 镜像属性（见文件头偏离 1）：官方 Radix 不产出这两个 data-radix-*，仅作验收选择器 */
      data-radix-scroll-area-scrollbar=""
      className="flex touch-none select-none transition-colors h-full w-2.5 p-[1px]"
      style={{
        position: 'absolute',
        top: 0,
        /* 官方竖向分支：`right: dir==="ltr" ? 0 : undefined`（两处 Root 都是 dir="ltr"） */
        right: 0,
        bottom: 'var(--radix-scroll-area-corner-height)',
      } as CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={() => {
        window.clearTimeout(hideTimerRef.current);
        setHovered(true);
      }}
      onPointerLeave={() => {
        hideTimerRef.current = window.setTimeout(() => setHovered(false), SCROLL_HIDE_DELAY);
      }}
    >
      <div
        ref={thumbRef}
        data-radix-scroll-area-thumb=""
        data-state="visible"
        className="relative flex-1 rounded-full bg-border dark:bg-zinc-600"
        style={{
          /* 官方 `iye`：`{width:"var(--radix-scroll-area-thumb-width)", height:"var(--radix-scroll-area-thumb-height)"}` */
          height: 'var(--radix-scroll-area-thumb-height)',
          transform: 'translate3d(0, 0px, 0)',
          /* MTV 偏离 3：把官方 dark 主题的 `dark:bg-zinc-600` = #52525b 钉死 */
          backgroundColor: '#52525b',
        }}
        onPointerDownCapture={(event) => {
          /* 官方 `iye.onPointerDownCapture`：记录按下点相对**拇指**的偏移 */
          const rect = event.currentTarget.getBoundingClientRect();
          grabOffsetRef.current = event.clientY - rect.top;
        }}
      />
    </div>
  );
}
