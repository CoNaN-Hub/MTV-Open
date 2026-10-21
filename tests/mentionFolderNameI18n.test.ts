/**
 * 官方「素材库文件夹名」词条回归。
 *
 * 官方 `U1(name, t)`（canvas @200033）把文件夹语义名映射到点号 key：
 * `favorites→common.favorite`、`character/scene/item/style/sound→library.folders.*`；
 * `eD(path, t)` 按 `/` 分段调用。本表断言 MTV 的 4 份词条与官方词典**逐字相同**。
 *
 * 官方词典位置：`library.folders.*` en@3691195 / ja@4040982 / ko@4178802 / zh@4304951；
 * `common.favorite` en@3621789 / ja@3988001 / ko@4125128 / zh（index-DQjoOgEC.js）@840543。
 */
import { describe, expect, it } from 'vitest';
import enUS from '../src/i18n/locales/en-US';
import jaJP from '../src/i18n/locales/ja-JP';
import koKR from '../src/i18n/locales/ko-KR';
import zhCN from '../src/i18n/locales/zh-CN';

const OFFICIAL: Record<string, Record<string, string>> = {
  'en-US': {
    'common.favorite': 'Favorite',
    'library.folders.character': 'Character',
    'library.folders.scene': 'Scene',
    'library.folders.item': 'Item',
    'library.folders.style': 'Style',
    'library.folders.sound': 'Sound Effect',
    'library.folders.others': 'Others',
  },
  'ja-JP': {
    'common.favorite': 'お気に入り',
    'library.folders.character': 'キャラクター',
    'library.folders.scene': 'シーン',
    'library.folders.item': 'アイテム',
    'library.folders.style': 'スタイル',
    'library.folders.sound': '効果音',
    'library.folders.others': 'その他',
  },
  'ko-KR': {
    'common.favorite': '즐겨찾기',
    'library.folders.character': '캐릭터',
    'library.folders.scene': '씬',
    'library.folders.item': '아이템',
    'library.folders.style': '스타일',
    'library.folders.sound': '효과음',
    'library.folders.others': '기타',
  },
  'zh-CN': {
    'common.favorite': '收藏',
    'library.folders.character': '角色',
    'library.folders.scene': '场景',
    'library.folders.item': '道具',
    'library.folders.style': '风格',
    'library.folders.sound': '音效',
    'library.folders.others': '其他',
  },
};

const DICTS: Record<string, Record<string, string>> = { 'en-US': enUS, 'ja-JP': jaJP, 'ko-KR': koKR, 'zh-CN': zhCN };

describe('官方素材库文件夹名词条（U1 的点号 key）', () => {
  for (const [locale, table] of Object.entries(OFFICIAL)) {
    it(`${locale}：${Object.keys(table).length} 条逐字一致`, () => {
      const dict = DICTS[locale];
      expect(dict, `${locale} 词典应存在`).toBeTruthy();
      for (const [key, value] of Object.entries(table)) {
        expect(dict[key], `${locale} ${key}`).toBe(value);
      }
    });
  }

  it('`U1` 实际会用到的 6 条在 4 种语言里都不缺（others 不被 U1 使用，仅保命名空间完整）', () => {
    const usedKeys = ['common.favorite', 'library.folders.character', 'library.folders.scene',
      'library.folders.item', 'library.folders.style', 'library.folders.sound'];
    for (const [locale, table] of Object.entries(OFFICIAL)) {
      for (const key of usedKeys) {
        expect(table[key], `${locale} ${key}`).toBeTruthy();
        expect(DICTS[locale][key], `${locale} ${key} 必须已落库`).toBe(table[key]);
      }
    }
  });
});
