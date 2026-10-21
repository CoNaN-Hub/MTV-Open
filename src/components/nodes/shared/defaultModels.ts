/**
 * defaultModels 默认模型配置 — 按类型（文本/图像/视频/音频）定义各厂商预置模型列表和分组
 */
import type {
  AppConfig,
  GeneralModelCategory,
  GeneralModelConfig,
  ModelGroup,
  ModelOption,
  NodeType,
  ProviderModelSelection,
  WorkflowCategory,
  WorkflowDefinition,
} from '../../../types';
import { CATEGORY_TO_NODE_TYPES, GENERAL_MODEL_CATEGORY_LABELS } from '../../../types';
import { RUNNINGHUB_MODEL_MANIFEST, isLegacyRunningHubModel, getRunningHubModel, normalizeRunningHubModelId } from '../../../services/ai/providers/runninghubModelManifest';
import { isRunningHubWorkflow, workflowExecution } from '../../../services/workflowExecutionService';
import { DREAMINA_IMAGE_MODELS, DREAMINA_VIDEO_MODELS } from '../../../services/ai/dreaminaModels';
import { APIMART_OMNI_MODELS, isLegacyApimartOmni, replaceLegacyApimartOmni } from '../../../services/ai/apimartVideoModels';
import {
  applyCandidateAvailability,
  connectionCandidateAvailability,
  connectionLabel,
  upstreamModelIdOf,
} from '../../../services/ai/providerEntitlements';

export type MediaModelKind = 'image' | 'video' | 'audio';

type ProviderModelVisibilityConfig = Pick<AppConfig, 'providers' | 'dreaminaAuth'>;

export interface MediaModelOption extends ModelOption {
  providerConfigId?: string;
  mediaKind: MediaModelKind;
  groupId: string;
  groupName: string;
  /** ComfyUI 工作流才有；生成入口据此走本地工作流而不是接口模型 */
  workflowId?: string;
}

const runningHubModelOptions: ModelOption[] = RUNNINGHUB_MODEL_MANIFEST.map((model) => ({
  value: `runninghub/${model.id}`, provider: 'runninghub', label: model.label,
  description: `${model.id} · ${model.parameters.filter((field) => field.binding && field.binding !== 'prompt').map((field) => field.name).join(' / ') || '文本输入'}`,
  iconType: 'badge', badgeText: 'RH', nodeTypes: [`ai-${model.kind}`], audioPurpose: model.audioPurpose,
}));

const WORKFLOW_MEDIA_KIND: Partial<Record<WorkflowCategory, MediaModelKind>> = {
  'ai-image': 'image',
  'ai-video': 'video',
  'ai-audio': 'audio',
};

export const defaultModelGroups: ModelGroup[] = [
  // ========================================
  // 文本生成模型
  // ========================================
  {
    id: 'apimart',
    name: 'APIMart',
    description: '一个 API 搞定一切——节省 30-70%',
    iconType: 'badge',
    badgeText: 'AM',
    models: [
      // ── 文本模型 ──
      {
        value: 'apimart/gpt-5.4',
        provider: 'apimart',
        label: 'GPT-5.4',
        description: '极致逻辑与推理性能',
        iconType: 'badge',
        badgeText: 'OA',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/gpt-5.2',
        provider: 'apimart',
        label: 'GPT-5.2',
        description: '最新旗舰，顶尖推理与代码能力',
        iconType: 'badge',
        badgeText: 'OA',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/gpt-5',
        provider: 'apimart',
        label: 'GPT-5',
        description: 'OpenAI 旗舰模型，增强推理',
        iconType: 'badge',
        badgeText: 'OA',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/gpt-4o',
        provider: 'apimart',
        label: 'GPT-4o',
        description: '多模态旗舰，平衡性能与成本',
        iconType: 'badge',
        badgeText: 'OA',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/claude-opus-4-7',
        provider: 'apimart',
        label: 'Claude Opus 4.7',
        description: 'Anthropic 最强推理模型',
        iconType: 'badge',
        badgeText: 'AN',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/claude-sonnet-4-6',
        provider: 'apimart',
        label: 'Claude Sonnet 4.6',
        description: '高性价比复杂推理',
        iconType: 'badge',
        badgeText: 'AN',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/gemini-3.5-flash',
        provider: 'apimart',
        label: 'Gemini 3.5 Flash',
        description: 'Google 最新多模态模型',
        iconType: 'badge',
        badgeText: 'GG',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/gemini-3.1-pro-preview',
        provider: 'apimart',
        label: 'Gemini 3.1 Pro',
        description: 'Google 旗舰推理模型',
        iconType: 'badge',
        badgeText: 'GG',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/deepseek-v4-pro',
        provider: 'apimart',
        label: 'DeepSeek V4 Pro',
        description: 'DeepSeek 最强模型，超长上下文',
        iconType: 'badge',
        badgeText: 'DS',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/kimi-k2.5',
        provider: 'apimart',
        label: 'Kimi K2.5',
        description: '月之暗面最新版，超长上下文',
        iconType: 'badge',
        badgeText: 'KM',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/kimi-k2-instruct',
        provider: 'apimart',
        label: 'Kimi K2',
        description: '月之暗面指令遵循模型',
        iconType: 'badge',
        badgeText: 'KM',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/glm-5.1',
        provider: 'apimart',
        label: 'GLM-5.1',
        description: '智谱最新大语言模型',
        iconType: 'badge',
        badgeText: 'GL',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/minimax-m2.5',
        provider: 'apimart',
        label: 'MiniMax M2.5',
        description: 'MiniMax 大语言模型',
        iconType: 'badge',
        badgeText: 'MM',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'apimart/o4-mini',
        provider: 'apimart',
        label: 'o4-mini',
        description: 'OpenAI 推理模型，高性价比',
        iconType: 'badge',
        badgeText: 'OA',
        nodeTypes: ['ai-text'],
      },
      // ── 图片模型 ──
      {
        value: 'apimart/gemini-3.1-flash-image-preview',
        provider: 'apimart',
        label: 'Nano Banana 3.1',
        description: '最新 Nano Banana，最高画质',
        iconType: 'badge',
        badgeText: 'NB',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/gemini-3-pro-image-preview',
        provider: 'apimart',
        label: 'Nano Banana Pro',
        description: '专业级画质，光影渲染深度优化',
        iconType: 'badge',
        badgeText: 'NP',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/gemini-2.5-flash-image-preview',
        provider: 'apimart',
        label: 'Nano Banana',
        description: '极速版，支持独特创意风格呈现',
        iconType: 'badge',
        badgeText: 'ND',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/gpt-image-2.5-flare',
        provider: 'apimart',
        label: 'GPT Image 2.5 Flare',
        description: '快速图像生成与编辑，支持最多 16 张参考图',
        iconType: 'badge',
        badgeText: 'AM',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/gpt-image-2.5-sunburst',
        provider: 'apimart',
        label: 'GPT Image 2.5 Sunburst',
        description: '精细图像编辑，支持最多 16 张参考图',
        iconType: 'badge',
        badgeText: 'AM',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/gpt-image-2',
        provider: 'apimart',
        label: 'GPT Image 2',
        description: 'OpenAI 图像生成，支持文生图与图生图',
        iconType: 'badge',
        badgeText: 'AM',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/imagen-4.0-apimart',
        provider: 'apimart',
        label: 'Imagen 4.0',
        description: 'Google 旗舰图像生成模型',
        iconType: 'badge',
        badgeText: 'GG',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/flux-2-pro',
        provider: 'apimart',
        label: 'Flux 2 Pro',
        description: 'Black Forest Labs 专业级生图',
        iconType: 'badge',
        badgeText: 'FL',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/qwen-image-2.0-pro',
        provider: 'apimart',
        label: 'Qwen Image 2.0 Pro',
        description: '通义千问专业图像生成',
        iconType: 'badge',
        badgeText: 'QW',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/z-image-turbo',
        provider: 'apimart',
        label: 'Z-Image-Turbo',
        description: '轻量快速生图，支持智能改写',
        iconType: 'badge',
        badgeText: 'ZI',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/grok-imagine-1.0-apimart',
        provider: 'apimart',
        label: 'Grok Imagine',
        description: 'xAI 图像生成模型',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/midjourney',
        provider: 'apimart',
        label: 'Midjourney',
        description: 'Midjourney 图像生成',
        iconType: 'badge',
        badgeText: 'MJ',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/wan2.7-image-pro',
        provider: 'apimart',
        label: 'Wan 2.7 Pro',
        description: '进阶文生图与图像编辑',
        iconType: 'badge',
        badgeText: 'WA',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/doubao-seedream-4.0',
        provider: 'apimart',
        label: 'Seedream 4.0',
        description: '灵活图像功能，支持高分辨率',
        iconType: 'badge',
        badgeText: 'SD',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/doubao-seedream-4.5',
        provider: 'apimart',
        label: 'Seedream 4.5',
        description: '性能均衡的多模式图像生成',
        iconType: 'badge',
        badgeText: 'SD',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'apimart/doubao-seedream-5.0-lite',
        provider: 'apimart',
        label: 'Seedream 5.0 Lite',
        description: '轻量高效生图，支持 2K/3K',
        iconType: 'badge',
        badgeText: 'SD',
        nodeTypes: ['ai-image'],
      },
      // ── 视频模型 ──
      {
        value: 'apimart/doubao-seedance-2.0-fast',
        provider: 'apimart',
        label: '豆包视频 2.0 Fast',
        description: 'Seedance 2.0 快速视频生成',
        iconType: 'badge',
        badgeText: 'DB',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/doubao-seedance-2.0',
        provider: 'apimart',
        label: '豆包视频 2.0',
        description: 'Seedance 2.0 高质量视频生成',
        iconType: 'badge',
        badgeText: 'DB',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/doubao-seedance-2.0-mini',
        provider: 'apimart',
        label: '豆包视频 2.0 Mini',
        description: 'Seedance 2.0 轻量视频生成',
        iconType: 'badge',
        badgeText: 'DB',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/doubao-seedance-2.5',
        provider: 'apimart',
        label: '豆包视频 2.5',
        description: 'Seedance 2.5 视频生成，4-30s，多模态/编辑/延长/首尾帧，480p/720p',
        iconType: 'badge',
        badgeText: 'DB',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/doubao-seedance-1-5-pro',
        provider: 'apimart',
        label: '豆包视频 1.5 Pro',
        description: '专业视频生成，支持有声输出',
        iconType: 'badge',
        badgeText: 'DB',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/doubao-seedance-1-0-pro-quality',
        provider: 'apimart',
        label: '豆包视频 1.0 Pro Quality',
        description: 'Seedance 1.0 高质量视频生成',
        iconType: 'badge',
        badgeText: 'DB',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/doubao-seedance-1-0-pro-fast',
        provider: 'apimart',
        label: '豆包视频 1.0 Pro Fast',
        description: 'Seedance 1.0 快速视频生成',
        iconType: 'badge',
        badgeText: 'DB',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/sora-2',
        provider: 'apimart',
        label: 'Sora 2',
        description: 'OpenAI 视频生成旗舰模型',
        iconType: 'badge',
        badgeText: 'OA',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/veo3.1-quality',
        provider: 'apimart',
        label: 'Veo 3.1',
        description: 'Google 高质量视频生成',
        iconType: 'badge',
        badgeText: 'GG',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/kling-v3',
        provider: 'apimart',
        label: 'Kling V3',
        description: '可灵最新视频生成模型',
        iconType: 'badge',
        badgeText: 'KL',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/MiniMax-Hailuo-2.3',
        provider: 'apimart',
        label: '海螺 2.3',
        description: 'MiniMax 视频生成旗舰版',
        iconType: 'badge',
        badgeText: 'HL',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/MiniMax-H3',
        provider: 'apimart',
        label: 'MiniMax H3',
        description: 'MiniMax 视频生成，支持文生/图生/首尾帧/多模态参考，2K/768P，4-15s',
        iconType: 'badge',
        badgeText: 'MM',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/MiniMax-H3-Context-IR',
        provider: 'apimart',
        label: 'MiniMax H3 Context-IR',
        description: 'MiniMax H3 提示词增强版，上下文感知重写提示词后生成视频',
        iconType: 'badge',
        badgeText: 'MM',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/MiniMax-H3-Regeneration',
        provider: 'apimart',
        label: 'MiniMax H3 Regeneration',
        description: 'MiniMax H3 重生成版，基于已有视频片段重新生成',
        iconType: 'badge',
        badgeText: 'MM',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/wan2.7',
        provider: 'apimart',
        label: 'Wan 2.7',
        description: '万兴视频生成，高画质输出',
        iconType: 'badge',
        badgeText: 'WA',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/skyreels-v4-std',
        provider: 'apimart',
        label: 'SkyReels V4',
        description: 'SkyReels 视频生成模型',
        iconType: 'badge',
        badgeText: 'SR',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'apimart/viduq3-pro',
        provider: 'apimart',
        label: 'Vidu Q3 Pro',
        description: 'Vidu 专业级视频生成',
        iconType: 'badge',
        badgeText: 'VD',
        nodeTypes: ['ai-video'],
      },
      ...APIMART_OMNI_MODELS.map((model): ModelOption => ({
        value: `apimart/${model.id}`, provider: 'apimart', label: model.name,
        description: model.description, iconType: 'badge', badgeText: 'GO', nodeTypes: ['ai-video'],
      })),
      // ── 音频模型 ──
      {
        value: 'apimart/gpt-4o-mini-tts',
        provider: 'apimart',
        label: 'GPT-4o Mini TTS',
        description: 'OpenAI 文字转语音，高性价比',
        iconType: 'badge',
        badgeText: 'OA',
        nodeTypes: ['ai-audio'],
        audioPurpose: 'speech',
      },
      {
        value: 'apimart/flowmusic',
        provider: 'apimart',
        label: 'Flow Music',
        description: '提示词或歌词生成音乐，支持 BPM 与时长控制',
        iconType: 'badge',
        badgeText: 'FM',
        nodeTypes: ['ai-audio'],
        audioPurpose: 'music',
      },
    ],
  },
  {
    id: 'volcengine',
    name: '火山方舟',
    description: 'Ark Seedream 图像生成 API',
    iconType: 'badge',
    badgeText: 'V',
    models: [
      // --- 文本模型 ---
      {
        value: 'volcengine/doubao-seed-2-0-pro-260215',
        provider: 'volcengine',
        label: 'doubao-seed-2-0-pro',
        description: '适合复杂文本生成与推理',
        iconType: 'badge',
        badgeText: 'DB',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'volcengine/doubao-seed-2-0-lite-260428',
        provider: 'volcengine',
        label: 'doubao-seed-2-0-lite',
        description: '适合高频文本任务',
        iconType: 'badge',
        badgeText: 'DL',
        nodeTypes: ['ai-text'],
      },
      // --- 图片模型 ---
      {
        value: 'volcengine/doubao-seedream-5-0-pro-260628',
        provider: 'volcengine',
        label: 'Seedream 5.0 Pro',
        description: '旗舰生图模型，支持文生图/组图/多图参考，1K/2K',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'volcengine/doubao-seedream-5-0-lite-260128',
        provider: 'volcengine',
        label: 'Seedream 5.0 Lite',
        description: '轻量高效生图，支持 2K/3K/4K，输入+输出 ≤15 张',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'volcengine/doubao-seedream-4-5-251128',
        provider: 'volcengine',
        label: 'Seedream 4.5',
        description: '性能均衡的多模式图像生成，2K/4K',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'volcengine/doubao-seedream-4-0-250828',
        provider: 'volcengine',
        label: 'Seedream 4.0',
        description: '经典 Seedream 生图，支持 1K/2K/4K，可选极速模式',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-image'],
      },
      // --- 视频模型 ---
      {
        value: 'volcengine/doubao-seedance-2-0-260128',
        provider: 'volcengine',
        label: 'Seedance 2.0',
        description: '旗舰视频生成模型，支持多模态输入，4-15s',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'volcengine/doubao-seedance-2-0-fast-260128',
        provider: 'volcengine',
        label: 'Seedance 2.0 Fast',
        description: '快速视频生成，性能与质量平衡，4-15s',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'volcengine/doubao-seedance-2-0-mini-260615',
        provider: 'volcengine',
        label: 'Seedance 2.0 Mini',
        description: '轻量视频生成模型，4-15s',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'volcengine/doubao-seedance-2-5-260628',
        provider: 'volcengine',
        label: 'Seedance 2.5',
        description: '新一代视频生成，4-30s，多模态/编辑/延长/首尾帧，480p/720p',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'volcengine/doubao-seedance-1-5-pro-251215',
        provider: 'volcengine',
        label: 'Seedance 1.5 Pro',
        description: '专业视频生成，支持样片模式/离线推理，4-12s',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'volcengine/doubao-seedance-1-0-pro-250528',
        provider: 'volcengine',
        label: 'Seedance 1.0 Pro',
        description: '经典种子舞蹈视频生成，2-12s',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-video'],
      },
      {
        value: 'volcengine/doubao-seedance-1-0-pro-fast-251015',
        provider: 'volcengine',
        label: 'Seedance 1.0 Pro Fast',
        description: '快速经典视频生成，2-12s',
        iconType: 'badge',
        badgeText: 'V',
        nodeTypes: ['ai-video'],
      },
    ],
  },

  // ========================================
  // 其他内置供应商
  // ========================================

  // --- GRSAI ---
  {
    id: 'grsai',
    name: 'GRSAI',
    description: '图像生成与多模态文本模型服务',
    iconType: 'badge',
    badgeText: 'GR',
    models: [
      // --- 图片模型 ---
      {
        value: 'grsai/gpt-image-2',
        provider: 'grsai',
        label: 'GPT Image 2',
        description: 'OpenAI 图像生成，支持文生图与图生图',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/gpt-image-2-vip',
        provider: 'grsai',
        label: 'GPT Image 2 VIP',
        description: 'GPT Image 2 高优先级图像生成',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-pro',
        provider: 'grsai',
        label: 'Nano Banana Pro',
        description: '专业增强图像生成，支持最高 4K',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-2',
        provider: 'grsai',
        label: 'Nano Banana 2',
        description: '第二代图像生成，支持最高 4K',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-2-lite',
        provider: 'grsai',
        label: 'Nano Banana 2 Lite',
        description: '轻量快速图像生成',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-pro-vt',
        provider: 'grsai',
        label: 'Nano Banana Pro VT',
        description: 'Nano Banana Pro VT 图像生成',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-fast',
        provider: 'grsai',
        label: 'Nano Banana Fast',
        description: '快速图像生成与编辑',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-2-cl',
        provider: 'grsai',
        label: 'Nano Banana 2 CL',
        description: 'Nano Banana 2 CL 图像生成',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-pro-cl',
        provider: 'grsai',
        label: 'Nano Banana Pro CL',
        description: 'Nano Banana Pro CL 图像生成',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-2-2k-cl',
        provider: 'grsai',
        label: 'Nano Banana 2 2K CL',
        description: '固定 2K 图像生成',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-pro-4k-vip',
        provider: 'grsai',
        label: 'Nano Banana Pro 4K VIP',
        description: '高优先级 4K 图像生成',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-pro-vip',
        provider: 'grsai',
        label: 'Nano Banana Pro VIP',
        description: '高优先级专业图像生成',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'grsai/nano-banana-2-4k-cl',
        provider: 'grsai',
        label: 'Nano Banana 2 4K CL',
        description: '固定 4K 图像生成',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-image'],
      },
      // --- 文本模型 ---
      {
        value: 'grsai/gpt-5.4',
        provider: 'grsai',
        label: 'GPT-5.4',
        description: 'OpenAI 文本生成与推理模型',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'grsai/gpt-5.5',
        provider: 'grsai',
        label: 'GPT-5.5',
        description: 'OpenAI 高性能文本生成与推理模型',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'grsai/gemini-3.1-flash-lite',
        provider: 'grsai',
        label: 'Gemini 3.1 Flash Lite',
        description: '轻量多模态对话与推理模型',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'grsai/gemini-3.1-pro',
        provider: 'grsai',
        label: 'Gemini 3.1 Pro',
        description: '专业多模态对话与推理模型',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'grsai/gemini-3.5-flash',
        provider: 'grsai',
        label: 'Gemini 3.5 Flash',
        description: '快速多模态对话与推理模型',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'grsai/gemini-3-flash',
        provider: 'grsai',
        label: 'Gemini 3 Flash',
        description: '快速多模态对话模型',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'grsai/gemini-3-pro',
        provider: 'grsai',
        label: 'Gemini 3 Pro',
        description: '专业多模态对话与推理模型',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'grsai/gemini-2.5-flash',
        provider: 'grsai',
        label: 'Gemini 2.5 Flash',
        description: '高效多模态对话模型',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-text'],
      },
      {
        value: 'grsai/gemini-2.5-pro',
        provider: 'grsai',
        label: 'Gemini 2.5 Pro',
        description: '旗舰多模态对话与推理模型',
        iconType: 'badge',
        badgeText: 'GR',
        nodeTypes: ['ai-text'],
      },
    ],
  },

  // --- 即梦/Dreamina ---
  {
    id: 'dreamina',
    name: '即梦',
    description: '官方 OAuth 登录，自动文生图/图生图/视频',
    iconType: 'badge',
    badgeText: 'JM',
    models: [
      ...DREAMINA_IMAGE_MODELS.map((model) => ({
        value: `dreamina/${model.version}`,
        provider: 'dreamina',
        label: model.label,
        description: model.description,
        iconType: 'badge' as const,
        badgeText: 'JM',
        nodeTypes: ['ai-image' as const],
      })),
      ...DREAMINA_VIDEO_MODELS.map((model) => ({
        value: `dreamina/${model.version}`,
        provider: 'dreamina',
        label: model.label,
        description: model.description,
        iconType: 'badge' as const,
        badgeText: 'JM',
        nodeTypes: ['ai-video' as const],
      })),
    ],
  },

  // --- RunningHUB 模型 ---
  {
    id: 'runninghub',
    name: 'RunningHUB模型',
    description: '模型 API：文生图/图生图/图片编辑',
    iconType: 'badge',
    badgeText: 'RH',
    models: [
      ...runningHubModelOptions,
      {
        value: 'runninghub/nanobanana',
        provider: 'runninghub',
        label: 'NanoBanana',
        description: '基础图像生成模型，版本可在模式中切换',
        iconType: 'badge',
        badgeText: 'NB',
        nodeTypes: ['ai-image'],
        nbFamily: 'nanobanana',
      },
      {
        value: 'runninghub/nanobanana-pro',
        provider: 'runninghub',
        label: 'BananaPRO',
        description: '专业级画质，版本可在模式中切换',
        iconType: 'badge',
        badgeText: 'BP',
        nodeTypes: ['ai-image'],
        nbFamily: 'nanobanana-pro',
      },
      {
        value: 'runninghub/nanobanana-2',
        provider: 'runninghub',
        label: 'Banana2',
        description: '新一代图像模型，版本可在模式中切换',
        iconType: 'badge',
        badgeText: 'B2',
        nodeTypes: ['ai-image'],
        nbFamily: 'nanobanana-2',
      },
      {
        value: 'runninghub/gpt-image-2',
        provider: 'runninghub',
        label: 'GPT image 2',
        description: 'OpenAI 图像生成模型，版本可在模式中切换',
        iconType: 'badge',
        badgeText: 'RH',
        nodeTypes: ['ai-image'],
        nbFamily: 'gpt-image-2',
      },
      {
        value: 'runninghub-model/youchuan-v81',
        provider: 'runninghub',
        label: 'Midjourney V8.1',
        description: 'RunningHub Midjourney 文生图 V8.1，支持主图和风格参考图',
        iconType: 'badge',
        badgeText: 'RH',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'runninghub-model/youchuan-v7',
        provider: 'runninghub',
        label: 'Midjourney V7',
        description: 'RunningHub Midjourney 文生图 V7，支持主图和风格参考图',
        iconType: 'badge',
        badgeText: 'RH',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'runninghub-model/youchuan-v6',
        provider: 'runninghub',
        label: 'Midjourney V6',
        description: 'RunningHub Midjourney 文生图 V6，支持主图、角色参考图和风格参考图',
        iconType: 'badge',
        badgeText: 'RH',
        nodeTypes: ['ai-image'],
      },
    ],
  },

  // --- RunningHUB 工作流 ---
  {
    id: 'runninghubwf',
    name: 'RunningHUB工作流',
    description: '工作流模板：替换/风格迁移，结果更可控',
    iconType: 'badge',
    badgeText: 'RW',
    models: [
      {
        value: 'runninghub/2041177685895946242',
        provider: 'runninghubwf',
        label: '人物替换图片编辑V3',
        description: '双图人物替换，支持目标/被替换图遮罩',
        iconType: 'badge',
        badgeText: 'RW',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'runninghub/2050313968069165058',
        provider: 'runninghubwf',
        label: '人物替换V2.1',
        description: '双图人物替换，支持目标/被替换图遮罩',
        iconType: 'badge',
        badgeText: 'RW',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'runninghub/1994718111704158209',
        provider: 'runninghubwf',
        label: '漫画转真人',
        description: '基于工作流把二次元角色转写实人像',
        iconType: 'badge',
        badgeText: 'RW',
        nodeTypes: ['ai-image'],
      },
      {
        value: 'runninghub/2050306122774532097',
        provider: 'runninghubwf',
        label: 'Qwen-图像编辑',
        description: '多图指令编辑，适合人物/产品一致性、文字修改与姿势/深度控制',
        iconType: 'badge',
        badgeText: 'RW',
        nodeTypes: ['ai-image'],
      },
    ],
  },
];

function modelCategoryForNodeType(nodeType: NodeType): GeneralModelCategory | null {
  if (nodeType === 'ai-text') return 'text';
  if (nodeType === 'ai-image' || nodeType === 'ai-animation' || nodeType === 'ai-panorama') return 'image';
  if (nodeType === 'ai-video') return 'video';
  if (nodeType === 'ai-audio') return 'audio';
  return null;
}

function normalizedCatalogModelId(value: string, provider: string): string {
  if (provider === 'runninghub') return normalizeRunningHubModelId(value).toLowerCase();
  const providerPrefix = `${provider}/`;
  const modelId = value.startsWith(providerPrefix) ? value.slice(providerPrefix.length) : value;
  return modelId.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function providerConfigIdForGroup(groupId: string): string {
  return groupId === 'runninghub' ? 'runninghub-model' : groupId;
}

/**
 * ★ P2：把「**这条连接的 key 在上游能用哪些模型**」投影到候选表上。
 *
 * 数据来源是 `services/ai/providerEntitlements.ts` 的连接级权益（权威清单取自带 Key 的
 * `/v1/models`；分组开放矩阵取自匿名 `/api/pricing`，**只用于解释/佐证，绝不当"可用"的依据**）。
 *
 * 三件事：
 *   ① **标注连接**：每个候选写上 `connectionId` / `connectionName` ——
 *      两条连接都接了 `gpt-4o` 时，下拉里才分得清「选得到」的那一条能不能发出去；
 *   ② **标注可用性**：不在权威清单里的置 `unavailable`（下拉加标记、确认前出劝告）；
 *   ③ **裁剪**：只有**三重证据齐全**（不在清单 + 上游认识它 + 当时分组门关着）才真的删，
 *      且**永不清空**（删空就退回只标注）——空下拉是已知事故，见 `isProviderCategoryVisible`。
 *
 * ⚠️ **`models` 必须是「同一条连接」的完整候选**：③ 的「永不清空」是**按连接**判的。
 *    一次只传一个模型进来，守卫会永远触发（每个模型都"删空了"）⇒ 裁剪形同虚设。
 *
 * 拿不到任何数据 ⇒ 原样返回（退回现状，**不阻断**）。
 */
function withConnectionAvailability<T extends ModelOption>(
  models: T[],
  config: ProviderModelVisibilityConfig,
  providerConfigId: string | undefined,
  upstreamIdOf: (model: T) => string,
  options: { trim?: boolean } = {},
): T[] {
  if (!providerConfigId) return models;
  const connection = config.providers[providerConfigId];
  const availability = connectionCandidateAvailability(connection, providerConfigId);
  const label = connectionLabel(config, providerConfigId);
  const annotated = models.map((model) => ({
    ...model,
    connectionId: providerConfigId,
    connectionName: label,
  }));
  return applyCandidateAvailability(annotated, availability, upstreamIdOf, options);
}

/** 把候选按 `providerConfigId` 分桶（同一桶一起判「永不清空」）。 */
function bucketIndexesByConnection<T extends ModelOption>(
  entries: ReadonlyArray<{ option: T; connectionId: string | undefined }>,
): Map<string, number[]> {
  const buckets = new Map<string, number[]>();
  entries.forEach((entry, index) => {
    if (!entry.connectionId) return;
    const list = buckets.get(entry.connectionId);
    if (list) list.push(index);
    else buckets.set(entry.connectionId, [index]);
  });
  return buckets;
}

function createConfiguredModelOption(
  group: ModelGroup,
  model: ProviderModelSelection,
): ModelOption {
  const provider = group.models[0]?.provider || group.id;
  const value = model.id.startsWith(`${provider}/`)
    ? model.id
    : `${provider}/${model.id}`;
  return {
    value,
    provider,
    label: model.name,
    description: model.description || '',
    inputModalities: model.inputModalities,
    icon: group.icon,
    iconType: group.iconType,
    badgeText: group.badgeText,
    nodeTypes: CATEGORY_TO_NODE_TYPES[model.category],
  };
}

export function isProviderCategoryVisible(
  config: ProviderModelVisibilityConfig,
  providerConfigId: string | undefined,
  category: GeneralModelCategory,
): boolean {
  if (!providerConfigId) return true;
  const provider = config.providers[providerConfigId];
  if (!provider) return false;
  const visible = provider.visibleModelCategories;
  /* ★★★ 用户 2026：「更新自定义土豆厂商的模型选择后 **选择模型按钮的弹窗失效了**」
     实测该连接的 `visibleModelCategories` 被存成了**空数组**：
       `[].includes('image') === false` ⇒ 这个连接的**所有模型全被滤掉** ⇒ 下拉是空的
       （现场量到 `.model-dropdown` 280×16、`children: 0`、触发按钮只显示「选择模型」）。
     空数组在这里只可能是「**写入时模型列表还是空的**」（Agent 先建连接、用户后补模型；
     合并分支原样保留了这个空数组）—— 它不是「一个都不显示」的有效意图：
     那会让该连接彻底不可用，而且**画布上没有任何入口能救回来**（只能去设置里重新勾分类）。
     ⇒ 空数组与 `undefined` 同义：**不限制**。这样已经写坏的老数据能自愈。 */
  if (!Array.isArray(visible) || visible.length === 0) return true;
  return visible.includes(category);
}

interface ConfiguredModelGroupOptions {
  /** Special-purpose model groups may use adapter-specific IDs that are not catalog IDs. */
  filterSelectedModels?: boolean;
}

/**
 * Apply provider connection, selected-model and per-category visibility rules to a node model menu.
 * Missing providers are removed instead of being rendered as permanently locked groups.
 */
export function getConfiguredModelGroups(
  config: ProviderModelVisibilityConfig,
  nodeType: NodeType,
  groups: ModelGroup[] = defaultModelGroups,
  options: ConfiguredModelGroupOptions = {},
): ModelGroup[] {
  const modelNodeType = nodeType === 'ai-animation' || nodeType === 'ai-panorama'
    ? 'ai-image'
    : nodeType;
  const category = modelCategoryForNodeType(nodeType);
  if (!category) return [];
  const filterSelectedModels = options.filterSelectedModels ?? true;

  return groups.flatMap((group) => {
    if (group.id === 'runninghubwf') {
      // 旧条目仅有远端 ID、没有参数合同；保留 ID 识别，但不作为可运行选项展示。
      return [];
    }

    const providerConfigId = providerConfigIdForGroup(group.id);
    const provider = config.providers[providerConfigId];
    const dreaminaLegacyConnection = group.id === 'dreamina' && !!config.dreaminaAuth?.loggedIn;
    if (!provider && !dreaminaLegacyConnection) return [];
    if (group.id !== 'dreamina' && !provider?.apiKey) return [];
    if (provider && !isProviderCategoryVisible(config, providerConfigId, category)) return [];

    const modelProvider = group.models[0]?.provider || group.id;
    const selectedModels = group.id === 'apimart'
      ? replaceLegacyApimartOmni(provider?.selectedModels)
      : provider?.selectedModels;
    const selectedIds = selectedModels === undefined
      ? null
      : new Set(selectedModels.map((model) => normalizedCatalogModelId(model.id, modelProvider)));
    const models = group.models.filter((model) => {
      if (group.id === 'runninghub' && filterSelectedModels && selectedIds === null && !isLegacyRunningHubModel(model.value)) return false;
      if (!model.nodeTypes.includes(modelNodeType)) return false;
      if (!filterSelectedModels || selectedIds === null) return true;
      return selectedIds.has(normalizedCatalogModelId(model.value, modelProvider));
    }).map((model) => {
      const selected = selectedModels?.find(
        (candidate) => normalizedCatalogModelId(candidate.id, modelProvider)
          === normalizedCatalogModelId(model.value, modelProvider),
      );
      return selected
        ? {
            ...model,
            description: selected.description || model.description,
            inputModalities: selected.inputModalities,
          }
        : model;
    });
    if (filterSelectedModels && selectedModels) {
      const configuredIds = new Set(
        models.map((model) => normalizedCatalogModelId(model.value, modelProvider)),
      );
      for (const selectedModel of selectedModels) {
        const normalizedId = normalizedCatalogModelId(selectedModel.id, modelProvider);
        if (selectedModel.category !== category || configuredIds.has(normalizedId)) continue;
        if (group.id === 'runninghub' && !getRunningHubModel(selectedModel.id)) continue;
        models.push(createConfiguredModelOption(group, selectedModel));
        configuredIds.add(normalizedId);
      }
    }
    /* ★ P2：标注「走哪条连接」+「该连接的 key 能不能用」。
       内置分组**只标注不裁剪** —— 这里的候选本来就来自带 Key 的 `/v1/models`
       （`selectedModels` 是用户从那份权威清单里勾的），再裁一遍只会把用户勾过的东西弄丢。 */
    const withAvailability = withConnectionAvailability(
      models,
      config,
      providerConfigId,
      (model) => upstreamModelIdOf(model.value),
    );
    return withAvailability.length > 0 ? [{ ...group, models: withAvailability }] : [];
  });
}

/**
 * 自定义连接的模型都挤在同一个「通用模型」分组里，只显示模型名的话，
 * 两个中转站都接了 gpt-4o 就分不出是哪家；把连接名写进说明作为区分依据。
 */
function describeGeneralModel(
  model: GeneralModelConfig,
  config?: ProviderModelVisibilityConfig,
): string {
  const connectionName = config?.providers[model.providerConfigId]?.name?.trim();
  const detail = model.description?.trim() || '';
  return connectionName ? `${connectionName} · ${detail}` : detail;
}

interface GeneralModelGroupPresentation {
  id: string;
  name: string;
  description: string;
  badgeText: string;
}

function dedicatedGeneralModelGroup(
  model: GeneralModelConfig,
  config?: ProviderModelVisibilityConfig,
): GeneralModelGroupPresentation | null {
  const provider = config?.providers[model.providerConfigId];
  const catalogId = provider?.catalogId || model.providerConfigId;
  if (catalogId === 'sora2u') {
    return {
      id: `general-provider-${model.providerConfigId}`,
      name: 'Sora2U',
      description: 'Seedance 视频与图片模型',
      badgeText: 'S2U',
    };
  }
  if (catalogId === 'cccapi') {
    return {
      id: `general-provider-${model.providerConfigId}`,
      name: 'CCC API',
      description: 'OpenAI 兼容文本与图片模型',
      badgeText: 'CCC',
    };
  }
  return null;
}

function createGeneralModelOption(model: GeneralModelConfig): ModelOption {
  return {
    value: `general/${model.id}`,
    provider: 'general',
    label: model.name,
    description: '',
    inputModalities: model.inputModalities,
    iconType: 'badge',
    badgeText: GENERAL_MODEL_CATEGORY_LABELS[model.category].slice(0, 2),
    nodeTypes: CATEGORY_TO_NODE_TYPES[model.category],
  };
}

export function getGeneralModelGroups(
  generalModels: GeneralModelConfig[],
  config: ProviderModelVisibilityConfig,
  nodeType: NodeType,
  labels: { genericName?: string; genericDescription?: string } = {},
): ModelGroup[] {
  const visible = generalModels.filter((model) => (
    CATEGORY_TO_NODE_TYPES[model.category].includes(nodeType)
    && isProviderCategoryVisible(config, model.providerConfigId, model.category)
  ));

  /* ★ P2：自定义连接是「选得到、发不出去」的**真正缺口** ——
     `generalModels` 是用户手填的条目，**不经过**带 Key 的 `/v1/models` 过滤。
     上游 id 是 `model.modelId`（**不是** `general/<配置 id>`），所以要单独建一张 value→上游 id 的表；
     并且必须**按连接整批**交给可用性逻辑，否则「永不清空」的守卫会退化成永不裁剪。 */
  const upstreamIdByValue = new Map<string, string>();
  const prepared = visible.map((model) => {
    const option = createGeneralModelOption(model);
    upstreamIdByValue.set(option.value, model.modelId);
    return { model, option, presentation: dedicatedGeneralModelGroup(model, config) };
  });
  /* `resolved[i] === undefined` = **被裁掉**（不是"没处理"，没处理的项保留原对象）。
     ⚠️ 不能用「查不到就保留原项」的写法 —— 那会把刚裁掉的模型**又加回去** ✗（已实测踩到）。 */
  const resolved: Array<ModelOption | undefined> = prepared.map((entry) => entry.option);
  const upstreamIdOf = (option: ModelOption) =>
    upstreamIdByValue.get(option.value) ?? upstreamModelIdOf(option.value);
  for (const [connectionId, indexes] of bucketIndexesByConnection(
    prepared.map((entry) => ({ option: entry.option, connectionId: entry.model.providerConfigId })),
  )) {
    const processed = withConnectionAvailability(
      indexes.map((index) => prepared[index].option),
      config,
      connectionId,
      upstreamIdOf,
      { trim: true },
    );
    const byValue = new Map(processed.map((option) => [option.value, option]));
    for (const index of indexes) {
      resolved[index] = byValue.get(prepared[index].option.value);
    }
  }

  const dedicatedGroups = new Map<string, ModelGroup>();
  const genericModels: ModelOption[] = [];
  prepared.forEach((entry, index) => {
    const option = resolved[index];
    /* 被裁掉的（`undefined`）直接跳过 */
    if (!option) return;
    if (!entry.presentation) {
      genericModels.push(option);
      return;
    }
    const group = dedicatedGroups.get(entry.presentation.id);
    if (group) group.models.push(option);
    else dedicatedGroups.set(entry.presentation.id, { ...entry.presentation, iconType: 'badge', models: [option] });
  });
  const groups = [...dedicatedGroups.values()];
  if (genericModels.length > 0) {
    groups.push({
      id: 'general-models',
      name: labels.genericName || '通用模型',
      description: labels.genericDescription || '用户自定义的兼容接口模型',
      iconType: 'badge',
      badgeText: 'GM',
      models: genericModels,
    });
  }
  return groups;
}

/** 节点与对话共用的图片/视频/音频模型目录；传入 workflows 时把 ComfyUI 工作流一并列为可选模型。 */
export function getMediaModelOptions(
  generalModels: GeneralModelConfig[] = [],
  config?: ProviderModelVisibilityConfig,
  workflows: WorkflowDefinition[] = [],
): MediaModelOption[] {
  const mediaTargets: Array<{ mediaKind: MediaModelKind; nodeType: NodeType }> = [
    { mediaKind: 'image', nodeType: 'ai-image' },
    { mediaKind: 'video', nodeType: 'ai-video' },
    { mediaKind: 'audio', nodeType: 'ai-audio' },
  ];
  const builtIn = mediaTargets.flatMap(({ mediaKind, nodeType }) => {
    const groups = config
      ? getConfiguredModelGroups(config, nodeType)
      : defaultModelGroups;
    return groups.flatMap((group) => group.models.flatMap((model) => {
      if (model.provider === 'runninghubwf' || !model.nodeTypes.includes(nodeType)) return [];
      return [{
        ...model,
        groupId: group.id,
        groupName: group.name,
        mediaKind,
      } satisfies MediaModelOption];
    }));
  });

  /* ★ P2：自定义连接是「选得到、发不出去」的**真正缺口** ——
     `generalModels` 是用户手填的条目，**不经过**带 Key 的 `/v1/models` 过滤。
     上游 id 是 `model.modelId`（**不是** `general/<配置 id>`），而且必须**按连接整批**
     交给可用性逻辑（「永不清空」的守卫要按连接判，逐条判它会永远触发 ⇒ 裁剪失效）。
     ⚠️ 过滤与映射在**同一步**完成，保证索引与 `entries` 一一对应（不能先 filter 再 map 后对下标）。 */
  const customEntries: Array<{
    option: MediaModelOption;
    upstreamId: string;
    connectionId: string | undefined;
  }> = generalModels.flatMap((model) => {
    if (model.category !== 'image' && model.category !== 'video' && model.category !== 'audio') return [];
    if (config && !isProviderCategoryVisible(config, model.providerConfigId, model.category)) return [];
    const mediaKind: MediaModelKind = model.category === 'image'
      ? 'image'
      : model.category === 'video'
        ? 'video'
        : 'audio';
    const nodeType = mediaKind === 'image'
      ? 'ai-image'
      : mediaKind === 'video'
        ? 'ai-video'
        : 'ai-audio';
    const dedicatedGroup = dedicatedGeneralModelGroup(model, config);
    const option: MediaModelOption = {
      value: `general/${model.id}`,
      provider: 'general',
      label: model.name,
      description: describeGeneralModel(model, config),
      inputModalities: model.inputModalities,
      iconType: 'badge',
      badgeText: mediaKind === 'image' ? '图' : mediaKind === 'video' ? '视' : '音',
      nodeTypes: [nodeType],
      mediaKind,
      groupId: dedicatedGroup?.id || 'general-models',
      groupName: dedicatedGroup?.name || '通用模型',
    };
    return [{ option, upstreamId: model.modelId, connectionId: model.providerConfigId }];
  });

  let custom: MediaModelOption[] = customEntries.map((entry) => entry.option);
  if (config) {
    const upstreamIdByValue = new Map(customEntries.map((entry) => [entry.option.value, entry.upstreamId]));
    /* `undefined` = 被裁掉（**不能**"查不到就保留原项"，那会把刚裁掉的又加回去 ✗） */
    const kept: Array<MediaModelOption | undefined> = customEntries.map((entry) => entry.option);
    for (const [connectionId, indexes] of bucketIndexesByConnection(customEntries)) {
      const processed = withConnectionAvailability(
        indexes.map((index) => customEntries[index].option),
        config,
        connectionId,
        (option) => upstreamIdByValue.get(option.value) ?? upstreamModelIdOf(option.value),
        { trim: true },
      );
      const byValue = new Map(processed.map((option) => [option.value, option]));
      for (const index of indexes) {
        kept[index] = byValue.get(customEntries[index].option.value);
      }
    }
    custom = kept.filter((option): option is MediaModelOption => Boolean(option));
  }

  // ComfyUI 工作流也是一种「媒体模型」：不进目录，对话和 Agent 就看不到本地生成能力
  const workflowModels: MediaModelOption[] = workflows.flatMap((workflow) => {
    const mediaKind = WORKFLOW_MEDIA_KIND[workflow.category];
    if (!mediaKind) return [];
    const api = workflow.adapterType === 'workflow-api';
    const cloud = isRunningHubWorkflow(workflow) || api;
    if (cloud && !(api ? workflow.workflowApi : workflow.runninghub)) return [];
    const execution = workflowExecution(workflow);
    return [{
      value: cloud ? execution.model : `comfyui/${workflow.id}`,
      provider: execution.provider,
      label: workflow.name,
      description: api ? '自定义云工作流' : cloud ? `RunningHub ${workflow.runninghub?.kind === 'app' ? 'AI 应用' : '云工作流'}` : 'ComfyUI 工作流',
      iconType: 'badge',
      badgeText: api ? 'WF' : cloud ? 'RH' : 'CF',
      nodeTypes: [workflow.category],
      mediaKind,
      groupId: api ? 'workflow-api' : cloud ? 'runninghubwf' : 'comfyui',
      groupName: api ? '工作流 API' : cloud ? 'RunningHub 工作流' : 'ComfyUI 工作流',
      workflowId: workflow.id,
      providerConfigId: api ? workflow.workflowApi?.connectionId : cloud ? workflow.runninghub?.connectionId : undefined,
    }];
  });

  const unique = new Map<string, MediaModelOption>();
  for (const model of [...builtIn, ...custom, ...workflowModels]) {
    unique.set(`${model.mediaKind}:${model.value}`, model);
  }
  return [...unique.values()];
}

/**
 * **裸官方 id → MTV 模型 value** 的唯一匹配器（用户 2026-10-15 裁决 A，附硬条件）。
 *
 * 背景（为什么需要它）：MTV 有两套模型 id 空间 ——
 *   · **官方目录的裸 id**：`official-model-meta.json`（图片 29 / 视频 53 / 文本 16 / 音频 8）。
 *     ⚠️ **2026-10-15 用户重新裁决（推翻本条旧文「卡上候选 = 官方逐字复刻，不许改（判 B 被否）」）**：
 *     内置目录**不再是生成确认卡模型下拉的候选来源**，只降级为**展示元数据**（按 id 查名称/图标）。
 *     卡的候选改为「用户已配置连接声明的模型」（`getMediaModelOptions`），见
 *     `generationChipController.ts` 的 `connectionModels`。用户逐字：「我是自定义的厂商 我后台接入
 *     什么厂商 你就显示什么厂商的 我接入两个 你就显示两个厂商的」。
 *     下方这段「裸 id 空间错配」的解释仍然成立（执行侧仍要能解析历史卡/`@model` 里的裸 id）。
 *   · **MTV 自己的 value**：一律带厂商/连接前缀（`apimart/…` / `general/…` / `runninghub/…`），
 *     `defaultModelGroups` 95 条静态条目**全部**是带前缀的形状。
 * ⇒ 用户在卡上选完模型（或 `@model{<裸官方 id>}` 提及）后，走到执行期
 * `resolveMediaModel` → 本函数时**精确匹配必然落空**，报「未找到 @ 引用的媒体模型」。
 * 这是 **MTV 自己引入前缀层造成的 id 空间错配，不是官方行为** ⇒ 在执行侧补这一层解析。
 *
 * 纪律（**先精确、后后缀；唯一才认；歧义与不可用一律不认**）：
 *   1. 调用方先做**精确匹配**（`model.value === ref || === 'general/'+ref`），只有它失败才会走到这里；
 *   2. **只处理没有 `/` 的裸 id** —— 带前缀的 ref（`general/…` / `runninghub/…` / `apimart/…`）
 *      一律不参与后缀匹配，避免把别的命名空间卷进来或被剥前缀；
 *   3. 候选取自 `getMediaModelOptions(...)`：它经过 `getConfiguredModelGroups`
 *      ⇒ **没有 apiKey/不可用的厂商组已经被滤掉**（`defaultModels.ts:1104`）
 *      ⇒ 「只认可用连接」直接沿用既有可用性判定，这里**不另造一套**；
 *   4. 候选必须**唯一**。0 个（含歧义之外的不可用情形）或 ≥2 个（两条连接都提供同一 id）
 *      ⇒ 返回 `undefined`，调用方**保持原报错**，绝不任选一条。
 *
 * ⚠️ 这不是模糊匹配：比较的是「value 中最后一个 `/` 之后的部分与裸 id **全等**」（大小写不敏感），
 * 不做包含/前缀/相似度匹配。
 */
export function matchUniqueModelOptionByBareId(
  bareId: string,
  options: readonly MediaModelOption[],
): MediaModelOption | undefined {
  const target = bareId.trim().toLowerCase();
  if (!target) return undefined;
  const matches = options.filter((option) => {
    const slash = option.value.indexOf('/');
    if (slash <= 0) return false;
    return option.value.slice(slash + 1).trim().toLowerCase() === target;
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function findMediaModelOption(
  modelRef: string,
  generalModels: GeneralModelConfig[] = [],
  config?: ProviderModelVisibilityConfig,
  workflows: WorkflowDefinition[] = [],
): MediaModelOption | undefined {
  if (modelRef.startsWith('apimart/') && isLegacyApimartOmni(modelRef)) {
    modelRef = 'apimart/gemini-omni-1.1-flash-ext';
  }
  const normalized = modelRef.startsWith('general/') ? modelRef : `general/${modelRef}`;
  const options = getMediaModelOptions(generalModels, config, workflows);
  /* ① 精确匹配（含 `general/<cfgId>` 归一形状）——**永远优先**，行为与加这层之前逐字一致。 */
  const exact = options.find((model) => model.value === modelRef || model.value === normalized);
  if (exact) return exact;
  /* ② 精确失败才做「裸官方 id → MTV value」的唯一解析（见上面 `matchUniqueModelOptionByBareId`）。
     带 `/` 的 ref 不参与：保护 `general/…` / `runninghub/…` 等命名空间，也不做剥前缀。 */
  if (modelRef.includes('/')) return undefined;
  return matchUniqueModelOptionByBareId(modelRef, options);
}

// ============================================
// 文本模型上下文窗口目录（P3-D1）
// ============================================

export interface TextModelContextSpec {
  /** 模型上下文窗口（token，估算口径） */
  contextWindow: number;
  /** 建议为输出保留的 token 预算 */
  outputBudget: number;
  /** declared=用户声明；catalog=按模型 ID 匹配目录；default=保守默认值 */
  source: 'declared' | 'catalog' | 'default';
}

/** 按模型 ID 关键字推断上下文窗口；顺序敏感，先匹配的优先。 */
const TEXT_MODEL_CONTEXT_CATALOG: Array<[RegExp, number]> = [
  [/gpt-5/i, 400_000],
  [/gpt-4o|gpt-4/i, 128_000],
  [/\bo[34]\b|o[34]-mini/i, 200_000],
  [/claude/i, 200_000],
  [/gemini/i, 1_000_000],
  [/deepseek/i, 128_000],
  [/kimi|moonshot/i, 256_000],
  [/glm/i, 128_000],
  [/minimax/i, 1_000_000],
  [/qwen/i, 131_072],
  [/llama/i, 128_000],
];

/** 未识别模型的保守默认窗口。 */
export const DEFAULT_TEXT_CONTEXT_WINDOW = 32_000;

/** 已知能读图的文本模型 ID 关键字；顺序无关。 */
const VISION_TEXT_MODEL_PATTERNS: RegExp[] = [
  /gpt-5|gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision/i,
  /\bo[34]\b/i,
  /claude/i,
  /gemini/i,
  /grok-[2-9]|grok.*vision/i,
  /qwen.*(vl|omni)/i,
  /glm-4[.-]?\d*v|glm-4v/i,
  /internvl|llava|minicpm-v|pixtral|molmo|idefics/i,
  /step-1o|step-1v/i,
  /doubao.*(vision|seed)/i,
  /kimi.*(vl|latest)|moonshot-v1-\d+k-vision/i,
];

/**
 * 判断文本模型是否能吃图片输入。
 * 只按模型 ID 关键字匹配，命中不了不代表真的不支持——仅用于优先挑选，不做拦截。
 */
export function isVisionCapableTextModel(modelId: string): boolean {
  return VISION_TEXT_MODEL_PATTERNS.some((pattern) => pattern.test(modelId));
}

/** 显式能力优先；旧模型缺少声明时保留受限的 ID 目录兼容判断。 */
export function hasVisionInputCapability(model: {
  modelId: string;
  inputModalities?: Array<'text' | 'image'>;
}): boolean {
  return model.inputModalities !== undefined
    ? model.inputModalities.includes('image')
    : isVisionCapableTextModel(model.modelId);
}

function suggestedOutputBudget(contextWindow: number): number {
  return Math.min(8_192, Math.max(1_024, Math.floor(contextWindow / 8)));
}

/**
 * 解析文本模型的上下文规格。
 * 用户在模型配置中声明的 contextWindow 优先；否则按模型 ID 匹配目录；
 * 都没有时使用保守默认值。所有结果均为估算口径。
 */
export function resolveTextModelContextSpec(
  model?: Pick<GeneralModelConfig, 'modelId' | 'contextWindow'> | null,
): TextModelContextSpec {
  if (model?.contextWindow && model.contextWindow > 0) {
    return {
      contextWindow: model.contextWindow,
      outputBudget: suggestedOutputBudget(model.contextWindow),
      source: 'declared',
    };
  }
  const matched = model
    ? TEXT_MODEL_CONTEXT_CATALOG.find(([pattern]) => pattern.test(model.modelId))?.[1]
    : undefined;
  const contextWindow = matched ?? DEFAULT_TEXT_CONTEXT_WINDOW;
  return {
    contextWindow,
    outputBudget: suggestedOutputBudget(contextWindow),
    source: matched ? 'catalog' : 'default',
  };
}
