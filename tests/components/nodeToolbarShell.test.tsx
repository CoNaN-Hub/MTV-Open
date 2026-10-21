import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * NodeToolbarShell = 官方 `eT`(@1228499 `NodeFloatingLayer`) 的等价实现。
 * 这里只测**挂载边界**（官方 `u = visible && !isDragging` / `p = u || keepMounted`）与
 * **位移公式**（官方 `m = bIe.top / max(zoom,1) = -10/zoom`）—— 两者都是纯函数式行为，SSR 即可断言。
 *
 * 官方依据（`zoom-slider-3ZcFvYQO.js`）：
 *   bIe = { top:-10, bottom:14 } · yIe = e => e>0?e:1 · vIe = (placement, zoom) => bIe[placement]/yIe(zoom)
 *   const u = visible && !isDragging; const p = u || keepMounted;
 */
const driver = vi.hoisted(() => ({ zoom: 1 }));

vi.mock('@xyflow/react', () => ({
  useStore: (selector: (state: { transform: [number, number, number] }) => unknown) => (
    selector({ transform: [0, 0, driver.zoom] })
  ),
}));

import NodeToolbarShell from '../../src/components/nodes/shared/NodeToolbarShell';

function renderShell(props: {
  visible?: boolean;
  isDragging?: boolean;
  keepMounted?: boolean;
  children: ReactNode;
  placement?: 'top' | 'bottom';
}) {
  return renderToStaticMarkup(<NodeToolbarShell {...props} />);
}

beforeEach(() => {
  driver.zoom = 1;
});

describe('node toolbar mount boundary', () => {
  it('does not render toolbar children for a large initially unselected canvas', () => {
    const renderToolbar = vi.fn();
    function Toolbar() {
      renderToolbar();
      return <button>插件工具</button>;
    }

    const html = renderToStaticMarkup(
      <>
        {Array.from({ length: 1000 }, (_, index) => (
          <NodeToolbarShell key={index} visible={false}><Toolbar /></NodeToolbarShell>
        ))}
      </>,
    );

    expect(renderToolbar).not.toHaveBeenCalled();
    expect(html).not.toContain('<button');
    // 每张卡都渲染外层「pointer-events-none absolute inset-0」容器（官方 `eT` 外层 div）
    // ⚠️ 其中 `z-20` 是**承重**的：它让整条工具栏子树（含「⋯ 浏览全部」菜单）盖住
    //    节点两侧的 `+` 把手 `.node-handle`（z-index 15）。删掉它用户就会看到
    //    「+- 按钮压在浏览全部弹窗上面」（ImageNode 以前传的 className="z-10" 就是这个毛病）。
    expect(
      (html.match(/pointer-events-none absolute inset-0 z-20 overflow-visible/g) ?? []),
    ).toHaveLength(1000);
  });

  it('renders the selected toolbar immediately, on the official floating layer', () => {
    const html = renderShell({ visible: true, children: <button>复制</button> });

    expect(html).toContain('<button>复制</button>');
    // 官方 motion.div：data-node-floating-layer={placement} + origin center bottom
    expect(html).toContain('data-node-floating-layer="top"');
    expect(html).toContain('center bottom');
  });

  it('treats dragging as hidden (official u = visible && !isDragging)', () => {
    const html = renderShell({ visible: true, isDragging: true, children: <button>拖拽中</button> });

    expect(html).not.toContain('<button');
    expect(html).not.toContain('data-node-floating-layer');
  });

  it('keeps children mounted when keepMounted is set even if hidden', () => {
    const html = renderShell({ visible: false, keepMounted: true, children: <button>保持挂载</button> });

    expect(html).toContain('<button>保持挂载</button>');
    expect(html).toContain('data-node-floating-layer="top"');
  });

  it('offsets by the official -10/zoom before entering', () => {
    driver.zoom = 1;
    expect(renderShell({ visible: true, children: <span>a</span> })).toContain('translateY(-10px)');

    driver.zoom = 2;
    expect(renderShell({ visible: true, children: <span>a</span> })).toContain('translateY(-5px)');

    /* 官方 `yIe(e) = e > 0 ? e : 1`：0.5 是**正数** ⇒ 照除（-20px），不做上限夹取 */
    driver.zoom = 0.5;
    expect(renderShell({ visible: true, children: <span>a</span> })).toContain('translateY(-20px)');

    /* 只有 zoom <= 0 才落到 `yIe` 的兜底 1 ⇒ -10px */
    driver.zoom = 0;
    expect(renderShell({ visible: true, children: <span>a</span> })).toContain('translateY(-10px)');
  });

  it('uses the bottom placement offset (14/zoom) when asked', () => {
    driver.zoom = 2;
    const html = renderShell({ visible: true, placement: 'bottom', children: <span>b</span> });

    expect(html).toContain('data-node-floating-layer="bottom"');
    expect(html).toContain('translateY(7px)');
  });
});
