/**
 * MentionPicker — @ 选中器的公用外观：分段 Tab + 筛选芯片 + 图片卡片网格。
 *
 * 纯展示组件：数据来源、过滤和「选中后往编辑器里插什么」都留在调用方
 * （MentionEditor 用于节点提示词，ChatInput 用于聊天）。
 * 卡片走 onMouseDown + preventDefault，避免抢走 contenteditable 的光标。
 */
import { Icon } from '@iconify/react';
import { Fragment, useState, type ReactNode } from 'react';
import type { CharacterCropRect } from '../../types/dramaAssets';

export interface MentionPickerTab {
  id: string;
  label: string;
  icon?: string;
}

export interface MentionPickerChip {
  id: string;
  label: string;
  count?: number;
}

export interface MentionPickerItem {
  key: string;
  label: string;
  thumbnailUrl?: string;
  /** 复用角色头像的归一化裁剪参数。 */
  thumbnailCrop?: CharacterCropRect;
  /** 无缩略图时的占位图标（iconify 名） */
  icon?: string;
  /** 缩略图右上角小标，如 #3 / 自身 / 视频 */
  badge?: string;
  disabled?: boolean;
  audioPreviewUrl?: string;
  title?: string;
  /** 供 aria-activedescendant 引用；不需要键盘导航时可省略 */
  domId?: string;
  onSelect: () => void;
}

/** 官方 `ffe` 的分组（linked / assets / elements…）：一个滚动列表里的多段，每段默认 3 条 + 「显示更多」 */
export interface MentionPickerGroup {
  id: string;
  /** 段标题。官方那行是 `children: label || C("omniReference.suggestion.linkedNodeSection")`
   *  （r127 `vendor-pkg-canvas-Dp0xADoD.js` @257958）= **宿主给了 `linkedSectionLabel` 就用宿主的**：
   *  聊天输入区传的是 `chatAdapter.context.addReference`（zh「添加参考」，r127 @2578264），
   *  不传 label 的宿主才落回 `linkedNodeSection`「已连接节点」。 */
  label: string;
  /** 官方 `hint`（如 `omniReference.suggestion.linkedNodeShortcutHint` =「输入序号快选」） */
  hint?: string;
  items: MentionPickerItem[];
}

/* ══ 官方 zh-CN 文案（`index-BiTZf8mJ.js` @9128275 的 `omniReference.suggestion.*`）══
   `noResults:"暂无结果"` · `showMoreResults:"还有 {{count}} 个结果"` ·
   `linkedNodeSection:"已连接节点"` · `linkedNodeShortcutHint:"输入序号快选"` ·
   `myLibrarySection:"我的素材库"` · `pluginSection:"应用"` · `privateSection:"个人素材库"` */
export const MENTION_NO_RESULTS = '暂无结果';
export const MENTION_SHOW_MORE = (count: number) => `还有 ${count} 个结果`;
export const MENTION_LINKED_SECTION = '已连接节点';
export const MENTION_LINKED_HINT = '输入序号快选';
/** ⚠️ 官方 `Ub` 的**素材库段不渲染这个键**：那段用的是 `privateSection`「个人素材库」/ `teamSection`「团队素材库」
 *  （规格书 `_r124-official-mention-popup-spec.md` §4 注：`myLibrarySection` 出现但不在此渲染里 ⇒ 未取证用在何处）。
 *  MTV **不用它**（两处素材库段都改走 `MENTION_PRIVATE_SECTION`）；保留只为文案表完整，勿在新调用点使用。 */
export const MENTION_MY_LIBRARY = '我的素材库';
/** 官方 `omniReference.suggestion.privateSection` =「个人素材库」——**素材库段**用的那个键
 *  （规格书 §4 #6；r127/r100 的 i18n 表中 `privateSection:"个人素材库"`）。
 *  ⚠️ MTV 的短剧资产（人物/场景/道具）没有个人/团队之分（= 用户自己的库，无 `teamSection`）
 *  ⇒ 两个界面（聊天 `@` 面板、节点提示词 `MentionEditor`）对**同一份数据**必须用**同一个键**，不许各写各的。 */
export const MENTION_PRIVATE_SECTION = '个人素材库';
export const MENTION_PLUGIN_SECTION = '应用';

/** 官方模式下调用方不传 Tab（`ffe` 里没有这一行） */
const NO_TABS: MentionPickerTab[] = [];

interface MentionPickerProps {  /** ★ 官方口径：给**分组**就别再给 Tab（官方没有 Tab/芯片行，来源以分组呈现） */
  tabs?: MentionPickerTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  chips?: MentionPickerChip[];
  activeChip?: string;
  onChipChange?: (id: string) => void;
  items: MentionPickerItem[];
  /** ★ 官方口径：给**分组**就别再给 Tab（官方没有 Tab/芯片行，来源以分组呈现） */
  groups?: MentionPickerGroup[];
  /** ★ 模型口（`chat-open-reference-menu` 触发）专用：行样式取**官方模型菜单行**，
   *  与官方 `@` 面板行（`ffe` 的 `Ta`）**本来就不是同一套** ⇒ 加 `mention-row--model-menu`
   *  修饰类拆开（官方依据与逐字类名见 `mention-picker.css` 那段注释）。
   *  ⚠️ 只有模型口传它；`@` 面板（`groups` 通道）与 HelpMentionDemo 保持原样。 */
  modelMenu?: boolean;
  /** 键盘高亮项的 key */
  activeKey?: string;
  /** 鼠标移入某项时同步高亮 */
  onItemHover?: (key: string) => void;
  emptyText?: string;
  /** 芯片行左侧插槽（返回按钮等）；无芯片时单独成行 */
  leading?: ReactNode;
  footer?: ReactNode;
  listId?: string;
  ariaLabel?: string;
  className?: string;
  mediaAspectRatio?: number;
  /** 官方顶部搜索行（`ffe` 自带）；传 false 可关掉 */
  searchable?: boolean;
  searchPlaceholder?: string;
}

/* ══ 官方顶部搜索行（`use-waveform-data-DMduQqB-.js` 里 `ffe` 的第一行，9444 实测 outerHTML 逐字）══
   `<div class="flex h-[32px] w-full items-center gap-[6px] border-white/[0.08] min-w-[48px]
               self-stretch rounded-[12px] border-0 bg-accent px-3 py-1.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round"
           class="tabler-icon tabler-icon-search shrink-0 text-white/40">
        <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/>
        <path d="M21 21l-6 -6"/>
      </svg>
      <input type="text" placeholder="搜索" class="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px]
             leading-[18px] text-white/80 outline-none placeholder:text-white/30"
             autocomplete="off" spellcheck="false">
    </div>
   实测：行 bg **rgb(64,64,64)**（= 官方 `--accent: #404040`）· 圆角 12px · padding 6px 12px · gap 6px · 高 32px
        · 图标 14px `white/40` · 输入 13px/18px `white/80` · 占位符 `搜索` `white/30`
   ⚠️ 官方在弹窗里**不抢焦点**（实测 `document.activeElement` 始终是 ProseMirror，敲 `@a` 落在编辑器里），
      这个输入框只是可用鼠标点开的第二层筛选 ⇒ MTV 保持同样语义：独立 `searchQuery` 叠加过滤，不改编辑器内容。 */
const MENTION_SEARCH_ICON = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mention-search__icon"
    aria-hidden="true"
  >
    <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
    <path d="M21 21l-6 -6" />
  </svg>
);

export default function MentionPicker({
  tabs = NO_TABS,
  activeTab,
  onTabChange,
  chips,
  activeChip,
  onChipChange,
  items,
  groups,
  modelMenu = false,
  activeKey,
  onItemHover,
  emptyText = MENTION_NO_RESULTS,
  leading,
  footer,
  listId,
  ariaLabel,
  className = '',
  searchable = true,
  searchPlaceholder = '搜索',
}: MentionPickerProps) {
  /* ★ 官方模式：给了 `groups` 就渲染官方那套「一个滚动列表 + 多分组」，
     此时**不渲染 Tab 行 / 芯片行**（官方 `Ub` 里没有它们）。
     · `@` 触发的宿主（聊天输入卡 `ChatInput`、节点提示词 `MentionEditor`）**都走这条路**；
     · 不给 `groups` 的口（例：聊天的**模型菜单**，由 `chat-open-reference-menu` 触发）保留
       MTV 的 Tab + 芯片行 —— 那条口不是官方 `@` 面板，官方面板里也没有模型段。 */
  const usingGroups = Array.isArray(groups) && groups.length > 0;
  const hasChipRow = !usingGroups && (!!leading || (chips?.length ?? 0) > 0);
  /* 官方顶部搜索行：**独立**筛选（官方实测不抢编辑器焦点），点进去输入即在现有 candidate 上再过滤 */
  const [searchQuery, setSearchQuery] = useState('');
  const needle = searchQuery.trim().toLocaleLowerCase();
  const matchesSearch = (label: string) => !needle || label.toLocaleLowerCase().includes(needle);
  const shownGroups = usingGroups
    ? groups!.map((group) => ({ ...group, items: group.items.filter((item) => matchesSearch(item.label)) }))
      .filter((group) => group.items.length > 0)
    : [];
  const shownItems = usingGroups ? [] : items.filter((item) => matchesSearch(item.label));
  /* 官方：每组默认只列 **3 条**（`Is = 3` @273899），第 4 行是「显示更多」(kind: showMore*) */
  const MENTION_GROUP_LIMIT = 3;
  const [showAll, setShowAll] = useState(false);
  /** 分组模式下**逐组**记「显示更多」（官方也是每组一个 showMore* 项） */
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  /* 切换 Tab/芯片、搜索词或条目数变化时收起「显示更多」（官方 `setShowAllLinked` 的等价初值语义） */
  const groupKey = `${activeTab ?? ''}|${activeChip ?? ''}|${needle}|${items.length}|${groups?.map((g) => g.items.length).join(',') ?? ''}`;
  const [lastGroupKey, setLastGroupKey] = useState(groupKey);
  if (lastGroupKey !== groupKey) {
    setLastGroupKey(groupKey);
    setShowAll(false);
    setExpandedGroups({});
  }
  /* 分组模式下：所有分组的可见条目拼成一条键盘可选列表（官方 `selectables` 也是全局拍平的） */
  const flatGroupItems = usingGroups
    ? shownGroups.flatMap((g) => (expandedGroups[g.id] ? g.items : g.items.slice(0, MENTION_GROUP_LIMIT)))
    : shownItems;
  const visibleItems = showAll ? shownItems : shownItems.slice(0, MENTION_GROUP_LIMIT);
  /* 官方 `ffe` 默认 `selectedIndex = 0`（`useEffect(() => { e && u(0) }, [e])`）⇒
     父级没给 `activeKey` 时，首行也要**默认高亮**（否则方向键/回车没有落点 ✗） */
  const highlightedKey = activeKey ?? flatGroupItems[0]?.key ?? null;

  /* 行渲染 —— 官方 linked 行（zoom-slider @293064 逐字）：
       `Z(Ta, selected && Rc)` = `flex items-center gap-[8px] w-full px-[8px] py-[6px] text-left
                                  transition-colors rounded-[6px] cursor-pointer hover:bg-white/10`
       子元素顺序（官方就是**这个顺序**）：
         ① `CN` 缩略图框（`Mc` = `flex size-6 … rounded-[4px] border border-white/10 bg-white/5 …`）
         ② `span.flex-1 min-w-0 flex items-center gap-1` → 标签 `text-sm font-medium leading-5 text-white/90 truncate`
         ③ `#序号`（`min-w-[22px] shrink-0 text-right text-[11px] font-medium leading-4 tabular-nums
                    text-white/30` → 选中 `text-white/60`，`aria-hidden`）
         ④ `SN` 类型徽标（14px `text-[rgba(255,255,255,0.3)]`）
       ⚠️ MTV 旧版把 `#序号` 放在**最前面**、且没有缩略图框 ⇒ 已按官方改正（序号在标签**之后**）。

      ★★ 模型口（`modelMenu`）**不是这一套** —— 官方模型菜单行是另一个组件的另一套解剖
      （r127 `vendor-pkg-canvas-Dp0xADoD.js` @2264752 起逐字）：
        row   : `relative flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs`
                + `b && "min-h-10 rounded-xl px-3 py-2"`
        left  : `<span className="flex min-w-0 items-center gap-1.5">`
                  + `b && _.icon && <img src={_.icon} className="h-4 w-4 shrink-0 rounded-sm"/>`   ← **官方模型行有图标**
                  + `<span className="truncate">{_.label}</span>`
        right : `_.disabled ? <lock size=14/> : isSelected ? <check size=14/> : null`
      ⇒ 官方模型行 **没有 24px 缩略图框**（那是 `@` 面板行的 `CN`/`Mc`）、**没有 `#序号`**
        （那是官方「已连接节点」段专有的位次号）、**没有行尾类型徽标**（右侧只有 lock/check）
        ⇒ 模型口这三个元素一律不渲染（几何/底色/圆角取值见 `styles/mention-picker.css` 的
        `.mention-row--model-menu` 那段，逐条带官方偏移）。 */
  const renderRow = (item: MentionPickerItem, index: number, showIndex = true) => (
    <button
      key={item.key}
      id={item.domId}
      type="button"
      role="option"
      aria-selected={item.key === highlightedKey}
      disabled={item.disabled}
      data-selectable-index={index}
      className={`mention-row${modelMenu ? ' mention-row--model-menu' : ''}${item.key === highlightedKey ? ' is-active' : ''}${item.disabled ? ' is-disabled' : ''}`}
      onMouseEnter={() => onItemHover?.(item.key)}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!item.disabled) item.onSelect();
      }}
    >
      {modelMenu ? (
        <>
          {/* 官方模型行左槽：`flex min-w-0 items-center gap-1.5` = 16px 图标 + `truncate` 标签 */}
          <span className="mention-row-model-main">
            {item.icon && <Icon icon={item.icon} width="16" height="16" className="mention-row-model-icon" />}
            <span className="mention-row-model-label">{item.label}</span>
          </span>
          {/* 右侧槽：官方此处是 lock(禁用) / check(选中)。MTV 的模型口要给出**媒体类型/未配置**
              这档自有信息（官方模型菜单没有这段文案，但也没有可替换的官方文案）
              ⇒ 保留为右侧文字槽（`justify-between` 的第二个 child），不臆造 lock/check。 */}
          {item.badge != null && <span className="mention-row-model-badge">{String(item.badge)}</span>}
        </>
      ) : (
        <>
          {/* ① 官方 `CN` 缩略图框：有图给图，没图给类型图标（`Am` = `size-3 text-white/60` = 12px） */}
          <span className="mention-row-thumb">
            {item.thumbnailUrl
              ? <img src={item.thumbnailUrl} alt="" className="mention-row-thumb-img" draggable={false} />
              : <Icon icon={item.icon || 'mdi:vector-square'} width="12" height="12" className="mention-row-thumb-icon" />}
          </span>
          <span className="mention-row-label">{item.label}</span>
          {/* ③ 官方行尾序号 `#{rt}`（`zoom-slider` @294095：`{rt && <span className="min-w-[22px] …">#{rt}</span>}`）
              官方那个 `rt` 来自 `se = new Map(linked.map((v,i)=>[v.id,i+1]))` = **该条目在已连接列表里的 1-based 位次**，
              而且**只有「已连接节点」这一组**有号（其它组官方不给）⇒ 这里用行位次渲染、按 `showIndex` 开关 ✓
              （用户：「输入序号快选 的序号 也不对」——原来给的是节点的 `displayId` `#13/#17/#45` ✗） */}
          {item.badge != null ? (
            <span className="mention-row-index" aria-hidden="true">
              {String(item.badge)}
            </span>
          ) : showIndex ? (
            <span className="mention-row-index" aria-hidden="true">{`#${index + 1}`}</span>
          ) : null}
          <span className="mention-row-type" aria-hidden="true">
            <Icon icon={item.icon || 'mdi:vector-square'} width="14" height="14" />
          </span>
        </>
      )}
    </button>
  );

  return (
    <div className={`mention-picker${modelMenu ? ' mention-picker--model-menu' : ''} ${className}`}>
      {/* 官方 `ffe` 第一行 = 搜索行（有它，且**在**列表上方；官方没有 Tab/芯片行） */}
      {searchable && (
        <div className="mention-search">
          {MENTION_SEARCH_ICON}
          <input
            type="text"
            className="mention-search__input"
            placeholder={searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={searchPlaceholder}
          />
        </div>
      )}

      {/* 分类 Tab 行 —— ⚠️ 官方 `Ub` 里没有这一行，官方是「搜索行 + 分区列表」；
          `@` 触发的宿主已全部改走官方 `groups`（`ChatInput` / `MentionEditor`），
          这一行只剩非官方的口（聊天的模型菜单）。 */}
      {!usingGroups && tabs.length > 1 && (
        <div className="mention-picker-tabs" role="tablist" aria-label={ariaLabel}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === activeTab}
              className={`mention-picker-tab${tab.id === activeTab ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); onTabChange?.(tab.id); }}
            >
              {tab.icon && <Icon icon={tab.icon} width="14" height="14" />}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {hasChipRow && (
        <div className="mention-picker-chips">
          {leading}
          {chips?.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`mention-picker-chip${chip.id === activeChip ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); onChipChange?.(chip.id); }}
            >
              {chip.label}
              {chip.count != null && <span className="mention-picker-chip-count">{chip.count}</span>}
            </button>
          ))}
        </div>
      )}

      {/* ══ 官方 `ffe` 的列表结构（zoom-slider @275698 附近逐字）══
           · 面板：`Z(aL, "flex flex-col w-[320px]", "h-[320px]" | "max-h-[320px]")`
           · 内层：`cw = "flex min-h-0 flex-1 flex-col gap-2 p-2"`
           · 滚动：`vN = "flex min-h-0 flex-1 w-full min-w-0 flex-col items-stretch overflow-y-auto pb-1"` + 隐藏滚动条
           · 每组默认 **3 条**（`Is = 3` @273899）+ 第 4 行「显示更多」（`du`：`gap-[6px] text-[12px] text-[rgba(255,255,255,0.4)]` + chevron 14px）
           · 行（linked）：`#序号`(min-w-[22px] 11px tabular-nums white/30 → 选中 white/60) + 标签(14px medium leading-5 white/90 truncate) + 类型徽标(14px white/30)
           · 空态：`px-1 py-3 text-[14px] text-[rgba(255,255,255,0.4)]`（`omniReference.suggestion.noResults`）
           ⚠️ MTV 原来：大卡片网格 + 每行试听按钮（都是 MTV 自造 ✗）⇒ 按官方换成行式列表并去掉试听按钮 */}
      <div className="mention-scroll" id={listId} role="listbox" aria-label={ariaLabel}>
        {usingGroups ? (
          shownGroups.length === 0 ? (
            <div className="mention-row-empty">{emptyText}</div>
          ) : (
            shownGroups.map((group, groupIndex) => {
              const expanded = Boolean(expandedGroups[group.id]);
              const shown = expanded ? group.items : group.items.slice(0, MENTION_GROUP_LIMIT);
              const hiddenCount = group.items.length - shown.length;
              return (
                <Fragment key={group.id}>
                  {/* 官方 `cu` 分隔线：`<div className="shrink-0" style={{height:'0.5px',backgroundColor:'rgba(255,255,255,0.16)'}}/>`
                      —— 只在**两组之间**渲染（官方 `(Hn&&Oe)&&<cu/>`） */}
                  {groupIndex > 0 && <div className="mention-group-divider" aria-hidden="true" />}
                  {/* 官方每组 = `<div className="flex w-full flex-col gap-[2px]">` 包住「标题 + 行 + 显示更多」 */}
                  <div className="mention-group" data-mention-group={group.id}>
                    {/* 官方 `Ph`（zoom-slider @303351 逐字）：
                         `flex items-center justify-between gap-2 px-1 py-1`
                           · 标题 `<p className="text-xs font-medium leading-[1.3] text-white/40 tracking-[0.48px]">`
                           · `hint` `<span className="shrink-0 text-[11px] font-normal leading-[1.3] tracking-normal text-white/30">` */}
                    <div className="mention-group-header">
                      <p className="mention-group-label">{group.label}</p>
                      {group.hint && <span className="mention-group-hint">{group.hint}</span>}
                    </div>
                    {shown.map((item, index) => renderRow(item, index, group.id === 'nodes'))}
                    {/* 官方 `du`：`Z(Ta, "gap-[6px] text-[12px] text-[rgba(255,255,255,0.4)]", selected && Rc)` + chevron 14px
                        文案 `omniReference.suggestion.showMoreResults` =「还有 {{count}} 个结果」 */}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        className="mention-row mention-row-more"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.id]: true }))}
                      >
                        <Icon icon="lucide:chevron-down" width="14" height="14" />
                        <span>{MENTION_SHOW_MORE(hiddenCount)}</span>
                      </button>
                    )}
                  </div>
                </Fragment>
              );
            })
          )
        ) : shownItems.length === 0 ? (
          <div className="mention-row-empty">{emptyText}</div>
        ) : (
          <>
            {visibleItems.map((item, index) => renderRow(item, index, true))}
            {shownItems.length > MENTION_GROUP_LIMIT && !showAll && (
              <button
                type="button"
                className="mention-row mention-row-more"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowAll(true)}
              >
                <Icon icon="lucide:chevron-down" width="14" height="14" />
                <span>{MENTION_SHOW_MORE(shownItems.length - visibleItems.length)}</span>
              </button>
            )}
          </>
        )}
      </div>

      {footer && <div className="mention-picker-footer">{footer}</div>}
    </div>
  );
}
