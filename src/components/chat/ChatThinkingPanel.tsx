/**
 * 官方「思考档位 / Effort」控件 —— `use-chat-attachment-file-input-CE59XJWo.js`@87678 起逐字复刻。
 *
 * 官方压缩名 → 组件（本文件导出名）：
 *   `Eu` → `ThinkingSwitch`     开关键（shadcn `Switch`，关闭思考）
 *   `Su` → `ThinkingSlider`     档位滑杆（指针拖拽 + 方向键 + canvas 涟漪）
 *   `_u` → `ThinkingRippleCanvas` 滑杆底层的 canvas 点阵涟漪（`live` 时逐帧）
 *   `zs` → `ThinkingControl`    容器：多档 ⇒ 滑杆，单档 + 可关 ⇒ 开关，其余 ⇒ null
 *   `Iu` → `LockedEffortPanel`  会话已锁模型时的说明面板（标题 + 「模型已锁定」徽标 + 内嵌控件）
 *
 * 几何/缓动/涟漪数学全在 `src/services/chat/thinkingSliderGeometry.ts`（与官方同名函数一一对应）。
 *
 * ⚠️ 官方 `zs` 的第一行是 `if (!model.thinking) return null` —— 模型目录里**没有** `thinking`
 *    元数据时这个控件**整体不渲染**（官方离线兜底目录 `Tq` 也没有该字段）。
 *    MTV 的模型目录（用户自配的第三方连接）**永远**没有该字段，因此**调用方**
 *    （`AgentModelFlyout` → `resolveThinkingMetaForModel`）会在缺失时传入**官方逐字档位词汇表**
 *    作为兜底元数据 ⇒ 本组件照常渲染滑杆（★ 本工程唯一偏离官方处，逐字声明见
 *    `services/chat/configuredModelThinking.ts` 头注释 ★）。
 *    ⚠️ 本组件自身**保持官方原样**：`model.thinking` 为空仍然 `return null`（不在这里兜底），
 *    兜底只发生在「解析元数据」那一层，便于逐条对照官方 `zs`。
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { getLocale } from '../../i18n';
import {
  canDisableThinking,
  localizeLevel,
  type ModelThinkingMeta,
  type ModelWithThinking,
} from '../../services/chat/modelThinking';
import { getModelPickerText } from '../../services/chat/modelPickerStrings';
import {
  DOT_PAD,
  DRAG_THRESHOLD,
  LEVEL_TWEEN_MS,
  RIPPLE_DOT_RADIUS,
  RIPPLE_GRID,
  THINKING_OFF_SENTINEL,
  dotLeft,
  dotState,
  levelRatio,
  prefersReducedMotion,
  rippleAlpha,
  rippleFalloff,
  toFillRatio,
  tweenEase,
} from '../../services/chat/thinkingSliderGeometry';

/** 官方 `cx`：类名拼接。 */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** 官方 `wu`：档位标签（关闭哨兵 ⇒ i18n `off`）。 */
function levelLabel(level: string, locale: string, offText: string): string {
  return level === THINKING_OFF_SENTINEL ? offText : localizeLevel(level, locale);
}

/** 官方 `bu`：档位切换的补间值（`immediate` 或「减少动态效果」时直接取目标值）。 */
function useLevelTween(target: number, immediate: boolean): number {
  const skip = immediate || prefersReducedMotion();
  const [value, setValue] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    if (skip) {
      currentRef.current = target;
      return;
    }
    if (currentRef.current === target) return;
    const from = currentRef.current;
    const startedAt = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / LEVEL_TWEEN_MS);
      const next = from + (target - from) * tweenEase(progress);
      currentRef.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, skip]);

  /* `skip` 时直接取目标值，避免在 effect 里同步 setState 造成级联渲染。 */
  return skip ? target : value;
}

/**
 * 官方 `_u`：滑杆底层的 canvas 点阵涟漪。
 * `5px` 网格上画 `0.7px` 半径的点，按 `rippleFalloff × rippleAlpha` 调透明度；
 * `previewRatio`（悬停预览）用更低的基准透明度画在实心填充之外。
 */
function ThinkingRippleCanvas({
  fillRatio,
  previewRatio,
  accented,
  live,
}: {
  fillRatio: number;
  previewRatio: number | null;
  accented: boolean;
  live: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /* 最新绘制参数走 ref（只在 rAF / ResizeObserver 回调里读）⇒ 不在 render 期写 ref。 */
  const stateRef = useRef({ fillRatio, previewRatio, live });

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const parent = canvas?.parentElement;
    if (!canvas || !ctx || !parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w <= 0 || h <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const { fillRatio: fill, previewRatio: preview, live: isLiveProp } = stateRef.current;
    const fillPx = fill >= 1 ? w : Math.round(Math.min(1, Math.max(0, fill)) * w);
    const previewPx =
      preview == null ? fillPx : preview >= 1 ? w : Math.round(Math.min(1, Math.max(0, preview)) * w);

    const cols = Math.max(1, Math.floor(w / RIPPLE_GRID));
    const rows = Math.max(1, Math.floor(h / RIPPLE_GRID));
    const offsetX = Math.floor((w - cols * RIPPLE_GRID) / 2);
    const offsetY = Math.floor((h - rows * RIPPLE_GRID) / 2);
    const now = performance.now();
    const isLive = isLiveProp && !prefersReducedMotion();

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = getComputedStyle(canvas).color;

    const paintUpTo = (limit: number, alphaFor: (t: number) => number) => {
      if (limit <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, limit, h);
      ctx.clip();
      for (let row = 0; row < rows; row += 1) {
        const py = offsetY + row * RIPPLE_GRID + RIPPLE_GRID / 2;
        for (let col = 0; col < cols; col += 1) {
          const px = offsetX + col * RIPPLE_GRID + RIPPLE_GRID / 2;
          if (px - RIPPLE_GRID / 2 >= limit) break;
          ctx.globalAlpha = alphaFor(rippleFalloff(px, py, limit, w, h)) * rippleAlpha(px, limit, now, isLive);
          ctx.beginPath();
          ctx.arc(px, py, RIPPLE_DOT_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    if (previewPx > fillPx) paintUpTo(previewPx, (t) => 0.12 * (0.28 + 0.72 * t));
    paintUpTo(fillPx, (t) => 0.7 * (0.28 + 0.72 * t));
    ctx.globalAlpha = 1;
  }, []);

  useEffect(() => {
    paint();
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const observer =
      typeof ResizeObserver === 'function' && parent ? new ResizeObserver(() => paint()) : null;
    if (observer && parent) observer.observe(parent);
    return () => observer?.disconnect();
  }, [paint]);

  useEffect(() => {
    stateRef.current = { fillRatio, previewRatio, live };
    if (!live || prefersReducedMotion()) paint();
  }, [fillRatio, previewRatio, live, paint]);

  useEffect(() => {
    if (!live || prefersReducedMotion()) return;
    let frame = 0;
    const loop = () => {
      paint();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [live, paint]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cx(
        'pointer-events-none absolute inset-0',
        accented ? 'text-accent-primary' : 'text-text-text-primary',
      )}
    />
  );
}

/** 官方 `Eu`：思考开关键。 */
function ThinkingSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const label = getModelPickerText('thinking', getLocale());
  return (
    <div className="flex h-7 items-center justify-between gap-3 pr-0.5">
      <span className="text-xs font-normal text-text-text-primary">{label}</span>
      <SwitchPrimitive.Root
        aria-label={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cx(
          'shrink-0 data-[state=checked]:bg-accent-primary',
          'data-[state=unchecked]:bg-zinc-600 data-[state=unchecked]:shadow-none',
          'focus-visible:outline-none',
          'peer inline-flex h-5 w-9 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <SwitchPrimitive.Thumb
          className={cx(
            'pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
            'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}

/** 官方 `Su`：档位滑杆。 */
export function ThinkingSlider({
  levels,
  selectedLevel,
  enabled,
  onSelect,
}: {
  levels: string[];
  selectedLevel: string | null;
  enabled: boolean;
  onSelect: (level: string) => void;
}) {
  const locale = getLocale();
  const offText = getModelPickerText('off', locale);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const pointerStartXRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  const selectedIndex = selectedLevel ? levels.indexOf(selectedLevel) : -1;
  const targetRatio = levelRatio(levels, selectedLevel);
  const desiredRatio = isDragging && hoverRatio != null ? hoverRatio : targetRatio;
  const tweenedRatio = useLevelTween(desiredRatio, isDragging);
  const isLive = isDragging || Math.abs(tweenedRatio - targetRatio) > 0.004;
  const hoveredIndex = hoverRatio == null || levels.length === 0 ? null : Math.round(hoverRatio * (levels.length - 1));
  const maxIndex = Math.max(selectedIndex, 0);
  const isMax = levels.length > 0 && maxIndex === levels.length - 1;
  const previewLevel =
    !isDragging && hoveredIndex != null && levels.length > 1 && hoveredIndex !== maxIndex
      ? levels[hoveredIndex] ?? null
      : null;
  const fillRatio = selectedLevel === THINKING_OFF_SENTINEL ? 0 : toFillRatio(tweenedRatio, trackWidth);
  const previewFillRatio =
    previewLevel == null || levels[hoveredIndex ?? -1] === THINKING_OFF_SENTINEL
      ? null
      : toFillRatio(levelRatio(levels, previewLevel), trackWidth);
  const valueLabel = selectedLevel ? levelLabel(selectedLevel, locale, offText) : null;

  useLayoutEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    const measure = () => setTrackWidth(node.clientWidth);
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ⚠️ 这几个都是普通函数而**不是** `useCallback`：React Compiler 的
     `react-hooks/preserve-manual-memoization` 会因推断依赖（`setHoverRatio` 等）与手写依赖
     不一致而报错；滑杆是叶子组件，去掉手工 memo 没有实际代价。 */
  const ratioFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const inner = rect.width - DOT_PAD * 2;
    if (inner <= 0) return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.min(1, Math.max(0, (clientX - rect.left - DOT_PAD) / inner));
  };

  const selectIndex = (index: number) => {
    const level = levels[index];
    if (!level || !enabled) return;
    onSelect(level);
  };

  const selectRatio = (ratio: number) => {
    if (levels.length === 0) return;
    selectIndex(Math.round(ratio * (levels.length - 1)));
  };

  const endDrag = () => {
    draggingRef.current = false;
    if (movedRef.current) {
      movedRef.current = false;
      setIsDragging(false);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    event.preventDefault();
    draggingRef.current = true;
    pointerStartXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ratio = ratioFromClientX(event.clientX);
    if (ratio != null) {
      setHoverRatio(ratio);
      selectRatio(ratio);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const ratio = ratioFromClientX(event.clientX);
    if (ratio == null) return;
    setHoverRatio(ratio);
    if (!draggingRef.current) return;
    if (!movedRef.current && Math.abs(event.clientX - pointerStartXRef.current) >= DRAG_THRESHOLD) {
      movedRef.current = true;
      setIsDragging(true);
    }
    if (movedRef.current) selectRatio(ratio);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!enabled || levels.length === 0) return;
    const current = Math.max(0, selectedIndex);
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        selectIndex(Math.min(levels.length - 1, current + 1));
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        selectIndex(Math.max(0, current - 1));
        break;
      case 'Home':
        event.preventDefault();
        selectIndex(0);
        break;
      case 'End':
        event.preventDefault();
        selectIndex(levels.length - 1);
        break;
      default:
        break;
    }
  };

  const dots = useMemo(
    () =>
      levels.map((level, index) => {
        const ratio = index / Math.max(levels.length - 1, 1);
        const state = dotState(index, maxIndex, hoveredIndex, isMax);
        const stateClass = {
          max: 'scale-[1.9] bg-accent-primary',
          selected: 'scale-[1.9] bg-text-text-primary',
          hovered: 'scale-125 bg-text-text-primary/[0.7]',
          idle: 'scale-100 bg-text-text-primary/[0.28]',
        }[state];
        return (
          <span
            key={`${level}-${index}`}
            className={cx(
              'absolute top-1/2 z-10 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full',
              'transition-[color,transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
              stateClass,
            )}
            style={{ left: dotLeft(ratio, trackWidth) }}
          />
        );
      }),
    [hoveredIndex, isMax, levels, maxIndex, trackWidth],
  );

  return (
    <div className={cx('flex flex-col gap-2', !enabled && 'opacity-45')}>
      <div className="flex h-7 items-center justify-between gap-3 pr-0.5">
        <span className="text-xs font-normal text-text-text-primary">{getModelPickerText('effort', locale)}</span>
        {valueLabel ? (
          <span className="min-w-9 text-right text-xs font-normal text-text-text-primary animate-in fade-in-0 duration-150 motion-reduce:animate-none">
            {valueLabel}
          </span>
        ) : null}
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={enabled ? 0 : -1}
        aria-label={getModelPickerText('effort', locale)}
        aria-valuemin={0}
        aria-valuemax={Math.max(levels.length - 1, 0)}
        aria-valuenow={Math.max(selectedIndex, 0)}
        aria-valuetext={valueLabel ?? undefined}
        aria-disabled={!enabled || undefined}
        aria-orientation="horizontal"
        className={cx(
          'relative h-7 overflow-hidden rounded-md',
          'bg-text-text-primary/[0.06]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          enabled ? 'cursor-pointer' : 'cursor-default',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onPointerLeave={() => {
          if (!draggingRef.current) setHoverRatio(null);
        }}
        onKeyDown={handleKeyDown}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0.5 overflow-hidden rounded">
          <div
            className={cx(
              'absolute inset-y-0 left-0 rounded',
              'transition-colors duration-200 motion-reduce:transition-none',
              isMax ? 'bg-accent-primary/[0.12]' : 'bg-text-text-primary/[0.06]',
            )}
            style={{ width: fillRatio >= 1 ? '100%' : `${fillRatio * 100}%` }}
          />
          <ThinkingRippleCanvas
            fillRatio={fillRatio}
            previewRatio={previewFillRatio}
            accented={isMax}
            live={isLive}
          />
        </div>
        {levels.length > 1 ? (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {dots}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 官方 `zs`：思考档位控件容器。 */
export function ThinkingControl({
  model,
  settings,
  onChange,
  embedded = false,
}: {
  model: ModelWithThinking & { id: string };
  settings: { enabled: boolean; level?: string | null } | null | undefined;
  onChange: (next: { enabled: boolean; level?: string }) => void;
  embedded?: boolean;
}) {
  const thinking: ModelThinkingMeta | undefined = model.thinking;
  if (!thinking) return null;
  const levels = thinking.levels ?? [];
  const currentLevel = settings?.level || thinking.default?.level || levels[0] || null;
  const canDisable = canDisableThinking(model);
  const enabled = canDisable ? (settings?.enabled ?? thinking.default?.enabled ?? true) : true;
  const switchable = levels.length > 1;
  if (!switchable && !canDisable) return null;
  const allLevels = canDisable ? [THINKING_OFF_SENTINEL, ...levels] : levels;
  const selected = canDisable && !enabled ? THINKING_OFF_SENTINEL : currentLevel;

  const handleSelect = (level: string) => {
    if (level === THINKING_OFF_SENTINEL) {
      onChange({ enabled: false, ...(currentLevel ? { level: currentLevel } : {}) });
      return;
    }
    onChange({ enabled: true, level });
  };

  return (
    <div
      className={cx(
        'flex flex-col gap-1 text-foreground',
        embedded
          ? 'w-full border-t border-border/50 px-2 py-1.5'
          : 'w-[240px] shrink-0 rounded-2xl border border-border/50 bg-popover px-3 py-2.5 shadow-lg',
      )}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {switchable ? (
        <ThinkingSlider
          key={model.id}
          levels={allLevels}
          selectedLevel={selected}
          enabled
          onSelect={handleSelect}
        />
      ) : (
        <ThinkingSwitch
          checked={enabled}
          onCheckedChange={(next) => onChange({ enabled: next, ...(currentLevel ? { level: currentLevel } : {}) })}
        />
      )}
    </div>
  );
}

/**
 * 官方 `Iu`：会话已开始时模型被锁定的说明面板。
 * 结构 = 标题行（模型图标 + 名称 + 「模型已锁定」徽标）+ 说明段 + 内嵌 `zs`（锁定态仍可调档位）。
 */
export function LockedEffortPanel({
  model,
  displayName,
  settings,
  onChange,
  leading,
  lockIcon,
}: {
  model: ModelWithThinking & { id: string };
  displayName: string;
  settings: { enabled: boolean; level?: string | null } | null | undefined;
  onChange: (next: { enabled: boolean; level?: string }) => void;
  /** 官方 `pn`：模型图标槽（`<span className="flex size-4 shrink-0 items-center justify-center">…`）。 */
  leading?: ReactNode;
  /** 官方 `Lo`：锁图标（10px / stroke 1.75）。 */
  lockIcon?: ReactNode;
}) {
  const locale = getLocale();
  const lockedLabel = getModelPickerText('modelLocked', locale);
  const lockedHint = getModelPickerText('modelLockedHint', locale);
  return (
    <div data-locked-effort-panel="" className="w-[240px] p-1 text-foreground">
      <div className="px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-text-primary">{displayName}</h4>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-4 text-text-text-secondary">
            {lockIcon}
            {lockedLabel}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-4 text-text-text-secondary">{lockedHint}</p>
      </div>
      <ThinkingControl embedded model={model} settings={settings} onChange={onChange} />
    </div>
  );
}
