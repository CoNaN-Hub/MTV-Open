/**
 * officialPileProjection 鈥斺€?瀹樻柟 **PILE 鎶曞奖灞?* `pJe`@2987702 鐨勭Щ妞嶃€? *
 * 瀹樻柟閫愬瓧锛? * ```js
 * const TJ="pile-member-anchor", $G="pile-landing-node", hJe="pile-unstack-edge-waiting";
 * function pJe(e, t = qa(e)) {
 *   const n = new Map, s = new Map, r = new Map, o = new Map(e.map(i => [i.id, i]));
 *   for (const i of e) {
 *     if (i.type !== he.PILE) continue;
 *     const c = (t.membersByPileId.get(i.id) ?? []).map(u => sb(u));   // 鎴愬憳鐨?display
 *     r.set(i.id, c);
 *     const d = kg(i, c.map(u => u.displaySize));                      // 鎸夊皝闈㈤噸灞呬腑
 *     n.set(i.id, d); s.set(i.id, vr(d, o));                           // 鍫嗗彔鑺傜偣 + 瀹冪殑缁濆鍧愭爣
 *   }
 *   return e.map(i => {
 *     if (i.type === he.PILE) {
 *       const u = n.get(i.id) ?? i;
 *       return { ...u, data: { ...u.data, displayMembers: r.get(i.id) ?? [] } };
 *     }
 *     const a = t.pileIdByNodeId.get(i.id), c = a ? n.get(a) : void 0, d = a ? s.get(a) : void 0;
 *     if (!c || !d) return i;
 *     return { ...i, className: TJ, parentId: void 0, extent: void 0, position: d,
 *              width: yr(c), height: _i(c),
 *              draggable: !1, selectable: !1, connectable: !1, selected: !1 };
 *   });
 * }
 * ```
 *
 * 鈬?**琚惛鏀剁殑鎴愬憳鍙樻垚涓嶅彲瑙侀敋鐐?*锛坄.pile-member-anchor` 鍦?`nodes-pile.css` 閲屾槸
 *   `pointer-events:none!important; opacity:0!important`锛夛紝骞惰鍋滃埌鍫嗗彔鑺傜偣鐨勪綅缃笌灏哄涓婏紱
 *   鍫嗗彔鑺傜偣鑷繁鎸夈€屾渶鍚?鈮? 涓垚鍛樸€嶇殑灏侀潰灏哄閲嶅眳涓€? *
 * 杈癸細瀹樻柟 `ict`@2988335 鈥斺€?**鍚屼竴涓爢鍙犲唴涓や釜鎴愬憳涔嬮棿鐨勮竟鐩存帴 `hidden: true`**銆? */
import type { Edge, Node as RFNode } from '@xyflow/react';
import type { BaseNodeData } from '../types';
import {
  PILE_MEMBER_ANCHOR_CLASS,
  PILE_NODE_TYPE,
  buildPileIndex,
  pileAbsolutePosition,
  pileDisplaySize,
  pileMemberIds,
  recenterPile,
  type AnyNode,
} from './officialPile';

type SizeGetter = (node: AnyNode) => { width: number; height: number };

/** 瀹樻柟 `pJe(e, t = qa(e))` */
export function projectPilesForReactFlow(
  nodes: readonly RFNode<BaseNodeData>[],
  sizeOf: SizeGetter,
): RFNode<BaseNodeData>[] {
  const list = nodes as unknown as AnyNode[];
  const byId = new Map(list.map((n) => [n.id, n]));
  const index = buildPileIndex(list, byId);

  /** 鍫嗗彔鑺傜偣 id 鈫?閲嶅眳涓悗鐨勮妭鐐?*/
  const recenteredPiles = new Map<string, AnyNode>();
  /** 鍫嗗彔鑺傜偣 id 鈫?瀹冪殑**缁濆**鍧愭爣锛堟垚鍛橀敋鐐硅鐢ㄥ畠锛屽洜涓洪敋鐐硅鑴辩埗锛?*/
  const pileAbsolute = new Map<string, { x: number; y: number }>();

  for (const node of list) {
    if (node.type !== PILE_NODE_TYPE) continue;
    const members = index.membersByPileId.get(node.id) ?? [];
    const sizes = members.map((m) => pileDisplaySize(m, sizeOf));
    const recentered = sizes.length === 0 ? node : recenterPile(node, sizes, sizeOf);
    recenteredPiles.set(node.id, recentered);
    pileAbsolute.set(node.id, pileAbsolutePosition(recentered, byId));
  }

  return list.map((node) => {
    if (node.type === PILE_NODE_TYPE) {
      const recentered = recenteredPiles.get(node.id) ?? node;
      const members = index.membersByPileId.get(node.id) ?? [];
      return {
        ...recentered,
        data: {
          ...recentered.data,
          displayMembers: members.map((m) => ({ node: m, displaySize: pileDisplaySize(m, sizeOf) })),
        },
      } as unknown as RFNode<BaseNodeData>;
    }
    const pileId = index.pileIdByNodeId.get(node.id);
    const pile = pileId ? recenteredPiles.get(pileId) : undefined;
    const pilePos = pileId ? pileAbsolute.get(pileId) : undefined;
    if (!pile || !pilePos) return node as unknown as RFNode<BaseNodeData>;
    const pileSize = sizeOf(pile);
    void pileSize;
    return {
      ...node,
      /* 官方 `ott`@3012950 是 `className: xee`（**整个替换**，不是追加）——
         必须与官方同款严格替换：`Canvas.tsx` 的裸锚点门（官方 `ZT`）判的是
         `nodeLookup.get(id)?.className === "pile-member-anchor"` 相等。 */
      className: PILE_MEMBER_ANCHOR_CLASS,
      parentId: undefined,
      extent: undefined,
      position: pilePos,
      /* ⚠️ 偏离官方一处（**必须**）：官方 `pJe` 会把锚点的 `width/height` 也改成堆叠的封面尺寸。
         MTV 的 `renderSizeOf` 会读 `measured`（而 React Flow 会把**渲染后**的尺寸回流进 store）
         ⇒ 照抄会形成「封面 = 上一次的封面」的自我放大回路（实测：预览层被撑到 500×1100）。
         这里只在**渲染投影**里把锚点挪到堆叠位置（视觉上完全一样：CSS 让它 opacity 0），
         `width/height` 保留成员自己的原值 ⇒ 尺寸来源稳定。 */
      draggable: false,
      selectable: false,
      connectable: false,
      selected: false,
    } as unknown as RFNode<BaseNodeData>;
  });
}

/**
 * 瀹樻柟 `ict(e,t)`@2988335 鐨?*绗竴閮ㄥ垎**锛堝爢鍙犲唴浜掕繛闅愯棌锛夛細
 * `if (d) return { ...i, hidden: true }`锛屽叾涓?`d = pileIdOf(source) && pileIdOf(source) === pileIdOf(target)`銆? *
 * 鈿狅笍 瀹樻柟 `ict` 杩樺甫 `pile-unstack-edge-waiting` 涓?`isEndpointSelected` 涓ゆ锛堣В鍫嗚繃娓℃湡鐢級锛? *    MTV 灏氭湭鍋氳В鍫嗗姩鐢?鈬?鏈疆鍙惤銆屽悓鍫嗗彔鍐呯殑杈归殣钘忋€嶈繖涓€鏉★紙娌″仛鐨勪笉鍋囪鍋氾級銆? */
export function hideIntraPileEdges(
  edges: readonly Edge[],
  nodes: readonly RFNode<BaseNodeData>[],
): Edge[] {
  const index = buildPileIndex(nodes as unknown as AnyNode[]);
  if (index.pileIdByNodeId.size === 0) return edges as Edge[];
  let changed = false;
  const next = edges.map((edge) => {
    const sourcePile = index.pileIdByNodeId.get(edge.source);
    const targetPile = index.pileIdByNodeId.get(edge.target);
    if (!sourcePile || sourcePile !== targetPile) return edge;
    if (edge.hidden) return edge;
    changed = true;
    return { ...edge, hidden: true };
  });
  return changed ? next : (edges as Edge[]);
}

/** 瀹樻柟 `lqe(e,t)` 鐨勪究鎹峰寘瑁咃細鏌愪釜鍫嗗彔鐨勬垚鍛?id 鍒楄〃 */
export function pileMemberIdsOf(nodes: readonly RFNode<BaseNodeData>[], pileId: string): string[] {
  const pile = nodes.find((n) => n.id === pileId);
  return pileMemberIds(pile as unknown as AnyNode);
}
