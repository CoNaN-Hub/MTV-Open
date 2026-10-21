/**
 * en-US 词条聚合：key 是源码里的中文原文，缺失时自动回落中文。
 * 按功能域拆分到各模块文件，新增模块在此处汇总。
 */
import common from './common';
import settings from './settings';
import onboarding from './onboarding';
import project from './project';
import character from './character';
import canvas from './canvas';
import chat from './chat';
import nodes from './nodes';
import officialModal from './officialModal';
import nodeSearch from './nodeSearch';
import series from './series';
import projectSettings from './projectSettings';
import videoEditor from './videoEditor';

const enUS: Record<string, string> = {
  ...common,
  ...settings,
  ...onboarding,
  ...project,
  ...character,
  ...canvas,
  ...chat,
  ...nodes,
  ...officialModal,
  ...nodeSearch,
  ...series,
  ...projectSettings,
  ...videoEditor,
  /* ── 官方「素材库文件夹名」词条（官方 U1 走的点号 key）──
     官方 U1(name, t)（canvas @200033）：favorites→common.favorite、character/scene/item/style/sound
     → library.folders.*；eD(path, t) 按 / 分段调用。官方词典逐字：
     en@3691195 / ja@4040982 / ko@4178802 / zh@4304951（common.favorite：en@3621789 / ja@3988001 / ko@4125128 / zh index@840543）。
     library.folders.others 官方词典里有、但 U1 不映射，这里一并落库以保持命名空间完整。 */
  'common.favorite': 'Favorite',
  'library.folders.character': 'Character',
  'library.folders.scene': 'Scene',
  'library.folders.item': 'Item',
  'library.folders.style': 'Style',
  'library.folders.sound': 'Sound Effect',
  'library.folders.others': 'Others',
  /* ── 官方 `Ub`（`@` 建议弹层）用到的点号 key（live bundle 逐字）──
     取值出处（canvas chunk `vendor-pkg-canvas-ChpWx5JY.js`，
     应用级 `common` 命名空间在 `index-DQjoOgEC.js`）：
     · `library.search`（canvas 词典 `library` 命名空间 @3692878）
     · `common.back` / `common.retry`（index @195620 `XT={back:"Back",…,retry:"Retry"}`；canvas 自己的
       `common` 命名空间里**没有**这两个键，`Ub` 的 `C("common.back","Back")` 走的就是应用级词条）
     · `elementLibrary.errors.loadFailed` / `elementLibrary.mention.{privateSection,teamSection}`
       （canvas @3614744 起的 `elementLibrary` 命名空间）
     · `omniReference.suggestion.referenceCurrentFolder`：官方词典里**没有**该键，
       `Ub` 的 `C("…","Reference folder")` 直接回落英文兜底串 ⇒ 四语言都用 "Reference folder"（逐字）。
     ja/ko 缺 `elementLibrary.*` 词条（官方词典只有 en/zh），按官方 fallbackLng 口径回落英文。 */
  'library.search': 'Search',
  'common.back': 'Back',
  'common.retry': 'Retry',
  'elementLibrary.errors.loadFailed': 'Could not load element details',
  'elementLibrary.mention.privateSection': 'Private elements',
  'elementLibrary.mention.teamSection': 'Team elements',
  'omniReference.suggestion.referenceCurrentFolder': 'Reference folder',
  /* ── 官方「生成确认模式」与「本地权限菜单」词条（官方点号 key）──
     官方词典：en 3521101/3561340 · ja 3927683 · ko 4064641 · zh 4201748/4227870（canvas chunk）。
     ⚠️ 官方 ja/ko 词典里**没有** `chatAdapter.localPermissionMenu.*` ⇒ 官方行为就是回退英文，这里同样落英文值。
     此前只有 zh-CN 落库，en/ja/ko 下这三颗控件（确认模式开关 + 菜单行 + 了解更多）会显示原始 key。 */
  'chatAdapter.confirmMode.auto': 'Act',
  'chatAdapter.confirmMode.askTitle': 'Ask before acting',
  'chatAdapter.confirmMode.ask': 'Ask',
  'chatAdapter.confirmMode.autoDesc': 'TapNow works without asking for approval.',
  'chatAdapter.confirmMode.autoTitle': 'Act without asking',
  'chatAdapter.confirmMode.askDesc': 'TapNow pauses so you can approve each action.',
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
  'chatAdapter.generationConfirmation.autoModeTipMessage': 'In auto-generate mode, Tapies will be auto-deducted for all generation tasks.',
  'chatAdapter.generationConfirmation.closeTip': 'Close',
  /* ── 官方「应用市场 / 插件域」点号 key（本轮「应用市场 · 插件域」补齐）──
     官方词典（canvas chunk `vendor-pkg-canvas-ChpWx5JY.js`，四语言各自成块）：
     · `chatAdapter.context.addReference`：en @3542816 / ja @3944118 / ko @4081106 / zh @4215846
       （`MessageInputAreaV2`(`Hie`) 与 `qie` 的 `linkedSectionLabel` 兜底，调用点 @2537631 / @2554637）
     · `chatAdapter.addMenu.plugins.noSearchResults`：en @3553449 / ja @3952137 / ko @4089278 / zh @4222700
       （`FCe` 市场列表空搜索结果，调用点 @352516）
     · `chatAdapter.addMenu.plugins.errors.listFailed`：同上四块（市场列表加载失败，调用点 @352066）
     · `chatAdapter.addMenu.plugins.installPlugin`：同上四块（卡片右上角 `$r` 的 aria-label / tooltip，调用点 @349631/@385416）
     · `chatAdapter.addMenu.plugins.byTapNow`：同上四块（分类兜底文案，调用点 @349631 / @347396 / @388083）
     · `chatAdapter.addMenu.skills.managePluginDialogTitle`：en @3557344 / ja @3954410 / ko @4091547 / zh @4225362
       （管理弹窗「应用」页签的 sr-only 标题，调用点 @409872） */
  'chatAdapter.context.addReference': 'Add reference',
  'chatAdapter.addMenu.plugins.noSearchResults': 'No matching Apps',
  'chatAdapter.addMenu.plugins.errors.listFailed': 'Failed to load apps',
  'chatAdapter.addMenu.plugins.installPlugin': 'Install App',
  'chatAdapter.addMenu.plugins.byTapNow': 'by TapNow',
  'chatAdapter.addMenu.skills.managePluginDialogTitle': 'Manage Apps',
  /* 官方新版「详细过程」(chatAdapter.progressDetails.*，新版 bundle @3582135/@4000281/@4140578 逐字) */
  'chatAdapter.progressDetails.title': 'Detailed progress',
  'chatAdapter.progressDetails.description': 'Keep activity steps and returned tool output visible.',
  'chatAdapter.progressDetails.summary': 'Result',
  'chatAdapter.progressDetails.output': 'Output',
  'chatAdapter.progressDetails.errors': 'Error output',
  'chatAdapter.progressDetails.file': 'File contents',
  'chatAdapter.progressDetails.truncated': 'Partial result — more data may remain. Continue reading or narrow the scope.',
};

export default enUS;
