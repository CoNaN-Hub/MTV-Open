/**
 * WorkspaceDotsBackground —— 官方工作空间首页的**点阵背景**（`Gr`，`index-DdHBXEd8.js` @28359 逐字移植）
 * ══════════════════════════════════════════════════════════════════════════
 * 官方常量（同文件 @3804 起逐字）：
 *   `Wt = "linear-gradient(to bottom, #000 0%, #000 30%, rgba(0,0,0,0.08) 55%, transparent 70%)"`  // mask-image
 *   `Ve = 22`     点阵步长        `$t = 300`   鼠标光晕高斯半径（sigma² = $t²/4 ⇒ 2σ² = $t²/2）
 *   `Vr = 2`      DPR 上限        `Se = {r:255,g:255,b:255,a:.07}`    基础色/透明度
 *   `Ke = {r:186,g:224,b:255,a:.175}` 鼠标处色/透明度                 `Kr = 1600` breathing 周期
 *   `Gt = .72` / `Wr = 1.3` breathing 透明度上下限倍率                `$r = 33`  breathing 帧间隔(ms)
 *
 * 官方算法（逐字）：
 *   容器 `pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[2rem]` + mask（`Wt`，`maskSize:100% 100%`）
 *   内 `<canvas className="pointer-events-none block size-full max-h-none max-w-none" />`
 *   · DPR = min(devicePixelRatio, 2)，`setTransform(dpr,0,0,dpr,0,0)` 后按 CSS 尺寸绘制
 *   · 从 `Ve/2` 起、步长 `Ve` 遍历网格；用鼠标位置算 `P = exp(-((dx²+dy²) / ($t²/2)))`
 *   · 颜色 = lerp(Se, Ke, P)，透明度 = lerp(baseAlpha, mouseAlpha, P)，画半径 1 的点
 *   · `breathing`：`baseAlpha *= Gt + (Wr-Gt) * (sin(now/Kr)+1)/2`，按 `$r` ms 节流重绘
 *   · 监听 `mousemove`（passive，记录指针，移出容器即清空）+ `scroll`（capture）+ `ResizeObserver` 重绘
 */
import { useCallback, useEffect, useRef } from 'react';

const MASK_IMAGE = 'linear-gradient(to bottom, #000 0%, #000 30%, rgba(0,0,0,0.08) 55%, transparent 70%)';
const DOT_STEP = 22;              // Ve
const GLOW_RADIUS = 300;          // $t
const DPR_CAP = 2;                // Vr
const BASE_COLOR = { r: 255, g: 255, b: 255, a: 0.07 };   // Se
const GLOW_COLOR = { r: 186, g: 224, b: 255, a: 0.175 };  // Ke
const BREATHE_PERIOD = 1600;      // Kr
const BREATHE_MIN = 0.72;         // Gt
const BREATHE_MAX = 1.3;          // Wr
const BREATHE_FRAME_MS = 33;      // $r

export interface WorkspaceDotsBackgroundProps {
  /** 官方 `breathing`：透明度缓慢呼吸 */
  breathing?: boolean;
  /** 官方 `intensity`：整体透明度倍率 */
  intensity?: number;
  className?: string;
}

export default function WorkspaceDotsBackground({
  breathing = false,
  intensity = 1,
  className,
}: WorkspaceDotsBackgroundProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ cx: number; cy: number } | null>(null);
  const frameRef = useRef(0);
  const breathingRef = useRef(breathing);
  const intensityRef = useRef(intensity);
  useEffect(() => {
    breathingRef.current = breathing;
    intensityRef.current = intensity;
  }, [breathing, intensity]);

  const paint = useCallback(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width <= 0 || height <= 0) return;
    const dpr = Math.min(typeof window !== 'undefined' && window.devicePixelRatio || 1, DPR_CAP);
    const pixelW = Math.max(1, Math.floor(width * dpr));
    const pixelH = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pointer = pointerRef.current;
    let glowX = Number.NEGATIVE_INFINITY;
    let glowY = Number.NEGATIVE_INFINITY;
    if (pointer) {
      const rect = host.getBoundingClientRect();
      const x = pointer.cx - rect.left;
      const y = pointer.cy - rect.top;
      if (x >= 0 && y >= 0 && x <= width && y <= height) {
        glowX = x;
        glowY = y;
      }
    }

    const sigmaSquared = (GLOW_RADIUS * GLOW_RADIUS) / 4;
    let baseAlpha = BASE_COLOR.a * intensityRef.current;
    const glowAlpha = GLOW_COLOR.a * intensityRef.current;
    if (breathingRef.current) {
      const wave = (Math.sin(performance.now() / BREATHE_PERIOD) + 1) / 2;
      baseAlpha *= BREATHE_MIN + (BREATHE_MAX - BREATHE_MIN) * wave;
    }

    for (let y = DOT_STEP * 0.5; y < height; y += DOT_STEP) {
      for (let x = DOT_STEP * 0.5; x < width; x += DOT_STEP) {
        const dx = x - glowX;
        const dy = y - glowY;
        const falloff = Math.exp(-((dx * dx + dy * dy) / (2 * sigmaSquared)));
        const r = BASE_COLOR.r + (GLOW_COLOR.r - BASE_COLOR.r) * falloff;
        const g = BASE_COLOR.g + (GLOW_COLOR.g - BASE_COLOR.g) * falloff;
        const b = BASE_COLOR.b + (GLOW_COLOR.b - BASE_COLOR.b) * falloff;
        const a = baseAlpha + (glowAlpha - baseAlpha) * falloff;
        ctx.fillStyle = `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, ${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  const schedule = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      paint();
    });
  }, [paint]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const observer = new ResizeObserver(() => schedule());
    observer.observe(host);
    schedule();

    const handleMove = (event: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const outside = x < 0 || y < 0 || x > rect.width || y > rect.height;
      pointerRef.current = outside ? null : { cx: event.clientX, cy: event.clientY };
      schedule();
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    return () => {
      observer.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [schedule]);

  useEffect(() => {
    if (!breathing) return undefined;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last >= BREATHE_FRAME_MS) {
        last = now;
        paint();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [breathing, paint]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-testid="workspace-dots-background"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[2rem] ${className ?? ''}`}
      style={{
        WebkitMaskImage: MASK_IMAGE,
        maskImage: MASK_IMAGE,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
      }}
    >
      <canvas ref={canvasRef} className="pointer-events-none block size-full max-h-none max-w-none" />
    </div>
  );
}
