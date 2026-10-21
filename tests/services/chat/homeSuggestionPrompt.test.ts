/**
 * 首页建议条的 prompt 归一化 = 官方 `fi`（`index-bundle.js` @1652990 逐字）。
 *
 * 官方点击建议条：`K = () => { !L||u||b||d || ( s(fi(L.prompt)), D.current.scrollTop=0 ) }`
 * （@1656712）⇒ 塞进输入框的一定是 `fi(prompt)`，不是原始 prompt。
 */
import { describe, expect, it } from 'vitest';
import { normalizeHomePrompt } from '../../../src/services/chat/homeSuggestionPrompt';

describe('normalizeHomePrompt（官方 fi）', () => {
  it('没有引用 token ⇒ 原样返回', () => {
    const text = '我想体验最新的 Seedance 2.0 Mini 视频创作能力。';
    expect(normalizeHomePrompt(text)).toBe(text);
  });

  it('单个 token ⇒ 提到最前，其余原样', () => {
    expect(normalizeHomePrompt('帮我看看 {{image:abc123}} 这张图')).toBe('{{image:abc123}} 帮我看看  这张图');
  });

  it('多个 token ⇒ 用空格连起来放最前', () => {
    expect(normalizeHomePrompt('{{image:a}}和{{video:b}}对比一下')).toBe('{{image:a}} {{video:b}} 和对比一下');
  });

  it('token 后紧跟中文时不吃字（只剥行首空白）', () => {
    expect(normalizeHomePrompt('{{node:x}}继续')).toBe('{{node:x}} 继续');
  });
});
