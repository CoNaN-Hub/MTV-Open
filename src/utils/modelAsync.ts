/**
 * 异步请求模型的判定（用户口径）：
 * `GPT Image 2.5 Flare` 与 `GPT Image 2.5 Flare async` 是**同一个模型**，
 * 区别只在请求方式（同步 / 异步任务队列）⇒ 名字上去掉 async 片段，
 * 改由徽标「异步」（列表行）与「异步请求」（说明卡）表达。
 */
const ASYNC_MODEL_RE = /async/i;

/** 该候选是否异步模型（看展示名与 value，兼容 `xxx async` / `xxx-async` 两种写法）。 */
export function isAsyncModel(model: { label: string; value: string }): boolean {
  return ASYNC_MODEL_RE.test(model.label ?? '') || ASYNC_MODEL_RE.test(model.value ?? '');
}

/** 去掉名字里的 async 片段，只留干净的模型名。 */
export function stripAsyncToken(name: string): string {
  const stripped = name
    .replace(/\s*[（([]?\s*async\s*[)）\]]?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped || name;
}
