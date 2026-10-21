/**
 * 定义摄影棚相机与灯光状态、预设和提示词转换规则，供 3D 面板与节点操作复用。
 */
import type {
  CameraAperture,
  CameraExposureTime,
  CameraGenerationSettings,
  CameraLens,
  CameraShutterEffect,
} from '../../../../types';
import { CAMERA_DEFAULTS, cameraAperture, cameraBody, cameraFocal, cameraLens } from '../../../../data/cameraControl';

export type { CameraLens } from '../../../../types';

export type CameraStudioMode = 'camera' | 'lighting' | 'dual';
export type CameraDistance = 'far' | 'full' | 'medium' | 'close' | 'extreme-close';
export type LightTemperature = 'cool' | 'neutral' | 'warm';

export interface CameraStudioCameraState {
  yaw: number;
  pitch: number;
  roll: number;
  distance: CameraDistance;
  lens: CameraLens;
  promptEnhance: boolean;
}

export interface CameraStudioLightState {
  yaw: number;
  pitch: number;
  intensity: number;
  temperature: LightTemperature;
  rimLight: boolean;
  fillLight: boolean;
}

export interface CameraStudioResult {
  mode: CameraStudioMode;
  camera: CameraStudioCameraState;
  light: CameraStudioLightState;
  prompt: string;
}

export interface CameraPreset {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  roll?: number;
  lens?: CameraLens;
}

export interface LightPreset {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
}

export const DEFAULT_CAMERA_STATE: CameraStudioCameraState = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  distance: 'medium',
  lens: '35mm',
  promptEnhance: true,
};

export const DEFAULT_LIGHT_STATE: CameraStudioLightState = {
  yaw: 45,
  pitch: 30,
  intensity: 65,
  temperature: 'neutral',
  rimLight: false,
  fillLight: true,
};

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'front', label: '正面', yaw: 0, pitch: 0 },
  { id: 'three-quarter', label: '右前 3/4', yaw: 45, pitch: 0 },
  { id: 'profile', label: '侧面', yaw: 90, pitch: 0 },
  { id: 'back', label: '背面', yaw: 180, pitch: 0 },
  { id: 'high', label: '高机位', yaw: 20, pitch: 38, lens: '50mm' },
  { id: 'low', label: '低机位', yaw: -20, pitch: -24, lens: '24mm' },
  { id: 'overhead', label: '俯拍', yaw: 0, pitch: 76, lens: '35mm' },
  { id: 'dutch', label: '荷兰角', yaw: 25, pitch: 4, roll: 18, lens: '35mm' },
];

export const LIGHT_PRESETS: LightPreset[] = [
  { id: 'front', label: '正面光', yaw: 0, pitch: 18 },
  { id: 'left', label: '左侧光', yaw: -90, pitch: 25 },
  { id: 'right', label: '右侧光', yaw: 90, pitch: 25 },
  { id: 'top', label: '顶光', yaw: 0, pitch: 72 },
  { id: 'back', label: '逆光', yaw: 180, pitch: 25 },
  { id: 'bottom', label: '底光', yaw: 0, pitch: -45 },
];

export function normalizeCameraYaw(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function describeCameraYaw(yaw: number): string {
  const angle = normalizeCameraYaw(yaw);
  if (angle >= -22.5 && angle < 22.5) return 'front camera view';
  if (angle >= 22.5 && angle < 67.5) return 'front-right three-quarter view';
  if (angle >= 67.5 && angle < 112.5) return 'right profile camera view';
  if (angle >= 112.5 && angle < 157.5) return 'rear-right three-quarter view';
  if (angle >= 157.5 || angle < -157.5) return 'rear camera view';
  if (angle >= -157.5 && angle < -112.5) return 'rear-left three-quarter view';
  if (angle >= -112.5 && angle < -67.5) return 'left profile camera view';
  return 'front-left three-quarter view';
}

function describeCameraPitch(pitch: number): string {
  if (pitch >= 65) return 'overhead top-down shot';
  if (pitch > 15) return 'high-angle shot';
  if (pitch < -12) return 'low-angle shot';
  return 'eye-level shot';
}

const DISTANCE_PROMPTS: Record<CameraDistance, string> = {
  far: 'wide establishing framing',
  full: 'full-body framing',
  medium: 'medium-shot framing',
  close: 'close-up framing',
  'extreme-close': 'extreme close-up framing',
};

const LENS_PROMPTS: Record<CameraLens, string> = {
  '15mm': '15mm ultra-wide lens',
  '24mm': '24mm wide-angle lens',
  '35mm': '35mm cinematic lens',
  '50mm': '50mm natural perspective lens',
  '85mm': '85mm portrait lens',
  '200mm': '200mm telephoto lens compression',
  macro: '100mm macro lens, extreme close-up, 1:1 magnification, fine surface detail',
  fisheye: 'fisheye lens distortion',
};

export function describeCameraLens(lens: CameraLens): string {
  return LENS_PROMPTS[lens];
}

/* ★ MTV 旧的 `SHUTTER_EFFECT_PROMPTS` / `APERTURE_PROMPTS`（自造的曝光/快门话术）已删除 ✓
   官方「摄影机控制」只有 机身/镜头/焦段/光圈 四段话术，且**逐字在包里**（`Yie/Xie/Zie/Qie`），
   见 `src/data/cameraControl.ts` 与 `buildGenerationCameraPrompt` ✓ */

/**
 * 「摄影机控制（Lens Combo）」→ **提示词片段**。
 *
 * ★ 官方对照（`zoom-slider-3ZcFvYQO.js`）：
 *   · 客户端 `TYe = (e,t,n,s,r) => e` 是**恒等函数** —— 官方**不在客户端**拼提示词，
 *     而是把 `cameraControl` 整包发给后端 `generation/image/camera_control`（@2819435），
 *     由服务端完成「器材 → 提示词」的翻译。
 *   · 但**那套翻译文本就摆在包里**（`Yie`机身 / `Xie`镜头 / `Zie`焦段 / `Qie`光圈，
 *     见 `src/data/cameraControl.ts`），每段都带 `", "` 前导 ⇒ 就是「拼到提示词尾部」的写法。
 *   ⇒ MTV 本地照拼即可拿到同等效果，且不受官方那 7 个模型的白名单限制。
 *
 * ⚠️ **拼接顺序无法从包里证实**（服务端代码不在包内）：这里按「机身 → 镜头 → 焦段 → 光圈」，
 *    与 Lens Combo 面板从左到右的顺序一致。
 * ⚠️ 关闭（`enabled !== true`）时返回空串 —— 与官方一致（官方关掉时走普通生成接口）。
 */
export function buildGenerationCameraPrompt(settings?: CameraGenerationSettings | LegacyCameraGenerationSettings): string {
  const resolved = migrateCameraSettings(settings);
  if (!resolved.enabled) return '';
  return [
    cameraBody(resolved.cameraKey)?.prompt,
    cameraLens(resolved.lensKey)?.prompt,
    cameraFocal(resolved.focalKey)?.prompt,
    cameraAperture(resolved.apertureKey)?.prompt,
  ].filter(Boolean).join('');
}

/** 旧版本存在节点上的摄影机设置（`{lens, shutterEffect, aperture, exposureTime}`）*/
interface LegacyCameraGenerationSettings {
  lens?: CameraLens;
  shutterEffect?: CameraShutterEffect;
  aperture?: CameraAperture;
  exposureTime?: CameraExposureTime;
}

/** 旧「镜头」值里能对上官方焦段的几档（15mm/85mm/200mm/macro/fisheye 官方没有 ⇒ 丢弃）*/
const LEGACY_FOCAL: Partial<Record<CameraLens, string>> = {
  '24mm': '24mm', '35mm': '35mm', '50mm': '50mm',
};
/** 旧「光圈」值 → 官方光圈 key（官方只有 f/1.4 · f/4 · f/11）*/
const LEGACY_APERTURE: Partial<Record<CameraAperture, string>> = {
  'f/1.4': 'f/1.4', 'f/4': 'f/4', 'f/11': 'f/11',
};

/**
 * 读取节点上的摄影机设置（**含旧数据迁移**）。
 * · 新格式（`enabled/cameraKey/lensKey/focalKey/apertureKey`）原样返回，缺失键补默认值；
 * · 旧格式（有 `lens/shutterEffect/aperture/exposureTime` 任一）按上表迁移：
 *   能对上的（24/35/50mm、f/1.4·f/4·f/11）映射过去，对不上的（15mm/85mm/200mm/macro/fisheye、
 *   快门效果、曝光时间）**官方没有对应项** ⇒ 丢弃并回落默认，`enabled` 置 true（用户当初是选了的）。
 */
export function migrateCameraSettings(
  raw?: CameraGenerationSettings | LegacyCameraGenerationSettings,
): CameraGenerationSettings {
  const fallback: CameraGenerationSettings = { enabled: false, ...CAMERA_DEFAULTS };
  if (!raw) return fallback;
  if ('cameraKey' in raw || 'lensKey' in raw) {
    const next = raw as CameraGenerationSettings;
    return {
      enabled: next.enabled === true,
      cameraKey: cameraBody(next.cameraKey) ? next.cameraKey : CAMERA_DEFAULTS.cameraKey,
      lensKey: cameraLens(next.lensKey) ? next.lensKey : CAMERA_DEFAULTS.lensKey,
      focalKey: cameraFocal(next.focalKey) ? next.focalKey : CAMERA_DEFAULTS.focalKey,
      apertureKey: cameraAperture(next.apertureKey) ? next.apertureKey : CAMERA_DEFAULTS.apertureKey,
    };
  }
  const legacy = raw as LegacyCameraGenerationSettings;
  const touched = Boolean(legacy.lens || legacy.shutterEffect || legacy.aperture || legacy.exposureTime);
  if (!touched) return fallback;
  return {
    enabled: true,
    cameraKey: CAMERA_DEFAULTS.cameraKey,
    lensKey: CAMERA_DEFAULTS.lensKey,
    focalKey: (legacy.lens && LEGACY_FOCAL[legacy.lens]) || CAMERA_DEFAULTS.focalKey,
    apertureKey: (legacy.aperture && LEGACY_APERTURE[legacy.aperture]) || CAMERA_DEFAULTS.apertureKey,
  };
}

function describeLightDirection(light: CameraStudioLightState): string {
  const yaw = normalizeCameraYaw(light.yaw);
  let direction = 'front';
  if (yaw >= 45 && yaw < 135) direction = 'right-side';
  else if (yaw <= -45 && yaw > -135) direction = 'left-side';
  else if (yaw >= 135 || yaw <= -135) direction = 'back';

  let elevation = '';
  if (light.pitch > 20) elevation = ' elevated';
  else if (light.pitch < -15) elevation = ' low';
  return `${direction}${elevation} key light`;
}

const TEMPERATURE_PROMPTS: Record<LightTemperature, string> = {
  cool: 'cool daylight color temperature',
  neutral: 'neutral studio color temperature',
  warm: 'warm tungsten color temperature',
};

export function buildCameraPrompt(camera: CameraStudioCameraState): string {
  const terms = [
    describeCameraYaw(camera.yaw),
    describeCameraPitch(camera.pitch),
    DISTANCE_PROMPTS[camera.distance],
    describeCameraLens(camera.lens),
  ];
  if (Math.abs(camera.roll) >= 1) terms.push(`${Math.round(camera.roll)} degree dutch angle`);
  if (camera.promptEnhance) terms.push('cinematic composition, coherent subject identity, high detail');
  return terms.join(', ');
}

export function buildLightingPrompt(light: CameraStudioLightState): string {
  const terms = [
    describeLightDirection(light),
    `${Math.round(light.intensity)}% intensity`,
    TEMPERATURE_PROMPTS[light.temperature],
  ];
  if (light.rimLight) terms.push('subtle rim light');
  if (light.fillLight) terms.push('soft fill light');
  return terms.join(', ');
}

export function buildStudioPrompt(
  mode: CameraStudioMode,
  camera: CameraStudioCameraState,
  light: CameraStudioLightState,
): string {
  if (mode === 'camera') return buildCameraPrompt(camera);
  if (mode === 'lighting') return buildLightingPrompt(light);
  return `${buildCameraPrompt(camera)}, ${buildLightingPrompt(light)}`;
}
