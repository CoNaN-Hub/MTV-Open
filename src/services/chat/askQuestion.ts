/**
 * 「提问（ask_question）」纯函数层 —— live 官方逐字移植。
 *
 * 官方符号与偏移（`vendor-pkg-canvas-ChpWx5JY.js`）：
 *   `jM`  @2133355  消息体 → 规范问题数组
 *   `MB`  @2133037  单题归一化
 *   `sQe` @2132960  question_id 生成
 *   `l_`  @2133835  单条 answer → 展示 labels
 *   `Toe` @2127342  上行 answer → 展示 labels（`OXe = Toe`）
 *   `Ioe` @2134015  content → 每题答案 labels
 *   `rQe` @2134510  状态判定（`undefined` → pending / 有答案 → answered / 否则 cancelled）
 *
 * 关键事实（逐字）：
 *  - `options` **不做归一化**，原样透传（下游只读 `label`/`description`/`value`）。
 *  - `multiSelect` 兼容 `mode === "multiple"`。
 *  - `header` 为空串时归一为 `undefined`。
 *  - 多题上行是 `{answers:[…]}`，每题 `free_text` 用 `\n` 把 `selected_labels + 自由文本` 拼成一段；
 *    单题上行退化为 `{free_text}` 或 `{selected_labels}`。
 *
 * 官方答案三段转换（`askQuestion.ts` 只有 `jM`/`Ioe`/`rQe` 是「读」，下面这三个是「写」）：
 *   `AB`  @2127571  面板回调 `{labels,freeText}` → **收集态**一题答案（`collectedAnswers` 元素，空 ⇒ `null`）
 *   `DXe` @2127785  收集态一题答案 → **上行 / `response`** 一题答案（有自由文本时把 labels 并进 `free_text`）
 *   `LXe` @2128062  一组答案 → `content.response` 载荷（>1 题 `{answers:[…]}`；单题 `{free_text}`/`{selected_labels}`）
 */
import type { AskQuestionAnswer } from '../../types/chat';
import type { ToolEventLike } from './agentToolLabels';

export interface AskQuestionOption {
  label?: string;
  description?: string;
  value?: string;
  [key: string]: unknown;
}

export interface AskQuestion {
  question_id: string;
  question: string;
  options: AskQuestionOption[];
  multiSelect: boolean;
  header?: string;
}

/** 官方 `sQe`。 */
function questionId(value: unknown, toolCallId: string, index: number): string {
  return typeof value === 'string' && value ? value : `${toolCallId}#${index}`;
}

/** 官方 `MB`：单题归一化（不满足条件返回 `null`）。 */
function normalizeQuestion(raw: unknown, toolCallId: string, index: number): AskQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.question !== 'string' || !Array.isArray(record.options)) return null;
  return {
    question_id: questionId(record.question_id, toolCallId, index),
    question: record.question,
    options: record.options as AskQuestionOption[],
    multiSelect: record.multiSelect === true || record.mode === 'multiple',
    header: typeof record.header === 'string' && record.header ? record.header : undefined,
  };
}

/** 官方 `jM`：从消息体（`content`）抽出规范问题数组。 */
export function askQuestionsOf(content: unknown): AskQuestion[] {
  if (!content || typeof content !== 'object') return [];
  const record = content as Record<string, unknown>;
  const toolCallId = (typeof record.tool_call_id === 'string' ? record.tool_call_id : '')
    || (typeof record.tool_use_id === 'string' ? record.tool_use_id : '');
  const response = record.response as Record<string, unknown> | undefined;
  const request = record.request as Record<string, unknown> | undefined;
  for (const candidate of [response?.questions, request?.questions]) {
    if (!Array.isArray(candidate)) continue;
    const list = candidate
      .map((item, index) => normalizeQuestion(item, toolCallId, index))
      .filter((item): item is AskQuestion => item !== null);
    if (list.length > 0) return list;
  }
  for (const candidate of [response, request]) {
    const single = normalizeQuestion(candidate, toolCallId, 0);
    if (single) return [single];
  }
  return [];
}

/**
 * 官方 `Rlt`（`vendor-pkg-canvas-ChpWx5JY.js` @2720270，逐字）：
 * ```js
 * Rlt = (e, t) => { const n = e.trim(), o = t.trim();
 *   if (!o) return n;
 *   for (const r of [":", "："]) { const i = `${o}${r}`;
 *     if (n.toLocaleLowerCase().startsWith(i.toLocaleLowerCase())) return n.slice(i.length).trim() }
 *   return n }
 * ```
 * 用途：有待答问题时，输入框可能被**预填**成「我另有想法」这类自由回答标签
 * （官方 `chatAdapter.askQuestion.freeText`）；发送时把标签连同其后的 `:` / `：` 剥掉，
 * 剩下的才是用户真正输入的内容。剥完为空 ⇒ 官方报 `emptyFreeText` 并中止发送。
 */
export function stripAskQuestionFreeTextLabel(value: string, freeTextLabel: string): string {
  const text = value.trim();
  const label = freeTextLabel.trim();
  if (!label) return text;
  for (const separator of [':', '：']) {
    const prefix = `${label}${separator}`;
    if (text.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) {
      return text.slice(prefix.length).trim();
    }
  }
  return text;
}

/** 官方 `Toe`（`OXe`）：上行 answer → 展示 labels。 */
export function answerLabels(answer: unknown): string[] {
  if (!answer || typeof answer !== 'object') return [];
  const record = answer as Record<string, unknown>;
  if (typeof record.free_text === 'string' && record.free_text) {
    return record.free_text.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  const selected = Array.isArray(record.selected_labels)
    ? record.selected_labels.filter((label): label is string => typeof label === 'string')
    : [];
  return selected;
}

/** 官方 `l_`：单条 answer → 展示 labels（空则 `[]`）。 */
function answerLabelsOrEmpty(answer: unknown): string[] {
  if (!answer || typeof answer !== 'object') return [];
  const record = answer as Record<string, unknown>;
  const freeText = typeof record.free_text === 'string' ? record.free_text.trim() : '';
  const selected = Array.isArray(record.selected_labels)
    ? record.selected_labels.filter((label): label is string => typeof label === 'string')
    : [];
  if (!freeText && selected.length === 0) return [];
  return answerLabels({
    free_text: freeText || undefined,
    selected_labels: selected,
  });
}

/** 官方 `Ioe`：content → 每题答案 labels（与 `questions` 顺序对齐）。 */
export function answerLabelsOf(content: unknown, questions: readonly AskQuestion[]): string[][] {
  if (!content || typeof content !== 'object') return [];
  const response = (content as Record<string, unknown>).response;
  if (!response || typeof response !== 'object') return [];
  const record = response as Record<string, unknown>;
  const answers = Array.isArray(record.answers)
    ? record.answers
    : (Array.isArray((record.answer as Record<string, unknown> | undefined)?.answers)
      ? ((record.answer as Record<string, unknown>).answers as unknown[])
      : null);
  if (answers) {
    const byId = new Map<string, string[]>();
    answers.forEach((answer, index) => {
      const labels = answerLabelsOrEmpty(answer);
      if (labels.length === 0) return;
      const id = (answer && typeof answer === 'object' && typeof (answer as Record<string, unknown>).question_id === 'string')
        ? ((answer as Record<string, unknown>).question_id as string)
        : '';
      byId.set(id || `#${index}`, labels);
    });
    return questions.map((question, index) => byId.get(question.question_id ?? '') ?? byId.get(`#${index}`) ?? []);
  }
  const single = answerLabelsOrEmpty(response).length > 0
    ? answerLabelsOrEmpty(response)
    : answerLabelsOrEmpty(record.answer);
  return single.length > 0 ? [single] : [];
}

/**
 * 官方 `AB`（@2127571，逐字）：
 * ```js
 * AB=(e,t)=>{const n=(e.labels??[]).map(r=>r.trim()).filter(Boolean),o=e.freeText?.trim();
 *   return n.length===0&&!o?null:{question_id:t,
 *     ...n.length>0?{selected_labels:Array.from(new Set(n))}:{},...o?{free_text:o}:{}}}
 * ```
 * 面板回调 `{labels,freeText}` → **收集态**（`pendingQuestion.collectedAnswers`）里的一题答案：
 * `trim` + 去空 + 去重；两者都空 ⇒ `null`（官方宿主 `Ve` 随后 `if(!Ct)return`，即**不推进**）。
 */
export function askQuestionAnswerOf(
  answer: { labels?: readonly string[]; freeText?: string } | null | undefined,
  questionId?: string,
): AskQuestionAnswer | null {
  const labels = (answer?.labels ?? [])
    .map((label) => label.trim())
    .filter(Boolean);
  const freeText = answer?.freeText?.trim();
  if (labels.length === 0 && !freeText) return null;
  return {
    question_id: questionId,
    ...(labels.length > 0 ? { selected_labels: Array.from(new Set(labels)) } : {}),
    ...(freeText ? { free_text: freeText } : {}),
  };
}

/**
 * 官方 `DXe`（@2127785，逐字）：
 * ```js
 * DXe=e=>{const t=e.selected_labels??[];
 *   return e.free_text?{question_id:e.question_id,free_text:[...new Set(t),e.free_text].join("\n")}
 *                    :{question_id:e.question_id,selected_labels:t}}
 * ```
 * 收集态一题答案 → **上行 / `content.response`** 的一题答案。有自由文本时把 `selected_labels`
 * 用 `\n` 并进 `free_text`：这样 `Ioe`→`l_`→`Toe`（按 `\n` 切）读回来时，**选项 label 不会被自由文本吃掉**。
 */
export function askQuestionResponseAnswerOf(answer: AskQuestionAnswer): AskQuestionAnswer {
  const labels = answer.selected_labels ?? [];
  return answer.free_text
    ? { question_id: answer.question_id, free_text: [...new Set(labels), answer.free_text].join('\n') }
    : { question_id: answer.question_id, selected_labels: labels };
}

/**
 * 官方 `LXe`（@2128062，逐字）：
 * ```js
 * LXe=(e,t)=>{if(e.length>1)return{answers:e.map((o,r)=>({...o,question_id:o.question_id??`${t}#${r}`}))};
 *   const n=e[0];return n?.free_text?{free_text:n.free_text}:{selected_labels:n?.selected_labels??[]}}
 * ```
 * 一组（已 `DXe` 过的）答案 → 官方写进 `content.response` 的载荷 `ze`。
 */
export function askQuestionResponseOf(
  answers: readonly AskQuestionAnswer[],
  questionId: string,
): Record<string, unknown> {
  if (answers.length > 1) {
    return {
      answers: answers.map((answer, index) => ({
        ...answer,
        question_id: answer.question_id ?? `${questionId}#${index}`,
      })),
    };
  }
  const first = answers[0];
  return first?.free_text
    ? { free_text: first.free_text }
    : { selected_labels: first?.selected_labels ?? [] };
}

/** 官方 `rQe`：`undefined` → pending；有答案 → answered；否则 cancelled。 */
export function askQuestionStatus(
  pendingStatus: unknown,
  content: unknown,
  questions: readonly AskQuestion[],
): 'pending' | 'answered' | 'cancelled' {
  if (typeof pendingStatus === 'string' && pendingStatus) return pendingStatus as 'pending' | 'answered' | 'cancelled';
  return answerLabelsOf(content, questions).some((labels) => labels.length > 0) ? 'answered' : 'cancelled';
}

/**
 * 官方 `$b` / `av`：`fEe.has(xl(e))` —— 族集合**逐字含两个字面量**
 * `new Set(["AskUserQuestion","ask_question"])`。
 *
 * 官方原文（dump `D:\DEEPSEEK\live-assets-r100\`，`vendor-pkg-canvas-DuoOicPr.js`）：
 *   · 集合 @447426：`fEe=new Set(["AskUserQuestion","ask_question"])`
 *   · 谓词 @449104：`av=e=>fEe.has(xl(e))`
 *   · 取名函数 @448796：`xl=e=>e.type==="tool_event"&&typeof e.content=="object"&&e.content!==null?String(e.content.tool??""):""`
 *
 * ⚠️ **round 120 更正**：本函数原先写成 `tool.trim().toLowerCase() === 'ask_question'`，注释还声称
 * 「官方 `xl()` 会 `toLowerCase()`，所以集合里的 `AskUserQuestion` 永不命中」——
 * **那条注释与 r100 原文不符**：`xl` @448796 **没有**任何 `toLowerCase()`，它返回 `content.tool` 原样
 * ⇒ 官方那两个字面量**都**会命中（精确匹配）。
 * 后果是 MTV 自己产出的问答卡（`agentApprovalContents` 的 `askUserQuestionContent` 逐字写
 * `tool:"AskUserQuestion"`，见该文件 @656）**压根没被认成卡** ⇒ 落进工具段、`AskQuestionSummary` 不渲染。
 * 现按官方逐字改成**精确集合匹配**（不做大小写归一 —— 归一反而会多认 `askuserquestion` 这类官方不认的串）。
 */
const OFFICIAL_ASK_QUESTION_TOOLS: ReadonlySet<string> = new Set([
  'AskUserQuestion',
  'ask_question',
]);

export function isAskQuestionTool(tool: string): boolean {
  return OFFICIAL_ASK_QUESTION_TOOLS.has(tool);
}

/** 从工具事件取 `content`。 */
export function askQuestionContentOf(item: ToolEventLike): Record<string, unknown> | null {
  const content = item.content;
  if (!content || typeof content !== 'object') return null;
  return content as Record<string, unknown>;
}
