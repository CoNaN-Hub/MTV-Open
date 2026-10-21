/**
 * `brainstorm_update` —— 官方面板那份 `brainstorm.md` 的**写入工具**。
 *
 * 为什么需要它（覆盖表 §36.4 的证据链）：
 *   · 官方**没有**「助手的回答正文就是文档」这条路。`artifacts/brainstorm.md` 是**产物通道**里的一个 artifact：
 *     `ist()`（@2444453）专门给它一个图标 `xue`、`kV`（@2444845）给它排序与
 *     `chatAdapter.artifactPanel.brainstormLabel`（「Brainstorm」）标签；而产物列表（@2755800 一带）
 *     是从 **`lT`(`show_html` 家族) 的 `content.request.artifact_path`** 收集的
 *     ⇒ 官方是「agent 调工具写 artifact，聊天里是正常回答」。
 *   · MTV 原先在系统指令里要求模型「每次回复都用完整 markdown 重写文档（**只写文档本身**）」并在收尾
 *     `writeBrainstormDoc(全量回答)` ⇒ 同一份内容同时出现在聊天正文与右侧面板（用户实测图 3/4）。
 *
 * 本工具就是那条「写 artifact」的客户端形态：
 *   · 出参 `officialRequest` 用官方通道形状 `{title, description, artifact_path}`；
 *   · 正文按 MTV 的本地落点写进 IndexedDB（`brainstormService`，面板读同一份）；
 *   · 只在**头脑风暴会话**里授权（`conversation.brainstormMode === true`），其它会话一律拒绝。
 */
import { useAppStore } from '../../../store/useAppStore';
import { writeBrainstormDoc } from '../brainstormService';
import { registerAgentTool } from '../toolRegistry';

/** 官方 `artifact_path` 字面量（`ist()`/`II()` 里逐字出现）。 */
export const BRAINSTORM_ARTIFACT_PATH = 'artifacts/brainstorm.md';

interface BrainstormUpdateInput {
  /** **完整**的文档 markdown（不是差异）。 */
  markdown: string;
}

export function registerBrainstormAgentTools(): Array<() => void> {
  return [registerAgentTool<BrainstormUpdateInput>({
    id: 'brainstorm_update',
    title: '更新头脑风暴文档',
    description: [
      '把**完整**的 brainstorm.md 正文写入本次会话的头脑风暴文档（右侧「Brainstorm」面板读的就是它）。',
      '每次调用都要给出整份文档的 markdown（不是差异、不是小节）。',
      '只在头脑风暴会话里可用；普通回答直接写在回复正文里，不要用它代替回答。',
    ].join(''),
    effect: 'file_write',
    inputSchema: {
      type: 'object',
      required: ['markdown'],
      additionalProperties: false,
      properties: {
        markdown: { type: 'string', minLength: 1 },
      },
    },
    summarizeInput: (input) => `更新头脑风暴文档（${(input.markdown ?? '').length} 字）`,
    execute: async (context, input) => {
      const markdown = (input.markdown ?? '').trim();
      if (!markdown) {
        return {
          status: 'error',
          summary: '更新头脑风暴文档失败：正文为空',
          modelContent: 'brainstorm_update 需要非空 markdown。',
          retryable: false,
          errorCode: 'BRAINSTORM_EMPTY',
        };
      }
      await writeBrainstormDoc(context.conversationId, context.projectId, markdown);
      return {
        status: 'success',
        summary: '已更新头脑风暴文档',
        modelContent: JSON.stringify({
          artifact_path: BRAINSTORM_ARTIFACT_PATH,
          title: 'brainstorm.md',
          characters: markdown.length,
        }),
        /* 官方通道形状逐字：`{title, description, artifact_path}`。 */
        officialRequest: {
          title: 'brainstorm.md',
          description: '',
          artifact_path: BRAINSTORM_ARTIFACT_PATH,
        },
      };
    },
    authorize: (context) => {
      const conversation = useAppStore.getState().conversations
        .find((item) => item.id === context.conversationId);
      return conversation?.brainstormMode === true
        ? { allowed: true }
        : { allowed: false, reason: '只有头脑风暴会话可以更新 brainstorm.md' };
    },
  })];
}
