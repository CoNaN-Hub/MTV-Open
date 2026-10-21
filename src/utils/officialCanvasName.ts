/**
 * 官方「新建画布」默认名 —— `page-DSy7Zc_d.js` 里 `At` / `Za` 的**逐字等价物**。
 *
 * ```js
 * At = e => e.toLocaleLowerCase().startsWith("zh") ? "画布" : "Canvas";
 * Za = (canvases, language) => {
 *   const r = At(language), i = new RegExp(`^${r}\\s+(\\d+)$`, "iu");
 *   const used = new Set(canvases.map(c => i.exec(c.name.trim())?.[1]).filter(Boolean).map(Number)
 *                                .filter(n => Number.isInteger(n) && n > 0));
 *   let u = 1; while (used.has(u)) u += 1;
 *   return `${r} ${u}`;
 * };
 * ```
 *
 * ★ 用户 2026：「点击新建画布 后 名字也不对啊」——官方**不是** `Untitled`：
 *   它取**最小未占用的正整数**，中文界面得到「画布 1 / 画布 2 / …」
 *   （实测用户那个官方窗口的切换列表里就是「画布 2」「画布 3」），英文界面得到 `Canvas N`。
 *   ⚠️ 只认 `^前缀\s+\d+$` 这种名字 ⇒ 手动改过名的画布不会占序号（与官方一致）。
 */
import { getLocale } from '../i18n';

export function officialDefaultCanvasName(existingNames: string[]): string {
  const prefix = getLocale().toLowerCase().startsWith('zh') ? '画布' : 'Canvas';
  const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`, 'iu');
  const used = new Set(
    existingNames
      .map((name) => pattern.exec(String(name ?? '').trim())?.[1])
      .filter((digits): digits is string => Boolean(digits))
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0),
  );
  let next = 1;
  while (used.has(next)) next += 1;
  return `${prefix} ${next}`;
}
