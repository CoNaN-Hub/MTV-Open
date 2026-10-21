/**
 * 「模型映射」管理面板契约（设置 → 模型映射）。
 *
 * 用户要求（2026）：
 *   · 版式**严格对齐官方「权限」页**：居中定宽列、不用左侧栏、不用统计大卡、不用传统表格；
 *     分区标题 + 说明 + 单选设置卡片 / 设置项行的视觉语言。
 *   · 面板**可编辑**：保存映射 / 标记已验证 / 保持原始名称 / 关联或新建 Canonical Model / 解除映射。
 *   · `providerModelId` 只用于调用与日志；界面唯一主展示名是 `displayName`；同步与异步是**两条**映射。
 *   · 不修改既有 Provider Adapter、Canonical Model Registry 与 API 调用逻辑 —— 只重构管理 UI；
 *     写入口是**运行时覆盖层**（`services/models/overrides.ts` + config 三个字段）。
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';

import { setLocale, t } from '../../src/i18n';
import { HIDDEN_FROM_PROVIDER_PICKER_IDS } from '../../src/services/ai/providerCatalogService';
/* ★ 厂商筛选下拉的选项 = 纯函数（单独 `.ts`，组件文件不能导出函数），直接拉进来钉行为 */
import { providerFilterOptions } from '../../src/components/settings/modelMappingProviderFilter';
import { listMappingRows } from '../../src/services/models/admin';
import { allCanonicalModels, getCanonicalModel, isValidCanonicalId } from '../../src/services/models/canonical';
import { findExactMapping, listExactMappings, syncRemovedMappings } from '../../src/services/models/mappings';
import { normalizeModel } from '../../src/services/models/normalize';
import {
  resetModelOverridesForTest, syncCanonicalAdditions, syncMappingOverrides,
} from '../../src/services/models/overrides';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const PANE_RAW = read('src/components/settings/ModelMappingSettings.tsx');
const PANE = code(PANE_RAW);
const CSS = read('src/styles/model-mapping.css');
/** 厂商筛选下拉的选项（纯函数；单独 `.ts`，组件文件不能导出函数） */
const FILTER = code(read('src/components/settings/modelMappingProviderFilter.ts'));

afterEach(() => {
  resetModelOverridesForTest();
  syncRemovedMappings([]);
});

describe('版式对齐官方「权限」页', () => {
  it('复用官方版式原语，且不用左侧栏 / 统计大卡 / 传统表格', () => {
    expect(PANE).toContain('SettingsPaneBody');
    expect(PANE).toContain('mm-page');
    expect(PANE).toContain('o-perm-head-title');
    expect(PANE).toContain('o-perm-head-desc');
    expect(PANE).toContain('o-perm-section__title');
    expect(PANE).toContain('o-perm-section__desc');
    /* 单选设置卡片 = 官方那套（含未选中时的 16×16 占位，少了会横向跑位） */
    expect(PANE).toContain('settings-perm-group');
    expect(PANE).toContain('settings-perm-option');
    expect(PANE).toContain('settings-perm-option-slot');
    /* ⚠️ 不用左侧栏（设置弹层的左栏是共享外壳，由 SettingsPanel 提供） */
    expect(PANE).not.toContain('SettingsNavigation');
    /* ⚠️ 不用统计大卡、不用传统表格 */
    expect(PANE).not.toContain('mm-summary');
    expect(PANE).not.toMatch(/role="table"|<table|<thead|mm-table/);
    expect(CSS).not.toContain('.mm-table');
    /* 内容居中窄栏（用户指定 960–1040px） */
    expect(CSS).toMatch(/\.mm-page\s*\{[^}]*max-width:\s*1000px/);
    expect(CSS).toMatch(/\.mm-page\s*\{[^}]*margin:\s*0 auto/);
  });

  it('顶部标题固定（sticky）', () => {
    expect(CSS).toMatch(/\.mm-page > header\s*\{[^}]*position:\s*sticky/);
    expect(CSS).toMatch(/\.mm-page > header\s*\{[^}]*top:\s*0/);
  });

  it('页面标题与说明逐字', () => {
    expect(PANE).toContain("t('模型映射')");
    expect(PANE).toContain('管理第三方平台调用 ID 与官方展示模型的对应关系。界面优先显示官方展示名称，实际调用始终使用 Provider Model ID。');
  });

  it('三个分区：审核策略 / 已接入映射 / 展开详情', () => {
    expect(PANE).toContain("t('新模型如何处理？')");
    expect(PANE).toContain('该规则决定新发现、未验证的 Provider 模型进入系统后的默认状态。');
    expect(PANE).toContain("t('已接入模型映射')");
    expect(PANE).toContain('搜索、筛选和审核各 Provider 的模型名称映射。待审核项目优先显示。');
    expect(PANE).toContain("t('来源模型')");
    expect(PANE).toContain("t('官方模型')");
    expect(PANE).toContain("t('审核信息')");
  });
});

describe('分区 1：映射审核策略', () => {
  it('两项单选，默认「进入待审核队列」（推荐 + 选中 Check）', () => {
    expect(PANE).toContain("config.modelMappingPolicy ?? 'queue'");
    expect(PANE).toContain("title: '进入待审核队列'");
    expect(PANE).toContain("title: '自动按规则匹配'");
    expect(PANE).toContain('t(option.title)');
    expect(PANE).toContain('保留平台原始名称，不进入正式模型选择器，等待管理员确认官方映射。');
    expect(PANE).toContain('依据已验证别名、原厂、能力、版本等元数据生成候选映射，但仍标记为待审核。');
    /* 选中态用官方那颗橙 + 右侧 Check */
    expect(PANE).toContain("const SELECTED_COLOR = '#E8871E'");
    expect(PANE).toContain('<CheckGlyph />');
    expect(PANE).toContain("role=\"radio\"");
    expect(PANE).toContain('aria-checked={active}');
  });

  it('策略落 `config.modelMappingPolicy`，写入后立即持久化', () => {
    expect(PANE).toContain('{ modelMappingPolicy: next }');
    expect(PANE).toMatch(/await saveConfig\(\{ silent: true \}\)/);
  });
});

describe('分区 2：列表与检索', () => {
  it('工具栏 = 搜索 / Provider / 状态 / 仅显示待审核 / 统计文字（无图表）', () => {
    expect(PANE).toContain('搜索官方展示名、Provider、Provider Model ID 或 canonicalId');
    expect(PANE).toContain("t('厂商')");
    expect(PANE).toContain("t('全部厂商')");
    expect(PANE).toContain("t('仅显示待审核')");
    expect(PANE).toContain('已验证 {verified} · 待审核 {review} · Provider {providers}');
    for (const option of ['状态', '待审核', '已验证', '冲突', '已停用']) {
      expect(PANE, option).toContain(`t('${option}')`);
    }
    /* 不用图表 */
    expect(PANE).not.toMatch(/recharts|chart\.js|<svg[^>]*class="[^"]*chart/);
  });

  it('下拉一律用官方原语：面板里**没有**原生 <select>，三个下拉都是官方 combobox', () => {
    /* 仓库硬规矩：原生 `<select>` 只允许在 `components/shared/Select.tsx` 里
       （`tests/components/select.test.tsx` 全仓扫 JSX）。管理面板也不能破例。 */
    expect(PANE).not.toMatch(/<select[\s>]/);
    expect(PANE).toContain("from '../shared/OfficialCombobox'");
    /* 筛选器也用 combobox（不是 `Select`）：菜单与触发器**同宽** + 搜索行 + 官方空值态。
       `Select` 的菜单是 `width: max-content`（比触发器窄），满足不了「同宽」这条。 */
    expect(PANE).not.toContain("from '../shared/Select'");
    expect((PANE.match(/<OfficialCombobox/g) ?? [])).toHaveLength(3);
    expect(PANE).toContain("searchPlaceholder={t('搜索厂商')}");
    expect(PANE).toContain("searchPlaceholder={t('搜索官方名或 canonicalId')}");
    /* 4 个短选项按官方「语言」那种纯列表（无搜索行） */
    expect(PANE).toContain('searchable={false}');
  });

  it('「全部」不是一个列表项：未筛选时走 placeholder，筛过之后才补一条用来清筛选', () => {
    /* 用户 2026 点名：「按钮是全部 Provider，你下拉怎么还出现了 全部 Provider」；
       随后又要求把字段名改成短的：「全部 Provider → 厂商」「状态：全部 → 状态」。 */
    expect(PANE).toContain("value={providerFilter === 'all' ? '' : providerFilter}");
    expect(PANE).toContain("placeholder={t('厂商')}");
    expect(PANE).toMatch(/providerFilter === 'all' \? \[\] : \[\{ value: 'all', label: t\('全部厂商'\)/);
    expect(PANE).toContain("value={statusFilter === 'all' ? '' : statusFilter}");
    expect(PANE).toContain("placeholder={t('状态')}");
    expect(PANE).toMatch(/statusFilter === 'all' \? \[\] : \[\{ value: 'all', label: t\('全部状态'\)/);
  });

  it('触发器文字用正常前景色（不是官方 `is-empty` 的 #646464）', () => {
    /* 用户 2026 对照「个人简介」的国家 / 城市：那里的字是白的，灰的「丑到爆炸」 */
    expect(CSS).toMatch(/\.mm-page \.mm-selectbox \.o-combobox__trigger\.is-empty\s*,[\s\S]{0,420}?color:\s*var\(--o-foreground\)/);
  });

  it('滚动条必须是**原生细灰条**，不能是 MTV 那条蓝紫自绘滑条', () => {
    /* 用户 2026：「滑条可以，但是那个颜色真的丑到爆炸」= `--scrollbar-thumb:#3a3a50` */
    expect(PANE).toContain('data-overlay-scrollbar="off"');
    expect(CSS).toMatch(/\.mm-scroll\s*\{[^}]*scrollbar-color:\s*rgb\(64, 64, 64\) transparent/);
    /* `index.css` 的 `[data-overlay-scrollbar][data-overlay-scrollbar]{scrollbar-width:none}`（0,2,0）
       会压过本类 ⇒ 必须 `!important`（同 `.project-list`） */
    expect(CSS).toMatch(/\.mm-scroll\[data-overlay-scrollbar='off'\]\s*\{[^}]*scrollbar-width:\s*thin !important/);
  });

  it('有下拉浮层打开时 Escape 让给浮层，不收起编辑区', () => {
    expect(PANE).toContain("document.querySelector('.o-menu, .o-combobox__panel')");
    expect(PANE).toContain('canonicalChoices');
  });

  it('图标全部内联：Iconify 是**网络**异步的，首帧缺席会把后面的文字推位', () => {
    /* 用户 2026：「点击厂商，搜索这里先出来 搜索厂商，然后再出来图标」——
       CDP 逐帧实测：`t=697ms` 搜索行在、图标 null、输入框 left=12；`t=829ms` 图标到、left=36。
       ⇒ 会「带位」的图标一律内联成 SVG（路径逐字抄运行中的应用）。 */
    for (const glyph of ['SearchGlyph', 'ChevronGlyph', 'CheckGlyph', 'PolicyGlyph']) {
      expect(PANE, glyph).toContain(`function ${glyph}`);
    }
    expect(PANE).toContain('<PolicyGlyph id={option.id} active={active} />');
    expect(PANE).toContain('<ChevronGlyph />');
    expect(PANE).toContain('<SearchGlyph size={14} />');
    /* 唯一留下的 `<Icon>`（告警三角，路径没在运行环境里取到）必须套定尺 slot，不能推位 */
    expect(PANE).toContain('className="mm-alert-icon"');
    expect(CSS).toMatch(/\.mm-alert-icon\s*\{[^}]*width:\s*14px/);

    const combo = code(read('src/components/shared/OfficialCombobox.tsx'));
    expect(combo).not.toMatch(/<Icon\b/);
    expect(combo).toContain('function SearchIcon');
    expect(combo).toContain('function ChevronIcon');
    expect(combo).toContain('function CheckIcon');
    expect(combo).not.toContain("from '@iconify/react'");
  });

  it('统计文字取 `mappingStats()`，不是自己数的', () => {
    /* ★ 2026：统计与列表必须吃同一份「映射 ∪ 已拉取目录」快照 ⇒ 传 `catalog` */
    expect(PANE).toContain('mappingStats(catalog)');
    expect(PANE).toContain('verified: stats.verified');
    expect(PANE).toContain('review: stats.review');
    expect(PANE).toContain('providers: stats.providers');
  });

  it('每行是**设置项行**：主标题 = displayName，调用 id 只在次级灰字里', () => {
    expect(PANE).toContain('<span className="mm-title">{row.displayName}</span>');
    expect(PANE).toMatch(/mm-sub[\s\S]{0,320}<code>\{row\.providerModelId\}<\/code>/);
    /* 中间列 = canonicalId + 映射依据摘要 */
    expect(PANE).toMatch(/mm-canonical[\s\S]{0,200}row\.canonicalId/);
    expect(PANE).toContain('basisOf(row)');
    for (const basis of ['官方表精确匹配', '已验证别名', '自动候选，待人工确认', '未建立官方映射']) {
      expect(PANE, basis).toContain(basis);
    }
  });

  it('状态 Badge：已验证=绿 / 待审核=琥珀 / 冲突=红 / 已停用=灰', () => {
    expect(PANE).toContain("data-tone={badge.tone}");
    expect(PANE).toContain("return { label: '已验证', tone: 'verified' }");
    expect(PANE).toContain("return { label: '待审核', tone: 'review' }");
    expect(PANE).toContain("return { label: '已停用', tone: 'deprecated' }");
    for (const tone of ['verified', 'review', 'conflict', 'deprecated']) {
      expect(CSS, tone).toMatch(new RegExp(`\\.mm-badge\\[data-tone='${tone}'\\]`));
    }
  });

  it('待审核项：左侧极细琥珀色强调线，不做大面积黄色背景', () => {
    expect(CSS).toContain(".mm-item-row[data-review='true']::before");
    const rail = CSS.slice(CSS.indexOf(".mm-item-row[data-review='true']::before"));
    expect(rail).toMatch(/width:\s*2px/);
    expect(rail.slice(0, 200)).toMatch(/background:\s*#e8871e/);
    /* 整行不得铺黄色底 */
    expect(CSS).not.toMatch(/\.mm-item-row\[data-review='true'\]\s*\{[^}]*background:/);
  });

  it('长列表虚拟滚动 + 默认只展开一条 + Esc 收起', () => {
    expect(PANE).toContain('new ResizeObserver');
    expect(PANE).toMatch(/translateY\(\$\{offsets\[startIndex\]/);
    expect(PANE).toContain('const [expandedKey, setExpandedKey] = useState<string | null>(null)');
    expect(PANE).toContain("event.key !== 'Escape'");
    /* 同一条再点一次 = 收起（打开另一条自动收起上一条） */
    expect(PANE).toMatch(/if \(expandedKey === key\) \{[\s\S]{0,90}setExpandedKey\(null\)/);
  });

  it('行的稳定键是 providerId + providerModelId（同步/异步各一条）', () => {
    expect(PANE).toMatch(/function rowKey\(row: Pick<MappingRow, 'providerId' \| 'providerModelId'>\): string/);
    const rows = listMappingRows();
    const keys = rows.map((row) => `${row.providerId}\u0000${row.providerModelId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('正在编辑的那一条被钉在列表最前，且豁免内容型筛选（保存后编辑区不会凭空消失）', () => {
    /* 待审核优先排序：一次保存可能让这一条不再「待审核」（刚关联上 canonical），
       不钉住的话它会跳到列表末尾、展开的编辑区直接从视口里消失（CDP 实测）。 */
    expect(PANE).toContain('const anchored = rowKey(row) === expandedKey');
    expect(PANE).toMatch(/if \(!anchored\) \{[\s\S]{0,520}onlyReview && row\.review\.length === 0/);
    expect(PANE).toContain('if (aKey === expandedKey || bKey === expandedKey)');
  });

  it('展开 / 收起后把目标行滚到视口顶部，且不在 effect 里写 state', () => {
    expect(PANE).toContain('const scrollTargetRef = useRef<string | null>(null)');
    expect(PANE).toContain('scrollTargetRef.current = key');
    expect(PANE).toContain('box.scrollTop = top');
    /* 仓库 lint 禁止在 effect 里同步 setState（会级联渲染）⇒ 用 ref */
    expect(PANE).not.toMatch(/useLayoutEffect\(\(\) => \{[\s\S]{0,120}setScrollTarget/);
  });
});

describe('分区 3：展开后的编辑区', () => {
  it('来源模型 / 官方模型 / 审核信息 三块字段齐备', () => {
    for (const fact of [
      "t('Provider Model ID')", "t('平台原始名称')", "t('执行模式')", "t('平台规格后缀')",
      "t('Official Vendor')", "t('Official Name')", "t('Canonical ID')", "t('Display Name')",
      "t('能力标签')", "t('映射状态')", "t('映射依据 Source')", "t('最后更新时间')",
      "t('待审核原因')", "t('备注')",
    ]) {
      expect(PANE, fact).toContain(fact);
    }
  });

  it('六个操作齐备；破坏性操作走确认框', () => {
    for (const label of [
      '保存映射', '确认并标记为已验证', '保持原始名称并标记待审核',
      '关联已有 Canonical Model', '创建新的 Canonical Model', '解除映射',
    ]) {
      expect(PANE, label).toContain(`t('${label}')`);
    }
    expect(PANE).toContain('confirmAction');
    expect(PANE).toContain("kind: 'warning'");
  });

  it('单条保存 = 乐观更新 + 失败回滚 + Toast', () => {
    expect(PANE).toContain('showToast');
    expect(PANE).toContain('updateConfig(patch)');
    /* 回滚：把这一组字段还原成提交前的值 */
    expect(PANE).toContain('modelMappingOverrides: before.modelMappingOverrides');
    expect(PANE).toContain('modelCanonicalAdditions: before.modelCanonicalAdditions');
    expect(PANE).toContain('removedModelMappings: before.removedModelMappings');
  });

  it('「标记为已验证」必须先有官方身份（不假装能验证原始名）', () => {
    expect(PANE).toContain("t('请先关联或创建 Canonical Model，再标记为已验证。')");
    expect(PANE).toMatch(/if \(!expandedRow\.canonicalId\) \{[\s\S]{0,240}return;/);
  });

  it('canonicalId 有格式校验，新建时还要查重', () => {
    expect(PANE).toContain('isValidCanonicalId');
    expect(PANE).toContain('canonicalId 格式无效，应形如 vendor/slug（小写字母、数字与连字符）。');
    expect(PANE).toContain("t('该 canonicalId 已存在，请改用「关联已有 Canonical Model」。')");
  });

  it('展示名只在管理员真的改过时才落 displayNameOverride（不冻住官方表改名）', () => {
    expect(PANE).toContain('initialDraft && draft.displayName !== initialDraft.displayName');
    expect(PANE).toContain('这是产品界面唯一的主展示名。异步模型必须保留 async。');
  });
});

describe('运行时覆盖层（面板的写入口，不动 Adapter / Registry / 调用链）', () => {
  const TUDOU = 'tudou';
  const UNMAPPED_ID = 'gpt-image-2-all';

  it('保存映射：覆盖同 key 的文件条目，解析立刻生效，调用 id 原样', () => {
    const before = normalizeModel({ providerId: TUDOU, providerModelId: UNMAPPED_ID });
    expect(before.canonicalId).toBeUndefined();

    syncMappingOverrides([{
      providerId: TUDOU,
      providerModelId: UNMAPPED_ID,
      canonicalId: 'google/banana-pro',
      matchStatus: 'verified',
      source: '测试',
      updatedAt: '2026-01-01',
    }]);

    const after = normalizeModel({ providerId: TUDOU, providerModelId: UNMAPPED_ID });
    expect(after.canonicalId).toBe('google/banana-pro');
    expect(after.matchStatus).toBe('verified');
    expect(after.officialName).toBe(getCanonicalModel('google/banana-pro')!.officialName);
    /* ★ 出站调用 id 逐字不变 */
    expect(after.providerModelId).toBe(UNMAPPED_ID);
  });

  it('覆盖层可以只写一条，文件里其它条目不受影响', () => {
    const count = listExactMappings(TUDOU).length;
    syncMappingOverrides([{
      providerId: TUDOU, providerModelId: UNMAPPED_ID, canonicalId: 'google/banana-pro',
      matchStatus: 'verified', source: '测试', updatedAt: '2026-01-01',
    }]);
    expect(listExactMappings(TUDOU).length).toBe(count);
  });

  it('保持原始名称并标记待审核：写覆盖条目而不是删文件', () => {
    const row = listMappingRows().find((item) => item.providerId === TUDOU && item.canonicalId)!;
    syncMappingOverrides([{
      providerId: TUDOU,
      providerModelId: row.providerModelId,
      matchStatus: 'manual-review',
      source: '管理员保持平台原始名称，待人工确认',
      updatedAt: '2026-01-01',
    }]);
    const model = normalizeModel({ providerId: TUDOU, providerModelId: row.providerModelId });
    expect(model.canonicalId).toBeUndefined();
    expect(model.matchStatus).toBe('manual-review');
    /* 名字回退到原始平台 id（不冒充官方名） */
    expect(model.displayName.startsWith(row.providerModelId)).toBe(true);
  });

  it('解除映射：第 1 档映射被屏蔽（可恢复），且不改文件本身', () => {
    const row = listMappingRows().find((item) => item.providerId === TUDOU && item.canonicalId)!;
    const key = `${TUDOU}\u0000${row.providerModelId}`;
    const before = normalizeModel({ providerId: TUDOU, providerModelId: row.providerModelId });
    expect(findExactMapping(TUDOU, row.providerModelId)).not.toBeNull();
    expect(listExactMappings(TUDOU).some((m) => m.providerModelId === row.providerModelId)).toBe(true);

    syncRemovedMappings([key]);
    expect(findExactMapping(TUDOU, row.providerModelId)).toBeNull();
    expect(listExactMappings(TUDOU).some((m) => m.providerModelId === row.providerModelId)).toBe(false);
    /* 解析不再走「映射登记」那一档（可能落到第 3.5 档，所以只比对依据变了） */
    expect(normalizeModel({ providerId: TUDOU, providerModelId: row.providerModelId }).source)
      .not.toBe(before.source);

    syncRemovedMappings([]);
    expect(findExactMapping(TUDOU, row.providerModelId)).not.toBeNull();
    expect(listExactMappings(TUDOU).some((m) => m.providerModelId === row.providerModelId)).toBe(true);
    expect(normalizeModel({ providerId: TUDOU, providerModelId: row.providerModelId }).source)
      .toBe(before.source);
  });

  it('新建 Canonical Model：additions 立刻可解析（Registry 内容变了，但文件没改）', () => {
    const canonicalId = 'test-vendor/test-slug';
    expect(isValidCanonicalId(canonicalId)).toBe(true);
    expect(allCanonicalModels().some((m) => m.canonicalId === canonicalId)).toBe(false);

    syncCanonicalAdditions([{
      canonicalId, officialName: 'Test Model', officialVendor: 'Test', capabilities: ['image'],
      status: 'active', source: '管理员在「模型映射」中新建', updatedAt: '2026-01-01',
    }]);
    syncMappingOverrides([{
      providerId: TUDOU, providerModelId: UNMAPPED_ID, canonicalId, matchStatus: 'verified',
      source: '测试', updatedAt: '2026-01-01',
    }]);

    const model = normalizeModel({ providerId: TUDOU, providerModelId: UNMAPPED_ID });
    expect(model.canonicalId).toBe(canonicalId);
    expect(model.officialName).toBe('Test Model');
    expect(model.displayName).toBe('Test Model');
  });

  it('异步与同步始终是两条独立映射（覆盖一条不吞掉另一条）', () => {
    const rows = listMappingRows().filter((row) => row.providerId === TUDOU && row.providerSuffix === 'async');
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    expect(row.executionMode).toBe('async');
    /* 异步的 displayName 必须保留 async */
    expect(row.displayName.split(' ').pop()).toBe('async');
    /* 覆盖异步那条，不影响同步那条 */
    const sync = listMappingRows().find((item) => item.providerId === TUDOU
      && item.providerModelId === row.providerModelId.replace(/-async$/, ''))!;
    syncMappingOverrides([{
      providerId: TUDOU, providerModelId: row.providerModelId, canonicalId: 'google/banana-pro',
      matchStatus: 'verified', source: '测试', updatedAt: '2026-01-01',
    }]);
    const syncAfter = normalizeModel({ providerId: TUDOU, providerModelId: sync.providerModelId });
    expect(syncAfter.providerModelId).toBe(sync.providerModelId);
    expect(syncAfter.displayName).not.toContain('async');
  });

  it('面板不 import Adapter / 请求合同 / 目录服务（调用链一个字都不改）', () => {
    expect(PANE).not.toMatch(/models\/adapters/);
    expect(PANE).not.toMatch(/imageRequestContracts/);
    expect(PANE).not.toMatch(/providerCatalogService/);
    expect(PANE).not.toMatch(/buildRequest|buildAuth|parseResponse/);
  });
});

describe('新词条已进 en/ja/ko 字典', () => {
  it('每个新文案三种语言都有词条', () => {
    const keys = [
      '新模型如何处理？', '进入待审核队列', '自动按规则匹配', '已接入模型映射',
      '仅显示待审核', '未建立官方映射', '官方表精确匹配', '已验证别名', '自动候选，待人工确认',
      '来源模型', '官方模型', '审核信息', '保存映射', '确认并标记为已验证',
      '保持原始名称并标记待审核', '关联已有 Canonical Model', '创建新的 Canonical Model', '解除映射',
      '恢复全部', '平台规格后缀', '能力标签', '待审核原因',
      'Canonical ID', 'Display Name',
    ];
    for (const locale of ['en-US', 'ja-JP', 'ko-KR']) {
      const src = read(`src/i18n/locales/${locale}/settings.ts`);
      for (const key of keys) expect(src, `${locale} 缺 ${key}`).toContain(`'${key}':`);
    }
  });
});

/**
 * 用户 2026：展开一条映射后，`Canonical ID` 与 `Display Name` 是**两个纯英文**字段名，
 * 要求「英文保留、后面写上中文」。⇒ 两个字段名走 i18n key（英文原文为 key），
 * zh 由 `locales/zh-CN/index.ts` 打中文注解，en/ja/ko 各自补对应语言的注解，**四语都不留半截**。
 */
describe('两个英文字段名后面的中文注解', () => {
  afterEach(() => {
    setLocale('zh-CN');
  });

  it('英文原名仍是 i18n key（组件渲染点没被改写成中文 key）', () => {
    expect(PANE).toContain("{t('Canonical ID')}");
    expect(PANE).toContain("{t('Display Name')}");
  });

  it('四语都同时含英文原名与本地语言注解', () => {
    for (const locale of ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'] as const) {
      setLocale(locale);
      for (const key of ['Canonical ID', 'Display Name']) {
        const label = t(key);
        /* 英文原名**保留在前**（用户要求：英文别删；en 的 `Display name` 原样保留大小写） */
        expect(label.toLowerCase().startsWith(key.toLowerCase()), `${locale} ${key} 丢了英文原名`).toBe(true);
        /* 后面确实跟了注解，不是原样英文 */
        expect(label.length, `${locale} ${key} 没加注解`).toBeGreaterThan(key.length);
        expect(label.trim().length, `${locale} ${key} 注解为空`).toBeGreaterThan(key.length);
      }
    }
  });

  it('中文注解逐字：Canonical ID = 规范模型 ID；Display Name = 显示名', () => {
    setLocale('zh-CN');
    expect(t('Canonical ID')).toBe('Canonical ID（规范模型 ID，内部标识）');
    expect(t('Display Name')).toBe('Display Name（显示名，界面唯一展示名）');
  });

  it('两个字段的注解不许互相串（别把两个搞混）', () => {
    setLocale('zh-CN');
    expect(t('Canonical ID')).not.toContain('显示名');
    expect(t('Display Name')).not.toContain('规范模型 ID');
  });

  it('ja/ko 是各自语言的注解，不是照抄英文或中文', () => {
    for (const [locale, marker] of [['ja-JP', '識別子'], ['ko-KR', '식별자']] as const) {
      setLocale(locale);
      const canonical = t('Canonical ID');
      expect(canonical, `${locale} Canonical ID 注解不是本地语言`).toContain(marker);
      expect(canonical, `${locale} Canonical ID 抄了中文`).not.toContain('规范模型 ID');
    }
  });
});

/**
 * 用户现场（2026-10-15）：设置 → 模型映射 的**厂商筛选下拉**里仍然列着
 * `cccapi / google / grsai / sora2u / volcengine / xai` —— 上一轮只下架了「新建连接」的选择框，
 * 漏了这里。
 *
 * 两条纪律：
 *  ① 判定/名单**只有一份**（`providerCatalogService.HIDDEN_FROM_PROVIDER_PICKER_IDS` /
 *     `isProviderSelectable`）—— 本页不复制常量、不另建名单；
 *  ② **下架只影响下拉选项** —— 已下架厂商的映射数据一个字都不能丢（解析、调用、列表照旧）。
 */
describe('厂商筛选下拉：已下架厂商不再列出（映射数据仍然保留）', () => {
  const XAI_MODEL_ID = 'grok-imagine-video-1.5-preview';

  it('构造一条 xai 映射数据 ⇒ 它仍在数据层，只是不在下拉选项里', () => {
    /* 写运行时覆盖层 = 面板「保存映射」的同一入口（xai.json 本身也在，这里再显式加一条） */
    syncMappingOverrides([{
      providerId: 'xai',
      providerModelId: XAI_MODEL_ID,
      canonicalId: 'xai/grok-imagine-video-1.5-preview',
      matchStatus: 'verified',
      source: '测试构造',
      updatedAt: '2026-01-01',
    }]);

    const rows = listMappingRows();
    /* ★ 数据层还在：这一条仍然列在映射列表里、仍然能被解析 —— 下架 ≠ 清空/丢弃 */
    expect(rows.filter((row) => row.providerId === 'xai').map((row) => row.providerModelId))
      .toContain(XAI_MODEL_ID);
    expect(findExactMapping('xai', XAI_MODEL_ID)).not.toBeNull();

    /* 下拉选项 = 数据层的 providerId **再过一层**同一判定 */
    const options = providerFilterOptions(rows.map((row) => row.providerId));

    /* 用户现场看到的 6 个应下架的一个都不许留 */
    for (const hidden of ['cccapi', 'google', 'grsai', 'sora2u', 'volcengine', 'xai']) {
      expect(options, `${hidden} 不应出现在厂商筛选下拉里`).not.toContain(hidden);
    }
    /* 应保留的（有映射数据的）厂商仍在 */
    expect(options).toContain('runninghub');
    expect(options).toContain('tudou');
  });

  it('判定与「新建连接」共用同一份名单（本页没有第二份）', () => {
    /* 下拉选项确实走了那份判定 */
    expect(PANE).toContain('providerFilterOptions(rows.map((row) => row.providerId))');
    /* ★ 判定所在的模块：import 的是**既有** `isProviderSelectable`，自己没有名单常量 */
    expect(FILTER).toContain("import { isProviderSelectable } from '../../services/ai/providerCatalogService'");
    expect(FILTER).not.toMatch(/HIDDEN_FROM_PROVIDER_PICKER_IDS/);
    expect(FILTER).not.toMatch(/'cccapi'|'volcengine'|'sora2u'|'grsai'|'xai'|'google'/);
    /* 本页也不许自己拼一份下架名单 */
    expect(PANE).not.toMatch(/HIDDEN_FROM_PROVIDER_PICKER_IDS/);
    expect(PANE).not.toMatch(/'cccapi'|'volcengine'|'sora2u'|'grsai'|'xai'/);
    /* 名单里每一个都被判定为不可选（保留的 tudou 不受影响） */
    for (const hidden of HIDDEN_FROM_PROVIDER_PICKER_IDS) {
      expect(providerFilterOptions([hidden, 'tudou']), hidden).toEqual(['tudou']);
    }
  });
});
