/**
 * 打光（relight）端点客户端 —— 官方契约 1:1，内部适配 MTV 的任意厂商/模型
 * ══════════════════════════════════════════════════════════════════════════
 * 官方源码：`assets/index-TabNyQNQ.js`（整块 = `RelightFeature`）
 *  · 方向预设 `Ut`（逐字）：
 *      left_90/270°, top_90/90°, right_90/90°, front_0/0°, bottom_90/-90°, back_180/180°
 *  · 允许的 (azimuth, elevation) 组合 `Bt`：
 *      (0,0) (270,0) (90,0) (0,90) (0,-90) (0,45) (315,0) (45,0) (315,45) (45,45)
 *  · 吸附网格：`xe=[0,45,90,135,180,225,270,315]`（方位）、`De=[-90,-45,0,45,90]`（仰角）
 *  · 默认状态（@236）：`{ angle:{preset:'front_0',azimuthDeg:0,elevationDeg:0}, brightnessLevel: 默认档,
 *                       temperatureK: 默认色温, rimEnabled: true, rimPreset: 'back_0' }`
 *  · 提交（@252-257）：
 *      params 落节点：`{ anglePreset, azimuthDeg, brightnessLevel, rimEnabled, rimPreset, temperatureK }`
 *      请求：`Lt.relight({ fileId, angle:{preset}, brightnessPercent: brightnessLevel,
 *                           temperatureK, rimEnabled, rimPreset }).send()`
 *      ⇒ 返回 `{ code, data:{ fileUrl } }`，成功后 `updateNodeData(nodeId, { src: fileUrl, taskInfo: undefined })`
 *        ★ **原地替换该节点的图**（不是新建节点）——与其它工具不同。
 * ──────────────────────────────────────────────────────────────────────────
 * MTV 适配：契约（字段名/取值/返回形状）不变；`send(runner?)` 默认走 MTV 生成管线
 * （`generateImagesBatch`，按 `metadata.node_id` 对应节点的 model/provider 发请求），可注入自定义 runner。
 */
import type { AIImageGenParams } from '../../types/aiTypes';
import { generateImagesBatch } from './generateImage';
import { useAppStore } from '../../store/useAppStore';

export type RelightPresetKey =
  | 'left_90' | 'top_90' | 'right_90' | 'front_0' | 'bottom_90' | 'back_180';

/** 官方 `Ut`（逐字：key / i18n labelKey / azimuthDeg / elevationDeg） */
export const RELIGHT_DIRECTIONS: readonly {
  key: RelightPresetKey; labelKey: string; azimuthDeg: number; elevationDeg: number;
}[] = [
  { key: 'left_90', labelKey: 'image.relightDirectionLeft', azimuthDeg: 270, elevationDeg: 0 },
  { key: 'top_90', labelKey: 'image.relightDirectionTop', azimuthDeg: 0, elevationDeg: 90 },
  { key: 'right_90', labelKey: 'image.relightDirectionRight', azimuthDeg: 90, elevationDeg: 0 },
  { key: 'front_0', labelKey: 'image.relightDirectionFront', azimuthDeg: 0, elevationDeg: 0 },
  { key: 'bottom_90', labelKey: 'image.relightDirectionBottom', azimuthDeg: 0, elevationDeg: -90 },
  { key: 'back_180', labelKey: 'image.relightDirectionBack', azimuthDeg: 180, elevationDeg: 0 },
];

/**
 * 官方 `se`（逐字）：**26 个**角度预设。主光源 6 宫格按钮用 `Ut`（上面那张），
 * 但落库 / 请求里的 `angle.preset` 用的是本表最近的预设（官方 `Ke()` 返回本表项）。
 */
export const RELIGHT_ANGLE_PRESETS: readonly { key: string; azimuthDeg: number; elevationDeg: number }[] = [
  { key: 'front_0', azimuthDeg: 0, elevationDeg: 0 },
  { key: 'right_45', azimuthDeg: 45, elevationDeg: 0 },
  { key: 'right_90', azimuthDeg: 90, elevationDeg: 0 },
  { key: 'right_rear_45', azimuthDeg: 135, elevationDeg: 0 },
  { key: 'back_180', azimuthDeg: 180, elevationDeg: 0 },
  { key: 'left_rear_45', azimuthDeg: 225, elevationDeg: 0 },
  { key: 'left_90', azimuthDeg: 270, elevationDeg: 0 },
  { key: 'left_45', azimuthDeg: 315, elevationDeg: 0 },
  { key: 'top_front_45', azimuthDeg: 0, elevationDeg: 45 },
  { key: 'top_front_right_45', azimuthDeg: 45, elevationDeg: 45 },
  { key: 'top_right_45', azimuthDeg: 90, elevationDeg: 45 },
  { key: 'right_rear_top_45', azimuthDeg: 135, elevationDeg: 45 },
  { key: 'top_rear_45', azimuthDeg: 180, elevationDeg: 45 },
  { key: 'left_rear_top_45', azimuthDeg: 225, elevationDeg: 45 },
  { key: 'top_left_45', azimuthDeg: 270, elevationDeg: 45 },
  { key: 'top_front_left_45', azimuthDeg: 315, elevationDeg: 45 },
  { key: 'bottom_front_45', azimuthDeg: 0, elevationDeg: -45 },
  { key: 'bottom_front_right_45', azimuthDeg: 45, elevationDeg: -45 },
  { key: 'bottom_right_45', azimuthDeg: 90, elevationDeg: -45 },
  { key: 'right_rear_bottom_45', azimuthDeg: 135, elevationDeg: -45 },
  { key: 'bottom_rear_45', azimuthDeg: 180, elevationDeg: -45 },
  { key: 'left_rear_bottom_45', azimuthDeg: 225, elevationDeg: -45 },
  { key: 'bottom_left_45', azimuthDeg: 270, elevationDeg: -45 },
  { key: 'bottom_front_left_45', azimuthDeg: 315, elevationDeg: -45 },
  { key: 'top_90', azimuthDeg: 0, elevationDeg: 90 },
  { key: 'bottom_90', azimuthDeg: 0, elevationDeg: -90 },
];

/** 官方 `Z = 5`：角度命中判定的容差（度） */
export const RELIGHT_ANGLE_TOLERANCE = 5;

/** 官方 `Bt`：允许的 (azimuth, elevation) 组合 */
export const RELIGHT_ALLOWED_ANGLES: readonly { azimuthDeg: number; elevationDeg: number }[] = [
  { azimuthDeg: 0, elevationDeg: 0 },
  { azimuthDeg: 270, elevationDeg: 0 },
  { azimuthDeg: 90, elevationDeg: 0 },
  { azimuthDeg: 0, elevationDeg: 90 },
  { azimuthDeg: 0, elevationDeg: -90 },
  { azimuthDeg: 0, elevationDeg: 45 },
  { azimuthDeg: 315, elevationDeg: 0 },
  { azimuthDeg: 45, elevationDeg: 0 },
  { azimuthDeg: 315, elevationDeg: 45 },
  { azimuthDeg: 45, elevationDeg: 45 },
];

/** 官方吸附网格 */
export const RELIGHT_AZIMUTH_STEPS: readonly number[] = [0, 45, 90, 135, 180, 225, 270, 315];
export const RELIGHT_ELEVATION_STEPS: readonly number[] = [-90, -45, 0, 45, 90];

/** 官方灯色（`W = new Color('#F3F9FC')`） */
export const RELIGHT_LIGHT_COLOR = '#F3F9FC';

/** 官方 `Ve`：亮度档位（只有 3 档） */
export const RELIGHT_BRIGHTNESS_STOPS: readonly number[] = [10, 50, 100];

/** 官方 `ye`：色温档位 + 对应灯色 */
export const RELIGHT_TEMPERATURE_STOPS: readonly { value: number; color: string }[] = [
  { value: 2000, color: '#D7995D' },
  { value: 3000, color: '#D5AE55' },
  { value: 4000, color: '#F3DB90' },
  { value: 5600, color: '#F3F9FC' },
  { value: 7000, color: '#D4E6EE' },
  { value: 8000, color: '#C4E2F0' },
];

/** 官方 `Ot`：色温滑块的渐变轨道（逐字） */
export const RELIGHT_TEMPERATURE_TRACK_GRADIENT =
  'linear-gradient(90deg, rgba(238,130,36,0.30) 0%, rgba(242,154,37,0.30) 20%, '
  + 'rgba(249,218,125,0.30) 41%, rgba(247,249,242,0.30) 63%, '
  + 'rgba(220,239,247,0.30) 81%, rgba(182,224,242,0.30) 99%)';

/** 官方 `U`：色温 → 灯色（灯架 `lightColor`） */
export function relightLightColorFor(temperatureK: number): string {
  return RELIGHT_TEMPERATURE_STOPS.find((stop) => stop.value === temperatureK)?.color ?? RELIGHT_LIGHT_COLOR;
}

/** 官方 `B`：色温 → 标签块底部光晕色 */
export function relightTabGlowColorFor(temperatureK: number): string {
  if (temperatureK <= 4000) return '#D5C6AA';
  if (temperatureK >= 7000) return '#9EC4F9';
  return '#A6A196';
}

/** 官方 `tIntensity`：亮度百分比 → 灯强度（≤10 ⇒ .35；≥100 ⇒ 2.2；否则 x/50） */
export function relightIntensityFor(brightnessPercent: number): number {
  if (brightnessPercent <= 10) return 0.35;
  if (brightnessPercent >= 100) return 2.2;
  return brightnessPercent / 50;
}

/** 官方 `pe`：该角度是否命中允许集合 `Bt`（容差 `Z = 5`） */
export function isRelightAngleAllowed(azimuthDeg: number, elevationDeg: number): boolean {
  return RELIGHT_ALLOWED_ANGLES.some((allowed) => (
    Math.abs(((azimuthDeg - allowed.azimuthDeg + 540) % 360) - 180) <= RELIGHT_ANGLE_TOLERANCE
    && Math.abs(elevationDeg - allowed.elevationDeg) <= RELIGHT_ANGLE_TOLERANCE
  ));
}

/** 官方 `Ke`：角度 → 最近的角度预设（`top_90` / `bottom_90` 先特判） */
export function nearestRelightAnglePreset(
  azimuthDeg: number,
  elevationDeg: number,
): { key: string; azimuthDeg: number; elevationDeg: number } | null {
  if (Math.abs(elevationDeg - 90) <= RELIGHT_ANGLE_TOLERANCE) {
    return RELIGHT_ANGLE_PRESETS.find((item) => item.key === 'top_90') ?? null;
  }
  if (Math.abs(elevationDeg + 90) <= RELIGHT_ANGLE_TOLERANCE) {
    return RELIGHT_ANGLE_PRESETS.find((item) => item.key === 'bottom_90') ?? null;
  }
  return RELIGHT_ANGLE_PRESETS.find((item) => (
    Math.abs(((azimuthDeg - item.azimuthDeg + 540) % 360) - 180) <= RELIGHT_ANGLE_TOLERANCE
    && Math.abs(elevationDeg - item.elevationDeg) <= RELIGHT_ANGLE_TOLERANCE
  )) ?? null;
}

/** 官方 `Qt`：角度 → 最近的轮廓光预设 key（曼哈顿距离） */
export function nearestRimPresetKey(azimuthDeg: number, elevationDeg: number): string {
  let best = RELIGHT_RIM_PRESETS[0].key;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const preset of RELIGHT_RIM_PRESETS) {
    const distance = Math.abs(((azimuthDeg - preset.azimuthDeg + 540) % 360) - 180)
      + Math.abs(elevationDeg - preset.elevationDeg);
    if (distance < bestDistance) { bestDistance = distance; best = preset.key; }
  }
  return best;
}

/** 官方轮廓光预设 `ce`（逐字：3 项，全部在正后方，仰角 -45 / 0 / 45；`back_0` 默认开） */
export const RELIGHT_RIM_PRESETS: readonly { key: string; azimuthDeg: number; elevationDeg: number }[] = [
  { key: 'back_0', azimuthDeg: 180, elevationDeg: 0 },
  { key: 'top_back_45', azimuthDeg: 180, elevationDeg: 45 },
  { key: 'low_back_45', azimuthDeg: 180, elevationDeg: -45 },
];

/** 官方 `Xe/$e`：把角度吸附到最近的网格值 */
export function snapAzimuth(deg: number): number {
  const value = ((deg % 360) + 360) % 360;
  let best = RELIGHT_AZIMUTH_STEPS[0];
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const step of RELIGHT_AZIMUTH_STEPS) {
    const diff = Math.min(Math.abs(value - step), 360 - Math.abs(value - step));
    if (diff < bestDiff) { bestDiff = diff; best = step; }
  }
  return best;
}
export function snapElevation(deg: number): number {
  let best = RELIGHT_ELEVATION_STEPS[0];
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const step of RELIGHT_ELEVATION_STEPS) {
    const diff = Math.abs(deg - step);
    if (diff < bestDiff) { bestDiff = diff; best = step; }
  }
  return best;
}

export interface RelightParams {
  /** 官方 `angle.preset`：取自 26 项 `se` 表，可为 `null` */
  anglePreset: string | null;
  azimuthDeg: number;
  elevationDeg: number;
  /** 官方 `brightnessLevel`（`Ve` 档位值） */
  brightnessLevel: number;
  /** 官方 `temperatureK`（`ye` 档位值） */
  temperatureK: number;
  rimEnabled: boolean;
  rimPreset: string;
}

export const RELIGHT_DEFAULTS: RelightParams = {
  anglePreset: 'front_0',
  azimuthDeg: 0,
  elevationDeg: 0,
  brightnessLevel: 50,
  temperatureK: 5600,
  rimEnabled: true,
  rimPreset: 'back_0',
};

/**
 * 官方 `ri`（initialParams → 状态）：
 *   · `angle.preset` 用 `Ke()` 重新按角度求最近预设（不直接信任传入的 preset）
 *   · 亮度 / 色温必须命中档位（官方 `Fe`），否则回落默认
 *   · `rimPreset` 必须命中 `ce`，否则回落 `back_0`
 */
export function normalizeRelightParams(input?: Partial<RelightParams> | null): RelightParams {
  const presetKey = typeof input?.anglePreset === 'string' ? input.anglePreset : null;
  const preset = presetKey
    ? RELIGHT_ANGLE_PRESETS.find((item) => item.key === presetKey) ?? null
    : null;
  const azimuthDeg = typeof input?.azimuthDeg === 'number' && Number.isFinite(input.azimuthDeg)
    ? input.azimuthDeg : (preset?.azimuthDeg ?? RELIGHT_DEFAULTS.azimuthDeg);
  const elevationDeg = typeof input?.elevationDeg === 'number' && Number.isFinite(input.elevationDeg)
    ? input.elevationDeg : (preset?.elevationDeg ?? RELIGHT_DEFAULTS.elevationDeg);
  const nearest = nearestRelightAnglePreset(azimuthDeg, elevationDeg);
  const brightness = input?.brightnessLevel;
  const temperature = input?.temperatureK;
  return {
    anglePreset: nearest?.key ?? preset?.key ?? null,
    azimuthDeg,
    elevationDeg,
    brightnessLevel: typeof brightness === 'number' && RELIGHT_BRIGHTNESS_STOPS.includes(brightness)
      ? brightness : RELIGHT_DEFAULTS.brightnessLevel,
    temperatureK: typeof temperature === 'number' && RELIGHT_TEMPERATURE_STOPS.some((stop) => stop.value === temperature)
      ? temperature : RELIGHT_DEFAULTS.temperatureK,
    rimEnabled: typeof input?.rimEnabled === 'boolean' ? input.rimEnabled : RELIGHT_DEFAULTS.rimEnabled,
    rimPreset: typeof input?.rimPreset === 'string' && RELIGHT_RIM_PRESETS.some((item) => item.key === input.rimPreset)
      ? input.rimPreset : RELIGHT_DEFAULTS.rimPreset,
  };
}

/** 官方 `Lt.relight({...})` 的入参（字段名逐字） */
export interface RelightRequest {
  fileId: string;
  angle: { preset: string | null };
  brightnessPercent: number;
  temperatureK: number;
  rimEnabled: boolean;
  rimPreset: string;
}

export function buildRelightRequest(
  params: RelightParams,
  options: { fileId: string },
): RelightRequest {
  return {
    fileId: options.fileId,
    angle: { preset: params.anglePreset },
    brightnessPercent: params.brightnessLevel,
    temperatureK: params.temperatureK,
    rimEnabled: params.rimEnabled,
    rimPreset: params.rimPreset,
  };
}

/** 适配层：官方把结构化参数发给云端，MTV 交给任意厂商图生图时需要一个提示词 */
export function relightPrompt(payload: RelightRequest): string {
  const direction = RELIGHT_ANGLE_PRESETS.find((item) => item.key === payload.angle.preset);
  const label = direction ? `${direction.azimuthDeg}° azimuth / ${direction.elevationDeg}° elevation` : payload.angle.preset;
  return [
    'Relight the SAME image: keep the subject, geometry, materials, composition and identity unchanged.',
    `Move the key light to ${label}; brightness ${payload.brightnessPercent}%; colour temperature ${payload.temperatureK}K.`,
    payload.rimEnabled ? `Add a rim/back light (${payload.rimPreset}) along the subject edges.` : 'Do not add a rim light.',
    'Only lighting and shading may change; do not alter or add objects.',
  ].join(' ');
}

export interface RelightResponse {
  code: number;
  data?: { fileUrl?: string };
}

export interface RelightRunnerOptions {
  model?: string;
  provider?: string;
  imageSize?: string;
  aspectRatio?: string;
}

/**
 * 官方 `Lt.relight(payload).send()`：
 *   · 入参 / 返回形状（`{code, data:{fileUrl}}`）与官方一致；
 *   · 不传 runner 时走 MTV 默认适配器（按 `fileId` 对应节点的 model/provider 发请求）。
 */
export function relight(payload: RelightRequest) {
  return {
    send: async (
      runner?: (params: AIImageGenParams) => Promise<string[]>,
      options: RelightRunnerOptions = {},
    ): Promise<RelightResponse> => {
      const node = useAppStore.getState().nodes.find((item) => item.id === payload.fileId);
      const nodeData = (node?.data ?? {}) as Record<string, unknown>;
      const params: AIImageGenParams = {
        prompt: relightPrompt(payload),
        model: options.model ?? (nodeData.model as string | undefined) ?? '',
        provider: options.provider ?? (nodeData.provider as string | undefined) ?? '',
        imageSize: options.imageSize ?? (nodeData.imageSize as string | undefined),
        aspectRatio: options.aspectRatio ?? (nodeData.aspectRatio as string | undefined),
        nodeId: payload.fileId,
        image_urls: [(nodeData.imageUrl as string | undefined) ?? ''].filter(Boolean),
      };
      const run = runner ?? (async (input: AIImageGenParams) => {
        const batch = await generateImagesBatch(input, 1);
        return batch.results.map((item) => item.url).filter((url): url is string => Boolean(url));
      });
      const urls = await run(params);
      if (!urls.length) return { code: 1, data: {} };
      return { code: 0, data: { fileUrl: urls[0] } };
    },
  };
}
