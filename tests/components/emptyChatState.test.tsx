import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import EmptyChatState from '../../src/components/chat/EmptyChatState';
import { setLocale } from '../../src/i18n';

beforeEach(() => {
  setLocale('zh-CN');
});

describe('EmptyChatState', () => {
  it('内容 = 官方空态：问候 + 主句 + 2 张建议卡 + 换一批，没有任何动作按钮', () => {
    const markup = renderToStaticMarkup(<EmptyChatState />);

    /* 官方 `chatAdapter.welcome.greeting` = "Hi {{username}}!"（默认账号 New Tapper） */
    expect(markup).toContain('Hi New Tapper!');
    /* 官方 `chatAdapter.welcome.question` */
    expect(markup).toContain('今天一起创作点什么？');
    /* 官方空态建议 = 本地兜底池（`Cue`）前 2 条，逐字 */
    expect(markup).toContain('看看下一步做什么');
    expect(markup).toContain('找点视觉灵感');
    expect(markup).toContain('请看一下当前画布内容，帮我判断最清晰的下一步创作方向。');
    /* 官方空态只有问候 + 主句 + 建议卡：MTV 原有的「新建对话 / 历史记录 / 智能体中心」
       三颗按钮**全部移除**（会话入口改由头部标题下拉承担，见 ground truth §2/§3）。 */
    expect(markup).not.toContain('智能体中心');
    expect(markup).not.toContain('新建对话');
    expect(markup).not.toContain('历史记录');
    expect(markup).not.toContain('画布 AI 助手');
    /* MTV 自创的能力说明段已按官方移除（官方空态没有这一段） */
    expect(markup).not.toContain('默认助手仍可正常使用');
  });
});
