// @vitest-environment jsdom
/**
 * 官方 `Ub` **资产库子部件** 的真实 DOM 回归。
 *
 * 逐字来源：`live-assets/vendor-pkg-canvas-ChpWx5JY.js`
 *  · `Ik`  资产行：`cx(Qa, !disabled&&selected&&hc, disabled&&"opacity-35 cursor-not-allowed")`
 *  · `jk`  缩略图：audio→`O1{variant:"row"}`；src→`Xc`+`TK`；video+videoSrc→`video`+`gS{size:10}`；
 *          text→`z1{variant:"row"}`；quote→`Xc`+`LN{size:12,className:cg,strokeWidth:1.5}`；
 *          video→`Xc relative`+`es{className:cg,opacity:1}`+`gS{size:8}`；default→`Xc`+`io{...}`
 *  · `Mk`  角标：`"text-[rgba(255,255,255,0.3)] shrink-0"` + `size:14` / `opacity:1`（quote 用 `strokeWidth:1.5`，
 *          library_element 无 opacity），未知 `type` → `null`
 *  · `Uv`  搜索框：wrapper `w-full shrink-0 px-2 pt-1 pb-1`，bar `flex h-[32px] ... px-2`，
 *          input `min-w-0 flex-1 ... placeholder:text-white/30`，图标 `cf` size 14 `shrink-0 text-white/40`
 *  · `Am`  渐隐外壳：`relative flex min-h-0 min-w-0 flex-1 flex-col` + 上下两层 `h-5` 渐隐
 *          （`fadeColor` 默认 `var(--popover)`，阈值 `s3` = 1）
 *  · `Xwe`/`Zwe` 插件行 / 分组行，`KM` 参考图卡，`e_e`/`Jwe` 骨架屏
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MENTION_GROUP_ICON_BOX_CLASS,
  MENTION_PLUGIN_AVATAR_CURSOR_CLASS,
  MENTION_ROW_PLACEHOLDER_CLASS,
  MENTION_ROW_CLASS,
  MENTION_ROW_SELECTED_CLASS,
  MENTION_SCROLL_FADE_THRESHOLD,
  MENTION_SKELETON_BLOCK_CLASS,
  MENTION_THUMB_FRAME_CLASS,
  MENTION_THUMB_ICON_CLASS,
  MENTION_TYPE_BADGE_CLASS,
  MentionAssetRow,
  MentionAssetRowsSkeleton,
  MentionAssetThumbnail,
  MentionAssetTypeBadge,
  MentionAssetTypeBadgeFromAssetType,
  MentionLibrarySearchInput,
  MentionMediaPlayOverlay,
  MentionPluginRow,
  MentionPluginRowsSkeleton,
  MentionReferenceCard,
  MentionScrollFade,
  MentionSkeletonBlock,
  MentionGroupIconBox,
  MentionGroupRow,
} from '../../src/components/chat/MentionLibraryParts';
import {
  MENTION_ROW_CLASS as CANONICAL_ROW_CLASS,
  MENTION_ROW_SELECTED_CLASS as CANONICAL_ROW_SELECTED_CLASS,
} from '../../src/components/chat/MentionSuggestionParts';

afterEach(cleanup);

const TABLER = (name: string, extra?: string) =>
  ['tabler-icon', `tabler-icon-${name}`, extra].join(' ');

describe('行基类常量复用（官方 Qa/N$=LP、hc=jP）', () => {
  it('MENTION_ROW_CLASS 与 MentionSuggestionParts 中已有常量逐字同一', () => {
    expect(MENTION_ROW_CLASS).toBe(CANONICAL_ROW_CLASS);
    expect(MENTION_ROW_CLASS).toBe(
      'flex items-center gap-[8px] w-full px-[8px] py-[6px] text-left transition-colors rounded-[6px] cursor-pointer hover:bg-white/10',
    );
  });

  it('MENTION_ROW_SELECTED_CLASS = bg-white/10，且阈值常量 s3 = 1', () => {
    expect(MENTION_ROW_SELECTED_CLASS).toBe(CANONICAL_ROW_SELECTED_CLASS);
    expect(MENTION_ROW_SELECTED_CLASS).toBe('bg-white/10');
    expect(MENTION_SCROLL_FADE_THRESHOLD).toBe(1);
  });

  it('骨架块类串逐字为 shadcn Skeleton（官方 $n←bt）', () => {
    const { container } = render(<MentionSkeletonBlock className="size-5" />);
    const block = container.firstElementChild as HTMLElement;
    expect(MENTION_SKELETON_BLOCK_CLASS).toBe('animate-pulse rounded-md bg-input/30');
    expect(block.className).toBe('animate-pulse rounded-md bg-input/30 size-5');
  });
});

describe('MentionAssetTypeBadge（官方 Mk）', () => {
  it('type="video"：size 14 / opacity 1 / className 逐字', () => {
    const { container } = render(<MentionAssetTypeBadge type="video" />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('height')).toBe('14');
    expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
    expect(svg.getAttribute('class')).toBe('text-[rgba(255,255,255,0.3)] shrink-0');
    const g = svg.querySelector('g') as SVGGElement;
    expect(g.getAttribute('opacity')).toBe('1');
    expect(MENTION_TYPE_BADGE_CLASS).toBe('text-[rgba(255,255,255,0.3)] shrink-0');
  });

  it('type="image"：同一 48 视框但 path 为图片占位（含 16.6064 24.0537）', () => {
    const { container } = render(<MentionAssetTypeBadge type="image" />);
    const path = container.querySelector('path') as SVGPathElement;
    expect(path.getAttribute('d')).toContain('16.6064 24.0537');
    expect(path.getAttribute('fill')).toBe('currentColor');
    expect(path.getAttribute('fill-rule')).toBe('evenodd');
    expect(container.querySelector('g')!.getAttribute('opacity')).toBe('1');
  });

  it('type="audio"：16 视框 + 七条波形 path', () => {
    const { container } = render(<MentionAssetTypeBadge type="audio" />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 16 16');
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.querySelectorAll('path')).toHaveLength(7);
  });

  it('type="text"：14 视框 + 三条文本线 + opacity 1', () => {
    const { container } = render(<MentionAssetTypeBadge type="text" />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 14 14');
    expect(svg.querySelectorAll('path')).toHaveLength(1);
    expect(svg.querySelector('g')!.getAttribute('opacity')).toBe('1');
  });

  it('type="quote"：Tabler Quote，strokeWidth 1.5，无 opacity 属性', () => {
    const { container } = render(<MentionAssetTypeBadge type="quote" />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('class')).toBe(TABLER('quote', MENTION_TYPE_BADGE_CLASS));
    expect(svg.getAttribute('stroke-width')).toBe('1.5');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.querySelectorAll('path')).toHaveLength(2);
    expect(svg.querySelector('g')).toBeNull();
  });

  it('type="library_element"：12 视框 + fill #828282', () => {
    const { container } = render(<MentionAssetTypeBadge type="library_element" />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 12 12');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    const path = svg.querySelector('path') as SVGPathElement;
    expect(path.getAttribute('fill')).toBe('#828282');
    expect(path.getAttribute('d')).toContain('M6 5.27237');
  });

  it('未知 type 渲染 null', () => {
    const { container } = render(<MentionAssetTypeBadge type="nope" />);
    expect(container.firstChild).toBeNull();
    const { container: c2 } = render(<MentionAssetTypeBadge />);
    expect(c2.firstChild).toBeNull();
  });
});

describe('MentionAssetTypeBadgeFromAssetType（官方 n_e）', () => {
  it('assetType=2（VIDEO）→ 视频占位；assetType="ASSET_TYPE_TEXT" → 文本占位', () => {
    const { container } = render(<MentionAssetTypeBadgeFromAssetType assetType={2} />);
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 48 48');
    expect(container.querySelector('path')!.getAttribute('d')).toContain('18.5762 19.5801');

    const { container: text } = render(
      <MentionAssetTypeBadgeFromAssetType assetType="ASSET_TYPE_TEXT" />,
    );
    expect(text.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 14 14');
  });

  it('assetType=3（AUDIO）→ 16 视框；未识别 → null', () => {
    const { container } = render(<MentionAssetTypeBadgeFromAssetType assetType={3} />);
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 16 16');
    const { container: none } = render(<MentionAssetTypeBadgeFromAssetType assetType={0} />);
    expect(none.firstChild).toBeNull();
  });
});

describe('MentionAssetThumbnail（官方 jk）', () => {
  it('type="audio" → 白底 O1 占位（variant="row"）', () => {
    const { container } = render(<MentionAssetThumbnail type="audio" />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toBe(`${MENTION_ROW_PLACEHOLDER_CLASS} size-6 shrink-0 rounded-[4px]`);
    const svg = box.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 12 11');
    expect(svg.getAttribute('width')).toBe('12');
    expect(svg.getAttribute('height')).toBe('11');
  });

  it('有 src → Xc 外框 + TK 懒加载图', () => {
    const { container } = render(<MentionAssetThumbnail src="a.png" type="image" />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.className).toBe(MENTION_THUMB_FRAME_CLASS);
    const img = frame.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('class')).toBe('block size-6 object-cover');
    expect(img.getAttribute('src')).toBe('a.png');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('type="video" + videoSrc → 相对定位外框 + video + gS size 10', () => {
    const { container } = render(<MentionAssetThumbnail type="video" videoSrc="v.mp4" />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.className).toBe(`${MENTION_THUMB_FRAME_CLASS} relative`);
    const video = frame.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('class')).toBe('block size-6 object-cover');
    expect(video.getAttribute('preload')).toBe('metadata');
    const overlay = frame.querySelector('span') as HTMLElement;
    expect(overlay.className).toBe('pointer-events-none absolute inset-0 flex items-center justify-center');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect((overlay.querySelector('svg') as SVGElement).getAttribute('width')).toBe('10');
  });

  it('type="quote" → Xc 外框 + Tabler Quote size 12 + cg 类', () => {
    const { container } = render(<MentionAssetThumbnail type="quote" />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.className).toBe(MENTION_THUMB_FRAME_CLASS);
    const svg = frame.querySelector('svg') as SVGElement;
    expect(MENTION_THUMB_ICON_CLASS).toBe('size-3 text-white/60');
    expect(svg.getAttribute('class')).toBe(TABLER('quote', MENTION_THUMB_ICON_CLASS));
    expect(svg.getAttribute('width')).toBe('12');
    expect(svg.getAttribute('stroke-width')).toBe('1.5');
  });

  it('type="text" → 白底 z1 占位；未知 type → io 图片占位（opacity 1）', () => {
    const { container: text } = render(<MentionAssetThumbnail type="text" />);
    expect((text.firstElementChild as HTMLElement).className).toBe(
      `${MENTION_ROW_PLACEHOLDER_CLASS} size-6 shrink-0 rounded-[4px]`,
    );

    const { container: other } = render(<MentionAssetThumbnail type="whatever" />);
    const frame = other.firstElementChild as HTMLElement;
    expect(frame.className).toBe(MENTION_THUMB_FRAME_CLASS);
    expect(frame.querySelector('g')!.getAttribute('opacity')).toBe('1');
  });
});

describe('MentionAssetRow（官方 Ik）', () => {
  it('button 结构 / 类串 / 名称 / 路径 / 类型角标逐字', () => {
    const onClick = vi.fn();
    const { container } = render(
      <MentionAssetRow
        asset={{
          name: '角色参考图',
          assetType: 4,
          folderDisplayPath: '/角色/风格',
          folderName: '风格',
        }}
        globalIndex={3}
        isSelected
        onClick={onClick}
      />,
    );
    const row = container.querySelector('button') as HTMLElement;
    expect(row.className).toBe(`${MENTION_ROW_CLASS} ${MENTION_ROW_SELECTED_CLASS}`);
    expect(row.getAttribute('data-selectable-index')).toBe('3');

    const label = row.children[1] as HTMLElement;
    expect(label.className).toBe('flex-1 min-w-0 flex flex-col gap-0');
    const nameWrap = label.children[0] as HTMLElement;
    expect(nameWrap.className).toBe('flex items-center gap-1 min-w-0');
    const nameSpan = nameWrap.children[0] as HTMLElement;
    expect(nameSpan.className).toBe(
      'text-[13px] font-medium leading-[18px] text-white/80 truncate',
    );
    expect(nameSpan.textContent).toBe('角色参考图');
    const pathSpan = label.children[1] as HTMLElement;
    expect(pathSpan.className).toBe('text-[11px] leading-[14px] text-white/35 truncate');
    expect(pathSpan.textContent).toBe('/角色/风格');

    row.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('hidePath 不渲染路径行；未选中时无 bg-white/10', () => {
    const { container } = render(
      <MentionAssetRow
        asset={{ name: 'x', assetType: 1, folderDisplayPath: '/a', folderName: 'a' }}
        globalIndex={0}
        hidePath
      />,
    );
    const row = container.querySelector('button') as HTMLElement;
    expect(row.className).toBe(MENTION_ROW_CLASS);
    expect(row.textContent).toBe('x');
  });

  it('disabled：`opacity-35 cursor-not-allowed` + 无 data-selectable-index + 不触发 onClick', () => {
    const onClick = vi.fn();
    const { container } = render(
      <MentionAssetRow
        asset={{ name: 'x', assetType: 5 }}
        globalIndex={2}
        isSelected
        disabled
        onClick={onClick}
      />,
    );
    const row = container.querySelector('button') as HTMLElement;
    expect(row.className).toBe(`${MENTION_ROW_CLASS} opacity-35 cursor-not-allowed`);
    expect(row.getAttribute('data-selectable-index')).toBeNull();
    row.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('complianceStatus=1（APPROVED）渲染已审核徽标 span，globalIndex<0 时无索引', () => {
    const { container } = render(
      <MentionAssetRow
        asset={{ name: 'x', assetType: 1, complianceStatus: 1 }}
        globalIndex={-1}
      />,
    );
    const row = container.querySelector('button') as HTMLElement;
    expect(row.getAttribute('data-selectable-index')).toBeNull();
    const badge = row.querySelector('span#none') as HTMLElement | null;
    expect(badge).toBeNull();
    const approved = row.querySelector('span.inline-flex') as HTMLElement;
    expect(approved.className).toBe('inline-flex items-center shrink-0');
    expect(approved.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(approved.querySelector('svg')!.getAttribute('fill')).toBe('currentColor');
  });
});

describe('MentionLibrarySearchInput（官方 Uv）', () => {
  it('wrapper / bar / input / 图标 类串逐字，onChange 回传值', () => {
    const onChange = vi.fn();
    const { container } = render(
      <MentionLibrarySearchInput value="ab" onChange={onChange} placeholder="搜索资产" />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toBe('w-full shrink-0 px-2 pt-1 pb-1');
    const bar = wrapper.firstElementChild as HTMLElement;
    expect(bar.className).toBe(
      'flex h-[32px] w-full items-center gap-[6px] rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-2',
    );
    const icon = bar.querySelector('svg') as SVGElement;
    expect(icon.getAttribute('class')).toBe(TABLER('search', 'shrink-0 text-white/40'));
    const input = bar.querySelector('input') as HTMLInputElement;
    expect(input.className).toBe(
      'min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] leading-[18px] text-white/80 outline-none placeholder:text-white/30',
    );
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('placeholder')).toBe('搜索资产');

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('额外 className 追加在末尾；onMouseDown 阻止冒泡', () => {
    const outer = vi.fn();
    const { container } = render(
      <div onMouseDown={outer}>
        <MentionLibrarySearchInput
          value=""
          wrapperClassName="wx"
          barClassName="bx"
          inputClassName="ix"
        />
      </div>,
    );
    const wrapper = container.querySelector('.wx') as HTMLElement;
    expect(wrapper.className).toBe('w-full shrink-0 px-2 pt-1 pb-1 wx');
    expect((wrapper.firstElementChild as HTMLElement).className).toContain(
      'bg-white/[0.04] px-2 bx',
    );
    expect(wrapper.querySelector('input')!.className).toContain('placeholder:text-white/30 ix');
    fireEvent.mouseDown(wrapper);
    expect(outer).not.toHaveBeenCalled();
  });
});

describe('MentionScrollFade（官方 Am）', () => {
  it('外层 + 上下渐隐层 + 滚动容器类串逐字；ref 指向滚动容器', () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <MentionScrollFade ref={ref} className="overflow-y-auto">
        <div>列表</div>
      </MentionScrollFade>,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toBe('relative flex min-h-0 min-w-0 flex-1 flex-col');
    const [top, bottom, scroller] = Array.from(outer.children) as HTMLElement[];
    expect(top.getAttribute('aria-hidden')).toBe('true');
    expect(top.className).toBe(
      'pointer-events-none absolute inset-x-0 top-0 z-[1] h-5 transition-opacity duration-150 opacity-0',
    );
    expect(top.style.background).toBe('linear-gradient(to bottom, var(--popover), transparent)');
    expect(bottom.className).toBe(
      'pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-5 transition-opacity duration-150 opacity-0',
    );
    expect(bottom.style.background).toBe('linear-gradient(to top, var(--popover), transparent)');
    expect(scroller.className).toBe(
      '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden overflow-y-auto',
    );
    expect(scroller.textContent).toBe('列表');
    expect(ref.current).toBe(scroller);
  });

  it('fadeColor 覆盖渐变色；onScroll 透传', () => {
    const onScroll = vi.fn();
    const { container } = render(
      <MentionScrollFade fadeColor="#123456" onScroll={onScroll}>
        <span>x</span>
      </MentionScrollFade>,
    );
    const outer = container.firstElementChild as HTMLElement;
    const top = outer.children[0] as HTMLElement;
    // jsdom 的 cssstyle 会把 #123456 规范化为 rgb(...)，故按包含关系断言。
    expect(top.style.background).toContain('linear-gradient(');
    expect(top.style.background).toContain('rgb(18, 52, 86)');
    expect(top.style.background).toContain('transparent');
    fireEvent.scroll(outer.children[2]);
    expect(onScroll).toHaveBeenCalled();
  });
});

describe('MentionGroupRow（官方 Zwe）/ MentionGroupIconBox（官方 Qwe）', () => {
  it('已知分组 id 出 CK 图标（duration → Tabler Clock），带 chevron', () => {
    const { container } = render(
      <MentionGroupRow group={{ id: 'duration', label: '时长' }} globalIndex={1} />,
    );
    const row = container.querySelector('button') as HTMLElement;
    expect(row.className).toBe(MENTION_ROW_CLASS);
    expect(row.getAttribute('data-selectable-index')).toBe('1');
    const box = row.querySelector('span') as HTMLElement;
    expect(MENTION_GROUP_ICON_BOX_CLASS).toBe(
      'flex size-6 shrink-0 items-center justify-center rounded-[4px] border border-white/[0.10] bg-white/[0.05] shadow-[inset_0_0.5px_0_0_rgba(255,255,255,0.16),0_4px_8px_0_0_rgba(0,0,0,0.16)]',
    );
    expect(box.className).toBe(MENTION_GROUP_ICON_BOX_CLASS);
    const icon = box.querySelector('svg') as SVGElement;
    expect(icon.getAttribute('class')).toBe(TABLER('clock', 'shrink-0 text-white/60'));
    expect(icon.getAttribute('width')).toBe('16');
    const label = row.querySelectorAll('span')[1] as HTMLElement;
    expect(label.className).toBe(
      'flex-1 min-w-0 text-sm font-medium leading-5 text-white/90 truncate',
    );
    const trailing = row.querySelectorAll('span')[2] as HTMLElement;
    expect(trailing.className).toBe('shrink-0 text-white/30');
    expect(trailing.querySelector('svg')!.getAttribute('class')).toBe(TABLER('chevron-right'));
  });

  it('selectionMode="direct" 不渲染 chevron；未知 id 图标框为空', () => {
    const { container } = render(
      <MentionGroupRow
        group={{ id: 'unknown', label: 'x', selectionMode: 'direct' }}
        globalIndex={-1}
      />,
    );
    const row = container.querySelector('button') as HTMLElement;
    expect(row.getAttribute('data-selectable-index')).toBeNull();
    expect(row.querySelectorAll('span')).toHaveLength(2);
    const box = row.querySelector('span') as HTMLElement;
    expect(box.childNodes).toHaveLength(0);

    const { container: boxed } = render(<MentionGroupIconBox />);
    expect((boxed.firstElementChild as HTMLElement).className).toBe(MENTION_GROUP_ICON_BOX_CLASS);
  });
});

describe('MentionPluginRow（官方 Xwe）/ 插件头像（官方 Gi pill）', () => {
  it('行类串 + 未注入头像时的官方胶囊外壳尺寸/样式逐字', () => {
    const onClick = vi.fn();
    const { container } = render(
      <MentionPluginRow
        plugin={{ pluginName: 'p', displayName: '插件名', iconUrl: 'i.png' }}
        globalIndex={0}
        onClick={onClick}
      />,
    );
    const row = container.querySelector('button') as HTMLElement;
    expect(row.className).toBe(MENTION_ROW_CLASS);
    const pill = row.querySelector('span') as HTMLElement;
    expect(pill.className).toBe(
      `flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] ${MENTION_PLUGIN_AVATAR_CURSOR_CLASS}`,
    );
    expect(pill.getAttribute('aria-hidden')).toBe('true');
    expect(pill.style.width).toBe('24px');
    expect(pill.style.height).toBe('24px');
    expect(pill.style.aspectRatio).toBe('1 / 1');
    expect(pill.style.cursor).toBe('default');
    const labelWrap = row.querySelectorAll('span')[1] as HTMLElement;
    expect(labelWrap.className).toBe('flex-1 min-w-0 flex items-center gap-1.5');
    const label = labelWrap.querySelector('span') as HTMLElement;
    expect(label.className).toBe(
      'min-w-0 flex-1 truncate text-sm font-medium leading-5 text-white/90',
    );
    expect(label.textContent).toBe('插件名');
    row.click();
    expect(onClick).toHaveBeenCalled();
  });
});

describe('MentionReferenceCard（官方 KM）', () => {
  it('容器/骨架/图片类串逐字，加载后显示标题遮罩', () => {
    const { container } = render(
      <MentionReferenceCard item={{ image_url: 'a.png', film_name: '片名' }} index={0} />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toBe(
      'group relative h-40 cursor-pointer overflow-hidden rounded-xl bg-white/[0.06]',
    );
    const skeleton = card.children[0] as HTMLElement;
    expect(skeleton.className).toBe('absolute inset-0 animate-pulse rounded-xl bg-white/[0.06]');
    const img = card.querySelector('img') as HTMLImageElement;
    expect(img.className).toBe(
      'absolute inset-0 h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none hover:scale-[1.03] opacity-0',
    );
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('alt')).toBe('片名');

    fireEvent.load(img);
    expect(card.children).toHaveLength(2);
    const caption = card.children[1] as HTMLElement;
    expect(caption.className).toBe(
      'pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-2.5 pb-2 pt-6',
    );
    expect((caption.firstElementChild as HTMLElement).className).toBe(
      'max-w-[80%] truncate text-[10px] font-medium text-white/95',
    );
  });

  it('无 film_name 时 alt 回落 `Reference {index+1}`，且无标题行', () => {
    const { container } = render(
      <MentionReferenceCard item={{ image_url: 'a.png' }} index={2} />,
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('Reference 3');
    fireEvent.load(img);
    const caption = (container.firstElementChild as HTMLElement).children[0] as HTMLElement;
    expect(caption.childNodes).toHaveLength(0);
  });
});

describe('骨架屏（官方 e_e / Jwe）', () => {
  it('e_e：count 行 + 行类串 + 三块骨架类串逐字', () => {
    const { container } = render(<MentionAssetRowsSkeleton count={2} />);
    expect((container.firstElementChild as HTMLElement).className).toBe(
      'flex w-full flex-col gap-[2px]',
    );
    const rows = container.querySelectorAll('div');
    const rowEls = [...rows].filter((el) => el.className.startsWith(MENTION_ROW_CLASS));
    expect(rowEls).toHaveLength(2);
    for (const row of rowEls) {
      expect(row.className).toBe(`${MENTION_ROW_CLASS} pointer-events-none`);
    }
    const blocks = [...rowEls[0].querySelectorAll('div')].filter((el) =>
      el.className.startsWith(MENTION_SKELETON_BLOCK_CLASS),
    );
    expect(blocks.map((el) => el.className)).toEqual([
      'animate-pulse rounded-md bg-input/30 size-6 shrink-0 rounded-[4px]',
      'animate-pulse rounded-md bg-input/30 h-5 w-16 rounded',
      'animate-pulse rounded-md bg-input/30 h-4 flex-1 rounded',
    ]);
    expect(rowEls[0].children[1].className).toBe(
      'flex-1 min-w-0 flex items-center gap-2',
    );
  });

  it('Jwe：count 行 + 三块（size-5 / h-4 flex-1 / size-4）', () => {
    const { container } = render(<MentionPluginRowsSkeleton count={1} />);
    const row = [...container.querySelectorAll('div')].find((el) =>
      el.className.startsWith(MENTION_ROW_CLASS),
    ) as HTMLElement;
    expect(row.className).toBe(`${MENTION_ROW_CLASS} pointer-events-none`);
    const blocks = [...row.querySelectorAll('div')].filter((el) =>
      el.className.startsWith(MENTION_SKELETON_BLOCK_CLASS),
    );
    expect(blocks.map((el) => el.className)).toEqual([
      'animate-pulse rounded-md bg-input/30 size-5 shrink-0 rounded-[4px]',
      'animate-pulse rounded-md bg-input/30 h-4 flex-1 rounded',
      'animate-pulse rounded-md bg-input/30 size-4 shrink-0 rounded',
    ]);
  });
});

describe('MentionMediaPlayOverlay（官方 gS）', () => {
  it('绝对定位浮层 + size 默认 10 的播放三角', () => {
    const { container } = render(<MentionMediaPlayOverlay />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.className).toBe(
      'pointer-events-none absolute inset-0 flex items-center justify-center',
    );
    expect(span.getAttribute('aria-hidden')).toBe('true');
    const svg = span.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('width')).toBe('10');
    expect(svg.getAttribute('viewBox')).toBe('-3 0 13 10');
    expect(svg.getAttribute('class')).toBe(
      'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]',
    );
  });
});
