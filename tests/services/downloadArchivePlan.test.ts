import { describe, expect, it } from 'vitest';
import {
  batchFileIdentity,
  canvasArchiveFileName,
  canvasArchiveStamp,
  planDownload,
  uniqueZipEntryNames,
} from '../../src/services/downloadArchivePlan';

/**
 * 官方「下载全部」的分界与命名规则（`zoom-slider-3ZcFvYQO.js`，逐字）：
 *   `m0`  按 `file_id` **全局去重** ⇒ `XU(e) = e.length > 1` ⇒ archive（zip）；否则 direct（原始单文件）
 *   `$9e` `<= 1` 个文件时**不给** `download_name`；否则 `canvas_<yyyyMMddHHmmss>`（**本地时间**）
 *   `NL`  archive 时补 `.zip`
 * 官方实测（CDP 抓 POST body）：`download_name = "canvas_20260925165619"`。
 */
describe('downloadArchivePlan（官方 XU / $9e / NL 的等价实现）', () => {
  it('分界看的是「去重后的文件数」，不是节点数：同一文件被两个节点引用 ⇒ 仍走 direct', () => {
    const plan = planDownload([
      { id: 'a', filePath: 'C:/p/same.png' },
      { id: 'b', filePath: 'C:/p/same.png' },
    ]);
    expect(plan.mode).toBe('direct');
    expect(plan.uniqueItems).toHaveLength(1);
    expect(plan.groups).toHaveLength(1);
    // 两个节点都要算「已完成」，不能只结一个
    expect(plan.groups[0].map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('去重后 2 个文件 ⇒ archive（zip）', () => {
    const plan = planDownload([
      { id: 'a', filePath: 'C:/p/1.png' },
      { id: 'b', filePath: 'C:/p/2.png' },
    ]);
    expect(plan.mode).toBe('archive');
    expect(plan.uniqueItems.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('文件身份优先级：本地路径 > 媒体 URL > 节点 id（文本按节点各算一条）', () => {
    expect(batchFileIdentity({ id: 'a', filePath: 'C:/p/1.png', mediaUrl: 'https://x/1.png' }))
      .toBe('path:C:/p/1.png');
    expect(batchFileIdentity({ id: 'a', mediaUrl: 'https://x/1.png' })).toBe('url:https://x/1.png');
    expect(batchFileIdentity({ id: 'a', textOutput: 'hi' })).toBe('text:a');
    // 两条不同文本 ⇒ 2 个文件 ⇒ archive
    expect(planDownload([{ id: 'a', textOutput: 'x' }, { id: 'b', textOutput: 'y' }]).mode).toBe('archive');
  });

  it('去重保留**首次出现**的顺序（与官方 file_items 的 push 顺序一致）', () => {
    const plan = planDownload([
      { id: 'a', mediaUrl: 'u1' },
      { id: 'b', mediaUrl: 'u2' },
      { id: 'c', mediaUrl: 'u1' },
    ]);
    expect(plan.uniqueItems.map((item) => item.id)).toEqual(['a', 'b']);
    expect(plan.groups[0].map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('空输入 ⇒ direct 且没有代表项（调用方在此之前就已 return，这里只锁定不变式）', () => {
    const plan = planDownload([]);
    expect(plan.mode).toBe('direct');
    expect(plan.uniqueItems).toEqual([]);
  });

  it('建议文件名 = canvas_<yyyyMMddHHmmss>.zip（本地时间，官方实测同口径）', () => {
    const d = new Date(2026, 8, 25, 16, 56, 19); // 2026-09-25 16:56:19 本地时间
    expect(canvasArchiveStamp(d)).toBe('20260925165619');
    expect(canvasArchiveFileName(d)).toBe('canvas_20260925165619.zip');
    // 补零：月/日/时/分/秒都 < 10
    expect(canvasArchiveStamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102030405');
  });

  it('zip 包内同名条目补 _1/_2（⚠️ 官方包内命名不可见，这是 MTV 自定口径）', () => {
    expect(uniqueZipEntryNames(['a.png', 'a.png', 'b.png', 'a.png']))
      .toEqual(['a.png', 'a_1.png', 'b.png', 'a_2.png']);
    // 无扩展名也能补号
    expect(uniqueZipEntryNames(['x', 'x'])).toEqual(['x', 'x_1']);
  });
});
