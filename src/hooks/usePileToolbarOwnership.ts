/**
 * usePileToolbarOwnership — 保证**同一时刻只有一个堆叠显示工具条**（互斥）。
 *
 * 背景（实测）：两张堆叠卡的矩形会**互相重叠**，而每张卡上方那条 38px hover 桥
 * （官方 `UOe` 的 `data-pile-toolbar-bridge`，`inset-x-0`）**跟着一起重叠**
 * ⇒ 鼠标落在重叠区时**两个堆叠的 `onMouseEnter` 同时触发**，两条工具条同时真：
 *      `pile-alis1i0vy 175×48 @1448,392  opacity=1`
 *      `pile-j4883s758  91×48 @1189,432  opacity=1`
 * 官方每个堆叠也是各自一个 hover 状态、同样没有互斥，但官方那两张卡不重叠
 * ⇒ 实际不会同时出现。MTV 的堆叠布局会重叠，所以必须显式定一个「谁拥有工具条」。
 *
 * 语义：**后进入者抢占**；拥有者离开且经过 `releaseDelay` 后释放（与官方
 * `V3e = 200ms` 的收起延迟同名同值），避免在重叠区来回移动时抖动。
 */
import { useEffect, useState } from 'react';

const RELEASE_DELAY_MS = 200;

let currentOwnerId: string | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

function claim(id: string) {
  if (releaseTimer !== null) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (currentOwnerId === id) return;
  currentOwnerId = id;
  notify();
}

function release(id: string) {
  if (releaseTimer !== null) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (currentOwnerId !== id) return;
    currentOwnerId = null;
    notify();
  }, RELEASE_DELAY_MS);
}

/**
 * @param pileId  本堆叠 id
 * @param wants   本堆叠当前是否想显示工具条（hover/focus）
 * @returns       本堆叠是否**获准**显示工具条
 */
export function usePileToolbarOwnership(pileId: string, wants: boolean): boolean {
  const [, force] = useState(0);

  useEffect(() => {
    const sub = () => force((n) => n + 1);
    subscribers.add(sub);
    return () => { subscribers.delete(sub); };
  }, []);

  useEffect(() => {
    if (wants) claim(pileId);
    else release(pileId);
  }, [pileId, wants]);

  // 卸载时让出所有权，避免残留在已消失的堆叠上
  useEffect(() => () => {
    if (currentOwnerId === pileId) {
      currentOwnerId = null;
      notify();
    }
  }, [pileId]);

  return wants && currentOwnerId === pileId;
}
