/**
 * officialBatchEdges —— 官方「**批量/变体克隆体继承源节点入边**」的落地（官方 `fLe` + `mLe` + `Gg`）。
 *
 * 官方出处（`vendor-pkg-canvas-futqHM6N.js`，逐字）：
 * ```js
 * // @1206600 区段
 * function mLe(e, t, n) {                       // 复制一条边 t → 目标节点 n
 *   const s = {
 *     ...(t.data?.order    !== void 0 ? { order: t.data.order }       : {}),
 *     ...(t.data?.valueKey !== void 0 ? { valueKey: t.data.valueKey } : {}),
 *     ...(t.data?.purpose  !== void 0 ? { purpose: t.data.purpose }   : {}),
 *   };
 *   return ys(e, { source: t.source, target: n, sourceHandle: t.sourceHandle,
 *                  targetHandle: t.targetHandle, data: s });
 * }
 * function fLe(e, t, n, s, r) {
 *   const i = n.filter(u => u.target === s && Gg(u.data?.purpose));   // s = 源节点
 *   const l = new Set(e.map(u => u.id));
 *   if (i.some(u => !l.has(u.source))) return null;
 *   const c = [...t], d = [];
 *   for (const u of r) for (const p of i) {                           // ★ 每个新节点 × 每条入边
 *     const m = mLe(c, p, u);
 *     d.push(m); c.push(m);
 *   }
 *   return d;
 * }
 * // @668599
 * function Gg(e) { return e == null || e === "generation-input" }
 * ```
 * ⇒ **源节点的每一条「生成输入」入边，都要给每一个新建的目标节点各复制一条**。
 *
 * 用户 2026 报的两个症状是同一个根因（MTV 的图片批量路径**完全没做这一步**）：
 *   ① 「用参考卡拖右侧 + 引用该节点生成 → 图像生成多张：不管生成几张都应与参考卡有节点连接，现在没有」
 *      —— 第 1 张（菜单当场建的那张）有边，其余 N-1 张**一条边都没有**（实测 `inEdges: []`）；
 *   ② 「引用的参考生成时完全不参考」—— 克隆体没有入边 ⇒ 生成时的参考图解析
 *      （`collectConnectedReferenceMedia` / `@` 引用）拿不到参考卡 ⇒ 等于裸提示词生成。
 */
import type { Edge } from '@xyflow/react';

/** 官方 `Gg(e)` @668599：`purpose` 为空 或 `'generation-input'` 才算「生成输入」边 */
export function isOfficialGenerationInputEdge(edge: Edge): boolean {
  const purpose = (edge.data as { purpose?: unknown } | undefined)?.purpose;
  return purpose == null || purpose === 'generation-input';
}

/**
 * 官方 `fLe`：给每个新建目标节点复制源节点的全部「生成输入」入边。
 *
 * @param edges          画布现有边
 * @param sourceNodeId   源节点（参考卡/上游卡）
 * @param newTargetIds   本次新建的目标节点 id（**不含**源节点自身）
 * @param makeId         新边 id 生成器
 */
export function cloneGenerationInputEdges(
  edges: readonly Edge[],
  sourceNodeId: string,
  newTargetIds: readonly string[],
  makeId: () => string,
): Edge[] {
  if (newTargetIds.length === 0) return [];
  const incoming = edges.filter((edge) => edge.target === sourceNodeId && isOfficialGenerationInputEdge(edge));
  if (incoming.length === 0) return [];
  const out: Edge[] = [];
  for (const targetId of newTargetIds) {
    for (const edge of incoming) {
      /* 官方 `mLe`：只带 `order / valueKey / purpose` 三个字段（其余 data 不复制） */
      const data = edge.data as { order?: unknown; valueKey?: unknown; purpose?: unknown } | undefined;
      const clonedData: Record<string, unknown> = {};
      if (data?.order !== undefined) clonedData.order = data.order;
      if (data?.valueKey !== undefined) clonedData.valueKey = data.valueKey;
      if (data?.purpose !== undefined) clonedData.purpose = data.purpose;
      out.push({
        ...edge,
        id: makeId(),
        target: targetId,
        data: clonedData,
      } as Edge);
    }
  }
  return out;
}
