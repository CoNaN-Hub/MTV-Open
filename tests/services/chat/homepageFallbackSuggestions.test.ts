/**
 * `homepage_fallback_suggestions` 官方字面量（5 语言 × 30 条 = 150 条）落地校验。
 *
 * 唯一数据来源 = 官方发布产物的字面量抽取件 `prompt-literals.json`
 * （顶层键 `homepage_fallback_suggestions`，对应官方
 * `readable/web/assets/index-Beoy3Atw.js:1475-1775`）。
 * 本测试用 `fs.readFileSync` **直接读该源文件**，对抽查条目做「逐字相等」比较
 * （不是「看起来像」），并对全量 150 条做一次深比较。
 *
 * ⚠️ 该源文件是本地抽取件（绝对路径）；MTV 目前没有 homepage 界面，
 * 本模块只落地数据、未接入任何 UI。
 *
 * 测试分两层：
 * 1. **冻结字面量**（永远跑）：不依赖任何外部文件，直接断言仓库内数据的关键字面量。
 *    —— 数据既然已逐字落盘，仓库自身就必须能证明它是逐字的。
 * 2. **与源抽取件深比较**（源件在才跑）：源件缺失时按其真实原因 `skip`，
 *    并打印跳过原因；**不**用假断言掩盖（逐字结论已记在覆盖表 §58）。
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HOMEPAGE_FALLBACK_LANGUAGES,
  allHomepageFallbackSuggestions,
  homepageFallbackSuggestions,
} from '../../../src/services/chat/homepageFallbackSuggestions';

/** 官方字面量抽取件（唯一数据来源）。 */
const SOURCE_LITERALS =
  'C:/Users/Administrator/.dsh/attachments/v1/files/e3/e3d1b47b27ac05a5c7a39aaff7df3095ba810c4722f1265f01d43784d55ce31f/prompt-literals.json';

/** 源抽取件是否在本机（不在则第 2 层测试跳过，见文件头）。 */
const HAS_SOURCE = existsSync(SOURCE_LITERALS);

interface OfficialSuggestion {
  id: string;
  title: string;
  prompt: string;
  icon_category: string;
}

const official: OfficialSuggestion[] = HAS_SOURCE
  ? (JSON.parse(readFileSync(SOURCE_LITERALS, 'utf8')) as {
    homepage_fallback_suggestions: OfficialSuggestion[];
  }).homepage_fallback_suggestions
  : [];

/** 源件缺失时才出现的空表比较会误报 ⇒ 第 2 层的用例统一挂这个开关。 */
const withSource = it.skipIf(!HAS_SOURCE);

const officialById = new Map(official.map((item) => [item.id, item]));

/** 抽查：每个语言取首条 / 第 13 条 / 末条。 */
const SAMPLE_IDS = HOMEPAGE_FALLBACK_LANGUAGES.flatMap((language) => [
  `home-fallback-${language}-01`,
  `home-fallback-${language}-13`,
  `home-fallback-${language}-30`,
]);

describe('homepageFallbackSuggestions', () => {
  withSource('源抽取件本身是 150 条（5 语言 × 30 条）', () => {
    expect(official).toHaveLength(150);
    for (const language of HOMEPAGE_FALLBACK_LANGUAGES) {
      expect(official.filter((item) => item.id.startsWith(`home-fallback-${language}-`))).toHaveLength(30);
    }
  });

  it('5 个语言各 30 条，合计 150 条', () => {
    expect(HOMEPAGE_FALLBACK_LANGUAGES).toEqual(['zh', 'en', 'ja', 'ko', 'fr']);
    for (const language of HOMEPAGE_FALLBACK_LANGUAGES) {
      expect(homepageFallbackSuggestions(language)).toHaveLength(30);
    }
    expect(allHomepageFallbackSuggestions()).toHaveLength(150);
  });

  it('冻结字面量：首/末条与源抽取件逐字节原文一致（不依赖任何外部文件）', () => {
    const ours = new Map(allHomepageFallbackSuggestions().map((item) => [item.id, item]));
    /* 下面三条字符串是官方抽取件里的**原文**，逐字节抄进测试，作为仓库自证的冻结期望值
       （源件 `prompt-literals.json` 的 `homepage_fallback_suggestions`，抽取自官产物
       `readable/web/assets/index-Beoy3Atw.js:1475-1775`）。 */
    expect(ours.get('home-fallback-zh-01')).toEqual({
      id: 'home-fallback-zh-01',
      title: '体验最新的 Seedance 2.0 Mini 创作视频',
      prompt: '我想体验最新的 Seedance 2.0 Mini 视频创作能力。请根据这个项目当前的内容或我现在的想法，帮我设计一个适合快速生成的视频方向，并给出可以直接使用的完整创作指令。',
      icon_category: 'next_step',
    });
    expect(ours.get('home-fallback-en-01')).toEqual({
      id: 'home-fallback-en-01',
      title: 'Try Seedance 2.0 Mini video creation',
      prompt: 'I want to try the latest Seedance 2.0 Mini video creation capability. Based on the current project or my current idea, help me design a video direction that is fast to generate, then give me a complete creation prompt I can use directly.',
      icon_category: 'next_step',
    });
    expect(ours.get('home-fallback-fr-30')).toEqual({
      id: 'home-fallback-fr-30',
      title: 'Planifier la prochaine étape créative',
      prompt: "Aide-moi à planifier la prochaine étape créative de ce projet. Détermine d'abord si le projet a le plus besoin d'histoire, de personnages, de visuels, de références ou d'exécution de génération, puis donne-moi un plan d'action que je peux commencer tout de suite.",
      icon_category: 'next_step',
    });
  });

  withSource('各语言的 id 序列与源文件逐字一致（前缀 `home-fallback-<lang>-`）', () => {
    for (const language of HOMEPAGE_FALLBACK_LANGUAGES) {
      expect(homepageFallbackSuggestions(language).map((item) => item.id)).toEqual(
        official
          .filter((item) => item.id.startsWith(`home-fallback-${language}-`))
          .map((item) => item.id),
      );
    }
  });

  withSource('抽查 15 条的 title / prompt / icon_category 与源文件字符串完全相等', () => {
    const ours = new Map(allHomepageFallbackSuggestions().map((item) => [item.id, item]));
    for (const id of SAMPLE_IDS) {
      const fromSource = officialById.get(id);
      const fromModule = ours.get(id);
      expect(fromSource, `源文件缺少 ${id}`).toBeDefined();
      expect(fromModule, `模块缺少 ${id}`).toBeDefined();
      if (!fromSource || !fromModule) return;
      /* 逐字比较：直接对源文件里的原字符串做全等断言。 */
      expect(fromModule.prompt).toBe(fromSource.prompt);
      expect(fromModule.title).toBe(fromSource.title);
      expect(fromModule.icon_category).toBe(fromSource.icon_category);
    }
  });

  withSource('全量 150 条与源文件深度相等（顺序、id、字面量全部一致）', () => {
    expect(allHomepageFallbackSuggestions()).toEqual(official);
  });

  it('未知语言返回空数组：不翻译、不回落、不造默认值', () => {
    expect(homepageFallbackSuggestions('zh-CN')).toEqual([]);
    expect(homepageFallbackSuggestions('')).toEqual([]);
    expect(homepageFallbackSuggestions('de')).toEqual([]);
  });
});
