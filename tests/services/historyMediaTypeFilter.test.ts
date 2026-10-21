/**
 * 历史面板「媒体类型」过滤 +「所有项目」跨项目聚合的回归测试。
 *
 * 背景（用户反馈③）：面板原来用**单个** nodeType 查询（video 只查 `ai-video`），
 * 而官方是按 `generation_type`（image/video/audio/threed）过滤的
 * （`page-DVqoHdTT.js`@1611100 附近：`no("image","desc",E)` / `no("video","desc",E)` …），
 * 一个类型覆盖多个 MTV nodeType —— 例如 MTV 的「动画」历史写成 `ai-animation`，
 * 在 `historyCategoryOf` 里属于 **video**，但旧查询查不到 ⇒ 任何 tab 都不显示。
 * 修法：`HistoryQuery.nodeTypes`（一组）+ `TAB_TO_NODE_TYPES`（图片/视频/音频/3D）。
 */
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DB_NAME = 'ai-canvas-db';

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: new IDBFactory(),
  });
  vi.resetModules();
});

interface SeededRecord {
  id: string;
  projectId: string;
  nodeId: string;
  nodeLabel: string;
  timestamp: number;
  prompt: string;
  output: string;
  nodeType: string;
  model: string;
  provider: string;
  status: string;
  mediaUrl?: string;
  filePath?: string;
}

/**
 * 直接用底层 IndexedDB 建库 + 灌记录（与 indexedDbService 的 schema 一致：index `projectId_timestamp_id`）。
 * ⚠️ 版本必须跟 `schema.DB_VERSION` 一致：低于它时，这条常驻连接会把 `indexedDbService` 的升级请求挡成
 * `onblocked`（报「本地数据库正在等待其他软件窗口释放」）。
 */
async function seed(records: SeededRecord[]): Promise<void> {
  const { DB_VERSION } = await import('../../src/services/indexedDb/schema');
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const history = db.createObjectStore('history', { keyPath: 'id' });
      history.createIndex('projectId_timestamp_id', ['projectId', 'timestamp', 'id']);
      history.createIndex('nodeId', 'nodeId');
      db.createObjectStore('metadata', { keyPath: 'id' });
      db.createObjectStore('config', { keyPath: 'id' });
      db.createObjectStore('projects', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      for (const record of records) store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

function record(id: string, projectId: string, nodeType: string, timestamp: number): SeededRecord {
  return {
    id,
    projectId,
    nodeId: `${projectId}-node`,
    nodeLabel: id,
    timestamp,
    prompt: id,
    output: '',
    nodeType,
    model: 'm',
    provider: 'p',
    status: 'success',
  };
}

describe('history media-type filter (用户反馈③)', () => {
  it('nodeTypes 是一组「属于其一」，跨项目聚合不丢同类别记录', async () => {
    const { getHistoryEntriesForExport } = await import('../../src/services/indexedDbService');
    await seed([
      record('a-image', 'p1', 'ai-image', 1),
      record('a-animation', 'p1', 'ai-animation', 2),
      record('a-video', 'p2', 'ai-video', 3),
      record('a-panorama', 'p2', 'ai-panorama', 4),
      record('a-shotlist', 'p2', 'ai-shotlist', 5),
      record('a-audio', 'p2', 'ai-audio', 6),
      record('a-text', 'p1', 'ai-text', 7),
    ]);

    // 视频 tab：官方 generation_type=video ⇒ ai-video + ai-animation（旧单值查询会漏掉后者）
    const video = await getHistoryEntriesForExport('p1', { nodeTypes: ['ai-video', 'ai-animation'] });
    expect(video.map((r) => r.id)).toEqual(['a-animation']);

    // ★ 根因证据：旧口径（单值 `ai-video`）在 p1 里**查不到任何东西** ——
    //   MTV 的「动画」历史就是 `ai-animation`（AINodeDialog 的 `isAnimation` 分支），
    //   而它在 `historyCategoryOf` 里属于 video ⇒ 旧代码下这类记录在任何 tab 都不显示。
    const legacyVideoOnly = await getHistoryEntriesForExport('p1', { nodeType: 'ai-video' });
    expect(legacyVideoOnly).toEqual([]);

    // 图片 tab：ai-image + ai-panorama + ai-shotlist（旧单值查询只会有 a-image）
    const image = await getHistoryEntriesForExport('p2', { nodeTypes: ['ai-image', 'ai-panorama', 'ai-shotlist'] });
    expect(new Set(image.map((r) => r.id))).toEqual(new Set(['a-panorama', 'a-shotlist']));

    // 音频 tab
    const audio = await getHistoryEntriesForExport('p2', { nodeTypes: ['ai-audio'] });
    expect(audio.map((r) => r.id)).toEqual(['a-audio']);

    // 「所有项目」= 对每个项目各查一次再合并（与面板 useEffect 同构），
    // 视频类别跨 p1 / p2 都应出现
    const all = await Promise.all(
      ['p1', 'p2'].map((projectId) => getHistoryEntriesForExport(projectId, { nodeTypes: ['ai-video', 'ai-animation'] })),
    );
    expect(all.flat().map((r) => r.id).sort()).toEqual(['a-animation', 'a-video']);

    // ai-text 在官方 4 tab 里没有归属 ⇒ 任何一类都查不到
    const text = await getHistoryEntriesForExport('p1', { nodeTypes: ['ai-image', 'ai-panorama', 'ai-shotlist'] });
    expect(text.map((r) => r.id)).not.toContain('a-text');
  });

  it('nodeTypes 空数组 = 一类都不匹配（MTV 没有 3D 节点类型 ⇒ 走官方空态）', async () => {
    const { getHistoryEntriesForExport } = await import('../../src/services/indexedDbService');
    await seed([record('a-image', 'p1', 'ai-image', 1)]);
    expect(await getHistoryEntriesForExport('p1', { nodeTypes: [] })).toEqual([]);
    // 不传 nodeTypes / nodeType ⇒ 不过滤（既有调用方语义不变）
    expect((await getHistoryEntriesForExport('p1', {})).map((r) => r.id)).toEqual(['a-image']);
  });

  it('nodeType 单值口径仍然可用（兼容既有调用方）', async () => {
    const { getHistoryEntriesForExport } = await import('../../src/services/indexedDbService');
    await seed([
      record('a-image', 'p1', 'ai-image', 1),
      record('a-animation', 'p1', 'ai-animation', 2),
    ]);
    const only = await getHistoryEntriesForExport('p1', { nodeType: 'ai-animation' });
    expect(only.map((r) => r.id)).toEqual(['a-animation']);
  });
});
