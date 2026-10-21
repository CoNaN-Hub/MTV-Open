/**
 * settings/providerConnection/ProviderBillingSection — **连接级**「计费与积分」设置。
 *
 * ## 为什么要有这一块（用户 2026）
 * 「关于价格的需求：未来我会接入其他厂商的价格，所以**不要锁死土豆这一套**。」
 * 「连接级设置你加在 设置→模型与连接 这个分类里，功能齐全一些，方便我加入其他厂商时手动设置。」
 *
 * 土豆只是**一种**取价方式（new-api 系的公开价目表 `GET {站点根}/api/pricing`）。
 * 换厂商时可能：价目表路径不同 / 根本没有公开价目表 / 计价单位不是人民币 —— 全在这里配，
 * 不用改代码。预估逻辑本身（`services/ai/creditEstimate.ts`）只认这份配置，不认厂商。
 *
 * ## 优先级（越明确越优先）
 * 逐模型手动价 → 连接价目表 → 兜底单价；都查不到 ⇒ 该档显示官方那个 `-`，绝不猜数。
 */
import { Icon } from '@iconify/react';
/* ★ 模型名唯一出口：界面只显示 displayName */
import { displayNameOfCatalogEntry } from '../../../services/models/display';
import Select from '../../shared/Select';
import { useState } from 'react';
import type {
  GeneralModelCategory,
  ProviderBillingConfig,
  ProviderBillingModelOverride,
} from '../../../types';
import { GENERAL_MODEL_CATEGORY_LABELS } from '../../../types';
import { useT } from '../../../i18n';
import { CREDITS_PER_PRICE_UNIT, creditPriceEndpoint } from '../../../services/ai/creditEstimate';
import OFFICIAL_CATEGORY_ICONS from '../../../data/official-category-icons.json';
import { CATEGORY_ORDER } from './providerConnectionShared';
import {
  OFFICIAL_SELECT_TRIGGER,
  OfficialButton,
  OfficialCardRow,
  OfficialInput,
  OfficialSwitch,
} from '../official/OfficialControls';

/** 官方那套分类图标（与「启用模型」列表、节点搜索同一份）。 */
const CATEGORY_ICON_KEY: Record<GeneralModelCategory, keyof typeof OFFICIAL_CATEGORY_ICONS> = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
};

/** 可以一键加进「逐模型手动价」的候选（本连接已启用的模型，**带分类**）。 */
export interface ProviderBillingModel {
  id: string;
  name: string;
  category: GeneralModelCategory;
}

export interface ProviderBillingSectionProps {
  billing: ProviderBillingConfig | undefined;
  onChange: (next: ProviderBillingConfig | undefined) => void;
  /** 连接地址，用于把 `{origin}` 占位展开成真实地址做预览 */
  baseUrl: string;
  /** 候选模型（本连接已启用的模型，按分类分组展示「图标 + 文案」） */
  models: ProviderBillingModel[];
}

/** 档位明细的展示形式：`low|1k=0.04, medium|1k=0.05` */
function formatVariants(variants?: Record<string, number>): string {
  if (!variants) return '';
  return Object.entries(variants).map(([key, price]) => `${key}=${price}`).join(', ');
}

/**
 * 解析档位明细。**刻意宽容**：半截输入（`low|1k=`）解析成"没有明细"，
 * 但输入框里保留用户正在打的原文（草稿态），不会边打边被回写覆盖。
 */
function parseVariants(raw: string): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const chunk of raw.split(/[,;\n]/)) {
    const eq = chunk.indexOf('=');
    if (eq <= 0) continue;
    const key = chunk.slice(0, eq).trim();
    const price = Number(chunk.slice(eq + 1).trim());
    if (!key || !Number.isFinite(price) || price <= 0) continue;
    out[key] = price;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export default function ProviderBillingSection({
  billing,
  onChange,
  baseUrl,
  models,
}: ProviderBillingSectionProps) {
  const t = useT();
  /** 逐模型那几行的输入草稿（键 = 行下标），避免边打边被规范化回写 */
  const [draft, setDraft] = useState<Record<number, { price?: string; variants?: string }>>({});
  const [newModelId, setNewModelId] = useState('');

  const source = billing?.priceSource ?? 'auto';
  const enabled = billing?.enabled !== false;
  const perUnit = billing?.creditsPerUnit ?? CREDITS_PER_PRICE_UNIT;
  const overrides = billing?.modelOverrides ?? [];

  /* 还没配过手动价的模型，**按分类分组**（用户 2026：「给模型分类加上啊 图标+文案」）：
     分类标题 = 官方分类图标 + 分类名；胶囊 = 分类图标 + 模型名，与「启用模型」列表同一套视觉。 */
  const pendingModels = models.filter((model) => !overrides.some((item) => item.modelId === model.id));
  const groupedModels = CATEGORY_ORDER
    .map((category) => ({ category, items: pendingModels.filter((model) => model.category === category) }))
    .filter((group) => group.items.length > 0);

  const patch = (next: Partial<ProviderBillingConfig>) => onChange({ ...(billing ?? {}), ...next });

  const patchNumber = (key: 'creditsPerUnit' | 'fallbackUnitPrice' | 'balanceQuotaPerUnit', raw: string) => {
    const next: ProviderBillingConfig = { ...(billing ?? {}) };
    const text = raw.trim();
    if (!text) delete next[key];
    else {
      const value = Number(text);
      if (!Number.isFinite(value) || value <= 0) return;
      next[key] = value;
    }
    onChange(next);
  };

  /* 文本字段也走草稿态：直接回写会把用户打到一半的内容规范化掉 */
  const [textDraft, setTextDraft] = useState<Record<string, string>>({});
  const textValue = (key: string, current: string | number | undefined) =>
    textDraft[key] ?? (current === undefined ? '' : String(current));
  const onText = (key: string, raw: string, commit: (value: string) => void) => {
    setTextDraft((current) => ({ ...current, [key]: raw }));
    commit(raw);
  };
  const patchText = (
    key: 'balanceToken' | 'balanceUserId' | 'balancePath' | 'balanceAmountPath' | 'topUpPath',
    raw: string,
  ) => {
    const next: ProviderBillingConfig = { ...(billing ?? {}) };
    const text = raw.trim();
    if (!text) delete next[key];
    else next[key] = text;
    onChange(next);
  };

  /* 把「API Key 当访问令牌粘进来」这个错误当场指出来（实测踩过，余额会永远显示 `-`） */
  const looksLikeApiKey = /^sk-/i.test((billing?.balanceToken ?? '').trim());
  /* ⚠️ 账户 ID 是**数字**不是账户名：实测填 `conan` 会被服务端判
     `New-Api-User header format error`（用户 2026 就是先填了名字） */
  const badUserId = ((billing?.balanceUserId ?? '').trim().length > 0
    && !/^\d+$/.test((billing?.balanceUserId ?? '').trim()));

  const setOverride = (index: number, next: ProviderBillingModelOverride | null) => {
    const list = [...overrides];
    if (next === null) list.splice(index, 1);
    else list[index] = next;
    patch({ modelOverrides: list.length > 0 ? list : undefined });
  };

  const setDraftField = (index: number, key: 'price' | 'variants', value: string) =>
    setDraft((current) => ({ ...current, [index]: { ...current[index], [key]: value } }));

  /* 预览：把 `{origin}` / `{baseUrl}` 展开，让用户看得见最终请求哪个地址 */
  const previewEndpoint = creditPriceEndpoint(baseUrl, { priceSource: source, priceEndpoint: billing?.priceEndpoint });

  return (
    /* ⚠️ 必须包一层 `.o-section`，**不能让 `.o-card` 直接做 `.o-dialog__body` 的 flex 子项** ✗
       （踩过的坑）`.o-dialog__body` 是 `flex flex-col overflow-y:auto`，而 `.o-card` 带
       `overflow:hidden` ⇒ flex 项的 `min-height:auto` 归 0 ⇒ 所有卡片被压成 **1.3px**，
       弹窗里只看到几个空壳、内容全不可见（用户 2026：「没出现弹窗」）。
       `.o-section` 是 `overflow:visible` 的普通块、`min-height` 取内容高 ⇒ 不会塌。
       「连接信息」「启用模型」两个既有的区块也是这么包的 ✓ */
    <section className="o-section">
      <div className="o-section__head">
        <div>
          <h4 className="o-section__title">{t('计费与积分')}</h4>
          <p className="o-section__desc">
            {t('生成前的「预计花费」按这里的口径估算。换厂商时改这里即可，不必改代码。')}
          </p>
        </div>
        <OfficialSwitch
          checked={enabled}
          label={t('显示积分预估')}
          onChange={(next) => patch({ enabled: next })}
        />
      </div>

      {enabled && (
        <>
          <div className="o-card">
            <OfficialCardRow
              icon={<span className="o-state"><Icon icon="lucide:list-ordered" width={14} /></span>}
              title={t('取价方式')}
              description={t('决定「每个模型每张多少钱」从哪里来。')}
              trailing={
                <Select
                  fixedMenu
                  triggerClassName={OFFICIAL_SELECT_TRIGGER}
                  menuClassName="o-menu"
                  menuHideOverlayScrollbar
                  closeOnScroll
                  className="o-w28"
                  value={source}
                  onChange={(selectedOptionValue) =>
                    patch({ priceSource: selectedOptionValue as ProviderBillingConfig['priceSource'] })}
                >
                  <option value="auto">{t('自动读取站点价目表')}</option>
                  <option value="endpoint">{t('自定义价目表地址')}</option>
                  <option value="manual">{t('只用手动单价')}</option>
                </Select>
              }
            />
            {source === 'endpoint' && (
              <div className="o-card__row o-card__row--stack">
                <label className="o-field">
                  <span className="o-field__label">{t('价目表地址')}</span>
                  <OfficialInput
                    value={billing?.priceEndpoint ?? ''}
                    placeholder="/api/pricing"
                    onChange={(event) => patch({ priceEndpoint: event.target.value })}
                  />
                </label>
                <p className="o-field__desc">
                  {t('支持 {origin} 与 {baseUrl} 占位；以 / 开头时按本站点根解析。')}
                </p>
                {previewEndpoint && <p className="o-field__desc">{t('实际请求：{url}', { url: previewEndpoint })}</p>}
              </div>
            )}
            {source === 'manual' && (
              <div className="o-card__row">
                <p className="o-field__desc">{t('不请求任何价目表，只用下面的手动单价与兜底单价。')}</p>
              </div>
            )}
          </div>

          <div className="o-card">
            <OfficialCardRow
              icon={<span className="o-state"><Icon icon="lucide:scale" width={14} /></span>}
              title={t('积分换算')}
              description={t('价目表里的单价是「计价单位」，这里决定它折成多少积分。')}
            />
            <div className="o-card__row o-card__row--stack">
              <div className="o-fields">
                <label className="o-field">
                  <span className="o-field__label">{t('1 个计价单位 = 多少积分')}</span>
                  <OfficialInput
                    inputMode="decimal"
                    value={billing?.creditsPerUnit !== undefined ? String(billing.creditsPerUnit) : ''}
                    placeholder={String(CREDITS_PER_PRICE_UNIT)}
                    onChange={(event) => patchNumber('creditsPerUnit', event.target.value)}
                  />
                </label>
                <label className="o-field">
                  <span className="o-field__label">{t('计价单位名称')}</span>
                  <OfficialInput
                    value={billing?.currencyLabel ?? ''}
                    placeholder={t('人民币 (CNY)')}
                    onChange={(event) => patch({ currencyLabel: event.target.value || undefined })}
                  />
                </label>
              </div>
              <p className="o-field__desc">
                {t('默认 100，即 1 积分 = 计价单位的 0.01。土豆的价目表是人民币 ⇒ 1 积分 = ¥0.01。')}
              </p>
              <p className="o-field__desc">{t('当前：1 积分 = {value} 计价单位。', { value: 1 / perUnit })}</p>
            </div>
          </div>

          <div className="o-card">
            <OfficialCardRow
              icon={<span className="o-state"><Icon icon="lucide:life-buoy" width={14} /></span>}
              title={t('兜底单价')}
              description={t('价目表与逐模型手动价都查不到时用它；留空则该档不显示积分。')}
              trailing={
                <OfficialInput
                  className="o-w28"
                  inputMode="decimal"
                  value={billing?.fallbackUnitPrice !== undefined ? String(billing.fallbackUnitPrice) : ''}
                  placeholder={t('留空')}
                  onChange={(event) => patchNumber('fallbackUnitPrice', event.target.value)}
                />
              }
            />
          </div>

          <div className="o-card">
            <OfficialCardRow
              icon={<span className="o-state"><Icon icon="lucide:percent" width={14} /></span>}
              title={t('分组与折扣')}
              description={t('这条连接在上游属于哪个分组。价格会按该分组的倍率折算（如 vip-9折 ⇒ ×0.9）。')}
            />
            <div className="o-card__row o-card__row--stack">
              <div className="o-fields">
                <label className="o-field">
                  <span className="o-field__label">{t('上游分组名')}</span>
                  <OfficialInput
                    value={billing?.group ?? ''}
                    placeholder={t('留空则自动反推')}
                    onChange={(event) => patch({ group: event.target.value.trim() || undefined })}
                  />
                </label>
              </div>
              <p className="o-field__desc">
                {t('上游没有端点会告诉你「这个 key 属于哪个分组」，所以留空时 MTV 会用带 Key 的模型清单与公开价目表反推；反推不出来就留空、不套折扣。')}
              </p>
              <p className="o-field__desc">
                {t('倍率先查上游倍率表；表里没有的（如 vip-9折）按组名的「N折」推出 N/10。')}
              </p>
              <p className="o-field__desc">
                {t('这是 MTV 增强：官方读的是账号级付费状态，没有连接级分组这个概念。')}
              </p>
            </div>
          </div>

          <div className="o-card">
            <OfficialCardRow
              icon={<span className="o-state"><Icon icon="lucide:wallet" width={14} /></span>}
              title={t('余额与充值')}
              description={t('顶部那颗积分按钮显示的余额从哪里读、点它去哪里充值。')}
            />
            <div className="o-card__row o-card__row--stack">
              <div className="o-fields">
                <label className="o-field">
                  <span className="o-field__label">{t('账户访问令牌')}</span>
                  <OfficialInput
                    type="password"
                    autoComplete="off"
                    value={textValue('balanceToken', billing?.balanceToken)}
                    placeholder={t('在厂商个人中心生成，通常不以 sk- 开头')}
                    onChange={(event) => onText('balanceToken', event.target.value, (raw) => patchText('balanceToken', raw))}
                  />
                </label>
                <label className="o-field">
                  <span className="o-field__label">{t('账户 ID')}</span>
                  <OfficialInput
                    value={textValue('balanceUserId', billing?.balanceUserId)}
                    placeholder={t('一串数字，不是账户名')}
                    onChange={(event) => onText('balanceUserId', event.target.value, (raw) => patchText('balanceUserId', raw))}
                  />
                </label>
              </div>
              {badUserId && (
                <p className="o-field__error">
                  {t('账户 ID 是一串数字，不是账户名。可在厂商个人中心页面按 F12，在控制台执行 localStorage.uid 查看。')}
                </p>
              )}
              {/* ⚠️ 实测踩过：用户把**API Key**（`sk-…`，51 位）粘进了这个框，
                  而 `/api/user/self` 要的是**访问令牌**（不同的一种凭证）
                  ⇒ 一直回 `{"message":"Unauthorized, invalid access token"}`、余额永远显示 `-`。
                  这里直接按前缀把这种错误指出来 ✓ */}
              {looksLikeApiKey && (
                <p className="o-field__error">
                  {t('这看起来是 API Key，不是访问令牌。API Key 读不到余额，请在厂商个人中心的「系统访问令牌」里另生成一个。')}
                </p>
              )}
              <p className="o-field__desc">
                {t('有的厂商用 API Key 就能读余额；读不到时，去厂商个人中心生成一个访问令牌填这里。不填就显示 -。')}
              </p>
              <div className="o-fields">
                <label className="o-field">
                  <span className="o-field__label">{t('余额接口路径')}</span>
                  <OfficialInput
                    value={textValue('balancePath', billing?.balancePath)}
                    placeholder="/api/user/self"
                    onChange={(event) => onText('balancePath', event.target.value, (raw) => patchText('balancePath', raw))}
                  />
                </label>
                <label className="o-field">
                  <span className="o-field__label">{t('金额字段所在位置')}</span>
                  <OfficialInput
                    value={textValue('balanceAmountPath', billing?.balanceAmountPath)}
                    placeholder="data.quota"
                    onChange={(event) => onText('balanceAmountPath', event.target.value, (raw) => patchText('balanceAmountPath', raw))}
                  />
                </label>
                <label className="o-field">
                  <span className="o-field__label">{t('金额的写法')}</span>
                  <Select
                    fixedMenu
                    triggerClassName={OFFICIAL_SELECT_TRIGGER}
                    menuClassName="o-menu"
                    menuHideOverlayScrollbar
                    closeOnScroll
                    className="min-w-0"
                    value={billing?.balanceAmountUnit ?? 'quota'}
                    onChange={(selectedOptionValue) =>
                      patch({ balanceAmountUnit: selectedOptionValue as ProviderBillingConfig['balanceAmountUnit'] })}
                  >
                    <option value="quota">{t('还需要除以一个基数')}</option>
                    <option value="price">{t('本身就是金额')}</option>
                  </Select>
                </label>
                <label className="o-field">
                  <span className="o-field__label">{t('除以多少（基数）')}</span>
                  <OfficialInput
                    inputMode="numeric"
                    value={textValue('balanceQuotaPerUnit', billing?.balanceQuotaPerUnit)}
                    placeholder="500000"
                    onChange={(event) => onText('balanceQuotaPerUnit', event.target.value, (raw) => patchNumber('balanceQuotaPerUnit', raw))}
                  />
                </label>
              </div>
              <p className="o-field__desc">
                {t('这四项按厂商接口文档填。默认值是一套常见约定，换厂商时改这里即可。')}
              </p>
              <label className="o-field">
                <span className="o-field__label">{t('充值页地址')}</span>
                <OfficialInput
                  value={textValue('topUpPath', billing?.topUpPath)}
                  placeholder="/wallet"
                  onChange={(event) => onText('topUpPath', event.target.value, (raw) => patchText('topUpPath', raw))}
                />
              </label>
              <p className="o-field__desc">
                {t('点顶部积分按钮会跳到「充值积分」页，那里的按钮打开这个地址。')}
              </p>
            </div>
          </div>

          <div className="o-card">
            <OfficialCardRow
              icon={<span className="o-state"><Icon icon="lucide:tags" width={14} /></span>}
              title={t('逐模型手动价')}
              description={t('这里填的价会覆盖公开价目表。基础单价按「每张」填；档位明细写成 low|1k=0.04, medium|1k=0.05。')}
            />
            {overrides.length === 0 && (
              <div className="o-card__row">
                <p className="o-field__desc">{t('还没有手动价。下面点模型名可以快速加一行。')}</p>
              </div>
            )}
            {overrides.map((item, index) => (
              <div className="o-card__row o-card__row--stack" key={`${item.modelId}-${index}`}>
                <div className="o-fields">
                  <label className="o-field">
                    <span className="o-field__label">{t('模型 ID')}</span>
                    <OfficialInput
                      value={item.modelId}
                      onChange={(event) => setOverride(index, { ...item, modelId: event.target.value })}
                    />
                  </label>
                  <label className="o-field">
                    <span className="o-field__label">{t('基础单价')}</span>
                    <OfficialInput
                      inputMode="decimal"
                      value={draft[index]?.price ?? (item.unitPrice !== undefined ? String(item.unitPrice) : '')}
                      placeholder={t('留空')}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setDraftField(index, 'price', raw);
                        const value = Number(raw.trim());
                        if (!raw.trim()) setOverride(index, { ...item, unitPrice: undefined });
                        else if (Number.isFinite(value) && value > 0) setOverride(index, { ...item, unitPrice: value });
                      }}
                    />
                  </label>
                </div>
                <label className="o-field">
                  <span className="o-field__label">{t('档位明细')}</span>
                  <OfficialInput
                    value={draft[index]?.variants ?? formatVariants(item.variants)}
                    placeholder="low|1k=0.04, medium|1k=0.05"
                    onChange={(event) => {
                      const raw = event.target.value;
                      setDraftField(index, 'variants', raw);
                      setOverride(index, { ...item, variants: parseVariants(raw) });
                    }}
                  />
                </label>
                <div>
                  <OfficialButton type="button" variant="ghost" size="sm" onClick={() => setOverride(index, null)}>
                    {t('移除')}
                  </OfficialButton>
                </div>
              </div>
            ))}
            {/* ⚠️ JSX 子节点位置上的注释必须写成花括号包起来的注释形式 ——
                直接写裸的块注释会被当成**字面文本渲染出来**
                （用户 2026：「前面的文字是干啥的 你在逗我？」）✗ */}
            {groupedModels.map((group) => (
              /* 每个分类**各占一条 `o-card__row`** ⇒ 自动获得 `.o-card__row` 那条
                 `border-bottom` 分割线，类型之间不会再糊成一片
                 （用户 2026：「各类型之间的分割线呢 这个可读性太差了」） */
              <div className="o-card__row o-card__row--stack" key={group.category}>
                {/* ⚠️ 分类标题用 `.o-card__title`（14px / 500 / 前景色）—— 别用 `.o-section__desc`
                    （12px 灰），那个跟模型名一个量级，看去就是一行说明文字、认不出是分组标题
                    （用户 2026：「这个三个分类标题 识别性也很差」）✗ */}
                <span className="o-card__title flex items-center gap-2">
                  <span
                    className="contents"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: OFFICIAL_CATEGORY_ICONS[CATEGORY_ICON_KEY[group.category]] ?? '' }}
                  />
                  <span>{GENERAL_MODEL_CATEGORY_LABELS[group.category]}</span>
                </span>
                {/* ⚠️ 必须带 `--wrap`：`.o-filterbar` 默认不换行，而它在 `.o-card` 里、
                    `.o-card` 是 `overflow:hidden` ⇒ 模型一多，后面的胶囊会被直接裁掉、
                    永远点不到（用户 2026 报的「后面的点不到了」）✗
                    ⚠️ 胶囊用 `.o-badge--outline` + `.o-badge--action`：
                      · 不能用 `.o-filterchip` —— 那是「筛选」胶囊（透明底、只有 `data-checked` 才有底色），
                        当普通按钮用会渲染成一行纯文字，没有胶囊外观（用户 2026：「胶囊呢？」）✗
                      · 不能用 `.o-btn--outline` —— 它的底色是 `var(--o-background)`（对话框底色），
                        压在卡片上就是一块黑斑，跟面板格格不入（用户 2026：「颜色格格不入」）✗ */}
                <div className="o-filterbar o-filterbar--wrap">
                  {group.items.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      className="o-badge o-badge--outline o-badge--action"
                      title={displayNameOfCatalogEntry(model, { baseUrl })}
                      onClick={() => patch({ modelOverrides: [...overrides, { modelId: model.id }] })}
                    >
                      <span
                        className="contents"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: OFFICIAL_CATEGORY_ICONS[CATEGORY_ICON_KEY[model.category]] ?? '' }}
                      />
                      <span>{displayNameOfCatalogEntry(model, { baseUrl })}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {/* ⚠️ 这一行**不能**用 `.o-fields` —— 它是 **2 列 grid** ⇒ 把按钮的 `<div>` 也放进去，
                按钮会落在「第 1 行第 2 列」并贴顶，看起来浮在输入框右上方（用户 2026 报的「位置错」）✗
                照抄同一弹窗里「添加手动模型」那一行的写法：`o-card__row--center` + `o-card__body o-inline`
                ⇒ 输入框内联、按钮垂直居中贴右端 ✓ */}
            <div className="o-card__row o-card__row--center">
              <div className="o-card__body o-inline">
                <OfficialInput
                  className="flex-1 min-w-0"
                  value={newModelId}
                  placeholder={t('上游模型 ID')}
                  onChange={(event) => setNewModelId(event.target.value)}
                />
              </div>
              <OfficialButton
                type="button"
                variant="outline"
                size="sm"
                aria-label={t('添加其他模型')}
                disabled={!newModelId.trim()}
                onClick={() => {
                  patch({ modelOverrides: [...overrides, { modelId: newModelId.trim() }] });
                  setNewModelId('');
                }}
              >
                <Icon icon="lucide:plus" width={16} />
                {t('添加')}
              </OfficialButton>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
