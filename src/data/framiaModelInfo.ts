/**
 * Framia 站点「选择模型」说明卡的**模型情报目录**（唯一真源）。
 *
 * ## 数据从哪来（都是抓到的，不是编的）
 * 1. `framia-model-info.json` = 两条 Framia 线上源的合并：
 *    - `https://api.framia.pro/video/api/v2/common/get_model_configs`（无鉴权，200）→ `display_name` / `aliases` /
 *      `supported_resolutions` / `max_reference_inputs`；
 *    - Framia 前端 bundle `3hkw08s41r9m8.js` 里的模型情报表（逐字）→ `description` / `bestFor` / `speed` / `quality` / `cost`
 *      （47 条，含图像 / 视频 / 音频 / 3D）。
 * 2. `zh` 字段 = 用户在 Framia 界面截到的**官方中文卡片**（目前 4 条：GPT Image 2.5 Flare / Sunburst、
 *    Nano Banana Pro、Seedance 2.0 Mini）。其余条目 Framia 前端表里只有英文原文（抓到的 9 个 chunk 内零中文），
 *    所以没 `zh` 的条目按官方英文显示；拿到 Framia 的 zh 语言包后往 `framia-model-info.json` 里补 `zh` 即可。
 *
 * ## 匹配口径（用户裁决）
 * - **只按抓到的情报出卡**：MTV 的模型对上目录就出卡，对不上就**什么都不弹**（不写兜底档位、不拿短简介凑数）；
 *   ⚠️ 2026-10 二次裁决：**「出不出卡」不再由本目录决定** —— 画布说明卡改为
 *   `services/models/modelInfoCard.buildModelInfoCard` 装配（官方身份/官方参数/官方简介 → 本目录
 *   → MTV 自己的 description），查不到官方条目时出**最小卡**并注明「官方目录未收录」。
 *   本目录现在的角色 = **速度/质量/成本三档 + 「适合」文案**的首选来源（官方目录没有这三项）。
 * - 匹配是**精确匹配**（名字 / 别名，逐 token 归一化后相等），不做前缀包含 ——
 *   否则「GPT Image 2」会把「GPT Image 2.5 Flare」抢走；
 * - 将来接入：把 `framia-model-info.json` 换成接口拉回来的同结构数据即可，界面不用改。
 */
import raw from './framia-model-info.json';

export type FramiaModelKind = 'image' | 'video';

export interface FramiaModelInfo {
  /** Framia 站点模型名（逐字） */
  name: string;
  /** 厂商（google / openai / bytedance …） */
  provider: string;
  /** 图像 / 视频 */
  kind: FramiaModelKind | string;
  /** 可用于匹配 MTV 模型的别名（来自 get_model_configs 的 aliases + name） */
  aliases: string[];
  /** 可选分辨率档 */
  resolutions: string[];
  /** 参考图上限 */
  maxReferenceInputs: number;
  /** 卡片正文（官方英文原文） */
  description: string;
  /** 官方「适合」原文（英文） */
  bestFor: string;
  /** 速度 1–5 */
  speed: number;
  /** 质量 1–5 */
  quality: number;
  /** 成本档：Low / Medium / High */
  cost: 'Low' | 'Medium' | 'High' | string;
  /** 官方中文（界面截图逐字；缺则回退英文） */
  zh?: { description: string; bestFor?: string };
}

export const FRAMIA_MODEL_INFO = raw as unknown as FramiaModelInfo[];

/** 归一化：大小写、`.` `_` `-` `/` `[]()` 和空白一律压成单个空格 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s._\-/[\]()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 一个 MTV 模型可能的匹配候选：原值、`/` 之后那段、展示名；
 *  另外把 `async` 片段去掉再来一轮 —— `GPT Image 2.5 Flare async` 与 `… Flare` 是同一个模型，
 *  区别只在请求方式（卡片上用「异步请求」徽标表达）。 */
function candidatesOf(model: { value: string; label: string }): string[] {
  const value = model.value ?? '';
  const tail = value.split('/').pop() ?? value;
  const raw = [value, tail, model.label ?? ''];
  const stripped = raw.map((item) => item.replace(/\basync\b/gi, ' '));
  return [...new Set([...raw, ...stripped].map(normalize).filter(Boolean))];
}

/** 取某个 MTV 模型的 Framia 情报；取不到返回 null（= 不出卡，等接入）。 */
export function framiaModelInfoFor(model: { value: string; label: string } | null | undefined): FramiaModelInfo | null {
  if (!model) return null;
  const candidates = candidatesOf(model);
  if (candidates.length === 0) return null;
  for (const entry of FRAMIA_MODEL_INFO) {
    const keys = new Set([entry.name, ...(entry.aliases ?? [])].map(normalize));
    if (candidates.some((candidate) => keys.has(candidate))) return entry;
  }
  return null;
}

/** 界面侧判断入口：该目录里有没有这个模型的情报。
 *  ⚠️ **不再用作「出不出说明卡」的闸门**（见文件头：画布说明卡永远出卡，官方目录未收录时出最小卡）。 */
export function hasFramiaModelInfo(model: { value: string; label: string } | null | undefined): boolean {
  return framiaModelInfoFor(model) !== null;
}

/** 成本档 → 展示文案与颜色（官方卡片：Low 绿 / Medium 黄 / High 红） */
export function framiaCostAppearance(cost: string): { text: string; className: string } {
  if (cost === 'Low') return { text: '低', className: 'text-emerald-400' };
  if (cost === 'High') return { text: '高', className: 'text-rose-400' };
  return { text: '中', className: 'text-amber-400' };
}
