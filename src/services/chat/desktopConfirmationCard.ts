/**
 * `desktop_*_confirmation` 卡（官方 `$Qe`）的**纯函数层** —— 逐字复刻
 * `live-确认卡与widget.md` 第 3 章 + live bundle 原文（**已用 `_rawat.mjs` 读原始窗口逐字核对**，
 * 未凭报告转述）。本文件无 React、无 store、无网络。
 *
 * ── 权威偏移（`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`，0-based char 偏移）──
 * | 符号 | 偏移 | 角色 |
 * |---|---|---|
 * | `LNe` | 442270 | `new Set([5 个 desktop 工具名])` |
 * | `kD` | 444089 | 族谓词 `LNe.has(content.tool)` |
 * | `BQe` | 2159581 | titles 英文回退 map（5 项） |
 * | `VQe` | 2159839 | `new Set(["batch_download_files"])`（走 client action 的 kind 集合） |
 * | `hy` | 2159877 | `(e,t)=>({[e]:OQe(t)})` —— answer payload 构造 |
 * | `Boe` | 2159902 | 把 `detail.request_json` 展开到顶层 |
 * | `GQe` | 2160058 | 字符串数组去重（保序） |
 * | `HQe` | 2160228 | summary / description 构造器（逐字 switch） |
 * | `OQe` | 2158411 | 51200 字符结果裁剪 |
 * | `MM` | 2157930 | 稳定键序 JSON 序列化 |
 * | `FQe` | 2157904 | 排序比较器 |
 * | `d_` | 2157895 | `51200` |
 * | `zQe` | 2158792 | 三个「非用户决定」error code |
 * | `Uoe` | 2158894 | 从 answer 取 `action` |
 * | `UQe` | 2159023 | 从 error 取 `code` |
 * | `Ff` | 2159117 | 解析卡片状态 |
 * | `Of` | 2159421 | 在途判定（在途 ⇒ 整卡 `null`） |
 * | `K5`/`Y5`/`X5`/`Lf`/`tp` | 2156643 / 2156725 / 2156842 / 2156943 / 2156983 | localStorage 读写 |
 * | `Q5`/`Z5`/`zoe` | 2157027 / 2157065 / 2157106 | 缓存 key 前缀 + 24h TTL |
 * | `DB`/`J5`/`fy`/`LB`/`LQe`/`c_` | 2157122 / 2157187 / 2157450 / 2157523 / 2157597 / 2157868 | 缓存读写清 |
 *
 * 验证分级：**(d) 源码级**（逐字 + 偏移）。组件侧的 (b) jsdom 见
 * `tests/components/desktopConnectorMcpCardsDom.test.tsx`。
 */
import type { ToolEventContent } from './agentContents';

/* ============================================================================
 * 1. 族谓词与工具名（`LNe` @442270 / `kD` @444089）
 * ============================================================================ */

/** 官方 `LNe` @442270。逐字：5 个 `desktop_*_confirmation` / `batch_download_files_confirmation`。 */
export const DESKTOP_CONFIRMATION_TOOLS = [
  'desktop_open_app_confirmation',
  'desktop_capture_screen_confirmation',
  'desktop_fs_confirmation',
  'desktop_shell_command_confirmation',
  'batch_download_files_confirmation',
] as const;

const DESKTOP_CONFIRMATION_TOOL_SET: ReadonlySet<string> = new Set(DESKTOP_CONFIRMATION_TOOLS);

/** 官方 `xl` @443724（工具名字段）与 `kD` @444089（族谓词）的逐字复刻。 */
export function isDesktopConfirmationTool(tool: unknown): boolean {
  return DESKTOP_CONFIRMATION_TOOL_SET.has(typeof tool === 'string' ? tool : '');
}

/** 官方 `xl` @443724：`String(e.content.tool ?? "")`（**不是** `tool_name`）。 */
export function toolEventTool(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  return String((content as { tool?: unknown }).tool ?? '');
}

/** 官方 `$M` @2427173 的 `kD(e)` 分支谓词。 */
export function isDesktopConfirmationEvent(event: unknown): boolean {
  if (!event || typeof event !== 'object') return false;
  const e = event as { type?: unknown; content?: unknown };
  if (e.type !== 'tool_event') return false;
  return isDesktopConfirmationTool(toolEventTool(e.content));
}

/* ============================================================================
 * 2. 静态表（`BQe` @2159581 / `VQe` @2159839 / `zQe` @2158792）
 * ============================================================================ */

/** 官方 `BQe` @2159581（逐字，**英文**；运行时是 i18n 的 `defaultValue`）。 */
export const DESKTOP_CONFIRMATION_TITLE_FALLBACKS: Readonly<Record<string, string>> = {
  desktop_open_app: 'Open app on this desktop',
  desktop_capture_screen: 'Capture screen on this desktop',
  desktop_fs: 'Agent requests local folder access',
  desktop_shell_command: 'Run a shell command on this desktop',
  batch_download_files: 'Download files',
};

/** 官方标题兜底硬编码串：`BQe[p] || "Run a desktop action"`。 */
export const DESKTOP_CONFIRMATION_TITLE_HARD_FALLBACK = 'Run a desktop action';

/** 官方 `VQe` @2159839：走 **client action**（`runAgentClientAction`）而不是 desktop host 的 kind。 */
export const DESKTOP_CLIENT_ACTION_KINDS: ReadonlySet<string> = new Set(['batch_download_files']);

/** 官方 `zQe` @2158792：`status==="failed"` 时归 `"skipped"` 的三个 error code。 */
export const DESKTOP_SKIPPED_ERROR_CODES: ReadonlySet<string> = new Set([
  'superseded_by_new_message',
  'generation_confirmation_expired',
  'conversation_cancelled',
]);

/** 官方 `d_` @2157895：结果 JSON 截断字符数。 */
export const DESKTOP_RESULT_TRUNCATE_CHARS = 51200;

/* ============================================================================
 * 3. 状态解析（`Uoe` / `UQe` / `Ff` / `Of`）
 * ============================================================================ */

/** 官方 `Uoe` @2158894（逐字）。 */
export function officialAnswerAction(envelope: unknown): unknown {
  const e = envelope as {
    response?: { action?: unknown; answer?: { action?: unknown } };
    result?: { action?: unknown; answer?: { action?: unknown } };
    action?: unknown;
  } | null;
  return (
    e?.response?.action ??
    e?.response?.answer?.action ??
    e?.result?.action ??
    e?.result?.answer?.action ??
    e?.action
  );
}

/** 官方 `UQe` @2159023（逐字）。 */
export function officialErrorCode(envelope: unknown): string {
  const e = envelope as {
    error?: { code?: unknown };
    result?: { error?: { code?: unknown } };
  } | null;
  const code = e?.error?.code ?? e?.result?.error?.code;
  return typeof code === 'string' ? code : '';
}

/** 官方 `Ff` @2159117 依赖的 store 切片形状（官方 `hs`）。 */
export interface OfficialConfirmationStoreSlice {
  pendingConfirmation?: { confirmationId?: string; status?: string; kind?: string } | null;
  resolvedConfirmations?: Record<string, string> | null;
}

/** 官方 `Ff` @2159117（逐字）。`"pending" | "confirmed" | "rejected" | "skipped"`。 */
export function resolveDesktopConfirmationStatus(
  event: unknown,
  confirmationId: string,
  store: OfficialConfirmationStoreSlice | null | undefined,
): string {
  const pending = store?.pendingConfirmation;
  if (pending?.confirmationId === confirmationId) return String(pending.status);
  const resolved = store?.resolvedConfirmations?.[confirmationId];
  if (resolved) return resolved;
  const e = event as { status?: unknown; result?: { status?: unknown } } | null;
  const status = e?.status ?? e?.result?.status;
  if (status === 'completed') return officialAnswerAction(event) === 'reject' ? 'rejected' : 'confirmed';
  if (status === 'failed') {
    return DESKTOP_SKIPPED_ERROR_CODES.has(officialErrorCode(event)) ? 'skipped' : 'rejected';
  }
  return 'pending';
}

/** 官方 `Of` @2159421（逐字）：`true` ⇒ 工具仍在途 ⇒ 整卡 `return null`。 */
export function isDesktopConfirmationInFlight(
  event: unknown,
  confirmationId: string,
  store: OfficialConfirmationStoreSlice | null | undefined,
): boolean {
  const e = event as { status?: unknown; result?: { status?: unknown } } | null;
  return !(
    (e?.status ?? e?.result?.status) !== 'started' ||
    officialAnswerAction(event) != null ||
    store?.pendingConfirmation?.confirmationId === confirmationId ||
    store?.resolvedConfirmations?.[confirmationId]
  );
}

/* ============================================================================
 * 4. view-model 派生（`Boe` / `GQe`）
 * ============================================================================ */

/** 官方 `Boe` @2159902（逐字）：`detail.request_json` 是对象就展开它，否则返回入参本身。 */
export function expandDesktopRequestJson(envelope: unknown): Record<string, unknown> {
  const e = (envelope ?? {}) as { detail?: unknown };
  const detail = e.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const requestJson = (detail as { request_json?: unknown }).request_json;
    if (requestJson && typeof requestJson === 'object' && !Array.isArray(requestJson)) {
      return requestJson as Record<string, unknown>;
    }
  }
  return (envelope ?? {}) as Record<string, unknown>;
}

/** 官方 `GQe` @2160058（逐字）：非字符串跳过、`trim` 后去重、保序。 */
export function dedupeTrimmedStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/* ============================================================================
 * 5. 稳定 JSON 序列化 + 结果裁剪（`MM` / `FQe` / `OQe`）
 * ============================================================================ */

/** 官方 `FQe` @2157904（逐字）。 */
export function officialSortComparator(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 官方 `MM` @2157930（逐字）：稳定键序 JSON 序列化。
 * `undefined` 的分支返回 `void 0`（对象里整键丢弃、数组里变 `"null"`）。
 */
export function stableJsonStringify(value: unknown): string | undefined {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (typeof value === 'bigint') throw new TypeError('BigInt cannot be serialized to JSON.');
  if (typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    return `[${Array.from(value, (entry) => stableJsonStringify(entry) ?? 'null').join(', ')}]`;
  }
  const record = value as Record<string, unknown>;
  const parts = Object.keys(record)
    .sort(officialSortComparator)
    .flatMap((key) => {
      const serialized = stableJsonStringify(record[key]);
      return serialized === undefined ? [] : [`${JSON.stringify(key)}: ${serialized}`];
    });
  return `{${parts.join(', ')}}`;
}

/** 官方 `OQe` @2158411 的结果形状。 */
export interface OfficialDesktopActionResult {
  ok?: boolean | null;
  truncated?: true;
  truncated_chars?: number;
  preview_json?: string;
  [key: string]: unknown;
}

/** 官方 `OQe` @2158411（逐字）：超过 {@link DESKTOP_RESULT_TRUNCATE_CHARS} 就裁剪。 */
export function truncateDesktopActionResult(result: unknown): OfficialDesktopActionResult {
  const e = (result ?? {}) as OfficialDesktopActionResult;
  const preview = e.preview_json;
  if (e.truncated === true && typeof preview === 'string') {
    return {
      ok: typeof e.ok === 'boolean' ? e.ok : null,
      truncated: true,
      truncated_chars: Number.isInteger(e.truncated_chars) ? (e.truncated_chars as number) : 0,
      preview_json: preview.slice(0, DESKTOP_RESULT_TRUNCATE_CHARS),
    };
  }
  const serialized = stableJsonStringify(e) ?? '{}';
  if (serialized.length <= DESKTOP_RESULT_TRUNCATE_CHARS) return { ...e };
  return {
    ok: typeof e.ok === 'boolean' ? e.ok : null,
    truncated: true,
    truncated_chars: serialized.length - DESKTOP_RESULT_TRUNCATE_CHARS,
    preview_json: serialized.slice(0, DESKTOP_RESULT_TRUNCATE_CHARS),
  };
}

/** 官方 `hy` @2159877（逐字）：`(kind, result) => ({[kind]: OQe(result)})`。 */
export function buildDesktopAnswerPayload(
  kind: string,
  result: unknown,
): Record<string, OfficialDesktopActionResult> {
  return { [kind]: truncateDesktopActionResult(result) };
}

/* ============================================================================
 * 6. summary / description 构造器（`HQe` @2160228，逐字 switch）
 * ============================================================================ */

/** 官方 i18n 取值函数的形状（第二参数是英文 `defaultValue`）。 */
export type DesktopTextFn = (key: string, defaultValue: string) => string;
/** 官方带变量形态：`e(key, {count, defaultValue})`。 */
export type DesktopTextVarsFn = (
  key: string,
  vars: { defaultValue: string } & Record<string, string | number>,
) => string;

/** 官方 `HQe` 第 1 参数（`n` = `se()` 的 `t`）的**两种**调用形态的合体。 */
export type DesktopSummaryTextFn = {
  (key: string, defaultValue: string): string;
  (key: string, vars: { defaultValue: string } & Record<string, string | number>): string;
};

/**
 * 官方 `HQe` @2160228（逐字）。
 *
 * @param t 官方 `n`（`se()` 的 `t`）
 * @param kind 官方 `t` 形参名冲突 ⇒ 这里改名 `kind`（= `String(d.confirmation_kind ?? "")`）
 * @param envelope 官方 `n`（`$Qe` 里传的是 `d = content.request ?? content.result ?? {}`）
 * @param authorizedFolderDisplayName 官方 `o`（`$Qe` 传已授权目录显示名 `w`；仅 `organize` 用）
 *   —— 类型含 `null`，因为官方 `w` 在找不到 grant 时是 `undefined`（`?.displayName`）。
 * @param desktopCapabilityAvailable 官方 `r`（`m?.available`；仅 `batch_download_files` 用）
 *
 * ⚠️ 参数名与官方压缩名不同（官方形参表就是 `(e,t,n,o,r=!1)`），**函数体逐字**。
 */
export function desktopConfirmationSummary(
  t: DesktopSummaryTextFn,
  kind: string,
  envelope: unknown,
  authorizedFolderDisplayName?: string | null,
  desktopCapabilityAvailable = false,
): string {
  const i = expandDesktopRequestJson(envelope);
  switch (kind) {
    case 'desktop_open_app':
      return `App: ${String(i.app_id ?? '')}`;
    case 'desktop_capture_screen':
      return `Scope: ${String(i.scope ?? i.window_id ?? 'current screen')}`;
    case 'desktop_fs': {
      const operation = String(i.operation ?? '');
      if (operation === 'batch_write') {
        const count = Array.isArray(i.items) ? i.items.length : 0;
        const countText = count
          ? String(count)
          : t('chatAdapter.desktopConfirmation.batchWrite.selectedByAgent', {
              defaultValue: 'selected by Agent',
            });
        const destination =
          i.directory_grant_id ||
          t('chatAdapter.desktopConfirmation.batchWrite.chooseFolderAfterConfirming', {
            defaultValue: 'choose a local folder after confirming',
          });
        return `${t('chatAdapter.desktopConfirmation.batchWrite.files', {
          count: countText,
          defaultValue: 'Files: {{count}}',
        })}
${t('chatAdapter.desktopConfirmation.batchWrite.destination', {
  target: String(destination),
  defaultValue: 'Destination: {{target}}',
})}`;
      }
      if (operation === 'batch_upload') {
        return String(i.batch_source ?? 'pick_files') === 'pick_directory'
          ? 'After you confirm, pick a local folder to upload its files.'
          : 'After you confirm, pick local files to upload.';
      }
      if (operation === 'pick_directory') {
        return 'Agent needs access to a local folder. After you confirm, pick a folder to grant access.';
      }
      if (operation === 'pick_file') {
        return 'Agent needs access to a local file. After you confirm, pick a file to grant access.';
      }
      if (operation === 'organize') {
        const actions = Array.isArray(i.actions)
          ? i.actions.filter(
              (action) => !!action && typeof action === 'object' && !Array.isArray(action),
            )
          : [];
        const folder =
          authorizedFolderDisplayName ||
          i.directory_grant_id ||
          t('chatAdapter.desktopConfirmation.organize.authorizedFolder', {
            defaultValue: 'authorized folder',
          });
        const lines: string[] = actions.slice(0, 4).map((action) => {
          const entry = action as { type?: unknown; path?: unknown; source?: unknown; destination?: unknown };
          if (entry.type === 'mkdir') {
            return t('chatAdapter.desktopConfirmation.organize.mkdir', {
              path: String(entry.path ?? ''),
              defaultValue: 'Create folder: {{path}}',
            });
          }
          const verb = entry.type === 'rename' ? 'rename' : 'move';
          return t(`chatAdapter.desktopConfirmation.organize.${verb}`, {
            source: String(entry.source ?? ''),
            destination: String(entry.destination ?? ''),
            defaultValue:
              verb === 'rename'
                ? 'Rename: {{source}} → {{destination}}'
                : 'Move: {{source}} → {{destination}}',
          });
        });
        if (actions.length > lines.length) {
          lines.push(
            t('chatAdapter.desktopConfirmation.organize.more', {
              count: actions.length - lines.length,
              defaultValue: '+ {{count}} more',
            }),
          );
        }
        return [
          t('chatAdapter.desktopConfirmation.organize.directory', {
            target: String(folder),
            defaultValue: 'Folder: {{target}}',
          }),
          t('chatAdapter.desktopConfirmation.organize.actions', {
            count: actions.length,
            defaultValue: 'Actions: {{count}}',
          }),
          ...lines,
        ].join('\n');
      }
      const target =
        i.file_grant_id ||
        i.directory_grant_id ||
        i.relative_path ||
        i.file_name ||
        'choose target after confirming';
      return `Operation: ${operation}\nTarget: ${String(target)}`;
    }
    case 'batch_download_files': {
      const fileCount = Array.isArray(i.file_ids) ? i.file_ids.length : 0;
      const nodeCount = Array.isArray(i.node_refs) ? i.node_refs.length : 0;
      return `Files: ${fileCount + nodeCount || 'selected by Agent'}\nDestination: ${
        desktopCapabilityAvailable ? 'Desktop save dialog' : 'browser downloads'
      }`;
    }
    case 'desktop_shell_command':
      return String(i.command ?? '');
    default:
      return '';
  }
}

/* ============================================================================
 * 7. localStorage 缓存（`K5`/`Y5`/`X5`/`Lf`/`tp`/`Q5`/`Z5`/`zoe`/`DB`/`J5`/`fy`/`LB`/`LQe`/`c_`）
 * ============================================================================ */

/** 官方 `Q5` @2157027。 */
export const DESKTOP_RUN_CACHE_PREFIX = 'tap:desktop-confirmation-run:v1:';
/** 官方 `Z5` @2157065。 */
export const DESKTOP_RESULT_CACHE_PREFIX = 'tap:desktop-confirmation-result:v1:';
/** 官方 `zoe` @2157106：`1440*60*1e3` = 24h。 */
export const DESKTOP_CACHE_TTL_MS = 1440 * 60 * 1e3;

/** 官方 `K5` @2156643（逐字）：拿不到 localStorage 就 `null`。 */
function desktopStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** 官方 `Lf` @2156943（逐字）。 */
function desktopRemoveItem(key: string): void {
  try {
    desktopStorage()?.removeItem(key);
  } catch {
    /* 官方 `catch{}` 逐字：清缓存失败静默。 */
  }
}

/** 官方 `Y5` @2156725（逐字）：`JSON.parse` 失败时顺手清键。 */
function desktopReadJson(key: string): unknown {
  const storage = desktopStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    desktopRemoveItem(key);
    return null;
  }
}

/** 官方 `X5` @2156842（逐字）。 */
function desktopWriteJson(key: string, value: unknown): boolean {
  const storage = desktopStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** 官方 `tp` @2156983（逐字）。 */
function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 官方 `DB` @2157122 的 run 缓存形状。 */
export interface DesktopConfirmationRunCache {
  canvasId: string;
  conversationId: string;
  runId: string;
  assistantMessageId: string;
  confirmationId: string;
  expiresAt: number;
  [key: string]: unknown;
}

/** 官方 `DB` @2157122（逐字）。 */
export function writeDesktopConfirmationRunCache(entry: Omit<DesktopConfirmationRunCache, 'expiresAt'>): void {
  desktopWriteJson(`${DESKTOP_RUN_CACHE_PREFIX}${entry.canvasId}`, {
    ...entry,
    expiresAt: Date.now() + DESKTOP_CACHE_TTL_MS,
  });
}

/** 官方 `J5` @2157187（逐字）：字段缺失 / 过期 / canvasId 不匹配 ⇒ 清键并返回 `null`。 */
export function readDesktopConfirmationRunCache(
  canvasId: string,
): DesktopConfirmationRunCache | null {
  const key = `${DESKTOP_RUN_CACHE_PREFIX}${canvasId}`;
  const parsed = desktopReadJson(key);
  if (!parsed || typeof parsed !== 'object') return null;
  const entry = parsed as DesktopConfirmationRunCache;
  if (
    entry.canvasId !== canvasId ||
    !isNonEmptyTrimmedString(entry.conversationId) ||
    !isNonEmptyTrimmedString(entry.runId) ||
    !isNonEmptyTrimmedString(entry.assistantMessageId) ||
    !isNonEmptyTrimmedString(entry.confirmationId) ||
    typeof entry.expiresAt !== 'number' ||
    entry.expiresAt <= Date.now()
  ) {
    desktopRemoveItem(key);
    return null;
  }
  return entry;
}

/** 官方 `fy` @2157450（逐字）。 */
export function clearDesktopConfirmationRunCache(canvasId: string, runId?: string): void {
  if (runId) {
    const existing = readDesktopConfirmationRunCache(canvasId);
    if (existing && existing.runId !== runId) return;
  }
  desktopRemoveItem(`${DESKTOP_RUN_CACHE_PREFIX}${canvasId}`);
}

/** 官方 `LB` @2157523（逐字）。 */
export function writeDesktopConfirmationResultCache(confirmationId: string, modifications: unknown): void {
  if (!confirmationId) return;
  desktopWriteJson(`${DESKTOP_RESULT_CACHE_PREFIX}${confirmationId}`, {
    modifications,
    expiresAt: Date.now() + DESKTOP_CACHE_TTL_MS,
  });
}

/** 官方 `LQe` @2157597（逐字）。 */
export function readDesktopConfirmationResultCache(confirmationId: string): unknown {
  if (!confirmationId) return undefined;
  const key = `${DESKTOP_RESULT_CACHE_PREFIX}${confirmationId}`;
  const parsed = desktopReadJson(key);
  if (!parsed || typeof parsed !== 'object') return undefined;
  const entry = parsed as { modifications?: unknown; expiresAt?: unknown };
  if (
    !entry.modifications ||
    typeof entry.modifications !== 'object' ||
    Array.isArray(entry.modifications) ||
    typeof entry.expiresAt !== 'number' ||
    entry.expiresAt <= Date.now()
  ) {
    desktopRemoveItem(key);
    return undefined;
  }
  return entry.modifications;
}

/** 官方 `c_` @2157868（逐字）。 */
export function clearDesktopConfirmationResultCache(confirmationId: string): void {
  if (confirmationId) desktopRemoveItem(`${DESKTOP_RESULT_CACHE_PREFIX}${confirmationId}`);
}

/* ============================================================================
 * 8. 便捷出口
 * ============================================================================ */

/** 官方 `$Qe` 的 `d = content.request ?? content.result ?? {}`。 */
export function desktopConfirmationEnvelope(content: unknown): Record<string, unknown> {
  const c = (content ?? {}) as { request?: unknown; result?: unknown };
  const picked = c.request ?? c.result ?? {};
  return (picked ?? {}) as Record<string, unknown>;
}

/** 官方 `u = String(d.confirmation_id ?? "")`。 */
export function desktopConfirmationId(envelope: unknown): string {
  return String((envelope as { confirmation_id?: unknown } | null)?.confirmation_id ?? '');
}

/** 官方 `p = String(d.confirmation_kind ?? "")`。 */
export function desktopConfirmationKind(envelope: unknown): string {
  return String((envelope as { confirmation_kind?: unknown } | null)?.confirmation_kind ?? '');
}

/** 官方标题：``n(`chatAdapter.desktopConfirmation.titles.${p}`, {defaultValue: BQe[p] || "Run a desktop action"})``。 */
export function desktopConfirmationTitleDefault(kind: string): string {
  return DESKTOP_CONFIRMATION_TITLE_FALLBACKS[kind] || DESKTOP_CONFIRMATION_TITLE_HARD_FALLBACK;
}

/**
 * 官方 `$Qe` 的 `S = !p || !f || f.isKindEnabled(p)`（设置里是否允许该能力）。
 *
 * ⚠️ MTV 侧 **无生产者**：MTV 没有 `desktopPermissionPolicy`（`agent-host-provider-qxBBhMjS.js`
 * 里的 `desktopCapability` / `desktopPermissionPolicy` 上下文在 MTV 不存在）⇒ 默认 `policy` 传
 * `null` 时按官方语义返回 `true`（不显示「已禁用」横幅）。
 */
export function desktopConfirmationPolicyAllows(
  kind: string,
  policy: { isKindEnabled?: (kind: string) => boolean } | null | undefined,
): boolean {
  if (!kind || !policy) return true;
  if (typeof policy.isKindEnabled !== 'function') return true;
  return policy.isKindEnabled(kind);
}

/** 官方 `M = C && !o && S`（确认按钮可用）里的 `S` 之外的 `C`（canInteract）。 */
export function canInteractWithDesktopConfirmation(
  confirmationId: string,
  kind: string,
  cardStatus: string,
  store: OfficialConfirmationStoreSlice | null | undefined,
): boolean {
  const pending = store?.pendingConfirmation;
  return (
    !!confirmationId &&
    !!kind &&
    cardStatus === 'pending' &&
    pending?.confirmationId === confirmationId &&
    pending.status === 'pending' &&
    (!pending.kind || pending.kind === kind)
  );
}

/** 供组件使用的官方 `content` 类型别名（与 `agentApprovalContents.desktopFsConfirmationContent` 同形）。 */
export type DesktopConfirmationContent = ToolEventContent;
