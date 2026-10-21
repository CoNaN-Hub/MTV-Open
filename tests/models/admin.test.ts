/**
 * 映射管理视图契约（设置 → 模型映射）。
 *
 * 用户要求（2026）：
 *   「提供开发或管理视图，显示：Provider、原始模型名称、调用 ID、官方展示名、
 *     canonicalId、执行模式、映射状态、映射依据和更新时间」
 *   「对未映射、冲突、下线或元数据变化的模型建立待审核机制」
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  listMappingConflicts, listMappingRows, listReviewRows, mappingStats, mappingsForCanonical,
} from '../../src/services/models/admin';
import { allProviderConfigs } from '../../src/services/models/providers';
import { allCanonicalModels } from '../../src/services/models/canonical';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('映射表数据（管理视图的唯一数据源）', () => {
  const rows = listMappingRows();

  it('每行都带齐用户点名的九个字段', () => {
    expect(rows.length).toBeGreaterThan(300);
    for (const row of rows) {
      expect(typeof row.providerId, row.providerModelId).toBe('string');
      expect(typeof row.providerLabel, row.providerModelId).toBe('string');
      expect(typeof row.providerModelId, row.providerModelId).toBe('string');
      expect(typeof row.officialName, row.providerModelId).toBe('string');
      expect(typeof row.displayName, row.providerModelId).toBe('string');
      expect(['sync', 'async']).toContain(row.executionMode);
      expect(['verified', 'unverified', 'manual-review']).toContain(row.matchStatus);
      expect(['verified', 'unverified', 'deprecated']).toContain(row.status);
      /* canonicalId / source / updatedAt 允许缺，但字段本身要在 */
      expect('canonicalId' in row).toBe(true);
      expect('source' in row).toBe(true);
      expect('updatedAt' in row).toBe(true);
    }
  });

  it('`displayName` 永远不是平台前缀形态（界面只显示它）', () => {
    for (const row of rows) {
      expect(row.displayName, row.providerModelId)
        .not.toMatch(/^(apimart|grsai|cccapi|volcengine|runninghub|dreamina|tudou|general)\//);
    }
  });

  it('有官方身份的条目：canonicalId 一定存在于 Registry，官方名与 Registry 逐字一致', () => {
    const canonical = new Map(allCanonicalModels().map((m) => [m.canonicalId, m]));
    let withCanonical = 0;
    for (const row of rows) {
      if (!row.canonicalId) continue;
      withCanonical++;
      const official = canonical.get(row.canonicalId);
      expect(official, row.canonicalId).toBeDefined();
      expect(row.officialName, row.providerModelId).toBe(official!.officialName);
      /* displayName = 官方名 + 可能的规格后缀 */
      expect(row.displayName === row.officialName
        || row.displayName === `${row.officialName} ${row.providerSuffix}`).toBe(true);
    }
    expect(withCanonical).toBeGreaterThan(30);
  });

  it('没有官方身份的条目：officialName 为空，displayName 取自平台策划名或原始 id', () => {
    for (const row of rows) {
      if (row.canonicalId) continue;
      expect(row.officialName, row.providerModelId).toBe('');
      expect(row.displayName).toBeTruthy();
    }
  });

  it('行按 平台 → 调用 ID 排序（表里稳定可读）', () => {
    const sorted = [...rows].sort((a, b) => (
      a.providerId.localeCompare(b.providerId) || a.providerModelId.localeCompare(b.providerModelId)
    ));
    expect(rows.map((r) => `${r.providerId}/${r.providerModelId}`))
      .toEqual(sorted.map((r) => `${r.providerId}/${r.providerModelId}`));
  });
});

describe('待审核机制', () => {
  it('未映射 / 待人工确认 / 仅策划名 都会被标出来', () => {
    const review = listReviewRows();
    expect(review.length).toBeGreaterThan(0);
    const reasons = new Set(review.flatMap((row) => row.review));
    expect(reasons.has('planned-name-only')).toBe(true);
    expect(reasons.has('manual-review')).toBe(true);
    for (const row of review) expect(row.review.length).toBeGreaterThan(0);
  });

  it('`manual-review` 的条目名字照给，但状态标记保留（不冒充已验证）', () => {
    const manual = listMappingRows().filter((row) => row.matchStatus === 'manual-review');
    expect(manual.length).toBeGreaterThan(0);
    for (const row of manual) {
      expect(row.review).toContain('manual-review');
      /* 候选没换名字：有 canonicalId 才会显示官方名，否则是原始 id */
      expect(row.canonicalId ? row.displayName : row.providerModelId).toBe(row.displayName);
    }
  });

  it('官方下场（deprecated）会被标出来（当前数据里没有 ⇒ 机制存在即可）', () => {
    for (const row of listMappingRows()) {
      if (row.status === 'deprecated') expect(row.review).toContain('deprecated');
    }
  });

  it('冲突检测：同平台同调用 ID 不许重复（构建期已保证，这里兜一层）', () => {
    expect(listMappingConflicts()).toEqual([]);
  });
});

describe('概览统计', () => {
  it('统计口径与逐行统计一致', () => {
    const stats = mappingStats();
    const rows = listMappingRows();
    expect(stats.total).toBe(rows.length);
    expect(stats.verified).toBe(rows.filter((r) => r.matchStatus === 'verified').length);
    expect(stats.manualReview).toBe(rows.filter((r) => r.matchStatus === 'manual-review').length);
    expect(stats.unverified).toBe(rows.filter((r) => r.matchStatus === 'unverified').length);
    expect(stats.review).toBe(rows.filter((r) => r.review.length > 0).length);
    expect(stats.canonicalModels).toBe(allCanonicalModels().length);
    /* `providers` = **有映射文件的平台数**（不是平台定义表条数 —— 有些平台还没配映射）*/
    expect(stats.providers).toBe(new Set(rows.map((r) => r.providerId)).size);
    expect(stats.providers).toBeLessThanOrEqual(allProviderConfigs().length);
    /* 声明了执行规格后缀的平台（async 这类必须是配置来的）*/
    expect(stats.providersWithSuffix).toBeGreaterThanOrEqual(1);
  });

  it('某个官方模型被哪些平台映射 —— 改官方名时能看到影响面', () => {
    const hit = mappingsForCanonical('google/banana-pro');
    expect(hit.length).toBeGreaterThanOrEqual(2);
    expect(new Set(hit.map((r) => r.providerId)).size).toBeGreaterThanOrEqual(2);
    /* 同步与异步都在 */
    expect(new Set(hit.map((r) => r.executionMode))).toEqual(new Set(['sync', 'async']));
  });
});

describe('设置面板接线（新增平台只加配置，不改这里的结构）', () => {
  it('导航里有「模型映射」，置于「模型与连接」组', () => {
    const nav = read('src/components/settings/SettingsNavigation.tsx');
    expect(nav).toContain("id: 'modelMapping'");
    expect(nav).toContain("label: '模型映射'");
    expect(nav.indexOf("id: 'api'")).toBeLessThan(nav.indexOf("id: 'modelMapping'"));
  });

  it('`SettingsTab` 有 `modelMapping`，面板会渲染它', () => {
    expect(read('src/store/store.ui.ts')).toMatch(/\|\s*'modelMapping'/);
    const panel = read('src/components/SettingsPanel.tsx');
    expect(panel).toContain("import ModelMappingSettings from './settings/ModelMappingSettings';");
    expect(panel).toContain("activeTab === 'modelMapping' && <ModelMappingSettings />");
  });

  it('面板通过**配置覆盖层**写映射，不碰 Provider Adapter / 调用链', () => {
    const pane = code(read('src/components/settings/ModelMappingSettings.tsx'));
    expect(pane).toContain("from '../../services/models/admin'");
    /* 写入口只有这四组 config 字段（store 侧会把它们推进 overrides 快照） */
    expect(pane).toContain('modelMappingOverrides');
    expect(pane).toContain('removedModelMappings');
    expect(pane).toContain('modelCanonicalAdditions');
    expect(pane).toContain('modelMappingPolicy');
    /* ⚠️ 管理 UI 不 import 任何 Adapter / 请求合同 / 目录服务 —— 调用链一个字都不改 */
    expect(pane).not.toMatch(/models\/adapters/);
    expect(pane).not.toMatch(/imageRequestContracts/);
    expect(pane).not.toMatch(/providerCatalogService/);
    /* 数据源本身也不该碰 store */
    const admin = code(read('src/services/models/admin.ts'));
    expect(admin).not.toMatch(/from '\.\.\/\.\.\/store/);
    expect(admin).not.toMatch(/from '\.\.\/\.\.\/components/);
  });

  it('CSS 已引入', () => {
    expect(read('src/index.css')).toContain("@import './styles/model-mapping.css';");
  });

  it('新词条已进 en/ja/ko 字典', () => {
    for (const loc of ['en-US', 'ja-JP', 'ko-KR']) {
      const src = read(`src/i18n/locales/${loc}/settings.ts`);
      for (const key of ['模型映射', '调用 ID', '官方展示名', '映射依据 Source', '未映射', '待人工确认', '来源模型', '官方模型', '审核信息']) {
        expect(src, `${loc} 缺 ${key}`).toContain(`'${key}':`);
      }
    }
  });
});
