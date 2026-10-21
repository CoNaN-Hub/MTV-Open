// @vitest-environment jsdom
/**
 * 官方 `Ub` 子部件的真实 DOM 回归（jsdom）。
 *
 * 逐字来源（`live-ProseMirror-提及输入内核.md` §5.3 / 本文件的 `MentionSuggestionParts.tsx` 头注释）：
 *  · `Xp` 分组标题：`flex items-center justify-between gap-2 px-1 py-1` +
 *    `text-xs font-medium leading-[1.3] text-white/40 tracking-[0.48px]` +
 *    hint `text-[11px] font-normal leading-[1.3] tracking-normal text-white/30`
 *  · `Cu` 分隔线：`shrink-0` + `height:0.5px` + `rgba(255,255,255,0.16)`
 *  · `Su` 提示行：`cx(LP, "gap-[6px] text-[12px] text-[rgba(255,255,255,0.4)]", selected && "bg-white/10")`
 *  · `Ak` 文件夹行：`cx("group/asset-folder", LP, selected && "bg-white/10")`
 *  · `rC` 高亮：命中片段 `text-white/90`，其余不着色
 *  · `U3` 骨架：`flex w-full flex-col gap-[2px]` + `cx(LP,"pointer-events-none")` + 三条占位块
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MENTION_ROW_CLASS,
  MentionFolderRow,
  MentionHighlight,
  MentionHintRow,
  MentionSectionHeader,
  MentionSeparator,
  MentionSkeleton,
} from '../../src/components/chat/MentionSuggestionParts';

afterEach(cleanup);

describe('MentionSectionHeader（官方 Xp）', () => {
  it('容器与标题/提示的逐字 class', () => {
    const { container } = render(<MentionSectionHeader hint="3 个">技能</MentionSectionHeader>);
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toBe('flex items-center justify-between gap-2 px-1 py-1');
    const title = box.querySelector('p') as HTMLElement;
    expect(title.className).toBe('text-xs font-medium leading-[1.3] text-white/40 tracking-[0.48px]');
    expect(title.textContent).toBe('技能');
    const hint = box.querySelector('span') as HTMLElement;
    expect(hint.className).toBe('shrink-0 text-[11px] font-normal leading-[1.3] tracking-normal text-white/30');
  });

  it('无 hint 时不渲染 span', () => {
    const { container } = render(<MentionSectionHeader>技能</MentionSectionHeader>);
    expect(container.querySelector('span')).toBeNull();
  });
});

describe('MentionSeparator（官方 Cu）', () => {
  it('0.5px + rgba(255,255,255,0.16)', () => {
    const { container } = render(<MentionSeparator />);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toBe('shrink-0');
    expect(div.style.height).toBe('0.5px');
    expect(div.style.backgroundColor).toBe('rgba(255, 255, 255, 0.16)');
  });
});

describe('MentionHintRow（官方 Su）', () => {
  it('行基类 + 附加类串；选中时 `bg-white/10`；`data-selectable-index` 透传', () => {
    const onClick = vi.fn();
    const { container } = render(
      <MentionHintRow index={2} isSelected onClick={onClick}>查看全部</MentionHintRow>,
    );
    const row = container.querySelector('button') as HTMLElement;
    expect(row.className).toBe(`${MENTION_ROW_CLASS} gap-[6px] text-[12px] text-[rgba(255,255,255,0.4)] bg-white/10`);
    expect(row.getAttribute('data-selectable-index')).toBe('2');
    row.click();
    expect(onClick).toHaveBeenCalled();
  });
});

describe('MentionFolderRow（官方 Ak）', () => {
  it('`group/asset-folder` + 行基类；标题与尾部图标 class 逐字', () => {
    const { container } = render(
      <MentionFolderRow displayName="我的项目" globalIndex={1} trailingIcon={<svg />} />,
    );
    const row = container.querySelector('button') as HTMLElement;
    expect(row.className).toBe(`group/asset-folder ${MENTION_ROW_CLASS}`);
    const label = row.querySelector('span') as HTMLElement;
    expect(label.className).toBe('flex-1 min-w-0 text-sm font-medium leading-5 text-white/90 truncate');
    expect(label.textContent).toBe('我的项目');
  });

  it('`globalIndex < 0` 时 `data-selectable-index` 为 undefined', () => {
    const { container } = render(<MentionFolderRow displayName="x" globalIndex={-1} />);
    expect(container.querySelector('button')!.getAttribute('data-selectable-index')).toBeNull();
  });
});

describe('MentionHighlight（官方 rC）', () => {
  it('无 keyword 时原样输出', () => {
    const { container } = render(<MentionHighlight text="角色参考图" />);
    expect(container.textContent).toBe('角色参考图');
    expect(container.querySelector('span[class]')).toBeNull();
  });

  it('命中片段用 `text-white/90`（大小写不敏感），其余不着色', () => {
    const { container } = render(<MentionHighlight text="角色参考图" keyword="参考" />);
    const spans = [...container.querySelectorAll('span')];
    expect(spans.map((s) => s.textContent)).toEqual(['角色', '参考', '图']);
    expect(spans[0].className).toBe('');
    expect(spans[1].className).toBe('text-white/90');
    expect(spans[2].className).toBe('');
  });

  it('正则元字符被转义（`(` 不会当作分组）', () => {
    const { container } = render(<MentionHighlight text="a(b" keyword="(" />);
    expect(container.textContent).toBe('a(b');
    expect([...container.querySelectorAll('span')].some((s) => s.className === 'text-white/90')).toBe(true);
  });
});

describe('MentionSkeleton（官方 U3）', () => {
  it('`count` 行，每行 `cx(LP,"pointer-events-none")` + 三条占位块', () => {
    const { container } = render(
      <MentionSkeleton count={3} renderBlock={(cls, key) => <div className={cls} key={key} data-block />} />,
    );
    expect(container.firstElementChild!.className).toBe('flex w-full flex-col gap-[2px]');
    const rows = [...container.querySelectorAll('div')].filter((d) => d.className.startsWith(MENTION_ROW_CLASS));
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.className).toBe(`${MENTION_ROW_CLASS} pointer-events-none`);
      expect(row.querySelectorAll('[data-block]')).toHaveLength(4);
    }
    expect((rows[0].querySelector('[data-block]') as HTMLElement).className).toBe('size-6 shrink-0 rounded-[4px]');
  });
});
