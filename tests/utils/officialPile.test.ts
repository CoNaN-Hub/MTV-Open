/**
 * officialPile —— 官方 PILE 纯函数层的行为测试。
 *
 * 逐条对齐官方 `zoom-slider-3ZcFvYQO.js` 的堆叠段落（@char2771505…@2779800）：
 *   `FE` / `CQ` / `cO` / `qa` / `SQ` / `EQ` / `pqe` / `fqe` / `$lt` / `vT` /
 *   `iO` / `_l` / `mh` / `oO` / `kg` / `aO` / `tqe` / `nqe` / `sqe` / `rqe` / `oqe` / `iqe` / `aqe` / `Vlt` / `vr`
 */
import { describe, expect, it } from 'vitest';
import type { Node as RFNode } from '@xyflow/react';
import type { BaseNodeData } from '../../src/types';
import {
  PILE_ALLOWED_MEMBER_TYPES,
  PILE_FAN_GAP,
  PILE_ID_PREFIX,
  PILE_MAX_MEMBERS,
  PILE_NODE_TYPE,
  PILE_RENDER_CLASSES,
  PILE_STACK_OFFSETS,
  PILE_TOOLBAR_BRIDGE_HEIGHT,
  PILE_TOOLBAR_BRIDGE_TOP,
  applyPileCreation,
  buildPileIndex,
  canAbsorbIntoPile,
  canCreatePile,
  centerFirstOrder,
  createPileFromSelection,
  isAllowedPileMember,
  isPileableNode,
  moveIdsToFront,
  movePileMemberToFront,
  pileAbsolutePosition,
  pileCoverSize,
  pileDisplaySize,
  pileFanLayout,
  pileLastFive,
  pileMemberIds,
  pilePreviewExpansion,
  pileRowCounts,
  pileSlots,
  pileStackLayers,
  pileStackOffset,
  pileStackPlacement,
  pileStaggerStep,
  planPile,
  recenterPile,
  releaseFromParents,
  unpilePileNode,
} from '../../src/utils/officialPile';

type N = RFNode<BaseNodeData>;

function node(id: string, type: string, x = 0, y = 0, w = 100, h = 100, parentId?: string): N {
  return {
    id,
    type,
    position: { x, y },
    width: w,
    height: h,
    measured: { width: w, height: h },
    parentId,
    data: { type } as BaseNodeData,
  } as unknown as N;
}

function pile(id: string, memberIds: string[], x = 0, y = 0, w = 100, h = 100): N {
  return {
    id,
    type: PILE_NODE_TYPE,
    position: { x, y },
    width: w,
    height: h,
    measured: { width: w, height: h },
    data: { memberIds, type: 'pile' } as BaseNodeData,
  } as unknown as N;
}

/** 官方 `yr(node)` / `_i(node)` —— 用 `measured` 的真实渲染尺寸 */
const sizeOf = (n: N) => ({
  width: (n.measured?.width as number) ?? n.width ?? 0,
  height: (n.measured?.height as number) ?? n.height ?? 0,
});

describe('常量（官方逐字）', () => {
  it('PILE 节点类型 = "pile"，id 前缀 = "pile-"', () => {
    expect(PILE_NODE_TYPE).toBe('pile');
    expect(PILE_ID_PREFIX).toBe('pile-');
  });

  it('maxMembers 默认 50；可堆叠类型 = image/video/audio/text', () => {
    expect(PILE_MAX_MEMBERS).toBe(50);
    expect([...PILE_ALLOWED_MEMBER_TYPES]).toEqual(['image', 'video', 'audio', 'text']);
    expect(PILE_FAN_GAP).toBe(128);
  });

  it('层叠摆位表 1..5 层的最后一项永远是 {0,0,0}（正面那张）', () => {
    for (const count of [1, 2, 3, 4, 5]) {
      const offsets = PILE_STACK_OFFSETS[count];
      expect(offsets).toHaveLength(count);
      expect(offsets[offsets.length - 1]).toEqual({ x: 0, y: 0, rotation: 0 });
    }
    expect(PILE_STACK_OFFSETS[2][0]).toEqual({ x: -14, y: 5, rotation: -3.5 });
    expect(PILE_STACK_OFFSETS[5][1]).toEqual({ x: 28, y: 12, rotation: 5.5 });
  });
});

describe('pileMemberIds（官方 FE）', () => {
  it('去掉非字符串、空串、重复项，且保序', () => {
    const p = pile('pile-1', ['a', 'b', 'a', '', 0 as unknown as string, 'c']);
    expect(pileMemberIds(p)).toEqual(['a', 'b', 'c']);
  });

  it('memberIds 不是数组 → 空；不是 pile 类型 → 空', () => {
    expect(pileMemberIds(node('n1', 'image'))).toEqual([]);
    const bad = { ...pile('pile-1', []), data: { memberIds: 'nope' } } as unknown as N;
    expect(pileMemberIds(bad)).toEqual([]);
  });
});

describe('类型门（官方 CQ / cO）', () => {
  it('image/video/audio/text 可堆叠；group/pile/command 不可', () => {
    expect(isPileableNode(node('a', 'image'))).toBe(true);
    expect(isPileableNode(node('b', 'video'))).toBe(true);
    expect(isPileableNode(node('c', 'audio'))).toBe(true);
    expect(isPileableNode(node('d', 'text'))).toBe(true);
    expect(isPileableNode(node('e', 'group'))).toBe(false);
    expect(isPileableNode(node('f', PILE_NODE_TYPE))).toBe(false);
    expect(isPileableNode(node('g', 'canvas-note'))).toBe(false);
  });

  it('MTV 的 ai-*/source-* 类型名归一到官方口径', () => {
    expect(isPileableNode(node('a', 'ai-image'))).toBe(true);
    expect(isPileableNode(node('a', 'source-image'))).toBe(true);
    expect(isPileableNode(node('a', 'ai-video'))).toBe(true);
    expect(isPileableNode(node('a', 'source-video'))).toBe(true);
    expect(isPileableNode(node('a', 'ai-audio'))).toBe(true);
    expect(isPileableNode(node('a', 'ai-text'))).toBe(true);
    /* 归一后不在官方 wQ 里的一律不可堆叠 */
    expect(isPileableNode(node('a', 'ai-animation'))).toBe(false);
    expect(isPileableNode(node('a', 'ai-panorama'))).toBe(false);
    expect(isPileableNode(node('a', 'ai-storyboard'))).toBe(false);
    expect(isPileableNode(node('a', 'ai-director'))).toBe(false);
    expect(isPileableNode(node('a', 'comment'))).toBe(false);
    expect(isPileableNode(node('a', 'plugin-node'))).toBe(false);
    expect(isPileableNode(node('a', 'command-menu'))).toBe(false);
  });

  it('allowedMemberTypes 覆盖默认表；大小写不敏感', () => {
    expect(isAllowedPileMember(node('a', 'image'), { allowedMemberTypes: ['video'] })).toBe(false);
    expect(isAllowedPileMember(node('a', 'video'), { allowedMemberTypes: ['video'] })).toBe(true);
    expect(isAllowedPileMember(node('a', 'image'), { allowedMemberTypes: ['IMAGE'] })).toBe(true);
  });
});

describe('成员归属索引（官方 qa）', () => {
  it('一个节点同时被两个堆叠声明时，归给 id 字典序**最小**的堆叠', () => {
    const nodes = [node('m1', 'image'), pile('pile-b', ['m1']), pile('pile-a', ['m1'])];
    const index = buildPileIndex(nodes);
    expect(index.pileIdByNodeId.get('m1')).toBe('pile-a');
    expect(index.membersByPileId.get('pile-a')?.map((n) => n.id)).toEqual(['m1']);
    expect(index.membersByPileId.get('pile-b')).toEqual([]);
  });

  it('堆叠里的非法成员（分组 / 另一个堆叠 / 不存在的 id）被剔除', () => {
    const nodes = [node('g', 'group'), pile('pile-x', []), pile('pile-a', ['g', 'pile-x', 'ghost', 'ok']), node('ok', 'video')];
    const index = buildPileIndex(nodes);
    expect(index.membersByPileId.get('pile-a')?.map((n) => n.id)).toEqual(['ok']);
  });
});

describe('建堆门（官方 SQ / EQ / Glt）', () => {
  it('少于 2 个来源 → 不可建', () => {
    const nodes = [node('m1', 'image')];
    expect(canCreatePile(nodes, ['m1'], {}, sizeOf)).toBe(false);
  });

  it('2 个合法成员 → 可建', () => {
    const nodes = [node('m1', 'image'), node('m2', 'video')];
    expect(canCreatePile(nodes, ['m1', 'm2'], {}, sizeOf)).toBe(true);
  });

  it('enabled === false → 不可建', () => {
    const nodes = [node('m1', 'image'), node('m2', 'video')];
    expect(canCreatePile(nodes, ['m1', 'm2'], { enabled: false }, sizeOf)).toBe(false);
  });

  it('选中的 GROUP 被整块跳过（两个分组 → 来源数 0 → 不可建）', () => {
    const nodes = [node('g1', 'group'), node('g2', 'group')];
    expect(planPile(nodes, ['g1', 'g2'], {}, sizeOf)).toBeNull();
  });

  it('成员数超过 maxMembers → 不可建', () => {
    const nodes = [node('m1', 'image'), node('m2', 'image'), node('m3', 'image')];
    expect(canCreatePile(nodes, ['m1', 'm2', 'm3'], { maxMembers: 2 }, sizeOf)).toBe(false);
  });

  it('已在别的堆叠里的节点 → 不能再次入堆（SQ）', () => {
    const nodes = [node('m1', 'image'), node('m2', 'image'), pile('pile-a', ['m1'])];
    expect(canAbsorbIntoPile(nodes[0], buildPileIndex(nodes).pileIdByNodeId)).toBe(false);
    expect(canCreatePile(nodes, ['m1', 'm2'], {}, sizeOf)).toBe(false);
  });

  it('选中一个「已有成员的堆叠」+ 一个新节点 → 可建（来源 ≥2）', () => {
    const nodes = [node('m1', 'image'), node('m2', 'image'), pile('pile-a', ['m1'])];
    expect(canCreatePile(nodes, ['pile-a', 'm2'], {}, sizeOf)).toBe(true);
  });

  it('选中的 PILE 若成员为空 → 不可建', () => {
    const nodes = [node('m1', 'image'), pile('pile-a', [])];
    expect(canCreatePile(nodes, ['pile-a', 'm1'], {}, sizeOf)).toBe(false);
  });

  it('计划里的 targetParentId：所有来源同父且父存在 → 取该父', () => {
    const nodes = [
      node('p', 'group', 0, 0, 1000, 1000),
      node('m1', 'image', 10, 10, 100, 100, 'p'),
      node('m2', 'video', 200, 10, 100, 100, 'p'),
    ];
    const plan = planPile(nodes, ['m1', 'm2'], {}, sizeOf);
    expect(plan?.targetParentId).toBe('p');
    /* 全局位置是全节点包围盒中心 - 封面/2；相对位置 = 全局 - 父的全局位置 */
    const parentPos = pileAbsolutePosition(nodes[0], new Map(nodes.map((n) => [n.id, n])));
    expect(plan!.targetPosition.x).toBeCloseTo(plan!.targetGlobalPosition.x - parentPos.x, 6);
  });

  it('封面尺寸只看**最后 5 个**成员（官方 _l / iO）', () => {
    const sizes = [9999, 9999, 1, 1, 1, 1, 1].map((v) => ({ width: v, height: v }));
    expect(pileLastFive(sizes)).toHaveLength(5);
    expect(pileCoverSize(sizes)).toEqual({ width: 1, height: 1 });
    expect(pileCoverSize([])).toEqual({ width: 0, height: 0 });
  });

  it('文本节点封面按 mG = 320 等比缩；非文本不缩', () => {
    expect(pileDisplaySize(node('t', 'text', 0, 0, 640, 320), sizeOf)).toEqual({ width: 320, height: 160 });
    expect(pileDisplaySize(node('i', 'image', 0, 0, 640, 320), sizeOf)).toEqual({ width: 640, height: 320 });
  });
});

describe('建堆（官方 pqe / fqe）', () => {
  it('新堆叠节点：id 前缀 pile- / type pile / data.memberIds，且**追加在最后**', () => {
    const nodes = [node('m1', 'image', 0, 0), node('m2', 'video', 500, 300)];
    const result = createPileFromSelection(nodes, ['m1', 'm2'], 'abc', {}, sizeOf)!;
    expect(result).not.toBeNull();
    const target = result.targetPile;
    expect(target.id).toBe('pile-abc');
    expect(target.type).toBe(PILE_NODE_TYPE);
    expect(pileMemberIds(target)).toEqual(['m1', 'm2']);
    expect(result.nextNodes[result.nextNodes.length - 1].id).toBe('pile-abc');
  });

  it('成员被脱父并转成绝对坐标；被完全吸收的来源堆叠节点被移除', () => {
    const nodes = [
      node('p', 'group', 1000, 1000, 2000, 2000),
      node('m1', 'image', 10, 20, 100, 100, 'p'),
      node('m2', 'image', 300, 20, 100, 100, 'p'),
      pile('pile-old', ['m1'], 0, 0),
    ];
    const result = createPileFromSelection(nodes, ['pile-old', 'm2'], 'new', {}, sizeOf)!;
    const ids = result.nextNodes.map((n) => n.id);
    expect(ids).not.toContain('pile-old');
    const m1 = result.nextNodes.find((n) => n.id === 'm1')!;
    expect(m1.parentId).toBeUndefined();
    expect(m1.position).toEqual({ x: 1010, y: 1020 });
  });

  it('releaseFromParents：无父无 extent 的节点原样返回（引用相同）', () => {
    const n = node('m1', 'image', 7, 8);
    const map = releaseFromParents([n], ['m1']);
    expect(map.get('m1')).toBe(n);
  });

  it('applyPileCreation 不可建时返回原数组', () => {
    const nodes = [node('m1', 'image')];
    expect(applyPileCreation(nodes, ['m1'], 'x', {}, sizeOf)).toEqual(nodes);
  });
});

describe('绝对坐标（官方 vr / U6）', () => {
  it('沿 parentId 链累加，带环检测', () => {
    const byId = new Map<string, N>([
      ['a', node('a', 'group', 100, 200)],
      ['b', node('b', 'group', 10, 20, 100, 100, 'a')],
      ['c', node('c', 'image', 1, 2, 100, 100, 'b')],
    ]);
    expect(pileAbsolutePosition(byId.get('c')!, byId)).toEqual({ x: 111, y: 222 });
  });

  it('循环 parentId 不会死循环', () => {
    const a = node('a', 'group', 1, 1, 10, 10, 'b');
    const b = node('b', 'group', 2, 2, 10, 10, 'a');
    const byId = new Map<string, N>([['a', a], ['b', b]]);
    const pos = pileAbsolutePosition(a, byId);
    expect(Number.isFinite(pos.x)).toBe(true);
  });
});

describe('recenterPile（官方 kg / aO）', () => {
  it('尺寸不变 → 原对象返回；否则以旧中心重新居中', () => {
    const p = pile('pile-1', [], 0, 0, 100, 100);
    expect(recenterPile(p, [{ width: 100, height: 100 }], sizeOf)).toBe(p);
    const next = recenterPile(p, [{ width: 200, height: 50 }], sizeOf);
    expect(next.position).toEqual({ x: -50, y: 25 });
    expect(next.width).toBe(200);
    expect(next.height).toBe(50);
  });
});

describe('平铺布局（官方 tqe / nqe / sqe / rqe / oqe / iqe）', () => {
  it('centerFirstOrder 让离中心最近的行先加', () => {
    expect(centerFirstOrder(4)).toEqual([1, 2, 0, 3]);
    expect(centerFirstOrder(3)).toEqual([1, 0, 2]);
  });

  it('pileRowCounts：列数 = round(sqrt(n))，余数按离中心最近的列先加', () => {
    expect(pileRowCounts(0)).toEqual([]);
    expect(pileRowCounts(2)).toEqual([2]);
    expect(pileRowCounts(3)).toEqual([2, 1]);
    expect(pileRowCounts(4)).toEqual([2, 2]);
    expect(pileRowCounts(5)).toEqual([3, 2]);
    expect(pileRowCounts(6)).toEqual([3, 3]);
    expect(pileRowCounts(7)).toEqual([2, 3, 2]);
    expect(pileRowCounts(9)).toEqual([3, 3, 3]);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) {
      expect(pileRowCounts(n).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it('pileSlots 给每格算离中心距离', () => {
    const slots = pileSlots([2, 2]);
    expect(slots).toHaveLength(4);
    expect(slots[0]).toEqual({ rowIndex: 0, columnIndex: 0, distanceFromCenter: 0.5 * 0.5 + 0.5 * 0.5 });
  });

  it('pileFanLayout：成员倒序占最近的格子，行内水平铺开、行间 gap = 128', () => {
    const p = pile('pile-1', [], 500, 500, 100, 100);
    const members = [node('m1', 'image', 0, 0, 100, 100), node('m2', 'image', 0, 0, 100, 100)];
    const placements = pileFanLayout(p, members, sizeOf);
    expect(placements).toHaveLength(2);
    /* 2 个成员 → 1 行 2 列（round(sqrt(2)) = 1 列？不是：round(1.414)=1 → [2]） */
    const xs = placements.map((x) => x.position.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBe(100 + PILE_FAN_GAP);
    /* 中心对齐：(x1+x2)/2 + 宽度/2 应等于堆叠中心 550 */
    expect((xs[0] + xs[1]) / 2 + 50).toBeCloseTo(550, 6);
  });

  it('pileFanLayout 空成员 → 空数组', () => {
    expect(pileFanLayout(pile('pile-1', []), [], sizeOf)).toEqual([]);
  });
});

describe('层叠摆位（官方 xG / fO / qM / wC）', () => {
  it('pilePreviewExpansion：compact=1 · interactive=2 · drop-target=2.35 · source=传入值', () => {
    expect(pilePreviewExpansion('compact')).toBe(1);
    expect(pilePreviewExpansion('interactive')).toBe(2);
    expect(pilePreviewExpansion('drop-target')).toBe(2.35);
    expect(pilePreviewExpansion('source', 0.6)).toBe(0.6);
    expect(pilePreviewExpansion('未知')).toBe(1);
  });

  it('pileStackOffset：位移/旋转 = 摆位表 × 展开倍数；只有**正面**那张随倍数上抬 8px/级', () => {
    /* expansion = 1 ⇒ 就是摆位表原值，字段名从 rotation 变成 rotate */
    expect(pileStackOffset(0, 2, 1)).toEqual({ x: -14, y: 5, rotate: -3.5 });
    expect(pileStackOffset(1, 2, 1)).toEqual({ x: 0, y: 0, rotate: 0 });
    /* expansion = 2：x/y/rotate 全 ×2；正面那张再抬 -8*(2-1) = -8 */
    expect(pileStackOffset(0, 2, 2)).toEqual({ x: -28, y: 10, rotate: -7 });
    expect(pileStackOffset(1, 2, 2)).toEqual({ x: 0, y: -8, rotate: 0 });
    /* 3 层时正面(idx=2) 抬 8，其余不抬 */
    expect(pileStackOffset(2, 3, 2)).toEqual({ x: 0, y: -8, rotate: 0 });
    expect(pileStackOffset(0, 3, 2)).toEqual({ x: -36, y: 12, rotate: -8 });
    /* 层数越界 → 回落到第 1 层的唯一摆位 */
    expect(pileStackOffset(0, 99, 1)).toEqual({ x: 0, y: 0, rotate: 0 });
  });

  it('pileStackPlacement：可见层 zIndex = index+1（正面最大）；溢出层缩进封面且 zIndex = 0', () => {
    const visible0 = pileStackPlacement({
      memberSize: { width: 100, height: 100 },
      coverSize: { width: 100, height: 100 },
      visibleIndex: 0,
      visibleCount: 3,
      expansion: 1,
    });
    expect(visible0.zIndex).toBe(1);
    expect(visible0.scale).toBe(1);
    const front = pileStackPlacement({
      memberSize: { width: 100, height: 100 },
      coverSize: { width: 100, height: 100 },
      visibleIndex: 2,
      visibleCount: 3,
      expansion: 1,
    });
    expect(front.zIndex).toBe(3);

    /* 溢出：封面 100×100 ⇒ 内框 84×84；成员 168×84 ⇒ scale = 84/168 = 0.5 */
    const overflow = pileStackPlacement({
      memberSize: { width: 168, height: 84 },
      coverSize: { width: 100, height: 100 },
      visibleIndex: -1,
      visibleCount: 3,
      expansion: 1,
    });
    expect(overflow.zIndex).toBe(0);
    expect(overflow.scale).toBeCloseTo(0.5, 6);
    /* 溢出但成员本来就比封面小 ⇒ scale 封顶 1 */
    const small = pileStackPlacement({
      memberSize: { width: 10, height: 10 },
      coverSize: { width: 100, height: 100 },
      visibleIndex: -1,
      visibleCount: 1,
      expansion: 1,
    });
    expect(small.scale).toBe(1);
  });

  it('pileStackLayers：可见的是最后 ≤5 个，正面在末尾；其余溢出层附在最后', () => {
    const memberIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const visible = pileLastFive(memberIds);
    expect(visible).toEqual(['c', 'd', 'e', 'f', 'g']);
    const layers = pileStackLayers(visible, memberIds, () => ({ width: 100, height: 100 }), { width: 100, height: 100 }, 1);
    expect(layers).toHaveLength(7);
    /* 可见 5 张：index 0..4，正面是 'g'（zIndex 5） */
    expect(layers.slice(0, 5).map((l) => l.id)).toEqual(['c', 'd', 'e', 'f', 'g']);
    expect(layers[4].zIndex).toBe(5);
    /* 溢出 2 张（a、b）visibleIndex = -1、zIndex 0 */
    expect(layers.slice(5).map((l) => l.id)).toEqual(['a', 'b']);
    expect(layers.slice(5).every((l) => l.visibleIndex === -1 && l.zIndex === 0)).toBe(true);
  });

  it('pileStaggerStep：正面延迟 0，越靠后越大，封顶 0.54；越界取最大档', () => {
    expect(pileStaggerStep(4, 5)).toBe(0);
    expect(pileStaggerStep(3, 5)).toBe(0.18);
    expect(pileStaggerStep(0, 5)).toBe(0.54);
    expect(pileStaggerStep(0, 99)).toBe(0.54);
    expect(pileStaggerStep(-1, 5)).toBe(0.54);
  });
});

describe('渲染器类名常量（官方 uJe §5.2 逐字）', () => {
  it('关键类名与官方原文一致', () => {
    expect(PILE_RENDER_CLASSES.root).toBe('group relative size-full outline-none');
    expect(PILE_RENDER_CLASSES.member).toBe('pointer-events-none absolute left-1/2 top-1/2 origin-center');
    expect(PILE_RENDER_CLASSES.memberListHidden).toBe('relative size-full invisible');
    expect(PILE_RENDER_CLASSES.empty).toBe(
      'absolute left-1/2 top-1/2 flex h-[196px] w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-card text-sm text-muted-foreground',
    );
    expect(PILE_RENDER_CLASSES.shade).toBe(
      'pointer-events-none absolute inset-0 z-20 rounded-xl bg-[#080B10]',
    );
    expect(PILE_TOOLBAR_BRIDGE_HEIGHT).toBe(38);
    expect(PILE_TOOLBAR_BRIDGE_TOP).toBe(-38);
  });
});

describe('解堆（官方 $lt）与成员换序（官方 Vlt / aqe）', () => {
  it('空堆叠 → 直接删除该节点', () => {
    const nodes = [node('m1', 'image'), pile('pile-a', [])];
    expect(unpilePileNode(nodes, 'pile-a', sizeOf).map((n) => n.id)).toEqual(['m1']);
  });

  it('有成员 → 堆叠节点被删除，成员脱父并放到平铺坐标', () => {
    const nodes = [node('m1', 'image', 0, 0, 100, 100), node('m2', 'image', 400, 0, 100, 100), pile('pile-a', ['m1', 'm2'], 0, 0)];
    const next = unpilePileNode(nodes, 'pile-a', sizeOf);
    expect(next.map((n) => n.id)).toEqual(['m1', 'm2']);
    for (const n of next) {
      expect(n.parentId).toBeUndefined();
      expect(n.position.x).not.toBe(nodes.find((o) => o.id === n.id)!.position.x);
    }
  });

  it('堆叠不存在 → 原样返回', () => {
    const nodes = [node('m1', 'image')];
    expect(unpilePileNode(nodes, 'nope', sizeOf)).toEqual(nodes);
  });

  it('moveIdsToFront：把目标 id 提到末尾（= 正面），保持相对顺序', () => {
    expect(moveIdsToFront(['a', 'b', 'c'], ['c'])).toEqual(['a', 'b', 'c']);
    expect(moveIdsToFront(['a', 'b', 'c'], ['a'])).toEqual(['b', 'c', 'a']);
    expect(moveIdsToFront(['a', 'b', 'c'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(moveIdsToFront(['a', 'b'], ['zzz'])).toEqual(['a', 'b']);
  });

  it('movePileMemberToFront 只改目标堆叠的 memberIds；非成员不动', () => {
    const nodes = [node('a', 'image'), node('b', 'image'), node('c', 'image'), pile('pile-a', ['a', 'b', 'c'])];
    const next = movePileMemberToFront(nodes, 'pile-a', 'a');
    expect(pileMemberIds(next.find((n) => n.id === 'pile-a'))).toEqual(['b', 'c', 'a']);
    expect(movePileMemberToFront(nodes, 'pile-a', 'zzz')).toEqual(nodes);
  });
});
