/**
 * 会话**自动标题**（用户实测图 3 vs 图 4：官方历史里是「视觉艺术总监分析」这种名字，MTV 全是「新对话」）。
 *
 * 官方：标题由服务端算好、通过流事件下发
 * （解析 `vendor-packages-CvEFn1fJ.js` @722999 `p==="title"`；消费 `vendor-pkg-canvas-Dp0xADoD.js` @2742808
 *  `onTitle: Xe => l.setConversationTitle(Xe, re)` ⇒ **客户端零命名逻辑**；旧注释引的 @2692515 是错的）。
 * MTV 没有服务端 ⇒ 先截断第一条用户消息，再异步调一次文本模型换成官方那种短名。
 * 验证分级 = **(b) 纯函数 + (d) 源码级**。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanGeneratedTitle, deriveConversationTitle, shouldAutoTitle } from '../../../src/services/chat/conversationTitle';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('deriveConversationTitle', () => {
  it('去掉提及 token 与 markdown 记号，压平空白', () => {
    expect(deriveConversationTitle('@{n15:额度深秋} 用这个 skill 分析这张图'))
      .toBe('用这个 skill 分析这张图');
    expect(deriveConversationTitle('## **视觉** 分析\n\n> 引用'))
      .toBe('视觉 分析 引用');
    expect(deriveConversationTitle('@skill{124yzkbed|visual%E2%80%91art%E2%80%91director} 分析这张图'))
      .toBe('分析这张图');
  });

  it('超过 24 字截断（不加省略号，与官方短标题观感一致）；空输入返回空串', () => {
    const long = '这是一段很长的用户请求'.repeat(5);
    const title = deriveConversationTitle(long);
    expect(title).toHaveLength(24);
    expect(title).not.toContain('…');
    expect(deriveConversationTitle('   ')).toBe('');
    expect(deriveConversationTitle('@{n1:图}')).toBe('');
  });
});

describe('shouldAutoTitle', () => {
  it('默认名（新对话 / 空）且不是用户改过的 ⇒ 可以写自动标题', () => {
    expect(shouldAutoTitle({ title: '新对话', titleSource: 'auto' })).toBe(true);
    expect(shouldAutoTitle({ title: '', titleSource: 'auto' })).toBe(true);
    expect(shouldAutoTitle(undefined)).toBe(false);
  });

  it('用户改过名 / 已有非默认标题 ⇒ 不再覆盖', () => {
    expect(shouldAutoTitle({ title: '新对话', titleSource: 'user' })).toBe(false);
    expect(shouldAutoTitle({ title: '视觉艺术总监分析', titleSource: 'auto' })).toBe(false);
  });
});

describe('cleanGeneratedTitle —— 清洗模型给的短名（纯函数）', () => {
  it('去掉引号/书名号/`标题：`前缀/尾标点，只保留第一行', () => {
    expect(cleanGeneratedTitle('「可爱的小猫」')).toBe('可爱的小猫');
    expect(cleanGeneratedTitle('"雨夜街头调色"。')).toBe('雨夜街头调色');
    expect(cleanGeneratedTitle('标题：饮品居家生活方式广告')).toBe('饮品居家生活方式广告');
    expect(cleanGeneratedTitle('第一行\n第二行解释')).toBe('第一行');
    expect(cleanGeneratedTitle('  《分镜表拆解》  ')).toBe('分镜表拆解');
  });

  it('超过 12 字截断（官方真机那几条都在 8 字上下）；空输出返回空串', () => {
    const long = '这是一个特别特别长的会话标题不应该被采纳';
    expect(cleanGeneratedTitle(long)).toHaveLength(12);
    expect(cleanGeneratedTitle('')).toBe('');
    expect(cleanGeneratedTitle('   \n  ')).toBe('');
    expect(cleanGeneratedTitle('。。。')).toBe('');
  });
});

describe('源码级：控制器在第一条用户消息后写标题', () => {
  it('`submitConversationMessage` 里 `addMessage(userMessage)` 之后调用自动标题', () => {
    const source = read('src/services/chat/conversationExecutionController.ts');
    const addIndex = source.indexOf('store.addMessage(userMessage)');
    const titleIndex = source.indexOf('shouldAutoTitle(conversation)');
    expect(addIndex).toBeGreaterThan(0);
    expect(titleIndex).toBeGreaterThan(addIndex);
    expect(source).toContain('titleSource: \'auto\'');
  });

  it('★ 两条腿：先落截断标题，再异步调模型换成短名（官方那一步的等价物）', () => {
    const source = read('src/services/chat/conversationExecutionController.ts');
    expect(source).toContain('deriveConversationTitle(rawInput)');
    expect(source).toContain('void refineConversationTitle(conversationId, rawInput)');
    /* 起名失败不能影响发消息 ⇒ 服务里自己吞错 */
    const service = read('src/services/chat/conversationTitle.ts');
    expect(service).toContain('catch {');
    expect(service).toContain('conversation.titleSource === \'user\'');
  });
});

