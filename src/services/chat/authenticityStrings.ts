/**
 * authenticityStrings —— 官方 `authenticityCheck.*` 文案表（`vendor-pkg-canvas-ChpWx5JY.js` 逐字抽取）。
 *
 * 官方位置（同一个 i18n 资源对象里，4 个语言的 `authenticityCheck` 命名空间各一份）：
 *   enUS `bvt`@3612257 · jaJP `vwt`@3984498 · koKR `v_t`@4121650 · zhCN `CCt`@4255016
 *   （命名空间对象紧跟在 `imageModels.*` 之后、`elementLibrary.*` 之前，各语言的资源桶在
 *     @3713092 / @4057456 / @4195262 / @4318810 处按 `authenticityCheck:<符号>` 注册。）
 * MTV 只保留自有的 4 个语言（en/ja/ko/zh-CN），与 `mentionStrings.ts` / `agentEventStrings.ts` 口径一致。
 *
 * ⚠️ 官方 `Ob`（@213827）只用到这个命名空间里的 7 个叶子键：
 *   `tooltip.{approved,pending,rejected,invalidParameter}` 与 `statusText.{pending,rejected,invalidParameter}`。
 *   本文件按 `mentionStrings.ts` 的口径**整块逐字保留**（含 `title` / `description` /
 *   `invalidParameter{Image,Video,Audio}` 多行规格说明等），避免二次拼接出错。
 *
 * ⚠️⚠️ **官方 jaJP / koKR 两份命名空间里根本没有 `invalidParameter*` 键**
 *   （`tooltip` 只有 `approved|rejected|pending`；`statusText` 只有 `rejected|pending`），
 *   frFR 也一样。因此 {@link authenticityString} 的「当前语言 → 英文」回退在这两个键上是**生效路径**，
 *   不是兜底装饰：ja/ko 下 `tooltip.invalidParameter` / `statusText.invalidParameter` 会取到英文原文。
 *   这是逐字复刻的结果，**不要**自行补译（补译就不是官方值了）。
 */
/* 官方原文里的缩进符是**全角间隔符 U+3000**（形如 `Format<U+3000>mp4 / mov`、`格式<U+3000>wav / mp3`），
   属于 `no-irregular-whitespace` 的「非常规空白」；但它是官方 bundle 里的**原始字节**，必须逐字保留
   （绝不能换成普通空格）⇒ 只在这张逐字数据表上关掉该规则。 */
/* eslint-disable no-irregular-whitespace */
export const AUTHENTICITY_STRINGS: Record<string, Record<string, unknown>> = {
  enUS: {tooltip:{approved:"Character verified, ready for Seedance 2.0 video generation",rejected:"Real photo or copyrighted IP detected",invalidParameterVideo:`Video spec limited. Please ensure it meets:
Format　mp4 / mov
Res　480p – 720p
Length　2 – 15 s
Ratio　0.4 – 2.5 (W ÷ H)
Max　50 MB`,invalidParameter:"This file does not meet the verification requirements for format, size, or duration.",invalidParameterImage:`Image spec limited. Please ensure it meets:
Format　jpeg / png / webp / bmp / tiff / gif
Size　300 – 6000 px (W & H)
Ratio　0.4 – 2.5 (W ÷ H)
Max　30 MB`,invalidParameterAudio:`Audio spec limited. Please ensure it meets:
Format　wav / mp3
Length　2 – 15 s
Max　15 MB`,pending:"Verification submitted — please wait"},acceptedLabel:"ACCEPTED",title:"Seedance 2.0 Verification",description:'Some advanced models (e.g. Seedance 2.0) strictly block real-person likenesses and copyrighted characters. Verifying your character image marks it as "compliant," allowing future generations to bypass compliance screening and avoid errors.',acceptedText:"Original characters, AI-generated characters (photorealistic included)",prohibitedText:"Real photos, celebrity / public figure likenesses, copyrighted IPs",confirm:"Seedance 2.0 Verification",dontShowAgain:"Don't show this again",prohibitedLabel:"PROHIBITED",footnote:"*By continuing, you confirm that you have read the rules and that your submission is compliant.",statusText:{rejected:"Rejected",invalidParameter:"Spec Limited",pending:"Under Review"}},
  jaJP: {tooltip:{approved:"検証済み — Seedance 2.0 動画生成に使用可能",rejected:"実写写真または著作権保護された IP を検出",pending:"検証を送信しました — しばらくお待ちください"},acceptedLabel:"提出可",title:"Seedance 2.0 検証",description:"一部の上位モデル（例：Seedance 2.0）は実在人物の肖像や著作権キャラクターを厳格にブロックします。事前に検証すると画像が「準拠済み」となり、以降の生成時にスキャンを省略でき、エラーを防げます。",acceptedText:"オリジナルキャラクター、AI 生成キャラクター（実写風を含む）",prohibitedText:"実写写真、有名人の肖像、著作権で保護された IP",confirm:"Seedance 2.0 検証",dontShowAgain:"今後表示しない",prohibitedLabel:"提出不可",footnote:"*続行することで、上記ルールを確認し、提出内容が準拠していることに同意します。",statusText:{rejected:"不合格",pending:"検証中"}},
  koKR: {tooltip:{approved:"검증 완료 — Seedance 2.0 영상 생성에 사용 가능",rejected:"실제 사진 또는 저작권 보호 IP 감지됨",pending:"검증이 제출되었습니다 — 잠시 기다려 주세요"},acceptedLabel:"제출 가능",title:"Seedance 2.0 검증",description:"일부 고급 모델(예: Seedance 2.0)은 실제 인물 초상 및 저작권 캐릭터를 엄격히 차단합니다. 사전 검증을 통해 이미지를 「준수 완료」로 표시하면 이후 생성 시 검사를 건너뛰어 오류를 방지할 수 있습니다.",acceptedText:"오리지널 캐릭터, AI 생성 캐릭터 (실사 스타일 포함)",prohibitedText:"실제 사진, 유명인 초상, 저작권 보호 IP",confirm:"Seedance 2.0 검증",dontShowAgain:"다시 표시하지 않기",prohibitedLabel:"제출 불가",footnote:"*계속 진행함으로써 위 규칙을 확인하였으며 제출 내용이 규정에 부합함을 보증합니다.",statusText:{rejected:"거부됨",pending:"검증 중"}},
  zhCN: {tooltip:{approved:"角色已合规，可用于 Seedance 2.0 视频生成",rejected:"检测到真人照片或受版权保护的 IP 形象",invalidParameterVideo:`视频规格受限，请确认满足以下要求：
格式　mp4 / mov
分辨率　480p ~ 720p
时长　2 ~ 15 秒
比例　0.4 ~ 2.5（宽 ÷ 高）
大小　≤ 50 MB`,invalidParameter:"该文件的格式、尺寸或时长不满足验证要求",invalidParameterImage:`图片规格受限，请确认满足以下要求：
格式　jpeg / png / webp / bmp / tiff / gif
尺寸　300 ~ 6000 px（宽高）
比例　0.4 ~ 2.5（宽 ÷ 高）
大小　≤ 30 MB`,invalidParameterAudio:`音频规格受限，请确认满足以下要求：
格式　wav / mp3
时长　2 ~ 15 秒
大小　≤ 15 MB`,pending:"已提交角色合规验证，请稍候"},acceptedLabel:"允许提交",title:"Seedance 2.0 合规验证",description:"部分进阶模型（如 Seedance 2.0）对真人肖像及版权形象有严格拦截机制。提前验证可将您的角色图片标记为「已合规」，后续参考生成时自动跳过合规扫描，避免任务报错。",acceptedText:"原创角色、AI 生成角色（含写实风格）",prohibitedText:"真人照片、明星/公众人物肖像、受版权保护的 IP 形象",confirm:"Seedance 2.0 合规验证",dontShowAgain:"不再提示",prohibitedLabel:"禁止提交",footnote:"*继续即表示您已阅读上述规则，并确认提交内容合规。",statusText:{rejected:"角色违规",invalidParameter:"规格受限",pending:"正在验证"}},
};
/* eslint-enable no-irregular-whitespace */

/**
 * 官方 `Cwe`（`vendor-pkg-canvas-ChpWx5JY.js`@213650，**逐字**）：
 * 「参数非法（REJECTED_INVALID）」时按 `assetType` 取 tooltip 的键。
 * 官方源码：`const Cwe={Image:"authenticityCheck.tooltip.invalidParameterImage",
 *                      Video:"…invalidParameterVideo",Audio:"…invalidParameterAudio"}`
 * 取值点（`Ob` 内）：`h = n ? Cwe[n] : "authenticityCheck.tooltip.invalidParameter"`。
 */
export const AUTHENTICITY_INVALID_PARAMETER_TOOLTIP: Record<string, string> = {
  Image: 'authenticityCheck.tooltip.invalidParameterImage',
  Video: 'authenticityCheck.tooltip.invalidParameterVideo',
  Audio: 'authenticityCheck.tooltip.invalidParameterAudio',
};

/** MTV `Locale` → 本表键。（与 `mentionStrings.ts` / `agentEventStrings.ts` 同一套映射。） */
const LOCALE_TABLE_KEY: Record<string, string> = {
  'zh-CN': 'zhCN', zhCN: 'zhCN', zh: 'zhCN',
  'en-US': 'enUS', enUS: 'enUS', en: 'enUS',
  'ja-JP': 'jaJP', jaJP: 'jaJP', ja: 'jaJP',
  'ko-KR': 'koKR', koKR: 'koKR', ko: 'koKR',
};

/** 官方 i18n 的 `{{name}}` 插值（与 `mentionStrings.ts` 同口径；当前这 7 个键都不含插值）。 */
export function interpolateAuthenticityString(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (
    params[key] === undefined || params[key] === null ? match : String(params[key])
  ));
}

export interface AuthenticityStringOptions {
  /** MTV 语言（`'zh-CN'` 等）。 */
  locale?: string;
  /** 官方 `t(key, {…})` 的插值参数。 */
  params?: Record<string, string | number>;
  /** 官方 `t(key, "fallback")` 的第二参：命中不到时用它。 */
  fallback?: string;
}

/**
 * 取官方 `authenticityCheck.<path>`（支持 `a.b.c` 路径；`authenticityCheck.` 前缀可带可不带，
 * 与 `mentionStrings.ts` 的「相对命名空间根」口径一致）。
 * 命中顺序与官方一致：当前语言 → 英文 → 调用方 `fallback` → 原样返回 `path`。
 */
export function authenticityString(path: string, options: AuthenticityStringOptions = {}): string {
  const { locale = 'zh-CN', params, fallback } = options;
  const relative = path.startsWith('authenticityCheck.') ? path.slice('authenticityCheck.'.length) : path;
  const read = (table: Record<string, unknown> | undefined): string | null => {
    let node: unknown = table;
    for (const part of relative.split('.')) {
      if (!node || typeof node !== 'object') return null;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === 'string' ? node : null;
  };
  const key = LOCALE_TABLE_KEY[locale] ?? 'zhCN';
  const text = read(AUTHENTICITY_STRINGS[key]) ?? read(AUTHENTICITY_STRINGS.enUS) ?? fallback ?? path;
  return interpolateAuthenticityString(text, params);
}
