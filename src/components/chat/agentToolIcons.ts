/**
 * 官方 `Tot`（`mie = e => Tot[e]`，live bundle 偏移 2403422，逐字）：
 * ```js
 * Tot = { webSearch: fue, skill: ti, viewMedia: ng, canvasContext: ng, exploration: ng,
 *         edit: GP, command: mue };
 * ```
 * `ng`（viewMedia / canvasContext / exploration 共用）等的 lucide 名受 vendor-libs 内多作用域同名影响，
 * live 侧未能可靠解析 —— 此处沿用已核对的 dist 映射。
 *
 * 单独成文件以满足 `react-refresh/only-export-components`
 * （`AgentToolLine` 与 `ToolActivityDetailList` 共用同一张表）。
 */
import { Box, Globe, ListChecks, Pencil, Search, SquareTerminal, type LucideIcon } from 'lucide-react';
import type { AgentToolLineKind } from '../../services/chat/agentToolLabels';

export const TOOL_KIND_ICONS: Record<AgentToolLineKind, LucideIcon> = {
  webSearch: Globe,
  skill: Box,
  viewMedia: Search,
  canvasContext: Search,
  exploration: Search,
  edit: Pencil,
  command: SquareTerminal,
};

/** 官方 `Eot` 的分组汇总行图标 `gue` = lucide `ListChecks`（live DOM 实测 `lucide-list-checks`）。 */
export const TOOL_GROUP_ICON: LucideIcon = ListChecks;
