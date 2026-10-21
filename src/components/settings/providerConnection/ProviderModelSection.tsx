/**
 * settings/providerConnection/ProviderModelSection — 启用模型区块。
 *
 * 承载模型清单的搜索 / 分类筛选 / 勾选 / 分类修正 / 协议与视频能力入口，
 * 以及自定义连接专属的文档导入与手动添加模型。
 */
/* ★ 模型名唯一出口：界面只显示 displayName */
import { displayNameOfCatalogEntry } from '../../../services/models/display';
import Select from '../../shared/Select';
import { Icon } from '@iconify/react';
import type { Dispatch, SetStateAction } from 'react';
import { entitlementModelKey, getProviderEntitlements } from '../../../services/ai/providerEntitlements';
import { GENERAL_MODEL_CATEGORY_LABELS } from '../../../types';
import type {
  GeneralModelCategory,
  ImageReferenceRequestMode,
  ProviderModelSelection,
} from '../../../types';
import type { VideoModelCapability } from '../../../types/aiTypes';
import type { ModelProtocolImportResult } from '../../../services/ai/modelProtocolImport';
import type { ProviderDefinition } from '../../../services/ai/providerCatalogService';
import { normalizeBaseUrl } from '../../../services/ai/providerBaseUrl';
import { useT } from '../../../i18n';
import OFFICIAL_CATEGORY_ICONS from '../../../data/official-category-icons.json';
import {
  OFFICIAL_SELECT_TRIGGER,
  OfficialButton,
  OfficialInput,
  OfficialNote,
  OfficialTextarea,
} from '../official/OfficialControls';
import ModelProtocolEditor from '../ModelProtocolEditor';
import ProtocolImportPanel from '../ProtocolImportPanel';
import VideoCapabilityEditor from './VideoCapabilityEditor';
import { CATEGORY_ORDER, type CatalogStatus, type ProtocolImportSnapshot } from './providerConnectionShared';

/** 模型类别 → 官方分类图标 key（`data/official-category-icons.json` 的键就是官方中文文案） */
const CATEGORY_ICON_KEY: Record<GeneralModelCategory, keyof typeof OFFICIAL_CATEGORY_ICONS> = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
};

/** 官方分类筛选 chip 的**多选**用法（官方「节点搜索」那一排的原样式，选中 = `bg-accent`，不是蓝色） */
function ChipButton({
  checked, icon, onClick, children,
}: {
  checked: boolean;
  icon: keyof typeof OFFICIAL_CATEGORY_ICONS;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="o-filterchip"
      data-checked={checked || undefined}
      aria-pressed={checked}
      onClick={onClick}
    >
      <span
        className="contents"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: OFFICIAL_CATEGORY_ICONS[icon] ?? '' }}
      />
      <span>{children}</span>
    </button>
  );
}

interface ProviderModelSectionProps {  definition: ProviderDefinition;
  models: ProviderModelSelection[];
  filteredModels: ProviderModelSelection[];
  selectedModels: ProviderModelSelection[];
  selectedIds: Set<string>;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  category: GeneralModelCategory | 'all';
  setCategory: Dispatch<SetStateAction<GeneralModelCategory | 'all'>>;
  visibleModelCategories: Set<GeneralModelCategory>;
  catalogStatus: CatalogStatus;
  catalogMessage: string;
  missingCredentials: boolean;
  apiKey: string;
  baseUrl: string;
  setProtocolValid: Dispatch<SetStateAction<boolean>>;
  protocolImportOpen: boolean;
  setProtocolImportOpen: Dispatch<SetStateAction<boolean>>;
  protocolImportSnapshot: ProtocolImportSnapshot | null;
  protocolModel: ProviderModelSelection | undefined;
  videoCapabilityModel: ProviderModelSelection | undefined;
  setProtocolModelId: Dispatch<SetStateAction<string | null>>;
  setVideoCapabilityModelId: Dispatch<SetStateAction<string | null>>;
  categoryEditModelId: string | null;
  setCategoryEditModelId: Dispatch<SetStateAction<string | null>>;
  manualModelId: string;
  setManualModelId: Dispatch<SetStateAction<string>>;
  manualModelName: string;
  setManualModelName: Dispatch<SetStateAction<string>>;
  manualCategory: GeneralModelCategory;
  setManualCategory: Dispatch<SetStateAction<GeneralModelCategory>>;
  onToggleModel: (modelId: string) => void;
  onToggleVisibleModels: () => void;
  onToggleVisibleCategory: (category: GeneralModelCategory) => void;
  onToggleAllVisibleCategories: () => void;
  onAddManualModel: () => void;
  onUpdateModelCategory: (modelId: string, category: GeneralModelCategory) => void;
  onUpdateModelContextWindow: (modelId: string, raw: string) => void;
  onUpdateModelDescription: (modelId: string, description: string) => void;
  onUpdateModelVisionCapability: (modelId: string, enabled: boolean) => void;
  onUpdateModelProtocol: (
    modelId: string,
    executionProfile: ProviderModelSelection['executionProfile'],
  ) => void;
  onUpdateVideoCapability: (modelId: string, capability: VideoModelCapability | undefined) => void;
  onUpdateImageReferenceRequestMode: (modelId: string, mode: ImageReferenceRequestMode) => void;
  /** ★ 连接级默认「参考图调用语义」（本连接所有图片模型继承；模型自己配过则优先） */
  imageReferenceRequestMode: ImageReferenceRequestMode | undefined;
  onImageReferenceRequestModeChange: (mode: ImageReferenceRequestMode | undefined) => void;
  onCloseProtocolEditor: () => void;
  onApplyProtocolImport: (result: ModelProtocolImportResult) => void;
  onUndoProtocolImport: () => void;
  onFetchModels: () => void;
}

export default function ProviderModelSection({
  definition,
  models,
  filteredModels,
  selectedModels,
  selectedIds,
  query,
  setQuery,
  category,
  setCategory,
  visibleModelCategories,
  catalogStatus,
  catalogMessage,
  missingCredentials,
  apiKey,
  baseUrl,
  setProtocolValid,
  protocolImportOpen,
  setProtocolImportOpen,
  protocolImportSnapshot,
  protocolModel,
  videoCapabilityModel,
  setProtocolModelId,
  setVideoCapabilityModelId,
  categoryEditModelId,
  setCategoryEditModelId,
  manualModelId,
  setManualModelId,
  manualModelName,
  setManualModelName,
  manualCategory,
  setManualCategory,
  onToggleModel,
  onToggleVisibleModels,
  onToggleVisibleCategory,
  onToggleAllVisibleCategories,
  onAddManualModel,
  onUpdateModelCategory,
  onUpdateModelContextWindow,
  onUpdateModelDescription,
  onUpdateModelVisionCapability,
  onUpdateModelProtocol,
  onUpdateVideoCapability,
  onUpdateImageReferenceRequestMode,
  imageReferenceRequestMode,
  onImageReferenceRequestModeChange,
  onCloseProtocolEditor,
  onApplyProtocolImport,
  onUndoProtocolImport,
  onFetchModels,
}: ProviderModelSectionProps) {
  const t = useT();

  /**
   * 「这条连接拉到的模型里，哪些**不在平台价目表**里」—— 用于行内标注（不隐藏）。
   *
   * 权威清单是带 Key 的 `/v1/models`；平台匿名价目表 `/api/pricing` 只作为**佐证**。
   * 实测（土豆）：`/v1/models` 会列出价目表里没有的模型，而其中就有直接回
   * `503 No available channel for model … under group default` 的 ⇒ 拉得到 ≠ 用得了。
   * `null` = 还没有价目表快照（没拉过）⇒ **一律不标**（不猜）。
   */
  const platformUnlisted = (() => {
    /* 快照在模块级内存里（不持久化）⇒ 每次渲染现取，天然在「刚拉取过」之后是最新的。 */
    const snapshot = getProviderEntitlements(definition.id);
    if (!snapshot) return null;
    return (modelId: string) => snapshot.models[entitlementModelKey(modelId)] === undefined;
  })();

  /** 官方「节点搜索」筛选 chip（`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium`）：
   *  图标是官方原 SVG（`data/official-category-icons.json`，9444 DOM 抠出），文案照官方 `filters.*`。 */
  const categoryOption = (value: GeneralModelCategory | 'all', label: string, officialLabel: keyof typeof OFFICIAL_CATEGORY_ICONS) => (    <label
      key={value}
      className="o-filterchip"
      htmlFor={`provider-model-category-${value}`}
      data-checked={category === value || undefined}
    >
      <span
        className="contents"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: OFFICIAL_CATEGORY_ICONS[officialLabel] ?? '' }}
      />
      <span>{label}</span>
      <input
        type="radio"
        className="sr-only"
        id={`provider-model-category-${value}`}
        name="provider-model-category"
        value={value}
        checked={category === value}
        onChange={() => { if (category !== value) setCategory(value); }}
      />
    </label>
  );

  return (
    <section className="o-section">
      <div className="o-section__head">
        <div>
          <h4 className="o-section__title">{t('启用模型')}</h4>
          <p className="o-section__desc">{t('仅勾选会在应用中使用的模型')}</p>
        </div>
        <div className="o-inline o-inline--wrap shrink-0">
          {definition.id === 'custom-openai' ? (
            <>
              {protocolImportSnapshot ? (
                <OfficialButton type="button" variant="ghost" size="sm" className="o-icon-btn" onClick={onUndoProtocolImport}>
                  <Icon icon="lucide:undo-2" width={16} />
                  {t('撤销导入')}
                </OfficialButton>
              ) : null}
              <OfficialButton
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={protocolImportOpen}
                onClick={() => setProtocolImportOpen((open) => !open)}
              >
                <Icon icon="lucide:file-down" width={16} />
                {t('导入文档')}
              </OfficialButton>
            </>
          ) : null}
          <OfficialButton
            type="button"
            variant="outline"
            size="sm"
            disabled={missingCredentials || catalogStatus === 'loading'}
            onClick={() => void onFetchModels()}
          >
            <Icon
              icon={catalogStatus === 'loading' ? 'lucide:loader-circle' : 'lucide:cloud-download'}
              className={catalogStatus === 'loading' ? 'settings-spin' : undefined}
              width={16}
            />
            {catalogStatus === 'loading' ? t('拉取中') : t('拉取模型')}
          </OfficialButton>
        </div>
      </div>

      {definition.id === 'custom-openai' && protocolImportOpen ? (
        <ProtocolImportPanel
          onApply={onApplyProtocolImport}
          onClose={() => setProtocolImportOpen(false)}
        />
      ) : null}

      {/* ★ 连接级「参考图请求」默认值 —— 用户 2026：「模型不要固定死这一个，其他能生图的模型也需要『调用语义』」。
          一条中转站通常整家同一套协议 ⇒ 在这里配一次，本连接下**所有图片模型**都继承；
          单个模型若在「模型调用协议」里单独配过，则以模型自己的为准（优先级见 `ApiProviderConfig` 注释）。 */}
      {models.some((model) => model.category === 'image') ? (
        <div className="o-card">
          <div className="o-card__row o-card__row--center">
            <span className="o-state"><Icon icon="lucide:image" width={14} /></span>
            <div className="o-card__body">
              <div className="o-card__desc">
                {t('参考图请求（本连接默认）：本连接下所有图片模型未单独配置时都用它。「编辑接口 JSON（images 数组）」= 参考图当底图的图生图语义')}
              </div>
            </div>
            <Select
              fixedMenu
              triggerClassName={OFFICIAL_SELECT_TRIGGER}
              menuClassName="o-menu"
              menuHideOverlayScrollbar
              closeOnScroll
              className="o-w28"
              value={imageReferenceRequestMode ?? ''}
              onChange={(selectedOptionValue) => onImageReferenceRequestModeChange(
                selectedOptionValue === '' ? undefined : selectedOptionValue as ImageReferenceRequestMode,
              )}
            >
              <option value="">{t('跟随厂商目录')}</option>
              <option value="edits-json-images">{t('编辑接口 JSON（images 数组）')}</option>
              <option value="edits-multipart">{t('编辑接口 Multipart（图片文件）')}</option>
              <option value="generation-json-image-urls">{t('生成接口 JSON（image_urls）')}</option>
              <option value="generation-json-image-data-urls">{t('生成接口 JSON（image，data URL 数组）')}</option>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="o-card">
        <div className="o-card__row o-card__row--center">
          <span className="o-state"><Icon icon="lucide:eye" width={14} /></span>
          <div className="o-card__body">
            <div className="o-card__desc">{t('是否在对应类型节点中显示')}</div>
          </div>
          <div className="o-filterbar" role="group" aria-label={t('节点列表显示分类')}>
            <ChipButton
              checked={visibleModelCategories.size === CATEGORY_ORDER.length}
              icon="全部"
              onClick={onToggleAllVisibleCategories}
            >
              {t('全部')}
            </ChipButton>
            {CATEGORY_ORDER.map((item) => (
              <ChipButton
                key={item}
                checked={visibleModelCategories.has(item)}
                icon={CATEGORY_ICON_KEY[item]}
                onClick={() => onToggleVisibleCategory(item)}
              >
                {GENERAL_MODEL_CATEGORY_LABELS[item]}
              </ChipButton>
            ))}
          </div>
        </div>
      </div>

      {catalogMessage && (
        <OfficialNote
          tone={catalogStatus === 'error' ? 'danger' : 'default'}
          icon={<Icon icon={catalogStatus === 'error' ? 'lucide:circle-alert' : 'lucide:info'} width={16} />}
        >
          {catalogMessage}
        </OfficialNote>
      )}

      {models.length > 0 && (
        <>
          <div className="o-inline">
            <OfficialInput
              type="search"
              className="flex-1 min-w-0"
              leadingIcon={<Icon icon="lucide:search" width={16} />}
              value={query}
              placeholder={t('搜索模型 ID 或名称')}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="o-filterbar" role="radiogroup" aria-label={t('模型类别')}>
              {categoryOption('all', t('全部'), '全部')}
              {CATEGORY_ORDER.map((item) => categoryOption(item, GENERAL_MODEL_CATEGORY_LABELS[item], CATEGORY_ICON_KEY[item]))}
            </div>
          </div>

          <div className="o-list">
            <div className="o-list__head">
              <label>
                <input
                  type="checkbox"
                  className="o-check"
                  checked={filteredModels.length > 0 && filteredModels.every((model) => selectedIds.has(model.id))}
                  onChange={onToggleVisibleModels}
                />
                <span>{t('选择当前结果')}</span>
              </label>
              <span>{t('{count} 个已选', { count: selectedModels.length })}</span>
            </div>

            {filteredModels.length > 0 ? filteredModels.map((model) => (
              <div
                key={model.id}
                className={`o-list__row${categoryEditModelId === model.id ? ' o-list__row--editing' : ''}`}
              >
                <button
                  type="button"
                  className="o-kind"
                  aria-label={`修改 ${displayNameOfCatalogEntry(model, { baseUrl })} 的模型分类，当前为${GENERAL_MODEL_CATEGORY_LABELS[model.category]}`}
                  title="点击修改模型分类"
                  aria-expanded={categoryEditModelId === model.id}
                  onClick={() => setCategoryEditModelId((current) => current === model.id ? null : model.id)}
                >
                  <span
                    className="contents"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: OFFICIAL_CATEGORY_ICONS[CATEGORY_ICON_KEY[model.category]] ?? '' }}
                  />
                  {GENERAL_MODEL_CATEGORY_LABELS[model.category]}
                </button>
                <label className="o-list__label">
                  <input
                    type="checkbox"
                    className="o-check"
                    checked={selectedIds.has(model.id)}
                    onChange={() => onToggleModel(model.id)}
                  />
                  <span className="o-list__copy">
                    <strong>{displayNameOfCatalogEntry(model, { baseUrl })}</strong>
                    {/* 官方模型行：名字下方是**该模型的简要说明**（`official-model-meta.json` 每条都有 `description`），
                        不是内部 ID（用户：「模型名底下 不应该都是 关于模型的简要说明吗 你怎么还是ID」）✓ */}
                    <small>
                      {model.description ?? ''}
                      {/* ★ 「拉取模型」的权威来源是带 Key 的 `/v1/models`；平台**价目表**里没有这条 ⇒ 标注。
                          事故（用户真机）：土豆的 `/v1/models` 会拉出 `gpt-image-2-pro`、`gpt-image-2.5-sunburst`
                          这种价目表里根本没有的模型，其中一个实测直接回
                          `503 No available channel for model … under group default`
                          ⇒ **「能拉到」不等于「能用」**。这里**只标注、不隐藏**
                          （用户口径：后台接入什么就显示什么），要不要勾用由你决定。 */}
                      {platformUnlisted?.(model.id) ? (
                        <span className="o-list__warn" title={t('平台价目表未收录该模型：该分组很可能没有为它配置线路（实测会回 503）。可以勾选，但可能生成失败。')}>
                          {t('平台未收录')}
                        </span>
                      ) : null}
                    </small>
                  </span>
                </label>
                {definition.id === 'custom-openai' && selectedIds.has(model.id) ? (
                  <>
                    {model.category === 'video' ? (
                      <OfficialButton
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className={model.videoCapability ? 'o-icon-btn o-icon-btn--on' : 'o-icon-btn'}
                        aria-label={`配置 ${displayNameOfCatalogEntry(model, { baseUrl })} 视频参数能力`}
                        title="视频参数能力"
                        onClick={() => {
                          setVideoCapabilityModelId(model.id);
                          setProtocolModelId(null);
                          setProtocolValid(true);
                        }}
                      >
                        <Icon icon="lucide:video" width={16} />
                      </OfficialButton>
                    ) : null}
                    <OfficialButton
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={model.executionProfile ? 'o-icon-btn o-icon-btn--on' : 'o-icon-btn'}
                      aria-label={`配置 ${displayNameOfCatalogEntry(model, { baseUrl })} 调用协议`}
                      title="调用协议"
                      onClick={() => {
                        setProtocolModelId(model.id);
                        setVideoCapabilityModelId(null);
                        setProtocolValid(true);
                      }}
                    >
                      <Icon icon="lucide:sliders-horizontal" width={16} />
                    </OfficialButton>
                  </>
                  ) : null}
                {categoryEditModelId === model.id ? (
                  <div
                    className="o-inline-edit"
                    role="group"
                    aria-label={`选择 ${displayNameOfCatalogEntry(model, { baseUrl })} 的模型分类`}
                  >
                    <div className="o-filterbar">
                      <span className="o-field__desc">分类</span>
                      {CATEGORY_ORDER.map((item) => (
                        <ChipButton
                          key={item}
                          checked={model.category === item}
                          icon={CATEGORY_ICON_KEY[item]}
                          onClick={() => {
                            if (model.category === item) setCategoryEditModelId(null);
                            else onUpdateModelCategory(model.id, item);
                          }}
                        >
                          {GENERAL_MODEL_CATEGORY_LABELS[item]}
                        </ChipButton>
                      ))}
                    </div>
                    {model.category === 'text' ? (
                      <>
                        <label className="o-list__label">
                          <input
                            type="checkbox"
                            className="o-check"
                            checked={model.inputModalities?.includes('image') ?? false}
                            onChange={(event) => onUpdateModelVisionCapability(
                              model.id,
                              event.target.checked,
                            )}
                          />
                          <span className="o-field__label">支持图片输入</span>
                        </label>
                        <label className="o-field">
                          <span className="o-field__label">上下文窗口（token）</span>
                          <OfficialInput
                            type="text"
                            inputMode="numeric"
                            value={model.contextWindow ?? ''}
                            placeholder="留空则按模型 ID 推断"
                            onChange={(event) => onUpdateModelContextWindow(
                              model.id,
                              event.target.value,
                            )}
                          />
                        </label>
                      </>
                    ) : null}
                    <label className="o-field">
                      <span className="o-field__label">Agent 选型说明</span>
                      <OfficialTextarea
                        value={model.description ?? ''}
                        maxLength={500}
                        rows={2}
                        placeholder="例如：适合中文 OCR、角色图分析，速度快、成本低"
                        onChange={(event) => onUpdateModelDescription(model.id, event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            )) : (
              <div className="o-list__empty">{t('没有匹配的模型')}</div>
            )}
          </div>

          {definition.id === 'custom-openai'
            && videoCapabilityModel
            && videoCapabilityModel.category === 'video'
            && selectedIds.has(videoCapabilityModel.id) ? (
              <VideoCapabilityEditor
                key={videoCapabilityModel.id}
                model={videoCapabilityModel}
                baseUrl={baseUrl}
                onChange={(capability) => onUpdateVideoCapability(
                  videoCapabilityModel.id,
                  capability,
                )}
                onClose={() => setVideoCapabilityModelId(null)}
              />
            ) : null}

          {definition.id === 'custom-openai'
            && protocolModel
            && selectedIds.has(protocolModel.id) ? (
              <ModelProtocolEditor
                key={protocolModel.id}
                model={protocolModel}
                apiKey={apiKey.trim()}
                baseUrl={normalizeBaseUrl(baseUrl) || definition.defaultBaseUrl || ''}
                onChange={(profile) => onUpdateModelProtocol(protocolModel.id, profile)}
                onImageReferenceRequestModeChange={(mode) => (
                  onUpdateImageReferenceRequestMode(protocolModel.id, mode)
                )}
                onValidityChange={setProtocolValid}
                onClose={onCloseProtocolEditor}
              />
            ) : null}
        </>
      )}

      {definition.id === 'custom-openai' && (
        <div className="o-card">
          <div className="o-card__row o-card__row--center">
            <div className="o-card__body o-inline">
              <OfficialInput
                type="text"
                className="flex-1 min-w-0"
                value={manualModelId}
                placeholder="手动输入模型 ID"
                onChange={(event) => setManualModelId(event.target.value)}
              />
              <OfficialInput
                type="text"
                className="flex-1 min-w-0"
                value={manualModelName}
                placeholder="显示名称（可选）"
                onChange={(event) => setManualModelName(event.target.value)}
              />
              <Select fixedMenu triggerClassName={OFFICIAL_SELECT_TRIGGER} menuClassName="o-menu" menuHideOverlayScrollbar closeOnScroll className="o-w28"
                value={manualCategory}
                onChange={(selectedOptionValue) => setManualCategory(selectedOptionValue as GeneralModelCategory)}
              >
                {CATEGORY_ORDER.map((item) => (
                  <option key={item} value={item}>{GENERAL_MODEL_CATEGORY_LABELS[item]}</option>
                ))}
              </Select>
            </div>
            <OfficialButton
              type="button"
              variant="outline"
              size="sm"
              aria-label="添加手动模型"
              disabled={!manualModelId.trim()}
              onClick={onAddManualModel}
            >
              <Icon icon="lucide:plus" width={16} />
              添加
            </OfficialButton>
          </div>
        </div>
      )}
    </section>
  );
}
