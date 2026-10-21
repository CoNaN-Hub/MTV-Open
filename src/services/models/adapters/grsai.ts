/**
 * Adapter: GRSAI —— 自有 JSON 协议（`/v1/api/generate`）+ 厂商给定像素表。
 * 规则原来写死在 `services/ai/imageRequestContracts.ts`。
 *
 * ⚠️ 这里的比例/像素表是**厂商文档给的**（`https://qmy27nhsd9.apifox.cn/452409160e0`），
 *    不是从模型名猜出来的；模型清单也是文档列的，不是靠 `includes('nano-banana')` 匹配。
 */
import { mapImageDimensions } from '../../aiDimensions';
import type { BuiltInImageRequestContract, ImageContractContext } from './contract';
import { createOpenAiCompatibleAdapter } from './openaiCompatible';
import type { ProviderAdapter } from '../types';

/** 文档列的 Nano 系列（`https://qmy27nhsd9.apifox.cn/452392911e0`） */
const NANO_MODELS = new Set([
  'nano-banana', 'nano-banana-fast', 'nano-banana-2', 'nano-banana-2-cl',
  'nano-banana-2-2k-cl', 'nano-banana-2-4k-cl', 'nano-banana-pro',
  'nano-banana-pro-vt', 'nano-banana-pro-cl', 'nano-banana-pro-vip', 'nano-banana-pro-4k-vip',
]);
const GPT_MODELS = new Set([
  'gpt-image-2', 'gpt-image-2-vip', 'gpt-image-2.5',
  'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst',
]);

/** GRSAI 的 GPT 档位是厂商给定的像素表，不能使用全局「短边 2K/4K」换算。 */
const GPT_SIZES: Readonly<Record<string, readonly [string, string, string]>> = {
  '1:1': ['1024x1024', '2048x2048', '2880x2880'],
  '16:9': ['1280x720', '2048x1152', '3840x2160'],
  '9:16': ['720x1280', '1152x2048', '2160x3840'],
  '4:3': ['1152x864', '2304x1728', '3264x2448'],
  '3:4': ['864x1152', '1728x2304', '2448x3264'],
  '3:2': ['1536x1024', '2048x1360', '3504x2336'],
  '2:3': ['1024x1536', '1360x2048', '2336x3504'],
  '5:4': ['1120x896', '2240x1792', '3200x2560'],
  '4:5': ['896x1120', '1792x2240', '2560x3200'],
  '21:9': ['1456x624', '2912x1248', '3840x1648'],
  '9:21': ['624x1456', '1248x2912', '1648x3840'],
  '2:1': ['1536x768', '3072x1536', '3840x1920'],
  '1:2': ['768x1536', '1536x3072', '1920x3840'],
};
const GPT_BASE_SIZES: Readonly<Record<string, string>> = {
  '1:1': '1024x1024', '16:9': '1672x941', '9:16': '941x1672',
  '4:3': '1443x1090', '3:4': '1090x1443', '3:2': '1536x1024',
  '2:3': '1024x1536', '5:4': '1408x1120', '4:5': '1120x1408',
  '21:9': '1920x832', '9:21': '832x1920', '1:2': '896x1792', '2:1': '1792x896',
};
const NANO_RATIOS = new Set(['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9']);
const NANO_2_EXTRA_RATIOS = new Set(['1:4', '4:1', '1:8', '8:1']);

/**
 * **round 122 追加（用户批准）**：GRSAI 合同把档位当必填（`sizeIndex < 0` 直接抛错），
 * 而公共函数 `generateImagesBatch` 不再替调用方编 `2K` ⇒ 由**该合同自己**声明兜底。
 *
 * 依据说明（如实登记）：GRSAI 侧文档未声明缺省档位，此值 = 搬迁前公共函数的解构默认值，
 * 目的是**保持既有行为不变**（搬到合同里只是让「谁在造值」可见），不是「上游文档声明」。
 * 平台声明缺省后应替换成文档值。
 */
const GRSAI_FALLBACK_IMAGE_SIZE = '2K';

/**
 * 比例的**协议兜底**：和 `resolution`/`size` 一样，GRSAI 请求体必须有比例，
 * 而上游文档**同样未声明**缺省比例 ⇒ 由**本合同自己**声明。
 * 这里用 **`'auto'`（= 让上游自己定）**，不是 `1:1`：
 *  · 官方目录里这些模型的 `defaults.aspectRatio` 就是 **`"Auto"`**（`nano-banana-*` / `grok-*` / `world-edit` 全是）；
 *  · 本 Adapter 两个分支**本来就支持 `'auto'`**（`NANO_RATIOS` 含 `'auto'`；GPT 分支对 `auto` 有专门分支）；
 *  · 用户裁决明确「不许替用户断言一个他没要的 1:1」⇒ 「未指定」应当表达成「未指定」，而不是方图。
 *  · 用户真给了**平台不支持**的比例（例如 `7:4`）仍按下面的白名单**报错，不替换**。
 * （搬迁前公共函数把这三种情况都写成 `'1:1'`；这里只改「完全没有来源」这一档，有来源时逐字不变。）
 */
const GRSAI_FALLBACK_ASPECT_RATIO = 'auto';

function dimensionsFromSize(size: string): { width: number; height: number } {
  const [width, height] = size.split('x').map(Number);
  return { width, height };
}

export function grsaiImageContract(ctx: ImageContractContext): BuiltInImageRequestContract | undefined {
  /* ⚠️ 用 `baseModelId` 查表：平台的执行规格后缀（如 `-async`）不该影响厂商能力判定 */
  const modelId = ctx.baseModelId;
  const isNano = NANO_MODELS.has(modelId);
  if (!isNano && !GPT_MODELS.has(modelId)) return undefined;

  const normalizedSize = ctx.imageSize === '720p' ? '1K' : ctx.imageSize ?? GRSAI_FALLBACK_IMAGE_SIZE;
  const sizeIndex = ['1K', '2K', '4K'].indexOf(normalizedSize);
  if (sizeIndex < 0) throw new Error(`GRSAI 不支持图片档位 ${ctx.imageSize}`);
  /* round 122 追加：比例用**协议兜底** `GRSAI_FALLBACK_ASPECT_RATIO`（`'auto'`），
     仍然**不猜一个具体比例**：`'auto'` 表达「未指定」，由上游决定；用户真给了比例时逐字用它。 */
  const ratio = ctx.aspectRatio ?? GRSAI_FALLBACK_ASPECT_RATIO;
  let dimensions = mapImageDimensions(normalizedSize, ctx.aspectRatio);
  let sizeFields: Record<string, string>;
  if (isNano) {
    const supportsRatio = NANO_RATIOS.has(ratio)
      || (modelId.startsWith('nano-banana-2') && NANO_2_EXTRA_RATIOS.has(ratio));
    if (!supportsRatio) throw new Error(`GRSAI ${modelId} 不支持比例 ${ctx.aspectRatio || '（本次没有比例来源，请在项目设置或卡片上指定）'}`);
    sizeFields = { aspectRatio: ratio, imageSize: normalizedSize };
  } else {
    const isBase = modelId === 'gpt-image-2' || modelId === 'gpt-image-2.5';
    const size = isBase
      ? GPT_BASE_SIZES[ratio]
      : GPT_SIZES[ratio]?.[sizeIndex];
    if (ratio !== 'auto' && !size) throw new Error(`GRSAI ${modelId} 不支持比例 ${ctx.aspectRatio || '（本次没有比例来源，请在项目设置或卡片上指定）'}`);
    if (size) dimensions = dimensionsFromSize(size);
    // 基础款只支持 1K，直接提交比例；VIP/2.5 增强款要求精确像素。
    sizeFields = {
      aspectRatio: isBase || ratio === 'auto' ? ratio : size!,
      quality: isBase ? 'auto' : 'medium',
    };
  }
  return {
    kind: 'protocol',
    referenceInput: 'data-url',
    dimensions,
    protocol: {
      version: 2,
      mode: 'sync',
      auth: { type: 'bearer' },
      submit: {
        method: 'POST', path: '/api/generate', bodyEncoding: 'json',
        body: {
          /* 保持原有模板变量写法：调用方 `generateImage` 用同一个 `modelName` 喂 `{{model}}`，
             与 `ctx.providerModelId` 同源 ⇒ 出站 id 仍是平台原文 ✓ */
          model: '{{model}}', prompt: '{{prompt}}', images: '{{imageUrls}}',
          ...sizeFields, replyType: 'json',
        },
      },
      response: { type: 'json', result: { urlPath: 'results.*.url' }, errorPath: 'error' },
    },
  };
}

export const grsaiAdapter: ProviderAdapter = {
  ...createOpenAiCompatibleAdapter('grsai', 'GRSAI'),
};
