/**
 * 「应用 / 插件域」提及数据层（`services/chat/mentionPlugins.ts`）回归。
 *
 * 期望值全部来自 live 官方产物 `vendor-pkg-canvas-ChpWx5JY.js` 的逐字定义（见该文件头表）：
 *  `Pde`(canvas 头部 `a7 as C$`，源在 vendor-packages @1012567) · `I1` @98139 ·
 *  `Ub` 内 `tt` @238346 · `Ne` 的 `yt` @2535432 · `lrt` @2526609 · `k0e`+`I0e` @190895 · `M0e` @191119
 */
import { describe, expect, it } from 'vitest';
import {
  appendMentionPluginExamplePrompt,
  buildMentionPluginConnectDetail,
  buildMentionSuggestionPluginItem,
  insertMentionPluginValue,
  mentionPluginConnectorStatus,
  mentionPluginSkillName,
  mentionPluginSourceFromInstalled,
  mentionPluginSourcesFromInstalled,
  mentionPluginTokenReady,
  type MentionPluginSource,
} from '../../src/services/chat/mentionPlugins';
import type { InstalledPlugin } from '../../src/types/plugin';

const plugin = (overrides: Partial<MentionPluginSource> = {}): MentionPluginSource => ({
  pluginName: 'demo',
  displayName: 'Demo App',
  description: 'desc',
  isInstalled: true,
  status: 'enabled',
  skills: [],
  connectors: [],
  ...overrides,
});

describe('official C$ (Pde) — plugin skill name', () => {
  it('brainstorm 直接用插件名', () => {
    expect(mentionPluginSkillName(plugin({ pluginName: 'brainstorm' }))).toBe('brainstorm');
  });

  it('优先取「不在连接器名单里」的第一个技能', () => {
    expect(mentionPluginSkillName(plugin({
      skills: [{ name: 'feishu' }, { name: 'write' }, { name: 'read' }],
      connectors: [{ name: 'feishu' }],
    }))).toBe('write');
  });

  it('所有技能都被连接器占用 ⇒ 回落 skills[0].name；无技能 ⇒ 回落插件名', () => {
    expect(mentionPluginSkillName(plugin({
      skills: [{ name: 'feishu' }],
      connectors: [{ name: 'feishu' }],
    }))).toBe('feishu');
    expect(mentionPluginSkillName(plugin({ skills: [] }))).toBe('demo');
  });
});

describe('official I1 — merge connector statuses', () => {
  const withConnectors = plugin({ connectors: [{ name: 'a' }, { name: 'b' }] });

  it('无连接器 ⇒ undefined', () => {
    expect(mentionPluginConnectorStatus(plugin({ connectors: [] }), new Map())).toBeUndefined();
  });

  it('状态表里查不到任何一项 ⇒ undefined', () => {
    expect(mentionPluginConnectorStatus(withConnectors, new Map())).toBeUndefined();
  });

  it('全 authenticated ⇒ authenticated', () => {
    expect(mentionPluginConnectorStatus(withConnectors, new Map([['a', 'authenticated'], ['b', 'authenticated']])))
      .toBe('authenticated');
  });

  it('优先级逐字：pending_approval > pending > expired > error > disconnected', () => {
    expect(mentionPluginConnectorStatus(withConnectors, new Map([['a', 'authenticated'], ['b', 'pending_approval']])))
      .toBe('pending_approval');
    expect(mentionPluginConnectorStatus(withConnectors, new Map([['a', 'expired'], ['b', 'pending']])))
      .toBe('pending');
    expect(mentionPluginConnectorStatus(withConnectors, new Map([['a', 'error'], ['b', 'expired']])))
      .toBe('expired');
    expect(mentionPluginConnectorStatus(withConnectors, new Map([['a', 'disconnected'], ['b', 'error']])))
      .toBe('error');
    expect(mentionPluginConnectorStatus(withConnectors, new Map([['a', 'disconnected']])))
      .toBe('disconnected');
  });
});

describe('official lrt — can the app be written into the chat', () => {
  it('未安装 / 非 enabled / 连接器未就绪 三条都拦', () => {
    expect(mentionPluginTokenReady({ isInstalled: false, status: 'enabled' })).toBe(false);
    expect(mentionPluginTokenReady({ isInstalled: true, status: 'disabled' })).toBe(false);
    expect(mentionPluginTokenReady({ isInstalled: true, status: 'enabled', connectors: [{}] }, 'pending')).toBe(false);
    expect(mentionPluginTokenReady({ isInstalled: true, status: 'enabled', connectors: [{}] }, 'authenticated')).toBe(true);
    /* 无连接器 ⇒ 连接状态位不参与判定。 */
    expect(mentionPluginTokenReady({ isInstalled: true, connectors: [] }, undefined)).toBe(true);
    /* 连接器存在但状态表没给值（`t === void 0`）⇒ 放行。 */
    expect(mentionPluginTokenReady({ isInstalled: true, connectors: [{}] }, undefined)).toBe(true);
  });
});

describe('official Ub tt(plugin) — row data to mention item', () => {
  it('字段与 renderText 逐字', () => {
    const item = buildMentionSuggestionPluginItem(plugin({
      pluginName: 'feishu',
      displayName: '飞书',
      skills: [{ name: 'feishu' }, { name: 'doc' }],
      connectors: [{ name: 'feishu' }],
      status: 'enabled',
      iconUrl: 'https://x/y.png',
    }), 'authenticated');
    expect(item).toEqual({
      id: 'feishu',
      label: '飞书',
      type: 'plugin',
      renderText: 'plugin:feishu:doc',
      description: 'desc',
      pluginStatus: 'enabled',
      pluginIsInstalled: true,
      pluginSkills: [{ name: 'feishu' }, { name: 'doc' }],
      pluginConnectors: [{ name: 'feishu' }],
      pluginConnectorStatus: 'authenticated',
      pluginIconUrl: 'https://x/y.png',
    });
  });

  it('skills / connectors 缺省为空数组；isInstalled 非 true 时归一为 false', () => {
    const item = buildMentionSuggestionPluginItem({ pluginName: 'p', displayName: 'P' });
    expect(item.pluginSkills).toEqual([]);
    expect(item.pluginConnectors).toEqual([]);
    expect(item.pluginIsInstalled).toBe(false);
    expect(item.renderText).toBe('plugin:p:p');
  });
});

describe('official Ne yt — plugin connect detail', () => {
  it('技能为空时用 parsed.skillName 造一条；连接器补 displayName/description 兜底', () => {
    const item = buildMentionSuggestionPluginItem(plugin());
    const detail = buildMentionPluginConnectDetail(
      { ...item, pluginIsInstalled: true, pluginStatus: 'enabled' },
      { pluginName: 'demo', skillName: 'write' },
    );
    expect(detail).toEqual({
      pluginName: 'demo',
      displayName: 'Demo App',
      description: 'desc',
      downloadCount: '0',
      isInstalled: true,
      status: 'enabled',
      isUpdateAvailable: false,
      skills: [{ name: 'write', displayName: 'write', description: '' }],
      connectors: [],
      marketingSlots: [],
      iconUrl: undefined,
    });
  });

  it('pluginSkills 非空时逐条补 displayName/description；连接器同理', () => {
    const item = buildMentionSuggestionPluginItem(plugin({
      skills: [{ name: 'a' }, { name: 'b', displayName: 'B', description: 'bd' }],
      connectors: [{ name: 'c' }, { name: 'd', displayName: 'D', description: 'dd' }],
    }));
    const detail = buildMentionPluginConnectDetail(item, { pluginName: 'demo', skillName: 'a' });
    expect(detail.skills).toEqual([
      { name: 'a', displayName: 'a', description: '' },
      { name: 'b', displayName: 'B', description: 'bd' },
    ]);
    expect(detail.connectors).toEqual([
      { name: 'c', displayName: 'c', description: '' },
      { name: 'd', displayName: 'D', description: 'dd' },
    ]);
  });
});

describe('official k0e + I0e — write {{plugin:skill}} into the input value', () => {
  it('值里已有同插件 token ⇒ 原位替换（不追加）', () => {
    expect(insertMentionPluginValue('看 {{demo:read}} 这个', 'demo', 'write')).toBe('看 {{demo:write}} 这个');
  });

  it('值里没有 ⇒ 追加；末尾空白只补 token，不重复空格', () => {
    expect(insertMentionPluginValue('你好', 'demo', 'write')).toBe('你好 {{demo:write}} ');
    expect(insertMentionPluginValue('你好 ', 'demo', 'write')).toBe('你好 {{demo:write}} ');
    expect(insertMentionPluginValue('', 'demo', 'write')).toBe('{{demo:write}} ');
  });

  it('插件名的正则元字符被转义（official A0e）', () => {
    expect(insertMentionPluginValue('x {{a.b:old}} y', 'a.b', 'new')).toBe('x {{a.b:new}} y');
  });
});

describe('official M0e — append example prompt', () => {
  it('空 / 已包含 ⇒ 原样返回；否则按末尾空白决定分隔符', () => {
    expect(appendMentionPluginExamplePrompt('a', '')).toBe('a');
    expect(appendMentionPluginExamplePrompt('a', undefined)).toBe('a');
    expect(appendMentionPluginExamplePrompt('a want b', 'want')).toBe('a want b');
    expect(appendMentionPluginExamplePrompt('a', 'p')).toBe('a p');
    expect(appendMentionPluginExamplePrompt('a ', 'p')).toBe('a p');
    expect(appendMentionPluginExamplePrompt('', 'p')).toBe('p');
  });
});

describe('MTV adapter: InstalledPlugin to official plugin list item', () => {
  const installed = (overrides: Partial<InstalledPlugin> = {}): InstalledPlugin => ({
    id: 'demo',
    source: 'local',
    enabled: true,
    installedAt: 0,
    updatedAt: 0,
    manifest: {
      apiVersion: 1,
      runtime: 'javascript',
      id: 'demo',
      name: 'Demo',
      version: '1.0.0',
      category: 'utility',
      entry: 'main.js',
      permissions: [],
      contributes: { nodeTools: [] },
      description: 'demo plugin',
      repository: 'https://github.com/a/demo',
    },
    ...overrides,
  });

  it('enabled 映射成官方 status 口径；无技能/连接器/图标（MTV manifest 没有这些字段）', () => {
    expect(mentionPluginSourceFromInstalled(installed())).toEqual({
      pluginName: 'demo',
      displayName: 'Demo',
      description: 'demo plugin',
      isInstalled: true,
      status: 'enabled',
      skills: [],
      connectors: [],
      iconUrl: undefined,
      category: 'utility',
    });
    expect(mentionPluginSourceFromInstalled(installed({ enabled: false })).status).toBe('disabled');
  });

  it('批量保持入参顺序', () => {
    const list = mentionPluginSourcesFromInstalled([
      installed({ id: 'a', manifest: { ...installed().manifest, id: 'a', name: 'A' } }),
      installed({ id: 'b', manifest: { ...installed().manifest, id: 'b', name: 'B' } }),
    ]);
    expect(list.map((entry) => entry.pluginName)).toEqual(['a', 'b']);
  });
});
