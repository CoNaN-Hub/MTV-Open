/**
 * `node_update_confirmation` 卡的**摘要 / body / 编辑目标 / answer payload** 纯函数层 —— live 官方逐字移植。
 *
 * 权威源码：`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`
 *
 * | 官方本地名 | 定义偏移 | 角色 |
 * |---|---|---|
 * | `yd` | 2346528 | 非数组对象守卫 |
 * | `Qi` | 2346570 | 非空 trim 字符串 |
 * | `Ttt` | 2346611 | 字符串数组去空 |
 * | `Ett` | 2346688 | 找 node_update 的确认载体 |
 * | `sre` | 2347042 | `changes[]` 归一化（`field` 兜底 `"node"`、`mode` 兜底 `"update"`） |
 * | `NE` | 2347497 | 取 `request_json` |
 * | `rre` / `ktt` / `Cg` | 2347597 / 2347638 / 2347686 | `request_json.patch` / `.replace_data` / 子对象 |
 * | `ire` | 2347734 | 从 `node_ref` / `node_refs` 收集 nodeId（去 `node/` 前缀、去重） |
 * | `Itt` | 2348399 | 去掉 `node/` 前缀 |
 * | `lre` | 2348453 | `/^\d+\s+lines?\s+(changed\|added\|removed\|updated)$/i` |
 * | `jtt` | 2348542 | 取第一个非 diff-summary 的显式文本 |
 * | `cre` | 2348617 | 是否存在「显式文本」（返回 `string \| undefined`） |
 * | `dre` | 2348849 | body 文案构造器 |
 * | `Mtt` | 2349067 | 编辑目标判定 `{kind:"patch"\|"params", field}` |
 * | `Ptt` | 2349714 | 用编辑值构造 answer payload |
 * | `Rtt` | 2349794 | 数字守卫 |
 * | `Ltt` | 2349966 | `detail.items[]` |
 * | `Ftt` | 2350101 | summary 构造器 |
 * | `Dtt` | 2349865 | `confirmation_kind==="node_update" \|\| tool_name==="node_update_confirmation"` |
 * | `Ott` | 2350378 | viewModel `{confirmationId, items[]}` |
 *
 * ⚠️ 官方 `are`（@2347888）会调 `Ic(nodeId)` 从**画布 store** 取节点媒体形状，属于组件层；
 * 本文件只提供 `nodeUpdateReferences` 的纯映射，store 读取在组件内完成。
 */
import type { ToolEventContent } from './agentContents';

export type NodeUpdateChange = {
  field: string;
  mode: string;
  before_summary?: string;
  after_summary?: string;
};

export type NodeReferenceEntry = { source: string; nodeId: string; declaredMediaKind: 'image' | 'video' | 'audio' };

/** 官方 `yd`。 */
function yd(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 官方 `Qi`。 */
function Qi(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** 官方 `Ttt`。 */
function Ttt(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

/** 官方 `Rtt`。 */
export function numberGuard(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** 官方 `Ett`。 */
function Ett(content: unknown): Record<string, unknown> | null {
  const record = content as Record<string, unknown> | undefined;
  const candidates = [record?.request, record?.response, record?.result, record];
  for (const candidate of candidates) {
    if (!yd(candidate) || typeof candidate.confirmation_id !== 'string') continue;
    if (
      candidate.confirmation_kind === 'node_update'
      || candidate.tool_name === 'node_update_confirmation'
      || typeof candidate.node_ref === 'string'
    ) {
      return candidate;
    }
  }
  return null;
}

/** 官方 `sre`。 */
export function normalizeNodeUpdateChanges(value: unknown): NodeUpdateChange[] {
  if (!Array.isArray(value)) return [];
  return value.filter(yd).map((item) => ({
    field: Qi(item.field) ?? 'node',
    mode: Qi(item.mode) ?? 'update',
    before_summary: Qi(item.before_summary),
    after_summary: Qi(item.after_summary),
  }));
}

/** 官方 `NE`。 */
function NE(carrier: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const detail = carrier?.detail as Record<string, unknown> | undefined;
  const fromDetail = detail?.request_json;
  if (yd(fromDetail)) return fromDetail;
  if (yd(carrier?.request_json)) return carrier.request_json as Record<string, unknown>;
  return {};
}

/** 官方 `Cg`。 */
function Cg(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return yd(value) ? value : {};
}

/** 官方 `rre`。 */
function rre(carrier: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return Cg(NE(carrier), 'patch');
}

/** 官方 `ktt`。 */
function ktt(carrier: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return Cg(NE(carrier), 'replace_data');
}

/** 官方 `Itt`。 */
function Itt(value: string): string {
  return value.trim().replace(/^node\//, '');
}

/** 官方 `ire`。 */
export function collectNodeUpdateRefs(carrier: Record<string, unknown> | null | undefined): string[] {
  const requestJson = NE(carrier);
  const candidates = [
    Qi(carrier?.node_ref),
    Qi(requestJson.node_ref),
    ...Ttt(requestJson.node_refs),
  ].filter((value): value is string => !!value).map(Itt).filter((value) => !!value);
  return Array.from(new Set(candidates));
}

/** 官方 `lre`。 */
export function isDiffSummaryLine(value: string): boolean {
  return /^\d+\s+lines?\s+(changed|added|removed|updated)$/i.test(value.trim());
}

/** 官方 `jtt`。 */
function jtt(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = Qi(value);
    if (text && !isDiffSummaryLine(text)) return text;
  }
  return undefined;
}

/** 官方 `cre`。 */
export function explicitNodeUpdateText(carrier: Record<string, unknown> | null | undefined): string | undefined {
  const requestJson = NE(carrier);
  const patch = rre(carrier);
  const patchParams = Cg(patch, 'params');
  const replaceData = ktt(carrier);
  const replaceParams = Cg(replaceData, 'params');
  const preview = Cg(requestJson, 'preview');
  return jtt(
    patch.text, patch.prompt, patch.title,
    patchParams.text, patchParams.prompt, patchParams.title,
    replaceData.text, replaceData.prompt, replaceData.title,
    replaceParams.text, replaceParams.prompt, replaceParams.title,
    preview.text, preview.prompt, preview.title,
  );
}

/** 官方 `dre`。 */
export function buildNodeUpdateBody(
  carrier: Record<string, unknown> | null | undefined,
  changes: readonly NodeUpdateChange[],
  fallback: string,
): string {
  const explicit = explicitNodeUpdateText(carrier);
  if (explicit) return explicit;
  const afterSummaries = changes
    .filter((change) => /text|content|prompt|title|description/i.test(change.field))
    .map((change) => change.after_summary)
    .filter((value): value is string => !!value && !isDiffSummaryLine(value));
  if (afterSummaries.length > 0) return afterSummaries.join('\n\n');
  const summary = carrier?.summary;
  return (typeof summary === 'string' ? summary : undefined) || fallback;
}

export type NodeUpdateEditTarget = { kind: 'patch' | 'params'; field: string };

/** 官方 `Mtt`。 */
export function resolveNodeUpdateEditTarget(
  carrier: Record<string, unknown> | null | undefined,
  changes: readonly NodeUpdateChange[],
): NodeUpdateEditTarget | null {
  const patch = rre(carrier);
  const params = Cg(patch, 'params');
  if (Qi(patch.text) !== undefined) return { kind: 'patch', field: 'text' };
  if (Qi(patch.prompt) !== undefined) return { kind: 'patch', field: 'prompt' };
  if (Qi(patch.title) !== undefined) return { kind: 'patch', field: 'title' };
  if (Qi(params.text) !== undefined) return { kind: 'params', field: 'text' };
  if (Qi(params.prompt) !== undefined) return { kind: 'params', field: 'prompt' };
  if (Qi(params.title) !== undefined) return { kind: 'params', field: 'title' };
  const field = changes.find((change) => /text|content|prompt|title/i.test(change.field))
    ?.field.trim().toLowerCase();
  if (field === 'text' || field === 'content') return { kind: 'patch', field: 'text' };
  if (field === 'prompt') return { kind: 'patch', field: 'prompt' };
  if (field === 'title') return { kind: 'patch', field: 'title' };
  return null;
}

/** 官方 `Ptt`。 */
export function buildNodeUpdateAnswerPayload(
  target: NodeUpdateEditTarget,
  value: string,
): Record<string, unknown> {
  return target.kind === 'params' ? { params: { [target.field]: value } } : { [target.field]: value };
}

/** 官方 `Ftt`。 */
export function buildNodeUpdateSummary(
  requestJson: Record<string, unknown>,
  changes: readonly NodeUpdateChange[],
): string {
  if (yd(requestJson.replace_data)) return 'Replace the full node data object';
  const parts = changes
    .map((change) => {
      const field = change.field.trim();
      const mode = change.mode.trim();
      return field ? (mode ? `${mode} ${field}` : field) : null;
    })
    .filter((value): value is string => !!value);
  if (parts.length === 0) {
    const summary = Qi(requestJson.summary);
    return summary ?? 'Update the node';
  }
  return `Update node fields: ${parts.join(', ')}`;
}

/** 官方 `Ltt`。 */
function Ltt(carrier: Record<string, unknown>): Record<string, unknown>[] | null {
  const detail = carrier.detail as Record<string, unknown> | undefined;
  const items = yd(detail) ? detail.items : undefined;
  if (!Array.isArray(items)) return null;
  const filtered = items.filter(yd);
  return filtered.length > 0 ? filtered : null;
}

/** 官方 `Dtt`。 */
function Dtt(carrier: Record<string, unknown>): boolean {
  return carrier.confirmation_kind === 'node_update' || carrier.tool_name === 'node_update_confirmation';
}

export interface NodeUpdateViewModelItem {
  index: number;
  nodeRefs: string[];
  summary: string;
  bodyText: string;
  bodyIsPrompt: boolean;
  changes: NodeUpdateChange[];
}

export interface NodeUpdateViewModel {
  confirmationId: string;
  items: NodeUpdateViewModelItem[];
}

/** 官方 `Ott`：viewModel 构造（逐字）。 */
export function extractNodeUpdateViewModel(content: unknown): NodeUpdateViewModel | null {
  const record = content as Record<string, unknown> | undefined;
  const candidates = [record?.request, record?.response, record?.result, record];
  for (const candidate of candidates) {
    if (!yd(candidate) || typeof candidate.confirmation_id !== 'string' || !Dtt(candidate)) continue;
    const carriers = Ltt(candidate);
    if (!carriers) continue;
    const items: NodeUpdateViewModelItem[] = [];
    carriers.forEach((item, position) => {
      const requestJson = yd(item.request_json) ? item.request_json : {};
      const carrier = {
        confirmation_id: candidate.confirmation_id,
        node_ref: Qi(requestJson.node_ref),
        changes: requestJson.changes,
        request_json: requestJson,
      };
      const changes = normalizeNodeUpdateChanges(requestJson.changes);
      const nodeRefs = collectNodeUpdateRefs(carrier);
      const summary = buildNodeUpdateSummary(requestJson, changes);
      const bodyText = buildNodeUpdateBody(carrier, changes, summary);
      const index = numberGuard(item.index) ?? position;
      items.push({
        index,
        nodeRefs,
        summary,
        bodyText,
        bodyIsPrompt: explicitNodeUpdateText(carrier) !== undefined,
        changes,
      });
    });
    if (items.length !== 0) return { confirmationId: candidate.confirmation_id, items };
  }
  return null;
}

/** 官方 `are`（@2347888）的**纯映射**部分：nodeId → reference 描述。 */
export function nodeUpdateReferences(nodeIds: readonly string[]): NodeReferenceEntry[] {
  /* 官方这里的 `declaredMediaKind` 来自画布 store（`Ic`）；纯映射只产出 `source`/`nodeId`，
     媒体类型由组件从 store 补齐（见 `NodeUpdateConfirmationCard.tsx`）。 */
  return nodeIds.map((nodeId) => ({ source: `node/${nodeId}`, nodeId, declaredMediaKind: 'image' as const }));
}

/** 工具事件 → node_update 载体（供组件取 `summary` 等）。 */
export function nodeUpdateCarrierOf(content: ToolEventContent | Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  return Ett(content);
}
