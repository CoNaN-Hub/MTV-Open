/**
 * `desktop_*_confirmation` / `connectorAuthCard` / `mcpApp` 三族的官方 i18n 文案表
 * —— **逐字**取自 live bundle（`_rawat.mjs` 原始窗口 + `_live-chatAdapter-i18n*.json`，
 * 未凭截图或报告转述）。
 *
 * ── 为什么自带表（与同批 `widgetStrings.ts` 同一套落地方式） ─────────────────────
 *   1. MTV 的 locale 字典在 `src/i18n/locales/*`，**属本任务文件边界之外**（改动被禁止），
 *      且按 §9.3，MTV 目前只有 `chatAdapter.confirmMode` / `chatAdapter.localPermissionMenu`
 *      两组 `chatAdapter.*` 键 —— 官方这批 key 在 MTV 侧**不存在**。
 *   2. MTV 的 `t()` 以**中文源串**为 key，官方 key 是点号路径 ⇒ 直接
 *      `t("chatAdapter.mcpApp.title")` 永远命中不了。这里按官方口径「key → 当前 locale 的值」
 *      自行解析，值全部逐字来自官方 locale 块。
 *
 * ── 数据源（逐字偏移） ──────────────────────────────────────────────────────────
 * | key 组 | zh 块偏移 | 出处 |
 * |---|---|---|
 * | `chatAdapter.desktopConfirmation.*`（26 键） | 4200447 | `vendor-pkg-canvas-ChpWx5JY.js`，§3.9 表逐项核对 |
 * | `chatAdapter.connectorAuthCard.*`（11 键） | 4216191 | 同上，§5.8 逐字 JSON |
 * | `chatAdapter.mcpApp.*`（12 键） | 4215159 | 同上，§6.7 逐字 |
 * | `chatAdapter.addMenu.connectors.*` / `addMenu.plugins.*` | `_live-chatAdapter-i18n.v2.json` | zh + ja 两栏（见下方 ⚠️） |
 *
 * ⚠️ **未挖到 / 未落表（禁止补写猜测）**
 *   1. `common.cancel` / `common.copy` / `common.copied` 的中文值：官方这三个键在 `common`
 *      命名空间（不在 `chatAdapter` 块里），本轮**未在 live bundle 里定位到该命名空间的 locale 块**
 *      ⇒ 本表**不写**这三键，调用点按官方英文 `defaultValue`（`Cancel` / `Copy` / `Copied`）回落。
 *      待补：把 `common.*` 的 zh/ja/ko 值从官方 locale 块挖出后加进本表即可（无需改调用点）。
 *   2. `chatAdapter.connectorAuthCard.connected`（zh「已连接」）官方代码 **0 次引用**（死键，§9.1）
 *      ⇒ 本**不**入表（connected 态实际读 `chatAdapter.addMenu.connectors.status.authenticated`）。
 *   3. `chatAdapter.desktopConfirmation.titles.fallback`（zh「执行桌面操作」）官方 locale 里有、
 *      但**运行时不使用**（代码兜底是硬编码 `"Run a desktop action"`）⇒ 不入表。
 *   4. `_live-chatAdapter-i18n.v2.json` 只对 `ja` / `zh` 两栏给了 `addMenu.*` 值
 *      （en/fr/ko 为 `undefined`）⇒ 对 en/fr/ko 回落官方英文 `defaultValue`，**不猜**。
 */
import { useMemo } from 'react';
import { getLocale, useT, type Locale } from '../../i18n';

/** 官方第二参数：字符串默认值，或 `{defaultValue, ...vars}` 对象（两种官方写法都出现）。 */
export type OfficialTextDefault =
  | string
  | ({ defaultValue: string } & Record<string, string | number>);

/** core `t` 形状（官方 `const {t: o} = se()` 的 `o`）。 */
export type OfficialTextFn = (key: string, defaultValue?: OfficialTextDefault) => string;

/** 官方 `chatAdapter.*` 文案表：`key → locale → 逐字值`。 */
export const OFFICIAL_DESKTOP_CONNECTOR_MCP_TEXT: Record<string, Partial<Record<Locale, string>>> = {
  /* ══════════ §3.9 `chatAdapter.desktopConfirmation.*`（zh 块 @4200447，逐字） ══════════ */
  'chatAdapter.desktopConfirmation.rejected': { 'zh-CN': '已拒绝' },
  'chatAdapter.desktopConfirmation.confirmed': { 'zh-CN': '已确认' },
  'chatAdapter.desktopConfirmation.skipped': { 'zh-CN': '已跳过' },
  'chatAdapter.desktopConfirmation.openSettings': { 'zh-CN': '打开设置' },
  'chatAdapter.desktopConfirmation.disabledInSettings': {
    'zh-CN': '此能力已在桌面端权限设置中关闭。',
  },
  'chatAdapter.desktopConfirmation.confirm': { 'zh-CN': '确认' },
  'chatAdapter.desktopConfirmation.reject': { 'zh-CN': '拒绝' },
  'chatAdapter.desktopConfirmation.working': { 'zh-CN': '处理中…' },
  'chatAdapter.desktopConfirmation.batchWrite.selectedByAgent': { 'zh-CN': '由 Agent 选择' },
  'chatAdapter.desktopConfirmation.batchWrite.chooseFolderAfterConfirming': {
    'zh-CN': '确认后选择本地文件夹',
  },
  'chatAdapter.desktopConfirmation.batchWrite.files': { 'zh-CN': '文件：{{count}}' },
  'chatAdapter.desktopConfirmation.batchWrite.destination': { 'zh-CN': '保存位置：{{target}}' },
  'chatAdapter.desktopConfirmation.organize.actions': { 'zh-CN': '操作数量：{{count}}' },
  'chatAdapter.desktopConfirmation.organize.directory': { 'zh-CN': '操作目录：{{target}}' },
  'chatAdapter.desktopConfirmation.organize.rename': {
    'zh-CN': '重命名：{{source}} → {{destination}}',
  },
  'chatAdapter.desktopConfirmation.organize.move': {
    'zh-CN': '移动：{{source}} → {{destination}}',
  },
  'chatAdapter.desktopConfirmation.organize.mkdir': { 'zh-CN': '创建文件夹：{{path}}' },
  'chatAdapter.desktopConfirmation.organize.authorizedFolder': { 'zh-CN': '已授权文件夹' },
  'chatAdapter.desktopConfirmation.organize.more': { 'zh-CN': '另有 {{count}} 项' },
  'chatAdapter.desktopConfirmation.titles.desktop_capture_screen': { 'zh-CN': '在本机截屏' },
  'chatAdapter.desktopConfirmation.titles.desktop_open_app': { 'zh-CN': '在本机打开应用' },
  'chatAdapter.desktopConfirmation.titles.desktop_fs': { 'zh-CN': 'Agent 请求访问本地文件夹' },
  'chatAdapter.desktopConfirmation.titles.desktop_shell_command': { 'zh-CN': '在本机运行命令' },
  'chatAdapter.desktopConfirmation.titles.batch_download_files': { 'zh-CN': '下载文件' },

  /* ══════════ §5.8 `chatAdapter.connectorAuthCard.*`（zh 块 @4216191，逐字） ══════════ */
  'chatAdapter.connectorAuthCard.statusExpired': { 'zh-CN': '{{name}} 授权已过期，请重新连接。' },
  'chatAdapter.connectorAuthCard.title': { 'zh-CN': '连接 {{name}}' },
  'chatAdapter.connectorAuthCard.waiting': { 'zh-CN': '等待授权中...' },
  'chatAdapter.connectorAuthCard.description': { 'zh-CN': '允许 Agent 使用自定义工具和第三方集成。' },
  'chatAdapter.connectorAuthCard.continueIn': { 'zh-CN': '在 {{name}} 中继续' },
  'chatAdapter.connectorAuthCard.failed': { 'zh-CN': '连接失败。' },
  'chatAdapter.connectorAuthCard.retry': { 'zh-CN': '重试' },
  'chatAdapter.connectorAuthCard.skipped': { 'zh-CN': '已跳过' },
  'chatAdapter.connectorAuthCard.skip': { 'zh-CN': '跳过' },
  'chatAdapter.connectorAuthCard.authenticate': { 'zh-CN': '去授权' },

  /* ══════════ §5.8 被引用的 `addMenu.*`（`_live-chatAdapter-i18n.v2.json`，zh + ja 逐字） ══════════ */
  'chatAdapter.addMenu.connectors.status.authenticated': {
    'zh-CN': '已连接',
    'ja-JP': '接続済み',
  },
  'chatAdapter.addMenu.connectors.connecting': { 'zh-CN': '连接中...', 'ja-JP': '接続中...' },
  'chatAdapter.addMenu.connectors.errors.startFailed': {
    'zh-CN': '启动连接器授权失败',
    'ja-JP': 'コネクタ 認証を開始できませんでした',
  },
  'chatAdapter.addMenu.plugins.connectPromptDesc': {
    'zh-CN': '检测到 {{pluginName}} 尚未成功连接',
    'ja-JP': '{{pluginName}} はインストール済みですが、まだ接続されていません。',
  },
  'chatAdapter.addMenu.plugins.errors.statusUpdateFailed': {
    'zh-CN': '应用状态更新失败',
    'ja-JP': 'アプリの状態更新に失敗しました',
  },

  /* ══════════ §6.7 `chatAdapter.mcpApp.*`（zh 块 @4215159，逐字） ══════════ */
  'chatAdapter.mcpApp.expand': { 'zh-CN': '放大应用' },
  'chatAdapter.mcpApp.collapse': { 'zh-CN': '收起应用' },
  'chatAdapter.mcpApp.closeExpanded': { 'zh-CN': '关闭放大的应用' },
  'chatAdapter.mcpApp.title': { 'zh-CN': '应用' },
  'chatAdapter.mcpApp.loadFailed': { 'zh-CN': '面板暂时未能加载' },
  'chatAdapter.mcpApp.loadTimeout': { 'zh-CN': '面板资源加载或初始化超时' },
  'chatAdapter.mcpApp.reload': { 'zh-CN': '重新加载面板' },
  'chatAdapter.mcpApp.retryScheduled': { 'zh-CN': '正在准备自动重试…' },
  'chatAdapter.mcpApp.retrySafe': { 'zh-CN': '仅重新加载面板，不会重新提交生成' },
  'chatAdapter.mcpApp.retryLoading': { 'zh-CN': '正在重新加载面板…' },
  'chatAdapter.mcpApp.loading': { 'zh-CN': '正在加载面板…' },
  'chatAdapter.mcpApp.previsReplySubmitted': { 'zh-CN': '已提交 Previs 面板回复' },
};

/** 把官方第二参数的两种形态归一：抽出 `defaultValue` 与其余插值变量。 */
function splitDefault(defaultValue?: OfficialTextDefault): {
  text: string | undefined;
  vars: Record<string, string | number> | undefined;
} {
  if (typeof defaultValue === 'string') return { text: defaultValue, vars: undefined };
  if (!defaultValue) return { text: undefined, vars: undefined };
  const { defaultValue: text, ...vars } = defaultValue;
  return { text, vars: Object.keys(vars).length > 0 ? vars : undefined };
}

/** 官方 i18next 的 `{{var}}` 插值（缺变量时保留原占位符，与官方一致）。 */
function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * 官方 `se()` 的 `t` 在此刻 locale 下的取值：命中官方表 → 插值；否则回落调用点的英文
 * `defaultValue`；再否则回落 key 本身（官方 i18next 的兜底顺序）。
 */
export function officialDesktopConnectorMcpText(
  key: string,
  locale: Locale,
  defaultValue?: OfficialTextDefault,
): string {
  const { text, vars } = splitDefault(defaultValue);
  const value = OFFICIAL_DESKTOP_CONNECTOR_MCP_TEXT[key]?.[locale];
  if (value) return interpolate(value, vars);
  const fallback = text ?? key;
  return interpolate(fallback, vars);
}

/**
 * 组件内用文案函数 —— 形状与官方 `const {t: o} = se()` 的 `o` 一致：
 *   `o("chatAdapter.mcpApp.title", {defaultValue: "App"})`
 *   `o("chatAdapter.connectorAuthCard.title", {name: r, defaultValue: `Connect with ${r}`})`
 *   `o("chatAdapter.addMenu.plugins.errors.statusUpdateFailed")`（官方此处**不传** defaultValue）
 *
 * `useT()` 只用于订阅语言切换（触发重渲染）；取值走 {@link getLocale}，与 `ShowWidgetCard` 同一手法。
 */
export function useDesktopConnectorMcpText(): OfficialTextFn {
  useT();
  const locale = getLocale();
  return useMemo(
    () => (key: string, defaultValue?: OfficialTextDefault) =>
      officialDesktopConnectorMcpText(key, locale, defaultValue),
    [locale],
  );
}

/** 表内全部官方 key（供测试断言「表覆盖了什么」）。 */
export function officialDesktopConnectorMcpTextKeys(): string[] {
  return Object.keys(OFFICIAL_DESKTOP_CONNECTOR_MCP_TEXT);
}
