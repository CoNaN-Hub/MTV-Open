/**
 * referencePromptPlan —— 官方边变化 → 下游卡 prompt 重写的**纯规划**（本次范围：图片 / 文本）。
 *
 * 依据（EXE）：
 *   · `rge({nodes, previousEdges, nextEdges})`（`page-DPdEgTS0.js` @1451700）：
 *       先求「受影响的 target」= 那些 `source/target/Ih(edge)` 发生变化的边的 target；
 *       再对每个 target 用 `Eb(draft, 旧引用, 新引用)` 重写 prompt（官方在 `rge` 里只处理 VIDEO，
 *       非 VIDEO 走 `onBeforeDelete` 那条 —— 本模块按用户定的范围，先只做**图片/文本**）。
 *   · `draft = getPromptDraft(id) ?? data.prompt`；写完 `setPromptDraft(id, 新值===原值 ? undefined : 新值)`
 *       —— 保住用户的手改草稿。
 *   · 引用没变（before/after 的 id+renderText 列表相同）⇒ 不动。
 *   · 空 draft ⇒ 跳过（官方删除路径里 `if (!draft) return`）。
 *
 * 本模块**只产出计划**，不写 store：调用方拿到 `{ id, prompt, draft }` 自行应用（便于单测与灰阶上线）。
 */
import type { Node as RFNode, Edge } from '@xyflow/react';
import {
  collectUpstreamReferences,
  referenceEntriesForPrompt,
  rewriteReferenceTokens,
  referenceKindOfNodeType,
  type ReferenceKind,
} from './referenceTokens';

export interface ReferencePromptRewrite {
  id: string;
  /** 应写回 `data.prompt` 的新值 */
  prompt: string;
  /** 应写回草稿的值（与原 prompt 相同则置 `undefined`，与官方一致） */
  draft: string | undefined;
}

export interface ReferencePromptPlanOptions {
  nodes: readonly RFNode[];
  previousEdges: readonly Edge[];
  nextEdges: readonly Edge[];
  /** 本次处理哪些类别（默认 `['image', 'text']` —— 用户定的范围，视频/音频/3D 后续再开） */
  kinds?: readonly ReferenceKind[];
  /** 读草稿（官方 `getPromptDraft`）；没有草稿体系时可不传 */
  getDraft?: (nodeId: string) => string | undefined;
}

function edgeSignature(edge: Edge): string {
  const order = (edge.data as { order?: unknown } | undefined)?.order;
  return `${edge.source}|${edge.sourceHandle ?? ''}|${edge.target}|${edge.targetHandle ?? ''}|${String(order ?? 0)}`;
}

/** 官方 `rge` 的第一步：哪些 target 受影响（边被增/删/改动，或端点/顺序变了） */
export function collectAffectedTargets(
  previousEdges: readonly Edge[],
  nextEdges: readonly Edge[],
): Set<string> {
  const prevById = new Map(previousEdges.map((edge) => [edge.id, edge]));
  const nextById = new Map(nextEdges.map((edge) => [edge.id, edge]));
  const affected = new Set<string>();
  for (const id of new Set([...prevById.keys(), ...nextById.keys()])) {
    const prev = prevById.get(id);
    const next = nextById.get(id);
    const changed = !prev || !next || edgeSignature(prev) !== edgeSignature(next);
    if (!changed) continue;
    if (prev) affected.add(prev.target);
    if (next) affected.add(next.target);
  }
  return affected;
}

export function planReferencePromptRewrites(options: ReferencePromptPlanOptions): ReferencePromptRewrite[] {
  const { nodes, previousEdges, nextEdges, getDraft } = options;
  const kinds: readonly ReferenceKind[] = options.kinds ?? ['image', 'text'];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const affected = collectAffectedTargets(previousEdges, nextEdges);
  const plan: ReferencePromptRewrite[] = [];

  for (const targetId of affected) {
    const node = nodesById.get(targetId);
    if (!node) continue;
    const kind = referenceKindOfNodeType(node.type);
    /* 本次只做图片/文本（官方把 VIDEO 放在另一条路径；音频/3D 暂不在范围内）*/
    if (!kind || !kinds.includes(kind)) continue;

    const before = referenceEntriesForPrompt(
      collectUpstreamReferences(targetId, previousEdges, nodesById),
      kinds,
    );
    const after = referenceEntriesForPrompt(
      collectUpstreamReferences(targetId, nextEdges, nodesById),
      kinds,
    );
    const sameRefs = before.length === after.length
      && before.every((entry, i) => entry.id === after[i].id && entry.renderText === after[i].renderText);
    if (sameRefs) continue;

    const data = (node.data ?? {}) as Record<string, unknown>;
    const prompt = typeof data.prompt === 'string' ? data.prompt : '';
    const draft = getDraft?.(targetId) ?? prompt;
    if (!draft) continue;

    const nextPrompt = rewriteReferenceTokens(draft, before, after);
    if (nextPrompt === prompt) continue;

    plan.push({
      id: targetId,
      prompt: nextPrompt,
      draft: nextPrompt === prompt ? undefined : nextPrompt,
    });
  }
  return plan;
}
