/**
 * ColorPickerButton —— 官方文本卡工具栏第一格「背景颜色」的**调色板**（`mQ` @2757073 逐字）
 *
 * 官方结构（`dPe` 的 obsidian 按钮里塞的就是这个 picker）：
 *   <Popover>
 *     <PopoverTrigger asChild>
 *       <div className={Z("size-5 aspect-square rounded-full border cursor-pointer",
 *                          !selectedColor && "bg-card-foreground", triggerClassName)}
 *            style={{ backgroundColor: selectedColor }} />
 *     </PopoverTrigger>
 *     <PopoverContent className="w-auto" side="bottom" sideOffset={22}>
 *       <div className="flex flex-col gap-4 px-3 py-5 bg-black/60 backdrop-blur-lg rounded-xl border border-input">
 *         {showReset && <button className="size-6 rounded-full border border-input transition-transform
 *              hover:scale-110 bg-card-foreground relative cursor-pointer
 *              before:content-[''] before:absolute before:inset-0 before:m-auto before:w-4 before:h-[1.5px]
 *              before:bg-muted-foreground/50 before:rotate-45" onClick={onReset} title={t("common.resetColor")} />}
 *         {colors.map(c => <button className="size-6 rounded-full border border-input transition-transform
 *              hover:scale-110 cursor-pointer" style={{ backgroundColor: c.value }}
 *              onClick={() => onColorChange(M9e(c.appliedValue, applyOpacity))}
 *              title={t(`common.colors.${c.label}`)} />)}
 *       </div>
 *     </PopoverContent>
 *   </Popover>
 *
 * 官方按钮本体的 `handle` 是 **空函数 `tot(){}`**（点按钮不做事，交互全在色盘里）⇒ 这里同样不派发任何动作。
 * 官方 tooltip = `nodes.markdownToolbar.backgroundColor`（中文包 =「背景颜色」）。
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../../../i18n';
import {
  TEXT_BACKGROUND_COLORS,
  TEXT_BACKGROUND_COLOR_LABELS,
  applyColorOpacity,
} from '../../../../services/officialTextColors';

export interface ColorPickerButtonProps {
  /** 当前 `data.color`（空 = 未设置 ⇒ 触发器显示 `bg-card-foreground`） */
  color: string;
  onColorChange: (color: string) => void;
  disabled?: boolean;
}

function ColorPickerButton({ color, onColorChange, disabled = false }: ColorPickerButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 官方是 Radix popover ⇒ 点外部 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const tooltip = t('背景颜色');
  const close = useCallback(() => setOpen(false), []);

  const pick = useCallback((appliedValue: string) => {
    onColorChange(applyColorOpacity(appliedValue, 1));
    close();
  }, [close, onColorChange]);

  const reset = useCallback(() => {
    /* 官方 `onReset: () => o("")` —— 清空颜色 */
    onColorChange('');
    close();
  }, [close, onColorChange]);

  return (
    <div ref={wrapRef} className="color-picker-wrap nodrag">
      <button
        type="button"
        className="ftb-btn icon-only act-color-picker"
        data-tooltip={tooltip}
        aria-label={tooltip}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={(e) => {
          /* 官方按钮本体 `handle` 是空函数；点按钮只是 hover 高光，交互在色点触发器上 */
          e.stopPropagation();
        }}
      >
        <span
          role="button"
          tabIndex={-1}
          aria-hidden="true"
          className={`color-picker-trigger${color ? '' : ' is-empty'}`}
          style={color ? { backgroundColor: color } : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setOpen((v) => !v);
          }}
        />
      </button>

      {open && (
        <div
          className="color-picker-popover nodrag"
          role="dialog"
          aria-label={tooltip}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="color-picker-panel">
            <button
              type="button"
              className="color-picker-reset"
              onClick={reset}
              aria-label={t('重置颜色')}
              data-tooltip={t('重置颜色')}
              data-tooltip-pos="bottom"
            />
            {TEXT_BACKGROUND_COLORS.map((c) => {
              const label = t(TEXT_BACKGROUND_COLOR_LABELS[c.label] ?? c.label);
              return (
                <button
                  key={c.value}
                  type="button"
                  className="color-picker-swatch"
                  style={{ backgroundColor: c.value }}
                  onClick={() => pick(c.appliedValue)}
                  aria-label={label}
                  title={label}
                  data-tooltip={label}
                  data-tooltip-pos="bottom"
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ColorPickerButton);
