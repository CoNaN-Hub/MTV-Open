/**
 * DeleteToolbarButton —— 官方节点工具条末尾的「删除」键
 * （`uPe` @1485700 + 图标 `Mg` = Tabler `trash`，`zoom-slider-3ZcFvYQO.js`）
 *
 * 官方（逐字）：
 *   const n4 = 触屏 && 屏幕长边 768–1366          // 见 `utils/touchDevice.ts`
 *   const s  = eu(nodeId)                        // = 只读上下文 || 该节点被别的设备锁住
 *   const a = {
 *     node: <Wt variant="ghost" size="sm"
 *               className={Z("cursor-pointer px-1! text-muted-foreground/70 hover:text-destructive/80",
 *                             r.nodes?.deletable === false && "cursor-not-allowed opacity-50")}
 *               data-testid={CANVAS.NODE.DELETE_BTN} disabled={r.nodes?.deletable === false}>
 *             <Mg size={20} />
 *           </Wt>,
 *     key: "delete", text: t("common.delete") || "Delete",
 *     handle: () => { if (!s) { if (!E3()) { Vo(); return } deleteElements({ nodes: [{ id: nodeId }] }) } },
 *   };
 *   return n4 && !s ? [...tools, [a]] : tools;   // ← **额外补一组**（组间照常有分隔线）
 * ⇒ 桌面端（`n4 === false`）工具条里**没有**这个键 ✓
 */
import { memo, useCallback } from 'react';
import { useT } from '../../../../i18n';
import { useAppStore } from '../../../../store/useAppStore';
import { OfficialIcon } from '../../../sidebar/OfficialIcon';
import AnimatedButton from '../../../shared/AnimatedButton';

export interface DeleteToolbarButtonProps {
  nodeId: string;
  disabled?: boolean;
}

function DeleteToolbarButton({ nodeId, disabled = false }: DeleteToolbarButtonProps) {
  const t = useT();
  const label = t('删除');
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    useAppStore.getState().deleteNode(nodeId);
  }, [disabled, nodeId]);

  return (
    <AnimatedButton
      type="button"
      className="ftb-btn icon-only act-delete is-danger"
      data-tooltip={label}
      aria-label={label}
      data-testid="canvas.node.delete_btn"
      disabled={disabled}
      onClick={handleDelete}
    >
      <OfficialIcon name="delete" size={20} />
    </AnimatedButton>
  );
}

export default memo(DeleteToolbarButton);
