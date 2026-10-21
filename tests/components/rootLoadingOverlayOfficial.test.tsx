// @vitest-environment jsdom
/**
 * MTV 根加载屏 = 官方 **根加载屏** `loading-overlay-DoLoNJJU.js` 的 1:1 复刻回归。
 *
 * ── 为什么单开本文件 ────────────────────────────────────────────────────────
 * `src/components/shared/LazyLoadBoundary.tsx` 有两个变体：
 *   · `variant === 'root'`    → 本轮**照官方逐字重写**，由本文件钉死；
 *   · `variant === 'feature'` → 本轮**一个字都没动**，本文件只做「原样未变」的快照断言。
 * 另外一个**不在本轮白名单**的文件 `tests/styles/canvasTokensRemoved.test.ts` 也读这个组件的
 * 源码（它钉的是令牌清理，与本文件关注点不同），故不合并。
 *
 * ── 官方依据（新构建哈希 `3ba264df7660179133784731923a0a6ab5d87cf0`）────────────
 * `D:\DEEPSEEK\live-assets-r100\loading-overlay-DoLoNJJU.js`（全文 1,325 字节）逐字：
 * ```js
 * const n="https://fe-assets.tapnow.media/3ba264df76…/assets/loading-BWU_g4Wm.webp",
 * r=()=>a.jsxs(t.div,{
 *   role:"status","aria-live":"polite","aria-label":"Loading canvas",
 *   className:"fixed inset-0 z-50 flex items-center justify-center bg-black",
 *   initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},
 *   transition:{duration:1,ease:"easeOut"},
 *   "data-testid":s.COMMON.LOADING.OVERLAY,
 *   children:[
 *     a.jsx(t.div,{
 *       initial:{opacity:0,scale:.95},animate:{opacity:1,scale:1},exit:{opacity:0,scale:1},
 *       transition:{duration:.3,delay:.1,ease:"easeOut",exit:{duration:.8,ease:"easeOut"}},
 *       children:a.jsx(t.img,{src:n,alt:"Loading",className:"w-16 h-16 object-contain",
 *         animate:{scale:[.95,1.05,.95]},
 *         transition:{duration:2,repeat:1/0,ease:"easeInOut"}})}),
 *     a.jsx("span",{className:"sr-only",children:"Loading canvas, please wait..."})
 *   ]});
 * ```
 * `s.COMMON.LOADING.OVERLAY` = `"common-loading-overlay"`（`vendor-packages-JNk8f0_N.js`
 * @643361 逐字：`LOADING:{OVERLAY:"common-loading-overlay"}`）。
 * `t` = `dd` = `oks` = framer-motion 的 `motion`（`oks=fur(i2r,Aur)` @1522781）；
 * `a` = `g` = react/jsx-runtime。
 *
 * ── 官方原件 ──────────────────────────────────────────────────────────────
 * 官方那张 200×200 动画 WebP 已**字节原样**落库到 `src/assets/loading-canvas.webp`，
 * 由本文件用 `readFileSync` + `createHash` 钉死 sha256。
 *
 * 验证分级 = **(b) jsdom 真 DOM + 源码级**；未做 (a) live CDP（加载屏一闪而过，见报告）。
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LazyLoadFallback } from '../../src/components/shared/LazyLoadBoundary';

/* ⚠️ 本文件是 jsdom 环境：`import.meta.url` 不是 `file:` 方案（vitest 给的是虚拟 URL，
   `fileURLToPath` 会抛「The URL must be of scheme file」）⇒ 按本仓既有约定用 cwd（= 仓库根）。 */
const ASSET = resolve(process.cwd(), 'src/assets/loading-canvas.webp');

/** 官方原件 sha256（`loading-BWU_g4Wm.webp`，197,602 字节）。 */
const OFFICIAL_SHA256 = 'e90e059cd2c39b8c739a2e00f25fbed5f3e322a69dfe26be4b17d5ea93c798e0';

type El = ReactElement<Record<string, unknown>>;

const asArray = (value: unknown): El[] =>
  Array.isArray(value) ? (value as El[]) : [value as El];

/**
 * `LazyLoadFallback` 是纯函数组件 ⇒ 直接调用即可拿到**未渲染**的元素树，
 * 这样 `initial/animate/exit/transition` 这些**不会落到 DOM 属性上**的 motion 取值
 * 可以逐字读出来断言（比正则扫源码硬）。
 */
function rootTree(label = 'MTV 导演画布') {
  const outer = LazyLoadFallback({ label, variant: 'root' }) as El;
  const [inner, srOnly] = asArray(outer.props.children);
  const img = asArray(inner.props.children)[0];
  return { outer, inner, img, srOnly };
}

afterEach(() => {
  cleanup();
});

describe('根加载屏 = 官方 `loading-overlay-DoLoNJJU.js` 逐字复刻', () => {
  it('容器 = `motion.div`，类串与 role/aria-*/data-testid 逐字照官方', () => {
    const outer = rootTree().outer;
    expect(outer.props.className).toBe(
      'fixed inset-0 z-50 flex items-center justify-center bg-black',
    );
    expect(outer.props.role).toBe('status');
    expect(outer.props['aria-live']).toBe('polite');
    expect(outer.props['aria-label']).toBe('Loading canvas');
    expect(outer.props['data-testid']).toBe('common-loading-overlay');
    /* 官方最外层 fade：`duration:1` / `ease:"easeOut"`，三态 opacity 0→1→0 */
    expect(outer.props.initial).toEqual({ opacity: 0 });
    expect(outer.props.animate).toEqual({ opacity: 1 });
    expect(outer.props.exit).toEqual({ opacity: 0 });
    expect(outer.props.transition).toEqual({ duration: 1, ease: 'easeOut' });
  });

  it('内层 = `motion.div`，`duration:.3` / `delay:.1` / `exit:{duration:.8}` 逐字', () => {
    const inner = rootTree().inner;
    expect(inner.props.initial).toEqual({ opacity: 0, scale: 0.95 });
    expect(inner.props.animate).toEqual({ opacity: 1, scale: 1 });
    expect(inner.props.exit).toEqual({ opacity: 0, scale: 1 });
    expect(inner.props.transition).toEqual({
      duration: 0.3,
      delay: 0.1,
      ease: 'easeOut',
      exit: { duration: 0.8, ease: 'easeOut' },
    });
  });

  it('图 = `motion.img`：`alt="Loading"` / `w-16 h-16 object-contain` / `duration:2` 无限往返', () => {
    const img = rootTree().img;
    expect(img.props.alt).toBe('Loading');
    expect(img.props.className).toBe('w-16 h-16 object-contain');
    expect(img.props.animate).toEqual({ scale: [0.95, 1.05, 0.95] });
    expect(img.props.transition).toEqual({
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    });
    expect(img.props.transition).toHaveProperty('repeat', Infinity);
    /* 必须吃**本地**官方原件，不是官方 CDN 远端地址 */
    expect(String(img.props.src)).toContain('loading-canvas');
    expect(String(img.props.src)).not.toContain('fe-assets.tapnow.media');
  });

  it('`sr-only` 文案逐字，且根变体**没有可见文案**（官方无可见文字）', () => {
    const srOnly = rootTree().srOnly;
    expect(srOnly.props.className).toBe('sr-only');
    expect(srOnly.props.children).toBe('Loading canvas, please wait...');

    const { container } = render(<LazyLoadFallback label="MTV 导演画布" variant="root" />);
    const sr = container.querySelector('.sr-only');
    expect(sr?.textContent).toBe('Loading canvas, please wait...');
    /* 摘掉 sr-only 后，根加载屏里一个字都不该剩 —— 尤其不许再出现「正在加载{label}」 */
    sr?.remove();
    expect(container.textContent).toBe('');
  });

  it('根变体的 DOM 属性也确实落到元素上（容器类串/role/aria/testid）', () => {
    const { container } = render(<LazyLoadFallback label="MTV 导演画布" variant="root" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe(
      'fixed inset-0 z-50 flex items-center justify-center bg-black',
    );
    expect(root.getAttribute('role')).toBe('status');
    expect(root.getAttribute('aria-live')).toBe('polite');
    expect(root.getAttribute('aria-label')).toBe('Loading canvas');
    expect(root.getAttribute('data-testid')).toBe('common-loading-overlay');
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('alt')).toBe('Loading');
    expect(img.getAttribute('class')).toBe('w-16 h-16 object-contain');
  });

  it('根变体**不再有**转圈弧（`animate-spin` / `border-t-primary` / `aria-hidden`）', () => {
    const { container } = render(<LazyLoadFallback label="MTV 导演画布" variant="root" />);
    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(container.querySelector('[class*="border-t-primary"]')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    /* 根变体里唯一的 span 就是那个 sr-only 文案 */
    const spans = [...container.querySelectorAll('span')];
    expect(spans).toHaveLength(1);
    expect(spans[0].className).toBe('sr-only');
  });

  it('图片资产存在且 sha256 == 官方原件 `e90e059c…`', () => {
    const bytes = readFileSync(ASSET);
    expect(bytes.length).toBe(197602);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(OFFICIAL_SHA256);
    /* WebP 魔数 `RIFF….WEBP`（确认没被转格式 / 重绘） */
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
  });
});

describe('feature 变体本轮未动（原样快照）', () => {
  it('结构与文案逐字未变，`label` prop 仍在用', () => {
    const { container } = render(<LazyLoadFallback label="资产面板" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe(
      'fixed bottom-5 left-1/2 z-[300] flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-xl',
    );
    expect(root.getAttribute('role')).toBe('status');
    expect(root.getAttribute('aria-live')).toBe('polite');
    /* feature 变体不是官方根加载屏 ⇒ 不该带官方的 testid */
    expect(root.hasAttribute('data-testid')).toBe(false);
    expect(container.textContent).toBe('正在加载资产面板');

    const spinner = container.querySelector('span[aria-hidden="true"]');
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute('class')).toBe(
      'h-3.5 w-3.5 animate-spin rounded-full border border-border border-t-primary',
    );
    const text = container.querySelector('span.text-xs');
    expect(text?.textContent).toBe('正在加载资产面板');
    expect(text?.getAttribute('class')).toContain('text-muted-foreground');
  });
});
