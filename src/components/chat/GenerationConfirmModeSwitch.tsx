/**
 * GenerationConfirmModeSwitch —— 官方 `wp`（`Cp = memo(wp)`，`displayName="GenerationConfirmModeSwitch"`）
 * 的**逐字移植**。官方出处：
 *   · 组件体：`assets/use-chat-attachment-file-input-BcpbCD8t.js` @168588 起（`GenerationConfirmModeSwitch`）
 *   · 运行时 DOM / 几何：CDP 9222 实测（`_off-confirm-switch.out.txt`、`_off-rail-probe.out.txt`）
 *
 * 逐行对照（左=官方，右=本文件）：
 *   位置    官方挂在**输入框底部控制条**（rail）左侧：实测父链
 *           `div.flex h-10 min-w-0 items-center justify-between px-2 pb-2`（rail `[2209,1295,343,40]`，
 *           开关 `[2251,1298,26,26]`，紧跟在「+」之后）⇒ **不是头部**。
 *   `jn`    两态表：`{mode, labelKey, titleKey, descKey, desktopDescKey}` —— 原样照抄（含键路径）。
 *   `bp`    菜单容器类：`flex w-[min(18rem,calc(100vw-1.5rem))] flex-col items-stretch gap-[4px]
 *           overflow-hidden rounded-2xl border-0 bg-[#292929] p-1 shadow-[0_4px_16px_0_rgba(0,0,0,0.16),
 *           inset_0_0.5px_0_0_rgba(255,255,255,0.16)]`
 *   `Ap`    菜单行类：`flex w-full cursor-pointer items-start gap-2.5 rounded-md py-1.5 pr-2 pl-3
 *           focus:bg-white/5 data-[highlighted]:bg-white/5`
 *   触发键   `flex h-[26px] min-w-[26px] shrink-0 items-center overflow-hidden rounded-full cursor-pointer`
 *           + `iconOnly ? "px-[5px]" : "py-1 pr-1.5 pl-1"` + `text-sm font-medium text-foreground/90`
 *           + `transition-[padding,background-color] duration-150 ease-out motion-reduce:transition-none`
 *           + `hover:bg-foreground/10` + `focus:outline-none focus-visible:outline-none`
 *           + open 时 `bg-white/5`；disabled 时 `cursor-not-allowed opacity-50 hover:bg-transparent`
 *   标签块   `aria-hidden={iconOnly}`、`data-adaptive-control-content="confirm-mode"`、
 *           `grid min-w-0 transition-[grid-template-columns,opacity,margin] duration-150 ease-out`
 *           + `iconOnly ? "ml-0 grid-cols-[0fr] opacity-0" : "ml-1.5 grid-cols-[1fr] opacity-100"`
 *   箭头     `ml-2.5 aspect-square size-3 shrink-0 text-white/40 transition-transform duration-150` + open 时 `rotate-180`
 *   图标     `Gr`：ask=`kl`（path 用 `fill="currentColor"`）、auto=`Sl`（`stroke="currentColor" stroke-width="1.16375"
 *           stroke-linecap/linejoin="round"`）；触发 16px / 菜单行 16px（`mt-1.5 size-4 shrink-0 text-text-text-primary`）
 *   勾       `qo` = lucide check，`size-4`、`strokeWidth 2`、`text-white/88`，仅当前态渲染
 *   了解更多  仅桌面端（官方 `o = desktopCapability.available === true`）渲染该行：
 *           wrapper `mt-0.5 w-full border-t border-white/10 px-2 pt-1.5 pb-0.5`，
 *           按钮 `w-full rounded-md px-2 py-1.5 text-left text-[11px] leading-4 text-white/50
 *           transition-colors hover:bg-white/5 hover:text-white/80`，
 *           onClick = `preventDefault + stopPropagation + openSettingsModal(DESKTOP_PERMISSIONS) + 关闭菜单`
 *   对齐     `align:"start"`, `side:"top"`, `sideOffset:8`, `alignOffset = addButton.left - anchor.left`
 *   提示     `ps`（面板 tooltip）：关闭态显示当前模式的描述（桌面端用 desktopDescKey）
 *   受控/持久化：官方读全局 `AGENT_PREFS.generation_confirm_mode` + 会话 `conversationConfirmationMode`。
 *           MTV 对应物 = 会话的 `agentMode`（`collaborative`=ask / `autonomous`=auto），由 props 传入。
 *
 * ⚠️ 与官方的两处**实现差异**（非设计差异，均已记账）：
 *   1. 官方用 Radix `DropdownMenu`（`hs/fs/ms/Ie`）；MTV 没有 Radix，用与 `ConversationMenu`
 *      同一套 portal + 手动定位，定位参数照抄官方（side:top / sideOffset:8 / align:start / alignOffset）。
 *   2. 官方两个模式字形来自其图标注册表（`kl`/`Sl`）；MTV 没有这两个注册表项，故将官方运行时 DOM 里的
 *      `<path d>` 与属性**原样内联**（见 `MODE_GLYPHS`）。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { AgentMode } from '../../types/agent';
import { useT } from '../../i18n';

/** 官方 `Gr` 的两个字形（16×16）。路径与属性逐字取自官方运行时 DOM。 */
const MODE_GLYPHS: Record<AgentMode, { d: string; stroked: boolean }> = {
  /* 官方 `kl`（ask） */
  collaborative: {
    stroked: false,
    d:
    'M3.83328 4.33301C3.83331 3.87629 4.01456 3.43819 4.33751 3.11523C4.66047 2.79228 5.09856 2.61102 5.55528 2.611C5.81881 2.611 6.07597 2.6717 6.30854 2.78483C6.3732 2.44946 6.53688 2.13825 6.78185 1.89323C7.10483 1.57025 7.54318 1.38867 7.99994 1.38867C8.45665 1.38871 8.89478 1.57029 9.21772 1.89323C9.46267 2.13824 9.62603 2.44948 9.6907 2.78483C9.92334 2.67161 10.1806 2.611 10.4443 2.611C10.901 2.61101 11.3391 2.79229 11.6621 3.11523C11.9071 3.36028 12.0704 3.67172 12.135 4.00716C12.3677 3.89391 12.625 3.83302 12.8886 3.83301C13.3454 3.83301 13.7834 4.01461 14.1064 4.33757C14.4294 4.66054 14.6109 5.09858 14.6109 5.55534V9.22201C14.6109 10.6512 14.0431 12.0219 13.0325 13.0326C12.0219 14.0431 10.6512 14.611 9.22195 14.611H7.99994C6.15443 14.611 4.98945 14.0313 3.98692 13.0355L3.98562 13.0345L1.78575 10.8343C1.77978 10.8283 1.77383 10.8223 1.76817 10.8161C1.47193 10.488 1.31319 10.0584 1.32481 9.61654C1.33647 9.17459 1.51751 8.75379 1.83067 8.44173C2.14384 8.12969 2.56514 7.9502 3.00711 7.9401C3.29644 7.9335 3.58004 8.00011 3.83328 8.13021V4.33301ZM6.27761 7.08301V4.33301L6.27403 4.26172C6.25761 4.09639 6.18453 3.94077 6.06603 3.82227C5.93059 3.68688 5.74679 3.611 5.55528 3.611C5.36377 3.61102 5.17997 3.68685 5.04454 3.82227C4.90912 3.95768 4.83331 4.1415 4.83328 4.33301V9.01497L5.2978 9.47949C5.49303 9.67473 5.49298 9.99126 5.2978 10.1865C5.10253 10.3818 4.78603 10.3818 4.59077 10.1865L3.98269 9.57845C3.9805 9.5763 3.97833 9.57413 3.97618 9.57194L3.53022 9.12598C3.39329 9.00234 3.21439 8.93557 3.02989 8.93978C2.84461 8.94401 2.66804 9.01929 2.53673 9.15007C2.4054 9.28093 2.32938 9.45757 2.32449 9.6429C2.3197 9.82581 2.38465 10.0034 2.5058 10.1403L4.69135 12.3262H4.69168C5.51025 13.1392 6.42327 13.611 7.99994 13.611H9.22195C10.3859 13.611 11.5024 13.1486 12.3255 12.3255C13.1485 11.5024 13.6109 10.386 13.6109 9.22201V5.55534C13.6109 5.36379 13.5348 5.18004 13.3994 5.0446C13.2639 4.90917 13.0801 4.83301 12.8886 4.83301C12.6971 4.83302 12.5133 4.90917 12.3779 5.0446C12.2425 5.18004 12.1666 5.36381 12.1666 5.55534V7.38867C12.1666 7.66476 11.9427 7.88859 11.6666 7.88867C11.3905 7.88867 11.1666 7.66481 11.1666 7.38867V4.33301C11.1666 4.1415 11.0904 3.95768 10.955 3.82227C10.8196 3.68685 10.6358 3.61101 10.4443 3.611C10.2528 3.611 10.069 3.68687 9.93354 3.82227C9.79812 3.95768 9.72198 4.1415 9.72195 4.33301V6.77767C9.72189 7.05376 9.49806 7.27767 9.22195 7.27767C8.94587 7.27764 8.72201 7.05374 8.72195 6.77767V3.111C8.72195 2.91946 8.6458 2.7357 8.51036 2.60026C8.37496 2.46487 8.19142 2.38871 7.99994 2.38867C7.80841 2.38867 7.62464 2.46483 7.4892 2.60026C7.35376 2.7357 7.27761 2.91946 7.27761 3.111V7.08301C7.27761 7.35913 7.05374 7.58298 6.77761 7.58301C6.50147 7.58301 6.27761 7.35915 6.27761 7.08301Z',
  },
  /* 官方 `Sl`（auto） */
  autonomous: {
    stroked: true,
    d:
    'M13.8176 4.87041C12.9896 3.66009 11.7752 2.76673 10.3733 2.33655C8.97142 1.90637 7.465 1.96488 6.10067 2.50248C4.73634 3.04009 3.59494 4.02495 2.86332 5.29583C2.1317 6.56671 1.85321 8.04832 2.07343 9.49812C2.29365 10.9479 2.99955 12.28 4.07555 13.2763C5.15155 14.2726 6.53392 14.8741 7.99634 14.9823C9.45877 15.0906 10.9146 14.6991 12.1256 13.872C13.3365 13.045 14.2308 11.8313 14.662 10.4297M13.8176 1V4.87041H9.94716M6.21749 9.09267L7.9064 10.7816L11.2138 7.47414',
  },
};

/** 官方 `jn`：两态表（键路径为官方词典路径，取值见 `src/i18n/locales/*`）。 */
const MODES: Array<{
  mode: AgentMode;
  labelKey: string;
  titleKey: string;
  descKey: string;
  desktopDescKey: string;
}> = [
  {
    mode: 'collaborative',
    labelKey: 'chatAdapter.confirmMode.ask',
    titleKey: 'chatAdapter.confirmMode.askTitle',
    descKey: 'chatAdapter.confirmMode.askDesc',
    desktopDescKey: 'chatAdapter.localPermissionMenu.alwaysConfirmDescription',
  },
  {
    mode: 'autonomous',
    labelKey: 'chatAdapter.confirmMode.auto',
    titleKey: 'chatAdapter.confirmMode.autoTitle',
    descKey: 'chatAdapter.confirmMode.autoDesc',
    desktopDescKey: 'chatAdapter.localPermissionMenu.autoExceptDeleteDescription',
  },
];

/** 官方 `bp`。 */
const MENU_CLASS = 'flex w-[min(18rem,calc(100vw-1.5rem))] flex-col items-stretch gap-[4px] overflow-hidden rounded-2xl border-0 bg-[#292929] p-1 shadow-[0_4px_16px_0_rgba(0,0,0,0.16),inset_0_0.5px_0_0_rgba(255,255,255,0.16)]';
/** 官方 `Ap`（`data-[highlighted]` 由 Radix 提供，MTV 用 `hover:` 覆盖同一视觉）。 */
const ITEM_CLASS = 'flex w-full cursor-pointer items-start gap-2.5 rounded-md py-1.5 pr-2 pl-3 focus:bg-white/5 hover:bg-white/5';

/** 官方 `side:"top"`、`sideOffset:8`。 */
const MENU_SIDE_OFFSET = 8;

interface GenerationConfirmModeSwitchProps {
  /** 官方会话级 `conversationConfirmationMode`：MTV 用会话 `agentMode` 承载。
   *  ⚠️ 无活动会话时宿主会传 `undefined` ⇒ 这里必须给默认值，否则触发钮字形取不到而整块崩。 */
  mode?: AgentMode;
  onChange: (mode: AgentMode) => void;
  disabled?: boolean;
  /** 官方 rail 宽度 ≤ 450 时的 `data-icon-only` 形态（`const mae=450`，PAGE@755181）。 */
  iconOnly?: boolean;
  /** 官方 `addButtonAlignRef`：「+」按钮，用于 `alignOffset`。 */
  addButtonAlignRef?: RefObject<HTMLElement | null>;
}

export default function GenerationConfirmModeSwitch({
  mode = 'collaborative',
  onChange,
  disabled = false,
  iconOnly = false,
  addButtonAlignRef,
}: GenerationConfirmModeSwitchProps) {
  const t = useT();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  /** 官方 `o = desktopCapability?.available === true`：MTV 用 Tauri 环境判定。 */
  const desktop = typeof window !== 'undefined' && '__TAURI__' in window;

  /* 官方 `b()`：`g(E.left - w.left)` —— alignOffset = 「+」左边 − 锚点左边。 */
  const resolveAlignOffset = useCallback(() => {
    const anchor = anchorRef.current;
    const addButton = addButtonAlignRef?.current;
    if (!anchor || !addButton) return 0;
    return addButton.getBoundingClientRect().left - anchor.getBoundingClientRect().left;
  }, [addButtonAlignRef]);

  /* 官方 Radix `ms`：`side:"top" sideOffset:8 align:"start" alignOffset`。 */
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = menuRef.current?.offsetWidth ?? 0;
    const height = menuRef.current?.offsetHeight ?? 0;
    const left = Math.min(
      Math.max(8, rect.left + resolveAlignOffset()),
      Math.max(8, window.innerWidth - width - 8),
    );
    setPosition({ top: Math.max(8, rect.top - MENU_SIDE_OFFSET - height), left });
  }, [open, resolveAlignOffset]);

  /* 官方 Radix `hs` 的 `onOpenChange`：禁用时 `m(false)`，否则 `w && b(), m(w)`。 */
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    /* 官方 `useLayoutEffect`：打开时监听 resize 重算 alignOffset。 */
    const onResize = () => setPosition(null);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  /* 官方 Radix 关闭后重新打开会重新定位；position 随 open 归零由下面的 open 分支处理。 */

  /* 官方 `S = jn.find(w => w.mode === u) ?? jn[0]`。 */
  const active = MODES.find((item) => item.mode === mode) ?? MODES[0];
  /* ⚠️ 触发钮上的字形必须用**已归一化的** `active.mode`：
     没有活动会话时 `mode` 会是 `undefined`，此前这里直接 `MODE_GLYPHS[mode].d`
     ⇒ `TypeError: Cannot read properties of undefined (reading 'd')`
     ⇒ 整个「对话助手」惰性边界加载失败（用户实测「agent 面板加载不出来」）。 */
  const activeGlyph = MODE_GLYPHS[active.mode] ?? MODE_GLYPHS[MODES[0].mode];
  const activeDesc = desktop ? active.desktopDescKey : active.descKey;

  return (
    <>
      <div ref={anchorRef} className="inline-flex">
        <button
          type="button"
          disabled={disabled}
          data-testid="generation-confirm-mode-switch"
          aria-label={t(active.labelKey)}
          aria-haspopup="menu"
          aria-expanded={open}
          data-icon-only={iconOnly || undefined}
          /* 官方 `ps`：关闭态显示当前模式描述（`f ? "" : s(M)`）。 */
          data-tooltip={open ? undefined : t(activeDesc)}
          onClick={() => {
            if (disabled) { setOpen(false); return; }
            setOpen((value) => !value);
          }}
          className={[
            'flex h-[26px] min-w-[26px] shrink-0 items-center overflow-hidden rounded-full cursor-pointer',
            iconOnly ? 'px-[5px]' : 'py-1 pr-1.5 pl-1',
            'text-sm font-medium text-foreground/90',
            'transition-[padding,background-color] duration-150 ease-out motion-reduce:transition-none',
            'hover:bg-foreground/10',
            'focus:outline-none focus-visible:outline-none',
            open ? 'bg-white/5' : '',
            disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : '',
          ].filter(Boolean).join(' ')}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0 text-foreground/90"
            style={{ flexShrink: 0 }}
            aria-hidden="true"
          >
            <path
              d={activeGlyph.d}
              {...(activeGlyph.stroked
                ? { stroke: 'currentColor', strokeWidth: 1.16375, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
                : { fill: 'currentColor' })}
            />
          </svg>
          <span
            aria-hidden={iconOnly}
            data-adaptive-control-content="confirm-mode"
            className={[
              'grid min-w-0 transition-[grid-template-columns,opacity,margin] duration-150 ease-out motion-reduce:transition-none',
              iconOnly ? 'ml-0 grid-cols-[0fr] opacity-0' : 'ml-1.5 grid-cols-[1fr] opacity-100',
            ].join(' ')}
          >
            <span className="flex min-w-0 items-center overflow-hidden whitespace-nowrap">
              <span>{t(active.labelKey)}</span>
              {/* 官方 `sx`（`size:12, strokeWidth:1.5`）——live DOM 里是 **Tabler `chevron-down`**
                  （24 viewBox、`<path d="M6 9l6 6l6 -6">`，与模型胶囊 `Hl` 同一颗）。
                  ⚠️ 此前这里是自造的 `viewBox="0 0 16 16"` + 24 viewBox 的 path ⇒ 箭头**被裁切/错位**（用户实测指出）。 */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`tabler-icon tabler-icon-chevron-down ml-2.5 aspect-square size-3 shrink-0 text-white/40 transition-transform duration-150 motion-reduce:transition-none${open ? ' rotate-180' : ''}`}
                aria-hidden="true"
              >
                <path d="M6 9l6 6l6 -6" />
              </svg>
            </span>
          </span>
        </button>
      </div>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          data-testid="generation-confirm-mode-menu"
          className={`fixed z-50 ${MENU_CLASS}`}
          style={{
            top: position?.top ?? -9999,
            left: position?.left ?? -9999,
            visibility: position ? 'visible' : 'hidden',
          }}
        >
          <div className="flex w-full flex-col gap-[4px]">
            {MODES.map((item) => {
              const current = item.mode === mode;
              const description = desktop ? item.desktopDescKey : item.descKey;
              return (
                <button
                  key={item.mode}
                  type="button"
                  role="menuitem"
                  data-testid={`generation-confirm-mode-${item.mode === 'collaborative' ? 'ask' : 'auto'}`}
                  onClick={() => {
                    setOpen(false);
                    /* 官方 `v(w)`：`p(w)` + 持久化 + 会话模式；`p` 是本地 state，MTV 由 props 承载。 */
                    if (!current) onChange(item.mode);
                  }}
                  className={`${ITEM_CLASS} text-left`}
                >
                  <svg
                    width={16}
                    height={16}
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mt-1.5 size-4 shrink-0 text-text-text-primary"
                    style={{ flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    <path
                      d={MODE_GLYPHS[item.mode].d}
                      {...(MODE_GLYPHS[item.mode].stroked
                        ? { stroke: 'currentColor', strokeWidth: 1.16375, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
                        : { fill: 'currentColor' })}
                    />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-5 text-text-text-primary">{t(item.titleKey)}</p>
                    <p className="break-words text-xs font-normal leading-4 text-text-text-secondary">{t(description)}</p>
                  </div>
                  <div className="mt-1.5 flex size-4 shrink-0 items-center justify-center">
                    {current && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width={16}
                        height={16}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        /* ⚠️ 官方写的是 `text-white/88`，但 `/88` 不在 Tailwind 的透明度刻度里 ⇒ 该类不会生成；
                           改成任意值 `/[0.88]`（颜色值不变）。 */
                        className="shrink-0 text-white/[0.88]"
                        aria-hidden="true"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {desktop && (
            <div className="mt-0.5 w-full border-t border-white/10 px-2 pt-1.5 pb-0.5">
              <button
                type="button"
                data-testid="generation-confirm-mode-learn-more"
                className="w-full rounded-md px-2 py-1.5 text-left text-[11px] leading-4 text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
                onClick={(event) => {
                  /* 官方：`preventDefault + stopPropagation + openSettingsModal(DESKTOP_PERMISSIONS) + m(false)`。 */
                  event.preventDefault();
                  event.stopPropagation();
                  useAppStore.getState().setSettingsOpen(true, 'permissions');
                  setOpen(false);
                }}
              >
                {t('chatAdapter.localPermissionMenu.learnMore')}
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
