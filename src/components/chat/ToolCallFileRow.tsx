/**
 * ToolCallFileRow —— 官方 `fie`（displayName `ToolCallFileRow`，live bundle 偏移 2404588）**逐字移植**。
 *
 * 官方原文：
 * ```js
 * fie = memo(({fileName, kind, isActive}) => {
 *   const {t} = se();
 *   const requestWorkspaceFile = useStore(s => s.requestWorkspaceFile);
 *   const {key, fallback} = kind === "edit"
 *     ? (isActive ? {key:"editingFile", fallback:`Editing ${fileName}`}
 *                 : {key:"editedFile",  fallback:`Edited ${fileName}`})
 *     : (isActive ? {key:"readingFile", fallback:`Reading ${fileName}`}
 *                 : {key:"readFile",    fallback:`Read ${fileName}`});
 *   return (
 *     <button type="button" data-tool-file-row=""
 *       onClick={() => requestWorkspaceFile(fileName)}
 *       className="block max-w-[min(640px,100%)] cursor-pointer truncate py-0.5 text-left underline
 *                  decoration-transparent underline-offset-2 transition-colors hover:text-foreground/80
 *                  hover:decoration-current">
 *       {t(ba(key), {fileName, defaultValue: fallback})}     // ba(k) = `chatAdapter.agentEvent.toolCallLine.${k}`
 *     </button>
 *   );
 * });
 * ```
 *
 * ⚠️ 两处 MTV 侧差异（如实记录）：
 *   1. 官方点击调用 store 动作 `requestWorkspaceFile(fileName)`（把该工作区文件拉进对话）。
 *      MTV 侧**没有这条 store 动作**（全仓 0 命中）⇒ 走可注入的 `onOpenFile` 回调，
 *      未注入时按钮照常渲染、点击无副作用（DOM 与官方一致）。
 *   2. 文案走 `agentEventString`（官方 `chatAdapter.agentEvent.toolCallLine.*` 四语言表，
 *      MTV 已于早期轮次逐字落库），`{{fileName}}` 用官方同一个参数名插值。
 */
import { memo } from 'react';
import { getLocale } from '../../i18n';
import { agentEventString } from '../../services/chat/agentEventStrings';

/** 官方 `fie` 的 `kind`。 */
export type ToolCallFileRowKind = 'edit' | 'exploration';

export interface ToolCallFileRowProps {
  /** 官方 `fileName`：`trim(content.request.file_name)`（官方 `_ot` + `bb`）。 */
  fileName: string;
  /** 官方 `kind`：`labelInput.kind === "edit" ? "edit" : "exploration"`。 */
  kind: ToolCallFileRowKind;
  /** 官方 `isActive`：该行是否处于「进行中」。 */
  isActive: boolean;
  /** 官方 store 动作 `requestWorkspaceFile(fileName)` 的 MTV 侧替身（未注入 = 无副作用）。 */
  onOpenFile?: (fileName: string) => void;
}

/** `agentEventString()` 的入参是**相对 `chatAdapter.agentEvent` 命名空间**的路径（与 `agentEventStrings.ts` 口径一致）；
 *  官方那边是完整 key `ba(k) = "chatAdapter.agentEvent.toolCallLine." + k`。 */
const TOOL_CALL_LINE_LOOKUP = (key: string) => `toolCallLine.${key}`;

function ToolCallFileRow({ fileName, kind, isActive, onOpenFile }: ToolCallFileRowProps) {
  const locale = getLocale();
  const { key, fallback } = kind === 'edit'
    ? (isActive
      ? { key: 'editingFile', fallback: `Editing ${fileName}` }
      : { key: 'editedFile', fallback: `Edited ${fileName}` })
    : (isActive
      ? { key: 'readingFile', fallback: `Reading ${fileName}` }
      : { key: 'readFile', fallback: `Read ${fileName}` });
  const template = agentEventString(TOOL_CALL_LINE_LOOKUP(key), locale);
  /* 官方 `t(ba(key), {fileName, defaultValue})`：命中不到时吃 `defaultValue`。 */
  const label = (template === TOOL_CALL_LINE_LOOKUP(key) ? fallback : template)
    .replace(/\{\{fileName\}\}/g, fileName);

  return (
    <button
      type="button"
      data-tool-file-row=""
      onClick={() => onOpenFile?.(fileName)}
      className="block max-w-[min(640px,100%)] cursor-pointer truncate py-0.5 text-left underline decoration-transparent underline-offset-2 transition-colors hover:text-foreground/80 hover:decoration-current"
    >
      {label}
    </button>
  );
}

export default memo(ToolCallFileRow);
