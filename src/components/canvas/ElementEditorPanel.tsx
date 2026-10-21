/**
 * ElementEditorPanel —— 官方「新建主体」左侧面板（element library editor）
 *
 * 官方源码（`page-DPdEgTS0.js`@char1618455 起，逐字）：
 *   motion.aside data-element-editor data-element-editor-scroll
 *     style={{ left: o, top: 64, bottom: p ? 210 : 60, width: L }}
 *   容器类名：`fixed z-[80] flex max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl
 *              border-[0.5px] border-white/[0.10] bg-[rgba(22,22,22,0.82)]
 *              shadow-[inset_0_0.5px_0_0_rgba(255,255,255,0.14),0_4px_8px_0_rgba(0,0,0,0.04)]
 *              backdrop-blur-[40px]`
 *   右侧拖拽调宽：`group/resize absolute bottom-0 right-0 top-0 z-50 flex w-3 cursor-col-resize
 *                  items-center justify-center` + 内 `h-6 w-0.5 rounded-full bg-white/0
 *                  group-hover/resize:bg-white/30`
 *   头部 `flex h-[52px] shrink-0 items-center gap-3 px-4` · 标题 `min-w-0 flex-1 truncate text-sm font-medium text-white/90`
 *   关闭 `size-7 shrink-0 rounded-lg text-white/55 hover:bg-white/5 hover:text-white/90` + lucide x 20
 *   滚动区 `min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:rgba(255,255,255,0.22)_transparent]
 *            [scrollbar-gutter:stable] [scrollbar-width:thin]` > `space-y-4 px-4 pb-4`
 *   字段标签 `text-sm font-medium text-white/55` + 必填星号 `ml-0.5 text-destructive`（`--destructive:#934c4c`）
 *   名称输入 `h-10 rounded-2xl px-3 text-sm`（基类 `h-9 w-full rounded-md border border-input bg-transparent
 *            px-3 py-1 text-base shadow-sm placeholder:text-muted-foreground focus-visible:ring-1`，被三层覆写）
 *   描述 textarea `min-h-[60px] resize-none rounded-2xl px-3 py-2.5 text-sm`（基类 `min-h-16 rounded-md border border-input`）
 *   过滤标签条 `flex w-fit max-w-full min-w-0 gap-1 overflow-x-auto rounded-xl bg-white/5 p-1`
 *   过滤标签 `h-6 shrink-0 rounded-lg px-2 text-xs text-white/50 hover:text-white/75`
 *             选中追加 `bg-[#4a4a4a] text-white/90 shadow-[inset_0_0.5px_0_rgba(255,255,255,0.12)]`
 *   网格 `grid gap-x-2 gap-y-3` + 宽度 ≥448 时 `grid-cols-4`，否则 `grid-cols-2`
 *   卡片 `flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-2xl bg-white/5
 *        text-white/50 transition-colors hover:bg-white/8 hover:text-white/75`
 *   参考卡容器 `relative aspect-square overflow-hidden rounded-2xl bg-white/5`
 *   参考卡标题 `mt-1 truncate text-center text-xs leading-4 text-white/55`
 *   删除按钮 `absolute right-2 top-2 z-30 flex size-5 cursor-pointer items-center justify-center rounded-lg
 *             bg-[#e6e6e6] text-[#1f1f1f] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-white`
 *   底栏 `flex shrink-0 items-center justify-end gap-3 px-4 pb-4 pt-2`
 *   取消 `h-9 w-20 rounded-lg bg-white/[0.035] text-white/85 hover:bg-white/[0.07]`
 *   完成 `h-9 w-20 rounded-lg bg-[#e6e6e6] text-[#0a0a0a] hover:bg-white`，`disabled={saving || !name.trim()}`
 *
 * ★ MTV 落库（用户 2026 决策 A「真接线」）—— MTV 有真实后端，不是假面板：
 *   1. `saveCharacterCard('project', DramaCharacter)` 先建卡（`DramaCharacter`：name/identity/summary/visualNotes/…）
 *   2. 每张**画布参考卡** → `captureImageNodeToCharacter({ nodeId, scope:'project', characterId, kind, prompt, hideNode:false })`
 *      （它内部会把 `CharacterReferenceImage` 合并进 `dramaAssets.characters` 并落盘）
 *   3. 每张**本地上传** → `addCharacterReferenceImage('project', characterId, reference, { makePrimary })`
 *
 * ★ 与官方的已知差异（记账，别当 bug）：
 *   · 官方面板有「个人 / 团队」之外还有「本地上传 / **从画布选择**」两张引导卡。MTV 的入口本来就是
 *     「先在画布上选中节点 → 点工具栏『新建主体』」，面板里的「从画布选择」会退化成**没有行为的假按钮**
 *     ⇒ 按「不做假控件」**不渲染那一张**（网格因此少一格，属预期差异）。
 *   · 官方作用域是云端的个人/团队；MTV 用**项目级** `dramaAssets`（`scope:'project'`）——
 *     「全局角色库」是 MTV 的另一套作用域，留作后续（本轮不做假切换）。
 *   · 参考卡的**拖拽重排**（官方 dnd-kit）未接 —— MTV 无该依赖，且参考图顺序不影响建卡结果。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore, generateId } from '../../store/useAppStore';
import { isEligibleCharacterReferenceNode } from '../../store/store.dramaAssets';
import { normalizeAssetKey } from '../../services/dramaAssetExtract';
import { useT } from '../../i18n';
import type { BaseNodeData } from '../../types';
import type { CharacterReferenceImage, DramaCharacter } from '../../types/dramaAssets';
import type { Node as RFNode } from '@xyflow/react';

/** 参考素材的分类（官方过滤标签条 `全部 / 图片 / 视频 / 音频 / 文本`） */
type MediaFilter = 'all' | 'image' | 'video' | 'audio' | 'text';

interface Reference {
  /** 源画布节点 id（本地文件型参考没有） */
  nodeId?: string;
  /** 缩略图 URL（画布节点取 imageUrl/thumbnailUrl；本地文件取 data URL） */
  url: string;
  title: string;
  filter: Exclude<MediaFilter, 'all'>;
  /** 本地文件型参考的落库载荷（画布型走 captureImageNodeToCharacter，不需要它） */
  local?: CharacterReferenceImage;
}

/** 节点类型 → 官方过滤标签那一类 */
function filterOfNodeType(type: string | undefined): Exclude<MediaFilter, 'all'> {
  if (!type) return 'image';
  if (type.includes('video')) return 'video';
  if (type.includes('audio')) return 'audio';
  if (type.includes('text') || type.includes('markdown') || type.includes('shotlist')) return 'text';
  return 'image';
}

/** 官方面板默认宽度（可右侧拖拽调宽；官方是 framer-motion 的 `L` 状态） */
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 280;
const MAX_WIDTH = 560;
/** 官方 `grid-cols-4` 的断点（容器宽度 ≥448） */
const GRID_BREAKPOINT = 448;
const MAX_LOCAL_FILE_BYTES = 4 * 1024 * 1024;

export default function ElementEditorPanel({
  nodeIds, onClose,
}: {
  /** 打开时**已经选中**的可捕节点（官方 `openForNodes(se)`） */
  nodeIds: readonly string[];
  onClose: () => void;
}) {
  const t = useT();
  const nodes = useAppStore((s) => s.nodes);
  const saveCharacterCard = useAppStore((s) => s.saveCharacterCard);
  const captureImageNodeToCharacter = useAppStore((s) => s.captureImageNodeToCharacter);
  const addCharacterReferenceImage = useAppStore((s) => s.addCharacterReferenceImage);
  const showToast = useAppStore((s) => s.showToast);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 打开那一刻把「选中的可捕节点」固化成参考卡（之后画布选区变化不影响本面板，官方同理） */
  const [references, setReferences] = useState<Reference[]>(() => (
    nodeIds
      .map((id) => nodes.find((n) => n.id === id) as RFNode<BaseNodeData> | undefined)
      .filter((node): node is RFNode<BaseNodeData> => isEligibleCharacterReferenceNode(node))
      .map((node) => ({
        nodeId: node.id,
        url: (node.data.imageUrl ?? node.data.thumbnailUrl ?? '') as string,
        title: (node.data.label as string | undefined)?.trim() || t('参考素材'),
        filter: filterOfNodeType(node.type),
      }))
  ));

  /* Esc 关闭（官方 radix 面板同理） */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  /* 右侧拖拽调宽（官方 `group/resize` 热区 12px） */
  const onResizeStart = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (move: PointerEvent) => {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (move.clientX - startX)));
      setWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [width]);

  const counts = useMemo(() => ({
    all: references.length,
    image: references.filter((r) => r.filter === 'image').length,
    video: references.filter((r) => r.filter === 'video').length,
    audio: references.filter((r) => r.filter === 'audio').length,
    text: references.filter((r) => r.filter === 'text').length,
  }), [references]);
  const visible = filter === 'all' ? references : references.filter((r) => r.filter === filter);
  const columns = width >= GRID_BREAKPOINT ? 4 : 2;

  const addLocalFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    void (async () => {
      const added: Reference[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_LOCAL_FILE_BYTES) {
          showToast(t('「{name}」超过 4MB，已跳过', { name: file.name }), 'error');
          continue;
        }
        const isImage = file.type.startsWith('image/');
        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('read failed'));
          reader.readAsDataURL(file);
        }).catch(() => '');
        if (!url) continue;
        const now = Date.now();
        added.push({
          url,
          title: file.name,
          filter: isImage ? 'image' : 'text',
          local: {
            id: `reference-${generateId()}`,
            kind: 'other',
            imageUrl: url,
            prompt: '',
            createdAt: now,
            updatedAt: now,
          },
        });
      }
      if (added.length > 0) setReferences((prev) => [...prev, ...added]);
    })();
  }, [showToast, t]);

  const confirm = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const now = Date.now();
      const character: DramaCharacter = {
        id: `character-${generateId()}`,
        kind: 'character',
        name: trimmed,
        key: normalizeAssetKey(trimmed),
        summary: description.trim(),
        visualNotes: description.trim(),
        identity: description.trim() || trimmed,
        importance: 'main',
        confirmed: true,
        createdAt: now,
        updatedAt: now,
        source: 'manual',
      };
      const created = await saveCharacterCard('project', character);
      if (!created) { showToast(t('新建主体失败'), 'error'); return; }

      let index = 0;
      for (const reference of references) {
        if (reference.nodeId) {
          /* 官方 `mme`/`captureImageNodeToCharacter`：画布节点 → 角色参考图（首张即主视觉） */
          await captureImageNodeToCharacter({
            nodeId: reference.nodeId,
            scope: 'project',
            characterId: character.id,
            kind: index === 0 ? 'primary' : 'other',
            prompt: character.visualNotes,
            hideNode: false,
          });
        } else if (reference.local) {
          await addCharacterReferenceImage('project', character.id, reference.local, {
            makePrimary: index === 0,
          });
        }
        index += 1;
      }
      showToast(t('已新建主体「{name}」', { name: trimmed }));
      onClose();
    } finally {
      setSaving(false);
    }
  }, [
    addCharacterReferenceImage, captureImageNodeToCharacter, description, name, onClose, references,
    saveCharacterCard, saving, showToast, t,
  ]);

  const FILTERS: Array<[MediaFilter, string]> = [
    ['all', t('全部')], ['image', t('图片')], ['video', t('视频')], ['audio', t('音频')], ['text', t('文本')],
  ];

  return createPortal(
    <aside
      data-element-editor
      data-element-editor-scroll
      className="element-editor-panel"
      style={{ width }}
      aria-label={t('新建主体')}
    >
      <header className="element-editor-header">
        <h2 className="element-editor-title">{t('新建主体')}</h2>
        <button type="button" className="element-editor-close" aria-label={t('取消')} onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6l-12 12" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* 右侧拖拽调宽（官方 `group/resize` 12px 热区 + hover 才亮的 2×24 把手） */}
      <div
        className="element-editor-resize"
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onResizeStart}
      >
        <span className="element-editor-resize-bar" />
      </div>

      <div className="element-editor-scroll">
        <div className="element-editor-body">
          <div>
            <label className="element-editor-label" htmlFor="element-name">
              {t('名称')}<span className="element-editor-required">*</span>
            </label>
            <input
              id="element-name"
              required
              maxLength={50}
              className="element-editor-input"
              placeholder={t('例如：男主角')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div>
            <label className="element-editor-label" htmlFor="element-description">{t('主体描述')}</label>
            <textarea
              id="element-description"
              rows={2}
              className="element-editor-textarea"
              placeholder={t('描述模型应该如何理解这个主体')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div>
            <label className="element-editor-label">{t('添加参考素材')}</label>
            <div className="element-editor-filters" role="tablist" aria-label={t('添加参考素材')}>
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  className={`element-editor-filter${filter === value ? ' is-active' : ''}`}
                  onClick={() => setFilter(value)}
                >
                  {label} ({counts[value]})
                </button>
              ))}
            </div>

            <div className="element-editor-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {/* 官方「本地上传」卡（`Ds` tabler plus 16） */}
              <button
                type="button"
                className="element-editor-card"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5l0 14" /><path d="M5 12l14 0" />
                </svg>
                <span className="element-editor-card-label">{t('本地上传')}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                multiple
                hidden
                onChange={(event) => { addLocalFiles(event.target.files); event.target.value = ''; }}
              />

              {visible.map((reference, index) => (
                <div key={reference.nodeId ?? `local-${index}-${reference.title}`} className="element-editor-ref">
                  <div className="element-editor-ref-thumb">
                    <img src={reference.url} alt="" draggable={false} />
                    <button
                      type="button"
                      className="element-editor-ref-remove"
                      aria-label={t('移除')}
                      onClick={() => setReferences((prev) => prev.filter((item) => item !== reference))}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 6l-12 12" /><path d="M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="element-editor-ref-title">{reference.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="element-editor-footer">
        <button type="button" className="element-editor-btn element-editor-btn--ghost" onClick={onClose}>
          {t('取消')}
        </button>
        <button
          type="button"
          className="element-editor-btn element-editor-btn--primary"
          disabled={saving || !name.trim()}
          onClick={() => { void confirm(); }}
        >
          {t('完成')}
        </button>
      </footer>
    </aside>,
    document.body,
  );
}
