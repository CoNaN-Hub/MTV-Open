/**
 * modelProviderIconClass —— 官方 `mq(model)` 的**逐字移植**（live `vendor-pkg-canvas-ChpWx5JY.js` @52239）：
 *
 * ```js
 * mq = e => { const t = ua(e.id, e.label);
 *   return t.includes("claude") || t.includes("anthropic") ? "size-[14px] object-contain"
 *        : t.includes("openai") || t.includes("gpt")            ? "size-[17px] object-contain"
 *        : t.includes("kimi")   || t.includes("moonshot")       ? "size-[15px] object-contain"
 *        : "size-4 object-contain"; }
 * ```
 * `ua(id, label)` 是官方的「id + label 归一化」串（大小写无关），这里用 `${id} ${label}`.toLowerCase() 等价实现。
 */
export function modelProviderIconClass(id: string, label: string): string {
  const t = `${id} ${label}`.toLowerCase();
  if (t.includes('claude') || t.includes('anthropic')) return 'size-[14px] object-contain';
  if (t.includes('openai') || t.includes('gpt')) return 'size-[17px] object-contain';
  if (t.includes('kimi') || t.includes('moonshot')) return 'size-[15px] object-contain';
  return 'size-4 object-contain';
}
