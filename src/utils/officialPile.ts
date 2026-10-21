/**
 * officialPile —— 官方 **PILE（堆叠）** 的纯函数层，逐字移植。
 *
 * 官方出处（只读 `E:\TapNow-0.4.66\resources\web\assets\`）：
 *   `zoom-slider-3ZcFvYQO.js` 的堆叠段落 @char2771505 … @char2779800。
 *   枚举在 `index-BiTZf8mJ.js`@char6649946：`t.PILE="pile"`（`he.PILE`）。
 *   完整抽取报告：`D:\DEEPSEEK\official-pile-spec.md`（1075 行）。
 *
 * ★★ 与 MTV 现有「分组」最大的不同（也是必须单独一套函数的原因）：
 *   官方 PILE **不用 `parentId`** —— 成员是**平铺的顶层节点**，
 *   归属关系只存在堆叠节点自己的 `data.memberIds: string[]`（顺序 = z-order / 层叠顺序）。
 *
 * ⚠️ 本文件只放 **官方逐字** 的算法；不含任何自造规则。
 *   渲染器（`uJe`）与投影层（`pJe`）尚未移植，见 `AGENTS.md`「官方 PILE 规格」。
 */
import type { Node as RFNode } from '@xyflow/react';
import type { BaseNodeData } from '../types';

/* ══════════════════════════════════════════════════════════════════════════
   常量（全部官方逐字）
   ══════════════════════════════════════════════════════════════════════════ */

/** 官方 `he.PILE`（`index-BiTZf8mJ.js`@6649946 的 `Jc` 枚举：`t.PILE="pile"`） */
export const PILE_NODE_TYPE = 'pile';
/** 官方 `hqe` 的 id 模板：`` `${he.PILE}-${hr()}` `` */
export const PILE_ID_PREFIX = 'pile-';
/** 官方 `lO = 50` @2773751 —— 默认 `maxMembers`（远端策略钳制上界也是 50） */
export const PILE_MAX_MEMBERS = 50;
/** 官方 `wQ = [he.IMAGE, he.VIDEO, he.AUDIO, he.TEXT]` @2773751 —— 默认可堆叠类型 */
export const PILE_ALLOWED_MEMBER_TYPES: readonly string[] = ['image', 'video', 'audio', 'text'];
/** 官方 `vC = 128` @2772373 —— 平铺（fan/grid）时的成员间距 */
export const PILE_FAN_GAP = 128;
/** 官方 `mG = 320` @2771505 —— 文本节点封面尺寸的上限（`eqe` 用它等比缩） */
export const PILE_TEXT_COVER_MAX = 320;
/** 官方 `oL` 附近的成员投影类名 @2987562（逐字三个） */
export const PILE_MEMBER_ANCHOR_CLASS = 'pile-member-anchor';
export const PILE_LANDING_NODE_CLASS = 'pile-landing-node';
export const PILE_UNSTACK_EDGE_CLASS = 'pile-unstack-edge-waiting';
/** 官方 `Dk = 38` @2938675 —— 堆叠工具条上方的 hover 桥高度 */
export const PILE_TOOLBAR_BRIDGE_HEIGHT = 38;
/** 官方 `sJe = 200` @2981492 —— 工具条 hover 收起延迟 ms */
export const PILE_TOOLBAR_HIDE_DELAY = 200;
/** 官方 `x0 = [0,.18,.3,.42,.54]` @2809723 —— 层叠动画的延迟档 */
export const PILE_STAGGER_STEPS: readonly number[] = [0, 0.18, 0.3, 0.42, 0.54];

/**
 * 官方 PILE 渲染器（`uJe`@2983735）用到的**全部 className 逐字**（`official-pile-spec.md` §5.2）。
 * 放进常量是为了让渲染组件只做拼装、不夹带任何自造字面量。
 */
export const PILE_RENDER_CLASSES = {
  /** 外层根 div */
  root: 'group relative size-full outline-none',
  /** 外层根 div 的禁用附加类（`c.isDisabled &&`） */
  rootDisabled: 'node-disabled-blur cursor-not-allowed',
  /** 成员列表容器 */
  memberList: 'relative size-full',
  /** 成员列表容器（画廊打开 / 解堆计划中 ⇒ `invisible`） */
  memberListHidden: 'relative size-full invisible',
  /** 单个成员的 motion div */
  member: 'pointer-events-none absolute left-1/2 top-1/2 origin-center',
  /** 空堆叠（`pile.empty`） */
  empty:
    'absolute left-1/2 top-1/2 flex h-[196px] w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-card text-sm text-muted-foreground',
  /** 成员预览（官方 `YZe` 的根） */
  previewRoot: 'group/display-node relative size-full overflow-hidden rounded-xl',
  /** 成员预览最外那圈 1px 描边 */
  previewBorder: 'pointer-events-none absolute inset-0 z-20 rounded-[inherit] border border-white/10',
  /** 生成中：压暗层 */
  previewLoadingShade: 'absolute inset-0 overflow-hidden rounded-xl bg-black/35',
  /** 生成中：扫光条（配 CSS 里的 `@keyframes pile-shimmer`） */
  previewShimmer:
    'absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent motion-safe:animate-[pile-shimmer_1.4s_cubic-bezier(0.25,1,0.5,1)_infinite]',
  /** 成员预览的标题行（官方 `ZZe`） */
  previewTitleRow: 'mb-2 flex h-4 max-w-full items-center gap-1 text-xs leading-4 text-muted-foreground',
  /** 预览遮罩（官方 `fJ`） */
  shade: 'pointer-events-none absolute inset-0 z-20 rounded-xl bg-[#080B10]',
  /**
   * 成员预览上的**操作行**（官方 `pJ` @2932627，`zZe`/`$Ze` 都用它包 `actions`）：
   * 默认不可见、`group-hover/display-node` / `group-focus-within/display-node` 才显形
   * （`group/display-node` 由 `previewRoot` 提供）。`onPointerDown`/`onClick` = 官方 `PG` @2932192
   * （`e.stopPropagation()`，别让点击穿透成「打开媒体查看器」）。
   */
  previewActions:
    'nodrag nopan pointer-events-none absolute left-3 top-3 z-30 flex gap-1 opacity-0 group-hover/display-node:pointer-events-auto group-hover/display-node:opacity-100 group-focus-within/display-node:pointer-events-auto group-focus-within/display-node:opacity-100',
  /**
   * 预览操作行里的**方形小按钮**（官方 `hJ` @2932227；收藏按钮 `oQe` 唯一使用处）。
   * 逐字：`flex size-7 cursor-pointer items-center justify-center rounded-[10px] bg-black/50
   * text-[#F5F5F5] transition-[background-color,opacity] hover:bg-black/70 focus-visible:outline-none
   * focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60
   * motion-reduce:transition-none`。
   */
  previewActionButton:
    'flex size-7 cursor-pointer items-center justify-center rounded-[10px] bg-black/50 text-[#F5F5F5] transition-[background-color,opacity] hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
  /** 工具条上方的 hover 桥（官方 `QZe`） */
  toolbarBridge: 'nodrag pointer-events-auto absolute inset-x-0 z-10',
  /** `--pile-toolbar-scale` 缩放层（官方 `QZe`） */
  toolbarScaleLayer: 'absolute left-1/2 size-0 origin-bottom',
} as const;

/** 官方 `Dk = 38` @2938675 —— 工具条上方的 hover 桥高度（px） */
export const PILE_TOOLBAR_BRIDGE_TOP = -PILE_TOOLBAR_BRIDGE_HEIGHT;

/** 官方 `iJe = .6` @2982627 —— 打开**堆叠全屏画廊**时写死的 `initialZoom`
 *  （`uJe` 的 `ne` 回调逐字：`g({…, initialZoom: iJe, previewMode:"source"})`） */
export const PILE_GALLERY_INITIAL_ZOOM = 0.6;

/** 官方 `vG = 8` @2809723 —— 溢出的成员缩进封面时留的边距（`fO` 用） */
export const PILE_STACK_INSET = 8;

/**
 * 官方 `wC(mode, t = 1)` @2809723 —— **预览展开倍率**。
 * 它同时被 `xG` 当作层叠位移/旋转的倍率：`compact` 时是 1（不展开）。
 * 官方 `dJe` 把状态映射成 `"compact" | "drop-target" | "interactive"`。
 */
export const PILE_PREVIEW_EXPANSION: Readonly<Record<string, number>> = {
  compact: 1,
  interactive: 2,
  'drop-target': 2.35,
};

/** 官方 `wC(e,t=1)`：`source` 用传入的 `t`（= 画廊快照的 `previewExpansion`） */
export function pilePreviewExpansion(mode: string, base = 1): number {
  if (mode === 'source') return base;
  return PILE_PREVIEW_EXPANSION[mode] ?? 1;
}

/** 官方 `qM(e,t)` @2809723 —— 层叠入场/解堆的**逐层延迟档**（`x0`，从正面往后再往回数） */
export function pileStaggerStep(index: number, count: number): number {
  if (index < 0) return PILE_STAGGER_STEPS[PILE_STAGGER_STEPS.length - 1];
  const n = Math.max(count - index - 1, 0);
  return PILE_STAGGER_STEPS[Math.min(n, PILE_STAGGER_STEPS.length - 1)];
}

/**
 * 官方 `xG(index, count, expansion)` @2809723 —— **单层的位移/旋转**。
 *
 * ```js
 * function xG(e,t,n){
 *   const r = yG[t]?.[e] ?? yG[1][0],      // 摆位表；越界回落第 1 层
 *         o = e === t-1,                   // 是不是**正面**那张
 *         i = Math.max(n-1, 0),
 *         a = o ? -8*i : 0;                // 只有正面那张会随展开倍数往上抬 8px/级
 *   return { x: r.x*n, y: r.y*n + a, rotate: r.rotation*n };
 * }
 * ```
 * ⚠️ 注意字段名：官方这里叫 **`rotate`**（不是 `rotation`）—— 摆位表 `yG` 里才叫 `rotation`。
 */
export function pileStackOffset(
  index: number,
  count: number,
  expansion = 1,
): { x: number; y: number; rotate: number } {
  const base = PILE_STACK_OFFSETS[count]?.[index] ?? PILE_STACK_OFFSETS[1][0];
  const isFront = index === count - 1;
  const levels = Math.max(expansion - 1, 0);
  const lift = isFront ? -PILE_STACK_INSET * levels : 0;
  return { x: base.x * expansion, y: base.y * expansion + lift, rotate: base.rotation * expansion };
}

export interface PileStackPlacement {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  zIndex: number;
}

/**
 * 官方 `fO({memberSize, coverSize, visibleIndex, visibleCount, expansion})` @2809723 ——
 * **每个成员最终摆在哪、多大、压在第几层**。
 *
 * ```js
 * function fO({memberSize,coverSize,visibleIndex,visibleCount,expansion}){
 *   if (visibleIndex >= 0) return { ...xG(visibleIndex,visibleCount,expansion), scale:1, zIndex:visibleIndex+1 };
 *   const o = xG(0,visibleCount,expansion);
 *   if (!coverSize) return { ...o, scale:1, zIndex:0 };
 *   const i = Math.max(coverSize.width  - vG*2, 1),
 *         a = Math.max(coverSize.height - vG*2, 1),
 *         c = Math.min(i/Math.max(memberSize.width,1), a/Math.max(memberSize.height,1), 1);
 *   return { ...o, scale:c, zIndex:0 };
 * }
 * ```
 * ⇒ 「正面 5 张」`visibleIndex = 0..count-1`（`zIndex = index+1`，正面最大）；
 *   溢出的成员传 `visibleIndex = -1`，被缩到封面内、`zIndex = 0`（压在最底下）。
 */
export function pileStackPlacement(input: {
  memberSize: { width: number; height: number };
  coverSize: { width: number; height: number } | null;
  visibleIndex: number;
  visibleCount: number;
  expansion: number;
}): PileStackPlacement {
  const { memberSize, coverSize, visibleIndex, visibleCount, expansion } = input;
  if (visibleIndex >= 0) {
    return { ...pileStackOffset(visibleIndex, visibleCount, expansion), scale: 1, zIndex: visibleIndex + 1 };
  }
  const base = pileStackOffset(0, visibleCount, expansion);
  if (!coverSize) return { ...base, scale: 1, zIndex: 0 };
  const innerWidth = Math.max(coverSize.width - PILE_STACK_INSET * 2, 1);
  const innerHeight = Math.max(coverSize.height - PILE_STACK_INSET * 2, 1);
  const scale = Math.min(
    innerWidth / Math.max(memberSize.width, 1),
    innerHeight / Math.max(memberSize.height, 1),
    1,
  );
  return { ...base, scale, zIndex: 0 };
}

export interface PileStackLayer extends PileStackPlacement {
  /** 成员节点 id */
  id: string;
  /** 该成员在**最后 ≤5 个**里的下标；`-1` = 溢出（不在正面那张摞里） */
  visibleIndex: number;
  /** 逐层动画延迟档（官方 `qM`） */
  staggerStep: number;
}

/**
 * 把「最后 ≤5 个成员」（官方 `_l`）算成**一摞卡片的摆位**。
 *
 * ⚠️ 与官方一致：可见的那几张按 `_l` 的顺序 `visibleIndex = 0..n-1`，
 * 而**正面**（`zIndex` 最大）是 `_l` 的**最后一个**。
 * 溢出的成员（`_l` 之外）官方在 `fO` 里传 `visibleIndex = -1`（缩进封面、压最底层）。
 */
export function pileStackLayers(
  visibleIds: readonly string[],
  allMemberIds: readonly string[],
  sizeOfMember: (id: string) => { width: number; height: number },
  coverSize: { width: number; height: number } | null,
  expansion = 1,
): PileStackLayer[] {
  const visibleSet = new Set(visibleIds);
  const layers: PileStackLayer[] = visibleIds.map((id, index) => ({
    id,
    visibleIndex: index,
    ...pileStackPlacement({
      memberSize: sizeOfMember(id),
      coverSize,
      visibleIndex: index,
      visibleCount: visibleIds.length,
      expansion,
    }),
    staggerStep: pileStaggerStep(index, visibleIds.length),
  }));
  for (const id of allMemberIds) {
    if (visibleSet.has(id)) continue;
    layers.push({
      id,
      visibleIndex: -1,
      ...pileStackPlacement({
        memberSize: sizeOfMember(id),
        coverSize,
        visibleIndex: -1,
        visibleCount: visibleIds.length,
        expansion,
      }),
      staggerStep: pileStaggerStep(-1, visibleIds.length),
    });
  }
  return layers;
}


/**
 * 官方 `yG` @2809723 —— **层叠摆位表**（按成员数 1..5 给出每层的 `{x,y,rotation}`）。
 * 注意：数组**最后一项**永远是 `{x:0,y:0,rotation:0}`（正面那张），
 * 前面的项向两侧散开并轻微旋转 ⇒ 这就是「一摞卡片」的观感来源。
 */
export const PILE_STACK_OFFSETS: Readonly<Record<number, ReadonlyArray<{ x: number; y: number; rotation: number }>>> = {
  1: [{ x: 0, y: 0, rotation: 0 }],
  2: [{ x: -14, y: 5, rotation: -3.5 }, { x: 0, y: 0, rotation: 0 }],
  3: [{ x: -18, y: 6, rotation: -4 }, { x: 18, y: 7, rotation: 4 }, { x: 0, y: 0, rotation: 0 }],
  4: [
    { x: -24, y: 9, rotation: -5 },
    { x: 24, y: 10, rotation: 5 },
    { x: -11, y: 4, rotation: -2.5 },
    { x: 0, y: 0, rotation: 0 },
  ],
  5: [
    { x: -28, y: 11, rotation: -5.5 },
    { x: 28, y: 12, rotation: 5.5 },
    { x: -14, y: 5, rotation: -3 },
    { x: 14, y: 6, rotation: 3 },
    { x: 0, y: 0, rotation: 0 },
  ],
};

/** 官方 `JNe = new Set([COMMAND, GROUP, PILE, COMMENT])` @1068128 —— 这几类**不参与**入场动画 */
export const PILE_PRESENCE_SKIP = true;

export interface PilePlanOptions {
  /** 官方 `n.enabled`（远端策略 `pile.enabled`）；`false` 直接判不可建 */
  enabled?: boolean;
  /** 官方 `n.allowedMemberTypes ?? wQ` */
  allowedMemberTypes?: readonly string[];
  /** 官方 `n.maxMembers ?? lO` */
  maxMembers?: number;
}

export type PileNode = RFNode<BaseNodeData> & { type: typeof PILE_NODE_TYPE };
export type AnyNode = RFNode<BaseNodeData>;

/* ══════════════════════════════════════════════════════════════════════════
   尺寸 / 坐标助手（官方 `yr` / `_i` / `vr` / `U6` 的 MTV 落地）
   ══════════════════════════════════════════════════════════════════════════ */

type SizeGetter = (node: AnyNode) => { width: number; height: number };

/** 官方 `oO(e)`：`{width:Math.max(yr(e),1),height:Math.max(_i(e),1)}` */
export function pileRenderSize(node: AnyNode, sizeOf: SizeGetter): { width: number; height: number } {
  const size = sizeOf(node);
  return { width: Math.max(size.width, 1), height: Math.max(size.height, 1) };
}

/** 官方 `eqe(e,t)`：文本节点按 `mG = 320` 等比缩（非文本原样返回） */
export function pileTextClamp(
  node: AnyNode,
  size: { width: number; height: number },
): { width: number; height: number } {
  if (nodeTypeOf(node) !== 'text') return size;
  const scale = Math.min(PILE_TEXT_COVER_MAX / size.width, PILE_TEXT_COVER_MAX / size.height, 1);
  return { width: size.width * scale, height: size.height * scale };
}

/** 官方 `mh(e)` = `eqe(e, oO(e))` —— 单个成员的「封面尺寸」 */
export function pileDisplaySize(node: AnyNode, sizeOf: SizeGetter): { width: number; height: number } {
  return pileTextClamp(node, pileRenderSize(node, sizeOf));
}

/** 官方 `_l(e)` = `e.slice(-5)` —— 只取**最后 5 个**参与封面尺寸计算 */
export function pileLastFive<T>(items: readonly T[]): T[] {
  return items.slice(-5);
}

/** 官方 `iO(e)`：封面尺寸 = 最后 ≤5 个成员的 max 宽 / max 高（空则 `{0,0}`） */
export function pileCoverSize(
  sizes: ReadonlyArray<{ width: number; height: number }>,
): { width: number; height: number } {
  const last = pileLastFive(sizes);
  if (last.length === 0) return { width: 0, height: 0 };
  return {
    width: Math.max(...last.map((s) => s.width)),
    height: Math.max(...last.map((s) => s.height)),
  };
}

/** 官方 `aO(e)`：堆叠节点的中心（`position + 自身尺寸/2`） */
export function pileCenter(node: AnyNode, sizeOf: SizeGetter): { x: number; y: number } {
  const size = sizeOf(node);
  return { x: node.position.x + size.width / 2, y: node.position.y + size.height / 2 };
}

/** 官方 `kg(e,t)`：以旧中心为锚，把堆叠节点改成新封面尺寸（尺寸不变则原样返回） */
export function recenterPile(
  pile: AnyNode,
  coverSizes: ReadonlyArray<{ width: number; height: number }>,
  sizeOf: SizeGetter,
): AnyNode {
  const cover = pileCoverSize(coverSizes);
  /* 空堆叠（成员全没了）不归一化，免得把节点收成 0×0 */
  if (cover.width <= 0 || cover.height <= 0) return pile;
  const size = sizeOf(pile);
  /* ★★★ 修（用户报的「堆叠卡 + 工具条 反复闪烁 / 看着像两个工具栏」的**根因**）★
     `sizeOf` 是 `renderSizeOf` = **`measured` 优先**，而 React Flow 每渲染一帧就把量到的 DOM 尺寸
     写回 `measured` ⇒ 只拿 `size` 跟封面比就早退的话，节点会带着**创建时的旧 `width/height`** 原样返回。
     于是两帧一循环（实测每 ~200ms 翻一次、一直在翻）：
       wrapper=旧width/height(444×592) → RF 量到 444×592 写回 measured
         → 本函数读到 size=444×592 ≠ cover(250×333) → 规范化成 cover
         → wrapper=250×333 → RF 量到 250×333 写回 measured
         → 本函数读到 size=250×333 === cover ⇒ **早退**，width/height 又变回旧的 444×592 → 回到第一步
     堆叠根是 `size-full`（100% 撑满 wrapper）、工具条又锚在卡顶边 ⇒ 卡和工具条一起上下跳（还带着
     工具条缩放层 `--pile-toolbar-scale` 一起缩放，所以宽度也在 91↔175 之间跳）＝ 用户看到的「闪烁」。
     ⇒ **渲染尺寸只认 cover**：早退必须同时要求节点自身的 `width/height` 已经是 cover，
        否则一律把 `width/height` 规范化写回（`pile.width` 是 store 里的旧值，这里必须覆盖它）。 */
  if (
    size.width === cover.width && size.height === cover.height
    && pile.width === cover.width && pile.height === cover.height
  ) {
    return pile;
  }
  const center = pileCenter(pile, sizeOf);
  return {
    ...pile,
    position: { x: center.x - cover.width / 2, y: center.y - cover.height / 2 },
    width: cover.width,
    height: cover.height,
  } as AnyNode;
}

/**
 * 官方 `vr(e,t,n,s)` @422656 —— **递归求绝对坐标**（沿 `parentId` 链累加）。
 * 带环检测（`visiting` 集合）与缓存，官方逐字语义。
 */
export function pileAbsolutePosition(
  node: AnyNode,
  byId: ReadonlyMap<string, AnyNode>,
  cache?: Map<string, { x: number; y: number }>,
  visiting?: Set<string>,
): { x: number; y: number } {
  if (cache?.has(node.id)) return cache.get(node.id)!;
  const seen = visiting ?? new Set<string>();
  if (seen.has(node.id)) {
    const self = { ...node.position };
    cache?.set(node.id, self);
    return self;
  }
  seen.add(node.id);
  if (!node.parentId) {
    const self = { ...node.position };
    cache?.set(node.id, self);
    seen.delete(node.id);
    return self;
  }
  const parent = byId.get(node.parentId);
  if (!parent) {
    const self = { ...node.position };
    cache?.set(node.id, self);
    seen.delete(node.id);
    return self;
  }
  const parentPos = pileAbsolutePosition(parent, byId, cache, seen);
  const abs = { x: node.position.x + parentPos.x, y: node.position.y + parentPos.y };
  cache?.set(node.id, abs);
  seen.delete(node.id);
  return abs;
}

/** 官方 `U6(e,t)` = 位置相减 */
export function subtractPosition(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: a.x - b.x, y: a.y - b.y };
}

/* ══════════════════════════════════════════════════════════════════════════
   成员归属索引 / 类型门
   ══════════════════════════════════════════════════════════════════════════ */

/** 官方 `FE(pile)` @2774159 —— 去重、丢非字符串、保序 */
export function pileMemberIds(pile: AnyNode | undefined | null): string[] {
  if (pile?.type !== PILE_NODE_TYPE) return [];
  const raw = (pile.data as { memberIds?: unknown } | undefined)?.memberIds;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * ★ MTV 节点类型 → **官方节点类型名**。
 *
 * 官方 `he.IMAGE/VIDEO/AUDIO/TEXT` 的字面量就是 `"image" / "video" / "audio" / "text"`；
 * 而 MTV 的 React Flow 类型名带 `ai-` / `source-` 前缀（见 `components/Canvas.tsx:146` 的
 * `nodeTypes`：`ai-image` / `source-image` / `ai-video` / `source-video` / `ai-audio` /
 * `source-audio` / `ai-text` / `source-text`）。
 * ⇒ 必须显式归一，否则 `wQ` 一个都匹配不上，「堆叠」按钮永远不会出现（实测踩过）。
 * 归一后**不在表里的**一律视为不可堆叠（如 `group` / `canvas-note` / `comment` /
 * `ai-animation` / `ai-panorama` / `ai-storyboard` / `plugin-node` / `command-menu`）。
 */
const MTV_TO_OFFICIAL_NODE_TYPE: Readonly<Record<string, string>> = {
  'ai-image': 'image',
  'source-image': 'image',
  image: 'image',
  'ai-video': 'video',
  'source-video': 'video',
  video: 'video',
  'ai-audio': 'audio',
  'source-audio': 'audio',
  audio: 'audio',
  'ai-text': 'text',
  'source-text': 'text',
  text: 'text',
};

/** 节点在 MTV 里的 `type`（RF）优先，其次 `data.type`；返回**官方口径**的小写类型名或 `undefined` */
function nodeTypeOf(node: AnyNode): string | undefined {
  const raw =
    (typeof node.type === 'string' ? node.type : undefined) ??
    (node.data as { type?: unknown } | undefined)?.type;
  if (typeof raw !== 'string') return undefined;
  return MTV_TO_OFFICIAL_NODE_TYPE[raw.toLowerCase()];
}

/** 官方 `CQ(e)` @2774361 —— 类型属于默认 `wQ` */
export function isPileableNode(node: AnyNode): boolean {
  const type = nodeTypeOf(node);
  return type !== undefined && PILE_ALLOWED_MEMBER_TYPES.some((t) => t === type);
}

/** 官方 `cO(e,t)` @2774435 —— `CQ(e) && (t.allowedMemberTypes ?? wQ).includes(type)` */
export function isAllowedPileMember(node: AnyNode, options: PilePlanOptions = {}): boolean {
  const type = nodeTypeOf(node);
  if (type === undefined || !isPileableNode(node)) return false;
  const allowed = options.allowedMemberTypes ?? PILE_ALLOWED_MEMBER_TYPES;
  return allowed.some((t) => t.toLowerCase() === type);
}

export interface PileIndex {
  /** 节点 id → 它所属堆叠的 id（同时属于多个时取**字典序最小**的堆叠） */
  pileIdByNodeId: Map<string, string>;
  /** 堆叠 id → 成员节点（已按 `FE` 清洗，且剔除不合法/嵌套堆叠的成员） */
  membersByPileId: Map<string, AnyNode[]>;
}

/** 官方 `qa(e,t)` @2774575 —— 成员归属索引（一个节点只归一个堆叠：id 字典序最小者） */
export function buildPileIndex(
  nodes: readonly AnyNode[],
  byId: ReadonlyMap<string, AnyNode> = new Map(nodes.map((n) => [n.id, n])),
): PileIndex {
  const pileIdByNodeId = new Map<string, string>();
  const membersByPileId = new Map<string, AnyNode[]>();
  for (const node of nodes) {
    if (node.type !== PILE_NODE_TYPE) continue;
    for (const memberId of pileMemberIds(node)) {
      const member = byId.get(memberId);
      if (!member || member.type === PILE_NODE_TYPE || !isPileableNode(member)) continue;
      const claimed = pileIdByNodeId.get(memberId);
      if (!claimed || node.id < claimed) pileIdByNodeId.set(memberId, node.id);
    }
  }
  for (const node of nodes) {
    if (node.type !== PILE_NODE_TYPE) continue;
    const members: AnyNode[] = [];
    for (const memberId of pileMemberIds(node)) {
      if (pileIdByNodeId.get(memberId) !== node.id) continue;
      const member = byId.get(memberId);
      if (member) members.push(member);
    }
    membersByPileId.set(node.id, members);
  }
  return { pileIdByNodeId, membersByPileId };
}

/** 官方 `lqe(e,t)` @2775003 */
export function pileMembersOf(pile: AnyNode, nodes: readonly AnyNode[]): AnyNode[] {
  return buildPileIndex(nodes).membersByPileId.get(pile.id) ?? [];
}

/** 官方 `SQ(e,t,n)` @2775064 —— 「这个节点能被吸进堆叠吗」 */
export function canAbsorbIntoPile(
  node: AnyNode,
  pileIdByNodeId: ReadonlyMap<string, string>,
  options: PilePlanOptions = {},
): boolean {
  if (options.enabled === false) return false;
  if (pileIdByNodeId.has(node.id)) return false;
  return isAllowedPileMember(node, options);
}

/* ══════════════════════════════════════════════════════════════════════════
   建堆计划（官方 `EQ` / `pqe`）
   ══════════════════════════════════════════════════════════════════════════ */

export interface PileSource {
  node: AnyNode;
  members: AnyNode[];
}

export interface PilePlan {
  sources: PileSource[];
  members: AnyNode[];
  targetParentId: string | undefined;
  targetGlobalPosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
}

/** 官方 `cqe(e,t,n)` @2775217 —— 包围盒中心（用 `oO` 的真实渲染尺寸） */
function sourcesBoundingCenter(
  sources: readonly PileSource[],
  cover: { width: number; height: number },
  byId: ReadonlyMap<string, AnyNode>,
  sizeOf: SizeGetter,
): { x: number; y: number } {
  const cache = new Map<string, { x: number; y: number }>();
  const boxes = sources.map(({ node }) => {
    const pos = pileAbsolutePosition(node, byId, cache);
    const size = pileRenderSize(node, sizeOf);
    return { left: pos.x, top: pos.y, right: pos.x + size.width, bottom: pos.y + size.height };
  });
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.right));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  return { x: (left + right - cover.width) / 2, y: (top + bottom - cover.height) / 2 };
}

/** 官方 `dqe(e,t)` @2775404 —— 所有来源共享的父节点（且该父节点必须存在于图里） */
function commonParentOf(sources: readonly PileSource[], byId: ReadonlyMap<string, AnyNode>): string | undefined {
  const parentId = sources[0]?.node.parentId;
  if (parentId && sources.every((s) => s.node.parentId === parentId)) {
    return byId.has(parentId) ? parentId : undefined;
  }
  return undefined;
}

/** 官方 `uqe(e,t,n)` @2775495 —— 把「全局坐标」换算成目标父节点下的**相对坐标** */
function toParentLocal(
  position: { x: number; y: number },
  parentId: string | undefined,
  byId: ReadonlyMap<string, AnyNode>,
): { x: number; y: number } {
  if (!parentId) return position;
  const parent = byId.get(parentId);
  if (!parent) return position;
  return subtractPosition(position, pileAbsolutePosition(parent, byId));
}

/** 官方 `vT(e,t)` @2775132 —— 被吸收的节点一律**脱父**并转成绝对坐标 */
export function releaseFromParents(
  nodes: readonly AnyNode[],
  ids: readonly string[],
  byId: ReadonlyMap<string, AnyNode> = new Map(nodes.map((n) => [n.id, n])),
): Map<string, AnyNode> {
  const idSet = new Set(ids);
  const out = new Map<string, AnyNode>();
  for (const node of nodes) {
    if (!idSet.has(node.id)) continue;
    if (!node.parentId && (node as { extent?: unknown }).extent === undefined) {
      out.set(node.id, node);
      continue;
    }
    out.set(node.id, {
      ...node,
      parentId: undefined,
      extent: undefined,
      position: pileAbsolutePosition(node, byId),
    } as AnyNode);
  }
  return out;
}

/**
 * 官方 `EQ(e,t,n)` @2775938 —— **建堆结构门 + 计划**（返回 `null` = 不可建）。
 * 逐条：`enabled !== false` → 每个选中 id 都在图里 →
 * 选中的 PILE 必须有成员且成员全合法 / 选中的非 GROUP 必须过 `SQ` / GROUP 整块跳过 →
 * 去重成员数 `≥2` 且 `≤ maxMembers ?? 50`。
 */
export function planPile(
  nodes: readonly AnyNode[],
  selectedIds: readonly string[],
  options: PilePlanOptions = {},
  sizeOf: SizeGetter,
): PilePlan | null {
  const selected = [...new Set(selectedIds)];
  if (options.enabled === false) return null;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const index = buildPileIndex(nodes, byId);
  const sources: PileSource[] = [];
  for (const id of selected) {
    const node = byId.get(id);
    if (!node) return null;
    if (node.type !== 'group') {
      if (node.type === PILE_NODE_TYPE) {
        const members = index.membersByPileId.get(node.id) ?? [];
        if (members.length === 0 || !members.every((m) => isAllowedPileMember(m, options))) return null;
        sources.push({ node, members });
        continue;
      }
      if (!canAbsorbIntoPile(node, index.pileIdByNodeId, options)) return null;
      sources.push({ node, members: [node] });
    }
  }
  if (sources.length < 2) return null;
  const deduped = new Map<string, AnyNode>();
  for (const source of sources) for (const member of source.members) if (!deduped.has(member.id)) deduped.set(member.id, member);
  const members = [...deduped.values()];
  const maxMembers = options.maxMembers ?? PILE_MAX_MEMBERS;
  if (members.length < 2 || members.length > maxMembers) return null;

  const cover = pileCoverSize(members.map((m) => pileDisplaySize(m, sizeOf)));
  const targetGlobalPosition = sourcesBoundingCenter(sources, cover, byId, sizeOf);
  const targetParentId = commonParentOf(sources, byId);
  const targetPosition = toParentLocal(targetGlobalPosition, targetParentId, byId);
  return { sources, members, targetParentId, targetGlobalPosition, targetPosition };
}

/** 官方 `Glt(e,t,n)` @2776878 */
export function canCreatePile(
  nodes: readonly AnyNode[],
  selectedIds: readonly string[],
  options: PilePlanOptions = {},
  sizeOf: SizeGetter,
): boolean {
  return planPile(nodes, selectedIds, options, sizeOf) !== null;
}

export interface PileCreation {
  nextNodes: AnyNode[];
  targetPile: AnyNode;
  targetGlobalPosition: { x: number; y: number };
  sources: PileSource[];
}

/** 官方 `hqe(e,t,n,s)` @2776694 —— 唯一的堆叠节点工厂 */
export function createPileNode(
  memberIds: readonly string[],
  position: { x: number; y: number },
  size: { width: number; height: number },
  parentId: string | undefined,
  uid: string,
): AnyNode {
  return {
    id: `${PILE_ID_PREFIX}${uid}`,
    type: PILE_NODE_TYPE,
    position,
    width: size.width,
    height: size.height,
    parentId,
    selected: false,
    data: { memberIds: [...memberIds], type: 'pile' },
  } as unknown as AnyNode;
}

/**
 * 官方 `pqe(e,t,n)` @2776891 —— 建堆：
 * 被完全吸收的**来源堆叠节点会被移除**，成员脱父，新堆叠节点**追加在最后**。
 */
export function createPileFromSelection(
  nodes: readonly AnyNode[],
  selectedIds: readonly string[],
  uid: string,
  options: PilePlanOptions = {},
  sizeOf: SizeGetter,
): PileCreation | null {
  const plan = planPile(nodes, selectedIds, options, sizeOf);
  if (!plan) return null;
  const { sources, members, targetGlobalPosition, targetParentId, targetPosition } = plan;
  const memberIds = members.map((m) => m.id);
  const cover = pileCoverSize(members.map((m) => pileDisplaySize(m, sizeOf)));
  const targetPile = createPileNode(memberIds, targetPosition, cover, targetParentId, uid);
  const released = releaseFromParents(nodes, memberIds);
  const absorbedPileIds = new Set(
    sources.filter((s) => s.node.type === PILE_NODE_TYPE).map((s) => s.node.id),
  );
  const nextNodes = nodes.flatMap((n) => (absorbedPileIds.has(n.id) ? [] : [released.get(n.id) ?? n]));
  nextNodes.push(targetPile);
  return { nextNodes, targetPile, targetGlobalPosition, sources };
}

/** 官方 `fqe(e,t,n)` @2777291 */
export function applyPileCreation(
  nodes: readonly AnyNode[],
  selectedIds: readonly string[],
  uid: string,
  options: PilePlanOptions = {},
  sizeOf: SizeGetter,
): AnyNode[] {
  return createPileFromSelection(nodes, selectedIds, uid, options, sizeOf)?.nextNodes ?? [...nodes];
}

/* ══════════════════════════════════════════════════════════════════════════
   平铺（fan/grid）布局 —— 官方 `tqe` / `nqe` / `sqe` / `rqe` / `oqe` / `iqe`
   ══════════════════════════════════════════════════════════════════════════ */

/** 官方 `tqe(e)` @2772380 —— 行数分配顺序（离中心最近的行先加） */
export function centerFirstOrder(count: number): number[] {
  const center = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => i).sort(
    (a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b,
  );
}

/** 官方 `nqe(e)` @2772380 —— 把 e 个成员分成接近方阵的行 */
export function pileRowCounts(count: number): number[] {
  if (count <= 0) return [];
  const columns = Math.max(1, Math.round(Math.sqrt(count)));
  const base = Math.floor(count / columns);
  const remainder = count % columns;
  const rows = Array.from({ length: columns }, () => base);
  const order = centerFirstOrder(columns);
  for (let i = 0; i < remainder; i += 1) rows[order[i]] += 1;
  return rows;
}

export interface PileSlot {
  rowIndex: number;
  columnIndex: number;
  distanceFromCenter: number;
}

/** 官方 `sqe(e)` @2772380 —— 每个格子的「离中心距离」 */
export function pileSlots(rows: readonly number[]): PileSlot[] {
  const rowCenter = (rows.length - 1) / 2;
  return rows.flatMap((columns, rowIndex) => {
    const columnCenter = (columns - 1) / 2;
    return Array.from({ length: columns }, (_, columnIndex) => {
      const dx = columnIndex - columnCenter;
      const dy = rowIndex - rowCenter;
      return { rowIndex, columnIndex, distanceFromCenter: dx * dx + dy * dy };
    });
  });
}

/** 官方 `rqe(e,t)` @2772380 —— 成员**倒序**依次占「离中心最近」的格子 */
export function assignPileSlots<T>(
  members: readonly T[],
  slots: readonly PileSlot[],
): Array<PileSlot & { member: T; animationIndex: number }> {
  const reversed = [...members].reverse();
  const sorted = [...slots].sort(
    (a, b) =>
      a.distanceFromCenter - b.distanceFromCenter ||
      a.rowIndex - b.rowIndex ||
      a.columnIndex - b.columnIndex,
  );
  return reversed.map((member, index) => ({ ...sorted[index], member, animationIndex: index }));
}

/** 官方 `oqe(e)` @2772380 —— 一行占多宽 / 多高（成员之间 `vC = 128` 间距） */
export function pileRowExtent(
  row: ReadonlyArray<{ member: { width: number; height: number } }>,
  gap: number = PILE_FAN_GAP,
): { width: number; height: number } {
  return {
    width: row.reduce((sum, item) => sum + item.member.width, 0) + Math.max(row.length - 1, 0) * gap,
    height: Math.max(...row.map((item) => item.member.height)),
  };
}

export interface PileFanPlacement {
  memberId: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  animationIndex: number;
}

/**
 * 官方 `iqe(e,t)` @2772380 —— 以堆叠节点 `e`（已带绝对 `position`）的中心为锚，
 * 把成员平铺成方阵，返回每个成员的**绝对**坐标。
 */
export function pileFanLayout(
  pile: AnyNode,
  members: ReadonlyArray<AnyNode>,
  sizeOf: SizeGetter,
  gap: number = PILE_FAN_GAP,
): PileFanPlacement[] {
  if (members.length === 0) return [];
  const rows = pileRowCounts(members.length);
  const slots = pileSlots(rows);
  const sized = members.map((node) => ({ node, ...pileDisplaySize(node, sizeOf) }));
  const assignments = assignPileSlots(sized, slots);
  const grouped = rows.map((_, rowIndex) =>
    assignments.filter((a) => a.rowIndex === rowIndex).sort((a, b) => a.columnIndex - b.columnIndex),
  );
  const rowExtents = grouped.map((row) =>
    pileRowExtent(row.map((a) => ({ member: { width: a.member.width, height: a.member.height } })), gap),
  );
  const totalHeight = rowExtents.reduce((sum, e) => sum + e.height, 0) + Math.max(grouped.length - 1, 0) * gap;
  const center = pileCenter(pile, sizeOf);
  let cursorY = center.y - totalHeight / 2;
  const placements: PileFanPlacement[] = [];
  grouped.forEach((row, rowIndex) => {
    const extent = rowExtents[rowIndex];
    let cursorX = center.x - extent.width / 2;
    row.forEach((item) => {
      placements.push({
        memberId: item.member.node.id,
        position: { x: cursorX, y: cursorY + (extent.height - item.member.height) / 2 },
        width: item.member.width,
        height: item.member.height,
        animationIndex: item.animationIndex,
      });
      cursorX += item.member.width + gap;
    });
    cursorY += extent.height + gap;
  });
  return placements;
}

/* ══════════════════════════════════════════════════════════════════════════
   解堆（官方 `$lt`）与成员增删（官方 `Vlt` / `aqe` / `Klt`）
   ══════════════════════════════════════════════════════════════════════════ */

/** 官方 `aqe(e,t)` @2773789 —— 把 `t` 里的 id 提到最前（保持相对顺序） */
export function moveIdsToFront(ids: readonly string[], move: readonly string[]): string[] {
  const unique = [...new Set(ids)];
  const present = new Set(unique);
  const moving = [...new Set(move)].filter((id) => present.has(id));
  const movingSet = new Set(moving);
  return [...unique.filter((id) => !movingSet.has(id)), ...moving];
}

/** 官方 `Vlt(e,t,n)` @2773948 —— moveMemberToTop（放回正面 = 数组末尾） */
export function movePileMemberToFront(
  nodes: readonly AnyNode[],
  pileId: string,
  memberNodeId: string,
): AnyNode[] {
  const pile = nodes.find((n) => n.id === pileId && n.type === PILE_NODE_TYPE);
  const ids = pileMemberIds(pile);
  if (!ids.includes(memberNodeId)) return [...nodes];
  const next = moveIdsToFront(ids, [memberNodeId]);
  if (next.every((id, i) => id === ids[i])) return [...nodes];
  return nodes.map((n) =>
    n.id === pileId ? ({ ...n, data: { ...n.data, memberIds: next } } as AnyNode) : n,
  );
}

/** 官方 `$lt(e,t)` @2779181 —— 解堆：空堆叠直接删除；否则成员按平铺布局释放 */
export function unpilePileNode(
  nodes: readonly AnyNode[],
  pileId: string,
  sizeOf: SizeGetter,
  byId: ReadonlyMap<string, AnyNode> = new Map(nodes.map((n) => [n.id, n])),
): AnyNode[] {
  const pile = nodes.find((n) => n.id === pileId && n.type === PILE_NODE_TYPE);
  if (!pile) return [...nodes];
  const members = buildPileIndex(nodes, byId).membersByPileId.get(pileId) ?? [];
  if (members.length === 0) return nodes.filter((n) => n.id !== pileId);
  const memberIds = new Set(members.map((m) => m.id));
  const cover = pileCoverSize(members.map((m) => pileDisplaySize(m, sizeOf)));
  const resized = recenterPile(pile, members.map((m) => pileDisplaySize(m, sizeOf)), sizeOf) as AnyNode & {
    width: number;
    height: number;
  };
  void cover;
  const positioned = { ...resized, position: pileAbsolutePosition(resized, byId) };
  const placements = new Map(pileFanLayout(positioned, members, sizeOf).map((p) => [p.memberId, p.position]));
  return nodes.flatMap((n) => {
    if (n.id === pileId) return [];
    if (!memberIds.has(n.id)) return [n];
    return [{ ...n, parentId: undefined, extent: undefined, position: placements.get(n.id) ?? n.position } as AnyNode];
  });
}

/**
 * 官方 `Klt(e,t,n,s)` @2779553（长度 648）—— **从堆叠里摘出单个成员**（画廊 `removeMember` 的图重写）。
 *
 * 官方逐字（`zoom-slider-3ZcFvYQO.js`）：
 * ```js
 * function Klt(e,t,n,s){
 *   const r=e.find(b=>b.id===t&&b.type===he.PILE); if(!r) return e;
 *   const o=qa(e); if(o.pileIdByNodeId.get(n)!==t) return e;
 *   const i=o.membersByPileId.get(t)??[], a=i.filter(b=>b.id!==n), c=a.length<2,
 *         d=new Set(a.map(b=>b.id)), u=kg(r,i.map(mh)), p=new Map(e.map(b=>[b.id,b])),
 *         f={...u,position:vr(u,p)}, m=aO(f), g=vT(e,i.map(b=>b.id));
 *   return e.flatMap(b=>{
 *     if(b.id===t){ if(c) return [];
 *       const v=kg(r,a.map(mh)); return [{...v,data:{...v.data,memberIds:a.map(y=>y.id)}}] }
 *     return b.id===n ? [{...b,parentId:void 0,extent:void 0,position:s}]
 *       : c&&d.has(b.id) ? [{...b,parentId:void 0,extent:void 0,position:{x:m.x-yr(b)/2,y:m.y-_i(b)/2}}]
 *       : [g.get(b.id)??b] })
 * }
 * ```
 * 语义逐条（与官方一一对应）：
 *   · 堆叠不存在 / 该成员不归这个堆叠（`qa` 归属表 `pileIdByNodeId`）⇒ **原样返回**；
 *   · 摘出后剩余成员 `< 2`（`c`）⇒ 堆叠节点**整体删除**，剩余成员以「按**摘出前**成员全集算出的堆叠中心」
 *     `m` 居中摆放（`m` 用的是 `kg` 全集重算 + `vr` 绝对坐标 + `aO` 求中心）；
 *   · 否则堆叠按**剩余**成员重算封面尺寸（`kg`）并写回新的 `memberIds`；
 *   · 被摘出的成员落到调用方给的 `s`（画布落点，左上角），并脱父 / 清 `extent`；
 *   · 其余成员一律走 `vT`（`releaseFromParents`：脱父 + 转绝对坐标）。
 *
 * ⚠️ MTV 偏离：官方第 4 个实参 `s`（落点）由画廊拖拽结束时给出；MTV 的 store 动作允许省略
 *    ⇒ 省略时回落到该成员的**当前绝对坐标**（= 原地不动）。官方：永远传落点，无「原地」分支。
 * ⚠️ 官方 `yr` / `_i` 是**未钳制**的原始宽高（`oO` 才做 `max(,1)`）；MTV 注入的 `sizeOf` 已是渲染尺寸
 *    （等价 `oO`）⇒ 零尺寸节点上差 ≤1px（与既有 `recenterPile` / `pileDisplaySize` 同一口径）。
 */
export function removePileMember(
  nodes: readonly AnyNode[],
  pileId: string,
  memberId: string,
  sizeOf: SizeGetter,
  dropPosition?: { x: number; y: number },
): AnyNode[] {
  const pile = nodes.find((n) => n.id === pileId && n.type === PILE_NODE_TYPE);
  if (!pile) return [...nodes];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const index = buildPileIndex(nodes, byId);
  if (index.pileIdByNodeId.get(memberId) !== pileId) return [...nodes];
  const members = index.membersByPileId.get(pileId) ?? [];
  const remaining = members.filter((m) => m.id !== memberId);
  const dissolves = remaining.length < 2;
  const remainingIds = new Set(remaining.map((m) => m.id));
  /* 官方 `u = kg(r, i.map(mh))` + `f = {...u, position: vr(u,p)}` + `m = aO(f)` */
  const resizedFull = recenterPile(pile, members.map((m) => pileDisplaySize(m, sizeOf)), sizeOf);
  const absoluteFull = { ...resizedFull, position: pileAbsolutePosition(resizedFull, byId) } as AnyNode;
  const center = pileCenter(absoluteFull, sizeOf);
  /* 官方 `g = vT(e, i.map(b=>b.id))` —— **摘出前**的全部成员一起脱父转绝对坐标 */
  const released = releaseFromParents(nodes, members.map((m) => m.id), byId);
  const member = byId.get(memberId);
  const fallbackDrop = member ? pileAbsolutePosition(member, byId) : { x: 0, y: 0 };
  return nodes.flatMap((node) => {
    if (node.id === pileId) {
      if (dissolves) return [];
      /* 官方 `v = kg(r, a.map(mh))` + 写回剩余 `memberIds` */
      const resized = recenterPile(pile, remaining.map((m) => pileDisplaySize(m, sizeOf)), sizeOf);
      return [
        {
          ...resized,
          data: { ...resized.data, memberIds: remaining.map((m) => m.id) },
        } as AnyNode,
      ];
    }
    if (node.id === memberId) {
      return [
        { ...node, parentId: undefined, extent: undefined, position: dropPosition ?? fallbackDrop } as AnyNode,
      ];
    }
    if (dissolves && remainingIds.has(node.id)) {
      const size = sizeOf(node);
      return [
        {
          ...node,
          parentId: undefined,
          extent: undefined,
          position: { x: center.x - size.width / 2, y: center.y - size.height / 2 },
        } as AnyNode,
      ];
    }
    return [released.get(node.id) ?? node];
  });
}
