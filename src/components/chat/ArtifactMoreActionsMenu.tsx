/**
 * ArtifactMoreActionsMenu —— 官方 `Qae`（产物详情页头部 `rj` 槽位里的「更多操作」下拉，
 * `page-BeI7xydN.js`@694005）逐字复刻。
 *
 * 官方原文：
 *   const Qae = ({onClearContent}) => {
 *     const {t} = useT();
 *     return (
 *       <DropdownMenu>
 *         <Tooltip className="z-[70]" content={t('chatAdapter.artifactPanel.moreActions','More actions')}>
 *           <DropdownMenuTrigger asChild>
 *             <button type="button"
 *               className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md
 *                          text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground/95
 *                          focus:outline-none data-[state=open]:bg-white/[0.08] data-[state=open]:text-foreground/95"
 *               aria-label="More actions">
 *               <MoreVertical size={16} stroke={1.5} />
 *             </button>
 *           </DropdownMenuTrigger>
 *         </Tooltip>
 *         <DropdownMenuContent align="end" alignOffset={0} sideOffset={4}
 *           className="z-[70] min-w-[160px] rounded-lg">
 *           <DropdownMenuItem variant="destructive" onSelect={onClearContent}>
 *             <Trash size={14} stroke={1.5} />{t('chatAdapter.artifactPanel.clearContent','Clear content')}
 *           </DropdownMenuItem>
 *         </DropdownMenuContent>
 *       </DropdownMenu>
 *     );
 *   };
 *
 * ⚠️ 官方用 Radix `DropdownMenu` + `Tooltip`；MTV 原来没有 `@radix-ui/react-dropdown-menu`（已按官方补装）。
 */
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import OfficialTooltip from './OfficialTooltip';
import { OfficialMoreVerticalIcon, OfficialTrashIcon } from './officialIcons';
import { useT } from '../../i18n';

export interface ArtifactMoreActionsMenuProps {
  /** 官方 `onClearContent`：删掉 brainstorm 产物（MTV = 清空本地 brainstorm 文档）。 */
  onClearContent: () => void;
}

export default function ArtifactMoreActionsMenu({ onClearContent }: ArtifactMoreActionsMenuProps) {
  const t = useT();
  return (
    <DropdownMenu.Root>
      <OfficialTooltip content={t('更多操作')} className="z-[70]">
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground/95 focus:outline-none data-[state=open]:bg-white/[0.08] data-[state=open]:text-foreground/95"
            aria-label="More actions"
          >
            <OfficialMoreVerticalIcon size={16} strokeWidth={1.5} />
          </button>
        </DropdownMenu.Trigger>
      </OfficialTooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          alignOffset={0}
          sideOffset={4}
          className="z-[70] min-w-[160px] rounded-lg border-none bg-[#292929] p-1 shadow-[0_4px_16px_0_rgba(0,0,0,0.16),inset_0_0.5px_0_0_rgba(255,255,255,0.16)]"
        >
          <DropdownMenu.Item
            onSelect={onClearContent}
            className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-xs text-destructive outline-none data-[highlighted]:bg-destructive/10"
          >
            <OfficialTrashIcon size={14} strokeWidth={1.5} />
            {t('清空内容')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
