/**
 * pilePreviewContentOf —— 官方 `OYe(node, renderSize, displayScale, variant)` 的 MTV 适配。
 *
 * 只决定「预览画什么」，**类型分派 / 类名 / 占位 / 状态全在**
 * `components/nodes/PileMemberPreview.tsx`（逐字移植官方 `TT` / `qZe` / `zZe` / `GZe` / `HZe` / `$Ze`）。
 * 单独放一个文件是为了满足 `react-refresh/only-export-components`
 * （组件文件只导出组件）。
 *
 * 官方 `OYe` 逐字（`zoom-slider-3ZcFvYQO.js`@2808819）：
 * ```js
 * function OYe(e,t,n,s){const r=e.data,o=r.taskInfo,i=FYe(o),a=xC(r,"src"),c=a?ur(a):"";
 *   switch(e.type){
 *     case he.IMAGE: return {content:{type:"image",title:Rb(r,"Image"),displaySrc:c?hs(c,s)??c:"",fallbackSrc:c||void 0},status:i};
 *     case he.VIDEO: return {content:{type:"video",title:Rb(r,"Video"),thumbnailSrc:c?hs(c,Pn.THUMBNAIL_V2)??"":"",playbackSrc:c?hs(c,Pn.SMALL)??c:""},status:i};
 *     case he.AUDIO: return {content:{type:"audio",title:Rb(r,"Audio"),src:c},status:i};
 *     case he.TEXT:  return {content:{type:"text",title:Rb(r,"Text"),markdown:xC(r,"text"),backgroundColor:xC(r,"color")||void 0,renderSize:t,displayScale:n},status:i};
 *     default:       return {content:{type:"unsupported",title:Rb(r,"Unsupported")},status:i}}}
 * ```
 * ⚠️ `hs(url, variant)` 是官方 **CDN 尺寸变体**（`Pn.SMALL` / `Pn.THUMBNAIL_V2`）；
 *    MTV 的媒体是本地文件或直链，没有这套服务 ⇒ **直接用原 URL**（唯一的偏离，已记账）。
 * ★ 标题（官方 `Rb(data, "Image")` @2808641 逐字，**不是** i18n）：
 *   ```js
 *   function xC(e,t){ const n=e[t]; return typeof n=="string"&&n.trim() ? n : "" }
 *   function Rb(e,t){ return xC(e,"title") || t }
 *   ```
 *   ⇒ 官方 = `data.title`（非空字符串）；**取不到就回落到写死的英文类型名**
 *      `Image` / `Video` / `Audio` / `Text` / `Unsupported`（调用点传的字面量）。
 *   ⚠️ MTV 早前读的是节点自己的 `label` 且缺省回落**空串** ⇒ 没名字的卡在画廊里
 *      **只剩一个图标、没有文字**（用户反馈「名称显示有点混乱」✗）。
 *   现在：`data.title` → `data.label`（MTV 的展示名，= 官方 `data.title` 的对应字段）
 *      → 官方那串英文类型名。**保证永远非空**（与官方一致 ✓）
 */
import type { BaseNodeData } from '../types';
import type { PilePreviewContent } from '../components/nodes/PileMemberPreview';

/** 官方 `xC(e,t)` @2808570 —— `typeof v === "string" && v.trim() ? v : ""` */
function officialStringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value : '';
}

/** 官方 `Rb(data, fallback)` @2808641 —— `xC(data,"title") || fallback`；MTV 再加一层 `label` */
function officialTitle(data: Record<string, unknown>, label: string, fallback: string): string {
  return officialStringField(data, 'title') || label || fallback;
}

export function pilePreviewContentOf(
  node: { type?: string; data: BaseNodeData },
  renderSize: { width: number; height: number },
  displayScale = 1,
): PilePreviewContent {
  const data = (node.data ?? {}) as unknown as Record<string, unknown> & {
    label?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    thumbnailUrl?: string;
    prompt?: string;
    text?: string;
  };
  const label = officialStringField(data, 'label');
  const rawType =
    (typeof node.type === 'string' ? node.type : undefined) ??
    (node.data as { type?: unknown } | undefined)?.type;
  const type = typeof rawType === 'string' ? rawType.toLowerCase().replace(/^(ai|source)-/, '') : '';
  switch (type) {
    case 'image': {
      const title = officialTitle(data, label, 'Image');
      return { type: 'image', title, displaySrc: data.imageUrl ?? '', fallbackSrc: data.thumbnailUrl };
    }
    case 'video': {
      const title = officialTitle(data, label, 'Video');
      return {
        type: 'video',
        title,
        thumbnailSrc: data.thumbnailUrl ?? data.imageUrl ?? '',
        playbackSrc: data.videoUrl ?? '',
      };
    }
    case 'audio': {
      const title = officialTitle(data, label, 'Audio');
      return { type: 'audio', title, src: data.audioUrl ?? '' };
    }
    case 'text': {
      const title = officialTitle(data, label, 'Text');
      return {
        type: 'text',
        title,
        markdown: data.prompt ?? data.text ?? '',
        renderSize,
        displayScale,
      };
    }
    default: {
      const title = officialTitle(data, label, 'Unsupported');
      return { type: 'unsupported', title };
    }
  }
}
