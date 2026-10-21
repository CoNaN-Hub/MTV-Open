/**
 * 「摄影机控制」模块（官方 Lens Combo）契约。
 *
 * 用户口径（2026）：
 *   ·「请基于我拥有的 EXE 对应源码，精准复刻画布卡片底部编辑区的"摄影机控制按钮"模块」
 *   ·「落点用本地 config 能实现官方一样的 效果和功能吗」
 *   ·「效果不打折的情况下 官方走云端 我门走本地 不行吗」
 *   ·「和官方一致」  ⇒ 开关（`enabled`）决定提示词是否注入，与官方 gating 口径一致
 *
 * 官方真值（`web/resources/web/assets/zoom-slider-3ZcFvYQO.js`）：
 *   · `Ant` @3177828 触发组：`h-9 rounded-lg` · 图标 `w-7 h-7 m-0.5 rounded-md` + `w-5 h-5` 位图
 *     · 文字 `h-8 px-0 pr-2 text-sm font-medium whitespace-nowrap text-white` + 开启时 `max-w-[80px] truncate`
 *     · 关闭叉 `absolute -top-1 -right-1 w-4 h-4 bg-black rounded-full opacity-0 group-hover:opacity-100`
 *     · Tooltip `px-3 py-2 pt-2.5 rounded-lg` + `rgba(51,51,51,.80)` + `blur(28px)`，
 *       内容 = 缩略图 `w-9 h-9` + 名字 + ON/OFF + `镜头 / 焦段 / 光圈`
 *   · `Snt` @3171270 面板：`bg-popover/95 backdrop-blur-sm rounded-xl border border-border p-4 shadow-2xl`
 *     · 标题 `camera_control.title` + 保存按钮 `px-3 py-1 rounded-md text-xs font-medium bg-muted`
 *     · 四个 `k0` 选择器 `gap-4`，中间分隔 `w-0.5 bg-foreground/10 h-20 mb-9`
 *   · `k0` @3168320 滚轮：`itemSize=80` · 窗高 `42+80+42` · 200ms ease-out · 选中 64×64 / 相邻 48×48
 *   · `ui` = THRESHOLD 100 / COOLDOWN_MS 150 / ANIMATION_DURATION 200 / PREVIEW_HEIGHT 42 / ITEM_GAP 0
 *   · 器材目录：机身 9 · 镜头 10 · 焦段 7 · 光圈 3
 *   · 提示词片段 `Yie/Xie/Zie/Qie` 每段自带 `", "` 前导
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_APERTURES, CAMERA_BODIES, CAMERA_DEFAULTS, CAMERA_FOCALS, CAMERA_LENSES, CAMERA_OFFICIAL_MODELS,
  CAMERA_PICKER, cameraAperture, cameraBody, cameraControlAllowedFor, cameraFocal, cameraLens,
} from '../../src/data/cameraControl';
import { buildGenerationCameraPrompt, migrateCameraSettings } from '../../src/components/nodes/shared/image/cameraStudio';
import type { CameraGenerationSettings } from '../../src/types';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

/** 去掉注释后的源码 —— 本轮改动会在文件里**写明删掉了什么**，whole-file 匹配会自己误伤自己 */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CONTROL = 'src/components/nodes/shared/CameraControl.tsx';
const CSS = 'src/styles/camera-control.css';
const DATA = 'src/data/cameraControl.ts';
const PANEL = 'src/components/nodes/shared/PromptPanel.tsx';
const DIALOG = 'src/components/nodes/AINodeDialog.tsx';
const STUDIO = 'src/components/nodes/shared/image/cameraStudio.ts';

/** 官方 JS 里的原始常量（逐字抄下来当"真值表"，防止实现被悄悄改宽/改窄） */
const OFFICIAL = {
  bodies: ['sony_venice', 'arri_alexa_35', 'arri_alexa_65', 'red_v_raptor', 'panavision_dxl2',
    'arricam_lt', 'arriflex_435', 'imax_keighley', 'imax_film_camera'],
  lenses: ['zeiss_ultra_prime', 'arri_signature_prime', 'canon_k35', 'cooke_s4', 'cooke_speed_panchro',
    'cooke_sf_18x', 'helios', 'panavision_c_series', 'panavision_primo', 'hawk_class_x'],
  focals: ['8mm', '14mm', '24mm', '35mm', '50mm', '75mm', '125mm'],
  apertures: ['f/1.4', 'f/4', 'f/11'],
  defaults: { cameraKey: 'sony_venice', lensKey: 'zeiss_ultra_prime', focalKey: '24mm', apertureKey: 'f/4' },
};

function cssBlock(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, `找不到 ${selector}`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at)).replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('摄影机控制 · 器材目录逐字对齐官方', () => {
  it('机身 9 项、键序与官方 `mYe` 一致', () => {
    expect(CAMERA_BODIES.map((item) => item.key)).toEqual(OFFICIAL.bodies);
  });

  it('镜头 10 项、键序与官方 `gYe` 一致', () => {
    expect(CAMERA_LENSES.map((item) => item.key)).toEqual(OFFICIAL.lenses);
  });

  it('焦段 7 项、键序与官方 `bYe` 一致（且官方**不给图**，只有文字）', () => {
    expect(CAMERA_FOCALS.map((item) => item.key)).toEqual(OFFICIAL.focals);
    expect(CAMERA_FOCALS.every((item) => item.image === undefined)).toBe(true);
  });

  it('光圈只有官方那 3 档（`yYe`），label 用 `ƒ/`', () => {
    expect(CAMERA_APERTURES.map((item) => item.key)).toEqual(OFFICIAL.apertures);
    expect(CAMERA_APERTURES.map((item) => item.label)).toEqual(['ƒ/1.4', 'ƒ/4', 'ƒ/11']);
  });

  it('数码/胶片徽标只有官方那两个值', () => {
    const badges = new Set(CAMERA_BODIES.map((item) => item.badge).filter(Boolean));
    expect([...badges].sort()).toEqual(['Digital', 'Film']);
  });

  it('默认组合 = 官方 `uYe/hYe/pYe/fYe`', () => {
    expect(CAMERA_DEFAULTS).toEqual(OFFICIAL.defaults);
  });

  it('`ui` 五个常量逐字一致', () => {
    expect(CAMERA_PICKER.THRESHOLD).toBe(100);
    expect(CAMERA_PICKER.COOLDOWN_MS).toBe(150);
    expect(CAMERA_PICKER.ANIMATION_DURATION).toBe(200);
    expect(CAMERA_PICKER.PREVIEW_HEIGHT).toBe(42);
    expect(CAMERA_PICKER.ITEM_GAP).toBe(0);
    expect(CAMERA_PICKER.ITEM_SIZE).toBe(80);
  });

  it('每个器材都有非空提示词片段，且都以 `", "` 前导（可直接接在提示词尾部）', () => {
    const all = [...CAMERA_BODIES, ...CAMERA_LENSES, ...CAMERA_FOCALS, ...CAMERA_APERTURES];
    expect(all).toHaveLength(29);
    for (const item of all) {
      expect(item.prompt, `${item.key} 缺提示词`).toBeTruthy();
      expect(item.prompt.startsWith(', '), `${item.key} 缺 ", " 前导`).toBe(true);
    }
  });

  it('查表 helper 命中 / 未命中都对', () => {
    expect(cameraBody('sony_venice')?.label).toBeTruthy();
    expect(cameraLens('canon_k35')?.label).toBeTruthy();
    expect(cameraFocal('125mm')?.key).toBe('125mm');
    expect(cameraAperture('f/11')?.key).toBe('f/11');
    expect(cameraBody('nope')).toBeUndefined();
    expect(cameraAperture('f/2.8')).toBeUndefined();
  });
});

describe('摄影机控制 · 提示词注入（本地替代官方云端）', () => {
  const on: CameraGenerationSettings = { enabled: true, ...OFFICIAL.defaults };

  it('关掉时返回空串（与官方一致：关掉就走普通生成）', () => {
    expect(buildGenerationCameraPrompt({ ...on, enabled: false })).toBe('');
    expect(buildGenerationCameraPrompt(undefined)).toBe('');
  });

  it('开启时按「机身 → 镜头 → 焦段 → 光圈」拼接官方片段', () => {
    const text = buildGenerationCameraPrompt(on);
    const parts = [
      cameraBody(OFFICIAL.defaults.cameraKey)!.prompt,
      cameraLens(OFFICIAL.defaults.lensKey)!.prompt,
      cameraFocal(OFFICIAL.defaults.focalKey)!.prompt,
      cameraAperture(OFFICIAL.defaults.apertureKey)!.prompt,
    ];
    expect(text).toBe(parts.join(''));
    expect(text.startsWith(', ')).toBe(true);
  });

  it('换一档器材，片段跟着换', () => {
    const text = buildGenerationCameraPrompt({ enabled: true, ...OFFICIAL.defaults, lensKey: 'canon_k35' });
    expect(text).toContain(cameraLens('canon_k35')!.prompt);
    expect(text).not.toContain(cameraLens(OFFICIAL.defaults.lensKey)!.prompt);
  });

  it('旧格式（`{lens,shutterEffect,aperture,exposureTime}`）能迁移，只映射官方有对应值的档位', () => {
    const migrated = migrateCameraSettings({ lens: '35mm', aperture: 'f/11' } as never);
    expect(migrated).toMatchObject({ enabled: true, focalKey: '35mm', apertureKey: 'f/11' });
    /* 官方没有 15mm/85mm/200mm/macro/fisheye ⇒ 回落到默认焦段，不瞎编 */
    const fallback = migrateCameraSettings({ lens: '85mm' } as never);
    expect(fallback.focalKey).toBe(OFFICIAL.defaults.focalKey);
    expect(fallback.cameraKey).toBe(OFFICIAL.defaults.cameraKey);
  });

  it('新格式原样透传；键不认识时回落官方默认值', () => {
    expect(migrateCameraSettings(on)).toEqual(on);
    const bad = migrateCameraSettings({ enabled: true, ...OFFICIAL.defaults, cameraKey: 'nope' });
    expect(bad.cameraKey).toBe(OFFICIAL.defaults.cameraKey);
  });

  it('注入点：直接接在项目提示词尾部，不再用 MTV 自造的 `Camera settings:` 包装', () => {
    const dialog = code(read(DIALOG));
    expect(dialog).toContain('buildGenerationCameraPrompt(latestData.cameraSettings)');
    expect(dialog).toContain('`${projectPrompt}${cameraPrompt}`');
    expect(dialog).not.toMatch(/Camera settings:/);
    /* 旧的空话术表不该再被注入逻辑引用 */
    const studio = code(read(STUDIO));
    expect(studio).not.toContain('SHUTTER_EFFECT_PROMPTS');
    expect(studio).not.toContain('APERTURE_PROMPTS');
  });

  it('「和官方一致」：注入只看 `enabled`，不看模型白名单', () => {
    /* 官方客户端把 `enabled` 整包发给云端；MTV 本地拼提示词 ⇒ 任何图像模型都能用，
       代码里不能出现「按模型 id 决定要不要注入」的分支 */
    const studio = read(STUDIO);
    expect(studio).toContain('if (!resolved.enabled) return');
    expect(studio).not.toContain('CAMERA_OFFICIAL_MODELS');
    expect(read(DATA)).toContain('CAMERA_OFFICIAL_MODELS');
  });
});

describe('摄影机控制 · 官方逐模型白名单（按钮出不出现）', () => {
  /* 官方渲染点 `zoom-slider-3ZcFvYQO.js` @3211385，枚举值展开自 `index-BiTZf8mJ.js` @6782649 */
  it('白名单就是官方那 7 个**真实 id**（不是按名字猜的）', () => {
    expect([...CAMERA_OFFICIAL_MODELS]).toEqual([
      'nano-banana-flash',
      'nano-banana-flash-lite',
      'tamar-google-gemini-pro',
      'nano-banana',
      'gpt-image-2',
      'gpt-image-2.5-flare',
      'gpt-image-2.5-sunburst',
    ]);
    /* ⚠️ `nano-banana-2` 是官方的 `ALIAS_NANO_BANANA_2`，**不在**挂载条件里 */
    expect(CAMERA_OFFICIAL_MODELS as readonly string[]).not.toContain('nano-banana-2');
  });

  it('官方命中的模型 → 显示', () => {
    for (const model of ['nano-banana', 'nano-banana-flash', 'nano-banana-flash-lite', 'gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']) {
      expect(cameraControlAllowedFor(model), model).toBe(true);
    }
  });

  it('MTV 带供应商前缀的 id 也能命中（归一化到官方 id）', () => {
    expect(cameraControlAllowedFor('apimart/gpt-image-2'), 'apimart/gpt-image-2').toBe(true);
    expect(cameraControlAllowedFor('apimart/gpt-image-2.5-sunburst')).toBe(true);
    /* `nano-banana-2` 是官方的 `ALIAS_NANO_BANANA_2` ⇒ 官方自己把它归一成 `GEMINI_BANANA_2`
       （`index-BiTZf8mJ.js` @6797216 的 `CBe` 表）⇒ 照样显示 ✓ */
    expect(cameraControlAllowedFor('grsai/nano-banana-2'), 'grsai/nano-banana-2').toBe(true);
    expect(cameraControlAllowedFor('grsai/nano-banana-flash')).toBe(true);
  });

  it('官方没给的模型 → 不显示（这正是用户报的「某些模型不会出现」）', () => {
    for (const model of ['flux-2-pro', 'midjourney-v7', 'doubao-seedream-4.0', 'imagen-4.0', 'grok-2-image', 'tapnow-image-turbo']) {
      expect(cameraControlAllowedFor(model), model).toBe(false);
    }
    expect(cameraControlAllowedFor(undefined)).toBe(false);
    expect(cameraControlAllowedFor('')).toBe(false);
  });

  it('自定义连接要带上游 modelId / 可读名当候选（只传 value 判不出来）', () => {
    /* `general/provider-custom-…` 这个 value 里没有任何官方模型名 */
    expect(cameraControlAllowedFor('general/provider-custom-2611fc0a-7n7og')).toBe(false);
    /* 但同一条连接的 `modelId` 一说就命中了（与 `modelAliases` 同一套归一化）*/
    expect(cameraControlAllowedFor(['general/provider-custom-x', 'gemini-3.1-flash-image-preview'])).toBe(true);
    expect(cameraControlAllowedFor(['general/provider-custom-x', undefined, 'Nano Banana Pro'])).toBe(true);
  });

  it('PromptPanel 的挂载条件里用上了它，且把上游候选一起传进去', () => {
    const panel = read(PANEL);
    expect(panel).toContain('cameraControlAllowedFor([selectedModel, generalModelConfig?.modelId, generalModelConfig?.name])');
    expect(panel).toContain("import { cameraControlAllowedFor } from '../../../data/cameraControl';");
    /* 不能只在注入侧限制，按钮侧也必须是同一条件 */
    const at = panel.indexOf('cameraControlAllowedFor([');
    expect(at).toBeGreaterThan(panel.indexOf("nodeType === 'ai-image' || nodeType === 'ai-video'"));
  });
});

describe('摄影机控制 · 组件接线', () => {
  it('PromptPanel 已整块换成官方那套，旧的自造四下拉/预览全删干净', () => {
    const panel = code(read(PANEL));
    expect(panel).toContain("import CameraControl from './CameraControl';");
    expect(panel).toContain('<CameraControl value={cameraSettings} onChange={onChangeCameraSettings} />');
    for (const dead of ['CameraSettingsSelector', 'CameraSettingsPreview', 'CAMERA_LENS_OPTIONS',
      'CAMERA_SHUTTER_OPTIONS', 'CAMERA_APERTURE_OPTIONS', 'CAMERA_EXPOSURE_OPTIONS', 'lensControlUrl']) {
      expect(panel, `${dead} 应该已经删掉`).not.toContain(dead);
    }
  });

  it('触发组结构 = `Ant`：图标开关 + 文字 + 关闭叉 + tooltip + 面板', () => {
    const src = read(CONTROL);
    expect(src).toContain('className={`cc-icon${enabled ? \' is-on\' : \'\'}`}');
    expect(src).toContain('className="cc-text"');
    expect(src).toContain('className="cc-close"');
    expect(src).toContain('className="cc-tooltip"');
    expect(src).toContain('className="cc-popover"');
    /* 打开面板即自动启用（官方 `x`） */
    expect(src).toMatch(/if \(next && !enabled && !locked\) \{/);
  });

  it('tooltip 组合行是官方那种**斜杠分隔**（不是 `NYe` 逗号版，那是死代码）', () => {
    const src = read(CONTROL);
    expect(src).toContain('${lens?.label ?? settings.lensKey} / ${focal?.label ?? settings.focalKey} / ${aperture?.label ?? settings.apertureKey}');
    expect(src).not.toMatch(/\$\{body\?\.label[^\n]*\} {3}/);
  });

  it('面板保存按钮走 `common.save`；标题与文字都用 `camera_control.title`', () => {
    const src = code(read(CONTROL));
    expect(src).toContain("t('保存')");
    /* 面板 aria-label + 面板标题 + 图标开关 aria-label + 触发文字（两分支）= 5 处 */
    expect(src.match(/t\('摄影机控制'\)/g)).toHaveLength(5);
    expect(src).not.toContain('镜头组合');
  });

  it('ON/OFF 用官方四语小表（MTV 的 `关闭` 已被占成 "Close"，无法复用）', () => {
    const src = read(CONTROL);
    expect(src).toContain("'zh-CN': '开启'");
    expect(src).toContain("'en-US': 'OFF'");
    expect(src).toContain("'ja-JP': 'オン'");
    expect(src).toContain("'ko-KR': '끄기'");
  });

  it('四语 `camera_control.title` 已进字典（en/ja/ko）', () => {
    expect(read('src/i18n/locales/en-US/nodes.ts')).toContain("'摄影机控制': 'Lens Combo'");
    expect(read('src/i18n/locales/ja-JP/nodes.ts')).toContain("'摄影机控制': 'カメラコントロール'");
    expect(read('src/i18n/locales/ko-KR/nodes.ts')).toContain("'摄影机控制': '카메라 제어'");
  });

  it('滚轮换档的 `alive` 必须在 effect 体内置回 true（StrictMode 回归）', () => {
    /* 官方 `k0` 只在 cleanup 里写 `f.current = !1`（生产构建没问题 ✗）
       ⇒ dev + StrictMode 的 mount→cleanup→mount 会把它**永久**置 false ⇒
         200ms 后的 `onChange` 每次早退、换档彻底失效（实测踩过 ✗）。
       这里锁死修复：effect 体内必须有一次 `alive.current = true`，且 cleanup 仍要置 false。 */
    const src = read(CONTROL);
    const at = src.indexOf('const alive = useRef(true);');
    expect(at).toBeGreaterThan(-1);
    const tail = src.slice(at, at + 900);
    expect(tail).toContain('alive.current = true;');
    expect(tail).toContain('alive.current = false;');
    expect(tail.indexOf('alive.current = true;')).toBeLessThan(tail.indexOf('alive.current = false;'));
  });

  it('落点用本机 config（官方走云端 model prefs）', () => {
    const src = read(CONTROL);
    expect(src).toContain('config.cameraControlDefaults');
    expect(src).toContain('cameraControlDefaults: {');
    expect(read('src/types/index.ts')).toContain('cameraControlDefaults?');
  });
});

describe('摄影机控制 · CSS 逐字对齐官方原子', () => {
  it('触发组：h-9 / rounded-lg / hover:bg-muted / open:bg-white-10', () => {
    const root = cssBlock(read(CSS), '.cc-root');
    expect(root).toContain('height: 36px');
    expect(root).toContain('border-radius: 12px');
    const css = read(CSS);
    expect(css).toMatch(/\.cc-root:hover \{ background: var\(--muted, #2b2b2b\)/);
    expect(css).toMatch(/\.cc-root:active,\s*\n\.cc-root\.is-open \{ background: rgba\(255, 255, 255, 0\.1\); \}/);
  });

  it('图标开关：w-7 h-7 m-0.5 rounded-md，位图 w-5 h-5', () => {
    const icon = cssBlock(read(CSS), '.cc-icon');
    expect(icon).toContain('width: 28px');
    expect(icon).toContain('height: 28px');
    expect(icon).toContain('margin: 2px');
    expect(icon).toContain('border-radius: 10px');
    const img = cssBlock(read(CSS), '.cc-icon > img');
    expect(img).toContain('width: 20px');
    expect(img).toContain('height: 20px');
    expect(img).toContain('transition: all 0.3s');
  });

  it('文字按钮：h-8 / pr-2 / 14px / 500 / 白，开启时 80px 省略号', () => {
    const text = cssBlock(read(CSS), '.cc-text');
    expect(text).toContain('height: 32px');
    expect(text).toContain('padding: 0 8px 0 0');
    expect(text).toContain('font-size: 14px');
    expect(text).toContain('font-weight: 500');
    expect(text).toContain('white-space: nowrap');
    const truncate = cssBlock(read(CSS), '.cc-text__label.is-truncate');
    expect(truncate).toContain('max-width: 80px');
    expect(truncate).toContain('text-overflow: ellipsis');
  });

  it('关闭叉：-top-1 -right-1 / 16×16 / 黑圆 / hover 才显形', () => {
    const close = cssBlock(read(CSS), '.cc-close');
    expect(close).toContain('top: -4px');
    expect(close).toContain('right: -4px');
    expect(close).toContain('width: 16px');
    expect(close).toContain('height: 16px');
    expect(close).toContain('background: #000000');
    expect(close).toContain('opacity: 0');
    expect(read(CSS)).toContain('.cc-root:hover .cc-close { opacity: 1; }');
  });

  it('tooltip：官方玻璃配方逐字（0.80 底 + blur 28 + 双阴影）', () => {
    const tip = cssBlock(read(CSS), '.cc-tooltip');
    expect(tip).toContain('rgba(51, 51, 51, 0.8)');
    expect(tip).toContain('blur(28px)');
    expect(tip).toContain('box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.16), inset 0px 0.5px 0px rgba(255, 255, 255, 0.16)');
    expect(tip).toContain('border-radius: 12px');
    expect(read(CSS)).toMatch(/\.cc-tooltip__thumb \{[^}]*width: 36px; height: 36px; object-fit: contain;/);
  });

  it('面板：bg-popover/95 + blur-sm + rounded-xl(16px) + border + p-4', () => {
    const panel = cssBlock(read(CSS), '.cc-panel');
    expect(panel).toContain('padding: 16px');
    expect(panel).toContain('border-radius: 16px');
    expect(panel).toContain('blur(4px)');
    expect(panel).toContain('var(--popover, #262626) 95%');
  });

  it('面板分隔线：w-0.5 / h-20 / mb-9', () => {
    const sep = cssBlock(read(CSS), '.cc-panel__sep');
    expect(sep).toContain('width: 2px');
    expect(sep).toContain('height: 80px');
    expect(sep).toContain('margin-bottom: 36px');
  });

  it('选择窗：上下各 42 的预览留白 + 选中框 rounded-2xl + inset 阴影', () => {
    const frame = cssBlock(read(CSS), '.cc-picker__frame');
    expect(frame).toContain('border-radius: 16px');
    expect(frame).toContain('background-size: cover');
    const active = cssBlock(read(CSS), '.cc-picker__frame.is-active');
    expect(active).toContain('inset 0 0 8px 2px rgba(156, 163, 175, 0.15)');
    const clip = cssBlock(read(CSS), '.cc-picker__clip');
    expect(clip).toContain('border-radius: 16px');
    expect(clip).toContain('overflow: hidden');
  });

  it('选中项 64×64 全亮 / 相邻 48×48 半透明；无图项 18px 亮 / 14px 灰', () => {
    const img = cssBlock(read(CSS), '.cc-picker__img');
    expect(img).toContain('width: 48px');
    expect(img).toContain('opacity: 0.5');
    const sel = cssBlock(read(CSS), '.cc-picker__img.is-selected');
    expect(sel).toContain('width: 64px');
    expect(sel).toContain('opacity: 1');
    const text = cssBlock(read(CSS), '.cc-picker__text.is-selected');
    expect(text).toContain('font-size: 18px');
    expect(cssBlock(read(CSS), '.cc-picker__text')).toContain('font-size: 14px');
  });

  it('label：text-xs / mt-4 / max-w-120 / 居中截断', () => {
    const label = cssBlock(read(CSS), '.cc-picker__label');
    expect(label).toContain('margin-top: 16px');
    expect(label).toContain('max-width: 120px');
    expect(label).toContain('font-size: 12px');
    expect(label).toContain('text-align: center');
    expect(label).toContain('text-overflow: ellipsis');
  });

  it('CSS 已被 index.css 引入', () => {
    expect(read('src/index.css')).toContain("@import './styles/camera-control.css';");
  });

  it('25 张图全在仓库里（22 器材 + 底图 + 镜头开/关）', () => {
    const dir = new URL('../../src/assets/official-icons/camera/', import.meta.url);
    const list = readdirSync(dir) as string[];
    expect(list).toHaveLength(25);
    for (const name of ['lens-on.png', 'lens-off.png', 'picker-bg.png', 'sony-venice.png', 'hawk-class-x.png', 'f11.png']) {
      expect(list, `缺 ${name}`).toContain(name);
    }
  });
});
