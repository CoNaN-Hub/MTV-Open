/**
 * ai/generateImage — 图片生成入口
 *
 * 按 provider 分流到对应 adapter：
 *   dreamina   → dreaminaService（CLI 本地化图片，不走图床上传）
 *   apimart    → Media Provider Registry → APIMart adapter
 *   general    → providers/standardImage（通用模型，OpenAI 兼容）
 *   volcengine → providers/volcengineImage（Seedream 专属请求格式）
 *   runninghub → Media Provider Registry → RunningHub adapter
 *   localllm   → 已废弃，引导迁移到通用模型
 *   其他       → providers/standardImage（标准 OpenAI 兼容）
 *
 * 公共前置处理（prompt 解析、图床上传、空值校验）统一在此完成。
 */
import { useAppStore } from '../../store/useAppStore';
import { DEFAULT_BASE_URLS } from '../../constants/api';
import { mapImageDimensions } from '../aiDimensions';
import { generateDreaminaImage } from '../dreaminaService';
import { executeComfyUIGenerate } from '../comfyWorkflowService';
import { isRunningHubWorkflow } from '../workflowExecutionService';
import { executeRunningHubWorkflow } from './providers/runninghubWorkflow';
import { executeWorkflowApiMedia } from '../workflowApi/workflowApiAdapter';
import { parseWorkflowApiFields } from '../workflowApi/workflowApiConfig';
import { collectConnectedReferenceMedia, getMediaReferenceUrls, mergeMediaReferences } from './connectedReferenceMedia';
import type { AIImageGenParams, BatchImageResult, ImageGenerationResult } from '../../types/aiTypes';
import { MAX_IMAGE_BATCH_COUNT } from '../../types/aiTypes';
import { extractModelName, resolveGeneralModel, resolveGeneralModelConnection } from './helpers';
import { collectPromptNodeMediaUrls, resolvePromptWithImageRefs } from './promptResolver';
import { warnIfTooManyReferences } from './connectedReferenceMedia';
import { resolveImageDataUrlArray, resolveImageUrlArray } from './imageUtils';
/* 出站提示词组装（**原话直发**，对齐官方）—— 见该文件的文件头 */
import { buildImagePrompt } from './imagePromptHints';
/* 官方界面「精细度」→ 请求体 `quality`（按模型能力映射，任何厂商通用） */
import { resolveOutgoingImageQuality } from './imageQuality';
/* 官方画布「档位 × 比例」像素表 + 厂商声明的像素表 —— 尺寸必须与上游认的值一致（见各文件头） */
import { dimensionsFromImageSize, officialImageSize } from './officialImageSizes';
import { imageDimensionPreset } from './mediaModelCapabilities';
import { generateImageStandardBatch } from './providers/standardImage';
import { generateVolcengineImagesBatch } from './providers/volcengineImage';
import { runConfiguredModelProtocol } from './modelProtocolRuntime';
import { mediaProviderRegistry } from './mediaProviderRegistry';
import { executeModelProtocol, modelProtocolUsesVariable, resolveModelExecutionProfile } from './modelProtocol';
import { getProviderDefinition } from './providerCatalogService';
import { resolveBuiltInImageRequestContract, validateBuiltInImageResponse } from './imageRequestContracts';

/**
 * 出图尺寸（用例标注/卡片元数据）—— 与出站 `size` 用**同一套取值顺序**，
 * 免得「界面写 2K、文件是 4K」：
 *   1. 厂商声明的像素（`imageDimensionPreset`）；
 *   2. 官方画布像素表（`officialImageSize`）；
 *   3. 短边换算（旧行为）。
 */
function resolveImageDimensions(
  modelName: string,
  imageSize: string | undefined,
  aspectRatio: string | undefined,
): { width: number; height: number } {
  /* round 122 追加：三级来源都不命中时 `mapImageDimensions` 用它的**函数内定义**的兜底
     （短边表缺省 1024、比例串缺失按方图），不再由公共函数塞一个 `2K`/`1:1`。 */
  return imageDimensionPreset(modelName, imageSize, aspectRatio)
    ?? dimensionsFromImageSize(officialImageSize(modelName, imageSize, aspectRatio))
    ?? mapImageDimensions(imageSize, aspectRatio);
}

function hasReferenceImageFile(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if ('$file' in value && modelProtocolUsesVariable(JSON.stringify(value.$file) ?? '', 'imageUrls')) {
    return true;
  }
  return Object.values(value).some(hasReferenceImageFile);
}

export async function generateImage(
  params: AIImageGenParams,
  signal?: AbortSignal,
): Promise<ImageGenerationResult> {
  const batch = await generateImagesBatch(params, 1, signal);
  const result = batch.results[0];
  if (!result) throw new Error('图片生成返回结果为空');
  return result;
}

function singleResult(result: ImageGenerationResult): BatchImageResult {
  return { requestedCount: 1, results: [result], failedCount: 0 };
}

function mergeImageUrls(primary: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [...primary, ...extra]) {
    const u = (url || '').trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** 当前项目启用的风格母图 URL */
function getProjectStyleMasterUrl(): string | null {
  const { currentProjectId, projects } = useAppStore.getState();
  const project = projects.find((p) => p.id === currentProjectId);
  const ref = project?.settings?.visualStyle?.styleReference;
  if (!ref || ref.enabled === false) return null;
  const url = (ref.imageUrl || '').trim();
  return url || null;
}

export async function generateImagesBatch(
  params: AIImageGenParams,
  count: number,
  signal?: AbortSignal,
): Promise<BatchImageResult> {
  const requestedCount = Math.min(MAX_IMAGE_BATCH_COUNT, Math.max(1, Math.floor(count)));
  const { prompt: rawPrompt, model, provider } = params;
  /**
   * **用户 2026-10-15 批准（round 122 追加）**：这里原来是**解构默认值**
   * `const { …, imageSize = '2K', aspectRatio = '1:1' } = params;`
   * ⇒ 上游（`generationRuntime.ts:263-274`，`显式 > 项目设置 > 模型目录默认 > 不填`）明明按裁决
   * 「无来源就不写该字段」传了 `undefined`，**在这里又被补成常量 `2K`/`1:1` 并原样进请求体**
   * （`:133 resolveBuiltInImageRequestContract` / `:187 buildImagePrompt` / `:295 resolveImageDimensions`）
   * ⇒ 卡片不显示、请求却发 `2K/1:1`，即「卡上显示 ≠ 实际会发」的**反方向**版本，
   * 与 `mediaInputResolution.ts:114-117` 登记的那条「代价」是同一个病根。
   *
   * 现在：**公共函数不再造值**，`undefined` 原样往下传，由**真正需要它的那一层**决定：
   *  · `standardImage`（通用 OpenAI 兼容）：`imageDimensionPreset`（**厂商/连接声明的能力表**）
   *    → `officialImageSize`（官方画布像素表）→ 短边换算，三级都是它自己文件里写明的来源；
   *  · `volcengineImage`：`normalizeSeedreamSize` 的**模型档位表**（`SEEDREAM_SIZE_SUPPORT`）兜底，
   *    按模型家族取「最接近的支持档位」，不是全局常量；
   *  · `tudou` / `grsai` 的**协议合同**：外部接口要求 `resolution`/`size` 必填
   *    ⇒ 由**该合同自己**声明常量并注明依据（见各自文件里的注释）。
   */
  const imageSize = params.imageSize;
  const aspectRatio = params.aspectRatio;

  const generalModel = provider === 'general' ? resolveGeneralModel(model) : undefined;
  if (provider === 'general' && !generalModel) {
    throw new Error('未找到该通用模型配置\n请在「设置 → API Key」中检查');
  }
  const config = useAppStore.getState().config;
  const connectionId = generalModel?.providerConfigId ?? provider;
  const providerConfig = config.providers[connectionId];
  const modelName = generalModel?.modelId ?? extractModelName(model, provider);
  const providerDefinition = getProviderDefinition(connectionId, providerConfig);
  const catalogModel = providerDefinition?.models?.find((item) => item.id === modelName);
  // 已确认的内置合同优先，未知模型、自定义连接与工作流保持自己的协议。
  // 连接地址与已映射的精细度一并传入：土豆这类「自有接口形状」的中转站要按域名识别，
  // 且它的 resolution/quality 只认小写档位，必须在合同构建期就写好字面量。
  const builtInContract = params.workflowId ? undefined
    : resolveBuiltInImageRequestContract(
      providerDefinition,
      modelName,
      imageSize,
      aspectRatio,
      providerConfig?.baseUrl?.trim() || providerDefinition?.defaultBaseUrl,
      resolveOutgoingImageQuality(modelName, params.quality),
    );
  const executionProfile = builtInContract ? undefined : generalModel?.executionProfile;
  const imageReferenceRequestMode = builtInContract?.kind === 'standard' ? builtInContract.imageReferenceRequestMode
    : builtInContract ? undefined
    : generalModel?.imageReferenceRequestMode
      ?? (executionProfile?.preset === 'custom' ? undefined
        : providerConfig?.selectedModels?.find((item) => item.id === modelName)?.imageReferenceRequestMode
          ?? providerConfig?.imageReferenceRequestMode   /* ★ 连接级默认（用户 2026：其他能生图的模型也要语义） */
          ?? catalogModel?.imageReferenceRequestMode);
  const usesImageDataUrls = !params.workflowId
    && (builtInContract?.kind === 'protocol' && builtInContract.referenceInput === 'data-url'
      || imageReferenceRequestMode === 'generation-json-image-data-urls');
  const usesImageMultipart = !params.workflowId
    && executionProfile?.preset !== 'custom'
    && imageReferenceRequestMode === 'edits-multipart';

  const customProtocol = executionProfile?.preset === 'custom'
    ? resolveModelExecutionProfile(executionProfile)
    : undefined;
  const usesCustomImageFiles = customProtocol?.submit.bodyEncoding === 'multipart'
    && hasReferenceImageFile(customProtocol.submit.body);


  // 解析 @{nodeId:label} 引用：图片 URL 提取到 image_urls，文本内联替换到 prompt
  const { prompt: resolvedPrompt, imageUrls } = await resolvePromptWithImageRefs(rawPrompt, {
    preferLocalImages: usesImageMultipart || usesCustomImageFiles || usesImageDataUrls,
  });
  if (signal?.aborted) throw new DOMException('请求已取消', 'AbortError');

  // 合并调用方传入的 image_urls 与从 prompt 中解析出的 imageUrls
  let contentImageUrls = mergeImageUrls([...(params.image_urls || [])], imageUrls);

  // 项目风格母图：自动插到最前，无需用户每次 @
  const styleMasterUrl = getProjectStyleMasterUrl();
  let allImageUrls = contentImageUrls;
  let styleAsFirst = false;
  if (styleMasterUrl) {
    contentImageUrls = contentImageUrls.filter((u) => u !== styleMasterUrl);
    allImageUrls = mergeImageUrls([styleMasterUrl], contentImageUrls);
    styleAsFirst = true;
  }

  /* ★★ 用户 2026：「批量生成时 一样的模型 一样的参考图 一样的提示词，官方效果更好，MTV 差很多」
     —— 根因是**我们发出去的提示词和官方不是同一段文本**（官方是用户原话直发）。
     `edits-json-images` 模式下不再做任何提示词工程，逐字对齐官方；
     其它模式保留样板（那是给「参考图走 image_urls 会被上游无视」的端点准备的）。
     详见 `services/ai/imagePromptHints.ts` 的文件头。 */
  const prompt = buildImagePrompt({
    rawPrompt: resolvedPrompt,
    referenceCount: allImageUrls.length,
    styleAsFirst,
    aspectRatio,
    mode: imageReferenceRequestMode,
  });
  warnIfTooManyReferences({ image: allImageUrls.length });

  // Dreamina：CLI 端本地化图片，不走图床上传
  if (provider === 'dreamina') {
    if (!prompt.trim()) throw new Error('提示词不能为空');
    if (requestedCount > 1) throw new Error('即梦暂不支持批量生成，请将数量设为 1');
    return singleResult(await generateDreaminaImage({ prompt, model, imageSize, aspectRatio, imageUrls: allImageUrls, nodeId: params.nodeId }, signal));
  }


  // ComfyUI 工作流执行路径：参考图由 ComfyUI 自己的 /upload 收，不必先过图床
  if (params.workflowId) {
    if (requestedCount > 1) throw new Error('工作流暂不支持批量生成，请将数量设为 1');
    const workflow = useAppStore.getState().workflows.find((item) => item.id === params.workflowId);
    if (provider === 'workflow-api' && workflow?.adapterType !== 'workflow-api') throw new Error('请先配置并选择工作流 API');
    if (workflow?.adapterType === 'workflow-api') {
      const refs = mergeMediaReferences(collectPromptNodeMediaUrls(rawPrompt).references, collectConnectedReferenceMedia(params.nodeId).references);
      const result = await executeWorkflowApiMedia({ workflowId: workflow.id, nodeId: params.nodeId, taskContext: params.workflowApiTaskContext,
        prompt, inputs: parseWorkflowApiFields(params.workflowInputs, workflow.workflowApi), references: {
          image: mergeImageUrls(allImageUrls, getMediaReferenceUrls(refs, 'image', 'local')),
          video: getMediaReferenceUrls(refs, 'video', 'local'), audio: getMediaReferenceUrls(refs, 'audio', 'local'),
        } }, signal);
      return singleResult({ ...result, ...mapImageDimensions(imageSize, aspectRatio) });
    }
    if (isRunningHubWorkflow(workflow)) {
      const refs = mergeMediaReferences(collectPromptNodeMediaUrls(rawPrompt).references, collectConnectedReferenceMedia(params.nodeId).references);
      const outputs = await executeRunningHubWorkflow({ ...params, workflowId: params.workflowId, prompt, kind: 'image', references: {
        image: mergeImageUrls(allImageUrls, getMediaReferenceUrls(refs, 'image', 'local')),
        video: getMediaReferenceUrls(refs, 'video', 'local'), audio: getMediaReferenceUrls(refs, 'audio', 'local'),
      } }, signal);
      return singleResult({ url: outputs[0].url, runninghubOutputs: outputs, ...mapImageDimensions(imageSize, aspectRatio) });
    }
    return singleResult(await executeComfyUIGenerate({ ...params, prompt }, signal, allImageUrls));
  }
  if (provider === 'runninghubwf') throw new Error('请先在工作流管理中导入并配置该 RunningHub 工作流');
  if (provider === 'workflow-api') throw new Error('请先配置并选择工作流 API');

  // comfyui 从不注册在 providers 里，落到下面的 default 分支只会误报「未配置 API Key」
  if (provider === 'comfyui') {
    throw new Error('未选择 ComfyUI 工作流\n请在模型选择器中导入并选择工作流');
  }


  // 参考图传输格式由模型显式配置或已确认的厂商目录决定。
  const referenceMedia = provider === 'runninghub' ? mergeMediaReferences(collectPromptNodeMediaUrls(rawPrompt).references, collectConnectedReferenceMedia(params.nodeId).references) : undefined;
  if (referenceMedia) allImageUrls = mergeImageUrls(allImageUrls, getMediaReferenceUrls(referenceMedia, 'image', 'local'));
  // multipart 直接读取原始参考图，避免本地图片先上传图床再下载回来的额外网络依赖。
  allImageUrls = provider === 'runninghub' || usesImageMultipart ? allImageUrls : usesImageDataUrls || usesCustomImageFiles
    ? await resolveImageDataUrlArray(allImageUrls, signal)
    : await resolveImageUrlArray(allImageUrls, provider, signal);
  if (signal?.aborted) throw new DOMException('请求已取消', 'AbortError');

  if (!prompt.trim() && provider !== 'runninghub') throw new Error('提示词不能为空');

  if (builtInContract?.kind === 'protocol') {
    const apiKey = providerConfig?.apiKey || '';
    const baseUrl = providerConfig?.baseUrl?.trim() || providerDefinition?.defaultBaseUrl || '';
    if (!apiKey) throw new Error(`未配置 ${providerDefinition?.name} 的 API Key\n请在「设置 → API Key」中配置`);
    const results: ImageGenerationResult[] = [];
    // 此合同一次只生成一张；顺序执行用户请求的数量，失败即停止，禁止重放提交。
    for (let index = 0; index < requestedCount; index += 1) {
      signal?.throwIfAborted();
      try {
        const result = await executeModelProtocol({
          apiKey, baseUrl, protocol: builtInContract.protocol,
          variables: { model: modelName, prompt, imageUrls: allImageUrls },
          /* `validateBuiltInImageResponse` 只适用于**同步**合同（它要求 `status === "succeeded"`）。
             异步合同的提交响应是 `{data:{id,status:"submitted"}}`，套上去会直接抛错 ✗ */
          validateResponse: builtInContract.protocol.mode === 'sync' ? validateBuiltInImageResponse : undefined,
          signal,
        });
        signal?.throwIfAborted();
        const url = result.urls?.[0];
        if (!url) throw new Error('图片生成返回结果为空');
        results.push({ url, ...builtInContract.dimensions });
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === 'AbortError') || !results.length) throw error;
        break;
      }
    }
    return { requestedCount, results, failedCount: requestedCount - results.length };
  }

  const registeredAdapter = mediaProviderRegistry.getImageAdapter(provider);
  if (registeredAdapter) {
    return registeredAdapter.generateImage({
      params,
      prompt,
      imageUrls: allImageUrls,
      referenceMedia,
      requestedCount,
      signal,
    });
  }

  // 尚未迁移的 Provider 继续走兼容分支。
  switch (provider) {
    case 'general': {
      if (!generalModel) {
        throw new Error('未找到该通用模型配置\n请在「设置 → API Key」中检查');
      }
      const gm = generalModel;
      const connection = resolveGeneralModelConnection(model);
      if (!connection) throw new Error(`通用模型 "${gm.name}" 的连接配置不存在`);
      if (!connection.baseUrl) throw new Error(`通用模型 "${gm.name}" 未配置接口地址`);
      const dimensions = resolveImageDimensions(gm.modelId, imageSize, aspectRatio);
      const hasExplicitStandardRequestMode = allImageUrls.length > 0
        && imageReferenceRequestMode !== undefined
        && executionProfile?.preset !== 'custom';
      if (executionProfile && !hasExplicitStandardRequestMode) {
        const urls = await runConfiguredModelProtocol({
          model: gm,
          category: 'image',
          nodeId: params.nodeId,
          signal,
          variables: {
            model: gm.modelId,
            prompt,
            /* round 122 追加：**没值就不放这个变量**（不放 = 模板拿不到它），
               不再把公共函数的常量 `2K`/`1:1` 当作用户的选择喂进自定义协议。 */
            ...(imageSize !== undefined ? { imageSize } : {}),
            ...(aspectRatio !== undefined ? { aspectRatio } : {}),
            size: `${dimensions.width}x${dimensions.height}`,
            width: dimensions.width,
            height: dimensions.height,
            n: requestedCount,
            batchCount: requestedCount,
            imageUrls: allImageUrls,
          },
        });
        const results = urls.slice(0, requestedCount).map((url) => ({ url, ...dimensions }));
        if (results.length === 0) throw new Error('图片生成返回结果为空');
        return {
          requestedCount,
          results,
          failedCount: Math.max(0, requestedCount - results.length),
        };
      }
      return generateImageStandardBatch({
        apiKey: connection.apiKey,
        baseUrl: connection.baseUrl,
        modelName: gm.modelId,
        prompt,
        dimensions,
        imageUrls: allImageUrls,
        imageReferenceRequestMode,
        /* 官方界面「精细度」→ `quality`（按**模型能力表**映射/把关，任何厂商都适用） */
        quality: resolveOutgoingImageQuality(gm.modelId, params.quality),
        /* 官方像素表需要原始「档位 + 比例」（`dimensions` 已经换算过，缺比例信息） */
        imageSize,
        aspectRatio,
        /* 官方「透明背景」→ 请求体 `background`+`output_format` ✓ */
        transparentBackground: params.transparentBackground,
      }, requestedCount, signal);
    }

    case 'volcengine': {
      const pc = config.providers.volcengine;
      const apiKey = pc?.apiKey || '';
      if (!apiKey) throw new Error('未配置 火山方舟 的 API Key\n请在「设置 → API Key」中配置');
      const baseUrl = (pc?.baseUrl || DEFAULT_BASE_URLS.volcengine || '').replace(/\/+$/, '');
      if (!baseUrl) throw new Error('未配置 火山方舟 的服务地址\n请在「设置 → API Key」中添加');
      return generateVolcengineImagesBatch({
        apiKey,
        baseUrl,
        model,
        provider,
        prompt,
        imageSize,
        aspectRatio,
        imageUrls: allImageUrls,
      }, requestedCount, signal);
    }

    case 'localllm':
      // 已合并到通用模型，保留兼容旧数据
      throw new Error('本地大模型已迁移到「通用模型」，请重新选择模型\n请在「设置 → API Key」中添加通用模型');

    default: {
      // 标准 OpenAI 兼容 provider（ppio / siliconflow / openai 等）
      const pc = config.providers[provider];
      const apiKey = pc?.apiKey || '';
      if (!apiKey) throw new Error(`未配置 ${provider} 的 API Key\n请在「设置 → API Key」中配置`);
      const baseUrl = (pc?.baseUrl || DEFAULT_BASE_URLS[provider] || '').replace(/\/+$/, '');
      if (!baseUrl) throw new Error(`未配置 ${provider} 的服务地址\n请在「设置 → API Key」中添加`);
      const modelName = extractModelName(model, provider);
      const dimensions = resolveImageDimensions(modelName, imageSize, aspectRatio);
      return generateImageStandardBatch({
        apiKey,
        baseUrl,
        modelName,
        prompt,
        dimensions,
        imageUrls: allImageUrls,
        imageReferenceRequestMode,
        quality: resolveOutgoingImageQuality(modelName, params.quality),
        /* 官方像素表需要原始「档位 + 比例」 */
        imageSize,
        aspectRatio,
      }, requestedCount, signal);
    }
  }
}
