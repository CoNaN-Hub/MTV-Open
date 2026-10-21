// @vitest-environment jsdom
/**
 * 第 61 轮：官方**新版**「详细过程」(`progressDetails`) 的工具结果块 —— 用户图 2 里那个「输出」框。
 *
 * 官方逐字（新版 `vendor-pkg-canvas-CvbAwZyy.js` @440773）：`OX` 把
 * `response.{summary,description,message}` → **结果**、`{text,output,content,result,stdout*}` → **输出**、
 * `{stderr*,error.message}` → **错误输出**、`text_preview` → **文件内容**；
 * `truncated` ⇒ 「当前为部分结果…」。渲染见 `ToolPublicResult`（`<pre class="… font-mono …">`）。
 * MTV 生产者（**第 72 轮按官方真机取证修正**）：只有 `content.response.summary`（= 「结果」块）。
 * 官方 `response.output/text/content/result/stdout*` 在官方真机与官方产物里**都没有客户端生产者**
 * ⇒ MTV 结构化工具**不写也不渲染**「输出」块（`data-tool-public-result` 不出现）。
 *
 * 验证分级 = **(a) 官方真机 CDP + (b) jsdom 真 DOM + (d) 源码级**。
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import ToolPublicResult from '../../src/components/chat/ToolPublicResult';
import { setLocale } from '../../src/i18n';
import { toolPublicResultSections, OFFICIAL_SKIP_TEXTS } from '../../src/services/chat/toolPublicResult';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

afterEach(cleanup);

describe('progressDetails 纯函数层（官方 `OX`）', () => {
  it('response.summary → 结果；response.output → 输出；键映射逐字', () => {
    const { sections } = toolPublicResultSections({
      response: { summary: '已运行 2/2 个节点', output: 'Launching skill: tapnow-cli:tapnow-cli' },
    });
    expect(sections).toEqual([
      { kind: 'summary', text: '已运行 2/2 个节点' },
      { kind: 'output', text: 'Launching skill: tapnow-cli:tapnow-cli' },
    ]);
  });

  it('stderr → 错误输出；error.message 追加为错误输出；truncated 透传', () => {
    const { sections, truncated } = toolPublicResultSections({
      response: { stderr: 'boom', truncated: true },
      error: { message: '工具执行失败' },
    });
    expect(sections).toEqual([
      { kind: 'errors', text: 'boom' },
      { kind: 'errors', text: '工具执行失败' },
    ]);
    expect(truncated).toBe(true);
  });

  it('content[].type==="text" → 输出；重复文本去重', () => {
    const { sections } = toolPublicResultSections({
      response: { content: [{ type: 'text', text: 'A' }, { type: 'text', text: 'A' }, { type: 'image' }, { type: 'text', text: 'B' }] },
    });
    expect(sections).toEqual([{ kind: 'output', text: 'A' }, { kind: 'output', text: 'B' }]);
  });

  it('omitTexts 命中（大小写无关）与空文本不产出；官方 `Mae` = ["tapnow cli"]', () => {
    expect(OFFICIAL_SKIP_TEXTS).toEqual(['tapnow cli']);
    const { sections } = toolPublicResultSections(
      { response: { summary: 'TapNow CLI', output: 'keep me', description: '   ' } },
      ['tapnow cli', ''],
    );
    expect(sections).toEqual([{ kind: 'output', text: 'keep me' }]);
  });

  it('没有任何字段 ⇒ 空（组件返回 null，不占位）', () => {
    expect(toolPublicResultSections({ response: {} })).toEqual({ sections: [], truncated: false });
  });
});

describe('progressDetails 组件（官方 `TT`）', () => {
  it('渲染「输出」标签 + <pre> 文本（官方类名逐字）', () => {
    setLocale('zh-CN');
    render(<ToolPublicResult payload={{ response: { output: 'Launching skill: tapnow-cli:tapnow-cli' } }} />);
    const block = document.body.querySelector('[data-tool-public-result]')!;
    expect(block).not.toBeNull();
    expect(block.className).toContain('mt-1 space-y-1.5 pl-6');
    expect(block.textContent).toContain('输出');
    const pre = block.querySelector('pre')!;
    expect(pre.className).toContain('max-h-48');
    expect(pre.className).toContain('font-mono');
    expect(pre.className).toContain('bg-foreground/5');
    expect(pre.textContent).toBe('Launching skill: tapnow-cli:tapnow-cli');
  });

  it('hideErrors ⇒ 错误输出不显示；truncated ⇒ 官方提示条', () => {
    setLocale('zh-CN');
    render(
      <ToolPublicResult
        hideErrors
        payload={{ response: { output: 'ok', stderr: 'bad', truncated: true } }}
      />,
    );
    const block = document.body.querySelector('[data-tool-public-result]')!;
    expect(block.textContent).not.toContain('bad');
    expect(block.textContent).toContain('当前为部分结果');
  });

  it('无内容 ⇒ 不渲染（官方 `if (!visible.length && !truncated) return null`）', () => {
    setLocale('zh-CN');
    render(<ToolPublicResult payload={{ response: {} }} />);
    expect(document.body.querySelector('[data-tool-public-result]')).toBeNull();
  });

  it('四语言词条都在（官方新版逐字）', () => {
    for (const [locale, output] of [['zh-CN', '输出'], ['en-US', 'Output'], ['ja-JP', '出力'], ['ko-KR', '출력']] as const) {
      setLocale(locale);
      cleanup();
      render(<ToolPublicResult payload={{ response: { output: 'x' } }} />);
      expect(document.body.textContent).toContain(output);
    }
    setLocale('zh-CN');
  });
});

describe('源码级：挂载点与生产者', () => {
  it('工具行内挂载（官方 `zae`：chips 行之前，omitTexts 含 label/描述/`Mae`）', () => {
    const source = read('src/components/chat/ToolActivityDetailList.tsx');
    expect(source).toContain('<ToolPublicResult');
    expect(source).toContain('hideErrors');
    expect(source).toContain('...OFFICIAL_SKIP_TEXTS');
    /* 位置：在 chips 行分支之前（官方 `zae` 的顺序）。 */
    expect(source.indexOf('<ToolPublicResult')).toBeLessThan(source.indexOf('{!active && chips.length > 0 ?'));
  });

  it('生产者：MTV **不**写 `response.output` / `response.truncated`（官方真机无该字段）', () => {
    const executor = read('src/services/chat/agentRoundExecutor.ts');
    /* 第 72 轮修正：官方真机实测画布类工具行的 `content.response` 只有结构化字段，
       `output/text/content/result/stdout*` 一个都没有；官方产物里 `output:` 只出现在
       `OX` 的键表与 `TT` 的兜底词典 ⇒ 没有任何客户端生产者。
       第 61 轮把 MTV 的 `modelContent`（给模型看的载荷，结构化工具就是 JSON）截断写进
       `content.response.output` ⇒ 画布工具行下多出一坨原始 JSON。这里钉死「不再有该生产者」。 */
    expect(executor).not.toContain('persistedOutputText');
    expect(executor).not.toContain('OUTPUT_TEXT_LIMIT');
    const items = read('src/services/chat/agentActivityItems.ts');
    expect(items).not.toContain('output: toolCall.outputText');
    expect(items).not.toContain('truncated: true');
    /* 「结果」块（官方 `kind:'summary'`）必须保留：官方真机该块存在。 */
    expect(items).toContain("summary: step.outputSummary ?? step.toolCall?.resultSummary ?? ''");
    /* 只允许官方 schema 里存在的载荷通道透传。 */
    expect(items).toContain('...(toolCall?.officialResponse ?? {})');
  });
});
