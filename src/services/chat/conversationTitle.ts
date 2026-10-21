/**
 * 会话**自动标题**的派生 —— 官方 `onTitle` 链路的 MTV 等价物。
 *
 * ## 官方源码（逐字，2026 复核）
 * 流事件解析（`vendor-packages-CvEFn1fJ.js` @722999）：
 * ```js
 * else if (p === "title") { const E = JSON.parse(b); E.title && t.onTitle(E.title) }
 * ```
 * 消费点（`vendor-pkg-canvas-Dp0xADoD.js` @2742808）：
 * ```js
 * onTitle: Xe => { l.setConversationTitle(Xe, re) }
 * ```
 * `setConversationTitle` 全 bundle 只出现在：store setter、上面这条流事件、加载会话
 * （`setConversationTitle(Je.title || null, re)` @2752886）、用户手动重命名（@2825262）。
 * ⇒ **客户端零命名逻辑**：标题由**服务端**生成后下发；真机实测形如「视觉艺术总监分析」
 * 「饮品居家生活方式广告」（短名，不是用户原话的前缀）。
 *
 * ⚠️ 仓库旧注释引的偏移 `@2692515` 是**错的**（真的在 @2742808 / 解析器 @722999）。
 *
 * ## MTV 怎么等价
 * 没有服务端 ⇒ 两条腿：
 *   1. **立即**用第一条用户消息派生一个截断标题（不花钱、不等网络），UI 立刻有名字；
 *   2. 随后**异步**用聊天同一个文本模型跑一次短名（等价官方服务端那一步），成功就换掉。
 * 只在「还是默认名且用户没改过」时写；期间用户手动改名 / 会话不在当前列表 ⇒ 不覆盖。
 * 模型没配置、调用失败、输出不合规 ⇒ **静默保留**第 1 步的截断标题（不弹错、不阻断发消息）。
 */

import { useAppStore } from '../../store/useAppStore';
import { generateText } from '../ai/generateText';
import { resolveAssistantModel } from '../ai/assistantStream';

/** 官方短标题的观感长度：够看明白是哪一轮，又不撑爆下拉。 */
const MAX_TITLE_LENGTH = 24;

/** 模型生成标题的最大保留字数（官方真机那几条都在 8 字上下）。 */
const GENERATED_TITLE_MAX_LENGTH = 12;

/** 提及 token / markdown 记号。 */
const MENTION_TOKEN = /@(?:asset|drama|skill|model|wf)\{[^{}]*\}|@\{[^{}]*\}/g;
const MARKDOWN_NOISE = /[*_`>#~]+/g;

export function deriveConversationTitle(input: string): string {
  const stripped = (input ?? '')
    .replace(MENTION_TOKEN, ' ')
    .replace(MARKDOWN_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';
  return stripped.length > MAX_TITLE_LENGTH ? stripped.slice(0, MAX_TITLE_LENGTH) : stripped;
}

/** 会话是否还在用「自动标题」且尚未被写过（默认名 = `新对话`）。 */
export function shouldAutoTitle(conversation: { title?: string; titleSource?: 'auto' | 'user' } | undefined): boolean {
  if (!conversation) return false;
  if (conversation.titleSource === 'user') return false;
  return !conversation.title || conversation.title === '新对话';
}

/** 官方那一步（服务端）的提示词风格：只出一个短名，不要解释、不要标点。 */
const TITLE_PROMPT = [
  '给下面这段用户需求起一个 2–8 个字的会话标题。',
  '要求：只输出标题本身，不要引号、不要句号、不要换行、不要解释；概括主体与意图，例如「可爱的小猫」「雨夜街头调色」。',
  '',
  '用户需求：',
].join('\n');

/**
 * 清洗模型输出 —— 纯函数，便于直测。
 * 去掉常见包装（引号/书名号/方括号/`标题：` 前缀/多余空行），压平空白，超长截断。
 */
export function cleanGeneratedTitle(raw: string): string {
  const firstLine = (raw ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';
  const WRAPPERS = /["'“”‘’「」『』《》【】[\]()（）]/g;
  const TRAILING_PUNCT = /[。．.,，、；;：:！!？?~～\s]+$/;
  /* 模型可能写成 `"标题"。` 这种「包装 + 尾标点」混合 ⇒ 反复剥到稳定（两轮足够）。 */
  let unwrapped = firstLine.replace(/^(?:标题|title)\s*[:：]\s*/i, '');
  for (let i = 0; i < 2; i++) {
    unwrapped = unwrapped
      .replace(TRAILING_PUNCT, '')
      .replace(new RegExp(`^${WRAPPERS.source}+`), '')
      .replace(new RegExp(`${WRAPPERS.source}+$`), '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (!unwrapped) return '';
  return unwrapped.length > GENERATED_TITLE_MAX_LENGTH
    ? unwrapped.slice(0, GENERATED_TITLE_MAX_LENGTH)
    : unwrapped;
}

/** 用聊天同一个助手模型；没配就返回 null（= 不花任何调用）。 */
function resolveTitleModel(): { model: string; provider: string } | null {
  const resolved = resolveAssistantModel();
  if (!resolved?.selectionId) return null;
  const slash = resolved.selectionId.indexOf('/');
  if (slash <= 0) return null;
  return { model: resolved.selectionId, provider: resolved.selectionId.slice(0, slash) };
}

/**
 * 官方 `onTitle` 的 MTV 等价：调一次文本模型要个短名。
 * **永不抛错**（失败返回空串）——标题是锦上添花，不能影响发消息。
 */
export async function generateConversationTitle(
  input: string,
  target: { model: string; provider: string },
): Promise<string> {
  const source = (input ?? '').trim();
  if (!source) return '';
  try {
    const raw = await generateText({
      prompt: `${TITLE_PROMPT}${source.slice(0, 2_000)}`,
      model: target.model,
      provider: target.provider,
    });
    return cleanGeneratedTitle(raw);
  } catch {
    return '';
  }
}

/**
 * 发消息后异步补一次短名；只在「标题还是自动写的、用户没改过」时覆盖。
 * 调用方 `void` 掉即可（不 await、不影响这一轮执行）。
 */
export async function refineConversationTitle(conversationId: string, input: string): Promise<void> {
  const target = resolveTitleModel();
  if (!target) return;
  const title = await generateConversationTitle(input, target);
  if (!title) return;
  const store = useAppStore.getState();
  const conversation = store.conversations.find((item) => item.id === conversationId);
  if (!conversation || conversation.titleSource === 'user') return;
  store.updateConversation(conversationId, { title, titleSource: 'auto' });
}
