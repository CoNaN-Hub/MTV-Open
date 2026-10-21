/**
 * ko-KR 词条聚合：key 是源码里的中文原文，缺失时自动回落中文。
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

const koKR: Record<string, string> = {
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
  'common.favorite': '즐겨찾기',
  'library.folders.character': '캐릭터',
  'library.folders.scene': '씬',
  'library.folders.item': '아이템',
  'library.folders.style': '스타일',
  'library.folders.sound': '효과음',
  'library.folders.others': '기타',
  /* ── 官方 `Ub`（`@` 建议弹层）用到的点号 key（live bundle 逐字）──
     · `library.search`：canvas 词典 `library` 命名空间 @4180192（`title:"라이브러리",search:"검색"`）
     · `common.back` / `common.retry`：应用级 `index-DQjoOgEC.js` @612747（`ij={back:"뒤로",…,retry:"재시도"}`）
     · `elementLibrary.*`：官方词典只有 en/zh 两份，ko 缺失 ⇒ 按官方 fallbackLng 口径回落英文
       （与 `mentionStrings.ts` 里 `skills.*` / `skillOptions.*` 的 ko 取值同一处理）
     · `omniReference.suggestion.referenceCurrentFolder`：官方词典里**没有**该键，
       `Ub` 的 `C("…","Reference folder")` 直接回落英文兜底串 ⇒ 逐字 "Reference folder"。 */
  'library.search': '검색',
  'common.back': '뒤로',
  'common.retry': '재시도',
  'elementLibrary.errors.loadFailed': 'Could not load element details',
  'elementLibrary.mention.privateSection': 'Private elements',
  'elementLibrary.mention.teamSection': 'Team elements',
  'omniReference.suggestion.referenceCurrentFolder': 'Reference folder',
  /* ── 官方「生成确认模式」与「本地权限菜单」词条（官方点号 key）──
     官方词典：en 3521101/3561340 · ja 3927683 · ko 4064641 · zh 4201748/4227870（canvas chunk）。
     ⚠️ 官方 ja/ko 词典里**没有** `chatAdapter.localPermissionMenu.*` ⇒ 官方行为就是回退英文，这里同样落英文值。
     此前只有 zh-CN 落库，en/ja/ko 下这三颗控件（确认模式开关 + 菜单行 + 了解更多）会显示原始 key。 */
  'chatAdapter.confirmMode.auto': '자동실행',
  'chatAdapter.confirmMode.askTitle': '실행 전 확인',
  'chatAdapter.confirmMode.ask': '수동확인',
  'chatAdapter.confirmMode.autoDesc': 'TapNow가 승인 없이 작업을 진행합니다.',
  'chatAdapter.confirmMode.autoTitle': '확인 없이 실행',
  'chatAdapter.confirmMode.askDesc': 'TapNow가 일시 정지되어 각 작업을 승인할 수 있습니다.',
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
  'chatAdapter.generationConfirmation.autoModeTipMessage': '모든 생성 작업에서 Tapies가 자동 차감됩니다.',
  'chatAdapter.generationConfirmation.closeTip': '닫기',
  /* ── 官方「应用市场 / 插件域」点号 key（本轮「应用市场 · 插件域」补齐；取值逐字来自 live bundle）──
     官方词典：`chatAdapter.context.addReference` ko @4081106 ·
     `chatAdapter.addMenu.plugins.{noSearchResults,errors.listFailed,installPlugin,byTapNow}` ko @4088995/@4089278 ·
     `chatAdapter.addMenu.skills.managePluginDialogTitle` ko @4091547。 */
  'chatAdapter.context.addReference': '참조 추가',
  'chatAdapter.addMenu.plugins.noSearchResults': '일치하는 앱이 없습니다',
  'chatAdapter.addMenu.plugins.errors.listFailed': '앱을 불러오지 못했습니다',
  'chatAdapter.addMenu.plugins.installPlugin': '앱 설치',
  'chatAdapter.addMenu.plugins.byTapNow': 'TapNow 제공',
  'chatAdapter.addMenu.skills.managePluginDialogTitle': '앱 관리',
  /* 官方新版「详细过程」(chatAdapter.progressDetails.*，新版 bundle @3582135/@4000281/@4140578 逐字) */
  'chatAdapter.progressDetails.title': '상세 진행',
  'chatAdapter.progressDetails.description': '실행 단계와 도구 결과를 표시합니다.',
  'chatAdapter.progressDetails.summary': '결과',
  'chatAdapter.progressDetails.output': '출력',
  'chatAdapter.progressDetails.errors': '오류 출력',
  'chatAdapter.progressDetails.file': '파일 내용',
  'chatAdapter.progressDetails.truncated': '일부 결과입니다. 이어서 읽거나 범위를 좁히세요.',
};

export default koKR;
