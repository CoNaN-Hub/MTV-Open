/**
 * 官方 `chatAdapter.askQuestion` 交互面板 —— `Qie`（displayName `AskQuestionSheet`，live 偏移 2558500 / memo 2563609）1:1 复刻。
 *
 * 官方逐字（要点，全部来自 `live-提问表单族.md` §1.3/§1.4/§1.5/§1.6/§1.7/§1.9）：
 * ```js
 * // 常量
 * const $ie = 4, urt = 200;                       // 渲染选项上限 / 自由文本 maxLength
 * // 高度动画
 * l = reducedMotion ? {duration:0} : {duration:.22, ease:[.4,0,.2,1]}
 * krt = { initial:{opacity:0}, animate:{opacity:1}, transition:{duration:.16, ease:[.4,0,.2,1]} }
 * // 键盘：ArrowDown/Up → moveHighlight(±1)；ArrowLeft → goPrev；Enter/ArrowRight → goNext；
 * //       " " → selectAt(highlight)；数字键 1..min(options,4) → selectAt(n-1)；
 * //       options.length+1 → 聚焦自由文本；Escape → onFreeTextStart("")；单字符 → activateFreeText + insertText
 * // goNext: canGoNext && (clearMultiSelectDraft, onAnswer(toolUseId, {labels: E, freeText: T ? N : undefined}))
 * // goPrev: canGoPrev && 把 collectedAnswers 补齐到 questions.length、写入当前题、step-1
 * // selectAt(i): 单选替换、多选 toggle；单选模式下再点会清 freeText 激活
 * // activateFreeText: y(true)，单选模式下清空已选
 * // moveHighlight(d): u<0 ? (d>0?0:w-1) : (u+d+w)%w；单选模式下同步设为选中
 * ```
 *
 * ⚠️ MTV 侧说明（如实记录）：
 *  1. 自由文本编辑器官方是 `qie`(`ChatMentionInput`，ProseMirror 内核)，其 `@` 提及内部组装**未挖到**
 *     ⇒ 这里用一个等价的 `contentEditable` 实现**外层契约**（`value`/`maxLength`/`placeholder`/`ariaLabel`/
 *     `minHeight`/`maxHeight`/`className` + 命令式 `focus`/`insertText`/`isMentionSuggestionActive`），
 *     `@` 提及弹层未实现（`isMentionSuggestionActive()` 恒 `false`）。
 *  2. `onFreeTextStart` / `onHeightChange` 在官方是 compose hook 的解构（`tn`/`lo`，**未挖到**定义）
 *     ⇒ MTV 侧它们就是本组件向外的回调。
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { getLocale, useT } from '../../i18n';
import { askQuestionLabel } from '../../services/chat/askQuestionStrings';
import type { MentionLookups } from '../../services/chat/mentionTokens';
import { askQuestionAnswerOf, type AskQuestion, type AskQuestionOption } from '../../services/chat/askQuestion';
import ChatMentionInput, { type ChatMentionInputHandle } from './ChatMentionInput';
import InputTopSheet from './InputTopSheet';

/** 官方 `$ie`：渲染的选项上限（也是数字热键上限）。 */
const MAX_OPTIONS = 4;
/** 官方 `urt`：自由文本 `maxLength`。 */
const FREE_TEXT_MAX_LENGTH = 200;
/** 官方 `Art` / `Irt`：高度动画。 */
const HEIGHT_TRANSITION = { duration: 0.22, ease: [0.4, 0, 0.2, 1] } as const;
const HEIGHT_TRANSITION_REDUCED = { duration: 0 } as const;
/** 官方 `krt`：内容淡入。 */
const CONTENT_FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.16, ease: [0.4, 0, 0.2, 1] },
} as const;
/** 官方 `Yie`：选项行 / 自由文本行共用的基类。 */
const ROW_BASE = 'flex min-h-[34px] w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 transition-colors';

/** 官方 `BF` = `RowIndex`。 */
function RowIndex({ index, isActive }: { index: number; isActive: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-[15px] shrink-0 items-center justify-center rounded-[3px] text-[10px] leading-none ${isActive ? 'bg-white/[0.13] text-chat-foreground' : 'bg-white/[0.07] text-muted-foreground'}`}
    >
      {index + 1}
    </span>
  );
}

/** 官方 `Kie` = `HeaderChip`（面板里用 `bg-white/[0.08]` + `text-chat-foreground`，与摘要卡不同）。 */
function HeaderChip({ header }: { header?: string }) {
  if (!header) return null;
  return (
    <span className="shrink-0 rounded-[5px] bg-white/[0.08] px-1.5 py-0.5 text-[11px] leading-4 text-chat-foreground">
      {header}
    </span>
  );
}

/** 官方 `Xie` = `OptionRow`。 */
function OptionRow({
  option,
  index,
  isHighlighted,
  isSelected,
  multiSelect,
  onSelect,
}: {
  option: AskQuestionOption;
  index: number;
  isHighlighted: boolean;
  isSelected: boolean;
  multiSelect: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={`${ROW_BASE} text-left ${isHighlighted ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}
    >
      <RowIndex index={index} isActive={isSelected || isHighlighted} />
      <span className="shrink-0 text-[13px] font-medium leading-none text-chat-foreground">{option.label}</span>
      {option.description ? (
        <span className="min-w-0 flex-1 truncate text-xs leading-none text-muted-foreground">{option.description}</span>
      ) : null}
      <span
        aria-hidden
        className={`ml-auto flex size-[18px] shrink-0 items-center justify-center transition-colors ${multiSelect ? 'rounded-[5px]' : 'rounded-full'} ${isSelected ? 'bg-chat-foreground' : multiSelect ? 'border border-white/25 bg-transparent' : 'bg-transparent'}`}
      >
        {isSelected ? (
          /* 官方用 Tabler `IconCheck`，`size={13}` `stroke={2}`。 */
          <svg
            aria-hidden="true"
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#202020]"
          >
            <path d="M5 12l5 5l10 -10" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}

export interface AskQuestionSheetProps {
  /** 官方 `onAnswer(toolUseId, {labels, freeText})`。 */
  onAnswer: (toolUseId: string, answer: { labels: string[]; freeText?: string }) => void;
  /** 官方 `onFreeTextStart(text)`：Escape 时以 `""` 调用。 */
  onFreeTextStart?: (text: string) => void;
  /** 官方 `onHeightChange(height)`：`Math.round(offsetHeight)`，相同值不重复回调。 */
  onHeightChange?: (height: number) => void;
  /** 官方 `suppressed`：与可见性做与运算。 */
  suppressed?: boolean;
}

export default function AskQuestionSheet({
  onAnswer,
  onFreeTextStart,
  onHeightChange,
  suppressed = false,
}: AskQuestionSheetProps) {
  useT();
  const locale = getLocale();
  const listboxId = useId();
  const reducedMotion = useReducedMotion();

  const pending = useAppStore((state) => state.pendingQuestion);
  const multiSelectDraft = useAppStore((state) => state.multiSelectDraft);
  const store = useAppStore;
  /* 提及展示表（官方 `A = {nodeTitleMap, fileTitleMap, brainstormLabel}`）：
     MTV 从画布节点取标题；`fileTitleMap` 与资产预览缓存官方来自服务端/本地缓存，MTV 暂为空。 */
  const mentionLookups: MentionLookups = useMemo(() => {
    const nodeTitleMap = new Map<string, string>();
    for (const node of store.getState().nodes) {
      const title = node.data?.label ?? node.data?.title;
      if (typeof title === 'string' && title) nodeTitleMap.set(node.id, title);
    }
    return { nodeTitleMap, fileTitleMap: new Map(), brainstormLabel: '头脑风暴' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toolUseId = pending?.toolUseId ?? '';
  const questions = pending?.questions ?? [];
  const step = pending?.step ?? 0;
  const currentQuestion: AskQuestion | undefined = questions[step];
  /** 官方 `rq`：`status === "pending" && questions.length > 0`。 */
  const visible = pending?.status === 'pending' && questions.length > 0;

  const [highlight, setHighlight] = useState(-1);
  const [freeText, setFreeText] = useState('');
  const [isFreeTextActivated, setFreeTextActivated] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  /** 官方 `_ = currentQuestion?.options.slice(0, $ie) ?? []`。 */
  const options = useMemo(() => currentQuestion?.options.slice(0, MAX_OPTIONS) ?? [], [currentQuestion]);

  /* 官方：step / toolUseId 变化时重置（高亮 -1、选中取 collectedAnswers、freeText、激活态）。
     ⚠️ 不能在 effect 体里同步 setState（`react-hooks/set-state-in-effect`）⇒ 延到下一帧。 */
  useEffect(() => {
    const collected = (pending?.collectedAnswers ?? []) as ({ selected_labels?: string[]; free_text?: string } | null)[];
    const previous = collected[step];
    const reset = requestAnimationFrame(() => {
      setHighlight(-1);
      setFreeText(previous?.free_text ?? '');
      setFreeTextActivated(!!previous?.free_text);
    });
    const labels = previous?.selected_labels ?? [];
    if (labels.length > 0) store.getState().setMultiSelectDraft(labels);
    else store.getState().clearMultiSelectDraft();
    return () => cancelAnimationFrame(reset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolUseId, step]);

  const isMultiSelect = currentQuestion?.multiSelect === true;
  const rowCount = options.length + 1;
  const isFreeTextHighlighted = highlight === options.length;
  const isLastQuestion = step === questions.length - 1;
  const trimmedFreeText = freeText.trim();
  const isFreeTextAnswering = trimmedFreeText.length > 0 && (isMultiSelect || isFreeTextActivated);
  /** 官方 `E = !v && T ? frt : m`（单选 + 自由文本激活 ⇒ 已选强制为空）。 */
  const selected = useMemo(
    () => (!isMultiSelect && isFreeTextAnswering ? [] : multiSelectDraft),
    [isFreeTextAnswering, isMultiSelect, multiSelectDraft],
  );
  const canGoNext = selected.length > 0 || isFreeTextAnswering;
  const canGoPrev = step > 0;

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    store.getState().clearMultiSelectDraft();
    onAnswer(toolUseId, { labels: selected, freeText: isFreeTextAnswering ? trimmedFreeText : undefined });
  }, [canGoNext, isFreeTextAnswering, onAnswer, selected, store, toolUseId, trimmedFreeText]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    const collected = [...(pending?.collectedAnswers ?? [])];
    while (collected.length < questions.length) collected.push(null);
    /* 官方 `M`（@2548330 邻域，逐字）：`E.length===0 && !T ? null : {question_id: d?.question_id, …}`
       —— 空答案写 `null`（**不是**一个只有 `question_id` 的空壳），这样宿主 `Ve` 的
       `Ze.findIndex(rt=>!rt)`（找第一处未答）与 `We = Ze.filter(rt=>rt!==null)` 才与官方同语义。 */
    collected[step] = askQuestionAnswerOf(
      { labels: selected, freeText: isFreeTextAnswering ? trimmedFreeText : undefined },
      currentQuestion?.question_id,
    );
    store.getState().setPendingQuestionProgress(collected, step - 1);
  }, [canGoPrev, currentQuestion?.question_id, isFreeTextAnswering, pending?.collectedAnswers, questions.length, selected, step, store, trimmedFreeText]);

  const selectAt = useCallback((index: number) => {
    const option = options[index];
    if (!option) return;
    setHighlight(index);
    const label = String(option.label ?? '');
    const next = isMultiSelect
      ? (multiSelectDraft.includes(label)
        ? multiSelectDraft.filter((item) => item !== label)
        : [...multiSelectDraft, label])
      : [label];
    store.getState().setMultiSelectDraft(next);
    if (!isMultiSelect) setFreeTextActivated(false);
  }, [isMultiSelect, multiSelectDraft, options, store]);

  const activateFreeText = useCallback(() => {
    setFreeTextActivated(true);
    if (!isMultiSelect) store.getState().clearMultiSelectDraft();
  }, [isMultiSelect, store]);

  const moveHighlight = useCallback((delta: number) => {
    const next = highlight < 0 ? (delta > 0 ? 0 : rowCount - 1) : (highlight + delta + rowCount) % rowCount;
    setHighlight(next);
    const option = options[next];
    if (option && !isMultiSelect) {
      store.getState().setMultiSelectDraft([String(option.label ?? '')]);
      setFreeTextActivated(false);
    }
  }, [highlight, isMultiSelect, options, rowCount, store]);

  const freeTextRef = useRef<ChatMentionInputHandle | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const freeTextRowRef = useRef<HTMLDivElement | null>(null);
  const reportedHeightRef = useRef(0);

  const reportHeight = useCallback((height: number) => {
    const rounded = Math.round(height);
    if (rounded === reportedHeightRef.current) return;
    reportedHeightRef.current = rounded;
    onHeightChange?.(rounded);
  }, [onHeightChange]);

  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node) { setMeasuredHeight(null); return undefined; }
    const measure = (entries?: ResizeObserverEntry[]) => {
      const target = (entries?.[0]?.target ?? node) as HTMLElement;
      const height = target.offsetHeight;
      setMeasuredHeight(height);
      reportHeight(height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [reportHeight, visible]);

  /* 官方聚焦副作用：可见时聚焦根 listbox；自由文本激活 / 失去时在根与编辑器之间切换焦点。 */
  useEffect(() => {
    if (!visible) return;
    listboxRef.current?.focus({ preventScroll: true });
  }, [visible, multiSelectDraft]);
  useEffect(() => {
    if (!visible) return;
    if (isFreeTextAnswering) freeTextRef.current?.focus();
    else if (freeTextRowRef.current?.contains(document.activeElement)) listboxRef.current?.focus({ preventScroll: true });
  }, [visible, isFreeTextAnswering]);

  const handleListboxKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if ((event.target as HTMLElement).closest('[data-ask-free-text="true"]')) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) { freeTextRef.current?.focus(); return; }
    const key = event.key;
    if (key === 'ArrowDown' || key === 'ArrowUp') { event.preventDefault(); moveHighlight(key === 'ArrowDown' ? 1 : -1); return; }
    if (key === 'ArrowLeft') { event.preventDefault(); goPrev(); return; }
    if (key === 'Enter' || key === 'ArrowRight') { event.preventDefault(); goNext(); return; }
    if (key === ' ') { event.preventDefault(); selectAt(highlight); return; }
    if (key === String(options.length + 1)) { event.preventDefault(); freeTextRef.current?.focus(); return; }
    if (key >= '1' && key <= String(Math.min(options.length, MAX_OPTIONS))) { event.preventDefault(); selectAt(Number(key) - 1); return; }
    if (key === 'Escape') { event.preventDefault(); onFreeTextStart?.(''); return; }
    if (key.length === 1) {
      event.preventDefault();
      activateFreeText();
      freeTextRef.current?.insertText(key);
      freeTextRef.current?.focus();
    }
  }, [activateFreeText, goNext, goPrev, highlight, moveHighlight, onFreeTextStart, options.length, selectAt]);

  const handleFreeTextKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement> | KeyboardEvent) => {
    event.stopPropagation();
    const native = 'nativeEvent' in event ? event.nativeEvent : event;
    if (native.isComposing || native.keyCode === 229) return;
    if (freeTextRef.current?.isMentionSuggestionActive()) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown') { event.preventDefault(); moveHighlight(key === 'ArrowDown' ? 1 : -1); return; }
    if (key === 'Enter') { event.preventDefault(); return; }
    if (key === 'Escape') { event.preventDefault(); listboxRef.current?.focus({ preventScroll: true }); }
  }, [moveHighlight]);

  if (!currentQuestion || !visible || suppressed) return null;

  const questionText = currentQuestion.question;
  const progressText = askQuestionLabel('progress', locale)
    .replace(/\{\{current\}\}/g, String(step + 1))
    .replace(/\{\{total\}\}/g, String(questions.length));

  return (
    <InputTopSheet
      visible
      motionKey={`ask-question-${toolUseId || 'empty'}`}
      className="border border-b-0 border-white/[0.08]"
      contentRef={contentRef}
      anchorOffsetPx={8}
      onExitComplete={() => reportHeight(0)}
    >
      <div
        ref={listboxRef}
        id={listboxId}
        tabIndex={-1}
        role="listbox"
        aria-label={questionText}
        onKeyDown={handleListboxKeyDown}
        className="outline-none"
      >
        <motion.div
          initial={false}
          animate={{ height: measuredHeight ?? 'auto' }}
          transition={reducedMotion ? HEIGHT_TRANSITION_REDUCED : HEIGHT_TRANSITION}
          style={{ overflow: 'hidden' }}
        >
          <div ref={measureRef}>
            <motion.div {...CONTENT_FADE}>
              <div className="flex items-start gap-2 border-b border-white/[0.07] px-3.5 pb-2.5 pt-3">
                <HeaderChip header={currentQuestion.header} />
                <span className="min-w-0 flex-1 text-[13px] leading-[1.5] text-chat-foreground">{questionText}</span>
                {questions.length > 1 ? (
                  <span className="shrink-0 pt-0.5 text-[11px] leading-4 text-muted-foreground">{progressText}</span>
                ) : null}
              </div>
              <div className="p-1.5">
                {options.map((option, index) => (
                  <OptionRow
                    key={String(option.label ?? index)}
                    option={option}
                    index={index}
                    isHighlighted={index === highlight}
                    isSelected={selected.includes(String(option.label ?? ''))}
                    multiSelect={isMultiSelect}
                    onSelect={() => selectAt(index)}
                  />
                ))}
                <div
                  ref={freeTextRowRef}
                  data-ask-free-text="true"
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('[data-ask-free-text-input="true"]')) return;
                    freeTextRef.current?.focus();
                  }}
                  className={`${ROW_BASE} cursor-text ${(isFreeTextAnswering || isFreeTextHighlighted) ? 'bg-white/[0.07]' : trimmedFreeText ? '' : 'hover:bg-white/[0.04]'}`}
                >
                  <RowIndex index={options.length} isActive={isFreeTextAnswering || isFreeTextHighlighted} />
                  <ChatMentionInput
                    ref={freeTextRef}
                    value={freeText}
                    maxLength={FREE_TEXT_MAX_LENGTH}
                    onChange={(next) => { setFreeText(next); activateFreeText(); }}
                    onKeyDown={handleFreeTextKeyDown}
                    onFocus={() => {
                      setHighlight(options.length);
                      if (trimmedFreeText) activateFreeText();
                    }}
                    placeholder={askQuestionLabel('hintFreeText', locale)}
                    ariaLabel={askQuestionLabel('hintFreeText', locale)}
                    minHeight={18}
                    maxHeight={96}
                    className={`text-[13px] ${(isFreeTextAnswering || !trimmedFreeText) ? 'text-chat-foreground' : 'text-muted-foreground/50'}`}
                    lookups={mentionLookups}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-white/[0.06] px-3.5 pb-2 pt-2">
                <button
                  type="button"
                  disabled={!canGoPrev}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={goPrev}
                  className={`h-7 shrink-0 rounded-md px-2.5 text-xs font-medium transition-colors ${canGoPrev ? 'cursor-pointer bg-white/[0.06] text-chat-foreground/70 hover:bg-white/[0.1] hover:text-chat-foreground' : 'cursor-not-allowed bg-white/[0.03] text-muted-foreground/30'}`}
                >
                  {askQuestionLabel('prev', locale)}
                </button>
                <span className="min-w-0 flex-1" />
                <button
                  type="button"
                  disabled={!canGoNext}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={goNext}
                  className={`h-7 shrink-0 rounded-md px-3.5 text-xs font-semibold transition-colors ${canGoNext ? 'cursor-pointer bg-[#F2F2F2] text-[#202020] hover:bg-white' : 'cursor-not-allowed bg-white/[0.08] text-muted-foreground/40'}`}
                >
                  {askQuestionLabel(isLastQuestion ? 'submit' : 'next', locale)}
                  {isMultiSelect && selected.length > 0 ? (
                    <span className="ml-1 font-medium opacity-60">({selected.length})</span>
                  ) : null}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </InputTopSheet>
  );
}
