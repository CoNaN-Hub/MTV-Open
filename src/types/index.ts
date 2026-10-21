/**
 * types 全局类型定义 — 定义 NodeType、BaseNodeData、CanvasProject、AppConfig、ModelOption、WorkflowDefinition 等核心类型
 */
import type { AudioOutputFormat, AudioSpeechSettings, AudioTtsVoice, ModelExecutionProfile, VideoModelCapability, VideoReferenceItem } from './aiTypes';
import type { AudioGenerationPurpose } from './media';
import type { ImageAnnotationLayer } from '@tenney95/xiaoluo-image-editor';
import type { CanvasNoteData } from './canvasNote';
import type {
  DirectorResultManifestReference,
  DirectorRuntimeKind,
  DirectorSceneReference,
} from './directorScene';
import type { ShotlistColumnKey, ShotRow, ShotlistScriptSource, ShotlistProductionSource } from './shotlist';
import type { Locale } from '../i18n';
/* 模型身份归一化结果（多平台接入 / 官方名称展示）—— 类型来自 services/models */
import type { CanonicalModel, NormalizedModel, ProviderModelMapping } from '../services/models/types';
import type { McpToolExposure } from './mcp';
import type { AgentMode, AgentToolEffect } from './agent';
import type { MockupSettings } from './mockup';

export type {
  CanvasDrawingTool,
  CanvasNoteArrowhead,
  CanvasNoteCrop,
  CanvasNoteData,
  CanvasNoteFontFamily,
  CanvasNoteFontSize,
  CanvasNoteKind,
  CanvasNoteLayerDirection,
  CanvasNoteLineType,
  CanvasNotePatch,
  CanvasNotePoint,
  CanvasNoteRoughness,
  CanvasNoteRoundness,
  CanvasNoteStrokeStyle,
  CanvasNoteStrokeWidth,
  CanvasNoteStyle,
  CanvasNoteTextAlign,
} from './canvasNote';
export { createCanvasNoteData, DEFAULT_CANVAS_NOTE_STYLE, isCanvasNoteKind } from './canvasNote';

export type {
  DirectorBlendProjectArtifact,
  DirectorCamera,
  DirectorCameraInterpolation,
  DirectorCameraKeyframe,
  DirectorCoordinateSystem,
  DirectorEnvironment,
  DirectorFrameImageArtifact,
  DirectorProjectFileReference,
  DirectorReferenceVideoArtifact,
  DirectorResultArtifact,
  DirectorResultManifest,
  DirectorResultManifestReference,
  DirectorResultProducer,
  DirectorRuntimeKind,
  DirectorScene,
  DirectorSceneEntity,
  DirectorSceneParent,
  DirectorSceneReference,
  DirectorShot,
  DirectorTimeline,
  DirectorTransform,
  DirectorVector3,
  DirectorWorldColor,
} from './directorScene';

export type { ShotFrameBinding, ShotFrameCandidate, ShotlistColumnKey, ShotRow } from './shotlist';
export {
  buildShotFramePrompt,
  buildShotPlaceholderText,
  collectShotFrameCandidates,
  formatShotRowBrief,
  computeShotlistDuration,
  createShotRow,
  DEFAULT_SHOT_DURATION,
  isShotRowBlank,
  isShotRowTextOnly,
  readShotFrameSource,
  resolveShotDuration,
  resolveShotlistColumns,
  resolveShotTransitionKind,
  SHOT_CAMERA_OPTIONS,
  SHOT_SIZE_OPTIONS,
  SHOT_TRANSITION_OPTIONS,
  SHOTLIST_COLUMN_LABELS,
  SHOTLIST_COLUMN_ORDER,
  SHOTLIST_DEFAULT_COLUMNS,
  SHOTLIST_FRAME_SOURCE_TYPES,
  SHOTLIST_OPTIONAL_COLUMNS,
  SHOTLIST_PINNED_COLUMNS,
  SHOTLIST_TRANSITION_DURATION,
} from './shotlist';

export type {
  AnnotationPoint,
  ArrowImageAnnotation,
  BaseImageAnnotation,
  BrushImageAnnotation,
  ImageAnnotation,
  ImageAnnotationLayer,
  ImageAnnotationTool,
  ImageAnnotationType,
  MarkerImageAnnotation,
  RectangleImageAnnotation,
  TextImageAnnotation,
} from '@tenney95/xiaoluo-image-editor';

// 节点类型定义
export type NodeType =
  | 'ai-text'
  | 'ai-image'
  | 'ai-video'
  | 'ai-audio'
  | 'ai-animation'
  | 'ai-panorama'
  | 'ai-markdown'
  | 'ai-storyboard'
  | 'ai-shotlist'
  | 'ai-director'
  | 'source-image'
  | 'source-video'
  | 'source-audio'
  | 'source-text'
  | 'plugin-node'
  | 'canvas-note'
  /* 画布「对比」节点（参考 MOMO 画布 `compareNode`）：A/B 两路图片并排/擦除对比，
     没有输出接点 ⇒ 它是终点节点，不参与下游生成。见 `components/nodes/CompareNode.tsx`。 */
  | 'compare'
  | 'mockup'
  | 'comment';

// 内置图像预设可请求的生成后处理流程
export type ImagePostProcess = 'character-8-direction-grid';

export type AnimationAction = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hit';
export type AnimationPreviewMode = 'playing' | 'sheet';
export type CameraLens = '15mm' | '24mm' | '35mm' | '50mm' | '85mm' | '200mm' | 'macro' | 'fisheye';
export type CameraShutterEffect = 'freeze' | 'natural' | 'motion' | 'light-trails';
export type CameraAperture = 'f/1.4' | 'f/2' | 'f/2.8' | 'f/4' | 'f/5.6' | 'f/8' | 'f/11' | 'f/16';
export type CameraExposureTime = '1/2000s' | '1/1000s' | '1/500s' | '1/250s' | '1/125s' | '1/60s' | '1/30s' | '1/8s' | '1/2s' | '1s' | '5s';

/**
 * 摄影机控制（官方账号菜单外的那个「Lens Combo」）的**节点设置**。
 *
 * ★ 官方字段名逐字（`zoom-slider-3ZcFvYQO.js` 的 `Nnt` hook / `data.cameraControl`）：
 *     `{ enabled, cameraKey, lensKey, focalKey, apertureKey }`
 *   键的取值见 `src/data/cameraControl.ts`（机身 9 / 镜头 10 / 焦段 7 / 光圈 3）。
 *
 * ⚠️ 与上面那四个 `Camera*` 类型**不是一回事**：那套（`CameraLens` = 15mm/24mm/…）是
 *   **摄影棚**（`CameraStudioPanel` / `cameraStudio.ts`）在用的，保持原样 ✓
 *   旧版本曾把摄影棚那套直接塞进这里（`{lens, shutterEffect, aperture, exposureTime}`），
 *   与官方「机身/镜头/焦段/光圈」并不是同一套东西 ⇒ 已按官方换血，旧数据在读取处迁移。
 */
export interface CameraGenerationSettings {
  /** 开关：关掉时**不进提示词**（与官方一致 —— 官方关掉时走普通生成接口）*/
  enabled: boolean;
  /** 机身 key（`CAMERA_BODIES`）*/
  cameraKey: string;
  /** 镜头 key（`CAMERA_LENSES`）*/
  lensKey: string;
  /** 焦段 key（`CAMERA_FOCALS`）*/
  focalKey: string;
  /** 光圈 key（`CAMERA_APERTURES`）*/
  apertureKey: string;
}

export const ANIMATION_ACTION_LABELS: Record<AnimationAction, string> = {
  idle: '待机',
  walk: '行走',
  run: '奔跑',
  jump: '跳跃',
  attack: '攻击',
  hit: '受击',
};

export const ANIMATION_FRAME_GRIDS: Record<6 | 8 | 10 | 12 | 16 | 20, { cols: number; rows: number }> = {
  6: { cols: 3, rows: 2 },
  8: { cols: 4, rows: 2 },
  10: { cols: 5, rows: 2 },
  12: { cols: 4, rows: 3 },
  16: { cols: 4, rows: 4 },
  20: { cols: 5, rows: 4 },
};

/** 可以拖进宫格空格的节点类型（角色库参考图落在画布上是 source-image） */
export const STORYBOARD_CELL_SOURCE_TYPES = ['ai-image', 'source-image'];

// 宫格分镜：被拖入某格的图片覆盖
export interface StoryboardCellOverride {
  url: string;         // 展示用 asset/data URL
  filePath?: string;   // 本地文件路径（复用被拖入节点的落盘文件）
  assetId?: string;    // 稳定资产身份，不随文件移动或重命名变化
  relativePath?: string; // 项目目录内的相对路径（持久化优先）
}

export type CharacterLibraryNodeLink = {
  scope: 'project' | 'global';
  characterId: string;
} & ({
  referenceImageId: string;
  actionId?: never;
  mediaId?: never;
} | {
  referenceImageId?: never;
  actionId: string;
  mediaId: string;
});

/** 视频拉片插件写入图片节点的结构化结果；不包含本地路径或调用级 resourceId。 */
export interface VideoFrameAnalysisData {
  sourceVideoNodeId: string;
  sourceVideoName?: string;
  shotId?: string;
  inPoint?: number;
  outPoint?: number;
  sampleRole?: 'start' | 'middle' | 'end' | 'custom';
  reviewStatus?: 'unreviewed' | 'reviewed' | 'edited';
  overrideFields?: string[];
  aiOriginal?: Record<string, string | number | null>;
  requestedTime: number;
  actualTime: number;
  frameDuration?: number;
  approximateFrame?: number;
  shotSize?: string;
  camera?: string;
  content?: string;
  dialogue?: string;
  audio?: string;
  transition?: string;
  duration?: number;
  note?: string;
  confidence?: number | null;
}

// 节点数据接口
export interface BaseNodeData extends MockupSettings {
  label: string;
  type: NodeType;
  /**
   * 官方 Pin（画布标记分组）：本节点所属色组 id 列表（id 就是 hex 去掉 `#`）。
   * 官方源码 `zoom-slider` @1178019 `$g / mB / MAe`；色组表见 `services/canvasPin.ts` 的 `PIN_GROUPS`。
   * 顺序有意义 —— 官方 `primaryGroup` = **最后一个**（`DAe`）。
   */
  color_pins?: string[];
  /**
   * 官方节点「背景颜色」（文本卡工具栏第 1 格 `mQ`）：
   * 官方外壳 `gIe` @1223400 逐字 `style={{ … backgroundColor: data.color }}` ⇒ **卡片底色 = 该值**；
   * 官方 `fxe` 把它带进放大面板（`media.backgroundColor`）。取值来自 `services/officialTextColors.ts`
   * 的 `appliedValue` + alpha（文本卡 opacity=1 ⇒ `#RRGGBBFF`），空/undefined = 不设色。
   */
  color?: string;
  displayId?: number;         // 节点展示编号（#10, #11, ...）
  role?: 'generator' | 'source'; // 节点角色：生成器（有AI对话框） vs 源节点（上传/粘贴内容）
  fileName?: string;           // 上传的文件名（源节点使用）
  /**
   * 官方**编辑子类型**（`index-*.js` 的 `$2s` 枚举，逐字）：
   * `CUTOUT="cutout"` · `OUT_PAINT="out_paint"` · `PARTIAL_REDRAW="partial_redraw"`
   * `MULTI_ANGLE="multi_angle"` · `RELIGHT="relight"` · `QUICK_SPLIT="quick_split"` · `RESIZE="resize"`
   *
   * 官方各处创建编辑产物节点时都会带上它，例：
   *   · 浮动裁剪编辑器确认后 `Fm({ src, title:"Cropped Image", editSubType: Nv.CUTOUT }, …)`
   *   · 抠图 `f_({ src:"", title:t("image.matting"), editSubType: yl.CUTOUT }, …)`
   *   · 图像节点渲染时用它分流：`const y = d === yl.CUTOUT`
   * MTV 侧目前只有裁剪写这一条（用法与官方一致）。 */
  editSubType?: 'cutout' | 'out_paint' | 'partial_redraw' | 'multi_angle' | 'relight' | 'quick_split' | 'resize';
  /**
   * 官方浮动**重绘**编辑器产出的蒙版 URL（PNG：黑底 + 原图，涂过的区域 alpha = 0）。
   *
   * 官方在 `jhe.handleGenerate` 里把 mask 上传后**直接塞进请求**：
   *   `images = [refUrl?, maskUrl]`（refUrl 只在带了参考图时才有，mask 永远最后一张）
   * MTV 的生成服务从节点数据取参数 ⇒ 用这个字段把同一张 mask 交给 `generateImagesBatch`
   * （见 `services/generationService.ts` 里 `image_urls` 的组装）。
   */
  redrawMaskUrl?: string;
  /** 官方同一处 `images[0]`：带参考图时的那张（参考图选择器接上后写这里） */
  redrawReferenceUrl?: string;
  /**
   * 官方扩图（`Phe.handleGenerate` @1330724）上传的那张**合成图**（透明底 + 原图居中/按 pad 摆放）。
   * 官方是 `images: [F]`（只有这一张）＋固定提示词 `Mhe`；MTV 走项目内文件 URL，
   * 由 `services/generationService.ts` 组装成 `image_urls`。
   */
  outpaintImageUrl?: string;
  /** 官方多角度：源图（loe({image_urls:[src]})）—— 生成服务据此把它放进 image_urls */
  multiAngleSourceUrl?: string;
  /** 官方多角度参数（落节点便于复现）：{rotate_right_left,move_forward,vertical_angle,wide_angle_lens} */
  multiAngleParams?: { rotate_right_left: number; move_forward: number; vertical_angle: number; wide_angle_lens: boolean };
  /**
   * ★ 官方「不渲染底部编辑区」标记（`zoom-slider` 的 `V = Gi(s)?.data?.hide_inputbar === true`，
   *   门 `pe = 选中数 <= 1 && !V`，`if (!be) return;` ⇒ **该节点整条编辑条都不渲染**）。
   * 官方 9444 实测（2026-09 本轮）：
   *   · 4 张带「替换」的**上传/粘贴参考卡** → `canvas-node-generation-input-bar` **ABSENT**
   *   · 4 张**生成卡**（有提示词/产物） → 同一条 **VISIBLE**
   * ⇒ 本字段 = 「这张卡是从文件进来的（参考卡）」；写入点见 `store.nodes.ts::prepareNodeForInsertion`
   *   与 `ImageNode.handleUpload`（两处都对应卡片上的「替换」按钮门 = `fileName` 非空）。
   */
  hide_inputbar?: boolean;
  prompt?: string;           // 提示词
  output?: string;            // 输出结果（文本/URL等）
  status?: 'idle' | 'loading' | 'success' | 'error';
  model?: string;             // 选择的模型 ID（如 qwen/qwen3.5-397b-a17b）
  provider?: string;          // 选择的供应商 ID（如 apimart）
  workflowId?: string;        // 选择的工作流 ID
  workflowInputs?: Record<string, string>; // 本地 IO 或云工作流 nodeId/fieldName 赋值
  runninghubOutputs?: import('./runninghub').RunningHubOutput[];
  runninghubModelParameters?: Record<string, string>;
  runninghubStage?: string;
  workflowApiOutputs?: import('./workflowApi').CloudWorkflowOutput[];
  workflowApiStage?: string;
  imageUrl?: string;          // 生成的图片 URL（Tauri: asset://localhost/..., 浏览器: data:...）
  videoUrl?: string;          // 生成的视频 URL
  audioUrl?: string;          // 生成的音频 URL
  sourceUrl?: string;         // 原始远程生成 URL（下载到本地前保留）
  filePath?: string;          // 本地文件路径（项目 data 目录下，重建 asset URL 用）
  assetId?: string;           // 稳定资产身份；filePath 仅表示当前位置
  relativePath?: string;      // 项目目录内相对路径，保存时优先于绝对路径
  artifactId?: string;        // 对话媒体 Artifact ID（聊天与节点共享同一产物）
  thumbnailUrl?: string;      // 缩略图（应与 imageUrl 同步；全屏/预览统一读 resolveNodeImageDisplaySrc）
  /** 每次生成成功写入的单调版本号，用于绕过 WebView 图片缓存 */
  mediaVersion?: number;
  /** 由短剧资产一键创建的图像节点：反查绑定 */
  dramaAssetId?: string;
  dramaAssetKind?: import('./dramaAssets').DramaAssetKind;
  /** 角色参考图与当前项目节点的反向关联；全局角色本身不保存项目节点 ID。 */
  characterLibraryLinks?: CharacterLibraryNodeLink[];
  /** 仅表示该节点当前由角色库收纳隐藏，节点与连线仍保留在项目数据中。 */
  hiddenByCharacterLibrary?: boolean;
  /** 分组节点：折叠为文件夹卡片，组内节点与其连线暂不渲染 */
  groupCollapsed?: boolean;
  /** 分组节点：折叠前的尺寸，展开时还原 */
  groupExpandedSize?: { width: number; height: number };
  mattingMask?: string;       // 遮罩编辑器蒙版数据（data URL，独立于图片存储）
  annotation?: string;        // 旧版标注数据（data URL，透明 PNG；仅用于兼容读取）
  annotationLayer?: ImageAnnotationLayer; // 可编辑矢量标注层，独立于原图存储
  imageWidth?: number;        // 生成图片实际宽度
  imageHeight?: number;       // 生成图片实际高度
  videoWidth?: number;        // 视频原始宽度（用于节点等比布局）
  videoHeight?: number;       // 视频原始高度（用于节点等比布局）
  nodeWidth?: number;         // 画布节点当前宽度
  nodeHeight?: number;        // 画布节点当前高度
  imageSize?: string;         // 画质选择：'1K' | '2K' | '4K'
  aspectRatio?: string;       // 图片比例：'1:1' | '16:9' | ...
  batchCount?: number;        // 单次批量生成图片数量，默认 1
  batchGroupId?: string;      // 同一次批量生成的结果分组 ID
  /**
   * 官方 `data.options`：本次生成返回的**全部**图片（「多变体」批量结果就是它）。
   *
   * 官方出处（`course-api-base-url-CGXqZmAy.js`@3140300 逐字）：
   * `data:{...Be.data, src:_e, options:re.options, historyVariantsHidden:y,
   *        historyVariantCount:Math.max(B?.totalCount??0, re.options.length), …}`
   * 读取点：`V0`（`page-DVqoHdTT.js`@1359974）把 `src + options` 去重后作为「折叠变体数」；
   * `wme`/`vme` 也用它铺展开来。MTV 的「多变体」批量把 N 张全部写进源节点 ⇒ 这里存 N 个地址。
   */
  options?: string[];
  /** 官方 `historyVariantCount`（`course-…`@3140300）：**折叠变体数**，`Math.max(服务端总数, options.length)` */
  historyVariantCount?: number;
  /**
   * 官方 `historyVariantsHidden`：折叠变体已「隐藏」（= 官方「删除其他历史」`Sme` 的结果状态）。
   * 官方 `page-DVqoHdTT.js`@1360248：`{src:e.src, options:[], historyVariantsHidden:!0, historyVariantCount:e.src?1:0, …}`
   */
  historyVariantsHidden?: boolean;
  /**
   * ★ 官方 `historyPreviewSrc`（chunk 常量 `ma = "historyPreviewSrc"`，
   *   `course-api-base-url-CGXqZmAy.js`@3133760 逐字 `const Xf=16,yst=48,vst=8,xst=[],ma="historyPreviewSrc";`）。
   *
   * **语义 = 「折叠态下这张卡显示哪一张变体」**：
   *   · 读：官方 `nK(e)`（`course-…`@589300 逐字）
   *     `function nK(e){const t=typeof e.src=="string"?e.src:"";return typeof e.historyPreviewSrc=="string"&&e.historyPreviewSrc?e.historyPreviewSrc:t}`
   *     ⇒ `historyPreviewSrc || src`；
   *     节点渲染投影 `Mwe(e)`（同段）在 `historyVariantsHidden !== true` 时用 `{...e, src: nK(e)}` 覆盖显示的图。
   *   · 写：官方只在三处落笔 ——
   *     ① `handleApply`（`he`，`course-…`@3141396）写变体时 **清空**（`[ma]: void 0`）；
   *     ② `handleSelectImage`（`Ct`，`course-…`@3142860）命中服务端批次时同样清空；未命中批次时
   *        `u(e,{src:_e,[ma]:void 0,currentSourceFileId:tr(_e)})` 也清空；
   *     ③ 画廊**打开**时把当前值暂存到 `F.current.historyPreviewSrc`，
   *        画廊**关闭**且期间没有点过任何变体（`!G.current`）时**原样写回**
   *        （`course-…`@3142060 的 `d(e,re=>({...re,data:{...re.data,[ma]:_e?.historyPreviewSrc,...}}))`）。
   *   ⇒ 折叠态默认不写该字段；只有「预览过某张变体但没确认」时才需要它，关闭画廊即还原。
   */
  historyPreviewSrc?: string;
  /**
   * 官方 `currentSourceFileId`（服务端文件库主键）：`handleSelectImage` 写主图时一并落笔
   * （`u(e,{src:_e,[ma]:void 0,currentSourceFileId:tr(_e)})`，`course-…`@3142860），
   * `handleApply` 也写（`re.sourceFileIds[_e] ?? ne ?? tr(_e)`）。
   * MTV 没有服务端文件库 ⇒ 只在能从 URL 反推时写入（`utils/officialFavorites.ts` 的 `tr`）。
   */
  currentSourceFileId?: string;
  cameraSettings?: CameraGenerationSettings; // 生图/生视频摄影参数；字段缺省时由模型自动决定
  videoResolution?: number;   // 视频分辨率：832 | 1024 | 1280 | 1440
  videoFps?: number;          // 视频帧率：16 | 24 | 30
  videoFrames?: number;       // 视频生成帧数（时长）
  animationAction?: AnimationAction; // 角色逐帧动画动作
  animationFrames?: 6 | 8 | 10 | 12 | 16 | 20; // Sprite Sheet 总帧数
  animationPreviewMode?: AnimationPreviewMode; // 动图预览 / 静态排布
  animationFps?: number;      // 预览播放帧率（1-24），默认 8
  animationLoop?: boolean;    // 预览循环播放，false 时播到末帧停住，默认 true
  seedanceResolution?: string;// Seedance 分辨率：'480p' | '720p' | '1080p' | '4k'
  seedanceRatio?: string;     // Seedance 宽高比：'16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9' | 'adaptive'
  seedanceDuration?: number;  // Seedance 时长（整数秒）：2-15
  generateAudio?: boolean;    // 生成有声视频（Seedance 2.0 / 1.5 pro）
  videoReferences?: VideoReferenceItem[]; // 手动挑选的参考帧 / 参考角色；不选则沿用连线顺序
  /**
   * ★ 官方**视频节点变体**（§93 新增）= 官方 `data.type` 的 MTV 承载槽。
   *
   * 官方枚举 `_o` @152208 逐字：
   *   `var _o=(e=>(e.UPLOAD="upload",e.GENERATE="generate",e.UPSCALE="upscale",e.CLIP="clip",e))(_o||{})`
   * 官方分派 `fse` @2093744 逐字：
   *   `const o=e.data.type||_o.GENERATE; return vV[o]||vV[_o.GENERATE]`
   *   （`vV={[_o.UPLOAD]:dse,[_o.GENERATE]:cse,[_o.CLIP]:qoe,[_o.UPSCALE]:mse}`）
   *
   * ⚠️ **为什么键名不是 `type`**：官方 `data.type` 在 MTV 里**已被 `NodeType` 占用**
   * （`'ai-video' | 'source-video' | …`，全仓 ~200 处读写）；两者同名不同义，直接抢占会让
   * `data.type === 'generate'` 的节点在 `Canvas.nodeTypes` 里找不到组件。
   * ⇒ 值域与语义照官方**原样**搬到这里，缺省 = 官方 `_o.GENERATE`。见
   * `utils/officialVideoNodeVariant.ts`（含历史数据兼容策略）。
   */
  videoNodeType?: 'upload' | 'generate' | 'upscale' | 'clip';
  /**
   * ★ 官方节点参数包 `data.params`（§69 新增，**字段名与嵌套层级都取官方原样**）。
   *
   * 官方 `LXe`（canvas:@1991362 逐字）：`params: n?.params || {}`；
   * 同段 `updateParams` 逐字：`a.useCallback(f=>{t(e,h=>({params:{...h.data?.params,...f}}))},[e,t])`。
   *
   * MTV 的视频参数一直是**平铺**在 `data` 上（`seedanceRatio` / `seedanceDuration` / …），
   * 本字段**只**承载官方「生成方式」那一支 —— 官方写的就是 `params` 里的两个字段：
   *   · 选模型时的种子（官方 `CQe` canvas:@2037060 逐字）
   *     `U={...k.defaults,model:E,variant:k.variant,modelType:k.modelType,…}` ⇒ `c(n,{params:U})`；
   *   · 「生成方式」选择器（官方 `an` canvas:@2058180 逐字）
   *     `i({modelType:kn.modelType,variant:kn.variant,...er})`。
   *
   * **取值域**
   *   · `modelType` = 官方 `zt` 模型模式枚举字符串：`text_to_video` / `image_to_video` /
   *     `start_end_to_video` / `reference_to_video` / `reference_video_to_video` /
   *     `video_edit` / `video_extend` / `digital_human`
   *     （`aDe` 键集，逐字见 `services/ai/modelParamCatalog.ts` 的 `MODEL_TYPE_TO_METHOD`）。
   *   · `variant` = 目录 `variants[].key`（`reference` / `text` / `image` / `start_end` / `edit` …）。
   *
   * **官方缺省**：字段不存在 ⇒ 官方 `state.modelType = null` ⇒ `dd(null) = null` ⇒
   * 触发 chip 的「生成方式」段**不 push**（官方 `Poe` canvas:@1873888 `r&&x.push(r)`）。
   * 老 MTV 节点数据没有这个包 ⇒ 按官方缺省处理（不补默认值）。
   */
  params?: {
    /** 官方 `params.model`（模型 id）。MTV 平铺在 `data.model`，这里只做官方同形声明。 */
    model?: string;
    /** 官方 `zt` 模型模式枚举值 —— 「生成方式」的载体。 */
    modelType?: string;
    /** 官方目录 `variants[].key`。 */
    variant?: string;
    [key: string]: unknown;
  };
  audioVoice?: AudioTtsVoice; // TTS 音色
  audioSpeechSettings?: AudioSpeechSettings;
  audioFormat?: AudioOutputFormat; // TTS 输出格式
  audioSpeed?: number;        // TTS 播放速度：0.25-4
  audioPurpose?: AudioGenerationPurpose; // 当前音频模型用途
  musicTitle?: string;        // Flow Music 标题
  musicLyrics?: string;       // Flow Music 歌词
  musicClipId?: string;       // Flow Music 产物标识
  musicBpm?: number;          // Flow Music BPM
  musicDuration?: number;     // Flow Music 时长：1-240 秒
  autoGenerateLyrics?: boolean; // 是否先调用歌词生成接口
  style?: string;               // 画风 ID（如 'realistic'、'anime'）
  error?: string;             // 错误信息
  // ── 宫格分镜（ai-storyboard）──
  storyboardCols?: number;              // 列数
  storyboardRows?: number;              // 行数
  storyboardRowPositions?: number[];    // 自定义横线位置百分比（有序，不含 0/100），非均匀裁切时使用
  storyboardColPositions?: number[];    // 自定义竖线位置百分比（有序，不含 0/100），非均匀裁切时使用
  storyboardExtracted?: boolean[];      // 各格是否已被拖出提取（行优先），已提取的格显示空占位
  storyboardOverrides?: (StoryboardCellOverride | null)[]; // 各格被拖入的图片（覆盖源图裁片显示）
  // ── 分镜表（ai-shotlist）──
  shotlistRows?: ShotRow[];                 // 逐行镜头
  shotlistColumns?: ShotlistColumnKey[];    // 当前显示的列（常驻列恒在其中）
  shotlistScriptSource?: ShotlistScriptSource;
  shotlistProductionSource?: ShotlistProductionSource;
  frameAnalysis?: VideoFrameAnalysisData;   // 视频拉片抽帧及画面分析结果
  // ── 3D 导演台（ai-director）──
  directorRuntimeKind?: DirectorRuntimeKind; // 缺失=lightweight-web；未知运行时必须失败关闭
  directorInstanceId?: string;           // 导演台 localStorage 隔离实例 ID
  directorStatus?: 'idle' | 'open' | 'ready';
  directorCaptureUrls?: string[];        // 从导演台同步的截图 URL 列表
  directorCaptureFilePaths?: string[];   // 对应本地路径
  directorScene?: DirectorSceneReference; // 结构化 Director Scene 的不可变项目文件引用
  directorResultManifest?: DirectorResultManifestReference; // 当前结果清单的不可变项目文件引用
  /** 轻量笔记/绘图元素。与 AI 生成节点数据语义隔离。 */
  note?: CanvasNoteData;
  [key: string]: unknown;
}

// ── AI 输出历史记录 ──
export interface OutputHistoryEntry {
  id: string;                    // 唯一 ID
  projectId: string;             // 所属项目 ID
  nodeId: string;                // 来源节点 ID
  nodeLabel: string;             // 来源节点名称
  timestamp: number;             // 生成时间戳
  prompt: string;                // 原始提示词
  output: string;                // 输出内容（文本 or URL）
  nodeType: NodeType;            // 节点类型
  model: string;                 // 模型 ID
  provider: string;              // 供应商 ID
  status: 'success' | 'error';   // 生成结果
  error?: string;                // 错误信息
  mediaUrl?: string;             // 媒体资源 URL（imageUrl/videoUrl/audioUrl）
  filePath?: string;             // 本地文件路径
  params?: Record<string, unknown>; // 生成参数快照
}

/** 单集创作要点；只描述写作结构。 */
export interface EpisodeCreativeInfo {
  /** 本集要完成的叙事任务。 */
  task?: string;
  /** 对立双方、争夺目标与失败代价。 */
  coreConflict?: string;
  /** 开场几秒内建立的冲突或悬念。 */
  openingHook?: string;
  /** 本集的关键反转或情绪爆点。 */
  reversal?: string;
  /** 结尾未完成动作、揭露或关系反转。 */
  endingHook?: string;
  /** 按发生顺序排列的主要情节点。 */
  beats?: string[];
  /** 目标时长（秒），仅用于创作统计提示。 */
  targetDurationSec?: number;
  /** 原著章节、页码或段落范围。 */
  sourceRange?: string;
}

export interface CanvasProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** 最近一次离开/切换时捕获的画布 WebP 快照（Data URL）。 */
  snapshot?: string;
  /** 本地媒体文件夹名（形如「项目名-短ID」）。创建时确定后保持稳定，旧项目可能缺失（回退到 id）。 */
  dataFolder?: string;
  /** Store revision 计数模式：project=项目独立计数（默认），global=全局计数 */
  revisionScope?: 'project' | 'global';
  /** 项目级创作基线；旧项目缺失时沿用应用与节点默认值。 */
  settings?: ProjectSettings;
  /**
   * 分集项目所属的剧集项目 id。有值 = 这是一集，画布独立、角色库与素材目录跟随父项目；
   * 无值 = 普通单画布项目，或已拥有分集的剧集项目本身。
   */
  parentId?: string;
  /** 分集序号，从 1 开始；仅分集项目有。 */
  episodeNo?: number;
  /** 本集大纲；仅分集项目有。旧项目继续兼容此字段。 */
  episodeOutline?: string;
  /** 本集完整剧本正文；与大纲分开保存。 */
  episodeScript?: string;
  /** 本集结构化创作要点。 */
  episodeCreative?: EpisodeCreativeInfo;
  /** 剧集级原著与剧本；仅剧集项目有。 */
  series?: ProjectSeriesInfo;
  /**
   * 所属「文件夹 / Collection」的 id（官方 `collections` 模型，与「剧集」`parentId` 相互独立：
   * 文件夹只做分组，不影响角色库、素材目录与画布切换）。无值 = 未归入任何文件夹。
   */
  collectionId?: string;
}

/**
 * 工作空间「文件夹 / Collection」（官方 `collections` 表）。
 * 官方字段：`id` / `name` / `child_canvas_count` / `cover_set` / `updated_at`；
 * MTV 只存 `id/name/createdAt/updatedAt`，「N 个项目」与三封面由 `CanvasProject.collectionId` 反查。
 */
export interface WorkspaceCollection {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** 原著文件引用：正文存在项目数据目录里，记录只留定位信息。 */
export interface ProjectOriginalWork {
  fileName: string;
  /** 相对项目数据目录的路径 */
  relativePath: string;
  addedAt: number;
}

/** 剧集项目的原著与剧本，全部分集共享。 */
export interface ProjectSeriesInfo {
  originalWork?: ProjectOriginalWork;
  /** 全剧剧本正文 */
  script?: string;
}

export type ProjectModelKind = 'text' | 'image' | 'video' | 'audio';

/** 项目级风格母图：生图时自动作为风格参考注入，无需每次 @ */
export interface ProjectStyleReference {
  /** 项目 data 目录下的本地路径 */
  filePath?: string;
  /** 展示/生成用 URL（asset:// 或 data:） */
  imageUrl?: string;
  /** 文件名（展示用） */
  fileName?: string;
  /**
   * 是否启用自动注入。
   * 有 imageUrl 时默认 true；关闭后仅保留母图文件，不参与生成。
   */
  enabled?: boolean;
}

export interface ProjectVisualStyleSettings {
  styleId?: string;
  styleName?: string;
  /** 保存选择时的提示词快照，避免自定义画风被删除后项目失去基线。 */
  prompt?: string;
  locked?: boolean;
  /** 上传的风格母图（卡通/电影截图等），整项目图像生成自动跟随 */
  styleReference?: ProjectStyleReference;
}

export interface ProjectGenerationDefaults {
  imageAspectRatio?: string;
  imageSize?: string;
  /** 视频画面比例：'16:9' 横屏、'9:16' 竖屏等；应用到节点的 seedanceRatio。 */
  videoAspectRatio?: string;
  videoResolution?: '480p' | '720p' | '1080p' | '4k';
  videoDuration?: number;
}

export interface ProjectSettings {
  visualStyle?: ProjectVisualStyleSettings;
  /** @deprecated 旧项目的全类型提示词后缀；编辑保存后迁移到 promptSuffixes。 */
  promptSuffix?: string;
  promptSuffixes?: Partial<Record<ProjectModelKind, string>>;
  defaultModels?: Partial<Record<ProjectModelKind, string>>;
  /** 专门用于图片理解/描述的文本模型；必须声明 image 输入能力。 */
  visionModelId?: string;
  /** 允许 Agent 在未显式 @model 时依据能力和用户描述选择媒体模型。 */
  modelAutoRouting?: boolean;
  generation?: ProjectGenerationDefaults;
}

// API 配置
export type GeneralModelCategory = 'text' | 'image' | 'audio' | 'video';

/** 连接级文本/对话 API 协议；缺省保持 OpenAI Chat Completions 兼容。 */
export type ChatApiProtocol =
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'gemini-native';

export type ImageReferenceRequestMode =
  | 'generation-json-image-urls'
  | 'generation-json-image-data-urls'
  | 'edits-multipart'
  /**
   * ★★ 「编辑接口 + JSON body + `images` 数组」（用户 2026 实测新增）。
   * 语义等价于官方 `scene:"image-edit"`：把这次调用声明为**图像编辑**，参考图作为底图，
   * 而不是「文生图 + 一堆参考图」。
   * 实测依据（土豆中转站 + gpt-image-2-pro，抓包官方 + 逐形态对照）：
   *   · `POST /images/generations` + `image_urls` / `image`(data) / `scene` / `{{Image 1}}` ⇒ **一律无视参考图**；
   *   · `POST /images/edits` + multipart ⇒ 400「multipart/form-data is not supported」；
   *   · `POST /images/edits` + **JSON** `{model,prompt,size,images:[url|dataURL]}` ⇒ ✅ 完全跟着参考图，
   *     而且**用用户原话即可**（不需要任何提示词工程）。
   * 官方客户端发的就是这种语义：`{prompt:"参考{{Image 1}} …", scene:"image-edit", images:[…]}`。
   */
  | 'edits-json-images';

export type ProviderCatalogAdapter = 'openai-compatible' | 'local-manifest';

export type WebSearchProviderId = 'tavily' | 'bocha' | 'zhipu-search' | 'exa';

/**
 * 单个模型的计费覆盖 —— 用户手填的价，**优先于**连接价目表。
 *
 * 用于「这家厂商没有公开价目表」「价目表里名字对不上」「想按自己的口径算」三种情况。
 */
export interface ProviderBillingModelOverride {
  /** 上游模型 id（大小写不敏感；与价目表 / 节点上的 modelId 同名匹配） */
  modelId: string;
  /** 该模型「每张」的单价（计价单位） */
  unitPrice?: number;
  /**
   * 档位明细。键是 `quality|resolution`（如 `low|1k`、`high|2k`），大小写不敏感；
   * 某一维不限就用 `*`（如 `*|1k`）。查表时**先匹配明细、再退回 unitPrice**。
   */
  variants?: Record<string, number>;
}

/**
 * ★ 连接级「计费 / 积分」设置（用户 2026：「未来我会接入其他厂商的价格，所以不要锁死土豆这一套」）。
 *
 * 土豆（new-api 系）只是**一种**取价方式：`GET {origin}/api/pricing` 的公开价目表。
 * 换别家时可能：价目表路径不同 / 没有公开价目表 / 计价单位不是人民币 —— 都在这里覆盖，
 * 不用改代码，也不用把土豆那套写死进预估逻辑。
 */
export interface ProviderBillingConfig {
  /** 关掉后本连接不显示积分预估（默认开）。 */
  enabled?: boolean;
  /**
   * 价目表来源：
   *   · `auto`（默认）= 按 new-api 约定取 `{站点根}/api/pricing`
   *   · `endpoint`    = 用 `priceEndpoint` 指定的地址
   *   · `manual`      = **完全不请求**，只用下面的手动单价 / 逐模型覆盖
   */
  priceSource?: 'auto' | 'endpoint' | 'manual';
  /** `priceSource === 'endpoint'` 时的价目表地址；支持 `{baseUrl}` / `{origin}` 占位。 */
  priceEndpoint?: string;
  /**
   * 多少积分 = 1 个计价单位（默认 100 ⇒ 1 积分 = 0.01）。
   * 土豆的 `/api/status` 是 `quota_display_type:"CNY"`，所以它的 1 单位 = ¥1、1 积分 = ¥0.01。
   */
  creditsPerUnit?: number;
  /** 计价单位的显示名（仅用于界面提示，如 `人民币 (CNY)`）。 */
  currencyLabel?: string;
  /** 兜底单价：价目表与逐模型覆盖都查不到时用它；不填则该档不显示积分。 */
  fallbackUnitPrice?: number;
  /** 逐模型覆盖。 */
  modelOverrides?: ProviderBillingModelOverride[];

  /**
   * ★ **本连接在上游所属的分组名**（如 new-api 系的 `vip-9折` / `svip`）—— 用户声明。
   *
   * 它是**折扣**（`×0.9` 这类倍率）与**分组门**（「这个模型对哪些分组开放」）的输入。
   *
   * ⚠️ 上游**没有**任何匿名端点会告诉你「这个 key 属于哪个分组」（`/api/pricing` 是匿名公开的，
   *    `group_ratio` 里也没有"当前分组"这一项 —— 实测）。所以：
   *      · 这里留空时，MTV 会用「带 Key 的 `/v1/models`」与「价目表的 `enable_groups`」**反推**
   *        （零反例判据，见 `services/ai/providerEntitlements.ts` 的 `inferConnectionGroup`）；
   *      · 反推不出来、或反推错了，用户就在这里**显式声明**覆盖它。
   *    倍率优先查上游 `group_ratio` 表；表里没有的（如 `vip-9折`）按组名的「N折」语义推出 N/10；
   *    两者都得不到 ⇒ **留空、不套折扣**（NOT FOUND 就是 NOT FOUND，不猜）。
   *
   * ⚠️ **MTV 增强**：官方读的是账号级 `isPayingCustomer`，
   *    官方侧没有任何读 `enable_groups` / `usable_group` 的代码（NOT FOUND）。
   */
  group?: string;

  /**
   * ★ 账户余额查询 —— 读「我在该厂商那里还有多少钱」，顶部那颗积分按钮显示的就是它。
   *
   * ⚠️ **new-api 系（土豆）用 API Key 读不到余额**（`/api/user/self` 只认登录态 access token，
   *    `/v1/dashboard/billing/subscription` 返回的是 `hard_limit_usd = 1e8` 哨兵值）。
   *    所以这里可以单独填一个「系统访问令牌」；apimart 这类能直接用 API Key 读的就留空。
   */
  balanceToken?: string;
  /**
   * 账户 ID —— 有些厂商要求它**随令牌一起发**（实测：new-api 系的前端每次请求都注入
   * `New-Api-User: <localStorage.uid>`，只发 `Authorization` 会被判未授权）。
   * 在厂商个人中心能看到自己的用户 ID。
   */
  balanceUserId?: string;
  /** 余额查询路径（相对站点根）；默认 `/api/user/self`（new-api） */
  balancePath?: string;
  /** 从响应里取「金额」的字段路径；默认 `data.quota` */
  balanceAmountPath?: string;
  /**
   * 金额单位：
   *   · `quota`（默认）= new-api 的 quota 计数，需 ÷ `balanceQuotaPerUnit` 才是计价单位
   *   · `price`        = 响应里已经是计价单位（如 apimart 的 `remain_credits`）
   */
  balanceAmountUnit?: 'quota' | 'price';
  /** quota → 计价单位的基数；默认 500000（new-api `/api/status` 的 `quota_per_unit`） */
  balanceQuotaPerUnit?: number;
  /** 充值页地址（相对站点根或完整 URL）；默认 `/console/topup` */
  topUpPath?: string;
}

/** 用户在厂商目录中明确启用的模型，不包含凭据。 */
export interface ProviderModelSelection {
  id: string;
  name: string;
  category: GeneralModelCategory;
  provider: string;
  description?: string;
  /** 用户已手动编辑用途说明，刷新厂商目录时不覆盖。 */
  descriptionManual?: boolean;
  /** 可验证的输入模态；自然语言描述不能替代该能力声明。 */
  inputModalities?: Array<'text' | 'image'>;
  /** 用户已手动确认输入模态，刷新厂商目录时不覆盖。 */
  inputModalitiesManual?: boolean;
  /** 分类是否由用户手动指定；为 true 时重新拉取目录或合并模型不再覆盖该分类。 */
  categoryManual?: boolean;
  /**
   * 文本模型的上下文窗口（token）。缺省时按模型 ID 猜目录，猜不中退回保守默认值，
   * 中转站的自定义命名基本都猜不中，声明出来助手才不会过早压缩上下文。
   */
  contextWindow?: number;
  /** 自定义媒体模型的提交、轮询与结果解析规则。 */
  executionProfile?: ModelExecutionProfile;
  /** 图片模型存在参考图时使用的请求协议；缺省保持 generations JSON 兼容方式。 */
  imageReferenceRequestMode?: ImageReferenceRequestMode;
  /** 视频模型的参数能力声明（时长/分辨率/比例/参考素材等），缺省走通用兜底。 */
  videoCapability?: VideoModelCapability;
  /**
   * ★ 归一化后的模型身份（多平台接入 / 官方名称展示）。
   *
   * 由 `services/models` 的归一化器算出：`canonicalId` / `officialName` / `displayName` /
   * `officialVendor` / `executionMode` / `matchStatus` …
   *
   * ⚠️ **界面只允许读 `normalized.displayName`**；
   *    `id` 是平台调用 id（出站原样发），`name` 是平台原始名（只作排障）。
   *    旧配置没有这个字段 ⇒ 用 `services/models/display` 的取数函数**实时算**，无需迁移。
   */
  normalized?: NormalizedModel;
  /**
   * ★ 官方模型目录的「思考」元数据（`model.thinking`）。
   *
   * 官方该字段**只来自服务端模型目录**（`listModels()` 条目），客户端常量表里没有它
   * （官方离线兜底目录 `Tq` 同样不带该字段 ⇒ 官方那时也不画档位控件）。
   * MTV 没有该服务端目录 ⇒ **不补默认值**：这里只是一个**透传通道**，
   * 只有当上游目录条目自带 `thinking` 时，`ChatThinkingPanel` 的官方 Effort 档位控件才会出现。
   */
  thinking?: import('./chat').ModelThinkingMeta;
}

export interface ApiProviderConfig {
  name: string;
  /**
   * 运行期明文凭据，只存在于内存。持久化时由 providerSecretService 摘进 Rust 侧的
   * 凭据存储（Renderer 不可直读），数据库里只留 apiKeyRef，不再写入明文。
   */
  apiKey: string;
  /** 凭据在凭据存储中的条目名；由持久化层维护，业务代码不要直接读写。 */
  apiKeyRef?: string;
  baseUrl?: string;
  /** 文本/对话请求协议；旧配置缺失时按 openai-compatible 处理。 */
  chatApiProtocol?: ChatApiProtocol;
  /** 内置目录定义 ID；自定义连接的配置 key 与目录定义 ID 不同。 */
  catalogId?: string;
  /** undefined 表示旧配置尚未选择；空数组表示用户明确未启用任何模型。 */
  selectedModels?: ProviderModelSelection[];
  /** 最近一次拉取并保存在本地的完整模型目录，不包含凭据。 */
  catalogModels?: ProviderModelSelection[];
  /** undefined 表示旧配置全部可见；空数组表示从所有节点模型列表隐藏该厂商。 */
  visibleModelCategories?: GeneralModelCategory[];
  /**
   * ★ 连接级默认「参考图调用语义」：本连接下**所有**图片模型没单独配时都用它。
   * 用户 2026：「模型不要固定死这一个，其他能生图的模型也需要『调用语义』」
   * ⇒ 一条中转站通常整家都是同一个协议，配一次即可，不必逐模型点。
   * 优先级：模型自己的 `imageReferenceRequestMode` > 本字段 > 厂商目录默认。
   */
  imageReferenceRequestMode?: ImageReferenceRequestMode;
  /**
   * ★ 连接级「计费 / 积分」设置 —— 取价方式、积分换算与逐模型手动价。
   * 用户 2026：「未来我会接入其他厂商的价格，所以不要锁死土豆这一套」⇒ 全部走这里配置。
   */
  billing?: ProviderBillingConfig;
  catalogUpdatedAt?: number;
}

/**
 * 本地个人资料里的「社交媒体」一条。
 * 官方是多平台（`socialLinks.platform.*`）+ 可增删的 chip 列表；
 * MTV 只保留「链接 + 可选平台名」这两个够用的字段（本地不需要平台校验）。
 */
export interface ProfileSocialLink {
  url: string;
  /** 官方 `display_text`；MTV 留空则按平台名/域名展示 */
  displayText?: string;
}

// 即梦/Dreamina OAuth 登录态（登录态由官方 dreamina_cli 持久化，此处仅镜像用于 UI）
export interface DreaminaAuthData {  loggedIn: boolean;
  username?: string;          // 账户昵称
  credit?: string;            // 额度余额文本
  loginTs?: number;           // 登录时间戳
  cookie?: string;            // 遗留字段（旧 cookie 方案），已弃用且不再持久化（属凭据）
}

// 即梦 OAuth 登录运行态（对应 Rust LoginRuntime 快照）
export interface DreaminaRuntime {
  active: boolean;
  phase: string;              // idle/preparing/starting/oauth_ready/polling/success/failed
  message: string;
  error: string;
  verificationUrl: string;    // 授权链接
  userCode: string;           // 验证码
  loggedIn: boolean;
  username: string;
  credit: string;
}

/** 画布背景主题 */
export type CanvasBackground =
  | 'default'
  | 'solar-system'
  | 'minimal'
  | 'nebula'
  | 'off-white'
  | 'frosted-glass'
  | 'custom';

/** 画布交互模式：default = Figma 风格（左键框选 / 右键·中键平移 / 滚轮缩放）；classic = 传统（左键平移 / Shift+拖动框选 / 滚轮纵横平移 / Ctrl+滚轮缩放） */
export type InteractionMode = 'default' | 'classic';

/** 节点顶部工具栏显示方式 */
export type NodeToolbarMode = 'icons' | 'icons-and-text';

/** 软件启动后优先展示的视图。 */
export type StartupView = 'last-project' | 'project-library';

/** 主窗口可固定的宽高比 */
export type WindowAspectRatio = '16:9' | '16:10' | '4:3';

/** 吉祥物在可拖动视口中的相对位置，x/y 均为 0-1。 */
export interface MascotPosition {
  x: number;
  y: number;
}

/** 画布空白处长按圆环可触发的快捷动作。 */
export type CanvasQuickActionKind =
  | 'comfyui'
  | 'workflows'
  | 'assets'
  | 'settings'
  | 'projects'
  | 'video-editor'
  | 'action-library'
  | 'fit-view'
  | 'custom-url'
  | 'disabled';

export interface CanvasQuickAction {
  id: string;
  kind: CanvasQuickActionKind;
  /** 自定义网页或需要覆盖默认文案时使用。 */
  label?: string;
  /** 仅 custom-url 动作使用，执行前仍会校验 http/https 协议。 */
  url?: string;
}

export interface AppConfig {
  providers: Record<string, ApiProviderConfig>;
  /** 当前用于 Agent 联网搜索的厂商；旧配置未设置时优先沿用 Tavily。 */
  webSearchProviderId?: WebSearchProviderId;
  /**
   * ★ 顶部那颗「积分」按钮从**哪条连接**读余额（用户在「设置 → 充值积分」里选）。
   * 未设置时自动挑：优先带 `billing.balanceToken` 的连接，其次第一条配了 Key 的连接。
   */
  creditSourceConnectionId?: string;
  theme: 'dark' | 'light';
  language?: Locale; // 界面语言，未设置时跟随系统
  /**
   * ── 本地个人资料（官方账号菜单「账户管理」那一项打开的个人资料页在 MTV 的落点）──
   * ⚠️ MTV 是本地桌面应用、**没有账号/计费后端**（见 `SettingsNavigation.tsx` 顶部说明），
   *    所以这些字段**只存在本机 config 里**：不上传、不联网校验。
   *    字段与官方「个人简介」页一一对应（用户给的官方截图）：
   *    头像 / 用户名 / 个人简介 / 社交媒体 / 国家-地区 / 城市 / 身份-职业 / 显示入驻时间。
   *    头像与既有 `customBackgroundUrl` 一样存 data URL；上传时先缩到 256 控制体积。
   */
  profileAvatarUrl?: string; // 头像（data URL，≤256×256）
  profileUsername?: string;  // 用户名（官方是必填）
  profileBio?: string;       // 个人简介
  profileSocialLinks?: ProfileSocialLink[]; // 社交媒体链接（官方是可增删的 chip 列表）
  profileCountry?: string;   // 国家 / 地区
  profileCity?: string;      // 城市
  profileOccupation?: string; // 身份 / 职业
  profileShowJoinedDate?: boolean; // 显示入驻时间，默认 true

  /**
   * 摄影机控制（Lens Combo）的**上次使用组合**。
   * 官方存在**云端模型偏好**里（`KM()` → `MODEL_PREFS.modelConfigs[model].advancedSettings.cameraControl`）；
   * MTV 无此后端 ⇒ 落本机 config（换机器不同步，这是唯一差异）。
   */
  cameraControlDefaults?: {
    cameraKey: string;
    lensKey: string;
    focalKey: string;
    apertureKey: string;
  };
  canvasBackground?: CanvasBackground; // 画布背景主题
  /**
   * 一次生成多个结果时的默认保存方式（官方「画布设置 → 批量生成结果」，`generation-result-layout-*`）。
   * · `pile`     堆叠 —— 多个结果收进一个堆叠节点（官方默认）
   * · `variants` 多变体 —— 多个结果作为同一节点的变体
   * · `spread`   铺开 —— 每个结果一个独立节点（MTV 原有行为，MTV 默认值）
   */
  batchResultLayout?: 'pile' | 'variants' | 'spread';
  interactionMode?: InteractionMode; // 画布交互模式，默认 'default'
  nodeToolbarMode?: NodeToolbarMode; // 节点顶部工具栏显示方式，默认 'icons'
  nodeLabelVisible?: boolean; // 是否显示节点顶部标题标签，默认 true
  canvasNoteToolbarVisible?: boolean; // 是否显示画布笔记工具栏，默认 true
  canvasHistoryPinned?: boolean; // 操作记录浮层是否锁定常显（默认悬浮才显示）
  outputHistoryPinned?: boolean; // 输出历史面板是否固定常驻（固定后跳转节点不关闭面板）
  canvasQuickActions?: CanvasQuickAction[]; // 画布空白处长按圆环，最多 6 个槽位
  /**
   * ★ 模型映射：新发现、未验证的 Provider 模型进入系统后的默认状态。
   *   · `queue`          —— 进待审核队列（保留平台原始名，等待管理员确认官方映射）【默认】
   *   · `auto-candidate` —— 自动按别名/原厂/能力/版本等元数据生成候选，但仍标记待审核
   */
  modelMappingPolicy?: 'queue' | 'auto-candidate';
  /**
   * ★ 模型映射的**运行时覆盖层**（管理面板「保存映射 / 标记已验证 / 关联 canonical / 解除映射」）。
   * 同 `providerId + providerModelId` 时**覆盖** `src/data/modelMappings/*.json` 的出厂配置。
   */
  modelMappingOverrides?: ProviderModelMapping[];
  /** ★ 被「解除映射」屏蔽掉的出厂条目（键 = `providerId\u0000providerModelId`）。 */
  removedModelMappings?: string[];
  /** ★ 管理面板「创建新的 Canonical Model」新建的条目（叠加在 `modelCanonical.json` 之上）。 */
  modelCanonicalAdditions?: CanonicalModel[];
  startupView?: StartupView; // 软件启动后打开上次画布或项目列表，默认 'last-project'
  windowAspectRatio?: WindowAspectRatio; // 窗口尺寸预设所用比例，默认 '16:9'
  windowAspectLocked?: boolean; // 拖拽缩放窗口时是否固定为上面的比例，默认 false
  windowSize?: { width: number; height: number }; // 上次退出时的窗口逻辑尺寸，启动时恢复
  customCursor?: boolean; // 是否启用内置鼠标指针样式，默认 true
  customBackgroundUrl?: string;  // 自定义背景图片 data URL
  customBackgroundIsDark?: boolean; // 自定义背景是否为深色（自动识别）
  customBackgroundOpacity?: number; // 自定义背景透明度 0-1，默认 0.3
  comfyUIUrl?: string;        // ComfyUI 默认服务地址（工作流没绑定服务端时用它）
  comfyServers?: ComfyServer[]; // 额外的 ComfyUI 服务端，供工作流按需绑定
  comfyUIPath?: string;       // ComfyUI 安装目录路径
  dreaminaAuth?: DreaminaAuthData; // 即梦登录态
  baseDataDir?: string;       // 用户自定义文件保存根目录，保存结构为 {baseDataDir}/{projectId}/**
  generalModels?: GeneralModelConfig[]; // 用户自建通用模型
  sidebarFloating?: boolean;  // 侧边栏是否悬浮显示（半隐于窗口边缘），默认 false
  windowGlassFrame?: boolean; // 是否显示主窗口玻璃外框，默认 true
  /**
   * 官方 Pin 的**组名**（画布级配置，键 = 色组 id 即 hex 去掉 `#`）。
   * 官方存储位置：`updateCanvasConfig({ canvas_id, pin: { color_groups: { [groupId]: { name } } } })`
   * （`page-DPdEgTS0.js` @1637352 `ube(canvasId)`）。空值 ⇒ 回落到 i18n 默认名（`canvas.pin.colors.*`）。
   */
  pinGroupNames?: Record<string, string>;
  /**
   * 官方「媒体收藏」的本地态（`zoom-slider-3ZcFvYQO.js` 的 `nc` store @21670 / `L_` @432268）。
   * 键 = 官方 `sourceFileId`，MTV 的映射规则见 `utils/officialFavorites.ts`（`assetId` → `relativePath`
   * → `filePath` → 官方 `Xs(url)` 正则）；值 = 是否已收藏。
   * 与 `pinGroupNames` 同一套持久化通道（`updateConfig` + `saveConfig`）。
   */
  favoriteSourceFileIds?: Record<string, boolean>;
  /**
   * 工作空间「我的项目」的文件夹（官方 `collections`）。
   * 与 `pinGroupNames`/`favoriteSourceFileIds` 同一套持久化通道（`updateConfig` + `saveConfig`）。
   */
  collections?: WorkspaceCollection[];
  performanceMode?: boolean; // 性能模式：关闭高开销视觉效果与装饰动画，默认 false
  /** @deprecated 仅用于读取早期图形兼容模式配置，加载后迁移到 performanceMode。 */
  graphicsCompatibilityMode?: boolean;
  titlebarFloating?: boolean; // 标题栏是否悬浮显示（macOS 红绿灯内移并带毛玻璃胶囊），默认 true
  mascotVisible?: boolean;   // 是否显示吉祥物，默认 false
  mascotPosition?: MascotPosition; // 吉祥物相对视口位置，未设置时使用右下角默认位置
  assetFolders?: string[];    // 资产管理中登记的外部本地文件夹路径（引用不拷贝）
  assetWaterfallColumns?: number; // 资产管理瀑布流列数，默认 3，范围 2-6
  photoshopPath?: string;    // Photoshop 安装路径，自动检测失败时手动配置
  jianyingPath?: string;     // 剪映专业版安装路径，自动检测失败时手动配置
  premierePath?: string;     // Adobe Premiere Pro 安装路径，自动检测失败时手动配置
  assistantModelId?: string;  // 助手模型 ID：generalModels 中的 text 模型 id
  assistantImageModelId?: string;  // 助手生图模型 ID：generalModels 中的 image 模型 id
  assistantVideoModelId?: string;  // 助手生视频模型 ID：generalModels 中的 video 模型 id
  cloudParseEnabled?: boolean; // 是否启用云端解析，默认 true；关闭后助手仅使用本地规则
  mcpAutoStart?: boolean;     // 启动软件时自动开启 MCP 本地控制会话，默认 false
  mcpPort?: number;           // MCP 固定端口，1024-65535；未设置时随机分配
  mcpTransport?: 'stdio' | 'streamable-http'; // 默认 stdio；HTTP 模式监听 0.0.0.0
  mcpToolExposure?: McpToolExposure; // 默认 compact；full 兼容客户端原生工具发现
  /**
   * 「设置 → 权限」的**本机默认批准方式**（官方对应 `preference.confirmationMode`）。
   * 只用来初始化**新对话**的 `agentMode`；单次对话仍可在输入栏工具条里覆盖。
   * 缺省 = `'collaborative'`（与改版前的行为一致）。
   */
  agentDefaultMode?: AgentMode;
  /**
   * 「设置 → 权限」的**能力开关**（官方对应 `preference.localFiles` 那一组）。
   * 键 = `AgentToolEffect`，`false` = 该能力整体关闭（Policy Engine 直接拒绝）；
   * **缺省 / `true` = 开启**，所以不下发这一项时行为与改版前完全一致。
   * `read` 与 `user_choice` 不接受关闭（UI 里那两个开关是禁用的）。
   */
  agentCapabilities?: Partial<Record<AgentToolEffect, boolean>>;
}

// ── 通用模型配置 ──
export interface GeneralModelConfig {
  id: string;
  name: string;               // 名称
  modelId: string;            // 模型 ID
  category: GeneralModelCategory; // 模型种类
  contextWindow?: number;     // 文本模型上下文窗口（token）；未声明时按模型 ID 目录推断
  description?: string;       // 用户可编辑的模型用途说明，用于 Agent 路由参考
  inputModalities?: Array<'text' | 'image'>;
  /** 对应 config.providers 中的连接 ID，凭据和地址仅从该连接读取。 */
  providerConfigId: string;
  executionProfile?: ModelExecutionProfile;
  /** 图片模型存在参考图时使用的请求协议；缺省保持 generations JSON 兼容方式。 */
  imageReferenceRequestMode?: ImageReferenceRequestMode;
  /** 视频模型的参数能力声明（时长/分辨率/比例/参考素材等），缺省走通用兜底。 */
  videoCapability?: VideoModelCapability;
  /**
   * ★ 归一化后的模型身份（与 `ProviderModelSelection.normalized` 同一套）。
   * ⚠️ 界面只读 `normalized.displayName`；`modelId` 是上游真实调用 id（**原样发请求**）。
   *    旧配置没有这个字段 ⇒ 用 `services/models/display` 实时算，无需迁移。
   */
  normalized?: NormalizedModel;
  /**
   * ★ 官方模型目录的「思考」元数据（`model.thinking`）—— 与 `ProviderModelSelection.thinking`
   * 同一个透传通道；MTV 不自造档位，见该字段的说明。
   */
  thinking?: import('./chat').ModelThinkingMeta;
}

export const GENERAL_MODEL_CATEGORY_LABELS: Record<GeneralModelCategory, string> = {
  text: '文本',
  image: '图片',
  audio: '音频',
  video: '视频',
};

/** GeneralModelCategory → 适用的节点类型映射 */
export const CATEGORY_TO_NODE_TYPES: Record<GeneralModelCategory, NodeType[]> = {
  text: ['ai-text'],
  image: ['ai-image', 'ai-animation'],
  video: ['ai-video'],
  audio: ['ai-audio'],
};

// 引用节点信息
export interface NodeReference {
  nodeId: string;
  nodeLabel: string;
  nodeType: NodeType;
  outputType: 'text' | 'image' | 'video' | 'audio';
}

// ============================================
// 模型/供应商定义 — 驱动节点底部模型选择器
// ============================================

export interface ModelOption {
  value: string;              // 模型唯一 ID
  provider: string;           // 归属供应商
  label: string;              // 展示名
  description?: string;       // 简介
  inputModalities?: Array<'text' | 'image'>; // 可验证的输入模态
  icon?: string;              // 图标路径或内置图标名
  iconType?: 'image' | 'badge';
  badgeText?: string;
  nodeTypes: NodeType[];      // 可用于哪些节点类型
  nbFamily?: string;          // RunningHub/GRSAI nanobanana 家族标识（可选）
  audioPurpose?: AudioGenerationPurpose; // 音频模型用途，避免音乐与语音混用
  /* 官方模型目录的「思考」元数据（`model.thinking`）：模型带上它，
     `ChatThinkingPanel` 里的官方 Effort 档位控件才会出现（官方 `zs` 的首行判断）。 */
  thinking?: import('./chat').ModelThinkingMeta;
  /* 官方模型信息面板（`uu`）要的简介与能力评分（速度 / 智能 / 花费，1..5）。 */
  capabilityScores?: import('./chat').ModelCapabilityScores;
  /**
   * ★ 这条候选**走哪条连接**（P2）。
   *
   * 自定义连接的配置 key 形如 `custom-<uuid8>`，与展示名不同 ⇒ 两个中转站都接了 `gpt-4o`
   * 时，光看模型名分不出是哪条；候选上标出连接 id / 名字才能避免「选得到、发不出去」。
   * 内置厂商这一项等于 provider id（拿不到时留空）。
   */
  connectionId?: string;
  connectionName?: string;
  /**
   * ★ 「该连接的 key 在上游**用不了**它」（P2/P1）。
   *
   * 判据只有带 Key 的 `/v1/models` 权威清单；**没有清单时一律不置位**（不猜）。
   * **MTV 增强**：官方读账号级 `isPayingCustomer`，没有这套连接级可用性概念（NOT FOUND）。
   * ⚠️ 置位的候选**默认仍会列出**（除非调用方显式裁剪）—— 只用于加标记与确认前劝告，不阻断。
   */
  unavailable?: boolean;
}

export interface ModelGroup {
  id: string;
  name: string;               // 供应商展示名
  description: string;
  icon?: string;
  iconType?: 'image' | 'badge';
  badgeText?: string;
  models: ModelOption[];
}

// ============================================
// 工作流定义 — ComfyUI workflow import
// ============================================

/** 额外的 ComfyUI 服务端；图片 / 视频分开部署时，工作流各自绑定一台 */
export interface ComfyServer {
  id: string;
  name: string;
  url: string;
}

/** 工作流分类 — 对应各节点类型 */
export type WorkflowCategory = 'ai-text' | 'ai-image' | 'ai-video' | 'ai-audio';

/** 工作流中识别的输入/输出节点类型 */
export type WorkflowIONodeType = 'prompt' | 'image' | 'video' | 'audio';

/** 工作流中识别的输入/输出节点信息 */
export interface WorkflowIONode {
  nodeId: string;             // ComfyUI 节点 ID（如 "57:27"）
  title: string;              // 节点标题（来自 _meta.title 或 class_type）
  type: WorkflowIONodeType;   // 节点类型
}

/** 导入的 ComfyUI 工作流 */
export interface WorkflowDefinition {
  adapterType?: 'comfyui' | 'runninghub' | 'workflow-api';
  runninghub?: import('./runninghub').RunningHubWorkflowManifest;
  workflowApi?: import('./workflowApi').WorkflowApiManifest;
  id: string;
  name: string;               // 工作流名称
  category: WorkflowCategory; // 归属分类
  fileName: string;           // 原始文件名
  fileContent: string;        // JSON 字符串
  editableContent?: string;   // ComfyUI UI 工作流 JSON，用于保留节点布局后再次编辑
  ioNodes?: WorkflowIONode[]; // 识别出的输入/输出节点
  /** 各类型的默认 IO 节点（type → nodeId）；用户没 @ 该类型节点时，提示词框里的同类内容自动注入这里 */
  defaultNodes?: Partial<Record<WorkflowIONodeType, string>>;
  /** 绑定的 ComfyUI 服务端 id；为空或服务端已删除时回落到默认地址 */
  serverId?: string;
  createdAt: number;
  updatedAt?: number;
}

/** 按 NodeType 映射其所属工作流分类 */
export function getWorkflowCategory(nodeType: NodeType): WorkflowCategory | null {
  switch (nodeType) {
    case 'ai-text': return 'ai-text';
    case 'ai-image': return 'ai-image';
    case 'ai-video': return 'ai-video';
    case 'ai-audio': return 'ai-audio';
    default: return null;
  }
}

// ============================================
// 用户自定义预设 — 可编辑的提示词模板
// ============================================

export type PresetNodeType = 'ai-text' | 'ai-image' | 'ai-video' | 'ai-audio';

export const PRESET_NODE_TYPES: PresetNodeType[] = ['ai-text', 'ai-image', 'ai-video', 'ai-audio'];

export const PRESET_NODE_TYPE_LABELS: Record<PresetNodeType, string> = {
  'ai-text': '文本预设',
  'ai-image': '图像预设',
  'ai-video': '视频预设',
  'ai-audio': '音频预设',
};

// ============================================
// 节点类型统一视觉配置 — 图标、颜色、标签
// 所有组件引用此处，避免分散定义
// ============================================
export interface NodeTypeVisualConfig {
  icon: string;      // MDI 图标名（用于 @iconify/react <Icon>）
  color: string;     // Tailwind 文字颜色类，如 'text-accent-primary'
  bg: string;        // Tailwind 背景色类，如 'bg-primary/15'
  label: string;     // 中文名称
}

export const NODE_TYPE_CONFIG: Record<string, NodeTypeVisualConfig> = {
  /* 「文本」与「插件」两类原先用 MTV 靛蓝（`indigo` 色族 400 = #6366f1 / `--brand` 一族同色值）。
     2026 round 95 全仓移除 MTV 品牌色 ⇒ 这里改用官方令牌 `--accent-primary`(#90c4e5) +
     `--primary`(#1fa2dc) 的 15% 淡化底，**保持本表 12 类的分类色系统不变**。
     ⚠️ 官方**没有**「按节点类型分配身份色」的表：官方自己的节点提及面
     （`.mention-node[data-mention-type='plugin'|'skill'|'brainstorm']`，`index-BroFpZiQ.css` 逐字）
     走的是中性 —— `text-text-text-primary` + `bg-transparent`/`bg-[#333333]`。
     ⇒ 本项属于「官方无对应物 → 按官方主色刻度替换」，详见 round 95 报告。 */
  'ai-text':     { icon: 'mdi:text-box-outline',         color: 'text-accent-primary', bg: 'bg-primary/15',  label: '生成文本' },
  'ai-image':    { icon: 'mdi:image-outline',             color: 'text-green-400',   bg: 'bg-green-500/15',   label: '生成图像' },
  /* ⚠️ `label` = 官方**菜单项**文案 `nodes.videoNode`（zh「视频」@4403524 / en `Video` @3781502 /
     ja「動画」@4135656 / ko「비디오」@4276918，逐字；见 `vendor-pkg-canvas-CvbAwZyy.js`）。
     🚨 **它不是卡片标题**：官方视频卡的默认标题是工厂 `Tr` 里**硬编码的英文字面量** `title:"Video"`
     （canvas @742021 逐字 `C={src:"",prompt:"",title:"Video",type:_o.GENERATE,…}`），
     `gr`/`pLe`（NodeCard）逐字 `H=y?.title||i||"Title"` 直接渲染 `data.title`
     （标题行 `WDe` @833604 `children:e` —— 全链无任何本地化）。
     ⇒ 卡片标题由 `nodePickerActions.buildNodeData` 显式写成 `'Video'`，**不**走本字段。
     本字段只喂「添加节点」菜单之外的统计/历史等表面，口径与官方菜单一致（原来是自造的「生成视频」）。 */
  'ai-video':    { icon: 'mdi:video-outline',             color: 'text-blue-400',    bg: 'bg-blue-500/15',    label: '视频' },
  'ai-audio':    { icon: 'mdi:volume-high',               color: 'text-orange-400',  bg: 'bg-orange-500/15',  label: '生成音频' },
  'ai-animation': { icon: 'mdi:animation-play-outline',    color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/15', label: '生成动画' },
  'ai-panorama': { icon: 'mdi:panorama',                  color: 'text-cyan-400',    bg: 'bg-cyan-500/15',    label: '生成360全景' },
  'ai-markdown': { icon: 'mdi:language-markdown-outline', color: 'text-purple-400',  bg: 'bg-purple-500/15',  label: 'Markdown' },
  'ai-storyboard': { icon: 'mdi:grid',                    color: 'text-pink-400',    bg: 'bg-pink-500/15',    label: '宫格分镜' },
  'ai-shotlist':   { icon: 'mdi:table-large',             color: 'text-amber-400',   bg: 'bg-amber-500/15',   label: '分镜表' },
  'ai-director':   { icon: 'mdi:video-3d',                color: 'text-violet-400',  bg: 'bg-violet-500/15',  label: '3D 导演台' },
  'plugin-node':   { icon: 'mdi:puzzle-outline',          color: 'text-accent-primary', bg: 'bg-primary/15',  label: '插件节点' },
  'canvas-note':   { icon: 'mdi:draw',                    color: 'text-sky-400',     bg: 'bg-sky-500/15',     label: '画布笔记' },
  /* 画布「对比」节点（用户 2026 要的：两张图片节点连进来即出对比滑块） */
  /* ⚠️ 本条曾被「插入 mockup」的补丁整行顶掉（`git diff` 里的 `-  'compare': …`）——
     现按原文**逐字补回**（图标/色/底/文案四项与 HEAD 完全一致）。测试
     `tests/components/compareNodeRegistry.test.ts` 已加不变量兜底。 */
  'compare':       { icon: 'mdi:compare',                 color: 'text-sky-400',     bg: 'bg-sky-500/15',     label: '对比' },

  'mockup':        { icon: 'mdi:devices',                 color: 'text-violet-400',  bg: 'bg-violet-500/15',  label: '样机' },
};

/** 获取节点类型视觉配置，未匹配时返回灰色兜底 */
export function getNodeTypeConfig(kind: string): NodeTypeVisualConfig {
  return NODE_TYPE_CONFIG[kind] ?? { icon: 'mdi:help-circle-outline', color: 'text-gray-400', bg: 'bg-gray-500/15', label: kind };
}

export type PresetTriggerMode = 'direct' | 'insertPrompt';

export type UserPresetMode = 'basic' | 'advanced';

export type PresetParameterType = 'text' | 'textarea' | 'number' | 'select' | 'boolean';

export type PresetParameterValue = string | number | boolean;

export interface PresetParameterDefinition {
  id: string;
  key: string;
  label: string;
  type: PresetParameterType;
  required?: boolean;
  defaultValue?: PresetParameterValue;
  options?: string[];
}

export interface PresetSequenceStep {
  id: string;
  name: string;
  nodeType: PresetNodeType;
  promptTemplate: string;
  model?: string;
  provider?: string;
  /** provider=comfyui 时指定本地工作流；缺省则沿用触发节点的工作流 */
  workflowId?: string;
  imageSize?: string;
  aspectRatio?: string;
}

export interface PresetAdvancedConfig {
  parameters: PresetParameterDefinition[];
  steps: PresetSequenceStep[];
}

export interface PresetRunRequest {
  presetId: string;
  sourceNodeId: string;
}

/** 反推提示词弹窗的输入：图片节点给自身图，视频节点给抽好的关键帧 */
export interface ReversePromptRequest {
  sourceNodeId: string;
  kind: 'image' | 'video';
  imageUrls: string[];
}

// ── 用户自定义画风 ──
export interface CustomStyle {
  id: string;
  nodeType: string;       // 'ai-image' | 'ai-panorama' | 'ai-video'
  name: string;           // 画风名称
  prompt: string;         // 画风提示词
  thumbnail?: string;     // base64 缩略图
  createdAt: number;
}

export interface UserPreset {
  id: string;
  nodeType: PresetNodeType;
  name: string;
  description: string;
  promptTemplate: string;
  icon?: string;              // iconify icon name (e.g. 'mdi:star'), for Toolbar display
  thumbnail?: string;        // base64 data URL
  triggerMode: PresetTriggerMode;  // direct=替换全文, insertPrompt=追加到提示词
  // 可选：预设绑定的模型和尺寸，选择后生图时覆盖节点设置
  model?: string;
  provider?: string;
  imageSize?: string;
  aspectRatio?: string;
  /** 旧数据缺省时按 basic 读取。 */
  mode?: UserPresetMode;
  advanced?: PresetAdvancedConfig;
}

// ============================================
// 用户 Skill — 只读上传与调用，不提供内置编辑
// ============================================

export interface SkillManifest {
  name?: string;
  description?: string;
  whenToUse?: string;
  /** 缺省表示不额外限制；空数组表示该 Skill 不需要任何 Agent 工具。 */
  allowedTools?: string[];
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
  version?: string;
}

export interface UserSkill {
  id: string;
  name: string;
  description: string;
  fileName: string;
  content: string;
  sourceType: 'file' | 'folder';
  storagePath?: string;
  entryFileName?: string;
  /** 从入口文件 frontmatter 解析的非执行型声明。 */
  manifest?: SkillManifest;
  /**
   * 是否启用（官方技能详情页右上那颗开关）。
   * 缺省 = 启用；关掉后技能**仍列在管理面板里**，但不再出现在模型/用户/MCP 三个面上
   * （见 `skillCatalog.isSkillAvailableOnSurface` 的硬门）。
   */
  enabled?: boolean;
  createdAt: number;
}

// ============================================
// 节点分组
// ============================================

export interface NodeGroup {
  id: string;
  name: string;
  nodeIds: string[];
  color: string;
  createdAt: number;
}

/** 分组色板 — 循环分配（首色原为 MTV 靛蓝 `#6366f1`，2026 round 95 改用官方 `--primary` #1fa2dc） */
export const GROUP_COLOR_PALETTE = [
  '#1fa2dc',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#14b8a6',
  '#f97316',
];

// ============================================
// Toolbar 自定义编辑 — 按钮 / Zone / 布局
// ============================================

/** Toolbar 按钮定义（注册表中每一项） */
export interface ToolbarButtonDef {
  key: string;              // 唯一标识，如 'copy', 'fullscreen', 'matting'
  label: string;            // tooltip 文本
  icon: string;             // iconify name (e.g. 'mdi:copy') 或 emoji
  /**
   * 官方原版 SVG 图标名（src/assets/official-icons/）。
   * 有值时优先渲染它，而不是上面的 iconify 图标 —— 用于和 TapNow 官方 1:1 对齐。
   */
  officialIcon?: string;
  /**
   * 官方原版图标的**固有尺寸**（px）。不填 = 节点工具栏默认 20px。
   *
   * 官方依据：各工具自己传 `size`（图像主行 = 20；⋯ 菜单项 = 16 被 `svg:size-5` 拉到 20；
   * 文本卡「复制全部」`yU`(CopyButton) 内部 = **16px**）⇒ 这一栏只为「固有尺寸 ≠ 默认」的项存在。
   */
  officialIconSize?: number;
  defaultZone: string;      // 默认归属 Zone 名
  /**
   * 默认**不进主行**，只出现在「⋯ 浏览全部」菜单里。
   *
   * 官方依据（TapNowExtract · `zoom-slider-3ZcFvYQO.js` @3083219 `ptt`）：
   * 图像节点主行只有 `crop / multi_angle / redraw / relight / ⋯`（+ 右组 saveToLibrary/download/scale），
   * 其余（outpainting/erase/annotation/enhance/resizePixels/cutout/quickSplit/authenticityCheck）
   * **全部在 ⋯ 菜单里**，主行不出现 ⇒ 本字段即官方的「不在主行」。
   */
  defaultHidden?: boolean;
  /**
   * 官方的**项级显隐门**（官方容器 `cPe`：`g?.invisible!==!0||!!g?.lockedTooltip`）：
   * `invisible && !lockedTooltip` ⇒ 该项被过滤掉（不渲染）；
   * `invisible && lockedTooltip` ⇒ 保留渲染，但成为「禁用 + 锁定提示」态。
   */
  invisible?: boolean;
  /** 锁定提示（官方 `lockedTooltip`）：有值时该项禁用并显示这句话而不是 label */
  lockedTooltip?: string;
  /** 静态禁用（官方 `y = b.disabled || !!b.lockedTooltip`） */
  disabled?: boolean;
  /** 是否有状态变体（如 copied 状态的图标），默认 false */
  hasState?: boolean;
  /** 子菜单项 key 列表（如宫格裁切有子菜单） */
  subKeys?: string[];
}

/** 一个 Zone 的布局 */
export interface ToolbarZoneLayout {
  id: string;
  name: string;
  buttonKeys: string[];
}

/** 单个节点类型的 Toolbar 布局 */
export interface ToolbarLayout {
  zones: ToolbarZoneLayout[];
  version: number;
}

/** 所有节点类型的 Toolbar 布局集合 */
export type ToolbarLayouts = Record<string, ToolbarLayout>;

/**
 * 官方**下拉菜单行**（`dPe` 的 `menuItems[i]`）的**超集类型**：在 `ToolbarButtonDef` 之上把
 * `icon` / `defaultZone` 放宽为可选（其余字段不变）。
 *
 * 为什么不用「更瘦的独立类型」：调用方（图像/文本工具栏）的 `renderIcon` 直接就是 `DefIcon`，
 * 形参收 `ToolbarButtonDef`（它要读 `officialIcon`）。若菜单行类型更瘦，箭头函数的逆变检查会报
 * 「`defaultZone` 缺失」；用**超集**则 `ToolbarButtonDef` 仍可赋给 `ToolbarMenuRowDef`，两边都成立。
 *
 * 官方依据（为什么菜单行可以没有 icon / defaultZone）：
 *   `course-api-base-url-DmmB7bTf.js@2680931` 的 `x2e`（视频卡三帧菜单）三项**只有**
 *   `key` / `labelKey` / `mode`；同一份代码里的 `more` 菜单项才带 `icon:a.jsx(Sx,{size:16})`
 *   ⇒ 「菜单行没有图标」是官方允许的形态，MTV **不编造图标**。
 */
export type ToolbarMenuRowDef = Omit<ToolbarButtonDef, 'icon' | 'defaultZone'> & {
  /** 有 `icon` 才渲染行图标；没有就只渲染文字 */
  icon?: string;
  /** 菜单行不参与主行分区 ⇒ 可缺省 */
  defaultZone?: string;
};
