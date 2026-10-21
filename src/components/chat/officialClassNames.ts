/**
 * 官方 `z`（`vendor-packages-jvPqKqU8.js` @174701，`export {I as z}`）的最小替身 ——
 * 本任务的**三族**卡片里，`z(...)` 的每次调用都只是「基类 + 若干条件类」的拼接，
 * 不存在 tailwind 冲突类（`py-3` vs `px-4`、`opacity-50` vs `transition-opacity` …），
 * 故 `clsx` 的「过滤 falsy 后空格拼接」与官方输出**逐字一致**；`twMerge` 部分无触发点。
 *
 * ⚠️ MTV **没有** `clsx` / `tailwind-merge` 依赖，也没找到现成的 `cn()` 工具
 * ⇒ 这里给本三族一个**局部**实现，不改任何既有文件。
 */
export type ClassNamePart = string | false | null | undefined;

/** 官方 `z` 的逐字行为：falsy 项丢弃，其余按序空格拼接。 */
export function z(...parts: ClassNamePart[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ');
}
