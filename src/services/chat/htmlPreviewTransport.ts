/**
 * `htmlPreview` 的数据面 —— 官方 `vo.*` / `mr` / `ne` 三个外部实体的落户处（**端点逐字**，**传输未解析**）。
 *
 * 官方端点常量（`vendor-packages-jvPqKqU8.js` @695040 / @696959，逐字）：
 * ```
 * GET_CANVAS_ARTIFACT:e=>`/api/agent-gateway/v1/canvases/${e}/artifact`,
 * SHARED_PAGES:"/api/agent-gateway/v1/shared-pages",
 * SHARED_PAGE:e=>`/api/agent-gateway/v1/shared-pages/${e}`,
 * SHARED_PAGE_BY_ARTIFACT:e=>`/api/agent-gateway/v1/canvases/${e}/shared-page`
 * ```
 * 官方方法（@702560 / @705634，逐字）：
 * ```
 * getCanvasArtifact:e=>{const t=`${Ce.GET_CANVAS_ARTIFACT(e.canvas_id)}?artifact_path=${encodeURIComponent(e.artifact_path)}`;return ye().Get(t,{cache:"no-cache"})},
 * shareHtmlArtifact:e=>ye().Post(Ce.SHARED_PAGES,e),
 * getSharedPage:e=>ye().Get(Ce.SHARED_PAGE(e.token),{cache:"no-cache"}),
 * getSharedPageByArtifact:e=>ye().Get(Ce.SHARED_PAGE_BY_ARTIFACT(e.canvas_id),{params:{artifact_path:e.artifact_path},cache:"no-cache"})
 * ```
 * 官方上传（`vendor-packages` @56003，逐字）：`function Wt(e,t){return Dh.upload(e,t)}`，别名 `mr`
 * ⇒ 返回 `{success, fileInfo:{file_id, url}}`。
 *
 * ⚠️ **官方实体未解析，待替换**（诚实清单，见报告）：
 *   1. `ye()`（官方 HTTP 客户端）与 `Dh.upload` 未挖到 ⇒ 本文件**没有**伪造 fetch 调用，
 *      `officialHtmlPreviewTransport` 的方法一律抛 {@link HtmlPreviewTransportUnavailableError}，
 *      使预览器如实落到官方 `{status:"error"}` / `shareFailed` 分支，而不是假装成功。
 *   2. 端点路径**逐字保留**在 {@link HTML_PREVIEW_ENDPOINTS} / {@link buildCanvasArtifactPath} /
 *      {@link buildSharedPageByArtifactPath} 里，接线时直接接上 MTV 的传输层即可。
 *   3. `ne`（toast）已可用 MTV 的 `showToast` 等价承载，见 {@link officialToast}。
 */
import { useAppStore } from '../../store/useAppStore';
import { readChatArtifact } from './chatArtifactService';

/** 官方 `Ce` 端点常量（逐字）。 */
export const HTML_PREVIEW_ENDPOINTS = {
  GET_CANVAS_ARTIFACT: (canvasId: string) => `/api/agent-gateway/v1/canvases/${canvasId}/artifact`,
  SHARED_PAGES: '/api/agent-gateway/v1/shared-pages',
  SHARED_PAGE: (token: string) => `/api/agent-gateway/v1/shared-pages/${token}`,
  SHARED_PAGE_BY_ARTIFACT: (canvasId: string) => `/api/agent-gateway/v1/canvases/${canvasId}/shared-page`,
} as const;

/** 官方 `getCanvasArtifact` 的 URL 拼装（逐字含 `?artifact_path=` 与 `encodeURIComponent`）。 */
export function buildCanvasArtifactPath(input: {
  canvas_id: string;
  artifact_path: string;
}): string {
  return `${HTML_PREVIEW_ENDPOINTS.GET_CANVAS_ARTIFACT(input.canvas_id)}?artifact_path=${encodeURIComponent(input.artifact_path)}`;
}

/** 官方 `getSharedPageByArtifact` 的 URL 拼装（逐字，走 `params` 等价形态）。 */
export function buildSharedPageByArtifactPath(input: {
  canvas_id: string;
  artifact_path: string;
}): string {
  return `${HTML_PREVIEW_ENDPOINTS.SHARED_PAGE_BY_ARTIFACT(input.canvas_id)}?artifact_path=${encodeURIComponent(input.artifact_path)}`;
}

/** 官方 `shareHtmlArtifact` 的请求载荷形状（`mst` 的 `g` 逐字构造）。 */
export interface ShareHtmlArtifactInput {
  file_id: string;
  title: string;
  description: string;
  canvas_id?: string;
  source_artifact_path: string;
}

/** `vo` 的对外形状（官方四个方法 + `mr` 上传）。 */
export interface HtmlPreviewTransport {
  getCanvasArtifact(input: {
    canvas_id: string;
    artifact_path: string;
  }): Promise<{ data?: { artifact?: { content?: unknown } } }>;
  getSharedPageByArtifact(input: {
    canvas_id: string;
    artifact_path: string;
  }): Promise<{ data?: { token?: string } }>;
  shareHtmlArtifact(input: ShareHtmlArtifactInput): Promise<{ data?: { token?: string } }>;
  /** 官方 `mr(file)`（= `Wt(e,t)` → `Dh.upload`）。 */
  uploadSharePage(file: File): Promise<{ success?: boolean; fileInfo?: { file_id?: string; url?: string } }>;
}

/** 官方传输层未解析时抛这个 —— 保证预览器走官方失败分支，而不是静默假装成功。 */
export class HtmlPreviewTransportUnavailableError extends Error {
  constructor(method: string) {
    super(
      `official htmlPreview transport is not resolved yet (${method}); ` +
        '官方实体未解析，待替换：`ye()` / `Dh.upload` 未挖到',
    );
    this.name = 'HtmlPreviewTransportUnavailableError';
  }
}

/**
 * 官方 `vo` + `mr` 在 MTV 侧的落地实现。
 *
 * · `getCanvasArtifact` —— **本地**实现：从本地 artifact 表（`chatArtifactService`，
 *   key = `projectId::artifact_path`）读正文，按官方的 `{data:{artifact:{content}}}` 形状返回。
 *   ⚠️ 这是**数据源差异**而非语义差异：官方那份在服务端，字段名
 *   （`canvas_id` / `artifact_path` / `artifact.content`）逐字保留。
 * · 其余三个是**服务端**方法（分享 token / 分享上传）：MTV 没有对应后端 ⇒ 抛
 *   {@link HtmlPreviewTransportUnavailableError}，让预览器走官方失败分支
 *   （`getSharedPageByArtifact` 官方本来就 `.catch(()=>{})` 静默忽略；分享则 toast「分享失败」）。
 */
export const officialHtmlPreviewTransport: HtmlPreviewTransport = {
  async getCanvasArtifact(input) {
    const record = await readChatArtifact(input.canvas_id, input.artifact_path);
    if (!record) return { data: { artifact: { content: undefined } } };
    return { data: { artifact: { content: record.content } } };
  },
  async getSharedPageByArtifact(input) {
    void buildSharedPageByArtifactPath(input);
    throw new HtmlPreviewTransportUnavailableError('vo.getSharedPageByArtifact');
  },
  async shareHtmlArtifact(input) {
    void HTML_PREVIEW_ENDPOINTS.SHARED_PAGES;
    void input;
    throw new HtmlPreviewTransportUnavailableError('vo.shareHtmlArtifact');
  },
  async uploadSharePage(file) {
    void file;
    throw new HtmlPreviewTransportUnavailableError('mr');
  },
};

export const localHtmlPreviewTransport = officialHtmlPreviewTransport;

/**
 * 官方 `ne`（toast）在 MTV 侧的承载：`ne.success(msg)` / `ne.error(msg)` ⇒
 * `useAppStore.getState().showToast(msg, 'success' | 'error')`（`store.toast.ts` 的 `showToast`）。
 */
export const officialToast = {
  success(message: string): void {
    useAppStore.getState().showToast(message, 'success');
  },
  error(message: string): void {
    useAppStore.getState().showToast(message, 'error');
  },
};
