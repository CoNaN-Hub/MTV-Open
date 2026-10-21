/**
 * AgentApprovalCard — Agent 步骤审批卡（P3-E1）。
 *
 * 展示等待确认的工具操作（画布写入、文件写入、媒体生成、永久删除、项目记忆、API 配置），
 * 提供确认 / 拒绝。键盘可操作，类别用文字标签而非仅颜色表达。
 *
 * 版式 = **官方卡 / 表单卡 / 选项行 / 胶囊键**（`official-chat.css` 的 `.c-card*` /
 * `.c-btn-pill` / `.c-btn-text` / `.c-opt*` / `.c-check`，出处 `page-DVqoHdTT.js` 逐字）：
 *   · 卡片 `w-full min-w-0 max-w-[360px] space-y-2 rounded-xl bg-white/[0.04] px-3.5 py-3`
 *   · 卡头 `flex items-center gap-1.5`：图标 `16 / stroke 1.5 / text-muted-foreground`
 *     + 标题 `text-xs font-medium leading-4 text-chat-foreground`
 *     + 状态 `ml-auto shrink-0 text-[11px] text-muted-foreground`
 *   · 主按钮（官方唯一的表单确认形态）= **胶囊** `h-9 rounded-full px-6 text-sm font-medium`，
 *     底 `rgba(255,255,255,0.10)`、字 `#d4d4d8`、内描边、hover `rgba(255,255,255,0.16)`，
 *     禁用 `bg-white/[0.03] text-muted-foreground/40`
 *   · 次级按钮 `px-2 text-xs text-muted-foreground hover:text-chat-foreground`
 *   · 可选项 = 官方 `OptionRow`：`min-h-[34px] rounded-[7px] px-2.5 py-2`，
 *     选中 `bg-white/[0.07]`、hover `bg-white/[0.04]`，尾部勾选框 `size-[18px]`（多选 `rounded-[5px]`）
 *   · 图标全部换成 lucide（官方那套 1.5 描边线性图标）
 *
 * ⚠️ 与改版前的差别：原来是**琥珀色警告卡**（`border-l-2 border-amber-400/60 bg-amber-400/5`
 *    + `text-amber-300` + `bg-amber-500` 黑色字确认键）—— 官方没有琥珀警告卡这种形态，
 *    审批卡就是一张中性卡 + 胶囊主键 ⇒ 整体换掉。
 * 行为一字未改：确认 / 拒绝、媒体模型选择、中转站模型勾选（含上限、筛选、分页、目录过期）、
 * 配置写入的「不写 API Key」提示、AgentToolDetails 展开全部保留。
 */
import Select from '../shared/Select';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import type {
  AgentApprovalKind,
  AgentApprovalResolution,
  AgentStep,
  ProviderModelChoice,
} from '../../types/agent';
import type { MediaModelOption } from '../nodes/shared/defaultModels';
import AgentToolDetails from './AgentToolDetails';
import { useT } from '../../i18n';
import { MAX_PROVIDER_MODEL_SELECTION, queryProviderModels, toggleProviderModelSelection } from '../../services/chat/providerModelCatalogService';
/* ★ 模型名的唯一出口：界面只显示 displayName，不显示平台调用 id */
import { displayNameOfCatalogModel, useModelNameResolver } from '../../services/models/display';

interface AgentApprovalCardProps {
  step: AgentStep;
  mediaModelOptions: MediaModelOption[];
  mediaModelAvailability: Record<string, boolean>;
  onResolve: (approvalId: string, resolution: AgentApprovalResolution) => void;
}

const KIND_META: Record<AgentApprovalKind, { label: string; icon: string }> = {
  user_choice: { label: '需要你选择', icon: 'lucide:list-checks' },
  canvas_write: { label: '画布修改', icon: 'lucide:square-dashed-mouse-pointer' },
  file_write: { label: '写入文件', icon: 'lucide:save' },
  permanent_delete: { label: '永久删除', icon: 'lucide:trash-2' },
  media_generation: { label: '生成媒体', icon: 'lucide:image-plus' },
  memory_write: { label: '保存记忆', icon: 'lucide:brain' },
  config_write: { label: 'API 配置', icon: 'lucide:plug' },
  asset_write: { label: '资产库写入', icon: 'lucide:library' },
};


const PROVIDER_CATEGORY_LABELS: Record<ProviderModelChoice['category'], string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
};

const MEDIA_KIND_LABELS = {
  image: '生图',
  video: '视频',
  audio: '音频',
} as const;

export default function AgentApprovalCard(props: AgentApprovalCardProps) {
  return <ApprovalCardContent key={props.step.approval?.id ?? props.step.id} {...props} />;
}

function ApprovalCardContent({
  step,
  mediaModelOptions,
  mediaModelAvailability,
  onResolve,
}: AgentApprovalCardProps) {
  const t = useT();
  /* ★ 模型名唯一出口（媒体模型选择卡只显示 displayName）*/
  const modelName = useModelNameResolver();
  const approval = step.approval;
  const inputRequest = approval?.inputRequest;
  const mediaModelRequest = inputRequest?.kind === 'media_model' ? inputRequest : undefined;
  const providerModelsRequest = inputRequest?.kind === 'provider_models' ? inputRequest : undefined;
  const [selectedModelRef, setSelectedModelRef] = useState(
    mediaModelRequest?.selectedModelRef,
  );
  // 中转站接入：默认不预选，由用户明确勾选要接入哪几个
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const maxSelection = Math.min(providerModelsRequest?.maxSelection ?? MAX_PROVIDER_MODEL_SELECTION, MAX_PROVIDER_MODEL_SELECTION);
  const providerPage = useMemo(() => queryProviderModels(providerModelsRequest?.options ?? [], query, categoryFilter, page),
    [providerModelsRequest, query, categoryFilter, page]);
  const expiresAt = providerModelsRequest?.catalog?.expiresAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt]);
  const catalogExpired = !!expiresAt && expiresAt <= now;
  const providerGroups = useMemo(() => {
    const groups = new Map<string, ProviderModelChoice[]>();
    for (const option of providerPage.options) {
      const list = groups.get(option.category) ?? [];
      list.push(option);
      groups.set(option.category, list);
    }
    return (['text', 'image', 'video', 'audio'] as const)
      .flatMap((category) => (groups.has(category)
        ? [[category, groups.get(category)!] as const]
        : []));
  }, [providerPage]);
  const toggleModelId = (id: string) => {
    setSelectedModelIds((current) => toggleProviderModelSelection(current, [id], maxSelection));
  };
  const toggleCategory = (ids: string[]) => {
    setSelectedModelIds((current) => toggleProviderModelSelection(current, ids, maxSelection));
  };
  const groupedModels = useMemo(() => {
    if (!mediaModelRequest) return [];
    const groups = new Map<string, MediaModelOption[]>();
    for (const model of mediaModelOptions) {
      if (model.mediaKind !== mediaModelRequest.mediaKind) continue;
      const models = groups.get(model.groupName) ?? [];
      models.push(model);
      groups.set(model.groupName, models);
    }
    return [...groups.entries()];
  }, [mediaModelRequest, mediaModelOptions]);
  if (!approval) return null;
  const meta = KIND_META[approval.kind];
  const needsModelSelection = !!mediaModelRequest;
  const needsProviderSelection = !!providerModelsRequest;
  const hasAvailableModel = groupedModels.some(([, models]) =>
    models.some((model) => mediaModelAvailability[model.value]),
  );
  const selectedModelAvailable = !!selectedModelRef
    && !!mediaModelAvailability[selectedModelRef];

  const handleConfirm = () => {
    if (approval.status !== 'pending' || (providerModelsRequest?.catalog && providerModelsRequest.catalog.expiresAt <= Date.now())
      || (needsProviderSelection && (!selectedModelIds.length || selectedModelIds.length > maxSelection))) return;
    onResolve(approval.id, {
      approved: true,
      ...(needsModelSelection ? { inputValues: { modelRef: selectedModelRef } } : {}),
      ...(needsProviderSelection ? { inputValues: { selectedModelIds } } : {}),
    });
  };

  return (
    <div
      className="c-card"
      role="group"
      aria-label={t('{label}待确认', { label: t(meta.label) })}
    >
      <div className="c-card__head">
        <Icon icon={meta.icon} width={16} strokeWidth={1.5} aria-hidden="true" />
        <span className="c-card__title">{t('待确认')} · {t(meta.label)}</span>
        <span className="c-card__status">{t('等待你的决定')}</span>
      </div>
      <p className="c-card__body">
        {step.toolCall?.inputSummary || approval.summary}
      </p>
      <AgentToolDetails input={step.toolCall?.inputDisplay} defaultExpanded />
      {approval.kind === 'config_write' && (
        <div className="c-card__body c-card__divider flex items-start gap-1.5" style={{ fontSize: 12, lineHeight: '18px' }}>
          <Icon icon="lucide:shield-check" width={14} className="mt-0.5 shrink-0" />
          <span>{t('不会写入 API Key；新连接保持空白，已有连接保留原值。')}</span>
        </div>
      )}
      {mediaModelRequest && (
        <div className="c-card__divider">
          <p className="c-card__title mb-2">
            {t('选择{kind}模型', { kind: t(MEDIA_KIND_LABELS[mediaModelRequest.mediaKind]) })}
          </p>
          {hasAvailableModel ? (
            <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
              {groupedModels.map(([groupName, models]) => (
                <div key={groupName}>
                  <p className="c-card__status mb-1" style={{ marginLeft: 0 }}>{groupName}</p>
                  <div className="flex flex-col">
                    {models.map((model) => {
                      const available = !!mediaModelAvailability[model.value];
                      const selected = selectedModelRef === model.value;
                      return (
                        <button
                          key={model.value}
                          type="button"
                          disabled={!available}
                          aria-pressed={selected}
                          title={available ? model.description : t('模型未配置或当前不可用')}
                          onClick={() => setSelectedModelRef(model.value)}
                          className="c-opt"
                        >
                          <span className="c-opt__label">{modelName(model.value)}</span>
                          <span className="c-opt__desc">{model.description}</span>
                          <span className="c-opt__mark" data-on={selected || undefined} aria-hidden="true">
                            {selected && <Icon icon="lucide:check" width={13} strokeWidth={2} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="c-card__body" style={{ fontSize: 12, lineHeight: '17px', color: 'var(--c-muted)' }}>
              {t('暂无可用模型，请先在设置中完成模型配置。')}
            </p>
          )}
        </div>
      )}
      {providerModelsRequest && (
        <div className="c-card__divider">
          <p className="c-card__title mb-2">
            {t('勾选要接入的模型（已选 {selected} / {total}）', { selected: selectedModelIds.length, total: providerModelsRequest.options.length })}
          </p>
          <p className="c-card__body mb-2" style={{ fontSize: 12, color: 'var(--c-muted)' }} role="status">
            {t('每批最多 {count} 个；筛选和翻页会保留已选项。', { count: maxSelection })}
          </p>
          {catalogExpired && (
            <p role="alert" className="c-card__body mb-2" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
              {t('模型目录已过期，请拒绝本次选择并重新读取目录。')}
            </p>
          )}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              className="c-input min-w-0 flex-1"
              aria-label={t('搜索模型名称或 ID')}
              placeholder={t('搜索模型名称或 ID')}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            />
            <Select
              fixedMenu
              className="min-w-0"
              triggerClassName="c-select-trigger"
              menuClassName="o-menu"
              menuHideOverlayScrollbar
              aria-label={t('模型分类')}
              value={categoryFilter}
              onChange={(selectedOptionValue) => { setCategoryFilter(selectedOptionValue); setPage(1); }}
            >
              <option value="">{t('全部分类')}</option>
              {Object.entries(PROVIDER_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
            </Select>
            <button type="button" className="c-btn-text" disabled={!selectedModelIds.length}
              onClick={() => setSelectedModelIds([])}>{t('清空已选')}</button>
          </div>
          {providerPage.total === 0 && (
            <p className="c-card__body" style={{ fontSize: 12, color: 'var(--c-muted)' }}>{t('没有匹配的模型')}</p>
          )}
          <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
            {providerGroups.map(([category, options]) => {
              const ids = options.map((option) => option.id);
              const allSelected = ids.every((id) => selectedModelIds.includes(id));
              return (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="c-card__status" style={{ marginLeft: 0 }}>
                      {t(PROVIDER_CATEGORY_LABELS[category])}（{options.length}）
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleCategory(ids)}
                      disabled={catalogExpired || (!allSelected && selectedModelIds.length >= maxSelection)}
                      className="c-btn-text"
                    >
                      {allSelected ? t('取消本页此类选择') : t('选取本页此类（受批次上限限制）')}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {options.map((option) => {
                      const selected = selectedModelIds.includes(option.id);
                      return (
                        <label
                          key={option.id}
                          className="c-opt"
                          style={{ cursor: 'pointer' }}
                          aria-selected={selected}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={catalogExpired || (!selected && selectedModelIds.length >= maxSelection)}
                            onChange={() => toggleModelId(option.id)}
                            className="c-check"
                          />
                          <span className="c-opt__desc" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                            {/* ★ 只显示**展示名**：平台的原始模型 id 不进界面
                                （需要排障时看 DOM 上的 `data-model-id`）*/}
                            <span data-model-id={option.id}>
                              {displayNameOfCatalogModel(providerModelsRequest?.catalog?.catalogId, option.id, option.name)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 c-card__body" style={{ fontSize: 12 }}>
            <span>{t('筛选结果 {count} 个', { count: providerPage.total })} · {providerPage.page} / {providerPage.pageCount}</span>
            <div className="flex items-center gap-2">
              <button type="button" className="c-btn-text" disabled={providerPage.page <= 1}
                onClick={() => setPage(providerPage.page - 1)}>{t('上一页')}</button>
              <button type="button" className="c-btn-text" disabled={providerPage.page >= providerPage.pageCount}
                onClick={() => setPage(providerPage.page + 1)}>{t('下一页')}</button>
            </div>
          </div>
        </div>
      )}
      <div className="c-card__actions">
        <button
          type="button"
          onClick={() => onResolve(approval.id, { approved: false })}
          className="c-btn-text"
        >
          {t('拒绝')}
        </button>
        <button
          type="button"
          disabled={(needsModelSelection && !selectedModelAvailable)
            || approval.status !== 'pending' || catalogExpired
            || (needsProviderSelection && (selectedModelIds.length === 0 || selectedModelIds.length > maxSelection))}
          onClick={handleConfirm}
          className="c-btn-pill"
        >
          {needsModelSelection
            ? t('确认生成')
            : needsProviderSelection
              ? t('接入选中的 {count} 个模型', { count: selectedModelIds.length })
              : t('确认执行')}
        </button>
      </div>
    </div>
  );
}
