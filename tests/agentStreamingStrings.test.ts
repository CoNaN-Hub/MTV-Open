/**
 * 官方 `chatAdapter.streaming.*` 文案表回归
 * （`index-DjCL4F9p.js`：en@8460904 一带 · ja@8869157 · ko@9006350 · zh@9138170 逐字）。
 *
 * 这组测试同时锁住一个**已修的真 bug**：原先 `ThinkingStatusLine` 用的是
 * `t('重连中...')` / `t('停止中...')`，这两个键在 MTV 的 zh 字典里不存在，
 * i18n 的兜底是「原样返回 key」⇒ 英/日/韩三种语言下会直接吐中文源串。
 */
import { describe, expect, it } from 'vitest';
import { streamLabel } from '../src/services/chat/streamingStrings';

describe('streamingStrings（官方 chatAdapter.streaming.*）', () => {
  it('四语的 recovering / interrupted 与官方逐字一致（不再是中文源串兜底）', () => {
    expect(streamLabel('recovering', 'zh-CN')).toBe('正在重连...');
    expect(streamLabel('recovering', 'en-US')).toBe('Reconnecting...');
    expect(streamLabel('recovering', 'ja-JP')).toBe('再接続中...');
    expect(streamLabel('recovering', 'ko-KR')).toBe('재연결 중...');

    expect(streamLabel('interrupted', 'zh-CN')).toBe('正在停止...');
    expect(streamLabel('interrupted', 'en-US')).toBe('Stopping...');
    expect(streamLabel('interrupted', 'ja-JP')).toBe('停止中...');
    expect(streamLabel('interrupted', 'ko-KR')).toBe('중지 중...');
  });

  it('官方 Jx 四档活动文案齐全', () => {
    for (const locale of ['zh-CN', 'en-US', 'ja-JP', 'ko-KR']) {
      for (const key of ['thinking', 'working', 'processing', 'composing']) {
        const value = streamLabel(key, locale);
        expect(value).toBeTruthy();
        expect(value).not.toBe(key);
      }
    }
    expect(streamLabel('thinking', 'zh-CN')).toBe('思考中...');
    expect(streamLabel('working', 'en-US')).toBe('Working...');
    expect(streamLabel('processing', 'ja-JP')).toBe('実行中...');
    expect(streamLabel('composing', 'ko-KR')).toBe('정리 중...');
  });

  it('stoppedByUser 与官方一致', () => {
    expect(streamLabel('stoppedByUser', 'zh-CN')).toBe('你已停止本次回复');
    expect(streamLabel('stoppedByUser', 'en-US')).toBe('You stopped this response');
    expect(streamLabel('stoppedByUser', 'ja-JP')).toBe('応答を停止しました');
    expect(streamLabel('stoppedByUser', 'ko-KR')).toBe('응답을 중지했습니다');
  });

  it('压缩上下文两键（官方 `Tie`/CompactLifecycleLine 用）齐全且逐字一致', () => {
    expect(streamLabel('compacting', 'zh-CN')).toBe('正在自动压缩上下文');
    expect(streamLabel('compacted', 'zh-CN')).toBe('上下文已自动压缩');
    expect(streamLabel('compacting', 'en-US')).toBe('Automatically compacting context');
    expect(streamLabel('compacted', 'en-US')).toBe('Context automatically compacted');
    expect(streamLabel('compacting', 'ja-JP')).toBe('コンテキストを自動圧縮中');
    expect(streamLabel('compacted', 'ja-JP')).toBe('コンテキストを自動圧縮しました');
    expect(streamLabel('compacting', 'ko-KR')).toBe('컨텍스트 자동 압축 중');
    expect(streamLabel('compacted', 'ko-KR')).toBe('컨텍스트 자동 압축 완료');
  });

  it('未知 locale 回落英文；未知 key 原样返回', () => {
    expect(streamLabel('thinking', 'fr-FR')).toBe('Thinking...');
    expect(streamLabel('nope', 'zh-CN')).toBe('nope');
  });
});
