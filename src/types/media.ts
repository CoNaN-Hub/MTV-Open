/** 对话助手媒体生成领域类型。 */
export type MediaKind = 'image' | 'video' | 'audio';

export type AudioGenerationPurpose = 'music' | 'speech';

export type MediaDeliveryMode = 'chat' | 'canvas' | 'both';

export interface MediaGenerationIntent {
  kind: MediaKind;
  prompt: string;
  /**
   * 画布卡片的**短标题**（模型给的，如官方那张「可爱的小猫」）。
   * 缺省时回落到 MTV 原来的固定文案（`对话生成图片` 等）。
   *
   * 依据（用户 2026 对照官方）：官方 agent 产出的图片节点文件名/标题是**模型给的短名**
   * （「一只可爱的小猫，蓬松柔软的毛发…」→「可爱的小猫」），是**概括**而不是前缀截断
   * ⇒ 客户端无法从 prompt 推导，只能由模型给。MTV 的 `canvas_create_nodes` 本来就是这个口径
   * （`label` 由模型传），只有 `media_generate` 这条链一直写死。
   */
  title?: string;
  /** GeneralModelConfig.id 或供应商模型 value。 */
  modelRef?: string;
  deliveryMode: MediaDeliveryMode;
  /** 音频生成时用于区分音乐与语音，底层仍复用音频节点执行能力。 */
  audioPurpose?: AudioGenerationPurpose;
  /** 审批前锁定的视频有效参数；缺省表示沿用模型默认。 */
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  /**
   * ★ 2026-10-15：**图片清晰度档位**（`1K` / `2K` / `4K`）—— 确认卡第三颗胶囊的落点。
   *
   * 官方语义见 `live-assets-new/vendor-packages-DRvCmDjR.js` @1095139 邻域
   * （`rq` = `NANO_BANANA_2_1`：`options:{aspectRatios:[…15 项],imageSizeOptions:["1K","2K","4K"]}`）；
   * MTV 侧此前只有「项目设置 > 模型目录默认」两个来源（`generationRuntime` 图片分支），
   * 卡上选了也传不进去 ⇒ 这里补成**请求级**参数（优先级最高，见 `generationRuntime`）。
   */
  imageSize?: string;
  /**
   * ★ 2026-10-15：**张数**（官方 `1×/2×/4×`，`p8e=[1,2,4]` @1327920，
   * `live-assets-new/vendor-pkg-canvas-CvbAwZyy.js`）。
   *
   * ⚠️ 能力边界：`generationRuntime` 的图片分支一次只产一个产物（无批量分支）；
   * 本值落到节点数据 `batchCount`，由节点侧批量链（`generationService`）在「再次生成」时生效。
   */
  times?: number;
  /** 云工作流按节点/字段映射的本轮参数。 */
  workflowInputs?: Record<string, string>;
  runninghubModelParameters?: Record<string, string>;
}

export type MediaGenerationStatus =
  | 'queued'
  | 'generating'
  | 'succeeded'
  | 'failed';

export type CanvasMaterializationStatus =
  | 'none'
  | 'pending'
  | 'created'
  | 'failed';

/**
 * 产物落盘状态，与「生成成功」严格区分：
 * - saved：已写入项目数据目录，url 指向本地文件；
 * - skipped：无项目或非桌面端，本就不该落盘；
 * - failed：生成已完成但没能保存，url 仍是签名地址或 blob 等临时地址，重启后可能失效。
 */
export type MediaPersistenceStatus = 'saved' | 'skipped' | 'failed';

export interface MediaGenerationResult {
  workflowApiOutputs?: import('./workflowApi').CloudWorkflowOutput[];
  workflowApiTaskId?: string;
  runninghubOutputs?: import('./runninghub').RunningHubOutput[];
  id: string;
  kind: MediaKind;
  deliveryMode: MediaDeliveryMode;
  /** 优先为项目本地 asset URL；Web 模式或落盘失败时为 sourceUrl。 */
  url: string;
  sourceUrl: string;
  filePath?: string;
  /** 落盘状态；failed 时 url 是临时地址，需要提示用户重试保存。 */
  persistence: MediaPersistenceStatus;
  /** persistence 为 failed 时的原因。 */
  persistError?: string;
  prompt: string;
  modelId: string;
  provider: string;
  width?: number;
  height?: number;
  audioPurpose?: AudioGenerationPurpose;
  createdAt: number;
}

export interface ResolvedMediaModel {
  configId: string;
  requestModel: string;
  provider: string;
  audioPurpose?: AudioGenerationPurpose;
  /** 选中的是 ComfyUI 工作流时带上，生成入口据此走本地工作流 */
  workflowId?: string;
}
