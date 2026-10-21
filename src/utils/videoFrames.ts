/**
 * 首/尾帧的**顺序语义**（用户裁决：「⇄ 按照官方的来」）。
 *
 * 官方把「已连的两张帧」只当**一个有序数组**用，源码里**没有任何 frame role 区分**：
 *   `vendor-pkg-canvas-*.js` @2041103 区逐字（`at` = 按 `data.order` 排好序的帧引用）：
 *     `first: He[0] ? { url: He[0].url, edgeId: He[0].edgeId, index: 0 } : null,`
 *     `last:  He[1] ? { url: He[1].url, edgeId: He[1].edgeId, index: 1 } : null`
 *   `⇄`（同文件 @2054966 逐字）：
 *     `On = () => { …; at.length>=2 && (ie(at[0].nodeId), se(null)) }`
 *   配套效果（@2041103）：
 *     `if (at.findIndex(Bt => Bt.nodeId === fe) === 0) { const Bt = setTimeout(() => { re("image",[1,0]); ie(null) }, 50); … }`
 *   ⇒ **`re("image",[1,0])` 把两条边的 `data.order` 0↔1 对调** —— 即「交换顺序」，净效果就是互换。
 *
 * MTV 侧：`VideoReferenceItem` 上保留了 `role`（`first_frame` / `last_frame`），因为**请求层**按
 * role 组装上游字段（`services/ai/generateVideo.ts`、`providers/apimartMedia.ts` …）。
 * 本模块的职责是把两者锁在一起：**顺序是唯一事实，role 一律由位置派生**
 * （第 0 张 = `first_frame`，第 1 张 = `last_frame`），任何写入都过这里归一，
 * 于是「按顺序取槽」的 UI 与「按 role 发请求」的传输层永远一致。
 */
import type { VideoReferenceItem } from '../types/aiTypes';

/** 已连的帧引用，**按数组顺序**（= 官方 `at`）。首帧 = `[0]`，尾帧 = `[1]`。 */
export function orderedFrameRefs(
  refs: readonly VideoReferenceItem[] | undefined,
): VideoReferenceItem[] {
  return (refs ?? []).filter((item) => item.kind === 'frame');
}

/** 把 role 按**位置**重新派生（顺序不动）。顺序与 role 已经一致时原样返回。 */
export function normalizeFrameRoles(
  refs: readonly VideoReferenceItem[],
): VideoReferenceItem[] {
  let frameIndex = 0;
  let changed = false;
  const next = refs.map((item) => {
    if (item.kind !== 'frame') return item;
    const role: VideoReferenceItem['role'] = frameIndex++ === 0 ? 'first_frame' : 'last_frame';
    if (item.role === role) return item;
    changed = true;
    return { ...item, role };
  });
  return changed ? next : [...refs];
}

/**
 * `⇄`：交换前两张帧的**位置**（官方 `re("image",[1,0])`）。
 * 帧不足两张时原样返回（官方也是 `at.length>=2` 才动作 ⇒ 按钮 disabled）。
 */
export function swapFrameOrder(
  refs: readonly VideoReferenceItem[] | undefined,
): VideoReferenceItem[] {
  const frames = orderedFrameRefs(refs).slice(0, 2);
  if (frames.length < 2) return [...(refs ?? [])];
  const [first, last] = frames;
  const next = [...(refs ?? [])];
  const firstIndex = next.indexOf(first);
  const lastIndex = next.indexOf(last);
  if (firstIndex < 0 || lastIndex < 0) return [...(refs ?? [])];
  next[firstIndex] = last;
  next[lastIndex] = first;
  return normalizeFrameRoles(next);
}

/**
 * 把一张帧写进第 `slotIndex` 个槽（`0` = 首帧 / `1` = 尾帧）—— 官方 `se(ds)` / `ie(ds)` 的等价物。
 *
 * 官方语义（首/尾各自一个槽，`at` = `[first, last]` 过滤空值）：
 *   · 两张都在、写首帧 ⇒ `[新, 旧尾]`（旧尾**不动**）
 *   · 两张都在、写尾帧 ⇒ `[旧首, 新]`（旧首**不动**）
 *   · 只有一张、写尾帧 ⇒ `[旧首, 新]`
 *   · 只有一张、写首帧 ⇒ `[新]`（旧首被替换，没有尾帧）
 *   · 一张都没有、写尾帧 ⇒ `[新]` ⇒ **按位置它就是首帧**（官方没有「只有尾帧」这个状态）
 * 非帧条目（参考角色）保持原位，帧条目沿用原本占的坑位。
 */
export function setFrameSlot(
  refs: readonly VideoReferenceItem[] | undefined,
  slotIndex: 0 | 1,
  frame: VideoReferenceItem,
): VideoReferenceItem[] {
  const list = refs ?? [];
  const frames = orderedFrameRefs(list).slice(0, 2);
  const first = slotIndex === 0 ? frame : frames[0];
  const last = slotIndex === 0 ? frames[1] : frame;
  const nextFrames = [first, last].filter((item): item is VideoReferenceItem => Boolean(item));

  const next: VideoReferenceItem[] = [];
  let cursor = 0;
  for (const item of list) {
    if (item.kind !== 'frame') {
      next.push(item);
      continue;
    }
    const replacement = nextFrames[cursor++];
    if (replacement) next.push(replacement);
  }
  while (cursor < nextFrames.length) next.push(nextFrames[cursor++]);
  return normalizeFrameRoles(next);
}
