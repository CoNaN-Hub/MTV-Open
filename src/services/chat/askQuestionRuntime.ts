/**
 * 「提问（`ask_question`）」的**运行时等待通道** —— 对位审批的 `waitForAgentApproval`。
 *
 * 官方链路（`pendingQuestion` 会话态 + `Qie`(`AskQuestionSheet`)）：
 *   1. agent 的 `ask_question` 工具产出提问 ⇒ 官方把会话态写成
 *      `setPendingQuestion({ toolUseId, questionId, questions: jM(event), status: "pending" })`
 *      （写入点 2696365），提问面板 `Qie` 因此出现；
 *   2. 用户在面板里逐题作答，面板回调 `onAnswer(toolUseId, {labels, freeText})`
 *      ⇒ `answerPendingQuestion`（官方宿主 `Ve` @2717400 的非数组分支）写回 `collectedAnswers`；
 *   3. 答完最后一题 ⇒ 官方 `updatePendingQuestionStatus("answered")` + 把答案上行，
 *      `content.response` 落盘后暂存卡按「已答」渲染；MTV 由工具自己收尾清会话态。
 *
 * ⚠️ MTV 侧的数据源差异：官方工具是**服务端**发起的（工具调用天然带 `tool_use_id`），
 * MTV 的 `ask_question` 是**本地工具**，所以「等待」用本地 resolver 表实现（与审批同款）。
 * key = 官方 `content.tool_call_id`（= `AgentToolContext.callId`），这样渲染层
 * `Moe`(`AskQuestionSummary`) 的 `useStore` 订阅与 `pendingQuestion.toolUseId` 能对上。
 */
import { useAppStore } from '../../store/useAppStore';
import type { AskQuestionAnswer } from '../../types/chat';
import { askQuestionAnswerOf } from './askQuestion';

type Resolver = (answers: AskQuestionAnswer[]) => void;

const pendingResolvers = new Map<string, Resolver>();

/** 用户在面板里答完最后一题后由宿主调用：唤醒等待中的 `ask_question` 工具。 */
export function resolveAskQuestionAnswers(toolUseId: string, answers: AskQuestionAnswer[]): boolean {
  const resolver = pendingResolvers.get(toolUseId);
  if (!resolver) return false;
  pendingResolvers.delete(toolUseId);
  resolver(answers);
  return true;
}

/** 当前是否有人在等这个 `toolUseId` 的答复（宿主可据此判断面板该不该收答案）。 */
export function hasPendingAskQuestion(toolUseId: string): boolean {
  return pendingResolvers.has(toolUseId);
}

/**
 * 等用户的答复。`signal` 中止时按 `AbortError` 拒绝（与 `waitForAgentApproval` 同语义，
 * 让执行器走「任务已取消」那条既有分支，而不是把工具当成失败）。
 */
export function waitForAskQuestionAnswers(
  toolUseId: string,
  signal: AbortSignal,
): Promise<AskQuestionAnswer[]> {
  return new Promise<AskQuestionAnswer[]>((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener('abort', handleAbort);
      pendingResolvers.delete(toolUseId);
    };
    const handleAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    pendingResolvers.set(toolUseId, (answers) => {
      cleanup();
      resolve(answers);
    });
    signal.addEventListener('abort', handleAbort, { once: true });
    if (signal.aborted) handleAbort();
  });
}

/** `answerPendingQuestion` 的结果（官方 `Ve` 的三条出口）。 */
export type AskQuestionAnswerOutcome =
  /** 不属于当前待答问题 / 空答案（官方 `AB` ⇒ `null` ⇒ `if(!Ct)return`）。 */
  | 'ignored'
  /** 还有下一题 ⇒ 官方 `setPendingQuestionProgress(Ze, rt+1)`，**工具继续等**。 */
  | 'advanced'
  /** 最后一题 ⇒ 官方 `updatePendingQuestionStatus("answered")` + 唤醒工具。 */
  | 'submitted';

/**
 * 官方宿主 `Ve`（@2717400）的**非数组分支**逐字移植 —— 面板每次 `onAnswer(toolUseId,{labels,freeText})`
 * 走一次，等价于官方 `chatAdapter` 里的 `answerQuestion`：
 * ```js
 * const rt = Ee?.step ?? 0;
 * for (Ze = [...Ee?.collectedAnswers ?? []]; Ze.length < tt.length;) Ze.push(null);
 * const Ct = AB(ee, tt[rt]?.question_id);
 * if (!Ct) return;                       // 空答案不推进
 * if (Ze[rt] = Ct, rt < tt.length - 1) { ce.setPendingQuestionProgress(Ze, rt+1, Le); ... return }
 * const We = Ze.filter(rt=>rt!==null);
 * if (We.length === 0) return;
 * const st = We.map(DXe), lt = st.map(Toe), ze = LXe(st, Ke||J);
 * ce.setInputValue("", Le), ce.clearMultiSelectDraft(Le),
 * ce.updatePendingQuestionStatus("answered", lt, Le);   // ← 状态先落「已答」
 * …把 `ze` 并进对应 tool_event 的 `content.response`…
 * ```
 * MTV 的差异（如实登记）：官方 `answerQuestion` **不** `clearPendingQuestion`（它在整条 run
 * 结束 / 出错时才清，见 `me` @2709685）；MTV 没有那个 run 级钩子，所以由 `ask_question` 工具
 * 自己的 `finally`（工具被唤醒的下一微任务）来清 —— 语义相同：状态先变 `"answered"`
 * （`rq` 选择器 ⇒ 面板立刻收起；`iQe` ⇒ 摘要卡按「已答」渲染，不会闪一下「未回答」），
 * 工具一恢复就把会话态清掉。
 */
export function answerPendingQuestion(
  toolUseId: string,
  answer: { labels: readonly string[]; freeText?: string },
): AskQuestionAnswerOutcome {
  const store = useAppStore.getState();
  const pending = store.pendingQuestion;
  if (!pending || pending.toolUseId !== toolUseId || pending.status !== 'pending') return 'ignored';
  const questions = pending.questions ?? [];
  const step = pending.step ?? 0;
  /* 官方 `AB(ee, tt[rt]?.question_id)`；`null` ⇒ 官方 `if(!Ct)return`。 */
  const entry = askQuestionAnswerOf(answer, questions[step]?.question_id);
  if (!entry) return 'ignored';
  const collected = [...(pending.collectedAnswers ?? [])];
  while (collected.length < questions.length) collected.push(null);
  collected[step] = entry;

  if (step < questions.length - 1) {
    store.setPendingQuestionProgress(collected, step + 1);
    return 'advanced';
  }

  const submitted = collected.filter((item): item is AskQuestionAnswer => item != null);
  store.updatePendingQuestionStatus('answered');
  store.clearMultiSelectDraft();
  if (!resolveAskQuestionAnswers(toolUseId, submitted)) {
    /* 没有等待者（工具已中止 / 已被清）⇒ 不留 `answered` 残影（官方「run 结束清态」的本地等价）。 */
    store.clearPendingQuestion();
  }
  return 'submitted';
}
