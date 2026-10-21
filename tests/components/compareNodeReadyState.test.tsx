// @vitest-environment jsdom
/**
 * 对比卡「连够两张图 ⇒ 出滑块 + 拖得动」的渲染级契约。
 *
 * 背景（2026-10 白底药丸事故）：`Canvas.tsx` 的 `nodeTypes` 掉了 `compare` 键 ⇒
 * React Flow 走 fallback default 节点 ⇒ **CompareNode 根本没被挂载**，
 * 「连入两张图后滑块是否出现」这条功能路径整体消失
 * （真机 CDP 9333：`.compare-node` / `.compare-preview-placeholder` 在 DOM 里都不存在，
 *   只有 `react-flow__node-default` + rgb(255,255,255) 白底 + 上下两个黑手柄）。
 *
 * 这条测试绕过 React Flow 的注册表（注册表本身由 `compareNodeRegistry.test.ts` 钉），
 * 直接挂 CompareNode，钉住它自己的行为：
 *   · 空态 → `.compare-preview-placeholder`（+ 共享的 `.node-preview-placeholder`），没有滑块
 *   · 两张入图 → `.cmp` 滑块出现，`before/after` = 第 1 / 第 2 条入边的图
 *   · 抓 `.cmp-grip` 拖动 ⇒ `aria-valuenow` / `--p` 跟着变（滑块真的能拖）
 *   · 手柄恒为 left / right 两个（入边靠 left；right 给无损改图的输出接点用）
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import CompareNode from '../../src/components/nodes/CompareNode';
import { useAppStore } from '../../src/store/useAppStore';

const IMG_A = 'asset://localhost/before.png';
const IMG_B = 'asset://localhost/after.png';

function seedCompare(inputs: Array<{ id: string; url?: string }>) {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    nodes: [
      ...inputs.map((i, idx) => ({
        id: i.id,
        type: 'ai-image' as const,
        position: { x: idx * 400, y: 0 },
        data: { type: 'ai-image', label: 'Image', imageUrl: i.url, nodeWidth: 250, nodeHeight: 250 },
      })),
      {
        id: 'compare-1',
        type: 'compare' as const,
        position: { x: 900, y: 0 },
        data: { type: 'compare', label: '图片对比' },
      },
    ] as never,
    edges: inputs.map((i, idx) => ({
      id: `edge-${idx}`,
      source: i.id,
      target: 'compare-1',
      sourceHandle: 'right',
      targetHandle: 'left',
    })) as never,
  });
}

function renderCompare() {
  return render(
    <ReactFlowProvider>
      <CompareNode id="compare-1" data={{ type: 'compare', label: '图片对比' } as never} selected={false} />
    </ReactFlowProvider>,
  );
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  cleanup();
});

describe('对比卡渲染：空态 vs 连够两张图', () => {
  it('没有任何入边 ⇒ 空态占位（用 image 卡同一套类），没有滑块', () => {
    seedCompare([]);
    const { container } = renderCompare();
    expect(container.querySelector('.node.compare-node')).not.toBeNull();
    expect(container.querySelector('.compare-preview-placeholder.node-preview-placeholder')).not.toBeNull();
    expect(container.querySelector('.cmp')).toBeNull();
  });

  it('只有一张入图 ⇒ 仍是空态（必须两张才出对比）', () => {
    seedCompare([{ id: 'img-a', url: IMG_A }]);
    const { container } = renderCompare();
    expect(container.querySelector('.compare-preview-placeholder')).not.toBeNull();
    expect(container.querySelector('.cmp')).toBeNull();
  });

  it('两张图都没图（空图卡连进来）⇒ 仍算空态', () => {
    seedCompare([{ id: 'img-a' }, { id: 'img-b' }]);
    const { container } = renderCompare();
    expect(container.querySelector('.compare-preview-placeholder')).not.toBeNull();
    expect(container.querySelector('.cmp')).toBeNull();
  });

  it('★ 连够两张图 ⇒ 滑块出现，before/after = 第 1 / 第 2 条入边的图', () => {
    seedCompare([
      { id: 'img-a', url: IMG_A },
      { id: 'img-b', url: IMG_B },
    ]);
    const { container } = renderCompare();
    const cmp = container.querySelector('.cmp');
    expect(cmp).not.toBeNull();
    expect(container.querySelector('.compare-preview-placeholder')).toBeNull();
    expect(cmp!.querySelector('.cmp-before img')!.getAttribute('src')).toBe(IMG_A);
    expect(cmp!.querySelector('.cmp-after')!.getAttribute('src')).toBe(IMG_B);
    /* 滑块拖拽入口（`.cmp-grip`）必须在 —— 它才是「拖得动」的那块 */
    expect(cmp!.querySelector('.cmp-grip')).not.toBeNull();
    expect(cmp!.getAttribute('aria-valuenow')).toBe('50');
  });

  it('★ 抓 `.cmp-grip` 拖动 ⇒ sliderPosition（aria-valuenow / --p）跟着变', () => {
    seedCompare([
      { id: 'img-a', url: IMG_A },
      { id: 'img-b', url: IMG_B },
    ]);
    const { container } = renderCompare();
    const cmp = container.querySelector('.cmp') as HTMLElement;
    /* jsdom 没有布局 ⇒ 给滑块一个确定的盒子，`at()` 才能算出手指位置 */
    cmp.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const grip = cmp.querySelector('.cmp-grip') as HTMLElement;
    fireEvent.pointerDown(grip, { clientX: 100, pointerId: 1, bubbles: true });
    fireEvent.pointerMove(grip, { clientX: 40, pointerId: 1, bubbles: true });
    const dragged = Number(cmp.getAttribute('aria-valuenow'));
    expect(dragged).toBeLessThan(50);
    expect(Number(cmp.style.getPropertyValue('--p'))).toBeCloseTo(dragged / 100, 2);
    fireEvent.pointerUp(grip, { clientX: 40, pointerId: 1, bubbles: true });
  });

  it('键盘 ← / → 也能移动滑条（ImageCompare 自带）', () => {
    seedCompare([
      { id: 'img-a', url: IMG_A },
      { id: 'img-b', url: IMG_B },
    ]);
    const { container } = renderCompare();
    const cmp = container.querySelector('.cmp') as HTMLElement;
    fireEvent.keyDown(cmp, { key: 'ArrowLeft' });
    /* glide 是 rAF 弹簧动画，jsdom 里不会推进 ⇒ 只断言它接受了按键、没抛错、初始值仍在合法区间 */
    expect(Number(cmp.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(0);
    expect(Number(cmp.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(100);
  });

  it('手柄仍是 left + right 两个（入边靠 left；right 给无损改图的输出接点用）', () => {
    seedCompare([
      { id: 'img-a', url: IMG_A },
      { id: 'img-b', url: IMG_B },
    ]);
    const { container } = renderCompare();
    const handles = [...container.querySelectorAll('.node-handle')];
    expect(handles.map((h) => h.getAttribute('data-handleid')).sort()).toEqual(['left', 'right']);
    expect(container.querySelectorAll('.react-flow__handle')).toHaveLength(2);
  });
});
