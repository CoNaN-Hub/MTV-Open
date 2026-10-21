/**
 * 出站「精细度」（quality）—— **不是土豆专用**，任何 OpenAI 兼容连接都走这条。
 *
 * ★★★ 用户 2026：
 *   1.「一样的模型/参考图/提示词，官方效果更好，MTV 差很多」→ 官方会把界面上的
 *      **精细度**（`quality`）发进请求，MTV 从来没发过 ⇒ 一切取决于上游默认值。
 *   2.「mtv 也同样发吧。然后我接入的是自定义 api 厂商…未来我可能会更换厂商，
 *      所以上面的修改不要单纯只针对土豆，未来适配进来的厂商也要适配」
 *      ⇒ 一律按**模型能力表**判定，不写死任何厂商 id。
 *
 * 设计（全部数据驱动，没有 per-vendor 分支）：
 *   · 官方界面词汇（7 键，`uBs.gpt2.qualityOptions`）：
 *       low 低 · medium 中 · high 高 · xhigh 超高 · max 极致 · hd 2K · standard 标准
 *   · OpenAI 兼容接口只认：`low | medium | high | auto`（gpt-image 系列）· `standard | hd`（dall-e 3）
 *     ⇒ 送之前必须映射：`xhigh`/`max` 只能降到 `high`（不能原样发，会 400）。
 *   · 该不该发：先查 MTV 的官方模型能力表 `qualityOptionsForModel(modelName)`
 *     （**按模型名匹配**，所以任何连接/厂商只要模型名对得上就能命中，与 provider id 无关）；
 *        - 表里有这个模型 ⇒ 只有该模型确实支持这一档才发；
 *        - 表里没有（自建连接的陌生模型名）⇒ 仅当名字**看起来就是 OpenAI 图像模型**
 *          （`gpt-image*` / `dall-e*`）才发 —— 其它厂商（gemini/flux/…）的接口不一定认
 *          `quality`，宁可不发也不要 400 把整条生成打断。
 *
 * ★ 用户 2026 追加：「界面显示低，但请求里其实没有 quality」——
 *   新图片卡没有 `data.quality`，选择器只**显示**默认值 ⇒ 上游按自己的默认跑。
 *   ⇒ 节点没存过档位时改用**模型默认档**（`defaultQualityForModel`）兜底，
 *     做到「界面显示什么就发什么」，与官方一致（官方 UI 永远有具体选中值）。
 */
import { defaultQualityForModel, qualityOptionsForModel } from '../../utils/imageModelCapabilities';

/** 官方 7 键 → OpenAI 兼容接口能接受的值 */
const OFFICIAL_QUALITY_TO_API: Record<string, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'high',
  max: 'high',
  hd: 'hd',
  standard: 'standard',
  auto: 'auto',
};

/** 接口确实认的取值（映射后的白名单，防止把官方私有词汇原样发出去） */
const API_QUALITY_VALUES = new Set(Object.values(OFFICIAL_QUALITY_TO_API));

/** 表里查不到时，只对这类**看起来就是 OpenAI 图像模型**的名字放行 */
const OPENAI_IMAGE_MODEL_RE = /^(gpt-image|dall-e)/i;

/** 把官方界面的精细度换算成能发出去的值；不该发时返回 undefined */
export function mapOfficialQualityToApi(quality?: string): string | undefined {
  const value = (quality ?? '').trim().toLowerCase();
  if (!value) return undefined;
  const mapped = OFFICIAL_QUALITY_TO_API[value];
  return mapped && API_QUALITY_VALUES.has(mapped) ? mapped : undefined;
}

/**
 * 本次请求该发的 `quality`（undefined = 不发）。
 * @param modelName 上游真实模型名（如 `gpt-image-2.5-flare`）——与 provider id 无关
 * @param quality   界面上的精细度（官方 7 键）；节点里没存过时用**模型默认档**兜底，
 *                  保证「界面显示的档位 == 实际发出去的档位」（官方从不会空着发）。
 */
export function resolveOutgoingImageQuality(modelName: string, quality?: string): string | undefined {
  const supported = qualityOptionsForModel(modelName);
  const requested = (quality ?? '').trim().toLowerCase();
  const effective = requested || defaultQualityForModel(modelName) || '';
  const mapped = mapOfficialQualityToApi(effective);
  if (!mapped) return undefined;

  if (supported && supported.length > 0) {
    /* 能力表命中：该模型支持这一档才发（例如 flux 系列根本没有 qualityOptions ⇒ 不发） */
    return supported.includes(effective) ? mapped : undefined;
  }
  return OPENAI_IMAGE_MODEL_RE.test(modelName) ? mapped : undefined;
}
