// @vitest-environment jsdom
/**
 * 「模型映射」页的数据源 —— **已拉取模型目录 ∪ 现有映射数据**。
 *
 * 用户现场（2026）：在连接设置里重新拉取了厂商模型（`/v1/models`），
 * 新模型**不出现在**「设置 → 模型映射」那张表里，看起来像「固定死了」。
 *
 * 根因：面板的 `rows` 只依赖 `config.modelMappingOverrides / removedModelMappings /
 * modelCanonicalAdditions`，而 `listMappingRows()` 本身只从**映射登记表**出表 ——
 * 谁都没读过 `config.providers[*].catalogModels`。
 *
 * 本用例钉两件事：
 *   ① 数据层：目录里存在、映射表里没有的模型 ⇒ 多一行（`fromCatalog`、无 canonicalId、
 *      待审核），并且 `mappingStats()` 的待审核数 +1；
 *   ② 渲染层：把目录塞进 store 的 `config.providers` 后**重新渲染**，表格真的多出这一行
 *      （证明 `useMemo` 的依赖里确实有目录 ⇒ 拉取后自动重算，不需要重开页面）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

/* `useAppStore` 只是被「读」：面板用 selector 读 config 与三个动作。 */
const harness = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) => selector(harness.state),
}));
/* Iconify 走网络加载，jsdom 里没意义 */
vi.mock('@iconify/react', () => ({ Icon: () => null }));
/* 确认框只用于「解除映射」，本用例不点它；真实模块会拖进 tauri 插件 */
vi.mock('../../src/services/confirmDialog', () => ({ confirmAction: vi.fn(async () => false) }));

import ModelMappingSettings from '../../src/components/settings/ModelMappingSettings';
import { setLocale } from '../../src/i18n';
import { listMappingRows, mappingStats } from '../../src/services/models/admin';
import { catalogEntriesOfProviders } from '../../src/services/models/catalog';
import type { ApiProviderConfig } from '../../src/types';

const TUDOU = 'tudou';
const NEW_MODEL_ID = 'zzz-freshly-pulled-model';

/** 面板只读这几个字段（见组件顶部 `useAppStore(...)`）。 */
type HarnessConfig = {
  providers: Record<string, Record<string, unknown>>;
  modelMappingPolicy?: string;
  modelMappingOverrides?: unknown[];
  removedModelMappings?: unknown[];
  modelCanonicalAdditions?: unknown[];
};

function configWith(catalogModels: Array<{ id: string; name: string }>): HarnessConfig {
  return {
    providers: {
      /* 连接 key 是自定义的，平台标识靠 baseUrl 归一化成 `tudou`（与映射表同一口径） */
      'custom-tudou': {
        name: 'tudou',
        apiKey: '',
        baseUrl: 'https://api.ai-tudou.net',
        catalogModels,
      },
    },
    modelMappingPolicy: 'queue',
    modelMappingOverrides: [],
    removedModelMappings: [],
    modelCanonicalAdditions: [],
  };
}

/**
 * ★「拉取模型目录」只换 `config.providers`，**三个映射字段的引用一个字都不动** ——
 *   这与 store 里的真实写入（`saveProviderConfig()` 只重建 `providers`）完全一致，
 *   所以用例能证明「表格重算靠的是目录依赖」，而不是碰巧被别的依赖变化带出来的。
 */
function pullCatalog(into: HarnessConfig, catalogModels: Array<{ id: string; name: string }>): HarnessConfig {
  const connection = into.providers['custom-tudou'];
  return {
    ...into,
    providers: {
      ...into.providers,
      'custom-tudou': { ...connection, catalogModels },
    },
  };
}

function install(config: HarnessConfig) {
  harness.state = {
    config,
    showToast: () => {},
    updateConfig: () => {},
    saveConfig: async () => {},
  };
}

/** 目录里有什么（面板的入参就这一份） */
function catalogOfCurrentConfig() {
  const config = harness.state.config as HarnessConfig;
  return catalogEntriesOfProviders(config.providers as unknown as Record<string, ApiProviderConfig>);
}

const rowsKeyed = (rows: ReturnType<typeof listMappingRows>) => rows.map((row) => `${row.providerId}\u0000${row.providerModelId}`);

beforeEach(() => {
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
  setLocale('zh-CN');
});

describe('数据层：行的来源 = 目录 ∪ 映射数据', () => {
  it('目录里有、映射表里没有 ⇒ 新增一行（无 canonicalId、待审核），统计 +1', () => {
    const beforeRows = listMappingRows();
    const beforeStats = mappingStats();

    install(configWith([{ id: NEW_MODEL_ID, name: 'Freshly Pulled' }]));
    const catalog = catalogOfCurrentConfig();
    expect(catalog).toEqual([{ providerId: TUDOU, providerModelId: NEW_MODEL_ID, providerModelName: 'Freshly Pulled' }]);

    const afterRows = listMappingRows(catalog);
    const afterStats = mappingStats(catalog);

    /* ★ 表格多一行 */
    expect(afterRows.length).toBe(beforeRows.length + 1);
    /* ★ 统计跟着一起算 */
    expect(afterStats.total).toBe(beforeStats.total + 1);
    expect(afterStats.review).toBe(beforeStats.review + 1);
    expect(afterStats.providers).toBe(beforeStats.providers); // 同一家平台，平台数不变

    const added = afterRows.find((row) => row.providerId === TUDOU && row.providerModelId === NEW_MODEL_ID)!;
    expect(added, '目录里的新模型必须在表里').toBeDefined();
    /* 形态与「已登记但没映射上」的行一致：没有官方身份、待审核、依据「未建立官方映射」 */
    expect(added.fromCatalog).toBe(true);
    expect(added.canonicalId).toBeUndefined();
    expect(added.officialName).toBe('');
    expect(added.displayName).toBe(NEW_MODEL_ID);
    expect(added.matchStatus).toBe('unverified');
    expect(added.review).toContain('unmapped');
    expect(added.catalogStatus).toBe('present');
    /* 没有登记过 ⇒ 没有映射依据与更新时间（展开区的「映射依据 / 最后更新时间」显示「未记录」） */
    expect(added.source).toBeUndefined();
    expect(added.updatedAt).toBeUndefined();
  });

  it('已经在映射表里的模型不会被目录重复出一行（同键以映射数据为准）', () => {
    const registered = listMappingRows().find((row) => row.providerId === TUDOU)!;
    install(configWith([{ id: registered.providerModelId, name: '平台名' }]));
    const rows = listMappingRows(catalogOfCurrentConfig());
    const hits = rows.filter((row) => row.providerId === TUDOU && row.providerModelId === registered.providerModelId);
    expect(hits).toHaveLength(1);
    expect(hits[0].fromCatalog).toBeUndefined();
    /* 映射数据里的结论/依据不被目录覆盖 */
    expect(hits[0].matchStatus).toBe(registered.matchStatus);
    expect(hits[0].source).toBe(registered.source);
    expect(hits[0].catalogStatus).toBe('present');
  });

  it('映射表里有、目录里没有 ⇒ 行照旧保留，只标注 absent（删了不能丢数据）', () => {
    const registered = listMappingRows().find((row) => row.providerId === TUDOU)!;
    /* 目录里只给了另一条模型 ⇒ 这条在目录里「不存在」 */
    install(configWith([{ id: NEW_MODEL_ID, name: 'Freshly Pulled' }]));
    const rows = listMappingRows(catalogOfCurrentConfig());
    const kept = rows.find((row) => row.providerId === TUDOU && row.providerModelId === registered.providerModelId)!;
    expect(kept, '映射数据不能被目录删掉').toBeDefined();
    expect(kept.catalogStatus).toBe('absent');
    expect(kept.matchStatus).toBe(registered.matchStatus);
  });

  it('该平台没拉过目录（旧配置）⇒ 不做 absent 标注（不猜）', () => {
    const registered = listMappingRows().find((row) => row.providerId === TUDOU)!;
    install({ providers: {} });
    const rows = listMappingRows(catalogOfCurrentConfig());
    const kept = rows.find((row) => row.providerId === TUDOU && row.providerModelId === registered.providerModelId)!;
    expect(kept.catalogStatus).toBeUndefined();
  });

  it('目录带来的新平台也算一个 Provider（统计里的 Provider 数）', () => {
    const before = mappingStats();
    const catalog = catalogEntriesOfProviders({
      /* 认不出的域名 + 自定义连接 key ⇒ providerId 就是该连接 key（不虚构平台） */
      'custom-brand-new': {
        name: 'brand-new',
        apiKey: '',
        baseUrl: 'https://api.brand-new-vendor.example',
        catalogModels: [{ id: 'model-1', name: 'Model 1' }],
      } as ApiProviderConfig,
    });
    const after = mappingStats(catalog);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].providerId).toBe('custom-brand-new');
    expect(after.total).toBe(before.total + 1);
    expect(after.providers).toBe(before.providers + 1);
  });
});

describe('渲染层：重新拉取目录后表格自动多一行（不需要重开页面）', () => {
  it('把新模型塞进 config.providers 再渲染 ⇒ 搜索得到这一行，统计待审核 +1', () => {
    /* ① 拉目录之前：表里没有这条模型 */
    const before = configWith([]);
    install(before);
    const beforeStats = mappingStats();
    const view = render(<ModelMappingSettings />);

    const search = screen.getByTestId('mm-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: NEW_MODEL_ID } });
    expect(screen.queryByTestId(`mm-row-${TUDOU}-${NEW_MODEL_ID}`)).toBeNull();
    expect(screen.queryByText('没有符合条件的映射')).not.toBeNull();

    /* ② 拉目录（store 侧就是 `saveProviderConfig()`：只重建 `config.providers`） */
    install(pullCatalog(before, [{ id: NEW_MODEL_ID, name: 'Freshly Pulled' }]));
    view.rerender(<ModelMappingSettings />);

    const row = screen.getByTestId(`mm-row-${TUDOU}-${NEW_MODEL_ID}`);
    expect(row).toBeTruthy();
    /* 行形态：主标题 = 平台原始 id（没有官方名）、canonicalId 空、状态待审核、依据「未建立官方映射」 */
    expect(row.querySelector('.mm-title')?.textContent).toBe(NEW_MODEL_ID);
    expect(row.querySelector('.mm-canonical')?.textContent).toBe('—');
    expect(row.querySelector('.mm-basis')?.textContent).toBe('未建立官方映射');
    expect(row.querySelector('.mm-badge')?.getAttribute('data-tone')).toBe('review');
    expect(row.querySelector('.mm-badge')?.textContent).toBe('待审核');

    /* ③ 统计跟着变：待审核 +1，Provider 数不变 */
    const numbers = (text: string | null) => (text ?? '').match(/\d+/g)?.map(Number) ?? [];
    const [verified, review, providers] = numbers(screen.getByTestId('mm-stats').textContent);
    const after = mappingStats(catalogOfCurrentConfig());
    expect(review).toBe(beforeStats.review + 1);
    expect(review).toBe(after.review);
    expect(verified).toBe(after.verified);
    expect(providers).toBe(after.providers);
  });

  it('目录快照里没有的映射行：保留 + 标注「目录快照中未找到」', () => {
    const registered = listMappingRows().find((row) => row.providerId === TUDOU)!;
    install({
      ...configWith([{ id: NEW_MODEL_ID, name: 'Freshly Pulled' }]),
      modelMappingPolicy: 'queue',
    });
    render(<ModelMappingSettings />);
    const search = screen.getByTestId('mm-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: registered.providerModelId } });
    const row = screen.getByTestId(`mm-row-${TUDOU}-${registered.providerModelId}`);
    expect(row).toBeTruthy();
    expect(row.querySelector('.mm-catalog-missing')?.textContent).toBe('目录快照中未找到');
  });

  it('目录行的稳定键仍是 providerId + providerModelId（没有重复行）', () => {
    const registered = listMappingRows().find((row) => row.providerId === TUDOU)!;
    install(configWith([
      { id: registered.providerModelId, name: '平台名' },
      { id: NEW_MODEL_ID, name: 'Freshly Pulled' },
      /* 同一 id 在 selectedModels / catalogModels 各来一次也只算一条 */
      { id: NEW_MODEL_ID, name: 'Freshly Pulled' },
    ]));
    const keys = rowsKeyed(listMappingRows(catalogOfCurrentConfig()));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
