/**
 * officialModal —— 官方「通用对话框」命令式 store（`class jas` / `_m`）的行为测试。
 *
 * 逐条对齐官方 `index-BiTZf8mJ.js`@char6110647 的语义：
 *   · `add` 先去重再 push，返回 id
 *   · `generateId()` 形如 `modal-N-<ts>`
 *   · `update` 只改指定 id
 *   · `dismiss(id)` 先置 `isClosing:true` 并通知，**延迟 `dismissDelay ?? 150`** 后才 `onClose()` + 移除
 *   · `dismiss()` 无参 = 关掉最后一个
 *   · `duration > 0` 自动关闭
 *   · `_m.confirm/alert/...` 走 `CA` 归一（字符串 ⇒ `{description}`）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfficialModalStore, type OfficialModalOptions } from '../../src/services/officialModal';

function makeStore() {
  const store = new OfficialModalStore();
  const seen: OfficialModalOptions[][] = [];
  store.subscribe((modals) => seen.push(modals));
  return { store, seen };
}

describe('OfficialModalStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('add 返回 id，形如 modal-N-<ts>，并把 modal 放进列表', () => {
    const { store, seen } = makeStore();
    const id = store.add({ title: '运行整组？' });
    expect(id).toMatch(/^modal-1-\d+$/);
    expect(store.getModals()).toHaveLength(1);
    expect(store.getModals()[0]).toMatchObject({ id, title: '运行整组？' });
    expect(store.getModals()[0].createdAt).toBeTypeOf('number');
    expect(seen).toHaveLength(1);
  });

  it('add 对同 id 先去重再 push（不会出现两条）', () => {
    const { store } = makeStore();
    store.add({ id: 'fixed', title: 'A' });
    store.add({ id: 'fixed', title: 'B' });
    expect(store.getModals()).toHaveLength(1);
    expect(store.getById('fixed')?.title).toBe('B');
  });

  it('update 只改目标 modal，且发一次通知', () => {
    const { store, seen } = makeStore();
    const a = store.add({ title: 'A', description: 'estimating' });
    const b = store.add({ title: 'B' });
    const before = seen.length;
    store.update(a, { description: 'unavailable', confirmButton: { label: '整组执行', disabled: true } });
    expect(store.getById(a)?.description).toBe('unavailable');
    expect(store.getById(a)?.confirmButton).toMatchObject({ disabled: true });
    expect(store.getById(b)?.description).toBeUndefined();
    expect(seen.length).toBe(before + 1);
  });

  it('dismiss(id) 先置 isClosing 通知，再按默认 150ms 延迟移除并调 onClose', () => {
    const { store, seen } = makeStore();
    const onClose = vi.fn();
    const id = store.add({ title: 'A', onClose });

    store.dismiss(id);
    // 通知已发生，但条目还在、且 isClosing
    expect(store.getById(id)?.isClosing).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(seen.at(-1)?.[0]?.isClosing).toBe(true);

    vi.advanceTimersByTime(149);
    expect(onClose).not.toHaveBeenCalled();
    expect(store.getModals()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.getModals()).toHaveLength(0);
  });

  it('dismissDelay 可覆盖默认 150ms', () => {
    const { store } = makeStore();
    const onClose = vi.fn();
    const id = store.add({ onClose, dismissDelay: 400 });
    store.dismiss(id);
    vi.advanceTimersByTime(399);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismiss() 无参 = 关掉最后一个', () => {
    const { store } = makeStore();
    const first = store.add({ title: 'A' });
    const last = store.add({ title: 'B' });
    store.dismiss();
    expect(store.getById(last)?.isClosing).toBe(true);
    expect(store.getById(first)?.isClosing).toBeUndefined();
  });

  it('dismissAll 逐个关掉', () => {
    const { store } = makeStore();
    const a = store.add({});
    const b = store.add({});
    store.dismissAll();
    expect(store.getById(a)?.isClosing).toBe(true);
    expect(store.getById(b)?.isClosing).toBe(true);
  });

  it('duration > 0 时自动关闭', () => {
    const { store } = makeStore();
    const id = store.add({ title: 'A', duration: 500 });
    vi.advanceTimersByTime(500);
    expect(store.getById(id)?.isClosing).toBe(true);
  });

  it('getSnapshot 引用稳定（useSyncExternalStore 要求），notify 后才换新引用', () => {
    const { store } = makeStore();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    store.add({});
    const snap = store.getSnapshot();
    expect(store.getSnapshot()).toBe(snap);
    store.update(store.getModals()[0].id, { title: 'X' });
    expect(store.getSnapshot()).not.toBe(snap);
    expect(store.getSnapshot()[0].title).toBe('X');
  });

  it('subscribe 返回的退订函数生效', () => {
    const { store } = makeStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.add({});
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    store.add({});
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
