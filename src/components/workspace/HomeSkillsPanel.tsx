/**
 * HomeSkillsPanel —— 首页「技能」按钮打开的官方「管理技能」面板。
 * ══════════════════════════════════════════════════════════════════════════
 * 官方证据：
 *  · i18n 字面量（`index-bundle.js` @850770 附近）：`skills.title="技能"`、`tabSkill="技能"`、
 *    `tabPlugin="应用"`、`searchPlaceholder="搜索"`、`emptyPlugins="暂无应用"`、
 *    `noSearchResults="没有匹配的技能"`、`skillsName="技能名称"`
 *    ⇒ 首页那颗「技能」按钮打开的就是这个「技能 / 应用」双页签面板。
 *  · 「+」→ 管理技能：`onManageSkill: () => { d(!1), s("skill") }`（@1647071 附近）
 *    ⇒ 与管理面板是同一个入口。
 *
 * MTV 侧不新写面板：直接复用已逐字移植的 `SkillsManagerDialog`（官方「管理技能」对话框）
 * + `SkillCreateDialog`（官方「创建技能」）。两者都只读 store 动作（`uploadSkill` 等），
 * 所以首页也能独立挂载，不需要画布里的 `ChatInput`。
 */
import { useCallback } from 'react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import SkillsManagerDialog from '../chat/SkillsManagerDialog';
import SkillCreateDialog from '../chat/SkillCreateDialog';

export default function HomeSkillsPanel() {
  const t = useT();
  const open = useAppStore((s) => s.homeSkillsOpen);
  const tab = useAppStore((s) => s.homeSkillsTab);
  const createOpen = useAppStore((s) => s.homeSkillCreateOpen);
  const setHomeSkillsOpen = useAppStore((s) => s.setHomeSkillsOpen);
  const setHomeSkillCreateOpen = useAppStore((s) => s.setHomeSkillCreateOpen);
  const uploadSkill = useAppStore((s) => s.uploadSkill);
  const showToast = useAppStore((s) => s.showToast);

  const upload = useCallback(
    async (source: 'file' | 'folder') => {
      try {
        await uploadSkill(source);
      } catch (error) {
        showToast(error instanceof Error ? error.message : t('上传 Skill 失败'), 'error');
      }
    },
    [showToast, t, uploadSkill],
  );

  return (
    <>
      <SkillsManagerDialog
        open={open}
        initialTab={tab}
        onClose={() => setHomeSkillsOpen(false)}
        onCreateSkill={() => {
          setHomeSkillsOpen(false);
          setHomeSkillCreateOpen(true);
        }}
        onUploadSkillFile={() => void upload('file')}
        onUploadSkillFolder={() => void upload('folder')}
      />
      <SkillCreateDialog
        open={createOpen}
        onClose={() => setHomeSkillCreateOpen(false)}
        onBack={() => {
          setHomeSkillCreateOpen(false);
          setHomeSkillsOpen(true);
        }}
      />
    </>
  );
}
