/**
 * ProviderConnectionDialog — add/edit one provider connection and choose its enabled models.
 *
 * 本组件只负责弹窗级状态与编排：凭证、模型清单、协议导入快照和各区块的联动。
 * 连接信息、联网搜索切换、模型清单三个区块分别拆到 ./providerConnection/* 子组件。
 */
import { Icon } from '@iconify/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ChatApiProtocol,
  GeneralModelCategory,
  ImageReferenceRequestMode,
  ProviderBillingConfig,
  ProviderModelSelection,
} from '../../types';
import { resolveChatApiProtocol } from '../../services/ai/chatApiProtocol';
import type { VideoModelCapability } from '../../types/aiTypes';
import {
  capCatalogModels,
  createConnectionId,
  fetchProviderModelCatalog,
  getProviderDefinition,
  getProviderDefinitions,
  getWebSearchProviderDefinitions,
  selectableProviderDefinitions,
  type ProviderDefinition,
} from '../../services/ai/providerCatalogService';
import { normalizeBaseUrl } from '../../services/ai/providerBaseUrl';
import type { ModelProtocolImportResult } from '../../services/ai/modelProtocolImport';
import { useAppStore } from '../../store/useAppStore';
import { testProviderConnection } from '../../services/testConnection';
import { useT } from '../../i18n';
import ModalOverlay from '../shared/ModalOverlay';
import { OfficialButton } from './official/OfficialControls';
import ProviderConnectionForm from './providerConnection/ProviderConnectionForm';
import ProviderModelSection from './providerConnection/ProviderModelSection';
import ProviderWorkflowSection from './providerConnection/ProviderWorkflowSection';
import type { WorkflowApiDraft } from '../../types/workflowApi';
import { normalizeWorkflowApiBaseUrl } from '../../services/workflowApi/autodlWorkflowManifest';
import { editableWorkflowApiManifest, validateDeclarativeWorkflowManifest } from '../../services/workflowApi/workflowApiDefinition';
import ProviderWebSearchPicker from './providerConnection/ProviderWebSearchPicker';
import ProviderBillingSection from './providerConnection/ProviderBillingSection';
import {
  assertProviderModelsVideoCapabilities,
  mergeModels,
} from './providerConnection/providerConnectionModels';
import {
  CATEGORY_ORDER,
  buildRelayAssistantPrompt,
  type CatalogStatus,
  type ProtocolImportSnapshot,
  type ProviderConnectionDialogProps,
} from './providerConnection/providerConnectionShared';

export default function ProviderConnectionDialog({
  isOpen,
  connectionId,
  initialConfig,
  providerConfigs,
  connectedProviderIds,
  fallbackModels,
  dreaminaLoggedIn,
  dreaminaLoading,
  runninghubWorkflowApiKey = '',
  onDreaminaLogin,
  onClose,
  onSave,
}: ProviderConnectionDialogProps) {
  const t = useT();
  const editing = !!connectionId && !!initialConfig;
  /**
   * ★ 「这条连接」的 id —— **同一次编辑里必须稳定**。
   *
   * `createConnectionId()` 生成的是随机 `custom-<uuid8>`：如果「拉取模型」与「保存」各生成一次，
   * 两次就不是同一条连接 ⇒ 拉取时按 A 缓存的权益，保存后按 B 去查 ⇒ **永远查不到**（折扣/分组门失效）。
   * 所以新建连接时**只生成一次**并记住，拉取与保存共用。
   */
  const generatedConnectionIdRef = useRef<string | undefined>(undefined);
  const resolveNextConnectionId = (catalogId: string): string => {
    if (connectionId) return connectionId;
    if (!generatedConnectionIdRef.current) generatedConnectionIdRef.current = createConnectionId(catalogId);
    return generatedConnectionIdRef.current;
  };
  const initialDefinitionId = initialConfig?.catalogId || connectionId || '';
  const initialDefinition = getProviderDefinition(initialDefinitionId, initialConfig);
  const initialSelectedModels = initialConfig?.selectedModels || [];
  const initialCatalogModels = initialConfig?.catalogModels || [];
  const initialLocalModels = initialDefinition ? (fallbackModels[initialDefinition.id] || []) : [];
  const [definitionId, setDefinitionId] = useState(initialDefinitionId);
  const [connectionName, setConnectionName] = useState(initialConfig?.name || initialDefinition?.name || '');
  const [chatApiProtocol, setChatApiProtocol] = useState<ChatApiProtocol>(
    () => resolveChatApiProtocol(initialConfig?.chatApiProtocol),
  );
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || initialDefinition?.defaultBaseUrl || '');
  /* ★ 连接级「参考图调用语义」默认值（本连接所有图片模型继承；模型自己配过则优先） */
  const [imageReferenceRequestMode, setImageReferenceRequestMode] = useState<ImageReferenceRequestMode | undefined>(
    initialConfig?.imageReferenceRequestMode,
  );
  /* ★ 连接级「计费 / 积分」（取价方式、积分换算、逐模型手动价）——
     用户 2026：「未来我会接入其他厂商的价格，不要锁死土豆这一套」 */
  const [billing, setBilling] = useState<ProviderBillingConfig | undefined>(initialConfig?.billing);
  const [workflowApiKey, setWorkflowApiKey] = useState(runninghubWorkflowApiKey);
  const [workflowDrafts, setWorkflowDrafts] = useState<WorkflowApiDraft[]>(() =>
    useAppStore.getState().workflows.filter((workflow) => workflow.adapterType === 'workflow-api' && workflow.workflowApi?.connectionId === connectionId)
      .map((workflow) => ({ id: workflow.id, name: workflow.name, manifest: editableWorkflowApiManifest(workflow.workflowApi!) })));
  const [workflowValid, setWorkflowValid] = useState(false);
  const [models, setModels] = useState<ProviderModelSelection[]>(
    mergeModels(mergeModels(initialLocalModels, initialCatalogModels), initialSelectedModels),
  );
  const [selectedIds, setSelectedIds] = useState(() =>
    new Set(initialSelectedModels.map((model) => model.id)),
  );
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>(
    initialSelectedModels.length > 0 || initialLocalModels.length > 0 ? 'ready' : 'idle',
  );
  const [catalogMessage, setCatalogMessage] = useState(
    initialCatalogModels.length > 0 ? t('已加载本地缓存 {count} 个模型', { count: initialCatalogModels.length }) : '',
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<GeneralModelCategory | 'all'>('all');
  const [visibleModelCategories, setVisibleModelCategories] = useState(
    () => new Set(initialConfig?.visibleModelCategories ?? CATEGORY_ORDER),
  );
  const [manualModelId, setManualModelId] = useState('');
  const [manualModelName, setManualModelName] = useState('');
  const [manualCategory, setManualCategory] = useState<GeneralModelCategory>('text');
  const [videoCapabilityModelId, setVideoCapabilityModelId] = useState<string | null>(null);
  const [protocolModelId, setProtocolModelId] = useState<string | null>(null);
  const [protocolValid, setProtocolValid] = useState(true);
  const [protocolImportOpen, setProtocolImportOpen] = useState(false);
  const [protocolImportSnapshot, setProtocolImportSnapshot] = useState<ProtocolImportSnapshot | null>(null);
  const [categoryEditModelId, setCategoryEditModelId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const definition = getProviderDefinition(definitionId);
  const definitions = getProviderDefinitions();
  const webSearchDefinitions = getWebSearchProviderDefinitions();
  const isWebSearchProvider = definition?.kind === 'web-search';
  const isWorkflowApi = definition?.kind === 'workflow-api';
  const hasWebSearchConnection = webSearchDefinitions.some((item) =>
    Boolean(providerConfigs[item.id]?.apiKey?.trim()),
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * ★ 「选择 API 厂商」里能挑的厂商（用户 2026 指定：一部分厂商不再出现在选择框）。
   *
   * ⚠️ 只过滤**新建连接的选择框**：厂商定义、适配器与既有连接全都保留
   *    （`HIDDEN_FROM_PROVIDER_PICKER_IDS` 里写明了为什么不能直接删定义）。
   *    正在编辑的那条连接即便已下架也仍然列出来（否则用户认不出自己在改什么，没法复核后保存）。
   */
  const availableDefinitions = selectableProviderDefinitions(definitions, {
    initialDefinitionId,
    connectedProviderIds,
    hasWebSearchConnection,
    isWebSearchProvider,
  });

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return models.filter((model) =>
      (category === 'all' || model.category === category)
      && (!normalizedQuery
        || model.name.toLowerCase().includes(normalizedQuery)
        || model.id.toLowerCase().includes(normalizedQuery)),
    );
  }, [category, models, query]);

  const selectedModels = useMemo(
    () => models.filter((model) => selectedIds.has(model.id)),
    [models, selectedIds],
  );

  const protocolModel = useMemo(
    () => models.find((model) => model.id === protocolModelId),
    [models, protocolModelId],
  );
  const videoCapabilityModel = useMemo(
    () => models.find((model) => model.id === videoCapabilityModelId),
    [models, videoCapabilityModelId],
  );

  /**
   * 新建自定义连接时，若接口地址和对话协议都与已有连接重合，多半是忘了自己加过。
   * Agent 那条路会按 Base URL + 协议并进已有连接，手动添加不便直接改写用户填的模型清单，
   * 所以只提示，由用户决定是新建还是回去编辑。
   */
  const duplicateConnectionName = useMemo(() => {
    if (editing || definition?.id !== 'custom-openai') return '';
    const target = normalizeBaseUrl(baseUrl, chatApiProtocol);
    if (!target) return '';
    const match = Object.values(providerConfigs).find((item) => (
      item.catalogId === 'custom-openai'
      && resolveChatApiProtocol(item.chatApiProtocol) === chatApiProtocol
      && normalizeBaseUrl(item.baseUrl, chatApiProtocol) === target
    ));
    return match?.name?.trim() || '';
  }, [baseUrl, chatApiProtocol, definition, editing, providerConfigs]);

  const missingCredentials = useMemo(() => {
    if (!definition) return true;
    if (definition.kind === 'workflow-api') return !baseUrl.trim();
    if (definition.authType === 'oauth') return !dreaminaLoggedIn;
    if (definition.id === 'runninghub-model') return !apiKey.trim() && !workflowApiKey.trim();
    if (!apiKey.trim()) return true;
    return definition.credentials.some(
      (field) => field.required && field.key === 'baseUrl' && !baseUrl.trim(),
    );
  }, [apiKey, baseUrl, definition, dreaminaLoggedIn, workflowApiKey]);
  const workflowOnlyConnection = definition?.id === 'runninghub-model' && !!workflowApiKey.trim() && !apiKey.trim();

  const chooseDefinition = (nextDefinition: ProviderDefinition) => {
    const savedConfig = nextDefinition.kind === 'web-search'
      ? providerConfigs[nextDefinition.id]
      : undefined;
    setDefinitionId(nextDefinition.id);
    setConnectionName(savedConfig?.name || nextDefinition.name);
    setChatApiProtocol(resolveChatApiProtocol(savedConfig?.chatApiProtocol));
    setApiKey(savedConfig?.apiKey || '');
    setBaseUrl(savedConfig?.baseUrl || nextDefinition.defaultBaseUrl || '');
    setImageReferenceRequestMode(savedConfig?.imageReferenceRequestMode);
    setBilling(savedConfig?.billing);
    setWorkflowApiKey('');
    const localModels = fallbackModels[nextDefinition.id] || [];
    setModels(localModels);
    setSelectedIds(new Set());
    setCatalogStatus(localModels.length > 0 ? 'ready' : 'idle');
    setCatalogMessage('');
    setQuery('');
    setCategory('all');
    setVisibleModelCategories(new Set(CATEGORY_ORDER));
    setManualModelId('');
    setManualModelName('');
    setManualCategory('text');
    setVideoCapabilityModelId(null);
    setProtocolModelId(null);
    setProtocolValid(true);
    setProtocolImportOpen(false);
    setProtocolImportSnapshot(null);
    setCategoryEditModelId(null);
  };

  /**
   * 探测补出的接口地址与用户填的不一致时回写输入框，返回更正后的地址。
   * 输入框为空说明走的是厂商默认地址，没什么可更正的，也不该把默认值钉进配置。
   */
  const adoptResolvedBaseUrl = (resolved: string | undefined): string | undefined => {
    const current = normalizeBaseUrl(baseUrl, chatApiProtocol);
    if (!resolved || !current || resolved === current) return undefined;
    setBaseUrl(resolved);
    return resolved;
  };

  const handleFetchModels = async () => {
    if (!definition || missingCredentials) return;
    if (workflowOnlyConnection) { setCatalogStatus('warning'); setCatalogMessage('当前只配置工作流连接，可直接保存；获取模型目录需要模型 API Key'); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCatalogStatus('loading');
    setCatalogMessage('');
    try {
      if (definition.id === 'runninghub-model') {
        const result = await testProviderConnection('runninghub-model', apiKey.trim());
        if (!result.success) throw new Error(result.error || t('RunningHub API Key 验证失败'));
      }
      const result = await fetchProviderModelCatalog({
        providerId: definition.id,
        /* ★ 权益按**连接**缓存 ⇒ 键必须是连接 key（自定义连接是 `custom-<uuid8>`），
           不能拿 `definition.id` 顶替 —— 两条自定义连接会互相覆盖。 */
        connectionId: resolveNextConnectionId(definition.id),
        config: {
          name: connectionName.trim() || definition.name,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim() || undefined,
          catalogId: definition.id,
          chatApiProtocol,
        },
        fallbackModels: fallbackModels[definition.id] || [],
        signal: controller.signal,
      });
      /* ★★ 成功拉到目录 ⇒ **以本次目录为准**（`mergeModels` 是**并集**，并集会让
         「平台已经下架 / 平台从来没有」的模型永远留在列表里 —— 用户 2026：
         「我都重启了 为什么还能拉到」）。
         只保留**用户手工加过或改过分类**的条目（`categoryManual`，见 `addManualModel` /
         `updateModelCategory`），目录来的旧条目一律由本次结果替换。 */
      setModels((current) => mergeModels(
        current.filter((model) => model.categoryManual === true),
        result.models,
      ));
      setCatalogStatus(result.warning ? 'warning' : 'ready');
      const corrected = adoptResolvedBaseUrl(result.resolvedBaseUrl);
      /* ★ 分组权益（**MTV 增强**）：本次拉取顺带解析出的上游分组与倍率。
         拿不到就是空串 —— **不提示、不阻断**（`providerEntitlements.ts` 文件头）。 */
      const entitlement = result.entitlements?.inferredGroup;
      const entitlementSuffix = entitlement
        ? t('；识别到分组 {group}{ratio}', {
          group: entitlement.label || entitlement.group,
          ratio: entitlement.ratio !== null ? `（${entitlement.ratio}x）` : '',
        })
        : '';
      /* ★ 剔掉的「平台公开价目表里没有」的模型数 —— **不许静默**（用户 2026：土豆都没有，你拉了干啥？）。
         ⚠️ 判据是**在不在价目表里**，不是价格：
            `gpt-image-2.5-sunburst-async` 的 `model_price` 是 0，但它的真实价格在
            `/api/pricing` 顶层的 `model_pricing_variants`（quality×resolution 共 15 档，$0.04–$0.18）
            ⇒ 「model_price 0」**不等于**未定价（我上一版这么读是错的，这里不再那么写）。 */
      const droppedSuffix = result.droppedUnlisted
        ? t('；已过滤 {count} 个平台公开价目表里没有的模型', { count: result.droppedUnlisted })
        : '';
      setCatalogMessage(
        result.warning
        || (corrected
          ? t('已获取 {count} 个模型，接口地址已更正为 {url}', {
            count: result.models.length,
            url: corrected,
          })
          : t('已获取 {count} 个模型', { count: result.models.length })) + entitlementSuffix + droppedSuffix,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setCatalogStatus('error');
      setCatalogMessage(error instanceof Error ? error.message : t('模型列表拉取失败'));
    }
  };

  const handleAssistantAdd = async () => {
    const store = useAppStore.getState();
    store.openChatWithDraft(
      buildRelayAssistantPrompt(
        connectionName.trim(),
        normalizeBaseUrl(baseUrl, chatApiProtocol),
        chatApiProtocol,
      ),
    );
  };

  const handleTestConnection = async () => {
    if (!definition || missingCredentials) return;
    setCatalogStatus('loading');
    setCatalogMessage(t('正在验证 {name} 连接...', { name: definition.name }));
    if (definition.id === 'runninghub-model') {
      const checks: string[] = [];
      let passed = true;
      for (const [id, key, label] of [['runninghub-model', apiKey.trim(), '模型'], ['runninghub', workflowApiKey.trim(), '工作流']] as const) {
        if (!key) continue;
        const result = await testProviderConnection(id, key, baseUrl.trim() || undefined);
        checks.push(`${label}连接：${result.success ? `验证成功${result.balance ? `（${result.balance}）` : ''}` : result.error || '验证失败'}`);
        passed &&= result.success;
      }
      setCatalogStatus(passed ? 'ready' : 'error'); setCatalogMessage(checks.join('；')); return;
    }
    const result = await testProviderConnection(
      definition.id,
      apiKey.trim(),
      baseUrl.trim() || undefined,
      chatApiProtocol,
    );
    if (result.success) {
      const corrected = adoptResolvedBaseUrl(result.baseUrl);
      setCatalogStatus('ready');
      setCatalogMessage([
        t('{name} 连接验证成功', { name: definition.name }),
        result.balance,
        corrected && t('接口地址已更正为 {url}', { url: corrected }),
      ].filter(Boolean).join('，'));
      return;
    }
    setCatalogStatus(result.unsupported ? 'warning' : 'error');
    setCatalogMessage((result.error && (isWorkflowApi ? t(result.error) : result.error)) || t('{name} 连接验证失败', { name: definition.name }));
  };

  const closeProtocolEditor = () => {
    setProtocolModelId(null);
    setProtocolValid(true);
  };

  const toggleModel = (modelId: string) => {
    if (selectedIds.has(modelId) && protocolModelId === modelId) closeProtocolEditor();
    if (selectedIds.has(modelId) && videoCapabilityModelId === modelId) {
      setVideoCapabilityModelId(null);
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const toggleVisibleModels = () => {
    const allVisibleSelected = filteredModels.length > 0
      && filteredModels.every((model) => selectedIds.has(model.id));
    if (
      allVisibleSelected
      && protocolModelId
      && filteredModels.some((model) => model.id === protocolModelId)
    ) {
      closeProtocolEditor();
    }
    if (
      allVisibleSelected
      && videoCapabilityModelId
      && filteredModels.some((model) => model.id === videoCapabilityModelId)
    ) {
      setVideoCapabilityModelId(null);
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const model of filteredModels) {
        if (allVisibleSelected) next.delete(model.id);
        else next.add(model.id);
      }
      return next;
    });
  };

  const toggleVisibleCategory = (nextCategory: GeneralModelCategory) => {
    setVisibleModelCategories((current) => {
      const next = new Set(current);
      if (next.has(nextCategory)) next.delete(nextCategory);
      else next.add(nextCategory);
      return next;
    });
  };

  const toggleAllVisibleCategories = () => {
    setVisibleModelCategories((current) =>
      current.size === CATEGORY_ORDER.length ? new Set() : new Set(CATEGORY_ORDER),
    );
  };

  const addManualModel = () => {
    const id = manualModelId.trim();
    if (!id || !definition) return;
    const model: ProviderModelSelection = {
      id,
      name: manualModelName.trim() || id,
      category: manualCategory,
      provider: connectionId || definition.id,
      categoryManual: true,
    };
    setModels((current) => mergeModels(current, [model]));
    setSelectedIds((current) => new Set(current).add(id));
    setManualModelId('');
    setManualModelName('');
  };

  const updateModelCategory = (modelId: string, nextCategory: GeneralModelCategory) => {
    setModels((current) => current.map((model) =>
      model.id === modelId ? {
        ...model,
        category: nextCategory,
        categoryManual: true,
        ...(nextCategory === 'video' ? {} : { videoCapability: undefined }),
      } : model,
    ));
    if (nextCategory !== 'video' && videoCapabilityModelId === modelId) {
      setVideoCapabilityModelId(null);
    }
    setVisibleModelCategories((current) => new Set(current).add(nextCategory));
    setCategoryEditModelId(null);
  };

  /** 0 / 空 表示不声明，交回给按模型 ID 猜目录的兜底逻辑。 */
  const updateModelContextWindow = (modelId: string, raw: string) => {
    const parsed = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
    const contextWindow = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    setModels((current) => current.map((model) => (
      model.id === modelId ? { ...model, contextWindow } : model
    )));
  };

  const updateModelDescription = (modelId: string, description: string) => {
    setModels((current) => current.map((model) => (
      model.id === modelId
        ? { ...model, description: description.slice(0, 500), descriptionManual: true }
        : model
    )));
  };

  const updateModelVisionCapability = (modelId: string, enabled: boolean) => {
    setModels((current) => current.map((model) => model.id === modelId
      ? {
          ...model,
          inputModalities: enabled ? ['text', 'image'] : ['text'],
          inputModalitiesManual: true,
        }
      : model));
  };

  const updateModelProtocol = (
    modelId: string,
    executionProfile: ProviderModelSelection['executionProfile'],
  ) => {
    setModels((current) => current.map((model) =>
      model.id === modelId ? { ...model, executionProfile } : model,
    ));
  };

  const updateVideoCapability = (
    modelId: string,
    videoCapability: VideoModelCapability | undefined,
  ) => {
    setModels((current) => current.map((model) => (
      model.id === modelId ? { ...model, videoCapability } : model
    )));
  };

  const updateImageReferenceRequestMode = (
    modelId: string,
    imageReferenceRequestMode: ImageReferenceRequestMode,
  ) => {
    setModels((current) => current.map((model) =>
      model.id === modelId ? { ...model, imageReferenceRequestMode } : model,
    ));
  };

  const applyProtocolImport = (result: ModelProtocolImportResult) => {
    if (
      definition?.id !== 'custom-openai'
      || !result.baseUrl
      || !result.modelId
      || !result.category
      || !result.protocol
    ) return;
    setProtocolImportSnapshot({
      baseUrl,
      models: structuredClone(models),
      selectedIds: new Set(selectedIds),
      visibleModelCategories: new Set(visibleModelCategories),
      category,
      protocolModelId,
      protocolValid,
      catalogStatus,
      catalogMessage,
    });
    const modelId = result.modelId;
    const importedModel: ProviderModelSelection = {
      id: modelId,
      name: models.find((model) => model.id === modelId)?.name || modelId,
      category: result.category,
      provider: connectionId || definition.id,
      executionProfile: { preset: 'custom', protocol: result.protocol },
      imageReferenceRequestMode: result.imageReferenceRequestMode,
      categoryManual: true,
    };
    setBaseUrl(result.baseUrl);
    setModels((current) => {
      const existing = current.find((model) => model.id === modelId);
      if (!existing) return [...current, importedModel];
      return current.map((model) => model.id === modelId
        ? { ...model, category: importedModel.category, executionProfile: importedModel.executionProfile,
            imageReferenceRequestMode: importedModel.imageReferenceRequestMode, categoryManual: true }
        : model);
    });
    setSelectedIds((current) => new Set(current).add(modelId));
    setVisibleModelCategories((current) => new Set(current).add(importedModel.category));
    setCategory('all');
    setProtocolModelId(modelId);
    setProtocolValid(true);
    setCatalogStatus('ready');
    setCatalogMessage(t('已从接口文档导入模型 {id}，保存前可继续检查调用协议', { id: modelId }));
    setProtocolImportOpen(false);
  };

  const undoProtocolImport = () => {
    if (!protocolImportSnapshot) return;
    setBaseUrl(protocolImportSnapshot.baseUrl);
    setModels(protocolImportSnapshot.models);
    setSelectedIds(protocolImportSnapshot.selectedIds);
    setVisibleModelCategories(protocolImportSnapshot.visibleModelCategories);
    setCategory(protocolImportSnapshot.category);
    setProtocolModelId(protocolImportSnapshot.protocolModelId);
    setProtocolValid(protocolImportSnapshot.protocolValid);
    setCatalogStatus(protocolImportSnapshot.catalogStatus);
    setCatalogMessage(protocolImportSnapshot.catalogMessage);
    setProtocolImportSnapshot(null);
    setProtocolImportOpen(false);
  };

  const closeDialog = () => {
    setProtocolImportOpen(false);
    setProtocolImportSnapshot(null);
    onClose();
  };

  const returnToDefinitionPicker = () => {
    setProtocolImportOpen(false);
    setProtocolImportSnapshot(null);
    setDefinitionId('');
  };

  const handleSave = async () => {
    if (
      !definition
      || missingCredentials
      || (!isWebSearchProvider && !isWorkflowApi && !workflowOnlyConnection && selectedModels.length === 0)
      || !protocolValid
    ) return;
    try {
      if (isWorkflowApi) {
        if (!baseUrl.trim() || !workflowValid || !workflowDrafts.length) throw new Error(t('请完成工作流配置'));
        normalizeWorkflowApiBaseUrl(baseUrl, true);
        workflowDrafts.forEach((draft) => validateDeclarativeWorkflowManifest(draft.manifest));
        if (!apiKey.trim() && workflowDrafts.some((draft) => draft.manifest.protocol.auth?.type !== 'none')) throw new Error(t('请填写工作流 API Token'));
      }
      assertProviderModelsVideoCapabilities(selectedModels);
    } catch (error) {
      setCatalogStatus('error');
      setCatalogMessage(error instanceof Error ? error.message : t('视频能力配置无效'));
      return;
    }
    const nextConnectionId = isWebSearchProvider
      ? definition.id
      : resolveNextConnectionId(definition.id);
    const modelConfig = isWebSearchProvider || isWorkflowApi
      ? {}
      : {
          selectedModels: selectedModels.map((model) => ({ ...model, provider: nextConnectionId })),
          catalogModels: capCatalogModels(models, selectedIds)
            .map((model) => ({ ...model, provider: nextConnectionId })),
          visibleModelCategories: CATEGORY_ORDER.filter((item) => visibleModelCategories.has(item)),
          catalogUpdatedAt: Date.now(),
          /* ★ 连接级「参考图调用语义」：本连接所有图片模型没单独配时用它 */
          ...(imageReferenceRequestMode ? { imageReferenceRequestMode } : {}),
          /* ★ 连接级「计费 / 积分」：不过滤空对象，用户就是要把开关关掉也要存下来 */
          ...(billing ? { billing } : {}),
        };
    try { await onSave(
      nextConnectionId,
      {
        name: connectionName.trim() || definition.name,
        apiKey: definition.authType === 'oauth' ? '' : apiKey.trim(),
        baseUrl: isWorkflowApi ? normalizeWorkflowApiBaseUrl(baseUrl, true) : normalizeBaseUrl(baseUrl, chatApiProtocol) || undefined,
        catalogId: definition.id,
        ...(definition.id === 'custom-openai' ? { chatApiProtocol } : {}),
        ...modelConfig,
      },
      definition.id === 'runninghub-model'
        ? { runninghubWorkflowApiKey: workflowApiKey.trim() }
        : isWorkflowApi ? { workflowApiDrafts: workflowDrafts } : undefined,
    );
    } catch (error) { setCatalogStatus('error'); setCatalogMessage(error instanceof Error ? error.message : t('保存失败')); }
  };

  return createPortal(
    <ModalOverlay
      isOpen={isOpen}
      onClose={closeDialog}
      ariaLabel={editing ? t('编辑 API 厂商') : t('添加 API 厂商')}
      className="o-dialog o-dialog--lg"
      closeOnBackdrop={false}
    >
      {/* 官方 `Vd`：右上角一颗 24×24 的关闭键（`absolute right-4 top-4`、
          `lucide-x size-4 text-[#CCCCCC]`、`hover:bg-input/80`），头部 `Ly` + 标题 `rg` */}
      <button
        type="button"
        aria-label={t('关闭')}
        data-testid="provider-dialog-close-btn"
        className="o-dialog__close"
        onClick={closeDialog}
      >
        <Icon icon="lucide:x" width={16} height={16} />
      </button>

      <header className="o-dialog__header">
        <h3 className="o-dialog__title">
          {isWebSearchProvider ? t('联网搜索') : definition ? isWorkflowApi ? t(definition.name) : definition.name : t('选择 API 厂商')}
        </h3>
        <p className="o-dialog__desc">
          {editing ? t('编辑连接') : t('新建连接')}
          {' · '}
          {definition
            ? (isWorkflowApi ? t(definition.description) : definition.description)
            : t('从下面的厂商里挑一个开始配置。')}
        </p>
      </header>

      {!definition ? (
        <div className="o-dialog__body">
          <div className="o-picker">
            {availableDefinitions.map((item) => (
              <button
                key={item.id}
                type="button"
                className="o-picker__item"
                onClick={() => chooseDefinition(item)}
              >
                <span className="o-picker__badge">{item.badgeText}</span>
                <span className="o-picker__copy">
                  <strong>{item.kind === 'web-search' ? t('联网搜索') : item.kind === 'workflow-api' ? t(item.name) : item.name}</strong>
                  <small>{item.kind === 'web-search' ? t('Tavily、博查、智谱与 Exa') : item.kind === 'workflow-api' ? t(item.description) : item.description}</small>
                </span>
                <Icon icon="lucide:chevron-right" width={18} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="o-dialog__body flex flex-col gap-6" data-overlay-scrollbar="off">
            <ProviderConnectionForm
              editing={editing}
              definition={definition}
              isWebSearchProvider={isWebSearchProvider}
              connectionName={connectionName}
              setConnectionName={setConnectionName}
              chatApiProtocol={chatApiProtocol}
              setChatApiProtocol={setChatApiProtocol}
              apiKey={apiKey}
              setApiKey={setApiKey}
              baseUrl={baseUrl}
              setBaseUrl={setBaseUrl}
              workflowApiKey={workflowApiKey}
              setWorkflowApiKey={setWorkflowApiKey}
              dreaminaLoggedIn={dreaminaLoggedIn}
              dreaminaLoading={dreaminaLoading}
              onDreaminaLogin={onDreaminaLogin}
              duplicateConnectionName={duplicateConnectionName}
              catalogStatus={catalogStatus}
              catalogMessage={catalogMessage}
              missingCredentials={missingCredentials}
              onReturnToPicker={returnToDefinitionPicker}
              onTestConnection={handleTestConnection}
            />

            {isWebSearchProvider && (
              <ProviderWebSearchPicker
                definitions={webSearchDefinitions}
                providerConfigs={providerConfigs}
                currentDefinition={definition}
                onChoose={chooseDefinition}
              />
            )}

            {isWorkflowApi && <ProviderWorkflowSection drafts={workflowDrafts} onChange={setWorkflowDrafts} onValidityChange={setWorkflowValid} />}
            {!isWebSearchProvider && !isWorkflowApi && (
              <>
              <ProviderModelSection
                definition={definition}
                models={models}
                filteredModels={filteredModels}
                selectedModels={selectedModels}
                selectedIds={selectedIds}
                query={query}
                setQuery={setQuery}
                category={category}
                setCategory={setCategory}
                visibleModelCategories={visibleModelCategories}
                catalogStatus={catalogStatus}
                catalogMessage={catalogMessage}
                missingCredentials={missingCredentials}
                apiKey={apiKey}
                baseUrl={baseUrl}
                setProtocolValid={setProtocolValid}
                protocolImportOpen={protocolImportOpen}
                setProtocolImportOpen={setProtocolImportOpen}
                protocolImportSnapshot={protocolImportSnapshot}
                protocolModel={protocolModel}
                videoCapabilityModel={videoCapabilityModel}
                setProtocolModelId={setProtocolModelId}
                setVideoCapabilityModelId={setVideoCapabilityModelId}
                categoryEditModelId={categoryEditModelId}
                setCategoryEditModelId={setCategoryEditModelId}
                manualModelId={manualModelId}
                setManualModelId={setManualModelId}
                manualModelName={manualModelName}
                setManualModelName={setManualModelName}
                manualCategory={manualCategory}
                setManualCategory={setManualCategory}
                onToggleModel={toggleModel}
                onToggleVisibleModels={toggleVisibleModels}
                onToggleVisibleCategory={toggleVisibleCategory}
                onToggleAllVisibleCategories={toggleAllVisibleCategories}
                onAddManualModel={addManualModel}
                onUpdateModelCategory={updateModelCategory}
                onUpdateModelContextWindow={updateModelContextWindow}
                onUpdateModelDescription={updateModelDescription}
                onUpdateModelVisionCapability={updateModelVisionCapability}
                onUpdateModelProtocol={updateModelProtocol}
                onUpdateVideoCapability={updateVideoCapability}
                onUpdateImageReferenceRequestMode={updateImageReferenceRequestMode}
                imageReferenceRequestMode={imageReferenceRequestMode}
                onImageReferenceRequestModeChange={setImageReferenceRequestMode}
                onCloseProtocolEditor={closeProtocolEditor}
                onApplyProtocolImport={applyProtocolImport}
                onUndoProtocolImport={undoProtocolImport}
                onFetchModels={handleFetchModels}
              />
              {/* ★ 连接级「计费与积分」：取价方式 / 积分换算 / 逐模型手动价（用户 2026 点名要的
                  「方便我加入其他厂商时手动设置」）。放在模型清单之后，因为它按模型生效。 */}
              <ProviderBillingSection
                billing={billing}
                onChange={setBilling}
                baseUrl={baseUrl}
                models={selectedModels.map((model) => ({
                  id: model.id,
                  name: model.name,
                  category: model.category,
                }))}
              />
              </>
            )}
          </div>

          <footer className="o-dialog__footer">
            <span className="o-muted mr-auto">
              {isWebSearchProvider
                ? t('当前使用 {name}', { name: definition.name })
                : isWorkflowApi ? t('将配置 {count} 个工作流', { count: workflowDrafts.length }) : selectedModels.length > 0
                  ? t('将启用 {count} 个模型', { count: selectedModels.length })
                  : t('至少选择一个模型')}
            </span>
            {definition?.id === 'custom-openai' && (
              <OfficialButton
                type="button"
                variant="ghost"
                size="sm"
                className="o-icon-btn"
                onClick={() => void handleAssistantAdd()}
              >
                <Icon icon="lucide:message-square-plus" width={16} />
                {t('调用助手添加')}
              </OfficialButton>
            )}
            <OfficialButton type="button" variant="outline" size="md" onClick={closeDialog}>
              {t('取消')}
            </OfficialButton>
            <OfficialButton
              type="button"
              variant="default"
              size="md"
              disabled={
                missingCredentials
                || (isWorkflowApi && !workflowValid)
                || (!isWebSearchProvider && !isWorkflowApi && !workflowOnlyConnection && selectedModels.length === 0)
                || !protocolValid
              }
              onClick={() => void handleSave()}
            >
              {editing ? t('保存更改') : t('添加厂商')}
            </OfficialButton>
          </footer>
        </>
      )}
    </ModalOverlay>,
    document.body,
  );
}
