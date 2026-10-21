/**
 * creditEstimate —— 生成前的「预计花费（**积分**）」本地预估。
 *
 * ## 为什么是积分，不是单价
 * 官方 TapNow 在发送前弹的是「本次执行预计花费约 {{amount}} Tapies。」（服务端算的）。
 * MTV 没有计费后端，所以这里改成**纯本地预估**，并且**对外只暴露积分**、不暴露单价。
 *
 * ## 换算口径
 * `1 积分 = 0.01 × 该连接价目表的计价单位`（`CREDITS_PER_PRICE_UNIT = 100`）。
 *   · 土豆（new-api）的 `/api/status` 是 `quota_display_type:"CNY"` + `display_in_currency:true`
 *     ⇒ 它的 `model_price` **就是人民币** ⇒ 土豆 1 积分 = ¥0.01
 *   · 所以 `gpt-image-2.5-flare` 1K·medium（¥0.04）= **4 积分**，gemini-3-pro 1K（¥0.10）= **10 积分**
 *
 * ## 价格从哪来（**不硬编码**）
 * 每个模型的价都不一样，档位（low/medium/high × 1k/2k/4k）也不一样，
 * 所以一律现查中转站**公开**的价目表：`GET {origin}/api/pricing`（new-api 系，无需鉴权）。
 *   · `model_pricing_variants[模型].variants[]` = `{ params:{quality,resolution}, price }` 明细
 *   · `data[].model_price`（仅 `quota_type === 1` 按次计费）= 兜底单价
 * 查不到 / 拉不到 ⇒ 返回 `null`（调用方不渲染），绝不猜数。
 *
 * ⚠️ 各模型的分辨率写法不统一（gpt-image 是小写 `1k`，gemini 是大写 `1K`）⇒ 比对一律大小写不敏感。
 * ⚠️ 带 `unit`（如 `per_second`）的是按秒计费的视频模型 ⇒ 不参与图片预估。
 */
import { corsSafeFetch } from './httpTransport';
import type { ProviderBillingConfig, ProviderBillingModelOverride } from '../../types';

/** 多少积分 = 1 个计价单位（= 价目表的 0.01 个单位）。 */
export const CREDITS_PER_PRICE_UNIT = 100;

export interface CreditPriceVariant {
  params: Record<string, string>;
  price: number;
}

export interface CreditPriceTable {
  /** 归一化模型名 → 按次计费的基础单价（`model_price`） */
  base: Map<string, number>;
  /** 归一化模型名 → 档位明细 */
  variants: Map<string, CreditPriceVariant[]>;
}

export interface CreditEstimateRequest {
  /** 节点上存的模型值（如 `general/provider-custom-xxx`）或上游 modelId */
  modelId: string;
  /** 已映射成接口认的精细度：low / medium / high …（见 `services/ai/imageQuality.ts`） */
  quality?: string;
  /** 界面档位：1K / 2K / 4K（大小写不敏感） */
  resolution?: string;
  /** 本次生成张数 */
  count?: number;
}

export interface CreditEstimate {
  /** 预计花费（积分） */
  credits: number;
  /** 单价（计价单位，仅内部核算用；不直接展示）。**已套用分组倍率** */
  unitPrice: number;
  count: number;
  /**
   * 套用倍率**之前**的单价。
   *
   * ⚠️ 只有在倍率真的作用到这次取价上时才存在（即价格来自厂商公开价目表、且倍率解析得出）。
   *    用户手填的价（`modelOverrides` / `fallbackUnitPrice`）**不套倍率** ⇒ 这里为 `undefined`。
   */
  baseUnitPrice?: number;
  /**
   * 本次实际套用的分组倍率（**MTV 增强**；官方侧 NOT FOUND，见 `providerEntitlements.ts`）。
   * `undefined` = 没套（拿不到分组 / 解析不出倍率 / 价格是用户手填的）。
   */
  groupRatio?: number;
  /** 该倍率对应的分组名（排障用，顺便让界面能写清「为什么是这个价」）。 */
  group?: string;
}

function normalizeModelName(value: string): string {
  return value.trim().toLowerCase();
}

function toPrice(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 解析 new-api 的 `/api/pricing` 响应；结构不认识时返回空表（调用方按"查不到"处理）。 */
export function parseCreditPriceTable(raw: unknown): CreditPriceTable {
  const table: CreditPriceTable = { base: new Map(), variants: new Map() };
  if (!raw || typeof raw !== 'object') return table;
  const root = raw as Record<string, unknown>;

  const rawVariants = root.model_pricing_variants;
  if (rawVariants && typeof rawVariants === 'object') {
    for (const [name, entry] of Object.entries(rawVariants as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      /* `unit` 存在 = 按秒/按别的单位计费（视频），不能当"每张"用 */
      if (typeof record.unit === 'string' && record.unit) continue;
      const list = Array.isArray(record.variants) ? record.variants : [];
      const variants: CreditPriceVariant[] = [];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const variant = item as Record<string, unknown>;
        const price = toPrice(variant.price);
        if (price === undefined) continue;
        const params: Record<string, string> = {};
        const rawParams = variant.params;
        if (rawParams && typeof rawParams === 'object') {
          for (const [k, v] of Object.entries(rawParams as Record<string, unknown>)) {
            if (typeof v === 'string' || typeof v === 'number') params[k.toLowerCase()] = String(v);
          }
        }
        variants.push({ params, price });
      }
      if (variants.length > 0) table.variants.set(normalizeModelName(name), variants);
    }
  }

  const rows = Array.isArray(root.data) ? root.data : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    /* quota_type === 1 = 按次计费；其余（0）是按 token 的 model_ratio，图片用不上 */
    if (Number(record.quota_type) !== 1) continue;
    const name = typeof record.model_name === 'string' ? record.model_name : '';
    const price = toPrice(record.model_price);
    if (!name || price === undefined) continue;
    table.base.set(normalizeModelName(name), price);
  }

  return table;
}

/** 归一化后的候选模型名：同步 id / 异步 id 互为候选（两个在价目表里价格相同）。 */
export function creditModelCandidates(modelId: string): string[] {
  const id = normalizeModelName(modelId);
  const out = [id, `${id}-async`];
  if (id.endsWith('-async')) out.push(id.slice(0, -'-async'.length));
  return [...new Set(out)];
}

/**
 * 按「模型 + 精细度 + 分辨率」查到单价。
 *
 * ★★★ **必须"两轮"查，不能"逐个候选：先明细再基础价"** ✓✓（实测踩到过，会报错价）
 *   土豆 2026 重构了价目表：**档位明细挂在异步 id 上**，同步 id 只剩一个高额兜底价 ——
 *     · `gpt-image-2.5-sunburst`        → 无明细，`model_price = 0.13`
 *     · `gpt-image-2.5-sunburst-async`  → 15 条明细，low·1k = **0.04**（我们实际发的是这个 id）
 *   逐个候选那种写法会在同步 id 上拿到基础价 0.13 **立刻返回**，把一张 ¥0.04 的图报成 ¥0.13 ✗
 *   ⇒ 先**遍历所有候选找明细命中**（明细永远比基础价准），都没有才退回基础价 ✓
 */
export function lookupCreditUnitPrice(
  table: CreditPriceTable,
  request: CreditEstimateRequest,
): number | null {
  const wanted: Record<string, string> = {};
  if (request.quality) wanted.quality = request.quality.toLowerCase();
  if (request.resolution) wanted.resolution = request.resolution.toLowerCase();
  const candidates = creditModelCandidates(request.modelId);

  /* ① 全候选找档位明细；参数越多越具体越优先 */
  for (const candidate of candidates) {
    const variants = table.variants.get(candidate);
    if (!variants || variants.length === 0) continue;
    let best: CreditPriceVariant | null = null;
    for (const variant of variants) {
      const keys = Object.keys(variant.params);
      if (keys.length === 0) continue;
      /* 明细只声明它自己管的维度（有的模型只分 quality、有的只分 resolution） */
      const matched = keys.every((key) => wanted[key] !== undefined && variant.params[key].toLowerCase() === wanted[key]);
      if (!matched) continue;
      if (!best || keys.length > Object.keys(best.params).length) best = variant;
    }
    if (best) return best.price;
  }

  /* ② 一条明细都没命中，才退回该模型的基础单价 */
  for (const candidate of candidates) {
    const base = table.base.get(candidate);
    if (base !== undefined) return base;
  }
  return null;
}

/** 单价 → 积分（含张数）。`perUnit` = 多少积分算 1 个计价单位（默认 100）。 */
export function creditsFromUnitPrice(unitPrice: number, count = 1, perUnit = CREDITS_PER_PRICE_UNIT): number {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
  const safePerUnit = Number.isFinite(perUnit) && perUnit > 0 ? perUnit : CREDITS_PER_PRICE_UNIT;
  return Math.round(unitPrice * safePerUnit * safeCount * 100) / 100;
}

/* ── ★ 连接级计费配置（用户 2026：「不要锁死土豆这一套」） ─────────────────── */

/** 连接配置里的「多少积分 = 1 个计价单位」，非法值回落默认 100。 */
export function creditsPerUnit(billing?: ProviderBillingConfig): number {
  const value = billing?.creditsPerUnit;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : CREDITS_PER_PRICE_UNIT;
}

function positiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 逐模型手动价的匹配：把 `quality|resolution` 这种键解析成两个维度。
 * `*` 表示该维度不限。空维度（如 `low|`）= 不限。
 */
function parseOverrideVariantKey(key: string): { quality: string; resolution: string } | null {
  const parts = key.split('|');
  if (parts.length !== 2) return null;
  const norm = (raw: string) => {
    const v = raw.trim().toLowerCase();
    return !v || v === '*' ? '*' : v;
  };
  return { quality: norm(parts[0]), resolution: norm(parts[1]) };
}

/**
 * 查「逐模型手动价」。命中顺序：**档位明细（更具体的优先）→ 该模型的基础单价**。
 *
 * ⚠️ 与 `lookupCreditUnitPrice` 同一个坑：必须**先把该模型的明细全看完**，不能匹配一个候选就返回。
 * 这里一个 `modelId` 可能有多个覆盖条目（写重复了），所以两轮都遍历完整列表。
 */
export function lookupOverrideUnitPrice(
  billing: ProviderBillingConfig | undefined,
  request: CreditEstimateRequest,
): number | null {
  const overrides = billing?.modelOverrides;
  if (!Array.isArray(overrides) || overrides.length === 0) return null;
  const candidates = creditModelCandidates(request.modelId);
  const matched = overrides.filter((item: ProviderBillingModelOverride) =>
    typeof item?.modelId === 'string' && candidates.includes(normalizeModelName(item.modelId)));

  const wanted: Record<string, string> = {
    quality: (request.quality ?? '').toLowerCase(),
    resolution: (request.resolution ?? '').toLowerCase(),
  };

  /* ① 档位明细：命中的维度越多越具体 ⇒ 优先 */
  let best: { price: number; specificity: number } | null = null;
  for (const item of matched) {
    if (!item.variants || typeof item.variants !== 'object') continue;
    for (const [key, rawPrice] of Object.entries(item.variants)) {
      const price = positiveNumber(rawPrice);
      if (price === null) continue;
      const parsed = parseOverrideVariantKey(key);
      if (!parsed) continue;
      let specificity = 0;
      let ok = true;
      for (const dim of ['quality', 'resolution'] as const) {
        const need = parsed[dim];
        if (need === '*') continue;
        if (wanted[dim] !== need) { ok = false; break; }
        specificity += 1;
      }
      if (!ok) continue;
      if (!best || specificity > best.specificity) best = { price, specificity };
    }
  }
  if (best) return best.price;

  /* ② 退回该模型的基础单价 */
  for (const item of matched) {
    const price = positiveNumber(item.unitPrice);
    if (price !== null) return price;
  }
  return null;
}

/**
 * 一步到位：**手动覆盖 → 价目表 → 兜底单价**，再按连接的积分换算比例折算。
 *
 * 优先级就是"越明确越优先"：用户手写的 > 厂商公开价目表 > 连接级兜底。
 * `billing.enabled === false` ⇒ 直接返回 null（本连接不做预估）。
 *
 * ## ★ 分组倍率（P3，**MTV 增强**）
 *
 * `groupRatio` 来自该连接的**上游分组**（`providerEntitlements.resolveConnectionDiscount`）：
 *   · 倍率来自上游 `group_ratio` 表，或由**组名**「N折」推出（`vip-9折` ⇒ 0.9）——
 *     两种来源都写在 `providerEntitlements.ts` 里，查不到就是 `null`（**留空，不猜**）；
 *   · 只作用在**厂商公开价目表**那一条取价路径上。`modelOverrides` / `fallbackUnitPrice`
 *     是**用户自己填的数**，再乘一遍倍率等于替用户改价 ⇒ **不套**（沿用「越明确越优先」）。
 *   · `groupRatio` 为 `null`/`undefined`/非正数 ⇒ 原价返回，**不阻断**。
 *   · 折扣后的价**不是谎言**：上游确实按 `group_ratio` 计费，平台自己的 UI 也显示「0.9x 倍率」。
 */
export function estimateWithBilling(
  table: CreditPriceTable | null,
  request: CreditEstimateRequest,
  billing?: ProviderBillingConfig,
  groupRatio?: number | null,
): CreditEstimate | null {
  if (billing?.enabled === false) return null;
  const overridePrice = lookupOverrideUnitPrice(billing, request);
  const tablePrice = overridePrice === null && table ? lookupCreditUnitPrice(table, request) : null;
  const unitPrice = overridePrice ?? tablePrice ?? positiveNumber(billing?.fallbackUnitPrice);
  if (unitPrice === null) return null;
  const count = Number.isFinite(request.count) && (request.count ?? 0) > 0 ? Math.floor(request.count!) : 1;

  /* ★ 倍率只作用在**厂商公开价目表**那一条路径上（见上方说明） */
  const ratio = typeof groupRatio === 'number' && Number.isFinite(groupRatio) && groupRatio > 0
    ? groupRatio
    : null;
  const discounted = tablePrice !== null && ratio !== null ? tablePrice * ratio : unitPrice;
  return {
    unitPrice: discounted,
    count,
    credits: creditsFromUnitPrice(discounted, count, creditsPerUnit(billing)),
    ...(tablePrice !== null && ratio !== null ? { baseUnitPrice: unitPrice, groupRatio: ratio } : {}),
  };
}

/** 查表 + 换算一步到位；查不到返回 `null`（调用方不渲染，不猜数）。 */
export function estimateImageCredits(
  table: CreditPriceTable,
  request: CreditEstimateRequest,
): CreditEstimate | null {
  const unitPrice = lookupCreditUnitPrice(table, request);
  if (unitPrice === null) return null;
  const count = Number.isFinite(request.count) && (request.count ?? 0) > 0 ? Math.floor(request.count!) : 1;
  return { unitPrice, count, credits: creditsFromUnitPrice(unitPrice, count) };
}

/** 积分的展示形式：整数档不带小数，小数额保留 1~2 位（对齐官方「约 5 Tapies」的观感）。 */
export function formatCredits(credits: number): string {
  if (!Number.isFinite(credits) || credits <= 0) return '0';
  if (credits >= 10) return String(Math.round(credits));
  if (credits >= 1) {
    const rounded = Math.round(credits * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  return (Math.round(credits * 100) / 100).toString();
}

/* ── 价目表拉取（同源公开接口，带内存缓存） ─────────────────────────────── */

const PRICE_TABLE_TTL_MS = 10 * 60 * 1000;
const priceTableCache = new Map<string, { table: CreditPriceTable; at: number }>();
const inflight = new Map<string, Promise<CreditPriceTable | null>>();

/**
 * 价目表地址：`{baseUrl}` 站点根 + 路径。
 *
 * 三种来源（连接级配置 `billing.priceSource`）：
 *   · 默认 `auto`   —— new-api 约定：`{origin}/api/pricing`
 *   · `endpoint`    —— 用配置里的地址；支持 `{baseUrl}` / `{origin}` 占位，
 *                      以 `/` 开头时按连接的 origin 解析（换厂商时路径不同就靠这个）
 *   · `manual`      —— **完全不请求**，只用连接里手填的单价 ⇒ 返回 null
 */
export function creditPriceEndpoint(baseUrl: string, billing?: ProviderBillingConfig): string | null {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return null;
  }
  const source = billing?.priceSource ?? 'auto';
  if (source === 'manual') return null;
  if (source !== 'endpoint') return `${origin}/api/pricing`;

  const raw = (billing?.priceEndpoint ?? '').trim();
  if (!raw) return null;
  const expanded = raw
    .replace(/\{baseUrl\}/gi, baseUrl.replace(/\/+$/, ''))
    .replace(/\{origin\}/gi, origin);
  try {
    return new URL(expanded, origin).toString();
  } catch {
    return null;
  }
}

/**
 * 拉取并缓存某个连接的价格表；任何失败都返回 null（静默，不打断生成）。
 *
 * ⚠️ **刻意不接受 `AbortSignal`** ✓✓（踩过的坑）：
 *    同一个价格表在多处共享（`inflight` 去重）。若把请求绑到第一个调用方的 signal 上，
 *    它一 abort 就会把**所有**等待者一起弄死。而 `<StrictMode>`（`main.tsx:58`）下 effect 是
 *    mount→cleanup→mount：第一次挂载的 cleanup 立刻 abort ⇒ 第二次复用到那个已死的 promise
 *    ⇒ 永远拿不到价格、徽章永远不显示 ✗（实测就这么踩的）。
 *    这是**带缓存的元数据 GET**，本来就不该跟着某个组件的生命周期走 ⇒ 不传 signal。
 */
export async function loadCreditPriceTable(
  baseUrl: string,
  billing?: ProviderBillingConfig,
): Promise<CreditPriceTable | null> {
  /* `manual` 模式（或地址配置不合法）⇒ 根本不发请求；调用方只用连接里的手动单价 */
  const endpoint = creditPriceEndpoint(baseUrl, billing);
  if (!endpoint) return null;
  const cached = priceTableCache.get(endpoint);
  if (cached && Date.now() - cached.at < PRICE_TABLE_TTL_MS) return cached.table;
  const running = inflight.get(endpoint);
  if (running) return running;

  const task = (async () => {
    try {
      const response = await corsSafeFetch(endpoint, { method: 'GET' });
      if (!response.ok) return null;
      const table = parseCreditPriceTable(await response.json());
      priceTableCache.set(endpoint, { table, at: Date.now() });
      return table;
    } catch {
      return null;
    } finally {
      inflight.delete(endpoint);
    }
  })();
  inflight.set(endpoint, task);
  return task;
}

/**
 * **同步**读「已经拉取过」的价目表（命中缓存且未过期才返回，否则 `null`）。
 *
 * 给**悬停即显示**的场合用（模型说明卡）：那种交互不能等一次网络往返，
 * 也不该为了悬停而发请求。价目表通常已经由生成确认卡的 `loadCreditPriceTable`
 * （10 分钟 TTL）拉过一次 ⇒ 这里只做**缓存读**；没有缓存 ⇒ 调用方按「价目未取到」处理
 * （说明卡上那一行直接不渲染，不猜数、不显示 loading）。
 *
 * ⚠️ 只有「同一条连接 + 同一个价目表地址」才会命中 ⇒ 卡上显示的一定是**这条连接的真实价目**。
 */
export function cachedCreditPriceTable(
  baseUrl: string,
  billing?: ProviderBillingConfig,
): CreditPriceTable | null {
  const endpoint = creditPriceEndpoint(baseUrl, billing);
  if (!endpoint) return null;
  const cached = priceTableCache.get(endpoint);
  if (!cached) return null;
  if (Date.now() - cached.at >= PRICE_TABLE_TTL_MS) return null;
  return cached.table;
}

/** 仅供测试：清掉缓存。 */
export function clearCreditPriceTableCache(): void {
  priceTableCache.clear();
  inflight.clear();
}
