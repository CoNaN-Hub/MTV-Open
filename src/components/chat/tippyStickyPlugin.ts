/**
 * 官方 `pv`（tippy.js **sticky 插件**）**逐字移植**。
 *
 * 出处：live `vendor-libs-CQ5RMq_I.js` @4625888 —— 官方把 tippy 的 sticky 插件内联定义
 * 在自己的 bundle 里（npm 包 `tippy.js@6` 不再带 `plugins/sticky` 文件），
 * 并在 `B4`（`mentionSuggestionRenderer`）里以 `plugins:[pv]` 传入：
 *
 * ```js
 * var m9s = {
 *   name: "sticky", defaultValue: !1,
 *   fn: function (e) {
 *     var n = e.reference, a = e.popper;
 *     function r() { return e.popperInstance ? e.popperInstance.state.elements.reference : n }
 *     function i(c) { return e.props.sticky === !0 || e.props.sticky === c }
 *     var o = null, s = null;
 *     function l() {
 *       var c = i("reference") ? r().getBoundingClientRect() : null,
 *           d = i("popper") ? a.getBoundingClientRect() : null;
 *       (c && ZVe(o, c) || d && ZVe(s, d)) && e.popperInstance && e.popperInstance.update(),
 *         o = c, s = d, e.state.isMounted && requestAnimationFrame(l);
 *     }
 *     return { onMount: function () { e.props.sticky && l() } };
 *   },
 * };
 * function ZVe(t, e) {
 *   return t && e ? t.top !== e.top || t.right !== e.right || t.bottom !== e.bottom || t.left !== e.left : !0;
 * }
 * ```
 */
import type { Plugin } from 'tippy.js';

interface RectLike {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 官方 `ZVe`：两个 rect 是否不同（任一 `null` 也算不同）。 */
export function isDifferentRect(current: RectLike | null, next: RectLike | null): boolean {
  return current && next
    ? current.top !== next.top
      || current.right !== next.right
      || current.bottom !== next.bottom
      || current.left !== next.left
    : true;
}

/** 官方 `m9s`：`{name:"sticky", defaultValue:false, fn}`。 */
export const tippyStickyPlugin: Plugin = {
  name: 'sticky',
  defaultValue: false,
  fn(instance) {
    const { reference, popper } = instance;
    const currentReference = () => (
      instance.popperInstance ? instance.popperInstance.state.elements.reference : reference
    );
    const wants = (target: 'reference' | 'popper') => (
      instance.props.sticky === true || instance.props.sticky === target
    );
    let previousReference: RectLike | null = null;
    let previousPopper: RectLike | null = null;
    const tick = () => {
      const referenceRect = wants('reference') ? currentReference().getBoundingClientRect() : null;
      const popperRect = wants('popper') ? popper.getBoundingClientRect() : null;
      if ((referenceRect && isDifferentRect(previousReference, referenceRect))
        || (popperRect && isDifferentRect(previousPopper, popperRect))) {
        instance.popperInstance?.update();
      }
      previousReference = referenceRect;
      previousPopper = popperRect;
      if (instance.state.isMounted) requestAnimationFrame(tick);
    };
    return {
      onMount() {
        if (instance.props.sticky) tick();
      },
    };
  },
};
