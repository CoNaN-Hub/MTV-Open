/**
 * ai/officialImageSizes —— 官方画布「档位 × 比例」像素表（1:1 抄自官方运行时）
 *
 * 来源：官方桌面端 `tapnow://app/assets/index-*.js` 里的常量 `xYe`
 * （同源常量还有 `tI=3840` 最长边、`az=16` 对齐、`L2t=2880*2880` 最大像素、
 *  `F2t={"1K":1024*1024,"2K":2048*2048,"4K":2880*2880}` 像素预算、默认档位 `"2K"`）。
 *
 * ## 为什么必须用这张表
 * 实测同一节点、同一提示词、同一参考图：
 *   · 官方 1K · 3:4 发出 `size: "864x1152"`（≈0.995 MP）
 *   · MTV 旧算法（短边 1024 × 比例）发出 `1024x1365`，再按 16 对齐成 `1024x1360`（≈1.39 MP）
 * 2K 差距更大：官方 `1728x2304`（3.98 MP） vs MTV `2048x2731`（5.59 MP）。
 * 这些模型的原生出图尺寸就是这张表里的值；要一张表外的更大的图，上游只能**放大重绘**，
 * 表现就是用户报的「涂抹痕迹 / 双重曝光文字」。⇒ 一律按官方表发尺寸。
 *
 * ## 适用范围（★ 用户 2026 实测后收窄，别搞反顺序）
 * 出站 `size` 的**第一优先级是「厂商自己声明的像素」**（`mediaModelCapabilities.imageDimensionPreset`）：
 * 中转站只认自己文档里的值，发别的值不报错但会**静默回落到不受控的默认尺寸**
 * （实测：`768x1024`⇒768x1024 ✓、`2480x3312`⇒2480x3312 ✓，
 *  而 `864x1152`⇒1536x2048 ✗、`1728x2304`⇒2480x3312 ✗）。
 * 本表是**厂商没声明时的同源兜底**，用来让 MTV 与官方画布在参数上一致，
 * 而不是「官方发什么就一定最优」—— 用户的接入方是中转站，认的才是权威。
 * 只对**官方走这张表的模型族**生效（`gpt-image-*` / `dall-e-*`，见 `isOfficialImageSizeModel`）。
 */

/** 官方档位 → 比例 → 像素串。未列出的比例不出现在官方 UI 上，调用方需回退旧算法。 */
export const OFFICIAL_IMAGE_SIZES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  '1K': {
    '1:1': '1024x1024',
    '4:3': '1152x864',
    '3:4': '864x1152',
    '5:4': '1152x912',
    '4:5': '912x1152',
    '3:2': '1248x832',
    '2:3': '832x1248',
    '16:9': '1360x768',
    '9:16': '768x1360',
    '2:1': '1440x720',
    '21:9': '1568x672',
    '9:21': '672x1568',
  },
  '2K': {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '5:4': '2288x1824',
    '4:5': '1824x2288',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '16:9': '2736x1536',
    '9:16': '1536x2736',
    '2:1': '2880x1440',
    '21:9': '3136x1344',
    '9:21': '1344x3136',
  },
  '4K': {
    '1:1': '2880x2880',
    '4:3': '3312x2480',
    '3:4': '2480x3312',
    '5:4': '3216x2576',
    '4:5': '2576x3216',
    '3:2': '3520x2352',
    '2:3': '2352x3520',
    '16:9': '3840x2160',
    '9:16': '2160x3840',
    '2:1': '3840x1920',
    '21:9': '3840x1648',
    '9:21': '1648x3840',
  },
};

/**
 * 是否官方像素表的适用模型。
 * 官方这一族只有 OpenAI 命名（`gpt-image-2.5-flare` 等），自定义中转站沿用同名模型即自动命中。
 */
export function isOfficialImageSizeModel(modelName: string | undefined): boolean {
  if (!modelName) return false;
  return /^(gpt-image|dall-e)/i.test(modelName.trim());
}

/** MTV 档位串 → 官方档位串（`720p` 归到 `1K`，与官方 `xYe` 无 720p 档一致）。 */
export function toOfficialImageSizeTier(imageSize: string | undefined): string | undefined {
  if (!imageSize) return undefined;
  const normalized = imageSize === '720p' ? '1K' : imageSize;
  return OFFICIAL_IMAGE_SIZES[normalized] ? normalized : undefined;
}

/** MTV 界面上的「自适应」值 → 官方 `auto`（官方 `xYe.auto = {auto:"auto"}` ⇒ 直接发 `"auto"`）。 */
const AUTO_RATIOS = new Set(['自适应', 'auto', 'Auto']);

/**
 * 取官方像素串；模型/档位/比例任一不在表内返回 `undefined`（调用方回退旧算法）。
 *
 * 特别注意「自适应」：官方**发 `size:"auto"`**（让模型自己定原生尺寸），
 * 而 MTV 旧算法把它当非法比例 ⇒ 退成 `1024x1024`（1:1），构图与官方不一致。
 * 这里按官方返回 `"auto"`。
 */
export function officialImageSize(
  modelName: string | undefined,
  imageSize: string | undefined,
  aspectRatio: string | undefined,
): string | undefined {
  if (!isOfficialImageSizeModel(modelName)) return undefined;
  if (aspectRatio && AUTO_RATIOS.has(aspectRatio)) return 'auto';
  const tier = toOfficialImageSizeTier(imageSize);
  if (!tier || !aspectRatio) return undefined;
  return OFFICIAL_IMAGE_SIZES[tier][aspectRatio];
}

/** 像素串 → 宽高；串非法时返回 `undefined`。 */
export function dimensionsFromImageSize(
  size: string | undefined,
): { width: number; height: number } | undefined {
  if (!size) return undefined;
  const match = /^(\d+)x(\d+)$/.exec(size.trim());
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return undefined;
  return { width, height };
}
