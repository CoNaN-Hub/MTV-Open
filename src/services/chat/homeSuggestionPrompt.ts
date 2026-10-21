/**
 * 首页建议条的 prompt 归一化 —— 官方 `fi`（`index-bundle.js` @1652990 逐字）：
 * ```js
 * const br = /\{\{[a-zA-Z0-9_-]+:[^}]+}\}/g;
 * function fi(e) {
 *   const a = e.match(br) ?? [];
 *   if (a.length === 0) return e;
 *   const n = e.replace(br, "").replace(/^[ \t]+/, "");
 *   return `${a.join(" ")} ${n}`;
 * }
 * ```
 * ⇒ 把 `{{type:id}}` 这类引用 token **提到最前**，其余原样。
 * 官方点击建议条时就是 `s(fi(L.prompt))`（@1656712），所以这段必须逐字对上。
 */
const REFERENCE_TOKEN = /\{\{[a-zA-Z0-9_-]+:[^}]+\}\}/g;

export function normalizeHomePrompt(text: string): string {
  const tokens = text.match(REFERENCE_TOKEN) ?? [];
  if (tokens.length === 0) return text;
  const rest = text.replace(REFERENCE_TOKEN, '').replace(/^[ \t]+/, '');
  return `${tokens.join(' ')} ${rest}`;
}
