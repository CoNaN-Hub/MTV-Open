/**
 * ConversationMenu —— 官方 TapNow 助手「会话下拉」（1:1 复刻）。
 *
 * 官方依据（`live-侧栏-动作条-面板-输入区.md` §2 A)，逐字取自 canvas chunk）：
 *   · 容器 `w-72 p-1.5 rounded-xl`，`side: bottom`、`sideOffset: 8`、`align: start`（标题触发）/`end`（历史图标触发）
 *   · 「新建对话」行：`flex items-center gap-2 px-2.5 py-2 mb-0.5 rounded-lg hover:bg-white/[0.06]`
 *     + 图标 @16 + 文本 `text-[13px] font-medium text-foreground/90`（`conversation.addNewChat`）
 *   · 滚动区 `max-h-[400px] overflow-y-auto`；列表 `space-y-1`
 *   · 行：`group/item flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-white/[0.06]`
 *     标题 `min-w-0 flex-1 text-[13px] font-normal truncate text-foreground/80 group-hover/item:text-foreground/95`
 *     时间 `shrink-0 inline-flex h-6 items-center text-[11px] text-muted-foreground/50 tabular-nums`（hover 时隐藏）
 *     操作区 `shrink-0 items-center hidden group-hover/item:flex`
 *   · **每行只有两个操作：重命名 + 删除**（官方没有排序、收纳、外发、复制、派生类操作）
 *   · 空态 `flex flex-col items-center justify-center py-10` + `text-xs text-muted-foreground/50`（`conversation.noHistory`）
 *
 * 本轮补齐的 3 处缺口（官方偏移见各段注释）：
 *   · **legacy 分组**（`_` 折叠头 @2483862 / `y` 加载行 @2484146 / `g.map` 行 @2484600 / `S` 加载更多 @2485660）
 *   · **只读徽标**（`readOnlyLabel` @2484927 legacy 行、@2480578 顶置行）
 *   · **分页**（哨兵 `<div ref={k} className="h-px w-full"/>` + `threshold:.1` @2478431；`pageSize=Yx=20` @457058）
 *
 * ⚠️ 与官方的已知差异（均记账）：
 *   1. 官方时间戳走内部相对时间格式器（`common.relativeTime.justNow` + 相对串，未能在产物里定位到完整词表），
 *      这里用 `Intl.RelativeTimeFormat` 生成同语义的相对时间 + 官方「刚刚」文案；如需逐字对齐需再取证。
 *   2. 官方两条 aria-label 是**硬编码英文**（`"rename conversation"` / `"delete conversation"`，官方自身的 i18n 缺口）；
 *      这里改用仓库既有 i18n 键，避免为对齐而引入 a11y 退化。
 *   3. 官方 legacy 行里 `He && Q?.trim()` 的**重命名中**分支在官方 UI 里不可达（legacy 行没有重命名触发键），
 *      这里只渲染官方 non-renaming 分支 `text-foreground/80 group-hover/item:text-foreground/95`。
 *   4. IntersectionObserver 官方**不做存在性判断**（`new IntersectionObserver` 直接构造）；
 *      jsdom 下没有该 API ⇒ 这里加了 `typeof IntersectionObserver === 'undefined'` 守卫（唯一的行为性偏差）。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import type { ChatConversation } from '../../types/chat';
import { useT } from '../../i18n';
import {
  CONVERSATION_MENU_OFFSET,
  CONVERSATION_MENU_WIDTH,
  CONVERSATION_SCROLL_THRESHOLD,
  CONVERSATION_SENTINEL_CLASS,
  formatConversationRelativeTime,
  paginateConversations,
  partitionConversations,
} from './conversationMenuSpec';
import {
  OfficialChevronDownIcon,
  OfficialHistoryIcon,
  OfficialTablerChevronRightIcon,
  OfficialTablerEyeIcon,
  OfficialTablerPencilIcon,
  OfficialTablerPlusIcon,
  OfficialTablerTrashIcon,
} from './officialIcons';
import { OfficialTablerLoaderIcon } from './conversationSidebarIcons';

export interface ConversationMenuProps {
  anchorRef: RefObject<HTMLElement | null>;
  /** 全量会话（含 legacy / `archived`）；组件内部按官方两条数据路分桶 + 分页。 */
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  /** 官方两个触发器的对齐：标题下拉 `align: "start"`，聊天记录图标 `align: "end"`。 */
  align?: 'start' | 'end';
  /** 官方 `oe`（加载态）：为真时渲染 4 行骨架；为假且列表为空时渲染官方**空态**（图标 + 文案）。 */
  isLoading?: boolean;
  /** 官方 `V`（`isFetchingNextPage`）：普通列表正在取下一页 ⇒ 哨兵下方转圈。 */
  isFetchingNextPage?: boolean;
  /** 官方 `y`（legacyLoading）：legacy 分组正在加载 ⇒ 加载行（`eo` + `conversation.loading`）。 */
  isLegacyLoading?: boolean;
  /** 官方 `T`（loadingMore）：legacy「加载更多」按钮的内联转圈 + `disabled`。 */
  isLoadingMoreLegacy?: boolean;
  /** 官方 legacy 行的选择回调 `e(ve.id,{isLegacy:!0})`（只读会话，需按 legacy 语义装载）。 */
  onSelectLegacy?: (id: string) => void;
}

/** 官方语义的相对时间：<1 分钟用「刚刚」，其余用平台相对时间格式器（见 conversationMenuSpec.ts）。 */

export default function ConversationMenu({
  anchorRef,
  conversations,
  activeConversationId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClose,
  align = 'start',
  isLoading = false,
  isFetchingNextPage = false,
  isLegacyLoading = false,
  isLoadingMoreLegacy = false,
  onSelectLegacy,
}: ConversationMenuProps) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** 官方 `k`：普通列表无限滚动哨兵。 */
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  /** 官方 `w`（legacy page）与普通列表 page：起点都是 1，每页 `Yx=20`。 */
  const [page, setPage] = useState(1);
  const [legacyPage, setLegacyPage] = useState(1);
  /** 官方 `_`（legacyExpanded）初始 `!1` —— **默认收起**。 */
  const [legacyExpanded, setLegacyExpanded] = useState(false);

  /** 官方两条数据路：`re`（普通）与 `g`（legacy）。 */
  const { active: activeConversations, legacy: legacyConversations } = partitionConversations(conversations);
  const { items: visibleConversations, hasNextPage } = paginateConversations(activeConversations, page);
  const {
    items: visibleLegacyConversations,
    hasNextPage: hasMoreLegacy,
  } = paginateConversations(legacyConversations, legacyPage);

  const loadNextPage = useCallback(() => { setPage((current) => current + 1); }, []);
  const loadMoreLegacy = useCallback(() => { setLegacyPage((current) => current + 1); }, []);

  /* 官方 Radix：side=bottom、align=start|end、sideOffset=8；这里按触发元素矩形定位并夹进视口。 */
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const preferredLeft = align === 'end' ? rect.right - CONVERSATION_MENU_WIDTH : rect.left;
    const left = Math.min(
      Math.max(8, preferredLeft),
      Math.max(8, window.innerWidth - CONVERSATION_MENU_WIDTH - 8),
    );
    const top = Math.min(rect.bottom + CONVERSATION_MENU_OFFSET, Math.max(8, window.innerHeight - 120));
    setPosition({ top, left });
  }, [align, anchorRef]);

  /* 官方 Radix DropdownMenu 自带「点外部关闭 / Esc 关闭」。 */
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (renamingId) {
        /* 官方：重命名中按 Esc 只取消重命名，不关菜单 */
        event.preventDefault();
        setRenamingId(null);
        return;
      }
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [anchorRef, onClose, renamingId]);

  useEffect(() => {
    if (renamingId) inputRef.current?.focus();
  }, [renamingId]);

  /* 官方 `a.useEffect(()=>{const ve=new IntersectionObserver(me=>{me[0].isIntersecting&&H&&!oe&&!V&&$()},{threshold:.1});
     return k.current&&ve.observe(k.current),()=>ve.disconnect()},[$,H,V,oe])` @2478431
     —— 阈值逐字 `.1`；回调里的 4 个条件逐字（哨兵可见 + 有下一页 + 非首屏加载 + 非取下一页中）。 */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      /* 官方写成一个 `&&` 串；这里展开成早退，语义逐字相同（lint 禁止裸表达式）。 */
      if (!entries[0].isIntersecting || !hasNextPage || isLoading || isFetchingNextPage) return;
      loadNextPage();
    }, { threshold: CONVERSATION_SCROLL_THRESHOLD });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadNextPage, hasNextPage, isFetchingNextPage, isLoading]);

  const startRename = useCallback((conversation: ChatConversation) => {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title ?? '');
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const next = renameValue.trim();
    if (next) onRename(renamingId, next);
    setRenamingId(null);
  }, [onRename, renameValue, renamingId]);

  if (typeof document === 'undefined') return null;

  const relativeLocale = typeof document !== 'undefined'
    ? document.documentElement.lang || 'zh-CN'
    : 'zh-CN';

  const hasRows = visibleConversations.length > 0 || legacyConversations.length > 0 || isLegacyLoading;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={t('聊天记录')}
      className="chat-conversation-menu c-conv-menu fixed w-72 p-1.5 rounded-xl"
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        zIndex: 50,
        background: 'var(--popover-bg, #262626)',
        border: '1px solid var(--c-border)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {/* 官方「新建对话」行（`conversation.addNewChat`） */}
      <button
        type="button"
        role="menuitem"
        onClick={() => { onNew(); onClose(); }}
        className="flex w-full items-center gap-2 px-2.5 py-2 mb-0.5 cursor-pointer rounded-lg hover:bg-white/[0.06] focus:bg-white/[0.06] text-left"
      >
        <OfficialTablerPlusIcon size={16} strokeWidth={1.5} className="shrink-0 text-foreground/70" />
        <span className="text-[13px] font-medium text-foreground/90">{t('新建对话')}</span>
      </button>

      <div className="max-h-[400px] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {isLoading ? (
          /* 官方**加载态**（`oe = loading || (… && list.length===0)`）逐字：
             `p-2 space-y-1.5` 里 4 行 `flex items-center justify-between rounded-lg px-3 py-2.5`，
             每行两条 `animate-pulse` 灰条（`h-3.5 w-[60%] bg-foreground/15` / `h-3 w-12 bg-foreground/10`）。 */
          <div className="p-2 space-y-1.5">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center justify-between rounded-lg px-3 py-2.5">
                <div className="h-3.5 w-[60%] rounded bg-foreground/15 animate-pulse" />
                <div className="h-3 w-12 rounded bg-foreground/10 animate-pulse" />
              </div>
            ))}
          </div>
        ) : !hasRows ? (
          /* 官方**空态**逐字：`flex flex-col items-center justify-center py-10` + Tabler `history`
             `w-5 h-5 text-muted-foreground/40 mb-2` + `p.text-xs text-muted-foreground/50`（`conversation.noHistory`）。 */
          <div className="flex flex-col items-center justify-center py-10">
            <OfficialHistoryIcon className="w-5 h-5 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground/50">{t('暂无历史记录')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* 官方 `re.map(...)` —— 普通会话行 */}
            {visibleConversations.map((conversation) => {
              const isCurrent = conversation.id === activeConversationId;
              const renaming = renamingId === conversation.id;
              const title = conversation.title?.trim() || t('未命名对话');
              const stamp = conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt;
              return (
                <div
                  key={conversation.id}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => { if (!renaming) { onSelect(conversation.id); onClose(); } }}
                  onKeyDown={(event) => {
                    if (renaming) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(conversation.id);
                      onClose();
                    }
                  }}
                  className={`group/item flex items-center gap-2 px-2.5 py-2 rounded-lg ${renaming ? 'bg-white/[0.06]' : 'cursor-pointer hover:bg-white/[0.06] focus:bg-white/[0.06]'}`}
                >
                  {renaming ? (
                    <input
                      ref={inputRef}
                      value={renameValue}
                      maxLength={100}
                      aria-label={t('重命名')}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
                        if (event.key === 'Escape') { event.preventDefault(); setRenamingId(null); }
                      }}
                      className="min-w-0 h-6 flex-1 bg-transparent p-0 text-[13px] font-normal text-foreground/95 outline-none border-none"
                    />
                  ) : (
                    <>
                      <span
                        className={`min-w-0 flex-1 text-[13px] font-normal truncate ${isCurrent ? 'text-foreground/95' : 'text-foreground/80 group-hover/item:text-foreground/95'}`}
                      >
                        {title}
                      </span>
                      <span className="shrink-0 inline-flex h-6 items-center text-[11px] text-muted-foreground/50 tabular-nums group-hover/item:hidden">
                        {formatConversationRelativeTime(stamp, relativeLocale, t('刚刚'))}
                      </span>
                    </>
                  )}

                  <span className={`shrink-0 items-center ${renaming ? 'flex' : 'hidden group-hover/item:flex'}`}>
                    <button
                      type="button"
                      aria-label={t('重命名')}
                      title={t('重命名')}
                      onClick={(event) => { event.stopPropagation(); startRename(conversation); }}
                      className="size-6 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-chat-foreground hover:bg-white/[0.12] transition-colors"
                    >
                      {/* 官方 `s.jsx(Fp,{size:13})` —— **不带 strokeWidth** ⇒ Tabler 默认 2。
                          第 58 轮用户实测「图标大小都不一样」：MTV 此前写死 `strokeWidth={1.5}`，
                          同样 13px 下笔画更细 ⇒ 看起来更小更暗。 */}
                      <OfficialTablerPencilIcon size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('删除')}
                      title={t('删除')}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(conversation.id);
                      }}
                      className="size-6 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <OfficialTablerTrashIcon size={13} />
                    </button>
                  </span>
                </div>
              );
            })}

            {/* 官方 `re.length>0&&s.jsxs(s.Fragment,{children:[s.jsx("div",{ref:k,className:"h-px w-full"}),
                V&&s.jsx("div",{className:"flex items-center justify-center py-2",children:s.jsx(eo,{className:"w-3.5 h-3.5 animate-spin text-muted-foreground/50"})})]})` @2483283 */}
            {visibleConversations.length > 0 && (
              <>
                <div ref={sentinelRef} className={CONVERSATION_SENTINEL_CLASS} />
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-2">
                    <OfficialTablerLoaderIcon className="w-3.5 h-3.5 animate-spin text-muted-foreground/50" />
                  </div>
                )}
              </>
            )}

            {/* 官方 legacy 区块 `(g.length>0||y)&&s.jsxs("div",{children:[折叠头, _&&<>加载行|列表 + S&&加载更多</>]})` */}
            {(legacyConversations.length > 0 || isLegacyLoading) && (
              <div>
                <button
                  type="button"
                  onClick={() => setLegacyExpanded((value) => !value)}
                  className="flex w-full items-center gap-1.5 px-2.5 py-2 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider hover:text-muted-foreground/80 cursor-pointer rounded-md hover:bg-white/[0.04]"
                >
                  {legacyExpanded
                    ? <OfficialChevronDownIcon className="w-3.5 h-3.5 shrink-0" />
                    : <OfficialTablerChevronRightIcon className="w-3.5 h-3.5 shrink-0" />}
                  {t('历史对话（仅可查看）')}
                </button>

                {legacyExpanded && (
                  <>
                    {isLegacyLoading ? (
                      /* 官方加载行 @2484146：`px-2.5 py-2 flex items-center gap-2 text-muted-foreground/50` */
                      <div className="px-2.5 py-2 flex items-center gap-2 text-muted-foreground/50">
                        <OfficialTablerLoaderIcon className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span className="text-xs">{t('加载对话中...')}</span>
                      </div>
                    ) : (
                      visibleLegacyConversations.map((conversation) => (
                        <div
                          key={`legacy-${conversation.id}`}
                          role="menuitem"
                          tabIndex={0}
                          onClick={() => { (onSelectLegacy ?? onSelect)(conversation.id); onClose(); }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              (onSelectLegacy ?? onSelect)(conversation.id);
                              onClose();
                            }
                          }}
                          className="group/item flex items-center gap-2 px-2.5 py-2 cursor-pointer rounded-lg hover:bg-white/[0.06] focus:bg-white/[0.06]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-[13px] font-normal truncate text-foreground/80 group-hover/item:text-foreground/95"
                              >
                                {conversation.title?.trim() || t('未命名对话')}
                              </span>
                              {/* 官方**只读徽标**：纯文本 span，没有 pill / 背景色 / 边框 */}
                              <span className="shrink-0 text-[10px] text-muted-foreground/50">
                                {t('仅可查看')}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground/50 tabular-nums">
                              {formatConversationRelativeTime(
                                conversation.updatedAt ?? conversation.createdAt,
                                relativeLocale,
                                t('刚刚'),
                              )}
                            </div>
                          </div>
                          <OfficialTablerEyeIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />
                        </div>
                      ))
                    )}

                    {/* 官方 `S&&s.jsx("div",{className:"px-2.5 py-2",children:s.jsxs("button",{type:"button",onClick:K,disabled:T,className:"w-full py-2 …",children:[T?eo:null,loadMoreLegacy]})})` @2485660 */}
                    {hasMoreLegacy && (
                      <div className="px-2.5 py-2">
                        <button
                          type="button"
                          onClick={loadMoreLegacy}
                          disabled={isLoadingMoreLegacy}
                          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground/80 rounded-lg border border-border/50 hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {isLoadingMoreLegacy
                            ? <OfficialTablerLoaderIcon className="w-3.5 h-3.5 animate-spin" />
                            : null}
                          {t('加载更多')}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
