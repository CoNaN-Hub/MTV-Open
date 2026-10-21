/**
 * 官方 `Jd`（= `course-api-base-url-*.js` 的 `zIe`）**逐字**：
 *   `BIe = new Set([TEXT, IMAGE, VIDEO, VIDEO_EDIT, AUDIO])`
 *   `zIe = e => !!(e.id && BIe.has(e.type ?? ''))`
 *
 * 官方用它过滤会话的 `contextNodeIds`（`jle`，`page-*.js@748988`）：
 *   `jle(e, t) = e.filter(id => { const d = nodeLookup.get(id); return d != null && Jd(d); })`
 * ⇒ **只有 文本 / 图片 / 视频 / 视频编辑 / 音频 五类节点可被引用**；分组、便签、堆叠等一律不参与。
 * 这个过滤结果直接决定 ContextStrip 的 `m = p.length + attachments.length + (quotedText ? 1 : 0)`，
 * 也就是「清空」按钮什么时候出现（`m > 1`）—— 与「从画布添加」的拾取白名单是**同一个集合**。
 *
 * MTV 的节点类型是 `ai-text` / `ai-image` / `ai-video` / `ai-audio` / `ai-animation` /
 * `ai-panorama` / `ai-shotlist` ⇒ 按同一语义映射（animation 是视频，panorama 是图片，shotlist 是文本）。
 */
export const REFERENCEABLE_NODE_TYPES: ReadonlySet<string> = new Set([
  'ai-text',
  'ai-image',
  'ai-video',
  'ai-audio',
  'ai-animation',
  'ai-panorama',
  'ai-shotlist',
]);

/** 官方 `Jd`。 */
export function isReferenceableNodeType(type: string | undefined | null): boolean {
  return !!type && REFERENCEABLE_NODE_TYPES.has(type);
}
