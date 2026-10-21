/**
 * widget 三件套的 **SSR 静态标记**逐字断言 —— 验证分级 (c)。
 *
 * 断言的是官方 **类串 / DOM 结构 / 属性 / 内联 CSS**（对应 offset 见各组件文件头注释）：
 *   · `WidgetLoadingPlaceholder`（官方 `pre` @2360571）
 *   · `ShowWidgetLoading`（官方 `fre` @2365793）
 *   · `ShowHtmlCard`（官方 `ure` @2358363）
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import WidgetLoadingPlaceholder, {
  OFFICIAL_WIDGET_LOADING_CSS,
} from '../../src/components/chat/WidgetLoadingPlaceholder';
import ShowWidgetLoading from '../../src/components/chat/ShowWidgetLoading';
import ShowWidgetCard from '../../src/components/chat/ShowWidgetCard';
import ShowHtmlCard from '../../src/components/chat/ShowHtmlCard';

describe('WidgetLoadingPlaceholder（官方 `pre` @2360571）—— SSR 逐字', () => {
  it('默认 height=220 + 根/四层/底部行/转圈 类串逐字', () => {
    const markup = renderToStaticMarkup(<WidgetLoadingPlaceholder />);

    expect(markup).toContain(
      'class="my-2 overflow-hidden rounded-xl border border-white/10 bg-[#1F1F1F] relative"',
    );
    expect(markup).toContain('style="height:220px"');

    /* 点阵层 */
    expect(markup).toContain('<div class="absolute inset-0 dot-base"></div>');
    /* 波纹两层（外面套 wave-container） */
    expect(markup).toContain('<div class="absolute inset-0 wave-container">');
    expect(markup).toContain('<div class="absolute inset-0 wave wave-1"></div>');
    expect(markup).toContain('<div class="absolute inset-0 wave wave-2"></div>');
    /* 底部行 */
    expect(markup).toContain(
      '<div class="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-4 py-3">',
    );
    /* 转圈：h-3.5 w-3.5（14×14）· border-[1.5px] */
    expect(markup).toContain(
      '<div class="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/20 border-t-white/60"></div>',
    );
    /* 文案 */
    expect(markup).toContain('<span class="text-[10px] text-white/30 tracking-wider">');
  });

  it('文案优先级 title → messages[index] → chatAdapter.widget.generating', () => {
    expect(renderToStaticMarkup(<WidgetLoadingPlaceholder />)).toContain('正在生成...');
    expect(renderToStaticMarkup(<WidgetLoadingPlaceholder messages={['第一条']} />)).toContain(
      '第一条',
    );
    expect(
      renderToStaticMarkup(<WidgetLoadingPlaceholder title="标题" messages={['第一条']} />),
    ).toContain('标题');
  });

  it('height 覆盖：inline style 用模板串拼 px', () => {
    expect(renderToStaticMarkup(<WidgetLoadingPlaceholder height={320} />)).toContain(
      'style="height:320px"',
    );
  });

  it('内联 <style> 的 dot-base / wave-container / wave-1 / wave-2 / 关键帧**逐字**存在', () => {
    const markup = renderToStaticMarkup(<WidgetLoadingPlaceholder />);
    for (const fragment of [
      '.dot-base {',
      'background-image: radial-gradient(rgba(255,255,255,0.1) 1.5px, transparent 1.5px);',
      'background-size: 18px 18px;',
      'background-position: center;',
      '.wave-container {',
      '-webkit-mask-image: radial-gradient(white 1.5px, transparent 1.5px);',
      '-webkit-mask-size: 18px 18px;',
      '-webkit-mask-position: center;',
      'mask-image: radial-gradient(white 1.5px, transparent 1.5px);',
      'mask-size: 18px 18px;',
      'mask-position: center;',
      '.wave {',
      'filter: blur(14px);',
      'background-repeat: repeat;',
      'will-change: background-position;',
      '.wave-1 {',
      'animation: wave-flow-1 5s linear infinite;',
      'background-size: calc(320px / sin(110deg)) 100%;',
      'rgba(255,255,255,0.5) 120px,',
      'rgba(255,255,255,0.4) 160px,',
      'opacity: 0.7;',
      '.wave-2 {',
      'animation: wave-flow-2 7.5s linear infinite;',
      'background-size: calc(420px / sin(70deg)) 100%;',
      'rgba(255,255,255,0.3) 170px,',
      'rgba(255,255,255,0.25) 220px,',
      'opacity: 0.55;',
      '@keyframes wave-flow-1 {',
      'background-position-x: calc(320px / sin(110deg));',
      '@keyframes wave-flow-2 {',
      'background-position-x: calc(420px / sin(70deg));',
      '110deg,',
      '70deg,',
    ]) {
      expect(markup).toContain(fragment);
    }
    /* 导出常量本身与渲染出的内容一致（防止有人「美化」CSS 后测试仍绿）。 */
    expect(OFFICIAL_WIDGET_LOADING_CSS).toContain('@keyframes wave-flow-2');
  });

  it('§6.4：这四个 class 不是 Tailwind 工具类，而是组件内联 <style>（故不受 purge 影响）', () => {
    const markup = renderToStaticMarkup(<WidgetLoadingPlaceholder />);
    expect(markup).toContain('<style>');
    expect(markup.indexOf('<style>')).toBeGreaterThan(markup.indexOf('dot-base'));
  });
});

describe('ShowWidgetLoading（官方 `fre` @2365793）—— 纯转发', () => {
  it('官方 `fre` 就是 `({title,messages}) => <pre title={title} messages={messages}/>`（**不传 height**）', () => {
    const forwarded = renderToStaticMarkup(<ShowWidgetLoading title="加载中" messages={['a', 'b']} />);
    const direct = renderToStaticMarkup(<WidgetLoadingPlaceholder title="加载中" messages={['a', 'b']} />);
    expect(forwarded).toBe(direct);
    /* 因此高度始终是官方默认 220px */
    expect(forwarded).toContain('style="height:220px"');
  });
});

describe('ShowWidgetCard（官方 `mre` @2363632 + 占位 `Gtt` @2365897）—— SSR 逐字', () => {
  const noop = () => undefined;

  it('根容器 / iframe 属性 / 官方 style 串 / 占位行 逐字', () => {
    const markup = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <ShowWidgetCard content={{ title: '我的小组件', widget_code: '<h1>hi</h1>' } as any} onSendPrompt={noop} />,
    );

    expect(markup).toContain('<div class="my-2 w-full">');
    expect(markup).toContain('sandbox="allow-scripts"');
    expect(markup).not.toContain('allow-same-origin');
    expect(markup).toContain('src="/usercontent-proxy/widget-proxy.html"');
    expect(markup).toContain('title="我的小组件"');
    /* 官方 style 对象逐字：width 100% / height 200px（默认）/ border none / overflow hidden / display none */
    expect(markup).toContain(
      'style="width:100%;height:200px;border:none;overflow:hidden;display:none"',
    );
    /* 占位行 `Gtt`：h-4 w-4（16×16）+ border-2 + 硬编码英文 */
    expect(markup).toContain('<div class="flex items-center gap-2 px-3 py-3">');
    expect(markup).toContain(
      'class="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"',
    );
    expect(markup).toContain('class="text-xs text-muted-foreground"');
    expect(markup).toContain('Loading widget...');
  });

  it('无 widget_code ⇒ 整体返回 null（官方 `!y||d==="error" ? null : …`）', () => {
    expect(
      renderToStaticMarkup(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <ShowWidgetCard content={{ title: '只有标题' } as any} onSendPrompt={noop} />,
      ),
    ).toBe('');
  });
});

describe('ShowHtmlCard（官方 `ure` @2358363）—— SSR 逐字', () => {
  const content = { title: '我的页面', description: '描述文案', artifact_path: 'pages/a.html' };

  it('无 artifact_path ⇒ 整体返回 null', () => {
    expect(renderToStaticMarkup(<ShowHtmlCard content={{ title: 'x' }} />)).toBe('');
    expect(renderToStaticMarkup(<ShowHtmlCard content={{ description: 'd' }} />)).toBe('');
  });

  it('根 button + 4 层装饰 span 类串逐字', () => {
    const markup = renderToStaticMarkup(<ShowHtmlCard content={content} />);

    expect(markup).toContain('<button type="button"');
    expect(markup).toContain(
      'class="group/card relative my-2 flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-2xl bg-chat-bubble-header py-4 pl-5 pr-4 text-left transition-colors duration-200 focus:outline-none"',
    );
    expect(markup).toContain(
      'class="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-200 group-hover/card:bg-white/[0.04]"',
    );
    expect(markup).toContain(
      'class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_80px_at_bottom_left,rgba(155,232,255,0.06)_0%,rgba(0,0,0,0)_100%)] transition-opacity duration-200 group-hover/card:opacity-0"',
    );
    expect(markup).toContain(
      'class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_80px_at_bottom_left,rgba(155,232,255,0.1)_0%,rgba(0,0,0,0)_100%)] opacity-0 transition-opacity duration-200 group-hover/card:opacity-100"',
    );
    expect(markup).toContain(
      'class="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1.5px)] bg-[length:8px_8px] opacity-80 [mask-image:radial-gradient(circle_60px_at_bottom_left,black,transparent)] transition-opacity duration-200 [-webkit-mask-image:radial-gradient(circle_60px_at_bottom_left,black,transparent)] group-hover/card:opacity-100"',
    );
    /* 4 层装饰 span 全是 aria-hidden */
    expect(markup.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('图标 = lucide FileTextSpark，size 28 / 官方逐字 `stroke:1` / 类串逐字', () => {
    const markup = renderToStaticMarkup(<ShowHtmlCard content={content} />);
    expect(markup).toContain('class="lucide lucide-file-text-spark relative shrink-0 text-white/50 transition-colors duration-200 group-hover/card:text-white/80"');
    expect(markup).toContain('width="28"');
    expect(markup).toContain('height="28"');
    expect(markup).toContain('viewBox="0 0 24 24"');
    expect(markup).toContain('stroke="1"');
    expect(markup).toContain('stroke-width="2"');
    /* 官方 iconNode 6 条 path（`file-text-spark`） */
    expect(markup.match(/<path /g)).toHaveLength(6);
  });

  it('标题 `title ?? "HTML"`；标题/副标题类串逐字', () => {
    expect(renderToStaticMarkup(<ShowHtmlCard content={content} />)).toContain('我的页面');
    expect(renderToStaticMarkup(<ShowHtmlCard content={{ artifact_path: 'a.html' }} />)).toContain(
      '>HTML<',
    );

    const markup = renderToStaticMarkup(<ShowHtmlCard content={content} />);
    expect(markup).toContain(
      'class="truncate font-sans text-[14.5px] font-[590] leading-[22.5px] tracking-[-0.375px] text-popover-foreground transition-colors duration-200 group-hover/card:text-foreground"',
    );
    expect(markup).toContain(
      'class="truncate font-sans text-xs font-normal leading-[18px] text-white/60 transition-colors duration-200 group-hover/card:text-white/75"',
    );
    expect(markup).toContain('class="relative flex min-w-0 flex-1 flex-col gap-1"');
  });

  it('⚠️ 副标题是 `chatAdapter.artifactPanel.openInteractivePage`（live 源 `children:c`），**不是** description', () => {
    const markup = renderToStaticMarkup(<ShowHtmlCard content={content} />);
    expect(markup).toContain('打开互动作品');
    /* description 不在渲染结果里出现（只进 store） */
    expect(markup).not.toContain('描述文案');
  });

  it('`content.request ?? content` 的取值口径', () => {
    const nested = renderToStaticMarkup(
      <ShowHtmlCard
        content={{ status: 'completed', request: { title: '内层标题', artifact_path: 'n.html' } }}
      />,
    );
    expect(nested).toContain('内层标题');
    expect(nested).toContain('打开互动作品');
  });
});
