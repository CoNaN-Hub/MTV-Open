import { beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';

/**
 * `saveNodeOutputsToDirectory` 的**产物形态**端到端（不碰真磁盘、不弹原生目录框）：
 * 官方分界 = `XU(items) = items.length > 1`（去重后**文件数** > 1 ⇒ zip，== 1 ⇒ 原始单文件），
 * MTV 用 JSZip 本地打包。这里把 Tauri 的目录选择/写盘全部 mock 掉，直接看**写出去的字节**：
 *   · archive 分支：文件名 `canvas_<yyyyMMddHHmmss>.zip`，字节以 `PK\x03\x04` 开头，用 JSZip 能解出条目
 *   · direct 分支：原名单文件，字节就是原始内容（**不是** zip）
 *   · 同一文件被两个节点引用 ⇒ 仍走 direct（去重看文件数，不看节点数）
 */
const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  invoke: vi.fn(),
  resolveUniqueDestPath: vi.fn(),
  buildNodeFileName: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async () => false),
  readFile: mocks.readFile,
  rename: vi.fn(),
  stat: mocks.stat,
  writeFile: mocks.writeFile,
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open, save: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('../../src/services/fs/assetIndex', () => ({ identifyAsset: vi.fn() }));
vi.mock('../../src/services/fs/assetLibrary', () => ({ walkDirectoryFiles: vi.fn() }));
vi.mock('../../src/services/fs/core', () => ({
  arrayBufferToBase64: vi.fn(),
  bytePartsToBase64Async: vi.fn(),
  buildNodeFileName: mocks.buildNodeFileName,
  ensureProjectDataDir: vi.fn(),
  getAssetUrlFromPath: vi.fn(),
  getConvertFileSrc: vi.fn(),
  getFileCategory: vi.fn(),
  getMimeType: () => 'application/octet-stream',
  getProjectDataDir: vi.fn(),
  isTauriEnv: () => true,
  joinPath: (dir: string, name: string) => `${dir}/${name}`,
  notifyProjectDiskChanged: vi.fn(),
  resolveUniqueDestPath: mocks.resolveUniqueDestPath,
  sanitizeFileName: (name: string) => name,
  stripVerbatimPrefix: (path: string) => path,
}));

import { saveNodeOutputsToDirectory, type BatchSaveItem } from '../../src/services/fileService';

/** `data:image/png;base64,` + payload（内容读取会走 `atob` 分支，无需任何网络/文件） */
function dataUrl(payload: string): string {
  return `data:image/png;base64,${Buffer.from(payload, 'utf8').toString('base64')}`;
}

function lastWrittenBytes(): Uint8Array {
  const calls = mocks.writeFile.mock.calls;
  return calls[calls.length - 1][1] as Uint8Array;
}

function lastWrittenPath(): string {
  const calls = mocks.writeFile.mock.calls;
  return calls[calls.length - 1][0] as string;
}

beforeEach(() => {
  mocks.open.mockResolvedValue('C:/out');
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.resolveUniqueDestPath.mockImplementation(async (dir: string, name: string) => `${dir}/${name}`);
  mocks.buildNodeFileName.mockImplementation((label: string | undefined, ext: string) => `${label ?? 'output'}${ext}`);
});

const twoImages: BatchSaveItem[] = [
  { id: 'n1', mediaUrl: dataUrl('AAA'), nodeType: 'ai-image', fileName: '图一' },
  { id: 'n2', mediaUrl: dataUrl('BBB'), nodeType: 'ai-image', fileName: '图二' },
];

describe('download 批量落盘：官方 archive/direct 分界', () => {
  it('去重后 2 个文件 ⇒ 打成 canvas_<stamp>.zip，且包内两条内容正确', async () => {
    const done: Array<[string, string | undefined]> = [];
    const outcome = await saveNodeOutputsToDirectory(twoImages, {
      onItemStart: vi.fn(),
      onItemDone: (id, error) => done.push([id, error]),
    });

    expect(outcome.canceled).toBe(false);
    expect(outcome.failed).toEqual([]);
    expect(outcome.savedIds).toEqual(['n1', 'n2']);
    expect(done).toEqual([['n1', undefined], ['n2', undefined]]);
    // 官方 `$9e` + `NL`：canvas_<yyyyMMddHHmmss>.zip
    expect(outcome.archiveFileName).toMatch(/^canvas_\d{14}\.zip$/);
    expect(lastWrittenPath()).toBe(`C:/out/${outcome.archiveFileName}`);

    const bytes = lastWrittenBytes();
    // zip 本地文件头签名 PK\x03\x04
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(['图一.png', '图二.png']);
    expect(await zip.file('图一.png')!.async('string')).toBe('AAA');
    expect(await zip.file('图二.png')!.async('string')).toBe('BBB');
  });

  it('去重后只有 1 个文件 ⇒ direct：原名单文件、内容原样、**不是** zip', async () => {
    const outcome = await saveNodeOutputsToDirectory([twoImages[0]], {});
    expect(outcome.archiveFileName).toBeUndefined();
    expect(lastWrittenPath()).toBe('C:/out/图一.png');
    expect(Buffer.from(lastWrittenBytes()).toString('utf8')).toBe('AAA');
  });

  it('同一文件被 2 个节点引用 ⇒ 仍走 direct（分界看**文件数**，不是节点数）', async () => {
    const shared: BatchSaveItem[] = [
      { id: 'n1', filePath: 'C:/media/same.png', nodeType: 'ai-image', fileName: '图一' },
      { id: 'n2', filePath: 'C:/media/same.png', nodeType: 'ai-image', fileName: '图二' },
    ];
    mocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const done: string[] = [];
    const outcome = await saveNodeOutputsToDirectory(shared, { onItemDone: (id) => done.push(id) });

    expect(outcome.archiveFileName).toBeUndefined();
    expect(lastWrittenPath()).toBe('C:/out/图一.png');
    // 两个节点都算完成
    expect(outcome.savedIds).toEqual(['n1', 'n2']);
    expect(done).toEqual(['n1', 'n2']);
    // 只读/写了一次（没有为第二个节点重复落盘）
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
  });

  it('包内同名自动补号（⚠️ 官方包内命名不可见，这是 MTV 自定口径）', async () => {
    const sameName: BatchSaveItem[] = [
      { id: 'n1', mediaUrl: dataUrl('AAA'), nodeType: 'ai-image', fileName: '同名' },
      { id: 'n2', mediaUrl: dataUrl('BBB'), nodeType: 'ai-image', fileName: '同名' },
    ];
    await saveNodeOutputsToDirectory(sameName, {});
    const zip = await JSZip.loadAsync(lastWrittenBytes());
    expect(Object.keys(zip.files).sort()).toEqual(['同名.png', '同名_1.png']);
  });

  it('用户取消目录选择 ⇒ canceled，且一个字节都没写', async () => {
    mocks.open.mockResolvedValue(null);
    const outcome = await saveNodeOutputsToDirectory(twoImages, {});
    expect(outcome.canceled).toBe(true);
    expect(outcome.savedIds).toEqual([]);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('读取内容失败 ⇒ 每一项都标失败（不产生半个 zip）', async () => {
    const broken: BatchSaveItem[] = [
      { id: 'n1', mediaUrl: 'https://example.invalid/a.png', nodeType: 'ai-image', fileName: 'a' },
      { id: 'n2', mediaUrl: 'https://example.invalid/b.png', nodeType: 'ai-image', fileName: 'b' },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
    const outcome = await saveNodeOutputsToDirectory(broken, {});
    fetchSpy.mockRestore();

    expect(outcome.savedIds).toEqual([]);
    expect(outcome.failed.map((f) => f.id)).toEqual(['n1', 'n2']);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
});
