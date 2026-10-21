/**
 * 官方 `n4`（`index-BiTZf8mJ.js` @42850，逐字）：
 *
 *   const n4 = typeof window !== "undefined" && "ontouchend" in document
 *              && Math.max(window.screen.width, window.screen.height) >= 768
 *              && Math.max(window.screen.width, window.screen.height) <= 1366;
 *
 * ⇒ **触屏设备 + 屏幕长边落在 768–1366**（iPad 那类）才为真。
 * 用途（官方 `uPe` @1485700 / `od` @1485894 `NodeToolbarWithDelete`）：
 *   这些设备没有键盘删除键 ⇒ 在节点工具条**末尾补一组删除键**（`n4 && !locked` 时才补）。
 * 桌面端 `n4 === false` ⇒ 工具条里**没有**删除键 ✓（用户桌面上不该看到它）。
 */
export function isTouchTabletDevice(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const hasTouchEnd = 'ontouchend' in document;
  const longSide = Math.max(window.screen?.width ?? 0, window.screen?.height ?? 0);
  return hasTouchEnd && longSide >= 768 && longSide <= 1366;
}
