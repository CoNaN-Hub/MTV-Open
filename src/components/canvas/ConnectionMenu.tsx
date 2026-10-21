/**
 * ConnectionMenu 连线拖放命令菜单 —— 从节点 Handle 拖到画布空白处弹出。
 *
 * ★ 1:1 对齐官方（`zoom-slider-3ZcFvYQO.js` @2905900 起）：
 *   官方这套菜单**就是双击画布那个菜单的同一个组件**（`uZe`：同一份 `UT` 分组 / `QT` 条目，
 *   组标题 `<div className="text-sm py-1">`、容器 `w-72`(288) + `animate-in zoom-in`），
 *   差别只在「分组内容」和 `menuMode`。MTV 的 `.menu-row / .menu-ico / .menu-lbl / .menu-sub /
 *   .menu-section / .menu-title` 系列就是按官方双击菜单全量实测对齐的那一份 ⇒ **必须复用**，
 *   不能另写一套 Tailwind（此前手写的一套实测 279×52，官方口径是 269×56 ⇒ 用户："全都不一样"）。
 *
 * 组标题：左柄「添加上下文」/ 右柄「引用该节点生成」（官方 `common.newContext` /
 *   `common.generateNewContent`）。
 */
import { Fragment, memo, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { calcFixedPosition } from '../../utils/popupPosition';
import { useT } from '../../i18n';
import type { ConnectionMenuGroup, ConnectionMenuOption } from '../../hooks/useConnectionDropMenu';
import { OfficialIcon } from '../sidebar/OfficialIcon';

interface ConnectionMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  groups: ConnectionMenuGroup[];
  menuRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (option: ConnectionMenuOption) => void;
  /**
   * ★ 官方「选区 `+`」那条路（`page-DPdEgTS0.js` @1437683 逐字）：
   * ```jsx
   * <motion.div className="absolute z-50 -translate-x-1/2" style={{ left: b.x, top: b.y }}
   *   initial={{opacity:0,scale:.9,y:10}} animate={{opacity:1,scale:1,y:0}} …>
   *   <div className="mt-4">{<wme/>}</div>
   * </motion.div>
   * ```
   * `b` 已经由官方 `x$` **按 258×297 + padding 12 + marginTop 16 钳制过** ⇒
   * 这里**不能再走 `calcFixedPosition` 二次钳制** ✗（否则菜单会被再挪一次、和白色贝塞尔曲线对不上）。
   * 语义改成「锚点 = 菜单**水平中心**」(`-translate-x-1/2`) + 菜单本体下移 `mt-4`(16) ✓
   */
  selectionAnchor?: boolean;
}

// 官方实测（与双击菜单同一份规格）：288 宽 · 组标题区 28 · 行 56 · 行间距 4 · 容器 p-1(4)
const MENU_W = 288;
const MENU_SECTION_H = 28;
/** 官方菜单外那层 `mt-4` = 16（视觉结果：**菜单盒顶边 = 锚点 Y + 16**）✓ */
const SELECTION_MENU_OFFSET_Y = 16;
const MENU_ROW_H = 56;
const MENU_ROW_GAP = 4;
const MENU_PAD = 4;

function ConnectionMenu({ visible, position, groups, menuRef, onSelect, selectionAnchor = false }: ConnectionMenuProps) {
  const t = useT();
  const options = useMemo(() => groups.flatMap((group) => group.children), [groups]);
  const sectionCount = groups.filter((group) => group.children.length > 0).length;
  const estimatedHeight =
    MENU_PAD * 2
    + sectionCount * MENU_SECTION_H
    + options.length * MENU_ROW_H
    + Math.max(0, options.length - 1) * MENU_ROW_GAP;
  // Hook 必须在任何提前 return 之前调用，否则显示/隐藏切换会错位 Hook 顺序
  const safePos = useMemo(
    () => calcFixedPosition(position.x, position.y, MENU_W, estimatedHeight),
    [position.x, position.y, estimatedHeight],
  );

  if (!visible) return null;
  if (options.length === 0) return null;

  /** 官方选区锚点：`-translate-x-1/2`（锚点 = 菜单水平中心）+ 本体 `mt-4`；自由模式仍走 MTV 的视口钳制
   *  ★★ `mt-4` 的正确落点（官方源码 @1437683 逐字）：
   *  ```jsx
   *  <motion.div className="absolute z-50 -translate-x-1/2" style={{left:b.x, top:b.y}} …>
   *    <div className="mt-4">{<wme/>}</div>      // ← mt-4 是**菜单外面的偏移层**
   *  </motion.div>
   *  ```
   *  官方的 motion.div 只是定位容器（无底色），`mt-4` 的那层才是真正的菜单盒子
   *  ⇒ 视觉结果 = **菜单盒顶边 = 锚点 Y + 16**
   *  ⚠️ MTV 的 motion.div **本身就是菜单盒**（有底色/边框）⇒ 把 `mt-4` 写在**它里面** ✗
   *     等于在盒子顶部加了 16px 空白：实测组标题被顶到 y=20（官方 y=4）、
   *     首行 y=48（官方 y=32），菜单高度也多出 16（358 vs 354）✗✓
   *  ⇒ 改成**把它并入定位**（`position.y + 16`），盒内不再放 `mt-4` ✓ */
  const anchorX = selectionAnchor ? '-50%' : 0;
  const placeLeft = selectionAnchor ? position.x : safePos.left;
  const placeTop = selectionAnchor ? position.y + SELECTION_MENU_OFFSET_Y : safePos.top;
  const body = (
    <div
      className="node-picker-body"
      ref={(el) => {
        if (!el || el.dataset.cmdkInitialized) return;
        el.dataset.cmdkInitialized = '1';
        /* 官方 cmdk：面板打开即把**第一个可用条目**设为 active（它的副标因此常显）✓
           ⚠️ 原来查的是 `.command-item` ✗ —— 本菜单的行是 `<div role="option">`（没有这个类）
              ⇒ 从没命中过 ⇒ 官方的「首行副标可见」在 MTV 上看不到（用户：「内容不对」）✓ */
        el.querySelector('[role="option"]:not([data-disabled="true"])')?.setAttribute('data-selected', 'true');
      }}
    >
      {groups.map((group, groupIndex) => (
        <Fragment key={group.title}>
          {/* 官方两条分组之间有 1px 分隔线（`zoom-slider` 菜单：`shrink-0 bg-border h-[1px] w-full my-2`
              —— t1153 官方实测：组1 248 + 分隔线 17 + 组2 80 = 345 = 面板内容高 ✓） */}
          {groupIndex > 0 && <div className="connection-menu-divider" aria-hidden="true" />}
          <div>
            {/* 组标题 —— 与双击菜单同一份 `.menu-section` / `.menu-title`（12px/500 #7A7A7A） */}
            <div className="menu-section">
              <span className="menu-title">{t(group.title)}</span>
            </div>

            {group.children.map((option) => {
                  /* 官方 `QT` / `qie` 逐字（zoom-slider @29274 起）：
                       行   : group w-full h-13(52) text-base cursor-pointer rounded-xl p-2
                              transition-all duration-200 flex items-center gap-2
                              dark:data-[selected=true]:bg-accent/50  → hover/选中 rgba(63,63,70,.5)
                       图标盒: relative h-full aspect-square(36) rounded-md(6) text-muted-foreground
                              bg-accent/40 flex items-center justify-center transition-all duration-200
                              [&_svg]:size-[18px] [&_svg]:text-popover-foreground
                       文字块: flex-1 h-full flex flex-col justify-between overflow-hidden
                       标题 : font-medium text-sm text-popover-foreground leading-none
                              translate-y-[10px] group-hover:translate-y-0 transition-transform duration-200
                       副标 : text-xs text-muted-foreground leading-none opacity-0
                              group-hover:opacity-100 transition-all duration-200 truncate line-clamp-1
                     ⇒ 关键差异（原实现全缺）：行高 52（不是 56）· r12（不是 16）· 图标 36/r6/18px（不是 34/r10/17）
                        · **hover 动效**：标题上移归位 + 副标淡入（原来只是 display:none/block 硬切）✗✓ */
                  const rowClassName =
                    'group flex h-[52px] w-full cursor-pointer text-left items-center gap-2 rounded-2xl p-2 text-base transition-all duration-200 hover:bg-[rgba(64,64,64,0.5)]';
                  const inner = (
                    <>
                      <div className="relative flex aspect-square h-full shrink-0 items-center justify-center rounded-[10px] bg-[rgba(64,64,64,0.4)] text-[#7A7A7A] transition-all duration-200 [&_svg]:size-[18px] [&_svg]:text-[#CCCCCC]">
                        <OfficialIcon name={option.icon} size={18} />
                      </div>
                      <div className="flex h-full flex-1 flex-col justify-between overflow-hidden">
                        <span className="inline-flex translate-y-[10px] items-center gap-1 text-sm font-medium leading-none text-[#CCCCCC] transition-transform duration-200 group-hover:translate-y-0">
                          {t(option.label)}
                        </span>
                        {option.description ? (
                          <p className="line-clamp-1 truncate text-xs leading-none text-[#7A7A7A] opacity-0 transition-all duration-200 group-hover:opacity-100">
                            {t(option.description)}
                          </p>
                        ) : null}
                      </div>
                    </>
                  );

                  /* 官方原结构：条目根节点 = **div + role="option"**（cmdk `Item`），
                     禁用走 `data-disabled="true"` + `aria-disabled`，**不是** `<button disabled>` ✓ */
                  return option.disabled ? (
                    <div
                      key={option.id}
                      role="option"
                      aria-disabled="true"
                      data-disabled="true"
                      data-testid={`connection-command-${option.id}`}
                      className={`${rowClassName} cursor-not-allowed opacity-45`}
                    >
                      {inner}
                    </div>
                  ) : (
                    <div
                      key={option.id}
                      role="option"
                      onClick={() => onSelect(option)}
onMouseEnter={(e) => {
            const root = e.currentTarget.closest('.node-picker-body');
            root?.querySelectorAll('.command-item[data-selected="true"]').forEach((el) => el.removeAttribute('data-selected'));
            e.currentTarget.setAttribute('data-selected', 'true');
          }}
onMouseLeave={(e) => e.currentTarget.removeAttribute('data-selected')}
                      data-testid={`connection-command-${option.id}`}
                      className={rowClassName}
                    >
                      {inner}
                    </div>
                  );
                })}
          </div>
        </Fragment>
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={menuRef}
          /* ★ 选区 `+` 那条走**官方另一个面板规格**（t1152/t1153 实测）：
               官方 `.node-float-ui` 选区菜单 = **260 宽 · radius 12 · pad 4 · 无 backdrop-blur**
               ⚠️ MTV 的 `.connection-command-menu` 底样式是照**双击菜单**（288/w-72 · r16）写的 ✗
                  ⇒ 选区菜单跟着变成 288/r16（用户：「大小不对」✓）
               ⇒ 加变体类，只在 `selectionAnchor` 时套官方选区规格 ✓ */
          className={`connection-command-menu${selectionAnchor ? ' connection-command-menu--selection' : ''}`}
          style={{ left: placeLeft, top: placeTop }}
          initial={{ opacity: 0, scale: 0.95, y: -4, x: anchorX }}
          animate={{ opacity: 1, scale: 1, y: 0, x: anchorX }}
          exit={{ opacity: 0, scale: 0.95, y: -4, x: anchorX }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* 官方 `mt-4` 已并入 `placeTop`（见上），**盒子内部不再放偏移层** ✗ */}
          {body}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(ConnectionMenu);
