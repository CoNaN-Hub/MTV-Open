/**
 * 官方 marble 封面（boring-avatars）逐值回归
 *
 * 期望值来自官方 9444 实测 DOM（页 chunk `page-CoyqNJe1.js` 的宫格项目卡，`index-BsHyQ2qj.js`
 * @6728550 起是 boring-avatars 的 UMD 打包）：
 *   项目 id `4f10c54e-c98b-42d0-b6bd-9cb70bdb0d2f`
 *   → hash 556055423（%5 = 3）
 *   → 底色 `#606d80` / path1 `#a3a7ae` / path2 `#3e3e41`
 *   → path1 `translate(-6 -6) rotate(-286 40 40) scale(1.3)`
 *     path2 `translate(-5 -5) rotate(-69 40 40) scale(1.3)`
 * 注意：官方**两条 path 的 `scale()` 都取 T[2].scale**（源码如此），不是各自的 scale。
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarbleAvatar } from '../../src/components/projectLibrary/ProjectCovers';
import { MARBLE_COLORS, marbleSpecs } from '../../src/components/projectLibrary/marble';
import { CoverSet, ListCover } from '../../src/components/workspace/WorkspaceCovers';

const OFFICIAL_ID = '4f10c54e-c98b-42d0-b6bd-9cb70bdb0d2f';

describe('官方 marble 封面算法', () => {
  it('对官方实测样本产出逐值一致的取色 / 位移 / 旋转', () => {
    const specs = marbleSpecs(OFFICIAL_ID, MARBLE_COLORS);
    expect(specs.map((spec) => spec.color)).toEqual(['#606d80', '#a3a7ae', '#3e3e41']);
    expect(specs[1]).toMatchObject({ translateX: -6, translateY: -6, rotate: -286 });
    expect(specs[2]).toMatchObject({ translateX: -5, translateY: -5, rotate: -69 });
  });

  it('同 name 恒定（稳定哈希），不同 name 取色不同', () => {
    expect(marbleSpecs(OFFICIAL_ID, MARBLE_COLORS)).toEqual(marbleSpecs(OFFICIAL_ID, MARBLE_COLORS));
    const other = marbleSpecs('another-project-id', MARBLE_COLORS).map((spec) => spec.color);
    expect(other.every((color) => MARBLE_COLORS.includes(color))).toBe(true);
  });

  it('渲染出的 SVG 与官方 DOM 的 fill / transform 一致（含两条 path 共用 T[2].scale）', () => {
    const html = renderToStaticMarkup(
      createElement(MarbleAvatar, {
        name: OFFICIAL_ID,
        className: 'h-full w-full rounded-[12px] hover:scale-110 transition-all duration-200',
      }),
    );
    expect(html).toContain('viewBox="0 0 80 80"');
    expect(html).toContain('preserveAspectRatio="none"');
    expect(html).toContain('width="100%"');
    expect(html).toContain('fill="#606d80"');
    expect(html).toContain('fill="#a3a7ae"');
    expect(html).toContain('fill="#3e3e41"');
    expect(html).toContain('translate(-6 -6) rotate(-286 40 40) scale(1.3)');
    expect(html).toContain('translate(-5 -5) rotate(-69 40 40) scale(1.3)');
    expect(html).toContain('mix-blend-mode:overlay');
    expect(html).toContain('feGaussianBlur stdDeviation="7"');
    // 官方 `square: true` ⇒ mask 里的 rect 不带 rx
    expect(html).toContain('<rect width="80" height="80" fill="#FFFFFF">');
    expect(html).not.toContain('<rect width="80" height="80" rx=');
  });

  it('square = false 时 mask 的 rect 带 rx=160（官方 `rx: square ? undefined : 160`）', () => {
    const html = renderToStaticMarkup(createElement(MarbleAvatar, { name: OFFICIAL_ID, square: false }));
    expect(html).toContain('rx="160"');
  });
});

describe('官方收藏夹封面（`ks` / `ca`）', () => {
  const coverSet = [
    { canvas_id: 'aaa', preview_image: 'https://x/1.png' },
    { canvas_id: 'bbb' },
    {},
  ];

  it('宫格三张叠放用官方百分比位姿（右侧 15° / 中间 0° / 左侧 -15°）', () => {
    const html = renderToStaticMarkup(createElement(CoverSet, { coverSet }));
    // 外层 perspective:400
    expect(html).toContain('perspective:400px');
    // 三层宽度与旋转原点
    expect(html.match(/width:37\.3%/g)?.length).toBe(3);
    expect(html.match(/transform-origin:left top/g)?.length).toBe(3);
    // 官方 normal 位姿
    expect(html).toContain('left:58.5%');
    expect(html).toContain('top:24.6%');
    expect(html).toContain('rotate(15deg)');
    expect(html).toContain('left:31.3%');
    expect(html).toContain('top:18.5%');
    expect(html).toContain('left:5.6%');
    expect(html).toContain('top:37.9%');
    expect(html).toContain('rotate(-15deg)');
    // z-index 3 / 2 / 1
    expect(html).toContain('z-index:3');
    expect(html).toContain('z-index:2');
    expect(html).toContain('z-index:1');
    // 单卡：官方 `ys` —— 100/134 比例 + 16px 圆角 + 五色 marble
    expect(html).toContain('aspect-ratio:100 / 134');
    expect(html).toContain('rounded-[16px]');
    expect(html).toContain('shadow-[-2px_-1px_10.5px_rgba(0,0,0,0.4)]');
    expect(html).toContain('outline outline-1 outline-[#CCCCCC]/50');
    // 有图的一张走 img，无图的走 marble / 渐变+花标
    expect(html).toContain('src="https://x/1.png"');
    expect(html).toContain('viewBox="0 0 80 80"');
    expect(html).toContain('linear-gradient(180deg, #CCCECE 0%, #939E9E 100%)');
  });

  it('isDropTarget 时用官方 expanded 位姿', () => {
    const html = renderToStaticMarkup(createElement(CoverSet, { coverSet, isDropTarget: true }));
    expect(html).toContain('left:63.7%');
    expect(html).toContain('top:17.9%');
    expect(html).toContain('left:0.4%');
    expect(html).toContain('top:31.2%');
  });

  it('列表预览格 72×48：项目走 marble / 收藏夹走 px 位姿叠卡 + #1A1E20 底', () => {
    const project = renderToStaticMarkup(
      createElement(ListCover, { item: { type: 'project', projectId: 'bbb' } }),
    );
    expect(project).toContain('width:72px');
    expect(project).toContain('height:48px');
    expect(project).toContain('shrink-0 overflow-hidden rounded-[12px]');
    expect(project).toContain('viewBox="0 0 80 80"');

    const collection = renderToStaticMarkup(
      createElement(ListCover, { item: { type: 'collection', coverSet } }),
    );
    expect(collection).toContain('shrink-0 relative overflow-hidden rounded-[12px]');
    expect(collection).toContain(
      'background:linear-gradient(136deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0) 100%), #1A1E20',
    );
    // 官方 `ra` px 位姿 + `la` 的圆角 4 / 描边 / 阴影
    expect(collection).toContain('left:12.8px');
    expect(collection).toContain('top:15.87px');
    expect(collection).toContain('width:19.56px');
    expect(collection).toContain('height:26.08px');
    expect(collection).toContain('left:25.6px');
    expect(collection).toContain('width:20px');
    expect(collection).toContain('height:26.4px');
    expect(collection).toContain('left:40.4px');
    expect(collection).toContain('border-radius:4px');
    expect(collection).toContain('box-shadow:-2px -1px 10.5px rgba(0, 0, 0, 0.40)');
    expect(collection).toContain('outline:1px solid rgba(204, 204, 204, 0.4)');
  });
});
