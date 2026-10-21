/**
 * nodePickerActions — 「添加节点」菜单的**唯一添加动作**。
 *
 * 与 `nodePickerCatalog.tsx`（唯一目录）、`NodePickerPanel.tsx`（唯一内容组件）配套：
 * 菜单里每一条生成类节点都走这里建节点，因此两个入口点出来的节点数据完全一致。
 * （单独成文件是为了满足 `react-refresh/only-export-components`。）
 */
import { useAppStore, generateId } from '../../store/useAppStore';
import type { NodeType } from '../../types';
import { NODE_TYPE_CONFIG } from '../../types';
import { getCanvasPointerPosition } from '../../services/canvasPointerService';
import { NODE_BASE_SIZE, nodeSizeForAspect } from '../../utils/nodeBounds';
import { imageNodeDefaultParamsForModelValue } from '../../utils/imageNodeDefaults';
import { officialVideoNodeFlatDefaults, officialVideoNodeParamsSeed } from '../../utils/officialVideoNodeParams';
import { generationItems } from './nodePickerCatalog';

/** 从 localStorage 读取上次用过的默认模型（按节点类型） */
function loadDefaultModel(nodeType: string): { model: string; provider: string } | null {
  try {
    const raw = localStorage.getItem('canvas-model-prefs');
    if (!raw) return null;
    const prefs: Record<string, string> = JSON.parse(raw);
    // 全景图 / 逐帧动画回退到生图偏好
    const modelValue = prefs[nodeType]
      || (nodeType === 'ai-panorama' || nodeType === 'ai-animation' ? prefs['ai-image'] : undefined);
    if (!modelValue) return null;
    const slashIdx = modelValue.indexOf('/');
    if (slashIdx === -1) return null;
    const provider = modelValue.slice(0, slashIdx);
    if (!provider) return null;
    return { model: modelValue, provider };
  } catch {
    return null;
  }
}

/** 节点的默认尺寸与初始数据（尺寸按 **官方 EXE 源码**：`Od={250,250}` / `pR(ratio)` / 文本卡 = `Ha`=250×250） */
export function buildNodeData(type: NodeType): Record<string, unknown> {
  const isImage = type === 'ai-image';
  const isText = type === 'ai-text';
  const isPanorama = type === 'ai-panorama';
  const isAnimation = type === 'ai-animation';
  const isDirector = type === 'ai-director';
  const isCompare = type === 'compare';

  const isMockup = type === 'mockup';
  const isVideo = type === 'ai-video';
  /* ★ 默认模型要**先拿到** ✓（新图卡的默认 比例/尺寸 按模型给 ✓ 见下 ✓）*/
  const defaultModel = loadDefaultModel(type);
  /* ★ gpt-image-2.5-flare / sunburst → 「自适应」+ 1K ✓
       （上游按 ~1K 原生渲染再放大 ⇒ 2K/4K 反而更糊 ⇒ 实测见 `imageNodeDefaultParams` 注释 ✓）
       其余模型 → 旧默认 16:9 + 2K ✓ 不动 ✓ */
  const imageDefaults = imageNodeDefaultParamsForModelValue(defaultModel?.model);
  /* 官方 `pR`：横图高定 250 · 竖图宽定 250；新建图卡带 `aspectRatio`（默认 16:9 ⇒ 444×250 ✓）*/
  const imageBox = nodeSizeForAspect(imageDefaults.aspectRatio);
  /* ══ §108 新建视频卡尺寸 = 官方 `ar(16/9)` = **444×250** ══
     官方工厂写死 16:9（`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @735528 区逐字
       `{width:N,height:E}=ar(16/9)`；放大工厂 `DZ` @735800 区同写 `ar(16/9)`；
       `ar` 定义 @497533：基准 `ws={width:250,height:250}`，`ratio>1 ⇒ 高 250、宽 250*ratio`）
     ⇒ `Math.round(250*16/9)=444` ⇒ **444×250**。
     官方真机 CDP 9222（`app.tapnow.media/canvas/86b84122-…`）实测同值：
       `.react-flow__node[data-id^="video-"]` 的 inline style 逐字 `width:444px;height:250px`。
     MTV 原来把视频卡写死 **280×160** ✗ ⇒ 按官方改成 `nodeSizeForAspect('16:9')`。
     ⚠️ 只改**新建**卡的默认尺寸；已有节点带自己的 `nodeWidth/nodeHeight`，不受影响。 */
  const videoBox = nodeSizeForAspect('16:9');
  const nodeData: Record<string, unknown> = {
    /* 官方文本卡标题 = **"Text"**（`wT`/`Dx` 逐字 `title:"Text"`）——与图片卡一律 "Image" 同一套口径。
       ★ 对比卡：用户 2026「添加节点菜单里的名字不变 依旧是 对比，创建/连接后 卡片左上角显示为 图片对比」
         ⇒ **菜单行文字**（`nodePickerCatalog` 的 `label`）保持「对比」，
            **节点数据里的默认标题**是「图片对比」（卡片左上角读的是它）。 */
    /* 官方视频卡默认标题 = **工厂 `Tr` 硬编码的英文字面量 `"Video"`**（canvas @742021 逐字
       `C={src:"",prompt:"",title:"Video",type:_o.GENERATE,…}`）—— **不走 i18n**。
       标题行 `WDe` @833604 逐字 `children:e` 原样渲染 `data.title`，全链无本地化。
       ⚠️ 与 `NODE_TYPE_CONFIG['ai-video'].label`（= 官方**菜单**文案 `nodes.videoNode`，zh「视频」）
       是**两个不同的官方字符串**，别混。 */
    label: isText
      ? 'Text'
      : isVideo
        ? 'Video'
        : isCompare
          ? '图片对比'
          : (NODE_TYPE_CONFIG[type]?.label || generationItems.find((m) => m.type === type)?.label || '节点'),
    type,
    prompt: '',
    status: 'idle' as const,
    nodeWidth: isText ? NODE_BASE_SIZE.width
      : isImage ? imageBox.width
        : isCompare ? NODE_BASE_SIZE.width
        : isMockup ? 720
          : isAnimation || isDirector ? 320
            : isPanorama ? 300
              : isVideo ? videoBox.width : 280,
    nodeHeight: isText ? NODE_BASE_SIZE.height
      : isImage ? imageBox.height
        : isCompare ? NODE_BASE_SIZE.height
        : isMockup ? 720
          : isDirector ? 240 : isAnimation ? 358 : isPanorama ? 200
            : isVideo ? videoBox.height : 160,
  };
  if (isImage) {
    nodeData.aspectRatio = imageDefaults.aspectRatio;
    nodeData.imageSize = imageDefaults.imageSize;
  }
  if (isPanorama) {
    nodeData.previewMode = 'image';
  }
  if (isAnimation) {
    nodeData.prompt = '2D俯视角游戏角色，保持角色造型、朝向、比例和光照一致';
    nodeData.animationAction = 'idle';
    nodeData.animationFrames = 8;
    nodeData.animationPreviewMode = 'playing';
    nodeData.aspectRatio = '1:1';
    nodeData.imageSize = '2K';
  }
  if (isDirector) {
    nodeData.role = 'source';
    nodeData.directorStatus = 'idle';
    nodeData.directorCaptureUrls = [];
  }
  if (isCompare) {
    /* 与多选菜单那条 `nodes.compareNode` 建出来的数据同形状（两处入口建的卡一致） */
    nodeData.compareMode = 'split';
    nodeData.direction = 'horizontal';
    nodeData.splitDirection = 'vertical';
  }
  if (isMockup) {
    nodeData.label = '样机';
    nodeData.hide_inputbar = true;
    nodeData.mockupDeviceId = 'iphone-duo';
    nodeData.mockupFoldAngle = 180;
  }
  if (defaultModel) {
    nodeData.model = defaultModel.model;
    nodeData.provider = defaultModel.provider;
  }
  if (isVideo) {
    /* ★ §93 官方 `Tr` @743227 的 `params` 种子 —— 建卡时**必须**写入 `params.modelType`：
       官方 `LXe` @1991362 `const h=n?.params?.modelType` 是底部 chip「生成方式」段的唯一来源，
       缺省 ⇒ `dd(null)=null` ⇒ 该段不 push（用户实测「生成方式」缺失的直接原因）。
       另：官方 `Tr` 把 `variants[0].defaults`（`aspectRatio`/`duration`/`resolution`/`generateAudio`）
       一并铺进 `params` ⇒ 比例/清晰度/时长三段也随之有值。
       ⚠️ 只补「节点还没有 params」的新卡；存量节点数据一律不动（用户已改过的参数不能被覆盖）。 */
    nodeData.params = officialVideoNodeParamsSeed(defaultModel?.model, defaultModel?.provider);
    Object.assign(nodeData, officialVideoNodeFlatDefaults(defaultModel?.model));
    nodeData.videoNodeType = 'generate'; // 官方 `_o.GENERATE`（`Tr` 逐字 `type:_o.GENERATE`）
  }
  return nodeData;
}

/** 统一的「添加节点」动作：两个入口点出来的节点完全一样 */
export function addNodeFromPicker(type: NodeType, onClose: () => void): void {
  useAppStore.getState().addNode({
    id: `node-${generateId()}`,
    type,
    position: getCanvasPointerPosition(),
    data: buildNodeData(type),
  } as never);
  onClose();
}
