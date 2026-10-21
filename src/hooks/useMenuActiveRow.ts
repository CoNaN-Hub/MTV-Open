/**
 * useMenuActiveRow —— 右键菜单「打开即高亮首项 + ↑/↓ 移动高亮」
 *
 * 官方行为（cmdk）：菜单**打开那一刻**第一项就带 `data-selected="true"`，
 * 配合容器上的 `data-[selected=true]:bg-muted`（`--muted` = `#2b2b2b`）⇒ 打开即有一条高亮；
 * 鼠标移到某项、或按 ↑/↓ 都会把高亮移过去。
 * MTV 原来只有 `:hover` 才高亮 ⇒ 观感与官方不同 ✗（用户点名「hover / hover 底色」）。
 *
 * 做法：在菜单根节点上做**事件委托**，给命中的 `.menu-row` 加 `.active`
 * （`.canvas-ctx-menu .menu-row.active` 已按官方 `#2b2b2b` 着色）。
 * 不侵入各组件的 JSX，两个菜单（空白 / 卡片）共用。
 */
import { useEffect } from 'react';

interface Options {
  /** 菜单根元素（`CanvasContextMenu` / `NodeContextMenu` 各自的 `menuRef`） */
  menuRef: React.RefObject<HTMLElement | null>;
  /** 菜单是否打开 */
  visible: boolean;
  /** 键盘监听开关（子菜单打开时可传 false，避免两个菜单同时响应） */
  keyboardEnabled?: boolean;
}

export function useMenuActiveRow({ menuRef, visible, keyboardEnabled = true }: Options) {
  useEffect(() => {
    const root = menuRef.current;
    if (!root || !visible) return undefined;

    const rows = () =>
      Array.from(root.querySelectorAll<HTMLElement>('.menu-row')).filter(
        (el) => !el.classList.contains('disabled'),
      );

    let index = 0;
    const paint = (next: number) => {
      const list = rows();
      if (!list.length) return;
      index = Math.max(0, Math.min(next, list.length - 1));
      list.forEach((el, i) => el.classList.toggle('active', i === index));
    };

    /* 官方：打开即高亮第一项 */
    paint(0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (!keyboardEnabled) return;
      const list = rows();
      if (!list.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        paint(index + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        paint(index - 1);
      }
    };

    const onPointerOver = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const row = target?.closest?.('.menu-row') as HTMLElement | null;
      if (!row || !root.contains(row)) return;
      const list = rows();
      const at = list.indexOf(row);
      if (at >= 0) {
        index = at;
        list.forEach((el, i) => el.classList.toggle('active', i === at));
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    root.addEventListener('pointerover', onPointerOver, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      root.removeEventListener('pointerover', onPointerOver, true);
      rows().forEach((el) => el.classList.remove('active'));
    };
  }, [keyboardEnabled, menuRef, visible]);
}

export default useMenuActiveRow;
