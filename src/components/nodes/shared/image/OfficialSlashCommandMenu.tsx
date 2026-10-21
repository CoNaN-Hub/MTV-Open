import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { OFFICIAL_SLASH_COMMANDS, SLASH_CONNECT_HINT, type OfficialSlashCommand } from './officialSlashCommands';
import { OfficialSlashIcon } from './officialSlashIcons';

/* ══════════════════════════════════════════════════════════════════════════
   官方 `/` 指令菜单 —— 逐字复刻 `lT` = `SlashCommandMenu`（`zoom-slider-3ZcFvYQO.js` @**1622825**）
   ──────────────────────────────────────────────────────────────────────────
   容器：`Z("w-full bg-popover rounded-lg shadow-lg border border-border py-2 max-h-96 overflow-y-auto", className)`
   列表：`"px-2 pb-1"`（**没有搜索框**，`vm` 是静态 5 条、不筛选）
   单项（`ije` @1621437）：
     `Z("w-full h-13 text-base cursor-pointer rounded-xl p-2 transition-all duration-200 flex items-center gap-2 mb-1",
        selected && "bg-accent/50", !disabled && "hover:bg-accent/50", disabled && "opacity-50 cursor-not-allowed")`
     图标框 `"h-full aspect-square rounded-md text-muted-foreground bg-accent/40 flex items-center justify-center
              transition-all duration-200 [&_svg]:size-[18px] [&_svg]:text-popover-foreground"`
     标题  `Z("font-medium text-sm capitalize text-popover-foreground leading-none transition-transform duration-200",
              hover||selected ? "translate-y-0" : "translate-y-[10px]")`
     描述  `Z("text-xs text-muted-foreground leading-none transition-all duration-200 truncate",
              hover||selected ? "opacity-100" : "opacity-0", disabledReason && "text-destructive")`
   连接提示（仅 disabled && showConnectionHint）：
     `"px-3 pb-2 pt-2 border-t border-border text-sm text-destructive"` ← `nodes.slashCommands.connectImageShortcutHint`
   ref API（官方同名）：`moveUp / moveDown / selectCurrent / escape`（上下**循环**）
   ⚠️ 官方主题 token（dark）：`--popover:#262626`、`--accent:#404040`、`--border:#ffffff1a`、
      `--popover-foreground:#ccc`、`--muted-foreground:#7a7a7a`、`destructive:#934c4c`
      —— MTV 的 Tailwind 未必生成 `bg-popover/bg-accent/border-border`，
      所以在 `prompt.css` 里用**同名类 + 官方色值**显式落地（见 `.oscm-*`）。
   ══════════════════════════════════════════════════════════════════════════ */

export interface OfficialSlashCommandMenuHandle {
  moveUp: () => void;
  moveDown: () => void;
  selectCurrent: () => void;
  escape: () => void;
}

interface Props {
  visible: boolean;
  /** 官方 `isMenuDisabled`：连线条数 / 节点类型不满足时整菜单禁用 */
  disabled?: boolean;
  /** 官方 `showConnectionHint`：禁用且未生成时，底部显示「至少连入一张图片」提示 */
  showConnectionHint?: boolean;
  onSelect: (command: OfficialSlashCommand) => void;
  onClose: () => void;
  className?: string;
}

const OfficialSlashCommandMenu = forwardRef<OfficialSlashCommandMenuHandle, Props>(function OfficialSlashCommandMenu(
  { visible, disabled = false, showConnectionHint = false, onSelect, onClose, className },
  ref,
) {
  const [selected, setSelected] = useState(0);

  useImperativeHandle(ref, () => ({
    moveUp: () => setSelected((i) => (i > 0 ? i - 1 : OFFICIAL_SLASH_COMMANDS.length - 1)),
    moveDown: () => setSelected((i) => (i < OFFICIAL_SLASH_COMMANDS.length - 1 ? i + 1 : 0)),
    selectCurrent: () => {
      const cmd = OFFICIAL_SLASH_COMMANDS[selected];
      if (cmd && !disabled) onSelect(cmd);
    },
    escape: () => onClose(),
  }), [selected, disabled, onSelect, onClose]);

  useEffect(() => { if (visible) setSelected(0); }, [visible]);
  if (!visible) return null;

  return (
    <div className={`oscm-root w-full max-h-96 overflow-y-auto py-2 ${className ?? ''}`} data-testid="official-slash-menu">
      <div className="px-2 pb-1">
        {OFFICIAL_SLASH_COMMANDS.map((cmd, index) => {
          const isSelected = selected === index;
          const active = isSelected;
          return (
            <div
              key={cmd.id}
              role="menuitem"
              aria-selected={isSelected}
              data-testid={`official-slash-item-${cmd.id}`}
              className={`oscm-item mb-1 flex h-[52px] w-full cursor-pointer items-center gap-2 rounded-xl p-2 text-base transition-all duration-200${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
              onMouseEnter={() => setSelected(index)}
              onClick={() => { if (!disabled) onSelect(cmd); }}
            >
              <div className="oscm-icon-box flex h-full aspect-square items-center justify-center rounded-md transition-all duration-200">
                <OfficialSlashIcon id={cmd.id} />
              </div>
              <div className="flex h-full flex-1 flex-col justify-between overflow-hidden">
                <span className={`oscm-title font-medium text-sm leading-none transition-transform duration-200${active ? ' translate-y-0' : ' translate-y-[10px]'}`}>
                  {cmd.title}
                </span>
                <p className={`oscm-desc truncate text-xs leading-none transition-all duration-200${active ? ' opacity-100' : ' opacity-0'}`}>
                  {cmd.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {disabled && showConnectionHint && (
        <div className="oscm-hint border-t px-3 pb-2 pt-2 text-sm">{SLASH_CONNECT_HINT}</div>
      )}
    </div>
  );
});

export default OfficialSlashCommandMenu;
