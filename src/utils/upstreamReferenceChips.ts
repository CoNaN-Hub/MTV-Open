/**
 * 官方「上游引用行」(`gx` @1700439) 的两条纯逻辑 —— 与组件分开放，
 * 因为 `react-refresh/only-export-components` 要求组件文件只导出组件。
 *
 * 依据（`zoom-slider-3ZcFvYQO.js`）：
 *   · 条目标题：`const Q = Y.title || "Image"`（视频 "Video"、音频 "Audio"）；
 *       文本是 `const q = Y.title || \`Text ${Q + 1}\`` —— 文本序号取**文本列表内下标**，从 1 起。
 *   · 移除：`onRemove: () => c(Y.edgeId)`，`c` 即 `rd()` 里的 `removeByEdgeId`，
 *       官方落地为 `s({ edges: [{ id }] })`（从边表里删掉这条入边）。
 *       MTV 走 store 的 `onEdgesChange`（与画布里手动删边**同一条路径**，含历史提交 ✓）。
 */
import { useAppStore } from '../store/useAppStore';
import type { ReferenceKind } from './referenceTokens';

const KIND_FALLBACK_TITLE: Record<ReferenceKind, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  text: 'Text',
};

/** 官方 `gx` 的条目标题：`title || "Image"/"Video"/"Audio"`；文本 `title || \`Text ${index+1}\`` */
export function referenceChipTitle(
  title: string,
  kind: ReferenceKind,
  indexInKind: number,
): string {
  if (title) return title;
  return kind === 'text'
    ? `${KIND_FALLBACK_TITLE.text} ${indexInKind + 1}`
    : KIND_FALLBACK_TITLE[kind];
}

/** 官方条目 ✕ → `removeByEdgeId(edgeId)` */
export function removeUpstreamReference(edgeId: string): void {
  useAppStore.getState().onEdgesChange([{ id: edgeId, type: 'remove' }]);
}
