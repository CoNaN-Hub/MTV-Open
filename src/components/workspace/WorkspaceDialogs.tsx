/**
 * WorkspaceDialogs —— 官方「我的项目」页的批量操作条与「移动至...」对话框
 * ══════════════════════════════════════════════════════════════════════════
 * 官方 `ga`（多选批量条，`page-CoyqNJe1.js` @47446）：
 *   const ga = ({visible, selectedCount, onClose, actions = [], className}) => (
 *     <AnimatePresence>{visible && (
 *       <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}
 *                   transition={{duration:.25,ease:"easeOut"}}
 *                   className={R("fixed bottom-8 left-[calc(50%-175px)] z-50", className)}>
 *         <div className="flex items-center gap-2 px-5 py-4 rounded-2xl"
 *              style={{background:"rgba(38, 38, 38, 0.50)", backdropFilter:"blur(44px)",
 *                      WebkitBackdropFilter:"blur(44px)", boxShadow:"0px 4px 8px 0px rgba(0, 0, 0, 0.30)",
 *                      outline:"1px solid rgba(255, 255, 255, 0.10)", outlineOffset:-1}}>
 *           <button onClick={onClose} className="p-0.5 rounded text-muted-foreground hover:text-white …">✕ size20</button>
 *           <div className="min-w-[230px]">
 *             <span className="text-foreground text-base font-medium leading-6 whitespace-nowrap select-none">
 *               已选择 {{count}} 个画布</span></div>
 *           <Tooltip delayDuration={1000}><div className="flex items-center gap-2">
 *             {actions.map(p => (
 *               <button onClick={p.onClick} disabled={p.disabled}
 *                       className={R("p-0.5 rounded transition-colors","text-popover-foreground hover:text-white",
 *                                     "disabled:opacity-30 disabled:pointer-events-none",
 *                                     "focus:outline-none focus-visible:outline-none")}>{p.icon}</button>))}
 *           </div></Tooltip>
 *         </div></motion.div>)}
 *     </AnimatePresence>);
 *
 * 官方 `pa`（「移动至...」对话框 @29886）：
 *   <DialogContent showClose={false}
 *     className="w-[350px] p-6 rounded-[20px] outline-2 outline-border outline-offset-[-2px]
 *                backdrop-blur-[44px] flex flex-col gap-4">
 *     <h2 className="text-lg font-bold leading-[27px] text-primary-foreground">移动至...</h2>
 *     <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto w-full">
 *       [移出文件夹]  className=R("w-full p-3 rounded-[10px] text-left transition-colors shrink-0","bg-input/30",
 *                                 "border-2 border-dashed border-muted-foreground/40","flex items-center justify-between gap-2",
 *                                 "focus-visible:outline-none", selected ? "outline-2 outline-primary-foreground/60 outline-offset-[-2px]" : "hover:bg-input/50")
 *                     文本：移出文件夹 / 返回个人
 *       [新建文件夹]  同上（hover:bg-input/30），文本：新建文件夹 / 创建并移入，右侧 `yt`(folder-plus) size18
 *       [文件夹项]    className=R("w-full p-3 rounded-[10px] text-left transition-colors shrink-0","bg-input/30","flex flex-col gap-1",
 *                                 "focus-visible:outline-none", selected ? "outline-2 outline-primary-foreground/60 outline-offset-[-2px]" : "hover:bg-input/50")
 *                     文本：name（text-sm leading-5 text-card-foreground truncate）+ `{count} 个项目`（text-xs leading-4 tracking-[0.12px] text-muted-foreground）
 *     </div>
 *     <div className="flex gap-2 w-full pt-2">
 *       取消  className="flex-1 h-9 rounded-lg bg-input/30 border border-border text-primary-foreground hover:bg-input/50"
 *       继续  className="flex-1 h-9 rounded-lg bg-primary-foreground text-background hover:bg-primary-foreground/90"（未选中时 disabled）
 *     </div>
 *   </DialogContent>
 *   常量：`mt="__move_out__"`（移出文件夹的哨兵值）
 */
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@iconify/react';

export interface BatchAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * 官方 `ga`：底部居中的多选操作条。
 *
 * ⚠️ 官方是 `motion.div`（`initial {opacity:0,y:20}` → `animate {opacity:1,y:0}`、
 *    退场反向、`transition {duration:.25,ease:"easeOut"}`），而且 `ga` 里**没有** reduced-motion
 *    分支（与官方其它组件不同）⇒ 这里也照抄，不额外加开关。
 *    ⇒ 外层必须**常驻**（`AnimatePresence` 在 portal 里），否则退出动画没机会跑。
 */
export function WorkspaceSelectionBar({
  visible,
  selectedCount,
  onClose,
  actions,
}: {
  visible: boolean;
  selectedCount: number;
  onClose: () => void;
  actions: BatchAction[];
}) {
  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-8 left-[calc(50%-175px)] z-50"
        >
          <div
            className="flex items-center gap-2 rounded-2xl px-5 py-4"
            style={{
              background: 'rgba(38, 38, 38, 0.50)',
              backdropFilter: 'blur(44px)',
              WebkitBackdropFilter: 'blur(44px)',
              boxShadow: '0px 4px 8px 0px rgba(0, 0, 0, 0.30)',
              outline: '1px solid rgba(255, 255, 255, 0.10)',
              outlineOffset: -1,
            }}
          >
            <button
              type="button"
              aria-label="取消选择"
              data-testid="workspace-selection-close"
              onClick={onClose}
              className="rounded p-0.5 text-[#7a7a7a] transition-colors hover:text-white focus:outline-none focus-visible:outline-none"
            >
              {/* 官方那颗是 `tabler:x`（path `M18 6l-12 12` / `M6 6l12 12`，与 lucide:x 同形） */}
              <Icon icon="tabler:x" width={20} height={20} />
            </button>
            <div className="min-w-[230px]">
              <span className="select-none whitespace-nowrap text-base font-medium leading-6 text-[#f5f5f5]">
                {`已选择 ${selectedCount} 个画布`}
              </span>
            </div>
            {/* 官方：`<Tooltip delayDuration={1000}><div className="flex items-center gap-2">{actions…}</div></Tooltip>`
                —— 一个 Tooltip **包住整组**（延迟 1000ms 全局生效）。
                MTV 的等价写法：容器上 `data-tooltip-delay="1000"`（`useTooltipAutoPlacement` 用 `closest()` 读容器），
                按钮上给 `data-tooltip`。⚠️ 原来写的是原生 `title=` ⇒ 浏览器会弹**系统气泡**，
                与官方那种带样式的气泡完全不是一个东西。 */}
            <div className="flex items-center gap-2" data-tooltip-delay="1000">
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  aria-label={action.label}
                  data-tooltip={action.label}
                  data-testid={`workspace-selection-${action.key}`}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="rounded p-0.5 text-[#ccc] transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-30 focus:outline-none focus-visible:outline-none"
                >
                  {action.icon}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** 官方 `mt`：移出文件夹的哨兵值 */
export const MOVE_OUT = '__move_out__';

export interface MoveTarget {
  id: string;
  name: string;
  childCount: number;
}

/** 官方 `pa`：「移动至...」对话框 */
export function WorkspaceMoveDialog({
  open,
  targets,
  selected,
  activeCollectionId,
  canCreateCollection,
  onSelect,
  onMoveOut,
  onCreateCollection,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  targets: MoveTarget[];
  selected: string | null;
  activeCollectionId?: string | null;
  canCreateCollection: boolean;
  onSelect: (id: string) => void;
  onMoveOut: () => void;
  onCreateCollection: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  const optionClass = (active: boolean) =>
    `w-full shrink-0 rounded-[10px] p-3 text-left transition-colors focus-visible:outline-none ${
      active
        ? 'bg-input/30 outline outline-2 outline-offset-[-2px] outline-[rgba(250,250,250,0.6)]'
        : 'bg-input/30 hover:bg-white/10'
    }`;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/80" onClick={onCancel} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="移动至..."
        data-testid="workspace-move-dialog"
        className="fixed left-1/2 top-1/2 flex w-[350px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[20px] bg-[#1f1f1f] p-6 outline outline-2 outline-offset-[-2px] outline-[#ffffff1a] backdrop-blur-[44px]"
      >
        <h2 className="text-lg font-bold leading-[27px] text-[#fafafa]">移动至...</h2>
        <div className="flex max-h-[220px] w-full flex-col gap-2 overflow-y-auto">
          {activeCollectionId && (
            <button
              type="button"
              data-testid="workspace-move-out"
              onClick={onMoveOut}
              className={`${optionClass(selected === MOVE_OUT)} flex items-center justify-between gap-2 border-2 border-dashed !border-[rgba(122,122,122,0.4)]`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-normal leading-5 text-[#fafafa]">移出文件夹</span>
                <span className="text-xs font-normal leading-4 tracking-[0.12px] text-[#7a7a7a]">返回个人</span>
              </div>
              <Icon icon="lucide:corner-up-left" width={18} height={18} className="shrink-0 text-[#7a7a7a]" />
            </button>
          )}
          {canCreateCollection && (
            <button
              type="button"
              data-testid="workspace-move-new-collection"
              onClick={onCreateCollection}
              className={`${optionClass(false)} flex items-center justify-between gap-2 border-2 border-dashed !border-[rgba(122,122,122,0.4)]`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-normal leading-5 text-[#fafafa]">新建文件夹</span>
                <span className="text-xs font-normal leading-4 tracking-[0.12px] text-[#7a7a7a]">创建并移入</span>
              </div>
              <Icon icon="tabler:folder-plus" width={18} height={18} className="shrink-0 text-[#7a7a7a]" />
            </button>
          )}
          {targets.map((target) => (
            <button
              key={target.id}
              type="button"
              data-testid={`workspace-move-target-${target.id}`}
              onClick={() => onSelect(target.id)}
              className={`${optionClass(selected === target.id)} flex flex-col gap-1`}
            >
              <span className="truncate text-sm font-normal leading-5 text-[#fafafa]">{target.name}</span>
              <span className="text-xs font-normal leading-4 tracking-[0.12px] text-[#7a7a7a]">
                {`${target.childCount} 个项目`}
              </span>
            </button>
          ))}
        </div>
        <div className="flex w-full gap-2 pt-2">
          <button
            type="button"
            data-testid="workspace-move-cancel"
            onClick={onCancel}
            className="h-9 flex-1 rounded-lg border border-[#ffffff1a] bg-white/[0.15] text-[#fafafa] transition-colors hover:bg-white/20"
          >
            取消
          </button>
          <button
            type="button"
            data-testid="workspace-move-confirm"
            onClick={onConfirm}
            disabled={!selected}
            className="h-9 flex-1 rounded-lg bg-[#fafafa] text-[#0f0f0f] transition-colors hover:bg-white/90 disabled:pointer-events-none disabled:opacity-50"
          >
            继续
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
