/**
 * §71 官方 `_p`/`x9` 的「**输入感知** variant 选择」—— 上游连线素材计数（官方 `parentCounts`）全链。
 *
 * 官方逐字（`vendor-packages-DRvCmDjR.js` / `vendor-pkg-canvas-CvbAwZyy.js`）：
 * ```js
 * // @1220052  `_p`（本地名 `y9`）：5 参 = model, modelType, imageCount, videoCount, audioCount=0
 * y9=(e,t,n,s,r=0)=>{ … switch(t){ case K.TEXT_TO_VIDEO: return n===0&&s===0;
 *                                case K.IMAGE_TO_VIDEO: return n===1&&s===0; … } }
 * // @1216950  `x9`（本地名 `Uhe`）：4 参 —— **没有音频入参**
 * function x9(e,t,n=0,s=0){ … for(const o of r.variants) if(y9(e,o.modelType,t,n,s)) return {…} … }
 * // @1991414  `LXe`：`parentCounts` 只算「generation-input」入边带进来的父节点
 * const{parentNodes:o}=Ac(e), r=cn(f=>f.edges),
 *       i=a.useMemo(()=>{const f=new Set(r.filter(h=>h.target===e&&vu(h.data?.purpose)).map(h=>h.source));
 *                        return o.filter(h=>f.has(h.id))},[o,r,e]),
 *       l=a.useMemo(()=>Sc(i),[i]), … return {…, parentCounts:l, …}
 * // @810176  `Sc`：按节点类型分三类计数
 * Sc=e=>({imageCount:e.filter(r=>r.type===Z.IMAGE).length,
 *         videoCount:e.filter(r=>r.type===Z.VIDEO||r.type===Z.VIDEO_EDIT).length,
 *         audioCount:e.filter(r=>r.type===Z.AUDIO).length})
 * // @731952  `vu(e)`：`e==null||e==="generation-input"`
 * ```
 * ⇒ 目标症状（§69 遗留缺口）：「连了 1 张图时 MTV 走 `text` variant，官方走 `image`」。
 */
import { describe, expect, it } from 'vitest';
import type { Edge, Node as RFNode } from '@xyflow/react';
import {
  collectParentReferenceCounts,
  isGenerationInputPurpose,
} from '../../src/utils/referenceTokens';
import {
  variantMatchesExactInputs,
  videoVariantForMethod,
  videoVariantForModel,
} from '../../src/services/ai/modelParamCatalog';

/* ── 最小夹具：`collectParentReferenceCounts` 只读 `id / type / data` ──────────── */
type FixtureNode = Pick<RFNode, 'id' | 'type'> & { data: Record<string, unknown> };

function node(id: string, type: string, data: Record<string, unknown> = {}): FixtureNode {
  return { id, type, data } as FixtureNode;
}

function edge(id: string, source: string, target: string, data?: Record<string, unknown>): Edge {
  return { id, source, target, ...(data ? { data } : {}) } as Edge;
}

const VIDEO_TARGET = 'video-1';

function counts(edges: readonly Edge[], nodes: readonly FixtureNode[]) {
  return collectParentReferenceCounts(VIDEO_TARGET, edges, nodes as unknown as readonly RFNode[]);
}

/* ── 官方 `vu`（purpose 谓词） ──────────────────────────────────────────────── */
describe('官方 `vu`（canvas:@731952）的 purpose 谓词', () => {
  it('`null`/`undefined`/`generation-input` 才算生成输入边', () => {
    expect(isGenerationInputPurpose(undefined)).toBe(true);
    expect(isGenerationInputPurpose(null)).toBe(true);
    expect(isGenerationInputPurpose('generation-input')).toBe(true);
    /* 官方 `JL`：`world-script` / `world-edit-reference` 是 3D 世界专用边，不算生成输入 */
    expect(isGenerationInputPurpose('world-script')).toBe(false);
    expect(isGenerationInputPurpose('world-edit-reference')).toBe(false);
    expect(isGenerationInputPurpose('')).toBe(false);
  });
});

/* ── 官方 `Sc` 三类计数（MTV 同源口径） ────────────────────────────────────── */
describe('`collectParentReferenceCounts`：上游连线素材计数（官方 LXe→Sc）', () => {
  it('0 引用 ⇒ 0/0/0', () => {
    expect(counts([], [node(VIDEO_TARGET, 'ai-video')])).toEqual({
      imageCount: 0, videoCount: 0, audioCount: 0,
    });
  });

  it('1 张图（`ai-image` 有 `imageUrl`）⇒ imageCount=1', () => {
    expect(counts(
      [edge('e1', 'img-1', VIDEO_TARGET)],
      [node(VIDEO_TARGET, 'ai-video'), node('img-1', 'ai-image', { imageUrl: 'a.png' })],
    )).toEqual({ imageCount: 1, videoCount: 0, audioCount: 0 });
  });

  it('多类混合：2 图 + 1 视频 + 1 音频 + 1 文本 ⇒ 文本**不计入**三类', () => {
    expect(counts(
      [
        edge('e1', 'img-1', VIDEO_TARGET),
        edge('e2', 'img-2', VIDEO_TARGET),
        edge('e3', 'vid-1', VIDEO_TARGET),
        edge('e4', 'aud-1', VIDEO_TARGET),
        edge('e5', 'txt-1', VIDEO_TARGET),
      ],
      [
        node(VIDEO_TARGET, 'ai-video'),
        node('img-1', 'ai-image', { imageUrl: 'a.png' }),
        node('img-2', 'source-image', { src: 'b.png' }),
        node('vid-1', 'ai-video', { videoUrl: 'c.mp4' }),
        node('aud-1', 'ai-audio', { audioUrl: 'd.mp3' }),
        node('txt-1', 'ai-text', { text: 'hello' }),
      ],
    )).toEqual({ imageCount: 2, videoCount: 1, audioCount: 1 });
  });

  it('① 出边 / ② 别人的入边 ⇒ 不计；③ 入边但源卡还没出图 ⇒ **计 1**（官方只看节点类型）', () => {
    expect(counts(
      [
        edge('e1', VIDEO_TARGET, 'img-1'),                 // ① 出边
        edge('e2', 'img-2', 'other-node'),                 // ② 别人的入边
        edge('e3', 'img-3', VIDEO_TARGET),                 // ③ 入边，源卡还没出图
      ],
      [
        node(VIDEO_TARGET, 'ai-video'),
        node('img-1', 'ai-image', { imageUrl: 'a.png' }),
        node('img-2', 'ai-image', { imageUrl: 'b.png' }),
        node('img-3', 'ai-image', {}),
      ],
    )).toEqual({ imageCount: 1, videoCount: 0, audioCount: 0 });
  });

  it('非素材类型的入边（如 `ai-shotlist`）不计入任何一类', () => {
    expect(counts(
      [edge('e1', 'shot-1', VIDEO_TARGET)],
      [node(VIDEO_TARGET, 'ai-video'), node('shot-1', 'ai-shotlist', { rows: [] })],
    )).toEqual({ imageCount: 0, videoCount: 0, audioCount: 0 });
  });

  it('非「生成输入」purpose 的入边被官方 `vu` 过滤掉', () => {
    expect(counts(
      [
        edge('e1', 'img-1', VIDEO_TARGET, { purpose: 'world-script' }),
        edge('e2', 'img-2', VIDEO_TARGET, { purpose: 'generation-input' }),
        edge('e3', 'img-3', VIDEO_TARGET, { purpose: undefined }),
      ],
      [
        node(VIDEO_TARGET, 'ai-video'),
        node('img-1', 'ai-image', { imageUrl: 'a.png' }),
        node('img-2', 'ai-image', { imageUrl: 'b.png' }),
        node('img-3', 'ai-image', { imageUrl: 'c.png' }),
      ],
    )).toEqual({ imageCount: 2, videoCount: 0, audioCount: 0 });
  });

  it('源节点不在画布上（悬空边）⇒ 不计、不炸', () => {
    expect(counts(
      [edge('e1', 'ghost', VIDEO_TARGET)],
      [node(VIDEO_TARGET, 'ai-video')],
    )).toEqual({ imageCount: 0, videoCount: 0, audioCount: 0 });
  });

  it('同一张上游卡连了两条边 ⇒ 官方 `Cee` 的 `[...new Set(source)]` 去重 ⇒ 只算 1', () => {
    /* 第 65 轮按官方对齐：官方 `Cee`（canvas:@1044905，逐字 `[...new Set(入边 source)]`）
       先按 source 去重再映射成 parentNodes ⇒ 「同源双线」官方算 **1**。
       （此前 MTV 按**边**计数算 2，已在记录 §71 D2 登记为差异；本轮改为官方口径。） */
    expect(counts(
      [edge('e1', 'img-1', VIDEO_TARGET), edge('e2', 'img-1', VIDEO_TARGET)],
      [node(VIDEO_TARGET, 'ai-video'), node('img-1', 'ai-image', { imageUrl: 'a.png' })],
    )).toEqual({ imageCount: 1, videoCount: 0, audioCount: 0 });
  });
});

/* ── 症结：`_p` 的输入感知让 `frames` 档在 text / image 之间切换 ───────────── */
describe('§71 症结：1 张图时官方选 `image`（不是 `text`）', () => {
  /* 官方 seedance-2.0 的 variant 表（`model-param-catalog.json`，= vendor-packages `Fe`）：
     `reference`(reference_to_video, img min0/max9) → `text`(text_to_video) → `image`(image_to_video) → … */
  const MODEL = 'seedance-2.0';

  it('`_p`（`variantMatchesExactInputs`）逐字：0/1/2 决定 frames 档的兄弟 variant', () => {
    expect(variantMatchesExactInputs(MODEL, 'text_to_video', 0, 0, 0)).toBe(true);
    expect(variantMatchesExactInputs(MODEL, 'image_to_video', 0, 0, 0)).toBe(false);
    expect(variantMatchesExactInputs(MODEL, 'image_to_video', 1, 0, 0)).toBe(true);
    expect(variantMatchesExactInputs(MODEL, 'text_to_video', 1, 0, 0)).toBe(false);
    expect(variantMatchesExactInputs(MODEL, 'start_end_to_video', 2, 0, 0)).toBe(true);
    expect(variantMatchesExactInputs(MODEL, 'start_end_to_video', 1, 0, 0)).toBe(false);
    expect(variantMatchesExactInputs(MODEL, 'reference_to_video', 1, 0, 0)).toBe(true);
    expect(variantMatchesExactInputs(MODEL, 'reference_to_video', 2, 0, 0)).toBe(true);
  });

  it('0 引用（真实计数）⇒ `frames` 档 = `text`', () => {
    const counts0 = counts([], [node(VIDEO_TARGET, 'ai-video')]);
    expect(counts0).toEqual({ imageCount: 0, videoCount: 0, audioCount: 0 });
    expect(videoVariantForMethod(
      MODEL, 'frames', counts0.imageCount, counts0.videoCount, counts0.audioCount,
    )).toMatchObject({ modelType: 'text_to_video', variant: 'text' });
  });

  it('**1 张图（真实计数）⇒ `frames` 档 = `image`**（§69 遗留缺口，本轮修复）', () => {
    const counts1 = counts(
      [edge('e1', 'img-1', VIDEO_TARGET)],
      [node(VIDEO_TARGET, 'ai-video'), node('img-1', 'ai-image', { imageUrl: 'a.png' })],
    );
    expect(counts1).toEqual({ imageCount: 1, videoCount: 0, audioCount: 0 });
    expect(videoVariantForMethod(
      MODEL, 'frames', counts1.imageCount, counts1.videoCount, counts1.audioCount,
    )).toMatchObject({ modelType: 'image_to_video', variant: 'image' });
  });

  it('2 张图（真实计数）⇒ `frames` 档 = `start_end`', () => {
    const counts2 = counts(
      [edge('e1', 'img-1', VIDEO_TARGET), edge('e2', 'img-2', VIDEO_TARGET)],
      [
        node(VIDEO_TARGET, 'ai-video'),
        node('img-1', 'ai-image', { imageUrl: 'a.png' }),
        node('img-2', 'ai-image', { imageUrl: 'b.png' }),
      ],
    );
    expect(counts2).toEqual({ imageCount: 2, videoCount: 0, audioCount: 0 });
    expect(videoVariantForMethod(
      MODEL, 'frames', counts2.imageCount, counts2.videoCount, counts2.audioCount,
    )).toMatchObject({ modelType: 'start_end_to_video', variant: 'start_end' });
  });

  it('选模型（官方 `CQe` → `x9`/`o$`）同样吃真实计数', () => {
    /* 0 引用：`x9` 从第一个 variant 起找 `_p` 命中项 ⇒ seedance-2.0 的 `reference`（img min0） */
    expect(videoVariantForModel(MODEL, 0, 0, 0)).toMatchObject({
      modelType: 'reference_to_video', variant: 'reference',
    });
    /* 1 张图：`reference` 仍精确命中（min0/max9 且视频数 0）⇒ 官方同样先给 `reference`。
       注意官方 `x9` 是**按目录顺序取第一个 `_p` 命中项**，不是「最贴合的那个」：
       `veo3.1` 的目录顺序是 `text → image → start_end → reference`（img min1），
       1 张图时**排在前面的 `image` 先命中** ⇒ 仍是 `image`，
       `reference` 只在 `image` 不成立（如 `videoCount>0` 等）时才轮得到。 */
    expect(videoVariantForModel(MODEL, 1, 0, 0)).toMatchObject({
      modelType: 'reference_to_video', variant: 'reference',
    });
    expect(videoVariantForModel('veo3.1', 0, 0, 0)).toMatchObject({
      modelType: 'text_to_video', variant: 'text',
    });
    expect(videoVariantForModel('veo3.1', 1, 0, 0)).toMatchObject({
      modelType: 'image_to_video', variant: 'image',
    });
    expect(videoVariantForModel('veo3.1', 2, 0, 0)).toMatchObject({
      modelType: 'start_end_to_video', variant: 'start_end',
    });
  });

  it('视频入边：`edit` 档要 1 个视频（官方 `referenceVideoRange min:1`）', () => {
    const withVideo = counts(
      [edge('e1', 'vid-1', VIDEO_TARGET)],
      [node(VIDEO_TARGET, 'ai-video'), node('vid-1', 'ai-video', { videoUrl: 'c.mp4' })],
    );
    expect(withVideo).toEqual({ imageCount: 0, videoCount: 1, audioCount: 0 });
    expect(videoVariantForMethod(
      'seedance-2.5', 'edit', withVideo.imageCount, withVideo.videoCount, withVideo.audioCount,
    )).toMatchObject({ modelType: 'video_edit', variant: 'edit' });
  });

  it('边界：计数为 0 时 `video_edit` 不成立（官方 `dDe` 的 `?? l[0]` 兜底仍在）', () => {
    expect(variantMatchesExactInputs('seedance-2.5', 'video_edit', 0, 0, 0)).toBe(false);
    expect(variantMatchesExactInputs('seedance-2.5', 'video_edit', 0, 1, 0)).toBe(true);
    expect(videoVariantForMethod('seedance-2.5', 'edit', 0, 0, 0)).toMatchObject({
      modelType: 'video_edit', variant: 'edit',
    });
  });
});
