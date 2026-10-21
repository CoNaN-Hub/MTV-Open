/**
 * `widgetStrings` —— 官方 `chatAdapter.widget.*` / `chatAdapter.htmlPreview.*` /
 * `chatAdapter.artifactPanel.openInteractivePage` / `chatAdapter.errors.sendFailed`
 * 四组文案表的**逐字**断言（来源：live bundle locale 块，见文件头 offset 注释）。
 *
 * 验证分级 (d) 源码级 + (c) 串断言。
 */
import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_WIDGET_TEXT,
  officialWidgetText,
  officialWidgetTextKeys,
} from '../../src/services/chat/widgetStrings';

describe('widgetStrings —— 官方文案表（逐字，4 个 locale）', () => {
  it('覆盖 widget 族 + htmlPreview 族的全部 19 个官方 key', () => {
    expect(officialWidgetTextKeys()).toHaveLength(19);
    expect(officialWidgetTextKeys()).toEqual(
      expect.arrayContaining([
        'chatAdapter.widget.generating',
        'chatAdapter.artifactPanel.openInteractivePage',
        'chatAdapter.errors.sendFailed',
        'chatAdapter.htmlPreview.title',
        'chatAdapter.htmlPreview.close',
        'chatAdapter.htmlPreview.loading',
        'chatAdapter.htmlPreview.loadFailed',
        'chatAdapter.htmlPreview.renderFailed',
        'chatAdapter.htmlPreview.retry',
        'chatAdapter.htmlPreview.downloadHtml',
        'chatAdapter.htmlPreview.downloadFailed',
        'chatAdapter.htmlPreview.copy',
        'chatAdapter.htmlPreview.copyFailed',
        'chatAdapter.htmlPreview.share',
        'chatAdapter.htmlPreview.sharing',
        'chatAdapter.htmlPreview.shareCopied',
        'chatAdapter.htmlPreview.shareFailed',
        'chatAdapter.htmlPreview.shareLinkLabel',
        'chatAdapter.htmlPreview.disclaimer',
      ]),
    );
    /* 每个 key 必须齐 4 个 locale（MTV 不支持 fr ⇒ 不入表，官方 fr 值另存于报告）。 */
    for (const key of officialWidgetTextKeys()) {
      expect(Object.keys(OFFICIAL_WIDGET_TEXT[key]).sort()).toEqual([
        'en-US',
        'ja-JP',
        'ko-KR',
        'zh-CN',
      ]);
    }
  });

  it('§6.10 `chatAdapter.widget.generating` 四语逐字（组内唯一键）', () => {
    expect(officialWidgetText('chatAdapter.widget.generating', 'zh-CN')).toBe('正在生成...');
    expect(officialWidgetText('chatAdapter.widget.generating', 'en-US')).toBe('Generating...');
    expect(officialWidgetText('chatAdapter.widget.generating', 'ja-JP')).toBe('生成中...');
    expect(officialWidgetText('chatAdapter.widget.generating', 'ko-KR')).toBe('생성 중...');
  });

  it('`ShowHtmlCard` 副标题 key 逐字（live 源：该卡**真的**渲染它，见 §6.7 分歧）', () => {
    expect(officialWidgetText('chatAdapter.artifactPanel.openInteractivePage', 'zh-CN')).toBe(
      '打开互动作品',
    );
    expect(officialWidgetText('chatAdapter.artifactPanel.openInteractivePage', 'en-US')).toBe(
      'Open interactive page',
    );
  });

  it('`chatAdapter.errors.sendFailed` 逐字', () => {
    expect(officialWidgetText('chatAdapter.errors.sendFailed', 'zh-CN')).toBe(
      '抱歉，发生了错误。请稍后重试。',
    );
    expect(officialWidgetText('chatAdapter.errors.sendFailed', 'en-US')).toBe(
      'Sorry, an error occurred. Please try again later.',
    );
  });

  it('§8.9 `htmlPreview.*` 四语抽样逐字（含 … 单字符省略号）', () => {
    expect(officialWidgetText('chatAdapter.htmlPreview.title', 'zh-CN')).toBe('HTML 预览');
    expect(officialWidgetText('chatAdapter.htmlPreview.title', 'en-US')).toBe('HTML preview');
    expect(officialWidgetText('chatAdapter.htmlPreview.loading', 'zh-CN')).toBe('加载中…');
    expect(officialWidgetText('chatAdapter.htmlPreview.loading', 'ja-JP')).toBe('読み込み中…');
    expect(officialWidgetText('chatAdapter.htmlPreview.loading', 'ko-KR')).toBe('불러오는 중…');
    expect(officialWidgetText('chatAdapter.htmlPreview.sharing', 'zh-CN')).toBe('正在分享…');
    expect(officialWidgetText('chatAdapter.htmlPreview.sharing', 'en-US')).toBe('Sharing…');
    expect(officialWidgetText('chatAdapter.htmlPreview.shareCopied', 'zh-CN')).toBe('分享链接已复制');
    expect(officialWidgetText('chatAdapter.htmlPreview.copyFailed', 'zh-CN')).toBe('复制失败');
    expect(officialWidgetText('chatAdapter.htmlPreview.renderFailed', 'zh-CN')).toBe('渲染失败');
    expect(officialWidgetText('chatAdapter.htmlPreview.shareLinkLabel', 'ko-KR')).toBe('공유 링크');
    expect(officialWidgetText('chatAdapter.htmlPreview.disclaimer', 'zh-CN')).toBe(
      '本页内容由用户借助 AI 生成，可能存在不准确之处，请自行甄别。相关内容与观点均与 TapNow 平台无关。',
    );
  });

  it('未命中的 key ⇒ 回落调用点英文默认值，再回落 key（官方 i18next 兜底顺序）', () => {
    expect(officialWidgetText('chatAdapter.unknown.key', 'zh-CN', 'Fallback')).toBe('Fallback');
    expect(
      officialWidgetText('chatAdapter.unknown.key', 'zh-CN', { defaultValue: 'Obj Fallback' }),
    ).toBe('Obj Fallback');
    expect(officialWidgetText('chatAdapter.unknown.key', 'zh-CN')).toBe('chatAdapter.unknown.key');
  });

  it('表内命中的 key **不**受第二参数影响（与官方 `t(key, {defaultValue})` 一致）', () => {
    expect(officialWidgetText('chatAdapter.htmlPreview.copy', 'zh-CN', 'Copy')).toBe('复制');
  });
});
