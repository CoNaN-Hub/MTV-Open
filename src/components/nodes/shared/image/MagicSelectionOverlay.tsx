/**
 * MagicSelectionOverlay — 焦点编辑（官方 `magicSelection`）的卡片内覆盖层。
 *
 * 逐字对应官方 `ex` / `ex.displayName="MagicSelectionOverlay"`（`vendor-pkg-canvas-futqHM6N.js` @1600161）
 * 与其中的 mark 项 `lZ`（同文件紧随其后）。
 *
 * 官方 DOM：
 *   <div class="absolute inset-0 z-20 overflow-visible" style="pointer-events:{active?'auto':'none'}">
 *     {active && <div class="absolute inset-0 rounded-[12px]" style="cursor:<crosshair>" onClick={onClick}/>}
 *     {marks.map(m => <MarkItem .../>)}
 *   </div>
 *
 * MarkItem 两态（官方逐字）：
 *   ① 识别中（`isLoading && clickPosition`）：点击点处一颗胶囊
 *        `absolute z-40 flex items-center pointer-events-none text-nowrap`
 *        `style={{ top:y*100%, left:x*100%, transform:'translate(4px,-50%)' }}`
 *        内含 `bg-background/90 backdrop-blur-sm text-xs px-2.5 py-1.5 rounded-full border shadow-lg`
 *        + `⏳`(animate-pulse, 14px) + `magicSelection.recognizing`（`text-muted-foreground font-medium`）
 *   ② 已识别：`box_2d` 决定的白色描边框
 *        `absolute border-2 border-white/80 ring-1 ring-black/20 pointer-events-none z-30 rounded-sm`
 *        `style={{ top:box0*100%, left:box1*100%, width:(box3-box1)*100%, height:(box2-box0)*100% }}`
 *        + 框上方标签条（`-top-8 left-0`）：单标签 = 胶囊（图标 + label）；
 *          多候选（`detections.length>1`）= 可展开下拉，逐条 `index === selectedIndex` 高亮
 *        + 删除键（20×20 圆，hover 变 destructive）
 *
 * ⚠️ `box_2d` 与 `clickPosition` 都是 **0–1 归一化**（官方 `*100` 得到百分比）——
 *    见 store 里 `FocusEditMark.clickPosition` 的注释（曾误用 0–1000，已改）。
 */
import { memo, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '../../../../store/useAppStore';
import type { FocusEditMark } from '../../../../store/store.ui';
import { useT } from '../../../../i18n';

interface MagicSelectionOverlayProps {
  nodeId: string;
  /** 本卡是否可作为「点击取元素」的目标（官方 `g = isActive && src && !(nodeId === sourceNodeId)`） */
  isTarget: boolean;
  /** 本卡的图地址（官方 `t`） */
  src: string | undefined;
}

function MagicSelectionOverlayInner({ nodeId, isTarget, src }: MagicSelectionOverlayProps) {
  const t = useT();
  /* ⚠️ selector 必须返回**稳定引用**（原始数组），过滤放到组件体里做。
     写成 `(s) => s.focusEditMarks.filter(...)` 会每次返回新数组 ⇒
     `useSyncExternalStore` 认为快照一直在变 ⇒ **无限重渲染**
     （实测报 `Maximum update depth exceeded`，节点被 NodeRenderBoundary 接住变成错误卡）。 */
  const allMarks = useAppStore((s) => s.focusEditMarks);
  const marks = useMemo(
    () => allMarks.filter((mark) => mark.targetNodeId === nodeId),
    [allMarks, nodeId],
  );
  const showToast = useAppStore((s) => s.showToast);

  const active = isTarget && !!src;

  /* 官方 `b`：点击取点。归一化到 0–1，**并做 1s 节流**（官方 `magicSelection.clickTooFastInterval`）。 */
  const lastClickRef = useRef(0);
  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!active) return;
    event.preventDefault();
    event.stopPropagation();
    const now = Date.now();
    if (now - lastClickRef.current < 1000) {
      showToast(t('点击太快，请稍后再试'), 'error');
      return;
    }
    lastClickRef.current = now;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    void useAppStore.getState().identifyFocusEditElement(nodeId, src, { x, y });
  }, [active, nodeId, src, showToast, t]);

  /* 官方 `y`：切换候选 —— store 负责「mark 顶层值 + token 就地覆写」（芯片标签随之更新）。*/
  const handleSelectIndex = useCallback((markId: string, index: number) => {
    useAppStore.getState().selectFocusEditMark(markId, index);
  }, []);

  /* 官方 `y(_)`：删除 mark 时连**它的 token** 一起摘（不给输入框留孤儿芯片）。*/
  const handleRemove = useCallback((markId: string) => {
    useAppStore.getState().deleteFocusEditMark(markId);
  }, []);

  if (marks.length === 0 && !active) return null;

  return (
    <div
      className="magic-selection-overlay"
      style={{ pointerEvents: active ? 'auto' : 'none' }}
    >
      {active && <div className="magic-selection-hit" onClick={handleClick} aria-hidden="true" />}
      {marks.map((mark) => (
        <MarkItem
          key={mark.id}
          mark={mark}
          onSelectIndex={(index) => handleSelectIndex(mark.id, index)}
          onRemove={() => handleRemove(mark.id)}
        />
      ))}
    </div>
  );
}

/** 官方 `lZ` */
const MarkItem = memo(function MarkItem({
  mark,
  onSelectIndex,
  onRemove,
}: {
  mark: FocusEditMark;
  onSelectIndex: (index: number) => void;
  onRemove: () => void;
}) {
  const t = useT();

  // ① 识别中
  if (mark.isLoading && mark.clickPosition) {
    return (
      <div
        className="magic-mark-loading"
        style={{
          top: `${mark.clickPosition.y * 100}%`,
          left: `${mark.clickPosition.x * 100}%`,
          transform: 'translate(4px, -50%)',
        }}
      >
        <div className="magic-mark-loading-pill">
          <span className="magic-mark-hourglass" aria-hidden="true">⏳</span>
          <span className="magic-mark-loading-text">{t('识别中...')}</span>
        </div>
      </div>
    );
  }

  const [top, left, bottom, right] = mark.box_2d;
  const hasChoices = Array.isArray(mark.detections) && mark.detections.length > 1;

  return (
    <div
      className="magic-mark-box"
      style={{
        top: `${top * 100}%`,
        left: `${left * 100}%`,
        width: `${(right - left) * 100}%`,
        height: `${(bottom - top) * 100}%`,
      }}
    >
      <div className="magic-mark-tag">
        {hasChoices ? (
          <select
            className="magic-mark-select"
            value={mark.selectedIndex}
            onChange={(event) => onSelectIndex(Number(event.target.value))}
            aria-label={mark.label || t('选择元素')}
          >
            {mark.detections.map((detection, index) => (
              <option key={`${detection.label_name}-${index}`} value={index}>
                {detection.label_name}
              </option>
            ))}
          </select>
        ) : (
          <div className="magic-mark-label">
            {/* 官方 `la`（sparkles，16×16）+ 标签文字：`noe` 的胶囊里就是这个组合 */}
            <span className="magic-mark-icon" aria-hidden="true">✨</span>
            <span className="magic-mark-label-text">{mark.label}</span>
          </div>
        )}
        <button
          type="button"
          className="magic-mark-remove"
          onClick={(event) => { event.stopPropagation(); onRemove(); }}
          aria-label={t('删除标记')}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
});

export default memo(MagicSelectionOverlayInner);
