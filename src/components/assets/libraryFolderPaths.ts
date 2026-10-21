/**
 * libraryFolderPaths —— 素材库根文件夹的**纯常量与纯函数**。
 *
 * 官方依据（`page-DPdEgTS0.js` 的素材库面板 / 「选择文件夹」对话框 `z2` 共用同一份列表）：
 *  · `library.folders` 逐字 = 风格 / 场景 / 道具 / 其他 / 音效 / 角色；
 *    MTV 按官方面板**实际渲染顺序**排成 `角色 → 用户新建的根文件夹（按创建顺序）→ 场景/道具/风格/音效/Others`
 *    （9444 实测 t956）。
 *  · 官方账号里「其他」这一行在服务端就是字面量 `Others`（i18n `library.folders.others` =「其他」），
 *    MTV 本地素材库的默认目录叫「其他」⇒ **显示 `Others`、实际读写 `其他`**（用户确认 2026）。
 *
 * ⚠️ 这些常量/函数原本写在 `LibraryFolderRows.tsx` 里，但那个文件是**组件文件** ——
 *    `react-refresh/only-export-components` 要求组件文件只导出组件，所以拆到这里
 *    （纯搬运，没有改语义）。
 */

/** 官方文件夹（`library.folders`），按官方面板实际渲染顺序 */
export const LIBRARY_PANEL_FOLDERS = ['角色', '场景', '道具', '风格', '音效', 'Others'] as const;
export type LibraryPanelFolder = (typeof LIBRARY_PANEL_FOLDERS)[number];

export const LIBRARY_OTHERS_LABEL = 'Others';
export const LIBRARY_OTHERS_DIR = '其他';

export function libraryFolderDir(label: string): string {
  return label === LIBRARY_OTHERS_LABEL ? LIBRARY_OTHERS_DIR : label;
}

export function libraryFolderLabel(dir: string): string {
  return dir === LIBRARY_OTHERS_DIR ? LIBRARY_OTHERS_LABEL : dir;
}

/** 磁盘名 ↔ 官方显示名的别名（磁盘「其他」由内置「Others」行代表，
 *  不再额外渲染一行，否则会出现「其他 / Others」两行）。 */
const LIBRARY_ROOT_ALIAS: Record<string, string> = { [LIBRARY_OTHERS_DIR]: LIBRARY_OTHERS_LABEL };

export function libraryRootOrder(extra: readonly string[] = []): string[] {
  const [first, ...rest] = LIBRARY_PANEL_FOLDERS as readonly string[];
  const builtin = new Set<string>(LIBRARY_PANEL_FOLDERS as readonly string[]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of extra) {
    if (!n || builtin.has(n) || LIBRARY_ROOT_ALIAS[n] || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return [first, ...out, ...rest];
}
