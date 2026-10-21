/**
 * settings/ModelMappingSettings —— 「模型映射」管理面板（可编辑）
 *
 * 版式**严格照抄官方「权限」页**（`DesktopPermissionsSettings.tsx` 的注释里记了官方出处）：
 *   · 居中定宽列（`div.mx-auto.flex.w-full.max-w-2xl.flex-col.gap-8`）——这里放宽到
 *     960–1040px（用户指定），其余间距/字号/圆角/描边全部复用 `.o-perm-*` / `.settings-perm-*`。
 *   · 页头 `h2`（20/600/28）+ `p.mt-1`（14/20）
 *   · 每个分区 `section.space-y-3` + `h3.text-sm.font-medium.tracking-tight` + `p.text-xs.leading-5`（12/20）
 *   · 单选设置卡片 = `.settings-perm-group` + `.settings-perm-option`（选中 `#E8871E` + 右侧 Check，
 *     未选中一颗 16×16 占位 —— 少了它会横向跑位）
 *   · 映射列表**不是表格**：每条映射是一行**设置项**，展开后的编辑区落在**该卡片下方**
 *
 * 数据流：
 *   读 —— `services/models/admin.ts` 的 `listMappingRows(catalog)` / `mappingStats(catalog)`
 *         `catalog` = `services/models/catalog.ts` 的 `catalogEntriesOfProviders(config.providers)`
 *         ⇒ **行的来源 = 已拉取模型目录 ∪ 现有映射数据**（重新拉取厂商模型后新模型会自动出现）
 *   写 —— `config.modelMappingPolicy` / `modelMappingOverrides` / `removedModelMappings` /
 *          `modelCanonicalAdditions`（由 `store.config.ts` 推进 `services/models/overrides.ts` 的快照）
 *
 * ⚠️ 本面板**不改** Provider Adapter、Canonical Model Registry 与 API 调用逻辑：
 *    调用 id 仍然是 `providerModelId`（原样发），界面唯一主展示名仍然只有 `displayName`。
 *    运行时覆盖层只影响「身份怎么解析 / 展示名怎么取」，是让「保存 / 解除 / 新建 canonical」
 *    真正落地所必需的**加法扩展**（见 `services/models/overrides.ts` 顶部说明）。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';

import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { SettingsPaneBody } from './SettingsPane';
import { OfficialSwitch } from './official/OfficialControls';
import OfficialCombobox from '../shared/OfficialCombobox';
import { confirmAction } from '../../services/confirmDialog';
import {
  listMappingConflicts, listMappingRows, mappingStats, type MappingRow, type ReviewReason,
} from '../../services/models/admin';
import { catalogEntriesOfProviders } from '../../services/models/catalog';
import { allCanonicalModels, getCanonicalModel, isValidCanonicalId } from '../../services/models/canonical';
import { findExactMapping } from '../../services/models/mappings';
import type { CanonicalModel, ProviderModelMapping } from '../../services/models/types';
/* ★ 厂商筛选下拉的选项（含「下架厂商不再列出」的判定）—— 单独 `.ts`：
   `react-refresh/only-export-components` 不允许组件文件导出函数。
   下架名单/判定**只有一份**（`providerCatalogService`），这里不复制常量。 */
import { providerFilterOptions } from './modelMappingProviderFilter';
import type { AppConfig } from '../../types';

/** 官方式选中色（官方「权限」页的 `#E8871E`） */
const SELECTED_COLOR = '#E8871E';

/** 折叠行的高度（实测 62px：上下内边距 24 + 标题 20 + 间隙 2 + 次级行 16）；
    只影响虚拟滚动的初始窗口 —— 渲染过的行会被 ResizeObserver 量出真实高度。 */
const ROW_FALLBACK_HEIGHT = 62;
/** 视口外多渲染几条，滚动时不露白。 */
const OVERSCAN = 4;

/** 待审核原因 → 文案（中文原文即 i18n key）。 */
const REVIEW_LABELS: Record<ReviewReason, string> = {
  unmapped: '未映射',
  'manual-review': '待人工确认',
  'planned-name-only': '仅策划名',
  deprecated: '官方已下线',
  'metadata-stale': '官方元数据已变',
};

type StatusFilter = 'all' | 'review' | 'verified' | 'conflict' | 'deprecated';

/** 行的稳定键 —— **必须是 providerId + providerModelId**（同步/异步是两条）。 */
function rowKey(row: Pick<MappingRow, 'providerId' | 'providerModelId'>): string {
  return `${row.providerId}\u0000${row.providerModelId}`;
}

/** 解除映射在 config 里的键（与 `services/models/mappings.ts` 的 `isMappingRemoved` 同构）。 */
function removedKey(providerId: string, providerModelId: string): string {
  return `${providerId}\u0000${providerModelId}`;
}

/** 状态 Badge 的口径：`verified` = 已验证；`deprecated` = 已停用；其余一律「待审核」。 */
function badgeOf(row: MappingRow): { label: string; tone: 'verified' | 'review' | 'conflict' | 'deprecated' } {
  if (row.status === 'deprecated') return { label: '已停用', tone: 'deprecated' };
  if (row.matchStatus === 'verified') return { label: '已验证', tone: 'verified' };
  return { label: '待审核', tone: 'review' };
}

/** 「映射依据摘要」—— 用**已有数据**说话，不编造。 */
function basisOf(row: MappingRow): string {
  if (!row.canonicalId) return '未建立官方映射';
  if (row.matchStatus === 'verified') {
    return (row.source ?? '').includes('别名') ? '已验证别名' : '官方表精确匹配';
  }
  if (row.matchStatus === 'manual-review') return '自动候选，待人工确认';
  return '未建立官方映射';
}

/** 今天（`YYYY-MM-DD`）—— 映射登记时间的口径与配置文件一致。 */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ── 内联图标（**不要换成 `<Icon>`**）──
   MTV 的图标走 Iconify **网络**加载（`services/iconCacheService.ts`：API + localStorage 缓存），
   而 `@iconify/react` 在图标未到时**什么都不渲染** —— 首帧少一个图标就会把后面的文字横向推 20~28px，
   图标 130ms 后到齐 = 肉眼可见的「先出文字、再出图标」（CDP 逐帧实测，用户 2026 点名）。
   ⇒ 本页要用的图标全部内联成 SVG（`Select.tsx` 的箭头也是这么干的），路径**逐字**复制自运行中的应用。
   包装 `<g>` 保留 iconify 的结构：`.settings-perm-option > svg { stroke-width: 1.75 }` 会改细
   直接挂在 svg 上的线宽，挂在 `<g>` 上则不受影响（和现在渲染出来的一模一样）。 */
const GLYPH_BODY = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function SearchGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g {...GLYPH_BODY}>
        <path d="m21 21l-4.34-4.34" />
        <circle cx="11" cy="11" r="8" />
      </g>
    </svg>
  );
}

/** `lucide:chevron-down` —— 行尾展开箭头 */
function ChevronGlyph() {
  return (
    <svg className="mm-chevron" width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" style={{ color: 'var(--o-muted-foreground)' }}>
      <g {...GLYPH_BODY}>
        <path d="m6 9l6 6l6-6" />
      </g>
    </svg>
  );
}

/** `lucide:check` —— 策略卡片选中态那颗勾（未选中时由 `.settings-perm-option-slot` 占位） */
function CheckGlyph() {
  return (
    <svg className="settings-perm-option-check" width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" style={{ color: SELECTED_COLOR }}>
      <g {...GLYPH_BODY}>
        <path d="M20 6L9 17l-5-5" />
      </g>
    </svg>
  );
}

/** `lucide:inbox` / `lucide:wand-sparkles` —— 策略卡片的前导图标 */
function PolicyGlyph({ id, active }: { id: 'queue' | 'auto-candidate'; active: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ color: active ? SELECTED_COLOR : 'var(--o-muted-foreground)' }}
    >
      <g {...GLYPH_BODY}>
        {id === 'queue' ? (
          <>
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11" />
          </>
        ) : (
          <path d="m21.64 3.64l-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72M14 7l3 3M5 6v4m14 4v4M10 2v2M7 8H3m18 8h-4M11 3H9" />
        )}
      </g>
    </svg>
  );
}

/** 二进制查找：第一个「底边 > top」的下标（虚拟滚动的起点）。 */
function indexAt(offsets: readonly number[], top: number): number {
  let low = 0;
  let high = offsets.length - 1;
  let best = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (offsets[mid] <= top) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

interface Draft {
  canonicalId: string;
  displayName: string;
  note: string;
}

function draftOf(row: MappingRow): Draft {
  return { canonicalId: row.canonicalId ?? '', displayName: row.displayName, note: '' };
}

export default function ModelMappingSettings() {
  const t = useT();
  const showToast = useAppStore((state) => state.showToast);
  const config = useAppStore((state) => state.config);
  const updateConfig = useAppStore((state) => state.updateConfig);
  const saveConfig = useAppStore((state) => state.saveConfig);

  /* 策略直接读 config（不另存一份 state）—— 保存失败回滚时界面自动跟着回去，
     不会出现「界面显示新规则、配置其实还是旧的」这种谎。 */
  const policy = config.modelMappingPolicy ?? 'queue';
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [onlyReview, setOnlyReview] = useState(false);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [initialDraft, setInitialDraft] = useState<Draft | null>(null);
  const [creating, setCreating] = useState(false);
  const [newCanonical, setNewCanonical] = useState({ canonicalId: '', officialName: '', officialVendor: '', capabilities: '' });

  /* ── 数据（config 一变就重算） ── */
  const overrides = config.modelMappingOverrides;
  const removed = config.removedModelMappings;
  const additions = config.modelCanonicalAdditions;
  /**
   * ★ 已拉取模型目录（`config.providers[*].catalogModels / selectedModels` → 平台标识 + 调用 id）。
   *
   * 入参是 `config.providers` **整个对象**：`saveProviderConfig()` 写目录时整份 providers 换引用
   * ⇒ 这里必然重算 ⇒ `rows` / `stats` 跟着重算。这就是「重新拉取厂商模型后表里自动多出新行」
   * 的依赖链（以前 `rows` 只依赖三个映射字段，拉目录跟它无关 ⇒ 看起来「固定死了」）。
   */
  const catalog = useMemo(() => catalogEntriesOfProviders(config.providers), [config.providers]);
  /** 当前数据源（映射 ∪ 目录）—— 写完之后要重新取「这一行」也走它，不能用无参版本。 */
  const readRows = useCallback(() => listMappingRows(catalog), [catalog]);
  const rows = useMemo(
    () => readRows(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overrides, removed, additions, catalog],
  );
  const stats = useMemo(
    () => mappingStats(catalog),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overrides, removed, additions, catalog],
  );
  const conflictKeys = useMemo(
    () => new Set(listMappingConflicts().map((c) => rowKey(c))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overrides, removed, additions],
  );

  /* 厂商筛选下拉的选项：有映射数据的 providerId → 过一层 `isProviderSelectable()`。
     ⚠️ 过滤只发生在这份**选项**上：`rows`（数据层）一个字都没动 —— 已下架厂商的映射数据
        仍然完整保留、仍然参与解析与调用，只是不再出现在下拉里（见 `providerFilterOptions`）。 */
  const providers = useMemo(() => providerFilterOptions(rows.map((row) => row.providerId)), [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      /* ★ 正在编辑的那一条**豁免内容型筛选**：一次保存就可能让它不再是「待审核」
         （比如刚关联上 canonical），若在这里滤掉，展开的编辑区会凭空消失。
         用户显式输入的「Provider 筛选 / 搜索」仍然生效。 */
      const anchored = rowKey(row) === expandedKey;
      if (!anchored) {
        if (onlyReview && row.review.length === 0) return false;
        if (statusFilter === 'review' && !(row.matchStatus !== 'verified' || row.status === 'deprecated')) return false;
        if (statusFilter === 'verified' && row.matchStatus !== 'verified') return false;
        if (statusFilter === 'conflict' && !conflictKeys.has(rowKey(row))) return false;
        if (statusFilter === 'deprecated' && row.status !== 'deprecated') return false;
      }
      if (providerFilter !== 'all' && row.providerId !== providerFilter) return false;
      if (!q) return true;
      return `${row.displayName} ${row.providerId} ${row.providerLabel} ${row.providerModelId} ${row.canonicalId ?? ''}`
        .toLowerCase()
        .includes(q);
    });
    /* 待审核优先显示；**正在编辑的那一条钉在最前**（同档内按 Provider + 调用 id 稳定排序）。
       ★ 钉住是必须的：保存可能让这一条不再「待审核」，否则它会跳到列表末尾，
         展开的编辑区直接从视口里消失（实测）。 */
    return filtered.sort((a, b) => {
      const aKey = rowKey(a);
      const bKey = rowKey(b);
      if (aKey === expandedKey || bKey === expandedKey) {
        return aKey === bKey ? 0 : (aKey === expandedKey ? -1 : 1);
      }
      return (b.review.length > 0 ? 1 : 0) - (a.review.length > 0 ? 1 : 0);
    });
  }, [conflictKeys, expandedKey, onlyReview, providerFilter, query, rows, statusFilter]);

  /* ── 虚拟滚动 ──
     高度只有两种来源：折叠行（估值）与展开行（真实量）。用一个 ResizeObserver
     盯住滚动容器（视口高度）与**每一个已渲染**的行（真实高度）—— 行内容变化
     （比如展开区里又开了「创建 canonical」表单）会自动重新量。 */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const measures = useRef(new Map<string, number>());
  const itemNodes = useRef(new Map<string, HTMLElement>());
  const itemRefs = useRef(new Map<string, (node: HTMLDivElement | null) => void>());
  const observerRef = useRef<ResizeObserver | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(560);
  const [, setMeasureTick] = useState(0);

  const remember = useCallback((key: string, node: HTMLElement) => {
    const height = node.offsetHeight;
    if (height > 0 && measures.current.get(key) !== height) {
      measures.current.set(key, height);
      setMeasureTick((tick) => tick + 1);
    }
  }, []);

  const measureItem = useCallback((key: string, node: HTMLDivElement | null) => {
    const observer = observerRef.current;
    const previous = itemNodes.current.get(key);
    if (previous && previous !== node) {
      observer?.unobserve(previous);
      itemNodes.current.delete(key);
    }
    if (!node) return;
    itemNodes.current.set(key, node);
    observer?.observe(node);
    remember(key, node);
  }, [remember]);

  /** 每个 key 一个**稳定**的 ref 回调（否则每次渲染都会 observe / unobserve 一轮） */
  const itemRef = useCallback((key: string) => {
    let ref = itemRefs.current.get(key);
    if (!ref) {
      ref = (node) => measureItem(key, node);
      itemRefs.current.set(key, ref);
    }
    return ref;
  }, [measureItem]);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (el === box) {
          const height = box.clientHeight;
          if (height > 0) setViewport((value) => (value === height ? value : height));
          continue;
        }
        const key = el.dataset.mmKey;
        if (key) remember(key, el);
      }
    });
    observerRef.current = observer;
    observer.observe(box);
    for (const [key, node] of itemNodes.current) {
      observer.observe(node);
      remember(key, node);
    }
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [remember]);

  /* 偏移表：每次渲染现算（最多几百行，比缓存更省心且不会有陈旧高度） */
  const offsets: number[] = [];
  let totalHeight = 0;
  for (const row of visible) {
    offsets.push(totalHeight);
    totalHeight += measures.current.get(rowKey(row)) ?? ROW_FALLBACK_HEIGHT;
  }
  const startIndex = Math.max(0, indexAt(offsets, scrollTop) - OVERSCAN);
  const endIndex = Math.min(
    visible.length,
    indexAt(offsets, scrollTop + viewport) + 1 + OVERSCAN,
  );
  const slice = visible.slice(startIndex, endIndex);

  /* 展开 / 收起之后把目标行滚到视口顶部（用**这一帧真实算出来的**偏移量，
     而不是点击那一刻的旧顺序 —— 展开会让这一条被钉到列表最前）。
     用 ref 而不是 state：写 state 会在 effect 里触发级联渲染（仓库 lint 直接判错）。 */
  const scrollTargetRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const target = scrollTargetRef.current;
    if (!target) return;
    scrollTargetRef.current = null;
    const box = scrollRef.current;
    if (!box) return;
    const index = visible.findIndex((row) => rowKey(row) === target);
    if (index < 0) return;
    let top = 0;
    for (let i = 0; i < index; i += 1) {
      top += measures.current.get(rowKey(visible[i])) ?? ROW_FALLBACK_HEIGHT;
    }
    box.scrollTop = top;
  });

  /* ── 写入 ── */
  const persist = useCallback(async (
    patch: Partial<AppConfig>,
    successMessage: string,
    failureMessage: string,
  ) => {
    const before = useAppStore.getState().config;
    updateConfig(patch);
    try {
      await saveConfig({ silent: true });
      showToast(successMessage, 'success');
      return true;
    } catch {
      /* 乐观更新回滚：把这一组字段还原成提交前的值（store 自己已经弹过错误提示） */
      updateConfig({
        modelMappingOverrides: before.modelMappingOverrides,
        removedModelMappings: before.removedModelMappings,
        modelCanonicalAdditions: before.modelCanonicalAdditions,
        modelMappingPolicy: before.modelMappingPolicy,
      });
      showToast(failureMessage, 'error');
      return false;
    }
  }, [saveConfig, showToast, updateConfig]);

  /** 当前生效的映射条目（运行时覆盖优先，其次文件配置）。 */
  const baseOf = useCallback((row: MappingRow): ProviderModelMapping => (
    findExactMapping(row.providerId, row.providerModelId) ?? {
      providerId: row.providerId,
      providerModelId: row.providerModelId,
      matchStatus: 'unverified',
      updatedAt: today(),
    }
  ), []);

  const writeOverride = useCallback(async (
    row: MappingRow,
    patch: Partial<ProviderModelMapping>,
    successMessage: string,
  ) => {
    const list = useAppStore.getState().config.modelMappingOverrides ?? [];
    const mapping: ProviderModelMapping = {
      ...baseOf(row),
      ...patch,
      providerId: row.providerId,
      providerModelId: row.providerModelId,
      /* 同步 / 异步是两条独立映射 ⇒ 把规格后缀与执行模式钉死在这条上，
         免得上游 `baseModelId` 探测把它们串味。 */
      providerSuffix: row.providerSuffix,
      executionMode: row.executionMode,
      updatedAt: today(),
    };
    const next = [...list.filter((item) => rowKey(item) !== rowKey(row)), mapping];
    return persist(
      { modelMappingOverrides: next },
      successMessage,
      t('保存失败，映射已还原'),
    );
  }, [baseOf, persist, t]);

  const syncDraftFrom = useCallback((row: MappingRow) => {
    const next = draftOf(row);
    setDraft(next);
    setInitialDraft(next);
  }, []);

  const toggleRow = useCallback((row: MappingRow) => {
    const key = rowKey(row);
    if (expandedKey === key) {
      setExpandedKey(null);
      setDraft(null);
      setInitialDraft(null);
      setCreating(false);
      return;
    }
    setExpandedKey(key);
    syncDraftFrom(row);
    setCreating(false);
    scrollTargetRef.current = key;
  }, [expandedKey, syncDraftFrom]);

  /* 展开后重新取一次「当前行」（写了配置之后行对象会换引用）。 */
  const expandedRow = useMemo(
    () => (expandedKey ? rows.find((row) => rowKey(row) === expandedKey) ?? null : null),
    [expandedKey, rows],
  );

  const selectPolicy = useCallback((next: 'queue' | 'auto-candidate', label: string) => {
    if (policy === next) return;
    void persist(
      { modelMappingPolicy: next },
      t('新模型处理规则已设为「{mode}」', { mode: t(label) }),
      t('保存失败，规则已还原'),
    );
  }, [persist, policy, t]);

  const saveMapping = useCallback(async () => {
    if (!expandedRow || !draft) return;
    const canonicalId = draft.canonicalId.trim();
    if (canonicalId && !isValidCanonicalId(canonicalId)) {
      showToast(t('canonicalId 格式无效，应形如 vendor/slug（小写字母、数字与连字符）。'), 'error');
      return;
    }
    const patch: Partial<ProviderModelMapping> = { canonicalId: canonicalId || undefined };
    /* 只有管理员真的改过展示名才落 `displayNameOverride`（否则会把这行名字冻住，
       官方表改名后不跟着走）。 */
    patch.displayNameOverride = initialDraft && draft.displayName !== initialDraft.displayName
      ? draft.displayName.trim() || undefined
      : baseOf(expandedRow).displayNameOverride;
    patch.note = draft.note.trim() || undefined;
    const ok = await writeOverride(expandedRow, patch, t('映射已保存'));
    if (ok) {
      const fresh = readRows().find((row) => rowKey(row) === rowKey(expandedRow));
      if (fresh) syncDraftFrom(fresh);
    }
  }, [baseOf, draft, expandedRow, initialDraft, readRows, showToast, syncDraftFrom, t, writeOverride]);

  const markVerified = useCallback(async () => {
    if (!expandedRow) return;
    if (!expandedRow.canonicalId) {
      showToast(t('请先关联或创建 Canonical Model，再标记为已验证。'), 'error');
      return;
    }
    const ok = await writeOverride(expandedRow, {
      canonicalId: expandedRow.canonicalId,
      matchStatus: 'verified',
      source: '管理员在「模型映射」中人工确认',
    }, t('已标记为「已验证」'));
    if (ok) {
      const fresh = readRows().find((row) => rowKey(row) === rowKey(expandedRow));
      if (fresh) syncDraftFrom(fresh);
    }
  }, [expandedRow, readRows, showToast, syncDraftFrom, t, writeOverride]);

  const keepOriginal = useCallback(async () => {
    if (!expandedRow) return;
    const ok = await writeOverride(expandedRow, {
      canonicalId: undefined,
      displayNameOverride: undefined,
      matchStatus: 'manual-review',
      source: '管理员保持平台原始名称，待人工确认',
    }, t('已保持原始名称并标记为待审核'));
    if (ok) {
      const fresh = readRows().find((row) => rowKey(row) === rowKey(expandedRow));
      if (fresh) syncDraftFrom(fresh);
    }
  }, [expandedRow, readRows, syncDraftFrom, t, writeOverride]);

  const linkCanonical = useCallback(async (canonicalId: string) => {
    if (!expandedRow || !canonicalId) return;
    const canonical = getCanonicalModel(canonicalId);
    const ok = await writeOverride(expandedRow, {
      canonicalId,
      displayNameOverride: undefined,
      matchStatus: 'verified',
      source: `管理员关联已有 Canonical Model（${canonical?.officialName ?? canonicalId}）`,
    }, t('已关联 Canonical Model'));
    if (ok) {
      const fresh = readRows().find((row) => rowKey(row) === rowKey(expandedRow));
      if (fresh) syncDraftFrom(fresh);
    }
  }, [expandedRow, readRows, syncDraftFrom, t, writeOverride]);

  const createCanonical = useCallback(async () => {
    if (!expandedRow) return;
    const canonicalId = newCanonical.canonicalId.trim();
    const officialName = newCanonical.officialName.trim();
    if (!isValidCanonicalId(canonicalId)) {
      showToast(t('canonicalId 格式无效，应形如 vendor/slug（小写字母、数字与连字符）。'), 'error');
      return;
    }
    if (allCanonicalModels().some((model) => model.canonicalId === canonicalId)) {
      showToast(t('该 canonicalId 已存在，请改用「关联已有 Canonical Model」。'), 'error');
      return;
    }
    if (!officialName) {
      showToast(t('Official Name 不能为空。'), 'error');
      return;
    }
    const entry: CanonicalModel = {
      canonicalId,
      officialName,
      officialVendor: newCanonical.officialVendor.trim() || undefined,
      capabilities: newCanonical.capabilities.split(',').map((item) => item.trim()).filter(Boolean),
      status: 'active',
      source: '管理员在「模型映射」中新建',
      updatedAt: today(),
    };
    const additionsList = [...(useAppStore.getState().config.modelCanonicalAdditions ?? []), entry];
    const mappingList = useAppStore.getState().config.modelMappingOverrides ?? [];
    const mapping: ProviderModelMapping = {
      ...baseOf(expandedRow),
      providerId: expandedRow.providerId,
      providerModelId: expandedRow.providerModelId,
      canonicalId,
      displayNameOverride: undefined,
      providerSuffix: expandedRow.providerSuffix,
      executionMode: expandedRow.executionMode,
      matchStatus: 'verified',
      source: `管理员新建 Canonical Model（${officialName}）`,
      updatedAt: today(),
    };
    const ok = await persist({
      modelCanonicalAdditions: additionsList,
      modelMappingOverrides: [...mappingList.filter((item) => rowKey(item) !== rowKey(expandedRow)), mapping],
    }, t('已创建 Canonical Model 并关联'), t('创建失败，映射已还原'));
    if (ok) {
      setCreating(false);
      setNewCanonical({ canonicalId: '', officialName: '', officialVendor: '', capabilities: '' });
      const fresh = readRows().find((row) => rowKey(row) === rowKey(expandedRow));
      if (fresh) syncDraftFrom(fresh);
    }
  }, [baseOf, expandedRow, newCanonical, persist, readRows, showToast, syncDraftFrom, t]);

  const unlink = useCallback(async () => {
    if (!expandedRow) return;
    const confirmed = await confirmAction(
      t('确定要解除「{name}」的映射吗？解除后界面会回退显示平台原始名称。', { name: expandedRow.displayName }),
      { title: t('解除映射'), kind: 'warning', okLabel: t('解除映射'), cancelLabel: t('取消') },
    );
    if (!confirmed) return;
    const overridesList = (useAppStore.getState().config.modelMappingOverrides ?? [])
      .filter((item) => rowKey(item) !== rowKey(expandedRow));
    const removedList = [...new Set([
      ...(useAppStore.getState().config.removedModelMappings ?? []),
      removedKey(expandedRow.providerId, expandedRow.providerModelId),
    ])];
    const ok = await persist(
      { modelMappingOverrides: overridesList, removedModelMappings: removedList },
      t('已解除该条映射'),
      t('解除失败，映射已还原'),
    );
    if (ok) {
      setExpandedKey(null);
      setDraft(null);
      setInitialDraft(null);
    }
  }, [expandedRow, persist, t]);

  const restoreAll = useCallback(() => {
    void persist({ removedModelMappings: [] }, t('已恢复全部被解除的映射'), t('恢复失败，已还原'));
  }, [persist, t]);

  /**
   * Escape：**必须挂在 window 捕获阶段**。
   * 理由：MTV 的设置弹层 `ModalOverlay` 在 `document` 捕获阶段**无条件**消费 Escape
   * （`src/components/shared/ModalOverlay.tsx` 的 `document.addEventListener('keydown', h, true)`），
   * 面板内的冒泡处理永远收不到。window 捕获比 document 捕获更早 ⇒ 只有「有展开项 /
   * 新建表单开着」时消费（先收新建表单，再收展开项），其余情况原样放行，弹层照旧关闭。
   */
  const escapeState = useRef({ expanded: false, creating: false });
  useEffect(() => {
    escapeState.current = { expanded: expandedKey !== null, creating };
  }, [creating, expandedKey]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      /* 有下拉浮层开着（`Select` 的 `o-menu` / `OfficialCombobox` 面板）就把 Escape 让给它 */
      if (document.querySelector('.o-menu, .o-combobox__panel')) return;
      const { expanded, creating: drafting } = escapeState.current;
      if (!expanded && !drafting) return;
      event.preventDefault();
      event.stopPropagation();
      if (drafting) {
        setCreating(false);
        return;
      }
      setExpandedKey(null);
      setDraft(null);
      setInitialDraft(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  /* 展开区的下拉要列全部 canonical（含管理员新建的）。`additions` 变了 ⇒ overrides.ts 的
     canonical 快照换引用 ⇒ registry 内容变了，必须重算。 */
  const canonicalOptions = useMemo(
    () => allCanonicalModels(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [additions],
  );

  return (
    <SettingsPaneBody>
      <div className="mm-page">
        <header>
          <h2 className="o-perm-head-title">{t('模型映射')}</h2>
          <p className="o-perm-head-desc">
            {t('管理第三方平台调用 ID 与官方展示模型的对应关系。界面优先显示官方展示名称，实际调用始终使用 Provider Model ID。')}
          </p>
        </header>

        {/* ── 分区 1：映射审核策略 ── */}
        <section className="o-perm-section">
          <div className="o-perm-section__head">
            <div className="o-perm-section__label">
              <h3 className="o-perm-section__title">{t('新模型如何处理？')}</h3>
              <p className="o-perm-section__desc">
                {t('该规则决定新发现、未验证的 Provider 模型进入系统后的默认状态。')}
              </p>
            </div>
          </div>
          <div className="settings-perm-group" role="radiogroup" aria-label={t('新模型处理规则')}>
            {([
              {
                id: 'queue' as const,
                title: '进入待审核队列',
                desc: '保留平台原始名称，不进入正式模型选择器，等待管理员确认官方映射。',
              },
              {
                id: 'auto-candidate' as const,
                title: '自动按规则匹配',
                desc: '依据已验证别名、原厂、能力、版本等元数据生成候选映射，但仍标记为待审核。',
              },
            ]).map((option) => {
              const active = policy === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`mm-policy-${option.id}`}
                  className="settings-perm-option"
                  onClick={() => selectPolicy(option.id, option.title)}
                >
                  <PolicyGlyph id={option.id} active={active} />
                  <div className="settings-perm-option-body">
                    <div className="settings-perm-option-title" style={active ? { color: SELECTED_COLOR } : undefined}>
                      {t(option.title)}
                    </div>
                    <div className="settings-perm-option-desc" style={active ? { color: SELECTED_COLOR } : undefined}>
                      {t(option.desc)}
                    </div>
                  </div>
                  {active ? (
                    <CheckGlyph />
                  ) : (
                    <span className="settings-perm-option-slot" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 分区 2：已接入模型映射 ── */}
        <section className="o-perm-section">
          <div className="o-perm-section__head">
            <div className="o-perm-section__label">
              <h3 className="o-perm-section__title">{t('已接入模型映射')}</h3>
              <p className="o-perm-section__desc">
                {t('搜索、筛选和审核各 Provider 的模型名称映射。待审核项目优先显示。')}
              </p>
            </div>
          </div>

          <div className="mm-toolbar">
            <label className="mm-search">
              <SearchGlyph size={14} />
              <input
                type="search"
                value={query}
                data-testid="mm-search"
                placeholder={t('搜索官方展示名、Provider、Provider Model ID 或 canonicalId')}
                aria-label={t('搜索映射')}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {/* 与官方「国家 / 地区」同一套：**带搜索的下拉**、菜单与按钮同宽、左对齐。
                「全部」不是一个列表项 —— 未筛选时走 combobox 的 placeholder（显示「厂商」/「状态」），
                只有已经筛过才在列表里补一条「全部厂商」/「全部状态」用来清筛选。 */}
            <div className="mm-selectbox" data-testid="mm-provider-filter">
              <OfficialCombobox
                className="o-combobox--field"
                value={providerFilter === 'all' ? '' : providerFilter}
                onChange={(next) => setProviderFilter(next || 'all')}
                options={[
                  ...(providerFilter === 'all' ? [] : [{ value: 'all', label: t('全部厂商') }]),
                  ...providers.map((id) => ({ value: id, label: id })),
                ]}
                placeholder={t('厂商')}
                searchPlaceholder={t('搜索厂商')}
                emptyText={t('没有匹配的厂商')}
                ariaLabel={t('Provider')}
              />
            </div>
            <div className="mm-selectbox" data-testid="mm-status-filter">
              <OfficialCombobox
                className="o-combobox--field"
                value={statusFilter === 'all' ? '' : statusFilter}
                onChange={(next) => setStatusFilter((next || 'all') as StatusFilter)}
                options={[
                  ...(statusFilter === 'all' ? [] : [{ value: 'all', label: t('全部状态') }]),
                  { value: 'review', label: t('待审核') },
                  { value: 'verified', label: t('已验证') },
                  { value: 'conflict', label: t('冲突') },
                  { value: 'deprecated', label: t('已停用') },
                ]}
                placeholder={t('状态')}
                /* 4 个短选项 —— 按官方「语言」那种**纯列表**（`PSl` 有搜索行，语言那处没有） */
                searchable={false}
                emptyText={t('没有匹配的状态')}
                ariaLabel={t('状态')}
              />
            </div>
            <div className="mm-toolbar-end">
              <label className="mm-toggle">
                <OfficialSwitch
                  label={t('仅显示待审核')}
                  checked={onlyReview}
                  onChange={setOnlyReview}
                />
                <span>{t('仅显示待审核')}</span>
              </label>
              <span className="mm-stats" data-testid="mm-stats">
                {t('已验证 {verified} · 待审核 {review} · Provider {providers}', {
                  verified: stats.verified,
                  review: stats.review,
                  providers: stats.providers,
                })}
              </span>
            </div>
          </div>

          <div className="settings-perm-group mm-list-group">
            <div
              className="mm-scroll"
              ref={scrollRef}
              data-testid="mm-list"
              /* 不要 MTV 那条全局悬浮滑条（右栏 `SettingsPanel` 的同一口径；用户点名「不要出现滑条」） */
              data-overlay-scrollbar="off"
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            >
              <div className="mm-canvas" style={{ height: totalHeight }}>
                <div className="mm-window" style={{ transform: `translateY(${offsets[startIndex] ?? 0}px)` }}>
                  {slice.map((row) => {
                    const key = rowKey(row);
                    const badge = badgeOf(row);
                    const isOpen = expandedKey === key;
                    return (
                      <div className="mm-item" key={key} ref={itemRef(key)} data-mm-key={key}>
                        <button
                          type="button"
                          className="mm-item-row"
                          data-review={row.review.length > 0 || undefined}
                          aria-expanded={isOpen}
                          data-testid={`mm-row-${row.providerId}-${row.providerModelId}`}
                          onClick={() => toggleRow(row)}
                        >
                          <span className="mm-icon" aria-hidden="true">
                            {row.officialVendor?.slice(0, 1).toUpperCase() ?? row.providerId.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="mm-main">
                            <span className="mm-title">{row.displayName}</span>
                            <span className="mm-sub">
                              <span>{row.providerLabel}</span>
                              <code>{row.providerModelId}</code>
                            </span>
                          </span>
                          <span className="mm-meta">
                            {/* canonicalId 那一格只放 id；「未建立官方映射」是**依据摘要**的措辞，
                                放在下面那行 —— 两格写同一句话会读成 bug。 */}
                            <code className="mm-canonical">{row.canonicalId ?? t('—')}</code>
                            <span className="mm-basis">{t(basisOf(row))}</span>
                            {/* ★ 映射登记着、但该平台最近一次拉取的目录快照里没有它：
                                行照旧保留（删了不能丢数据），只做标注。没拉过目录的平台不标注。
                                ⚠️ 措辞必须写「快照」：`catalogModels` 落库有上限（300 条，见
                                `providerCatalogService.MAX_CACHED_CATALOG_MODELS`），所以「没找到」
                                也可能是没进缓存，不能断言「已下架」。 */}
                            {row.catalogStatus === 'absent' && (
                              <span
                                className="mm-catalog-missing"
                                data-testid="mm-catalog-missing"
                                title={t('以最近一次拉取的目录快照为准（落库有上限），可能是已下架、已改名，或只是没进缓存。')}
                              >
                                {t('目录快照中未找到')}
                              </span>
                            )}
                          </span>
                          <span className="mm-tail">
                            <span className="mm-badge" data-tone={badge.tone}>{t(badge.label)}</span>
                            <ChevronGlyph />
                          </span>
                        </button>

                        {isOpen && expandedRow && draft && (
                          <MappingDetail
                            row={expandedRow}
                            draft={draft}
                            canonical={getCanonicalModel(expandedRow.canonicalId)}
                            canonicalOptions={canonicalOptions}
                            creating={creating}
                            newCanonical={newCanonical}
                            onDraft={setDraft}
                            onToggleCreating={() => setCreating((value) => !value)}
                            onNewCanonical={setNewCanonical}
                            onSave={() => void saveMapping()}
                            onVerify={() => void markVerified()}
                            onKeepOriginal={() => void keepOriginal()}
                            onLink={(id) => void linkCanonical(id)}
                            onCreate={() => void createCanonical()}
                            onUnlink={() => void unlink()}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {visible.length === 0 && (
              <p className="mm-empty">{t('没有符合条件的映射')}</p>
            )}
          </div>

          {(removed?.length ?? 0) > 0 && (
            <div className="mm-restore">
              <span>{t('已解除映射 {count} 条', { count: removed?.length ?? 0 })}</span>
              <button type="button" className="mm-link" onClick={restoreAll}>{t('恢复全部')}</button>
            </div>
          )}

          {conflictKeys.size > 0 && (
            <p className="mm-alert" role="alert">
              {/* 唯一还用 `<Icon>` 的地方（`lucide:triangle-alert` 没在运行环境里渲染过，路径无法逐字取）；
                  外面套一个定尺 slot，图标晚到也不会把文字推位。 */}
              <span className="mm-alert-icon" aria-hidden="true">
                <Icon icon="lucide:triangle-alert" width={14} height={14} />
              </span>
              {t('存在 {count} 条冲突映射（同平台同调用 ID 登记了多次）', { count: conflictKeys.size })}
            </p>
          )}
        </section>
      </div>
    </SettingsPaneBody>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   展开后的映射详情 —— 落在**该卡片下方**，用分隔线 + 设置行呈现（与参考图一致）
   ══════════════════════════════════════════════════════════════════════ */
function MappingDetail({
  row,
  draft,
  canonical,
  canonicalOptions,
  creating,
  newCanonical,
  onDraft,
  onToggleCreating,
  onNewCanonical,
  onSave,
  onVerify,
  onKeepOriginal,
  onLink,
  onCreate,
  onUnlink,
}: {
  row: MappingRow;
  draft: Draft;
  canonical: CanonicalModel | null;
  canonicalOptions: readonly CanonicalModel[];
  creating: boolean;
  newCanonical: { canonicalId: string; officialName: string; officialVendor: string; capabilities: string };
  onDraft: (draft: Draft) => void;
  onToggleCreating: () => void;
  onNewCanonical: (value: { canonicalId: string; officialName: string; officialVendor: string; capabilities: string }) => void;
  onSave: () => void;
  onVerify: () => void;
  onKeepOriginal: () => void;
  onLink: (canonicalId: string) => void;
  onCreate: () => void;
  onUnlink: () => void;
}) {
  const t = useT();
  const badge = badgeOf(row);
  /* 搜索匹配的是 `label + value`（`OfficialCombobox` 照官方 cmdk 的口径拼），
     所以「官方名」和「canonicalId」（含厂商）都能搜到。 */
  const canonicalChoices = useMemo(
    () => canonicalOptions.map((model) => ({
      value: model.canonicalId,
      label: `${model.officialName} — ${model.canonicalId}`,
    })),
    [canonicalOptions],
  );

  return (
    <div className="mm-detail" data-testid={`mm-detail-${row.providerId}-${row.providerModelId}`}>
      {/* ── 来源模型 ── */}
      <div className="mm-detail-block">
        <h4 className="mm-detail-heading">{t('来源模型')}</h4>
        <div className="mm-facts">
          <Fact label={t('Provider')} value={`${row.providerModelId ? row.providerLabel : row.providerLabel} (${row.providerId})`} />
          <Fact label={t('Provider Model ID')} value={row.providerModelId} mono />
          <Fact label={t('平台原始名称')} value={row.providerModelName ?? row.providerModelId} mono />
          <Fact label={t('执行模式')} value={row.executionMode === 'async' ? t('异步（async）') : t('同步（sync）')} />
          <Fact
            label={t('平台规格后缀')}
            value={row.providerSuffix ?? (row.declaredSuffixes.length > 0 ? t('未使用（该平台支持 {list}）', { list: row.declaredSuffixes.join(' / ') }) : t('无'))}
          />
        </div>
      </div>

      {/* ── 官方模型 ── */}
      <div className="mm-detail-block">
        <h4 className="mm-detail-heading">{t('官方模型')}</h4>
        <div className="mm-facts">
          <Fact label={t('Official Vendor')} value={canonical?.officialVendor ?? row.officialVendor ?? t('未建立官方映射')} />
          <Fact label={t('Official Name')} value={canonical?.officialName ?? row.officialName ?? t('未建立官方映射')} />
          <Fact label={t('能力标签')} value={canonical?.capabilities?.length ? canonical.capabilities.join(' · ') : t('无')} />
        </div>
        <div className="mm-field">
          <label htmlFor={`mm-canonical-${row.providerId}-${row.providerModelId}`}>{t('Canonical ID')}</label>
          <input
            id={`mm-canonical-${row.providerId}-${row.providerModelId}`}
            className="mm-input mm-input--mono"
            value={draft.canonicalId}
            placeholder="vendor/slug"
            onChange={(event) => onDraft({ ...draft, canonicalId: event.target.value })}
          />
        </div>
        <div className="mm-field">
          <label htmlFor={`mm-display-${row.providerId}-${row.providerModelId}`}>{t('Display Name')}</label>
          <input
            id={`mm-display-${row.providerId}-${row.providerModelId}`}
            className="mm-input"
            value={draft.displayName}
            onChange={(event) => onDraft({ ...draft, displayName: event.target.value })}
          />
          <p className="mm-hint">{t('这是产品界面唯一的主展示名。异步模型必须保留 async。')}</p>
        </div>
      </div>

      {/* ── 审核信息 ── */}
      <div className="mm-detail-block">
        <h4 className="mm-detail-heading">{t('审核信息')}</h4>
        <div className="mm-facts">
          <div className="mm-fact">
            <span className="mm-fact-label">{t('映射状态')}</span>
            <span className="mm-badge" data-tone={badge.tone}>{t(badge.label)}</span>
          </div>
          <Fact label={t('映射依据 Source')} value={row.source ?? t('未记录')} />
          <Fact label={t('最后更新时间')} value={row.updatedAt ?? t('未记录')} mono />
          <Fact
            label={t('待审核原因')}
            value={row.review.length > 0 ? row.review.map((reason) => t(REVIEW_LABELS[reason])).join(' · ') : t('无')}
          />
        </div>
        <div className="mm-field">
          <label htmlFor={`mm-note-${row.providerId}-${row.providerModelId}`}>{t('备注')}</label>
          <input
            id={`mm-note-${row.providerId}-${row.providerModelId}`}
            className="mm-input"
            value={draft.note}
            placeholder={t('可选：为什么这样映射')}
            onChange={(event) => onDraft({ ...draft, note: event.target.value })}
          />
        </div>
      </div>

      {/* ── 操作 ── */}
      <div className="mm-actions">
        <div className="mm-actions-primary">
          <button type="button" className="o-btn o-btn--default o-btn--sm" onClick={onSave} data-testid="mm-save">
            {t('保存映射')}
          </button>
          <button type="button" className="o-btn o-btn--secondary o-btn--sm" onClick={onVerify} data-testid="mm-verify">
            {t('确认并标记为已验证')}
          </button>
          <button type="button" className="o-btn o-btn--outline o-btn--sm" onClick={onKeepOriginal}>
            {t('保持原始名称并标记待审核')}
          </button>
        </div>

        <div className="mm-actions-secondary">
          <div className="mm-field mm-field--inline mm-picker">
            <span>{t('关联已有 Canonical Model')}</span>
            {/* 109 条 official 模型（22 个厂商）—— 原生下拉根本没法用，这里按官方
                「国家 / 地区」那个**带搜索的 combobox** 来（同一个 `OfficialCombobox`）。 */}
            <OfficialCombobox
              className="o-combobox--field"
              value=""
              onChange={(canonicalId) => { if (canonicalId) onLink(canonicalId); }}
              options={canonicalChoices}
              placeholder={t('选择…')}
              searchPlaceholder={t('搜索官方名或 canonicalId')}
              emptyText={t('没有匹配的 Canonical Model')}
              ariaLabel={t('关联已有 Canonical Model')}
            />
          </div>
          <button type="button" className="o-btn o-btn--outline o-btn--sm" onClick={onToggleCreating}>
            {t('创建新的 Canonical Model')}
          </button>
        </div>

        {creating && (
          <div className="mm-create">
            <div className="mm-create-grid">
              <label className="mm-field">
                <span>{t('Canonical ID')}</span>
                <input
                  className="mm-input mm-input--mono"
                  value={newCanonical.canonicalId}
                  placeholder="vendor/slug"
                  onChange={(event) => onNewCanonical({ ...newCanonical, canonicalId: event.target.value })}
                />
              </label>
              <label className="mm-field">
                <span>{t('Official Name')}</span>
                <input
                  className="mm-input"
                  value={newCanonical.officialName}
                  placeholder={t('原厂官方名称（保留大小写与版本号）')}
                  onChange={(event) => onNewCanonical({ ...newCanonical, officialName: event.target.value })}
                />
              </label>
              <label className="mm-field">
                <span>{t('Official Vendor')}</span>
                <input
                  className="mm-input"
                  value={newCanonical.officialVendor}
                  placeholder="Google"
                  onChange={(event) => onNewCanonical({ ...newCanonical, officialVendor: event.target.value })}
                />
              </label>
              <label className="mm-field">
                <span>{t('能力标签')}</span>
                <input
                  className="mm-input"
                  value={newCanonical.capabilities}
                  placeholder="image, image.edit"
                  onChange={(event) => onNewCanonical({ ...newCanonical, capabilities: event.target.value })}
                />
              </label>
            </div>
            <div className="mm-create-actions">
              <button type="button" className="o-btn o-btn--default o-btn--sm" onClick={onCreate} data-testid="mm-create">
                {t('创建并关联')}
              </button>
              <button type="button" className="o-btn o-btn--ghost o-btn--sm" onClick={onToggleCreating}>
                {t('取消')}
              </button>
            </div>
          </div>
        )}

        <div className="mm-actions-danger">
          <button type="button" className="mm-danger" onClick={onUnlink} data-testid="mm-unlink">
            {t('解除映射')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mm-fact">
      <span className="mm-fact-label">{label}</span>
      <span className={mono ? 'mm-fact-value mm-fact-value--mono' : 'mm-fact-value'}>{value}</span>
    </div>
  );
}
