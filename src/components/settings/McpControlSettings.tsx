/**
 * MCP 本地控制设置页，管理 bridge 会话、固定端口/令牌、自动开启和外部客户端配置片段。
 *
 * 版式 = **官方设计语言**（官方设置面板里没有「MCP 控制」这一页）：
 *   · 外壳 `SettingsPaneBody` + 面板头 `SettingsPaneHeader`（18/500 #f5f5f5 + 14 #7a7a7a）
 *     + 右上官方 Button `sm`（`.o-pane-head`）
 *   · 每项 = 官方 `SettingsRow`（`section`：`flex w-full flex-col gap-4 border-border/60 border-b pb-5`）
 *   · 传输方式 = 官方列表项 `.o-picker` / `.o-picker__item`（选中 `border-primary` + 主色 12% 底）
 *   · 说明块 = 官方 `.o-note`（`rounded-xl border border-border/80 bg-muted/20`，**没有黄色警告框**）
 *   · 配置片段 = 官方代码块 `.o-code`；确认弹窗 = 官方 Dialog（`o-dialog o-dialog--md`）
 */
import Select from '../shared/Select';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useShallow } from 'zustand/react/shallow';
import ModalOverlay from '../shared/ModalOverlay';
import { useAppStore } from '../../store/useAppStore';
import {
  getMcpBridgeStatus,
  stopMcpBridge,
} from '../../services/mcp/mcpBridgeService';
import type { McpBridgeSessionInfo } from '../../types/mcp';
import {
  buildMcpClientConfig,
  readRunningMcpToken,
  getMcpTokenPersistence,
  type McpTokenPersistence,
  getConfiguredMcpTransport,
  normalizeMcpPort,
  rotateMcpSessionToken,
  startConfiguredMcpBridge,
} from '../../services/mcp/mcpSessionConfig';
import { getMcpConnectionRequirements } from './mcpConnectionRequirements';
import { getConfiguredMcpToolExposure } from '../../services/mcp/mcpToolCatalog';
import { SettingsPaneBody, SettingsPaneHeader, SettingsRow } from './SettingsPane';
import {
  OFFICIAL_SELECT_TRIGGER,
  OfficialButton,
  OfficialNote,
  OfficialSwitch,
} from './official/OfficialControls';
import { useT } from '../../i18n';
import { StorageError } from '../../services/storageDiagnostics';

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

export default function McpControlSettings() {
  const t = useT();
  const { config, updateConfig, saveConfig } = useAppStore(useShallow((state) => ({
    config: state.config,
    updateConfig: state.updateConfig,
    saveConfig: state.saveConfig,
  })));
  const [session, setSession] = useState<McpBridgeSessionInfo | null>(null);
  const [token, setToken] = useState('');
  const [tokenPersistence, setTokenPersistence] = useState<McpTokenPersistence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [remoteConfirmOpen, setRemoteConfirmOpen] = useState(false);
  const portInputRef = useRef<HTMLInputElement>(null);
  const controlRevision = useRef(0);

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    const revision = controlRevision.current;
    getMcpBridgeStatus()
      .then(async (status) => {
        if (cancelled || revision !== controlRevision.current) return;
        setSession(status);
        setToken('');
        setTokenPersistence(null);
        // 会话已在运行（多为自动开启拉起的）时补出令牌，配置片段才能直接复制
        if (status) {
          const runningToken = await readRunningMcpToken(status.sessionId);
          if (cancelled || revision !== controlRevision.current) return;
          setToken(runningToken ?? '');
          setTokenPersistence(getMcpTokenPersistence());
        }
      })
      .catch((readError: unknown) => {
        if (!cancelled && revision === controlRevision.current) {
          setError(readError instanceof StorageError ? readError.message : t('无法读取 MCP 会话状态'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const clientConfig = useMemo(
    () => session && token ? buildMcpClientConfig(session, token) : null,
    [session, token],
  );

  const persistConfig = (patch: Parameters<typeof updateConfig>[0]) => {
    updateConfig(patch);
    void saveConfig();
  };

  const handleStart = async () => {
    controlRevision.current += 1;
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const started = await startConfiguredMcpBridge();
      setToken(started.token);
      setTokenPersistence(getMcpTokenPersistence());
      setSession(started.session);
    } catch (startError) {
      setToken('');
      setTokenPersistence(null);
      setSession(null);
      setError(startError instanceof Error ? startError.message : String(startError));
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    controlRevision.current += 1;
    setLoading(true);
    setError('');
    try {
      await stopMcpBridge();
      setSession(null);
      setToken('');
      setTokenPersistence(null);
      setCopied(false);
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : String(stopError));
    } finally {
      setLoading(false);
    }
  };

  // 轮换令牌会作废所有已发出的客户端配置；会话在运行时顺带重启，避免新旧令牌不一致。
  const handleRotateToken = async () => {
    controlRevision.current += 1;
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const nextToken = await rotateMcpSessionToken();
      if (session) {
        await stopMcpBridge();
        setSession(null);
        setToken('');
        setTokenPersistence(null);
        const started = await startConfiguredMcpBridge();
        setSession(started.session);
        setToken(started.token);
      } else {
        setToken(nextToken);
      }
      setTokenPersistence(getMcpTokenPersistence());
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : String(rotateError));
    } finally {
      setLoading(false);
    }
  };

  // ponytail: 20000-44999 随机，避开 Windows 动态端口段（49152+）与常见服务端口。
  // 万一撞上占用，开启会话时会明确报错，再点一次即可。
  const handleRandomPort = () => {
    const next = 20000 + Math.floor(Math.random() * 25000);
    if (portInputRef.current) portInputRef.current.value = String(next);
    setError('');
    persistConfig({ mcpPort: next });
  };

  const handleCopy = async () => {
    if (!clientConfig) return;
    try {
      await navigator.clipboard.writeText(clientConfig);
      setCopied(true);
    } catch {
      setError(t('复制客户端配置失败'));
    }
  };

  const handleTransportChange = (transport: 'stdio' | 'streamable-http') => {
    if (transport === getConfiguredMcpTransport(config.mcpTransport)) return;
    if (transport === 'streamable-http') {
      setRemoteConfirmOpen(true);
      return;
    }
    setError('');
    persistConfig({ mcpTransport: transport });
  };

  const confirmRemoteTransport = () => {
    setRemoteConfirmOpen(false);
    setError('');
    persistConfig({ mcpTransport: 'streamable-http' });
  };

  const configuredPort = normalizeMcpPort(config.mcpPort);
  const configuredTransport = getConfiguredMcpTransport(config.mcpTransport);
  const portChanged = session !== null && configuredPort !== undefined && configuredPort !== session.port;
  const transportChanged = session !== null && configuredTransport !== session.transport;
  const connectionRequirements = getMcpConnectionRequirements(configuredTransport);

  if (!isTauri) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {t('MCP 控制仅在 Tauri 桌面应用中可用。')}
      </div>
    );
  }

  return (
    <SettingsPaneBody>
      <div className="o-pane-head">
        <SettingsPaneHeader
          title={t('MCP 控制')}
          description={t('把画布能力以 MCP 服务暴露给外部客户端。')}
        />
        <div className="o-inline o-inline--wrap shrink-0">
          <OfficialButton
            variant={session ? 'outline' : 'default'}
            size="sm"
            onClick={session ? handleStop : handleStart}
            disabled={loading}
          >
            <Icon icon={session ? 'lucide:power-off' : 'lucide:power'} width={16} />
            {loading ? t('处理中') : session ? t('停止') : t('开启')}
          </OfficialButton>
        </div>
      </div>

      <div className="o-stack mt-8">
      {/* 会话状态 */}
      <div className="o-card">
        <div className="o-card__row o-card__row--center">
          <span className={session ? 'o-dot o-primary-bg' : 'o-dot o-muted-bg'} aria-hidden="true" />
          <div className="o-card__body">
            <div className="o-card__title">
              {session ? t('本地控制会话已开启') : t('本地控制会话已关闭')}
            </div>
            <div className="o-card__desc">
              {session
                ? session.transport === 'streamable-http'
                  ? t('远程 HTTP 端口 {port}{mode}', { port: session.port, mode: configuredPort === undefined ? t('（随机）') : t('（固定）') })
                  : t('回环端口 {port}{mode}', { port: session.port, mode: configuredPort === undefined ? t('（随机）') : t('（固定）') })
                : config.mcpAutoStart ? t('启动软件时自动开启') : t('默认关闭')}
            </div>
          </div>
          <span className={session ? 'o-badge o-badge--success' : 'o-badge o-badge--secondary'}>
            {session ? t('已开启') : t('已关闭')}
          </span>
        </div>
      </div>

      <SettingsRow
        stacked
        title={t('工具发现方式')}
        description={t('按需模式减少初始工具说明的上下文占用；完整模式适合已支持工具延迟加载的客户端。')}
      >
        <div className="o-field">
          <Select
            id="mcp-tool-exposure"
            className="min-w-0"
            triggerClassName={OFFICIAL_SELECT_TRIGGER}
            menuClassName="o-menu"
            menuHideOverlayScrollbar
            aria-describedby="mcp-tool-exposure-hint"
            fixedMenu
            value={getConfiguredMcpToolExposure(config.mcpToolExposure)}
            disabled={loading}
            onChange={(selectedOptionValue) => persistConfig({ mcpToolExposure: getConfiguredMcpToolExposure(selectedOptionValue) })}
          >
            <option value="compact">{t('按需发现（推荐）')}</option>
            <option value="full">{t('完整工具列表')}</option>
          </Select>
          <p id="mcp-tool-exposure-hint" className="o-field__desc">
            {t('切换后请在 MCP 客户端刷新工具列表或重新连接；已有对话的上下文不会自动清除。')}
          </p>
        </div>
      </SettingsRow>

      <SettingsRow
        title={t('启动软件时自动开启')}
        description={t('外部客户端无需每次手动开启会话；令牌固定保存在本机凭据存储中。')}
      >
        <OfficialSwitch
          label={t('启动软件时自动开启')}
          checked={config.mcpAutoStart === true}
          onChange={(next) => persistConfig({ mcpAutoStart: next })}
        />
      </SettingsRow>

      <SettingsRow
        stacked
        title={t('连接传输')}
        description={t('本机客户端走回环 stdio；跨机器或 Docker 环境走远程 Streamable HTTP。')}
      >
        <div className="o-picker">
          <button
            type="button"
            aria-pressed={configuredTransport === 'stdio'}
            className="o-picker__item"
            onClick={() => handleTransportChange('stdio')}
          >
            <Icon icon="lucide:terminal-square" width={18} />
            <span className="o-picker__copy">
              <strong>{t('本机 stdio')}</strong>
              <small>{t('只允许本机客户端通过 127.0.0.1 连接')}</small>
            </span>
          </button>
          <button
            type="button"
            aria-pressed={configuredTransport === 'streamable-http'}
            className="o-picker__item"
            onClick={() => handleTransportChange('streamable-http')}
          >
            <Icon icon="lucide:globe" width={18} />
            <span className="o-picker__copy">
              <strong>{t('远程 Streamable HTTP')}</strong>
              <small>{t('监听 0.0.0.0，允许其他机器或 Docker 连接')}</small>
            </span>
          </button>
        </div>
        {transportChanged && (
          <p className="o-muted-t text-[11px]">{t('传输方式将在下次开启会话时生效。')}</p>
        )}
      </SettingsRow>

      {configuredTransport === 'streamable-http' && (
        <OfficialNote tone="danger" icon={<Icon icon="lucide:shield-alert" width={16} />}>
          <div className="o-card__title">{t('远程 MCP 以最大权限运行')}</div>
          <p className="mt-1">
            {t('已连接的客户端可自动删除项目、写入文件、修改配置和调用付费媒体模型，不会出现逐次审批。仅在受信网络或隔离环境中开启。')}
          </p>
        </OfficialNote>
      )}

      <SettingsRow
        stacked
        title={configuredTransport === 'streamable-http' ? t('固定 HTTP 端口') : t('固定回环端口')}
        description={t('固定端口后客户端配置不再变化，写一次即可。')}
      >
        <div className="o-inline">
          <input
            ref={portInputRef}
            type="number"
            min={1024}
            max={65535}
            placeholder={t('留空则每次随机分配')}
            defaultValue={configuredPort ?? ''}
            aria-label={configuredTransport === 'streamable-http' ? t('固定 HTTP 端口') : t('固定回环端口')}
            className="o-input min-w-0 flex-1"
            onBlur={(event) => {
              const raw = event.target.value.trim();
              const next = raw ? normalizeMcpPort(raw) : undefined;
              if (raw && next === undefined) {
                setError(t('端口需在 1024-65535 之间'));
                event.target.value = String(configuredPort ?? '');
                return;
              }
              setError('');
              event.target.value = next ? String(next) : '';
              persistConfig({ mcpPort: next });
            }}
          />
          <OfficialButton
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleRandomPort}
            title={t('随机挑一个固定端口')}
          >
            <Icon icon="lucide:dices" width={16} />
            {t('随机')}
          </OfficialButton>
        </div>
        {portChanged && (
          <p className="o-muted-t text-[11px]">{t('新端口在下次开启会话时生效。')}</p>
        )}
      </SettingsRow>

      {session && !token && (
        <OfficialNote tone="warning" icon={<Icon icon="lucide:triangle-alert" width={16} />}>
          {t('未能读取当前会话令牌。请重新打开设置页重试；已保存的令牌不会被自动替换。')}
        </OfficialNote>
      )}

      {token && tokenPersistence === 'session-only' && (
        <div role="status" className="o-note o-note--warning" id="mcp-token-persistence">
          {t('令牌未能保存，目前仅本次应用会话有效。关闭应用后需要重新复制客户端配置。已保存的旧令牌不会被覆盖。')}
        </div>
      )}

      {clientConfig && (
        <SettingsRow
          stacked
          title={t('客户端配置片段')}
          description={tokenPersistence === 'persistent'
            ? t('粘贴到 Claude Desktop / Cursor 等客户端的 MCP 配置中。会话未开启时客户端调用会报错，重新开启即可继续用同一份配置。')
            : t('粘贴到客户端的 MCP 配置中。本次应用退出后，请重新检查并复制配置。')}
        >
          <div className="flex items-center justify-end gap-2">
            <OfficialButton
              variant="ghost"
              size="sm"
              onClick={handleRotateToken}
              disabled={loading}
              title={t('生成新令牌，旧配置立即失效')}
            >
              <Icon icon="lucide:refresh-cw" width={16} />
              {t('重置令牌')}
            </OfficialButton>
            <OfficialButton
              variant="outline"
              size="icon-sm"
              onClick={handleCopy}
              aria-label={t('复制 MCP 客户端配置')}
              title={t('复制客户端配置')}
            >
              <Icon icon={copied ? 'lucide:check' : 'lucide:copy'} width={14} />
            </OfficialButton>
          </div>
          <pre className="o-code">{clientConfig}</pre>
          {session?.transport === 'streamable-http' && (
            <p className="o-warn-t text-[11px]">
              {t('复制前请把 <AI_CANVAS_IP> 替换为运行 MTV 导演画布 电脑的局域网 IP。不同客户端的 HTTP 配置字段可能略有差异。')}
            </p>
          )}
        </SettingsRow>
      )}

      <section className="o-card o-card--pad" aria-labelledby="mcp-connection-requirements-title">
        <div className="o-inline">
          <Icon icon="lucide:circle-check-big" width={16} className="o-primary-t" />
          <h3 id="mcp-connection-requirements-title" className="o-card__title">
            {t('连接环境要求')}
          </h3>
        </div>
        <div className="o-picker mt-3">
          {connectionRequirements.map((requirement) => (
            <div key={requirement.title} className="o-picker__item cursor-default">
              <Icon icon={requirement.icon} width={18} />
              <div className="o-picker__copy">
                <strong>{t(requirement.title)}</strong>
                <small>{t(requirement.description)}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="o-details__body mt-3 border-t o-line pt-3">
          <p>
            <span className="o-fg-t font-medium">{t('首次连接：')}</span>
            {t('开启会话 → 复制上方配置 → 粘贴到客户端的 MCP 配置中 → 完全重启客户端。')}
          </p>
          <p className="mt-1">
            {t('修改端口或重置令牌后，需要重新复制配置并重启客户端。调用联网、云端模型或本地模型功能时，还需提前配置对应的网络、API Key 或模型环境。')}
          </p>
        </div>
      </section>

      {session && token && !clientConfig && (
        <OfficialNote tone="danger" icon={<Icon icon="lucide:circle-x" width={16} />}>
          {t('未找到本地 MCP 适配器脚本。')}
        </OfficialNote>
      )}

      <ModalOverlay
        isOpen={remoteConfirmOpen}
        onClose={() => setRemoteConfirmOpen(false)}
        ariaLabel={t('确认开启远程 MCP')}
        closeOnBackdrop={false}
        className="o-dialog o-dialog--md"
      >
        <button
          type="button"
          className="o-dialog__close"
          aria-label={t('关闭')}
          onClick={() => setRemoteConfirmOpen(false)}
        >
          <Icon icon="lucide:x" width={16} />
        </button>
        <header className="o-dialog__header">
          <h3 className="o-dialog__title">{t('确认暴露远程 MCP 服务')}</h3>
          <p className="o-dialog__desc">
            {t('服务将监听 0.0.0.0，局域网内能够到达该端口的设备都可以尝试连接。')}
          </p>
        </header>
        <div className="o-dialog__body flex flex-col gap-3" data-overlay-scrollbar="off">
          <p className="o-muted">
            {t('持有 Bearer Token 的客户端按自动生成模式运行，可无审批执行永久删除、文件写入、配置写入和付费媒体生成。')}
          </p>
          <OfficialNote tone="danger" icon={<Icon icon="lucide:shield-alert" width={16} />}>
            {t('请确认运行在受信网络、Docker 或其他隔离环境中，并继续保留独立备份。')}
          </OfficialNote>
        </div>
        <footer className="o-dialog__footer">
          <OfficialButton variant="outline" size="sm" onClick={() => setRemoteConfirmOpen(false)}>
            {t('取消')}
          </OfficialButton>
          <OfficialButton variant="destructive" size="sm" onClick={confirmRemoteTransport}>
            {t('我了解风险，切换到远程模式')}
          </OfficialButton>
        </footer>
      </ModalOverlay>

      {error && (
        <div className="o-note o-note--danger">
          <Icon icon="lucide:circle-x" width={16} />
          <div style={{ minWidth: 0 }}>{error}</div>
        </div>
      )}
      </div>
    </SettingsPaneBody>
  );
}
