/**
 * nodes/shared/mentionEditorDom — @ 提及编辑器的 DOM 层。
 * 把画布节点与工作流 IO 节点渲染成可插入提示词的「芯片」（chip）DOM 片段，
 * 用零宽空格（ZWSP）作分隔占位，配合 mentionEditorSources 提供可点选的提及候选。
 */
import { convertFileSrc } from '@tauri-apps/api/core';
import type { WorkflowIONodeType, StoryboardCellOverride } from '../../../types';
import type { AppState } from '../../../store/useAppStore';
import { useAppStore } from '../../../store/useAppStore';
import { getFileCategory } from '../../../services/fileService';
import { parseDramaMentionId } from '../../../types/dramaAssets';
import { resolveDramaActionMediaRef } from '../../../services/dramaAssetPrompt';
import { parseMagicItemTokens } from '../../../utils/magicItem';
import type { MagicItemToken } from '../../../utils/magicItem';
import { t } from '../../../i18n';

const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export const ZWSP = '\u200B';
const CHIP_STYLE: Record<string, string> = {
  'ai-text': 'chip-text',
  'ai-image': 'chip-image',
  'ai-video': 'chip-video',
  'ai-audio': 'chip-audio',
  'ai-markdown': 'chip-markdown',
  'ai-storyboard': 'chip-image',
};
const WF_IO_STYLE: Record<string, string> = {
  prompt: 'chip-workflow-prompt',
  image: 'chip-workflow-image',
  video: 'chip-workflow-video',
  audio: 'chip-workflow-audio',
};
const WF_IO_ICON: Record<string, string> = {
  prompt: 'T',
  image: 'I',
  video: 'V',
  audio: 'A',
};
const IMAGE_REFERENCE_NODE_TYPES = new Set([
  'ai-image',
  'source-image',
  'ai-storyboard',
  'ai-director',
  'ai-panorama',
  'ai-animation',
]);

type NodeMeta = {
  type: string;
  displayId: number | undefined;
  thumbnailUrl?: string;
  imageReferenceKey?: string;
  /** `role: 'source'` = 用户上传/粘贴进来的**源文件节点**（官方那侧对应 attachment 提及） */
  role?: string;
  /** 节点自己的名字（MTV 就在 `data.label`；官方是 `item.title`）——提及标签的 `title` 那一支 */
  title?: string;
};

const nodeMetaCache = new WeakMap<AppState['nodes'], Map<string, NodeMeta>>();

function localAssetUrl(filePath?: string): string | undefined {
  if (!filePath || !IS_TAURI) return undefined;
  try {
    return convertFileSrc(filePath);
  } catch {
    return undefined;
  }
}

export function bestNodeThumb(
  data: { imageUrl?: unknown; thumbnailUrl?: unknown; filePath?: unknown },
): string | undefined {
  if (data.imageUrl) {
    return localAssetUrl(data.filePath as string | undefined)
      || (data.thumbnailUrl as string | undefined)
      || (data.imageUrl as string | undefined);
  }
  return data.thumbnailUrl as string | undefined;
}

export function getNodeMetaMap(nodes: AppState['nodes']) {
  const cached = nodeMetaCache.get(nodes);
  if (cached) return cached;
  const map = new Map<string, NodeMeta>();
  for (const node of nodes) {
    const type = (node.data.type as string) || '';
    const thumbnailUrl = bestNodeThumb(node.data);
    const directorCaptureUrl = type === 'ai-director' && Array.isArray(node.data.directorCaptureUrls)
      ? node.data.directorCaptureUrls.find((url) => typeof url === 'string' && url.trim())
      : undefined;
    map.set(node.id, {
      type,
      displayId: node.data.displayId as number | undefined,
      thumbnailUrl,
      role: (node.data.role as string | undefined) || undefined,
      title: (node.data.label as string | undefined) || undefined,
      imageReferenceKey: IMAGE_REFERENCE_NODE_TYPES.has(type) && (thumbnailUrl || directorCaptureUrl)
        ? `node:${node.id}${!thumbnailUrl && directorCaptureUrl ? ':cap0' : ''}`
        : undefined,
    });
    if (node.data.type !== 'ai-storyboard') continue;
    const cols = Math.max(1, (node.data.storyboardCols as number) || 3);
    const rows = Math.max(1, (node.data.storyboardRows as number) || 3);
    const overrides = (node.data.storyboardOverrides as (StoryboardCellOverride | null)[] | undefined) ?? [];
    const imageUrl = node.data.imageUrl as string | undefined;
    for (let index = 0; index < rows * cols; index += 1) {
      const thumbnailUrl = overrides[index]?.url || imageUrl;
      if (thumbnailUrl) {
        const cellId = `${node.id}/cell/${index}`;
        map.set(cellId, {
          type: 'ai-image',
          displayId: undefined,
          thumbnailUrl,
          imageReferenceKey: `sbcell:${cellId}`,
        });
      }
    }
  }
  nodeMetaCache.set(nodes, map);
  return map;
}

export function isChipEl(node: Node | null | undefined): node is HTMLElement {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  const element = node as HTMLElement;
  return element.hasAttribute('data-ref-id')
    || element.hasAttribute('data-asset-path')
    || element.hasAttribute('data-drama-id')
    || element.hasAttribute('data-wf-id')
    || element.hasAttribute('data-skill-id')
    || element.hasAttribute('data-magic-item');
}

export function isBrEl(node: Node | null | undefined): boolean {
  return !!node && node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'BR';
}

export function ensureCaretSlotBeforeChip(chip: Node): void {
  const previous = chip.previousSibling;
  if (!previous || isBrEl(previous)) {
    chip.parentNode?.insertBefore(document.createTextNode(ZWSP), chip);
  } else if (previous.nodeType === Node.TEXT_NODE && !previous.textContent) {
    previous.textContent = ZWSP;
  }
}

export function normalizeChipSlots(root: HTMLElement): void {
  const chips = root.querySelectorAll('[data-ref-id],[data-asset-path],[data-drama-id],[data-wf-id],[data-skill-id],[data-magic-item]');
  for (const chip of Array.from(chips)) ensureCaretSlotBeforeChip(chip);
}

export function numberImageReferenceKeys(keys: Array<string | undefined>): Array<number | undefined> {
  const indexByKey = new Map<string, number>();
  return keys.map((key) => {
    if (!key) return undefined;
    const existing = indexByKey.get(key);
    if (existing !== undefined) return existing;
    const index = indexByKey.size + 1;
    indexByKey.set(key, index);
    return index;
  });
}

/**
 * ⚠️ MTV 自造的「(图N)」芯片序号 **已按官方删除**（用户 图1/图2 对比）：
 *   官方提及芯片（`tme` @366345）里只有【缩略图/类型图标】+【标签】+【hover 删除键】三件，
 *   **没有任何 `(图N)` 序号**；MTV 原来在这个函数里往每个图片芯片尾部追加
 *   `<span class="prompt-chip-image-index">(图1)</span>` ⇒
 *   胶囊被撑成两行（截图里那个「生成…」+ 换行的「(图1)」）✗。
 * 这里保留函数签名（调用方还在用），但**只清理历史遗留的序号节点**，不再新增。
 * （图片引用的**编号语义**仍由 `serializeDOM` 的 `{{Image N}}` 负责，与这里无关。）
 */
export function syncImageReferenceLabels(root: HTMLElement, _metaMap: Map<string, NodeMeta>): void {
  for (const chip of Array.from(root.querySelectorAll<HTMLElement>('.prompt-chip-image-index'))) {
    chip.remove();
  }
}

export function serializeDOM(root: HTMLElement): string {
  let result = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    if (element.hasAttribute('data-magic-item')) {
      /* 焦点编辑元数据 token —— 官方同样把 `{{magic_item:{…}}}` 当正文写回（`dN` / `processMagicTags` 再消费）*/
      const raw = element.getAttribute('data-magic-item') || '';
      result += raw ? `{{magic_item:${raw}}}` : '';
    } else if (element.hasAttribute('data-ref-id')) {
      result += `@{${element.getAttribute('data-ref-id') || ''}:${element.getAttribute('data-ref-label') || ''}}`;
    } else if (element.hasAttribute('data-drama-id')) {
      result += `@drama{${element.getAttribute('data-drama-id') || ''}:${element.getAttribute('data-drama-label') || ''}}`;
    } else if (element.hasAttribute('data-asset-path')) {
      result += `@asset{${encodeURIComponent(element.getAttribute('data-asset-path') || '')}}`;
    } else if (element.hasAttribute('data-skill-id')) {
      result += `@skill{${element.getAttribute('data-skill-id') || ''}|${encodeURIComponent(element.getAttribute('data-skill-name') || '')}}`;
    } else if (element.hasAttribute('data-wf-id')) {
      result += `@wf{${element.getAttribute('data-wf-id') || ''}|${element.getAttribute('data-wf-title') || ''}|${element.getAttribute('data-wf-type') || 'prompt'}}(`;
      const valueElement = element.querySelector('.prompt-chip-wf-value');
      if (valueElement) {
        for (const child of Array.from(valueElement.childNodes)) walk(child);
      }
      result += ')';
    } else if (element.tagName === 'BR') {
      result += '\n';
    } else {
      for (const child of Array.from(node.childNodes)) walk(child);
    }
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  /* 官方每插入一个提及就在后面补一个 `' '`（kit `Ag` @590365）⇒ 尾部会留一个空格，
     序列化时去掉行尾空白，避免提示词里出现无意义的尾随空格 ✓ */
  return result.split(ZWSP).join('').replace(/[ \t\n]+$/, '');
}

export function buildChipEl(
  nodeId: string,
  label: string,
  metaMap: Map<string, NodeMeta>,
): HTMLSpanElement {
  const meta = metaMap.get(nodeId);
  const nodeType = meta?.type || 'ai-text';
  const mentionType = mentionTypeOf(nodeType, meta);
  /* 官方 chip DOM —— 三层，逐字对齐 `zoom-slider` 的 `lme` @377423 + `tme` @366345：

       <span data-mention-node-view="true" contenteditable="false">        ← NodeView 壳（kit `Q6` @592752）
         <span data-node-view-wrapper data-mention-type=… class="inline"   ← tiptap `NodeViewWrapper`（kit `Ku`=`wg` @609625）
               style="white-space:normal">
           <span class="… h-5 min-w-[24px] max-w-[120px] p-1 rounded-[4px] bg-[#333333]">   ← `tme` 本体（`m6`）
             [缩略图 `nme` 14×14 r3 + Xj 阴影] | [类型图标 `sme` 14×14 / 字形 9px]
             <span class="flex-1 min-w-0 text-[12px] font-medium leading-[18px] truncate tracking-[-0.16px] text-white/60">
             [hover 删除键：14×14 / 图标 10px / before:-inset-1]
           </span>
         </span>
       </span>

     ⚠️ 三个关键事实（都是**读了源码**才确认的，之前都做错过）：
       1. **NodeView 路径下所有档都是基础灰 `#333333` + `r4` + `h-5`**：
          `.mention-image/-video/-element` 那套蓝/绿/紫胶囊 `!important` 只作用于 **class 路径**
          （`renderHTML` 产出的 `class="mention mention-<type>"`），而 composer 传了 `nodeViewComponent: lme`
          ⇒ NodeView 直接替换 DOM，芯片上**没有** `mention-<type>` 类，`Ku` 只加 `data-mention-type`
          ⇒ 那些胶囊规则在输入框里是死代码（用户：「官方 Image 是灰底 r4」✓）。
       2. `data-mention-type` 的取值是**提及条目的 type**：上传/粘贴进来的源文件 = `attachment`，
          画布图片/视频/音频/文本节点 = `image`/`video`/`audio`/`text`（kit `jh` @368000 的 `A=s==='attachment'`）。
       3. 预览卡挂在 `tme` 上的是 **`Zj`**（@370174）：只有 `type==='text'` 那支带底部 `@标签` 条 ✔
          （`eme` @366745「全档都带条」是**顶行参考图芯片** `r0` @1699083 用的那一套，别混） */
  const outer = document.createElement('span');
  outer.setAttribute('data-mention-node-view', 'true');
  outer.contentEditable = 'false';
  outer.setAttribute('data-ref-id', nodeId);
  outer.setAttribute('data-ref-label', label);
  outer.setAttribute('data-mention-type', mentionType);
  /* 节点的**原始名字**（官方 `item.title`）：重新编号时用它，而不是当前显示标签 ✓ */
  outer.setAttribute('data-ref-title', meta?.title ?? label);
  /* 预览档（MTV 侧用于挑 `Zj` 的哪一支）：`type` 为 video/audio/text 时走各自那支，
     其余（含 attachment / element / 库元素）一律走默认 = 图片卡（`p6`） */
  outer.setAttribute('data-preview-kind', previewKindOf(nodeType, meta));

  const viewWrapper = document.createElement('span');
  viewWrapper.setAttribute('data-node-view-wrapper', '');
  viewWrapper.className = 'inline';
  viewWrapper.style.whiteSpace = 'normal';
  viewWrapper.setAttribute('data-mention-type', mentionType);

  /* 官方提及条目的 kind（kit `renderHTML` @592600：`class = ['mention', type && 'mention-'+type]`）——
     MTV 留作内部 CSS/测试钩子；⚠️ 视觉上**不再**染蓝/绿/紫（见上面第 1 条） */
  const chipKind = chipMentionKind(nodeType, meta);
  const span = document.createElement('span');
  span.className = `prompt-chip prompt-chip-node ${CHIP_STYLE[nodeType] || CHIP_STYLE['ai-text']} mention-${chipKind}`;
  span.setAttribute('data-mention-type', mentionType);

  const isMedia = nodeType === 'ai-image' || nodeType === 'ai-video' || nodeType === 'ai-storyboard';
  if (isMedia && meta?.thumbnailUrl) {
    const thumbWrap = document.createElement('span');
    thumbWrap.className = 'prompt-chip-thumb-wrap';
    thumbWrap.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    image.src = meta.thumbnailUrl;
    image.className = 'prompt-chip-thumb';
    image.alt = '';
    thumbWrap.appendChild(image);
    span.appendChild(thumbWrap);
  } else {
    const icon = document.createElement('span');
    icon.className = 'prompt-chip-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = mentionTypeIconSvg(nodeType);
    span.appendChild(icon);
  }

  const labelEl = document.createElement('span');
  labelEl.className = 'prompt-chip-label';
  labelEl.textContent = label;
  span.appendChild(labelEl);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'prompt-chip-del';
  del.setAttribute('aria-label', '移除引用');
  del.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  del.addEventListener('mousedown', (event) => { event.preventDefault(); event.stopPropagation(); });
  del.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const root = outer.closest('[contenteditable="true"]') as HTMLElement | null;
    outer.remove();
    root?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
  });
  span.appendChild(del);

  viewWrapper.appendChild(span);
  outer.appendChild(viewWrapper);
  return outer;
}

/** 官方提及条目的 `type`（kit `jh` @368000）：
    ⚠️ composer 的 @ 列表给的是 **媒体档**（`zoom-slider` @3195786 `type: Ke.mediaType`
       ⇒ `image`/`video`/`audio`/`text`），**不是** `attachment`；
       `attachment` 只出现在「聊天附件面板」那条流程里（`jh` 的 `A = s === 'attachment'`）。
       ⇒ MTV 的源节点（上传/粘贴）同样按**真实媒体档**打标（图片仍是图片档、文本才是 text 档）✓ */
function mentionTypeOf(nodeType: string, meta?: NodeMeta): string {
  void meta;
  if (nodeType === 'ai-image' || nodeType === 'ai-storyboard') return 'image';
  if (nodeType === 'ai-video') return 'video';
  if (nodeType === 'ai-audio') return 'audio';
  if (nodeType === 'ai-text' || nodeType === 'ai-markdown') return 'text';
  return 'node';
}

/** 官方 `Zj` @370174 的分支选择（挂 `tme` 的预览卡）——按**条目自己的媒体档**分四支。
    ⚠️ 上传/粘贴进来的源文件节点**不再**一律当图片：官方 `jh` 里附件档的 `placeholderType`
       也是按实际媒体给的（`A && C ? 'video' : …`）⇒ 这里按节点类型判即可。 */
function previewKindOf(nodeType: string, meta?: NodeMeta): 'image' | 'video' | 'audio' | 'text' {
  void meta;
  if (nodeType === 'ai-video') return 'video';
  if (nodeType === 'ai-audio') return 'audio';
  if (nodeType === 'ai-text' || nodeType === 'ai-markdown') return 'text';
  return 'image';
}

/* ══════════════════════════════════════════════════════════════════════════════
   提及芯片/候选行的**名字 + 序号**（官方源码 + 官方 App 实测，双重确认）

   ▍名字（`zoom-slider` @3195786）：`label = item.title || \`Image ${n}\``
     —— `item.title` 就是**上游卡片自己的名字**。官方 App（CDP 9444）实测：
       那颗生成卡的输入框里挂着 3 颗芯片，名字是 `Image` / `IMAGE2` / `IMAGE2`，
       正是画布上那三张卡的标题 ⇒ **没有** `Image 1/2/3` 编号（用户：「应该是 @ 已连接上游节点卡片的名字」）✓

   ▍序号（`zoom-slider` @277750 / @294095）：
     `se = new Map(linked.map((v,i) => [v.id, i + 1]))`   // 节点 id → **在已连接列表里的 1-based 位次**
     行尾渲染：`{rt && <span className="min-w-[22px] shrink-0 text-right text-[11px] font-medium
                leading-4 tabular-nums text-white/30" aria-hidden>#{rt}</span>}`
     —— 这个 `#N` 就是分组标题右侧那句「输入序号快选」用的号（**只出现在「已连接节点」这一组**，
        其它组官方不给号）✓
     ⚠️ MTV 原来给 `#${displayId}`（节点的展示编号，实测是 `#13/#17/#45`）✗ 完全不是一回事。
   ══════════════════════════════════════════════════════════════════════════════ */

/** MTV 里等同于「没有名字」的标题：只有**遗留的类型默认名**（与各节点卡片自己的归一化口径一致）：
    `ImageNode.tsx` 显示时就把老数据里的 `生成图像` 归一化成 `Image` ⇒ 芯片名字也应显示归一化后的卡片名 */
const LEGACY_DEFAULT_TITLE: Record<string, string> = {
  '生成图像': 'Image',
  '生成图片': 'Image',
  '生成视频': 'Video',
  '生成音频': 'Audio',
  '生成文本': 'Text',
};

/** 节点在卡片上**显示**的名字（官方 `item.title`） */
export function displayNodeTitle(label: unknown): string {
  const raw = String(label ?? '').trim();
  if (!raw) return '';
  return LEGACY_DEFAULT_TITLE[raw] ?? raw;
}

/** 官方 `Image N` / `Video N` / `Audio N` / `Text N` 里的那个词 */
export function mentionKindLabel(kind: 'image' | 'video' | 'audio' | 'text'): string {
  return kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : kind === 'text' ? 'Text' : 'Image';
}

/** 官方的提及标签：`title || \`${Kind} ${indexInKind}\``（`title` = 卡片显示名；空名才编号，`indexInKind` 从 1 开始） */
export function mentionLabelFor(
  title: unknown,
  kind: 'image' | 'video' | 'audio' | 'text',
  indexInKind: number,
): string {
  const raw = displayNodeTitle(title);
  if (raw) return raw;
  return `${mentionKindLabel(kind)} ${Math.max(1, indexInKind)}`;
}

/** 提及条目 → 媒体档（官方那四支 `image|video|audio|text`） */
export function mentionKindOf(nodeType: string, meta?: NodeMeta): 'image' | 'video' | 'audio' | 'text' {
  const preview = previewKindOf(nodeType, meta);
  return preview;
}

/**
 * 官方 `updateMentionLabels`（@3196427）的等价实现：按 DOM 顺序给**同类**芯片重新编号
 * （`Image 1` / `Image 2` …，有名字的用名字）。插入、删除、重排后都要跑一遍。
 * 返回是否有芯片的标签被改（调用方据此决定是否 emit）。
 */
export function renumberMentionChips(root: HTMLElement, metaMap: Map<string, NodeMeta>): boolean {
  const counters: Record<string, number> = { image: 0, video: 0, audio: 0, text: 0 };
  let changed = false;
  const chips = Array.from(root.querySelectorAll<HTMLElement>('[data-ref-id]'));
  for (const chip of chips) {
    const nodeId = chip.getAttribute('data-ref-id') || '';
    const meta = metaMap.get(nodeId);
    /* 节点已不在画布上（历史残留）⇒ 保持原样，别把它改成 `Image N` */
    if (!meta) continue;
    const kind = mentionKindOf(meta.type, meta);
    counters[kind] += 1;
    const title = meta.title ?? chip.getAttribute('data-ref-title');
    const nextLabel = mentionLabelFor(title, kind, counters[kind]);
    chip.setAttribute('data-ref-title', String(title ?? ''));
    if (nextLabel === chip.getAttribute('data-ref-label')) continue;
    changed = true;
    chip.setAttribute('data-ref-label', nextLabel);
    const labelEl = chip.querySelector('.prompt-chip-label');
    if (labelEl) labelEl.textContent = nextLabel;
  }
  return changed;
}

/** 官方编辑器侧覆盖色的选择器是 `.mention-image` / `.mention-video` / `.mention-element` / `.mention-magic`；
    这里把 MTV 节点类型映射到官方那套 kind。
    ⚠️ **上传/粘贴进来的「源文件节点」（`role: 'source'`）按官方走 attachment 那档**：
       官方提及条目的 kind 就是 `mention-<item.type>`（kit `renderHTML` @592128），
       attachment 条目渲染成 `mention-<description>`（`ffe` 的行渲染里 `type === 'attachment' ? description : type`），
       那个字符串不落在 image/video/element 三个覆盖色里 ⇒ 芯片就是**基础灰 `#333333` + `rounded-[4px]` + `h-5`**。
       所以「上传的图片」在官方是灰底 r4、而「生成出来的图片节点」才是蓝胶囊（用户 图1/图2 的差异就是这个）。
       MTV 原来一律按节点类型判 image ⇒ 上传的源节点也被染成蓝胶囊 ✗。 */
function chipMentionKind(nodeType: string, meta?: NodeMeta): string {
  if (meta?.role === 'source') return 'text';
  if (nodeType === 'ai-image' || nodeType === 'ai-storyboard') return 'image';
  if (nodeType === 'ai-video') return 'video';
  return 'text';
}

/** 官方 `sme` 的 4 种类型图标（9px 白色） */
function mentionTypeIconSvg(nodeType: string): string {
  const image = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.35-4.35a1 1 0 0 0-1.41 0L4 22"/></svg>';
  const video = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-3v10l-6-3z"/></svg>';
  const audio = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  const text = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7V5h16v2M12 5v14M9 19h6"/></svg>';
  if (nodeType === 'ai-video') return video;
  if (nodeType === 'ai-audio') return audio;
  if (nodeType === 'ai-image' || nodeType === 'ai-storyboard') return image;
  return text;
}

export function buildAssetChipEl(path: string, assetUrl?: string): HTMLSpanElement {
  const name = path.split(/[\\/]/).pop() || 'asset';
  const isImage = getFileCategory(name) === 'image';
  const span = document.createElement('span');
  span.className = 'prompt-chip chip-asset';
  span.contentEditable = 'false';
  span.setAttribute('data-asset-path', path);
  if (isImage) span.setAttribute('data-image-ref-key', `asset:${encodeURIComponent(path)}`);
  const icon = document.createElement('span');
  icon.className = 'prompt-chip-icon';
  if (isImage && assetUrl) {
    const image = document.createElement('img');
    image.src = assetUrl;
    image.className = 'prompt-chip-thumb';
    image.alt = '';
    icon.appendChild(image);
  } else {
    icon.textContent = isImage ? '🖼' : '📄';
  }
  span.appendChild(icon);
  const label = document.createElement('span');
  label.className = 'prompt-chip-id';
  label.textContent = name.length > 18 ? `${name.slice(0, 16)}…` : name;
  span.appendChild(label);
  return span;
}

export function buildDramaChipEl(dramaId: string, name: string, kind: string, thumbUrl?: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `prompt-chip ${kind === 'voice' ? 'chip-audio' : kind === 'action-video' ? 'chip-video' : 'chip-image'}`;
  span.contentEditable = 'false';
  span.setAttribute('data-drama-id', dramaId);
  span.setAttribute('data-drama-label', name);
  span.setAttribute('data-drama-kind', kind);
  span.title = name;
  if (thumbUrl) span.setAttribute('data-image-ref-key', `drama:${dramaId}`);
  const icon = document.createElement('span');
  icon.className = 'prompt-chip-icon';
  if (thumbUrl) {
    const image = document.createElement('img');
    image.src = thumbUrl;
    image.className = 'prompt-chip-thumb';
    image.alt = '';
    icon.appendChild(image);
  } else {
    icon.textContent = kind === 'voice' ? '♪' : kind.startsWith('action-') ? '动' : kind === 'character' ? '人' : kind === 'scene' ? '场' : '道';
  }
  span.appendChild(icon);
  const label = document.createElement('span');
  label.className = 'prompt-chip-id';
  label.textContent = name.length > 16 ? `${name.slice(0, 14)}…` : name;
  span.appendChild(label);
  return span;
}

export function buildSkillChipEl(skillId: string, skillName: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'prompt-chip chip-skill';
  span.contentEditable = 'false';
  span.setAttribute('data-skill-id', skillId);
  span.setAttribute('data-skill-name', skillName);
  span.title = skillName;
  const icon = document.createElement('span');
  icon.className = 'prompt-chip-icon prompt-chip-skill-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '✦';
  span.appendChild(icon);
  const label = document.createElement('span');
  label.className = 'prompt-chip-skill-name';
  label.textContent = skillName.length > 20 ? `${skillName.slice(0, 18)}...` : skillName;
  span.appendChild(label);
  return span;
}

function buildWorkflowChipIconEl(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 16 16');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#f5a97f');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('d', 'M3.5 1.5h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2c0-1.1.9-2 2-2m7 7h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2c0-1.1.9-2 2-2m-6-1V10q0 1.5 1.5 1.5h2.5');
  svg.appendChild(path);
  return svg;
}

function buildChipTextEl(className: string, text: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}

export function buildWorkflowChipEl(
  ioNodeId: string,
  ioNodeTitle: string,
  ioNodeType: WorkflowIONodeType,
): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `prompt-chip prompt-chip-wf ${WF_IO_STYLE[ioNodeType] || WF_IO_STYLE.prompt}`;
  span.contentEditable = 'false';
  span.setAttribute('data-wf-id', ioNodeId);
  span.setAttribute('data-wf-title', ioNodeTitle);
  span.setAttribute('data-wf-type', ioNodeType);
  const prefix = document.createElement('span');
  prefix.className = 'prompt-chip-wf-prefix';
  prefix.contentEditable = 'false';
  prefix.appendChild(buildWorkflowChipIconEl());
  prefix.appendChild(buildChipTextEl('prompt-chip-icon', WF_IO_ICON[ioNodeType] || '?'));
  prefix.appendChild(buildChipTextEl('prompt-chip-wf-id', `#${ioNodeId}`));
  prefix.appendChild(buildChipTextEl('prompt-chip-wf-colon', ':'));
  span.appendChild(prefix);
  const valueArea = document.createElement('span');
  valueArea.className = 'prompt-chip-wf-value';
  valueArea.contentEditable = 'true';
  valueArea.appendChild(document.createElement('br'));
  span.appendChild(valueArea);
  return span;
}

function pushTextWithBreaks(nodes: Node[], text: string) {
  if (!text) return;
  text.split('\n').forEach((line, index) => {
    if (index > 0) nodes.push(document.createElement('br'));
    if (line) nodes.push(document.createTextNode(line));
  });
}

/**
 * 官方 `fwe` 的标签解码语义（严格往返才认，否则原样保留）—— `mentionTokens.ts:58`。
 * 生产端（官方 `mwe`、`selectionToolbarActions.addSelectionToChat`、`store.ui` focus-edit 回写）
 * 写的是 `encodeURIComponent(label)`，所以芯片标签必须对称解码，
 * 否则画布提示词里会出现 `%E9%A2%9D%E5%A8%98…` 这种原始百分号串（用户实测 图10）。
 */
export function decodeMentionLabel(value: string): string {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.trim() && encodeURIComponent(decoded) === value ? decoded : value;
  } catch {
    return value;
  }
}

export function renderPromptToNodes(text: string, metaMap: Map<string, NodeMeta>): Node[] {
  /* 焦点编辑的元数据 token **要渲染成芯片**（官方 `{{magic_item}}` → `mention-magic`，
     见 `vendor-pkg-canvas-CvbAwZyy.js` @1223925 的 HTML 生成器与 @307211 的 NodeView）。
     ⇒ 先把每条 token 换成占位符（对正则不可见），扫完再把芯片插回同样的位置。
     ⚠️ MTV 原来只把 token **剥掉**、另写一个 `@{nodeId:label}` 节点引用芯片 ⇒
        芯片上显示的是**目标节点的标题/文件名**，而不是识别出来的元素名（用户现场：「命名有问题」）。*/
  const magicTokens = parseMagicItemTokens(text);
  if (magicTokens.length > 0) {
    let working = '';
    let cursor = 0;
    magicTokens.forEach((token, index) => {
      working += text.slice(cursor, token.start) + `${MAGIC_CHIP_MARKER}${index}${MAGIC_CHIP_MARKER}`;
      cursor = token.end;
    });
    text = working + text.slice(cursor);
  }
  const regex = /@asset\{([^}]+)\}|@drama\{([^:]+):([^}]+)\}|@\{([^:]+):([^}]+)\}|@wf\{([^|]+)\|([^|]+)\|([^|}]+)\}|@skill\{([^|}]+)\|([^}]+)\}/g;
  const nodes: Node[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pushChip = (chip: Node) => {
    const previous = nodes[nodes.length - 1];
    if (!previous || isBrEl(previous) || isChipEl(previous)) nodes.push(document.createTextNode(ZWSP));
    nodes.push(chip);
  };

  while ((match = regex.exec(text)) !== null) {
    pushTextWithBreaks(nodes, text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      let path = match[1];
      try { path = decodeURIComponent(match[1]); } catch { /* 保留原值 */ }
      pushChip(buildAssetChipEl(path));
      lastIndex = regex.lastIndex;
    } else if (match[2] !== undefined) {
      const dramaId = match[2];
      const dramaName = match[3];
      let kind = 'character';
      let thumb: string | undefined;
      try {
        const store = useAppStore.getState();
        const { assetId, referenceImageId, actionId, actionMediaId, voiceClipId } = parseDramaMentionId(dramaId);
        const found = store.dramaAssets.characters.find((asset) => asset.id === assetId)
          || store.dramaAssets.scenes.find((asset) => asset.id === assetId)
          || store.dramaAssets.props.find((asset) => asset.id === assetId);
        if (voiceClipId !== undefined) {
          kind = 'voice';
        } else if (actionId !== undefined) {
          const media = resolveDramaActionMediaRef(found, actionId, actionMediaId);
          kind = media?.kind === 'video' ? 'action-video' : 'action-image';
          thumb = media && media.kind !== 'video' ? media.url : undefined;
        } else if (found) {
          kind = found.kind;
          const picked = referenceImageId && found.kind === 'character'
            ? found.referenceImages?.find((image) => image.id === referenceImageId)
            : undefined;
          if (picked) {
            thumb = picked.imageUrl;
          } else if (found.imageNodeId) {
            const node = store.nodes.find((candidate) => candidate.id === found.imageNodeId);
            thumb = bestNodeThumb(node?.data ?? {}) || found.imageUrl;
          } else {
            thumb = found.imageUrl;
          }
        }
      } catch {
        // 渲染失败时保留无缩略图芯片
      }
      pushChip(buildDramaChipEl(dramaId, dramaName, kind, thumb));
      lastIndex = regex.lastIndex;
    } else if (match[4] !== undefined) {
      pushChip(buildChipEl(match[4], decodeMentionLabel(match[5]), metaMap));
      lastIndex = regex.lastIndex;
    } else if (match[6] !== undefined) {
      const chip = buildWorkflowChipEl(match[6], match[7], match[8] as WorkflowIONodeType);
      const matchEnd = regex.lastIndex;
      if (text[matchEnd] === '(') {
        let depth = 1;
        let index = matchEnd + 1;
        while (index < text.length && depth > 0) {
          if (text[index] === '(') depth += 1;
          else if (text[index] === ')') depth -= 1;
          index += 1;
        }
        const valueText = text.slice(matchEnd + 1, index - 1);
        if (valueText) {
          const valueArea = chip.querySelector('.prompt-chip-wf-value');
          if (valueArea) {
            valueArea.innerHTML = '';
            for (const node of renderPromptToNodes(valueText, metaMap)) valueArea.appendChild(node);
          }
        }
        pushChip(chip);
        lastIndex = index;
        regex.lastIndex = index;
      } else {
        pushChip(chip);
        lastIndex = matchEnd;
        regex.lastIndex = matchEnd;
      }
    } else if (match[9] !== undefined) {
      let name = match[10];
      try { name = decodeURIComponent(match[10]); } catch { /* 保留原值 */ }
      pushChip(buildSkillChipEl(match[9], name));
      lastIndex = regex.lastIndex;
    }
  }
  pushTextWithBreaks(nodes, text.slice(lastIndex));
  return magicTokens.length > 0 ? spliceMagicChips(nodes, magicTokens, metaMap) : nodes;
}

/* ── 焦点编辑（官方 `magicSelection`）的芯片 ─────────────────────────────────
   官方 NodeView（`vendor-pkg-canvas-CvbAwZyy.js` @307211 `gCe`）逐字：

     <span class="mention mention-magic inline-flex items-center align-middle [mention-magic-loading]"
           data-mention-type="magic">
       识别中：  <span class="mr-1">⏳ Recognizing...</span>
       已识别：  <span class="mr-1 bg-muted rounded-full overflow-hidden">
                   <img class="size-3 aspect-square object-cover">   ← 目标节点缩略图（12×12 圆）
                 </span>
                 <span class="font-medium">{label}</span>            ← **识别出来的元素名**
       多候选且非识别中 ⇒ 尾巴一个 12×12 chevron（点开是候选下拉）
     </span>

   标签来源（官方）：`mark.label ?? token.label_name ?? "Object"` —— **永远不是节点标题** ✗
   候选下拉（官方）：选中后 `setMarkSelectedIndex` + 把 token 的 `label_name`/`box_2d`
                    就地覆写，芯片标签随之更新 ✓ */

/** 占位符（不可能出现在用户文本里；`parseMagicItemTokens` 已把 token 摘干净） */
const MAGIC_CHIP_MARKER = '\u0001';

function magicChipLabel(data: Record<string, unknown> | null, mark?: { label?: string }): string {
  const fromMark = (mark?.label ?? '').trim();
  if (fromMark) return fromMark;
  const fromToken = typeof data?.label_name === 'string' ? data.label_name.trim() : '';
  return fromToken || '对象';
}

function buildMagicChipEl(
  token: MagicItemToken,
  metaMap: Map<string, NodeMeta>,
): HTMLSpanElement {
  const data = token.data;
  const markId = typeof data?._markId === 'string' ? data._markId : '';
  const store = useAppStore.getState();
  const mark = store.focusEditMarks.find((entry) => entry.id === markId);
  const isLoading = mark ? mark.isLoading : Boolean(data?.isLoading);
  const label = magicChipLabel(data, mark);
  const nodeId = typeof data?.nodeId === 'string' ? data.nodeId : mark?.targetNodeId;
  const thumb = nodeId ? metaMap.get(nodeId)?.thumbnailUrl : undefined;
  const detections = mark?.detections ?? [];
  const hasChoices = detections.length > 1 && !isLoading;

  const chip = document.createElement('span');
  chip.setAttribute('data-magic-item', data ? JSON.stringify(data) : '');
  chip.setAttribute('data-magic-mark-id', markId);
  chip.setAttribute('data-label', label);
  chip.setAttribute('data-mention-type', 'magic');
  chip.setAttribute('contenteditable', 'false');
  chip.className = `mention mention-magic prompt-chip-magic${isLoading ? ' mention-magic-loading' : ''}`;

  if (isLoading) {
    const loading = document.createElement('span');
    loading.className = 'prompt-chip-magic-loading';
    loading.textContent = `⏳ ${t('识别中...')}`;
    chip.appendChild(loading);
    return chip;
  }

  const thumbWrap = document.createElement('span');
  thumbWrap.className = 'prompt-chip-magic-thumb';
  if (thumb) {
    const image = document.createElement('img');
    image.src = thumb;
    image.alt = '';
    thumbWrap.appendChild(image);
  } else {
    const glyph = document.createElement('span');
    glyph.className = 'prompt-chip-magic-glyph';
    glyph.textContent = '✨';
    thumbWrap.appendChild(glyph);
  }
  chip.appendChild(thumbWrap);

  const labelEl = document.createElement('span');
  labelEl.className = 'prompt-chip-magic-label';
  labelEl.textContent = label;
  chip.appendChild(labelEl);

  if (hasChoices) {
    /* 官方 `Wl`（lucide chevron-down，12×12）—— 多候选才有，点开下拉时旋转 180° */
    const chevron = document.createElement('span');
    chevron.className = 'prompt-chip-magic-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
    chip.appendChild(chevron);
  }

  /* 多候选 ⇒ 点芯片开下拉（官方 Radix DropdownMenu；MTV 用同一套「面板 + 选中圆点」视觉） */
  chip.setAttribute('role', 'button');
  chip.setAttribute('tabindex', '0');
  chip.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  chip.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMagicChipMenu(chip, markId);
  });
  return chip;
}

let activeMagicMenu: HTMLElement | null = null;

function closeMagicChipMenu(): void {
  activeMagicMenu?.remove();
  activeMagicMenu = null;
}

function toggleMagicChipMenu(chip: HTMLElement, markId: string): void {
  const openedOnThis = chip.getAttribute('data-magic-menu-open') === '1';
  closeMagicChipMenu();
  if (openedOnThis) {
    chip.removeAttribute('data-magic-menu-open');
    return;
  }
  const store = useAppStore.getState();
  const mark = store.focusEditMarks.find((entry) => entry.id === markId);
  if (!mark || mark.detections.length === 0) return;
  chip.setAttribute('data-magic-menu-open', '1');

  const panel = document.createElement('div');
  panel.className = 'prompt-chip-magic-menu';
  mark.detections.forEach((detection, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `prompt-chip-magic-menu-item${index === mark.selectedIndex ? ' is-selected' : ''}`;
    const name = document.createElement('span');
    name.className = 'prompt-chip-magic-menu-name';
    name.textContent = detection.label_name;
    item.appendChild(name);
    if (index === mark.selectedIndex) {
      const dot = document.createElement('span');
      dot.className = 'prompt-chip-magic-menu-dot';
      item.appendChild(dot);
    }
    item.addEventListener('mousedown', (event) => { event.preventDefault(); event.stopPropagation(); });
    item.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      useAppStore.getState().selectFocusEditMark(markId, index);
      closeMagicChipMenu();
    });
    panel.appendChild(item);
  });
  document.body.appendChild(panel);
  activeMagicMenu = panel;
  const rect = chip.getBoundingClientRect();
  panel.style.left = `${Math.round(rect.left)}px`;
  panel.style.top = `${Math.round(rect.bottom + 4)}px`;
  /* 点别处 / 按 Esc 关掉（官方 Radix 默认行为） */
  const onPointerDown = (event: MouseEvent) => {
    if (panel.contains(event.target as Node)) return;
    closeMagicChipMenu();
    document.removeEventListener('mousedown', onPointerDown, true);
  };
  document.addEventListener('mousedown', onPointerDown, true);
}

/** 把占位符换回 magic 芯片（保持原先的相对顺序与位置）。*/
function spliceMagicChips(
  nodes: Node[],
  tokens: MagicItemToken[],
  metaMap: Map<string, NodeMeta>,
): Node[] {
  const pattern = new RegExp(`${MAGIC_CHIP_MARKER}(\\d+)${MAGIC_CHIP_MARKER}`, 'g');
  const out: Node[] = [];
  const pushWithChips = (target: Node[], text: string) => {
    let cursor = 0;
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > cursor) target.push(document.createTextNode(text.slice(cursor, match.index)));
      const token = tokens[Number(match[1])];
      if (token) target.push(buildMagicChipEl(token, metaMap));
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) target.push(document.createTextNode(text.slice(cursor)));
  };
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').includes(MAGIC_CHIP_MARKER)) {
      pushWithChips(out, node.textContent ?? '');
      continue;
    }
    out.push(node);
  }
  return out;
}
