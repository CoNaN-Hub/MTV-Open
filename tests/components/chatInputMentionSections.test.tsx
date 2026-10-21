// @vitest-environment jsdom
/**
 * 聊天输入卡的 `@` 提及面板 = **官方 TapNow「分区单列表」**（逐字规格书
 * `D:\DEEPSEEK\_r124-official-mention-popup-spec.md`，取证对象 = 官方 `Ub`）。
 *
 * 本套件钉住 5 条硬约束：
 *  ① 面板**不再渲染 Tab 行**（官方 `Ub` = 搜索行 + **一个滚动列表 + 多分区**，规格书 §0-1/§1）；
 *  ② 分区标题 = 官方 `tm`（`mention-group-label` / `mention-group-hint`，规格书 §3）+ 官方 zh 文案
 *     （`omniReference.suggestion.*`，规格书 §4/§5）；
 *  ③ 每段默认 3 条 ⇒ 第 4 条起是「还有 N 个结果」（`MentionPicker` 的 `mention-row-more`）；
 *  ④ 节点行名字仍是官方 `Image N` 口径（不许退回 `data.label` 的「生成图像」）；
 *  ⑤ **缺数据的段整段不出现**（铁律：不造空段）；**官方没有模型段** ⇒ `@` 面板里不得有模型行。
 *  外加：点消息里的 `@model{}` 芯片（`chat-open-reference-menu`）要打开**模型菜单**，
 *        不是那个已经没有模型段的 `@` 面板（不许留下空面板死胡同）。
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ChatInput from '../../src/components/chat/ChatInput';
import { useAppStore } from '../../src/store/useAppStore';
import { setLocale } from '../../src/i18n';
import type { MediaModelOption } from '../../src/components/nodes/shared/defaultModels';

afterEach(cleanup);

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

const MEDIA_MODEL: MediaModelOption = {
  value: 'apimart/wan-2.5',
  provider: 'apimart',
  label: 'Wan 2.5',
  description: '视频生成模型',
  nodeTypes: ['ai-video'],
  mediaKind: 'video',
  groupId: 'apimart',
  groupName: 'APIMart',
};

/** 5 个**未命名**图片节点：`data.label` 是遗留类型默认名「生成图像」⇒ 必须显示成 `Image N`。 */
const UNNAMED_IMAGE_NODES = Array.from({ length: 5 }, (_, index) => ({
  id: `n${index + 1}`,
  position: { x: index * 10, y: 0 },
  data: { type: 'ai-image', label: '生成图像', displayId: index + 1 },
}));

function setStore(patch: Record<string, unknown>) {
  useAppStore.setState(patch as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
}

function renderComposer(overrides: Partial<React.ComponentProps<typeof ChatInput>> = {}) {
  return render(
    <ChatInput
      onAssistantModelChange={vi.fn()}
      mediaModels={[]}
      mediaModelOptions={[]}
      mediaModelAvailability={{}}
      inputValue=""
      onInputChange={vi.fn()}
      onSend={vi.fn()}
      {...overrides}
    />,
  );
}

/** 在输入框里敲出 `@`，让 `ChatInput` 打开官方提及面板（读 caret 前的文本 ⇒ 必须先放光标）。 */
function openMentionPanel(container: HTMLElement) {
  const editor = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
  expect(editor).not.toBeNull();
  editor!.textContent = '@';
  const range = document.createRange();
  range.selectNodeContents(editor!);
  range.collapse(false);
  const selection = window.getSelection();
  expect(selection).not.toBeNull();
  selection!.removeAllRanges();
  selection!.addRange(range);
  fireEvent.input(editor!);
  return editor!;
}

const groupLabels = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.mention-group-label')).map((el) => el.textContent);

const listboxLabel = (container: HTMLElement) =>
  container.querySelector('[role="listbox"]')?.getAttribute('aria-label');

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  setLocale('zh-CN');
});

describe('官方「分区单列表」—— 结构', () => {
  it('① 不再渲染 Tab 行；分区标题 = 官方 `tm`（标题 + 官方 hint）', () => {
    setStore({ nodes: UNNAMED_IMAGE_NODES.slice(0, 2) });
    const { container } = renderComposer();
    openMentionPanel(container);

    /* ★ 官方 `Ub` 里**没有** Tab 行（规格书 §0-1：官方是「一个滚动列表 + 多个分区」）。 */
    expect(container.querySelector('.mention-picker-tabs')).toBeNull();
    expect(container.querySelector('[role="tablist"]')).toBeNull();

    /* ★ 官方聊天宿主的 linked 段标题 = `linkedSectionLabel`
       `m("chatAdapter.context.addReference", "Add reference")`（r127 @2578264）⇒ zh「添加参考」。
       面板那行是 `children: l || C("omniReference.suggestion.linkedNodeSection")`（r127 @257958）
       ⇒ 只有**不传 label 的宿主**才显示「已连接节点」。 */
    const title = screen.getByText('添加参考');
    expect(title.className).toBe('mention-group-label');
    /* 官方 `nm`（r100 `tm`）：`flex items-center justify-between gap-2 px-1 py-1`。 */
    expect(title.parentElement!.className).toBe('mention-group-header');
    /* 不传 label 的宿主兜底文案在聊天面板里**不许**出现。 */
    expect(screen.queryByText('已连接节点')).toBeNull();
    /* 官方全列表只有这一段带 `hint` = `linkedNodeShortcutHint`「输入序号快选」。 */
    const hint = screen.getByText('输入序号快选');
    expect(hint.className).toBe('mention-group-hint');
  });

  it('② 每段超过 3 条 ⇒ 第 4 行是官方「还有 N 个结果」', () => {
    setStore({ nodes: UNNAMED_IMAGE_NODES });
    const { container } = renderComposer();
    openMentionPanel(container);

    const group = container.querySelector('[data-mention-group="nodes"]') as HTMLElement;
    expect(group).not.toBeNull();
    /* 官方 `Is = 3`：默认 3 条 + 一条「还有 N 个结果」。 */
    expect(group.querySelectorAll('[role="option"]')).toHaveLength(3);
    const more = group.querySelector('.mention-row-more') as HTMLElement;
    /* 官方 `omniReference.suggestion.showMoreResults` =「还有 {{count}} 个结果」。 */
    expect(more.textContent).toBe('还有 2 个结果');
  });

  it('③ 节点行名字仍是官方 `Image N`（防回退到 `data.label`）', () => {
    setStore({ nodes: UNNAMED_IMAGE_NODES });
    const { container } = renderComposer();
    openMentionPanel(container);

    expect(screen.getByText('Image 1', { selector: '.mention-row-label' })).not.toBeNull();
    expect(screen.getByText('Image 3', { selector: '.mention-row-label' })).not.toBeNull();
    /* 遗留类型默认名「生成图像」不许出现在面板里（那是回退）。 */
    expect(screen.queryByText('生成图像', { selector: '.mention-row-label' })).toBeNull();
    /* 展开「还有 2 个结果」后编号继续（该行是 `onMouseDown` 阻止默认 + `onClick` 展开）。 */
    fireEvent.click(container.querySelector('.mention-row-more') as HTMLElement);
    expect(screen.getByText('Image 5', { selector: '.mention-row-label' })).not.toBeNull();
  });

  it('④ 缺数据的段整段不出现（不造空段）', () => {
    setStore({ nodes: UNNAMED_IMAGE_NODES.slice(0, 1) });
    const { container } = renderComposer();
    openMentionPanel(container);

    const labels = groupLabels(container);
    /* 只有 linked 段有数据 ⇒ 只有它一段；官方其它段（应用/元素库/素材库/指令）都不许空出现。 */
    expect(labels).toEqual(['添加参考']);
    expect(container.querySelectorAll('[data-mention-group]')).toHaveLength(1);
    expect(screen.queryByText('应用', { selector: '.mention-group-label' })).toBeNull();
    expect(screen.queryByText('个人素材库', { selector: '.mention-group-label' })).toBeNull();
  });

  it('⑤ 短剧资产有数据时才出现素材库段，标题 = 官方 `privateSection`「个人素材库」', () => {
    setStore({
      nodes: [],
      dramaAssets: {
        characters: [{ id: 'c1', name: '阿离', kind: 'character', identity: '主角' }],
        scenes: [],
        props: [],
      },
    });
    const { container } = renderComposer();
    openMentionPanel(container);
    expect(groupLabels(container)).toEqual(['个人素材库']);
    /* ⚠️ 官方 `Ub` 在该位置**不渲染** `myLibrarySection`「我的素材库」（规格书 §4 注）⇒ 防回退。 */
    expect(screen.queryByText('我的素材库', { selector: '.mention-group-label' })).toBeNull();
    expect(screen.getByText('阿离', { selector: '.mention-row-label' })).not.toBeNull();
  });
});

describe('官方「@」面板没有模型段 + 模型入口不落在空面板', () => {
  it('⑥ `@` 面板里不出现模型行（官方 `omniReference.suggestion.*` 无模型键）', () => {
    setStore({ nodes: UNNAMED_IMAGE_NODES.slice(0, 1) });
    const { container } = renderComposer({
      mediaModelOptions: [MEDIA_MODEL],
      mediaModelAvailability: { [MEDIA_MODEL.value]: true },
    });
    openMentionPanel(container);

    expect(listboxLabel(container)).toBe('节点与资产引用');
    expect(screen.queryByText('Wan 2.5')).toBeNull();
    expect(groupLabels(container)).not.toContain('模型');
    /* ★ 模型口那套修饰（行 `mention-row--model-menu` + 面板 `mention-picker--model-menu`）只允许出现在
       模型口 —— `@` 面板走官方 `ffe` 的 `Ta`/`aL`（`rounded-[6px]` + `hover:bg-white/10` + 缩略图框 +
       `#序号`），一个都不许带上（口径见 `styles/mention-picker.css`）。 */
    expect(container.querySelectorAll('.mention-scroll [role="option"]').length).toBeGreaterThan(0);
    expect(container.querySelector('.mention-row--model-menu')).toBeNull();
    expect(container.querySelector('.mention-picker--model-menu')).toBeNull();
    /* `@` 面板行**必须**保留官方那套解剖：缩略图框（`CN`/`Mc`）与 `#序号` 都在。 */
    expect(container.querySelector('.mention-scroll [role="option"] .mention-row-thumb')).not.toBeNull();
    expect(container.querySelector('.mention-scroll [role="option"] .mention-row-index')).not.toBeNull();
  });

  it('⑦ 点消息里的 `@model{}` 芯片（`chat-open-reference-menu`）打开**模型菜单**，不是 `@` 面板', () => {
    const { container } = renderComposer({
      mediaModelOptions: [MEDIA_MODEL],
      mediaModelAvailability: { [MEDIA_MODEL.value]: true },
    });
    act(() => {
      window.dispatchEvent(new CustomEvent('chat-open-reference-menu', { detail: { kind: 'model', modelId: MEDIA_MODEL.value } }));
    });

    /* 模型菜单：有模型行 + 有媒体类型芯片 + **没有**官方分区标题（不是 `@` 面板）。
       ⚠️ 行文案走 `useModelNameResolver` 的展示名（映射表命中不到时退化为原始 id）
       ⇒ 这里不断言具体字面量，只断言「有行、行名非空、形态是模型菜单」。 */
    const rows = container.querySelectorAll('.mention-scroll [role="option"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].querySelector('.mention-row-model-label')!.textContent).toBeTruthy();
    expect(listboxLabel(container)).toBe('模型');
    expect(container.querySelectorAll('.mention-group-label')).toHaveLength(0);
    expect(container.querySelector('.mention-picker-tabs')).toBeNull();
    expect(container.querySelectorAll('.mention-picker-chip').length).toBeGreaterThan(0);
    /* ★ 模型口的每一行都要带 `mention-row--model-menu`：官方那两处行样式**不同**（模型菜单行 =
       `rounded-xl` 16px + `focus:bg-accent` #404040 + `min-h-10 px-3 py-2`；`@` 面板行 =
       `rounded-[6px]` + `hover:bg-white/10` + 有缩略图框/`#序号`）
       ⇒ 模型口必须拆到修饰类上（用户报告：「hover 的底色 圆角 不对」）。 */
    for (const row of Array.from(rows)) {
      expect(row.classList.contains('mention-row--model-menu')).toBe(true);
      /* 官方模型行的解剖（r127 @2264900）：`<span class="flex min-w-0 items-center gap-1.5">`
         + `<img class="h-4 w-4 shrink-0 rounded-sm">` + `<span class="truncate">`，右侧只有 lock/check
         ⇒ **没有** 24px 缩略图框（`@` 面板行的 `CN`/`Mc`）、**没有** `#序号`、**没有** 行尾类型徽标。 */
      expect(row.querySelector('.mention-row-model-label')).not.toBeNull();
      expect(row.querySelector('.mention-row-thumb')).toBeNull();
      expect(row.querySelector('.mention-row-index')).toBeNull();
      expect(row.querySelector('.mention-row-type')).toBeNull();
    }
    /* 面板容器：模型口另挂一套（官方模型菜单面板 #262626 / r10 / 1px 边 / p-2 / 248×400） */
    expect(container.querySelector('.mention-picker--model-menu')).not.toBeNull();
  });

  it('⑧ 模型菜单即使没有可用模型也不是「官方 `@` 面板的模型 Tab」（不再有死胡同）', () => {
    const { container } = renderComposer();
    act(() => {
      window.dispatchEvent(new CustomEvent('chat-open-reference-menu', { detail: { kind: 'model', modelId: 'x' } }));
    });
    expect(listboxLabel(container)).toBe('模型');
    expect(screen.getByText('暂无可引用的模型')).not.toBeNull();
    expect(container.querySelectorAll('.mention-group-label')).toHaveLength(0);
  });

  it('⑨ 模型菜单点行仍插入官方 `@model{id|label}`（模型引用入口仍可达）', () => {
    const onInputChange = vi.fn();
    const { container } = renderComposer({
      mediaModelOptions: [MEDIA_MODEL],
      mediaModelAvailability: { [MEDIA_MODEL.value]: true },
      onInputChange,
    });
    act(() => {
      window.dispatchEvent(new CustomEvent('chat-open-reference-menu', { detail: { kind: 'model', modelId: MEDIA_MODEL.value } }));
    });
    const row = container.querySelector('.mention-scroll [role="option"]') as HTMLElement;
    expect(row).not.toBeNull();
    fireEvent.mouseDown(row);
    expect(onInputChange).toHaveBeenCalled();
    const next = onInputChange.mock.calls[onInputChange.mock.calls.length - 1][0] as string;
    /* `ChatComposerEditor.serializeReference`：`@model{${id}|${label}}`（id = `model.value`，原样保留）。 */
    expect(next).toContain(`@model{${MEDIA_MODEL.value}|`);
  });
});

describe('素材库段：同一份数据、同一个官方键（两个界面不许各写各的）', () => {
  it('⑩ 聊天 `@` 面板与节点提示词 `MentionEditor` 都走 `MENTION_PRIVATE_SECTION`，都不再用 `MENTION_MY_LIBRARY`', () => {
    const chat = read('src/components/chat/ChatInput.tsx');
    const editor = read('src/components/nodes/shared/MentionEditor.tsx');
    for (const [name, source] of [['ChatInput', chat], ['MentionEditor', editor]] as const) {
      expect(source, `${name} 必须用官方 privateSection 那个常量`).toContain('MENTION_PRIVATE_SECTION');
      /* 官方 `Ub` 在该位置不渲染 `myLibrarySection` ⇒ 常量不许再被使用（规格书 §4 注）。 */
      expect(source, `${name} 不许再使用 myLibrarySection 常量`).not.toContain('MENTION_MY_LIBRARY');
    }
    /* 三处段落标签同源：常量只在 `MentionPicker.tsx` 定义一次。 */
    const picker = read('src/components/shared/MentionPicker.tsx');
    expect(picker).toContain("export const MENTION_PRIVATE_SECTION = '个人素材库';");
  });
});
