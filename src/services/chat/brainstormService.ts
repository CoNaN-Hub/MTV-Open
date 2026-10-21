/**
 * brainstormService —— 官方面板里那份 `brainstorm.md` 的**本地**落点（无服务端、无联网）。
 *
 * 官方语义（`artifactPanel.*` + 宿主 `Hoe` 的 props，PAGE@1011251）：
 *   · 文档是**会话级**的（`activeSessionId`），面板按 `## 小节` 分导航，可分段编辑；
 *   · `Update` = 让 Agent 重读画布与对话后重写整份文档（官方提示词 `artifactPanel.updatePrompt`）；
 *   · `Add to Canvas` / `Discuss in chat` / `Generate interactive page` 都基于这份文档；
 *   · `Outputs` = 工作区文件列表。
 * 官方把文档存在服务端 artifact 里；MTV 是本地画布 ⇒ 存在 IndexedDB（`brainstormDocs`，按会话）。
 *   之后若要镜像成项目目录下的真实 `brainstorm.md`，只需在这里加一层文件同步，调用方不用改。
 *
 * ⚠️ 小节切分：官方用 `um(q)` 产出 `sections`（含 `isEmpty`），其精确规则未在客户端产物中可读 ⇒
 *   这里按「`## ` 标题切分、首个 `# ` 标题作为文档标题、空小节标记」实现，并在文档里记账。
 */
import { STORE_BRAINSTORM_DOCS, openDB } from '../indexedDb/schema';

export interface BrainstormDoc {
  /** = conversationId（官方 artifact 也是会话级） */
  id: string;
  projectId: string;
  markdown: string;
  updatedAt: number;
}

export interface BrainstormSection {
  /** 稳定 id（由标题 slug 化得到，重名时追加序号） */
  id: string;
  /** 小节标题（`## xxx` 的 xxx；文首无标题段为「未命名小节」） */
  title: string;
  /** 小节正文（不含标题行） */
  body: string;
  /** 官方 `sections[].isEmpty` */
  isEmpty: boolean;
}

const listeners = new Set<(conversationId: string) => void>();

/** 订阅文档变更（面板/时间线刷新用）。返回取消订阅函数。 */
export function subscribeBrainstorm(
  listener: (conversationId: string) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(conversationId: string): void {
  for (const listener of listeners) {
    try {
      listener(conversationId);
    } catch (error) {
      console.warn('[brainstorm] listener failed:', error);
    }
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 读取某个会话的头脑风暴文档；不存在时返回空串。 */
export async function readBrainstormDoc(conversationId: string): Promise<string> {
  if (!conversationId || typeof indexedDB === 'undefined') return '';
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BRAINSTORM_DOCS, 'readonly');
    const record = await requestToPromise<BrainstormDoc | undefined>(
      tx.objectStore(STORE_BRAINSTORM_DOCS).get(conversationId),
    );
    return record?.markdown ?? '';
  } catch (error) {
    console.warn('[brainstorm] read failed:', error);
    return '';
  }
}

/** 写入（覆盖）某个会话的头脑风暴文档。 */
export async function writeBrainstormDoc(
  conversationId: string,
  projectId: string,
  markdown: string,
): Promise<void> {
  if (!conversationId || typeof indexedDB === 'undefined') return;
  const record: BrainstormDoc = {
    id: conversationId,
    projectId,
    markdown,
    updatedAt: Date.now(),
  };
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BRAINSTORM_DOCS, 'readwrite');
    tx.objectStore(STORE_BRAINSTORM_DOCS).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    notify(conversationId);
  } catch (error) {
    console.warn('[brainstorm] write failed:', error);
  }
}

/** 清空某个会话的头脑风暴文档（官方面板 `artifactPanel.clearContent`）。 */
export async function clearBrainstormDoc(conversationId: string): Promise<void> {
  if (!conversationId || typeof indexedDB === 'undefined') return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BRAINSTORM_DOCS, 'readwrite');
    tx.objectStore(STORE_BRAINSTORM_DOCS).delete(conversationId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    notify(conversationId);
  } catch (error) {
    console.warn('[brainstorm] clear failed:', error);
  }
}

/** 删除项目下全部文档（项目删除时调用），保持与对话/任务一致的清理语义。 */
export async function clearProjectBrainstormDocs(projectId: string): Promise<void> {
  if (!projectId || typeof indexedDB === 'undefined') return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BRAINSTORM_DOCS, 'readwrite');
    const store = tx.objectStore(STORE_BRAINSTORM_DOCS);
    const index = store.index('projectId_updatedAt');
    const keys = await requestToPromise<IDBValidKey[]>(index.getAllKeys(IDBKeyRange.bound(
      [projectId, 0],
      [projectId, Number.MAX_SAFE_INTEGER],
    )));
    for (const key of keys) store.delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('[brainstorm] clear project failed:', error);
  }
}

function slugify(title: string, index: number): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'section'}-${index}`;
}

/** 按 `## ` 标题切分小节（官方 `sections`）。文首（第一个 `## ` 之前）算一个小节。 */
export function parseBrainstormSections(markdown: string): BrainstormSection[] {
  const lines = (markdown ?? '').split('\n');
  const chunks: Array<{ title: string; body: string[] }> = [{ title: '', body: [] }];
  for (const line of lines) {
    const match = /^##\s+(.*)$/.exec(line);
    if (match) {
      chunks.push({ title: match[1].trim(), body: [] });
      continue;
    }
    chunks[chunks.length - 1].body.push(line);
  }
  return chunks
    .map((chunk, index) => {
      const body = chunk.body.join('\n').trim();
      const title = chunk.title || '未命名小节';
      return { id: slugify(title, index), title, body, isEmpty: body.length === 0 };
    })
    .filter((section, index) => index > 0 || section.body.length > 0 || chunkHasTitle(markdown));
}

function chunkHasTitle(markdown: string): boolean {
  return /^\s*##\s+/m.test(markdown ?? '');
}

/** 文档是否为空（官方空态判据）。 */
export function isBrainstormEmpty(markdown: string): boolean {
  return !(markdown ?? '').trim();
}

/** 把某小节的正文写回整份文档（官方面板的分段编辑 Save）。 */
export function replaceBrainstormSection(
  markdown: string,
  sectionId: string,
  nextBody: string,
): string {
  const sections = parseBrainstormSections(markdown);
  const target = sections.find((section) => section.id === sectionId);
  if (!target) return markdown;

  const blocks = sections.map((section, index) => {
    const body = section.id === sectionId ? nextBody.trim() : section.body;
    if (index === 0 && !/^\s*##\s+/m.test(markdown)) return body;
    return `## ${section.title}\n\n${body}`.trim();
  });
  return `${blocks.filter(Boolean).join('\n\n')}\n`;
}

/**
 * 官方 `artifactPanel.updatePrompt` 逐字（EN）：让 Agent 只更新这份文档、不做别的动作。
 * 中文按官方 zh 词条同义落地（官方 zh 表里这条键存在，措辞见 `_out_ca_strings.txt`）。
 */
export const BRAINSTORM_UPDATE_PROMPT_ZH = '请先阅读最新画布与对话上下文，然后重新总结并更新整份 brainstorm.md 文档。只更新 brainstorm.md，不要执行其它任何动作。';
export const BRAINSTORM_UPDATE_PROMPT_EN = 'Please review the latest canvas and conversation context, then re-summarize and update the entire brainstorm.md document. Only update the brainstorm.md document — do not take any other actions.';
