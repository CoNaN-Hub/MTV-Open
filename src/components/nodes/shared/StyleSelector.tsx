/**
 * StyleSelector — 画风选择器，PromptPanel 底部按钮 + ModalOverlay 弹出网格面板
 * 支持用户自定义画风（名称 + 提示词 + 图片）
 */
import { OfficialIcon } from '../../sidebar/OfficialIcon';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { createPortal } from 'react-dom';
import ModalOverlay from '../../shared/ModalOverlay';
import PopupCloseButton from '../../shared/PopupCloseButton';
import { useAppStore } from '../../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { PROJECT_STYLE_OPTIONS } from '../../../services/projectSettingsService';
import { useT } from '../../../i18n';

// ── 画风缩略图 ──
import thumbRealistic from '../../../assets/images/styles/realistic.webp';
import thumbAnime from '../../../assets/images/styles/anime.webp';
import thumbWatercolor from '../../../assets/images/styles/watercolor.webp';
import thumbOilPainting from '../../../assets/images/styles/oil-painting.webp';
import thumbSketch from '../../../assets/images/styles/sketch.webp';
import thumbCyberpunk from '../../../assets/images/styles/cyberpunk.webp';
import thumbInkWash from '../../../assets/images/styles/ink-wash.webp';
import thumbPixelArt from '../../../assets/images/styles/pixel-art.webp';
import thumb3dRender from '../../../assets/images/styles/3d-render.webp';
import thumbFlatIllustration from '../../../assets/images/styles/flat-illustration.webp';
import thumbCinematic from '../../../assets/images/styles/cinematic.webp';
import thumbVintage from '../../../assets/images/styles/vintage.webp';

/** 画风缩略图映射表 */
const THUMBNAILS: Record<string, string> = {
  realistic: thumbRealistic,
  anime: thumbAnime,
  watercolor: thumbWatercolor,
  'oil-painting': thumbOilPainting,
  sketch: thumbSketch,
  cyberpunk: thumbCyberpunk,
  'ink-wash': thumbInkWash,
  'pixel-art': thumbPixelArt,
  '3d-render': thumb3dRender,
  'flat-illustration': thumbFlatIllustration,
  cinematic: thumbCinematic,
  vintage: thumbVintage,
};

interface StyleOption {
  id: string;
  name: string;
  description?: string;
  prompt?: string;
  thumbnail?: string;
  isCustom?: boolean;
}

/** 画风列表 — ai-image / ai-panorama / ai-video 共用同一套选项 */
const SHARED_STYLES: StyleOption[] = PROJECT_STYLE_OPTIONS.map((style) => ({
  ...style,
  thumbnail: THUMBNAILS[style.id],
}));

/** 画风列表 — 按 nodeType 分组（当前共用同一套选项） */
const STYLE_GROUPS: Record<string, StyleOption[]> = {
  'ai-image': SHARED_STYLES,
  'ai-panorama': SHARED_STYLES,
  'ai-video': SHARED_STYLES,
};

interface StyleSelectorProps {
  nodeType: string;
  selectedStyle?: string;
  selectedStyleName?: string;
  /** 官方 `tnt` 的 `selectedStyleCover`：有风格时把图标换成封面缩略图 */
  selectedStyleCover?: string;
  onChange?: (styleId: string) => void;
  triggerVariant?: 'icon' | 'field';
  respectProjectLock?: boolean;
  onModalOpenChange?: (open: boolean) => void;
}

export default function StyleSelector({
  nodeType,
  selectedStyle,
  selectedStyleName,
  selectedStyleCover,
  onChange,
  triggerVariant = 'icon',
  respectProjectLock = true,
  onModalOpenChange,
}: StyleSelectorProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);

  // 新增表单
  const [formName, setFormName] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formThumbnail, setFormThumbnail] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const customStyles = useAppStore((s) => s.customStyles);
  const addCustomStyle = useAppStore((s) => s.addCustomStyle);
  const updateCustomStyle = useAppStore((s) => s.updateCustomStyle);
  const deleteCustomStyle = useAppStore((s) => s.deleteCustomStyle);
  const storedLockedProjectStyle = useAppStore(
    useShallow((state) => {
      const project = state.projects.find((item) => item.id === state.currentProjectId);
      const style = project?.settings?.visualStyle;
      return style?.locked && style.styleId ? style : null;
    }),
  );
  const lockedProjectStyle = respectProjectLock ? storedLockedProjectStyle : null;

  // 合并内置 + 自定义画风
  const builtin = STYLE_GROUPS[nodeType] ?? [];
  const custom = customStyles.filter((s) => s.nodeType === nodeType).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.prompt,
    prompt: s.prompt,
    thumbnail: s.thumbnail,
    isCustom: true,
  }));
  const styles = [...builtin, ...custom];

  // Escape 关闭
  useEffect(() => {
    if (!open && !addOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (addOpen) setAddOpen(false);
        else setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, addOpen]);

  useEffect(() => {
    onModalOpenChange?.(open || addOpen);
    return () => onModalOpenChange?.(false);
  }, [addOpen, onModalOpenChange, open]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  }, []);

  const handleSelect = useCallback(
    (styleId: string) => {
      onChange?.(styleId);
      setOpen(false);
    },
    [onChange],
  );

  const handleDeleteCustom = useCallback(
    (e: React.MouseEvent, styleId: string) => {
      e.stopPropagation();
      e.preventDefault();
      void deleteCustomStyle(styleId);
      // 如果当前选中了被删除的画风，清除选择
      if (selectedStyle === styleId) onChange?.('');
    },
    [deleteCustomStyle, selectedStyle, onChange],
  );

  // 打开新增表单
  const openAddForm = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setFormName('');
    setFormPrompt('');
    setFormThumbnail(undefined);
    setEditingStyleId(null);
    setAddOpen(true);
  }, []);

  const openEditForm = useCallback((e: React.MouseEvent, styleId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const style = customStyles.find((item) => item.id === styleId);
    if (!style) return;
    setFormName(style.name);
    setFormPrompt(style.prompt);
    setFormThumbnail(style.thumbnail);
    setEditingStyleId(style.id);
    setAddOpen(true);
  }, [customStyles]);

  // 选择图片文件
  const handlePickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFormThumbnail(reader.result as string);
    reader.readAsDataURL(file);
    // reset so same file can be re-selected
    e.target.value = '';
  }, []);

  // 提交新增或编辑
  const handleAddSubmit = useCallback(() => {
    const name = formName.trim();
    if (!name) return;
    const draft = {
      nodeType,
      name,
      prompt: formPrompt.trim(),
      thumbnail: formThumbnail,
    };
    if (editingStyleId) void updateCustomStyle(editingStyleId, draft);
    else void addCustomStyle(draft);
    setAddOpen(false);
    setEditingStyleId(null);
  }, [addCustomStyle, editingStyleId, formName, formPrompt, formThumbnail, nodeType, updateCustomStyle]);

  const effectiveSelectedStyle = lockedProjectStyle?.styleId ?? selectedStyle;
  const selectedName = styles.find((s) => s.id === effectiveSelectedStyle)?.name
    ?? lockedProjectStyle?.styleName
    ?? selectedStyleName;
  /* 官方 `tnt` 在有风格时把图标换成**风格封面**（`img w-5 h-5 rounded-[4px] object-cover`）
     ⚠️ 原来这里读 `lockedProjectStyle?.styleCover` —— 该字段**全项目无人写入**（死引用 ✗）⇒
        项目锁定的风格封面真实字段是 `visualStyle.styleReference.imageUrl`（见 `types/index.ts` `ProjectStyleReference`）。 */
  const selectedThumbnail = styles.find((s) => s.id === effectiveSelectedStyle)?.thumbnail
    ?? lockedProjectStyle?.styleReference?.imageUrl
    ?? selectedStyleCover;

  return (
    <>
      {triggerVariant === 'field' ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={!!lockedProjectStyle}
          onClick={handleToggle}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-border
                     bg-card px-3 text-left text-xs text-foreground outline-none
                     transition-colors hover:border-border-secondary focus:border-primary
                     disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon icon="lucide:palette" className="h-3.5 w-3.5 shrink-0 text-accent-primary" />
          <span className={`min-w-0 flex-1 truncate ${selectedName ? '' : 'text-text-text-tertiary'}`}>
            {selectedName || t('选择画风')}
          </span>
          <Icon icon="lucide:chevron-right" className="h-3.5 w-3.5 shrink-0 text-text-text-tertiary" />
        </button>
      ) : (
        /* ══ 官方「风格」触发器 `tnt`（@3141914 逐字）══
             <div className={Z("relative flex items-center","h-9 rounded-lg","transition-all duration-200",
                               "hover:bg-muted active:bg-white/[0.1]","cursor-pointer group/style")} onClick={open}>
               <div className="flex items-center justify-center w-7 h-7 m-0.5 rounded-md">
                 {有风格 ? <img className="w-5 h-5 rounded-[4px] object-cover"/> : <图标 16/>}
               </div>
               <span className={Z("text-sm font-medium whitespace-nowrap pr-2", 有风格 && "max-w-[60px] truncate")}>
                 {有风格 ? 风格名 : t("assetStyle.buttonLabel")}   「风格」
               </span>
               {有风格 && onClear && <button className="absolute -top-1 -right-1 w-4 h-4 bg-black rounded-full
                                                      flex items-center justify-center opacity-0
                                                      group-hover/style:opacity-100 transition-opacity">✕</button>}
             </div>
            外层 tooltip `V3`：`side="top" align="center" sideOffset={8}`；
            无风格时内容是文案 `assetStyle.tooltipTitle` =「风格仅基于图片生效」（MTV 原来写的是自造的
            「选择画风 / 画风: X」✗）；有风格时官方给的是 60px 宽的风格预览卡（名称 + 各张风格图）。
            ⚠️ MTV 原来只有【图标 + 「风格」】两件，**没有图标盒/没有封面缩略图/没有选中态名称/没有清除键** ✗ */
        <button
          type="button"
          className={`prompt-btn style-selector-btn${open ? ' style-active' : ''}${effectiveSelectedStyle ? ' has-style' : ''}${lockedProjectStyle ? ' cursor-not-allowed opacity-70' : ''}`}
          data-tooltip={selectedName ? selectedName : t('风格仅基于图片生效')}
          data-tooltip-pos="top"
          data-tooltip-offset="8"
          data-tooltip-delay="200"
          disabled={!!lockedProjectStyle}
          aria-disabled={!!lockedProjectStyle}
          onClick={handleToggle}
        >
          <span className="style-trigger-iconbox">
            {selectedThumbnail ? (
              <img className="style-trigger-cover" src={selectedThumbnail} alt="" draggable={false} />
            ) : (
              <OfficialIcon name="style" size={16} />
            )}
          </span>
          <span className="style-trigger-label">{selectedName || t('风格')}</span>
          {effectiveSelectedStyle && (
            <span
              role="button"
              tabIndex={-1}
              className="style-trigger-clear"
              aria-label={t('清除画风')}
              onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
              onClick={(event) => { event.stopPropagation(); onChange?.(''); }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </span>
          )}
        </button>
      )}

      {/* ── 画风选择弹窗 ── */}
      {createPortal(
        <ModalOverlay
          isOpen={open}
          onClose={() => setOpen(false)}
          ariaLabel={t('选择画风')}
          className="style-picker-panel"
        >
          <div className="style-picker-header">
            <span className="asset-picker-title">{t('选择画风')}</span>
            <div className="style-picker-header-actions">
              {effectiveSelectedStyle ? (
                <button
                  type="button"
                  className="style-add-btn"
                  onClick={() => handleSelect('')}
                  data-tooltip={t('清除画风')}
                  aria-label={t('清除当前画风')}
                >
                  <Icon icon="lucide:circle-off" className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                className="style-add-btn"
                onClick={openAddForm}
                data-tooltip={t('添加自定义画风')}
                aria-label={t('添加自定义画风')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <PopupCloseButton
                ariaLabel={t('关闭画风选择')}
                onClick={() => setOpen(false)}
              />
            </div>
          </div>
          <div className="style-picker-grid">
            {styles.length === 0 && (
              <div className="style-picker-empty">{t('暂无可选画风')}</div>
            )}
            {styles.map((s) => (
              <div
                key={s.id}
                className={`style-card${effectiveSelectedStyle === s.id ? ' selected' : ''}${s.isCustom ? ' is-custom' : ''}`}
              >
                <button
                  type="button"
                  className="style-card-select"
                  onClick={() => handleSelect(s.id)}
                >
                  <div className="style-card-img">
                    {s.thumbnail ? (
                      <img src={s.thumbnail} alt={s.name} />
                    ) : (
                      <div className="style-card-placeholder" />
                    )}
                    <span className="style-card-name">{s.isCustom ? s.name : t(s.name)}</span>
                  </div>
                  {s.description && (
                    <div className="style-card-desc">{s.isCustom ? s.description : t(s.description)}</div>
                  )}
                </button>
                {s.isCustom && (
                  <div className="style-card-actions">
                    <button
                      type="button"
                      className="style-card-action"
                      onClick={(e) => openEditForm(e, s.id)}
                      aria-label={t('编辑 {name}', { name: s.name })}
                      data-tooltip={t('编辑')}
                    >
                      <Icon icon="lucide:pencil" className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="style-card-action style-card-delete"
                      onClick={(e) => handleDeleteCustom(e, s.id)}
                      aria-label={t('删除此画风')}
                      data-tooltip={t('删除此画风')}
                    >
                      <Icon icon="lucide:trash-2" className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ModalOverlay>,
        document.body,
      )}

      {/* ── 新增 / 编辑自定义画风弹窗 ── */}
      {createPortal(
        <ModalOverlay
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          ariaLabel={editingStyleId ? t('编辑 {name}', { name: formName }) : t('添加自定义画风')}
          className="style-add-panel"
          closeOnBackdrop={false}
        >
          <div className="style-picker-header">
            <span className="asset-picker-title">
              {editingStyleId ? t('编辑 {name}', { name: formName }) : t('添加自定义画风')}
            </span>
            <PopupCloseButton
              ariaLabel={t('关闭自定义画风编辑')}
              onClick={() => setAddOpen(false)}
            />
          </div>
          <div className="style-add-body">
            {/* 缩略图 */}
            <div className="style-add-thumb" onClick={handlePickImage}>
              {formThumbnail ? (
                <img src={formThumbnail} alt="" className="style-add-thumb-img" />
              ) : (
                <div className="style-add-thumb-placeholder">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>{t('点击上传缩略图')}</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="style-add-file-input"
                onChange={handleFileChange}
              />
            </div>
            {/* 名称 */}
            <label className="style-add-label">{t('画风名称')}</label>
            <input
              type="text"
              className="style-add-input"
              placeholder={t('例如：赛博朋克')}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubmit(); }}
              autoFocus
            />
            {/* 提示词 */}
            <label className="style-add-label">{t('提示词')}</label>
            <textarea
              className="style-add-textarea"
              placeholder={t('输入该画风对应的提示词，生成时会自动附加到主提示词中')}
              value={formPrompt}
              onChange={(e) => setFormPrompt(e.target.value)}
              rows={3}
            />
            {/* 操作按钮 */}
            <div className="style-add-actions">
              <button
                type="button"
                className="style-add-cancel"
                onClick={() => setAddOpen(false)}
              >
                {t('取消')}
              </button>
              <button
                type="button"
                className="style-add-submit"
                disabled={!formName.trim()}
                onClick={handleAddSubmit}
              >
                {t('保存')}
              </button>
            </div>
          </div>
        </ModalOverlay>,
        document.body,
      )}
    </>
  );
}
