// @vitest-environment jsdom
/**
 * 官方 `Ob`（内容校验状态徽标，`vendor-pkg-canvas-ChpWx5JY.js`@213827）的真实 DOM 回归。
 *
 * 逐字来源：`D:\DEEPSEEK\_ub_parts\Ob.js` 与 `AuthenticityStatusBadge.tsx` 头注释的符号对照表：
 *  · `ro.UNKNOWN`      ⇒ `null`（什么都不渲染）
 *  · `ro.APPROVED`     ⇒ `span.inline-flex items-center shrink-0` +
 *                        `node-title` ? `Hce size={size} text-foreground/70`
 *                                     : `yv size={size+2} text-primary`
 *  · `S$`(pending|processing) ⇒ `span.inline-flex items-center shrink-0 [truncate]`
 *                        + `style={{fontSize:d,lineHeight:1.5}}` + `span.text-[rgba(255,255,255,0.4)]`
 *  · `REJECTED`        ⇒ `span.text-[#D36A6A]`（行内）/ `DN text-tap-stateWarning/60`（node-title）
 *  · `REJECTED_INVALID`⇒ tooltip 键取 `Cwe[assetType]`，tooltip
 *                        className = `whitespace-pre-line max-w-xs text-xs leading-relaxed`
 *  · `p()` 包装规则    ⇒ `disableTooltip` 时**不包**；`variant==="block"` 时不加 `truncate`
 *
 * ⚠️ 官方 `Dt`（Radix tooltip 包装）在 jsdom 里关闭态**不挂载 content**，无法直接断言 tooltip 文案；
 *    这里把仓库同源封装 `OfficialTooltip` 换成等价 stub，把 `content / side / className` 落到
 *    `data-*` 上以便逐字断言（stub 的 DOM 结构与被替换组件一致：外层包住 children）。
 */
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../src/i18n';
import { AuthenticityStatusBadge } from '../../src/components/shared/AuthenticityStatusBadge';

vi.mock('../../src/components/chat/OfficialTooltip', async () => {
  const React = await import('react');
  return {
    default: (props: {
      children?: ReactNode;
      content?: ReactNode;
      side?: string;
      className?: string;
    }) => React.createElement(
      'span',
      {
        'data-official-tooltip': '',
        'data-tooltip-side': props.side,
        'data-tooltip-class': props.className ?? '',
      },
      React.createElement('span', { 'data-tooltip-content': '' }, String(props.content)),
      props.children,
    ),
  };
});

afterEach(() => {
  cleanup();
  setLocale('zh-CN');
});

/** tooltip 外层（stub）——不存在时说明 `disableTooltip` 生效。 */
const tooltipWrap = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[data-official-tooltip]');

const tooltipText = (container: HTMLElement): string =>
  container.querySelector('[data-tooltip-content]')?.textContent ?? '';

/** 徽标根节点：有 tooltip 包装时是 stub 里的最后一个子元素，否则就是容器首元素。 */
const badgeRoot = (container: HTMLElement): HTMLElement => {
  const wrap = tooltipWrap(container);
  return (wrap ? wrap.lastElementChild : container.firstElementChild) as HTMLElement;
};

const svgOf = (container: HTMLElement): SVGSVGElement | null => container.querySelector('svg');

describe('AuthenticityStatusBadge（官方 Ob）· 六状态分支', () => {
  it('UNKNOWN ⇒ 什么都不渲染', () => {
    const { container } = render(<AuthenticityStatusBadge status="unknown" />);
    expect(container.innerHTML).toBe('');
    expect(tooltipWrap(container)).toBeNull();
  });

  it('APPROVED（default）⇒ yv = tabler circle-check-filled，size+2，text-primary', () => {
    const { container } = render(<AuthenticityStatusBadge status="approved" />);
    expect(badgeRoot(container).className).toBe('inline-flex items-center shrink-0');
    const svg = svgOf(container)!;
    expect(svg.getAttribute('class')).toBe('tabler-icon tabler-icon-circle-check-filled text-primary');
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('height')).toBe('14');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(tooltipText(container)).toBe('角色已合规，可用于 Seedance 2.0 视频生成');
  });

  it('APPROVED + presentation="node-title" ⇒ Hce = tabler circle-check，size 原样，text-foreground/70', () => {
    const { container } = render(<AuthenticityStatusBadge status="approved" presentation="node-title" />);
    const svg = svgOf(container)!;
    expect(svg.getAttribute('class')).toBe('tabler-icon tabler-icon-circle-check text-foreground/70');
    expect(svg.getAttribute('width')).toBe('12');
    expect(svg.getAttribute('height')).toBe('12');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
  });

  it('PENDING ⇒ statusText.pending + text-[rgba(255,255,255,0.4)] + 行内字号', () => {
    const { container } = render(<AuthenticityStatusBadge status="pending" />);
    const root = badgeRoot(container);
    expect(root.className).toBe('inline-flex items-center shrink-0 truncate');
    expect(root.style.fontSize).toBe('12px');
    expect(root.style.lineHeight).toBe('1.5');
    const text = root.querySelector('span')!;
    expect(text.className).toBe('text-[rgba(255,255,255,0.4)]');
    expect(text.textContent).toBe('正在验证');
    expect(tooltipText(container)).toBe('已提交角色合规验证，请稍候');
  });

  it('PROCESSING 与 PENDING 走同一分支（官方 S$ 覆盖两者）', () => {
    const { container } = render(<AuthenticityStatusBadge status="processing" />);
    expect(badgeRoot(container).textContent).toBe('正在验证');
    expect(tooltipText(container)).toBe('已提交角色合规验证，请稍候');
  });

  it('REJECTED（default）⇒ text-[#D36A6A] + statusText.rejected + tooltip.rejected', () => {
    const { container } = render(<AuthenticityStatusBadge status="rejected" />);
    const root = badgeRoot(container);
    expect(root.className).toBe('inline-flex items-center shrink-0 truncate');
    expect(root.querySelector('span')!.className).toBe('text-[#D36A6A]');
    expect(root.textContent).toBe('角色违规');
    expect(tooltipText(container)).toBe('检测到真人照片或受版权保护的 IP 形象');
    expect(tooltipWrap(container)!.getAttribute('data-tooltip-class')).toBe('');
    expect(tooltipWrap(container)!.getAttribute('data-tooltip-side')).toBe('top');
  });

  it('REJECTED + presentation="node-title" ⇒ DN = tabler alert-circle，text-tap-stateWarning/60', () => {
    const { container } = render(<AuthenticityStatusBadge status="rejected" presentation="node-title" />);
    const svg = svgOf(container)!;
    expect(svg.getAttribute('class')).toBe('tabler-icon tabler-icon-alert-circle text-tap-stateWarning/60');
    expect(svg.getAttribute('width')).toBe('12');
    expect(svg.getAttribute('d')).toBeNull();
    expect(container.querySelectorAll('path')).toHaveLength(3);
    expect(tooltipText(container)).toBe('检测到真人照片或受版权保护的 IP 形象');
  });

  it('REJECTED_INVALID + assetType 命中 Cwe ⇒ invalidParameterImage + 多行 tooltip class', () => {
    const { container } = render(<AuthenticityStatusBadge status="rejected_invalid" assetType="Image" />);
    expect(badgeRoot(container).textContent).toBe('规格受限');
    expect(tooltipText(container)).toBe(
      '图片规格受限，请确认满足以下要求：\n'
      + '格式　jpeg / png / webp / bmp / tiff / gif\n'
      + '尺寸　300 ~ 6000 px（宽高）\n'
      + '比例　0.4 ~ 2.5（宽 ÷ 高）\n'
      + '大小　≤ 30 MB',
    );
    expect(tooltipWrap(container)!.getAttribute('data-tooltip-class'))
      .toBe('whitespace-pre-line max-w-xs text-xs leading-relaxed');
  });

  it('REJECTED_INVALID 的 Video / Audio 分别命中 Cwe，缺 assetType 时回退 invalidParameter', () => {
    const video = render(<AuthenticityStatusBadge status="rejected_invalid" assetType="Video" />);
    expect(tooltipText(video.container)).toContain('视频规格受限');
    cleanup();
    const audio = render(<AuthenticityStatusBadge status="rejected_invalid" assetType="Audio" />);
    expect(tooltipText(audio.container)).toContain('音频规格受限');
    cleanup();
    const none = render(<AuthenticityStatusBadge status="rejected_invalid" />);
    expect(tooltipText(none.container)).toBe('该文件的格式、尺寸或时长不满足验证要求');
  });
});

describe('AuthenticityStatusBadge（官方 Ob）· size / variant / disableTooltip', () => {
  it('size 为 number：字体 `${size}px`、图标 `size + 2`', () => {
    const { container } = render(<AuthenticityStatusBadge status="pending" size={20} />);
    expect(badgeRoot(container).style.fontSize).toBe('20px');
    cleanup();
    const approved = render(<AuthenticityStatusBadge status="approved" size={20} />);
    expect(svgOf(approved.container)!.getAttribute('width')).toBe('22');
  });

  it('size 为 string：字体原样、图标 `calc(${size} + 2px)`', () => {
    const { container } = render(<AuthenticityStatusBadge status="pending" size="1em" />);
    expect(badgeRoot(container).style.fontSize).toBe('1em');
    cleanup();
    const approved = render(<AuthenticityStatusBadge status="approved" size="1em" />);
    expect(svgOf(approved.container)!.getAttribute('width')).toBe('calc(1em + 2px)');
    expect(svgOf(approved.container)!.getAttribute('height')).toBe('calc(1em + 2px)');
  });

  it('variant="block" 不加 `truncate`（保留官方模板串的尾随空格），inline 才加', () => {
    const block = render(<AuthenticityStatusBadge status="pending" variant="block" />);
    expect(badgeRoot(block.container).className).toBe('inline-flex items-center shrink-0 ');
    cleanup();
    const inline = render(<AuthenticityStatusBadge status="pending" variant="inline" />);
    expect(badgeRoot(inline.container).className).toBe('inline-flex items-center shrink-0 truncate');
  });

  it('disableTooltip ⇒ 完全不包 tooltip，但徽标本体照常渲染', () => {
    const { container } = render(<AuthenticityStatusBadge status="rejected_invalid" assetType="Image" disableTooltip />);
    expect(tooltipWrap(container)).toBeNull();
    expect(container.firstElementChild!.className).toBe('inline-flex items-center shrink-0 truncate');
    expect(svgOf(container)).toBeNull();
  });
});

describe('AuthenticityStatusBadge（官方 Ob）· 四种语言的 statusText', () => {
  const CASES = [
    { locale: 'zh-CN', pending: '正在验证', rejected: '角色违规' },
    { locale: 'en-US', pending: 'Under Review', rejected: 'Rejected' },
    { locale: 'ja-JP', pending: '検証中', rejected: '不合格' },
    { locale: 'ko-KR', pending: '검증 중', rejected: '거부됨' },
  ] as const;

  for (const c of CASES) {
    it(`${c.locale}：statusText.pending / statusText.rejected`, () => {
      setLocale(c.locale);
      const pending = render(<AuthenticityStatusBadge status="pending" />);
      expect(badgeRoot(pending.container).textContent).toBe(c.pending);
      cleanup();
      const rejected = render(<AuthenticityStatusBadge status="rejected" />);
      expect(badgeRoot(rejected.container).textContent).toBe(c.rejected);
    });
  }
});
