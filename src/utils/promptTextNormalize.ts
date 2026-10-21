/**
 * promptTextNormalize.ts —— 提示词纯文本的「官方二次排版」归一
 * ══════════════════════════════════════════════════════════════════════════
 * 出处：官方 `TiptapInput`（`use-waveform-data-DMduQqB-.js` @596374）
 *   `const Q = useMemo(() => preservePlainTextPaste ? { preserveWhitespace: true } : undefined, [...])`
 *   `useEditor({ …, parseOptions: Q, … })`
 * ——**默认关闭 `preserveWhitespace`** ⇒ 一律走 ProseMirror 的默认文本解析：
 *     · 连续换行整体当作**一个**段落分隔（空行被吃掉）
 *     · 行内连续空白折叠成一个空格
 *     · 段落首尾空白去掉
 *
 * ⚠️ 官方**两条路都走这一套**，这是关键：
 *   ① 粘贴：ProseMirror 默认的 `clipboardTextParser`；
 *   ② **载入 value**：同一个 `Q` 也传给了 `setContent` ——
 *      `useEffect(() => { if (T && e !== Y.current) { Y.current = e;
 *         T.chain().setContent(e, false, Q).setMeta('addToHistory', false).run() } }, [e, T, Q])`
 *      ⇒ 存量提示词每次进编辑器都会被**重新排版一次**（所以官方对「已经存了空行的文本」也会二次排版）。
 *
 * 单独成文件而不是放在 `MentionEditor.tsx` 里导出：那个文件只应导出组件，
 * 否则触发 eslint `react-refresh/only-export-components`。
 */
export function normalizePlainPromptText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
