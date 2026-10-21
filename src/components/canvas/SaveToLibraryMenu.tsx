/**
 * SaveToLibraryMenu —— 官方「保存到素材库」的**文件夹选择器**。
 *
 * 官方（`page-DPdEgTS0.js` @1430523 调用点 / @264432 对话框）：保存前先选素材库文件夹，
 * 标题 `library.selectFolder`「选择文件夹」，列表 = `library.folders`
 * 「风格 / 场景 / 道具 / 其他 / 音效 / 角色」；选中后保存并 toast `library.savedToFolder`
 * 「已保存到「{folder}」」。
 *
 * ★ MTV 落地：外壳复用官方 cmdk 面板规格（`.canvas-ctx-menu`：240 宽 · r16 · 行高 44 · 首行高亮）；
 *   文件夹来自 `LIBRARY_FOLDERS`，本地落盘 = `{baseDataDir}/file/<文件夹>/`（`fs/assetLibrary`）。
 *   ⚠️ 官方那个是素材库的**空间/文件夹树对话框**（`initialSpace`/`allowSpaceSwitch`、可新建文件夹）；
 *      MTV 素材库是本地扁平目录 ⇒ 这里只做官方那六个固定文件夹这一层（未做新建/切换空间，见报告）。
 */
import { memo } from 'react';
import { LIBRARY_FOLDERS } from '../../services/fs/assetLibrary';
import { useT } from '../../i18n';
import { useMenuActiveRow } from '../../hooks/useMenuActiveRow';

interface SaveToLibraryMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  menuRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (folderLabel: string) => void;
}

function SaveToLibraryMenu({ visible, position, menuRef, onSelect }: SaveToLibraryMenuProps) {
  const t = useT();
  /* 官方 cmdk：打开即高亮首项 + ↑/↓ 移动（与其它右键菜单同一套） */
  useMenuActiveRow({ menuRef, visible });
  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="canvas-ctx-menu"
      style={{ left: position.x, top: position.y }}
      data-testid="save-to-library-menu"
    >
      {/* 官方对话框标题 `library.selectFolder`「选择文件夹」 */}
      <div className="menu-row disabled" style={{ opacity: 0.6 }}>
        <span>{t('选择文件夹')}</span>
      </div>
      {LIBRARY_FOLDERS.map((folder) => (
        <div key={folder.key} className="menu-row" onClick={() => onSelect(folder.label)}>
          <span>{t(folder.label)}</span>
        </div>
      ))}
    </div>
  );
}

export default memo(SaveToLibraryMenu);
