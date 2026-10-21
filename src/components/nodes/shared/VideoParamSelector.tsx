/**
 * VideoParamSelector 视频参数选择器
 * - Seedance 模型 → Seedance 参数（分辨率、宽高比、时长、有声视频）
 * - 其他 provider → 通用视频参数（像素分辨率、帧率、时长）
 */
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import AnimatedButton from '../../shared/AnimatedButton';
import type { BaseNodeData, GeneralModelConfig } from '../../../types';
import type { VideoModelCapability, VideoReferenceItem } from '../../../types/aiTypes';
import type { DramaCharacter } from '../../../types/dramaAssets';
import { resolveDramaAssetImageRef } from '../../../services/dramaAssetPrompt';
import { getApimartSeedanceCapability } from '../../../services/ai/apimartVideoModels';
import { getVolcengineSeedanceCapability } from '../../../services/ai/volcengineVideoModels';
import { getDreaminaVideoCapability } from '../../../services/ai/dreaminaModels';
import { AUTODL_H3_WORKFLOW } from '../../../services/workflowApi/autodlWorkflowManifest';
import { getModelProtocolPresetVideoCapability } from '../../../services/ai/modelProtocol';
import {
  resolveVideoDurationSeconds,
  VIDEO_ASPECT_RATIOS,
  VIDEO_DURATION_MAX_SECONDS,
  VIDEO_DURATION_MIN_SECONDS,
} from '../../../services/aiDimensions';
import { useAppStore } from '../../../store/useAppStore';
import { useT } from '../../../i18n';
import {
  getParamEntry,
  videoGenerateMethodLabelKey,
  videoModelInfo,
  videoReferenceCapabilitySummaries,
  type VideoReferenceCapabilitySummary,
  type VideoMethodKey,
} from '../../../services/ai/modelParamCatalog';
/* 官方 `o.model` 是官方 `vt` 模型枚举值（目录表 `Fe` 的键）；MTV 节点上存的是模型选择器的
   value（自定义连接形如 `general/<cfgId>`）⇒ 复用 MTV 既有别名口径找回上游 modelId。 */
import { imageModelAliases } from '../../../utils/imageNodeDefaults';

interface VideoParamSelectorProps {
  provider?: string;
  selectedModel?: string;
  nodeId?: string;
  videoReferences?: VideoReferenceItem[];
  onChangeVideoReferences?: (value: VideoReferenceItem[]) => void;
  // ── ComfyUI / RunningHub ──
  videoResolution?: number;
  videoFps?: number;
  videoFrames?: number;
  onChangeResolution?: (value: number) => void;
  onChangeFps?: (value: number | undefined) => void;
  // ── Seedance ──
  seedanceResolution?: string;
  seedanceRatio?: string;
  seedanceDuration?: number;
  generateAudio?: boolean;
  onChangeSeedanceResolution?: (value: string | undefined) => void;
  onChangeSeedanceRatio?: (value: string | undefined) => void;
  onChangeSeedanceDuration?: (value: number | undefined) => void;
  onChangeGenerateAudio?: (value: boolean | undefined) => void;
  showSeedanceRatio?: boolean;
  showGenerateAudio?: boolean;
  /**
   * 官方 `VideoConfigsPanel`（`Roe` @1875906）的同名 prop：节点当前选中的**生成方式**
   * （官方 `dd(modelType)` 的输出 = `frames | reference | edit`）。
   *
   * 官方载体 = `data.params.modelType`（`zt` 枚举字符串）—— 由官方 `LXe`（canvas:@1991362）
   * 的 `state.modelType` 读出、`dd` 折成 method key；缺省（字段不存在）⇒ `null` ⇒ 不 push。
   * 见 `types/index.ts` 的 `BaseNodeData.params` 记账。
   */
  generateMethod?: VideoMethodKey;
  /**
   * 官方 `state.modelType`（`LXe` canvas:@1991362 `const h=n?.params?.modelType`）原样字符串。
   * §93 新增：官方目录兜底（`videoModelInfo`）需要它来选 `variants[]`；
   * 缺省时回落 `variants[0]`（= 官方 `jre` 的 `?? entry.variants[0]`）。
   */
  videoModelType?: string;
  /**
   * 官方 `Roe` 的 `availableGenerateMethods`（`_`）：`EJ(model)` 的产物
   * （顺序恒为 `frames → reference → edit`）。由调用方（`AINodeDialog`）从目录表给出。
   */
  availableGenerateMethods?: VideoMethodKey[];
  /**
   * 官方 `Roe` 的 `onGenerateMethodChange`（`v`）：写节点数据的
   * `params.modelType` / `params.variant`（官方 `an` canvas:@2058180 逐字）。
   */
  onGenerateMethodChange?: (method: VideoMethodKey) => void;
  /** 官方 `Roe` 的 `disabled`（`j`）。 */
  disabled?: boolean;
  /** 官方 `Roe` 的 `lockedParameters`（`L`，默认 `[]`，逐字）。 */
  lockedParameters?: string[];
  onContinuousEditEnd?: () => void;
}

const SEEDANCE_RESOLUTIONS = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
];

const SEEDANCE_RATIOS = [
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
  { value: '21:9', label: '21:9' },
  { value: 'adaptive', label: '自适应' },
];

const FRAME_ROLE_OPTIONS: Array<{ value: VideoReferenceItem['role']; label: string }> = [
  { value: 'first_frame', label: '首帧' },
  { value: 'reference', label: '中间帧' },
  { value: 'last_frame', label: '尾帧' },
];

/**
 * §115 —— **MTV 自造的「参考帧 / 参考角色」两个面板分组是否渲染**。
 *
 * 官方取证（`D:\DEEPSEEK\live-assets-r100\vendor-pkg-canvas-DuoOicPr.js` @1868054 区，`Eoe` =
 * `VideoConfigsPanel` 的完整 JSX + props 全文）：面板只有 **7 组** ——
 * 生成模式 · 生成方式 · **比例** · **清晰度** · 生成时长 · 生成音频 · 极速模式；
 * **没有**任何「按帧位指定首帧/尾帧」或「从角色库挑参考角色」的分组。
 * （`videoConfigs.frames`=「首尾帧」@4386535 只是**生成方式的一个选项**；
 *   `videoModels.firstFrame/lastFrame/selectFirstFrame` 属于另一套首尾帧选图，不是本面板分组。）
 *
 * 2026-10-15 用户裁决：官方没有 ⇒ 移除。这里改成**开关常量**而不是物理删除，理由见调用点注释
 * （`videoReferences` 字段仍被 6 处服务消费；关掉后用户看到的面板外形已与官方一致，且可一键恢复）。
 *
 * ⚠️ **用户 2026-10-15 的最终裁决（勿删、勿改成 true、勿连带清理）**：
 *    「官方无此两组 ⇒ **只关 UI、保留能力**，不许物理删除。」
 *    · 面板外形必须与官方一致（七组）⇒ 常量保持 `false`；
 *    · `videoReferences` 这条**能力**要留着 —— 它被 `services/ai/generateVideo.ts:108` ·
 *      `services/ai/providers/apimartMedia.ts:203` · `services/plugins/pluginRuntime.ts:530` ·
 *      `services/storageService.ts:296/332/541/574` 消费；
 *    · 下一轮**不要**删这个常量、也不要连带删 `references` / `frameReferences` /
 *      `characterOptions` / `addReference` / `setFrameRole` / `removeReference` 这些派生量；
 *      要恢复 UI 只需把常量改回 `true`。
 */
const SHOW_MTV_REFERENCE_PICKERS = false;

/**
 * §122 —— **帧率组是否在「视频参数面板」里渲染**（默认 `false`）。
 *
 * 官方 `Eoe` 在这个位置**没有帧率组**（可正向枚举的组：模式/生成方式/比例/清晰度/时长/音频/极速）；
 * 官方的帧率在**「放大」表单**里，取值只有 `auto / 30 / 60 / 90`
 * （`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @2083765 区 `video.upscaleForm.selectFrameRate`
 *  + `frameRate.auto/30fps/60fps/90fps`）。
 * MTV **没有放大表单** ⇒ 用户裁决：**保留能力、标注未接入**，不静默删除 ⇒ 用这个开关关掉面板里那一组。
 * 做放大表单时把 `configuredFrameRates` 按 `auto/30/60/90` 迁过去，再把本开关保持 `false`。
 */
const SHOW_MTV_FRAME_RATE_CONTROL = false;

/**
 * §123 官方比例项的**比例图形** = 官方 `E0`（`vendor-pkg-canvas-Dp0xADoD.js` @1229953 逐字）：
 *
 * ```js
 * E0 = ({ratio:e, size:t=14, className:n}) => {
 *   const o = e.toLowerCase();
 *   if (o.startsWith("auto") || o === "adaptive") return s.jsx(u1,{size:t,className:n});
 *   const l = (u => { const p = u.split(":");
 *     if (p.length !== 2) return 1;
 *     const m = parseFloat(p[0]), f = parseFloat(p[1]);
 *     return Number.isNaN(m) || Number.isNaN(f) || f === 0 ? 1 : m/f })(e);
 *   let c, d;
 *   return l >= 1 ? (c = t, d = t/l) : (d = t, c = t*l),
 *     s.jsx("div",{className:z("flex items-center justify-center flex-none",n),
 *       style:{width:t,height:t},
 *       children:s.jsx("div",{className:"border-[1.5px] border-current rounded-[2px]",
 *                           style:{width:c,height:d}})})}
 * ```
 *
 * `u1`（官方产物里 `import{jB as u1}`，本地名 `kY=R("fullscreen",…)`）= **lucide `fullscreen`**。
 * 真机取证（CDP 9222，官方 `videoConfigs.aspectRatio` 的「自适应」格）：
 * `class="lucide lucide-fullscreen"` · `width/height="14"` · 五条子元素逐字 =
 * `M3 7V5a2 2 0 0 1 2-2h2` / `M17 3h2a2 2 0 0 1 2 2v2` / `M21 17v2a2 2 0 0 1-2 2h-2` /
 * `M7 21H5a2 2 0 0 1-2-2v-2` / `<rect width="10" height="8" x="7" y="8" rx="1">`。
 * 比例档的框是真机同款：外层 `flex items-center justify-center flex-none`(14×14) +
 * 内层 `border-[1.5px] border-current rounded-[2px]`，尺寸 = `14×14/r`（**不取整**，
 * 官方真机计算值 16:9 → `14 × 7.875` · 4:3 → `14 × 10.5` · 21:9 → `14 × 6` · 9:16 → `7.875 × 14`）。
 */
function OfficialVideoRatioIcon({ ratio, size = 14 }: { ratio: string; size?: number }) {
  const lower = (ratio ?? '').toLowerCase();
  if (lower.startsWith('auto') || lower === 'adaptive') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-fullscreen"
        aria-hidden="true"
      >
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <rect width="10" height="8" x="7" y="8" rx="1" />
      </svg>
    );
  }
  const parts = (ratio ?? '').split(':');
  const w = parts.length === 2 ? parseFloat(parts[0]) : NaN;
  const h = parts.length === 2 ? parseFloat(parts[1]) : NaN;
  const r = Number.isNaN(w) || Number.isNaN(h) || h === 0 ? 1 : w / h;
  const boxW = r >= 1 ? size : size * r;
  const boxH = r >= 1 ? size / r : size;
  return (
    <div
      className="flex items-center justify-center flex-none"
      style={{ width: size, height: size }}
    >
      <div
        className="border-[1.5px] border-current rounded-[2px]"
        style={{ width: boxW, height: boxH }}
      />
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════════
 * 官方 `TF` —— **视频时长选择器**（`vendor-pkg-canvas-Dp0xADoD.js` @1866900 起 + @1867720 起，逐字）
 *
 * ```js
 * const vYe = [], wYe = /^\d{0,3}$/, Ay = -1;
 * function _Ye(e, t, n) {                       // 从候选 t 里挑离 e 最近的一个（并列时按 n 的方向）
 *   return t.reduce((o, r) => { const i = Math.abs(o - e), l = Math.abs(r - e);
 *     return l < i ? r : l > i ? o : e >= n ? Math.max(o, r) : Math.min(o, r) }) }
 * function TF({value:e, options:t, onValueChange:n, disabledOptions:o=vYe, disabledTooltips:r,
 *              disabled:i, ariaLabel:l, className:c}) {
 *   const {t:d} = ne(),
 *     u = a.useCallback(v => v === Ay ? "" : String(v), []),
 *     [p, m] = a.useState(() => u(e)),
 *     f = a.useMemo(() => [...new Set(t)], [t]),
 *     h = a.useMemo(() => { const v = new Set(o); return f.filter(w => !v.has(w)) }, [o, f]),
 *     g = a.useMemo(() => h.filter(v => v !== Ay), [h]);
 *   a.useEffect(() => { m(u(e)) }, [u, e]);
 *   const x = a.useCallback(() => {
 *     if (p === "") { m(u(e)); return }
 *     const v = Number(p), w = Number.isFinite(v) && g.length > 0 ? _Ye(v, g, e) : e;
 *     w !== e && n(w); m(u(w)) }, [p, g, n, u, e]);
 *   if (f.length === 0) return null;
 *   const y = f.filter(v => v !== Ay), b = y.length > 0 ? Math.min(...y) : void 0,
 *         _ = y.length > 0 ? Math.max(...y) : void 0;
 *   return s.jsxs("div",{className:z("flex min-w-0 items-center gap-2",c),"data-testid":"duration-selector",
 *     children:[
 *       s.jsx(ni,{options:f,value:e,onChange:n,disabled:i,disabledOptions:[...o],disabledTooltips:r,
 *         renderOption:v => v === Ay ? d("videoConfigs.durationAuto") : `${v}s`,
 *         scrollable:!0, className:"min-w-0 flex-1", itemClassName:"min-w-10 whitespace-nowrap"}),
 *       s.jsxs("div",{className:"relative w-[72px] shrink-0",children:[
 *         s.jsx(Cr,{type:"text",inputMode:"numeric",pattern:"[0-9]*","aria-label":l,
 *           value:p, placeholder:e === Ay ? d("videoConfigs.durationAuto") : void 0,
 *           min:b, max:_, step:1, disabled:i,
 *           onChange:v => { const w = v.target.value; if(!wYe.test(w)) return; m(w);
 *             const C = Number(w);
 *             w !== "" && Number.isInteger(C) && h.includes(C) && C !== e && n(C) },
 *           onFocus:v => v.currentTarget.select(), onClick:v => v.currentTarget.select(),
 *           onBlur:x,
 *           onKeyDown:v => { v.stopPropagation();
 *             v.key === "Enter" && (v.preventDefault(), x(), v.currentTarget.select());
 *             v.key === "Escape" && (v.preventDefault(), m(String(e)), v.currentTarget.blur()) },
 *           className:"h-8 w-full rounded-lg border-0 bg-input/40 py-0 pl-2 pr-6 text-center text-sm font-medium tabular-nums shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"}),
 *         p !== "" && s.jsx("span",{className:"pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground",children:"s"})
 *       ]})
 *     ]})}
 * ```
 *
 * 真机取证（CDP 9222 · `app.tapnow.media` · Seedance 2.5 · 面板 400×390）：
 *   · `[data-testid="duration-selector"]` = `div.flex.min-w-0.items-center.gap-2`，376×36 @(777.3,552.7)；
 *   · 药丸行 = `div.relative.flex.bg-input/40.rounded-lg.p-0.5.overflow-x-auto.min-w-0.flex-1`
 *     （`scrollbar-width:none` + 左右 15%/85% 的 `mask-image` 渐变），每颗 `min-w-10 whitespace-nowrap`
 *     = 40×32，`4s…30s` 逐颗溢出滚动；
 *   · 数值输入框 = `input[type=text][inputmode=numeric]`，72×32 @(1081.3,554.7)，
 *     `value="5"` · `aria-label="选择视频生成时长"` · `min=4 max=30 step=1`，
 *     右侧绝对定位的 `span` 文案 `s`（`p !== ""` 时才渲染）。
 *
 * ⚠️ **官方这个 prop 名字叫 `durationControl: "slider"`，但渲染出来的 `TF` 是「药丸 + 数字输入框」，不是滑杆。**
 *    调用点逐字：`durationControl: o.model===vt.SEEDANCE_2_5||o.model===vt.SEEDANCE_2_5_DRAFT||o.model===vt.WAN_3_0
 *    ? "slider" : "options"`（@2071153 区）。⇒ Seedance 2.5 **走的就是 `TF`**。
 * ══════════════════════════════════════════════════════════════════════════════ */
const OFFICIAL_DURATION_AUTO = -1;
/** 官方 `wYe = /^\d{0,3}$/` */
const OFFICIAL_DURATION_DRAFT_RE = /^\d{0,3}$/;

/** 官方 `_Ye(e, t, n)` 逐字。 */
function nearestOfficialDuration(candidate: number, pool: number[], current: number): number {
  return pool.reduce((best, value) => {
    const bestGap = Math.abs(best - candidate);
    const valueGap = Math.abs(value - candidate);
    if (valueGap < bestGap) return value;
    if (valueGap > bestGap) return best;
    return candidate >= current ? Math.max(best, value) : Math.min(best, value);
  });
}

/** 官方 `u = v => v === Ay ? "" : String(v)` */
function durationDraftOf(value: number | undefined): string {
  return value === OFFICIAL_DURATION_AUTO || value === undefined ? '' : String(value);
}

/* ══════════════════════════════════════════════════════════════════════════════
 * §126 官方分段控件的**选中底色 + 切换动画**（`vendor-pkg-canvas-Dp0xADoD.js` @1229060 区逐字）
 *
 * ```jsx
 * s.jsxs("div",{ref:p,className:z("relative flex bg-input/40 rounded-lg p-0.5",…),children:[
 *   s.jsx("div",{className:"absolute top-0.5 bottom-0.5 bg-input/40 rounded-md transition-all duration-200 ease-out",
 *                 style:{left:f.left,width:f.width}}),            // ← @1229126 滑动指示块
 *   e.map((E,k)=>{ … className:z("relative z-10 flex flex-1 items-center justify-center px-2 py-1.5 rounded-md text-sm
 *                                   transition-colors duration-200",
 *                                t===E ? "text-foreground" : "text-muted-foreground hover:text-foreground", …) })
 * ]})
 * ```
 * 量取方式（同处逐字）：`const A={left:k.offsetLeft,width:k.offsetWidth}; h(L=>…); u&&E.scrollTo({…})`。
 *
 * ⇒ **官方的「选中底色」不在按钮上**（选中项的类串只有 `text-foreground`，**没有 `bg-*`**），
 *   而是那颗**绝对定位的滑动指示块**：`bg-input/40` = `var(--input)` 40% —— 官方 dark 令牌 `--input:#ffffff26`
 *   （α=0x26/255=0.149）⇒ 40% ⇒ **rgba(255,255,255,0.0596)**；圆角 `rounded-md`(10px)；
 *   过渡 = `transition-all duration-200 ease-out` ⇒ `all 0.2s cubic-bezier(0, 0, 0.2, 1)`。
 *
 * ⚠️ MTV 侧：`.img-rp-segmented-thumb` 的 CSS **早就写好了**（位置/颜色/过渡一致），但
 *   `VideoParamSelector` 里**从来没有渲染过这个元素**（`img-rp-segmented-thumb` 在全文件命中 0）
 *   ⇒ 点击选项后没有任何底色、切换时也没有底色动画（用户 2026-10-15「点击选项时 底色没有 切换时 底色动画没有」）。
 *   ⇒ 本节按官方补上：把每个分段控件包一层 `VideoSegmented`，渲染官方那颗指示块并按选中项量取 `left/width`。
 * ══════════════════════════════════════════════════════════════════════════════ */
function useSegmentedThumb(activeKey: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const active = el.querySelector<HTMLElement>('[data-seg-active="true"]');
      if (!active) {
        setBox((prev) => (prev.width === 0 ? prev : { left: 0, width: 0 }));
        return;
      }
      /* 官方逐字：`{left: k.offsetLeft, width: k.offsetWidth}`（指示块与按钮同在 `position:relative` 容器内） */
      const next = { left: active.offsetLeft, width: active.offsetWidth };
      setBox((prev) => (prev.left === next.left && prev.width === next.width ? prev : next));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeKey]);
  return { ref, box };
}

/** 官方 `ni` 的轨道 + 滑动指示块（见上）。`className` 缺省 = `.img-rp-quality-segmented`。 */
function VideoSegmented({
  activeKey,
  className,
  children,
}: {
  activeKey: unknown;
  className?: string;
  children: ReactNode;
}) {
  const { ref, box } = useSegmentedThumb(activeKey);
  return (
    <div ref={ref} className={className ?? 'img-rp-quality-segmented'}>
      <span className="img-rp-segmented-thumb" style={{ left: box.left, width: box.width }} aria-hidden="true" />
      {children}
    </div>
  );
}


/**
 * 官方 `TF`：左边 `ni`（分段药丸，可横向滚动）+ 右边 72px 数字输入框 + 固定后缀 `s`。
 * 这也是 Seedance 2.5 / 2.5-draft / wan3.0 在官方上的时长形态。
 */
export function OfficialVideoDurationSelector({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  autoLabel,
  onCommit,
}: {
  value: number | undefined;
  options: number[];
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel: string;
  autoLabel: string;
  onCommit?: () => void;
}) {
  const uniqueOptions = useMemo(() => [...new Set(options)], [options]);
  const enabledOptions = useMemo(
    () => uniqueOptions.filter((item) => item !== OFFICIAL_DURATION_AUTO),
    [uniqueOptions],
  );
  const min = enabledOptions.length > 0 ? Math.min(...enabledOptions) : undefined;
  const max = enabledOptions.length > 0 ? Math.max(...enabledOptions) : undefined;

  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });
  const [overflow, setOverflow] = useState({ start: false, end: false });
  const activeIndex = uniqueOptions.indexOf(value as number);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const item = itemRefs.current[activeIndex];
    if (track && item) {
      setThumb((prev) => (
        prev.left === item.offsetLeft && prev.width === item.offsetWidth
          ? prev
          : { left: item.offsetLeft, width: item.offsetWidth }
      ));
      /* 官方 `ni`：`scrollable` 时把选中项滚到轨道中央（`scrollTo({behavior:"smooth"})`）。
         `scrollTo` 在 jsdom 里不存在 ⇒ 加存在性判断（只影响测试环境，浏览器里恒有）。 */
      if (typeof track.scrollTo === 'function') {
        track.scrollTo({
          left: item.offsetLeft - track.clientWidth / 2 + item.offsetWidth / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [activeIndex]);

  useLayoutEffect(() => {
    measure();
  }, [measure, uniqueOptions]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const sync = () => setOverflow({
      start: track.scrollLeft > 1,
      end: track.scrollLeft < track.scrollWidth - track.clientWidth - 1,
    });
    sync();
    track.addEventListener('scroll', sync);
    const observer = new ResizeObserver(sync);
    observer.observe(track);
    return () => {
      track.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, [uniqueOptions]);

  /* 官方 `TF` 用 `a.useState(() => u(e))` + `a.useEffect(() => { m(u(e)) }, [u, e])` 让草稿跟随外部值；
     这里改成「草稿随 `value` 记忆」的等价写法（不在 effect 里 setState，见 eslint
     `react-hooks/set-state-in-effect`）：只要外部 `value` 变了，草稿就自动重新按 `u(value)` 求值。 */
  const [draftState, setDraftState] = useState(() => ({ value, draft: durationDraftOf(value) }));
  const draft = draftState.value === value ? draftState.draft : durationDraftOf(value);
  const setDraft = useCallback((next: string) => setDraftState({ value, draft: next }), [value]);

  /* 官方 `x`（提交：就近吸附到合法档位） */
  const commit = useCallback(() => {
    if (draft === '') {
      setDraftState({ value, draft: durationDraftOf(value) });
      onCommit?.();
      return;
    }
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) && enabledOptions.length > 0
      ? nearestOfficialDuration(parsed, enabledOptions, value ?? parsed)
      : value;
    if (next !== undefined && next !== value) onChange(next);
    setDraftState({ value: next, draft: durationDraftOf(next) });
    onCommit?.();
  }, [draft, enabledOptions, onChange, onCommit, value]);

  if (uniqueOptions.length === 0) return null;

  const maskImage = `linear-gradient(to right, ${
    overflow.start ? 'transparent, black 15%' : 'black, black 15%'
  }, ${overflow.end ? 'black 85%, transparent' : 'black 85%, black'})`;

  return (
    <div className="flex min-w-0 items-center gap-2" data-testid="duration-selector">
      <div
        ref={trackRef}
        className="relative flex bg-input/40 rounded-lg p-0.5 overflow-x-auto min-w-0 flex-1"
        style={{ scrollbarWidth: 'none', WebkitMaskImage: maskImage, maskImage }}
      >
        <div
          className="absolute top-0.5 bottom-0.5 bg-input/40 rounded-md transition-all duration-200 ease-out"
          style={{ left: thumb.left, width: thumb.width }}
        />
        {uniqueOptions.map((option, index) => {
          const isActive = option === value;
          return (
            <button
              key={option}
              ref={(el) => { itemRefs.current[index] = el; }}
              type="button"
              aria-disabled={disabled}
              disabled={disabled}
              onClick={() => { if (!disabled) onChange(option); }}
              className={`relative z-10 flex flex-1 items-center justify-center px-2 py-1.5 rounded-md text-sm transition-colors duration-200 disabled:cursor-not-allowed ${disabled ? 'opacity-50' : ''} ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              } min-w-10 whitespace-nowrap`}
            >
              {option === OFFICIAL_DURATION_AUTO ? autoLabel : `${option}s`}
            </button>
          );
        })}
      </div>
      <div className="relative w-[72px] shrink-0">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={ariaLabel}
          value={draft}
          placeholder={value === OFFICIAL_DURATION_AUTO ? autoLabel : undefined}
          min={min}
          max={max}
          step={1}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value;
            if (!OFFICIAL_DURATION_DRAFT_RE.test(raw)) return;
            setDraft(raw);
            const parsed = Number(raw);
            if (raw !== '' && Number.isInteger(parsed) && uniqueOptions.includes(parsed) && parsed !== value) {
              onChange(parsed);
            }
          }}
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
              event.currentTarget.select();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(durationDraftOf(value));
              event.currentTarget.blur();
            }
          }}
          className="h-8 w-full rounded-lg border-0 bg-input/40 py-0 pl-2 pr-6 text-center text-sm font-medium tabular-nums shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {draft !== '' && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            s
          </span>
        )}
      </div>
    </div>
  );
}

// 本地出草稿常用 480/640；更高或更特殊的长边走下面的自定义输入
const COMBO_RESOLUTIONS = [480, 640, 832, 1280];
const MIN_CUSTOM_RESOLUTION = 128;
const MAX_CUSTOM_RESOLUTION = 4096;
const COMBO_FPS_OPTIONS = [
  { value: 16, label: '16帧' },
  { value: 24, label: '24帧' },
  { value: 30, label: '30帧' },
];

/**
 * 兼容新旧节点中的模型引用：优先内部 general ID，其次 Provider 作用域下的真实模型 ID，
 * 最后才接受全局唯一的真实模型 ID，避免同名模型错误串用能力配置。
 */
// 供模型引用兼容测试复用；组件仍是本文件默认导出。
// eslint-disable-next-line react-refresh/only-export-components
export function resolveGeneralVideoModel(
  generalModels: GeneralModelConfig[] | undefined,
  selectedModel: string | undefined,
  provider: string | undefined,
): GeneralModelConfig | undefined {
  if (!generalModels?.length || !selectedModel) return undefined;
  const directId = selectedModel.replace(/^general\//, '');
  const directMatch = generalModels.find((model) => model.id === directId);
  if (directMatch) return directMatch;

  const modelIds = new Set([selectedModel]);
  if (provider && selectedModel.startsWith(`${provider}/`)) {
    modelIds.add(selectedModel.slice(provider.length + 1));
  }
  const scopedMatch = generalModels.find((model) => (
    model.providerConfigId === provider && modelIds.has(model.modelId)
  ));
  if (scopedMatch) return scopedMatch;

  const matches = generalModels.filter((model) => modelIds.has(model.modelId));
  return matches.length === 1 ? matches[0] : undefined;
}

export interface GeneralVideoControlSupport {
  resolution: boolean;
  ratio: boolean;
  duration: boolean;
  frameRate: boolean;
  audio: boolean;
}

/** 通用视频模型的参数面板只读取 capability，不再扫描传输协议 JSON 猜模型能力。 */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveGeneralVideoControlSupport(
  capability: VideoModelCapability | undefined,
): GeneralVideoControlSupport {
  return {
    resolution: Boolean(capability?.resolutions?.length || capability?.defaultResolution),
    ratio: Boolean(capability?.ratios?.length || capability?.defaultRatio),
    duration: Boolean(
      capability?.durations?.length
      || capability?.minDuration !== undefined
      || capability?.maxDuration !== undefined
      || capability?.defaultDuration !== undefined
    ),
    frameRate: Boolean(capability?.frameRates?.length || capability?.defaultFrameRate !== undefined),
    audio: capability?.supportsAudio === true,
  };
}

export interface GeneralVideoParameterDisplayState {
  resolution?: string;
  ratio?: string;
  duration?: number;
  frameRate?: number;
  generateAudio?: boolean;
}

/** 允许值不等于默认值；只有节点显式值或 capability 明确 default 才能显示为已选择。 */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveGeneralVideoParameterDisplayState(
  capability: VideoModelCapability | undefined,
  current: GeneralVideoParameterDisplayState,
): GeneralVideoParameterDisplayState {
  return {
    resolution: current.resolution ?? capability?.defaultResolution,
    ratio: current.ratio ?? capability?.defaultRatio,
    duration: current.duration ?? capability?.defaultDuration,
    frameRate: current.frameRate ?? capability?.defaultFrameRate,
    generateAudio: current.generateAudio,
  };
}

/* ══════════════════════════════════════════════════════════════════════
 * 触发 chip —— 官方 `VideoConfigsTrigger`（`Poe`，canvas @1873820 起，逐字）
 * ══════════════════════════════════════════════════════════════════════
 * 官方源码（同一段 `a.forwardRef(({…}, u) => {…})`）逐字：
 *
 * ```js
 * Poe = a.forwardRef(({ aspectRatio: e, duration: t, resolution: n, disabled: o,
 *                       generateMethodLabel: r, supportsAudio: i, generateAudio: l,
 *                       generateModeLabel: c, ...d }, u) => {
 *   const { t: p } = se();
 *   const m = !e;
 *   const f = a.useMemo(() => {
 *     const x = [];
 *     c && x.push(c);                       // 生成模式（videoConfigs.modeOptions.<mode>）
 *     r && x.push(r);                       // 生成方式（VA(model, methodKey) 经 t()）
 *     !e && !n
 *       ? x.push(p("videoConfigs.auto"))
 *       : (e ? x.push(e === "adaptive" ? p("videoConfigs.adaptive") : e) : x.push(p("videoConfigs.auto")),
 *          n ? x.push(n) : x.push(p("videoConfigs.auto")));
 *     return x.join(" · ");
 *   }, [c, r, e, n, p]);
 *   const h = t ? (t === -1 ? p("videoConfigs.durationAuto") : `${t}s`) : void 0;
 *   const g = i && l !== void 0;
 *   return s.jsxs(Wt, { ref: u, variant: "ghost", disabled: o,
 *     className: z("gap-1 hover:bg-muted active:bg-white/[0.1] px-2 py-1 text-sm rounded-lg",
 *                  "data-[state=open]:bg-white/[0.1]",
 *                  "disabled:opacity-50 disabled:pointer-events-none"),
 *     ...d,
 *     children: [
 *       !r && (m ? s.jsx(m1, { size: 16 }) : s.jsx(T0, { ratio: e, size: 16 })),
 *       s.jsxs("span", { className: "flex items-center whitespace-nowrap", children: [
 *         f,
 *         f && h && s.jsx("span", { className: "opacity-50", children: " · " }),
 *         h && s.jsx("span", { className: "inline-block min-w-[3ch] text-left tabular-nums", children: h })
 *       ]}),
 *       g && s.jsxs(s.Fragment, { children: [
 *         s.jsx("span", { className: "opacity-50", children: "·" }),
 *         s.jsx(oYe, { enabled: l, size: 16 })
 *       ]})
 *     ]});
 * });
 * ```
 *
 * **形参语义（用户点名要逐字确定的六个量）**：
 *   · `e` = `aspectRatio`  比例（`"adaptive"` 例外：改显 `videoConfigs.adaptive`）
 *   · `n` = `resolution`   清晰度
 *   · `t` = `duration`     时长（**`-1` 表示自动** ⇒ `videoConfigs.durationAuto`；`0`/空 ⇒ 整段不渲染）
 *   · `r` = `generateMethodLabel`  生成方式（官方 `VA(model, methodKey)` 出 key，再 `t()` 出文案）
 *   · `c` = `generateModeLabel`    生成模式（官方 `videoConfigs.modeOptions.<mode>`）
 *   · `i` = `supportsAudio`，`l` = `generateAudio`，`o` = `disabled`，`u` = ref
 *   ⚠️ 用户给的片段把 `c` 记成 `durationAudio` / `generateModeLabel` 混写；以产物为准：
 *      `generateModeLabel:c`、`generateMethodLabel:r`、`duration:t`、**没有** `durationAudio` 这个 prop。
 *
 * **取值门**：官方 `VideoConfigsPanel`（`Roe`）传给触发器的四个量（canvas @1875930 邻域逐字）
 *   `generateMethodLabel: _&&_.length>0 ? _.find(H=>H.key===b)?.label : void 0`
 *   `aspectRatio: t.length>0 ? e : void 0` · `duration: m&&m.length>0 ? p : void 0`
 *   `resolution: l&&l.length>0 ? i : void 0`
 *   ⇒ 模型没声明该组选项时**不传**，触发文案据此走 `videoConfigs.auto` 兜底。
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * 官方触发 chip 主文案（`Poe` 的 `f`，逐字移植；`auto`/`adaptive` 文案由调用方解析后传入）。
 *
 * @param aspectRatio 官方 `e`
 * @param resolution 官方 `n`
 * @param generateModeLabel 官方 `c`
 * @param generateMethodLabel 官方 `r`
 * @param autoLabel 官方 `t("videoConfigs.auto")`
 * @param adaptiveLabel 官方 `t("videoConfigs.adaptive")`
 */
// eslint-disable-next-line react-refresh/only-export-components
export function videoConfigsTriggerLabel(
  aspectRatio: string | undefined,
  resolution: string | undefined,
  generateModeLabel: string | undefined,
  generateMethodLabel: string | undefined,
  autoLabel: string,
  adaptiveLabel: string,
): string {
  const parts: string[] = [];
  if (generateModeLabel) parts.push(generateModeLabel);
  if (generateMethodLabel) parts.push(generateMethodLabel);
  if (!aspectRatio && !resolution) {
    parts.push(autoLabel);
  } else {
    parts.push(aspectRatio ? (aspectRatio === 'adaptive' ? adaptiveLabel : aspectRatio) : autoLabel);
    parts.push(resolution ? resolution : autoLabel);
  }
  return parts.join(' · ');
}

/**
 * 官方触发 chip 的时长后缀（`Poe` 的 `h`，逐字）：`t ? (t === -1 ? durationAuto : `${t}s`) : void 0`。
 * 注意是**真值判断** ⇒ `0` / `undefined` 都返回 `undefined`（整段不渲染）。
 */
// eslint-disable-next-line react-refresh/only-export-components
export function videoConfigsTriggerDurationLabel(
  duration: number | undefined,
  durationAutoLabel: string,
): string | undefined {
  if (!duration) return undefined;
  return duration === -1 ? durationAutoLabel : `${duration}s`;
}

/**
 * 官方触发 chip 的音频指示（`Poe` 的 `g`，逐字）：`i && l !== void 0`。
 * ⇒ `supportsAudio` 为假、或 `generateAudio` 未显式取值（三态里的「模型默认」）时**不渲染**。
 */
// eslint-disable-next-line react-refresh/only-export-components
export function videoConfigsTriggerShowsAudio(
  supportsAudio: boolean,
  generateAudio: boolean | undefined,
): boolean {
  return supportsAudio && generateAudio !== undefined;
}

/**
 * 官方 `oYe`（canvas @1872780 起，逐字移植）：触发 chip 右侧那颗**有声/无声**图标
 * （喇叭 + 两道声波 + 一条带描边动画的斜线；`enabled` 只驱动斜线的 `stroke-dashoffset`）。
 *
 * ⚠️ 官方这颗是**图标、不是文案** —— MTV 原来那句 `有声视频 / 无声视频 / 音频模型默认` 官方 0 命中，
 *    已随自造文案一并删除。
 */
export function OfficialVideoConfigsTriggerAudioIcon({
  enabled,
  className,
  size = 16,
}: {
  enabled: boolean;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={['select-none transition-all duration-300', className].filter(Boolean).join(' ')}
    >
      <path
        d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="transition-colors duration-300"
      />
      <path
        d="M15 8a5 5 0 0 1 0 8"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="transition-colors duration-300"
      />
      <path
        d="M17.7 5a9 9 0 0 1 0 14"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="transition-colors duration-300"
      />
      <line
        x1="2" y1="2" x2="22" y2="22"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        style={{ strokeDasharray: 30, strokeDashoffset: enabled ? 30 : 0, transition: 'stroke-dashoffset 300ms ease-out' }}
      />
    </svg>
  );
}

/**
 * 官方 `VA`（`videoGenerateMethodLabelKey`）返回的是 **i18n key**，官方 zh 文案逐字为：
 *   `videoConfigs.frames` = 首尾帧 · `videoConfigs.reference` = 参考 ·
 *   `videoModels.videoEdit` = 视频编辑 · `videoConfigs.referenceOmni` = 全能参考
 * MTV 的 `t()` 以**中文源串**为 key ⇒ 先落到官方 zh 再交给 `t()`（en/ja/ko 命中 MTV 既有词典则生效，
 * 缺则回落中文 —— 本仓既有约定；**不自造**其它语言译文）。
 *
 * `videoConfigs.referenceOmni`（§69 起）只在官方目录表带 `referenceLabelKey` 的 6 个模型上命中
 * （seedance-2.0 / -fast / -mini、seedance-2.5、kling-video-o1、kling-video-o3）；
 * 其余模型 `VA` 走下一档 `videoConfigs.reference`（zh「参考」）—— 与官方逐字一致。
 */
const VIDEO_GENERATE_METHOD_ZH: Readonly<Record<string, string>> = {
  'videoConfigs.frames': '首尾帧',
  'videoConfigs.reference': '参考',
  'videoModels.videoEdit': '视频编辑',
  'videoConfigs.referenceOmni': '全能参考',
};

/**
 * 官方 `videoConfigs.*` 另外几条的 **zh 原文**（canvas:`@4398800` 邻域逐字）；
 * 官方占位符 `{{count}}` 按本仓 `t()` 的 `{count}` 语法落地（**只改占位符语法，不改文案**）。
 */
const VIDEO_CONFIGS_ZH: Readonly<Record<string, string>> = {
  'videoConfigs.referenceCapabilityJoin': ' + ',
  'videoConfigs.referenceCapabilityHeader': '支持以下任一种模式：',
  'videoConfigs.referenceCapabilityImage': '最多{count}张图',
  'videoConfigs.referenceCapabilityVideo': '最多{count}个视频',
  'videoConfigs.referenceCapabilityAudio': '最多{count}段音频',
  'videoConfigs.editMethodHint': '用提示词修改内容（如替换、增删元素），画幅与时长跟随原视频（需 4-30 秒）',
};

export default function VideoParamSelector({
  provider, selectedModel,
  nodeId, videoReferences, onChangeVideoReferences,
  videoResolution, videoFps, videoFrames,
  onChangeResolution, onChangeFps,
  seedanceResolution, seedanceRatio,
  seedanceDuration, generateAudio,
  onChangeSeedanceResolution, onChangeSeedanceRatio,
  onChangeSeedanceDuration, onChangeGenerateAudio,
  showSeedanceRatio = true, showGenerateAudio = true, onContinuousEditEnd,
  generateMethod,
  availableGenerateMethods,
  onGenerateMethodChange,
  videoModelType,
  disabled = false,
  lockedParameters = [],
}: VideoParamSelectorProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // 正在展开的来源选择器：frame = 加参考帧，character = 加参考角色
  const [pickerFor, setPickerFor] = useState<VideoReferenceItem['kind'] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  /* ══ §123 官方弹层定位（Radix `PopoverContent` 的 `side/align/sideOffset`）══
     官方 `Uoe`（`VideoConfigsPanel`）逐字（canvas:@1871588 邻域）：
       `s.jsx(Ds,{side:"top",align:"start",sideOffset:8,className:"w-auto p-0 bg-transparent border-none shadow-none",children:…})`
     其中 `Ds` = `vendor-packages-CvEFn1fJ.js` 导出的 `aI`（本地名 `xt`），逐字：
       `xt=a.forwardRef(({className:e,align:t="center",sideOffset:n=4,side:s="right",container:r,...o},i)=>
          a.jsx(u5,{container:r??void 0,children:a.jsx(Y1,{ref:i,align:t,side:s,sideOffset:n,className:…})}))`
     ⇒ 官方这一处**覆盖**了默认值：`side:"top"`（向上弹）· `align:"start"`（**左边缘对齐**，不是居中）·
       `sideOffset:8`（底边 = 触发器顶边 − 8）。
     真机取证（CDP 9222 · Seedance 2.5，2026-10-15）：
       · 触发器 `[aria-haspopup="dialog"][data-state="open"]` = BUTTON 238.1×36 @(765.6, 682.6)；
       · 面板 `.w-[400px] p-1 rounded-[20px] …` = 400×390 @(765.3, 284.7)；
       · `[data-radix-popper-content-wrapper]` style.transform = `translate(765.333px, 284.667px)`；
       · 证据：`panel.left 765.3 == trigger.left 765.6`（align start ✓，若是居中应为 684.65）·
               `panel.bottom 674.7 == trigger.top 682.6 − 8`（side top + sideOffset 8 ✓）。
     ⚠️ MTV 原来**既没有 portal 也没有写 left/top**，只靠 `.img-ratio-popup` 的
        `position:fixed; left:0; top:0; transform:translateX(-50%)` ⇒ 弹层落在最近包含块的左上角
        再左移半个宽度（用户实测「飘到左边」）⇒ 这里补上真 portal + 触发器实时 rect。 */
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup) return undefined;
    const place = () => {
      const rect = trigger.getBoundingClientRect();
      popup.style.left = `${rect.left}px`;
      popup.style.top = `${rect.top - 8 - popup.offsetHeight}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(popup);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  const generalModels = useAppStore((state) => state.config.generalModels);
  const projectCharacters = useAppStore((state) => state.dramaAssets.characters);
  const globalCharacters = useAppStore((state) => state.globalCharacters);
  const loadGlobalCharacters = useAppStore((state) => state.loadGlobalCharacters);
  // 连线进来的图片节点：参考帧与参考角色都能从这里挑
  const connectedImageNodes = useAppStore(useShallow((state) => {
    if (!nodeId) return [];
    const sourceIds = new Set(state.edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source));
    return state.nodes.filter((node) => sourceIds.has(node.id) && Boolean((node.data as BaseNodeData).imageUrl));
  }));
  const canvasNodes = useAppStore((state) => state.nodes);
  const workflowApiManifest = useAppStore((state) => state.workflows.find((workflow) =>
    workflow.id === selectedModel?.replace(/^workflow-api\//, ''))?.workflowApi);

  const references = videoReferences ?? [];
  const frameReferences = references.filter((item) => item.kind === 'frame');
  const characterReferences = references.filter((item) => item.kind === 'character');

  const characterOptions = useMemo(() => {
    const merged = [...projectCharacters, ...globalCharacters.filter(
      (character) => !projectCharacters.some((item) => item.id === character.id),
    )];
    return merged.flatMap((character: DramaCharacter) => {
      const resolved = resolveDramaAssetImageRef(character, canvasNodes);
      return resolved ? [{ id: `character:${character.id}`, label: character.name, url: resolved.imageUrl }] : [];
    });
  }, [canvasNodes, globalCharacters, projectCharacters]);

  const addReference = (kind: VideoReferenceItem['kind'], option: { id: string; label: string; url: string }) => {
    setPickerFor(null);
    if (references.some((item) => item.id === option.id && item.kind === kind)) return;
    // 参考帧默认补上还空着的那一端，参考角色一律当普通参考图提交
    const role: VideoReferenceItem['role'] = kind === 'character'
      ? 'reference'
      : frameReferences.some((item) => item.role === 'first_frame') ? 'last_frame' : 'first_frame';
    onChangeVideoReferences?.([...references, {
      id: option.id,
      kind,
      role,
      url: option.url,
      label: option.label,
      sourceNodeId: option.id.startsWith('character:') ? undefined : option.id,
    }]);
  };

  const setFrameRole = (itemId: string, role: VideoReferenceItem['role']) => {
    onChangeVideoReferences?.(references.map((item) => {
      if (item.id === itemId) return { ...item, role };
      // 首帧、尾帧各自唯一
      if (item.kind === 'frame' && role !== 'reference' && item.role === role) {
        return { ...item, role: 'reference' as const };
      }
      return item;
    }));
  };

  // 关弹窗时一并收起来源选择器，下次打开从干净状态开始
  const closePopup = () => {
    setOpen(false);
    setPickerFor(null);
  };

  const removeReference = (itemId: string) => {
    onChangeVideoReferences?.(references.filter((item) => item.id !== itemId));
  };

  const generalModel = useMemo(() => {
    return resolveGeneralVideoModel(generalModels, selectedModel, provider);
  }, [generalModels, provider, selectedModel]);

  const apimartCapability = provider === 'apimart'
    ? getApimartSeedanceCapability(selectedModel)
    : undefined;
  const volcengineCapability = provider === 'volcengine'
    ? getVolcengineSeedanceCapability(selectedModel)
    : undefined;
  const dreaminaCapability = provider === 'dreamina'
    ? getDreaminaVideoCapability(selectedModel)
    : undefined;
  const generalCapability = generalModel
    ? generalModel.videoCapability
      ?? getModelProtocolPresetVideoCapability(generalModel.executionProfile)
    : undefined;
  /* §108：`generalDisplayState` 已下移到 `effectiveCapability` 之后计算
     （官方目录兜底那一档必须能提供 display 兜底，否则 chip 的清晰度/时长两段永远拿不到值）。 */
  // 原生模型和通用模型共享参数面板，但通用模型不再经过会补齐 Seedance 默认值的能力视图。
  // 这样 capability 未声明的字段会保持未指定，不会被 UI 悄悄写成 720p / 16:9 / 24fps。
  const workflowApiCapability: VideoModelCapability | undefined = provider === 'workflow-api' && workflowApiManifest?.version === 1
    ? AUTODL_H3_WORKFLOW.capability : undefined;
  /* 官方 `o.model` = 官方 `vt` 模型枚举值（= 视频目录表 `Fe` 的键，`Zs[o.model]`）。
     MTV 节点上存的是模型选择器的 value（自定义连接形如 `general/<cfgId>`）⇒ 按 MTV 既有
     `imageModelAliases` 口径取**第一个能命中官方目录**的别名；一个都命不中时与官方
     「模型不在 `Fe` 里」同解（`VA`/`EJ` 退化为下一档 / 空表）。 */
  const videoCatalogModelId = useMemo(() => {
    const aliases = imageModelAliases(selectedModel);
    return aliases.find((alias) => getParamEntry(alias)) ?? selectedModel;
  }, [selectedModel]);
  /* 官方 `LXe` @1991362 读出的 `state.modelType`（= `data.params.modelType`，`zt` 枚举串）。 */
  const catalogModelType = typeof videoModelType === 'string' ? videoModelType : undefined;

  const nativeCapability = apimartCapability ?? volcengineCapability ?? dreaminaCapability;
  const parameterCapability = nativeCapability ?? workflowApiCapability ?? generalCapability;
  /* ══ §93 官方**目录表**兜底（用户裁决「三 · 按官方」） ══
     官方底部 chip 的每一段都**直接读目录表**：
       · 选项表 `_` = `EJ(model)`（canvas:@815812）→ MTV `videoMethodKeys`
       · 比例 / 清晰度 / 时长 / 音频 = `qI(model, modelType, isPayingCustomer, …)`
         （canvas:@2250420）→ MTV `videoModelInfo`
     MTV 此前只读 native（apimart / volcengine / dreamina）/ workflow-api / general 三条能力声明，
     **没有**接官方目录表 ⇒ 走通用模型路径的内置官方模型三段全空 ⇒ chip 只剩「自适应」（用户实测）。
     ⇒ 现在把目录表接成 `parameterCapability` 的**最后一档**：
         native → workflow-api → general → **官方目录**。
       前三档任意一档有声明就不动（不覆盖更具体的声明），符合「能拿到就拿、拿不到才兜底」。
     `isPayingCustomer`：MTV 全仓无订阅体系 ⇒ 官方**非付费分支**（与 `generationChipController` 同纪律）。
     `modelType`：官方 `state.modelType` = `data.params.modelType` ⇒ 由 `videoModelType` prop 传入；
       缺省时 `resolveVariant` 返回 `undefined`，回落 `entry.variants[0]`（= 官方 `jre` 的 `?? variants[0]`）。 */
  const catalogVideoInfo = useMemo(
    () => (parameterCapability
      ? null
      : videoModelInfo(videoCatalogModelId, catalogModelType, false, {
        /* ══ §121：**必须把当前 UI 值当 `overrides` 传进去** ══
           官方 `$I(e, t, n = {}, o = true)` 的第 3 参 `n` 就是 overrides，而官方 19 条 `$expr` 里
           **多条依赖它**（`modelParamCatalog.ts` 的 `EXPR_EVALUATORS` 逐字）：
             · `e=>{const t=e.resolution;return t==="1080p"||t==="4k"?[8]:[4,6,8]}`          ← 时长档随**清晰度**变
             · `e=>e.duration===10?["768P"]:["768P","1080P"]` / `…512P…`                     ← 清晰度随**时长**变
             · `e=>e.character_orientation==="video"?[10,20,30]:[5,10]`
             · `({aspectRatio:e})=>e==="auto"?[]:["1K","2K","4K"]`                           ← 档位随**比例**变
           MTV 此前**不传** ⇒ 这些表达式一律用 `variant.defaults` 求值 ⇒
           时长档会被算成「与清晰度无关的那一支」（用户图2 官方 4–10s / MTV 4–30s 的直接来源之一）。
           `resolveExprList` 里 `ctx = {...variant.defaults, ...filtered(overrides)}` ⇒ 传了就覆盖默认值 ✓ */
        resolution: seedanceResolution,
        duration: seedanceDuration,
        aspectRatio: seedanceRatio,
        generateAudio,
      })),
    [parameterCapability, videoCatalogModelId, catalogModelType, seedanceResolution, seedanceDuration, seedanceRatio, generateAudio],
  );
  const catalogCapability: VideoModelCapability | undefined = useMemo(() => (
    catalogVideoInfo
      ? {
        resolutions: catalogVideoInfo.resolutions,
        defaultResolution: catalogVideoInfo.defaultResolution,
        ratios: catalogVideoInfo.aspectRatios,
        defaultRatio: catalogVideoInfo.defaultAspectRatio,
        durations: catalogVideoInfo.durations,
        defaultDuration: catalogVideoInfo.defaultDuration,
        supportsAudio: catalogVideoInfo.supportsGenerateAudio,
      }
      : undefined
  ), [catalogVideoInfo]);
  /** 参数控件实际读的那一份（官方目录兜底后的结果）。 */
  const effectiveCapability = parameterCapability ?? catalogCapability;
  /* 类型收窄视图（仅本组件内部使用）：`apimart / volcengine / dreamina` 的能力对象是
     `VideoModelCapability` 的**结构超集**（只差 `operations` 的 readonly 修饰），
     而本组件读的字段全部落在公共子集里 ⇒ 统一按 `VideoModelCapability` 读。 */
  const effectiveCapabilityView = effectiveCapability as VideoModelCapability | undefined;
  /* ══ §108 修复：**控件门与显示态兜底都必须读 `effectiveCapability`** ══
     官方 `VideoConfigsPanel`（`Roe`）传给 chip 触发器的四个量，门只判「该模型的选项表非空」：
       `aspectRatio: t.length>0 ? e : void 0` · `resolution: l&&l.length>0 ? i : void 0`
       `duration: m&&m.length>0 ? p : void 0`
     ⇒ 官方**不区分**这份选项表来自「能力声明」还是「目录表」。
     MTV 上一版只把目录表接进了 `effectiveCapability`，却仍用**旧的 `generalCapability`**
       去算 `generalControlSupport` 与 `generalDisplayState` ✗
     ⇒ 走通用模型路径、且该模型在 `config.generalModels` 里**没写 `videoCapability`/`executionProfile`**
       时，`generalCapability` = `undefined` ⇒ 三个门全假、display 三值全 `undefined`
       ⇒ chip 只剩一个 `自适应`（用户实测：`Grok Imagine 1.5 ｜ 自适应`）。
     真机依据（CDP 9333，`node-tdo8iqaq2`，2026-10-15）：
       provider=`general` · selectedModel=`general/provider-custom-2611fc0a-e3ga3u`；
       IndexedDB `ai-canvas-db/config` 该条只有 `{id,name,modelId,category,providerConfigId}`
       ⇒ `videoCapability`/`executionProfile` 均缺省 ⇒ `generalCapability`=undefined；
       而官方目录 `videoModelInfo('grok-imagine-video-1.5')` 有
       `resolutions:['480p','720p','1080p']` · `defaultResolution:'720p'` · `durations:[1..15]` · `defaultDuration:5`。
     官方原文：`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1966989 起
       `F=a.useMemo(()=>[{node:s.jsx(Yv,{size:20}),…key:"saveToLibrary"…}]` … 与 chip 侧
       `Poe` 的 `f = [c, r, e?, n?] .join(" · ")`（本文件 206-264 行记账）——**没有任何一条按
       「能力来源」分支**。⇒ 这里同样不再分支。 */
  const generalControlSupport = resolveGeneralVideoControlSupport(effectiveCapabilityView);
  const generalDisplayState = resolveGeneralVideoParameterDisplayState(effectiveCapabilityView, {
    resolution: seedanceResolution,
    ratio: seedanceRatio,
    duration: seedanceDuration,
    frameRate: videoFps,
    generateAudio,
  });
  const isNativeSeedance = provider === 'volcengine' || provider === 'dreamina' || Boolean(apimartCapability || workflowApiCapability);
  // 本地工作流（ComfyUI / RunningHub）才按像素分辨率 + 帧率走；
  // 其余接口模型使用按秒表达的 API 布局；具体控件仍只由 capability 决定。
  const isWorkflowProvider = provider === 'comfyui' || provider === 'runninghub' || !provider;
  const usesDurationControls = isNativeSeedance || !isWorkflowProvider;
  const legacyVideoResolution = videoResolution ?? 832;
  const legacyVideoFps = videoFps ?? 24;
  const legacySeedanceRatio = seedanceRatio ?? '16:9';
  // 非 Seedance（ComfyUI / RunningHub / 自建模型）：比例换算成 width/height 后注入请求
  const genericRatios = VIDEO_ASPECT_RATIOS.map((value) => ({ value, label: value }));
  const showGenericRatio = showSeedanceRatio;
  const genericRatio = genericRatios.some((item) => item.value === legacySeedanceRatio)
    ? legacySeedanceRatio
    : VIDEO_ASPECT_RATIOS[0];
  const declaredResolutions = effectiveCapability?.resolutions?.length
    ? effectiveCapability.resolutions
    : effectiveCapability?.defaultResolution
      ? [effectiveCapability.defaultResolution]
      : undefined;
  const declaredRatios = effectiveCapability?.ratios?.length
    ? effectiveCapability.ratios
    : effectiveCapability?.defaultRatio
      ? [effectiveCapability.defaultRatio]
      : undefined;
  /* §121：**官方目录一旦成为事实来源，就不许再退回 MTV 的硬编码档位表**。
     官方 `Eoe` 每组都是「有档位 ⇒ `ti`；**没档位 ⇒ 静态「自适应」块**」（@1870648 / @1871200 / @1871960 区），
     **绝不会凭空补出一张 `SEEDANCE_RATIOS` / `SEEDANCE_RESOLUTIONS` 表**。
     MTV 原来是 `declaredRatios ? … : (… ? SEEDANCE_RATIOS : genericRatios)` ⇒ 目录里没有 `aspectRatios`
     的模型（如 `grok-imagine-video-1.5`）会被塞进 7 个 MTV 自造的比例格（用户图1 那行错乱的直接来源之一）。
     用户 2026-10-15 硬要求：「不得为了让面板好看而给没有数据的模型补默认选项格；缺数据一律不渲染」。 */
  const catalogIsSource = !parameterCapability && Boolean(catalogVideoInfo);
  const seedanceResolutions = declaredResolutions
    ? declaredResolutions.map((value) => ({ value, label: value === '4k' ? '4K' : value }))
    : catalogIsSource || generalModel ? [] : SEEDANCE_RESOLUTIONS;
  const seedanceRatiosRaw = declaredRatios
    ? declaredRatios.map((value) => ({ value, label: value }))
    : catalogIsSource
      ? []
      : isNativeSeedance || !isWorkflowProvider
        ? generalModel ? [] : SEEDANCE_RATIOS
        : genericRatios;
  /* §126 官方「比例」组**恒渲染，但控件类型看 `t.length>0`**（`Uoe` @1873756 逐字）：
       `t.length>0 ? s.jsx(ni,{options:t,…}) : s.jx("div",{className:"flex bg-input/40 rounded-lg p-0.5",…静态「自适应」块})`
     `t` = `availableRatios`（= 官方 `qI(model, modelType, …)` 的 `aspectRatios`）。
     **`视频编辑` 的 variant 里没有 `aspectRatios`**（r127 edit 项 `aspectRatioPolicy:"forbidden"`、`options` 只有
     `{resolutions,supportsAudio,omniReference,timesOptions}` —— `vendor-packages-CvEFn1fJ.js` @1130400 区逐字）
     ⇒ 官方在视频编辑下渲染的是**静态「自适应」块（body 高 36 ⇒ 该组 74）**，不是 7 格栅格（body 48 ⇒ 该组 86）。
     ⚠️ 这一档**直接决定面板高度**：官方 首尾帧/全能参考 = 74+86+74+74+74+8 = **390**；
        视频编辑 = 74+74+74+74+74+8 = **378**（用户「视频编辑的面板尺寸与首尾帧不一样」的另一半原因）。
     ⇒ 只要目录里当前 variant 明确没有 `aspectRatios`，就**不许**再回退 MTV 的硬编码 `SEEDANCE_RATIOS`。 */
  const officialVariantHasNoRatios = Boolean(catalogVideoInfo)
    && !(catalogVideoInfo?.aspectRatios?.length);
  const seedanceRatios = officialVariantHasNoRatios ? [] : seedanceRatiosRaw;
  // 参考素材上限只能读模型真正声明的值，不能用 UI 兼容默认值充当模型约束。
  const referenceLimits = apimartCapability
    ?? volcengineCapability
    ?? dreaminaCapability
    ?? workflowApiCapability
    ?? generalCapability;
  const describeLimit = (max: number | undefined, unit: string, kind: string) => {
    if (max === undefined) return '';
    return max === 0 ? `不支持${kind}` : `最多 ${max} ${unit}${kind}`;
  };
  const referenceLimitTip = referenceLimits
    ? [
      describeLimit(referenceLimits.maxImageReferences, '张', '参考图'),
      describeLimit(referenceLimits.maxVideoReferences, '个', '参考视频'),
      describeLimit(referenceLimits.maxAudioReferences, '个', '参考音频'),
    ].filter(Boolean).join('、')
    : '';
  const durationCandidates = [
    ...(effectiveCapability?.durations ?? []),
    ...(effectiveCapability?.defaultDuration === undefined ? [] : [effectiveCapability.defaultDuration]),
  ];
  const minDuration = effectiveCapability?.minDuration
    ?? (durationCandidates.length ? Math.min(...durationCandidates) : VIDEO_DURATION_MIN_SECONDS);
  const maxDuration = effectiveCapability?.maxDuration
    ?? (durationCandidates.length ? Math.max(...durationCandidates) : VIDEO_DURATION_MAX_SECONDS);
  // 文档写「仅支持 10 或 15 秒」这类离散取值时，只给这几档，不能用连续滑杆
  const allowedDurations = effectiveCapability?.durations?.length
    ? [...effectiveCapability.durations].sort((left, right) => left - right)
    : undefined;
  const capabilityDurationDefault = effectiveCapability?.defaultDuration;
  const useUnboundedDurationInput = Boolean(
    generalModel
    && !allowedDurations
    && (generalCapability?.minDuration === undefined || generalCapability?.maxDuration === undefined),
  );
  /* §124 官方 `videoConfigs.duration` 组的 `tooltip` 只在**多镜头模式**下才传
     （`VideoGenerationControls` 逐字：`durationTooltip: $e ? D("videoConfigs.multiShotDurationTooltip") : void 0`），
     普通模式下**没有** tooltip ⇒ 官方真机该标题 `titleSvg = none`。
     MTV 没有多镜头流程 ⇒ 这一段自造提示文案连同标题上那颗 `!` 一并删除（取值仍逐字保留在上方注释里备查）：
       仅支持 4 / 6 / 8 / 10 秒。使用参考视频时，此时长设置不生效，由模型决定输出时长。
       该模型仅支持 {allowedDurations} 秒。
       整数秒，范围 {minDuration}-{maxDuration}。值越大视频越长、耗时越高。 */
  const requestedDuration = seedanceDuration
    ?? (generalModel ? generalDisplayState.duration : capabilityDurationDefault)
    ?? (generalModel
      ? undefined
      // 缺少帧数时与提交层共用默认秒数，不能用临时的 77 帧显示成 3 秒。
      : resolveVideoDurationSeconds(undefined, videoFrames, legacyVideoFps, maxDuration));
  const displayedDuration = generalModel || requestedDuration === undefined
    ? requestedDuration
    : allowedDurations
      ? allowedDurations.reduce((best, value) => (
        Math.abs(value - requestedDuration) < Math.abs(best - requestedDuration) ? value : best
      ), allowedDurations[0])
      : Math.min(maxDuration, Math.max(minDuration, requestedDuration));
  const durationControlValue = displayedDuration === undefined
    ? allowedDurations?.[0] ?? minDuration
    : Math.min(maxDuration, Math.max(minDuration, displayedDuration));
  const displayedResolution = generalModel
    ? generalDisplayState.resolution
    : seedanceResolution && seedanceResolutions.some((item) => item.value === seedanceResolution)
      ? seedanceResolution
      : effectiveCapability?.defaultResolution ?? seedanceResolutions[0]?.value ?? '720p';
  const displayedRatio = generalModel
    ? generalDisplayState.ratio
    : seedanceRatio && seedanceRatios.some((item) => item.value === seedanceRatio)
      ? seedanceRatio
      : effectiveCapability?.defaultRatio ?? seedanceRatios[0]?.value ?? '16:9';
  const configuredFrameRates = generalCapability?.frameRates?.length
    ? [...generalCapability.frameRates].sort((left, right) => left - right)
    : generalCapability?.defaultFrameRate === undefined
      ? undefined
      : [generalCapability.defaultFrameRate];
  const displayedFrameRate = generalDisplayState.frameRate;
  // 标签按跨度等距抽样，保证数字之间有足够间距不重叠：
  // 跨度 ≤8（如 4~12）每秒都标；≤16（如 4~15/4~20）每 2s 标一个；
  // 更大（如 2.5 的 4~30）每 4s 标一个。端点 min/max 始终标。
  const durationSpan = Math.max(1, maxDuration - minDuration);
  const labelStep = durationSpan <= 8 ? 1 : durationSpan <= 16 ? 2 : 4;
  const durationLabelValues = new Set<number>();
  for (let v = minDuration; v <= maxDuration; v += labelStep) {
    durationLabelValues.add(v);
  }
  durationLabelValues.add(maxDuration);
  // 每一秒都保留一个等宽刻度槽，只隐藏中间文字；位置因此和原生 range 的步进严格一致。
  const durationTicks = Array.from(
    { length: Math.max(1, maxDuration - minDuration + 1) },
    (_, index) => minDuration + index,
  );
  const showResolutionControl = isNativeSeedance || generalControlSupport.resolution;
  const showRatioControl = showSeedanceRatio && (isNativeSeedance || generalControlSupport.ratio);
  // 自定义 API 只有 capability 声明了时长语义才显示；内置 API 保留原有时长控件。
  const showDurationControl = apimartCapability?.durationMode === 'automatic'
    ? false
    : generalModel ? generalControlSupport.duration : true;
  const showFrameRateControl = Boolean(generalModel && generalControlSupport.frameRate);
  const supportsAudio = isNativeSeedance
    ? Boolean(nativeCapability?.audioField)
    /* §93：官方目录兜底那一档也要把 `supportsAudio` 带出来（`videoModelInfo` 的
       `supportsGenerateAudio` = 官方 `!!defaults.generateAudio`）。已有能力声明的不动。 */
    : (generalControlSupport.audio || catalogCapability?.supportsAudio === true);
  /* §121：音频开关改成官方的 `开启/关闭` 分段后，不再需要「显示用的默认值」
     （官方 `ti value={C?"on":"off"}` 直接读 `generateAudio`，没有默认态）⇒ 该派生量已删。 */

  useEffect(() => {
    if (!parameterCapability) return;
    if (displayedResolution !== undefined
      && (isNativeSeedance || generalCapability?.defaultResolution !== undefined)
      && displayedResolution !== seedanceResolution) {
      onChangeSeedanceResolution?.(displayedResolution);
    }
    if (displayedRatio !== undefined
      && (isNativeSeedance || generalCapability?.defaultRatio !== undefined)
      && displayedRatio !== seedanceRatio) {
      onChangeSeedanceRatio?.(displayedRatio);
    }
    if (displayedDuration !== undefined
      && (isNativeSeedance || generalCapability?.defaultDuration !== undefined)
      && displayedDuration !== seedanceDuration) {
      onChangeSeedanceDuration?.(displayedDuration);
    }
    if (displayedFrameRate !== undefined
      && showFrameRateControl
      && generalCapability?.defaultFrameRate !== undefined
      && displayedFrameRate !== videoFps) {
      onChangeFps?.(displayedFrameRate);
    }
  }, [
    parameterCapability,
    displayedDuration,
    displayedRatio,
    displayedResolution,
    displayedFrameRate,
    generalCapability?.defaultDuration,
    generalCapability?.defaultFrameRate,
    generalCapability?.defaultRatio,
    generalCapability?.defaultResolution,
    isNativeSeedance,
    onChangeSeedanceDuration,
    onChangeSeedanceRatio,
    onChangeSeedanceResolution,
    onChangeFps,
    seedanceDuration,
    seedanceRatio,
    seedanceResolution,
    showFrameRateControl,
    videoFps,
  ]);

  // 角色库是懒加载的，打开来源选择器时补一次全局角色
  useEffect(() => {
    if (pickerFor === 'character' && globalCharacters.length === 0) void loadGlobalCharacters();
  }, [globalCharacters.length, loadGlobalCharacters, pickerFor]);

  // Close popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-ui-select-portal]')) return;
      /* §123：弹层已 portal 到 `<body>` ⇒ 它**不在** `ref.current` 里，
         必须把 popup 自己的子树也算作「内部」（否则点面板任意一处都会把它关掉）。 */
      if (popupRef.current?.contains(e.target as Node)) return;
      if (ref.current && !ref.current.contains(e.target as Node)) closePopup();
    };
    if (open) document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  // Close popup on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopup();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  /* ── 触发 chip 文案：官方 `VideoConfigsTrigger`（`Poe`，逐字实现见文件上部注释） ──
     全部自造文案（`模型默认参数` / `时长模型默认` / `比例模型默认` / `分辨率模型默认` /
     `帧率模型默认` / `音频模型默认` / `有声视频` / `无声视频`）在官方产物里 **0 命中**
     ⇒ 一并删除，改走官方口径。 */

  // 官方 `t("videoConfigs.auto")` zh「自适应」/ `t("videoConfigs.adaptive")` zh「自适应」
  //（官方这两条 zh 文案**逐字相同**，en 分别是 Auto / Adaptive）。
  const autoTriggerLabel = t('自适应');

  /* 官方 `o.model` = 官方 `vt` 模型枚举值（= 视频目录表 `Fe` 的键，`Zs[o.model]`）。
     MTV 节点上存的是模型选择器的 value（自定义连接形如 `general/<cfgId>`）⇒ 按 MTV 既有
     `imageModelAliases` 口径取**第一个能命中官方目录**的别名；一个都命不中时与官方
     「模型不在 `Fe` 里」同解（`VA`/`EJ` 退化为下一档 / 空表）。 */
  /*（`videoCatalogModelId` 已上提到能力解析之前 —— 官方目录兜底要用它。）*/

  /* ── 官方「生成方式」选项表（`Roe` 的 `ln`，canvas:@2057880 邻域逐字） ──
   * ```js
   * ln = a.useMemo(() => Ye.map(He => {
   *   let Bt;
   *   if (He === Hu.REFERENCE) {
   *     const dn = lDe(o.model), wn = O("videoConfigs.referenceCapabilityJoin"),
   *           so = kn => { const cs = [];
   *             kn.imageMax > 0 && cs.push(O("videoConfigs.referenceCapabilityImage", { count: kn.imageMax }));
   *             kn.videoMax > 0 && cs.push(O("videoConfigs.referenceCapabilityVideo", { count: kn.videoMax }));
   *             kn.audioMax > 0 && cs.push(O("videoConfigs.referenceCapabilityAudio", { count: kn.audioMax }));
   *             return cs.join(wn) };
   *     if (dn.length === 1) Bt = so(dn[0]);
   *     else if (dn.length > 1) {
   *       const kn = dn.map(cs => `• ${so(cs)}`);
   *       Bt = `${O("videoConfigs.referenceCapabilityHeader")}\n${kn.join("\n")}` } }
   *   He === Hu.EDIT && (o.model === vt.SEEDANCE_2_5 || o.model === vt.SEEDANCE_2_5_DRAFT)
   *     && (Bt = O("videoConfigs.editMethodHint"));
   *   return { key: He, label: O(VA(o.model, He)), hint: Bt };
   * }), [Ye, o.model, O]);
   * ```
   * 官方 zh 文案（canvas:@4398800 邻域逐字）：
   *   `referenceCapabilityJoin` " + " · `referenceCapabilityHeader` "支持以下任一种模式：" ·
   *   `referenceCapabilityImage` "最多{{count}}张图" · `referenceCapabilityVideo` "最多{{count}}个视频" ·
   *   `referenceCapabilityAudio` "最多{{count}}段音频" ·
   *   `editMethodHint` "用提示词描述修改内容（如替换、增删元素），画幅与时长跟随原视频（需 4-30 秒）"。
   * MTV 的 `t()` 用 `{count}` 占位符 ⇒ 官方 `{{count}}` 按**本仓既有约定**降为 `{count}`
   * （仅占位符语法，文案本身逐字不动）。 */
  const generateMethodOptions = useMemo(() => {
    /* 官方 `O("videoConfigs.x")` 的等价：官方 i18n key → 官方 zh 原文 → MTV `t()`。 */
    const tv = (key: string, vars?: Record<string, string | number>) => t(VIDEO_CONFIGS_ZH[key] ?? key, vars);
    return (availableGenerateMethods ?? []).map((key) => {
      let hint: string | undefined;
      if (key === 'reference') {
        const summaries = videoReferenceCapabilitySummaries(videoCatalogModelId);
        const join = tv('videoConfigs.referenceCapabilityJoin');
        const describe = (item: VideoReferenceCapabilitySummary) => {
          const parts: string[] = [];
          if (item.imageMax > 0) parts.push(tv('videoConfigs.referenceCapabilityImage', { count: item.imageMax }));
          if (item.videoMax > 0) parts.push(tv('videoConfigs.referenceCapabilityVideo', { count: item.videoMax }));
          if (item.audioMax > 0) parts.push(tv('videoConfigs.referenceCapabilityAudio', { count: item.audioMax }));
          return parts.join(join);
        };
        if (summaries.length === 1) {
          hint = describe(summaries[0]);
        } else if (summaries.length > 1) {
          const lines = summaries.map((item) => `• ${describe(item)}`);
          hint = `${tv('videoConfigs.referenceCapabilityHeader')}\n${lines.join('\n')}`;
        }
      }
      /* §132 官方 @2053400 区逐字：
           `He===Gu.EDIT && (o.model===vt.SEEDANCE_2_5 || o.model===vt.SEEDANCE_2_5_DRAFT) && (Bt=O("videoConfigs.editMethodHint"))`
         ⚠️ `o.model` 是**官方目录模型 id**（`vt` 枚举值 / 目录表 `Zs` 的键）。
            MTV 原来的判断用的是 `selectedModel`（= 节点上的模型选择器 value，自定义连接形如
            `general/<cfgId>`）⇒ **永远不等于 `'seedance-2.5'`** ⇒ 这一项的 ⓘ 与 tooltip 从不渲染
            （用户 2026-10-15：「视频编辑的 提示没有了」）。改用同文件既有的**别名解析结果** `videoCatalogModelId`
            （= `imageModelAliases(selectedModel)` 里第一个能命中官方目录的值，与 `_`/`o.model` 同源）。 */
      if (
        key === 'edit'
        && (videoCatalogModelId === 'seedance-2.5' || videoCatalogModelId === 'seedance-2.5-draft')
      ) {
        hint = tv('videoConfigs.editMethodHint');
      }
      const label = VIDEO_GENERATE_METHOD_ZH[videoGenerateMethodLabelKey(videoCatalogModelId, key)];
      return { key, label: label ? t(label) : key, hint };
    });
  }, [availableGenerateMethods, t, videoCatalogModelId]);

  // 官方 `r` = `_.find(H=>H.key===b)?.label`（`Roe` canvas:@1875919 逐字）：
  //   `generateMethodLabel: _&&_.length>0 ? _.find(H=>H.key===b)?.label : void 0`
  //   ⇒ 选项表为空、或找不到当前 key 时**不 push 这一段**（官方 `Poe` `r&&x.push(r)`）。
  const generateMethodLabel = (availableGenerateMethods?.length ?? 0) > 0
    ? generateMethodOptions.find((option) => option.key === generateMethod)?.label
    : undefined;

  // 官方 `Roe` 的取值门（@1875930 邻域逐字）：模型没声明该组选项 ⇒ 不传该量。
  const triggerAspectRatio = usesDurationControls
    ? (showRatioControl && seedanceRatios.length > 0 ? displayedRatio : undefined)
    : (showGenericRatio ? genericRatio : undefined);
  // 本地工作流（ComfyUI / RunningHub）的「分辨率」是像素长边 ⇒ 官方 chip 的清晰度位按该值显示
  //（官方只给 `l&&l.length>0 ? i : void 0` 这道门，值的形态由模型决定）。
  const triggerResolution: string | undefined = usesDurationControls
    ? (showResolutionControl && seedanceResolutions.length > 0 ? displayedResolution : undefined)
    : String(legacyVideoResolution);
  const triggerDuration = (!usesDurationControls || showDurationControl) ? displayedDuration : undefined;
  const triggerDurationLabel = videoConfigsTriggerDurationLabel(triggerDuration, t('自动'));
  const triggerLabel = videoConfigsTriggerLabel(
    triggerAspectRatio,
    triggerResolution,
    undefined /* 官方 `generateModeLabel`：MTV 画布视频节点没有「生成模式」字段 */,
    generateMethodLabel,
    autoTriggerLabel,
    autoTriggerLabel,
  );
  const triggerShowsAudio = videoConfigsTriggerShowsAudio(supportsAudio, generateAudio);
  /* ══ §123 面板宽度两档：官方 `${U?"w-[400px]":"w-[320px]"}`，`U = D && durationControl==="slider"` ══
     官方调用点逐字（canvas:@2071153 区）：
       `durationControl: o.model===vt.SEEDANCE_2_5||o.model===vt.SEEDANCE_2_5_DRAFT||o.model===vt.WAN_3_0
          ? "slider" : "options"`
     ⚠️ **别再把这个 `"slider"` 读成「滑杆」**：官方 `Uoe` 里 `U` 只决定
        「渲染官方 `TF`（药丸 + 数字输入框）」以及「面板宽 400」两件事（`D?U?<TF/>:<ni/>:<静态auto块>`）。
        真机取证见 `OfficialVideoDurationSelector` 的注释（Seedance 2.5 = 400px · `[data-testid="duration-selector"]`）。
     `wan3.0` 在目录里的 id 是 `wan3.0-video`（`src/data/model-param-catalog.json`）⇒ 两个写法都收。
     ⚠️ 后半段 `(!allowedDurations && !useUnboundedDurationInput)` 是 **MTV 独有兜底**（官方在 `D` 为假时渲染
        静态「自适应」块，没有可输入的时长控件）—— 登记保留，避免自定义模型彻底失去时长输入。 */
  const OFFICIAL_SLIDER_DURATION_MODELS: readonly string[] = ['seedance-2.5', 'seedance-2.5-draft', 'wan3.0', 'wan3.0-video'];
  /* §126 面板宽度两档的**官方判定**（`Uoe` @1871830 邻域逐字）：
       `U = D && y==="slider"` ⇒ 宽度 `${U?"w-[400px]":"w-[320px]"}`。
       即：**必须「有时长档位」（`D` 真）且模型在白名单里**才 400px；
       `视频编辑`（`D` 假，没有 durations）⇒ **320px**（用户实测：MTV 的「视频编辑」尺寸与首尾帧/全能参考不同，
       官方同样不同 —— 差的就是这一档宽度）。
     ⚠️ MTV 改前把 MTV 自有的兜底 `(!allowedDurations && !useUnboundedDurationInput)` 也算进 400px 档
       ⇒ 视频编辑被误判成 400px。现按官方收紧。 */
  const panelUsesSlider = showDurationControl
    && Boolean(allowedDurations)
    && OFFICIAL_SLIDER_DURATION_MODELS.includes(videoCatalogModelId ?? '');
  /* §126 官方时长段的 `D` 门该走哪一支 —— 官方 `Uoe` 逐字（`vendor-pkg-canvas-Dp0xADoD.js` @1874900）：
       `D = p && m && m.length>0 && f`（`m` = 当前 variant 的 `options.durations`）·
       `D ? (U ? <TF/> : <ni/>) : <静态「自适应」块，Tpe 图标 size14>`
     **「视频编辑」（`modelType:"video_edit"`）的 variant 在官方目录里没有 `durations`**
     —— r127 `_1.variants` 的 edit 项逐字：
       `{key:"edit",modelType:zt.VIDEO_EDIT,aspectRatioPolicy:"forbidden",referenceImageRange:{min:0,max:30},
         referenceVideoRange:{min:1,max:1},referenceAudioRange:{min:0,max:10},
         referenceVideoDurationRange:{min:4,max:30,maxTolerance:A3},
         options:{resolutions:so,supportsAudio:!0,omniReference:!0,timesOptions:[1,2]},
         defaults:{aspectRatio:"adaptive",duration:-1,resolution:"720p",generateAudio:!0}}`
       （`vendor-packages-CvEFn1fJ.js` @1130400 区）—— **`options` 里没有 `durations`**。
     ⇒ `m` 为空 ⇒ `D` 为假 ⇒ 官方**一定**渲染静态「自适应」块（用户图3 的整行块）。
     ⚠️ MTV 改前落到 `useUnboundedDurationInput` 分支 ⇒ 渲染出一个只显示数字的输入框（用户图2）。
     ⇒ 只要该模型在官方目录里有 variants（= 官方模型），`D` 为假就走静态块；MTV 自有的「无档位输入」
        只留给目录里没有的模型（登记在案）。 */
  const durationFollowsOfficialCatalog = Boolean(getParamEntry(videoCatalogModelId)?.variants?.length);

  return (
    <div className="ui-schema-renderer" data-ui-schema-placement="videoParams" ref={ref}>
      <div className="ui-schema-quality-ratio-pill">
        <AnimatedButton
          ref={triggerRef}
          type="button"
          className="img-pill-btn ui-schema-menu-trigger"
          /* 官方那颗 chip 的 `aria-haspopup`/`aria-expanded` 来自 Radix `PopoverTrigger`
             （`vendor-libs-BqrVOBEZ.js`@4113439 逐字：`"aria-haspopup":"dialog","aria-expanded":r.open`），
             对应官方 `Roe` 里的 `<Popover><PopoverTrigger asChild><Poe/></PopoverTrigger>…`；
             Radix `PopoverContent` 自己带 `role:"dialog"`（同文件 @4113990 逐字）
             ⇒ 官方弹层语义**确实是 dialog**，MTV 的 `.img-ratio-popup` 补上同一对属性。 */
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(e) => { e.stopPropagation(); if (open) closePopup(); else setOpen(true); }}
        >
          {/* §124 删除 MTV 自造的前导「电影机」svg（12×12：`polygon 23 7 16 12 23 17` + `rect 1 5 15 14`）。
              官方 `Poe` @1869600 邻域逐字：`!r&&(m?s.jsx(u1,{size:16}):s.jsx(E0,{ratio:e,size:16}))`
              —— 官方**只在没有生成方式文案时**才画那颗 `u1`（lucide `fullscreen`，16px）或 `E0`（比例框，16px），
              且**从来不是电影机图标**。真机 9222 实测：该 chip 首个子节点就是 SPAN（无 svg）。
              ⇒ 已按官方换成 `!triggerLabel && (ratio ? <E0/> : <u1/>)`（见下方 JSX）。 */}
          <span className="ui-schema-pill-label ui-schema-quality-ratio-label flex items-center whitespace-nowrap">
            {/* 官方 `Poe` 的**前导图标**（`@1869600` 邻域逐字）：`!r&&(m?s.jsx(u1,{size:16}):s.jsx(E0,{ratio:e,size:16}))`
                ⇒ **只有 `generateMethodLabel`（`r`）为空时**才渲染；有生成方式文案时官方**不画**任何前导图标
                  （真机 9222：底栏 chip 首个子节点就是一个 SPAN，没有 svg）。
                ⚠️ MTV 原来在这里硬挂了一颗电影机 svg（12×12，自造）⇒ 用户图2 多出来的那个图标。
                §124：按官方条件渲染 —— `!triggerLabel && (aspectRatio ? <E0/> : <u1/>)`。 */}
            {!generateMethodLabel && (
              triggerAspectRatio
                ? <OfficialVideoRatioIcon ratio={triggerAspectRatio} size={16} />
                : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-fullscreen" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><rect width="10" height="8" x="7" y="8" rx="1" /></svg>
            )}
            {triggerLabel}
            {/* §124 官方 `Poe` 逐字：`f && h && s.jsx("span",{className:"opacity-50",children:" · "})`
                —— 分隔符是 **` · `（前后各一个半角空格）**。
                ⚠️ 真机 9333 实测：MTV 这颗 span 的 `getBoundingClientRect().width = 4`（只剩 `·`），
                   官方 9222 同位置 = **11.9**（两个空格各 ≈3.9px + `·` 4px）；MTV 因此渲染成 `720p·19s`。
                   MTV 的 `textContent` 字符码是 `[32,183,32]`（与官方逐字相同）⇒ 丢的是**布局期的空格**，
                   不是文案。这里补 Tailwind `shrink-0`（官方没有这个工具类、但官方那份布局里该 span
                   不会被压缩）以复现官方实测宽度；取值本身仍逐字来自官方。 */}
            {triggerLabel && triggerDurationLabel && <span className="opacity-50 shrink-0 whitespace-pre"> · </span>}
            {triggerDurationLabel && (
              <span className="inline-block min-w-[3ch] text-left tabular-nums">{triggerDurationLabel}</span>
            )}
            {triggerShowsAudio && (
              <>
                <span className="opacity-50">·</span>
                <OfficialVideoConfigsTriggerAudioIcon enabled={generateAudio === true} />
              </>
            )}
          </span>
        </AnimatedButton>

        {open && createPortal(
          <div
            ref={popupRef}
            /* `img-ratio-popup--start` = 这一处弹层的对齐方式（官方 `align:"start"`），
               见 `quality-ratio.css` 里对该修饰类的说明：**去掉 `translateX(-50%)`**。 */
            className="img-ratio-popup img-ratio-popup--start ui-schema-popup ui-schema-video-params-popup"
            /* §127 **关掉 MTV 自有的浮层滚动条**（用户：「生成时长 显示有一个滑条 官方 我看了一下 没有」）。
               MTV 的 `OverlayScrollbarLayer`（`src/components/shared/OverlayScrollbarLayer.tsx`）会自动发现
               页面里所有可滚动元素并画一条浮层轨道；它的排除名单逐字（@22 行）：
                 `const DISCOVERY_EXCLUSION_SELECTOR = '[data-overlay-scrollbar="off"], .react-flow__node';`
               ⇒ 弹层里那条横向粗线 = `overlay-scrollbar-thumb overlay-scrollbar-thumb--horizontal`
                 （挂在本弹层的 `overlay-scrollbar-layer` 上，MTV 真机快照里它是 panel 的第 6 个直属子节点，
                   官方面板的直属子节点**恰好是 5 个组、没有任何滚动条层**）。
               官方弹层**没有**任何浮层滚动条（官方 `TF` 的横向滚动是原生 `overflow-x-auto` + mask，见
               `OfficialVideoDurationSelector` 注释）⇒ 这里把本弹层加入排除名单。 */
            data-overlay-scrollbar="off"
            /* ══ §115 面板外层：**MTV 已经逐值实现官方那串 Tailwind**（在 `src/styles/quality-ratio.css:49-83`），
                所以这里**不加** Tailwind 副本，避免两处定义打架。逐项对照（官方 = r100 @1868800 区内层 div 类串）：
                  · `${U?"w-[400px]":"w-[320px]"}`  ⇒ MTV `width: 320px`（**400 那一档见下方 `data-video-params-slider`**）
                  · `p-1`                            ⇒ MTV `padding: 4px`
                  · `rounded-[20px]`                 ⇒ MTV `border-radius: 20px`
                  · `[background:rgba(51,51,51,0.80)]`⇒ MTV `background: rgba(51,51,51,0.8)`
                  · `[backdrop-filter:blur(28px)]`   ⇒ MTV `backdrop-filter: blur(28px)`（含 `-webkit-` 前缀）
                  · `shadow-[0px_4px_16px_rgba(0,0,0,0.16),inset_0px_0.5px_0px_rgba(255,255,255,0.16)]`
                                                     ⇒ MTV `box-shadow: 0 4px 16px rgba(0,0,0,0.16), inset 0 0.5px 0 rgba(255,255,255,0.16)`
                ⚠️ 「全仓搜 `w-[320px]` / `51,51,51` / `blur(28px)` / `rounded-[20px]` 都是 0 命中」是**假阴性** ——
                   MTV 用的是**普通 CSS 值**而不是 Tailwind 字面量；上面每条都能在 `quality-ratio.css` 里逐字核到。
                §123 修正：`U` 与「滑杆」无关 —— 它只决定「渲染官方 `TF`（药丸 + 数字输入框）」与
                  「面板宽 400px」两件事，见 `styles/quality-ratio.css` 的
                  `[data-video-params-slider='true']` 规则与 `OfficialVideoDurationSelector` 的注释。 */
            data-video-params-slider={panelUsesSlider ? 'true' : undefined}
            role="dialog"
            style={{ display: 'block' }}
          >
            {/* ══ §115 参考帧 / 参考角色：**官方面板没有这两组**（`Eoe` 七组 = 生成模式·生成方式·比例·清晰度·生成时长·生成音频·极速模式，
                  全文见 `live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1868054 区）。
                2026-10-15 用户裁决「官方没有 ⇒ 按规矩移除」。这里用**开关常量**关掉 UI 而不是物理删除：
                ① `videoReferences` 这个**数据字段**仍被 6 处服务消费（`services/ai/generateVideo.ts:108` ·
                   `services/ai/providers/apimartMedia.ts:203` · `services/plugins/pluginRuntime.ts:530` ·
                   `services/storageService.ts:296/332/541/574`），物理删除要连带改请求层与持久化层；
                ② 关掉后**面板外形与官方一致**（用户看到的缺口已消除）；
                ③ 想恢复只需把常量改回 `true`（能力没有丢数据）。
                ⚠️ 若用户确认连能力也不要，下一步再删这整块 + 清理 `references/frameReferences/characterOptions/…` 这些只为它存在的派生量。 */}
            {SHOW_MTV_REFERENCE_PICKERS && onChangeVideoReferences && provider !== 'workflow-api' && (
              <div className="img-rp-quality-area">
                <div className="img-rp-section-label rh-video-ref-head">
                  <span>
                    参考帧
                    <span className="rh-tip" data-tooltip={`可选：指定某张图作为视频的首帧或尾帧，其余作为中间参考帧。不添加时按连线顺序交给模型。${referenceLimitTip ? `
该模型：${referenceLimitTip}（连线带入的素材一并计数）。` : ''}`}>!</span>
                  </span>
                  <button type="button" className="rh-video-ref-add" onClick={() => setPickerFor(pickerFor === 'frame' ? null : 'frame')}>
                    {pickerFor === 'frame' ? '取消' : '＋ 添加'}
                  </button>
                </div>
                {frameReferences.length > 0 && (
                  <div className="rh-video-frame-list">
                    {frameReferences.map((item) => (
                      <div key={item.id} className="rh-video-frame-row">
                        <img className="rh-video-frame-thumb" src={item.url} alt={item.label || '参考帧'} title={item.label} loading="lazy" />
                        <div className="img-rp-quality-segmented rh-video-frame-seg">
                          {FRAME_ROLE_OPTIONS.map((option) => (
                            <AnimatedButton
                              key={option.value}
                              type="button"
                              className={`img-rp-quality-item rh-v5-res-btn ui-schema-option ${item.role === option.value ? 'active' : ''}`}
                              onClick={() => setFrameRole(item.id, option.value)}
                            >
                              {option.label}
                            </AnimatedButton>
                          ))}
                        </div>
                        <button type="button" className="rh-video-ref-remove" aria-label={`移除 ${item.label || '参考帧'}`} onClick={() => removeReference(item.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="img-rp-section-label rh-video-ref-head mt-2">
                  <span>
                    参考角色
                    <span className="rh-tip" data-tooltip="可选：从角色库或连线节点挑选角色形象，作为参考图一起提交。提示词里写到该角色名字时，会自动告诉模型这个名字对应哪张参考图。">!</span>
                  </span>
                  <button type="button" className="rh-video-ref-add" onClick={() => setPickerFor(pickerFor === 'character' ? null : 'character')}>
                    {pickerFor === 'character' ? '取消' : '＋ 添加'}
                  </button>
                </div>
                {characterReferences.length > 0 && (
                  <div className="rh-video-frame-list">
                    {characterReferences.map((item) => (
                      <div key={item.id} className="rh-video-frame-row">
                        <img className="rh-video-frame-thumb" src={item.url} alt={item.label || '参考角色'} title={item.label} loading="lazy" />
                        <span className="rh-video-ref-name">{item.label || '参考角色'}</span>
                        <button type="button" className="rh-video-ref-remove" aria-label={`移除 ${item.label || '参考角色'}`} onClick={() => removeReference(item.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {pickerFor && (() => {
                  // 参考帧只从连线节点挑；角色库只出现在参考角色里
                  const pickerCharacters = pickerFor === 'character' ? characterOptions : [];
                  return (
                  <div className="rh-video-ref-picker">
                    {connectedImageNodes.length > 0 && <div className="rh-video-ref-picker-label">连线节点</div>}
                    {connectedImageNodes.map((node) => {
                      const data = node.data as BaseNodeData;
                      return (
                        <button
                          key={node.id}
                          type="button"
                          className="rh-video-ref-option"
                          onClick={() => addReference(pickerFor, { id: node.id, label: data.label || '参考图', url: data.imageUrl as string })}
                        >
                          <img className="rh-video-frame-thumb" src={data.imageUrl} alt="" loading="lazy" />
                          <span className="rh-video-ref-name">{data.label || '参考图'}</span>
                        </button>
                      );
                    })}
                    {pickerCharacters.length > 0 && <div className="rh-video-ref-picker-label">角色库</div>}
                    {pickerCharacters.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="rh-video-ref-option"
                        onClick={() => addReference(pickerFor, option)}
                      >
                        <img className="rh-video-frame-thumb" src={option.url} alt="" loading="lazy" />
                        <span className="rh-video-ref-name">{option.label}</span>
                      </button>
                    ))}
                    {connectedImageNodes.length === 0 && pickerCharacters.length === 0 && (
                      <div className="rh-video-ref-empty">
                        {pickerFor === 'frame'
                          ? '还没有可选的图片：先给视频节点连一个图片节点'
                          : '还没有可选的角色：先连一个图片节点，或在角色库里添加角色'}
                      </div>
                    )}
                  </div>
                  );
                })()}
              </div>
            )}

            {/* ── 官方「生成方式」（`Roe` 的 `videoConfigs.generateMethod` 段） ──
                官方渲染门（canvas:@1875793 逐字）：`M=b&&_&&_.length>0&&v`，其中
                  `b`=`generateMethod`（=`dd(params.modelType)`）、`_`=`availableGenerateMethods`、
                  `v`=`onGenerateMethodChange`；标题 = `R("videoConfigs.generateMethod")`（zh「生成方式」）；
                  选项 = `_.map(H=>H.key)`；值 = `b`；禁用 = `j||L.includes("generateMethod")`。
                官方 `renderOption`（canvas:@1876868 逐字）：`$.label`；有 `$.hint` 时再挂一颗
                信息图标 + tooltip（`whitespace-pre-line text-left leading-relaxed` 承载多行 hint）。
                MTV 弹窗是 MTV 自己的分段控件，此处沿用同一弹窗里「分辨率 / 宽高比」的既有写法，
                label / 选项来源 / 选项渲染语义 / 禁用条件逐字对齐官方。 */}
            {generateMethod && (availableGenerateMethods?.length ?? 0) > 0 && onGenerateMethodChange && (
              <div className="img-rp-quality-area">
                <div className="img-rp-section-label">生成方式</div>
                <VideoSegmented activeKey={generateMethod} className="img-rp-quality-segmented rh-video-resolution-seg">
                  {generateMethodOptions.map((option) => (
                    <AnimatedButton
                      key={option.key}
                      type="button"
                      data-seg-active={generateMethod === option.key}
                      disabled={disabled || lockedParameters.includes('generateMethod')}
                      className={`img-rp-quality-item rh-v5-res-btn ui-schema-option ${generateMethod === option.key ? 'active' : ''}`}
                      onClick={() => onGenerateMethodChange(option.key)}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        {option.label}
                        {option.hint && (
                          /* 官方 `renderOption`（@1872979 区逐字）：有 `hint` 时
                               `s.jsx(Gt,{content:<div className="whitespace-pre-line text-left leading-relaxed">{$.hint}</div>,
                                 children:s.jsx("span",{role:"button","aria-label":$.hint,tabIndex:0,
                                   onClick:X=>X.stopPropagation(),onKeyDown:…,
                                   className:"inline-flex items-center cursor-help text-muted-foreground hover:text-foreground transition-colors",
                                   children:s.jsx(NR,{size:12})})})`
                             `NR` = lucide **`info`**（`vendor-libs-BOn5wEJU.js` 导出 `fz` → `pX=R("info",…)`；
                             真机取证：`class="lucide lucide-info"` · 12×12 · `circle cx=12 cy=12 r=10` + 两段 `path`）。
                             ⚠️ MTV 原来渲染的是文字 `!`（自造字形）⇒ 换成官方那颗 SVG。 */
                          <span
                            className="rh-tip rh-tip-icon"
                            role="button"
                            aria-label={option.hint}
                            tabIndex={0}
                            data-tooltip={option.hint}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-info"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4" />
                              <path d="M12 8h.01" />
                            </svg>
                          </span>
                        )}
                      </span>
                    </AnimatedButton>
                  ))}
                </VideoSegmented>
              </div>
            )}

            {usesDurationControls ? (
              <>
                {/* ══ §115 比例段（官方 `videoConfigs.aspectRatio` =「比例」，zh 偏移 4386604）══
                    官方 `Eoe`（`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1870400 区逐字）：
                      `s.jsx(Ir,{title:L("videoConfigs.aspectRatio"),children:
                         t.length>0 ? s.jsx(ti,{options:t,value:e,onChange:n,disabled:j||D.includes("aspectRatio"),…,
                             renderOption:H=>s.jsxs("div",{className:"flex flex-col items-center gap-0.5",children:[s.jsx(C0,{ratio:H}),
                               s.jsx("span",{className:"text-xs",children:H==="adaptive"?L("videoConfigs.adaptive"):H})]})})
                         : s.jsx("div",{className:"flex bg-input/40 rounded-lg p-0.5",children:s.jsxs("div",{className:"flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-input/40 rounded-md text-foreground",children:[s.jsx(c1,{size:14}),
                               s.jsx("span",{className:"text-sm",children:L("videoConfigs.auto")})]})})})`
                    ⇒ **比例段没有任何门，恒渲染**（规格书 §4.3 表「比例｜**恒渲染**（无 gate）」）；
                      档位为空时渲染「自适应」静态块（`videoConfigs.auto` =「自适应」@4386423），**不是隐藏**。
                    ⚠️ MTV 原来把它挂在 `showRatioControl` 后面 ⇒ 目录无 `aspectRatios` 的模型
                      （如 `grok-imagine-video-1.5`）整段消失（用户图3 看不到比例组）⇒ 按官方改成恒渲染 + 静态兜底。
                    ⚠️ 官方顺序 = 生成方式 → **比例 → 清晰度** → 时长 → 音频，MTV 原来是分辨率在前 ⇒ 本次一并换位。 */}
                {showSeedanceRatio && (
                  <div className="img-rp-quality-area">
                    <div className="img-rp-section-label">
                      比例
                      {/* §125 官方「比例」标题**没有 tooltip**：`s.jsx(Ir,{title:F("videoConfigs.aspectRatio"),children:…})`
                          —— `Ir` 的 `tooltip`（`o`）未传 ⇒ 真机 `titleSvg: none`、`titleChildren` 里只有文本。
                          MTV 原来那颗自造 `!` 删除（原文案保留在此备查：决定输出视频的画面形状：
                          16:9 横屏、9:16 竖屏，自适应 = 由模型智能决定。）。 */}
                    </div>
                    {seedanceRatios.length > 0 ? (
                      /* ══ §121 官方比例项 = **竖排（比例框图标在上、`text-xs` 文字在下）**，且**没有「模型默认」这一项** ══
                          官方 @1870648 区逐字：
                            `renderOption:H=>s.jsxs("div",{className:"flex flex-col items-center gap-0.5",children:[
                               s.jsx(C0,{ratio:H}),
                               s.jsx("span",{className:"text-xs",children:H==="adaptive"?L("videoConfigs.adaptive"):H})]})`
                          ⇒ `options:t`（= `availableRatios`，**只有模型声明的比例档**）+ `value:e` + `onChange:n`，
                            **没有 `void 0` / 「模型默认」这种第三态**。
                          ⚠️ MTV 原来插了一颗「模型默认」按钮（`generalModel && generalCapability?.defaultRatio === undefined` 时）：
                            ① 官方没有这一项；② 8 个格子挤进 296px ⇒ 文字被压成竖排并与相邻格重叠（用户图1 的崩）。
                            ⇒ **删掉这颗**；「未指定」态由官方同一套语义表达 —— 官方 `value` 为空时 `ti` 不高亮任何格。 */
                      <VideoSegmented activeKey={displayedRatio}>
                        {seedanceRatios.map((opt) => (
                          <AnimatedButton
                            key={opt.value}
                            type="button"
                            data-seg-active={displayedRatio === opt.value}
                            className={`img-rp-quality-item rh-v5-res-btn ui-schema-option ${displayedRatio === opt.value ? 'active' : ''}`}
                            onClick={() => onChangeSeedanceRatio?.(opt.value)}
                          >
                            <span className="flex flex-col items-center gap-0.5">
                              <OfficialVideoRatioIcon ratio={opt.value} />
                              {/* 官方 `renderOption`（@1874104 逐字）：
                                    `G==="adaptive" ? F("videoConfigs.adaptive") : G`
                                  官方 zh 值 `CI.adaptive = "自适应"`（`index-CsQaPZ-H.js` @914866 区逐字，
                                  与 `CI.auto` 逐字相同）。
                                  ⚠️ MTV 原来写的是 `opt.label === '自适应' ? '自适应' : opt.value` —— 而
                                  `opt.label` 就是 `opt.value`（`declaredRatios.map(value => ({value, label:value}))`）
                                  ⇒ `'自适应' === 'adaptive'` 恒假 ⇒ **渲染成英文 `adaptive`**（用户图1 的直接来源）。 */}
                              <span className="text-xs">
                                {opt.value === 'adaptive' ? t('自适应') : opt.value}
                              </span>
                            </span>
                          </AnimatedButton>
                        ))}
                      </VideoSegmented>
                    ) : (
                      /* 官方空态块（类串逐字）：`flex bg-input/40 rounded-lg p-0.5` + 内层 `flex-1 … py-1.5 px-3 bg-input/40 rounded-md text-foreground` */
                      <div className="flex bg-input/40 rounded-lg p-0.5">
                        <div className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-input/40 rounded-md text-foreground">
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-fullscreen" aria-hidden="true">
                          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                          <rect width="10" height="8" x="7" y="8" rx="1" />
                        </svg>
                        <span className="text-sm">{autoTriggerLabel}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ══ §115 清晰度段（官方 `videoConfigs.resolution` =「清晰度」，zh 偏移 4387010）══
                    官方 @1871200 区逐字：`F?<ti options={l} …/>:<静态块，图标 CR size 14，文案 videoConfigs.auto>`
                    ⇒ 同样是**恒渲染 + 空态静态块**（规格书 §4.3 表「清晰度｜`F = i && l && l.length>0 && c`」，
                      空态走 else 分支的「自适应」块）。 */}
                {showResolutionControl || seedanceResolutions.length === 0 ? <div className="img-rp-quality-area">
                  <div className="img-rp-section-label">
                    清晰度
                    {/* §125 官方「清晰度」标题**没有 tooltip**（`Ir` 未传 `tooltip`）⇒ 真机 `titleSvg: none`。
                        原文案备查：只展示模型 capability 声明支持的分辨率档位；更高分辨率通常耗时更长。 */}
                  </div>
                  {seedanceResolutions.length > 0 ? (
                    /* §121：清晰度同样**没有「模型默认」这一项** —— 官方 `ti options={l}` 只列 `availableResolutions`
                       （`Eoe` @1871200 区逐字），未指定态由「value 不在列表里 ⇒ 不高亮」表达。 */
                    <VideoSegmented activeKey={displayedResolution}>
                      {seedanceResolutions.map((opt) => (
                        <AnimatedButton
                          key={opt.value}
                          type="button"
                          data-seg-active={displayedResolution === opt.value}
                          className={`img-rp-quality-item rh-v5-res-btn ui-schema-option ${displayedResolution === opt.value ? 'active' : ''}`}
                          onClick={() => onChangeSeedanceResolution?.(opt.value)}
                        >
                          {opt.label}
                        </AnimatedButton>
                      ))}
                    </VideoSegmented>
                  ) : (
                    <div className="flex bg-input/40 rounded-lg p-0.5">
                      <div className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-input/40 rounded-md text-foreground">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-aspect-ratio" aria-hidden="true">
                          {/* 官方 `ER` = tabler `aspect-ratio`（`vendor-libs-BOn5wEJU.js` @1623870
                              `const H4r=[["path",{d:"M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"}],
                                ["path",{d:"M7 12v-3h3"}],["path",{d:"M17 12v3h-3"}]], ryt=p("outline","aspect-ratio","AspectRatio",H4r)`） */}
                          <path d="M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" />
                          <path d="M7 12v-3h3" />
                          <path d="M17 12v3h-3" />
                        </svg>
                        <span className="text-sm">{autoTriggerLabel}</span>
                      </div>
                    </div>
                  )}
                </div> : null}

                {/* ══ §122 帧率组**从视频参数面板移除**（官方 `Eoe` 在这个位置没有帧率组）══
                    官方取证：`Eoe`（`D:\DEEPSEEK\live-assets-r100\vendor-pkg-canvas-DuoOicPr.js` @1868054–1873100）里
                    **可正向枚举的组只有 6 个**：模式`V`/生成方式`M`/比例/清晰度/时长`O`/音频`B`/极速`G` —— **没有帧率**。
                    官方**整体是有帧率的**，但位置在**「放大」表单**里（同文件 @2083765 区逐字）：
                      `s.jsx("p",{…,children:n("video.upscaleForm.selectFrameRate")})`
                      + `s.jsx(Mr,…children:[…s.jsx(jo,{value:"auto",…n("video.upscaleForm.frameRate.auto")}),
                          s.jsx(jo,{value:"30",…n("video.upscaleForm.frameRate.30fps")}),
                          s.jsx(jo,{value:"60",…n("video.upscaleForm.frameRate.60fps")}),
                          s.jsx(jo,{value:"90",…n("video.upscaleForm.frameRate.90fps")})…])`
                    ⇒ 官方取值只有 **`auto` / `30` / `60` / `90`**（不是 MTV 的 16/24/30「帧」）。
                    ⚠️ **MTV 没有放大表单**（全仓 `upscaleForm` 0 命中；`upscale` 只走工具栏「新建增强节点」那条路径）
                    ⇒ 按用户 2026-10-15 裁决：**保留 UI 能力但标注「未接入官方位置」**，不许静默删功能。
                    这里用开关常量 **默认关闭**（面板与 `Eoe` 对齐 = 此位置不出现帧率），
                    等 MTV 做出放大表单后再把 `configuredFrameRates` 按官方 `auto/30/60/90` 迁过去。 */}
                {SHOW_MTV_FRAME_RATE_CONTROL && showFrameRateControl && (
                  <div className="img-rp-quality-area">
                    <div className="img-rp-section-label">
                      帧率
                      <span className="rh-tip" data-tooltip="仅展示该模型配置中声明支持的帧率；帧率越高运动越顺滑，但生成成本通常也更高。">!</span>
                    </div>
                    {/* §121：帧率组是 **MTV 自有**（官方 `Eoe` 七组里没有「帧率」；它只在通用模型声明了
                        `frameRates` 时出现，走 MTV 自己的能力声明）。同样**不放「模型默认」格** —— 该格
                        官方不存在，且会挤坏整行布局。 */}
                    <div className="img-rp-quality-segmented">
                      {configuredFrameRates?.map((value) => (
                        <AnimatedButton
                          key={value}
                          type="button"
                          className={`img-rp-quality-item rh-v5-res-btn ui-schema-option ${displayedFrameRate === value ? 'active' : ''}`}
                          onClick={() => onChangeFps?.(value)}
                        >
                          {value}帧
                        </AnimatedButton>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seedance 时长 */}
                {apimartCapability?.durationMode === 'automatic' && (
                  <div className="text-xs text-text-text-secondary">时长由模型自动决定，可在提示词中描述节奏。</div>
                )}
                {(showDurationControl || (showGenerateAudio && supportsAudio)) && (
                <>
                  {/* ══ §124/§125 官方 `Ir` 组的**真实盒子**（`vendor-pkg-canvas-Dp0xADoD.js` @1227125 逐字）══
                       `Ir=({title:e,children:t,className:n,tooltip:o})=>s.jsxs("div",{className:z("p-2 flex flex-col gap-1.5",n),children:[
                          s.jsxs("div",{className:"flex items-center gap-1 text-xs font-medium text-muted-foreground px-1",children:[e, o&&…]}), t]})`
                       ⇒ **padding 8 · gap 6 · 没有任何 margin**；标题行 = `12px/500 · #7a7a7a · lh16 · pad 0 4px · gap 4`。
                       真机（9222 面板打开时）：官方五组 rect = 生成方式 74 · 比例 86 · 清晰度 74 · 生成时长 74 · 生成音频 74，
                       无相邻外边距（官方面板总高 390 = 8(p-1×2) + 74+86+74+74+74）。
                       ⚠️ MTV 原来用 `.rh-v5-meta-panel`（`flex column; gap:10px; padding:0`）套住「生成时长 + 生成音频」两段，
                          且「生成时长」用的是 `.rh-vram-adv-label`（**16px / #fff**）⇒ 与其余四组标题（12px / #7a7a7a）明显不同，
                          这正是用户「间距 字体 大小 颜色不对」的来源；
                          又给每组挂了 `mb-2`（margin-bottom 8）⇒ MTV 面板实测 **404.5** 高（官方 390）。
                       ⇒ 本次把两段拆成**两个官方 `Ir` 盒**（`img-rp-quality-area` = padding 8 / gap 6，去掉 `mb-2`），
                          标题改用 `.img-rp-section-label`（= 官方标题行取值），并去掉 MTV 自造的 `!`（官方该标题 `titleSvg=none`）。 */}
                  {showDurationControl && <div className="img-rp-quality-area">
                    <div className="img-rp-section-label">
                      生成时长
                    </div>
                    {/* §123 官方时长段的**三种形态**（`vendor-pkg-canvas-Dp0xADoD.js` @1874400 区逐字）：
                          ```jsx
                          s.jsx(Ir,{title:F("videoConfigs.duration"),tooltip:x,children:
                            D ? (U ? s.jsx(TF,{value:p,options:m,onValueChange:f,disabledOptions:h,
                                                disabledTooltips:g,disabled:j||R.includes("duration"),
                                                ariaLabel:F("videoConfigs.durationSelectorTitle")})
                                   : s.jsx(ni,{options:m,value:p,onChange:f,disabled:…,
                                               renderOption:G=>G===-1?F("videoConfigs.durationAuto"):`${G}s`,
                                               scrollable:m.length>8, itemClassName:"min-w-8"}))
                              : s.jsx("div",{className:"flex bg-input/40 rounded-lg p-0.5",children:… 静态「自适应」块，Tpe 图标 size 14})})
                          ```
                          门：`D = p && m && m.length>0 && f`（`availableDurations` 非空）·
                              `U = D && y==="slider"`（`durationControl`，只有 SEEDANCE_2_5 / SEEDANCE_2_5_DRAFT /
                              WAN_3_0 三家为 `"slider"` —— 见文件上方 `OfficialVideoDurationSelector` 的注释）。
                        ⇒ **`slider` 那一档渲染的是 `TF` = 药丸 + 数字输入框**；`options` 那一档只有药丸。
                        ⚠️ MTV 原来在 `slider` 档渲染了 `<input type="range">` 真滑杆 + 刻度文字
                          （刻度 = `min/labelStep` 抽样 → seedance-2.5 上正好落在 4/8/12/…/30，用户实测「过于离谱」）
                          ⇒ 本次按官方 `TF` 逐项重写（`OfficialVideoDurationSelector`）。 */}
                    {allowedDurations ? (
                      panelUsesSlider ? (
                        <OfficialVideoDurationSelector
                          value={displayedDuration}
                          options={allowedDurations}
                          onChange={(value) => onChangeSeedanceDuration?.(value)}
                          disabled={disabled || lockedParameters.includes('duration')}
                          ariaLabel={t('选择视频生成时长')}
                          autoLabel={t('自动')}
                          onCommit={onContinuousEditEnd}
                        />
                      ) : (
                      <VideoSegmented activeKey={displayedDuration} className={`img-rp-quality-segmented${allowedDurations.length > 8 ? ' is-scrollable' : ''}`}>
                        {allowedDurations.map((value) => (
                          <AnimatedButton
                            key={value}
                            type="button"
                            data-seg-active={displayedDuration === value}
                            className={`img-rp-quality-item ui-schema-option min-w-8 ${displayedDuration === value ? 'active' : ''}`}
                            onClick={() => onChangeSeedanceDuration?.(value)}
                          >
                            {value === -1 ? '自动' : `${value}s`}
                          </AnimatedButton>
                        ))}
                      </VideoSegmented>
                      )
                    ) : durationFollowsOfficialCatalog ? (
                      /* §126 官方 `D` 为假时的**静态「自适应」块**（`Uoe` @1875300 逐字）：
                           `s.jsx("div",{className:"flex bg-input/40 rounded-lg p-0.5",children:
                              s.jsxs("div",{className:"flex-1 flex items-center justify-center gap-2 py-1.5 px-3
                                                bg-input/40 rounded-md text-foreground",
                                children:[s.jsx(Tpe,{size:14}),
                                          s.jsx("span",{className:"text-sm",children:F("videoConfigs.auto")})]})})`
                         图标 `Tpe` = **tabler `hourglass`**（`vendor-libs-BOn5wEJU.js` @2452538
                           `const Hti=[["path",{d:"M6.5 7h11"}],["path",{d:"M6.5 17h11"}],
                             ["path",{d:"M6 20v-2a6 6 0 1 1 12 0v2a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1z"}],
                             ["path",{d:"M6 4v2a6 6 0 1 0 12 0v-2a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1z"}]],
                           Dnn=p("outline","hourglass","Hourglass",Hti)`）。 */
                      <div className="flex bg-input/40 rounded-lg p-0.5">
                        <div className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-input/40 rounded-md text-foreground">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-hourglass" aria-hidden="true">
                            <path d="M6.5 7h11" />
                            <path d="M6.5 17h11" />
                            <path d="M6 20v-2a6 6 0 1 1 12 0v2a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1z" />
                            <path d="M6 4v2a6 6 0 1 0 12 0v-2a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1z" />
                          </svg>
                          <span className="text-sm">{autoTriggerLabel}</span>
                        </div>
                      </div>
                    ) : useUnboundedDurationInput ? (
                      <input
                        type="number"
                        className="h-8 w-full rounded-md border border-border bg-card px-2 text-[11px] text-foreground outline-none focus:border-blue-400/60"
                        aria-label="生成时长（秒）"
                        min={generalCapability?.minDuration}
                        max={generalCapability?.maxDuration}
                        step={1}
                        value={displayedDuration ?? ''}
                        /* §121：占位文案不许用「模型默认」（官方无此概念/无此格） */
                        placeholder="秒"
                        onChange={(event) => onChangeSeedanceDuration?.(
                          event.target.value ? Number(event.target.value) : undefined,
                        )}
                        onBlur={onContinuousEditEnd}
                      />
                    ) : (
                    <div className="rh-duration-slider">
                      <div className="rh-duration-track">
                         <div
                           className="rh-duration-fill"
                           style={{ width: displayedDuration === undefined
                             ? '0%'
                             : `${((durationControlValue - minDuration) / Math.max(1, maxDuration - minDuration)) * 100}%` }}
                         />
                        <input
                          type="range"
                          className="rh-duration-input"
                          /* §121：官方 `vF` 的 `ariaLabel = L("videoConfigs.durationSelectorTitle")`
                             （zh「选择视频生成时长」@4386714）。⚠️ `vF` 的**内部实现**在 r109 规格书里
                             属「未获得」⇒ 只对齐**调用点**（这条 aria-label + slider 分支 + 400px），
                             **不宣称**这个 MTV 滑杆与官方 `vF` 逐字一致。 */
                          aria-label="选择视频生成时长"
                          min={minDuration}
                          max={maxDuration}
                          step={1}
                          value={durationControlValue}
                          onChange={(e) => onChangeSeedanceDuration?.(Number(e.target.value))}
                          onBlur={onContinuousEditEnd}
                        />
                      </div>
                      <div className="rh-duration-labels">
                        {durationTicks.map((v) => (
                          <span key={v} className={`rh-duration-tick ${displayedDuration !== undefined && displayedDuration >= v ? 'active' : ''}`} onClick={() => onChangeSeedanceDuration?.(v)}>
                            {durationLabelValues.has(v) ? `${v}s` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                    )}
                  </div>}
                  {/* §124：`.rh-v5-meta-panel` 的 `gap:10px` 也去掉了 —— 官方两组 `Ir` 之间**没有**额外间距
                      （真机：生成时长 74 → 生成音频 74，首尾相接）。 */}


                  {/* ══ §121 生成音频 = 官方 `ti options={["on","off"]}` **分段控件**（不是下拉、也不是开关）══
                      官方（`D:\DEEPSEEK\live-assets-r100\vendor-pkg-canvas-DuoOicPr.js` @1872585 区逐字）：
                        `B&&s.jsx(Ir,{title:L("videoModels.generateAudioLabel"),tooltip:L("videoModels.generateAudioDesc"),
                           children:s.jsx(ti,{options:["on","off"],value:C?"on":"off",onChange:H=>E(H==="on"),
                             disabled:j||D.includes("generateAudio"),
                             renderOption:H=>L(H==="on"?"common.on":"common.off")})})`
                      ⇒ 只有**两个**选项（`common.on` 开启 / `common.off` 关闭），值是布尔，**没有「模型默认」这一档**；
                        组门 `B = N && C !== void 0 && E`（`supportsAudio && generateAudio !== undefined && onGenerateAudioChange`）。
                      MTV 原来对通用模型渲染的是**三态下拉**（模型默认 / 生成音频 / 不生成音频）⇒ 与官方控件类型不符 ⇒ 改成分段。
                      §124：官方本组**有** tooltip（`videoModels.generateAudioDesc` =「为生成的视频添加音频内容」），
                        真机 `titleSvg` = `tabler-icon-help text-muted-foreground`（12×12，`Ir` 的 `to/Un/Wn/cl` 那条链），
                        而 MTV 原来挂的是一颗**空** `.rh-tip`（只画了个 14px 圆，没有字形）⇒ 换成官方那颗 `help` 图标。 */}
                  {showGenerateAudio && supportsAudio && (
                  <div className="img-rp-quality-area">
                    <div className="img-rp-section-label">
                      <span>生成音频</span>
                      <span className="rh-tip rh-tip-icon" data-tooltip={'为生成的视频添加音频内容'}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="tabler-icon tabler-icon-help text-muted-foreground"
                          aria-hidden="true"
                        >
                          <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                          <path d="M12 17l0 .01" />
                          <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" />
                        </svg>
                      </span>
                    </div>
                    <VideoSegmented activeKey={generateAudio === true ? 'on' : 'off'}>
                      {(['on', 'off'] as const).map((value) => (
                        <AnimatedButton
                          key={value}
                          type="button"
                          data-seg-active={(generateAudio === true ? 'on' : 'off') === value}
                          className={`img-rp-quality-item ui-schema-option ${(generateAudio === true ? 'on' : 'off') === value ? 'active' : ''}`}
                          onClick={() => onChangeGenerateAudio?.(value === 'on')}
                        >
                          {value === 'on' ? '开启' : '关闭'}
                        </AnimatedButton>
                      ))}
                    </VideoSegmented>
                  </div>
                  )}
                {/* §125 去掉 `.rh-v5-meta-panel` 包裹层（它的 `gap: 10px` 在官方**不存在**）。
                    真机对照（2026-10-15 两侧面板同开）：
                      · 官方：生成时长组 74 · 生成音频组 74，**两组直接相邻（组间 0 间距）**，面板 400×**390**；
                      · MTV（改前）：`.rh-v5-meta-panel{display:flex;flex-direction:column;gap:10px}` 把两组包住
                        ⇒ 74 + 10 + 74 = 158 ⇒ 面板 400×**400**。
                    ⇒ 两组现为面板的直接子节点，间距只来自各自官方 `Ir` 的 `p-2`（与其余三组同款）。 */}
                </>
                )}
              </>
            ) : (
              <>
                {showGenericRatio && (
                  <div className="img-rp-quality-area">
                    <div className="img-rp-section-label">
                      画面比例
                      <span className="rh-tip" data-tooltip="决定输出视频的画面形状：16:9 横屏、9:16 竖屏。分辨率为长边，短边按比例换算后注入工作流的 width/height。">!</span>
                    </div>
                    <div className="img-rp-quality-segmented rh-video-resolution-seg">
                      {genericRatios.map((opt) => (
                        <AnimatedButton
                          key={opt.value}
                          type="button"
                          className={`img-rp-quality-item rh-v5-res-btn ui-schema-option ${genericRatio === opt.value ? 'active' : ''}`}
                          onClick={() => onChangeSeedanceRatio?.(opt.value)}
                        >
                          {opt.label}
                        </AnimatedButton>
                      ))}
                    </div>
                  </div>
                )}

                {/* ComfyUI / RunningHub 分辨率 */}
                <div className="img-rp-quality-area" data-ui-schema-field="rhVideoResolution" data-ui-schema-type="segmented" data-ui-schema-value-type="number" data-ui-schema-default="832">
                  <div className="img-rp-section-label">
                    分辨率（长边）
                    <span className="rh-tip" data-tooltip="画面长边像素，短边由上方比例换算。分辨率越高细节越清晰、边缘更稳定，显存占用与生成耗时也明显增加。最后一格可以填预设以外的值，例如 384。">!</span>
                  </div>
                  <div className="img-rp-quality-segmented rh-video-resolution-seg rh-res-seg-with-custom">
                    {COMBO_RESOLUTIONS.map((res) => (
                      <AnimatedButton
                        key={res}
                        type="button"
                        className={`img-rp-quality-item rh-v5-res-btn ui-schema-option ${legacyVideoResolution === res ? 'active' : ''}`}
                        data-value={res}
                        data-ui-schema-value={res}
                        onClick={() => onChangeResolution?.(res)}
                      >
                        {res}
                      </AnimatedButton>
                    ))}
                    <input
                      type="number"
                      className="rh-res-custom-input"
                      aria-label="自定义长边像素"
                      placeholder="自定义"
                      min={MIN_CUSTOM_RESOLUTION}
                      max={MAX_CUSTOM_RESOLUTION}
                      step={8}
                      // 选中预设时留空只显示占位符，填了值才算自定义
                      value={COMBO_RESOLUTIONS.includes(legacyVideoResolution) ? '' : legacyVideoResolution}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value) && value > 0) onChangeResolution?.(value);
                      }}
                      onBlur={(event) => {
                        const value = Number(event.target.value);
                        if (event.target.value.trim() && Number.isFinite(value)) {
                          onChangeResolution?.(Math.min(
                            MAX_CUSTOM_RESOLUTION,
                            Math.max(MIN_CUSTOM_RESOLUTION, value),
                          ));
                        }
                        onContinuousEditEnd?.();
                      }}
                    />
                  </div>
                </div>

                {/* 帧率 & 时长 */}
                <div className="rh-v5-meta-panel">
                  <div className="rh-vram-adv-row">
                    <div className="rh-vram-adv-label">
                      <span>帧率</span>
                      <span className="rh-tip" data-tooltip="帧率越高运动更顺滑、动作更连贯。但生成更慢、成本更高。常用 24 帧。">!</span>
                    </div>
                    <div className="img-rp-quality-segmented rh-adv-seg rh-v5-fps-seg">
                      {COMBO_FPS_OPTIONS.map((opt) => (
                        <AnimatedButton
                          key={opt.value}
                          type="button"
                          className={`img-rp-quality-item rh-v5-fps-btn ui-schema-option ${legacyVideoFps === opt.value ? 'active' : ''}`}
                          data-value={opt.value}
                          data-ui-schema-value={opt.value}
                          onClick={() => {
                            // 旧节点只有帧数时，先固定反算出的秒数，避免切换 FPS 改变用户看到的时长。
                            if (!Number.isFinite(seedanceDuration)) {
                              onChangeSeedanceDuration?.(durationControlValue);
                            }
                            onChangeFps?.(opt.value);
                          }}
                        >
                          {opt.label}
                        </AnimatedButton>
                      ))}
                    </div>
                  </div>

                  <div className="rh-vram-adv-row" data-ui-schema-field="videoDuration" data-ui-schema-type="slider">
                    <div className="rh-vram-adv-label">
                      <span>生成时长（秒）</span>
                      <span className="rh-tip" data-tooltip={`整数秒，范围 ${minDuration}-${maxDuration}。提交时会根据帧率自动换算为模型需要的总帧数。`}>!</span>
                    </div>
                    <div className="rh-duration-slider">
                      <div className="rh-duration-track">
                        <div
                          className="rh-duration-fill"
                          style={{ width: `${((durationControlValue - minDuration) / Math.max(1, maxDuration - minDuration)) * 100}%` }}
                        />
                        <input
                          type="range"
                          className="rh-duration-input"
                          min={minDuration}
                          max={maxDuration}
                          step={1}
                          value={durationControlValue}
                          onChange={(e) => onChangeSeedanceDuration?.(Number(e.target.value))}
                          onBlur={onContinuousEditEnd}
                        />
                      </div>
                      <div className="rh-duration-labels">
                        {durationTicks.map((value) => (
                          <span
                            key={value}
                            className={`rh-duration-tick ${durationControlValue >= value ? 'active' : ''}`}
                            onClick={() => onChangeSeedanceDuration?.(value)}
                          >
                            {durationLabelValues.has(value) ? `${value}s` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}
