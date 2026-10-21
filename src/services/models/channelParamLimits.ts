/**
 * channelParamLimits —— **渠道**实际能收的参数（≠ 官方能力表）。
 *
 * 官方能力表（`utils/imageModelCapabilities.ts`，数据源 `official-image-models.json`，抽自官方 EXE）
 * 回答的是「**这个模型**支持什么」（`imageSizeOptions: ["1K","2K","4K"]` 等）。
 * 本模块回答的是另一件事：「**你接的这条渠道**实际能收什么」—— 官方没有这个概念（它自己就是渠道），
 * 所以这里只有**实测**来的、逐厂商的例外，没有任何推断。
 *
 * ★ 唯一已知实例：土豆（`api.ai-tudou.net`）的**异步**生图端点走「免费池」渠道，
 *   `resolution=4k` 或 `quality=high` 一律被网关挡回：
 *     `409 {"code":"free_pool_param_mismatch",
 *           "message":"Unsupported parameters for this channel; switching automatically."}`
 *   2026-10-20 用真实 key 逐参数实测（同一提示词，只改一个参数）：
 *     · `size=16:9` + `resolution=2k` + `quality=medium` → 200 `submitted`
 *     · `resolution=1k` + `medium` → 200 · `quality=low` → 200 · `2:1`/`21:9`/`9:16` → 200
 *     · `resolution=4k` + `medium` → **409**（换模型 `gpt-image-2-all` 同样 409）
 *     · `resolution=2k` + `quality=high` → **409**
 *   ⇒ 该渠道只收 `resolution ∈ {1k,2k}` + `quality ∈ {low,medium}`；官方那两个更高的档位
 *     在**这条**渠道上不可用。用户口径（2026-10-20）：菜单里**置灰**，不要剪掉。
 */

/**
 * 命中土豆异步生图的那几个模型名（上游真名，含 `-async` 后缀那个也在内）。
 * 只有 `-async` 后缀或 `gpt-image-2-all`（该模型**只有**异步端点）才吃这条限制 ——
 * 同步端点（`gpt-image-2.5-flare` 走 `/v1/images/generations`）收的是像素 `size`，没有 `resolution` 档位。
 */
const TUDOU_ASYNC_IMAGE_MODEL_RE = /^(?:gpt-image-2\.5-(?:flare|sunburst)|gpt-image-2-all)(?:-async)?$/i;

export interface ChannelParamLimits {
  /** 菜单里**置灰**的清晰度档位（该渠道会 409，但官方/模型本身支持）。 */
  readonly disabledImageSizes: readonly string[];
  /** 菜单里**置灰**的精细度档位。 */
  readonly disabledQualities: readonly string[];
  /** 当前值正好是置灰档位时收敛到哪一档（取该渠道能给到的**最高**档）。 */
  readonly fallbackImageSize: string;
  readonly fallbackQuality: string;
  /** 一句话说明（菜单 `title` 用），给用户解释为什么灰着。 */
  readonly reason: string;
}

/**
 * 按模型的**任意候选名**（`tudou/gpt-image-2.5-flare-async` · `general/<配置 id>` 对应的
 * `modelId` / 可读名 …）判定渠道限制；都判不出来返回 `null`（⇒ 不限制、不置灰）。
 */
export function channelParamLimitsFor(
  modelIds: readonly (string | null | undefined)[],
): ChannelParamLimits | null {
  const isTudouAsync = modelIds.some((raw) => {
    const ref = (raw ?? '').trim();
    /* 候选名可能是三种形态：上游真名（`gpt-image-2.5-flare-async`）·
       内置连接的模型引用（`tudou/gpt-image-2.5-flare-async`）·
       自定义连接的配置 id（`general/<配置 id>`，它里面没有模型名 ⇒ 由调用方另传 `modelId`）。*/
    const slash = ref.lastIndexOf('/');
    const id = slash >= 0 ? ref.slice(slash + 1) : ref;
    if (!TUDOU_ASYNC_IMAGE_MODEL_RE.test(id)) return false;
    return /-async$/i.test(id) || /^gpt-image-2-all$/i.test(id);
  });
  if (!isTudouAsync) return null;
  return {
    disabledImageSizes: ['4K'],
    disabledQualities: ['high', 'xhigh', 'max'],
    fallbackImageSize: '2K',
    fallbackQuality: 'medium',
    reason: '土豆异步生图当前走免费池渠道，只支持 1K / 2K 与「低 / 中」精细度；4K 与「高」及以上会被服务端拒绝（409）',
  };
}

/** 该值是否被渠道置灰（大小写不敏感）。 */
export function isChannelDisabled(
  disabled: readonly string[] | undefined,
  value: string | undefined | null,
): boolean {
  if (!disabled || !disabled.length || !value) return false;
  const target = value.trim().toLowerCase();
  return disabled.some((entry) => entry.trim().toLowerCase() === target);
}
