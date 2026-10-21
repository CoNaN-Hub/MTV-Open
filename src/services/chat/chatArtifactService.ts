/**
 * 会话级 HTML 产物的**本地落点** —— 官方 `artifact_path` 在 MTV 侧的数据面。
 *
 * 官方那一侧：`show_html` 工具在服务端落一个 artifact，渲染层 `show_html` 卡
 * (`ure`) 点击后写 `setHtmlPreviewTarget({artifactPath,title,description})`，
 * `mst`(`HtmlPreview`) 再用 `vo.getCanvasArtifact({canvas_id, artifact_path})` 把正文拉回来。
 *
 * ⚠️ MTV 侧的数据源差异（如实登记）：**没有服务端 artifact 接口**，所以正文落在本地
 * IndexedDB（`STORE_CHAT_ARTIFACTS`），由 `localHtmlPreviewTransport` 读回。
 * key = `` `${projectId}::${artifactPath}` `` —— `canvas_id` 在 MTV 里就是 `projectId`。
 * 官方字段名（`artifact_path` / `content`）逐字保留，只有存储介质不同。
 */
import { STORE_CHAT_ARTIFACTS, openDB } from '../indexedDb/schema';

export interface ChatArtifactRecord {
  /** `` `${projectId}::${artifactPath}` ``。 */
  id: string;
  projectId: string;
  conversationId: string;
  /** 官方 `artifact_path`（如 `artifacts/<conversationId>/page.html`）。 */
  artifactPath: string;
  /** 官方 `artifact.content`（HTML 正文）。 */
  content: string;
  title?: string;
  updatedAt: number;
}

export function chatArtifactId(projectId: string, artifactPath: string): string {
  return `${projectId}::${artifactPath}`;
}

/* 与 `brainstormService` 同一套轻量订阅约定：产物面板要能在面板开着时刷新出新产物。 */
const listeners = new Set<(conversationId: string) => void>();

export function subscribeChatArtifacts(listener: (conversationId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(conversationId: string): void {
  for (const listener of listeners) {
    try {
      listener(conversationId);
    } catch (error) {
      console.warn('[chatArtifact] listener failed:', error);
    }
  }
}

/** 官方 artifact 路径的 MTV 约定：按会话分目录，和 `brainstorm.md` 同一套 artifact 语义。 */
export function buildChatArtifactPath(conversationId: string, fileName: string): string {
  const safeName = fileName.trim().replace(/[^\w.-]+/g, '_') || 'page.html';
  return `artifacts/${conversationId}/${safeName}`;
}

export async function writeChatArtifact(record: Omit<ChatArtifactRecord, 'id' | 'updatedAt'>): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CHAT_ARTIFACTS, 'readwrite');
    tx.objectStore(STORE_CHAT_ARTIFACTS).put({
      ...record,
      id: chatArtifactId(record.projectId, record.artifactPath),
      updatedAt: Date.now(),
    } satisfies ChatArtifactRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  notify(record.conversationId);
}

export async function readChatArtifact(projectId: string, artifactPath: string): Promise<ChatArtifactRecord | null> {
  if (!projectId || !artifactPath || typeof indexedDB === 'undefined') return null;
  const db = await openDB();
  return new Promise<ChatArtifactRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_CHAT_ARTIFACTS, 'readonly');
    const request = tx.objectStore(STORE_CHAT_ARTIFACTS).get(chatArtifactId(projectId, artifactPath));
    request.onsuccess = () => resolve((request.result as ChatArtifactRecord | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** 列出一个会话的全部 HTML 产物（官方 artifact 面板的 `workspaceFiles` 在 MTV 侧的对应物）。 */
export async function listChatArtifacts(conversationId: string): Promise<ChatArtifactRecord[]> {
  if (!conversationId || typeof indexedDB === 'undefined') return [];
  const db = await openDB();
  return new Promise<ChatArtifactRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_CHAT_ARTIFACTS, 'readonly');
    const index = tx.objectStore(STORE_CHAT_ARTIFACTS).index('conversationId_updatedAt');
    const request = index.getAll(IDBKeyRange.bound([conversationId, 0], [conversationId, Infinity]));
    request.onsuccess = () => {
      const records = (request.result as ChatArtifactRecord[] | undefined) ?? [];
      /* 官方列表按产物路径稳定排序（不是按写入时间）。 */
      resolve([...records].sort((a, b) => a.artifactPath.localeCompare(b.artifactPath)));
    };
    request.onerror = () => reject(request.error);
  });
}

/** 测试用：清空某项目的全部 HTML 产物。 */
export async function clearChatArtifactsForTests(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CHAT_ARTIFACTS, 'readwrite');
    tx.objectStore(STORE_CHAT_ARTIFACTS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
