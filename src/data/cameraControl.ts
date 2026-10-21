/**
 * 摄影机控制（官方「Lens Combo」）的数据表 —— **逐字取自官方包**。
 *
 * 官方出处：`web/resources/web/assets/zoom-slider-3ZcFvYQO.js`
 *   · 器材目录    `zo`(机身 9) · `Fi`(镜头 10) · `ll`(焦段 7) · `sh`(光圈 3)   @2802578~
 *   · 默认值      `uYe/hYe/pYe/fYe` = sony_venice / zeiss_ultra_prime / 24mm / f/4
 *   · 白名单      `vYe` = [NANO_BANANA_2, NANO_BANANA_FLASH_LITE, GEMINI_BANANA_2,
 *                          GEMINI_BANANA, GPT_IMAGE_2, GPT_IMAGE_2_5_FLARE, GPT_IMAGE_2_5_SUNBURST]
 *   · **提示词片段** `Yie`(机身) · `Xie`(镜头) · `Zie`(焦段) · `Qie`(光圈)   @31680~
 *     每个片段都以 `", "` 开头 ⇒ 是**拼到提示词尾部**的写法：
 *       `sony_venice: ", clean digital look, 8k uhd"`
 *       `canon_k35:  ", using Canon K-35 lens, soft contrast, golden lens flare"`
 *
 * ★ 关于「效果」：官方客户端里 `TYe = (e,t,n,s,r) => e` 是**恒等函数**（客户端不拼提示词），
 *   它把 `cameraControl` 整包发给后端 `generation/image/camera_control`（@2819435），
 *   由**服务端**完成"器材 → 提示词"的翻译。
 *   但**那套翻译用的文本就摆在包里**（下面四张表）—— 所以 MTV 本地照拼即可拿到同等效果，
 *   而且不受官方那 7 个模型的白名单限制（任何图像模型都吃提示词）。
 *   ⚠️ 唯一无法从包里证实的是**拼接顺序**（服务端代码不在包内）：这里按
 *     「机身 → 镜头 → 焦段 → 光圈」= 面板从左到右的顺序拼接，且四段都自带 `", "` 前导。
 */
import sonyVenice from '../assets/official-icons/camera/sony-venice.png';
import arriAlexa35 from '../assets/official-icons/camera/arri-alexa-35.png';
import arriAlexa65 from '../assets/official-icons/camera/arri-alexa-65.png';
import redVRaptor from '../assets/official-icons/camera/red-v-raptor.png';
import panavisionDxl2 from '../assets/official-icons/camera/panavision-dxl2.png';
import arricamLt from '../assets/official-icons/camera/arricam-lt.png';
import arriflex435 from '../assets/official-icons/camera/arriflex-435.png';
import imaxKeighley from '../assets/official-icons/camera/imax-keighley.png';
import imaxFilmCamera from '../assets/official-icons/camera/imax-film-camera.png';
import zeissUltraPrime from '../assets/official-icons/camera/zeiss-ultra-prime.png';
import arriSignaturePrime from '../assets/official-icons/camera/arri-signature-prime.png';
import canonK35 from '../assets/official-icons/camera/canon-k35.png';
import cookeS4 from '../assets/official-icons/camera/cooke-s4.png';
import cookeSpeedPanchro from '../assets/official-icons/camera/cooke-speed-panchro.png';
import cookeSf18x from '../assets/official-icons/camera/cooke-sf-18x.png';
import helios from '../assets/official-icons/camera/helios.png';
import panavisionCSeries from '../assets/official-icons/camera/panavision-c-series.png';
import panavisionPrimo from '../assets/official-icons/camera/panavision-primo.png';
import hawkClassX from '../assets/official-icons/camera/hawk-class-x.png';
import apertureF14 from '../assets/official-icons/camera/f1.4.png';
import apertureF4 from '../assets/official-icons/camera/f4.png';
import apertureF11 from '../assets/official-icons/camera/f11.png';
import pickerBg from '../assets/official-icons/camera/picker-bg.png';
/* 官方白名单靠「MTV 模型 id → 官方真实 id」的既有归一化来判 ⇒ 复用不要另写一份 */
import { findImageModelCapability } from '../utils/imageModelCapabilities';

/** 官方 `ui` 常量：滚轮阈值 / 冷却 / 切换动画 / 上下留白 / 项间距 */
export const CAMERA_PICKER = {
  /** 滚轮累计 |deltaY| 超过它才切一档 */
  THRESHOLD: 100,
  /** 两次切换之间的冷却（ms）—— 防连续跳档 */
  COOLDOWN_MS: 150,
  /** 切换动画时长（ms） */
  ANIMATION_DURATION: 200,
  /** 选择窗上下各留的预览高度（px）—— 窗高 = PREVIEW_HEIGHT*2 + itemSize */
  PREVIEW_HEIGHT: 42,
  /** 项间距（官方为 0，即项与项紧贴） */
  ITEM_GAP: 0,
  /** 面板里每个选择器的项尺寸（官方 `itemSize={80}`） */
  ITEM_SIZE: 80,
} as const;

/** 选择器的背景图（官方 `I0 = /assets/camera-control-bg-*.png`） */
export const CAMERA_PICKER_BG = pickerBg;

export interface CameraOption {
  key: string;
  /** 显示名（官方 `name`，如 `Sony Venice`）—— 英文原名，不翻译 */
  label: string;
  /** 缩略图（焦段没有图，走文字渲染） */
  image?: string;
  /** 机身徽标（官方 `type`：`Digital` / `Film`）*/
  badge?: string;
  /** ★ 拼进提示词的片段（官方 `Yie/Xie/Zie/Qie`，**含前导 `", "`**）*/
  prompt: string;
}

/** 机身（官方 `zo`，顺序即官方目录顺序）*/
export const CAMERA_BODIES: CameraOption[] = [
  { key: 'sony_venice', label: 'Sony Venice', image: sonyVenice, badge: 'Digital', prompt: ', clean digital look, 8k uhd' },
  { key: 'arri_alexa_35', label: 'Arri Alexa 35', image: arriAlexa35, badge: 'Digital', prompt: ', cinematic color grading, soft highlights' },
  { key: 'arri_alexa_65', label: 'Arri Alexa 65', image: arriAlexa65, badge: 'Digital', prompt: ', Shot on ARRI Alexa 65, large format cinematography, hyper-realistic, cinematic lighting, 8k resolution, movie still' },
  { key: 'red_v_raptor', label: 'Red V-Raptor', image: redVRaptor, badge: 'Digital', prompt: ', high contrast, sharp focus' },
  { key: 'panavision_dxl2', label: 'Panavision DXL2', image: panavisionDxl2, badge: 'Digital', prompt: ', Hollywood movie style' },
  { key: 'arricam_lt', label: 'Arricam LT', image: arricamLt, badge: 'Film', prompt: ', Shot on Arricam LT, Kodak Vision3 500T, pin sharp focus, organic medium film grain, soft highlight roll-off, rich color density, faint red halo at the edge of the light source, highly detailed texture.' },
  { key: 'arriflex_435', label: 'ArriFlex 435', image: arriflex435, badge: 'Film', prompt: ', Shot on Arriflex 435, Kodak Vision3 250D 5207 style, pin sharp focus, medium film grain, soft highlight roll-off, high dynamic range, rich color density' },
  { key: 'imax_keighley', label: 'IMAX Keighley', image: imaxKeighley, badge: 'Film', prompt: ', shot on IMAX Keighley, Kodak Vision3 500T style, extremely sharp focus, high dynamic range, Extremely shallow depth of field, 18k resolution, hyper-realistic skin texture, organic film grain, 3D separation, color graded, volumetric lighting, epic scale' },
  { key: 'imax_film_camera', label: 'IMAX Film Camera', image: imaxFilmCamera, badge: 'Film', prompt: ', high resolution, fine film grain' },
];

/** 镜头（官方 `Fi`）*/
export const CAMERA_LENSES: CameraOption[] = [
  { key: 'zeiss_ultra_prime', label: 'Zeiss Ultra Prime', image: zeissUltraPrime, prompt: ', using Zeiss Ultra Prime, clinically sharp, high contrast' },
  { key: 'arri_signature_prime', label: 'Arri Signature Prime', image: arriSignaturePrime, prompt: ', using Arri Signature Prime, clean image, perfect optics' },
  { key: 'canon_k35', label: 'Canon K-35', image: canonK35, prompt: ', using Canon K-35 lens, soft contrast, golden lens flare' },
  { key: 'cooke_s4', label: 'Cooke S4', image: cookeS4, prompt: ', using Cooke S4 lens, The Cooke Look, creamy bokeh' },
  { key: 'cooke_speed_panchro', label: 'Cooke Panchro', image: cookeSpeedPanchro, prompt: ', using Cooke Speed Panchro Series III, buttery background blur, The Cooke Look, warm organic tones, soft sharpness, atmospheric depth' },
  { key: 'cooke_sf_18x', label: 'Cooke SF 1.8x', image: cookeSf18x, prompt: ', using Cooke Anamorphic SF, Identify the light source, golden lens flare, oval bokeh, Full Frame Anamorphic, warm cinematic look' },
  { key: 'helios', label: 'Helios', image: helios, prompt: ', using Helios 44-2 lens, swirly bokeh, twisted background' },
  { key: 'panavision_c_series', label: 'Panavision C Series', image: panavisionCSeries, prompt: ', anamorphic cinematic look, distinct blue horizontal lens flare, oval bokeh' },
  { key: 'panavision_primo', label: 'Panavision Primo', image: panavisionPrimo, prompt: ', using Panavision Primo Anamorphic, oval bokeh, Anamorphic format, horizontal blue lens flare, 2x squeeze, anamorphic look' },
  { key: 'hawk_class_x', label: 'Hawk Class X', image: hawkClassX, prompt: ', using Hawk Class X Anamorphic, identify the light source, subtle creamy vertical oval bokeh, organic sharpness, vintage modern aesthetic, soft horizontal flare' },
];

/** 焦段（官方 `ll`，**无缩略图** ⇒ 走文字渲染）*/
export const CAMERA_FOCALS: CameraOption[] = [
  { key: '8mm', label: '8mm', prompt: ', 8mm prime lens, exaggerated perspective, Rectilinear, immense sense of scale, stretching at edges' },
  { key: '14mm', label: '14mm', prompt: ', 14mm prime lens, rectilinear distortion, moderate linear perspective, subtle edge stretch, spatial depth, soft vignetting' },
  { key: '24mm', label: '24mm', prompt: ', 24mm prime lens, minimal rectilinear distortion, natural linear perspective, sharp corner details, cinematic natural framing, mild vignetting' },
  { key: '35mm', label: '35mm', prompt: ', 35mm prime lens, near-zero rectilinear distortion, human-eye natural perspective, sharp full-frame details, subtle vignetting, candid cinematic framing' },
  { key: '50mm', label: '50mm', prompt: ', 50mm prime lens, zero distortion, eye-like perspective, close-up, subject focus, ultra shallow DOF, sharp center, faint vignetting' },
  { key: '75mm', label: '75mm', prompt: ', 75mm prime lens, zero distortion, strong compression, extreme tight close, subject full dominance, extreme shallow DOF, sharp center, faint vignetting' },
  { key: '125mm', label: '125mm', prompt: ', 125mm macro lens, 1:1 magnification, extreme compression, microscopic view, razor-sharp details, total background isolation, creamy bokeh, texture focused' },
];

/** 光圈（官方 `sh`，显示名带 `ƒ`，但片段里是 `f/`）*/
export const CAMERA_APERTURES: CameraOption[] = [
  { key: 'f/1.4', label: 'ƒ/1.4', image: apertureF14, prompt: ', shallow depth of field, creamy bokeh, out-of-focus background' },
  { key: 'f/4', label: 'ƒ/4', image: apertureF4, prompt: ', f/4 aperture, infinite depth of field, razor-sharp details, hyperfocal distance' },
  { key: 'f/11', label: 'ƒ/11', image: apertureF11, prompt: ', f/11 aperture, deep depth of field, crystal clear background, everything in focus' },
];

/** 官方默认组合 `uYe/hYe/pYe/fYe` */
export const CAMERA_DEFAULTS = {
  cameraKey: 'sony_venice',
  lensKey: 'zeiss_ultra_prime',
  focalKey: '24mm',
  apertureKey: 'f/4',
} as const;

/**
 * ★★★★★ 官方**只在 7 个模型上显示**摄影机控制按钮 —— 逐字取自官方渲染点
 * （`zoom-slider-3ZcFvYQO.js` @3211385，`Ant` 的挂载条件）：
 *
 * ```js
 * o.model === bn.NANO_BANANA_2            // → "nano-banana-flash"
 *   || o.model === bn.NANO_BANANA_FLASH_LITE   // → "nano-banana-flash-lite"
 *   || o.model === bn.GEMINI_BANANA_2          // → "tamar-google-gemini-pro"
 *   || o.model === bn.GEMINI_BANANA            // → "nano-banana"
 *   || im(o.model)                             // → new Set(["gpt-image-2","gpt-image-2.5-flare","gpt-image-2.5-sunburst"]).has(model)
 * ```
 *
 * ⇒ 恰好等于官方那份白名单 `vYe`（同一个 chunk @2807794）。
 * ⚠️ 枚举值是**展开后**的真实 id（`im` = `AFl` @6783708，定义在 `index-BiTZf8mJ.js`）；
 *    注意 `nano-banana-2` 是 `ALIAS_NANO_BANANA_2`，**不在**这个条件里 —— 别按名字猜。
 */
export const CAMERA_OFFICIAL_MODELS = [
  'nano-banana-flash',
  'nano-banana-flash-lite',
  'tamar-google-gemini-pro',
  'nano-banana',
  'gpt-image-2',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
] as const;

/**
 * 官方自己对 `nano-banana-2` 的**别名归一**（`index-BiTZf8mJ.js` @6797216）：
 *
 * ```js
 * const n = t === jn.ALIAS_NANO_BANANA_2 ? jn.GEMINI_BANANA_2 : t;   // 建 `CBe` 表时
 * for (const a of [t, e.model, ...(e.externalModelIds ?? [])]) CBe.set(a, n);
 * function Ofs(t){ return CBe.get(t.trim()) ?? null; }               // id → 规范模型
 * ```
 *
 * ⇒ `nano-banana-2` 会被归一成 `tamar-google-gemini-pro` ⇒ **照样显示**摄影机控制。
 *   MTV 的官方表里 `nano-banana-2` 是单独一条 ⇒ 这里补上同一条官方别名规则。
 */
const CAMERA_MODEL_ALIASES: Record<string, string> = {
  'nano-banana-2': 'tamar-google-gemini-pro',
};

/**
 * 该模型是否显示摄影机控制（= 官方条件）。
 *
 * ⚠️ MTV 的模型 `value` 常带供应商前缀（`apimart/gpt-image-2`、`grsai/nano-banana-2`），
 *    自定义连接还有上游 id（`gemini-3.1-flash-image-preview`）⇒ 不能直接字符串比较。
 *    这里复用 `findImageModelCapability()`（它已经把各种 id 归一到**官方真实 id**）⇒
 *    `apimart/gpt-image-2` ✓ 命中 · `grsai/nano-banana-2` → 别名 → `tamar-google-gemini-pro` ✓ 命中 ·
 *    `flux-2-pro` / `midjourney-*` / `doubao-seedream-*` / `imagen-4.0` → ✗ 不显示（与官方一致）。
 */
export function cameraControlAllowedFor(model?: string | Array<string | undefined | null> | null): boolean {
  const capability = findImageModelCapability(model);
  if (!capability) return false;
  const canonical = CAMERA_MODEL_ALIASES[capability.model] ?? capability.model;
  return (CAMERA_OFFICIAL_MODELS as readonly string[]).includes(canonical);
}

const find = (list: CameraOption[], key?: string) => (key ? list.find((item) => item.key === key) : undefined);

export const cameraBody = (key?: string) => find(CAMERA_BODIES, key);
export const cameraLens = (key?: string) => find(CAMERA_LENSES, key);
export const cameraFocal = (key?: string) => find(CAMERA_FOCALS, key);
export const cameraAperture = (key?: string) => find(CAMERA_APERTURES, key);
