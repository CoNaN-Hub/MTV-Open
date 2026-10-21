/**
 * pileMemberActionsContext —— 官方 **PILE 成员操作上下文**（`zoom-slider-3ZcFvYQO.js`@2939490）。
 *
 * 官方逐字：
 * ```js
 * const mJ = h.createContext(null);                 // @2939673
 * function DG(){}                                   // noop
 * function FG(){ return !1 }                        // false
 * function JZe(){ return null }                     // removeMember 禁用态
 * function eQe(){ return null }                     // moveMemberToTop 禁用态
 * const tQe = { enabled:!1, canCreateFromSelection:FG, createFromSelection:FG,
 *               unpile:DG, removeMember:JZe, moveMemberToTop:eQe, dismissMemberError:DG };  // @2939490
 * function ect({value:e,children:t}){ return l.jsx(mJ.Provider,{value:e,children:t}) }     // provider
 * function gJ(){ return h.useContext(mJ) ?? tQe }                                          // hook
 * ```
 *
 * ★ 真实 value 在 `page-DPdEgTS0.js`@1460466 的 `us = useMemo(()=>({...}))`，字段顺序逐字：
 * ```js
 * us = useMemo(()=>({ enabled:Re, canCreateFromSelection:Ze, createFromSelection:nt, unpile:gt,
 *                     removeMember:wt, moveMemberToTop:It, dismissMemberError:on }),
 *               [Ze,nt,on,It,Re,wt,gt])
 * ```
 * 每个字段的官方实现与本文件的 TS 签名一一对应（调用点见下方各字段注释）。
 *
 * ⚠️ 为什么单独一个 `.ts`：`.tsx` 里只要导出**非组件**的东西，`react-refresh/only-export-components`
 *    就会报错（eslint 是提交门禁）⇒ context / hook / 缺省值放这里，
 *    Provider 组件（官方 `ect` → `PileMemberActionsProvider`）与 MTV 真实 value 的装配
 *    （`PileMemberActionsScope`）放在 `PileMemberActionsProvider.tsx`。
 *    （仓库既有同类做法：`nodes/pileGalleryContext.ts`、`hooks/useCanvasNodeLod.ts`。）
 */
import { createContext, useContext } from 'react';
import type { GalleryMemberSize } from '../../utils/officialPileGallery';

/**
 * 官方 `wt(pileId, memberId, screenCenter)` 的返回值（`page-DPdEgTS0.js`@1460146 逐字）：
 * ```js
 * return Ge(kt) ? { position:Rt, actualSize:ht, dissolved:St<=2, remainingMemberIds:Jt } : null
 * ```
 * `position` = 画布 flow 坐标下成员的**左上角**（官方 `Rt={x:Xe.x-w/2, y:Xe.y-h/2}`）。
 */
export interface PileMemberRemoval {
  position: { x: number; y: number };
  actualSize: GalleryMemberSize;
  dissolved: boolean;
  remainingMemberIds: string[];
}

/**
 * 官方 `It(pileId, memberId)` 的返回值：`pt.includes(Ue) ? {memberIds:pt} : null`
 * （`pt` = 改动后该堆叠的 `memberIds`）。
 */
export interface PileMemberOrder {
  memberIds: string[];
}

/**
 * 官方 `us`（真实 value）的 TS 形状 —— 字段名与官方逐字一致。
 *
 * 官方消费点（全量，bundle 内只有两处 `gJ()`）：
 *   · `WQe`@2955733（全屏画廊）`const {dismissMemberError:b, moveMemberToTop:v, removeMember:y} = gJ()`
 *       - `y(pileId, memberId, screenCenter)` @2960xxx 的 `_e` 内；
 *       - `v(pileId, memberId)` @2960xxx 的 `Je` 内；
 *       - `b` 只解构未调用（官方画廊当前无调用点）。
 *   · `uJe`@2983735（堆叠节点渲染器）`const f = gJ()`
 *       - `f.enabled`（`j = !a && f.enabled`）；
 *       - `f.unpile(pileId, previewExpansion, members)`（`X = () => f.unpile(e,q,C)`）；
 *       - `f.dismissMemberError(memberId)`（`Xe.onSelect`）。
 *   · `canCreateFromSelection` / `createFromSelection` 在官方 UI 中**只有定义、没有调用点**
 *     （`Te`@1444658 直接走 `E.createFromSelection(m)`，即 canvas 的 graphActions；grep 全 bundle 仅 1 处）。
 */
export interface PileMemberActions {
  /** 官方 `Re = !tt && de.enabled !== false`（`de` = 远端 `pile` 策略） */
  enabled: boolean;
  /** 官方 `Ze = he => Re ? X8(nodes, he, de) : false`（`X8` = `Glt`@2776878 建堆门） */
  canCreateFromSelection: (selectedIds: readonly string[]) => boolean;
  /** 官方 `nt = he => …Q8(nodes,he,de)…J8…Je(nextNodes,entryPlan)`（返回是否落库成功） */
  createFromSelection: (selectedIds: readonly string[]) => boolean;
  /**
   * 官方 `gt = (he,Ue,st) => …`（`he` = pileId，`Ue` = 展开倍数，`st` = 成员视图模型数组）。
   * 无动画计划时官方回落 `Ge(LS(nodes,he))`（= `$lt`@2779181 解堆）。
   */
  unpile: (pileId: string, expansion: number, members: readonly unknown[]) => void;
  /** 官方 `wt(pileId, memberId, screenCenter)`；`null` = 未处理（调用方回落「放回堆叠」） */
  removeMember: (
    pileId: string,
    memberId: string,
    dropScreenPoint: { x: number; y: number },
  ) => PileMemberRemoval | null;
  /** 官方 `It(pileId, memberId)`；`null` = 该成员不在此堆叠 */
  moveMemberToTop: (pileId: string, memberId: string) => PileMemberOrder | null;
  /** 官方 `on(memberId) = he => { Re && Z(he,{taskInfo:null}) }`（清节点的 `taskInfo`） */
  dismissMemberError: (memberId: string) => void;
}

/** 官方 `DG(){}` —— 公共 noop（`unpile` / `dismissMemberError` 的禁用态） */
function officialNoop(): void {
  /* 官方 `function DG(){}` */
}

/** 官方 `FG(){return !1}` —— 禁用态恒 `false`（`canCreateFromSelection` / `createFromSelection`） */
function officialFalse(): false {
  return false;
}

/** 官方 `JZe(){return null}` —— `removeMember` 禁用态 */
function disabledRemoveMember(): PileMemberRemoval | null {
  return null;
}

/** 官方 `eQe(){return null}` —— `moveMemberToTop` 禁用态 */
function disabledMoveMemberToTop(): PileMemberOrder | null {
  return null;
}

/**
 * 官方 `tQe`@2939490 —— **缺省（禁用）值**。
 * 导出给画廊当兜底：MTV 的画廊组件在没有 provider 时也应拿到与官方完全一致的禁用行为。
 */
export const DISABLED_PILE_MEMBER_ACTIONS: PileMemberActions = {
  enabled: false,
  canCreateFromSelection: officialFalse,
  createFromSelection: officialFalse,
  unpile: officialNoop,
  removeMember: disabledRemoveMember,
  moveMemberToTop: disabledMoveMemberToTop,
  dismissMemberError: officialNoop,
};

/** 官方 `const mJ = h.createContext(null)`@2939673 */
export const PileMemberActionsContext = createContext<PileMemberActions | null>(null);

/** 官方 `gJ()`@2939707 —— `useContext(mJ) ?? tQe`（**不抛错**，缺 provider 就是禁用态） */
export function usePileMemberActions(): PileMemberActions {
  return useContext(PileMemberActionsContext) ?? DISABLED_PILE_MEMBER_ACTIONS;
}
