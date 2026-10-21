/**
 * CreditEstimateBadge —— 生成前的「**预计花费**」（纯数字，前面一颗积分闪电图标）。
 *
 * ## 口径与价格来源（见 `services/ai/creditEstimate.ts`）
 *   · **1 积分 = 价目表计价单位的 1/100**（土豆的价目表是人民币 ⇒ 1 积分 = ¥0.01）
 *   · 价格**不硬编码** —— 每个模型、每个档位都不同，现查连接公开的 `/api/pricing`
 *   · 查不到 / 拉不到 ⇒ 显示 **`-`**（与官方一致），不猜数
 *
 * ## 逐项对齐官方（9222 实测 DOM + `course-api-base-url-*.js` 源码）
 *   ① 结构：`[图标 16×16][数字区 min-width:32px]`，整块 52×20、`padding-left:4px`
 *      （MTV 的 `.prompt-send-pill::before` 占的正是这 52×20，CSS 用 `:has()` 让位）
 *   ② **三态**（逐字对齐官方 `x2e` @1611113，见下方 `loading` 那段注释）：
 *        · 加载中：**保留上一个数值**并让它「呼吸」（官方 `.tap-price-pending`）；
 *          一个数值都没有时，呼吸的是那个 `-`（官方 `Av = {kind:"unavailable", text:"-"}`）
 *        · 算完但查不到价：静止的 `-`
 *        · 有价：滚动的数字
 *      ⚠️ 曾经写成「换查询键就立刻清空成静止的 `-`」✗ —— 那既不是官方的呼吸态，
 *        又会在换模型/换档位时把已经显示的数字跳掉（用户 2026 报的「动画前面还有个类似 - 出现」）
 *   ③ **归类键**：官方 `animationKey = `${serviceType}:${text}`` ⇒ 换模型/换数字都重放动画
 *   ④ **动画 = 逐位纵向滚动**（官方用 NumberFlow）：数字位是一条 `0…9` 的纵向数字带，
 *      按目标位移；**符号位（`-`/`.`）不滚动，只做透明度进出** —— 官方 NumberFlow 里
 *      `symbol__value` 正是这样处理的（`vM` 的 `present` 只动 `--_number-flow-d-opacity`）
 *   ⑤ 时长用官方常量：位移 `520ms cubic-bezier(0.22, 1, 0.36, 1)`、透明度 `180ms ease-out`
 *   ⑥ 字号用**官方的 `12px`**；字族/字重跟随 MTV 那颗 `3:4 · 1K · 低` 胶囊（500 / 继承字族）
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useT } from '../../../i18n';
import { useAppStore } from '../../../store/useAppStore';
import { resolveCreditConnection } from '../../../services/ai/creditConnection';
import { resolveOutgoingImageQuality } from '../../../services/ai/imageQuality';
import {
  estimateWithBilling,
  formatCredits,
  loadCreditPriceTable,
  lookupOverrideUnitPrice,
} from '../../../services/ai/creditEstimate';
import CreditBoltIcon from '../../shared/CreditBoltIcon';

/** 官方 NumberFlow 的动画常量（`course-api-base-url-*.js` 逐字） */
const TRANSFORM_TIMING = { duration: 0.52, ease: [0.22, 1, 0.36, 1] as const };
const OPACITY_TIMING = { duration: 0.18, ease: 'easeOut' as const };

/** 未算出/不可预估时显示的占位（官方 `Av.text`） */
const UNAVAILABLE_TEXT = '-';

const DIGIT_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * 逐位滚动：每个数字位是一条 `0…9` 的纵向带，向上滚到目标位；
 * 符号位（`-`）只做透明度进出（官方 NumberFlow 的 symbol 就是这么处理的）。
 */
function RollingValue({ text }: { text: string }) {
  return (
    <span className="prompt-credit-estimate__roll">
      {text.split('').map((char, index) => {
        const digit = DIGIT_CHARS.indexOf(char);
        if (digit < 0) {
          return (
            <AnimatePresence key={`symbol-${index}`} mode="popLayout" initial={false}>
              <motion.span
                className="prompt-credit-estimate__char"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={OPACITY_TIMING}
              >
                {char}
              </motion.span>
            </AnimatePresence>
          );
        }
        return (
          <span className="prompt-credit-estimate__char" key={`digit-${index}`}>
            <motion.span
              className="prompt-credit-estimate__strip"
              /* 初次挂载从 0 位滚上来（官方 NumberFlow 首帧也会动），此后只滚位移 */
              initial={{ y: '0em' }}
              animate={{ y: `-${digit}em` }}
              transition={TRANSFORM_TIMING}
            >
              {DIGIT_CHARS.map((value) => (
                <span key={value}>{value}</span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

export interface CreditEstimateBadgeProps {
  provider?: string;
  model?: string;
  imageSize?: string;
  /** 界面上的「精细度」（low/medium/high…），映射成接口认的值后再查表 */
  quality?: string;
  count?: number;
}

interface EstimateState {
  /** 结果对应的查询键；与当前键不一致说明这一档还在算（**不要拿旧数当新数** ✗） */
  key: string;
  /** 最近一次**算完**的积分；null = 那一档查不到价（官方 `unavailable`） */
  credits: number | null;
}

export default function CreditEstimateBadge({
  provider,
  model,
  imageSize,
  quality,
  count = 1,
}: CreditEstimateBadgeProps) {
  const t = useT();
  const providers = useAppStore((state) => state.config.providers);
  const generalModels = useAppStore((state) => state.config.generalModels);
  const [result, setResult] = useState<EstimateState>({ key: '', credits: null });

  const target = useMemo(
    () => resolveCreditConnection(provider, model, { providers, generalModels }),
    [provider, model, providers, generalModels],
  );
  const outgoingQuality = useMemo(
    () => (target ? resolveOutgoingImageQuality(target.modelId, quality) : undefined),
    [target, quality],
  );
  const baseUrl = target?.baseUrl;
  const modelId = target?.modelId;
  /* ★ 连接级计费设置（取价方式 / 积分换算 / 手动单价）。`billing` 变了也要重算 ⇒ 进 queryKey */
  const billing = target?.billing;
  const billingKey = billing ? JSON.stringify(billing) : '';
  /* ★ 分组折扣（**MTV 增强**）：该连接的上游分组倍率，如 `vip-9折` ⇒ 0.9x。
     随连接（含 key）变 ⇒ 与 billing 一起进 queryKey。`null` = 拿不到 ⇒ 原价显示。 */
  const discount = target?.discount ?? null;
  const discountKey = discount ? `${discount.group}:${discount.ratio ?? ''}` : '';
  const queryKey = baseUrl && modelId
    ? [baseUrl, modelId, outgoingQuality ?? '', imageSize ?? '', count, billingKey, discountKey].join('|')
    : '';
  /* 连接显式关掉了预估 ⇒ 整个徽章不渲染（胶囊那 52px 空位由 `::before` 占住） */
  const disabled = billing?.enabled === false;

  useEffect(() => {
    if (disabled || !queryKey || !baseUrl || !modelId) return;
    let active = true;
    void (async () => {
      /* 价格表是带缓存的共享元数据 GET，**不跟组件的生命周期走** ⇒ 不传 signal。
         （`<StrictMode>` 下 effect 会 mount→cleanup→mount；绑 signal 会让第二次复用到已死的
         共享 promise，徽章永远不显示 —— 见 `creditEstimate.loadCreditPriceTable` 的注释。）
         `priceSource:'manual'` 时 `loadCreditPriceTable` 直接返回 null、不发请求 ✓ */
      let table = await loadCreditPriceTable(baseUrl, billing);
      /* 连接里已经手填了单价 / 兜底价 ⇒ 不必为了价目表白等那两轮重试 */
      const hasManualPrice = lookupOverrideUnitPrice(
        billing,
        { modelId, quality: outgoingQuality, resolution: imageSize },
      ) !== null || (billing?.fallbackUnitPrice ?? 0) > 0;
      if (!table && active && !hasManualPrice) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        if (!active) return;
        table = await loadCreditPriceTable(baseUrl, billing);
      }
      if (!active) return;
      const estimate = estimateWithBilling(
        table,
        { modelId, quality: outgoingQuality, resolution: imageSize, count },
        billing,
        discount?.ratio ?? null,
      );
      setResult({ key: queryKey, credits: estimate ? estimate.credits : null });
    })();
    return () => {
      active = false;
    };
  }, [disabled, queryKey, baseUrl, modelId, outgoingQuality, imageSize, count, billing, discount]);

  /* ★ 三态 —— 逐字对齐官方 `x2e`（`course-api-base-url-CGXqZmAy.js` @1611113）：
       loading      —— 这一档**还在算**：官方不清空，而是**保留上一个数值**（`useLayoutEffect` 里
                       `if(!t)` 才更新 `s`），并给它挂 `tap-price-pending` 呼吸；
                       一个数值都还没有时，呼吸的是那个**真实的 `-`** 文本节点。
       unavailable  —— 算完了但没有价 ⇒ 静止的 `-`（官方 `Av={kind:"unavailable",text:"-"}`）
       regular      —— 有价 ⇒ 滚动的数字
    用户 2026 报的「在动画前面还有个类似 - 出现」就是这里：原来是"换键即清空成静止的 -"，
    既不像官方的呼吸态、重算时还会把已显示的数字跳掉 ✗ */
  const loading = result.key !== queryKey;
  /* 加载中 `result` 仍持有**上一次算完**的值 ⇒ 直接用它 = 官方的"冻结上一个数值" ✓ */
  const credits = result.credits;
  const text = credits === null ? UNAVAILABLE_TEXT : formatCredits(credits);
  /* 官方只在**数字本身变了**时才重放滚动（`v2e(i,n)` 相等就保留旧对象、不重渲染）
     ⇒ 键里**不放 modelId**，否则换模型但价格相同时会白滚一遍 ✗ */
  const animationKey = text;

  /* 连接级「计费」里显式关掉了预估 ⇒ 整块不渲染（胶囊的 52px 空位交回给 `::before`） */
  if (disabled) return null;

  return (
    <span
      className="prompt-credit-estimate"
      data-credit-estimate=""
      data-credit-value={text}
      data-credit-state={loading ? 'loading' : credits === null ? 'unavailable' : 'regular'}
      /* ★ 分组折扣（**MTV 增强**）也落到 DOM 上，排障时一眼看出「这个价是按哪个分组算的」 */
      data-credit-group={discount?.group ?? ''}
      data-credit-group-ratio={discount?.ratio ?? ''}
      title={discount?.ratio
        ? t('预计花费：按连接公开价目表估算，已套用分组 {group} 的 {ratio}x 倍率，仅供参考', {
          group: discount.label || discount.group,
          ratio: String(discount.ratio),
        })
        : t('预计花费：按连接公开价目表估算，仅供参考')}
    >
      <CreditBoltIcon className="prompt-credit-estimate__icon" size={16} />
      {/* 呼吸动画只打在**数字位**上（官方 `tap-price-pending` 也是只挂在 NumberFlow / 那个 `-` 上，
          图标 `<xR>` 是它的兄弟、不跟着呼吸） */}
      <span className={`prompt-credit-estimate__value${loading ? ' is-pending' : ''}`}>
        {/* `key` 只跟数字文本走：数字变了才重放滚动 */}
        <RollingValue key={animationKey} text={text} />
      </span>
    </span>
  );
}
