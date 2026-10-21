/**
 * 官方「生成确认模式」词条回归（四语言）。
 *
 * 官方词典（live `vendor-pkg-canvas-ChpWx5JY.js`）：
 *   en@3521101 · ja@3927683 · ko@4064641 · zh@4201748（`chatAdapter.confirmMode.*`）
 *   en@3561340 · zh@4227870（`chatAdapter.localPermissionMenu.*`）
 * ⚠️ 官方 **ja/ko 词典里没有** `chatAdapter.localPermissionMenu.*` ⇒ 官方行为是回退英文；
 *    本表的 ja/ko 同样落英文值（不是缺数据）。
 */
import { describe, expect, it } from 'vitest';
import enUS from '../src/i18n/locales/en-US';
import jaJP from '../src/i18n/locales/ja-JP';
import koKR from '../src/i18n/locales/ko-KR';
import zhCN from '../src/i18n/locales/zh-CN';

const CONFIRM: Record<string, Record<string, string>> = {
  'en-US': {
    'chatAdapter.confirmMode.ask': 'Ask',
    'chatAdapter.confirmMode.askTitle': 'Ask before acting',
    'chatAdapter.confirmMode.askDesc': 'TapNow pauses so you can approve each action.',
    'chatAdapter.confirmMode.auto': 'Act',
    'chatAdapter.confirmMode.autoTitle': 'Act without asking',
    'chatAdapter.confirmMode.autoDesc': 'TapNow works without asking for approval.',
  },
  'ja-JP': {
    'chatAdapter.confirmMode.ask': '手動確認',
    'chatAdapter.confirmMode.askTitle': '実行前に確認',
    'chatAdapter.confirmMode.askDesc': 'TapNow は一時停止し、各操作の承認を待ちます。',
    'chatAdapter.confirmMode.auto': '自動実行',
    'chatAdapter.confirmMode.autoTitle': '確認なしで実行',
    'chatAdapter.confirmMode.autoDesc': 'TapNow は承認を求めずに作業を進めます。',
  },
  'ko-KR': {
    'chatAdapter.confirmMode.ask': '수동확인',
    'chatAdapter.confirmMode.askTitle': '실행 전 확인',
    'chatAdapter.confirmMode.askDesc': 'TapNow가 일시 정지되어 각 작업을 승인할 수 있습니다.',
    'chatAdapter.confirmMode.auto': '자동실행',
    'chatAdapter.confirmMode.autoTitle': '확인 없이 실행',
    'chatAdapter.confirmMode.autoDesc': 'TapNow가 승인 없이 작업을 진행합니다.',
  },
  'zh-CN': {
    'chatAdapter.confirmMode.ask': '手动确认',
    'chatAdapter.confirmMode.askTitle': '手动确认',
    'chatAdapter.confirmMode.askDesc': 'Agent在执行生成前都会寻求您的确认',
    'chatAdapter.confirmMode.auto': '自动生成',
    'chatAdapter.confirmMode.autoTitle': '自动生成',
    'chatAdapter.confirmMode.autoDesc': 'Agent会自主规划生成任务并自动执行',
  },
};

/** 官方 en 的本地权限菜单（ja/ko 官方缺失 ⇒ 同样按 en 落库）。 */
const PERMISSION_EN = {
  'chatAdapter.localPermissionMenu.learnMore': 'Learn more',
  'chatAdapter.localPermissionMenu.alwaysConfirmDescription': 'Always ask for generation and every local file or folder operation.',
  'chatAdapter.localPermissionMenu.autoExceptDeleteDescription': 'Auto-run generation and safe local ops in mounted folders. Delete still needs confirmation.',
};

const DICTS: Record<string, Record<string, string>> = { 'en-US': enUS, 'ja-JP': jaJP, 'ko-KR': koKR, 'zh-CN': zhCN };

describe('官方确认模式词条（四语言）', () => {
  for (const [locale, table] of Object.entries(CONFIRM)) {
    it(`${locale}：6 个 \`chatAdapter.confirmMode.*\` 逐字一致`, () => {
      for (const [key, value] of Object.entries(table)) {
        expect(DICTS[locale][key], `${locale} ${key}`).toBe(value);
      }
    });
  }

  it('三语言的 `localPermissionMenu.{learnMore,alwaysConfirmDescription,autoExceptDeleteDescription}` 按官方口径落英文', () => {
    for (const locale of ['en-US', 'ja-JP', 'ko-KR']) {
      for (const [key, value] of Object.entries(PERMISSION_EN)) {
        expect(DICTS[locale][key], `${locale} ${key}`).toBe(value);
      }
    }
  });

  it('zh-CN 的本地权限词条存在（官方 zh 有，且与 en 不同）', () => {
    expect(zhCN['chatAdapter.localPermissionMenu.learnMore']).toBe('了解更多');
    expect(zhCN['chatAdapter.localPermissionMenu.learnMore']).not.toBe(PERMISSION_EN['chatAdapter.localPermissionMenu.learnMore']);
  });

  it('确认模式开关用到的键在四语言下都不会回落到原始 key', () => {
    for (const locale of Object.keys(CONFIRM)) {
      for (const key of ['chatAdapter.confirmMode.ask', 'chatAdapter.confirmMode.auto', 'chatAdapter.confirmMode.askDesc', 'chatAdapter.confirmMode.autoDesc']) {
        const value = DICTS[locale][key];
        expect(value, `${locale} ${key} 不能等于 key 本身`).toBeTruthy();
        expect(value).not.toBe(key);
      }
    }
  });
});
