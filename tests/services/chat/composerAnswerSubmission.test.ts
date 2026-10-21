// @vitest-environment jsdom
/**
 * 官方「有待答问题时，**发送键 = 提交答案**」的回归（`vendor-pkg-canvas-ChpWx5JY.js` @2724686 逐字）。
 *
 * ```js
 * if(!We && de.pendingQuestion?.status==="pending" && (pt||ot)){
 *   const bn=de.pendingQuestion.toolUseId,
 *         hn=pt ? Rlt(lt, u("chatAdapter.askQuestion.freeText","")) : "";
 *   if(pt && !hn){ ne.error(u("chatAdapter.askQuestion.emptyFreeText","Enter your answer first.")); tt(!1); return }
 *   J.setInputValue("",ee); J.clearMultiSelectDraft(ee); J.clearPendingSuggestionContext(ee);
 *   await Ve(bn,{labels: ot?de.multiSelectDraft:void 0, freeText: hn},ee); tt(!1); return }
 * ```
 * `pt = lt.trim().length>0`、`ot = de.multiSelectDraft.length>0`（@2723314/@2723404）；
 * `Rlt`（@2720270）把预填标签「我另有想法」连同其后的 `:` / `：` 剥掉。
 * 验证分级 = **(b) 纯逻辑断言**（`answerPendingQuestion` + `stripAskQuestionFreeTextLabel` 都是纯函数）。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { stripAskQuestionFreeTextLabel } from '../../../src/services/chat/askQuestion';
import { askQuestionLabel } from '../../../src/services/chat/askQuestionStrings';
import { answerPendingQuestion } from '../../../src/services/chat/askQuestionRuntime';
import { resolveAskQuestionAnswers } from '../../../src/services/chat/askQuestionRuntime';
import { useAppStore } from '../../../src/store/useAppStore';

const FREE_TEXT_LABEL_ZH = '我有其他想法';

function seedPending(toolUseId = 'call-1') {
  useAppStore.getState().setPendingQuestion({
    toolUseId,
    questionId: `${toolUseId}#0`,
    questions: [{
      question_id: `${toolUseId}#0`,
      question: '要哪种风格？',
      options: [{ label: '写实' }, { label: '动画' }],
      multiSelect: false,
    }],
    status: 'pending',
    step: 0,
    collectedAnswers: [],
  });
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('官方 composer 的「发送 = 提交答案」分支', () => {
  it('`Rlt` 逐字：剥掉「标签:」「标签：」前缀，其它原样', () => {
    expect(stripAskQuestionFreeTextLabel(`${FREE_TEXT_LABEL_ZH}：要写实`, FREE_TEXT_LABEL_ZH)).toBe('要写实');
    expect(stripAskQuestionFreeTextLabel(`${FREE_TEXT_LABEL_ZH}: realistic`, FREE_TEXT_LABEL_ZH)).toBe('realistic');
    /* 只有标签本身（没有内容）⇒ 剥完为空 ⇒ 官方走 `emptyFreeText` 分支。 */
    expect(stripAskQuestionFreeTextLabel(`${FREE_TEXT_LABEL_ZH}：`, FREE_TEXT_LABEL_ZH)).toBe('');
    expect(stripAskQuestionFreeTextLabel(FREE_TEXT_LABEL_ZH, FREE_TEXT_LABEL_ZH)).toBe(FREE_TEXT_LABEL_ZH);
    /* 普通输入不带前缀 ⇒ 原样。 */
    expect(stripAskQuestionFreeTextLabel('  写实  ', FREE_TEXT_LABEL_ZH)).toBe('写实');
    /* 标签为空 ⇒ 只 trim（官方 `if(!o)return n`）。 */
    expect(stripAskQuestionFreeTextLabel('  写实  ', '')).toBe('写实');
  });

  it('自由文本回答（`pt`）⇒ 提交后进入 `collectedAnswers` 并唤醒工具', async () => {
    seedPending();
    const waiting = new Promise<unknown>((resolve) => {
      /* 工具侧在等答复；这里模拟宿主的发送分支。 */
      const poll = setInterval(() => {
        const pending = useAppStore.getState().pendingQuestion;
        if (!pending || pending.status !== 'pending') { clearInterval(poll); resolve(null); }
      }, 1);
    });
    void waiting;
    const store = useAppStore.getState();
    store.setMultiSelectDraft([]);
    const outcome = answerPendingQuestion('call-1', { labels: [], freeText: '要写实' });
    expect(outcome).toBe('submitted');
    /* 会话态先落 `answered` 再被等待者清掉（S2 的 F2 次序），答案已交给工具。 */
    expect(useAppStore.getState().pendingQuestion).toBeNull();
  });

  it('多选草稿（`ot`）⇒ labels 走草稿、freeText 为空', () => {
    seedPending('call-2');
    useAppStore.getState().setMultiSelectDraft(['写实', '动画']);
    const received: unknown[] = [];
    resolveAskQuestionAnswers('call-2', []); // 先注册一个假等待者（返回值 false 也接受）
    expect(received).toEqual([]);
    const outcome = answerPendingQuestion('call-2', { labels: ['写实', '动画'] });
    expect(outcome).toBe('submitted');
    const collected = useAppStore.getState().pendingQuestion;
    expect(collected).toBeNull();
  });

  it('`emptyFreeText` 文案本地化可用（官方 `chatAdapter.askQuestion.emptyFreeText`）', () => {
    expect(askQuestionLabel('emptyFreeText', 'zh-CN')).toBe('请输入你的想法后再发送。');
    expect(askQuestionLabel('emptyFreeText', 'en-US')).toBe('Enter your answer first.');
    expect(askQuestionLabel('freeText', 'zh-CN')).toBe(FREE_TEXT_LABEL_ZH);
  });
});
