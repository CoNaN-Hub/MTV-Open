/** Clamp v into [min, max]. */
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * 文本高度估算：40 + 每行 20，夹在 [min, 600]。
 *
 * ⚠️ **文本卡（`ai-text`）已不再用它**：官方文本卡是**固定尺寸**（创建时 `Ha` = `Od` = 250×250，
 *    见 `utils/nodeBounds.ts`；内容区自己滚动 `h-full overflow-y-auto`）—— 不按行数撑高卡片 ✗。
 *    其它节点类型（音频 / Markdown / 语音转文本等 MTV 自有流程）仍在沿用，故保留本函数。
 */
export const textNodeHeight = (lines: number, min = 120) => clamp(40 + lines * 20, min, 600);

