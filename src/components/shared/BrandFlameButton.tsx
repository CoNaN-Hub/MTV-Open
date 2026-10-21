/**
 * BrandFlameButton.tsx —— 品牌火焰 Logo（官方 artigine `LogoShader` 逐字复刻）
 * ══════════════════════════════════════════════════════════════════════════
 * 三处使用（用户口径）：
 *   ① 画布内顶部居中 —— 可点，返回「我的项目」，带悬浮气泡（`src/components/Canvas.tsx`）
 *   ② 工作空间左上角「BETA」盘里的 logo —— 不可点（外层那个大盘按钮负责跳到「主页」），无气泡
 *   ③ 工作空间首页「今天要做点什么？」标题前 —— 不可点、无气泡
 * ⇒ 所以 `onActivate` 是**可选**的：不给就只渲染一块带 hover 动画的表面。
 *
 * 官方出处：`AppNavBar.tohwu1CJ.js` 的 `it()`（导航栏）——
 *   <div className="desktop-no-drag pointer-events-auto absolute left-1/2 -translate-x-1/2">
 *     <Tooltip delayDuration={1000}><TooltipTrigger asChild>
 *       <button type="button" onClick={onLogoActivate} aria-label={logoActionLabel}
 *               className="block rounded-full p-0 outline-none focus-visible:ring-[3px] ...">
 *         <LogoShader size={48} autoIgnite={N && $ !== true} />
 *       </button></TooltipTrigger><Tooltip side="bottom" sideOffset={10}>{…}</Tooltip></Tooltip>
 *   </div>
 *   ⇒ `size={48}` 且 `48 <= 64` ⇒ 官方走的是 **small 变体**（`he.small`）。
 *
 * 引擎逐字移植自 `brand.DHZj_TbF.js` 的 `nt()`（React hook）+ `$e`（WebGL，见
 * `brandFlameEngine.ts`），状态表逐字移植自 `logoStateStore.C_5rV8_2.js`：
 *
 * 本组件只保留 `idle` / `off` 两档（官方 5 档里其余 3 档是 busy/success/error，
 * 品牌 logo 用不到），但**逐条保留**官方的时间常数与平滑曲线：
 *   平滑 b(current,target,tau,dt) = c + (t−c)·(1−e^(−dt/tau))，误差 < .0015 直接吸附
 *   · power/flickerAmount/flickerSpeed/pulseAmount/fault → tau .7
 *   · 悬停强度 throttle：进入 tau .16、离开 tau .5（idle 的 throttle 目标 = 0）
 *   · 瞄准 aim：进入 tau .25、离开 tau .7
 *   · surge/burst：e^(−dt/.45) / e^(−dt/.9) 衰减，再以 tau .06 单向上追
 *   · phase += dt · params.flickerSpeed(2) · flickerSpeed · (1 + .7·throttle + 1.8·surge + 1.2·burst)
 *   · 入场点火（autoIgnite）：先 `off` 0.3s，再切 `idle`，并把 surge/burst 直接抬到 1
 *   · 静止 6s（且全部量已收敛）→ 1.8s 内把 intensity 降到 0 ⇒ 挂起（画布卸载）
 *     一旦有 hover/任何未收敛量 ⇒ 立刻以 .5s 把 intensity 升回 1
 *   · 挂起后 240ms 完成「着色器 → 静态图」交接（`it` / `lt` / `ut` 三段逻辑）
 *   · 两个图层 240ms `opacity` 交叉淡入；静态图层 `mix-blend-mode: plus-lighter`
 *   · 舞台：logo 本体只占画布 .52，四周各留 24% 给爆发/湍流，故着色器层 inset −46.154%
 *
 * ⚠️ 官方 `nt()` 还返回一个 `handleClick`（off ⇄ idle 手动开关）；导航栏**没用**它
 * （按钮的 onClick 直接是 `onLogoActivate`）⇒ 这里同样不接线：有 `onActivate` 时点击只跑回调，
 * 没有时整枚 logo 不可点（但 hover 动画照旧）。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createFlameEngine, type FlameEngine, type FlameFrame, type FlameVariant } from './brandFlameEngine';
import brandFlameFragment from '../../assets/logo/brandFlame.frag.glsl?raw';
import logoReferenceLarge from '../../assets/logo/logo-reference-large.webp';
import logoReferenceSmall from '../../assets/logo/logo-reference-small.webp';

/* ── 官方 `Be`：默认参数 ─────────────────────────────────────────────── */
const DEFAULT_PARAMS = {
  intensity: 1.1,
  flickerSpeed: 2,
  flickerAmount: 0.35,
  noiseScale: 1,
  smokeAmount: 1,
  fusion: 0.4,
} as const;

/* ── 官方 `he`：两个变体（亮核 uv 与羽流尺度都是实测值）──────────────── */
const VARIANTS: Record<'large' | 'small', FlameVariant> = {
  large: { textureSrc: logoReferenceLarge, coreX: 0.3783, coreY: 0.4294, spread: 1 },
  small: { textureSrc: logoReferenceSmall, coreX: 0.407, coreY: 0.443, spread: 0.85 },
};

/** 官方 `ct`：`size <= 64` 走 small */
const SMALL_VARIANT_MAX_SIZE = 64;

/* ── 官方 `N`：状态表（此处只搬 off / idle，数值逐字）────────────────── */
interface LogoStateConfig {
  fault: number;
  power: number;
  powerTau: number;
  throttle: number;
  throttleTau: number;
  flickerAmount: number;
  flickerSpeed: number;
  pulseAmount: number;
  pulseHz: number;
  enterSurge: number;
  enterBurst: number;
  allowDormancy: boolean;
}

const LOGO_STATES: Record<'off' | 'idle', LogoStateConfig> = {
  idle: {
    fault: 0, power: 1, powerTau: 0.45, throttle: 0, throttleTau: 0.5,
    flickerAmount: 1, flickerSpeed: 1, pulseAmount: 0, pulseHz: 0,
    enterSurge: 0, enterBurst: 0, allowDormancy: true,
  },
  off: {
    fault: 0, power: 0, powerTau: 0.18, throttle: 0, throttleTau: 0.4,
    flickerAmount: 1, flickerSpeed: 1, pulseAmount: 0, pulseHz: 0,
    enterSurge: 0, enterBurst: 0, allowDormancy: true,
  },
};

/** 官方 `S`：`off → 任意` 时直接给满的爆发量 */
const IGNITION_SURGE = { surge: 1, burst: 1 };
/** 官方 `Se`：入场点火延迟（秒） */
const AUTO_IGNITE_DELAY_SECONDS = 0.3;
/** 官方 `ot`：静止多久后挂起（秒） */
const DORMANCY_SECONDS = 6;
/** 官方 `at` / `st`：intensity 下落 / 回升的秒数 */
const INTENSITY_FALL_SECONDS = 1.8;
const INTENSITY_RISE_SECONDS = 0.5;
/** 官方 `Ke` / `Ze`：surge / burst 的指数衰减时间常数 */
const SURGE_DECAY_SECONDS = 0.45;
const BURST_DECAY_SECONDS = 0.9;
/** 官方 `Re`：surge/burst 单向上追的时间常数 */
const SURGE_BURST_FOLLOW_TAU = 0.06;
/** 官方 `Je` / `Qe`：throttle 进入 / 离开时间常数 */
const THROTTLE_ENTER_TAU = 0.16;
const THROTTLE_LEAVE_TAU = 0.5;
/** 官方 `et` / `tt`：aim 进入 / 离开时间常数 */
const AIM_ENTER_TAU = 0.25;
const AIM_LEAVE_TAU = 0.7;
/** 官方 `le`：参数平滑时间常数 */
const PARAM_TAU = 0.7;
/** 官方 `rt`：平滑吸附阈值 */
const SMOOTH_EPSILON = 0.0015;
/** 官方 `Ae`：舞台里 logo 本体占比 ⇒ 着色器层 inset = −((1/.52−1)/2) */
const STAGE_LOGO_RATIO = 0.52;
/** 官方 `240`：图层交叉淡入时长 */
const CROSSFADE_MS = 240;
/** 官方 `ot` 判定的收敛阈值 */
const SETTLED_THROTTLE = 0.004;
const SETTLED_SURGE = 0.003;

const STAGE_INSET = `${(-((1 / STAGE_LOGO_RATIO - 1) / 2) * 100).toFixed(3)}%`;

/** 官方 `b`：指数平滑 + 吸附 */
function smooth(current: number, target: number, tau: number, dt: number): number {
  const next = current + (target - current) * (1 - Math.exp(-dt / tau));
  return Math.abs(target - next) < SMOOTH_EPSILON ? target : next;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface BrandFlameButtonProps {
  /** 无障碍文案（官方 `logoActionLabel`）；不可点时也用它当 `aria-label`/`alt` */
  label: string;
  /**
   * 点击回调。**给了才可点**（此时外层渲染成 `<button>`，并默认挂 `data-tooltip`）；
   * 不给则只渲染一块带 hover 动画的「表面」（`<div role="img">`，**不出悬浮气泡**），
   * 方便塞进调用方自己的按钮里（如工作空间左上角那枚大盘 BETA 按钮）。
   */
  onActivate?: () => void;
  /** 可点时是否挂 `data-tooltip`（默认挂；工作空间两枚品牌标不需要气泡） */
  tooltip?: boolean;
  /** 官方 `size={48}`（`<= 64` 走 small 变体） */
  size?: number;
  /** 官方 `autoIgnite`：挂载后来一次点火爆发（0.3s 熄火 → 猛喷） */
  autoIgnite?: boolean;
  className?: string;
}

export default function BrandFlameButton({
  label,
  onActivate,
  tooltip = true,
  size = 48,
  autoIgnite = false,
  className,
}: BrandFlameButtonProps) {
  const variant = useMemo(
    () => (size <= SMALL_VARIANT_MAX_SIZE ? VARIANTS.small : VARIANTS.large),
    [size],
  );

  /* ── React 侧状态（对应官方 `nt` 的 useState 各员）────────────────── */
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const [semanticState, setSemanticState] = useState<'off' | 'idle'>(autoIgnite ? 'off' : 'idle');
  const [hovering, setHovering] = useState(false);
  const [isDormant, setIsDormant] = useState(false);
  /** 官方 `s`：唤醒瞬间盖在着色器上的**静态图盖布**（见 `resume` / `onTextureLoaded`）*/
  const [staticCover, setStaticCover] = useState(false);
  /** 官方 `O` 的等价物：静态图已解码 */
  const [staticLoaded, setStaticLoaded] = useState(false);
  /** 官方 `H`：静态图交接完成（派生，见下方 `handoffKey`） */
  /** 官方 `P`：挂起恢复计数（用来重启渲染循环） */
  const [resumeToken, setResumeToken] = useState(0);

  /* ── 引擎侧 ref（对应官方 `nt` 的一堆 useRef）────────────────────── */
  const dormantRef = useRef(false);
  const hoveringRef = useRef(false);
  const stateRef = useRef<'off' | 'idle'>(autoIgnite ? 'off' : 'idle');
  const powerRef = useRef(LOGO_STATES[autoIgnite ? 'off' : 'idle'].power);
  const flickerAmountRef = useRef(LOGO_STATES[autoIgnite ? 'off' : 'idle'].flickerAmount);
  const flickerSpeedRef = useRef(LOGO_STATES[autoIgnite ? 'off' : 'idle'].flickerSpeed);
  const pulseAmountRef = useRef(0);
  const faultRef = useRef(0);
  const pulsePhaseRef = useRef(0);
  const throttleRef = useRef(0);
  const throttleParamRef = useRef(0);
  const surgeRef = useRef(0);
  const burstRef = useRef(0);
  const surgeSmoothRef = useRef(0);
  const burstSmoothRef = useRef(0);
  const aimRef = useRef(0);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const timeRef = useRef(0);
  const phaseRef = useRef(0);
  const elapsedRef = useRef(0);
  const prevTimeRef = useRef<number | null>(null);
  const dormancyAnchorRef = useRef<number | null>(null);
  const intensityRef = useRef(1);

  /* ── 官方 `A` = resume()：清挂起，必要时重新点火循环 ─────────────────
     ⚠️ 官方这里同时 `_(!0)` 把静态图盖布**盖上**，再 `ue(m=>m+1)` 逼 React 重建引擎；
     新引擎的贴图加载完会回调 `_(!1)` 把盖布**揭掉**（见 `ze` 的第 5 个参数）。
     一盖一揭之间只有几毫秒，作用就是「着色器还没热起来时别露黑」。 */
  const resume = useCallback(() => {
    dormancyAnchorRef.current = null;
    if (!dormantRef.current) return;
    dormantRef.current = false;
    setIsDormant(false);
    setStaticCover(true);
    setResumeToken((token) => token + 1);
  }, []);

  /* ── 官方 `F` = applyState()：换档 + 抬 surge/burst ────────────────── */
  const applyState = useCallback(
    (next: 'off' | 'idle') => {
      resume();
      const previous = stateRef.current;
      if (previous === next) return;
      const config = LOGO_STATES[next];
      const fromOff = previous === 'off' && next !== 'off';
      const surge = fromOff ? IGNITION_SURGE.surge : config.enterSurge;
      const burst = fromOff ? IGNITION_SURGE.burst : config.enterBurst;
      surgeRef.current = Math.max(surgeRef.current, surge);
      burstRef.current = Math.max(burstRef.current, burst);
      stateRef.current = next;
      setSemanticState(next);
      /* 官方此处还会按 `autoReturnS` 挂一个自动回落定时器；idle/off 两档都是 0
         （= 不回落），所以本组件不需要那段定时器逻辑。 */
    },
    [resume],
  );

  /* 官方 `useEffect(()=>{ a && (T.current = U.current + Se) }, [a])`：
     `autoIgnite` ⇒ 0.3s 后点火（off → idle，带满 surge/burst）*/
  useEffect(() => {
    if (!autoIgnite) return;
    const timer = window.setTimeout(() => applyState('idle'), AUTO_IGNITE_DELAY_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [autoIgnite, applyState]);

  /* ── 渲染主循环（官方 `se`）──────────────────────────────────────── */
  useEffect(() => {
    if (!canvasEl) return;
    let cancelled = false;
    let raf = 0;
    let engine: FlameEngine | null = null;

    const create = () => {
      engine = createFlameEngine(
        canvasEl,
        variant,
        brandFlameFragment,
        () => {
          /* 官方：context lost → 先销毁再重建 */
          engine?.dispose();
          engine = null;
          if (!cancelled) create();
        },
        /* 官方 `ze` 的第 5 个参数：参考贴图就绪 ⇒ 揭掉唤醒时的静态图盖布 */
        () => {
          if (!cancelled) setStaticCover(false);
        },
      );
      setWebglAvailable(engine !== null);
      engine?.resize();
    };
    create();

    let observer: ResizeObserver | null = null;
    if (engine) {
      observer = new ResizeObserver(() => engine?.resize());
      observer.observe(canvasEl);
    }

    const frame = (nowMs: number) => {
      if (cancelled || dormantRef.current) return;
      const now = nowMs / 1000;
      const previous = prevTimeRef.current ?? now;
      const dt = Math.min(0.05, Math.max(0, now - previous));
      prevTimeRef.current = now;
      elapsedRef.current += dt;
      timeRef.current += dt;

      const config = LOGO_STATES[stateRef.current];
      powerRef.current = smooth(powerRef.current, config.power, config.powerTau, dt);
      flickerAmountRef.current = smooth(flickerAmountRef.current, config.flickerAmount, PARAM_TAU, dt);
      flickerSpeedRef.current = smooth(flickerSpeedRef.current, config.flickerSpeed, PARAM_TAU, dt);
      pulseAmountRef.current = smooth(pulseAmountRef.current, config.pulseAmount, PARAM_TAU, dt);
      faultRef.current = smooth(faultRef.current, config.fault, PARAM_TAU, dt);
      pulsePhaseRef.current += dt * config.pulseHz;

      const hoverTarget = hoveringRef.current ? 1 : 0;
      const throttleTau = hoverTarget > throttleRef.current ? THROTTLE_ENTER_TAU : THROTTLE_LEAVE_TAU;
      throttleRef.current = smooth(throttleRef.current, hoverTarget, throttleTau, dt);
      /* idle 的 throttle 目标是 0 ⇒ 这一项恒为 0，保留是为了与官方逐行一致 */
      throttleParamRef.current = smooth(throttleParamRef.current, config.throttle, config.throttleTau, dt);
      const pulse = pulseAmountRef.current * Math.sin(pulsePhaseRef.current * Math.PI * 2);
      const throttle = clamp01(Math.max(throttleRef.current, throttleParamRef.current) + pulse);

      const aimTau = hoverTarget > aimRef.current ? AIM_ENTER_TAU : AIM_LEAVE_TAU;
      aimRef.current = smooth(aimRef.current, hoverTarget, aimTau, dt);

      surgeRef.current *= Math.exp(-dt / SURGE_DECAY_SECONDS);
      burstRef.current *= Math.exp(-dt / BURST_DECAY_SECONDS);
      surgeSmoothRef.current =
        surgeSmoothRef.current < surgeRef.current
          ? smooth(surgeSmoothRef.current, surgeRef.current, SURGE_BURST_FOLLOW_TAU, dt)
          : surgeRef.current;
      burstSmoothRef.current =
        burstSmoothRef.current < burstRef.current
          ? smooth(burstSmoothRef.current, burstRef.current, SURGE_BURST_FOLLOW_TAU, dt)
          : burstRef.current;

      phaseRef.current +=
        dt * DEFAULT_PARAMS.flickerSpeed * flickerSpeedRef.current *
        (1 + 0.7 * throttle + 1.8 * surgeSmoothRef.current + 1.2 * burstSmoothRef.current);

      /* ── 挂起判定（官方逐条）── */
      const settled = powerRef.current === config.power && faultRef.current === config.fault;
      const busy =
        hoveringRef.current ||
        !config.allowDormancy ||
        !settled ||
        throttleRef.current > SETTLED_THROTTLE ||
        throttleParamRef.current > SETTLED_THROTTLE ||
        aimRef.current > SETTLED_THROTTLE ||
        surgeRef.current > SETTLED_SURGE ||
        burstRef.current > SETTLED_SURGE;
      if (busy) {
        dormancyAnchorRef.current = null;
      } else if (dormancyAnchorRef.current === null) {
        dormancyAnchorRef.current = elapsedRef.current;
      }
      if (
        dormancyAnchorRef.current !== null &&
        elapsedRef.current - dormancyAnchorRef.current > DORMANCY_SECONDS
      ) {
        intensityRef.current = Math.max(0, intensityRef.current - dt / INTENSITY_FALL_SECONDS);
        if (intensityRef.current === 0) {
          dormantRef.current = true;
          setIsDormant(true);
          return;
        }
      } else {
        intensityRef.current = Math.min(1, intensityRef.current + dt / INTENSITY_RISE_SECONDS);
      }

      const frameState: FlameFrame = {
        time: timeRef.current,
        phase: phaseRef.current,
        throttle,
        power: powerRef.current,
        surge: surgeSmoothRef.current,
        burst: burstSmoothRef.current,
        aim: aimRef.current,
        pointerX: pointerRef.current.x,
        pointerY: pointerRef.current.y,
        /* 官方 `oe.current` = `stage` prop，导航栏默认 true */
        stage: true,
        intensity: DEFAULT_PARAMS.intensity,
        flickerAmount: DEFAULT_PARAMS.flickerAmount * intensityRef.current * flickerAmountRef.current,
        noiseScale: DEFAULT_PARAMS.noiseScale,
        smokeAmount: DEFAULT_PARAMS.smokeAmount,
        fusion: DEFAULT_PARAMS.fusion,
        fault: faultRef.current,
      };
      engine?.render(frameState);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      engine?.dispose();
      prevTimeRef.current = null;
    };
    /* `resumeToken` 变化 ⇒ 挂起恢复后重启循环（官方依赖数组里是 `P`）*/
  }, [canvasEl, variant, resumeToken]);

  /* ── 官方：挂起且 idle 且静态图已就绪 ⇒ 240ms 后完成交接 ─────────────
     官方用 `ut()`（setTimeout + 双 rAF）把 `H` 置 true，并在条件不成立时同步置回 false。
     这里改成**派生**：交接条件成立的那一刻生成一个 key，240ms 后把 key 记进
     `handoffReady`，只有两者相等才算交接完成 —— 等价，且 effect 里不用同步 setState。
     key 里带上 `resumeToken`：第二次挂起（恢复过）要重新走一遍 240ms 淡出。 */
  const handoffKey =
    isDormant && semanticState === 'idle' && staticLoaded ? `dormant-${resumeToken}` : '';
  const [handoffReady, setHandoffReady] = useState('');
  useEffect(() => {
    if (!handoffKey) return;
    const timer = window.setTimeout(() => setHandoffReady(handoffKey), CROSSFADE_MS);
    return () => window.clearTimeout(timer);
  }, [handoffKey]);
  const staticHandoffComplete = handoffKey !== '' && handoffReady === handoffKey;

  /* ── 指针 ────────────────────────────────────────────────────────── */
  const handlePointerEnter = useCallback(() => {
    hoveringRef.current = true;
    setHovering(true);
    resume();
  }, [resume]);

  const handlePointerLeave = useCallback(() => {
    hoveringRef.current = false;
    setHovering(false);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerRef.current = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }, []);

  const attachStaticImage = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setStaticLoaded(true);
  }, []);

  /* 官方 `state`（对外语义）：挂起 > 悬停 > 本档 */
  const surfaceState = isDormant ? 'dormant' : semanticState === 'idle' && hovering ? 'hover' : semanticState;
  /* 官方 `P` = isStaticVisible（`isDormant || s`）：休眠时看静态图，
     醒着时盖布已被贴图加载回调揭掉 ⇒ 看着色器 */
  const staticVisible = isDormant || staticCover;
  /* 官方 `it`：静态图层完全亮起的三条件 */
  const layer = staticVisible && semanticState === 'idle' && staticLoaded
    ? { shader: 0, staticImage: 1 }
    : { shader: 1, staticImage: 0 };
  /* 官方 `lt`：静态交接未完成前，着色器层先别卸 */
  const renderCanvas = !isDormant || (semanticState === 'idle' && !staticHandoffComplete);

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    isolation: 'isolate',
  };
  const shaderLayerStyle: CSSProperties = {
    position: 'absolute',
    inset: STAGE_INSET,
    opacity: layer.shader,
    transition: `opacity ${CROSSFADE_MS}ms ease-out`,
  };
  const staticLayerStyle: CSSProperties = {
    opacity: layer.staticImage,
    transition: `opacity ${CROSSFADE_MS}ms ease-out`,
    mixBlendMode: 'plus-lighter',
  };

  /* 官方：WebGL 不可用 ⇒ 只渲染静态参考图 */
  if (webglAvailable === false) {
    return (
      <img
        src={variant.textureSrc}
        alt={label}
        data-testid="brand-flame-button"
        className={className ? `block object-contain ${className}` : 'block object-contain'}
        style={containerStyle}
        draggable={false}
      />
    );
  }

  /*
    ⚠️ 官方 `yt` 里 role/aria 在外层，但外层实际是 `<button>`（AppNavBar 那层）
    ⇒ 这里把 role="img" 的语义收敛到最外层元素上，内层只做指针采样。
  */
  const surface = (
    <div
      className={
        onActivate
          ? 'brand-flame-button__surface'
          : `brand-flame-button__surface${className ? ` ${className}` : ''}`
      }
      style={containerStyle}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      {...(onActivate
        ? {}
        : { role: 'img' as const, 'aria-label': label, 'data-testid': 'brand-flame-button', 'data-state': surfaceState })}
    >
      {renderCanvas ? (
        <div className="brand-flame-button__shader" style={shaderLayerStyle}>
          <canvas ref={setCanvasEl} className="brand-flame-button__canvas" />
        </div>
      ) : null}
      <div className="brand-flame-button__static" style={staticLayerStyle} aria-hidden="true">
        <img
          ref={attachStaticImage}
          src={variant.textureSrc}
          alt=""
          draggable={false}
          className="brand-flame-button__image"
          onLoad={() => setStaticLoaded(true)}
          onError={() => setStaticLoaded(false)}
        />
      </div>
    </div>
  );

  /* 不可点（工作空间「BETA」盘的 logo / 首页标题前那枚）：只给表面，不套按钮、不出气泡 */
  if (!onActivate) return surface;

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={label}
      {...(tooltip ? { 'data-tooltip': label } : {})}
      data-testid="brand-flame-button"
      className={className ? `brand-flame-button ${className}` : 'brand-flame-button'}
      data-state={surfaceState}
    >
      {surface}
    </button>
  );
}
