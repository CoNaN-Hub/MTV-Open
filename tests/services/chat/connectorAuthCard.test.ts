/**
 * `connectorAuthCard` 的纯函数层回归 —— 验证分级 **(d) 源码级**。
 * 每条断言都对着 live bundle 的逐字源码（偏移见被测模块文件头）。
 */
import { describe, expect, it } from 'vitest';
import {
  CONNECTOR_AUTH_SCHEMES,
  CONNECTOR_STATUS_TOOL,
  buildStartConnectorAuthSessionBody,
  connectorAuthCardRows,
  connectorAuthCardStoreKey,
  connectorAuthDescription,
  enabledConnectorCapabilityIds,
  findPluginForConnector,
  isConnectorAuthCardEvent,
  isFeishuOrLarkConnector,
  isPollableChallenge,
  mergeAuthSessions,
  normalizeConnectorAuthCard,
  normalizeConnectorAuthScheme,
  normalizeConnectorNameKey,
  pluginMatchesConnector,
  pluginNameForConnector,
  resolveConnectorAuthFlow,
  resolveConnectorCardStatus,
  resolveConnectorDisplayName,
  resolveConnectorIconUrl,
  resolveConnectorRecord,
  resolveFeishuLarkName,
  sessionStatus,
  toConnectorAuthPluginShape,
  type OfficialConnectorAuthCard,
  type OfficialConnectorRecord,
  type OfficialPluginRecord,
} from '../../../src/services/chat/connectorAuthCard';
import { officialDesktopConnectorMcpText } from '../../../src/services/chat/desktopConnectorMcpStrings';

/** 官方 `o` = `se()` 的 `t`（zh-CN 表）。 */
const t = (key: string, defaultValue?: Parameters<typeof officialDesktopConnectorMcpText>[2]) =>
  officialDesktopConnectorMcpText(key, 'zh-CN', defaultValue);

const card: OfficialConnectorAuthCard = {
  connector_id: 'feishu',
  label: 'Feishu',
  description: 'Lark workspace',
  icon: '  https://cdn.example/i.png  ',
  status: 'disconnected',
  auth_scheme: 'oauth2_device',
};

describe('connectorAuthCard —— 族谓词（zNe @442510 / ID @444985）', () => {
  it('工具名 = get_connector_status', () => {
    expect(CONNECTOR_STATUS_TOOL).toBe('get_connector_status');
    expect(
      isConnectorAuthCardEvent({ type: 'tool_event', content: { tool: 'get_connector_status' } }),
    ).toBe(true);
    expect(
      isConnectorAuthCardEvent({ type: 'tool_event', content: { tool: 'get_connector_status2' } }),
    ).toBe(false);
    expect(isConnectorAuthCardEvent({ type: 'tool_event', content: null })).toBe(false);
    expect(isConnectorAuthCardEvent(null)).toBe(false);
  });
});

describe('connectorAuthCard —— feishu/lark 名称映射（xQe/yQe/_Qe @2140608 邻域）', () => {
  it('xQe：lower + trim + 空白/连字符 → 下划线', () => {
    expect(normalizeConnectorNameKey('  Fei-Shu  ')).toBe('fei_shu');
    expect(normalizeConnectorNameKey('A  B')).toBe('a_b');
  });

  it('yQe：先试 connector_id 再试 label', () => {
    expect(resolveFeishuLarkName('feishu', 'X')).toBe('feishu');
    expect(resolveFeishuLarkName('unknown', 'lark')).toBe('lark');
    expect(resolveFeishuLarkName('unknown', 'other')).toBeNull();
  });

  it('_Qe：命中映射走 `chatAdapter.addMenu.connectors.<name>`，否则原样返回 label', () => {
    expect(resolveConnectorDisplayName('feishu', 'Feishu', (key, dv) => t(key, dv))).toBe(
      officialDesktopConnectorMcpText('chatAdapter.addMenu.connectors.feishu', 'zh-CN', 'Feishu'),
    );
    expect(resolveConnectorDisplayName('slack', 'Slack', (key, dv) => t(key, dv))).toBe('Slack');
  });
});

describe('connectorAuthCard —— auth scheme（vQe @2141067 / wQe @2141078）', () => {
  it('白名单逐字 5 项；不命中 ⇒ undefined', () => {
    expect([...CONNECTOR_AUTH_SCHEMES]).toEqual([
      'oauth2_authcode',
      'oauth2_device',
      'static_token',
      'service_credentials',
      'none',
    ]);
    expect(normalizeConnectorAuthScheme('oauth2_device')).toBe('oauth2_device');
    expect(normalizeConnectorAuthScheme('form')).toBeUndefined();
    expect(normalizeConnectorAuthScheme(null)).toBeUndefined();
  });
});

describe('connectorAuthCard —— 本地归一化（CQe @2141291，逐字）', () => {
  it('逐字默认值', () => {
    expect(normalizeConnectorAuthCard({ connector_id: 'x' })).toEqual({
      id: 'x',
      label: 'x',
      description: '',
      icon: null,
      status: 'disconnected',
      authScheme: 'none',
      capabilities: [],
      connectedAt: null,
      lastError: null,
      pendingSessionId: null,
    });
    expect(normalizeConnectorAuthCard(card)).toMatchObject({
      id: 'feishu',
      label: 'Feishu',
      status: 'disconnected',
      authScheme: 'oauth2_device',
      icon: '  https://cdn.example/i.png  ',
      lastError: null,
      pendingSessionId: null,
    });
  });
});

describe('connectorAuthCard —— 图标三选一（SQe @2140 邻域，逐字）', () => {
  it('首个「字符串且 trim 非空」的值，返回 trim 结果', () => {
    expect(resolveConnectorIconUrl(null, '  a  ', 'b')).toBe('a');
    expect(resolveConnectorIconUrl('', '   ', undefined)).toBeNull();
    expect(resolveConnectorIconUrl(undefined, 'z')).toBe('z');
  });
});

describe('connectorAuthCard —— connector_id ↔ pluginName（bQe/Doe/dI @2140 邻域）', () => {
  const plugins: OfficialPluginRecord[] = [
    { pluginName: 'tapnow-slack', connectors: [{ name: 'slack-connector' }] },
    { pluginName: 'feishu', status: 'enabled' },
    { pluginName: 'other' },
  ];

  it('bQe：pluginName 或 connectors[].name 命中', () => {
    expect(pluginMatchesConnector(plugins[0], 'slack-connector')).toBe(true);
    expect(pluginMatchesConnector(plugins[0], 'nope')).toBe(false);
  });

  it('Doe：直连命中 → 加 tapnow- 前缀命中 → 返回加前缀后的串', () => {
    expect(pluginNameForConnector('slack-connector', plugins)).toBe('tapnow-slack');
    expect(pluginNameForConnector('feishu', plugins)).toBe('feishu');
    expect(pluginNameForConnector('ghost', plugins)).toBe('tapnow-ghost');
    expect(pluginNameForConnector('tapnow-ghost', plugins)).toBe('tapnow-ghost');
    expect(pluginNameForConnector('   ', plugins)).toBeNull();
  });

  it('dI：拿不到就 null', () => {
    expect(findPluginForConnector('feishu', plugins)?.pluginName).toBe('feishu');
    expect(findPluginForConnector('ghost', plugins)).toBeNull();
  });
});

describe('connectorAuthCard —— NQe card→plugin（@2141933 之前，逐字）', () => {
  it('downloadCount "0"、isInstalled true、skills []、connectors 单条', () => {
    expect(toConnectorAuthPluginShape(card)).toEqual({
      pluginName: 'feishu',
      displayName: 'Feishu',
      description: 'Lark workspace',
      downloadCount: '0',
      isInstalled: true,
      isUpdateAvailable: false,
      skills: [],
      connectors: [{ name: 'feishu', displayName: 'Feishu', description: 'Lark workspace' }],
    });
  });
});

describe('connectorAuthCard —— 能力 / feishu 判定 / 启动 body（wbe @98483 / _be @98560 / kR @98710）', () => {
  it('wbe：只留 enabled 且 id 非空', () => {
    expect(
      enabledConnectorCapabilityIds({
        capabilities: [
          { id: 'a', enabled: true },
          { id: 'b', enabled: false },
          { id: '', enabled: true },
        ],
      }),
    ).toEqual(['a']);
    expect(enabledConnectorCapabilityIds(null)).toEqual([]);
  });

  it('_be：connector_id / plugin.id / plugin.label / label 任一含 feishu|lark|飞书', () => {
    expect(isFeishuOrLarkConnector('feishu', 'X')).toBe(true);
    expect(isFeishuOrLarkConnector('x', 'Lark Suite')).toBe(true);
    expect(isFeishuOrLarkConnector('x', 'x', { label: '飞书' })).toBe(true);
    expect(isFeishuOrLarkConnector('slack', 'Slack')).toBe(false);
  });

  it('kR：有启用能力带 capabilities，否则只有 connector_id', () => {
    expect(
      buildStartConnectorAuthSessionBody('c', { capabilities: [{ id: 'a', enabled: true }] }),
    ).toEqual({ connector_id: 'c', capabilities: ['a'] });
    expect(buildStartConnectorAuthSessionBody('c', { capabilities: [] })).toEqual({
      connector_id: 'c',
    });
  });
});

describe('connectorAuthCard —— 授权流类型（I$ = fce @685246，逐字）', () => {
  it('redirectUrl → redirect', () => {
    expect(resolveConnectorAuthFlow({ redirectUrl: 'https://a' }, 'none')).toBe('redirect');
  });
  it('formFields 非空 → form', () => {
    expect(resolveConnectorAuthFlow({ formFields: [{ name: 'token' }] }, 'none')).toBe('form');
  });
  it('verificationUrl / userCode → device（external_approval 例外）', () => {
    expect(resolveConnectorAuthFlow({ verificationUrl: 'https://v' }, 'none')).toBe('device');
    expect(resolveConnectorAuthFlow({ userCode: '123' }, 'none')).toBe('device');
    expect(
      resolveConnectorAuthFlow({ userCode: '123', challengeKind: 'external_approval' }, 'none'),
    ).toBe('external_approval');
  });
  it('回落 authScheme，再回落 challengeKind', () => {
    expect(resolveConnectorAuthFlow({}, 'oauth2_authcode')).toBe('redirect');
    expect(resolveConnectorAuthFlow({}, 'oauth2_device')).toBe('device');
    expect(resolveConnectorAuthFlow({ challengeKind: 'weird' }, 'none')).toBe('weird');
    expect(resolveConnectorAuthFlow({}, 'none')).toBeUndefined();
  });
});

describe('connectorAuthCard —— 轮询会话（e4 / SCe / t4 @334253）', () => {
  it('e4：只取存在的 status 字段', () => {
    expect(sessionStatus({ status: 'authenticated' })).toBe('authenticated');
    expect(sessionStatus({})).toBeUndefined();
    expect(sessionStatus(null)).toBeUndefined();
  });

  it('SCe：四种 challengeKind 之一', () => {
    expect(isPollableChallenge({ sessionId: 's', challengeKind: 'redirect' })).toBe(true);
    expect(isPollableChallenge({ sessionId: 's', challengeKind: 'none' })).toBe(true);
    expect(isPollableChallenge({ sessionId: 's', challengeKind: 'other' })).toBe(false);
    expect(isPollableChallenge(null)).toBe(false);
  });

  it('t4：sessionId 相同才合并，缺失字段用旧会话补', () => {
    const next = { sessionId: 's1', userCode: 'n' };
    const prev = { sessionId: 's1', redirectUrl: 'r', verificationUrl: 'v', userCode: 'o' };
    expect(mergeAuthSessions(next, prev)).toEqual({
      sessionId: 's1',
      userCode: 'n',
      redirectUrl: 'r',
      verificationUrl: 'v',
      formFields: undefined,
      submitUrl: undefined,
      expiresAt: undefined,
      pollIntervalMs: undefined,
    });
    expect(mergeAuthSessions({ sessionId: 's2' }, prev)).toEqual({ sessionId: 's2' });
  });
});

describe('connectorAuthCard —— store key 与状态机（F / O / U / B，@2144 邻域逐字）', () => {
  it('store key = `${toolCallId}:${connectorId}`', () => {
    expect(connectorAuthCardStoreKey('call-1', 'feishu')).toBe('call-1:feishu');
    expect(connectorAuthCardStoreKey('', 'feishu')).toBe(':feishu');
  });

  it('O = F ? "connected" : l ? "skipped" : d', () => {
    expect(resolveConnectorCardStatus('connected', 'disconnected', false)).toBe('connected');
    expect(resolveConnectorCardStatus('idle', 'authenticated', false)).toBe('connected');
    expect(resolveConnectorCardStatus('idle', 'authenticated', true)).toBe('connected');
    expect(resolveConnectorCardStatus('idle', 'disconnected', true)).toBe('skipped');
    expect(resolveConnectorCardStatus('waiting', 'disconnected', false)).toBe('waiting');
    expect(resolveConnectorCardStatus('failed', 'disconnected', false)).toBe('failed');
  });

  it('L()：仅 idle；expired / disconnected 两个分支', () => {
    expect(
      connectorAuthDescription('idle', null, { connector_id: 'feishu', status: 'expired' }, null, 'Feishu', t),
    ).toBe('Feishu 授权已过期，请重新连接。');
    expect(
      connectorAuthDescription(
        'idle',
        null,
        { connector_id: 'feishu', status: 'disconnected' },
        null,
        'Feishu',
        t,
      ),
    ).toBe('检测到 Feishu 尚未成功连接');
  });

  it('B()：failed ⇒ g；非 idle ⇒ null；U 为真 ⇒ last_error 原文；否则 description / i18n', () => {
    const idleNoError: OfficialConnectorAuthCard = { connector_id: 'c', status: 'connected' };
    expect(connectorAuthDescription('failed', 'boom', idleNoError, null, 'C', t)).toBe('boom');
    expect(connectorAuthDescription('waiting', 'boom', idleNoError, null, 'C', t)).toBeNull();
    expect(
      connectorAuthDescription(
        'idle',
        null,
        { connector_id: 'c', status: 'error', description: 'desc' },
        'last-error',
        'C',
        t,
      ),
    ).toBe('last-error');
    expect(
      connectorAuthDescription(
        'idle',
        null,
        { connector_id: 'c', status: 'error', description: 'desc' },
        null,
        'C',
        t,
      ),
    ).toBe('desc');
    expect(
      connectorAuthDescription('idle', null, { connector_id: 'c', status: 'connected' }, null, 'C', t),
    ).toBe('允许 Agent 使用自定义工具和第三方集成。');
  });
});

describe('connectorAuthCard —— 容器 Loe 的 view-model（@2149033 逐字）', () => {
  const connectors: OfficialConnectorRecord[] = [
    {
      id: 'feishu',
      label: 'Feishu',
      description: '',
      icon: null,
      status: 'authenticated',
      authScheme: 'none',
      capabilities: [],
      connectedAt: null,
      lastError: null,
      pendingSessionId: null,
    },
  ];

  it('过滤掉无 connector_id 的项；key 用 connector_id；toolCallId = tool_call_id || tool_use_id || ""', () => {
    const rows = connectorAuthCardRows({
      tool_use_id: 'tu-1',
      request: {},
      response: {
        auth_cards: [{ connector_id: 'a' }, null, { connector_id: '' }, 'x', { connector_id: 'b' }],
        connectors,
      },
    });
    expect(rows.map((r) => r.card.connector_id)).toEqual(['a', 'b']);
    expect(rows[0].toolCallId).toBe('tu-1');
    expect(rows[0].fallbackConnector).toBeNull();
    expect(rows[1].fallbackConnector).toBeNull();
  });

  it('tool_call_id 优先于 tool_use_id', () => {
    const rows = connectorAuthCardRows({
      tool_call_id: 'tc-1',
      tool_use_id: 'tu-1',
      request: {},
      response: { auth_cards: [{ connector_id: 'a' }] },
    });
    expect(rows[0].toolCallId).toBe('tc-1');
  });

  it('connectors[] 归一后按 id 建 Map 作为 fallbackConnector', () => {
    const rows = connectorAuthCardRows({
      request: {},
      response: { auth_cards: [{ connector_id: 'feishu' }], connectors },
    });
    expect(rows[0].fallbackConnector?.status).toBe('authenticated');
  });

  it('无 auth_cards / 非数组 ⇒ 空数组', () => {
    expect(connectorAuthCardRows({ request: {}, response: {} })).toEqual([]);
    expect(connectorAuthCardRows({ request: {}, response: { auth_cards: 'x' } })).toEqual([]);
    expect(connectorAuthCardRows(null)).toEqual([]);
  });

  it('resolveConnectorRecord：API 列表 → fallbackConnector → CQe 本地归一化', () => {
    const local = { ...connectors[0], id: 'feishu' };
    expect(resolveConnectorRecord(card, connectors, null).status).toBe('authenticated');
    expect(resolveConnectorRecord(card, [], local).status).toBe('authenticated');
    expect(resolveConnectorRecord(card, [], null).status).toBe('disconnected');
  });
});
