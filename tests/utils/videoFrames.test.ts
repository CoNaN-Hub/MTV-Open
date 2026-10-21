/**
 * 首/尾帧的**顺序语义**（用户裁决：「⇄（首尾帧互换） 按照官方的来」）。
 *
 * 官方源码（`vendor-pkg-canvas-*.js`）：
 *   · @2041103：`first: He[0] ? {…} : null, last: He[1] ? {…} : null`（`at` 按 `data.order` 排序）
 *     ⇒ **位置即身份，没有 frame role**。
 *   · ⇄（@2054966）：`at.length>=2 && (ie(at[0].nodeId), se(null))`
 *     + 效果（@2041103）：`re("image",[1,0])` 50ms 后把两条边的 `data.order` 0↔1 对调。
 *   · 槽位写入：`He==="first" ? se(ds) : ie(ds)`（@2055100 区）。
 *
 * MTV 侧保留 `role` 供请求层组装上游字段，本模块保证「顺序是唯一事实、role 由位置派生」。
 */
import { describe, expect, it } from 'vitest';

import {
  normalizeFrameRoles,
  orderedFrameRefs,
  setFrameSlot,
  swapFrameOrder,
} from '../../src/utils/videoFrames';
import type { VideoReferenceItem } from '../../src/types/aiTypes';

function frame(id: string, url = `${id}.png`): VideoReferenceItem {
  return { id, url, kind: 'frame', role: 'first_frame', label: id, sourceNodeId: id };
}
function character(id: string): VideoReferenceItem {
  return { id: `character:${id}`, url: `${id}.png`, kind: 'character', role: 'reference', label: id };
}

describe('orderedFrameRefs —— 官方 `at`：只取帧引用，按数组顺序', () => {
  it('过滤掉参考角色，保留帧的顺序', () => {
    const refs = [character('c1'), frame('a'), frame('b')];
    expect(orderedFrameRefs(refs).map((item) => item.id)).toEqual(['a', 'b']);
    expect(orderedFrameRefs(undefined)).toEqual([]);
  });
});

describe('normalizeFrameRoles —— role 由位置派生', () => {
  it('顺序与 role 相反时按位置改写（第 0 张一定是首帧）', () => {
    const refs: VideoReferenceItem[] = [
      { ...frame('a'), role: 'last_frame' },
      { ...frame('b'), role: 'first_frame' },
    ];
    const next = normalizeFrameRoles(refs);
    expect(next.map((item) => [item.id, item.role])).toEqual([
      ['a', 'first_frame'],
      ['b', 'last_frame'],
    ]);
  });

  it('参考角色不受影响，顺序不变', () => {
    const refs = [character('c1'), frame('a'), character('c2'), frame('b')];
    const next = normalizeFrameRoles(refs);
    expect(next.map((item) => item.id)).toEqual(refs.map((item) => item.id));
    expect(next[0].role).toBe('reference');
    expect(next[1].role).toBe('first_frame');
    expect(next[3].role).toBe('last_frame');
  });
});

describe('swapFrameOrder —— 官方 `re("image",[1,0])`', () => {
  it('两张帧 ⇒ 连位置一起换，role 仍与位置一致', () => {
    const refs = [
      { ...frame('a'), role: 'first_frame' as const },
      { ...frame('b'), role: 'last_frame' as const },
    ];
    const next = swapFrameOrder(refs);
    expect(next.map((item) => [item.id, item.role])).toEqual([
      ['b', 'first_frame'],
      ['a', 'last_frame'],
    ]);
  });

  it('位置与 role 本来就相反时，按「位置」判定谁是首帧（官方没有 role 概念）', () => {
    const refs: VideoReferenceItem[] = [
      { ...frame('a'), role: 'last_frame' },
      { ...frame('b'), role: 'first_frame' },
    ];
    const next = swapFrameOrder(refs);
    /* 位置 0 的 `a` 是首帧（官方口径）⇒ 换完 `b` 到位置 0 */
    expect(next.map((item) => item.id)).toEqual(['b', 'a']);
    expect(next.map((item) => item.role)).toEqual(['first_frame', 'last_frame']);
  });

  it('帧不足两张 ⇒ 原样返回（官方按钮此时 disabled = `at.length<2`）', () => {
    const one = [frame('a')];
    expect(swapFrameOrder(one).map((item) => item.id)).toEqual(['a']);
    expect(swapFrameOrder([])).toEqual([]);
    /* 三张及以上时官方只用前两张（`at.length>=2` 的动作也只动 `at[0]`） */
    const three = [frame('a'), frame('b'), frame('c')];
    expect(swapFrameOrder(three).map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('参考角色留在原位', () => {
    const refs = [character('c1'), frame('a'), frame('b')];
    const next = swapFrameOrder(refs);
    expect(next.map((item) => item.id)).toEqual(['character:c1', 'b', 'a']);
  });
});

describe('setFrameSlot —— 官方 `se(ds)` / `ie(ds)` 的槽位语义', () => {
  it('两张都在：写首帧 ⇒ `[新, 旧尾]`（旧尾不动）', () => {
    const refs = [frame('a'), frame('b')];
    const next = setFrameSlot(refs, 0, frame('c'));
    expect(next.map((item) => [item.id, item.role])).toEqual([
      ['c', 'first_frame'],
      ['b', 'last_frame'],
    ]);
  });

  it('两张都在：写尾帧 ⇒ `[旧首, 新]`（旧首不动）', () => {
    const refs = [frame('a'), frame('b')];
    const next = setFrameSlot(refs, 1, frame('c'));
    expect(next.map((item) => [item.id, item.role])).toEqual([
      ['a', 'first_frame'],
      ['c', 'last_frame'],
    ]);
  });

  it('只有一张：写尾帧 ⇒ 补成 `[旧首, 新]`', () => {
    const next = setFrameSlot([frame('a')], 1, frame('b'));
    expect(next.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('只有一张：写首帧 ⇒ 替换成 `[新]`（没有尾帧）', () => {
    const next = setFrameSlot([frame('a')], 0, frame('b'));
    expect(next.map((item) => item.id)).toEqual(['b']);
  });

  it('一张都没有：写「尾帧」⇒ 按位置它就是**首帧**（官方没有「只有尾帧」这个状态）', () => {
    const next = setFrameSlot([], 1, frame('a'));
    expect(next.map((item) => [item.id, item.role])).toEqual([['a', 'first_frame']]);
  });

  it('参考角色保持原位，帧条目沿用原本的坑位', () => {
    const next = setFrameSlot([character('c1'), frame('a'), character('c2')], 1, frame('b'));
    expect(next.map((item) => item.id)).toEqual(['character:c1', 'a', 'character:c2', 'b']);
  });
});
