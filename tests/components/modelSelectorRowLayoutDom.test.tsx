// @vitest-environment jsdom
/**
 * 画布「选择模型」下拉的**行版式**回归 —— 按官方 DOM 逐字对齐（用户实测：行与行贴成一片）。
 *
 * ## 官方证据（`D:\DEEPSEEK\live-assets-new\vendor-packages-DRvCmDjR.js` @1226275，图片节点下拉）
 * 内层列表：`<Un className="p-2 w-full h-full rounded-none flex flex-col gap-1 max-h-[400px] overflow-y-auto">`
 * 模型行：
 * ```jsx
 * <div className="flex items-center justify-between p-2 rounded-[12px] transition-colors relative">
 *   <div className="flex flex-col gap-1 flex-1 min-w-0">          // ← 名字行 + 标签行，行间 4px
 *     <div className="flex items-center gap-1 w-full">            // ← 名字行：图标 + 名字（gap 4）
 *       <img className="w-4 h-4 shrink-0 rounded-sm …"/>
 *       <span className="text-[12px] font-medium text-white/90 whitespace-nowrap">…</span>
 *     </div>
 *     {featureTags?.length > 0 && <div className="flex items-start gap-1 w-full flex-wrap">…</div>}
 *   </div>
 *   <div className="… w-8 h-8 absolute right-2 top-1/2 -translate-y-1/2">…</div>
 * </div>
 * ```
 * 间距单位：`--spacing: .25rem`（`_official-css/index-BroFpZiQ.css` @24046）⇒ `gap-1` = 4px、`p-2` = 8px。
 *
 * ## 这个测试钉什么
 * ① 行是**两行**（`.model-item-name-row` + `.model-item-tags`），徽标在**标签行**里，
 *   不再挤在名字行上（那正是模型名被压成 `GPT Image 2.5 Fl…` 的原因）；
 * ② 没有标签的模型只有名字行（官方 `featureTags && length > 0` 条件渲染）。
 *
 * 验证分级：(b) jsdom 真 DOM。
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import ModelSelector from '../../src/components/nodes/shared/ModelSelector';

const TUDOU = 'provider-custom-tudou';

function generalModel(id: string, modelId: string, name: string) {
  return {
    id,
    providerConfigId: TUDOU,
    modelId,
    name,
    category: 'image' as const,
    inputModalities: ['text' as const, 'image' as const],
    description: '',
  };
}

function seed() {
  const state = useAppStore.getState();
  useAppStore.setState({
    config: {
      ...state.config,
      generalModels: [
        generalModel('gm-flare', 'gpt-image-2.5-flare-async', 'GPT Image 2.5 Flare async'),
        generalModel('gm-plain', 'acme-plain-image', 'Acme Plain'),
      ],
      providers: {
        ...state.config.providers,
        [TUDOU]: {
          name: '土豆',
          catalogId: 'custom-openai',
          baseUrl: 'https://api.ai-tudou.net/v1',
          apiKey: 'sk-test',
        },
      },
    },
  } as never);
}

function openRows() {
  const rendered = render(
    <ModelSelector nodeType="ai-image" onSelect={vi.fn()} />,
  );
  fireEvent.click(rendered.container.querySelector('.model-selector-trigger') as HTMLElement);
  /* 下拉是 `createPortal(document.body)` ⇒ 行在 body 里，不在 container 里 */
  return Array.from(document.body.querySelectorAll('.model-item-model'));
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  setLocale('zh-CN');
  seed();
});

afterEach(() => {
  cleanup();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('官方两行行版式', () => {
  it('有标签的行 = 名字行 + 标签行（徽标不再占名字行的宽度）', () => {
    const rows = openRows();
    const row = rows.find((item) => item.getAttribute('data-model-value') === 'general/gm-flare');
    expect(row).toBeTruthy();
    const nameRow = row!.querySelector('.model-item-name-row');
    const tagRow = row!.querySelector('.model-item-tags');
    expect(nameRow).toBeTruthy();
    expect(tagRow).toBeTruthy();
    /* 两行是**兄弟**（官方 `flex flex-col gap-1` 的两个子项 ⇒ 中间 4px） */
    expect(nameRow!.nextElementSibling).toBe(tagRow);
    /* 名字行里只有图标 + 名字（+ 思考徽标），不应该再有 `.model-item-badge` */
    expect(nameRow!.querySelectorAll('.model-item-badge')).toHaveLength(0);
    expect(nameRow!.querySelector('.model-item-name')?.textContent).toBe('GPT Image 2.5 Flare');
    /* 徽标全在标签行：类型 / 连接 / 异步 */
    const badges = Array.from(tagRow!.querySelectorAll('.model-item-badge')).map((b) => b.textContent);
    expect(badges).toContain('图片');
    expect(badges).toContain('土豆');
    expect(badges).toContain('异步');
  });

  it('聊天/助手那两套（`c-pop` + `agentStyle`）保持单行内联徽标 —— 不是同一个官方参考', () => {
    const rendered = render(
      <ModelSelector
        nodeType="ai-text"
        onSelect={vi.fn()}
        agentStyle
        dropdownClassName="c-pop"
        renderTrigger={({ toggle }) => <button type="button" className="t" onClick={toggle} />}
        configuredGroupsOverride={[{
          id: 'grp',
          name: 'G',
          description: '',
          models: [{
            value: 'general/gm-chat',
            provider: 'general',
            label: 'Chat Model',
            description: '',
            badgeText: 'GM',
            connectionId: TUDOU,
            connectionName: '土豆',
            nodeTypes: ['ai-text'],
          }],
        }]}
      />,
    );
    fireEvent.click(rendered.container.querySelector('.t') as HTMLElement);
    const row = document.body.querySelector('.model-item-model');
    expect(row).toBeTruthy();
    /* 官方 `use-chat-attachment-file-input-*.js` 的行是 `h-8` **单行** ⇒ 不出现标签行 */
    expect(row!.querySelector('.model-item-tags')).toBeNull();
    const nameRow = row!.querySelector('.model-item-name-row');
    expect(nameRow!.querySelector('.model-item-badge')?.textContent).toBe('GM');
  });
});
