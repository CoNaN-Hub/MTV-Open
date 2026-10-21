/**
 * `progressDetails`（官方**新版**「详细过程」）的**纯函数层** —— 官方 `OX` 的逐字移植。
 *
 * 官方逐字（`vendor-pkg-canvas-CvbAwZyy.js` @440773 邻域）：
 * ```js
 * const ih = e => (e && typeof e === 'object' && !Array.isArray(e)) ? e : null;
 * function OX(payload, omitTexts = []) {
 *   const omit = new Set(omitTexts.map(m => m.trim().toLowerCase()).filter(Boolean));
 *   const o = m => omit.has(m.trim().toLowerCase());
 *   const r = ih(payload.response);
 *   const i = [r, ih(r?.client_result), ih(r?.desktop_fs), ih(r?.desktop_shell_command)].filter(Boolean);
 *   const l = [], c = new Set();
 *   const d = { summary:'summary', description:'summary', message:'summary',
 *               text:'output', output:'output', content:'output', result:'output',
 *               stdout_preview:'output', stdout:'output',
 *               stderr_preview:'errors', stderr:'errors', text_preview:'file' };
 *   let u = false;
 *   for (const m of i) {
 *     u ||= m.truncated === true || m.stdout_truncated === true || m.stderr_truncated === true;
 *     if (Array.isArray(m.content)) for (const f of m.content) {
 *       const h = ih(f);
 *       h?.type !== 'text' || typeof h.text !== 'string' || !h.text.trim() || c.has(h.text) || o(h.text)
 *         || (c.add(h.text), l.push({ kind:'output', text:h.text }));
 *     }
 *     for (const [f, h] of Object.entries(d)) {
 *       const g = m[f];
 *       typeof g !== 'string' || !g.trim() || c.has(g) || o(g) || (c.add(g), l.push({ kind:h, text:g }));
 *     }
 *   }
 *   const p = ih(payload.error)?.message;
 *   typeof p === 'string' && p.trim() && !c.has(p) && l.push({ kind:'errors', text:p });
 *   return { sections:l, truncated:u };
 * }
 * ```
 * 渲染侧见 `components/chat/ToolPublicResult.tsx`（官方 `TT`）。
 *
 * ⚠️ **MTV 生产者差异（第 72 轮按官方真机取证修正）**：官方这些文本来自**服务端工具 payload**
 * （`response.{summary,output,stderr,…}` / `client_result` / `desktop_*`）。
 * 官方真机（CDP 9222 `app.tapnow.media`，只展开步骤、只读）实测：
 *   · `data-tool-public-result` 只出现在 `skill` 行（`输出` + `Launching skill: tapnow-cli:tapnow-cli`）；
 *   · 全部工具事件的 `content.response` 键为结构化字段（如 `{ok,question_id}`、`{node_ids,algorithm}`），
 *     **没有任何 `output/text/content/result/stdout*`**；
 *   · 官方产物里 `output:` **只出现在 `OX` 的键表与 `TT` 的兜底词典**，没有任何客户端生产者
 *     （`response:{…}` 的客户端写入者只有「把 pending 结果并进已有 response」与 `show_*` mock）。
 * ⇒ MTV 的结构化工具（`canvas_query` / `view_media` / `read_canvas_nodes` …）没有「输出」语义的文本
 *   ⇒ **不写 `outputText`、也不写 `data-tool-public-result`**（本文件与渲染侧都不改动）。
 *   MTV 只保留官方真实存在的 `content.response.summary`（= 「结果」块）。
 * `client_result` / `desktop_fs` / `desktop_shell_command` MTV 没有生产者 ⇒ 恒不产出。
 */

/** 官方 `ih`。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export type ToolPublicResultKind = 'summary' | 'output' | 'errors' | 'file';

export interface ToolPublicResultSection {
  kind: ToolPublicResultKind;
  text: string;
}

/** 官方 `Mae`：三个挂载点都把它并进 `omitTexts`。 */
export const OFFICIAL_SKIP_TEXTS = ['tapnow cli'] as const;

/** 官方 `d`（键 → 种类）。 */
const KIND_BY_KEY: Record<string, ToolPublicResultKind> = {
  summary: 'summary',
  description: 'summary',
  message: 'summary',
  text: 'output',
  output: 'output',
  content: 'output',
  result: 'output',
  stdout_preview: 'output',
  stdout: 'output',
  stderr_preview: 'errors',
  stderr: 'errors',
  text_preview: 'file',
};

/** 官方 `c`（词典缺 key 时的英文兜底）。 */
export const TOOL_PUBLIC_RESULT_FALLBACK: Record<ToolPublicResultKind, string> = {
  summary: 'Result',
  output: 'Output',
  errors: 'Error output',
  file: 'File contents',
};

/** 官方 `OX(payload, omitTexts)`。 */
export function toolPublicResultSections(
  payload: unknown,
  omitTexts: readonly string[] = [],
): { sections: ToolPublicResultSection[]; truncated: boolean } {
  const omit = new Set(omitTexts.map((text) => text.trim().toLowerCase()).filter(Boolean));
  const skip = (text: string) => omit.has(text.trim().toLowerCase());
  const record = isRecord(payload) ? payload : {};
  const response = isRecord(record.response) ? record.response : null;
  const carriers = [
    response,
    isRecord(response?.client_result) ? response.client_result : null,
    isRecord(response?.desktop_fs) ? response.desktop_fs : null,
    isRecord(response?.desktop_shell_command) ? response.desktop_shell_command : null,
  ].filter((item): item is Record<string, unknown> => !!item);

  const sections: ToolPublicResultSection[] = [];
  const seen = new Set<string>();
  let truncated = false;

  for (const carrier of carriers) {
    truncated = truncated
      || carrier.truncated === true
      || carrier.stdout_truncated === true
      || carrier.stderr_truncated === true;
    if (Array.isArray(carrier.content)) {
      for (const entry of carrier.content) {
        const item = isRecord(entry) ? entry : null;
        if (!item || item.type !== 'text' || typeof item.text !== 'string') continue;
        const text = item.text;
        if (!text.trim() || seen.has(text) || skip(text)) continue;
        seen.add(text);
        sections.push({ kind: 'output', text });
      }
    }
    for (const [key, kind] of Object.entries(KIND_BY_KEY)) {
      const value = carrier[key];
      if (typeof value !== 'string' || !value.trim() || seen.has(value) || skip(value)) continue;
      seen.add(value);
      sections.push({ kind, text: value });
    }
  }

  const errorMessage = isRecord(record.error) ? record.error.message : undefined;
  if (typeof errorMessage === 'string' && errorMessage.trim() && !seen.has(errorMessage)) {
    sections.push({ kind: 'errors', text: errorMessage });
  }

  return { sections, truncated };
}
