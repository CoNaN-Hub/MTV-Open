/**
 * 确认卡族的**非组件**共享工具（纯函数 / 类型）—— 从 `ConfirmationCardParts.tsx` 拆出，
 * 以满足仓库的 `react-refresh/only-export-components` 约束（组件文件只导出组件）。
 *
 * 官方出处（`vendor-pkg-canvas-ChpWx5JY.js`）：
 *  - `z(...)` —— classnames 合并（官方用 `class-variance-authority` 风格的 `z`）
 *  - `vJe` @2228xxx —— `Rs` 的 selectedValue → label 反查
 *  - `LJe` @2238671 —— `WJe` 的条目状态机 reducer
 *  - `qse` @2286133 —— 确认前 blur 当前焦点
 */
import type { ReactNode } from 'react';

/** 官方 `z(...)`。 */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** 官方 `vJe(e,t)`：把 `selectedValue` 反查成 label（找不到则回落 value 本身）。 */
export function resolveChipLabel(
  value: ReactNode,
  options?: readonly { value: string; label: ReactNode }[],
): ReactNode {
  if (!options || options.length === 0) return value;
  const hit = options.find((option) => option.value === value);
  return hit ? hit.label : value;
}

/** 官方 `LJe` 的状态域。 */
export type PromptItemView = 'collapsed' | 'expanded' | 'editing';
export type PromptItemAction = { type: 'toggleExpanded' } | { type: 'enterEditing' } | { type: 'exitEditing' };

/** 官方 `LJe`（@2238671，逐字）。 */
export function promptItemReducer(state: PromptItemView, action: PromptItemAction): PromptItemView {
  switch (action.type) {
    case 'toggleExpanded':
      return state === 'collapsed' ? 'expanded' : state === 'expanded' ? 'collapsed' : state;
    case 'enterEditing':
      return 'editing';
    case 'exitEditing':
      return 'expanded';
    default:
      return state;
  }
}

/** 官方 `qse()`（@2286133，逐字）。 */
export function blurActiveElement(): void {
  const element = document.activeElement;
  if (element instanceof HTMLElement && element !== document.body) element.blur();
}
