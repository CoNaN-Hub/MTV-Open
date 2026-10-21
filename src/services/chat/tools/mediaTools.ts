/**
 * 注册图片、视频和音频生成工具；媒体调用沿用项目默认值、统一运行时和固定 Policy 边界。
 */
import { useAppStore } from '../../../store/useAppStore';
import { comfyBaseUrlFor } from '../../comfyServers';
import { isRunningHubWorkflow, isCloudWorkflow, mediaProviderConfigId, workflowExecution } from '../../workflowExecutionService';
import { AUTODL_H3_WORKFLOW, validateWorkflowApiManifest, resolveWorkflowApiInputValues } from '../../workflowApi/autodlWorkflowManifest';
import { completeWorkflowApiNodeTask, workflowApiConnection } from '../../workflowApi/workflowApiAdapter';
import { getRunningHubModel, parseRunningHubModelParameter } from '../../ai/providers/runninghubModelManifest';
import { runningHubParameterKey } from '../../runninghubWorkflowService';
import { completeRunningHubNodeTask } from '../../ai/providers/runninghubWorkflow';
import type {
  AudioGenerationPurpose,
  MediaDeliveryMode,
  MediaGenerationIntent,
  MediaKind,
} from '../../../types/media';
import {
  findMediaModelOption,
  getMediaModelOptions,
} from '../../../components/nodes/shared/defaultModels';
import {
  extractModelMention,
  MEDIA_PERSIST_FAILED_MESSAGE,
  runMediaGeneration,
} from '../../ai/generationRuntime';
import type { AgentToolDisplaySnapshot } from '../../../types/agent';
import {
  registerAgentTool,
  type AgentToolExecutionResult,
  type AgentToolSubStepHandle,
} from '../toolRegistry';
import { resolveDefaultMediaModelRef, resolveDefaultMediaRequestParams } from '../mediaInputResolution';
import {
  MEDIA_PLACEHOLDER_STALE_ERROR,
} from '../mediaPlaceholderLifecycle';

interface GenerateMediaInput {
  kind: MediaKind;
  prompt: string;
  /** 画布卡片的短标题（官方那张=「可爱的小猫」）；缺省回落到「对话生成图片」等固定文案。 */
  title?: string;
  modelRef?: string;
  deliveryMode: MediaDeliveryMode;
  audioPurpose?: AudioGenerationPurpose;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  /**
   * ★ 2026-10-15：**图片清晰度档位**（`1K`/`2K`/`4K`）。
   *
   * 来源 = 确认卡第三颗胶囊（官方 `imageSize` chip）。官方那张卡上它是可选项
   * （`live-assets-new/vendor-pkg-canvas-CvbAwZyy.js` 的 `xie` chip 行，模型 options 见
   * `vendor-packages-DRvCmDjR.js` @1095139 `rq.options.imageSizeOptions:["1K","2K","4K"]`），
   * 服务端把它当请求参数下发。MTV 此前**没有这个入参**（`generationRuntime` 的注释写着
   * 「MediaGenerationIntent 没有 imageSize 字段」）⇒ 用户选了也发不出去。
   */
  imageSize?: string;
  /**
   * ★ 2026-10-15：**张数**（`1/2/4`，官方 `p8e=[1,2,4]` @1327920）。
   * 目前只有**图片**受理；落到节点 `batchCount`（见 `MediaGenerationIntent.times`）。
   */
  times?: number;
  modelParameters?: Array<{ name: string; value: string }>;
  workflowInputs?: Array<{ nodeId: string; fieldName: string; value: string }>;
}

const MEDIA_PROMPT_DISPLAY_LIMIT = 1_000;

function resolveMediaToolInput(
  input: GenerateMediaInput,
  context: { projectId: string; mode: string; taskId?: string },
): GenerateMediaInput {
  const store = useAppStore.getState();
  const projectSettings = store.projects.find(
    (project) => project.id === context.projectId,
  )?.settings;
  const defaultModel = projectSettings?.defaultModels?.[input.kind];
  /* ⚠️ **第 86 轮修的真缺口：用户本轮显式写的 `@model{…}` 必须优先于项目默认模型。**
     旧代码在这里只写 `resolveDefaultMediaModelRef(projectSettings, kind, input.modelRef)`
     ⇒ 项目**已经设了该类型默认模型**时，项目默认值先被填进 `input.modelRef`，而
     `authorize`（同文件）随后拿它跟 `extractModelMention(task.goal)` 比对 ⇒ 提及 ≠ 项目默认
     ⇒ **整次调用被拒、连生成确认卡都不出**。用户明确要求「用户显式意图优先」。
     `@model` 是 **MTV 自有语法**（官方产物 `indexOf('@model') === -1`，官方无对应物）
     ⇒ 本条**没有官方可抄**，判据就是用户显式意图。

     落在**解析器**而不是 `authorize` 的理由（先读了各自职责与调用顺序）：
       · 调用顺序（`toolRegistry.prepareAgentToolCall:240-257`）= `resolveInput` → schema 校验 → Policy
         → `authorize`（`policyEngine.ts:97`）。`authorize` 拿到的是**已经解析过**的输入，
         它**看不到**「这个 modelRef 是用户显式给的还是解析器补的」⇒ 想在 `authorize` 里认提及，
         只能放宽比对（例如「不相等也放行」），那会**同时**放掉
         「提及 X + 显式 modelRef: Y」这条该拒的冲突（本文件下面那个 `authorize` 分支）。
       · `resolveInput` 的契约（`toolRegistry.ts:111`「在策略与审批前把项目默认值解析进输入」）
         正是「本轮到底用哪个模型」的**唯一决议点**，审批卡与执行期都读它的输出
         （卡上 `model_name` 走 `agentRoundExecutor.buildMediaGenerationRequestSnapshot` → 同一个
         `resolveDefaultMediaModelRef`）⇒ 在这里定优先级，「卡上写的」与「实际发的」恒等。
       · 同类工具已有同一口径的既有实现：`tools/shotlistTools.ts:156`
         `input.modelRef || mentioned || 项目默认图片模型`。

     优先级 = **显式 `modelRef` > 用户提及 > 按提示词自动路由 > 项目默认模型**：
     显式 `modelRef` 仍在最前 ⇒「提及 X + 显式 modelRef: Y」照旧被 `authorize` 拒绝（语义不变）；
     提及缺席时（`extractModelMention` 返回空）**逐字退回旧表达式** ⇒ 项目默认模型照常生效。 */
  const mentionedModelRef = extractModelMention(
    store.agentTasks.find((task) => task.id === context.taskId)?.goal ?? '',
  );
  let modelRef = resolveDefaultMediaModelRef(
    projectSettings,
    input.kind,
    input.modelRef || mentionedModelRef,
  );
  /* ⚠️ 自动路由**不得覆盖用户提及**：提及已经在 `modelRef` 里，再按提示词相关度重排
     就会把用户明确指定的模型换掉（同一优先级错误，只是发生得更晚）。
     无提及时这一行与旧代码**逐字等价**（`!input.modelRef && …` 之外只多了 `!mentionedModelRef`）。 */
  if (!input.modelRef && !mentionedModelRef && context.mode === 'autonomous' && projectSettings?.modelAutoRouting) {
    const terms = input.prompt.toLowerCase().split(/[\s,，。;；、/]+/).filter((term) => term.length >= 2);
    const options = getMediaModelOptions(
      store.config.generalModels ?? [],
      store.config,
      store.workflows,
    ).filter((option) => option.mediaKind === input.kind);
    const ranked = options.map((option) => {
      const description = `${option.label} ${option.description ?? ''}`.toLowerCase();
      const relevance = terms.reduce((score, term) => score + (description.includes(term) ? 1 : 0), 0);
      return { option, score: relevance + (option.value === defaultModel ? 0.25 : 0) };
    }).sort((a, b) => b.score - a.score);
    modelRef = ranked[0]?.option.value ?? modelRef;
  }
  const resolved: GenerateMediaInput = {
    ...input,
    ...(modelRef ? { modelRef } : {}),
  };
  if (input.kind !== 'video') return resolved;
  const selectedModel = modelRef
    ? findMediaModelOption(
      modelRef,
      store.config.generalModels ?? [],
      store.config,
      store.workflows,
    )
    : undefined;
  // 自定义 API 的缺省值由该模型 capability / 上游接口决定，不能套用项目里为内置模型
  // 保存的 16:9、1080p、10 秒等偏好。用户本轮显式传入的值已经保留在 resolved 中。
  if (selectedModel?.provider === 'general' && !selectedModel.workflowId) return resolved;
  if (selectedModel && ['runninghubwf', 'runninghub', 'workflow-api'].includes(selectedModel.provider)) return resolved;
  /* ⚠️ **必须「没值就不写这个键」**，不能写成 `aspectRatio: … ?? undefined`：
     `validateAgentToolInput` 用 `key in value` 判键是否存在（`agentToolSchemas.ts:61`），
     键存在而值为 `undefined` 一样会进 `type: 'string' | 'integer'` 分支 ⇒ 报
     `工具有效参数无效: $.aspectRatio 必须是字符串；$.resolution 必须是字符串；$.duration 必须是有限数字`。
     真机现场：项目**没有** `settings.generation`（没设视频默认参数）、模型又走「套项目默认」这条
     ⇒ 准备期必然失败、连审批卡都出不来。空串 / 非有限数字同属「无值」，同样不写。
     （通用校验器 `key in value` 的语义**不动**：那是全工具共用契约。） */
  const aspectRatio = input.aspectRatio ?? projectSettings?.generation?.videoAspectRatio;
  const resolution = input.resolution ?? projectSettings?.generation?.videoResolution;
  const duration = input.duration ?? projectSettings?.generation?.videoDuration;
  return {
    ...resolved,
    ...(typeof aspectRatio === 'string' && aspectRatio.length > 0 ? { aspectRatio } : {}),
    ...(typeof resolution === 'string' && resolution.length > 0 ? { resolution } : {}),
    ...(typeof duration === 'number' && Number.isFinite(duration) ? { duration } : {}),
  };
}

function nodeMediaKind(nodeId: string): MediaKind | undefined {
  const node = useAppStore.getState().nodes.find((item) => item.id === nodeId);
  if (!node) return undefined;
  if (node.data.imageUrl || node.type === 'source-image' || node.type === 'ai-image') return 'image';
  if (node.data.videoUrl || node.type === 'source-video' || node.type === 'ai-video') return 'video';
  if (node.data.audioUrl || node.type === 'source-audio' || node.type === 'ai-audio') return 'audio';
  return undefined;
}

function buildMediaInputDisplay(input: GenerateMediaInput): AgentToolDisplaySnapshot {
  const nodeReferences = [...input.prompt.matchAll(/@\{([^:}]+):([^}]+)\}/g)]
    .map((match) => {
      const nodeId = match[1].split('/cell/')[0];
      const node = useAppStore.getState().nodes.find((item) => item.id === nodeId);
      return {
        kind: 'node' as const,
        id: nodeId,
        label: node?.data.label || match[2],
        mediaKind: nodeMediaKind(nodeId),
      };
    });
  const assetReferences = [...input.prompt.matchAll(/@asset\{[^}]+\}/g)]
    .map((_, index) => ({
      kind: 'asset' as const,
      id: `asset-${index + 1}`,
      label: `用户素材 ${index + 1}`,
      mediaKind: 'image' as const,
    }));
  const fields: NonNullable<AgentToolDisplaySnapshot['fields']> = [
    {
      label: '媒体类型',
      value: input.kind === 'image' ? '图片' : input.kind === 'video' ? '视频' : '音频',
    },
    { label: '模型', value: input.modelRef || '确认时选择' },
    {
      label: '输出位置',
      value: input.deliveryMode === 'chat'
        ? '对话'
        : input.deliveryMode === 'canvas'
          ? '画布'
          : '对话和画布',
    },
    { label: '提示词', value: input.prompt.trim().slice(0, MEDIA_PROMPT_DISPLAY_LIMIT) },
  ];
  /**
   * **用户 2026-10-15 裁决（round 122 追加）**：这里原来对视频**无条件**补三行
   * `画面比例 / 分辨率 / 时长 = '模型默认'`（`source: 'model_default'`）。
   *
   * `'模型默认'` 是 **MTV 自造**：r121 已逐条核对官方产物（`Eoe` 的比例/清晰度/时长/音频四组）
   * **查无此项**，`'模型默认'` 与 `model_default` 在 r100 三个 vendor 产物里 **0 命中**
   * （见 §121 与 `VideoParamSelector.tsx` 里同一结论的注释）。官方没有「模型默认」这一态，
   * 更没有「值缺失时印两个字占位」的做法 ⇒ 按「官方没有的 MTV 移除」处理：
   * **有值才出这一行，没值就不出**（与 `mediaInputResolution` 的「无来源 ⇒ 不写字段」同一条纪律）。
   *
   * 图片比例也是真实入参（见同文件 `description` 与 `authorize` 的两道门）⇒ 一并显示，
   * 保证「工具收到的参数」在面板上可见（是工具面板，不是官方卡；不放任何占位文案）。
   */
  if (input.aspectRatio !== undefined) {
    fields.push({ label: '画面比例', value: input.aspectRatio, source: 'resolved' });
  }
  if (input.kind === 'video' && input.resolution !== undefined) {
    fields.push({ label: '分辨率', value: input.resolution, source: 'resolved' });
  }
  if (input.kind === 'video' && input.duration !== undefined) {
    fields.push({ label: '时长', value: `${input.duration} 秒`, source: 'resolved' });
  }
  return {
    fields,
    references: [...nodeReferences, ...assetReferences],
  };
}

function getAssistantMessageId(taskId: string): string | undefined {
  return useAppStore.getState().messages.find(
    (message) => message.agentTaskId === taskId && message.role === 'assistant',
  )?.id;
}

export function registerMediaAgentTools(): Array<() => void> {
  return [
    registerAgentTool<{ modelRef: string }>({
      id: 'media_model_parameters', title: '读取模型专属参数', effect: 'read',
      description: '读取当前可选 RunningHub 标准模型的操作、输入媒体、必填字段、默认值和限制。通过 media_generate.modelParameters 提交专属参数；首尾帧、编辑或动作控制需选择对应操作。',
      inputSchema: { type: 'object', required: ['modelRef'], additionalProperties: false, properties: { modelRef: { type: 'string', minLength: 1, maxLength: 240 } } },
      authorize: (context) => ({ allowed: context.projectId === useAppStore.getState().currentProjectId, reason: '只能读取当前项目可用的模型' }),
      execute: async (_context, input) => {
        const store = useAppStore.getState();
        const option = findMediaModelOption(input.modelRef, store.config.generalModels ?? [], store.config, store.workflows);
        const model = option?.provider === 'runninghub' ? getRunningHubModel(input.modelRef, true) : undefined;
        if (!model) return { status: 'error', summary: '未找到可用的 RunningHub 标准模型', modelContent: '先在模型管理中启用所需操作', errorCode: 'RUNNINGHUB_MODEL_NOT_FOUND' };
        return { status: 'success', summary: `已读取 ${model.label} 参数`, modelContent: JSON.stringify(model) };
      },
    }),
    registerAgentTool<{ modelRef: string }>({
      id: 'media_workflow_parameters', title: '读取云工作流参数', effect: 'read',
      description: '读取已保存云工作流的输出类型、参数名称、默认值与素材映射，供 media_generate 使用。',
      inputSchema: { type: 'object', required: ['modelRef'], additionalProperties: false, properties: { modelRef: { type: 'string', minLength: 1, maxLength: 240 } } },
      authorize: (context) => ({ allowed: context.projectId === useAppStore.getState().currentProjectId, reason: '只能读取当前项目可用的工作流' }),
      execute: async (_context, input) => {
        const store = useAppStore.getState();
        const option = findMediaModelOption(input.modelRef, store.config.generalModels ?? [], store.config, store.workflows);
        const workflow = store.workflows.find((item) => item.id === option?.workflowId);
        if (workflow?.adapterType === 'workflow-api') {
          validateWorkflowApiManifest(workflow.workflowApi);
          if (workflow.workflowApi.version === 2) return { status: 'success', summary: `已读取 ${workflow.name} 的参数`, modelContent: JSON.stringify({
            workflowId: workflow.id, outputType: workflow.workflowApi.outputKind, references: workflow.workflowApi.references,
            prompt: workflow.workflowApi.prompt, parameters: Object.entries(workflow.workflowApi.parameters).map(([name, spec]) => ({
              nodeId: 'workflow', fieldName: name, type: spec.type, required: spec.required ?? false, defaultValue: spec.default,
              label: spec.label, min: spec.min, max: spec.max, options: spec.options,
            })), usage: '通过 workflowInputs 传入工作流声明的参数；nodeId 为 workflow，fieldName 为参数名。素材在 prompt 中显式引用。不要同时传通用 duration/resolution/aspectRatio。',
          }) };
          const defaults = resolveWorkflowApiInputValues(workflow.workflowApi.defaults);
          return { status: 'success', summary: `已读取 ${workflow.name} 的参数`, modelContent: JSON.stringify({
            workflowId: workflow.id, outputType: 'video', capability: AUTODL_H3_WORKFLOW.capability, defaults,
            parameters: [{ nodeId: 'workflow', fieldName: 'seed', type: 'number', required: false, defaultValue: defaults.seed }],
            usage: '时长、分辨率和比例使用 duration/resolution/aspectRatio；可选 seed 放入 workflowInputs。图片与音频在 prompt 中显式引用，按顺序传入。',
          }) };
        }
        if (!isRunningHubWorkflow(workflow) || !workflow?.runninghub) return { status: 'error', summary: '未找到已保存的云工作流', modelContent: '请先在工作流管理中导入 RunningHub 工作流或 AI 应用', errorCode: 'RUNNINGHUB_WORKFLOW_NOT_FOUND' };
        return { status: 'success', summary: `已读取 ${workflow.name} 的参数`, modelContent: JSON.stringify({ workflowId: workflow.id, outputType: workflow.category, parameters: workflow.runninghub.parameters.map((field) => ({ ...field, defaultValue: typeof field.defaultValue === 'string' ? field.defaultValue.slice(0, 1200) : field.defaultValue })) }) };
      },
    }),
    registerAgentTool<GenerateMediaInput>({
      id: 'media_generate',
      title: '生成媒体内容',
      description: [
        '生成图片、视频、音乐或语音。用户本轮已提供 @model 时把模型 ID 写入 modelRef；',
        '未提供 @model 时省略 modelRef，运行时优先使用项目默认模型。',
        '若项目已设置该类型默认模型则直接使用；自主模式开启自动路由后，可依据模型能力与用户自定义说明选择。',
        '图片 prompt 可以原样包含用户提供的 @{nodeId:label} 或 @asset{path} 引用，',
        '运行时会自动解析为参考图输入；无需先读取节点原 prompt，也不要要求用户重新描述图片。',
        '视频可显式传入 aspectRatio、resolution 和 duration；自定义 API 省略时由模型 capability / 接口默认值决定，内置模型与工作流才锁定项目默认值。',
        '图片的 aspectRatio 同样要传：用户本轮明确说了画幅比例（例如「3:4 的竖幅」「16:9 横版」）时，必须把该比例写进 aspectRatio；',
        '图片侧的比例链条是「本轮显式值 > 项目设置 > 所选模型的目录默认」，都不存在时**不写该字段**（不会替你编一个 1:1）。',
        '图片的清晰度档位**没有**工具入参（本工具的 resolution/duration 只属于视频），它走项目设置或模型目录默认，不要为了改清晰度去传 resolution。',
        /* 官方那张图在画布上的节点名是「可爱的小猫」（= 对 prompt 的**概括**），
           MTV 原来写死成「对话生成图片」。概括推不出来，只能由模型给 ⇒ 加 `title` 入参。 */
        '请务必传 title：给这次产出起一个 2–8 个字的短名（照官方那样概括主体，例如「可爱的小猫」「雨夜街头」），它会成为画布节点标题、以及正文里那枚提及芯片上的文案；不要写整段提示词、不要带文件名后缀。',
        /* ★ 用户 2026 对照官方截图指出：官方回复正文里有节点芯片（`…目前正在生成：🖼可爱的小猫`），
           而 MTV 这条工具链**一条都没有** —— 芯片是正文里的 `@{nodeId:label}` 提及 token 渲染的，
           模型手上没有可直接抄的 token。⇒ 返回里给 `mention`，这里点名让它复制。
           ⚠️ 上一轮我只加到了 `canvas_create_nodes`，而这条链（`media_generate` 自己建占位节点）
             才是「对话生图」的实际路径 ⇒ 芯片仍然没出现。这次补在**本条**返回里。 */
        'deliveryMode 含画布时会在画布上新建卡片；返回里的 mention 字段（形如 @{nodeId:label}）就是那张卡片的引用原文——',
        '回复里要指向这次新建的卡片时，**直接复制该字段**写进正文，它会渲染成可点击、可悬浮预览的节点芯片；不要自己拼 id 或标签。',
        '协作模式由 Policy 请求确认，自主模式直接执行。deliveryMode 控制结果显示在对话、画布或两者。',
      ].join(''),
      inputSchema: {
        type: 'object',
        required: ['kind', 'prompt', 'deliveryMode'],
        additionalProperties: false,
        properties: {
          kind: { type: 'string', enum: ['image', 'video', 'audio'] },
          prompt: {
            type: 'string',
            minLength: 1,
            maxLength: 12000,
            description: '生成或编辑要求；图片编辑时必须原样保留用户给出的节点或资产引用标记。',
          },
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 60,
            description: '画布卡片的短名（2–8 个字），照官方那样概括画面主体，例如「可爱的小猫」；它会成为节点标题与正文里那枚提及芯片上的文案。不要写整段提示词。',
          },
          modelRef: { type: 'string', minLength: 1, maxLength: 240 },
          modelParameters: {
            type: 'array', maxItems: 100, description: 'RunningHub 标准模型专属参数；先用 media_model_parameters 读取合同。值为字符串，数组使用 JSON 字符串数组，数字/布尔值由本地还原。',
            items: { type: 'object', required: ['name', 'value'], additionalProperties: false, properties: {
              name: { type: 'string', minLength: 1, maxLength: 200 }, value: { type: 'string', maxLength: 12000 },
            } },
          },
          workflowInputs: {
            type: 'array', maxItems: 200, description: 'RunningHub 参数覆盖；先用 media_workflow_parameters 读取参数定义，数字和布尔值以字符串传入并由本地恢复类型。',
            items: { type: 'object', required: ['nodeId', 'fieldName', 'value'], additionalProperties: false, properties: {
              nodeId: { type: 'string', minLength: 1, maxLength: 120 }, fieldName: { type: 'string', minLength: 1, maxLength: 160 }, value: { type: 'string', maxLength: 12000 },
            } },
          },
          deliveryMode: { type: 'string', enum: ['chat', 'canvas', 'both'] },
          audioPurpose: { type: 'string', enum: ['music', 'speech'] },
          aspectRatio: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
            description: '画面比例（图片与视频都适用）；用户明确指定时传入（例如用户说「3:4 的竖幅小猫」就传 3:4），合法值由所选模型 capability 校验。',
          },
          resolution: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
            description: '视频分辨率档位；用户明确指定时传入，合法值由所选模型 capability 校验。',
          },
          duration: {
            type: 'integer',
            minimum: 1,
            maximum: 3600,
            description: '视频时长，单位秒；用户明确指定时传入，模型范围由 capability 在提交前校验。',
          },
          /* ★ 2026-10-15（确认卡胶囊的落点；**不在 `required` 里**）：
             · `imageSize` —— 官方那张卡第三颗胶囊（1K/2K/4K），图片专有；
             · `times`     —— 官方那张卡第四颗胶囊（1×/2×/4×），图片专有。
             两者都由**用户在卡上选择**后经 `resolveApprovalSelection` 叠进入参，
             `description` 明确写「不要由模型主动传」以免模型替用户做主。 */
          imageSize: {
            type: 'string',
            minLength: 1,
            maxLength: 32,
            description: '图片清晰度档位（1K/2K/4K）。只由用户在生成确认卡上选择后传入，模型不要主动传；合法值由所选模型的 capability 校验。',
          },
          times: {
            type: 'integer',
            minimum: 1,
            maximum: 16,
            description: '图片张数（官方 1×/2×/4×）。只由用户在生成确认卡上选择后传入，模型不要主动传。',
          },
        },
      },
      effect: 'media_generation',
      resolveInput: resolveMediaToolInput,
      authorize: (context, input) => {
        const store = useAppStore.getState();
        const task = store.agentTasks.find((item) => item.id === context.taskId);
        const mentionedModel = task ? extractModelMention(task.goal) : undefined;
        /* ⚠️ 这里的语义**没动**（第 86 轮）：它只拒绝「提及 X + 显式 `modelRef: Y`」这一类
           **真冲突**。`resolveMediaToolInput` 已经保证「有提及且没显式 `modelRef`」时
           `input.modelRef` 就是提及本身 ⇒ 这条分支不会被项目默认模型误伤。
           反过来（在 `authorize` 里认提及、放宽比对）会连上面的显式冲突一起放掉 ⇒ 不改这里。 */
        if (mentionedModel && mentionedModel !== input.modelRef) {
          return {
            allowed: false,
            reason: '工具使用的媒体模型与用户本轮 @model 选择不一致',
          };
        }
        if (input.modelRef) {
          const option = findMediaModelOption(
            input.modelRef,
            store.config.generalModels ?? [],
            store.config,
            store.workflows,
          );
          if (!option || option.mediaKind !== input.kind) {
            return { allowed: false, reason: '所选模型与本次媒体类型不兼容' };
          }
          if (input.modelParameters?.length) {
            const model = option.provider === 'runninghub' ? getRunningHubModel(input.modelRef, true) : undefined;
            if (!model) return { allowed: false, reason: '所选模型不支持 RunningHub 专属参数' };
            if (new Set(input.modelParameters.map((field) => field.name)).size !== input.modelParameters.length) return { allowed: false, reason: '模型参数包含重复字段' };
            try {
              for (const entry of input.modelParameters) {
                const field = model.parameters.find((field) => field.name === entry.name);
                if (!field) return { allowed: false, reason: '模型参数不在当前合同中' };
                parseRunningHubModelParameter(field, entry.value);
              }
            } catch (error) { return { allowed: false, reason: error instanceof Error ? error.message : '模型参数无效' }; }
          }
          if (option.workflowId) {
            const workflow = store.workflows.find((item) => item.id === option.workflowId);
            if ((isRunningHubWorkflow(workflow) || workflow?.workflowApi?.version === 2) && [input.aspectRatio, input.resolution, input.duration].some((value) => value !== undefined)) return { allowed: false, reason: '云工作流使用自己的参数定义，请通过 workflowInputs 设置比例、分辨率或时长' };
            if (input.workflowInputs && new Set(input.workflowInputs.map(runningHubParameterKey)).size !== input.workflowInputs.length) return { allowed: false, reason: '工作流参数包含重复节点/字段' };
            if (isRunningHubWorkflow(workflow)) {
              if (!store.config.providers[mediaProviderConfigId(option.provider, workflow)]?.apiKey) return { allowed: false, reason: '请先配置该 RunningHub 工作流使用的 API Key' };
            } else if (workflow?.adapterType === 'workflow-api') {
              try { validateWorkflowApiManifest(workflow.workflowApi); workflowApiConnection(store.config.providers[workflow.workflowApi.connectionId], workflow.workflowApi); }
              catch (error) { return { allowed: false, reason: error instanceof Error ? error.message : '工作流连接无效' }; }
            } else if (!comfyBaseUrlFor(option.workflowId)) {
              return { allowed: false, reason: '请先在设置里配置 ComfyUI 服务地址' };
            }
          } else if (option.provider === 'general') {
            const generalModel = (store.config.generalModels ?? []).find(
              (model) => `general/${model.id}` === option.value,
            );
            const provider = generalModel
              ? store.config.providers[generalModel.providerConfigId]
              : undefined;
            if (!generalModel?.modelId || !provider?.baseUrl) {
              return { allowed: false, reason: `模型“${option.label}”的接口配置不完整` };
            }
          } else if (option.provider === 'dreamina') {
            if (!store.config.dreaminaAuth?.loggedIn) {
              return { allowed: false, reason: '请先登录即梦账号' };
            }
          } else if (!store.config.providers[mediaProviderConfigId(option.provider)]?.apiKey) {
            return { allowed: false, reason: `请先配置 ${option.provider} 的 API Key` };
          }
        }
        if (
          input.deliveryMode !== 'chat'
          && store.currentProjectId !== context.projectId
        ) {
          return {
            allowed: false,
            reason: '目标项目当前未加载，不能把媒体结果写入其他项目的画布',
          };
        }
        if (input.kind === 'audio' && !input.audioPurpose) {
          return {
            allowed: false,
            reason: '音频生成必须说明用途是音乐还是语音',
          };
        }
        /**
         * ⚠️ **用户 2026-10-15 现场（P0）**：原实现把三个参数合成一道门 ——
         * `if (input.kind !== 'video' && (aspectRatio || resolution || duration)) ⇒ allowed:false`
         * ⇒ 图片**只要带比例就被整次拒绝**。而同日落地的图片比例链路
         * （`generationRuntime.ts:263-264` / `mediaInputResolution` 的 `显式 > 项目 > 目录默认`）
         * 与工具描述（同文件 `description`）都要求模型「用户说了 3:4 就写 aspectRatio」
         * ⇒ 模型照描述传 ⇒ 工具直接拒绝 ⇒ 用户原话「生成未完成：当前媒体生成工具拒绝了图片的 3:4 比例参数」，
         * **比修复前更糟（修复前只是静默 1:1，现在是彻底不出图）**。
         *
         * 现在的口径（拆成两道门、两条 reason，且**点名是哪个参数**）：
         *  · `aspectRatio`：**图片与视频都适用**（图片侧有完整的落点：审批卡载荷 → `request_json.aspect_ratio`
         *    → `generationRuntime` 的图片分支 → 请求体）；
         *  · `resolution` / `duration`：**只有视频**适用 —— 图片的档位不从这个工具入参走
         *    （`GenerateMediaInput` 里**没有** `imageSize` 字段，图片档位走项目设置/模型目录默认，
         *    见 `mediaInputResolution.catalogImageSizeDefault`）⇒ 没有依据放开，不顺手放开；
         *  · 音频：两者都不适用。
         */
        if (input.kind === 'audio' && input.aspectRatio !== undefined) {
          return {
            allowed: false,
            reason: '参数 aspectRatio（画面比例）只适用于图片与视频生成；音频生成不接受该参数',
          };
        }
        if (input.kind !== 'video' && input.resolution !== undefined) {
          return {
            allowed: false,
            reason: '参数 resolution（分辨率）只适用于视频生成；图片清晰度请改项目设置里的图片默认档位（该参数不出现在 media_generate 入参里）',
          };
        }
        if (input.kind !== 'video' && input.duration !== undefined) {
          return {
            allowed: false,
            reason: '参数 duration（时长）只适用于视频生成；图片生成没有时长这一项',
          };
        }
        /* ★ 2026-10-15：确认卡第三/第四颗胶囊的入参同样是**图片专有**。
           它们只由 `resolveApprovalSelection` 叠加（用户选择），但校验放在同一处，
           避免脏载荷绕过卡直接进入执行期。 */
        if (input.kind !== 'image' && input.imageSize !== undefined) {
          return {
            allowed: false,
            reason: '参数 imageSize（清晰度档位）只适用于图片生成',
          };
        }
        if (input.kind !== 'image' && input.times !== undefined) {
          return {
            allowed: false,
            reason: '参数 times（张数）只适用于图片生成',
          };
        }
        return { allowed: true };
      },
      summarizeInput: (input) => {
        const label = input.kind === 'image'
          ? '图片'
          : input.kind === 'video'
            ? '视频'
            : input.audioPurpose === 'music'
              ? '音乐'
              : '语音';
        const referenceCount = input.prompt.match(/@asset\{[^}]+\}|@\{[^:}]+:[^}]+\}/g)?.length ?? 0;
        return `${input.modelRef ? `使用 ${input.modelRef}` : '选择模型后'}${referenceCount > 0 ? `，基于 ${referenceCount} 个参考输入` : ''}生成${label}，输出到${
          input.deliveryMode === 'chat'
            ? '对话'
            : input.deliveryMode === 'canvas'
              ? '画布'
              : '对话和画布'
        }`;
      },
      buildInputDisplay: buildMediaInputDisplay,
      execute: async (context, input): Promise<AgentToolExecutionResult> => {
        const store = useAppStore.getState();
        if (!input.modelRef) {
          return {
            status: 'error',
            summary: '未选择媒体模型',
            modelContent: '未选择媒体模型',
            errorCode: 'AGENT_MEDIA_MODEL_REQUIRED',
          };
        }
        const referencedNodeIds = [...input.prompt.matchAll(/@\{([^:}]+):[^}]+\}/g)]
          .map((match) => match[1].split('/cell/')[0]);
        const missingNodeId = referencedNodeIds.find(
          (nodeId) => !store.nodes.some((node) => node.id === nodeId),
        );
        if (missingNodeId) {
          return {
            status: 'error',
            summary: '参考节点已不存在，请重新选择图片',
            modelContent: '参考节点已不存在，请重新选择图片',
            errorCode: 'AGENT_MEDIA_REFERENCE_NOT_FOUND',
          };
        }
        const assistantMessageId = getAssistantMessageId(context.taskId);
        if (!assistantMessageId) {
          return {
            status: 'error',
            summary: '未找到承载媒体结果的助手消息',
            modelContent: '未找到承载媒体结果的助手消息',
            errorCode: 'AGENT_MEDIA_MESSAGE_NOT_FOUND',
          };
        }

        /* ══ 真实阶段 ①②：确认可用的生成选项 / 确认比例与尺寸 ══════════════════════════
         * 官方那几行（「确认当前可用的图像生成选项」「确认竖幅画面和图像尺寸选项」「提交…图像生成」）
         * 在官方是**服务端**分别发出的独立 `tool_event`（`Gge` @21175 生产、行文案由 `Mae` 邻域读
         * `content.request.description`），客户端只按 `content.tool` 分桶渲染：
         *   · `live-assets\vendor-pkg-canvas-ChpWx5JY.js` @2394514 `jE`（`search|activity`）、
         *     @2394546 `PF`（连续同 `jE` 合并成**一个**桶 ⇒ 一个桶 = 一行 `PE`）、
         *     @2394689 `nie`（`exe` 先切 subagent，再 `PF` 分桶）；
         *   · 当前产物 `live-assets-new\vendor-pkg-canvas-CvbAwZyy.js` @2433961 `sk`、@2433993 `CO`、
         *     @2434136 `Cae`、@2448014 `ik`（行组件）—— 判据与 MTV `agentBlocks.PF` 逐字一致。
         * ⇒ **官方从未建模「一个工具调用内部的多条步骤」**（那是服务端多次工具调用的结果）。
         *   MTV 没有服务端 ⇒ 按 `toolRegistry.AgentToolSubStepInput` 的约定，用 MTV **现有 step 机制**
         *   等价表达：只有真读到目录里的模型 / 真读出发给请求的那组参数时，才各追加一步。
         * ⚠️ 不预生成、不补默认值：读不到就不写那一段文案。 */
        const kindLabel = input.kind === 'image' ? '图像' : input.kind === 'video' ? '视频' : '音频';
        const selectedOption = findMediaModelOption(
          input.modelRef,
          store.config.generalModels ?? [],
          store.config,
          store.workflows,
        );
        const optionsStep = context.reportStep?.({
          title: `确认当前可用的${kindLabel}生成选项`,
          inputSummary: `已解析生成模型：${selectedOption?.label ?? input.modelRef}`,
        });
        optionsStep?.finish(
          'succeeded',
          selectedOption ? `可用模型：${selectedOption.label}` : '工具入参里的模型不在本地目录中，交由运行期校验',
        );

        /* 比例 / 清晰度 / 时长的**真实值**：与审批卡载荷、与 `ai/generationRuntime.runMediaGeneration`
           的决议点同源（`mediaInputResolution.resolveDefaultMediaRequestParams` 逐字对标）。 */
        const projectSettings = store.projects.find(
          (project) => project.id === context.projectId,
        )?.settings;
        const effectiveParams = resolveDefaultMediaRequestParams(
          projectSettings,
          input.kind,
          {
            ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
            ...(input.resolution ? { resolution: input.resolution } : {}),
            ...(input.duration !== undefined ? { duration: input.duration } : {}),
            /* ★ 2026-10-15：卡上选的图片清晰度档位（官方 `imageSize` chip）。 */
            ...(input.imageSize ? { imageSize: input.imageSize } : {}),
          },
          {
            ...(selectedOption?.provider ? { provider: selectedOption.provider } : {}),
            ...(selectedOption?.workflowId ? { workflowId: selectedOption.workflowId } : {}),
            ...(input.modelRef ? { modelId: input.modelRef } : {}),
          },
        );
        const aspectRatioText = effectiveParams.aspectRatio ?? '';
        const sizeText = effectiveParams.imageSize
          ?? effectiveParams.resolution
          ?? (effectiveParams.duration !== undefined ? `${effectiveParams.duration}s` : '');
        const paramsStep = context.reportStep?.({
          /* 官方那行是「确认竖幅画面和图像尺寸选项」——即「比例 + 画面 + 档位 + 尺寸」，
             比例/档位都从真实解析结果取；解析不到就不写该段（不替用户断言一个默认值）。 */
          title: `确认${aspectRatioText}画面与${sizeText}尺寸选项`,
          inputSummary: [
            aspectRatioText ? `比例 ${aspectRatioText}` : '比例未指定（用模型/项目默认）',
            sizeText ? `档位 ${sizeText}` : '档位未指定（用模型默认）',
          ].join('，'),
        });
        paramsStep?.finish(
          'succeeded',
          [aspectRatioText || undefined, sizeText || undefined].filter(Boolean).join(' / ') || '比例与档位均未指定',
        );

        const intent: MediaGenerationIntent = {
          kind: input.kind,
          prompt: input.prompt,
          title: input.title,
          modelRef: input.modelRef,
          deliveryMode: input.deliveryMode,
          audioPurpose: input.audioPurpose,
          aspectRatio: input.aspectRatio,
          resolution: input.resolution,
          duration: input.duration,
          /* ★ 2026-10-15：确认卡第三/第四颗胶囊 → 执行期（请求级参数 / 节点 `batchCount`）。 */
          imageSize: input.imageSize,
          times: input.times,
          runninghubModelParameters: input.modelParameters ? Object.fromEntries(input.modelParameters.map((field) => [field.name, field.value])) : undefined,
          workflowInputs: input.workflowInputs ? Object.fromEntries(input.workflowInputs.map((field) => [runningHubParameterKey(field), field.value])) : undefined,
        };
        /* ★★ 2026-10 用户裁决 + 官方源码证据：**agent 生成期间画布上不存在卡**。
           （用户原话：「agent 在画布中 生成图卡是 loading 态 不对 ！去看源码」/「我说的是 loading 态
             时的**动画**以及**周围出现一个羽化颜色**」——那两样正是官方节点生成动效
             `.node-loading-*`（星空点阵 + 扫光 + `sweep-glow` 的 blur(26px) 羽化光），
             但官方**只在节点本地的 taskInfo 生成路径**上用它，agent 工具路径根本没有这张卡。）

           官方证据（`live-assets-new/vendor-pkg-canvas-CvbAwZyy.js`，字节偏移为 UTF-8 绝对偏移）：
           ① @2734415 `Qle={gen_image:{action:"sync_snapshots",collectChangeIds:BP}, …}`
              —— agent 的 `gen_image` 完成后，客户端才做一次画布快照同步（`canvas-service-sync`）。
           ② @2736260 `eut`：`const t=NT(e.tool),n=e.status==="completed",o=f0(t)&&e.status==="failed";
              if(!n&&!o)return null;` —— **`started` 事件一律 `return null`**（不建卡、不刷新）。
           ③ @2732481 `BP`：`e.items.forEach(o=>{…Fr(t,r.node_id)…})` —— 节点 id 只来自**工具响应**
              （`response.items[].node_id`），提交阶段的 `request` 里没有任何 node id。
           ④ 提交期给客户端的数据只有参数（@2290100 `gnt`：`model_name/prompt/aspect_ratio/…`），
              连 `reference_node_ids` 都是**引用**节点，不是本轮新节点。
           ⑤ 官方的 `Kp`（节点 loading 动效）挂在 `Nr(data.taskInfo)` 上
              （@734884 `Nr=e=>e?e.status===Ns.PENDING||e.status===Ns.PROCESSING:!1`），
              只对**节点本地发起**的生成（`taskInfo` 由客户端自己写）成立，agent 路径不写 taskInfo。

           ⇒ MTV 不再在提交时 `createMediaPlaceholder`；卡在**产物拿到之后**才落
             （官方仍是「总要落一张」：`gen_image` 无条件产节点，`deliveryMode` 只决定对话里是否也展示）。
           ⇒ 连带好处：失败/中断时画布上**没有**任何卡，不存在「永远转圈的僵尸卡」。 */
        const willCreateCanvasNode = true;
        /** 提交时的工程 —— 生成期间用户换了工程就别把卡落进新工程（原 `canvasDerivationGuard` 语义）。 */
        const pendingProjectId = context.projectId;
        let targetNodeId: string | undefined;
        store.updateMessage(assistantMessageId, {
          mediaStatus: 'queued',
          mediaError: undefined,
          canvasStatus: willCreateCanvasNode ? 'pending' : 'none',
          canvasNodeId: undefined,
          canvasError: undefined,
        });

        /* ══ 真实阶段 ③：提交生成 ══════════════════════════════════════════════════════
         * 这一步包住**真正发请求并等待产物**的那段（`runMediaGeneration`），所以它的
         * `createdAt..updatedAt` 就是真实提交耗时（官方 `RE` = `min(startedAt)..max(endedAt)`
         * ⇒「处理了 Xs」；MTV 等价物见 `messageContents.itemsDurationMs`）。
         * 文案对齐官方那行「提交9:16两只非洲象图像生成」：比例 + 卡片短名 + 媒体类型。 */
        let submitStep: AgentToolSubStepHandle | undefined;
        try {
          useAppStore.getState().updateMessage(assistantMessageId, {
            mediaStatus: 'generating',
          });
          submitStep = context.reportStep?.({
            /* 官方那行是「提交9:16两只非洲象图像生成」⇒ 比例 + 卡片短名 + 媒体类型，不加分隔空格。 */
            title: `提交${aspectRatioText}${input.title ?? ''}${kindLabel}生成`,
            inputSummary: `${selectedOption?.label ?? input.modelRef} ⇒ ${
              input.deliveryMode === 'chat' ? '对话' : input.deliveryMode === 'canvas' ? '画布' : '对话和画布'
            }`,
          });
          const result = await runMediaGeneration(
            intent,
            context.projectId,
            context.signal,
            targetNodeId,
            { projectId: context.projectId, conversationId: context.conversationId, messageId: assistantMessageId, deliveryMode: input.deliveryMode },
          );
          if (context.signal.aborted) {
            throw new DOMException('请求已取消', 'AbortError');
          }
          const currentStore = useAppStore.getState();
          /* ★ 官方：节点在**工具完成时**才出现（证据见上文 @2734415/@2736260/@2732481）
             ⇒ 这里「建卡 + 填图」在**同一个同步块**里做完：
               · `createMediaPlaceholder` 沿用它原来的口径写 `label/aspectRatio/imageSize/batchCount/
                 role:'generator'`（生成参数必须落到节点上，否则卡片会按 1:1 出尺寸）；
               · 紧接着 `settleMediaPlaceholder` 把产物填进同一张卡并置 `status:'success'`；
               · React 18 自动批处理同一 tick 内的两次 set ⇒ 画面只会看到**成品卡**一帧，
                 不会出现 `.node-loading-*` 的 loading 帧（官方 agent 路径也没有那一帧）。
             ⚠️ 与旧的「先建占位卡、完成时 settle」相比，落点/数据/历史快照都一致，只有**时序**变了。 */
          const projectChanged = currentStore.currentProjectId !== pendingProjectId;
          let nodeCreated = false;
          if (willCreateCanvasNode && !projectChanged) {
            const nodeId = currentStore.createMediaPlaceholder(intent);
            try {
              const cloud = currentStore.workflows?.find((workflow) => isCloudWorkflow(workflow) && workflowExecution(workflow).model === input.modelRef);
              if (!cloud && input.modelRef && getRunningHubModel(input.modelRef)) currentStore.updateNodeDataTransient(nodeId, { provider: 'runninghub', model: input.modelRef, runninghubModelParameters: intent.runninghubModelParameters });
              if (cloud) currentStore.updateNodeDataTransient(nodeId, { ...workflowExecution(cloud), workflowInputs: intent.workflowInputs });
              nodeCreated = currentStore.settleMediaPlaceholder(nodeId, result);
              if (nodeCreated) {
                targetNodeId = nodeId;
                currentStore.incrementRevision();
              } else {
                /* 极端情况（节点刚建就被删）：绝不留一张永远转圈的卡 ⇒ 标失败态。 */
                currentStore.failMediaPlaceholder(nodeId, MEDIA_PLACEHOLDER_STALE_ERROR);
              }
            } catch (settleError) {
              currentStore.failMediaPlaceholder(
                nodeId,
                settleError instanceof Error ? settleError.message : MEDIA_PLACEHOLDER_STALE_ERROR,
              );
              throw settleError;
            }
          }
          if (nodeCreated && targetNodeId && ['runninghubwf', 'runninghub'].includes(result.provider)) {
            currentStore.updateNodeDataTransient(targetNodeId, { runninghubOutputs: result.runninghubOutputs });
            completeRunningHubNodeTask(targetNodeId);
          }
          currentStore.updateMessage(assistantMessageId, {
            mediaResult: result,
            mediaStatus: 'succeeded',
            mediaError: undefined,
            /* 卡只在成功且没换工程时才落；换工程/没落成功时如实报「没建」，不留 loading 卡。 */
            canvasStatus: nodeCreated ? 'created' : (willCreateCanvasNode ? 'failed' : 'none'),
            canvasNodeId: targetNodeId,
            canvasError: nodeCreated
              ? undefined
              : (projectChanged ? MEDIA_PLACEHOLDER_STALE_ERROR : undefined),
          });
          if (!targetNodeId && ['runninghubwf', 'runninghub'].includes(result.provider)) completeRunningHubNodeTask(`runninghub-message-${assistantMessageId}`);
          if (result.workflowApiTaskId && (!targetNodeId || nodeCreated)) {
            if (targetNodeId) currentStore.updateNodeDataTransient(targetNodeId, { workflowApiOutputs: result.workflowApiOutputs });
            completeWorkflowApiNodeTask(targetNodeId ?? `workflow-api-message-${assistantMessageId}`, result.workflowApiTaskId);
          }
          // 落盘失败时产物只有临时地址，必须让用户和模型都看到，而不是报告纯成功
          const unsaved = result.persistence === 'failed';
          if (unsaved) {
            currentStore.showToast(
              `媒体已生成，但未保存到项目：${result.persistError || MEDIA_PERSIST_FAILED_MESSAGE}`,
              'error',
            );
          }
          /* 提交阶段真实结束（产物已拿到）；耗时 = 真实等待时间。 */
          submitStep?.finish('succeeded', unsaved ? '已生成，但未保存到项目目录' : '媒体内容已生成');
          return {
            status: 'success',
            summary: unsaved ? '媒体内容已生成，但未能保存到项目目录' : '媒体内容已生成',
            modelContent: JSON.stringify({
              artifactId: result.id,
              kind: result.kind,
              audioPurpose: result.audioPurpose,
              deliveryMode: result.deliveryMode,
              canvasNodeId: targetNodeId,
              /* 官方回复正文里的节点芯片就是 `@{nodeId:label}`；给模型一份**可直接抄**的原文
                 （标签 URL 编码，与 `store.ui.ts:535` 同一写法，`ChatReferenceText.decodeLabel` 严格往返）。
                 ⚠️ 拿不到节点（`nodeCreated === false`，占位卡已被删/换工程）时不写 —— 那条 chip 点不开。 */
              ...(targetNodeId && nodeCreated
                ? {
                  mention: `@{${targetNodeId}:${encodeURIComponent(String(
                    currentStore.nodes.find((item) => item.id === targetNodeId)?.data?.label ?? '',
                  ))}}`,
                }
                : {}),
              persistence: result.persistence,
              persistError: result.persistError,
              /* ★ 用户实测吐槽（「还喵的 恰呢？ 恰好？」）：
                 正文那句「已生成一张 9:16 竖版、**恰好两只非洲象**的图片」是**模型自己写的**，
                 它直接复述了用户提示词的开头（「恰好两只非洲象，完整入镜…」）。
                 官方那句是「已在画布上提交一张 9:16 竖幅的两只非洲象图，目前正在生成：@{…}」，
                 用的是**节点短名**。模型没有理由知道该用短名，所以这里把口径写明。 */
              replyHint: '写回复正文时，提到这张图/视频请直接用上面 mention 里的**节点短名**'
                + '（例如「两只非洲象」），不要复述用户提示词的措辞或开头词（如「恰好」「请帮我」）。',
            }),
            display: {
              fields: [
                { label: '产物 ID', value: result.id },
                { label: '媒体类型', value: result.kind },
                { label: '模型', value: result.modelId },
                { label: '保存状态', value: result.persistence },
                ...(targetNodeId
                  ? [{ label: '画布节点', value: targetNodeId }]
                  : []),
              ],
            },
          };
        } catch (error) {
          const stopped = context.signal.aborted
            || (error instanceof DOMException && error.name === 'AbortError');
          const message = stopped
            ? '已停止本地跟踪；供应商未确认远端取消，任务可能继续并产生费用'
            : error instanceof Error ? error.message : '未知错误';
          const currentStore = useAppStore.getState();
          /* 提交阶段以真实失败/中止收尾（官方状态 `failed` / `cancelled`）。 */
          submitStep?.finish(stopped ? 'stopped' : 'failed', message);
          /* ★ 失败/中断时画布上**没有卡**（官方 agent 路径同样没有：`eut` @2736260 在 `started`
             阶段 `return null`，`BP` @2732481 也只有 `response.items[].node_id`）
             ⇒ 「永远转圈的僵尸卡」在这个路径上不可能存在。
             唯一例外：`settle` 阶段抛错时上面已在同一同步块里把刚建的卡标成 `status:'error'`
             （`failMediaPlaceholder`）——那种卡是**已落地的成品卡**，不是 loading 卡。 */
          const nodeStillThere = Boolean(targetNodeId && currentStore.nodes.some((item) => item.id === targetNodeId));
          if (targetNodeId) currentStore.failMediaPlaceholder(targetNodeId, message);
          currentStore.updateMessage(assistantMessageId, {
            mediaStatus: 'failed',
            /* 「已停止本地跟踪；供应商未确认远端取消，任务可能继续并产生费用」= MTV 运维提示
               （防重复扣费）⇒ 走 `mediaNotice`（官方无对应物，见 `ChatMessage.mediaNotice`）；
               普通生成失败才走 `mediaError`（渲染层按官方 tool-event 文案族显示）。 */
            mediaError: stopped ? undefined : message,
            mediaNotice: stopped ? message : undefined,
            canvasStatus: targetNodeId ? 'failed' : 'none',
            canvasNodeId: targetNodeId,
            canvasError: targetNodeId ? message : undefined,
          });
          return {
            status: 'error',
            /* 原来这里是 MTV 自造的「媒体生成失败：<原始报错>」句式（官方产物 0 命中）
               ⇒ 直接给原始报错，不自造句式。 */
            summary: message,
            /* ★ 把**画布事实**一并给模型 —— 事故（用户真机）：
               失败时模型自己写出了「画布上尚未创建新图片节点」，而事实上占位卡**已经建了**
               （`node-wzxbupyg0` 当时还留在画布上）⇒ 模型在信息缺失时只能编。
               这里把 `canvasNodeCreated / canvasNodeId / canvasStatus` 明确喂给它。 */
            modelContent: JSON.stringify({
              error: message,
              canvasNodeCreated: nodeStillThere,
              canvasNodeId: targetNodeId ?? null,
              canvasStatus: targetNodeId ? (nodeStillThere ? 'failed' : 'missing') : 'none',
              hint: targetNodeId
                ? '画布上的卡片已标记为失败态，不要声称「画布上尚未创建节点」。'
                : '本次没有在画布上创建卡片。',
            }),
            errorCode: stopped
              ? 'AGENT_MEDIA_TRACKING_STOPPED'
              : 'AGENT_MEDIA_GENERATION_FAILED',
          };
        }
      },
    }),
  ];
}
