/**
 * 官方「排队消息条」—— `page-BeI7xydN.js`@904068（`yue` = 单行）/ @906300（`IO` = `QueuedMessagesBar`）逐字。
 *
 * 官方结构：
 *   `<InputTopSheet visible motionKey="queued-messages-bar" contentRef onExitComplete>`
 *     `<div className="relative py-2" style={gue}>`
 *       `<div ref={scrollRef} className="flex max-h-[148px] flex-col gap-3 overflow-y-auto [scrollbar-gutter:stable]
 *            scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border scrollbar-thumb-rounded">`
 *         `<DndContext id="queued-messages-dnd" sensors collisionDetection modifiers
 *              autoScroll={{threshold:{x:0,y:.25}}} onDragEnd>`
 *           `<SortableContext items={ids} strategy={verticalListSortingStrategy}>`
 *             `{queued.map(item => <QueuedMessageRow … sortable={queued.length>1} />)}`
 *   `</InputTopSheet>`
 *
 * 单行（`yue`）：
 *   `<div className="group/queued-row relative flex items-center gap-1 pl-4 pr-3">`
 *     `{sortable && <button aria-label={reorder} className="absolute inset-y-0 left-0.5 z-10 flex w-3 cursor-grab
 *         items-center justify-center text-white/40 opacity-0 transition-opacity hover:text-white/70
 *         active:cursor-grabbing group-hover/queued-row:opacity-100 focus:opacity-100 focus:outline-none"
 *         {...listeners}><GripVertical size=12 stroke=1.5/></button>}`
 *     `<MessageIcon size=16 className="shrink-0 text-text-text-tertiary"/>`
 *     `<span className="min-w-0 flex-1 truncate text-xs leading-5 text-white/60">{text}</span>`
 *     `<div className="flex shrink-0 items-center gap-3">`
 *       `<span className="text-[10px] leading-5 text-text-text-tertiary">{pendingLabel}</span>`
 *       `<div className="flex items-center gap-2">` 删除 / 编辑 两颗 14×1.5 图标钮 `</div>`
 *     `</div>`
 *   `</div>`
 *
 * ⚠️ 相对官方的两处从简（都已注释）：① 官方拖拽 modifier 在滚动盒内钳制 y（`w`），这里用
 * `@dnd-kit/modifiers` 的 `restrictToVerticalAxis`；② 官方行内文本走 `xue`（把 `{{node/…}}`/文件引用渲染成
 * chip），这里复用 MTV 自己的 `ChatReferenceText`（同类语义）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store/useAppStore';
import { getLocale, useT } from '../../i18n';
import type { QueuedChatMessage } from '../../types/chat';
import OfficialTooltip from './OfficialTooltip';
import InputTopSheet from './InputTopSheet';
import ChatReferenceText from './ChatReferenceText';
import {
  OfficialGripVerticalIcon,
  OfficialMessageIcon,
  OfficialPencilIcon,
  OfficialTrashIcon,
} from './officialIcons';

/** 官方 `chatAdapter.queue.*`（`index-DjCL4F9p.js`@8456038/en、@8834351/ja、@8971330/ko、@9108758/zh 逐字）。 */
const QUEUE_TABLE: Record<string, Record<string, string>> = {
  'zh-CN': { withReferences: '包含参考内容', reorder: '拖拽排序', cancel: '取消排队', pendingLabel: '待发送', edit: '编辑' },
  'en-US': { withReferences: 'With references', reorder: 'Drag to reorder', cancel: 'Remove', pendingLabel: 'Queued', edit: 'Edit' },
  'ja-JP': { withReferences: '参考コンテンツあり', reorder: 'ドラッグして並べ替え', cancel: '削除', pendingLabel: '送信待ち', edit: '編集' },
  'ko-KR': { withReferences: '참고 콘텐츠 포함', reorder: '드래그하여 순서 변경', cancel: '제거', pendingLabel: '전송 대기', edit: '편집' },
};

function queueText(key: string, locale: string): string {
  const table = QUEUE_TABLE[locale] ?? QUEUE_TABLE['en-US'];
  return table[key] ?? QUEUE_TABLE['en-US'][key] ?? key;
}

/** 官方 `yue`：排队中的一行。 */
function QueuedMessageRow({
  item,
  sortable,
  onRemove,
  onEdit,
}: {
  item: QueuedChatMessage;
  sortable: boolean;
  onRemove: (id: string) => void;
  onEdit: (item: QueuedChatMessage) => void;
}) {
  const locale = getLocale();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !sortable,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  const pendingLabel = queueText('pendingLabel', locale);
  const cancelLabel = queueText('cancel', locale);
  const editLabel = queueText('edit', locale);
  const reorderLabel = queueText('reorder', locale);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={[
        'group/queued-row relative flex items-center gap-1 pl-4 pr-3',
        isDragging ? 'opacity-90' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {sortable ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={reorderLabel}
          className={[
            'absolute inset-y-0 left-0.5 z-10 flex w-3 cursor-grab items-center justify-center',
            'text-white/40 opacity-0 transition-opacity hover:text-white/70 active:cursor-grabbing',
            'group-hover/queued-row:opacity-100 focus:opacity-100 focus:outline-none',
            isDragging ? 'opacity-100' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          {...listeners}
        >
          <OfficialGripVerticalIcon size={12} strokeWidth={1.5} />
        </button>
      ) : null}
      <OfficialMessageIcon size={16} className="shrink-0 text-text-text-tertiary" />
      <span className="min-w-0 flex-1 truncate text-xs leading-5 text-white/60">
        <ChatReferenceText value={item.text} compact />
      </span>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-[10px] leading-5 text-text-text-tertiary">{pendingLabel}</span>
        <div className="flex items-center gap-2">
          <OfficialTooltip content={cancelLabel}>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="cursor-pointer text-text-text-tertiary transition-colors hover:text-white/70 focus:outline-none"
              aria-label={cancelLabel}
            >
              <OfficialTrashIcon size={14} strokeWidth={1.5} />
            </button>
          </OfficialTooltip>
          <OfficialTooltip content={editLabel}>
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="cursor-pointer text-text-text-tertiary transition-colors hover:text-white/70 focus:outline-none"
              aria-label={editLabel}
            >
              <OfficialPencilIcon size={14} strokeWidth={1.5} />
            </button>
          </OfficialTooltip>
        </div>
      </div>
    </div>
  );
}

export default function QueuedMessagesBar({
  onHeightChange,
  onEditItem,
}: {
  onHeightChange?: (height: number) => void;
  /** 官方 `A`（编辑回调）：把整条排队项交给宿主搬回输入框（官方搬 text + 附件 + 引用 + 上下文）。 */
  onEditItem?: (item: QueuedChatMessage) => void;
}) {
  useT();
  const queued = useAppStore((state) => state.messageQueue);
  const removeQueuedMessage = useAppStore((state) => state.removeQueuedMessage);
  const reorderQueuedMessages = useAppStore((state) => state.reorderQueuedMessages);

  const visible = queued.length > 0;
  const sortable = queued.length > 1;
  const ids = useMemo(() => queued.map((item) => item.id), [queued]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(false);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      reorderQueuedMessages(String(active.id), String(over.id));
    },
    [reorderQueuedMessages],
  );

  const handleEdit = useCallback(
    (item: QueuedChatMessage) => {
      /* 官方顺序：先搬回输入框（text + 附件 + 引用 + 上下文），再 `removeQueuedMessage(id)`。 */
      onEditItem?.(item);
      removeQueuedMessage(item.id);
      window.dispatchEvent(new CustomEvent('chat-focus-composer'));
    },
    [onEditItem, removeQueuedMessage],
  );

  const reportHeight = useCallback(
    (height: number) => {
      onHeightChange?.(height);
    },
    [onHeightChange],
  );

  useEffect(() => {
    if (!visible) return;
    const node = contentRef.current;
    if (!node) return;
    reportHeight(node.offsetHeight);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) reportHeight((entry.target as HTMLElement).offsetHeight);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reportHeight, visible]);

  const measureBottom = useCallback(() => {
    const node = scrollRef.current;
    setAtBottom(!!node && node.scrollTop + node.clientHeight < node.scrollHeight - 1);
  }, []);

  useEffect(() => {
    measureBottom();
    const node = scrollRef.current;
    if (!node) return;
    node.addEventListener('scroll', measureBottom, { passive: true });
    return () => node.removeEventListener('scroll', measureBottom);
  }, [measureBottom, queued.length, visible]);

  return (
    <InputTopSheet
      visible={visible}
      motionKey="queued-messages-bar"
      contentRef={contentRef}
      onExitComplete={() => reportHeight(0)}
    >
      <div className="relative py-2">
        <div
          ref={scrollRef}
          className="flex max-h-[148px] flex-col gap-3 overflow-y-auto [scrollbar-gutter:stable] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border scrollbar-thumb-rounded"
        >
          <DndContext
            id="queued-messages-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            autoScroll={{ threshold: { x: 0, y: 0.25 } }}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {queued.map((item) => (
                <QueuedMessageRow
                  key={item.id}
                  item={item}
                  sortable={sortable}
                  onRemove={removeQueuedMessage}
                  onEdit={handleEdit}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <div
          aria-hidden
          className={[
            'pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent',
            'transition-opacity duration-200',
            atBottom ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
      </div>
    </InputTopSheet>
  );
}
