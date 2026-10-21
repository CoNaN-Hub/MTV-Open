/**
 * widget 族 / htmlPreview 的官方 i18n 文案表 —— **逐字**取自 live bundle。
 *
 * 数据源（`vendor-pkg-canvas-ChpWx5JY.js`，均用 `_rawat.mjs` 读原始窗口核对，未凭截图目测）：
 *   · `chatAdapter.widget.generating`              —— 引用点仅 @2360807；locale 块 en @3551928 / fr @3757280 /
 *                                                    ja @3950948 / ko @4088149 / zh @4221878
 *   · `chatAdapter.artifactPanel.openInteractivePage` —— 引用点 @2358534（`ShowHtmlCard`）；locale 块
 *                                                    en @3514235 / fr @3715601 / ja @3922503 / ko @4059430 / zh @4197072
 *   · `chatAdapter.errors.sendFailed`              —— 引用点 @2364517（`ShowWidgetCard`）；locale 块
 *                                                    en @3544828 / fr @3749227 / ja @3945496 / ko @4082587 / zh @4217057
 *   · `chatAdapter.htmlPreview.*`（16 键）           —— locale 块 en @3565948 / ja @3959711 / ko @4096902 / zh @4230096
 *                                                    （fr @3771773，MTV 不支持 fr ⇒ 不入表）
 *
 * ⚠️ 为什么用**自带表**而不是仓库的 `t()`：
 *   1. MTV 的 locale 字典在 `src/i18n/locales/*`，**属本任务文件边界之外，改动被禁止**；
 *      且按 §9.3，MTV 目前只有 `chatAdapter.confirmMode` / `chatAdapter.localPermissionMenu` 两组
 *      `chatAdapter.*` 键 —— 官方这批 key 在 MTV 侧**不存在**。
 *   2. MTV 的 `t()` 以**中文源串**为 key，官方 key 是点号路径 ⇒ 直接 `t("chatAdapter.htmlPreview.title")`
 *      永远命中不了。这里按官方口径「key → 当前 locale 的值」自行解析，值全部逐字来自官方 locale 块。
 *   3. 与同一批次的 `generationConfirmationStrings.ts` 保持同一套「表在 `src/services/chat/`」的落地方式。
 *
 * 官方组件里的调用形状是 `o(key, "EN default")` 与 `n(key, {defaultValue: "EN default"})`
 * （见 §7/§8 逐字），本模块的 `useWidgetText()` 同时接受这两种第二参数。
 */
import { useMemo } from 'react';
import { getLocale, useT, type Locale } from '../../i18n';

/** 官方第二参数：字符串默认值，或 `{defaultValue}` 对象（两种官方写法都出现）。 */
export type WidgetTextDefault = string | { defaultValue: string };

/** 官方 `chatAdapter.widget.*` / `chatAdapter.artifactPanel.*` / `chatAdapter.errors.*` / `chatAdapter.htmlPreview.*`。 */
export const OFFICIAL_WIDGET_TEXT: Record<string, Record<Locale, string>> = {
  /* ── §6.10 `chatAdapter.widget.*`（组内只有 1 个键） ── */
  'chatAdapter.widget.generating': {
    'zh-CN': '正在生成...',
    'en-US': 'Generating...',
    'ja-JP': '生成中...',
    'ko-KR': '생성 중...',
  },

  /* ── §6.7 `ShowHtmlCard` 唯一引用到的键（赋给变量 `c`，见 `ShowHtmlCard` 内的逐字说明） ── */
  'chatAdapter.artifactPanel.openInteractivePage': {
    'zh-CN': '打开互动作品',
    'en-US': 'Open interactive page',
    'ja-JP': 'インタラクティブページを開く',
    'ko-KR': '인터랙티브 페이지 열기',
  },

  /* ── `ShowWidgetCard` 的 `sendPrompt` 失败提示 ── */
  'chatAdapter.errors.sendFailed': {
    'zh-CN': '抱歉，发生了错误。请稍后重试。',
    'en-US': 'Sorry, an error occurred. Please try again later.',
    'ja-JP': '申し訳ございません、エラーが発生しました。後でもう一度お試しください。',
    'ko-KR': '죄송합니다. 오류가 발생했습니다. 나중에 다시 시도하세요.',
  },

  /* ── §8.9 `chatAdapter.htmlPreview.*`（zh 块 @4230096 逐字；en/ja/ko 同序逐字） ── */
  'chatAdapter.htmlPreview.title': {
    'zh-CN': 'HTML 预览',
    'en-US': 'HTML preview',
    'ja-JP': 'HTML プレビュー',
    'ko-KR': 'HTML 미리보기',
  },
  'chatAdapter.htmlPreview.close': {
    'zh-CN': '关闭预览',
    'en-US': 'Close preview',
    'ja-JP': 'プレビューを閉じる',
    'ko-KR': '미리보기 닫기',
  },
  'chatAdapter.htmlPreview.loading': {
    'zh-CN': '加载中…',
    'en-US': 'Loading…',
    'ja-JP': '読み込み中…',
    'ko-KR': '불러오는 중…',
  },
  'chatAdapter.htmlPreview.loadFailed': {
    'zh-CN': '预览加载失败',
    'en-US': 'Failed to load preview',
    'ja-JP': 'プレビューの読み込みに失敗しました',
    'ko-KR': '미리보기를 불러오지 못했습니다',
  },
  'chatAdapter.htmlPreview.renderFailed': {
    'zh-CN': '渲染失败',
    'en-US': 'Failed to render artifact',
    'ja-JP': 'アーティファクトの表示に失敗しました',
    'ko-KR': '아티팩트 렌더링 실패',
  },
  'chatAdapter.htmlPreview.retry': {
    'zh-CN': '重试',
    'en-US': 'Retry',
    'ja-JP': '再試行',
    'ko-KR': '다시 시도',
  },
  'chatAdapter.htmlPreview.downloadHtml': {
    'zh-CN': '下载 HTML',
    'en-US': 'Download HTML',
    'ja-JP': 'HTML をダウンロード',
    'ko-KR': 'HTML 다운로드',
  },
  'chatAdapter.htmlPreview.downloadFailed': {
    'zh-CN': 'HTML 下载失败，请重试。',
    'en-US': 'Unable to download HTML. Please try again.',
    'ja-JP': 'HTML をダウンロードできませんでした。もう一度お試しください。',
    'ko-KR': 'HTML을 다운로드할 수 없습니다. 다시 시도해 주세요.',
  },
  'chatAdapter.htmlPreview.copy': {
    'zh-CN': '复制',
    'en-US': 'Copy',
    'ja-JP': 'コピー',
    'ko-KR': '복사',
  },
  'chatAdapter.htmlPreview.copyFailed': {
    'zh-CN': '复制失败',
    'en-US': 'Copy failed',
    'ja-JP': 'コピーに失敗しました',
    'ko-KR': '복사 실패',
  },
  'chatAdapter.htmlPreview.share': {
    'zh-CN': '分享此页面',
    'en-US': 'Share this page',
    'ja-JP': 'このページを共有',
    'ko-KR': '이 페이지 공유',
  },
  'chatAdapter.htmlPreview.sharing': {
    'zh-CN': '正在分享…',
    'en-US': 'Sharing…',
    'ja-JP': '共有中…',
    'ko-KR': '공유 중…',
  },
  'chatAdapter.htmlPreview.shareCopied': {
    'zh-CN': '分享链接已复制',
    'en-US': 'Share link copied',
    'ja-JP': '共有リンクをコピーしました',
    'ko-KR': '공유 링크가 복사되었습니다',
  },
  'chatAdapter.htmlPreview.shareFailed': {
    'zh-CN': '分享失败',
    'en-US': 'Share failed',
    'ja-JP': '共有に失敗しました',
    'ko-KR': '공유 실패',
  },
  'chatAdapter.htmlPreview.shareLinkLabel': {
    'zh-CN': '分享链接',
    'en-US': 'Share link',
    'ja-JP': '共有リンク',
    'ko-KR': '공유 링크',
  },
  'chatAdapter.htmlPreview.disclaimer': {
    'zh-CN':
      '本页内容由用户借助 AI 生成，可能存在不准确之处，请自行甄别。相关内容与观点均与 TapNow 平台无关。',
    'en-US':
      'This page was created by a user with AI and may contain inaccuracies. Please verify independently. Its content and views are not affiliated with TapNow.',
    'ja-JP':
      '本ページの内容はユーザーが AI を用いて生成したもので、不正確な情報が含まれる場合があります。内容はご自身でご確認ください。記載の内容および見解は TapNow とは一切関係ありません。',
    'ko-KR':
      '이 페이지의 내용은 사용자가 AI를 사용하여 생성한 것으로 부정확한 정보가 포함될 수 있습니다. 직접 확인하시기 바랍니다. 해당 내용과 견해는 TapNow와 무관합니다.',
  },
};

/** 官方第二参数的两种形态归一为字符串。 */
function resolveDefault(defaultValue?: WidgetTextDefault): string | undefined {
  if (typeof defaultValue === 'string') return defaultValue;
  return defaultValue?.defaultValue;
}

/**
 * 官方 `se()` 的 `t` 在此刻 locale 下的取值：命中官方表就返回官方值，否则回落调用点的英文 `defaultValue`，
 * 再否则回落 key 本身（官方 i18next 的兜底顺序）。
 */
export function officialWidgetText(
  key: string,
  locale: Locale,
  defaultValue?: WidgetTextDefault,
): string {
  const entry = OFFICIAL_WIDGET_TEXT[key];
  const value = entry?.[locale];
  if (value) return value;
  return resolveDefault(defaultValue) ?? key;
}

/**
 * 组件内用文案函数 —— 形状与官方 `const {t: o} = se()` 的 `o` 一致：
 *   `o("chatAdapter.widget.generating", "Generating...")`
 *   `o("chatAdapter.errors.sendFailed", { defaultValue: "Send failed. Please retry." })`
 *
 * `useT()` 只用于订阅语言切换（触发重渲染）；取值走 {@link getLocale}，与 `EmptyChatState` 同一手法。
 */
export function useWidgetText(): (key: string, defaultValue?: WidgetTextDefault) => string {
  useT();
  const locale = getLocale();
  return useMemo(
    () => (key: string, defaultValue?: WidgetTextDefault) =>
      officialWidgetText(key, locale, defaultValue),
    [locale],
  );
}

/** 表内全部官方 key（供测试断言「表覆盖了什么」）。 */
export function officialWidgetTextKeys(): string[] {
  return Object.keys(OFFICIAL_WIDGET_TEXT);
}
