/**
 * 「应用 / 插件域」提及数据层 —— live 官方 bundle 逐字移植。
 *
 * 官方出处（三步符号解析，均在 `vendor-pkg-canvas-ChpWx5JY.js`；`i18n` 的 `m` = `se().t`）：
 *
 * | 官方符号 | 偏移 | 本文件 | 逐字原文 |
 * | --- | --- | --- | --- |
 * | `Pde` | vendor-packages @1012567（canvas 头部 `a7 as C$`） | `mentionPluginSkillName` | `if(e.pluginName==="brainstorm")return"brainstorm"; const t=new Set(e.connectors.map(n=>n.name)); return e.skills.find(n=>!t.has(n.name))?.name??e.skills[0]?.name??e.pluginName` |
 * | `I1` | canvas @98139 | `mentionPluginConnectorStatus` | `if(e.connectors.length===0)return; const n=e.connectors.map(o=>t.get(o.name)).filter(o=>!!o); if(n.length!==0) return n.every(o=>o==="authenticated")?"authenticated":n.some(o=>o==="pending_approval")?"pending_approval":n.some(o=>o==="pending")?"pending":n.some(o=>o==="expired")?"expired":n.some(o==="error")?"error":"disconnected"` |
 * | `Pve` | canvas @151277 | （复用 `mentionTokens.pluginRenderText`） | `Pve=(e,t)=>\`plugin:${e}:${t}\`` |
 * | `lrt` | canvas @2526609 | `mentionPluginTokenReady` | `lrt=(e,t)=>e.isInstalled&&(e.status??"enabled")==="enabled"&&(e.connectors.length===0||t===void 0||t==="authenticated")` |
 * | `Ub` 内 `tt` | canvas @238346 | `buildMentionSuggestionPluginItem` | `o({id:Ye.pluginName,label:Ye.displayName,type:"plugin",renderText:Pve(Ye.pluginName,vt),description:Ye.description,pluginStatus:Ye.status,pluginIsInstalled:Ye.isInstalled,pluginSkills:Ye.skills,pluginConnectors:Ye.connectors,pluginConnectorStatus:Ht,pluginIconUrl:Ye.iconUrl})`（`vt=C$(Ye)`、`Ht=I1(Ye,ae)`） |
 * | `Ne` 的 `yt` | canvas @2535432 | `buildMentionPluginConnectDetail` | `yt={pluginName:Ke.pluginName,displayName:Ee.label,description:Ee.description??"",downloadCount:"0",isInstalled:Ee.pluginIsInstalled===!0,status:Ee.pluginStatus,isUpdateAvailable:!1,skills:ze,connectors:ft,marketingSlots:[],iconUrl:Ee.pluginIconUrl}` |
 * | `k0e` + `I0e` | canvas @190895 | `insertMentionPluginValue` | `k0e=(e,t)=>\`{{${e}:${t}}}\``；`I0e=(e,t,n)=>{const o=k0e(t,n),r=new RegExp(\`\\\\{\\\\{${A0e(t)}:[^}]+\\\\}\\\\}\`,"g"); let i=!1; const l=e.replace(r,()=>(i=!0,o)); return i?l:e?/\\s$/.test(e)?\`${e}${o} \`:\`${e} ${o} \`:\`${o} \`}` |
 * | `M0e` | canvas @191119 | `appendMentionPluginExamplePrompt` | `M0e=(e,t)=>{const n=t?.trim(); return!n||e.includes(n)?e:e?/\\s$/.test(e)?\`${e}${n}\`:\`${e} ${n}\`:n}` |
 *
 * ⚠️ 「官方 plugin 列表对象」与「`Ub` 行的 `plugin` 项」是**同一个东西**（`Ub` 的 `Re` 直接来自
 * `componentProps.plugins`，行里读 `plugin.displayName` / `plugin.pluginName` / `plugin.iconUrl`）；
 * `Ub` 的行点击 (`tt`) 才把它转成 `mention` 项（`type:"plugin"` + `renderText:"plugin:<name>:<skill>"`），
 * 再交给 `qie`/`MessageInputAreaV2` 的 `handleSelect:Ne`。本文件把这两步分开：
 * `MentionPluginSource` = 行数据；`MentionSuggestionPluginItem` = `Ne` 的入参。
 *
 * ⚠️ 如实说明（MTV 数据源差异）：官方 `Re` 来自服务端应用目录 (`Wm()`)，对象含
 * `skills` / `connectors` / `status` / `isInstalled` / `iconUrl`；MTV 的「应用」是
 * 用户自写的本地代码插件（`InstalledPlugin`，见 `store.plugins.ts`），**没有技能 / 连接器概念**
 * ⇒ `mentionPluginSourcesFromInstalled()` 只能填 `skills: []` / `connectors: []` /
 * `status: enabled|disabled` / `iconUrl: undefined`。不猜测不存在的字段。
 */
import type { InstalledPlugin } from '../../types/plugin';
import { pluginRenderText } from './mentionTokens';

/** 官方 `connectors.status.*`：连接器的 6 个合并状态。 */
export type MentionConnectorStatus =
  | 'authenticated'
  | 'pending_approval'
  | 'pending'
  | 'expired'
  | 'error'
  | 'disconnected';

/** 官方 plugin 对象里的技能项（`skills` 命名空间）。 */
export type MentionPluginSkillInfo = {
  name: string;
  displayName?: string;
  description?: string;
};

/** 官方 plugin 对象里的连接器项。 */
export type MentionPluginConnectorInfo = {
  name: string;
  displayName?: string;
  description?: string;
};

/** 官方 plugin 列表项（`Ub` 的 `Re[]`，即 `componentProps.plugins`）。 */
export type MentionPluginSource = {
  pluginName: string;
  displayName: string;
  description?: string;
  isInstalled?: boolean;
  status?: string;
  skills?: readonly MentionPluginSkillInfo[];
  connectors?: readonly MentionPluginConnectorInfo[];
  iconUrl?: string;
  categoryLabel?: string;
  category?: string;
  examplePrompts?: readonly string[];
};

/** 官方 `Ne` 的入参（`Ub` 的 `tt` 造出来的 mention 项）。 */
export type MentionSuggestionPluginItem = {
  id: string;
  label: string;
  type: 'plugin';
  renderText: string;
  description?: string;
  pluginStatus?: string;
  pluginIsInstalled: boolean;
  pluginSkills: readonly MentionPluginSkillInfo[];
  pluginConnectors: readonly MentionPluginConnectorInfo[];
  pluginConnectorStatus?: MentionConnectorStatus;
  pluginIconUrl?: string;
};

/** 官方 `Ne` 内部组装的「插件详情」（喂 `lrt` / `_p` / `setPluginToConnect`）。 */
export type MentionPluginConnectDetail = {
  pluginName: string;
  displayName: string;
  description: string;
  downloadCount: string;
  isInstalled: boolean;
  status?: string;
  isUpdateAvailable: boolean;
  skills: MentionPluginSkillInfo[];
  connectors: MentionPluginConnectorInfo[];
  marketingSlots: readonly never[];
  iconUrl?: string;
};

/** 官方 `A0e`：正则转义。 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 官方 `Pde`（canvas 头部 `a7 as C$`）：挑出插件在对话里使用的技能名。 */
export function mentionPluginSkillName(plugin: MentionPluginSource): string {
  if (plugin.pluginName === 'brainstorm') return 'brainstorm';
  const connectorNames = new Set((plugin.connectors ?? []).map((connector) => connector.name));
  const skills = plugin.skills ?? [];
  return skills.find((skill) => !connectorNames.has(skill.name))?.name ?? skills[0]?.name ?? plugin.pluginName;
}

/**
 * 官方 `I1(plugin, statusById)`：把插件的多个连接器状态合并成一个。
 * 优先级逐字：全部 `authenticated` → `authenticated`；否则 `pending_approval` → `pending`
 * → `expired` → `error` → `disconnected`。无连接器 / 无任何已知状态 ⇒ `undefined`。
 */
export function mentionPluginConnectorStatus(
  plugin: Pick<MentionPluginSource, 'connectors'>,
  connectorStatusById?: ReadonlyMap<string, MentionConnectorStatus> | null,
): MentionConnectorStatus | undefined {
  const connectors = plugin.connectors ?? [];
  if (connectors.length === 0) return undefined;
  if (!connectorStatusById) return undefined;
  const statuses = connectors
    .map((connector) => connectorStatusById.get(connector.name))
    .filter((status): status is MentionConnectorStatus => Boolean(status));
  if (statuses.length === 0) return undefined;
  if (statuses.every((status) => status === 'authenticated')) return 'authenticated';
  if (statuses.some((status) => status === 'pending_approval')) return 'pending_approval';
  if (statuses.some((status) => status === 'pending')) return 'pending';
  if (statuses.some((status) => status === 'expired')) return 'expired';
  if (statuses.some((status) => status === 'error')) return 'error';
  return 'disconnected';
}

/** 官方 `lrt(detail, connectorStatus)`：这个应用现在能不能直接写进对话（否则先走连接流程）。 */
export function mentionPluginTokenReady(
  plugin: { isInstalled?: boolean; status?: string; connectors?: readonly unknown[] },
  connectorStatus?: MentionConnectorStatus,
): boolean {
  return plugin.isInstalled === true
    && (plugin.status ?? 'enabled') === 'enabled'
    && ((plugin.connectors?.length ?? 0) === 0 || connectorStatus === undefined || connectorStatus === 'authenticated');
}

/** 官方 `Ub` 内 `tt(plugin)`：行数据 → `Ne` 的入参。 */
export function buildMentionSuggestionPluginItem(
  plugin: MentionPluginSource,
  connectorStatus?: MentionConnectorStatus,
): MentionSuggestionPluginItem {
  return {
    id: plugin.pluginName,
    label: plugin.displayName,
    type: 'plugin',
    renderText: pluginRenderText(plugin.pluginName, mentionPluginSkillName(plugin)),
    description: plugin.description,
    pluginStatus: plugin.status,
    pluginIsInstalled: plugin.isInstalled === true,
    pluginSkills: plugin.skills ?? [],
    pluginConnectors: plugin.connectors ?? [],
    pluginConnectorStatus: connectorStatus,
    pluginIconUrl: plugin.iconUrl,
  };
}

/**
 * 官方 `Ne` 里的 `ze`/`ft`/`yt`：把 mention 项补全成「插件详情」。
 * `ze`（技能）逐字：`pluginSkills.length>0 ? pluginSkills.map(s=>({name,displayName:displayName??name,description:description??""})) : [{name:parsed.skillName,displayName:parsed.skillName,description:""}]`。
 * `ft`（连接器）逐字：`pluginConnectors?.map(c=>({name,displayName:displayName??name,description:description??""})) ?? []`。
 */
export function buildMentionPluginConnectDetail(
  item: MentionSuggestionPluginItem,
  parsed: { pluginName: string; skillName: string },
): MentionPluginConnectDetail {
  const skills = item.pluginSkills.length > 0
    ? item.pluginSkills.map((skill) => ({
      name: skill.name,
      displayName: skill.displayName ?? skill.name,
      description: skill.description ?? '',
    }))
    : [{ name: parsed.skillName, displayName: parsed.skillName, description: '' }];
  const connectors = (item.pluginConnectors ?? []).map((connector) => ({
    name: connector.name,
    displayName: connector.displayName ?? connector.name,
    description: connector.description ?? '',
  }));
  return {
    pluginName: parsed.pluginName,
    displayName: item.label,
    description: item.description ?? '',
    downloadCount: '0',
    isInstalled: item.pluginIsInstalled === true,
    status: item.pluginStatus,
    isUpdateAvailable: false,
    skills,
    connectors,
    marketingSlots: [],
    iconUrl: item.pluginIconUrl,
  };
}

/**
 * 官方 `k0e(kind, payload)` + `I0e(value, kind, payload)`：
 * 把 `{{<pluginName>:<skillName>}}` 写进输入值 —— 已有同插件 token 就**替换**（不打乱位置），
 * 否则追加（值非空时前面补空格，后面永远补一个空格）。
 */
export function insertMentionPluginValue(value: string, pluginName: string, payload: string): string {
  const token = `{{${pluginName}:${payload}}}`;
  const pattern = new RegExp(`\\{\\{${escapeRegExp(pluginName)}:[^}]+\\}\\}`, 'g');
  let replaced = false;
  const next = value.replace(pattern, () => {
    replaced = true;
    return token;
  });
  if (replaced) return next;
  if (!value) return `${token} `;
  return /\s$/.test(value) ? `${value}${token} ` : `${value} ${token} `;
}

/** 官方 `M0e(value, examplePrompt)`：把示例 prompt 追加到输入值末尾（已包含则不重复）。 */
export function appendMentionPluginExamplePrompt(value: string, examplePrompt?: string): string {
  const prompt = examplePrompt?.trim();
  if (!prompt || value.includes(prompt)) return value;
  if (!value) return prompt;
  return /\s$/.test(value) ? `${value}${prompt}` : `${value} ${prompt}`;
}

/**
 * MTV 数据源适配：`InstalledPlugin`（`store.plugins.ts`）→ 官方 plugin 列表项。
 *
 * `pluginName` 用 `manifest.id`（官方同字段），`displayName` 用 `manifest.name`。
 * `status` 用官方口径 `"enabled" | "disabled"`（官方 `x = u?.status ?? e.status ?? (g?"enabled":void 0)`，
 * `RT` 插件列表里就是 `status==="enabled"`）。
 */
export function mentionPluginSourceFromInstalled(plugin: InstalledPlugin): MentionPluginSource {
  return {
    pluginName: plugin.manifest.id,
    displayName: plugin.manifest.name,
    description: plugin.manifest.description,
    isInstalled: true,
    status: plugin.enabled ? 'enabled' : 'disabled',
    skills: [],
    connectors: [],
    iconUrl: undefined,
    category: plugin.manifest.category,
  };
}

/** 批量：`InstalledPlugin[]` → 官方 plugin 列表项（保持入参顺序）。 */
export function mentionPluginSourcesFromInstalled(
  plugins: readonly InstalledPlugin[],
): MentionPluginSource[] {
  return plugins.map(mentionPluginSourceFromInstalled);
}
