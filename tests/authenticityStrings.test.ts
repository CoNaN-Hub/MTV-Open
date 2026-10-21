/**
 * 官方 `authenticityCheck.*` 文案表回归（`authenticityStrings.ts`）。
 *
 * 逐字来源 `vendor-pkg-canvas-ChpWx5JY.js`：
 *   enUS `bvt`@3612257 · jaJP `vwt`@3984498 · koKR `v_t`@4121650 · zhCN `CCt`@4255016
 *
 * ⚠️ 官方 jaJP / koKR 两份命名空间**没有** `tooltip.invalidParameter` 与
 *    `statusText.invalidParameter`（frFR 也没有）⇒ 这两个键在 ja/ko 下按官方的
 *    「当前语言 → 英文」回退取到**英文原文**，这是官方的真实行为，不是缺数据。
 */
import { describe, expect, it } from 'vitest';
import {
  AUTHENTICITY_INVALID_PARAMETER_TOOLTIP,
  AUTHENTICITY_STRINGS,
  authenticityString,
  interpolateAuthenticityString,
} from '../src/services/chat/authenticityStrings';

const LOCALES = ['en-US', 'ja-JP', 'ko-KR', 'zh-CN'] as const;

/** 官方 `Ob` 用到的 7 个键 × 4 语言（逐字值；ja/ko 判空的两格是官方缺失键，回退英文）。 */
const SEVEN_KEYS = [
  'authenticityCheck.tooltip.approved',
  'authenticityCheck.tooltip.pending',
  'authenticityCheck.tooltip.rejected',
  'authenticityCheck.tooltip.invalidParameter',
  'authenticityCheck.statusText.pending',
  'authenticityCheck.statusText.rejected',
  'authenticityCheck.statusText.invalidParameter',
] as const;

const EXPECTED: Record<(typeof LOCALES)[number], Record<(typeof SEVEN_KEYS)[number], string>> = {
  'en-US': {
    'authenticityCheck.tooltip.approved': 'Character verified, ready for Seedance 2.0 video generation',
    'authenticityCheck.tooltip.pending': 'Verification submitted — please wait',
    'authenticityCheck.tooltip.rejected': 'Real photo or copyrighted IP detected',
    'authenticityCheck.tooltip.invalidParameter':
      'This file does not meet the verification requirements for format, size, or duration.',
    'authenticityCheck.statusText.pending': 'Under Review',
    'authenticityCheck.statusText.rejected': 'Rejected',
    'authenticityCheck.statusText.invalidParameter': 'Spec Limited',
  },
  'ja-JP': {
    'authenticityCheck.tooltip.approved': '検証済み — Seedance 2.0 動画生成に使用可能',
    'authenticityCheck.tooltip.pending': '検証を送信しました — しばらくお待ちください',
    'authenticityCheck.tooltip.rejected': '実写写真または著作権保護された IP を検出',
    // 官方 jaJP 命名空间里没有这个键 ⇒ 回退英文
    'authenticityCheck.tooltip.invalidParameter':
      'This file does not meet the verification requirements for format, size, or duration.',
    'authenticityCheck.statusText.pending': '検証中',
    'authenticityCheck.statusText.rejected': '不合格',
    // 官方 jaJP `statusText` 只有 {rejected,pending} ⇒ 回退英文
    'authenticityCheck.statusText.invalidParameter': 'Spec Limited',
  },
  'ko-KR': {
    'authenticityCheck.tooltip.approved': '검증 완료 — Seedance 2.0 영상 생성에 사용 가능',
    'authenticityCheck.tooltip.pending': '검증이 제출되었습니다 — 잠시 기다려 주세요',
    'authenticityCheck.tooltip.rejected': '실제 사진 또는 저작권 보호 IP 감지됨',
    // 官方 koKR 命名空间里没有这个键 ⇒ 回退英文
    'authenticityCheck.tooltip.invalidParameter':
      'This file does not meet the verification requirements for format, size, or duration.',
    'authenticityCheck.statusText.pending': '검증 중',
    'authenticityCheck.statusText.rejected': '거부됨',
    // 官方 koKR `statusText` 只有 {rejected,pending} ⇒ 回退英文
    'authenticityCheck.statusText.invalidParameter': 'Spec Limited',
  },
  'zh-CN': {
    'authenticityCheck.tooltip.approved': '角色已合规，可用于 Seedance 2.0 视频生成',
    'authenticityCheck.tooltip.pending': '已提交角色合规验证，请稍候',
    'authenticityCheck.tooltip.rejected': '检测到真人照片或受版权保护的 IP 形象',
    'authenticityCheck.tooltip.invalidParameter': '该文件的格式、尺寸或时长不满足验证要求',
    'authenticityCheck.statusText.pending': '正在验证',
    'authenticityCheck.statusText.rejected': '角色违规',
    'authenticityCheck.statusText.invalidParameter': '规格受限',
  },
};

describe('authenticityString —— 官方 authenticityCheck.* 文案（7 键 × 4 语言逐字）', () => {
  for (const locale of LOCALES) {
    for (const key of SEVEN_KEYS) {
      it(`${locale} · ${key}`, () => {
        expect(authenticityString(key, { locale })).toBe(EXPECTED[locale][key]);
      });
    }
  }

  it('ja/ko 的两格是**官方缺键回退英文**（而不是译文缺失占位）', () => {
    const ja = (AUTHENTICITY_STRINGS.jaJP as { tooltip: Record<string, unknown> }).tooltip;
    const ko = (AUTHENTICITY_STRINGS.koKR as { statusText: Record<string, unknown> }).statusText;
    expect('invalidParameter' in ja).toBe(false);
    expect('invalidParameter' in ko).toBe(false);
    expect(authenticityString('authenticityCheck.tooltip.invalidParameter', { locale: 'ja-JP' }))
      .toBe(authenticityString('authenticityCheck.tooltip.invalidParameter', { locale: 'en-US' }));
  });
});

describe('authenticityString —— 命名空间前缀 / 多行规格说明 / 回退链', () => {
  it('`authenticityCheck.` 前缀可带可不带', () => {
    expect(authenticityString('tooltip.approved', { locale: 'zh-CN' }))
      .toBe('角色已合规，可用于 Seedance 2.0 视频生成');
  });

  it('`tooltip.invalidParameterImage` 多行值逐字（U+3000 全角空格 + 换行）', () => {
    expect(authenticityString('authenticityCheck.tooltip.invalidParameterImage', { locale: 'en-US' })).toBe(
      'Image spec limited. Please ensure it meets:\n'
      + 'Format　jpeg / png / webp / bmp / tiff / gif\n'
      + 'Size　300 – 6000 px (W & H)\n'
      + 'Ratio　0.4 – 2.5 (W ÷ H)\n'
      + 'Max　30 MB',
    );
    expect(authenticityString('authenticityCheck.tooltip.invalidParameterAudio', { locale: 'zh-CN' })).toBe(
      '音频规格受限，请确认满足以下要求：\n'
      + '格式　wav / mp3\n'
      + '时长　2 ~ 15 秒\n'
      + '大小　≤ 15 MB',
    );
  });

  it('未命中：locale → 英文 → fallback → 原样返回 path', () => {
    expect(authenticityString('authenticityCheck.suggestion.notARealKey')).toBe('authenticityCheck.suggestion.notARealKey');
    expect(authenticityString('authenticityCheck.suggestion.notARealKey', { fallback: 'F' })).toBe('F');
    expect(authenticityString('authenticityCheck.statusText.pending', { locale: 'de-DE' })).toBe('正在验证');
  });

  it('`interpolateAuthenticityString` 只替换已知键', () => {
    expect(interpolateAuthenticityString('a {{x}} b {{y}}', { x: 1 })).toBe('a 1 b {{y}}');
    expect(interpolateAuthenticityString('a {{x}}', undefined)).toBe('a {{x}}');
  });
});

describe('官方 `Cwe` 映射表（@213650 逐字）', () => {
  it('Image / Video / Audio 三键', () => {
    expect(AUTHENTICITY_INVALID_PARAMETER_TOOLTIP).toEqual({
      Image: 'authenticityCheck.tooltip.invalidParameterImage',
      Video: 'authenticityCheck.tooltip.invalidParameterVideo',
      Audio: 'authenticityCheck.tooltip.invalidParameterAudio',
    });
  });
});
