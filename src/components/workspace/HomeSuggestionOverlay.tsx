/**
 * HomeSuggestionOverlay —— 官方首页输入框的「建议条」（空态覆盖层）。
 * ══════════════════════════════════════════════════════════════════════════
 * 官方出处（`D:\DEEPSEEK\index-bundle.js`）：
 *  · **@1658638** 覆盖层本体（逐字）：
 *    ```jsx
 *    !R.trim() && F.length===0 && L && !O.isActive
 *      ? jsx("button",{type:"button",onClick:K,disabled:u||b||d,
 *          className:"absolute left-0.5 top-1 max-w-full cursor-pointer truncate text-left text-sm
 *                     font-normal leading-5 text-secondary-muted-foreground transition-colors
 *                     hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-50",
 *          children: jsx(VB,{text:M,...jV,loop:!0,renderDisplayedText:AV,onActiveIndexChange:k,
 *                            className:"truncate"}, M.join("|"))})
 *      : null
 *    ```
 *  · **@1652884** 动画参数：`jV={typingSpeed:55,pauseDuration:1100,deletingSpeed:22,
 *    showCursor:!0,cursorCharacter:"_"}`
 *  · **@1656712** 点击行为 `K`：`s(fi(L.prompt)); D.current.scrollTop=0`
 *    ⇒ 点击 = 把**当前那一整条 `prompt`** 填进输入框（**不发送**）
 *  · **@1652990** `fi`：把 `{{type:id}}` 引用 token 提到最前，其余原样
 *  · 数据源：官方兜底建议 `aV/iV/…`（@1600126 起，5 语言 × 30 = 150 条）
 *    —— MTV 已逐字落地在 `services/chat/homepageFallbackSuggestions.ts`（此前未接 UI）
 *  · 输入框 `placeholder` 官方是**空串**（`placeholder:""`，@1658345）⇒ 提示语只由这条覆盖层承担。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLocale } from '../../i18n';
import { homepageFallbackSuggestions } from '../../services/chat/homepageFallbackSuggestions';
import { normalizeHomePrompt } from '../../services/chat/homeSuggestionPrompt';

/** 官方 `jV` */
const TYPING_SPEED = 55;
const PAUSE_DURATION = 1100;
const DELETING_SPEED = 22;
const CURSOR = '_';

interface HomeSuggestionOverlayProps {
  /** 点击后把 prompt 交给宿主写进输入框（官方 `K`） */
  onPick: (prompt: string) => void;
}

export default function HomeSuggestionOverlay({ onPick }: HomeSuggestionOverlayProps) {
  const suggestions = useMemo(() => homepageFallbackSuggestions(getLocale().split('-')[0]), []);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState('');
  const [deleting, setDeleting] = useState(false);
  const timerRef = useRef<number | null>(null);

  const current = suggestions[index % Math.max(1, suggestions.length)];

  useEffect(() => {
    if (!current) return;
    const full = current.title;
    /* 官方 `VB` 的状态机：typing(55ms/字) → pause(1100ms) → deleting(22ms/字) → 下一条 */
    const tick = () => {
      if (!deleting) {
        if (shown.length < full.length) {
          setShown(full.slice(0, shown.length + 1));
          timerRef.current = window.setTimeout(tick, TYPING_SPEED);
          return;
        }
        timerRef.current = window.setTimeout(() => setDeleting(true), PAUSE_DURATION);
        return;
      }
      if (shown.length > 0) {
        setShown(full.slice(0, shown.length - 1));
        timerRef.current = window.setTimeout(tick, DELETING_SPEED);
        return;
      }
      setDeleting(false);
      setIndex((i) => (i + 1) % Math.max(1, suggestions.length));
    };
    timerRef.current = window.setTimeout(tick, deleting ? DELETING_SPEED : TYPING_SPEED);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [current, deleting, shown, suggestions.length]);

  const pick = useCallback(() => {
    if (!current) return;
    onPick(normalizeHomePrompt(current.prompt));
  }, [current, onPick]);

  if (!current) return null;

  return (
    <button
      type="button"
      onClick={pick}
      data-testid="workspace-home-suggestion"
      title={current.title}
      className="absolute left-0.5 top-1 max-w-full cursor-pointer truncate text-left text-sm font-normal leading-5 text-[#a3a3a3] transition-colors hover:text-white/80"
    >
      <span className="truncate">
        {shown}
        <span className="opacity-70">{CURSOR}</span>
      </span>
    </button>
  );
}
