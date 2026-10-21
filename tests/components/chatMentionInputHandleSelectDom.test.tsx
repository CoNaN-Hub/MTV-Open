// @vitest-environment jsdom
/**
 * 官方 `Ne`（`handleSelect`，插件 / 技能 / 连接器插入路径）在 `ChatMentionInput` 上的**真实 DOM**回归。
 *
 * 官方逐字（`vendor-pkg-canvas-ChpWx5JY.js` @2527922 内的 `MessageInputAreaV2`）：
 * ```js
 * Ne = useCallback(async (Ee, tt) => {
 *   const Ke = Ee.type === "plugin" && Ee.renderText ? $q(Ee.renderText) : null;
 *   if (Ke) {
 *     if (Ee.pluginIsInstalled !== !0) return;                       // ① 未安装 ⇒ 直接 return
 *     const {editor: We, range: st} = tt;
 *     We.chain().focus().deleteRange({from: st.from, to: st.to}).run();
 *     const lt = We.getText();
 *     …yt = {pluginName, displayName, description, downloadCount:"0", isInstalled, status,
 *            isUpdateAvailable:!1, skills, connectors, marketingSlots:[], iconUrl}…
 *     if (!lrt(yt, Ee.pluginConnectorStatus)) {                      // ② 未就绪 ⇒ 先连接
 *       r(lt); const pt = ue(lt); g(pt), f.current?.setContentHtml(pt);
 *       sn.getState().setPluginToConnect({...yt, isInstalled:!0, status: …}); return;
 *     }
 *     const ot = _p(yt, b, lt);                                      // ③ 就绪 ⇒ 写 `{{plugin:skill}}`
 *     if (ot) { Fe.current = ot, r(ot); const pt = ue(ot); g(pt), f.current?.setContentHtml(pt); }
 *     return;
 *   }
 *   …插入 mention 节点 + 一个空格（官方默认分支 `m`）…
 * }, [b, r, ue]);
 * ```
 * 驱动方式：`ChatMentionInput` 的命令式 handle `insertText('@')` 会往编辑器里插入 `@`，
 * 触发官方的 `findSuggestionMatch`（未激活时「光标前一个字符正好是 `char`」）→ tippy 弹层。
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatMentionInput, { type ChatMentionInputHandle } from '../../src/components/chat/ChatMentionInput';
import type { MentionLookups } from '../../src/services/chat/mentionTokens';
import type { MentionPluginSource } from '../../src/services/chat/mentionPlugins';

afterEach(cleanup);

const lookups: MentionLookups = {
  nodeTitleMap: new Map(),
  fileTitleMap: new Map(),
  brainstormLabel: '头脑风暴',
};

const plugin: MentionPluginSource = {
  pluginName: 'demo',
  displayName: '演示应用',
  description: '应用描述',
  isInstalled: true,
  status: 'enabled',
  skills: [],
  connectors: [],
};

/** tippy 首次挂载 + React 树 flush。 */
const flushPopup = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
};

async function openPanel(
  props: Partial<React.ComponentProps<typeof ChatMentionInput>> = {},
) {
  const ref = createRef<ChatMentionInputHandle>();
  const onChange = vi.fn();
  const view = render(
    <ChatMentionInput ref={ref} value="" onChange={onChange} lookups={lookups} {...props} />,
  );
  await waitFor(() => {
    if (!view.container.querySelector('.ProseMirror')) throw new Error('editor not ready');
  });
  await act(async () => { ref.current!.insertText('@'); });
  await flushPopup();
  await waitFor(() => {
    if (!document.querySelector('[data-mention-panel]')) throw new Error('panel not ready');
  });
  return { ...view, onChange, ref };
}

/** 面板里「应用」分组的第一行按钮。 */
function firstPluginRow(): HTMLElement {
  const headers = [...document.querySelectorAll('[data-mention-panel] p')];
  const header = headers.find((el) => el.textContent === '应用');
  const section = header?.parentElement?.parentElement as HTMLElement;
  return section.querySelector('button') as HTMLElement;
}

describe('ChatMentionInput —— 官方 `Ne`（插件插入路径）', () => {
  it('未传 `mentionPlugins` ⇒ 不渲染应用分组，也不接 `handleSelect`（保持官方 `qie` 的 `showPlugins:!1`）', async () => {
    await openPanel({ mentionItems: () => [], onSearchMentions: () => [] });
    expect([...document.querySelectorAll('[data-mention-panel] p')].some((el) => el.textContent === '应用')).toBe(false);
  });

  it('传了 `mentionPlugins` ⇒ 应用分组出现，行显示 `displayName`', async () => {
    await openPanel({ mentionPlugins: [plugin] });
    expect(firstPluginRow().textContent).toBe('演示应用');
  });

  it('点击已就绪的应用行 ⇒ 删掉 `@query` 并把 `{{demo:demo}}` 写进 value（官方 `_p` + `I0e`）', async () => {
    const { onChange } = await openPanel({ mentionPlugins: [plugin] });
    await act(async () => { fireEvent.click(firstPluginRow()); });
    /* 官方 `_p(detail, sessionId, lt)` ⇒ `I0e(text, "demo", C$({...}))` ⇒ `{{demo:demo}} `。 */
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toBe('{{demo:demo}} ');
  });

  it('未安装（`pluginIsInstalled !== true`）⇒ 官方直接 return：不删 `@query`、不写 value', async () => {
    const { onChange } = await openPanel({
      mentionPlugins: [{ ...plugin, isInstalled: false }],
    });
    /* 输入 `@` 本身会让 value 变成 `@`（编辑器文本回调），点击前后**调用次数不变**才是官方语义。 */
    const before = onChange.mock.calls.length;
    await act(async () => { fireEvent.click(firstPluginRow()); });
    expect(onChange.mock.calls.length).toBe(before);
  });

  it('已安装但未启用（`lrt` 拦下）⇒ 走连接分支：`onPluginNeedsConnect` 收到官方 `yt`，value 还原成普通文本', async () => {
    const onPluginNeedsConnect = vi.fn();
    const { onChange } = await openPanel({
      mentionPlugins: [{ ...plugin, status: 'disabled' }],
      onPluginNeedsConnect,
    });
    await act(async () => { fireEvent.click(firstPluginRow()); });
    expect(onPluginNeedsConnect).toHaveBeenCalledTimes(1);
    /* 官方 `setPluginToConnect({...yt, isInstalled:!0, status:(yt.status??"enabled")==="enabled"?"enabled":"disabled"})`。 */
    expect(onPluginNeedsConnect.mock.calls[0][0]).toMatchObject({
      pluginName: 'demo',
      displayName: '演示应用',
      description: '应用描述',
      downloadCount: '0',
      isInstalled: true,
      status: 'disabled',
      isUpdateAvailable: false,
      skills: [{ name: 'demo', displayName: 'demo', description: '' }],
      connectors: [],
      marketingSlots: [],
    });
    /* 官方 `r(lt)`：把输入值还原成删掉 `@query` 之后的纯文本（这里为空串）。 */
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toBe('');
  });

  it('连接器未认证 ⇒ 同样先走连接分支（官方 `lrt` 的第三个条件）', async () => {
    const onPluginNeedsConnect = vi.fn();
    await openPanel({
      mentionPlugins: [{
        ...plugin,
        skills: [{ name: 'feishu' }],
        connectors: [{ name: 'feishu' }],
      }],
      connectorStatusById: new Map([['feishu', 'pending']]),
      onPluginNeedsConnect,
    });
    await act(async () => { fireEvent.click(firstPluginRow()); });
    expect(onPluginNeedsConnect).toHaveBeenCalledTimes(1);
    expect(onPluginNeedsConnect.mock.calls[0][0]).toMatchObject({
      /* 连接器 name 与技能 name 相同 ⇒ `C$` 回落 `skills[0].name`。 */
      skills: [{ name: 'feishu', displayName: 'feishu', description: '' }],
      connectors: [{ name: 'feishu', displayName: 'feishu', description: '' }],
    });
  });

  it('连接器已认证 ⇒ 直接写入 token，且 `onPluginActivate` 收到插件名（官方 `_p` 的 `setActivePlugin`）', async () => {
    const onPluginActivate = vi.fn();
    const { onChange } = await openPanel({
      mentionPlugins: [{
        ...plugin,
        skills: [{ name: 'feishu' }],
        connectors: [{ name: 'feishu' }],
      }],
      connectorStatusById: new Map([['feishu', 'authenticated']]),
      onPluginActivate,
    });
    await act(async () => { fireEvent.click(firstPluginRow()); });
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0]).toBe('{{demo:feishu}} ');
    expect(onPluginActivate).toHaveBeenCalledWith('demo', null);
  });
});
