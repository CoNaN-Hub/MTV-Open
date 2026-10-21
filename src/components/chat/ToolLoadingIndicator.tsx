/**
 * 官方「工具调用进行中」行 —— `page-BeI7xydN.js`@678060 的 `J0` 逐字。
 *
 * 官方源码（压缩名 → 语义）：
 *   `J0`   = `ToolLoadingIndicator`（`l.memo`，`displayName="ToolLoadingIndicator"`）
 *   `Wae`  = `{ show_form: m4 }` —— **只有 `show_form` 有专属图标**，其余一律转圈
 *   `An`   = tabler `loader-2`（本仓 `OfficialLoader2Icon`）
 *   `$a`   = `ShimmerText`（`duration` / `spread` 可调）
 *   `kc`/`X$`/`tR` = 工具名文案（本仓走官方表 `getToolLabel('<tool>_started')`）
 *
 * 官方 JSX：
 *   `<div className="my-1 inline-flex max-w-full items-center gap-2 py-0.5 text-[13px] font-normal leading-[1.65]">`
 *     `{Icon ? <Icon className="tool-call-status-icon-active size-4 shrink-0 text-muted-foreground/80"/>`
 *            : <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground/80"/>}`
 *     `<ShimmerText as="span" duration={2.1} spread={1.1}
 *        className="min-w-0 truncate text-[13px] font-normal leading-[1.65]
 *                   [--color-muted-foreground:color-mix(in_srgb,var(--muted-foreground)_92%,transparent)]">`
 *       `{label}</ShimmerText>`
 *   `</div>`
 */
import { memo } from 'react';
import { getLocale } from '../../i18n';
import { getToolLabel } from '../../services/chat/toolLabels';
import { humanizeToolLineText } from '../../services/chat/agentToolLabels';
import { OfficialLoader2Icon } from './officialIcons';
import ShimmerText from './ShimmerText';
import { IconForms } from './officialFormIcons';

/** 官方 `Wae`（`page-BeI7xydN.js`@678060 邻域）＝ `{ show_form: m4 }` —— **只有 `show_form` 有专属图标**，
 *  其余工具一律退回 `An`(tabler `loader-2`)。`m4` 的逐字身份 = **Tabler `forms`**
 *  （`live-提问表单族.md`；本仓内联为 `officialFormIcons.IconForms`）。
 *
 *  ⚠️ 官方在 `$M`（@2426950）里对 `show_form` 的 `pending`/`started` 分支走的就是 `<HM toolName="show_form"/>`
 *  ⇒ 本表补上这一项后，MTV 既有的通用 loading 分支（`status∈{started,in_progress} && isStreaming`）
 *  会自动用上官方图标，**无需另加分支**。 */
const TOOL_LOADING_ICONS: Record<string, typeof OfficialLoader2Icon> = {
  show_form: IconForms,
};

/** 官方 `tR`/`X$`：进行中的工具文案（官方表键 = `<tool>_started`）。 */
function toolLoadingLabel(toolName: string, locale = getLocale()): string {
  const key = `${toolName}_started`;
  const label = getToolLabel(key, locale);
  /* 官方表里没有这条工具时 `getToolLabel` 回退成 key 本身 ⇒ 退回工具名，别显示 `xxx_started`。
     ⚠️ MRI 自有工具（`media_generate` 等，官方 bundle 0 命中）连工具名都不该露 ⇒ 换成人话
     （用户实测：生成中那一行仍显示 `media_generate`）。 */
  return label && label !== key ? label : humanizeToolLineText(toolName, true);
}

const ToolLoadingIndicator = memo(function ToolLoadingIndicator({ toolName }: { toolName: string }) {
  const Icon = TOOL_LOADING_ICONS[toolName];
  const label = toolLoadingLabel(toolName);
  return (
    <div className="my-1 inline-flex max-w-full items-center gap-2 py-0.5 text-[13px] font-normal leading-[1.65]">
      {Icon ? (
        <Icon className="tool-call-status-icon-active size-4 shrink-0 text-muted-foreground/80" />
      ) : (
        <OfficialLoader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground/80" />
      )}
      <ShimmerText
        as="span"
        duration={2.1}
        spread={1.1}
        className="min-w-0 truncate text-[13px] font-normal leading-[1.65] [--color-muted-foreground:color-mix(in_srgb,var(--muted-foreground)_92%,transparent)]"
      >
        {label}
      </ShimmerText>
    </div>
  );
});

export default ToolLoadingIndicator;
