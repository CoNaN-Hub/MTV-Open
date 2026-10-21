/**
 * MentionEditor @提及编辑器 — 支持 @引用其他节点输出的富文本输入框，实时渲染为彩色标签芯片
 */
import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import type { WorkflowIONodeType } from '../../../types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '@iconify/react';
import { calcAnchoredPosition } from '../../../utils/popupPosition';
import MentionPicker, {
  type MentionPickerChip,
  type MentionPickerItem,
  MENTION_LINKED_SECTION,
  MENTION_LINKED_HINT,
  /* 素材库段的官方键 = `omniReference.suggestion.privateSection`「个人素材库」（**不是** `myLibrarySection`）。
     ⚠️ **同一份 MTV 短剧资产数据、同一个官方键**：`components/chat/ChatInput.tsx` 的 `@` 面板也用这个常量，
     改一处必须改两处（规格书 §4 注：官方 `Ub` 在该位置不渲染 `myLibrarySection`）。 */
  MENTION_PRIVATE_SECTION,
  MENTION_PLUGIN_SECTION,
} from '../../shared/MentionPicker';
import {
  DRAMA_MENTION_MERGE_ALL,
  buildDramaMentionId,
  buildDramaActionMentionId,
  buildDramaVoiceMentionId,
} from '../../../types/dramaAssets';
import type { CharacterReferenceImage } from '../../../types/dramaAssets';
import { AVATAR_ASPECT, CHARACTER_REFERENCE_KIND_LABELS } from '../../character/characterReferencePresentation';
import { useReferenceHoverCard } from './referenceHoverCard';
import { normalizePlainPromptText } from '../../../utils/promptTextNormalize';
import { resolveDramaActionMediaRef, resolveDramaVoiceRef } from '../../../services/dramaAssetPrompt';
import {
  bestNodeThumb,
  buildChipEl,
  buildDramaChipEl,
  buildWorkflowChipEl,
  ensureCaretSlotBeforeChip,
  getNodeMetaMap,
  isBrEl,
  isChipEl,
  normalizeChipSlots,
  renderPromptToNodes,
  renumberMentionChips,
  serializeDOM,
  syncImageReferenceLabels,
  ZWSP,
} from './mentionEditorDom';
import {
  resolveCanvasMentionNodes,
  resolveDramaMentionItems,
  resolveWorkflowMentionNodes,
} from './mentionEditorSources';

// 无缩略图时的卡片占位图标
const MEDIA_ICONS: Record<'image' | 'video' | 'audio' | 'text', string> = {
  image: 'mdi:image-outline',
  video: 'mdi:video-outline',
  audio: 'mdi:music-note-outline',
  text: 'mdi:text-box-outline',
};
const DRAMA_KIND_LABELS: Record<string, string> = { character: '角色', scene: '场景', prop: '道具' };

// ── Props ──
export interface MentionEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  nodeId?: string;
  selectedWorkflowId?: string;
  canSubmit?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onSlashTrigger?: () => void;
  className?: string;
}

// ── 暴露给上层的命令式接口（在当前光标处插入节点引用芯片）──
export interface MentionEditorHandle {
  insertMentionAtCursor: (id: string, label: string) => void;
}

// ═══════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════

const MentionEditor = forwardRef<MentionEditorHandle, MentionEditorProps>(function MentionEditor({
  value: prompt = '',
  onChange,
  onSubmit,
  placeholder = '输入提示词开始创作   (Enter 生成，Shift+Enter 换行)',
  nodeId,
  selectedWorkflowId,
  canSubmit = true,
  onFocus,
  onBlur,
  onSlashTrigger,
  className = '',
}: MentionEditorProps, ref) {
  // ── @ Mention state ──
  const [showMention, setShowMention] = useState(false);
  /** Escape 关弹窗时置 true ⇒ 让「showMention→false」跃迁里的删除生效（选中候选时不能删） */
  const escapeRequestedRef = useRef(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const mentionEditorWrapRef = useRef<HTMLDivElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const [mentionDropdownPosition, setMentionDropdownPosition] = useState({ left: 12, top: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const savedMentionRangeRef = useRef<Range | null>(null);
  const selectFirstMentionRef = useRef<(() => void) | null>(null);
  const lastFocusedWfValueRef = useRef<HTMLSpanElement | null>(null);
  const { nodes, edges, workflows, dramaAssets } = useAppStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      workflows: state.workflows,
      dramaAssets: state.dramaAssets,
    })),
  );

  // ── Selected workflow and its IO nodes ──
  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.id === selectedWorkflowId),
    [workflows, selectedWorkflowId],
  );
  const workflowIONodes = useMemo(
    () => selectedWorkflow?.ioNodes || [],
    [selectedWorkflow],
  );

  // ── Build nodeId → { type, displayId, thumbnailUrl } map ──
  const nodeMetaMap = useMemo(() => getNodeMetaMap(nodes), [nodes]);

  // ── Rebuild DOM when prompt changes externally ──
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    syncImageReferenceLabels(el, nodeMetaMap);
    /* ★ 官方**载入 value 时也走同一套解析**（`setContent(e,false,Q)`）⇒ 存量文本一并二次排版。
       ⚠️ 这里必须用**归一后**的串来比：DOM 本来就是由 `prompt` 生成的，拿原文比必然相等、
         直接 early-return，永远归不了 ✗（这就是「官方会二次排版、MTV 不会」的根因）。
       `prompt` 本身**不动**（官方也不回写），只影响编辑器里看到的排版。 */
    const normalizedPrompt = normalizePlainPromptText(prompt);
    if (serializeDOM(el) === normalizedPrompt) {
      // 删空后浏览器常残留 <br>，而 serializeDOM 会剥掉尾部换行使其「看起来为空」，
      // 于是 DOM 不会被清理、光标停在残留空行（第 2/3 行）。这里把真正的空状态归一化。
      // 仅在 prompt 由非空变空时触发（此 effect 才会重跑），不影响用户主动按 Shift+Enter 换行。
      if (normalizedPrompt === '' && el.innerHTML !== '') {
        const hadFocus = document.activeElement === el;
        el.innerHTML = '';
        if (hadFocus) {
          const sel = window.getSelection();
          const r = document.createRange();
          r.selectNodeContents(el);
          r.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
      }
      return;
    }
    const sel = window.getSelection();
    const cursorOffset = sel && sel.rangeCount ? saveCursor(el) : null;
    el.innerHTML = '';
    for (const node of renderPromptToNodes(normalizedPrompt, nodeMetaMap)) {
      el.appendChild(node);
    }
    syncImageReferenceLabels(el, nodeMetaMap);
    if (cursorOffset !== null) restoreCursor(el, cursorOffset);
  }, [prompt, nodeMetaMap]);

  // ── Cursor save/restore ──
  const saveCursor = (root: HTMLElement): number => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer)) return 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
    let offset = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node === range.startContainer) return offset + range.startOffset;
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (parent && parent.closest('[data-ref-id]')) continue;
        if (parent && parent.closest('[data-magic-item]')) continue;
        if (parent && parent.closest('[data-skill-id]')) continue;
        if (parent && parent.closest('[data-wf-id]') && !parent.closest('.prompt-chip-wf-value')) continue;
        offset += (node.textContent || '').length;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.hasAttribute('data-ref-id')) offset += 1;
        else if (el.hasAttribute('data-magic-item')) offset += 1;
        else if (el.hasAttribute('data-skill-id')) offset += 1;
        else if (el.hasAttribute('data-wf-id')) offset += 1;
      }
    }
    return offset;
  };

  const restoreCursor = (root: HTMLElement, offset: number) => {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
    let count = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      let nodeLen = 0;
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (parent && parent.closest('[data-ref-id]')) continue;
        if (parent && parent.closest('[data-magic-item]')) continue;
        if (parent && parent.closest('[data-skill-id]')) continue;
        if (parent && parent.closest('[data-wf-id]') && !parent.closest('.prompt-chip-wf-value')) continue;
        nodeLen = (node.textContent || '').length;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.hasAttribute('data-ref-id') || el.hasAttribute('data-magic-item') || el.hasAttribute('data-wf-id') || el.hasAttribute('data-skill-id')) nodeLen = 1;
        if (el.classList.contains('prompt-chip-wf-value') && count + nodeLen >= offset) {
          const firstChild = el.firstChild;
          if (firstChild) {
            range.setStart(firstChild, Math.max(0, offset - count));
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
          }
        }
      }
      if (count + nodeLen >= offset) {
        range.setStart(node, offset - count);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      count += nodeLen;
    }
    range.selectNodeContents(root);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  // ── Emit prompt string to parent ──
  const emitDOM = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    /* ★ 官方 `updateMentionLabels`（`zoom-slider` @3196427 / @3196958）：提及列表增删/重排后，
       同类芯片按新顺序**重新编号**（`Image 1` / `Image 2` …；有自己名字的仍用名字）。
       MTV 原来把插入时的标签烧进 token ⇒ 后面再 @ 一张不会改前一张的编号，删掉中间一张也不收敛 ✗ */
    renumberMentionChips(el, nodeMetaMap);
    syncImageReferenceLabels(el, nodeMetaMap);
    const next = serializeDOM(el);
    /* 官方 `dN`：用户删掉焦点编辑芯片后，画布上那条标记也必须跟着消失。*/
    useAppStore.getState().pruneFocusEditMarks(next);
    onChange(next);
  }, [nodeMetaMap, onChange]);

  const canvasMentionNodes = useMemo(
    () => (showMention ? resolveCanvasMentionNodes(nodeId, nodes, edges) : []),
    [edges, nodeId, nodes, showMention],
  );
  const workflowMentionNodes = useMemo(
    () => (showMention ? resolveWorkflowMentionNodes(selectedWorkflowId, workflowIONodes) : []),
    [selectedWorkflowId, showMention, workflowIONodes],
  );

  const filteredCanvasMentions = mentionQuery
    ? canvasMentionNodes.filter((n) => n.label.toLowerCase().includes(mentionQuery.toLowerCase()))
    : canvasMentionNodes;
  const filteredWorkflowMentions = mentionQuery
    ? workflowMentionNodes.filter((n) => n.label.toLowerCase().includes(mentionQuery.toLowerCase()))
    : workflowMentionNodes;

  const currentNodeType = nodes.find((node) => node.id === nodeId)?.data.type;
  const isAudioNode = currentNodeType === 'ai-audio';
  const isVideoNode = currentNodeType === 'ai-video';
  const dramaMentionItems = useMemo(() => {
    if (!showMention) return [];
    return resolveDramaMentionItems(dramaAssets, mentionQuery, currentNodeType);
  }, [showMention, dramaAssets, mentionQuery, currentNodeType]);

  // 角色参考图 / 动作列表 / 单个动作的素材选择。
  const [dramaRefPickerId, setDramaRefPickerId] = useState<string | null>(null);
  const [dramaActionPicker, setDramaActionPicker] = useState(false);
  const [dramaVoicePicker, setDramaVoicePicker] = useState(false);
  const [dramaActionId, setDramaActionId] = useState<string | null>(null);
  // @ 面板的 Tab / 资产种类筛选
  const [pickerTab, setPickerTab] = useState<'nodes' | 'assets' | 'workflow' | null>(null);
  const [dramaKind, setDramaKind] = useState<string>('all');
  useEffect(() => {
    if (!showMention) {
      setDramaRefPickerId(null);
      setDramaVoicePicker(false);
      setDramaActionPicker(false);
      setDramaActionId(null);
      setPickerTab(null);
      setDramaKind('all');
    }
  }, [showMention]);

  // ── Clear saved range when the mention menu closes ──
  useEffect(() => {
    if (!showMention) savedMentionRangeRef.current = null;
  }, [showMention]);

  // ── Track last focused workflow chip value area ──
  // 用于点击 connected-nodes-strip 缩略图时把文本插入到正确的 value 区
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const handler = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.classList.contains('prompt-chip-wf-value')) {
        lastFocusedWfValueRef.current = target;
      } else {
        lastFocusedWfValueRef.current = null;
      }
    };
    editor.addEventListener('focusin', handler);
    return () => editor.removeEventListener('focusin', handler);
  }, []);

  // ── Click outside closes mention ──
  useEffect(() => {
    if (!showMention) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      /* ⚠️ 弹窗已按官方 tippy 的 `appendTo: document.body` **Portal 到 body**（见下方渲染），
         它不再是编辑器的子节点 ⇒ 点弹窗里的行会被判成「点在外面」，capture 阶段就把菜单关掉，
         于是「选了卡片但输入框里什么都没有」（用户报的就是这个）。
         ⇒ 先把弹窗自身排除掉。 */
      if (mentionDropdownRef.current?.contains(target)) return;
      if (editorRef.current && !editorRef.current.parentElement?.contains(target)) {
        setShowMention(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [showMention]);

  // ── Helpers ──
  /** 删除光标前的 @ 及后续查询字（如 `@主角` → 整段删掉再插入芯片） */
  const deleteAtChar = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const container = range.startContainer;
    if (!container || container.nodeType !== Node.TEXT_NODE) return;
    const cursor = range.startOffset;
    const textBefore = (container.textContent || '').slice(0, cursor);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx < 0) return;
    const r = document.createRange();
    r.setStart(container, atIdx);
    r.setEnd(container, cursor);
    r.deleteContents();
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }, []);

  // ── Insert a canvas node chip ──
  const insertChipAtCursor = useCallback(
    (refNodeId: string, refLabel: string) => {
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.startContainer)) {
        range.selectNodeContents(el);
        range.collapse(false);
      }
      const chip = buildChipEl(refNodeId, refLabel, nodeMetaMap);
      range.insertNode(chip);
      ensureCaretSlotBeforeChip(chip);
      /* ★ 官方 `Ag`（kit @590365）选中提及后是
           `insertContentAt(range, [{type:'mention',attrs},{type:'text',text:' '}])`
         —— **芯片后面固定跟一个空格**，芯片自身没有任何 margin。
         MTV 原来既没插空格、`.prompt-chip-node` 又把 margin 归零 ⇒ 两个芯片**贴在一起**（实测 gap = 0px）✗
         （用户：「芯片之间的间距不对」）。空格宽度 = 同字体字号下一个空格的宽度（实测 3.94px @14px Inter）✓ */
      const spacer = document.createTextNode(' ');
      chip.parentNode?.insertBefore(spacer, chip.nextSibling);
      range.setStart(spacer, 1);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      emitDOM();
    },
    [nodeMetaMap, emitDOM],
  );

  // 暴露命令式插入：在当前光标处插入引用芯片；若编辑器内无有效光标则落到末尾
  useImperativeHandle(ref, () => ({
    insertMentionAtCursor: (id: string, label: string) => {
      const el = editorRef.current;
      if (!el) return;

      // 若之前焦点在 workflow chip 的 value 区内 → 在该 value 区末尾插入引用芯片
      const wfValue = lastFocusedWfValueRef.current;
      if (wfValue && el.contains(wfValue)) {
        wfValue.focus();
        // 光标落到 value 区末尾
        const sel = window.getSelection();
        if (sel) {
          const r = document.createRange();
          r.selectNodeContents(wfValue);
          r.collapse(false);
          sel.removeAllRanges();
          sel.addRange(r);
          // 如果已有内容，先加个空格
          const hasContent = wfValue.textContent && wfValue.textContent.trim().length > 0;
          if (hasContent) {
            r.insertNode(document.createTextNode(' '));
            r.collapse(false);
          } else {
            // 清除 contenteditable 的占位 <br>，避免芯片前多余换行
            wfValue.innerHTML = '';
            // 重新选择空 value 区末尾
            r.selectNodeContents(wfValue);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
          }
          const chip = buildChipEl(id, label, nodeMetaMap);
          r.insertNode(chip);
          ensureCaretSlotBeforeChip(chip);
          r.setStartAfter(chip);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        }
        emitDOM();
        return;
      }

      el.focus();
      const sel = window.getSelection();
      const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (!range || !el.contains(range.startContainer)) {
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false); // 末尾
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
      insertChipAtCursor(id, label);
    },
  }), [insertChipAtCursor, emitDOM, nodeMetaMap]);

  // ── Insert a workflow IO chip ──
  const insertWorkflowChipAtCursor = useCallback(
    (ioNodeId: string, ioNodeTitle: string, ioNodeType: WorkflowIONodeType) => {
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.startContainer)) {
        range.selectNodeContents(el);
        range.collapse(false);
      }
      const chip = buildWorkflowChipEl(ioNodeId, ioNodeTitle, ioNodeType);
      range.insertNode(chip);
      ensureCaretSlotBeforeChip(chip);
      const valueArea = chip.querySelector('.prompt-chip-wf-value');
      if (valueArea) {
        const textNode = valueArea.firstChild;
        range.setStart(textNode || valueArea, 0);
      } else {
        range.setStartAfter(chip);
      }
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      emitDOM();
    },
    [emitDOM],
  );

  // ── Mention selection handlers ──
  const handleSelectCanvasMention = useCallback(
    (refNodeId: string, refLabel: string) => {
      // Focus the editor FIRST so the selection we restore below
      // survives across the contentEditable boundary (workflow chip value area).
      const el = editorRef.current;
      if (el) el.focus();
      const saved = savedMentionRangeRef.current;
      savedMentionRangeRef.current = null;
      if (saved) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(saved);
        }
      }
      deleteAtChar();
      insertChipAtCursor(refNodeId, refLabel);
      setShowMention(false);
      setMentionQuery('');
    },
    [deleteAtChar, insertChipAtCursor],
  );

  const handleSelectWorkflowMention = useCallback(
    (ioNodeId: string, ioNodeTitle: string, ioNodeType: WorkflowIONodeType) => {
      // Focus the editor FIRST so the selection we restore below
      // survives across the contentEditable boundary (workflow chip value area).
      const el = editorRef.current;
      if (el) el.focus();
      const saved = savedMentionRangeRef.current;
      savedMentionRangeRef.current = null;
      if (saved) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(saved);
        }
      }
      deleteAtChar();
      insertWorkflowChipAtCursor(ioNodeId, ioNodeTitle, ioNodeType);
      setShowMention(false);
      setMentionQuery('');
    },
    [deleteAtChar, insertWorkflowChipAtCursor],
  );

  const insertDramaChipAtCursor = useCallback(
    (dramaId: string, name: string, kind: string, thumbUrl?: string) => {
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.startContainer)) {
        range.selectNodeContents(el);
        range.collapse(false);
      }
      const chip = buildDramaChipEl(dramaId, name, kind, thumbUrl);
      range.insertNode(chip);
      ensureCaretSlotBeforeChip(chip);
      range.setStartAfter(chip);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      emitDOM();
    },
    [emitDOM],
  );

  /** 把光标放回 @ 处，供插入芯片 */
  const restoreMentionCursor = useCallback(() => {
    const el = editorRef.current;
    if (el) el.focus();
    const saved = savedMentionRangeRef.current;
    savedMentionRangeRef.current = null;
    if (!saved) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(saved);
    }
  }, []);

  /** 二级菜单：引用角色的某一张参考图，或把全部参考图拼成一张 */
  const handleSelectDramaReference = useCallback(
    (
      item: { id: string; name: string; kind: string },
      pick: string,
      thumb?: string,
    ) => {
      restoreMentionCursor();
      deleteAtChar();
      insertDramaChipAtCursor(
        buildDramaMentionId(item.id, pick),
        item.name,
        item.kind,
        thumb,
      );
      setShowMention(false);
      setMentionQuery('');
      setDramaRefPickerId(null);
    },
    [restoreMentionCursor, deleteAtChar, insertDramaChipAtCursor],
  );

  const handleSelectDramaMention = useCallback(
    (item: { id: string; name: string; kind: string; imageNodeId?: string; imageUrl?: string }) => {
      // 仅当绑图节点上已有真实图片时，才 @ 图像节点；否则始终 @drama 芯片（解析时展开单条简介）
      if (item.imageNodeId) {
        const imgNode = nodes.find((n) => n.id === item.imageNodeId);
        const hasImage = !!(
          (imgNode?.data?.imageUrl as string | undefined)
          || (imgNode?.data?.thumbnailUrl as string | undefined)
          || item.imageUrl
        );
        if (imgNode && hasImage) {
          handleSelectCanvasMention(item.imageNodeId, item.name);
          return;
        }
      }
      restoreMentionCursor();
      deleteAtChar();
      let thumb: string | undefined;
      if (item.imageNodeId) {
        const n = nodes.find((x) => x.id === item.imageNodeId);
        thumb = bestNodeThumb(n?.data ?? {}) || item.imageUrl;
      } else {
        thumb = item.imageUrl;
      }
      insertDramaChipAtCursor(item.id, item.name, item.kind, thumb);
      setShowMention(false);
      setMentionQuery('');
    },
    [nodes, handleSelectCanvasMention, restoreMentionCursor, deleteAtChar, insertDramaChipAtCursor],
  );

  // ── Input handler: detect @ and / ──
  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    normalizeChipSlots(el); // 删字后行首化的芯片补回光标落点
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node && node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const cursorPos = range.startOffset;
        const before = text.slice(0, cursorPos);
        // 光标前最近的 @… 查询段（不含空格/换行）
        const atIdx = before.lastIndexOf('@');
        const afterAt = atIdx >= 0 ? before.slice(atIdx + 1) : '';
        const inMention =
          atIdx >= 0
          && !afterAt.includes(' ')
          && !afterAt.includes('\n')
          && !afterAt.includes('{'); // 已完成的 @{...} 芯片序列化文本不走菜单
        if (inMention) {
          setMentionQuery(afterAt);
          setShowMention(true);
          const sel2 = window.getSelection();
          if (sel2 && sel2.rangeCount) {
            savedMentionRangeRef.current = sel2.getRangeAt(0).cloneRange();
          }
        } else {
          if (showMention) setShowMention(false);
          if (cursorPos > 0 && text[cursorPos - 1] === '/') {
            onSlashTrigger?.();
          }
        }
      } else if (showMention) {
        // 光标移到了非文本节点（如 chip），关闭菜单
        setShowMention(false);
      }
    }
    emitDOM();
  }, [emitDOM, onSlashTrigger, showMention]);

  // ── KeyDown: mention navigation / submit / chip deletion ──
  const removeMentionTrigger = useCallback((): boolean => {
    /* 官方 `L()`：删掉光标前最近的 `@` 到光标（= tiptap `deleteRange({from,to})`）。
       三级兜底：活动选区 → 保存的 mention 区间 → 编辑器内最后一个 `@`（后面只剩空白）。
       ⚠️ 弹窗打开时键盘焦点常已离开编辑器 ⇒ 活动选区不可用，必须靠后两级。*/
    const editor = editorRef.current;
    if (!editor) return false;
    const editorOwns = (node: Node | null) => Boolean(node && editor.contains(node));
    let target: Range | null = null;
    const liveSelection = window.getSelection();
    if (liveSelection && liveSelection.rangeCount > 0) {
      const live = liveSelection.getRangeAt(0);
      if (editorOwns(live.startContainer)) target = live;
    }
    if (!target) {
      const saved = savedMentionRangeRef.current;
      if (saved && editorOwns(saved.startContainer)) target = saved.cloneRange();
    }
    if (target && target.collapsed && target.startContainer.nodeType === Node.TEXT_NODE) {
      const text = target.startContainer.textContent ?? '';
      const caret = target.startOffset;
      /* ⚠️ 焦点离开编辑器后，活动选区常被重置成 offset=0（或落在 `@` 上）⇒
         直接 `[at, caret)` 会得到**空区间**，`deleteContents()` 什么都不删 ✗（实测 `textAfter` 仍是 `@`）。
         正确口径：在 `[0, caret]` 里找最后一个 `@`；若它就落在光标处，则删这一字符。*/
      const at = text.slice(0, Math.min(caret + 1, text.length)).lastIndexOf('@');
      if (at >= 0) {
        const from = at;
        const to = at === caret ? caret + 1 : caret;
        if (to > from) {
          target.setStart(target.startContainer, from);
          target.setEnd(target.startContainer, to);
          target.deleteContents();
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
          emitDOM();
          return true;
        }
      }
    }
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let lastText: Text | null = null;
    let current: Node | null = walker.nextNode();
    while (current) {
      if ((current.textContent ?? '').includes('@')) lastText = current as Text;
      current = walker.nextNode();
    }
    if (lastText) {
      const content = lastText.textContent ?? '';
      const at = content.lastIndexOf('@');
      if (at >= 0 && !content.slice(at + 1).trim()) {
        const range = document.createRange();
        range.setStart(lastText, at);
        range.setEnd(lastText, at + 1);
        range.deleteContents();
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        return true;
      }
    }
    return false;
  }, [emitDOM]);

  /* 官方 Escape：弹窗打开时**总是**由弹窗消费（关弹窗 + 删 `@` 区间），不落到外层。
     ⚠️ MTV 的 DOM 编辑器在弹窗打开后键盘焦点已不在编辑器上 ⇒ 编辑器 onKeyDown 收不到
        ⇒ 这里再加一层**窗口级**（冒泡阶段）监听；AINodeDialog 的捕获阶段 Escape 已对
          `.mention-dropdown` 做豁免，所以面板不会被误关 ✓ */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!document.querySelector('.mention-dropdown')) return;
      event.preventDefault();
      event.stopPropagation();
      /* 标记「这次关闭是 Escape 触发的」——真正的删除放到下面那条
         `showMention → false` 的状态跃迁里做（见 `escapeRequestedRef` 注释） */
      escapeRequestedRef.current = true;
      removeMentionTrigger();
      setShowMention(false);
    };
    /* ⚠️ 必须挂在 **window 的捕获阶段**：`hooks/useKeyboardShortcuts.ts:376` 在 document 捕获阶段
       挂了 keydown（它会在某些分支里 stopPropagation）⇒ window 捕获早于 document 捕获才抢得到 ✓；
       AINodeDialog 的 window 捕获 Escape 已对 `.mention-dropdown` 豁免（返回早退、不 stop）✓ */
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [removeMentionTrigger]);

  /* 官方 `L()` 的落地位置：**MTV 自己那条关闭弹窗的路径**跑完之后再删 `@`。
     ⚠️ 直接在 Escape 处理里删会被 MTV 的关闭路径覆盖回去（同一个 keydown 里它还会 emit 一次 prompt，
        实测 `@` 又出现 ✗）。这里监听 `showMention` 由 true → false 的跃迁（React 提交后执行），
        再用 `setTimeout(0)` 抢到最后一次写入 ⇒ 官方语义「关弹窗 + 删触发字符」成立 ✓
     仅当是 Escape 触发（`escapeRequestedRef`）才删 —— 选中候选时也会 `showMention=false`，那时不能删 ✗ */
  useEffect(() => {
    if (showMention || !escapeRequestedRef.current) return;
    escapeRequestedRef.current = false;
    const timer = window.setTimeout(() => {
      removeMentionTrigger();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showMention, removeMentionTrigger]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // 输入法组合中：回车/方向键属于候选框，不该触发提交或 @ 选中
      if (e.nativeEvent.isComposing) return;
      // 方向键导航前先补好行首芯片的光标落点（ZWSP），否则光标跳不到芯片前
      if (e.key.startsWith('Arrow') && editorRef.current) normalizeChipSlots(editorRef.current);
      // @ mention: Enter → select first match
      if (showMention && e.key === 'Enter' && !e.shiftKey) {
        /* 官方：先 `stopPropagation()`，再选中候选 ⇒ 弹窗打开时 Enter **不会**提交到外层 */
        e.preventDefault();
        e.stopPropagation();
        selectFirstMentionRef.current?.();
        return;
      }
      /* 官方（editor @580105 suggestion 插件 onKeyDown，逐字）：
         · `ArrowUp/Down` **总是吞掉**（连候选为 0 条时也 return true）⇒ 光标不能跑掉
         · `Escape` → 先给拦截器，否则**关闭并删除 `@` 区间**（官方 `L`：`deleteRange({from,to})`）
         MTV 原来：方向键不吞（光标会移动、弹窗失焦）、Escape 只关闭不删 `@` ✗ */
      /* 弹窗是否真的开着：`showMention` 可能已被别的处理器提前置 false（关闭路径不止一条），
         所以同时看 DOM（`.mention-dropdown`）——官方 Escape 语义是「关弹窗 **且** 删掉 `@` 区间」 */
      const mentionPickerOpen = showMention || Boolean(document.querySelector('.mention-dropdown'));
      if (mentionPickerOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (mentionPickerOpen && e.key === 'Escape') {
        /* ⚠️ 必须 `stopPropagation()`：MTV 的节点面板在 **document 级**监听 Escape 关面板 ⇒
           不拦住的话弹窗虽然关了，但整个 composer 面板也一起被关掉 ✗（官方 Escape 只作用于弹窗） */
        e.preventDefault();
        e.stopPropagation();
        /* 删除从光标前最近的 `@` 到光标的文本（= 官方 `L()`：`deleteRange({from,to})`）
           ⚠️ 真键盘路径下弹窗一开，**选区常常已经不在编辑器里**（focus 跑到弹窗/被保存起来）
           ⇒ 必须按「活动选区 → 保存的 mention 区间 → 编辑器内最后一个 `@`」三级兜底，
             否则 `range.collapsed / nodeType` 一判就退出，`@` 删不掉 ✗（实测踩过）。*/
        const editor = editorRef.current;
        const editorOwns = (node: Node | null) => Boolean(editor && node && editor.contains(node));
        let target: Range | null = null;
        const liveSelection = window.getSelection();
        if (liveSelection && liveSelection.rangeCount > 0) {
          const live = liveSelection.getRangeAt(0);
          if (editorOwns(live.startContainer)) target = live;
        }
        if (!target) {
          const saved = savedMentionRangeRef.current;
          if (saved && editorOwns(saved.startContainer)) target = saved.cloneRange();
        }
        let removed = false;
        if (target && target.collapsed && target.startContainer.nodeType === Node.TEXT_NODE) {
          const text = target.startContainer.textContent ?? '';
          const at = text.lastIndexOf('@', Math.max(0, target.startOffset - 1));
          if (at >= 0) {
            target.setStart(target.startContainer, at);
            target.setEnd(target.startContainer, target.startOffset);
            target.deleteContents();
            removed = true;
          }
        }
        if (!removed && editor) {
          /* 兜底：编辑器内最后一个 `@`，且其后只剩空白（= 正在查询的那个触发符） */
          const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
          let lastText: Text | null = null;
          let current: Node | null = walker.nextNode();
          while (current) {
            if ((current.textContent ?? '').includes('@')) lastText = current as Text;
            current = walker.nextNode();
          }
          if (lastText) {
            const content = lastText.textContent ?? '';
            const at = content.lastIndexOf('@');
            if (at >= 0 && !content.slice(at + 1).trim()) {
              const range = document.createRange();
              range.setStart(lastText, at);
              range.setEnd(lastText, at + 1);
              range.deleteContents();
              removed = true;
            }
          }
        }
        if (removed && editor) {
          /* 走 MTV 自己的输入管线（`handleInput` → normalizeChipSlots + onChange）。
             ⚠️ 直接调 `emitDOM()` 实测会被“DOM→store→DOM”同步打回（`@` 又出现）✗；
                派发 `input` 事件才与用户输入同一条路径 ✓（t323 实测）。*/
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        }
        setShowMention(false);
        return;
      }
      // Submit on Enter (no shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = editorRef.current ? serializeDOM(editorRef.current) : '';
        if (canSubmit && text.trim() && onSubmit) onSubmit();
        return;
      }
      // Newline on Shift+Enter —— 手动插入单个 <br>，避免浏览器在芯片旁默认插入两个 <br>（换两行）
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();

        // 特例：光标正贴在某芯片前面 —— 把 <br> 插到「芯片(及其单个 ZWSP 落点)」之前，
        // 不分裂落点、不产生双停顿，光标停在芯片前。
        const sc = range.startContainer;
        const so = range.startOffset;
        let chipAfter: HTMLElement | null = null;
        if (sc.nodeType === Node.TEXT_NODE && so === (sc.textContent?.length ?? 0) && isChipEl(sc.nextSibling)) {
          chipAfter = sc.nextSibling as HTMLElement;
        } else if (sc.nodeType === Node.ELEMENT_NODE && isChipEl(sc.childNodes[so])) {
          chipAfter = sc.childNodes[so] as HTMLElement;
        }
        if (chipAfter) {
          const parent = chipAfter.parentNode!;
          let slot = chipAfter.previousSibling as Text | null;
          const zwspOnly = !!slot && slot.nodeType === Node.TEXT_NODE && (slot.textContent === '' || slot.textContent === ZWSP);
          if (!zwspOnly) {
            slot = document.createTextNode(ZWSP);
            parent.insertBefore(slot, chipAfter);
          } else if (!slot!.textContent) {
            slot!.textContent = ZWSP;
          }
          parent.insertBefore(document.createElement('br'), slot!); // <br> 在落点之前
          range.setStart(slot!, (slot!.textContent || '').length);   // 光标落到芯片前
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          emitDOM();
          return;
        }

        const br = document.createElement('br');
        range.insertNode(br);
        const next = br.nextSibling;
        if (!next) {
          // 位于末尾：补一个占位 <br>，让新空行可见，光标落在新行
          const filler = document.createElement('br');
          br.parentNode?.insertBefore(filler, null);
          range.setStartBefore(filler);
        } else {
          range.setStartAfter(br);
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        emitDOM();
        return;
      }
      // Delete chip on Backspace
      if (e.key === 'Backspace') {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return;
        const node = range.startContainer;
        const offset = range.startOffset;
        // 行首芯片前（光标在其 ZWSP 落点里）退格 → 删掉上面的换行 <br> 合并到上一行，而不是卡在 ZWSP
        if (node && node.nodeType === Node.TEXT_NODE && isChipEl(node.nextSibling) && isBrEl(node.previousSibling)) {
          e.preventDefault();
          (node.previousSibling as ChildNode).remove();
          emitDOM();
          return;
        }
        if (node && node.nodeType === Node.TEXT_NODE && offset === 0) {
          const valueArea = node.parentElement;
          if (valueArea?.classList.contains('prompt-chip-wf-value')) {
            const chipEl = valueArea.closest('[data-wf-id]');
            if (chipEl) {
              e.preventDefault();
              chipEl.remove();
              emitDOM();
              return;
            }
          }
        }
        // 光标在文本节点开头：删除其前一个兄弟若为芯片
        if (node && node.nodeType === Node.TEXT_NODE && offset === 0 && isChipEl(node.previousSibling)) {
          e.preventDefault();
          (node.previousSibling as HTMLElement).remove();
          emitDOM();
          return;
        }
        // 光标在元素层级（编辑器根 / 行尾，container 为元素）：删除光标前一个子节点若为芯片。
        // 末尾芯片时 container 是编辑器、offset=子节点数，前一个节点是 childNodes[offset-1]（而非 previousSibling）。
        if (node && node.nodeType === Node.ELEMENT_NODE && offset > 0 && isChipEl(node.childNodes[offset - 1])) {
          e.preventDefault();
          (node.childNodes[offset - 1] as HTMLElement).remove();
          emitDOM();
          return;
        }
      }
      // Delete chip on Delete
      if (e.key === 'Delete') {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return;
        const node = range.startContainer;
        if (node && node.nodeType === Node.TEXT_NODE) {
          const textLen = (node.textContent || '').length;
          if (range.startOffset === textLen) {
            const next = node.nextSibling;
            if (next && next.nodeType === Node.ELEMENT_NODE) {
              const nextEl = next as HTMLElement;
              if (nextEl.hasAttribute('data-ref-id') || nextEl.hasAttribute('data-wf-id') || nextEl.hasAttribute('data-skill-id')) {
                e.preventDefault();
                next.remove();
                emitDOM();
                return;
              }
            }
          }
        }
      }
    },
    [
      showMention,
      canSubmit,
      onSubmit,
      emitDOM,
    ],
  );

  // ── Paste: plain text only ──
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const plain = e.clipboardData.getData('text/plain');
      /* ★ 官方会**二次排版**（用户：「同样的提示词粘贴进去，官方会进行二次排版，MTV 并没有」）——
         出处：官方 `TiptapInput`（`use-waveform-data-DMduQqB-.js` @596374）把 `parseOptions` 设成
           `preservePlainTextPaste ? { preserveWhitespace: true } : undefined`
         即**默认关闭 `preserveWhitespace`** ⇒ 走 ProseMirror 的默认纯文本解析：
         连续换行整体当**一个**段落分隔、空串丢弃、行内空白折叠。
         MTV 原来把 `plain` **原文照插**（`insertNode(createTextNode(plain))`），而 `.prompt-editor`
         是 `white-space: pre-wrap` ⇒ 粘进来的空行原样保留 ✗（截图里那段就成了带空行的样子）。
         这里按同一口径归一：CRLF→LF、连续换行并成一个、行内空白折叠、去掉空行。 */
      const normalized = normalizePlainPromptText(plain);
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(normalized));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      emitDOM();
    },
    [emitDOM],
  );

  // ── 芯片 hover：① 发布节点 id 联动参考图条高亮；② 弹官方那张悬浮预览卡（`eme`） ──
  const lastHoverIdRef = useRef<string | null>(null);
  const { card: chipHoverCard, openFor: openChipHoverCard, scheduleClose: scheduleChipHoverClose } = useReferenceHoverCard();
  const handleEditorMouseOver = useCallback((e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest?.('[data-ref-id]') as HTMLElement | null;
    const id = el?.getAttribute('data-ref-id') ?? null;
    if (id === lastHoverIdRef.current) return; // 同一芯片，跳过避免抖动
    lastHoverIdRef.current = id;
    useAppStore.getState().setHoveredMentionNodeId(id);
    if (el && id) {
      /* 官方 `tme` 外面也包了 `eme`：hover 300ms 在上方弹 100px 预览卡 + `@标签`。
         ⚠️ MTV 原来弹的是自造的 `chip-name-tip` 小气泡 ✗ ⇒ 换成官方预览卡。
         ⚠️⚠️ 预览卡的**类型必须与芯片自身的 kind 一致**：官方 `Zj` 是按芯片的 `type` 分档的
            （video→视频卡 / audio→音频卡 / text→文本卡 / 其余→图片卡），而芯片的 kind 就是芯片上的
            `mention-<type>` 类（kit `renderHTML`：`class = ['mention', type && 'mention-'+type]`）
            ⇒ 这里**从芯片自己的类反推**，不再从节点数据另判（否则灰底文本芯片会弹出一张图片卡 ✗）。 */
      const label = el.getAttribute('data-ref-label') || '节点';
      const node = useAppStore.getState().nodes.find((item) => item.id === id);
      const data = (node?.data ?? {}) as Record<string, unknown>;
      const thumb = (data.thumbnailUrl as string | undefined) || (data.imageUrl as string | undefined);
      /* 预览档 = 官方 `Zj`（@370174 逐字）的分支：
           `type === 'video'` → 视频卡 · `'audio'` → 音频卡 · `'text'` → 文本卡（**唯一带底部 `@标签` 条的**）
           · **其余一律走默认那支 = 图片卡**（`p6`：只有 `<img h-[100px] w-auto>`，没有文案条）。
         ⇒ 芯片建的时候就把这一档写在 `data-preview-kind` 上（见 `buildChipEl`），这里优先读它；
           （老 DOM / 历史芯片没有该属性时，退回按类名判：只有 `mention-text` 且不是附件档才走文本卡。） */
      const previewKind = el.getAttribute('data-preview-kind');
      const chipKind = previewKind === 'video' || previewKind === 'audio' || previewKind === 'text'
        ? previewKind
        : el.classList.contains('mention-video') ? 'video'
        : 'image';
      openChipHoverCard(el, {
        title: label,
        kind: chipKind,
        url: chipKind === 'video'
          ? ((data.videoUrl as string | undefined) || thumb)
          : chipKind === 'audio'
            ? (data.audioUrl as string | undefined)
            : thumb,
        text: typeof data.output === 'string' ? data.output : undefined,
      });
    } else {
      scheduleChipHoverClose();
    }
  }, [openChipHoverCard, scheduleChipHoverClose]);
  const handleEditorMouseLeave = useCallback(() => {
    lastHoverIdRef.current = null;
    useAppStore.getState().setHoveredMentionNodeId(null);
    scheduleChipHoverClose();
  }, [scheduleChipHoverClose]);
  // 卸载时清除，避免残留 hover 高亮
  useEffect(() => () => { useAppStore.getState().setHoveredMentionNodeId(null); }, []);

  // ── @ 面板数据：输入图（画布节点） / 资产库（短剧资产） / ComfyUI 节点（工作流 IO） ──
  const dramaThumbOf = useCallback((item: { imageNodeId?: string; imageUrl?: string }) => {
    if (!item.imageNodeId) return item.imageUrl;
    const n = nodes.find((x) => x.id === item.imageNodeId);
    return bestNodeThumb(n?.data ?? {}) || item.imageUrl;
  }, [nodes]);

  const nodeTabItems: MentionPickerItem[] = [
    ...filteredCanvasMentions.map((node) => ({
      key: `node:${node.id}`,
      label: node.label,
      thumbnailUrl: node.thumbnailUrl,
      icon: MEDIA_ICONS[node.outputType],
      /* ⚠️ 这里**不再**给 `#displayId`：官方行尾的 `#N` 是「**在已连接列表里的位次**」
         （`zoom-slider` @277750 `se = new Map(linked.map((v,i)=>[v.id,i+1]))` + @294095 行尾 `#{rt}`），
         由 `MentionPicker` 用行位次渲染；节点自己的展示编号（`#13` 之类）跟这个号毫无关系 ✗
         （用户：「输入序号快选 的序号 也不对」） */
      badge: node.isSelf ? '自身' : undefined,
      onSelect: () => handleSelectCanvasMention(node.id, node.label),
    })),
  ];
  const workflowTabItems: MentionPickerItem[] = filteredWorkflowMentions.map((node) => ({
    key: `wf:${node.id}`,
    label: node.label,
    icon: MEDIA_ICONS[node._ioType === 'image' || node._ioType === 'video' || node._ioType === 'audio' ? node._ioType : 'text'],
    badge: '工作流',
    onSelect: () => handleSelectWorkflowMention(node._ioNodeId, node.label, node._ioType),
  }));

  const drillItem = !isAudioNode && dramaRefPickerId
    ? dramaMentionItems.find((item) => item.id === dramaRefPickerId)
    : undefined;
  const drillRefs: CharacterReferenceImage[] = (drillItem?.referenceImages ?? [])
    .filter((reference) => !!reference.imageUrl);
  const drillCharacter = dramaAssets.characters.find((character) => character.id === drillItem?.id);
  const drillActions = drillCharacter?.actions ?? [];
  const drillAction = drillActions.find((action) => action.id === dramaActionId);

  const dramaKindChips: MentionPickerChip[] = (() => {
    if (drillItem) return [];
    const counts = new Map<string, number>();
    for (const item of dramaMentionItems) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    if (counts.size === 0) return [];
    return [
      { id: 'all', label: '全部', count: dramaMentionItems.length },
      ...[...counts].map(([kind, count]) => ({ id: kind, label: DRAMA_KIND_LABELS[kind] ?? kind, count })),
    ];
  })();

  const assetTabItems: MentionPickerItem[] = drillItem && drillCharacter && isVideoNode && dramaVoicePicker
    ? (drillCharacter.voiceClips ?? []).map((clip) => ({
      key: `drama-voice:${clip.id}`,
      audioPreviewUrl: resolveDramaVoiceRef(drillCharacter, clip.id)?.url,
      label: clip.label?.trim() || '角色声音',
      icon: MEDIA_ICONS.audio,
      disabled: !resolveDramaVoiceRef(drillCharacter, clip.id),
      onSelect: () => {
        const voice = resolveDramaVoiceRef(drillCharacter, clip.id);
        if (!voice) return;
        restoreMentionCursor();
        deleteAtChar();
        insertDramaChipAtCursor(buildDramaVoiceMentionId(drillCharacter.id, clip.id), voice.label, 'voice');
        setShowMention(false);
        setMentionQuery('');
      },
    }))
    : drillItem && dramaActionPicker
    ? drillAction && drillCharacter
      ? (drillAction.media ?? []).map((media) => ({
        key: `drama-action-media:${media.id}`,
        label: media.name,
        thumbnailUrl: media.kind === 'video' ? undefined : media.url,
        icon: media.kind === 'video' ? 'lucide:film' : 'mdi:image-outline',
        badge: media.kind === 'video' ? '视频' : media.kind === 'gif' ? 'GIF' : '图片',
        disabled: !resolveDramaActionMediaRef(drillCharacter, drillAction.id, media.id),
        onSelect: () => {
          const selected = resolveDramaActionMediaRef(drillCharacter, drillAction.id, media.id);
          if (!selected) return;
          restoreMentionCursor();
          deleteAtChar();
          insertDramaChipAtCursor(
            buildDramaActionMentionId(drillCharacter.id, drillAction.id, media.id),
            selected.label,
            media.kind === 'video' ? 'action-video' : 'action-image',
            media.kind === 'video' ? undefined : selected.url,
          );
          setShowMention(false);
          setMentionQuery('');
        },
      }))
      : drillActions.map((action) => ({
        key: `drama-action:${action.id}`,
        label: action.name,
        thumbnailUrl: action.media?.find((media) => media.kind !== 'video' && media.url)?.url,
        icon: 'lucide:accessibility',
        badge: `${action.media?.length ?? 0} 素材`,
        onSelect: () => setDramaActionId(action.id),
      }))
    : drillItem ? [
      ...(drillRefs.length > 1 ? [{
        key: 'drama-merge-all',
        label: '全部拼成一张',
        icon: 'lucide:layout-grid',
        badge: `${drillRefs.length} 图`,
        onSelect: () => handleSelectDramaReference(drillItem, DRAMA_MENTION_MERGE_ALL, drillRefs[0]?.imageUrl),
      }] : []),
      ...drillRefs.map((reference) => ({
        key: `drama-ref:${reference.id}`,
        label: CHARACTER_REFERENCE_KIND_LABELS[reference.kind],
        thumbnailUrl: reference.imageUrl,
        onSelect: () => handleSelectDramaReference(drillItem, reference.id, reference.imageUrl),
      })),
      ...(drillRefs.length === 0 ? [{
        key: 'drama-brief', label: dramaThumbOf(drillItem) ? '主视觉' : '角色简介', icon: 'lucide:text',
        thumbnailUrl: dramaThumbOf(drillItem),
        disabled: drillItem.kind === 'character' && !dramaThumbOf(drillItem),
        onSelect: () => handleSelectDramaMention(drillItem),
      }] : []),
    ]
    : dramaMentionItems
      .filter((item) => dramaKind === 'all' || item.kind === dramaKind)
      .map((item) => {
        const references = (item.referenceImages ?? []).filter((reference) => !!reference.imageUrl);
        const multiRef = references.length > 1;
        const character = item.kind === 'character'
          ? dramaAssets.characters.find((candidate) => candidate.id === item.id)
          : undefined;
        const hasActions = !!character?.actions?.length;
        const avatarReference = character?.referenceImages?.find((reference) => reference.id === character.avatarReferenceImageId)
          ?? character?.referenceImages?.find((reference) => reference.id === character.primaryReferenceImageId)
          ?? character?.referenceImages?.[0];
        const avatarCrop = avatarReference?.imageUrl && avatarReference.id === character?.avatarReferenceImageId
          ? character?.avatarCrop
          : undefined;
        const thumb = dramaThumbOf(item) || references[0]?.imageUrl;
        const hasUsableAction = character?.actions?.some((action) =>
          action.media?.some((media) => !!resolveDramaActionMediaRef(character, action.id, media.id)),
        );
        const hasUsableVoice = isVideoNode && character?.voiceClips?.some((clip) =>
          !!resolveDramaVoiceRef(character, clip.id),
        );
        const emptyCharacter = !!character && !isAudioNode && !thumb && !hasUsableAction && !hasUsableVoice;
        return {
          key: `drama:${item.id}`,
          label: item.name,
          thumbnailUrl: avatarReference?.imageUrl || thumb,
          thumbnailCrop: avatarCrop,
          disabled: emptyCharacter,
          title: emptyCharacter ? '该角色暂无可引用的素材' : undefined,
          icon: isAudioNode ? MEDIA_ICONS.audio : 'mdi:account-box-outline',
          badge: isAudioNode ? '音频' : multiRef ? `${references.length} 图` : thumb ? undefined : '简介',
          onSelect: () => {
            if (emptyCharacter) return;
            if (isAudioNode) {
              if (!item.voice) return;
              restoreMentionCursor();
              deleteAtChar();
              insertDramaChipAtCursor(buildDramaVoiceMentionId(item.id, item.voice.id), item.voice.label, 'voice');
              setShowMention(false);
              setMentionQuery('');
              return;
            }
            // 单图或无图但有动作、视频可用声音的角色也能进入素材选择。
            if (multiRef || hasActions || (isVideoNode && character?.voiceClips?.length)) {
              setDramaRefPickerId(item.id);
              setDramaVoicePicker(false);
              setDramaActionPicker(false);
              setDramaActionId(null);
            } else handleSelectDramaMention(item);
          },
        };
      });

  // 首次打开优先展示有内容的分类；手动切换后保留选择，工作流取消时回到普通分类。
  const defaultTab = nodeTabItems.length > 0 ? 'nodes'
    : selectedWorkflow && workflowTabItems.length > 0 ? 'workflow'
      : assetTabItems.length > 0 ? 'assets' : 'nodes';
  const effectiveTab = drillItem ? 'assets'
    : pickerTab === 'workflow' && !selectedWorkflow ? defaultTab
      : pickerTab ?? defaultTab;
  const activeTabItems = effectiveTab === 'assets' ? assetTabItems
    : effectiveTab === 'workflow' ? workflowTabItems : nodeTabItems;

  /* 官方 `ffe` 的分组口径：来源 = **分组**（不是 Tab）。这里把各来源按官方顺序组装成组列表：
       已连接节点（linked） → 个人素材库（assets，含下钻） → 应用（plugin）
     下钻态（`drillItem`）只显示当前那一组（组标题 = 该角色/素材名）✓
     ⚠️ 分组标题用**官方 zh-CN 文案**（`index-BiTZf8mJ.js` @9128275 的 `omniReference.suggestion.*`）：
        linkedNodeSection「已连接节点」(+ hint「输入序号快选」) / **privateSection「个人素材库」** / pluginSection「应用」
        —— MTV 旧文案（输入图 / 资产库 / ComfyUI 节点）是自造 ✗
     ⚠️ 素材库段的键**不是** `myLibrarySection`「我的素材库」：官方 `Ub` 在该位置渲染的是
        `privateSection`「个人素材库」/ `teamSection`「团队素材库」（规格书 §4 注）⇒ 旧实现误用 key，已改。
     ⚠️ **同一份 MTV 短剧资产数据、同一个官方键**：聊天输入卡的 `@` 面板（`components/chat/ChatInput.tsx`
        的 `dramaMentionItems` / `mentionGroups`）用的也是 `MENTION_PRIVATE_SECTION`，**两处必须一致**，
        改一处就要改两处（否则同一数据两个标题 = 新的不一致）。
     ⚠️ linked 段的标题：聊天侧已确证官方宿主传 `chatAdapter.context.addReference`「添加参考」；
        节点提示词侧对应的官方宿主**未取证** ⇒ 这里先维持「已连接节点」，不盲改（登记待取证）。 */
  const mentionGroups = (() => {
    const next: { id: string; label: string; hint?: string; items: typeof nodeTabItems }[] = [];
    if (drillItem) {
      if (assetTabItems.length > 0) next.push({ id: 'assets', label: drillItem.name, items: assetTabItems });
      return next;
    }
    if (nodeTabItems.length > 0) {
      next.push({ id: 'nodes', label: MENTION_LINKED_SECTION, hint: MENTION_LINKED_HINT, items: nodeTabItems });
    }
    if (assetTabItems.length > 0) next.push({ id: 'assets', label: MENTION_PRIVATE_SECTION, items: assetTabItems });
    if (selectedWorkflow && workflowTabItems.length > 0) {
      next.push({ id: 'workflow', label: MENTION_PLUGIN_SECTION, items: workflowTabItems });
    }
    return next;
  })();

  /* 键盘/回车作用在**拍平后的可见条目**上（官方 `selectables` 也是全局拍平；每组只取前 3 条） */
  const flatMentionItems = mentionGroups.flatMap((group) => group.items.slice(0, 3));

  // 回车与鼠标始终选当前页面中的条目，包括动作及素材下钻页。
  useLayoutEffect(() => {
    selectFirstMentionRef.current = (flatMentionItems.length > 0 ? flatMentionItems : activeTabItems)
      .find((item) => !item.disabled)?.onSelect ?? null;
  });

  const updateMentionDropdownPosition = useCallback(() => {
    const dropdown = mentionDropdownRef.current;
    if (!dropdown) return;

    /* ══ 官方 tippy（`use-waveform-data` kit @588054 的 mention 渲染）══
         d = In(appendTo, {
           getReferenceClientRect: N(F),        // 默认 = `F.clientRect` = **suggestion 区间（@…光标）的矩形**
           placement: "bottom-start",           // 下方、左边缘对齐
           sticky: true, interactive: true, trigger: "manual",
           popperOptions: { modifiers: [ preventOverflow(boundary: viewport, padding: 8),
                                         flip(fallbackPlacements: ["top-start","bottom-start"]) ] },
         })
       ⚠️ 参考矩形是 **`@` 到光标那一段**（不是光标点）：MTV 原来拿光标 rect ⇒ 弹窗左边缘比官方
          多出一个 `@` 字符的宽度（用户：「左侧间距也不对」）⇒ 这里把区间起点退到 `@`。 */
    const savedRange = savedMentionRangeRef.current;
    let anchorRect: { left: number; top: number; bottom: number } | null = null;
    if (savedRange) {
      const range = savedRange.cloneRange();
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        range.setStart(range.startContainer, Math.max(0, range.startOffset - (mentionQuery.length + 1)));
      }
      const box = range.getBoundingClientRect();
      if (box && (box.width || box.height)) {
        anchorRect = { left: box.left, top: box.top, bottom: box.bottom };
      }
    }
    if (!anchorRect) {
      const editor = editorRef.current;
      if (!editor) return;
      const box = editor.getBoundingClientRect();
      anchorRect = { left: box.left, top: box.top, bottom: box.bottom };
    }
    const safePosition = calcAnchoredPosition(
      anchorRect,
      dropdown.offsetWidth,
      dropdown.offsetHeight,
      8,
      /* 官方 `preventOverflow` 的 padding = 8 */
      8,
      /* 官方 tippy `placement:"bottom-start"`（优先在区间**下方**，左边缘对齐） */
      'below',
    );
    /* Portal 到 body ⇒ 用 fixed 坐标（不再换算成 wrap 内的偏移） */
    const nextPosition = { left: Math.round(safePosition.left), top: Math.round(safePosition.top) };
    setMentionDropdownPosition((current) => (
      current.left === nextPosition.left && current.top === nextPosition.top ? current : nextPosition
    ));
  }, [mentionQuery]);

  useLayoutEffect(() => {
    if (!showMention) {
      setMentionDropdownPosition({ left: 12, top: 0 });
      return undefined;
    }

    const dropdown = mentionDropdownRef.current;
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateMentionDropdownPosition);
    if (dropdown) resizeObserver?.observe(dropdown);

    updateMentionDropdownPosition();
    window.addEventListener('resize', updateMentionDropdownPosition);
    window.addEventListener('scroll', updateMentionDropdownPosition, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateMentionDropdownPosition);
      window.removeEventListener('scroll', updateMentionDropdownPosition, true);
    };
  }, [
    assetTabItems.length,
    dramaKindChips.length,
    drillItem?.id,
    effectiveTab,
    mentionQuery,
    nodeTabItems.length,
    showMention,
    updateMentionDropdownPosition,
  ]);

  return (
    <div ref={mentionEditorWrapRef} className={`mention-editor-wrap relative ${className}`}>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={`prompt-editor${!prompt ? ' is-empty' : ''}`}
        data-placeholder={placeholder}
        /* ★ 用户：「官方没有这个滑条 MTV 移除掉」。
           ⚠️ 关键：MTV 的滑条**不是原生滚动条**，是全局 `OverlayScrollbarLayer`（`RootView` 里挂的）
           扫到可滚动元素后**自绘**的那条 4px `#3a3a50` 拇指 —— 所以 `::-webkit-scrollbar{display:none}`
           对它无效（用户第一轮就没看到效果）。
           官方的 opt-out 是 `data-overlay-scrollbar="off"`
           （见 `OverlayScrollbarLayer.tsx` 的 `DISCOVERY_EXCLUSION_SELECTOR`）。 */
        data-overlay-scrollbar="off"
        /* ⚠️ 拼写检查的红色波浪线**按用户要求不做**（2026）。
           踩过的坑留个记录，免得以后又有人从头查一遍：WebView2 里要出波浪线得**五环齐全** ——
             ① 编辑器 `spellCheck` 不为 false
             ② 编辑器 `lang` 指到一个**有 hunspell 词典**的语言（中文没有 ⇒ 必须 en）
             ③ `EBWebView\Dictionaries\en-US-10-1.bdic`（Chromium 认 `<lang>-<版本>-<修订>.bdic`
                这个名字，`en-US.bdic` 会被直接忽略）
             ④ `--enable-features=WinUseBrowserSpellChecker`（Windows 上 Chromium 默认走系统拼写
                检查器，不开这个根本不看 hunspell 词典）
             ⑤ profile `Preferences` 的 `spellcheck.dictionaries` 里要有 `["en-US"]`
                —— **这条才是真正的开关**：WebView2 没有设置界面，列表一直是空的，
                Chromium 对空列表一律不检查，前四条全都无从生效。
           官方 TapNow 是 Electron，自己会注册（它的 `%APPDATA%\@tap\desktop\Dictionaries\
           en-US-10-1.bdic` 就是被登记过的那本）。
           ⇒ 现在显式关掉，保证任何环境下都不出线。 */
        spellCheck={false}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onMouseOver={handleEditorMouseOver}
        onMouseLeave={handleEditorMouseLeave}
        onFocus={() => {
          if (editorRef.current) normalizeChipSlots(editorRef.current); // 聚焦即修复历史无落点芯片
          onFocus?.();
        }}
        onBlur={() => {
          onBlur?.();
          emitDOM();
        }}
      />

      {/* 提及芯片的悬浮预览卡（官方 `eme`，与参考图条**同一份**实现） */}
      {chipHoverCard}

      {/* @ Mention Dropdown —— 官方 tippy `appendTo: document.body`（kit @588054 的 `In(B, {appendTo: B})`，
          B 默认 `document.body`）⇒ **Portal 到 body**，否则会被卡片的 `overflow:hidden` 裁掉（用户：「被遮挡」）。
          位置用 fixed（见 updateMentionDropdownPosition）。 */}
      {showMention && createPortal(
        <div
          ref={mentionDropdownRef}
          /* ⚠️ 官方弹窗面板尺寸由 `ffe` 自己决定（`w-[320px]` / `max-h-[320px]`，见 mention-picker.css）
             ⇒ 外层**不要**再写宽度/最大高度覆盖它 */
          className="mention-dropdown fixed z-[9999] max-w-[calc(100vw-24px)]"
          style={{ left: mentionDropdownPosition.left, top: mentionDropdownPosition.top }}
        >
          <MentionPicker
            ariaLabel="引用节点或资产"
            /* ★ 官方 `ffe` 是「一个滚动列表 + 多分组」（linked / assets / elements…），**没有 Tab/芯片行** ✗
               ⇒ composer 改走 `groups` 通道：把三个来源各作为一组传进去，
                 `tabs/chips` 仍保留在 props 里（其它调用方如聊天输入框还在用旧路径）。 */
            groups={mentionGroups}
            tabs={[
              { id: 'nodes', label: isAudioNode ? '输入音频' : '输入图', icon: isAudioNode ? MEDIA_ICONS.audio : 'mdi:image-multiple-outline' },
              { id: 'assets', label: '资产库', icon: 'mdi:bookshelf' },
              ...(selectedWorkflow ? [{ id: 'workflow', label: 'ComfyUI 节点' }] : []),
            ]}
            activeTab={effectiveTab}
            onTabChange={(id) => {
              setPickerTab(id as 'nodes' | 'assets' | 'workflow');
              setDramaRefPickerId(null);
              setDramaActionPicker(false);
              setDramaActionId(null);
            }}
            chips={effectiveTab === 'assets' ? dramaKindChips : undefined}
            activeChip={dramaKind}
            onChipChange={setDramaKind}
            leading={effectiveTab === 'assets' && drillItem ? (
              <>
                <button
                  type="button"
                  className="mention-picker-chip"
                  aria-label={dramaActionPicker || dramaVoicePicker ? '返回角色参考图' : '返回资产列表'}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (dramaActionPicker || dramaVoicePicker) {
                      setDramaVoicePicker(false);
                      setDramaActionPicker(false);
                      setDramaActionId(null);
                    } else setDramaRefPickerId(null);
                  }}
                >
                  <Icon icon="lucide:chevron-left" width="12" height="12" />
                  {drillItem.name}
                </button>
                {drillCharacter && (
                  <button
                    type="button"
                    className={`mention-picker-chip${dramaActionPicker ? ' active' : ''}`}
                    aria-pressed={dramaActionPicker}
                    onMouseDown={(e) => { e.preventDefault(); setDramaVoicePicker(false); setDramaActionPicker(true); setDramaActionId(null); }}
                  >
                    <Icon icon="lucide:accessibility" width="12" height="12" />
                    动作
                    <span className="mention-picker-chip-count">{drillActions.length}</span>
                  </button>
                )}
                {drillCharacter && isVideoNode && (
                  <button
                    type="button"
                    className={`mention-picker-chip${dramaVoicePicker ? ' active' : ''}`}
                    aria-pressed={dramaVoicePicker}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDramaVoicePicker(true);
                      setDramaActionPicker(false);
                      setDramaActionId(null);
                    }}
                  >
                    <Icon icon={MEDIA_ICONS.audio} width="12" height="12" />
                    声音
                    <span className="mention-picker-chip-count">{drillCharacter.voiceClips?.length ?? 0}</span>
                  </button>
                )}
                {dramaActionPicker && drillAction && (
                  <button type="button" className="mention-picker-chip" aria-label="返回动作列表"
                    onMouseDown={(e) => { e.preventDefault(); setDramaActionId(null); }}>
                    <Icon icon="lucide:chevron-left" width="12" height="12" />
                    {drillAction.name}
                  </button>
                )}
              </>
            ) : undefined}
            items={activeTabItems}
            mediaAspectRatio={effectiveTab === 'assets' ? AVATAR_ASPECT : undefined}
            emptyText={effectiveTab === 'assets' && drillItem && dramaVoicePicker
              ? '该角色暂无声音，请先在角色库中添加'
              : effectiveTab === 'assets' && drillItem && dramaActionPicker
              ? drillAction ? '该动作暂无图片、GIF 或视频素材' : '该角色暂无动作，请先在角色库中添加'
              : mentionQuery ? '无匹配节点或资产' : effectiveTab === 'workflow' ? '当前工作流暂无可引用的节点' : effectiveTab === 'assets' ? isAudioNode ? '暂无带音频的角色，请先在角色库中添加音频' : '暂无短剧资产' : '暂无可引用的输入'}
            /* ⚠️ 官方 `ffe` 没有「引用资产 / 全局资产」这一行（MTV 自造）⇒ 已删除 footer */
          />
        </div>,
        document.body,
      )}

    </div>
  );
});

export default MentionEditor;
