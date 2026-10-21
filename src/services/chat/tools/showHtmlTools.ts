/**
 * `show_html` —— 官方「交互页 / HTML 产物」卡片族的**生产者**（覆盖表 §6「补工具生产者」）。
 *
 * 官方链路（源码级）：
 *   · 工具族 `ONe = Set(["show_html"])`（`lT` @444963）⇒ `$M` 的分支：
 *     `lT(e) => e.content.status !== "completed" ? null : <ure content={e.content}/>`；
 *   · `ure`(`ShowHtmlCard`) 读 `content.request ?? content` 的
 *     `{title, description, artifact_path}`，点击后 `setHtmlPreviewTarget({artifactPath,title,description})`；
 *   · `mst`(`HtmlPreview`) 用 `vo.getCanvasArtifact({canvas_id, artifact_path})` 拉正文。
 *
 * ⚠️ MTV 侧差异（如实登记）：**没有服务端 artifact 接口** ⇒ 正文落到本地 IndexedDB
 * （`chatArtifactService`，`artifacts/<conversationId>/<name>.html`），由 `localHtmlPreviewTransport` 读回。
 * 工具入参因此比官方多一个 `html`（官方那侧文件已经存在，MTV 需要正文才能落盘）；
 * 出参 `officialRequest = {title, description, artifact_path}` **逐字**是官方形状。
 */
import { useAppStore } from '../../../store/useAppStore';
import {
  buildChatArtifactPath,
  writeChatArtifact,
} from '../chatArtifactService';
import { registerAgentTool } from '../toolRegistry';

interface ShowHtmlInput {
  title: string;
  html: string;
  description?: string;
  /** 官方 `artifact_path`；不给就按会话生成 `artifacts/<conversationId>/<slug>.html`。 */
  artifact_path?: string;
}

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'page';
}

export function registerShowHtmlAgentTools(): Array<() => void> {
  return [registerAgentTool<ShowHtmlInput>({
    id: 'show_html',
    title: '生成交互页',
    description: [
      '把一段完整、自包含的 HTML 作为「交互页」产物展示给用户（官方 show_html 卡 + 全屏预览）。',
      'HTML 必须是单文件自包含（样式与脚本内联，不引用外部资源），否则预览里会缺样式。',
      '适合：可视化结果、可交互的演示页、图文报告。',
    ].join(''),
    effect: 'file_write',
    inputSchema: {
      type: 'object',
      required: ['title', 'html'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', maxLength: 1000 },
        html: { type: 'string', minLength: 1 },
        artifact_path: { type: 'string', maxLength: 400 },
      },
    },
    summarizeInput: (input) => `生成交互页「${input.title}」`,
    execute: async (context, input) => {
      const html = input.html ?? '';
      if (!html.trim()) {
        return {
          status: 'error',
          summary: '生成交互页失败：HTML 为空',
          modelContent: 'show_html 需要非空 html。',
          retryable: false,
          errorCode: 'SHOW_HTML_EMPTY',
        };
      }
      const artifactPath = input.artifact_path?.trim()
        || buildChatArtifactPath(context.conversationId, `${slugify(input.title)}.html`);
      await writeChatArtifact({
        projectId: context.projectId,
        conversationId: context.conversationId,
        artifactPath,
        content: html,
        title: input.title,
      });
      /* 官方 `request` 形状逐字：`{title, description, artifact_path}`。 */
      return {
        status: 'success',
        summary: `已生成交互页「${input.title}」`,
        modelContent: JSON.stringify({ artifact_path: artifactPath, title: input.title }),
        officialRequest: {
          title: input.title,
          description: input.description ?? '',
          artifact_path: artifactPath,
        },
      };
    },
    authorize: (context) => (
      useAppStore.getState().currentProjectId === context.projectId
        ? { allowed: true }
        : { allowed: false, reason: '只能给当前项目生成交互页' }
    ),
  })];
}
