/**
 * 第三方模型的**简要说明**覆盖表（纯数据）。
 *
 * ⚠️ 这里**只放说明文案，不放名字** ——
 *    名字的唯一来源是 `services/models/display`（映射配置 → 官方 Registry → 原始调用 id）。
 *    原文件 `components/nodes/shared/modelDisplayOverrides.ts` 同时带 `name`（手写 id→名表），
 *    属于「把名称映射写死在业务组件里」，已按用户要求删除；说明文案保留并搬到这里。
 *
 * 用法：模型行标题下方那一格；官方模型走官方简介（`official-model-meta.json` 的 `description`），
 *      本表只补**官方没有的第三方**，文案一句、可核对。
 */
export interface ModelDescriptionOverride {
  /** 名字下方的一句简要说明 */
  description: string;
}

export const MODEL_DESCRIPTION_OVERRIDES: Record<string, ModelDescriptionOverride> = {
  /* 智谱 GLM（用户自配）*/
  'glm-4.6v': { description: '智谱 GLM 视觉理解模型' },
  'glm-4.6v-flash': { description: 'GLM-4.6v 轻量档，响应更快' },
  'glm-5.3': { description: '智谱 GLM 旗舰推理模型' },
  'glm-5.3-flash': { description: 'GLM-5.3 轻量档，响应更快' },
  /* 其它第三方（同样只有原始 id）*/
  'gpt-5.5': { description: 'GPT-5.5 通用文本与多模态模型' },
  'grok-4.5': { description: 'xAI 官方旗舰文本与推理模型' },
};

/** 取值：模型 value/id 一律取最后一段（`grsai/gpt-5.5` → `gpt-5.5`），小写匹配 */
export function modelDescriptionOverride(...candidates: Array<string | undefined | null>): ModelDescriptionOverride | null {
  for (const candidate of candidates) {
    const raw = (candidate ?? '').trim();
    if (!raw) continue;
    const tail = raw.split('/').pop() ?? raw;
    const hit = MODEL_DESCRIPTION_OVERRIDES[tail.toLowerCase()] ?? MODEL_DESCRIPTION_OVERRIDES[raw.toLowerCase()];
    if (hit) return hit;
  }
  return null;
}
