/**
 * 确认卡族文案表 —— 官方 key → zh/en **逐字**抄录。
 *
 * 数据源：`D:\DEEPSEEK\live-确认卡与widget.md` §1.19（zh 块 @4195957）/ §2.6（zh 块 @4216683），
 * 与 `D:\DEEPSEEK\_live-chatAdapter-i18n.json` 一致。
 *
 * ⚠️ 为什么不用仓库 `t()` 直接查 key：
 *   1. MTV 的 locale 字典在 `src/i18n/locales/*`（**本任务文件范围之外，改动被禁止**），
 *      且 §9.3 记载 MTV 只有 `chatAdapter.confirmMode` / `chatAdapter.localPermissionMenu` 两组键；
 *      官方这批 `chatAdapter.generationConfirmation.*` / `chatAdapter.nodeUpdateConfirmation.*`
 *      键名在 MTV 侧**不存在**。
 *   2. 官方模板用 `{{name}}` 双花括号插值，而 MTV `t()` 用 `{name}` 单花括号。
 *      ⇒ 这里保留**官方模板原文**，自己按 `{{name}}` 替换，避免把官方模板改写成 MTV 口径。
 *
 * 5 个「locale 组内不存在、代码只用英文 defaultValue」的 key（`inconsistentBatch*` /
 * `unsupportedKind*` / `inconsistentBatchMode`）在此表中 **zh 与 en 相同**（逐字后果：中文环境显示英文）。
 */
import { useMemo } from 'react';
import { useT } from '../../i18n';

export interface ConfirmationTextEntry {
  zh: string;
  en: string;
}

/** 官方 `chatAdapter.generationConfirmation.*`（zh/en 逐字；共 38 键，这里列出代码实际引用到的）。 */
const GENERATION_TEXT: Record<string, ConfirmationTextEntry> = {
  'chatAdapter.generationConfirmation.generateImages': { zh: '生成 {{count}} 张图片', en: 'Generate {{count}} images' },
  'chatAdapter.generationConfirmation.generateVideos': { zh: '生成 {{count}} 个视频', en: 'Generate {{count}} videos' },
  'chatAdapter.generationConfirmation.imageGeneration': { zh: '图片生成', en: 'Image Generation' },
  'chatAdapter.generationConfirmation.videoGeneration': { zh: '视频生成', en: 'Video Generation' },
  'chatAdapter.generationConfirmation.batchTasks': { zh: '{{count}} 个任务', en: '{{count}} Tasks' },
  'chatAdapter.generationConfirmation.noPrompt': { zh: '未提供提示词', en: 'No prompt provided' },
  'chatAdapter.generationConfirmation.noReference': { zh: '无参考', en: 'No reference' },
  'chatAdapter.generationConfirmation.reference': { zh: '参考图', en: 'Reference' },
  'chatAdapter.generationConfirmation.imageN': { zh: '图片 {{n}}', en: 'Image {{n}}' },
  'chatAdapter.generationConfirmation.videoN': { zh: '视频 {{n}}', en: 'Video {{n}}' },
  'chatAdapter.generationConfirmation.confirm': { zh: '确认', en: 'Confirm' },
  'chatAdapter.generationConfirmation.cancel': { zh: '取消', en: 'Cancel' },
  'chatAdapter.generationConfirmation.rejectAll': { zh: '全部拒绝', en: 'Reject all' },
  'chatAdapter.generationConfirmation.rejectItem': { zh: '移除', en: 'Remove' },
  'chatAdapter.generationConfirmation.restoreItem': { zh: '撤销', en: 'Undo' },
  'chatAdapter.generationConfirmation.edit': { zh: '编辑', en: 'Edit' },
  'chatAdapter.generationConfirmation.finish': { zh: '完成', en: 'Finish' },
  'chatAdapter.generationConfirmation.skipped': { zh: '已跳过', en: 'Skipped' },
  'chatAdapter.generationConfirmation.confirmed': { zh: '已确认', en: 'Confirmed' },
  'chatAdapter.generationConfirmation.cancelled': { zh: '已取消', en: 'Cancelled' },
  'chatAdapter.generationConfirmation.generationFailed': { zh: '失败', en: 'Failed' },
  'chatAdapter.generationConfirmation.autoMode': { zh: 'Act', en: 'Act' },
  'chatAdapter.generationConfirmation.autoModeStatus': { zh: 'Act', en: 'Act' },
  'chatAdapter.generationConfirmation.sceneUnsupportedByModel': {
    zh: '该模型不提供这个类型，请先切换模型。',
    en: 'This model does not offer that type. Switch model first.',
  },
  'chatAdapter.generationConfirmation.mentionUnresolved': {
    zh: '提示词里 @ 的部分节点已不在画布上，请移除后再确认。',
    en: 'Some @ references are no longer on the canvas. Remove them from the prompt, then confirm.',
  },
  'chatAdapter.generationConfirmation.mentionNumberingUnavailable': {
    zh: '当前请求里有无法识别类型的引用，暂时不能再通过 @ 添加引用。',
    en: 'This request has references of unknown type, so new @ references can\'t be added right now.',
  },
  'chatAdapter.generationConfirmation.autoModeTipMessage': {
    zh: '自动生成模式下，所有生成任务将自动扣除 Tapies。',
    en: 'In auto-generate mode, Tapies will be auto-deducted for all generation tasks.',
  },
  'chatAdapter.generationConfirmation.closeTip': { zh: '关闭', en: 'Close' },
  /* ↓ 5 个：locale 组内**不存在**，官方只有英文 defaultValue（逐字），中文环境回落英文。 */
  'chatAdapter.generationConfirmation.inconsistentBatch': {
    zh: 'This batch does not share one model and generation configuration. Cancel it and ask Agent to retry.',
    en: 'This batch does not share one model and generation configuration. Cancel it and ask Agent to retry.',
  },
  'chatAdapter.generationConfirmation.inconsistentBatchShort': {
    zh: 'Inconsistent batch configuration',
    en: 'Inconsistent batch configuration',
  },
  'chatAdapter.generationConfirmation.inconsistentBatchMode': {
    zh: 'These references require different generation modes. Cancel and ask Agent to retry.',
    en: 'These references require different generation modes. Cancel and ask Agent to retry.',
  },
  'chatAdapter.generationConfirmation.unsupportedKind': {
    zh: 'This version cannot display the {{kind}} generation confirmation. Update the app or cancel this request.',
    en: 'This version cannot display the {{kind}} generation confirmation. Update the app or cancel this request.',
  },
  'chatAdapter.generationConfirmation.unsupportedKindShort': {
    zh: 'Unsupported confirmation type',
    en: 'Unsupported confirmation type',
  },
  /* 官方音频分支的标题 key **不在** generationConfirmation 组内（§1.4 逐字）。 */
  'audio.audioGeneration': { zh: '音频生成', en: 'Audio Generation' },
  /* 官方 `eet` 的时长/画质文案来源（§1.13 逐字）。 */
  'videoConfigs.durationAuto': { zh: '自动', en: 'Auto' },
};

/** 官方 `chatAdapter.nodeUpdateConfirmation.*`（zh/en 逐字，§2.6）。 */
const NODE_UPDATE_TEXT: Record<string, ConfirmationTextEntry> = {
  'chatAdapter.nodeUpdateConfirmation.title': { zh: '确认节点更新', en: 'Confirm node update' },
  'chatAdapter.nodeUpdateConfirmation.update': { zh: '更新', en: 'Update' },
  'chatAdapter.nodeUpdateConfirmation.cancel': { zh: '取消', en: 'Cancel' },
  'chatAdapter.nodeUpdateConfirmation.defaultSummary': { zh: '更新节点', en: 'Update the node' },
  'chatAdapter.nodeUpdateConfirmation.nodeUpdated': { zh: '计划更新的节点：', en: 'node updated:' },
};

const ALL_TEXT: Record<string, ConfirmationTextEntry> = { ...GENERATION_TEXT, ...NODE_UPDATE_TEXT };

/** 官方 `{{name}}` 插值（双花括号，逐字保留官方模板形状）。 */
export function fillOfficialTemplate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  ));
}

/** 取官方 zh 文案（缺表则回落 key 本身），按 `{{name}}` 插值。 */
export function officialConfirmationText(key: string, vars?: Record<string, string | number>): string {
  const entry = ALL_TEXT[key];
  return fillOfficialTemplate(entry ? entry.zh : key, vars);
}

/** 官方 en 文案（`{{name}}` 插值）。 */
export function officialConfirmationTextEn(key: string, vars?: Record<string, string | number>): string {
  const entry = ALL_TEXT[key];
  return fillOfficialTemplate(entry ? entry.en : key, vars);
}

export type ConfirmationTextFn = (key: string, vars?: Record<string, string | number>) => string;

/**
 * 组件用文案函数。
 *
 * 先交给 MTV 的 `t()`（**以中文源串为 key** 的既有约定：`t(zhText, vars)`），
 * 使仓库已有的 `zh→en/ja/ko` 字典在其后续补齐时自动生效；未命中时 `t()` 原样返回入参，
 * 即官方 zh 文案本身。官方模板的 `{{name}}` 在交给 `t()` **之前**已按官方口径替换完成。
 */
export function useConfirmationText(): ConfirmationTextFn {
  const t = useT();
  return useMemo(() => (key: string, vars?: Record<string, string | number>) => {
    const zh = officialConfirmationText(key, vars);
    return t(zh);
  }, [t]);
}

/** 表内全部官方 key（供测试断言「表覆盖了什么」）。 */
export function officialConfirmationTextKeys(): string[] {
  return Object.keys(ALL_TEXT);
}
