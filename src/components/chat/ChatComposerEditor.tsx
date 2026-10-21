/**
 * 对话输入的可编辑文本层，维护节点、模型和 Skill 引用令牌并向外暴露插入与聚焦 API。
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { useT, getLocale } from '../../i18n';
import { buildChipEl, getNodeMetaMap } from '../nodes/shared/mentionEditorDom';
import { useAppStore } from '../../store/useAppStore';
import { OfficialSparkleIcon } from './officialIcons';
import { resolveSkillIcon, resolveSkillOverride, resolveSkillTableKey, SKILL_ICON_INSET_KEYS } from './skillIconMap';

/* 官方 `input.placeholderSeparator`（`page-DVqoHdTT.js`@774485）：zh 是 `,`，其余语言的分段文案
   本身已带分隔符 ⇒ 空串。官方还有 `M = /^[A-Za-z]/.test(A) ? 'ml-1' : undefined`。 */
const PLACEHOLDER_SEPARATOR = getLocale() === 'zh-CN' ? ',' : '';
const PLACEHOLDER_SEPARATOR_CLASS = /^[A-Za-z]/.test(PLACEHOLDER_SEPARATOR) ? 'ml-1' : undefined;

export type ChatComposerReference =
  | { kind: 'node'; id: string; label: string; displayId?: number }
  | { kind: 'model'; id: string; label: string }
  | { kind: 'skill'; id: string; label: string }
  /** 资产库人物/场景/道具；发送时由 promptResolver 展开为设定正文或参考图 */
  | { kind: 'drama'; id: string; label: string }
  /** 官方「应用」提及：`renderText = plugin:<pluginName>:<skillName>`，
   *  写进输入值的 token 是官方 `k0e` 的 `{{<pluginName>:<skillName>}}`（见 `services/chat/mentionPlugins`）。 */
  | { kind: 'plugin'; id: string; label: string; skill: string };

export interface ChatComposerEditorHandle {
  focus: () => void;
  insertReference: (reference: ChatComposerReference) => void;
}

interface ChatComposerEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  nodeDisplayIds: ReadonlyMap<string, number | undefined>;
  onMentionQueryChange: (query: string | null) => void;
  onSlashQueryChange: (query: string | null) => void;
  onSuggestionKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => boolean;
  suggestionListId?: string;
  activeSuggestionId?: string;
  suggestionsOpen?: boolean;
  placeholder: string;
  disabled?: boolean;
}

type ParsedReference = ChatComposerReference & { raw: string };

const ZWSP = '\u200B';
const REFERENCE_PATTERN = /@\{([^:}\r\n]+):([^}\r\n]+)\}|@model\{([^|}\r\n]+)\|([^}\r\n]*)\}|@skill\{([^|}\r\n]+)\|([^}\r\n]*)\}|@drama\{([^:}\r\n]+):([^}\r\n]+)\}|\{\{([^:}\r\n]+):([^}\r\n]+)\}\}/g;
const REFERENCE_TEXT_PATTERN = /@\{[^:}\r\n]+:[^}\r\n]+\}|@model\{[^|}\r\n]+\|[^}\r\n]*\}|@skill\{[^|}\r\n]+\|[^}\r\n]*\}|@drama\{[^:}\r\n]+:[^}\r\n]+\}|\{\{[^:}\r\n]+:[^}\r\n]+\}\}/;

/** 芯片配色：边框 / 底色 / 文字 / 竖条 */
const REFERENCE_STYLES: Record<ChatComposerReference['kind'], { chip: string; accent: string }> = {
  node: { chip: 'border-primary/25 bg-primary/10 text-accent-primary', accent: 'bg-accent-primary/70' },
  model: { chip: 'border-sky-400/25 bg-sky-400/10 text-sky-100', accent: 'bg-sky-300/70' },
  skill: { chip: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100', accent: 'bg-emerald-300/70' },
  drama: { chip: 'border-violet-400/25 bg-violet-400/10 text-violet-100', accent: 'bg-violet-300/70' },
  /* 官方「应用」提及节点视图（`MentionNodeView` 的 plugin 分支）在官方是 `bg-transparent p-0`
     + 应用图标 + 文本；这里沿用同一套 MTV 芯片壳，只给它一组中性配色。 */
  plugin: { chip: 'border-amber-400/25 bg-amber-400/10 text-amber-100', accent: 'bg-amber-300/70' },
};
const REFERENCE_ARIA_PREFIX: Record<ChatComposerReference['kind'], string> = {
  node: '节点',
  model: '模型',
  skill: 'Skill',
  drama: '资产',
  plugin: '应用',
};

/**
 * 官方 `fwe`（`mentionTokens.ts` @209257 邻域）的标签解码语义，**逐字**：
 *   `const label = decodeURIComponent(raw); if (!label.trim() || encodeURIComponent(label) !== raw) return null;`
 * 即「只有严格往返成立的才算编码标签」，否则原样保留。
 * ⚠️ 不能写成裸 `decodeURIComponent`：节点标题里出现 `%` 时（如 `100%20off`）会被误解码。
 */
function decodeLabel(value: string): string {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.trim() && encodeURIComponent(decoded) === value ? decoded : value;
  } catch {
    return value;
  }
}

function sanitizeLabel(value: string): string {
  return value.replace(/}/g, '').trim();
}

function serializeReference(reference: ChatComposerReference): string {
  if (reference.kind === 'node') {
    return `@{${reference.id}:${sanitizeLabel(reference.label) || '节点'}}`;
  }
  if (reference.kind === 'model') {
    return `@model{${reference.id}|${sanitizeLabel(reference.label) || '模型'}}`;
  }
  if (reference.kind === 'drama') {
    return `@drama{${reference.id}:${sanitizeLabel(reference.label) || '资产'}}`;
  }
  if (reference.kind === 'plugin') {
    /* 官方 `k0e`：`(e,t)=>\`{{${e}:${t}}}\``（`e` = pluginName、`t` = skillName）。 */
    return `{{${reference.id}:${reference.skill}}}`;
  }
  return `@skill{${reference.id}|${encodeURIComponent(reference.label)}}`;
}

function parseReference(match: RegExpExecArray, nodeDisplayIds: ReadonlyMap<string, number | undefined>): ParsedReference {
  const raw = match[0];
  if (match[1] !== undefined) {
    return {
      kind: 'node',
      id: match[1],
      /* 官方 `mwe` 把标签写成 `encodeURIComponent(label)`（`mentionTokens.ts:45`），
         读回来必须走同一套解码语义 —— 否则芯片会显示 `%E9%A2%9D%E5%A8%98…`（用户实测 图10）。 */
      label: decodeLabel(match[2]) || '节点',
      displayId: nodeDisplayIds.get(match[1]),
      raw,
    };
  }
  if (match[3] !== undefined) {
    return {
      kind: 'model',
      id: match[3],
      label: match[4] || '模型',
      raw,
    };
  }
  if (match[5] !== undefined) {
    return {
      kind: 'skill',
      id: match[5],
      label: decodeLabel(match[6]) || 'Skill',
      raw,
    };
  }
  if (match[7] !== undefined) {
    return {
      kind: 'drama',
      id: match[7],
      label: match[8] || '资产',
      raw,
    };
  }
  /* 官方「应用」token `{{pluginName:skillName}}`。 */
  return {
    kind: 'plugin',
    id: match[9],
    label: match[9],
    skill: match[10],
    raw,
  };
}

function isReferenceElement(node: Node | null | undefined): node is HTMLElement {
  return !!node
    && node.nodeType === Node.ELEMENT_NODE
    && (node as HTMLElement).hasAttribute('data-chat-reference');
}

function isBreakElement(node: Node | null | undefined): boolean {
  return !!node && node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'BR';
}

function ensureCaretSlotBefore(referenceElement: HTMLElement): void {
  const previous = referenceElement.previousSibling;
  if (!previous || isBreakElement(previous) || isReferenceElement(previous)) {
    referenceElement.parentNode?.insertBefore(document.createTextNode(ZWSP), referenceElement);
  }
}

/** 官方 `qs`（技能头像）的 DOM 版（React 组件版见 `officialIcons.OfficialSkillAvatarIcon`）：
    `Xh` 专用 SVG → `Vs/Wh` 内缩 → `qh[key]` 专属图标 → 兜底 `Kt`。
    资源与官方同字节：`/assets/skill-icon-background.png`（= 官方 `bh`）、
    `/assets/skill-icon-fallback.png`（= 官方 `Kt` 的 base64 PNG，sha256 已核对一致）、
    各内置技能图标已由 `skillIconMap.ts` 逐字取出。 */
function buildOfficialSkillAvatarElement(size: number, skillName?: string): HTMLSpanElement {
  const override = skillName ? resolveSkillOverride(skillName) : null;
  if (override) {
    const img = document.createElement('img');
    img.src = override;
    img.alt = '';
    img.draggable = false;
    img.className = 'shrink-0 object-cover';
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.style.minWidth = `${size}px`;
    img.style.minHeight = `${size}px`;
    return img as unknown as HTMLSpanElement;
  }
  const key = skillName ? resolveSkillTableKey(skillName) : null;
  const inset = key && SKILL_ICON_INSET_KEYS.includes(key) ? 0.22 : 0;
  const offset = `${inset * 100}%`;
  const inner = `${(1 - inset * 2) * 100}%`;
  const span = document.createElement('span');
  span.setAttribute('aria-hidden', 'true');
  span.className = 'relative inline-flex shrink-0 overflow-hidden';
  span.style.width = `${size}px`;
  span.style.height = `${size}px`;
  span.style.minWidth = `${size}px`;
  span.style.minHeight = `${size}px`;
  span.style.borderRadius = '25%';
  const background = document.createElement('img');
  background.src = '/assets/skill-icon-background.png';
  background.alt = '';
  background.draggable = false;
  background.className = 'absolute inset-0 size-full object-cover';
  background.style.width = '100%';
  background.style.height = '100%';
  span.appendChild(background);
  const glyph = document.createElement('img');
  glyph.src = (skillName ? resolveSkillIcon(skillName) : null) ?? '/assets/skill-icon-fallback.png';
  glyph.alt = '';
  glyph.draggable = false;
  glyph.className = 'absolute object-contain';
  glyph.style.top = offset;
  glyph.style.left = offset;
  glyph.style.width = inner;
  glyph.style.height = inner;
  span.appendChild(glyph);
  return span;
}

function buildReferenceElement(reference: ParsedReference): HTMLSpanElement {
  const element = document.createElement('span');
  element.contentEditable = 'false';
  element.setAttribute('data-chat-reference', reference.kind);
  element.setAttribute('data-chat-reference-raw', reference.raw);
  const style = REFERENCE_STYLES[reference.kind];
  element.setAttribute('aria-label', `${REFERENCE_ARIA_PREFIX[reference.kind]} ${reference.label}${
    reference.kind === 'node' && reference.displayId != null ? `，编号 ${reference.displayId}` : ''
  }`);

  /* 官方 `NodeMentionPill`（`use-chat-attachment-file-input-*.js@158688`）的技能分支**逐字**：
     `mentionType === 'skill'` 时图标位走 `qs`（= 官方 14px 技能头像：背景 PNG + 25% 圆角 + 兜底 glyph），
     壳 = `mention mention-node group` + `cp`（`gap-1 h-5 min-w-[24px] max-w-[120px] p-1` 等）
     + `dp`（`text-white/60 hover:…`），内联 `{borderRadius:'4px', background:'#333333'}`。
     ⚠️ MTV 此前是「彩条 + `/名字`」，**没有缩略图**（用户实测「skill 到 agent 的缩略图不对」）。 */
  if (reference.kind === 'skill') {
    /* 官方**技能 chip 是透明底 + p-0 + 无 hover 效果**（`ox` @162242 的 `bg:"transparent"` /
       `className:"cursor-default p-0 hover:brightness-100 hover:shadow-none"`，
       `lx` @163631 的 `[&_.mention-node[data-mention-type='skill']]:p-0`）。
       ⚠️ **不要加 `select-none`**：官方真机实测链路 `user-select: auto`（`contenteditable="false"`
       的原子节点视图 `react-renderer node-mention`）⇒ 全选时浏览器会把选中高亮**画在 chip 上**
       （头像也会被蓝色高亮透出）。MTV 之前加了 `select-none`（`user-select: none`）⇒ 全选时
       chip 完全不高亮（用户实测对比图）。 */
    element.className = 'mention mention-node group relative mx-0.5 inline-flex min-w-[24px] max-w-[120px] cursor-default items-center justify-center gap-1 align-middle p-0';
    element.style.borderRadius = '4px';
    element.style.background = 'transparent';
    element.appendChild(buildOfficialSkillAvatarElement(14, reference.label));
    const skillLabel = document.createElement('span');
    skillLabel.className = 'truncate text-center text-xs font-normal leading-none transition-colors font-medium text-text-text-primary';
    skillLabel.textContent = reference.label;
    element.appendChild(skillLabel);
    return element;
  }

  if (reference.kind === 'node') {
    /* 官方 composer 的**节点**引用走的是同一个 ProseMirror NodeView（`lme`/`tme`，见
       `mentionEditorDom.buildChipEl` 头部对 `zoom-slider` 的逐字引文）⇒ 直接复用 MTV 已逐字移植的
       `buildChipEl`：`#333333` + `p-1 h-5 min-w-[24px] max-w-[120px] rounded-[4px]` +
       14px 缩略图/类型图标 + `text-[12px] text-white/60` 文案（悬停出 `×`）。
       ⚠️ MTV 原来是**自造**的「彩色竖条 + 标签 + `#编号`」 chip（用户实测图 4：
       「从画布框选节点卡片 → 加入对话，加入到 agent 编辑区里面的显示完全不对」）——
       官方 chip 里**没有**编号，也没有彩色竖条。 */
    const chip = buildChipEl(
      reference.id,
      reference.label,
      getNodeMetaMap(useAppStore.getState().nodes),
    );
    /* 本编辑器的序列化/命中判据（`serializeEditor` / `isReferenceElement`）都读这两个属性。 */
    chip.setAttribute('data-chat-reference', 'node');
    chip.setAttribute('data-chat-reference-raw', reference.raw);
    chip.setAttribute('aria-label', `${REFERENCE_ARIA_PREFIX.node} ${reference.label}${
      reference.displayId != null ? `，编号 ${reference.displayId}` : ''
    }`);
    /* 官方 NodeView 的悬停 `×`：`MentionEditor` 里由编辑器根的事件代理处理，这里由本编辑器自己接。 */
    const remove = chip.querySelector<HTMLElement>('.prompt-chip-del');
    remove?.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const root = chip.parentElement;
      chip.remove();
      root?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return chip;
  }

  /* ⚠️ 同样**不加 `select-none`**（官方原子节点视图是 `user-select: auto` + `contenteditable=false`，
     全选时高亮要能画在 chip 上）。 */
  element.className = `mx-0.5 inline-flex max-w-[min(100%,18rem)] items-center align-middle
    rounded-[7px] border px-2 py-1 text-[12px] font-medium leading-none shadow-sm ${style.chip}`;

  const accent = document.createElement('span');
  accent.setAttribute('aria-hidden', 'true');
  accent.className = `mr-1.5 h-3 w-0.5 shrink-0 rounded-full ${style.accent}`;
  element.appendChild(accent);

  const label = document.createElement('span');
  label.className = 'max-w-[12rem] truncate';
  label.textContent = reference.label;
  element.appendChild(label);

  return element;
}

function appendText(nodes: Node[], value: string): void {
  if (!value) return;
  const lines = value.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) nodes.push(document.createElement('br'));
    if (line) nodes.push(document.createTextNode(line));
  });
}

function renderValue(value: string, nodeDisplayIds: ReadonlyMap<string, number | undefined>): Node[] {
  const nodes: Node[] = [];
  let cursor = 0;
  for (const match of value.matchAll(REFERENCE_PATTERN)) {
    const start = match.index;
    if (start == null) continue;
    appendText(nodes, value.slice(cursor, start));
    const referenceElement = buildReferenceElement(parseReference(match, nodeDisplayIds));
    const previous = nodes[nodes.length - 1];
    if (!previous || isBreakElement(previous) || isReferenceElement(previous)) {
      nodes.push(document.createTextNode(ZWSP));
    }
    nodes.push(referenceElement);
    cursor = start + match[0].length;
  }
  appendText(nodes, value.slice(cursor));
  return nodes;
}

function serializeEditor(root: HTMLElement): string {
  let value = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      value += (node.textContent || '').split(ZWSP).join('');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const rawReference = element.getAttribute('data-chat-reference-raw');
    if (rawReference != null) {
      value += rawReference;
      return;
    }
    if (element.tagName === 'BR') {
      value += '\n';
      return;
    }
    for (const child of Array.from(element.childNodes)) walk(child);
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  return value;
}

function containsUndecoratedReference(root: HTMLElement): boolean {
  const visit = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      return REFERENCE_TEXT_PATTERN.test(node.textContent || '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE || isReferenceElement(node)) return false;
    return Array.from(node.childNodes).some(visit);
  };
  return Array.from(root.childNodes).some(visit);
}

function placeCaretAtEnd(root: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function resolveTextCaret(range: Range): { node: Text; offset: number } | null {
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    return { node: range.startContainer as Text, offset: range.startOffset };
  }
  if (range.startContainer.nodeType !== Node.ELEMENT_NODE || range.startOffset === 0) return null;

  let candidate: Node | null = range.startContainer.childNodes[range.startOffset - 1] ?? null;
  while (candidate?.nodeType === Node.ELEMENT_NODE && !isReferenceElement(candidate)) {
    candidate = candidate.lastChild;
  }
  if (candidate?.nodeType !== Node.TEXT_NODE) return null;
  return { node: candidate as Text, offset: candidate.textContent?.length ?? 0 };
}

const ChatComposerEditor = forwardRef<ChatComposerEditorHandle, ChatComposerEditorProps>(function ChatComposerEditor({
  value,
  onChange,
  onSubmit,
  nodeDisplayIds,
  onMentionQueryChange,
  onSlashQueryChange,
  onSuggestionKeyDown,
  suggestionListId,
  activeSuggestionId,
  suggestionsOpen = false,
  placeholder,
  disabled = false,
}, ref) {
  const t = useT();
  const editorRef = useRef<HTMLDivElement>(null);
  const lastRangeRef = useRef<Range | null>(null);
  const triggerRangeRef = useRef<Range | null>(null);

  const emitValue = useCallback(() => {
    if (editorRef.current) onChange(serializeEditor(editorRef.current));
  }, [onChange]);

  const captureSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.startContainer)) lastRangeRef.current = range.cloneRange();
  }, []);

  const detectTrigger = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const caret = selection.getRangeAt(0);
    const textCaret = resolveTextCaret(caret);
    if (!editor.contains(caret.startContainer) || !textCaret) {
      triggerRangeRef.current = null;
      onMentionQueryChange(null);
      onSlashQueryChange(null);
      return;
    }

    const textBeforeCaret = (textCaret.node.textContent || '').slice(0, textCaret.offset);
    const mention = /@([^\s@]*)$/.exec(textBeforeCaret);
    const slash = /(?:^|\s)\/([^\s/]*)$/.exec(textBeforeCaret);
    const trigger = mention ?? slash;
    if (!trigger) {
      triggerRangeRef.current = null;
      onMentionQueryChange(null);
      onSlashQueryChange(null);
      return;
    }

    const replacement = caret.cloneRange();
    replacement.setStart(textCaret.node, textCaret.offset - trigger[0].trimStart().length);
    triggerRangeRef.current = replacement;
    if (mention) {
      onMentionQueryChange(mention[1]);
      onSlashQueryChange(null);
    } else {
      onMentionQueryChange(null);
      onSlashQueryChange(slash?.[1] ?? '');
    }
  }, [onMentionQueryChange, onSlashQueryChange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const serializedValue = serializeEditor(editor);
    if (serializedValue === value && !containsUndecoratedReference(editor)) return;

    const hadFocus = document.activeElement === editor;
    editor.innerHTML = '';
    for (const node of renderValue(value, nodeDisplayIds)) editor.appendChild(node);
    if (hadFocus) placeCaretAtEnd(editor);
  }, [nodeDisplayIds, value]);

  useEffect(() => {
    const focusEditor = () => editorRef.current?.focus();
    window.addEventListener('chat-focus-composer', focusEditor);
    return () => window.removeEventListener('chat-focus-composer', focusEditor);
  }, []);

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    insertReference: (reference) => {
      const editor = editorRef.current;
      if (!editor || disabled) return;
      editor.focus();

      const selection = window.getSelection();
      const savedRange = triggerRangeRef.current ?? lastRangeRef.current;
      const range = savedRange && editor.contains(savedRange.startContainer)
        ? savedRange.cloneRange()
        : document.createRange();
      if (!savedRange || !editor.contains(savedRange.startContainer)) {
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      range.deleteContents();

      const raw = serializeReference(reference);
      const chip = buildReferenceElement({ ...reference, raw });
      range.insertNode(chip);
      ensureCaretSlotBefore(chip);
      const spacer = document.createTextNode(' ');
      chip.parentNode?.insertBefore(spacer, chip.nextSibling);
      range.setStart(spacer, 1);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      lastRangeRef.current = range.cloneRange();
      triggerRangeRef.current = null;
      onMentionQueryChange(null);
      onSlashQueryChange(null);
      emitValue();
    },
  }), [disabled, emitValue, onMentionQueryChange, onSlashQueryChange]);

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!editor.textContent && !editor.querySelector('[data-chat-reference]')) editor.innerHTML = '';
    captureSelection();
    detectTrigger();
    emitValue();
  }, [captureSelection, detectTrigger, emitValue]);

  const removeAdjacentReference = useCallback((direction: 'before' | 'after'): boolean => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return false;
    const range = selection.getRangeAt(0);
    if (!range.collapsed || !editor.contains(range.startContainer)) return false;

    let candidate: Node | null = null;
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const text = range.startContainer.textContent || '';
      if (direction === 'before' && range.startOffset === 0) candidate = range.startContainer.previousSibling;
      if (direction === 'after' && range.startOffset === text.length) candidate = range.startContainer.nextSibling;
    } else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
      candidate = direction === 'before'
        ? range.startContainer.childNodes[range.startOffset - 1] ?? null
        : range.startContainer.childNodes[range.startOffset] ?? null;
    }
    if (!isReferenceElement(candidate)) return false;

    const previous = candidate.previousSibling;
    candidate.remove();
    if (previous?.nodeType === Node.TEXT_NODE && previous.textContent === ZWSP) previous.remove();
    emitValue();
    return true;
  }, [emitValue]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (onSuggestionKeyDown?.(event)) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && value.trim()) onSubmit();
      return;
    }
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const lineBreak = document.createElement('br');
      const caretSlot = document.createTextNode(ZWSP);
      range.insertNode(lineBreak);
      lineBreak.parentNode?.insertBefore(caretSlot, lineBreak.nextSibling);
      range.setStart(caretSlot, 1);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      emitValue();
      return;
    }
    if (event.key === 'Backspace' && removeAdjacentReference('before')) event.preventDefault();
    if (event.key === 'Delete' && removeAdjacentReference('after')) event.preventDefault();
  }, [disabled, emitValue, onSubmit, onSuggestionKeyDown, removeAdjacentReference, value]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const text = document.createTextNode(event.clipboardData.getData('text/plain'));
    range.insertNode(text);
    range.setStartAfter(text);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    handleInput();
  }, [handleInput]);

  return (
    /* 官方 `ZL`（MessageInputAreaV2）根 = `@container relative px-4 py-4`；
       `@container` 是必需的：宽/窄双占位靠 `@[480px]:` 变体切换（插件 `@tailwindcss/container-queries`）。 */
    <div className="@container relative isolate min-h-12 max-h-[100px]">
      {/* 官方宽/窄双占位（PAGE@786700）：一层
          `absolute inset-x-0 top-0 z-20 grid grid-cols-1 text-sm leading-5 text-white/40`，
          两个 span 用 `col-start-1 row-start-1` 叠在同一格里，靠容器查询 `@[480px]` 切换：
            窄（<480px）→ `placeholderCompact`「随心输入」
            宽（≥480px）→ `placeholderTypePrompt` + `/使用技能` + `,` + `+添加画布内容` + `,` + `@引用参考或使用应用` */}
      {!value && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 grid grid-cols-1 text-sm leading-5 text-white/40">
          <span
            data-placeholder-compact
            className="pointer-events-none visible col-start-1 row-start-1 min-w-0 whitespace-nowrap opacity-100 transition-[opacity,visibility] duration-150 ease-out motion-reduce:transition-none @[480px]:invisible @[480px]:opacity-0"
          >
            {placeholder}
          </span>
          <span
            data-placeholder-full
            className="pointer-events-none invisible col-start-1 row-start-1 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 opacity-0 transition-[opacity,visibility] duration-150 ease-out motion-reduce:transition-none @[480px]:visible @[480px]:opacity-100"
          >
            <span className="whitespace-nowrap">{t('描述创意或需求, ')}</span>
            <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
              <span className="relative top-[-0.05em] leading-none">/</span>
              <span>{t('使用技能')}</span>
            </span>
            <span className={PLACEHOLDER_SEPARATOR_CLASS}>{PLACEHOLDER_SEPARATOR}</span>
            <span className="mx-0.5 inline-flex items-center whitespace-nowrap">
              <button
                type="button"
                className="pointer-events-none inline-flex items-center gap-1 rounded-sm text-white/50 transition-colors focus:outline-none hover:text-white/70 cursor-pointer @[480px]:pointer-events-auto"
              >
                <OfficialSparkleIcon size={14} strokeWidth={0.33} className="size-3.5 shrink-0" />
                <span>{t('添加画布内容')}</span>
              </button>
              <span className={PLACEHOLDER_SEPARATOR_CLASS}>{PLACEHOLDER_SEPARATOR}</span>
            </span>
            <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
              <span className="relative top-[-0.05em] leading-none">@</span>
              <span>{t('引用参考或使用应用')}</span>
            </span>
          </span>
        </div>
      )}
      <div
        ref={editorRef}
        role="textbox"
        aria-label={t('对话消息')}
        aria-multiline="true"
        aria-autocomplete="list"
        aria-controls={suggestionsOpen ? suggestionListId : undefined}
        aria-activedescendant={suggestionsOpen ? activeSuggestionId : undefined}
        aria-expanded={suggestionsOpen}
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck={false}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={captureSelection}
        onMouseUp={captureSelection}
        onPaste={handlePaste}
        onBlur={emitValue}
        /* 官方编辑器的 minHeight/maxHeight = **48 / 100**（`ZL` 里 `minHeight:48, maxHeight:100`，
           外壳 `relative isolate min-h-12`）。MTV 原来是 `min-h-[64px] max-h-[160px]`，
           实测让输入卡整体高 137px（官方构成 = 16+16 padding + 48 + rail 40 = 120）。
           文字色官方是 `text-foreground/80`（`text-[13px] leading-[1.65]`）。 */
        className={`chat-panel-textarea relative z-10 block w-full min-h-12 max-h-[100px]
          overflow-y-auto whitespace-pre-wrap break-words bg-transparent text-[13px] leading-[1.65] text-foreground/80
          outline-none selection:bg-primary/25 rounded-[8px] ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      />
    </div>
  );
});

export default ChatComposerEditor;
