/**
 * `ConnectorAuthCard` —— 官方 `Loe`（**@2149033**，`a.memo`；`displayName` @2149536）容器
 * + `TQe`（**@2142258**）真卡 + `RB`（**@2141933**）图标的**逐字**复刻。
 *
 * 官方原文（逐字，`_rawat.mjs` 原始窗口读出）：
 * ```js
 * Loe=a.memo(({content:e})=>{
 *   const t=e.response??null,
 *         n=(t?.auth_cards??[]).filter(i=>!!(i&&typeof i=="object"&&i.connector_id)),
 *         o=new Map((t?.connectors??[]).map(Ife).filter(i=>!!i).map(i=>[i.id,i])),
 *         r=(typeof e.tool_call_id=="string"?e.tool_call_id:"")||(typeof e.tool_use_id=="string"?e.tool_use_id:"");
 *   return n.length===0?null:s.jsx("div",{className:"my-2 flex w-full flex-col gap-2",
 *     children:n.map(i=>s.jsx(TQe,{card:i,fallbackConnector:o.get(i.connector_id)??null,toolCallId:r},i.connector_id))})
 * });
 * Loe.displayName="ConnectorAuthCard";
 * ```
 *
 * ── ⚠️ 本轮**未接线**的外部依赖（官方全部从 hook / store / context 拿，MTV 没有）────────
 *   · `Ev()`（`listConnectors`，react-query）、`Wm()`（`listPlugins`）、`JP()`（`startConnectorAuthSession`
 *     mutation）、`ZP()`（`installPlugin`）、`n1()`（`updatePluginInstallation`）→ {@link ConnectorAuthCardBridge}
 *   · `sn`（zustand store `skippedConnectorAuthCards` / `markConnectorAuthCardSkipped`）→ bridge
 *   · `iY()`（授权会话轮询 hook）→ bridge 的 `session` / `pollingError` + `registerAuthCallbacks`
 *     （**`iY` 内部用到的终结判定 `CO` 本轮未解析，故 hook 本体未落地** —— 见报告「未落地清单」）
 *   · `bD`（授权表单/设备码弹窗 @347560）、`e1`（CopyButton `k6` @409663）、`Gi`（插件图标兜底 @100672）
 *     → bridge 的三个 render prop；**未注入时**这三处按官方「无该元素」的渲染位置输出 `null`
 *   · `Np` / `Tp` / `Vb`（错误 → 文案映射）**未落地**（依赖未解析的错误码集合 `W_e`/`rCe`/`q_e`）
 *     ⇒ 直接回落到官方最内层文案 key / 错误原文
 *
 * ── 复用（**不是**新建替身）────────────────────────────────────────────────
 *   · `zp`（ShimmerText @181081/@180366）= 本仓库 `src/components/chat/ShimmerText.tsx`（已逐字对齐）
 *   · `z`（clsx/twMerge @174701）→ `./officialClassNames`
 *
 * 验证分级：**(b) jsdom**（`tests/components/desktopConnectorMcpCardsDom.test.tsx`）
 * + 纯函数 **(d) 源码级**（`tests/services/chat/connectorAuthCard.test.ts`）。
 * **没有**做 (a) live 画布实测。
 */
import { Fragment, memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { ToolEventContent } from '../../services/chat/agentContents';
import {
  buildStartConnectorAuthSessionBody,
  connectorAuthCardRows,
  connectorAuthCardStoreKey,
  connectorAuthDescription,
  findPluginForConnector,
  isFeishuOrLarkConnector,
  pluginNameForConnector,
  resolveConnectorAuthFlow,
  resolveConnectorCardStatus,
  resolveConnectorDisplayName,
  resolveConnectorIconUrl,
  resolveConnectorRecord,
  toConnectorAuthPluginShape,
  type ConnectorAuthCardLocalStatus,
  type OfficialAuthSession,
  type OfficialConnectorAuthCard,
  type OfficialConnectorRecord,
  type OfficialPluginRecord,
} from '../../services/chat/connectorAuthCard';
import { useDesktopConnectorMcpText } from '../../services/chat/desktopConnectorMcpStrings';
import ShimmerText from './ShimmerText';
import { z } from './officialClassNames';

/** 官方 `Ev()` / `Wm()` / `sn` / `JP()` / `ZP()` / `n1()` / `iY()` / `bD` / `e1` / `Gi` 的注入点。 */
export interface ConnectorAuthCardBridge {
  /** 官方 `Ev()`：`listConnectors()` 的 `data`。 */
  connectors?: readonly OfficialConnectorRecord[];
  /** 官方 `Wm()`：`listPlugins()` 的 `data`。 */
  plugins?: readonly OfficialPluginRecord[];
  /** 官方 store 选择器 `sn(Q=>!!Q.skippedConnectorAuthCards[i])`。 */
  isSkipped?: (key: string) => boolean;
  /** 官方 store action `markConnectorAuthCardSkipped`。 */
  markSkipped?: (key: string) => void;
  /** 官方 `N = JP()`：`startConnectorAuthSession` mutation。 */
  startSession?: (body: {
    connector_id: string;
    capabilities?: string[];
  }) => Promise<OfficialAuthSession | null>;
  /** 官方 `N.isPending`。 */
  isStartingSession?: boolean;
  /** 官方 `T = ZP()`：`installPlugin` mutation。 */
  installPlugin?: (pluginName: string) => Promise<unknown>;
  /** 官方 `E = n1()`：`updatePluginInstallation({status:"enabled"})` mutation。 */
  enablePlugin?: (pluginName: string) => Promise<unknown>;
  /** 官方 `b()`：connectors 查询的 `refetch`。 */
  refetchConnectors?: () => void;
  /** 官方 `rd()`：`()=>{$a=null,kh=null,pc=null,Ah=null}`（清 connector/auth 缓存）。 */
  clearAuthCache?: () => void;
  /** 官方 `ne.error(...)`（sonner toast）。 */
  onError?: (message: string) => void;
  /** 官方 `iY` 的 `G = P ?? p`（轮询会话 ?? 本地会话）。 */
  session?: OfficialAuthSession | null;
  /** 官方 `iY` 的 `j`（`pollingError`）。 */
  pollingError?: unknown;
  /** 把卡内的 `M`（认证成功）/ `A`（认证失败）交给接线方的轮询实现调用。 */
  registerAuthCallbacks?: (callbacks: {
    onAuthenticated: (() => void) | null;
    onFailed: ((error?: { errorMessage?: string }) => void) | null;
  }) => void;
  /** 官方 `Gi`（插件图标兜底 @100672）。未注入 ⇒ 不渲染图标。 */
  renderPluginIcon?: (props: {
    pluginId: string;
    label: string;
    size: number;
    variant: string;
  }) => ReactNode;
  /** 官方 `e1`（CopyButton `k6` @409663）：`variant:"clean"`, `shape:"square"`, `size:16`。 */
  renderCopyButton?: (props: {
    value: string;
    defaultText: string;
    successText: string;
    className: string;
  }) => ReactNode;
  /** 官方 `bD`（授权弹窗 @347560）。未注入 ⇒ 不渲染弹窗（官方 `f ? <bD/> : null` 的 null 支）。 */
  renderAuthDialog?: (props: {
    open: boolean;
    plugin: ReturnType<typeof toConnectorAuthPluginShape>;
    connector: OfficialConnectorRecord;
    session: OfficialAuthSession | null;
    onOpenChange: (open: boolean) => void;
    onAuthenticated: () => void;
    onRetry: () => void;
  }) => ReactNode;
}

/** 官方 `Ev()` / `Wm()` 未接线时的稳定空表（模块级常量 ⇒ `useCallback` 依赖不会每次渲染变化）。 */
const NO_CONNECTORS: readonly OfficialConnectorRecord[] = [];
const NO_PLUGINS: readonly OfficialPluginRecord[] = [];

/** 官方 `RB` @2141933（逐字）：有 `iconUrl` 就 `<img>`，否则 `Gi`。 */
function ConnectorIcon({
  card,
  iconUrl,
  bridge,
}: {
  card: OfficialConnectorAuthCard;
  iconUrl: string | null;
  bridge: ConnectorAuthCardBridge;
}) {
  if (iconUrl) {
    return (
      <span className="flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-white">
        <img
          src={iconUrl}
          alt=""
          aria-hidden={true}
          draggable={false}
          className="size-full object-contain"
        />
      </span>
    );
  }
  return (
    <>
      {bridge.renderPluginIcon?.({
        pluginId: card.connector_id,
        label: card.label || card.connector_id,
        size: 18,
        variant: 'pill',
      }) ?? null}
    </>
  );
}

interface ConnectorAuthCardItemProps {
  card: OfficialConnectorAuthCard;
  fallbackConnector: OfficialConnectorRecord | null;
  toolCallId: string;
  bridge: ConnectorAuthCardBridge;
}

/** 官方 `TQe` @2142258（逐字）。 */
export function ConnectorAuthCardItem({
  card,
  fallbackConnector,
  toolCallId,
  bridge,
}: ConnectorAuthCardItemProps) {
  const t = useDesktopConnectorMcpText();
  const displayName = resolveConnectorDisplayName(
    card.connector_id,
    card.label || card.connector_id,
    (key, defaultValue) => t(key, defaultValue),
  );
  const storeKey = connectorAuthCardStoreKey(toolCallId, card.connector_id);
  const skipped = bridge.isSkipped?.(storeKey) ?? false;

  const [localStatus, setLocalStatus] = useState<ConnectorAuthCardLocalStatus>('idle');
  const [localSession, setLocalSession] = useState<OfficialAuthSession | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [failureText, setFailureText] = useState<string | null>(null);

  const apiConnectors = bridge.connectors ?? NO_CONNECTORS;
  const plugins = bridge.plugins ?? NO_PLUGINS;
  const connector = resolveConnectorRecord(card, apiConnectors, fallbackConnector);
  const iconUrl = resolveConnectorIconUrl(card.icon, connector.icon);

  /** 官方 `k()`（逐字）：需要时先 installPlugin。 */
  const ensureInstalled = useCallback(async () => {
    const plugin = findPluginForConnector(card.connector_id, plugins);
    if (!plugin || plugin.isInstalled) return;
    await bridge.installPlugin?.(plugin.pluginName);
  }, [card.connector_id, plugins, bridge]);

  /** 官方 `I()`（逐字）：把插件状态置 `enabled`。 */
  const enableInstallation = useCallback(async () => {
    const pluginName = pluginNameForConnector(card.connector_id, plugins);
    if (!pluginName) return;
    const current = plugins.find((plugin) => plugin.pluginName === pluginName)?.status ?? 'enabled';
    if (current === 'enabled') return;
    await bridge.enablePlugin?.(pluginName);
  }, [card.connector_id, plugins, bridge]);

  /** 官方 `M`（逐字）：认证成功。 */
  const handleAuthenticated = useCallback(async () => {
    try {
      await enableInstallation();
    } catch {
      /* 官方 `catch(Q){ne.error(Tp(Q,o,"chatAdapter.addMenu.plugins.errors.statusUpdateFailed"))}`
         —— `Tp` 未落地 ⇒ 回落该 key 的官方文案（见文件头）。 */
      bridge.onError?.(t('chatAdapter.addMenu.plugins.errors.statusUpdateFailed'));
    }
    setLocalStatus('connected');
    setLocalSession(null);
    setDialogOpen(false);
    bridge.clearAuthCache?.();
    bridge.refetchConnectors?.();
    /* 官方 `M` 的 deps 逐字为 `[I,b,o]`；React Compiler 要求把用到的 state setter 也列出
       （setter 恒稳定，列出不改变重渲染时机）。 */
  }, [enableInstallation, bridge, t, setLocalStatus, setLocalSession, setDialogOpen]);

  /** 官方 `A`（逐字）：认证失败。`Vb` 未落地 ⇒ 直接用错误原文。 */
  const handleFailed = useCallback(
    (error?: { errorMessage?: string }) => {
      const raw = error?.errorMessage ?? '';
      setFailureText(
        (raw || null) ?? t('chatAdapter.connectorAuthCard.failed', 'Connection failed.'),
      );
      setLocalStatus('failed');
      setLocalSession(null);
    },
    [t, setFailureText, setLocalStatus, setLocalSession],
  );

  /** 官方：把 `M`/`A` 交给 `iY` 的 `onAuthenticated`/`onFailed`。 */
  useEffect(() => {
    bridge.registerAuthCallbacks?.({
      onAuthenticated: handleAuthenticated,
      onFailed: handleFailed,
    });
    return () => bridge.registerAuthCallbacks?.({ onAuthenticated: null, onFailed: null });
  }, [bridge, handleAuthenticated, handleFailed]);

  /** 官方轮询错误 effect（逐字）：仅 `waiting` 时生效。 */
  useEffect(() => {
    if (!bridge.pollingError || localStatus !== 'waiting') return;
    /* 官方 `Np(j,o,"chatAdapter.connectorAuthCard.failed")` 未落地 ⇒ 回落该 key。 */
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 官方 `TQe` 逐字：`!j||d!=="waiting"||(x(...),u("failed"),m(null),h(!1))`
    setFailureText(t('chatAdapter.connectorAuthCard.failed', 'Connection failed.'));
    setLocalStatus('failed');
    setLocalSession(null);
    setDialogOpen(false);
  }, [localStatus, bridge.pollingError, t]);

  /** 官方 `R()`（逐字）：启动授权会话。 */
  const startAuthorization = useCallback(async () => {
    try {
      await ensureInstalled();
      const session = await bridge.startSession?.(
        buildStartConnectorAuthSessionBody(card.connector_id, connector),
      );
      if (!session) {
        bridge.onError?.(t('chatAdapter.addMenu.connectors.errors.startFailed'));
        return;
      }
      setFailureText(null);
      setLocalSession(session);
      setLocalStatus('waiting');
      if (resolveConnectorAuthFlow(session, connector.authScheme) === 'form') {
        setDialogOpen(true);
        return;
      }
      const url = session.redirectUrl ?? session.verificationUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      /* 官方 `catch(Q){ne.error(Tp(Q,o,Np(Q,o,"...startFailed")))}`；`Tp`/`Np` 未落地 ⇒ 用最内层 key。 */
      bridge.onError?.(t('chatAdapter.addMenu.connectors.errors.startFailed'));
    }
  }, [
    ensureInstalled,
    bridge,
    card.connector_id,
    connector,
    t,
    setFailureText,
    setLocalSession,
    setLocalStatus,
    setDialogOpen,
  ]);

  /** 官方 `D()`（逐字）：取消 / 关闭。 */
  const cancel = useCallback(() => {
    setLocalSession(null);
    setDialogOpen(false);
    setLocalStatus('idle');
  }, [setLocalSession, setDialogOpen, setLocalStatus]);

  const authenticated = resolveConnectorCardStatus(localStatus, connector.status, skipped);
  const canInteractWithCard =
    localStatus === 'connected' || (localStatus === 'idle' && connector.status === 'authenticated');

  const session = bridge.session ?? localSession;
  const continueUrl = session
    ? (session.redirectUrl ?? session.verificationUrl)
    : null;
  const deviceCode = isFeishuOrLarkConnector(
    card.connector_id,
    card.label || card.connector_id,
    connector,
  )
    ? null
    : (session?.userCode ?? null);

  /** 官方 `W()`（逐字）：状态行。 */
  const renderStatusLine = () => {
    if (authenticated === 'waiting') {
      return (
        <ShimmerText
          as="p"
          duration={1.55}
          spread={2}
          className="mt-2 text-xs font-medium leading-4 text-text-text-secondary"
        >
          {t('chatAdapter.connectorAuthCard.waiting', 'Waiting for authorization...')}
        </ShimmerText>
      );
    }
    const text = connectorAuthDescription(
      authenticated,
      failureText,
      card,
      connector.lastError,
      displayName,
      (key, defaultValue) => t(key, defaultValue),
    );
    return text ? (
      <p className="mt-2 text-xs font-medium leading-4 text-text-text-secondary">{text}</p>
    ) : null;
  };

  /** 官方 `q`（逐字 switch on `O`）。 */
  const renderActions = (): ReactNode => {
    switch (authenticated) {
      case 'connected':
        return null;
      case 'skipped':
        return (
          <span className="whitespace-nowrap text-xs font-medium leading-4 text-text-text-tertiary">
            {t('chatAdapter.connectorAuthCard.skipped', 'Skipped')}
          </span>
        );
      case 'waiting':
        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cancel}
              className="cursor-pointer rounded-full px-2 py-1 text-xs font-medium leading-4 whitespace-nowrap text-text-text-secondary transition-colors hover:bg-white/8 hover:text-text-text-primary"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            {continueUrl ? (
              <a
                href={continueUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-6 min-w-0 max-w-full cursor-pointer items-center justify-center truncate rounded-full bg-white px-3 text-xs font-medium leading-4 text-black transition-opacity hover:opacity-90"
              >
                {t('chatAdapter.connectorAuthCard.continueIn', {
                  name: displayName,
                  defaultValue: `Continue in ${displayName}`,
                })}
              </a>
            ) : null}
          </div>
        );
      case 'failed':
      case 'idle':
        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => bridge.markSkipped?.(storeKey)}
              className="cursor-pointer rounded-full px-2 py-1 text-xs font-medium leading-4 whitespace-nowrap text-text-text-secondary transition-colors hover:bg-white/8 hover:text-text-text-primary"
            >
              {t('chatAdapter.connectorAuthCard.skip', 'Skip')}
            </button>
            <button
              type="button"
              onClick={() => {
                void startAuthorization();
              }}
              disabled={bridge.isStartingSession === true}
              className="flex h-6 max-w-full cursor-pointer items-center justify-center truncate rounded-full bg-white px-3 text-xs font-medium leading-4 text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bridge.isStartingSession === true
                ? t('chatAdapter.addMenu.connectors.connecting', 'Connecting...')
                : authenticated === 'failed'
                  ? t('chatAdapter.connectorAuthCard.retry', 'Retry')
                  : t('chatAdapter.connectorAuthCard.authenticate', 'Authenticate')}
            </button>
          </div>
        );
    }
  };

  /* 官方 `q` 是**一次**求值的 IIFE：`const q=(()=>{switch(O){...}})()`。 */
  const actions = renderActions();

  return (
    <Fragment>
      <div
        className={z(
          'flex w-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] px-4',
          authenticated === 'connected' ? 'py-3' : 'pt-3 pb-2.5',
          skipped && !canInteractWithCard && 'opacity-60',
        )}
      >
        {authenticated === 'connected' ? (
          <div className="flex min-w-0 items-center gap-2">
            <ConnectorIcon card={card} iconUrl={iconUrl} bridge={bridge} />
            <p className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-text-text-primary">
              {displayName}
            </p>
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium leading-4 text-accent-accent-success">
              <span className="size-1.5 rounded-full bg-accent-accent-success" aria-hidden={true} />
              {t('chatAdapter.addMenu.connectors.status.authenticated', 'Connected')}
            </span>
          </div>
        ) : (
          <Fragment>
            <div className="flex min-w-0 items-center gap-2">
              <ConnectorIcon card={card} iconUrl={iconUrl} bridge={bridge} />
              <p className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-text-text-primary">
                {t('chatAdapter.connectorAuthCard.title', {
                  name: displayName,
                  defaultValue: `Connect with ${displayName}`,
                })}
              </p>
            </div>
            {renderStatusLine()}
            {authenticated === 'waiting' && deviceCode ? (
              <div className="mt-2 grid grid-cols-[2rem_1fr_2rem] items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2">
                <span aria-hidden={true} className="size-8" />
                <p className="text-center font-mono text-base font-semibold tracking-[0.25em] text-white">
                  {deviceCode}
                </p>
                {bridge.renderCopyButton?.({
                  value: deviceCode,
                  defaultText: t('common.copy', 'Copy'),
                  successText: t('common.copied', 'Copied'),
                  className: 'size-8 justify-self-end',
                }) ?? null}
              </div>
            ) : null}
            {actions ? (
              <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
                {actions}
              </div>
            ) : null}
          </Fragment>
        )}
      </div>
      {dialogOpen
        ? (bridge.renderAuthDialog?.({
            open: dialogOpen,
            plugin: toConnectorAuthPluginShape(card),
            connector,
            session: localSession,
            onOpenChange: (open) => {
              if (!open) cancel();
            },
            onAuthenticated: () => {
              void handleAuthenticated();
            },
            onRetry: () => {
              setDialogOpen(false);
              void startAuthorization();
            },
          }) ?? null)
        : null}
    </Fragment>
  );
}

export interface ConnectorAuthCardProps {
  content: ToolEventContent;
  bridge?: ConnectorAuthCardBridge;
}

/**
 * 官方 `Loe` @2149033 容器。派发处（@2427975）**只有 `status==="completed"` 才渲染**，
 * 该判定在分派器里（`if(ID(e)){const T=e.content;if(T.status==="completed")return s.jsx(Loe,{content:T})}`）。
 */
const ConnectorAuthCard = memo(function ConnectorAuthCard({
  content,
  bridge,
}: ConnectorAuthCardProps) {
  const effectiveBridge = bridge ?? {};
  const rows = connectorAuthCardRows(content);
  if (rows.length === 0) return null;
  return (
    <div className="my-2 flex w-full flex-col gap-2">
      {rows.map((row) => (
        <ConnectorAuthCardItem
          key={row.card.connector_id}
          card={row.card}
          fallbackConnector={row.fallbackConnector}
          toolCallId={row.toolCallId}
          bridge={effectiveBridge}
        />
      ))}
    </div>
  );
});

ConnectorAuthCard.displayName = 'ConnectorAuthCard';

export default ConnectorAuthCard;
