// @vitest-environment jsdom
/**
 * 「画布素材预览」对话框（官方 `Ko`/`Yo`/`ns`/`qv` + 本地 `pIt`）的 DOM 与分支回归。
 *
 * 官方逐字链（`vendor-pkg-canvas-CvbAwZyy.js`）：
 * ```js
 * // @4564243 邻域（`uIt` 内）
 * s.jsx(Ko,{open:p!==null,onOpenChange:C=>!C&&m(null),children:s.jsxs(Yo,{className:"flex max-h-[90dvh] max-w-4xl flex-col",children:[
 *   s.jsxs(pl,{children:[s.jsx(ns,{children:l("画布素材预览","Canvas resource preview")}),
 *     s.jsx(qv,{children:String(u(p??"")?.data?.title??p??"")})]}),
 *   s.jsx(pIt,{node:u(p??"")}),
 *   s.jsx(Kme,{to:`/canvas/${…}?focus_node=${…}`,className:"self-end text-sm underline",children:l("在画布中打开","Open in Canvas")})]})})
 *
 * // @4565328  pIt（正文四条分支）
 * function pIt({node:e}){const{i18n:t}=se(),n=e?.data??{},o=typeof n.src=="string"?n.src:"";
 *   return e?.type==="image"&&o ? s.jsx("img",{src:o,alt:String(n.title??""),className:"min-h-0 max-h-[65dvh] object-contain"})
 *    : ["video","videoEdit"].includes(e?.type??"")&&o ? s.jsx("video",{src:o,controls:!0,playsInline:!0,className:"min-h-0 max-h-[65dvh]"})
 *    : e?.type==="audio"&&o ? s.jsx("audio",{src:o,controls:!0})
 *    : s.jsx("div",{className:"min-h-0 overflow-y-auto whitespace-pre-wrap text-sm",
 *         children:String(n.text??n.content??(t.language.startsWith("zh")?"在画布中查看此素材。":"Open this resource in Canvas."))})}
 *
 * // @152784  jc —— 这些缩略图/mention 的点击出口（宿主桥 `focusCanvasNodes`）
 * function jc(){const{fitView:e}=pt(),n=Ic()?.focusCanvasNodes;return{fitView:a.useCallback(async r=>{
 *   if(!n)return e(r);const i=r?.nodes?.map(l=>l.id)??[];return i.length?(n(i),!0):!1},[e,n])}}
 * ```
 *
 * ⚠️ 本文件钉的是**官方行为**：
 *   ① 四条分支按 `node.type` 分派，且 **MTV 的 `ai-*` 必须先归一到官方字面量**；
 *   ② `videoEdit` 也算视频（最容易漏的一条）；
 *   ③ 非 image/video/audio（含取不到节点）一律走**文本分支**；
 *   ④ 节点不存在时标题**退化成 nodeId**（官方 `?? p ?? ""`），**不是** toast。
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node as FlowNode } from '@xyflow/react';
import CanvasResourcePreviewDialog, {
  CanvasResourcePreviewBody,
} from '../../src/components/chat/CanvasResourcePreviewDialog';
import ChatReferenceText from '../../src/components/chat/ChatReferenceText';
import {
  CANVAS_RESOURCE_PREVIEW_EVENT,
  onCanvasResourcePreview,
  openCanvasResourcePreview,
} from '../../src/services/chat/canvasResourcePreview';
import { setLocale, t } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { BaseNodeData, NodeType } from '../../src/types';

/** 官方 `ha`（= canvas chunk 的 `Yo`，`vendor-packages-DRvCmDjR.js` @410310）基类逐字。 */
const DIALOG_BASE_CLASS = 'fixed left-[50%] top-[50%] z-50 bg-popover text-popover-foreground rounded-lg min-w-[300px] p-4 max-w-none translate-x-[-50%] translate-y-[-50%]';
/** 官方调用点 className（canvas @4564243 邻域逐字）。 */
const DIALOG_CALLSITE_CLASS = 'flex max-h-[90dvh] max-w-4xl flex-col';
/** 官方 `k0` 遮罩（@409931 逐字）。 */
const OVERLAY_CLASS = 'fixed inset-0 z-50 bg-black/80';
/** 官方 `qo` / `Lr` / `O0` 基类（@411124 / @411451 逐字）。 */
const HEADER_CLASS = 'flex flex-col space-y-1.5 text-center sm:text-left';
const TITLE_CLASS = 'text-lg font-semibold leading-none tracking-tight';
const DESCRIPTION_CLASS = 'text-sm text-muted-foreground';

function canvasNode(
  id: string,
  type: NodeType,
  data: Record<string, unknown> = {},
): FlowNode<BaseNodeData> {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: `节点 ${id}`, type, ...data } as unknown as BaseNodeData,
  };
}

/** 直接把节点塞进 store（`getCanvasNodeById` 读的就是 `state.nodes`）。 */
function mountNode(id: string, type: NodeType, data: Record<string, unknown> = {}): void {
  useAppStore.setState({ nodes: [canvasNode(id, type, data)] });
}

const dialogContent = () => document.querySelector('[data-testid="common-dialog-content"]');

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  cleanup();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('官方 `pIt` 正文四条分支', () => {
  it('图片：`ai-image` 归一到官方 `image` ⇒ `<img>` + 逐字类串', () => {
    const { container } = render(<CanvasResourcePreviewBody node={canvasNode('n1', 'ai-image', { label: '首帧', imageUrl: 'https://cdn.test/a.png' })} />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://cdn.test/a.png');
    expect(img.getAttribute('alt')).toBe('首帧');
    expect(img.getAttribute('class')).toBe('min-h-0 max-h-[65dvh] object-contain');
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('audio')).toBeNull();
  });

  it('图片：官方字面量 `image` + 官方字段 `src` 同样命中（官方路径优先）', () => {
    const { container } = render(
      <CanvasResourcePreviewBody node={{ type: 'image', data: { title: 'T', src: 'https://cdn.test/src.png' } }} />,
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.test/src.png');
    expect(img.getAttribute('alt')).toBe('T');
  });

  it('视频：`videoEdit` 也算视频（`["video","videoEdit"].includes(type)`）', () => {
    const { container } = render(
      <CanvasResourcePreviewBody node={{ type: 'videoEdit', data: { src: 'https://cdn.test/e.mp4' } }} />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.getAttribute('src')).toBe('https://cdn.test/e.mp4');
    expect(video.controls).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.getAttribute('class')).toBe('min-h-0 max-h-[65dvh]');
    expect(container.querySelector('img')).toBeNull();
  });

  it('视频：MTV 的 `ai-video` 归一到官方 `video`，源取 `videoUrl`', () => {
    const { container } = render(
      <CanvasResourcePreviewBody node={canvasNode('n2', 'ai-video', { videoUrl: 'https://cdn.test/v.mp4' })} />,
    );
    expect((container.querySelector('video') as HTMLVideoElement).getAttribute('src'))
      .toBe('https://cdn.test/v.mp4');
  });

  it('音频：`ai-audio` 归一到官方 `audio` ⇒ `<audio controls>`（类串官方未给）', () => {
    const { container } = render(
      <CanvasResourcePreviewBody node={canvasNode('n3', 'ai-audio', { mediaUrl: 'https://cdn.test/a.mp3' })} />,
    );
    const audio = container.querySelector('audio') as HTMLAudioElement;
    expect(audio).not.toBeNull();
    expect(audio.getAttribute('src')).toBe('https://cdn.test/a.mp3');
    expect(audio.controls).toBe(true);
    expect(audio.getAttribute('class')).toBeNull();
  });

  it('非 image/video/audio ⇒ **文本分支**（首尾两条 `: s.jsx("div"…)` 都落这里）', () => {
    const { container } = render(
      <CanvasResourcePreviewBody node={canvasNode('n4', 'ai-text', { label: '文案', output: '正文内容' })} />,
    );
    const div = container.querySelector('div') as HTMLDivElement;
    expect(div.getAttribute('class')).toBe('min-h-0 overflow-y-auto whitespace-pre-wrap text-sm');
    expect(div.textContent).toBe('正文内容');
    expect(container.querySelector('img, video, audio')).toBeNull();
  });

  it('文本分支：`text` > `content` > MTV `output` > 官方兜底文案', () => {
    const withText = render(
      <CanvasResourcePreviewBody node={{ type: 'text', data: { text: 'T', content: 'C', output: 'O' } }} />,
    );
    expect(withText.container.querySelector('div')!.textContent).toBe('T');
    withText.unmount();

    const withContent = render(
      <CanvasResourcePreviewBody node={{ type: 'text', data: { content: 'C', output: 'O' } }} />,
    );
    expect(withContent.container.querySelector('div')!.textContent).toBe('C');
    withContent.unmount();

    const withOutput = render(
      <CanvasResourcePreviewBody node={{ type: 'text', data: { output: 'O' } }} />,
    );
    expect(withOutput.container.querySelector('div')!.textContent).toBe('O');
    withOutput.unmount();

    /* 官方 `t.language.startsWith("zh") ? "在画布中查看此素材。" : "Open this resource in Canvas."` */
    const fallback = render(<CanvasResourcePreviewBody node={{ type: 'text', data: {} }} />);
    expect(fallback.container.querySelector('div')!.textContent).toBe('在画布中查看此素材。');
  });

  it('取不到节点（`u(p??"")` === undefined）⇒ 文本分支 + 官方兜底文案', () => {
    const { container } = render(<CanvasResourcePreviewBody node={undefined} />);
    expect(container.querySelector('div')!.getAttribute('class'))
      .toBe('min-h-0 overflow-y-auto whitespace-pre-wrap text-sm');
    expect(container.querySelector('div')!.textContent).toBe('在画布中查看此素材。');
  });

  it('节点类型归一：MTV 的 `source-video` / `source-audio` 也能命中（不只 `ai-*`）', () => {
    const video = render(
      <CanvasResourcePreviewBody node={canvasNode('n5', 'source-video', { videoUrl: 'v.mp4' })} />,
    );
    expect(video.container.querySelector('video')).not.toBeNull();
    video.unmount();
    const audio = render(
      <CanvasResourcePreviewBody node={canvasNode('n6', 'source-audio', { mediaUrl: 'a.mp3' })} />,
    );
    expect(audio.container.querySelector('audio')).not.toBeNull();
  });
});

describe('对话框外壳（官方 `Ko`/`Yo`/`ns`/`qv` + `ha` 的 `showClose` 默认 true）', () => {
  it('`nodeId === null` ⇒ 什么都不渲染（官方 `open: p !== null`）', () => {
    render(<CanvasResourcePreviewDialog nodeId={null} onClose={() => {}} onOpenInCanvas={() => {}} />);
    expect(dialogContent()).toBeNull();
    expect(document.querySelector('[data-testid="common-dialog-container"]')).toBeNull();
  });

  it('外壳：遮罩 / 内容 / 标题 / 描述 / 关闭键的类串与 testid 逐字', () => {
    mountNode('n1', 'ai-image', { label: '首帧', imageUrl: 'https://cdn.test/a.png' });
    render(<CanvasResourcePreviewDialog nodeId="n1" onClose={() => {}} onOpenInCanvas={() => {}} />);

    const overlay = document.querySelector('[data-testid="common-dialog-container"]') as HTMLElement;
    expect(overlay.getAttribute('class')).toBe(OVERLAY_CLASS);
    expect(overlay.getAttribute('data-state')).toBe('open');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');

    const content = dialogContent() as HTMLElement;
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(content.getAttribute('class')).toBe(`${DIALOG_BASE_CLASS} ${DIALOG_CALLSITE_CLASS}`);
    expect(content.getAttribute('data-state')).toBe('open');

    const header = content.children[0] as HTMLElement;
    expect(header.getAttribute('class')).toBe(HEADER_CLASS);
    const title = header.children[0] as HTMLElement;
    expect(title.tagName).toBe('H2');
    expect(title.getAttribute('class')).toBe(TITLE_CLASS);
    expect(title.textContent).toBe('画布素材预览');
    const description = header.children[1] as HTMLElement;
    expect(description.tagName).toBe('P');
    expect(description.getAttribute('class')).toBe(DESCRIPTION_CLASS);
    expect(description.textContent).toBe('首帧');

    /* 官方 `ha` 的 `Wg`(`Dialog.Close`)：`showClose` 默认 `true` ⇒ 恒有这颗 ✕，`sr-only` 恒为字面 `Close`。 */
    const close = document.querySelector('[data-testid="common-dialog-close-btn"]') as HTMLButtonElement;
    expect(close).not.toBeNull();
    expect(close.parentElement).toBe(content);
    expect(close.querySelector('span.sr-only')!.textContent).toBe('Close');
  });

  it('标题栏描述：节点不存在时退化成 nodeId（官方 `?? p ?? ""`），**不弹 toast**', () => {
    render(<CanvasResourcePreviewDialog nodeId="ghost" onClose={() => {}} onOpenInCanvas={() => {}} />);
    const content = dialogContent() as HTMLElement;
    expect((content.children[0].children[1] as HTMLElement).textContent).toBe('ghost');
    /* 不存在 ⇒ `u(p)` 为 undefined ⇒ 正文退化成文本分支的官方兜底串。 */
    expect(content.querySelector('div.min-h-0.overflow-y-auto')!.textContent).toBe('在画布中查看此素材。');
  });

  it('底部「在画布中打开」= MTV 适配点（无 router）⇒ 回调 `onOpenInCanvas(nodeId)`', () => {
    mountNode('n1', 'ai-text', { output: '正文' });
    const onOpenInCanvas = vi.fn();
    render(<CanvasResourcePreviewDialog nodeId="n1" onClose={() => {}} onOpenInCanvas={onOpenInCanvas} />);
    const link = Array.from(document.querySelectorAll('button'))
      .find((el) => el.textContent === '在画布中打开') as HTMLButtonElement;
    expect(link.getAttribute('class')).toBe('self-end text-sm underline');
    fireEvent.click(link);
    expect(onOpenInCanvas).toHaveBeenCalledTimes(1);
    expect(onOpenInCanvas).toHaveBeenCalledWith('n1');
  });

  it('Esc / 点遮罩 / ✕ 都走官方 `onOpenChange(false)` ⇒ `onClose`', () => {
    mountNode('n1', 'ai-text');
    const onClose = vi.fn();
    render(<CanvasResourcePreviewDialog nodeId="n1" onClose={onClose} onOpenInCanvas={() => {}} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(document.querySelector('[data-testid="common-dialog-container"]')!);
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(document.querySelector('[data-testid="common-dialog-close-btn"]')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('i18n：官方只做 zh/en 二选一，ja/ko 按官方回落英文', () => {
  it('zh 取官方中文原文；en/ja/ko 取官方英文原文', () => {
    setLocale('zh-CN');
    expect(t('画布素材预览')).toBe('画布素材预览');
    expect(t('在画布中打开')).toBe('在画布中打开');
    expect(t('在画布中查看此素材。')).toBe('在画布中查看此素材。');

    for (const locale of ['en-US', 'ja-JP', 'ko-KR'] as const) {
      setLocale(locale);
      expect(t('画布素材预览')).toBe('Canvas resource preview');
      expect(t('在画布中打开')).toBe('Open in Canvas');
      expect(t('在画布中查看此素材。')).toBe('Open this resource in Canvas.');
    }
  });

  it('非 zh 时正文兜底串也是英文（官方 `l(C,N)` 的 N 支）', () => {
    setLocale('en-US');
    const { container } = render(<CanvasResourcePreviewBody node={undefined} />);
    expect(container.querySelector('div')!.textContent).toBe('Open this resource in Canvas.');
  });
});

describe('宿主桥事件通道（官方 `jc()` → `focusCanvasNodes`）', () => {
  it('`openCanvasResourcePreview` 派发事件、`onCanvasResourcePreview` 收得到并可退订', () => {
    const seen: string[] = [];
    const off = onCanvasResourcePreview((nodeId) => seen.push(nodeId));
    openCanvasResourcePreview('n1');
    openCanvasResourcePreview('');
    off();
    openCanvasResourcePreview('n2');
    expect(seen).toEqual(['n1']);
  });

  it('事件名与 `detail.nodeId` 形状（`ChatPanel` 订阅的就是它）', () => {
    const listener = vi.fn();
    window.addEventListener(CANVAS_RESOURCE_PREVIEW_EVENT, listener);
    openCanvasResourcePreview('n9');
    window.removeEventListener(CANVAS_RESOURCE_PREVIEW_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent<{ nodeId: string }>).detail).toEqual({ nodeId: 'n9' });
  });

  it('★ 点 mention chip **只居中镜头、不弹预览框**（官方主画布页的行为）', () => {
    /* `missing` 分支要求 `currentProjectId` 非空才会拦成 toast ⇒ 显式置空，确保走 activateNode。 */
    useAppStore.setState({ currentProjectId: null });
    const preview: string[] = [];
    const batches: unknown[] = [];
    const singles: unknown[] = [];
    const off = onCanvasResourcePreview((nodeId) => preview.push(nodeId));
    const batchListener = (event: Event) => batches.push((event as CustomEvent).detail);
    const singleListener = (event: Event) => singles.push((event as CustomEvent).detail);
    window.addEventListener('canvas-focus-nodes', batchListener);
    window.addEventListener('canvas-focus-node', singleListener);

    const { container } = render(<ChatReferenceText value="看 @{n1:hello} 这张" compact />);
    fireEvent.click(container.querySelector('button')!);

    window.removeEventListener('canvas-focus-nodes', batchListener);
    window.removeEventListener('canvas-focus-node', singleListener);
    off();
    /* 用户 2026 口径：「两个 chip 点击都可以自动定位到相关卡片到画布中央」+「点击 chip 为什么会出预览框？」
       ⇒ 官方**主画布页**的出口就是 `ID` 的 `w`：`jc().fitView({nodes:[{id}], ...jwe})`
         （`jwe = {padding:1,maxZoom:2,minZoom:.5,duration:500}`，见 `focusCanvasNode`）。
       ⚠️ 那个 `focusCanvasNodes` 宿主桥只存在于 **Studio 嵌画布**（`uIt`@4562700）；
         真机实测（CDP 9222 真鼠标点官方 chip）：**无弹窗、无 popper**。
       ⇒ chip 点击 **只**居中镜头；预览框那半是我上一轮多做出来的，已去掉。 */
    expect(batches).toEqual([{ nodeIds: ['n1'], padding: 1, maxZoom: 2, duration: 500 }]);
    expect(singles).toEqual([]);
    expect(preview).toEqual([]);
  });
});
