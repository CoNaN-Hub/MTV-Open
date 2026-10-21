/**
 * useOverflowState —— 官方 `Qv`（`use-chat-attachment-file-input-BcpbCD8t.js`@140270，函数名 `Lx`）逐字复刻。
 *
 * 官方原文：
 *   const Qr = 2, Dh = [];
 *   function Lx(e = Dh) {
 *     const t = useRef(null);
 *     const [n, s] = useState(false);      // isOverflowing
 *     const r = useRef(false);             // 上一次是否溢出（迟滞用）
 *     const [i, o] = useState(true);       // isScrolledToStart
 *     const [c, l] = useState(false);      // isScrolledToEnd
 *     useEffect(() => {
 *       const d = t.current;
 *       if (!d) return;
 *       const u = () => {                                     // scroll
 *         const x = d.scrollLeft <= Qr;
 *         const g = d.scrollLeft + d.clientWidth >= d.scrollWidth - Qr;
 *         o(x); l(g);
 *       };
 *       const p = () => {                                     // resize / mutation
 *         const x = d.scrollWidth - d.clientWidth;
 *         const g = r.current ? x > -40 : x > 0;              // ← 40px 迟滞
 *         if (g !== r.current) { r.current = g; s(g); }
 *         if (!g) { o(true); l(false); return; }
 *         u();
 *       };
 *       p();
 *       d.addEventListener("scroll", u, { passive: true });
 *       const f = new ResizeObserver(p); f.observe(d);
 *       const m = new MutationObserver(p); m.observe(d, { childList: true, subtree: true });
 *       return () => { f.disconnect(); m.disconnect(); d.removeEventListener("scroll", u); };
 *     }, e);
 *     return { ref: t, isOverflowing: n, isScrolledToStart: i, isScrolledToEnd: c };
 *   }
 *
 * ⚠️ 与官方唯一差别：纯 node 测试环境没有 `ResizeObserver` / `MutationObserver`
 *    ⇒ 各自加 `typeof` 守卫（官方产物跑在浏览器里，不需要）。
 */
import { useEffect, useRef, useState, type RefObject } from 'react';

/** 官方 `Qr`：滚动量容差。 */
const SCROLL_EPSILON_PX = 2;
/** 官方迟滞阈值：已溢出时允许反向 40px 才收回「不溢出」。 */
const OVERFLOW_HYSTERESIS_PX = 40;

export interface OverflowState<T extends HTMLElement> {
  ref: RefObject<T | null>;
  isOverflowing: boolean;
  isScrolledToStart: boolean;
  isScrolledToEnd: boolean;
}

export default function useOverflowState<T extends HTMLElement>(
  deps: readonly unknown[] = [],
): OverflowState<T> {
  const ref = useRef<T | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const previousOverflowingRef = useRef(false);
  const [isScrolledToStart, setIsScrolledToStart] = useState(true);
  const [isScrolledToEnd, setIsScrolledToEnd] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const handleScroll = () => {
      const atStart = node.scrollLeft <= SCROLL_EPSILON_PX;
      const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - SCROLL_EPSILON_PX;
      setIsScrolledToStart(atStart);
      setIsScrolledToEnd(atEnd);
    };

    const measure = () => {
      const overflowBy = node.scrollWidth - node.clientWidth;
      const next = previousOverflowingRef.current
        ? overflowBy > -OVERFLOW_HYSTERESIS_PX
        : overflowBy > 0;
      if (next !== previousOverflowingRef.current) {
        previousOverflowingRef.current = next;
        setIsOverflowing(next);
      }
      if (!next) {
        setIsScrolledToStart(true);
        setIsScrolledToEnd(false);
        return;
      }
      handleScroll();
    };

    measure();
    node.addEventListener('scroll', handleScroll, { passive: true });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resizeObserver?.observe(node);
    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(measure);
    mutationObserver?.observe(node, { childList: true, subtree: true });
    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      node.removeEventListener('scroll', handleScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 官方 `useEffect(..., deps)` 同样是外部传入的依赖数组
  }, deps);

  return { ref, isOverflowing, isScrolledToStart, isScrolledToEnd };
}
