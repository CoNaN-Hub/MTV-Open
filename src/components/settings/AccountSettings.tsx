/**
 * settings/AccountSettings —— 「账户管理」→ 官方「个人简介」页
 *
 * 官方出处：账号菜单（`index-BiTZf8mJ.js`）里「账户管理」（`userMenu.accountSettings`）点开的
 * 个人资料页 —— 用户给的第二张截图就是官方那一页。
 *
 * ⚠️ 第一版我按「精简版」只做了 4 项（头像/用户名/简介/语言），用户判定为**忽悠人**
 *    （「咱本地归本地 但是 你这个 是纯忽悠人 图2是官方的」）⇒ 现在按官方 JSX **逐字重建**。
 *
 * 官方 JSX 真值（同一 chunk，从 `settings.personalIntroTitle` 处抠出）：
 *   <div class="pointer-events-auto space-y-6">
 *     <div class="flex flex-col gap-6">
 *       <h2 class="text-lg font-medium leading-7 text-foreground">个人简介</h2>
 *       <div class="flex flex-row items-start gap-6">                     ← 两栏：左头像 / 右表单
 *         <div class="group relative shrink-0 cursor-pointer">            ← 头像块
 *           <Avatar class="h-[180px] w-[180px] bg-muted shadow-sm"
 *                   fallbackClass="text-2xl font-medium bg-primary text-primary-foreground"
 *                   imageClass="object-cover" />
 *           <button class="absolute inset-0 z-10 … rounded-full bg-black/60 text-white opacity-0
 *                          transition-opacity group-hover:opacity-100 group-active:opacity-100
 *                          focus-visible:opacity-100">
 *             <Camera class="h-8 w-8" strokeWidth={1.33} /><span class="sr-only">更改</span>
 *         <div class="flex min-w-0 flex-1 flex-col gap-4">                ← 右栏表单列
 *           用户名*  ：flex flex-col gap-2 → label(+ `text-destructive` 星号) + input.h-9 + 错误行 text-xs
 *           个人简介 ：flex flex-col gap-2 self-stretch → textarea
 *           社交媒体 ：relative w-full min-w-0 → input + 右侧绝对定位 `h-7 w-7 rounded-md` 的「+」
 *                      + `flex flex-wrap gap-2` 的 chip 列表（移除钮 `rounded-full p-1`
 *                        `hover:bg-white/10`）
 *           国家/城市：grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3
 *           身份/职业：flex flex-col gap-2 → input
 *           显示入驻时间：flex items-center gap-2 → Switch
 *           语言     ：flex flex-col gap-2 → select
 *           保存     ：成功走 `Rt.success(t("settings.profileSaveSuccess"))`
 *
 * ★ 数据落点（用户选定）：**全部写本机 config**（`profile*` 字段），点「保存」一次落盘、
 *   重启保留。本地没有账号后端，所以没有联网校验，用户名只做「非空」这一条（官方必填项）。
 * ★ 「语言」这个 select 与齿轮菜单里的「简体中文」弹层**同源**：都直接渲染 `LOCALES`
 *   （官方 `Yze` 去掉法语）。改语言走既有链路 —— 写 `config.language` ⇒ `store.config.ts`
 *   里 `setLocale()` ⇒ 立即生效。
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';

import { useAppStore } from '../../store/useAppStore';
import { LOCALE_LABELS, getLocale, normalizeLocale, useT, type Locale } from '../../i18n';
import type { ProfileSocialLink } from '../../types';
import { SettingsPaneBody, SettingsPaneHeader } from './SettingsPane';
import { OfficialButton, OfficialInput, OfficialSwitch, OfficialTextarea } from './official/OfficialControls';
/* 官方「国家 / 地区 · 城市 · 语言」那三种下拉（`PSl` / `TSl` / 语言 select）的复刻 */
import OfficialCombobox from '../shared/OfficialCombobox';
import { cityOptions, countryOptions, locationLocale } from '../../data/locations';

/**
 * 「语言」下拉的**行序按官方 `Yze`**（`index-BiTZf8mJ.js` @10034991）：
 *   `[{English,en-US},{简体中文,zh-CN},{日本語,ja-JP},{한국어,ko-KR,beta},{Français,fr-FR,beta}]`
 * ⚠️ 与 `LOCALES` 的顺序**不同**（那是 zh 在前的 MTV 顺序）—— 官图里第一行就是 English ✓
 * ⚠️ 法语那行**去掉**：MTV 没有 fr 字典（用户早前定过「简体中文里 不要法语」）✗
 */
const LANGUAGE_ORDER: Locale[] = ['en-US', 'zh-CN', 'ja-JP', 'ko-KR'];

/** 头像边长上限（官方上传后也是缩过的）。存的是 data URL，别把原图塞进 config。 */
const AVATAR_MAX = 256;

/** 头像文件 → 缩到 ≤256 的 data URL；解码失败抛错，由调用方提示 */
async function toAvatarDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('decode'));
    el.src = raw;
  });
  const scale = Math.min(1, AVATAR_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, w, h);
  /* webp 压体积（Chromium / WebView2 支持；不支持时浏览器回落 png）—— config 是 JSON。 */
  return canvas.toDataURL('image/webp', 0.9);
}

/**
 * ⚠️ MTV 原来在这里放的是**自造的短名单**（47 国 / 69 城）—— 官方是**带搜索的完整数据集**，
 *    用户拿官方三张图指出「国家 城市 语言的下拉形式 现在MTV的完全不对」✗
 *    ⇒ 数据整块搬进 `src/data/locations.ts`（官方 250 国 + 243 城，逐字），这里只做组装。
 */

interface Draft {
  username: string;
  bio: string;
  socialLinks: ProfileSocialLink[];
  country: string;
  city: string;
  occupation: string;
  showJoinedDate: boolean;
}

export default function AccountSettings() {
  const t = useT();
  const config = useAppStore((s) => s.config);
  const updateConfig = useAppStore((s) => s.updateConfig);
  const saveConfig = useAppStore((s) => s.saveConfig);
  const showToast = useAppStore((s) => s.showToast);

  const persist = useCallback((patch: Parameters<typeof updateConfig>[0]) => {
    updateConfig(patch);
    void saveConfig().catch(() => undefined);
  }, [saveConfig, updateConfig]);

  /* ── 草稿：进页面时从 config 取一次；「保存」才落盘（对齐官方那颗保存按钮）── */
  const [draft, setDraft] = useState<Draft>(() => ({
    username: config.profileUsername ?? '',
    bio: config.profileBio ?? '',
    socialLinks: config.profileSocialLinks ?? [],
    country: config.profileCountry ?? '',
    city: config.profileCity ?? '',
    occupation: config.profileOccupation ?? '',
    showJoinedDate: config.profileShowJoinedDate !== false,
  }));
  const patch = useCallback((next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next })), []);

  const [avatar, setAvatar] = useState(() => config.profileAvatarUrl ?? '');
  const [socialInput, setSocialInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [saving, setSaving] = useState(false);

  /* ── 头像 ── */
  const fileRef = useRef<HTMLInputElement>(null);
  const onPickAvatar = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // 同一张图连选两次也要能再次触发 change
    if (!file) return;
    try {
      setAvatar(await toAvatarDataUrl(file));
    } catch {
      showToast(t('头像读取失败，请换一张图片'), 'error');
    }
  }, [showToast, t]);

  /* ── 社交媒体：加一条 / 删一条 ── */
  const addSocial = useCallback(() => {
    const url = socialInput.trim();
    if (!url) return;
    patch({ socialLinks: [...draft.socialLinks, { url }] });
    setSocialInput('');
  }, [draft.socialLinks, patch, socialInput]);

  /* ── 语言：走既有链路，改完立即生效（与齿轮菜单里的「简体中文」同一套）── */
  const configured = config.language;
  const locale: Locale = configured ? normalizeLocale(configured) : getLocale();
  const locLocale = locationLocale(locale);

  /* 官方：国家列表与语言有关（本地化名 + 按它排序）；城市列表还跟「已选国家」联动 */
  const countries = useMemo(() => countryOptions(locLocale), [locLocale]);
  const cities = useMemo(() => cityOptions(locLocale, draft.country), [draft.country, locLocale]);

  /* ── 保存 ── */
  const save = useCallback(() => {
    const username = draft.username.trim();
    if (!username) {
      setUsernameError(t('用户名不能为空'));
      return;
    }
    setUsernameError('');
    setSaving(true);
    try {
      persist({
        profileUsername: username,
        profileBio: draft.bio,
        profileSocialLinks: draft.socialLinks.length > 0 ? draft.socialLinks : undefined,
        profileCountry: draft.country || undefined,
        profileCity: draft.city || undefined,
        profileOccupation: draft.occupation,
        profileShowJoinedDate: draft.showJoinedDate,
        profileAvatarUrl: avatar || undefined,
      });
      showToast(t('资料已更新'));
    } finally {
      setSaving(false);
    }
  }, [avatar, draft, persist, showToast, t]);

  /* 官方 `Ax`（UserAvatar）的兜底首字母：
       `y = (username?.trim() || '').charAt(0) || 'U'`，其中 username = `user_name || email || 'User'`
     ⇒ 没名字时官方显示的是 **U**（不是 MTV 原来那个 'M' ✗）。MTV 没有邮箱字段 ⇒ 直接 `|| 'User'`。*/
  const initial = ((draft.username.trim() || 'User')[0] ?? 'U').toUpperCase();

  return (
    <SettingsPaneBody>
      {/* 官方这一页只有标题，没有副标题 */}
      <SettingsPaneHeader title={t('个人简介')} />

      <div className="account-form">
        {/* ── 头像（180×180 圆；hover 出黑色遮罩 + 相机图标）── */}
        <div className="account-avatar-group">
          <span className="account-avatar-preview">
            {avatar
              ? <img src={avatar} alt="" draggable={false} />
              : <span className="account-avatar-fallback">{initial}</span>}
          </span>
          <button
            type="button"
            className="account-avatar-overlay"
            onClick={() => fileRef.current?.click()}
          >
            <Icon icon="lucide:camera" width={32} height={32} strokeWidth={1.33} aria-hidden="true" />
            <span className="sr-only">{t('更改')}</span>
          </button>
          {avatar && (
            <button
              type="button"
              className="account-avatar-remove"
              onClick={() => setAvatar('')}
              aria-label={t('移除')}
            >
              <Icon icon="lucide:x" width={14} height={14} aria-hidden="true" />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label={t('更改')}
            onChange={(event) => { void onPickAvatar(event); }}
          />
        </div>

        {/* ── 右栏表单 ── */}
        <div className="account-fields">
          {/* 用户名（官方必填）*/}
          <div className="account-field-row">
            <label className="account-field-label" htmlFor="account-username">
              {t('用户名')}<span className="account-required" aria-hidden="true">*</span>
            </label>
            <OfficialInput
              id="account-username"
              value={draft.username}
              maxLength={32}
              placeholder={t('请输入用户名')}
              onChange={(event) => {
                patch({ username: event.target.value });
                if (usernameError) setUsernameError('');
              }}
            />
            {usernameError && <p className="account-field-error">{usernameError}</p>}
          </div>

          {/* 个人简介 */}
          <div className="account-field-row">
            <label className="account-field-label" htmlFor="account-bio">{t('个人简介')}</label>
            <OfficialTextarea
              id="account-bio"
              className="account-bio"
              value={draft.bio}
              maxLength={200}
              placeholder={t('介绍一下你自己…')}
              onChange={(event) => patch({ bio: event.target.value })}
            />
          </div>

          {/* 社交媒体：输入框 + 右侧「+」+ chip 列表 */}
          <div className="account-field-row">
            <label className="account-field-label" htmlFor="account-social">{t('社交媒体')}</label>
            <div className="account-social-input">
              <OfficialInput
                id="account-social"
                value={socialInput}
                placeholder={t('在此粘贴社交主页链接')}
                onChange={(event) => setSocialInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSocial(); } }}
              />
              <button
                type="button"
                className="account-social-add"
                onClick={addSocial}
                disabled={!socialInput.trim()}
                aria-label={t('添加')}
              >
                <Icon icon="lucide:plus" width={16} height={16} aria-hidden="true" />
              </button>
            </div>
            {draft.socialLinks.length > 0 && (
              <div className="account-social-chips">
                {draft.socialLinks.map((link, index) => (
                  <span className="account-social-chip" key={`${link.url}-${index}`}>
                    <span className="account-social-chip__text">{link.displayText || link.url}</span>
                    <button
                      type="button"
                      className="account-social-chip__remove"
                      aria-label={t('移除')}
                      onClick={() => patch({ socialLinks: draft.socialLinks.filter((_, i) => i !== index) })}
                    >
                      <Icon icon="lucide:x" width={12} height={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 国家 / 地区 + 城市（官方 `grid sm:grid-cols-2`）
              官方是**带搜索的下拉**（`PSl` 国家 / `TSl` 城市）：搜索行 + 首项高亮 + 右侧 ✓
              ⇒ 用 `OfficialCombobox`（逐字复刻），不再用 MTV 那个朴素 `Select` ✗
              · 国家：官方 250 条表，按本地化名排序，**存英文名**
              · 城市：官方 243 条精选城市，选了国家只出该国；输入列表里没有的给「使用「x」」*/}
          <div className="account-grid-2">
            <div className="account-field-row">
              <label className="account-field-label" htmlFor="account-country">{t('国家 / 地区')}</label>
              <OfficialCombobox
                id="account-country"
                className="o-combobox--field"
                value={draft.country}
                onChange={(value) => patch({ country: value })}
                options={countries}
                placeholder={t('国家')}
                searchPlaceholder={t('搜索国家…')}
                emptyText={t('未找到国家。')}
                ariaLabel={t('国家 / 地区')}
              />
            </div>
            <div className="account-field-row">
              <label className="account-field-label" htmlFor="account-city">{t('城市')}</label>
              <OfficialCombobox
                id="account-city"
                className="o-combobox--field"
                value={draft.city}
                onChange={(value) => patch({ city: value })}
                options={cities}
                placeholder={t('城市')}
                searchPlaceholder={t('搜索城市…')}
                emptyText={t('未找到城市。')}
                customLabel={(input) => t('使用「{city}」', { city: input })}
                ariaLabel={t('城市')}
              />
            </div>
          </div>

          {/* 身份 / 职业 */}
          <div className="account-field-row">
            <label className="account-field-label" htmlFor="account-occupation">{t('身份 / 职业')}</label>
            <OfficialInput
              id="account-occupation"
              value={draft.occupation}
              maxLength={40}
              placeholder={t('写点什么，让大家更了解你')}
              onChange={(event) => patch({ occupation: event.target.value })}
            />
          </div>

          {/* 显示入驻时间 */}
          <div className="account-switch-row">
            <span className="account-field-label">{t('显示入驻时间')}</span>
            <OfficialSwitch
              checked={draft.showJoinedDate}
              onChange={(checked) => patch({ showJoinedDate: checked })}
              label={t('显示入驻时间')}
            />
          </div>

          {/* 语言：与齿轮菜单里的「简体中文」同源，改完立即生效。
              官方这处是 **Radix Select（无搜索行）**，行右侧一个 ✓（见用户给的图 3）
              ⇒ 同一个 `OfficialCombobox` 传 `searchable={false}`，形态逐条对齐 ✓ */}
          <div className="account-field-row">
            <label className="account-field-label" htmlFor="account-language">{t('语言')}</label>
            <OfficialCombobox
              id="account-language"
              className="o-combobox--field"
              value={locale}
              onChange={(value) => { const next = normalizeLocale(value); if (next !== locale) persist({ language: next }); }}
              options={LANGUAGE_ORDER.map((code) => ({ value: code, label: LOCALE_LABELS[code] }))}
              placeholder={t('请选择语言')}
              searchable={false}
              ariaLabel={t('语言')}
            />
          </div>

          {/* 保存（官方 `profileSaveSuccess` 提示）*/}
          <div className="account-actions">
            <OfficialButton variant="default" onClick={save} disabled={saving}>
              {t('保存')}
            </OfficialButton>
          </div>
        </div>
      </div>
    </SettingsPaneBody>
  );
}
