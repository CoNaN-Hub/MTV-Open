/**
 * 官方 `Ub` 的**子部件**（逐字移植）—— live `vendor-pkg-canvas-ChpWx5JY.js`。
 *
 * | 官方符号 | 偏移 | 本文件 | 逐字 class |
 * | --- | --- | --- | --- |
 * | `Xp` | 262247 | `MentionSectionHeader` | `flex items-center justify-between gap-2 px-1 py-1` / `text-xs font-medium leading-[1.3] text-white/40 tracking-[0.48px]` / `text-[11px] font-normal leading-[1.3] tracking-normal text-white/30` |
 * | `Cu` | 263761 | `MentionSeparator` | `shrink-0` + `style={{height:"0.5px", backgroundColor:"rgba(255,255,255,0.16)"}}` |
 * | `Su` | 263868 | `MentionHintRow` | `cx(LP, "gap-[6px] text-[12px] text-[rgba(255,255,255,0.4)]", selected && "bg-white/10")` |
 * | `Ak` | 259971 | `MentionFolderRow` | `cx("group/asset-folder", LP, selected && "bg-white/10")` |
 * | `rC` | 260537 | `MentionHighlight` | 命中片段 `text-white/90` |
 * | `U3` | 263306 | `MentionSkeleton` | `flex w-full flex-col gap-[2px]` + `cx(LP,"pointer-events-none")` + 三条灰块 |
 *
 * ⚠️ 官方这些部件里的图标是**自绘 SVG**（`A6`/`E6` 48 视框媒体占位、`KM` 12 视框、`jk` 14 视框、
 * `Yl`/`Dp` 行内箭头），逐个字节抽取尚未做 ⇒ 本文件把图标做成 **prop 注入**，
 * 默认不渲染图标；一旦图标抽取完成，直接传入即可，class 契约不变。
 */
import { memo, type ReactNode } from 'react';

/** 官方 `LP`(`Qa`)：行基类。 */
export const MENTION_ROW_CLASS = 'flex items-center gap-[8px] w-full px-[8px] py-[6px] text-left transition-colors rounded-[6px] cursor-pointer hover:bg-white/10';
/** 官方 `jP`(`hc`)：选中态。 */
export const MENTION_ROW_SELECTED_CLASS = 'bg-white/10';

/** 官方 `Xp` = 分组标题行。 */
export const MentionSectionHeader = memo(function MentionSectionHeader({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-1">
      <p className="text-xs font-medium leading-[1.3] text-white/40 tracking-[0.48px]">{children}</p>
      {hint ? (
        <span className="shrink-0 text-[11px] font-normal leading-[1.3] tracking-normal text-white/30">{hint}</span>
      ) : null}
    </div>
  );
});

/** 官方 `Cu` = 0.5px 分隔线。 */
export const MentionSeparator = memo(function MentionSeparator() {
  return (
    <div
      className="shrink-0"
      style={{ height: '0.5px', backgroundColor: 'rgba(255,255,255,0.16)' }}
    />
  );
});

/** 官方 `Su` = 提示/动作行（`data-selectable-index` 可被键盘选中）。 */
export const MentionHintRow = memo(function MentionHintRow({
  index,
  isSelected,
  onClick,
  leadingIcon,
  children,
}: {
  index?: number;
  isSelected?: boolean;
  onClick?: () => void;
  leadingIcon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-selectable-index={index}
      className={`${MENTION_ROW_CLASS} gap-[6px] text-[12px] text-[rgba(255,255,255,0.4)]${isSelected ? ` ${MENTION_ROW_SELECTED_CLASS}` : ''}`}
      onClick={onClick}
    >
      {leadingIcon}
      <span>{children}</span>
    </button>
  );
});

/** 官方 `Ak` = 资产文件夹行。 */
export const MentionFolderRow = memo(function MentionFolderRow({
  displayName,
  globalIndex,
  isSelected,
  onClick,
  thumbnail,
  trailingIcon,
}: {
  displayName: string;
  globalIndex: number;
  isSelected?: boolean;
  onClick?: () => void;
  /** 官方 `ZN`（缩略图）；MTV 侧未移植 ⇒ 可由调用方注入。 */
  thumbnail?: ReactNode;
  trailingIcon?: ReactNode;
}) {
  return (
    <button
      type="button"
      data-selectable-index={globalIndex >= 0 ? globalIndex : undefined}
      className={`group/asset-folder ${MENTION_ROW_CLASS}${isSelected ? ` ${MENTION_ROW_SELECTED_CLASS}` : ''}`}
      onClick={onClick}
    >
      {thumbnail}
      <span className="flex-1 min-w-0 text-sm font-medium leading-5 text-white/90 truncate">{displayName}</span>
      <span className="shrink-0 text-white/30" aria-hidden>{trailingIcon}</span>
    </button>
  );
});

/** 官方 `rC` = 关键词高亮。 */
export const MentionHighlight = memo(function MentionHighlight({
  text,
  keyword,
}: {
  text: string;
  keyword?: string;
}) {
  if (!keyword) return <>{text}</>;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, index) => (
        part.toLowerCase() === keyword.toLowerCase()
          ? <span className="text-white/90" key={index}>{part}</span>
          : <span key={index}>{part}</span>
      ))}
    </>
  );
});

/** 官方 `U3` = 加载骨架（`count` 行）。官方占位块用 `$n`（骨架/微光件，其自身类串未挖到）⇒ 由调用方注入。 */
export const MentionSkeleton = memo(function MentionSkeleton({
  count,
  renderBlock,
}: {
  count: number;
  renderBlock?: (className: string, key: string) => ReactNode;
}) {
  const block = (className: string, key: string) => (
    renderBlock ? renderBlock(className, key) : <div className={className} key={key} />
  );
  return (
    <div className="flex w-full flex-col gap-[2px]">
      {Array.from({ length: count }, (_, index) => (
        <div className={`${MENTION_ROW_CLASS} pointer-events-none`} key={index}>
          {block('size-6 shrink-0 rounded-[4px]', `t${index}`)}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {block('h-[14px] w-3/4 rounded', `a${index}`)}
            {block('h-[10px] w-1/2 rounded', `b${index}`)}
          </div>
          {block('size-[14px] shrink-0 rounded', `c${index}`)}
        </div>
      ))}
    </div>
  );
});
