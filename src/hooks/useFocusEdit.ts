/**
 * useFocusEdit — 焦点编辑（官方 `magicSelection`）的**组件侧**入口。
 *
 * 逐字对应官方 `Jg`（`vendor-pkg-canvas-futqHM6N.js` @1578324–1580410）：
 *   · `handleToggle`（官方 `h`）：进入模式 / **退出模式时补自动连线**
 *   · `identifyObject`（官方同名）：**流程放在 store 的 `identifyFocusEditElement`**
 *     （节点卡片 ImageNode 也要直接触发，走 store 才不用把 hook 穿过整棵树）
 *   · `removeMark`（官方 `g`）：删 mark + 从 prompt 里摘掉对应 token
 *
 * ⚠️ 自动连线的方向按 **MTV 既有约定**（`assistantStream.ts:427`
 *    「已有节点 → 新节点」= `source: 被引用节点, target: 焦点编辑节点`），
 *    且补 `sourceHandle:'right' / targetHandle:'left'`（MTV 全仓统一写法，
 *    见 `presetSequenceService.ts:152` 等 20 余处）。
 *    官方原文是 `{source: mark.targetNodeId, target: source}` —— 语义一致（被提取的图
 *    作为焦点节点的输入参考），但 MTV 的画布输出在右/输入在左，故按 MTV 约定落地。
 */
import { useCallback, useMemo } from 'react';
import type { Connection } from '@xyflow/react';
import { useAppStore } from '../store/useAppStore';
import type { FocusEditMark } from '../store/store.ui';

export interface UseFocusEditResult {
  isActive: boolean;
  isProcessing: boolean;
  marks: FocusEditMark[];
  /** 进入/退出焦点编辑模式（官方 `toggleMode` + 退出时自动连线） */
  toggle: (sourceNodeId: string) => void;
  /** 点目标图片某处 → 识别元素（官方 `identifyObject`，0–1000 归一化点） */
  handleNodeClick: (
    targetNodeId: string,
    targetUrl: string | undefined,
    point: { x: number; y: number },
  ) => void;
  /** 删一条 mark（官方 `g`：同时把 prompt 里的 token 摘掉） */
  removeMark: (markId: string) => void;
}

export function useFocusEdit(sourceNodeId: string | null | undefined): UseFocusEditResult {
  const isActive = useAppStore((s) => s.focusEditNodeId === sourceNodeId && !!sourceNodeId);
  const isProcessing = useAppStore((s) => s.focusEditProcessing);
  const marks = useAppStore((s) => s.focusEditMarks);
  const setFocusEditNodeId = useAppStore((s) => s.setFocusEditNodeId);

  /* 官方 `h`（@1578360 逐字）：退出模式时，源↔每个被点过的目标节点补边。 */
  const toggle = useCallback((nodeId: string) => {
    const state = useAppStore.getState();
    if (state.focusEditNodeId !== nodeId) {
      setFocusEditNodeId(nodeId);       // 进入模式
      return;
    }

    // ── 退出模式 ──
    const collected = state.focusEditMarks;
    setFocusEditNodeId(null);
    if (collected.length === 0) return;

    const seen = new Set<string>();
    const additions: Connection[] = [];
    for (const mark of collected) {
      const targetId = mark.targetNodeId;
      if (!targetId || seen.has(targetId)) continue;
      const alreadyLinked = state.edges.some((edge) => (
        (edge.source === targetId && edge.target === nodeId)
        || (edge.source === nodeId && edge.target === targetId)
      ));
      if (alreadyLinked) continue;
      additions.push({ source: targetId, target: nodeId, sourceHandle: 'right', targetHandle: 'left' });
      seen.add(targetId);
    }
    if (additions.length > 0) state.onConnectBatch(additions);
  }, [setFocusEditNodeId]);

  const handleNodeClick = useCallback((
    targetNodeId: string,
    targetUrl: string | undefined,
    point: { x: number; y: number },
  ) => {
    void useAppStore.getState().identifyFocusEditElement(targetNodeId, targetUrl, point);
  }, []);

  const removeMark = useCallback((markId: string) => {
    /* 官方 `g`：删 mark + 把 prompt 里那段 token 摘掉（两件事必须一起做，
       否则输入框里会留一个指向已删标记的孤儿芯片）。store 里已统一实现。*/
    useAppStore.getState().deleteFocusEditMark(markId);
  }, []);
  return useMemo(
    () => ({ isActive, isProcessing, marks, toggle, handleNodeClick, removeMark }),
    [isActive, isProcessing, marks, toggle, handleNodeClick, removeMark],
  );
}
