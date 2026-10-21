/**
 * PileNodeToolbar —— 官方 **PILE（堆叠）浮动工具条** `nJe` 的逐字移植。
 *
 * 官方出处：`zoom-slider-3ZcFvYQO.js`@char2980299…@2981506（完整抽取见
 * `D:\DEEPSEEK\official-pile-spec.md` §4）。
 *
 * ```js
 * const eJe = new Set([he.IMAGE, he.VIDEO, he.AUDIO]);
 * function tJe(e){ return e.filter(t => { if(!eJe.has(t.type)) return false;
 *   const n=t.data; return typeof n.src=="string" && n.src.length>0 }) }
 * function nJe({canEdit:e, members:t, onUnpile:n}){
 *   … const m = o && i && f.length>0   // add-to-chat
 *     , g = a && t.length>0            // save-to-library
 *     , b = c(t);                      // download
 *   const x = [];
 *   e && x.push({key:"unpile",          buttonType:"unwrapped", node:<Xm tooltip={s("pile.unstack")}          onClick={n}><qse className="size-4"/></Xm>});
 *   m && x.push({key:"add-to-chat",     buttonType:"unwrapped", node:<Xm tooltip={s("common.addToChat")}      onClick={v}><Yse className="size-4"/></Xm>});
 *   g && x.push({key:"save-to-library", buttonType:"unwrapped", node:<Xm tooltip={s("library.saveToLibrary")} onClick={y}><Xse className="size-4"/></Xm>});
 *   b && x.push({key:"download",        buttonType:"unwrapped", node:<gQ tooltip={s("common.batchDownload")} isLoading={u} onClick={w}/>});
 *   return x }
 * ```
 *
 * ★ 容器（官方 `aJe` + `cPe`，**h-12 = 48px**）类名逐字：
 *   `nodrag cursor-default w-fit h-12 p-1 rounded-full flex flex-nowrap items-center justify-between
 *    bg-popover border z-10 whitespace-nowrap gap-1 text-white/90` + `node-float-ui-visible`
 *   容器内每个按钮外套 `cursor-pointer w-fit h-10 rounded-full flex items-center justify-center`。
 *
 * ★ `buttonType:"unwrapped"` ⇒ 官方 `dPe` 在 `if(e==="unwrapped")return n;` 处**直接返回节点本身**
 *   （不再包一层默认按钮）⇒ 上面每个 `<Xm>` 就是最终的按钮节点（`Xm` = 40×40 圆钮）。
 *   MTV 侧 `Xm` 已存在 = `components/canvas/SelectionToolbarButton.tsx` 的 `ToolbarButton`（逐字移植）。
 *
 * ⚠️ 三项 MTV 能力位（与官方同口径的「有没有」判断，不是等价替代）：
 *   · `eL("addToChat")` / `eL("saveToLibrary")` = 远端 `selectionToolbar.allowedItems` ⇒ MTV 恒真
 *   · `o`（agent 是否可用）= 官方 `Kse()`；MTV 用 `MTV_CAPS.agentAllowed`（与多选工具条同一口径）
 *   · `c(t)`（能否下载快照）= 官方 `canDownloadNodeSnapshots`；MTV 用 `canDownloadGroup` 同源的
 *     节点下载判定（`services/selectionToolbarActions.ts` 的 `canDownloadSelected`）
 */
import { useT } from '../../i18n';
import ToolbarButton from '../canvas/SelectionToolbarButton';
import type { Node as RFNode } from '@xyflow/react';
import type { BaseNodeData } from '../../types';

/** 官方 `eJe`：只有图 / 视频 / 音频算「可加入对话的媒体成员」 */
const CHAT_MEDIA_TYPES = new Set(['image', 'video', 'audio']);

/** MTV 类型名 → 官方口径（与 `utils/officialPile.ts` 的映射同一套语义，只取这三类） */
const MTV_TO_MEDIA_TYPE: Record<string, string> = {
  'ai-image': 'image',
  'source-image': 'image',
  'ai-video': 'video',
  'source-video': 'video',
  'ai-audio': 'audio',
  'source-audio': 'audio',
};

/** 官方 `tJe(e)` —— 图/视频/音频**且** `data.src` 非空 */
function chatMediaMembers(members: ReadonlyArray<RFNode<BaseNodeData>>): RFNode<BaseNodeData>[] {
  return members.filter((node) => {
    const rawType = typeof node.type === 'string' ? node.type : String(node.data?.type ?? '');
    if (!CHAT_MEDIA_TYPES.has(MTV_TO_MEDIA_TYPE[rawType] ?? '')) return false;
    const data = node.data as unknown as { src?: unknown; imageUrl?: unknown; videoUrl?: unknown; audioUrl?: unknown };
    const src = data?.src ?? data?.imageUrl ?? data?.videoUrl ?? data?.audioUrl;
    return typeof src === 'string' && src.length > 0;
  });
}

export interface PileNodeToolbarProps {
  /** 官方 `canEdit` = `!readOnly && controller.enabled` */
  canEdit: boolean;
  members: ReadonlyArray<RFNode<BaseNodeData>>;
  /** 官方工具条出现门 `rJe.shouldShowToolbar` */
  shouldShow: boolean;
  onUnpile: () => void;
  onAddToChat: (members: ReadonlyArray<RFNode<BaseNodeData>>) => void;
  onSaveToLibrary: (members: ReadonlyArray<RFNode<BaseNodeData>>) => void;
  onDownload: (members: ReadonlyArray<RFNode<BaseNodeData>>) => void;
  canDownload: boolean;
  busy?: boolean;
}

export default function PileNodeToolbar({
  canEdit,
  members,
  shouldShow,
  onUnpile,
  onAddToChat,
  onSaveToLibrary,
  onDownload,
  canDownload,
  busy = false,
}: PileNodeToolbarProps) {
  const t = useT();
  const mediaMembers = chatMediaMembers(members);
  /* 官方 `m` / `g` / `b` 三个条件逐条 */
  const canAddToChat = mediaMembers.length > 0;
  const canSaveToLibrary = members.length > 0;

  const tools = [
    canEdit
      ? {
          key: 'unpile',
          tooltip: t('取消堆叠'),
          icon: 'unpile' as const,
          onClick: onUnpile,
        }
      : null,
    canAddToChat
      ? {
          key: 'add-to-chat',
          tooltip: t('加入对话'),
          icon: 'addToChat' as const,
          onClick: () => onAddToChat(mediaMembers),
        }
      : null,
    canSaveToLibrary
      ? {
          key: 'save-to-library',
          tooltip: t('保存到素材库'),
          icon: 'saveToLibrary' as const,
          onClick: () => onSaveToLibrary(members),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; tooltip: string; icon: 'unpile' | 'addToChat' | 'saveToLibrary'; onClick: () => void }>;

  if (tools.length === 0 && !canDownload) return null;

  return (
    <div
      className={
        'nodrag cursor-default w-fit h-12 p-1 rounded-full '
        + 'flex flex-nowrap items-center justify-between bg-popover border z-10 '
        + 'whitespace-nowrap gap-1 text-white/90 node-float-ui-visible '
        /* ⚠️ `bg-popover` 在 MTV 的 Tailwind 里**不会被生成**（实测 computed =
           `rgba(0,0,0,0)`，与之前 `bg-popover/80` 同一个坑）⇒ 补上 MTV 既有那套
           浮层皮肤（与分组工具条同一个 `.node-floating-toolbar`）。官方类名仍逐字保留在上面。 */
        + 'node-floating-toolbar '
        /* ★ 官方 `nJe` 传给 `cPe` 的 className（逐字，zoom-slider-3ZcFvYQO.js @2983745）：
             `Z("absolute left-0 top-0 z-20", !shouldShow && "pointer-events-none!")`
           ⇒ 工具条以**缩放层左上角（原点）**为基准，再靠 `--float-y:-100%` 把底边中点压上去。
           ⚠️ MTV 的 `.node-floating-toolbar` 里那套 `top:var(--float-top)` + `left:50%` 是给
              官方 `od`（普通节点）用的，会在这个基准上再抬一次 ⇒ 由 nodes-pile.css 归零。 */
        + 'absolute left-0 top-0 z-20 '
        + (shouldShow ? '' : 'pointer-events-none!')
      }
      data-testid="pile-node-toolbar"
      /* 官方 `cPe`：`scaleMode:"inherit"` ⇒ `f = {"--float-scale": 1}`（内联覆盖继承值）
         ⇒ 缩放**只由** `QZe` 的缩放层 `scale(var(--pile-toolbar-scale,1))` 做一次 ✓
         其余逐字：`"--float-y":"-100%","--float-offset":"12px", transformOrigin:"center bottom"` */
      style={{
        '--float-y': '-100%',
        '--float-scale': 1,
        '--float-offset': '12px',
        transformOrigin: 'center bottom',
      } as React.CSSProperties}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      {/* 官方 `dPe` 对 `buttonType:"unwrapped"` 直接返回节点本身 ⇒ 每个按钮外面只套这一层 */}
      <div className="flex flex-nowrap items-center gap-[2px] w-full">
        {tools.map((tool) => (
          <div
            key={tool.key}
            className="cursor-pointer w-fit h-10 rounded-full flex items-center justify-center"
          >
            <ToolbarButton icon={tool.icon} tooltip={tool.tooltip} onClick={tool.onClick} />
          </div>
        ))}
        {canDownload && (
          <div className="cursor-pointer w-fit h-10 rounded-full flex items-center justify-center">
            {/* 官方第 4 项是 `gQ`（= `Xm` + 下载图标；`isActive = isDisabled = ariaBusy = isLoading`） */}
            <ToolbarButton
              icon="downloadAll"
              tooltip={t('下载全部')}
              busy={busy}
              disabled={busy}
              onClick={() => onDownload(members)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
