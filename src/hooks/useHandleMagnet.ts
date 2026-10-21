/**
 * 节点连接「+」按钮的磁吸跟随 —— **按官方源码还原**
 *
 * 官方源码（TapNow-0.4.66 → resources/web/assets/zoom-slider-3ZcFvYQO.js）：
 *
 *   Uke = {
 *     right: { left: 24, right: 40, top: 40, bottom: 40 },
 *     left:  { left: 40, right: 24, top: 40, bottom: 40 },
 *   }
 *   // 跟随容器（80×80 正圆，左右各贴自己那侧，垂直居中）
 *   className = right ? 'h-20 w-20 rounded-full absolute top-1/2 -translate-y-1/2 left-0  flex justify-center items-center'
 *                     : 'h-20 w-20 rounded-full absolute top-1/2 -translate-y-1/2 right-0 flex justify-center items-center'
 *   // 外层 Handle
 *   style     = { background: 'transparent', border: 'none', borderRadius: 0 }
 *   className = 'size-0 relative !flex items-center'
 *   // + 本体（lucide Plus，size 24）
 *   className = 'border-[2px] rounded-full text-muted-foreground transition-colors
 *                hover:text-foreground border-muted-foreground hover:border-foreground'
 *   // 可见条件
 *   visible = !多选 && (selected || n4) && isConnectable
 *
 * 结论：跟随范围是以「内 24 / 外 40 / 上下各 40」为界的矩形（不是圆 ✗）。
 *       这四个数字就是官方 `Uke` 的值（此前我一直拿自己推的数字试，错了）。
 */
import { useEffect, type RefObject } from 'react';

/** 官方 Uke：向卡片**内侧**最多 24 流 */
const FOLLOW_INWARD_FLOW = 24;
/** 官方 Uke：向卡片**外侧**最多 40 流 */
const FOLLOW_OUTWARD_FLOW = 40;
/** 官方 Uke：纵向上下各 40 流 */
const FOLLOW_VERTICAL_FLOW = 40;
/** 「+」在**显示位**相对手柄中心的偏移（流）。
 *  来自官方 CSS：容器 80×80 贴卡边 + flex 居中 → 显示位圆心在卡边外 **40** 流
 *  （`.node-handle-plus-visible { transform: translate(0) }`）。原来是 37 ✗（我自己量的）。 */
const HOVER_OFFSET = 40;
/** 触发跟随的距离（流）：官方容器本身 80×80 → 半径 40 */
const ACTIVATE_RADIUS_FLOW = 40;
/** 出场动画（opacity 0→1 + translateX 25→37，0.3s）期间不接管，否则看不到左右滑出 */
const APPEAR_SETTLE_MS = 320;

export function useHandleMagnet(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    let graceTimer = 0;
    let pointerX = Number.NEGATIVE_INFINITY;
    let pointerY = Number.NEGATIVE_INFINITY;
    const touched = new Set<HTMLElement>();
    const shownAt = new WeakMap<HTMLElement, number>();

    const clear = (handle: HTMLElement) => {
      handle.style.removeProperty('--magnet-x');
      handle.style.removeProperty('--magnet-y');
      handle.classList.remove('is-magnet');
      touched.delete(handle);
    };

    const apply = () => {
      frame = 0;
      const handles = root.querySelectorAll<HTMLElement>('.node-handle');
      if (!handles.length) return;

      // 画布缩放必须从 .react-flow__viewport 的 transform 取 —— MTV 手柄反向缩放，
      // 屏幕恒为 16px，用手柄宽度反推永远得 1（踩过）。
      const viewport = root.querySelector<HTMLElement>('.react-flow__viewport');
      const vt = viewport ? getComputedStyle(viewport).transform : '';
      /* ★★ **必须兼容 `matrix3d`** ✗✓ —— 原代码用 `startsWith('matrix(')`
         （**带左括号** ✓）→ 对 `matrix3d(…)` **直接返回 1** ✗✓
         WebView2 / 某些 GPU 路径会返回 `matrix3d` ✓ → 磁吸位移全算错 ✗
         （同一类坑在 `AINodeDialog.readLiveViewport` 里也踩过 ✓ 已一并加固 ✓）*/
      const zoom = (() => {
        if (!vt.startsWith('matrix')) return 1;
        const p = vt.slice(vt.indexOf('(') + 1, -1).split(',').map(Number);
        return Number.isFinite(p[0]) && p[0] > 0 ? p[0] : 1;
      })();

      // ── 先挑出「唯一」该接管的手柄 ──
      // ⚠️ 之前对每个手柄独立判定 → 光标在左 `+` 上时，右 `+` 的距离在临界值附近反复跨越
      //    （磁吸改位移 → 位移又改判定 → 自激），表现是**另一个一闪一闪**（用户反馈）。
      //    现在：① 只有最近的那个能接管；② 进入/退出用不同半径（滞回），临界不抖动。
      const engage = ACTIVATE_RADIUS_FLOW * zoom;
      const release = engage * 1.6;
      const candidates: Array<{ handle: HTMLElement; rect: DOMRect; isLeft: boolean; d: number }> = [];
      handles.forEach((handle) => {
        const rect = handle.getBoundingClientRect();
        if (rect.width <= 0) return;
        // ⚠️ 宽限期必须绑定「真正的出现瞬间」：
        //    原来在 hook 第一次看到手柄时就设 shownAt ✗ —— 那时它还是隐藏的，
        //    等 320ms 后光标才移过来，宽限期早过期 → 磁吸立刻抢走位移 → 出现动画不对。
        const now = performance.now();
        const node = handle.closest<HTMLElement>('.react-flow__node');
        const visible = !!node?.matches(':hover') || !!node?.classList.contains('selected');
        if (!visible) { shownAt.set(handle, now); return; }
        const shownSince = shownAt.get(handle);
        if (shownSince === undefined) { shownAt.set(handle, now); return; }
        const waited = now - shownSince;
        if (waited < APPEAR_SETTLE_MS) {
          // ⚠️ 关键：apply() 只在 pointermove 时跑。光标停在原处不动的话，
          //    宽限期结束后**没有任何东西再触发 apply** → 磁吸永远不接管
          //    （用户反馈"没动画了，连 hover 的运动都没了"）。
          //    所以这里自己预约一次到点后的重评估。
          if (!graceTimer) {
            graceTimer = window.setTimeout(() => {
              graceTimer = 0;
              schedule();
            }, APPEAR_SETTLE_MS - waited + 24);
          }
          return;
        }
        const isLeft = handle.classList.contains('react-flow__handle-left');
        const centerY = rect.top + rect.height / 2;
        const shownCenterX = rect.left + rect.width / 2 + (isLeft ? -HOVER_OFFSET * zoom : HOVER_OFFSET * zoom);
        const d = Math.hypot(pointerX - shownCenterX, pointerY - centerY);
        // 已经接管过的用更长的退出半径，避免在边界抖动
        if (d > (touched.has(handle) ? release : engage)) return;
        candidates.push({ handle, rect, isLeft, d });
      });
      candidates.sort((a, b) => a.d - b.d);
      const best = candidates[0];
      // 落选的手柄：清掉（只清一次，不会反复写 → 不会闪）
      handles.forEach((handle) => {
        if (handle !== best?.handle && touched.has(handle)) clear(handle);
      });
      if (!best) return;

      {
        const { handle, rect, isLeft } = best;
        const centerY = rect.top + rect.height / 2;
        const shownCenterX = rect.left + rect.width / 2 + (isLeft ? -HOVER_OFFSET * zoom : HOVER_OFFSET * zoom);
        const dxRaw = pointerX - shownCenterX;
        const dyRaw = pointerY - centerY;

        // 跟随范围 —— 逐字对应官方 Uke（矩形夹取）
        const out = FOLLOW_OUTWARD_FLOW * zoom;
        const inn = FOLLOW_INWARD_FLOW * zoom;
        const ver = FOLLOW_VERTICAL_FLOW * zoom;
        let dx = dxRaw;
        dx = isLeft ? Math.min(Math.max(dx, -out), inn) : Math.min(Math.max(dx, -inn), out);
        const dy = Math.min(Math.max(dyRaw, -ver), ver);

        handle.style.setProperty('--magnet-x', `${dx.toFixed(1)}px`);
        handle.style.setProperty('--magnet-y', `${dy.toFixed(1)}px`);
        handle.classList.add('is-magnet');
        touched.add(handle);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      schedule();
    };

    const onPointerLeave = () => {
      pointerX = Number.NEGATIVE_INFINITY;
      pointerY = Number.NEGATIVE_INFINITY;
      schedule();
    };

    root.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerleave', onPointerLeave, { passive: true });
    return () => {
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      if (frame) cancelAnimationFrame(frame);
      touched.forEach(clear);
    };
  }, [rootRef]);
}
