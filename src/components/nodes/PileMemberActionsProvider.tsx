/**
 * PileMemberActionsProvider —— 官方 **PILE 成员操作上下文的 Provider**（逐字对照 `zoom-slider-3ZcFvYQO.js`）
 *
 * 官方 `ect`@2939710（一行）：
 * ```js
 * function ect({value:e, children:t}){ return l.jsx(mJ.Provider,{value:e,children:t}) }
 * ```
 * ⇒ 本文件导出两件东西：
 *   · `PileMemberActionsProvider` —— 官方 `ect` 的逐字移植（**哑** Provider，只收 `value`）；
 *   · `PileMemberActionsScope`      —— MTV 侧的**真实 value 装配**（对应官方 `page-DPdEgTS0.js`@1460466
 *     那个 `us = useMemo(()=>({...}))`，见 `pileMemberActionsContext.ts` 顶部注释）。
 *
 * 真实 value 的官方出处逐字（`page-DPdEgTS0.js`，`useCallback` 定义顺序照抄）：
 * ```js
 * Re = !tt && de.enabled !== false;                                    // enabled（远端 pile 策略）
 * Ze = he => Re ? X8(ue.current, he, de) : false;                      // canCreateFromSelection
 * nt = he => { if(!Re) return false; const Ue=ue.current, st=P(), Xe=Q8(Ue,he,de);
 *              if(!Xe) return false; const ut=J8(Xe,st,xs()); return Je(Xe.nextNodes,ut) };  // createFromSelection
 * gt = (he,Ue,st) => { if(!Re) return; …hme(…)/unstackPlan… 无计划时 Ge(LS(nodes,he)) };    // unpile
 * wt = (he,Ue,st) => { if(!Re) return null; const Xe=Y(st), ut=ue.current, pt=ut.find(id===Ue);
 *                      if(!pt) return null; const ht={width:ln(pt),height:bs(pt)};
 *                      const Rt={x:Xe.x-ht.width/2, y:Xe.y-ht.height/2};
 *                      const bt=ut.find(id===he), St=bt?Tv(bt,ut).length:0;
 *                      const kt=Z8(ut,he,Ue,Rt), At=kt.find(id===he), Jt=OS(At);
 *                      return Ge(kt) ? {position:Rt,actualSize:ht,dissolved:St<=2,remainingMemberIds:Jt} : null };  // removeMember
 * It = (he,Ue) => { if(!Re) return null; const st=ue.current, Xe=eV(st,he,Ue), ut=Xe.find(id===he),
 *                   pt=OS(ut); return pt.includes(Ue) ? (Xe!==st&&Ge(Xe), {memberIds:pt}) : null };  // moveMemberToTop
 * on = he => { Re && Z(he,{taskInfo:null}) };                          // dismissMemberError
 * ```
 * 逐项对应到 MTV 见下方各 `useCallback` 的注释。
 *
 * ⚠️ 官方两处 `gJ()` 消费点（画廊 `WQe`@2956017、堆叠渲染器 `uJe`@2983900）见
 *    `pileMemberActionsContext.ts` 的 `PileMemberActions` 注释；本组件只负责「装配并下发」。
 */
import { useCallback, useMemo, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAppStore } from '../../store/useAppStore';
import {
  buildPileIndex,
  canCreatePile,
  movePileMemberToFront,
  pileMemberIds,
  PILE_NODE_TYPE,
  type AnyNode,
} from '../../utils/officialPile';
import { renderSizeOf } from '../../utils/officialCanvasLayout';
import {
  PileMemberActionsContext,
  type PileMemberActions,
  type PileMemberOrder,
  type PileMemberRemoval,
} from './pileMemberActionsContext';

/** 官方 `ect` —— 哑 Provider（value 的身份由调用方 `useMemo` 负责，与官方一致） */
export function PileMemberActionsProvider({
  value,
  children,
}: {
  value: PileMemberActions;
  children: ReactNode;
}) {
  return <PileMemberActionsContext.Provider value={value}>{children}</PileMemberActionsContext.Provider>;
}

/** `readonly string[]` 的逐项相等（用来替代官方 `Vlt` 的**引用相等**，见 `moveMemberToTop` 注释） */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * MTV 的真实 value 装配（= 官方 `page-DPdEgTS0.js`@1460466 的 `us`）。
 * 官方那个 useMemo 挂在画布组件里（它拿得到 `graphActions` / 落地计划 store）；
 * MTV 的对应物全部落在 zustand store 上 ⇒ 单独一个组件包住画布即可。
 *
 * ★ 必须是**画布之内**的组件：`removeMember` 要 `useReactFlow().screenToFlowPosition`
 *   把画廊的屏幕落点换成 flow 坐标（官方 `wt` 里的 `Y(st)`）。
 */
export function PileMemberActionsScope({ children }: { children: ReactNode }) {
  const { screenToFlowPosition } = useReactFlow();

  /**
   * 官方 `Ze = he => Re ? X8(ue.current, he, de) : false`。
   * `X8` 在 `zoom-slider` 里的真名是 `Glt`@2776878（= `utils/officialPile.ts` 的 `canCreatePile`）。
   * ⚠️ MTV 偏离：官方 `de` 是远端 `pile` 策略（`{enabled, allowedMemberTypes, maxMembers}`）；
   *    MTV 的 `pileSelectedNodes` 传的是空 `{}` ⇒ 这里也用 `{}`，保持与 store 动作**同一口径**（官方：读策略）。
   */
  const canCreateFromSelection = useCallback((selectedIds: readonly string[]): boolean => {
    const nodes = useAppStore.getState().nodes as unknown as AnyNode[];
    return canCreatePile(nodes, selectedIds, {}, (node) => renderSizeOf(node as never, nodes as never));
  }, []);

  /**
   * 官方 `nt = he => { …Q8(nodes,he,de)… ; return Je(Xe.nextNodes, ut) }`（`Q8` = `pqe`@2776891、
   * `Je` = 落库 + 落地计划 `J8`）。
   * ⚠️ MTV 偏离：MTV 没有官方的「落地计划 / 入场动画」store（`ns.getState().startEntryPlan` 那一套）
   *    ⇒ 复用 store 的 `pileSelectedNodes()`（它内部就是官方 `pqe` = `applyPileCreation`），
   *    返回值改成「图里是否真的多出一个堆叠节点」——官方返回的是 `Ge(nextNodes)` 的落库布尔，语义一致。
   * ⚠️ MTV 偏离：官方 `nt` 不改选区（选区由它的调用方 `Te`@1444658 事先给好）；MTV 的
   *    `pileSelectedNodes()` 按**当前选区**工作 ⇒ 这里先 `setSelectedNodeIds(ids,'direct')` 再调它。
   */
  const createFromSelection = useCallback((selectedIds: readonly string[]): boolean => {
    const store = useAppStore.getState();
    const before = new Set(store.nodes.map((node) => node.id));
    store.setSelectedNodeIds([...selectedIds], 'direct');
    store.pileSelectedNodes();
    return useAppStore
      .getState()
      .nodes.some((node) => node.type === PILE_NODE_TYPE && !before.has(node.id));
  }, []);

  /**
   * 官方 `gt = (he,Ue,st) => {…}`（`he` = pileId、`Ue` = 预览展开倍数、`st` = 成员视图模型数组）。
   * 官方有动画计划时走 `prepareUnstackPlan` / `beginLandingNodes` / `startUnstackMotion`；
   * **没有计划时**回落 `Ge(LS(nodes,he))`（`LS` = `$lt`@2779181，= `unpilePileNode`）。
   * ⚠️ MTV 偏离：MTV 没有官方的解堆动画 store ⇒ 只走官方的**回落分支**，并且按堆叠 id 解堆要靠
   *    「先把 store 选区钉到这个堆叠、再调按选区工作的 `unpileSelectedNodes`」——
   *    与 `PileNode.tsx` 的 `handleUnpile`（工具条）完全同一路径（官方 `$lt` 内部即按 id 处理）。
   * ⚠️ MTV 偏离：官方 `Ue`（展开倍数）/ `st`（成员数组）只被动画计划 `hme` 使用 ⇒ 在 MTV 侧被忽略。
   */
  const unpile = useCallback((pileId: string, _expansion: number, _members: readonly unknown[]): void => {
    const store = useAppStore.getState();
    store.setSelectedNodeIds([pileId], 'direct');
    store.unpileSelectedNodes();
  }, []);

  /**
   * 官方 `wt = (he,Ue,st) => {…}`（`st` = 屏幕坐标的落点中心 `Bt.screenCenter`）。
   * 逐条对应：
   *   · `if(!pt) return null` → 成员节点不存在 ⇒ `null`（调用方 `_e` 回落到「放回堆叠」）；
   *   · `ht={width:ln(pt),height:bs(pt)}` → `renderSizeOf`（官方 `yr` / `_i`）；
   *   · `Xe=Y(st)` → `screenToFlowPosition`（官方 `Y` 就是 React Flow 的屏幕→flow 换算）；
   *   · `Rt={x:Xe.x-w/2,y:Xe.y-h/2}` → 成员**左上角**的 flow 坐标（作为 `Klt` 的落点 `s`）；
   *   · `Z8(ut,he,Ue,Rt)` → `removeNodeFromPile(pileId, memberId, Rt)`（`Klt`@2779553）；
   *   · `Ge(kt)` 为假（图无变化）⇒ `null`：MTV 的 store 动作在无变化时**直接返回不落库**，
   *     这里用「成员必须真的归这个堆叠」提前判定（`qa` 归属表 `pileIdByNodeId`），语义等价；
   *   · `At=kt.find(id===he)` + `Jt=OS(At)` → 改动后该堆叠节点（已删除则为 `undefined`）的 `memberIds`；
   *   · `dissolved:St<=2`（`St` = **摘出前**成员数）→ `members.length <= 2`。
   */
  const removeMember = useCallback(
    (
      pileId: string,
      memberId: string,
      dropScreenPoint: { x: number; y: number },
    ): PileMemberRemoval | null => {
      const store = useAppStore.getState();
      const nodes = store.nodes as unknown as AnyNode[];
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const pile = byId.get(pileId);
      const member = byId.get(memberId);
      if (!pile || pile.type !== PILE_NODE_TYPE || !member) return null;
      const index = buildPileIndex(nodes, byId);
      if (index.pileIdByNodeId.get(memberId) !== pileId) return null;
      const members = index.membersByPileId.get(pileId) ?? [];
      const actualSize = renderSizeOf(member as never, nodes as never);
      const flow = screenToFlowPosition(dropScreenPoint);
      const position = { x: flow.x - actualSize.width / 2, y: flow.y - actualSize.height / 2 };
      const dissolved = members.length <= 2;
      store.removeNodeFromPile(pileId, memberId, position);
      const nextPile = useAppStore.getState().nodes.find((node) => node.id === pileId);
      return {
        position,
        actualSize,
        dissolved,
        remainingMemberIds: pileMemberIds(nextPile as unknown as AnyNode | undefined),
      };
    },
    [screenToFlowPosition],
  );

  /**
   * 官方 `It = (he,Ue) => { …eV(st,he,Ue)… ; return pt.includes(Ue) ? (Xe!==st&&Ge(Xe), {memberIds:pt}) : null }`
   * （`eV` = `Vlt`@2773948、`OS` = `FE`@2774159）。
   * ⚠️ MTV 偏离：官方 `Vlt` 在无变化时**返回同一引用**（`Xe!==st` 用来省一次落库）；
   *    MTV 的 `movePileMemberToFront` 一律返回新数组 ⇒ 改成比较 `memberIds` 是否逐项相同（结果等价）。
   */
  const moveMemberToTop = useCallback((pileId: string, memberId: string): PileMemberOrder | null => {
    const store = useAppStore.getState();
    const nodes = store.nodes as unknown as AnyNode[];
    const before = pileMemberIds(nodes.find((node) => node.id === pileId));
    const next = movePileMemberToFront(nodes, pileId, memberId);
    const memberIds = pileMemberIds(next.find((node) => node.id === pileId));
    if (!memberIds.includes(memberId)) return null;
    if (!sameIds(before, memberIds)) {
      store.commitToHistory();
      store.setNodes(next as never);
    }
    return { memberIds };
  }, []);

  /**
   * 官方 `on = he => { Re && Z(he,{taskInfo:null}) }` —— 清掉节点的 `taskInfo`（生成错误态）。
   * ⚠️ MTV 偏离：MTV 的 `BaseNodeData` **没有 `taskInfo` 字段**（`utils/officialPilePreviewContent.ts`
   *    的移植里也整段忽略了官方 `FYe(taskInfo)`），画廊里 `display.status.kind` 只可能是
   *    `'loading' | 'ready'`（`PileGallery.tsx`@330）⇒ 官方的错误动作按钮在 MTV 侧**永远不会出现**，
   *    没有可清的等价状态 ⇒ 保持官方禁用态 `DG` 的 no-op（官方：`updateNodeData(id,{taskInfo:null})`）。
   */
  const dismissMemberError = useCallback((_memberId: string): void => {
    /* 官方禁用态 `DG(){}` */
  }, []);

  const value = useMemo<PileMemberActions>(
    () => ({
      /**
       * 官方 `Re = !tt && de.enabled !== false`（`tt` = 协作编辑被锁；`de` = 远端 `pile` 策略）。
       * ⚠️ MTV 偏离：MTV 的画布无协作锁、也没有远端 `pile` 策略（`pileSelectedNodes` 传空 `{}`，
       *    即官方缺省 `lO = 50` / 默认类型表）⇒ 恒 `true`（官方不存在该策略时的取值同样是 `true`）。
       */
      enabled: true,
      canCreateFromSelection,
      createFromSelection,
      unpile,
      removeMember,
      moveMemberToTop,
      dismissMemberError,
    }),
    [canCreateFromSelection, createFromSelection, unpile, removeMember, moveMemberToTop, dismissMemberError],
  );

  return <PileMemberActionsProvider value={value}>{children}</PileMemberActionsProvider>;
}
