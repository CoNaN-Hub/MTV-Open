/**
 * AgentAddMenu —— 官方 rail 左簇第 1 颗「+」add 菜单（`fae`，`page-DVqoHdTT.js`@745924）的 1:1 移植。
 *
 * 官方逐字依据（源码 + CDP 9222 运行时 DOM 双证）：
 *   · 触发钮 `relative flex size-[26px] shrink-0 items-center justify-center rounded-full bg-white/10 p-0
 *     text-foreground cursor-pointer transition-all hover:bg-white/15`（disabled 加 `opacity-50 cursor-not-allowed`），
 *     `aria-label = chatAdapter.addMenu.open`（添加）；上传中换成 16px spinner；右下角提示点
 *     `absolute -top-px -right-px size-[7px] rounded-full bg-accent-primary animate-in zoom-in duration-300`。
 *   · 菜单 content `w-[240px]`、`side:"top"`、`sideOffset:4`、`align:"start"`、`onCloseAutoFocus` 阻止回落焦点；
 *     内卡 `flex flex-col items-start justify-end gap-[4px] overflow-hidden rounded-2xl border-0 bg-[#292929]
 *     p-1 shadow-[0_4px_16px_0_rgba(0,0,0,0.16),inset_0_0.5px_0_0_rgba(255,255,255,0.16)]`（实测菜单盒 240×230）。
 *   · 行 `flex h-8 cursor-pointer items-center justify-between gap-0 self-stretch rounded-md py-1.5 pr-2 pl-3
 *     focus:bg-white/10`（实测 232×32）；行内左组 `flex min-w-0 items-center gap-[6px]`，
 *     图标 `shrink-0 text-text-text-primary` @16，文案 `truncate text-xs text-text-text-primary`。
 *   · 分隔线 `my-0 bg-white/6`。
 *   · 子面板（技能/应用）`flex w-[340px] max-h-[320px] flex-col items-start justify-end gap-1 overflow-hidden
 *     rounded-2xl border-0 bg-[#292929] px-2 pt-2 pb-1 shadow-[…] animate-in fade-in-0 zoom-in-95 duration-100`，
 *     `absolute bottom-0`，`left: 244px` 或 `left: -344px`（按可用空间翻边：`panelRight - triggerLeft >= 240+4+340+8`）。
 *
 * ⚠️ 官方 7 行里 MTV 目前只能接 3 行的后端；其余 3 行**不造假**、按原位置留注释：
 *   · `insertFromCanvas`（从画布添加）→ 打开 MTV 的 @ 引用面板（画布节点页）✅
 *   · `uploadAttachment`（上传附件）→ MTV 没有「对话附件」这个概念（只有本地读取授权）⇒ 暂缺
 *   · `addLocalFolder`（添加本地文件夹，桌面端）→ MTV 的「授权当前对话读取本地文件」✅
 *   · `skills` 子面板（技能）→ MTV 技能列表 + 上传 Skill（文件/文件夹）✅
 *   · `brainstorm`（头脑风暴）→ 会话级开关 ✅（图标 = 官方 `wg` 位图 `/assets/brainstorm-icon.svg`）
 *   · `plugins` 子面板（全部应用）→ MTV 没有对话应用概念 ⇒ 暂缺
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useT } from '../../i18n';
import {
  OfficialBrainstormIcon,
  OfficialInsertFromCanvasIcon,
  OfficialLoaderCircleIcon,
  OfficialPaperclipIcon,
  OfficialSkillAvatarIcon,
  OfficialSkillCreateIcon,
  OfficialSkillGlyphIcon,
  OfficialSkillManageIcon,
  OfficialUploadIcon,
} from './officialIcons';
import OfficialScrollFade from './OfficialScrollFade';


/** 官方 `pl` / `hl` / `ml` / `gl` / `aae` / `uae`（常量定义 PAGE@744843）。 */
const ROW_CLASS = 'flex h-8 cursor-pointer items-center justify-between gap-0 self-stretch rounded-md py-1.5 pr-2 pl-3 focus:bg-white/10 hover:bg-white/10 w-full text-left';
const ROW_LEFT_CLASS = 'flex min-w-0 items-center gap-[6px]';
const LABEL_CLASS = 'truncate text-xs text-text-text-primary';
const ICON_CLASS = 'shrink-0 text-text-text-primary';
const CARD_CLASS = 'flex flex-col items-start justify-end gap-[4px] overflow-hidden rounded-2xl border-0 bg-[#292929] p-1 shadow-[0_4px_16px_0_rgba(0,0,0,0.16),inset_0_0.5px_0_0_rgba(255,255,255,0.16)] w-[240px] animate-in fade-in-0 zoom-in-95 duration-100 motion-reduce:animate-none';
const SUBPANEL_CLASS = 'flex w-[340px] max-h-[320px] flex-col items-start justify-end gap-1 overflow-hidden rounded-2xl border-0 bg-[#292929] px-2 pt-2 pb-1 shadow-[0_4px_16px_0_rgba(0,0,0,0.16),inset_0_0.5px_0_0_rgba(255,255,255,0.16)] animate-in fade-in-0 zoom-in-95 duration-100 motion-reduce:animate-none';

/** 官方 `tI`：14×14 折叠箭头（`opacity .4` 白描边 1.2）。 */
function RowChevron() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 14 14" fill="none" className="shrink-0" aria-hidden="true">
      <path opacity="0.4" d="M5.25 10.5L8.75 7L5.25 3.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface AgentAddMenuSkillOption {
  id: string;
  name: string;
  description?: string;
}

interface AgentAddMenuProps {
  disabled?: boolean;
  uploading?: boolean;
  /** 官方 `showAddLocalFolder`：桌面端才显示「添加本地文件夹」。 */
  showAddLocalFolder?: boolean;
  hasHint?: boolean;
  onInsertFromCanvas: () => void;
  onAddLocalDirectory: () => void;
  /** 官方 `uploadAttachment`：选文件作为本轮附件（进 `ContextStrip` 的附件 chip）。 */
  onUploadAttachment?: () => void;
  skills?: AgentAddMenuSkillOption[];
  skillUploading?: boolean;
  onSelectSkill?: (skill: AgentAddMenuSkillOption) => void;
  onUploadSkillFile?: () => void;
  onUploadSkillFolder?: () => void;
  /** 官方 `chatAdapter.addMenu.skills.createSkill`（zh「创建技能」）：打开创建技能对话框。 */
  onCreateSkill?: () => void;
  /** 官方 `chatAdapter.addMenu.skills.manageSkill`（zh「管理技能」）：打开技能管理面板。 */
  onManageSkills?: () => void;
  /** 官方行 6「头脑风暴」：会话级开关（激活时行底 `bg-[#90C4E5]/25` + 右侧勾）。 */
  brainstormActive?: boolean;
  onToggleBrainstorm?: () => void;
}

export default function AgentAddMenu({
  disabled = false,
  uploading = false,
  showAddLocalFolder = false,
  hasHint = false,
  onInsertFromCanvas,
  onUploadAttachment,
  onAddLocalDirectory,
  skills = [],
  skillUploading = false,
  onSelectSkill,
  onUploadSkillFile,
  onUploadSkillFolder,
  onCreateSkill,
  onManageSkills,
  brainstormActive = false,
  onToggleBrainstorm,
}: AgentAddMenuProps) {
  const t = useT();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [sub, setSub] = useState<'main' | 'skills'>('main');
  /** 官方技能子面板搜索框（`Ss`）的受控值。 */
  const [skillQuery, setSkillQuery] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  /** 官方 `Ea(query, 300)`：本地面包按名称/描述做大小写无关的子串匹配。 */
  const visibleSkills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    if (!query) return skills;
    return skills.filter((skill) => `${skill.name} ${skill.description ?? ''}`.toLowerCase().includes(query));
  }, [skills, skillQuery]);

  /** 官方 `j()`：翻边判据 `panelRight - triggerLeft >= 240 + 4 + 340 + 8`。 */
  const resolveSide = useCallback(() => {
    const anchor = anchorRef.current;
    const bubble = anchor?.closest<HTMLElement>('[data-canvas-input-bubble], .c-composer__card');
    const container = bubble ?? anchor;
    if (!anchor || !container) return 'right' as const;
    const available = container.getBoundingClientRect().right - anchor.getBoundingClientRect().left;
    return available >= 240 + 4 + 340 + 8 ? ('right' as const) : ('left' as const);
  }, []);

  /* 官方 Radix：`side:"top"`、`sideOffset:4`、`align:"start"`。 */
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = menuRef.current?.offsetWidth ?? 240;
    const height = menuRef.current?.offsetHeight ?? 0;
    setPosition({
      top: Math.max(8, rect.top - 4 - height),
      left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8)),
    });
    setSide(resolveSide());
  }, [open, resolveSide]);

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

  const close = () => { setOpen(false); setSub('main'); };

  return (
    <div className="relative flex items-center">
      <div ref={anchorRef} className="inline-flex">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          aria-label={t('添加')}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            if (disabled) { setOpen(false); return; }
            setOpen((value) => {
              if (value) setSub('main');
              return !value;
            });
          }}
          className={[
            'relative flex size-[26px] shrink-0 items-center justify-center rounded-full bg-white/10 p-0 text-foreground cursor-pointer transition-all hover:bg-white/15',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].filter(Boolean).join(' ')}
        >
          {uploading
            ? <OfficialLoaderCircleIcon size={16} strokeWidth={1.5} className="animate-spin" />
            : <Icon icon="lucide:plus" width={16} height={16} strokeWidth={2} />}
          {hasHint && (
            <span aria-hidden="true" className="absolute -top-px -right-px size-[7px] rounded-full bg-accent-primary animate-in zoom-in duration-300" />
          )}
        </button>
      </div>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50"
          style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, visibility: position ? 'visible' : 'hidden' }}
        >
          <div className={CARD_CLASS} role="menu" aria-label={t('添加')}>
            <div className="flex w-full flex-col gap-[4px]">
              {/* 官方行 1：从画布添加（0.4.90 的 `dm`=`Nui` 自绘 glyph，24 视框 + `scale(.84)`） */}
              <button type="button" role="menuitem" onMouseEnter={() => setSub('main')}
                onClick={() => { close(); onInsertFromCanvas(); }} className={ROW_CLASS}>
                <span className={ROW_LEFT_CLASS}>
                  <OfficialInsertFromCanvasIcon size={16} className={ICON_CLASS} />
                  <span className={LABEL_CLASS}>{t('从画布添加')}</span>
                </span>
              </button>

              {/* 官方行 2：`uploadAttachment`（官方 0.4.90 行序里它是**第一行**；
                  图标 = tabler `paperclip`，16 / strokeWidth 1.5）。 */}
              <button type="button" role="menuitem" onMouseEnter={() => setSub('main')}
                onClick={() => { close(); onUploadAttachment?.(); }} disabled={disabled} className={ROW_CLASS}>
                <span className={ROW_LEFT_CLASS}>
                  <OfficialPaperclipIcon size={16} strokeWidth={1.5} className={ICON_CLASS} />
                  <span className={LABEL_CLASS}>{t('上传附件')}</span>
                </span>
              </button>

              {/* 官方行 3：添加本地文件夹（桌面端；lucide folder-plus 16 / 1.5） */}
              {showAddLocalFolder && (
                <button type="button" role="menuitem" onMouseEnter={() => setSub('main')}
                  onClick={() => { close(); onAddLocalDirectory(); }} className={ROW_CLASS}>
                  <span className={ROW_LEFT_CLASS}>
                    <Icon icon="lucide:folder-plus" width={16} height={16} strokeWidth={1.5} className={ICON_CLASS} />
                    <span className={LABEL_CLASS}>{t('添加本地文件夹')}</span>
                  </span>
                </button>
              )}

              <div className="my-0 h-px w-full bg-white/[0.06]" aria-hidden="true" />

              {/* 官方行 4：技能（打开子面板） */}
              <button type="button" role="menuitem" aria-expanded={sub === 'skills'}
                onMouseEnter={() => setSub('skills')}
                onClick={(event) => { event.preventDefault(); setSub('skills'); }}
                className={`${ROW_CLASS} ${sub === 'skills' ? 'bg-white/10' : ''}`}>
                <span className={ROW_LEFT_CLASS}>
                  <OfficialSkillGlyphIcon size={16} className={ICON_CLASS} />
                  <span className={LABEL_CLASS}>{t('技能')}</span>
                </span>
                <RowChevron />
              </button>

              <div className="my-0 h-px w-full bg-white/[0.06]" aria-hidden="true" />

              {/* 官方行 6：头脑风暴（会话级开关）。官方逐字：
                  行 `cx(pl, active && 'bg-[#90C4E5]/25 focus:bg-[#90C4E5]/25')`；
                  文案额外加 `text-[#E6E6E6]`；右侧 12×12 勾 `d="M10 3L4.5 8.5L2 6"` stroke `#90C4E5` 1.4。 */}
              {onToggleBrainstorm && (
                <button
                  type="button"
                  role="menuitem"
                  aria-checked={brainstormActive}
                  onMouseEnter={() => setSub('main')}
                  onClick={() => { close(); onToggleBrainstorm(); }}
                  className={`${ROW_CLASS} ${brainstormActive ? 'bg-[#90C4E5]/25 hover:bg-[#90C4E5]/25' : ''}`}
                >
                  <span className={ROW_LEFT_CLASS}>
                    <OfficialBrainstormIcon size={16} className={ICON_CLASS} />
                    <span className={`${LABEL_CLASS} text-[#E6E6E6]`}>{t('头脑风暴')}</span>
                  </span>
                  <div className="flex shrink-0 items-center justify-center">
                    {brainstormActive && (
                      <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 12 12" fill="none" className="shrink-0" aria-hidden="true">
                        <path d="M10 3L4.5 8.5L2 6" stroke="#90C4E5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              )}

              <div className="my-0 h-px w-full bg-white/[0.06]" aria-hidden="true" />

              {/* 官方行 7：`plugins`（全部应用）子面板 —— MTV 没有对话应用概念 ⇒ 暂缺（不造假） */}
            </div>
          </div>

          {sub === 'skills' && (
            /* 官方技能子面板（`use-chat-attachment-file-input-*.js`@150768 起）逐字：
               `flex w-full min-w-0 flex-col gap-1 overflow-hidden` + `max-h-[320px]`；
               顺序 = 搜索框 → 可滚动列表（`flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto pb-1`）
               → 分隔线（`my-0 shrink-0 bg-white/6`）→ 上传文件 → 上传文件夹 → 创建技能 → 管理技能。 */
            <div className={SUBPANEL_CLASS} style={{ position: 'absolute', bottom: 0, left: side === 'right' ? 244 : -344 }}>
              <div className="flex w-full min-w-0 flex-col gap-1 overflow-hidden max-h-[320px]">
                {/* 官方 `Ss`（搜索框）：外层 `w-full shrink-0 px-2 pt-1 pb-1` 被调用处覆盖为
                    `px-0 pt-0 pb-0`；内条 `flex h-[32px] w-full items-center gap-[6px] rounded-[10px]
                    border border-white/[0.08] bg-white/[0.04] px-2`，再被 `Ia` 覆盖为
                    `min-w-[48px] self-stretch rounded-[12px] border-0 bg-accent px-3 py-1.5`；
                    图标 14 白 40%，输入 `text-[13px]/[18px] text-white/80 placeholder:text-white/30`。 */}
                <div className="w-full shrink-0 px-0 pt-0 pb-0" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="flex h-[32px] w-full min-w-[48px] items-center gap-[6px] rounded-[12px] border-0 bg-accent px-3 py-1.5">
                    <Icon icon="lucide:search" width={14} height={14} className="shrink-0 text-white/40" />
                    <input
                      type="text"
                      value={skillQuery}
                      onChange={(event) => setSkillQuery(event.target.value)}
                      placeholder={t('搜索')}
                      autoComplete="off"
                      spellCheck={false}
                      className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] leading-[18px] text-white/80 outline-none placeholder:text-white/30"
                    />
                  </div>
                </div>
                {/* 官方技能列表外面还套了一层滚动渐隐 `_s`(=`bN`，上下 20px 渐变、色 `var(--popover)`、
                    阈值 1px)：`<_s ref deps={[b.length, u]} className="flex min-h-0 flex-1 flex-col
                    gap-[2px] overflow-y-auto pb-1">`。 */}
                <OfficialScrollFade
                  className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto pb-1"
                  deps={[visibleSkills.length]}
                >
                  {visibleSkills.length === 0 ? (
                    <div className="flex h-8 items-center px-2 text-xs text-text-text-tertiary">
                      {t('暂无已启用技能')}
                    </div>
                  ) : visibleSkills.map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      role="menuitem"
                      onMouseEnter={() => setSub('skills')}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={(event) => { event.preventDefault(); close(); onSelectSkill?.(skill); }}
                      className={ROW_CLASS}
                    >
                      <span className={ROW_LEFT_CLASS}>
                        <OfficialSkillAvatarIcon size={16} skillName={skill.name} className={ICON_CLASS} />
                        <span className={`${LABEL_CLASS} min-w-0 flex-1 truncate`}>{skill.name}</span>
                      </span>
                    </button>
                  ))}
                </OfficialScrollFade>
                <div className="my-0 shrink-0 h-px w-full bg-white/[0.06]" aria-hidden="true" />
                {/* 官方两条上传行**共用同一颗 `qt` 图标**（`use-chat-attachment-file-input-*.js`@151484 /
                    @152000）；MTV 曾自造 `lucide:file-up` / `lucide:folder-up`，已按官方移除。
                    官方忙碌态 = `<wt size={16} className="animate-spin" />`（lucide loader-circle）。 */}
                <button type="button" role="menuitem" disabled={skillUploading}
                  onClick={() => { close(); onUploadSkillFile?.(); }} className={ROW_CLASS}>
                  <span className={ROW_LEFT_CLASS}>
                    {skillUploading
                      ? <OfficialLoaderCircleIcon size={16} className={`${ICON_CLASS} animate-spin`} />
                      : <OfficialUploadIcon size={16} className={ICON_CLASS} />}
                    <span className={LABEL_CLASS}>{t('上传 Skill 文件')}</span>
                  </span>
                </button>
                <button type="button" role="menuitem" disabled={skillUploading}
                  onClick={() => { close(); onUploadSkillFolder?.(); }} className={ROW_CLASS}>
                  <span className={ROW_LEFT_CLASS}>
                    {skillUploading
                      ? <OfficialLoaderCircleIcon size={16} className={`${ICON_CLASS} animate-spin`} />
                      : <OfficialUploadIcon size={16} className={ICON_CLASS} />}
                    <span className={LABEL_CLASS}>{t('上传技能文件夹')}</span>
                  </span>
                </button>
                {/* 官方 `skills.createSkill`（zh「创建技能」）：`Oa` 自绘 16 视框加号。 */}
                <button type="button" role="menuitem"
                  onClick={(event) => { event.preventDefault(); close(); onCreateSkill?.(); }} className={ROW_CLASS}>
                  <span className={ROW_LEFT_CLASS}>
                    <OfficialSkillCreateIcon size={16} className={ICON_CLASS} />
                    <span className={LABEL_CLASS}>{t('创建技能')}</span>
                  </span>
                </button>
                {/* 官方 `skills.manageSkill`（zh「管理技能」）：`Pa` 自绘 16 视框齿轮。 */}
                <button type="button" role="menuitem"
                  onClick={(event) => { event.preventDefault(); close(); onManageSkills?.(); }} className={ROW_CLASS}>
                  <span className={ROW_LEFT_CLASS}>
                    <OfficialSkillManageIcon size={16} className={ICON_CLASS} />
                    <span className={LABEL_CLASS}>{t('管理技能')}</span>
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
