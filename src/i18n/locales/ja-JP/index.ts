/**
 * ja-JP 词条聚合：key 是源码里的中文原文，缺失时自动回落中文。
 * 按功能域拆分到各模块文件，新增模块在此处汇总。
 * 占位符沿用 `{name}` 语法，必须与源码中 t() 的第二个参数字段名一致。
 */
import canvas from './canvas';
import character from './character';
import chat from './chat';
import common from './common';
import nodes from './nodes';
import officialModal from './officialModal';
import nodeSearch from './nodeSearch';
import onboarding from './onboarding';
import project from './project';
import projectSettings from './projectSettings';
import series from './series';
import settings from './settings';
import videoEditor from './videoEditor';

const jaJP: Record<string, string> = {
  ...canvas,
  ...character,
  ...chat,
  ...common,
  ...nodes,
  ...officialModal,
  ...nodeSearch,
  ...onboarding,
  ...project,
  ...projectSettings,
  ...series,
  ...settings,
  ...videoEditor,
  /* ── 官方「素材库文件夹名」词条（官方 U1 走的点号 key）──
     官方 U1(name, t)（canvas @200033）：favorites→common.favorite、character/scene/item/style/sound
     → library.folders.*；eD(path, t) 按 / 分段调用。官方词典逐字：
     en@3691195 / ja@4040982 / ko@4178802 / zh@4304951（common.favorite：en@3621789 / ja@3988001 / ko@4125128 / zh index@840543）。
     library.folders.others 官方词典里有、但 U1 不映射，这里一并落库以保持命名空间完整。 */
  'common.favorite': 'お気に入り',
  'library.folders.character': 'キャラクター',
  'library.folders.scene': 'シーン',
  'library.folders.item': 'アイテム',
  'library.folders.style': 'スタイル',
  'library.folders.sound': '効果音',
  'library.folders.others': 'その他',
  /* ── 官方 `Ub`（`@` 建议弹层）用到的点号 key（live bundle 逐字）──
     · `library.search`：canvas 词典 `library` 命名空间 @4042350（`title:"ライブラリ",search:"検索"`）
     · `common.back` / `common.retry`：应用级 `index-DQjoOgEC.js` @496381（`x1={back:"戻る",…,retry:"再試行"}`）
     · `elementLibrary.*`：官方词典只有 en/zh 两份，ja 缺失 ⇒ 按官方 fallbackLng 口径回落英文
       （与 `mentionStrings.ts` 里 `skills.*` / `skillOptions.*` 的 ja 取值同一处理）
     · `omniReference.suggestion.referenceCurrentFolder`：官方词典里**没有**该键，
       `Ub` 的 `C("…","Reference folder")` 直接回落英文兜底串 ⇒ 逐字 "Reference folder"。 */
  'library.search': '検索',
  'common.back': '戻る',
  'common.retry': '再試行',
  'elementLibrary.errors.loadFailed': 'Could not load element details',
  'elementLibrary.mention.privateSection': 'Private elements',
  'elementLibrary.mention.teamSection': 'Team elements',
  'omniReference.suggestion.referenceCurrentFolder': 'Reference folder',
  /* ── 官方「生成确认模式」与「本地权限菜单」词条（官方点号 key）──
     官方词典：en 3521101/3561340 · ja 3927683 · ko 4064641 · zh 4201748/4227870（canvas chunk）。
     ⚠️ 官方 ja/ko 词典里**没有** `chatAdapter.localPermissionMenu.*` ⇒ 官方行为就是回退英文，这里同样落英文值。
     此前只有 zh-CN 落库，en/ja/ko 下这三颗控件（确认模式开关 + 菜单行 + 了解更多）会显示原始 key。 */
  'chatAdapter.confirmMode.auto': '自動実行',
  'chatAdapter.confirmMode.askTitle': '実行前に確認',
  'chatAdapter.confirmMode.ask': '手動確認',
  'chatAdapter.confirmMode.autoDesc': 'TapNow は承認を求めずに作業を進めます。',
  'chatAdapter.confirmMode.autoTitle': '確認なしで実行',
  'chatAdapter.confirmMode.askDesc': 'TapNow は一時停止し、各操作の承認を待ちます。',
  'chatAdapter.localPermissionMenu.learnMore': 'Learn more',
  'chatAdapter.localPermissionMenu.autoExceptDeleteDescription': 'Auto-run generation and safe local ops in mounted folders. Delete still needs confirmation.',
  'chatAdapter.localPermissionMenu.alwaysConfirmDescription': 'Always ask for generation and every local file or folder operation.',
  /* ── 官方「自动生成模式提示条」词条（官方点号 key，`tae`(`GenerationAutoModeTip`) 用）──
     官方词典（canvas chunk `vendor-pkg-canvas-ChpWx5JY.js`）：
     · `chatAdapter.generationConfirmation.autoModeTipMessage`：en @3513465 / fr @3714830 /
       ja @3922010 / ko @4058933 / zh @4196603
     · `chatAdapter.generationConfirmation.closeTip`：en @3513370 / fr @3714731 /
       ja @3921935 / ko @4058858 / zh @4196529
     此前四语言**都没有**这两个 key 落库 ⇒ 提示条会显示原始 key。 */
  'chatAdapter.generationConfirmation.autoModeTipMessage': 'すべての生成タスクで Tapies が自動的に差し引かれます。',
  'chatAdapter.generationConfirmation.closeTip': '閉じる',
  /* ── 官方「应用市场 / 插件域」点号 key（本轮「应用市场 · 插件域」补齐；取值逐字来自 live bundle）──
     官方词典：`chatAdapter.context.addReference` ja @3944118 ·
     `chatAdapter.addMenu.plugins.{noSearchResults,errors.listFailed,installPlugin,byTapNow}` ja @3951832/@3952137 ·
     `chatAdapter.addMenu.skills.managePluginDialogTitle` ja @3954410。 */
  'chatAdapter.context.addReference': '参照を追加',
  'chatAdapter.addMenu.plugins.noSearchResults': '一致するアプリがありません',
  'chatAdapter.addMenu.plugins.errors.listFailed': 'アプリを読み込めませんでした',
  'chatAdapter.addMenu.plugins.installPlugin': 'アプリをインストール',
  'chatAdapter.addMenu.plugins.byTapNow': 'TapNow 提供',
  'chatAdapter.addMenu.skills.managePluginDialogTitle': 'アプリを管理',
  /* 官方新版「详细过程」(chatAdapter.progressDetails.*，新版 bundle @3582135/@4000281/@4140578 逐字) */
  'chatAdapter.progressDetails.title': '詳しい進捗',
  'chatAdapter.progressDetails.description': '実行手順とツールの結果を表示します。',
  'chatAdapter.progressDetails.summary': '結果',
  'chatAdapter.progressDetails.output': '出力',
  'chatAdapter.progressDetails.errors': 'エラー出力',
  'chatAdapter.progressDetails.file': 'ファイル内容',
  'chatAdapter.progressDetails.truncated': '一部の結果です。続きを読み取るか、範囲を絞ってください。',
};

export default jaJP;
