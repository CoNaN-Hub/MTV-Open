/**
 * 多角度（multi-angle）端点客户端 —— 官方契约 1:1，内部适配 MTV 的**任意厂商/模型**
 * ══════════════════════════════════════════════════════════════════════════
 * 官方源码（`TapNow-0.4.66/resources/web/assets/course-api-base-url-CGXqZmAy.js`）：
 *  · 参数默认值 / 归一化 @3073744：
 *      `sy = { rotate_right_left:-30, move_forward:0, vertical_angle:.5, wide_angle_lens:!1 }`
 *      `ZI(v,min,max,fallback) = typeof v!='number'||!isFinite(v) ? fallback : min(max, max(min, v))`
 *      `Ent(p) = { rotate_right_left:ZI(p?.rotate_right_left,-90,90,sy.rotate_right_left),
 *                  move_forward:ZI(p?.move_forward,0,10,sy.move_forward),
 *                  vertical_angle:ZI(p?.vertical_angle,-1,1,sy.vertical_angle),
 *                  wide_angle_lens: typeof p?.wide_angle_lens=='boolean' ? p.wide_angle_lens : sy.wide_angle_lens }`
 *  · 面板里的取整：`W(v) = typeof v=='number' ? (v*100)/100 : void 0`（两位小数）
 *  · 生成时调用 @3074800：
 *      `loe({ image_urls:[src],
 *             rotate_right_left: -I.rotate_right_left,      // ★ 取负（预览坐标系 → 请求坐标系）
 *             move_forward: I.move_forward, vertical_angle: I.vertical_angle,
 *             wide_angle_lens: I.wide_angle_lens,
 *             metadata: { node_id, ...(canvasId && { canvas_id }) } }).send()`
 *      响应处理：`res.code===0 && res.data?.result?.ids?.[0]` ⇒ 成功；否则**删掉刚建的节点**。
 * ──────────────────────────────────────────────────────────────────────────
 * ★ MTV 侧的「适配」：官方 `loe` 是 TapNow 云端服务（结构化参数进去、图出来）。
 *   MTV 没有该服务，但**契约不变** —— `loe(payload).send()` 的入参字段、取负规则、返回形状逐字一致；
 *   `send()` 内部把 payload 交给 MTV 的生成管线 `executeGeneration(nodeId, prompt)`，
 *   该管线按**节点当前选中的 model/provider** 发请求 ⇒ 用户在设置里新加的任何厂商/模型都能直接跑
 *   （厂商字段差异全部由 MTV 既有的 provider 适配层吃掉）。
 *   结构化参数 → 提示词模板见 `multiAnglePrompt`（这是 MTV 侧必需的翻译层，官方由云端做）。
 */
import type { AIImageGenParams } from '../../types/aiTypes';
import { generateImagesBatch } from './generateImage';
import { useAppStore } from '../../store/useAppStore';

export interface MultiAngleParams {
  /** 左右旋转（度）：-90（左）…90（右），默认 -30 */
  rotate_right_left: number;
  /** 前进（0…10，1 = 放大 10%），默认 0 */
  move_forward: number;
  /** 俯仰（-1…1，面板显示 = 值 × 45°，默认 0.5 = 22.5°） */
  vertical_angle: number;
  /** 广角镜头 */
  wide_angle_lens: boolean;
}

/** 官方 `sy`（逐字） */
export const MULTI_ANGLE_DEFAULTS: MultiAngleParams = {
  rotate_right_left: -30,
  move_forward: 0,
  vertical_angle: 0.5,
  wide_angle_lens: false,
};

/** 官方三条滑块的 min/max/step（@3075250 `QI` 的调用处，逐字） */
export const MULTI_ANGLE_RANGES = {
  rotate_right_left: { min: -90, max: 90, step: 1, defaultValue: 0 },
  vertical_angle: { min: -1, max: 1, step: 0.01, defaultValue: 0 },
  move_forward: { min: 0, max: 10, step: 0.1, defaultValue: 0 },
} as const;

/** 官方 `ZI`（逐字） */
function clampOr(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value !== 'number' || !Number.isFinite(value)
    ? fallback
    : Math.min(max, Math.max(min, value));
}

/** 官方 `Ent`（逐字，`initialParams` / policy `params` 都走它） */
export function normalizeMultiAngleParams(input?: Partial<MultiAngleParams> | null): MultiAngleParams {
  return {
    rotate_right_left: clampOr(input?.rotate_right_left, -90, 90, MULTI_ANGLE_DEFAULTS.rotate_right_left),
    move_forward: clampOr(input?.move_forward, 0, 10, MULTI_ANGLE_DEFAULTS.move_forward),
    vertical_angle: clampOr(input?.vertical_angle, -1, 1, MULTI_ANGLE_DEFAULTS.vertical_angle),
    wide_angle_lens: typeof input?.wide_angle_lens === 'boolean'
      ? input.wide_angle_lens
      : MULTI_ANGLE_DEFAULTS.wide_angle_lens,
  };
}

/** 官方 `W`：两位小数（拖拽立方体时用） */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 官方 `loe(...)` 的入参（字段名/顺序/取负规则逐字） */
export interface MultiAngleRequest {
  image_urls: string[];
  rotate_right_left: number;
  move_forward: number;
  vertical_angle: number;
  wide_angle_lens: boolean;
  metadata: { node_id: string; canvas_id?: string };
}

/** 官方调用点的 payload 构造（含 `rotate_right_left` **取负**） */
export function buildMultiAngleRequest(
  params: MultiAngleParams,
  options: { imageUrls: string[]; nodeId: string; canvasId?: string },
): MultiAngleRequest {
  return {
    image_urls: options.imageUrls,
    rotate_right_left: -params.rotate_right_left,
    move_forward: params.move_forward,
    vertical_angle: params.vertical_angle,
    wide_angle_lens: params.wide_angle_lens,
    metadata: { node_id: options.nodeId, ...(options.canvasId ? { canvas_id: options.canvasId } : {}) },
  };
}

/**
 * 适配层：官方把结构化参数发给云端，MTV 交给「任意厂商图生图」时需要一个提示词。
 * 规则（与官方语义一一对应）：
 *   rotate_right_left 负值 = 相机向左转、正值 = 向右转；move_forward = 向主体推进（每 1 = 放大 10%）；
 *   vertical_angle 正值 = 从上方俯视（×45°）；wide_angle_lens = 用广角镜头。
 */
export function multiAnglePrompt(payload: MultiAngleRequest): string {
  /* payload 里 `rotate_right_left` 是**取负后**的值（官方契约）⇒ 这里还原回用户看到的 UI 参数，
     再按「负 = 向左、正 = 向右」描述（与滑块左端 = 负值直觉一致）。 */
  const uiRotate = -payload.rotate_right_left;
  const direction = uiRotate === 0
    ? 'no horizontal rotation'
    : `${Math.abs(uiRotate)} degrees to the ${uiRotate > 0 ? 'right' : 'left'}`;
  const tilt = payload.vertical_angle === 0
    ? 'eye level'
    : `${Math.abs(payload.vertical_angle) * 45} degrees viewing from ${payload.vertical_angle > 0 ? 'above' : 'below'}`;
  const zoom = payload.move_forward === 0 ? 'keep the current distance' : `move forward by ${payload.move_forward}`;
  return [
    'Regenerate the SAME subject from a new camera angle. Keep the subject, identity, materials, lighting style and scene unchanged.',
    `Camera: rotate ${direction}; tilt ${tilt}; ${zoom}.`,
    payload.wide_angle_lens ? 'Use a wide-angle lens.' : 'Keep the current focal length.',
    'Only the viewpoint may change; do not add or remove objects.',
  ].join(' ');
}

/** `AIImageGenParams` 里 MTV 用的字段子集（保持可适配：model/provider 由调用方给的节点决定） */
export interface MultiAngleRunnerOptions {
  model?: string;
  provider?: string;
  imageSize?: string;
  aspectRatio?: string;
}

export interface LoeResponse {
  code: number;
  data?: { result?: { ids?: string[] } };
}

/**
 * 官方 `loe(payload).send()`：
 *   · 入参 / 返回形状与官方一致；
 *   · `send(runner?)` 不传 runner 时走 MTV 默认适配器（`generateImagesBatch`，按 payload.metadata.node_id
 *     对应节点的 model/provider 发请求）；传 runner 可注入自定义厂商调用（测试/特殊厂商）。
 */
export function loe(payload: MultiAngleRequest) {
  return {
    send: async (
      runner?: (params: AIImageGenParams) => Promise<string[]>,
      options: MultiAngleRunnerOptions = {},
    ): Promise<LoeResponse> => {
      const node = useAppStore.getState().nodes.find((item) => item.id === payload.metadata.node_id);
      const nodeData = (node?.data ?? {}) as Record<string, unknown>;
      const params: AIImageGenParams = {
        prompt: multiAnglePrompt(payload),
        model: options.model ?? (nodeData.model as string | undefined) ?? '',
        provider: options.provider ?? (nodeData.provider as string | undefined) ?? '',
        imageSize: options.imageSize ?? (nodeData.imageSize as string | undefined),
        aspectRatio: options.aspectRatio ?? (nodeData.aspectRatio as string | undefined),
        nodeId: payload.metadata.node_id,
        image_urls: payload.image_urls,
      };
      const run = runner ?? (async (input: AIImageGenParams) => {
        const batch = await generateImagesBatch(input, 1);
        return batch.results.map((item) => item.url).filter((url): url is string => Boolean(url));
      });
      const urls = await run(params);
      if (!urls.length) return { code: 1, data: { result: { ids: [] } } };
      return { code: 0, data: { result: { ids: urls } } };
    },
  };
}
