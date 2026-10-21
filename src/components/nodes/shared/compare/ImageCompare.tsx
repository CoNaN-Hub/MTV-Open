/**
 * ImageCompare —— Bencho「Image compare」组件（MIT · bencho.dev/licence），来源逐字保留。
 *
 * 机制见下方 Bencho 原注释（「两张图一个框 / 线是果冻 / 层会漂移」）。
 *
 * ── 本项目的适配（Bencho 原文要求"用你自己的判断"的那部分）──
 * Bencho 的 CSS 读了两个它自己**不定义**的设计令牌，已按 MTV 既有 token 映射：
 *   · `--font-ui`   ← MTV `body` 的字体栈（MTV 没有字体令牌）
 *   · `--signal`    ← 官方中性刻度（官方 `--foreground` #f5f5f5 = 焦点环；Bencho 那里也是焦点环）
 * 见 `styles/image-compare.css` 顶部的 `.image-compare-scope`（**只落在组件根上，不外溢**）。
 *
 * ── 与 Bencho 原版的三处功能性差异 ──
 *   ① 原版把两张图**写死**成 `/blocks/xray-2.jpg` 与 `/blocks/yak.jpg`（bencho.dev 的示例素材）
 *      ⇒ 加了 `beforeSrc` / `afterSrc`（有值即用，无值回落原示例常量）。
 *   ② 新增 `fill`：**铺满父容器**（尺寸实测，不写死 270×360）。
 *      用户实测的问题：卡片 280×360、组件写死 270×360 ⇒ 露出容器底色（「溢出的底部底色」）。
 *      ⚠️ 尺寸只从 `offsetWidth/offsetHeight`（布局像素）取 —— 画布缩放时
 *         `getBoundingClientRect` 给的是屏幕像素，会随缩放变化 ⇒ 拿它算滑条位置会错位。
 *   ③ 拖拽起点从**整块图**收窄到**滑条本身**（那根线的手柄区）。
 *      用户：「我悬浮就触发拖动，我没法移动卡片；我需要当我开始拖拽时 才触发」
 *      —— 原版是独立站点，整块图就是滑条；这里跑在画布节点里，整块图要是也吃 pointerdown，
 *      卡片就**永远拖不动**了 ⇒ 现在：**抓滑条 = 拖对比**，抓别处 = 交给 React Flow 拖卡片。
 *      实现 = 根节点去掉 `nodrag`，只给手柄区 `nodrag nopan nowheel`（RF 靠 `.nodrag` 判断是否接管）。
 * 其余逻辑（弹簧、flick、键盘、clip-path 弯折）**一字未改**。
 */
import { useEffect, useRef, useState } from 'react';

const W = 270;
const H = 360;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/* two photographs of one scene, the same size and framing: the
   x-ray is the before, the colour the after */
const DEFAULT_BEFORE = '/blocks/xray-2.jpg';
const DEFAULT_AFTER = '/blocks/yak.jpg';

export function Compare({
  /* show the Before and After tags */
  labels = true,
  corner = 20,
  beforeSrc,
  afterSrc,
  beforeLabel = 'Before',
  afterLabel = 'After',
  /* 铺满父容器（画布节点里用这个；独立使用时保持 Bencho 的固定尺寸） */
  fill = false,
}: {
  labels?: boolean;
  corner?: number;
  /** 覆盖原版写死的示例素材：左/上那张（before） */
  beforeSrc?: string;
  /** 覆盖原版写死的示例素材：右/下那张（after） */
  afterSrc?: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** true = 尺寸跟着父容器走（实测 offsetWidth/offsetHeight） */
  fill?: boolean;
} = {}) {
  const [p, setP] = useState(0.5);
  const [bend, setBend] = useState(0);
  const cur = useRef(0.5);
  const target = useRef<number | null>(null);
  /* the ends of the line, and how fast they are moving */
  const ends = useRef({ x: 0.5, v: 0 });
  const raf = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ v: number; t: number; last: number } | null>(null);
  const [held, setHeld] = useState(false);
  const BEFORE = beforeSrc || DEFAULT_BEFORE;
  const AFTER = afterSrc || DEFAULT_AFTER;

  /* ── `fill`：尺寸实测 ──
     `sizeRef` 给 rAF 循环读（循环里拿到的是闭包快照，不能读 state），
     `size` 给渲染读（画曲线 / 定手柄位置）。 */
  const sizeRef = useRef({ w: W, h: H });
  const [size, setSize] = useState({ w: W, h: H });
  useEffect(() => {
    if (!fill) return;
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w <= 0 || h <= 0) return;
      sizeRef.current = { w, h };
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);
  const bw = fill ? size.w : W;
  const bh = fill ? size.h : H;

  /* one loop for both motions: the glide toward a target, and
     the ends catching up with the middle. It stops itself once
     everything is still. */
  const loop = () => {
    if (raf.current) return;
    let prev = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.033, (t - prev) / 1000);
      prev = t;
      if (target.current !== null) {
        cur.current += (target.current - cur.current) * (1 - Math.pow(0.0004, dt));
        if (Math.abs(target.current - cur.current) < 0.0005) { cur.current = target.current; target.current = null; }
      }
      /* the jelly: a spring from the ends to the middle, damped
         firmly enough that it flexes and settles without a wobble */
      const e = ends.current;
      e.v += ((cur.current - e.x) * 620 - e.v * 44) * dt;
      e.x += e.v * dt;
      setP(cur.current);
      setBend(clamp((cur.current - e.x) * sizeRef.current.w * 0.5, -9, 9));
      const still = target.current === null && Math.abs(cur.current - e.x) < 0.0006 && Math.abs(e.v) < 0.002;
      if (still) { e.x = cur.current; e.v = 0; setBend(0); raf.current = 0; return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const glide = (to: number) => { target.current = to; loop(); };
  /* under the finger: the knob is drawn this frame, not the next —
     only the ends are left to the loop */
  const place = (v: number) => { target.current = null; cur.current = v; setP(v); loop(); };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const at = (cx: number) => {
    const r = box.current!.getBoundingClientRect();
    return clamp((cx - r.left) / r.width, 0, 1);
  };

  const r = clamp(corner, 0, 28);
  /* the line as a curve: ends at x - bend, and a control point at
     x + bend so the curve passes exactly through the knob */
  const x = p * bw;
  const top = x - bend;
  const curve = `M ${top.toFixed(2)} 0 Q ${(x + bend).toFixed(2)} ${bh / 2} ${top.toFixed(2)} ${bh}`;
  const cut = `path("M 0 0 L ${top.toFixed(2)} 0 Q ${(x + bend).toFixed(2)} ${bh / 2} ${top.toFixed(2)} ${bh} L 0 ${bh} Z")`;

  return (
    <div
      ref={box}
      /* ★ `nopan nowheel`：滚轮别被当成画布缩放。
         ⚠️ 这里**故意没有 `nodrag`** —— 有了它整块图都归滑条、卡片就拖不动了（用户实测报的 bug）。
         拖拽入口收在下面的 `.cmp-grip`（那根线的手柄区）。 */
      className="cmp image-compare-scope nopan nowheel"
      data-held={held || undefined}
      role="slider"
      tabIndex={0}
      aria-label="Image compare"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
      style={{ width: fill ? '100%' : W, height: fill ? '100%' : H, borderRadius: r, '--p': p } as React.CSSProperties}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); glide(clamp((target.current ?? cur.current) - 0.1, 0, 1)); }
        if (e.key === 'ArrowRight') { e.preventDefault(); glide(clamp((target.current ?? cur.current) + 0.1, 0, 1)); }
      }}
    >
      {/* the edit underneath, drifting a little with the line */}
      <img className="cmp-img cmp-after" src={AFTER} alt="" draggable={false} />
      {/* the raw shot on top, cut off at the line */}
      <div className="cmp-before" style={{ clipPath: cut }}>
        <img className="cmp-img" src={BEFORE} alt="" draggable={false} />
      </div>
      {labels && (
        <>
          <span className="cmp-tag" style={{ opacity: clamp((p - 0.14) * 4, 0, 1) }}>{beforeLabel}</span>
          <span className="cmp-tag cmp-right" style={{ opacity: clamp((0.86 - p) * 4, 0, 1) }}>{afterLabel}</span>
        </>
      )}
      <svg className="cmp-line" width={bw} height={bh} viewBox={`0 0 ${bw} ${bh}`} aria-hidden="true">
        <path d={curve} />
      </svg>
      {/* ★ 拖拽手柄区：跟着线走的一条**透明宽条**（宽条只是好抓，视觉还是 2px 的线 + 36px 圆钮）。
          只有它带 `nodrag nopan nowheel` ⇒ 抓这里 = 拖对比；抓图的别处 = React Flow 拖卡片。 */}
      <span
        className="cmp-grip nodrag nopan nowheel"
        style={{ left: x }}
        onPointerDown={(e) => {
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a scripted pointer */ }
          const v = at(e.clientX);
          drag.current = { v: 0, t: performance.now(), last: v };
          setHeld(true);
          glide(v);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const v = at(e.clientX);
          const now = performance.now();
          d.v = (v - d.last) / Math.max(1, now - d.t);
          d.t = now;
          d.last = v;
          place(v);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          setHeld(false);
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* never captured */ }
          /* a flick carries it to the edge it was thrown at */
          if (d && Math.abs(d.v) > 0.0025) {
            glide(d.v > 0 ? 1 : 0);
          }
        }}
        onPointerCancel={() => { drag.current = null; setHeld(false); }}
      >
        <span className="cmp-knob">
          <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
            <path d="M5 1 1 5l4 4M11 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </div>
  );
}

export default Compare;
