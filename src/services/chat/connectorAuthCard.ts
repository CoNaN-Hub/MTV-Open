/**
 * `connectorAuthCard`（官方 `Loe` 容器 @2149033 + `TQe` 真卡 @2142258）的**纯函数层** ——
 * 逐字复刻 `live-确认卡与widget.md` 第 5 章 + live bundle 原文（**已用 `_rawat.mjs`
 * 读原始窗口逐字核对**）。无 React、无 store、无网络。
 *
 * ── 权威偏移（`vendor-pkg-canvas-ChpWx5JY.js`，0-based char 偏移）──
 * | 符号 | 偏移 | 角色 |
 * |---|---|---|
 * | `zNe` | 442510 | `new Set(["get_connector_status"])` |
 * | `ID` | 444985 | 族谓词 `zNe.has(xl(e))` |
 * | `Loe` | 2149033 | 外层 `a.memo` 容器，`displayName="ConnectorAuthCard"` @2149536 |
 * | `TQe` | 2142258 | 单张卡片实现 |
 * | `RB` | 2141933 | 卡片图标（iconUrl `<img>` / `Gi` 兜底） |
 * | `yQe`/`xQe`/`gQe` | 2140608 邻域 | feishu/lark 名称映射 |
 * | `_Qe` | 2141190 | connector 名称 i18n 映射 |
 * | `CQe` | 2141291 | 本地归一化（API 与 fallback 都拿不到时） |
 * | `vQe`/`wQe` | 2141067 / 2141078 | auth scheme 白名单 |
 * | `SQe` | 2140 邻域 | 图标 URL 三选一（首个非空 trim） |
 * | `NQe` | 2141933 之前 | card → plugin 形状（喂给弹窗 `bD`） |
 * | `bQe`/`Doe`/`dI` | 2140 邻域 | connector_id ↔ pluginName |
 * | `wbe`/`_be`/`kR` | 98483 / 98560 / 98710 | 能力 id / feishu-lark 判定 / 启动会话 body |
 * | `e4`/`SCe`/`t4` | 334253 | 轮询会话状态归一 / 轮询条件 / 会话合并 |
 * | `sn` | 332465（store）/ 333875–333986（slice） | `skippedConnectorAuthCards` / `markConnectorAuthCardSkipped` |
 *
 * 验证分级：**(d) 源码级**（逐字 + 偏移）。组件侧 (b) jsdom 见
 * `tests/components/desktopConnectorMcpCardsDom.test.tsx`。
 */
import type { ToolEventContent } from './agentContents';

/* ============================================================================
 * 1. 族谓词（`zNe` @442510 / `ID` @444985）
 * ============================================================================ */

/** 官方 `zNe` @442510。 */
export const CONNECTOR_STATUS_TOOL = 'get_connector_status';

/** 官方 `ID` @444985 + `$M` 的派发分支（`status==="completed"` 才渲染）。 */
export function isConnectorAuthCardEvent(event: unknown): boolean {
  if (!event || typeof event !== 'object') return false;
  const e = event as { type?: unknown; content?: unknown };
  if (e.type !== 'tool_event') return false;
  const content = e.content;
  if (!content || typeof content !== 'object') return false;
  return String((content as { tool?: unknown }).tool ?? '') === CONNECTOR_STATUS_TOOL;
}

/* ============================================================================
 * 2. 数据形状（官方 react-query hooks 的返回值 / API 记录）
 * ============================================================================ */

/** 官方 `Ife`（= `wF`，`vendor-packages-jvPqKqU8.js` @685681）归一化后的 connector 记录。 */
export interface OfficialConnectorRecord {
  id: string;
  label: string;
  description: string;
  icon: string | null;
  status: string;
  authScheme: string;
  capabilities: { id: string; enabled: boolean }[];
  connectedAt: string | null;
  lastError: string | null;
  pendingSessionId: string | null;
}

/** 官方 `Wm()`（`listPlugins()`）返回的插件记录（`NQe` 产物同形的超集）。 */
export interface OfficialPluginRecord {
  pluginName: string;
  displayName?: string;
  description?: string;
  isInstalled?: boolean;
  status?: string;
  connectors?: { name: string; displayName?: string; description?: string }[];
}

/** 官方 `auth_cards[]` 单条（`TQe` 的 `card` prop）。 */
export interface OfficialConnectorAuthCard {
  connector_id: string;
  label?: string;
  description?: string;
  icon?: string | null;
  status?: string;
  auth_scheme?: string;
  last_error?: string | null;
  pending_session_id?: string | null;
}

/** 官方 `iY` 会话对象（`kR` 产出的 `startConnectorAuthSession` 结果 + 轮询叠加字段）。 */
export interface OfficialAuthSession {
  sessionId: string;
  status?: string;
  redirectUrl?: string | null;
  verificationUrl?: string | null;
  userCode?: string | null;
  formFields?: { name: string; label?: string; type?: string; required?: boolean }[];
  submitUrl?: string | null;
  expiresAt?: number;
  pollIntervalMs?: number;
  challengeKind?: string;
}

/** 官方 `_Qe` 入参用的 `connector_id` / `connectors[]` 映射键集合。 */
const FEISHU_LARK_NAMES: Readonly<Record<string, string>> = { feishu: 'feishu', lark: 'lark' };

/* ============================================================================
 * 3. feishu / lark 名称归一（`xQe` / `yQe` / `_Qe`，逐字）
 * ============================================================================ */

/** 官方 `xQe` @2140608 邻域（逐字）。 */
export function normalizeConnectorNameKey(value: string): string {
  return value.toLowerCase().trim().replace(/[\s-]+/g, '_');
}

/** 官方 `yQe` @2140608 邻域（逐字）：connector_id 与 label 依次试 `feishu` / `lark`。 */
export function resolveFeishuLarkName(connectorId: string, label: string): string | null {
  for (const candidate of [connectorId, label ?? '']) {
    const key = normalizeConnectorNameKey(candidate);
    if (!key) continue;
    const mapped = FEISHU_LARK_NAMES[key];
    if (mapped) return mapped;
  }
  return null;
}

/**
 * 官方 `_Qe` @2141190（逐字）：
 * `const o=yQe(e,t); return o ? n(`chatAdapter.addMenu.connectors.${o}`, {defaultValue:t}) : t`
 */
export function resolveConnectorDisplayName(
  connectorId: string,
  label: string,
  t: (key: string, defaultValue: string) => string,
): string {
  const mapped = resolveFeishuLarkName(connectorId, label);
  return mapped
    ? t(`chatAdapter.addMenu.connectors.${mapped}`, label)
    : label;
}

/* ============================================================================
 * 4. auth scheme（`vQe` @2141067 / `wQe` @2141078）
 * ============================================================================ */

/** 官方 `vQe` @2141067（逐字）。 */
export const CONNECTOR_AUTH_SCHEMES: ReadonlySet<string> = new Set([
  'oauth2_authcode',
  'oauth2_device',
  'static_token',
  'service_credentials',
  'none',
]);

/** 官方 `wQe` @2141078（逐字）：不在白名单 ⇒ `undefined`。 */
export function normalizeConnectorAuthScheme(value: unknown): string | undefined {
  return typeof value === 'string' && CONNECTOR_AUTH_SCHEMES.has(value) ? value : undefined;
}

/* ============================================================================
 * 5. 本地归一化（`CQe` @2141291，逐字）
 * ============================================================================ */

/** 官方 `CQe` @2141291（逐字）。 */
export function normalizeConnectorAuthCard(card: OfficialConnectorAuthCard): OfficialConnectorRecord {
  return {
    id: card.connector_id,
    label: card.label || card.connector_id,
    description: card.description ?? '',
    icon: card.icon ?? null,
    status: card.status || 'disconnected',
    authScheme: normalizeConnectorAuthScheme(card.auth_scheme) ?? 'none',
    capabilities: [],
    connectedAt: null,
    lastError: card.last_error ?? null,
    pendingSessionId: card.pending_session_id ?? null,
  };
}

/* ============================================================================
 * 6. 图标 URL 三选一（`SQe` @2140 邻域，逐字）
 * ============================================================================ */

/** 官方 `SQe` @2140 邻域（逐字）：首个「字符串且 trim 后非空」的值，返回 `trim()` 结果。 */
export function resolveConnectorIconUrl(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

/* ============================================================================
 * 7. connector_id ↔ pluginName（`bQe` / `Doe` / `dI`，逐字）
 * ============================================================================ */

/** 官方 `bQe` @2140 邻域（逐字）。 */
export function pluginMatchesConnector(plugin: OfficialPluginRecord, name: string): boolean {
  return (
    plugin.pluginName === name ||
    (plugin.connectors ?? []).some((connector) => connector.name === name)
  );
}

/** 官方 `Doe` @2140 邻域（逐字）：connector 名 → pluginName（找不到就按 `tapnow-` 前缀规则推）。 */
export function pluginNameForConnector(
  connectorId: string,
  plugins: readonly OfficialPluginRecord[],
): string | null {
  const name = connectorId.trim();
  if (!name) return null;
  const direct = plugins.find((plugin) => pluginMatchesConnector(plugin, name));
  if (direct) return direct.pluginName;
  const prefixed = name.startsWith('tapnow-') ? name : `tapnow-${name}`;
  const byPrefixed = plugins.find((plugin) => plugin.pluginName === prefixed);
  if (byPrefixed) return byPrefixed.pluginName;
  return prefixed !== name ? prefixed : name;
}

/** 官方 `dI` @2140 邻域（逐字）：connector 名 → 插件记录。 */
export function findPluginForConnector(
  connectorId: string,
  plugins: readonly OfficialPluginRecord[],
): OfficialPluginRecord | null {
  const pluginName = pluginNameForConnector(connectorId, plugins);
  if (!pluginName) return null;
  return plugins.find((plugin) => plugin.pluginName === pluginName) ?? null;
}

/* ============================================================================
 * 8. card → plugin 形状（`NQe` @2141933 之前，逐字）
 * ============================================================================ */

/** 官方 `NQe`（逐字）：把 `auth_cards[]` 单条包成弹窗 `bD` 要的 plugin 形状。 */
export function toConnectorAuthPluginShape(card: OfficialConnectorAuthCard): {
  pluginName: string;
  displayName: string;
  description: string;
  downloadCount: string;
  isInstalled: boolean;
  isUpdateAvailable: boolean;
  skills: unknown[];
  connectors: { name: string; displayName: string; description: string }[];
} {
  return {
    pluginName: card.connector_id,
    displayName: card.label || card.connector_id,
    description: card.description ?? '',
    downloadCount: '0',
    isInstalled: true,
    isUpdateAvailable: false,
    skills: [],
    connectors: [
      {
        name: card.connector_id,
        displayName: card.label || card.connector_id,
        description: card.description ?? '',
      },
    ],
  };
}

/* ============================================================================
 * 9. 能力 id / feishu-lark / 启动会话 body（`wbe` @98483 / `_be` @98560 / `kR` @98710）
 * ============================================================================ */

/** 官方 `wbe` @98483（逐字）。 */
export function enabledConnectorCapabilityIds(
  connector: Pick<OfficialConnectorRecord, 'capabilities'> | null | undefined,
): string[] {
  return (
    connector?.capabilities
      .filter((capability) => capability.enabled)
      .map((capability) => capability.id)
      .filter(Boolean) ?? []
  );
}

/** 官方 `_be` @98560（逐字）：connector_id / plugin.id / plugin.label / label 里含 feishu|lark|飞书。 */
export function isFeishuOrLarkConnector(
  connectorId: string,
  label: string,
  connector?: { id?: string; label?: string } | null,
): boolean {
  const joined = [connectorId, connector?.id, connector?.label, label]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return joined.includes('feishu') || joined.includes('lark') || joined.includes('飞书');
}

/** 官方 `kR` @98710（逐字）：有启用能力就带上 `capabilities`，否则只传 `connector_id`。 */
export function buildStartConnectorAuthSessionBody(
  connectorId: string,
  connector: Pick<OfficialConnectorRecord, 'capabilities'> | null | undefined,
): { connector_id: string; capabilities?: string[] } {
  const capabilities = enabledConnectorCapabilityIds(connector);
  return capabilities.length > 0
    ? { connector_id: connectorId, capabilities }
    : { connector_id: connectorId };
}

/* ============================================================================
 * 10. 授权流类型（`I$` = `fce`，`vendor-packages-jvPqKqU8.js` @685246，逐字）
 * ============================================================================ */

/**
 * 官方 `fce` @685246（逐字）：
 * ```js
 * fce=(e,t)=>e.redirectUrl?"redirect":e.formFields.length>0?"form":
 *   e.verificationUrl||e.userCode?e.challengeKind==="external_approval"?"external_approval":"device":
 *   t==="oauth2_authcode"?"redirect":t==="oauth2_device"?"device":e.challengeKind
 * ```
 * ⇒ `e.formFields.length` 在 `formFields` 为 `undefined` 时会抛；官方靠 API 保证该字段存在。
 * 本实现按官方逐字保留 `?.length` 之外**不改语义**：`formFields` 缺失时视为长度 0（与官方
 * 在 `formFields:[]` 时的分支一致），并在注释里标明这一处「工具链/健壮性所迫」。
 */
export function resolveConnectorAuthFlow(
  session: Pick<OfficialAuthSession, 'redirectUrl' | 'formFields' | 'verificationUrl' | 'userCode' | 'challengeKind'>,
  authScheme?: string,
): string | undefined {
  if (session.redirectUrl) return 'redirect';
  if ((session.formFields?.length ?? 0) > 0) return 'form';
  if (session.verificationUrl || session.userCode) {
    return session.challengeKind === 'external_approval' ? 'external_approval' : 'device';
  }
  if (authScheme === 'oauth2_authcode') return 'redirect';
  if (authScheme === 'oauth2_device') return 'device';
  return session.challengeKind;
}

/* ============================================================================
 * 11. 轮询会话（`e4` / `SCe` / `t4`，@334253 逐字）
 * ============================================================================ */

/** 官方 `e4` @334253（逐字）：只取 `status` 字段。 */
export function sessionStatus(session: unknown): string | undefined {
  if (!session || typeof session !== 'object' || !('status' in session)) return undefined;
  return (session as { status?: string }).status;
}

/** 官方 `SCe` @334253（逐字）：四种 challengeKind 之一才轮询。 */
export function isPollableChallenge(session: OfficialAuthSession | null | undefined): boolean {
  return (
    session?.challengeKind === 'redirect' ||
    session?.challengeKind === 'device' ||
    session?.challengeKind === 'external_approval' ||
    session?.challengeKind === 'none'
  );
}

/**
 * 官方 `t4` @334253 邻域（逐字，截断处按 `_rawat` 可见部分照抄）：
 * 会话 id 相同才合并，缺失字段用旧会话补。
 */
export function mergeAuthSessions(
  next: OfficialAuthSession | null | undefined,
  previous: OfficialAuthSession | null | undefined,
): OfficialAuthSession | null | undefined {
  if (!next) return next;
  if (!previous || next.sessionId !== previous.sessionId) return next;
  return {
    ...next,
    redirectUrl: next.redirectUrl ?? previous.redirectUrl,
    verificationUrl: next.verificationUrl ?? previous.verificationUrl,
    userCode: next.userCode ?? previous.userCode,
    formFields: next.formFields?.length ? next.formFields : previous.formFields,
    submitUrl: next.submitUrl ?? previous.submitUrl,
    expiresAt: next.expiresAt ?? previous.expiresAt,
    pollIntervalMs: next.pollIntervalMs ?? previous.pollIntervalMs,
  };
}

/* ============================================================================
 * 12. store key + 状态机（`F` / `O`，@2144156 附近逐字）
 * ============================================================================ */

/** 官方 `i = `${n}:${e.connector_id}``（`n` = `tool_call_id ?? tool_use_id ?? ""`）。 */
export function connectorAuthCardStoreKey(toolCallId: string, connectorId: string): string {
  return `${toolCallId}:${connectorId}`;
}

/** 官方 `TQe` 的本地状态机的四个状态。 */
export type ConnectorAuthCardLocalStatus = 'idle' | 'waiting' | 'connected' | 'failed';

/** 官方派生：`F = d==="connected" || d==="idle" && w.status==="authenticated"`。 */
export function isConnectorAuthenticated(
  localStatus: ConnectorAuthCardLocalStatus,
  connectorStatus: string,
): boolean {
  return localStatus === 'connected' || (localStatus === 'idle' && connectorStatus === 'authenticated');
}

/** 官方 `O`（逐字）：`F ? "connected" : l ? "skipped" : d`。 */
export function resolveConnectorCardStatus(
  localStatus: ConnectorAuthCardLocalStatus,
  connectorStatus: string,
  skipped: boolean,
): 'connected' | 'skipped' | ConnectorAuthCardLocalStatus {
  return isConnectorAuthenticated(localStatus, connectorStatus)
    ? 'connected'
    : skipped
      ? 'skipped'
      : localStatus;
}

/**
 * 官方 `L()` @2144330 附近（逐字）：**仅 idle** 时的「状态说明」文案。
 * 返回 `null` ⇒ 调用点继续走 `U`/`description` 分支（见 {@link connectorAuthDescription}）。
 */
export function connectorAuthStatusText(
  status: ReturnType<typeof resolveConnectorCardStatus>,
  connectorStatus: string,
  displayName: string,
  t: (key: string, defaultValue?: string | ({ defaultValue: string } & Record<string, string | number>)) => string,
): string | null {
  if (status !== 'idle') return null;
  switch (connectorStatus) {
    case 'expired':
      return t('chatAdapter.connectorAuthCard.statusExpired', {
        name: displayName,
        defaultValue: `${displayName} connection has expired. Please reconnect.`,
      });
    case 'disconnected':
      return t('chatAdapter.addMenu.plugins.connectPromptDesc', {
        pluginName: displayName,
        defaultValue: `${displayName} is installed but not connected yet.`,
      });
    default:
      return null;
  }
}

/**
 * 官方 `U = O==="idle" && !!e.last_error && e.status!=="expired" && e.status!=="disconnected"`，
 * 与 `B()`（逐字）。
 *
 * ⚠️ 官方 `Vb(e.last_error, o)`（错误 → 文案映射）**未落地**：它依赖未解析的错误码集合
 * `q_e` 与解析器（见报告「未落地清单」）⇒ 这里在 `U` 为真时**直接回落到 `e.last_error` 原文**
 * （官方 `Vb(...) ?? e.last_error` 的 `??` 右支），不伪造映射。
 */
export function connectorAuthDescription(
  status: ReturnType<typeof resolveConnectorCardStatus>,
  failureText: string | null,
  card: OfficialConnectorAuthCard,
  lastError: string | null | undefined,
  displayName: string,
  t: (key: string, defaultValue?: string | ({ defaultValue: string } & Record<string, string | number>)) => string,
): string | null {
  if (status === 'failed') return failureText;
  if (status !== 'idle') return null;
  const statusText = connectorAuthStatusText(status, card.status ?? '', displayName, t);
  if (statusText) return statusText;
  const hasLastError =
    status === 'idle' &&
    !!lastError &&
    card.status !== 'expired' &&
    card.status !== 'disconnected';
  if (hasLastError) return lastError ?? null;
  return (
    card.description ||
    t('chatAdapter.connectorAuthCard.description', {
      defaultValue: 'Enables the agent to use custom tools and third-party integrations.',
    })
  );
}

/* ============================================================================
 * 13. 容器 `Loe` 的 view-model 映射（@2149033，逐字）
 * ============================================================================ */

/** 官方 `Loe` 的一行 view-model。 */
export interface ConnectorAuthCardRow {
  card: OfficialConnectorAuthCard;
  fallbackConnector: OfficialConnectorRecord | null;
  toolCallId: string;
}

/**
 * 官方 `Loe` @2149033（逐字）：
 * ```js
 * const t=e.response??null,
 *       n=(t?.auth_cards??[]).filter(i=>!!(i&&typeof i=="object"&&i.connector_id)),
 *       o=new Map((t?.connectors??[]).map(Ife).filter(i=>!!i).map(i=>[i.id,i])),
 *       r=(typeof e.tool_call_id=="string"?e.tool_call_id:"")||(typeof e.tool_use_id=="string"?e.tool_use_id:"");
 * return n.length===0?null:<div className="my-2 flex w-full flex-col gap-2">{n.map(i=><TQe key={i.connector_id} .../>)}</div>
 * ```
 * `Ife` 的正体（`wF`）依赖 `vendor-packages` 的 `kt()` 归一化，**未落地**（见报告）⇒ 这里
 * 接受**已归一化**的 `connectors[]`（形状与 `Ife` 产物一致）；调用方若拿到原始 API 记录，
 * 请先用 {@link normalizeConnectorAuthCard} 或官方 `Ife` 归一。
 */
export function connectorAuthCardRows(content: ToolEventContent | null | undefined): ConnectorAuthCardRow[] {
  const response = (content?.response ?? null) as {
    auth_cards?: unknown;
    connectors?: (OfficialConnectorRecord | null)[];
  } | null;
  const rawCards = Array.isArray(response?.auth_cards) ? response.auth_cards : [];
  const cards = rawCards.filter(
    (card): card is OfficialConnectorAuthCard =>
      !!card && typeof card === 'object' && !!(card as OfficialConnectorAuthCard).connector_id,
  );
  const connectors = new Map<string, OfficialConnectorRecord>();
  for (const connector of response?.connectors ?? []) {
    if (!connector) continue;
    connectors.set(connector.id, connector);
  }
  const toolCallId =
    (typeof content?.tool_call_id === 'string' ? content.tool_call_id : '') ||
    (typeof content?.tool_use_id === 'string' ? content.tool_use_id : '');
  return cards.map((card) => ({
    card,
    fallbackConnector: connectors.get(card.connector_id) ?? null,
    toolCallId,
  }));
}

/**
 * 官方 `TQe` 的 `w`（connector 解析）：
 * `y.find(Q=>Q.id===e.connector_id) ?? null ?? t ?? CQe(e)`
 * （API 列表 → fallbackConnector → 本地归一化）。
 */
export function resolveConnectorRecord(
  card: OfficialConnectorAuthCard,
  apiConnectors: readonly OfficialConnectorRecord[],
  fallbackConnector: OfficialConnectorRecord | null,
): OfficialConnectorRecord {
  const fromApi = apiConnectors.find((connector) => connector.id === card.connector_id);
  /* 官方逐字为 `y.find(...) ?? null ?? t ?? CQe(e)`；其中 `?? null` 相对左侧 `X | undefined`
     是**恒等 no-op**（保留语义、不写出会触发 TS2871 的冗余表达式）。 */
  return fromApi ?? fallbackConnector ?? normalizeConnectorAuthCard(card);
}
