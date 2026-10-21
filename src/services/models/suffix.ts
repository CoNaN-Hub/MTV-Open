/**
 * 平台「执行规格后缀」解析 —— `async` / `batch` / `priority` …
 *
 * 规则（用户 2026 定稿）：
 *   · 后缀**必须保留**：出站请求体里的 model 恒等于带后缀的原文；
 *   · 匹配官方模型时先去掉后缀（用 `baseModelId`）；
 *   · 最终 `displayName = officialName + ' ' + suffix`；
 *   · 不得删除、翻译、隐藏或改写后缀；同步/异步是**两条独立可选模型**；
 *   · 去重键是 `providerId + providerModelId`，**不是** `canonicalId`。
 *
 * 后缀表是**每个平台自己的配置**（`modelProviders.json` 的 `suffixSpec`），
 * 所以以后接新平台只加配置，不改这里。
 */
import type { ExecutionMode, ProviderSuffixSpec } from './types';

/** 没配 suffixSpec 的平台用这个：不识别任何后缀。 */
export const NO_SUFFIX_SPEC: ProviderSuffixSpec = { separator: '-', suffixes: [] };

export interface SuffixSplit {
  /** 去掉后缀的主体 id（只用于匹配官方模型）。 */
  baseModelId: string;
  /** 命中的后缀（小写，不含分隔符）；没命中就是 undefined。 */
  suffix?: string;
  /** 后缀对应的执行模式；没命中后缀时按 `sync`。 */
  executionMode: ExecutionMode;
}

/** 后缀里允许出现的字符：字母数字（平台规格名都是这种）。 */
const SUFFIX_SHAPE = /^[a-z0-9]+$/;

/**
 * 拆出平台规格后缀。
 *
 * ⚠️ 只认 `suffixSpec.suffixes` 里**显式声明**的后缀 —— 不做「以 `-xxx` 结尾就当后缀」的猜测，
 *    否则 `gpt-image-2.5-flare-async-high` 这种真 id 会被切错，`nano-banana-flash` 也可能被误伤。
 */
export function splitSuffix(providerModelId: string, spec: ProviderSuffixSpec = NO_SUFFIX_SPEC): SuffixSplit {
  const id = providerModelId.trim();
  const separator = spec.separator || '-';
  const suffixes = spec.suffixes ?? [];
  if (!id || suffixes.length === 0) return { baseModelId: id, executionMode: 'sync' };

  /* 从最长后缀开始试，避免 `-async` 与 `-c` 这种前缀关系切错 */
  const sorted = [...suffixes].sort((a, b) => b.length - a.length);
  for (const raw of sorted) {
    const suffix = raw.toLowerCase();
    if (!SUFFIX_SHAPE.test(suffix)) continue;
    const tail = `${separator}${suffix}`;
    if (id.length <= tail.length || !id.toLowerCase().endsWith(tail)) continue;
    return {
      baseModelId: id.slice(0, -tail.length),
      suffix,
      executionMode: spec.executionMode?.[suffix] ?? 'async',
    };
  }
  return { baseModelId: id, executionMode: 'sync' };
}

/**
 * 拼最终展示名：`官方名 + ' ' + 后缀原文`。
 *
 * 例：`officialName='Banana Pro'` + `suffix='async'` ⇒ `'Banana Pro async'`。
 * 没后缀就直接返回官方名（**不做任何格式化/大小写处理** —— 官方名要逐字保真）。
 */
export function composeDisplayName(officialName: string, suffix?: string): string {
  const name = officialName.trim();
  if (!suffix) return name;
  return `${name} ${suffix}`;
}

/**
 * 收集「平台用过的全部后缀」——给管理视图与测试用。
 */
export function declaredSuffixes(specs: Array<ProviderSuffixSpec | undefined>): string[] {
  const all = new Set<string>();
  for (const spec of specs) for (const s of spec?.suffixes ?? []) all.add(s.toLowerCase());
  return [...all].sort();
}
