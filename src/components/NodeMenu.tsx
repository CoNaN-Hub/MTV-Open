/**
 * NodeMenu 浮动「添加节点」菜单 —— 定位弹出的那一支。
 *
 * ★ 内容已统一：本组件与左侧「+」面板渲染的是**同一个** `NodePickerPanel`，
 *   条目来自同一份 `nodePickerCatalog.tsx`，因此两个入口永远一致（同条目/同分组/同顺序）。
 *   本组件只负责**浮动定位 + 点击外部/Escape 关闭**，并复用 `.node-picker` 外壳样式
 *   （带 `--at` 变体 = 「出现在坐标点」的那一套：`left/top` 由 `calcFixedPosition` 给出）。
 *
 * ⚠️ 目前全仓没有调用 `showNodeMenu()` 的地方（`nodeMenuVisible` 恒为 false），
 *    也就是这条入口当前不会自己弹出；保留它是为了不删除既有实现，
 *    并保证一旦有调用方接上，弹出的内容与「+」面板一致。之前那份**只有 7 条、
 *    且没有「辅助工具 / 添加资源」分组**的私有列表已删除 —— 正是它与「+」面板不一致的根源。
 */
import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { calcFixedPosition } from '../utils/popupPosition';
import NodePickerPanel from './sidebar/NodePickerPanel';

const NODE_MENU_W = 240;
const NODE_MENU_H = 640;

export default function NodeMenu() {
  const nodeMenuVisible = useAppStore((s) => s.nodeMenuVisible);
  const nodeMenuPosition = useAppStore((s) => s.nodeMenuPosition);
  const hideNodeMenu = useAppStore((s) => s.hideNodeMenu);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideNodeMenu();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') hideNodeMenu();
    }
    if (nodeMenuVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodeMenuVisible, hideNodeMenu]);

  const safePos = useMemo(
    () => calcFixedPosition(nodeMenuPosition.x, nodeMenuPosition.y, NODE_MENU_W, NODE_MENU_H),
    [nodeMenuPosition.x, nodeMenuPosition.y],
  );

  return (
    <AnimatePresence>
      {nodeMenuVisible && (
        <div
          ref={menuRef}
          className="node-picker node-picker--at"
          style={{ left: safePos.left, top: safePos.top }}
        >
          {/* ★ 与左侧「+」面板 / 画布双击菜单**同一个组件、同一份目录** */}
          <NodePickerPanel onClose={hideNodeMenu} />
        </div>
      )}
    </AnimatePresence>
  );
}
