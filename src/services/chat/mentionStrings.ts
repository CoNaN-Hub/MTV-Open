/**
 * mentionStrings —— 官方 `omniReference.*` 文案表（`vendor-pkg-canvas-ChpWx5JY.js` 逐字抽取）。
 *
 * 官方位置（同一个命名空间对象，6 个语言各一份）：
 *   enUS@3631952 · frFR@3828573 · jaJP@3995788 · koKR@4132969 · zhTW@4267472 · zhCN@4267602
 * MTV 只保留自有的 4 个语言（en/ja/ko/zh-CN），与 `agentEventStrings.ts` 口径一致。
 *
 * ⚠️ 该命名空间**不只**是建议弹层文案：`Ub` 用到的 12 个 `suggestion.*` 叶子键之外，
 * 还含 `assetLimitExceeded.*`（参考资产超限提示）、`skills.*`、`chip.removeAriaLabel`
 * 与 `skillOptions.{speed,cam,shot}.*`（指令/镜头/速度技能名）。整块逐字保留，避免二次拼接出错。
 */
export const MENTION_STRINGS: Record<string, Record<string, unknown>> = {
  enUS: {assetLimitExceeded:{audio:"Only the first {{count}} audio reference will be recognized by this model.",video:"Only the first {{count}} video reference will be recognized by this model.",image:"Only the first {{count}} image reference will be recognized by this model."},skills:{duration:"Duration",cameraShot:"Camera shot",speedRamp:"Speed ramp",cameraMovement:"Camera movement"},chip:{removeAriaLabel:"Remove reference"},skillOptions:{speed:{gradual_acceleration:"Gradual acceleration",slow_motion:"Slow motion",auto:"Auto",flash_out:"Flash out",bullet_time:"Bullet time",hero_moment:"Hero moment",flash_in:"Flash in"},cam:{push:"Push in",pan_left:"Pan left",drone_aerial:"Drone aerial",truck_right:"Truck right",handheld:"Handheld",dolly_in:"Dolly in",truck_left:"Truck left",follow:"Follow shot",pan_right:"Pan right",static:"Static",tilt_up:"Tilt up",tilt_down:"Tilt down",orbit:"Orbit",crane_up:"Crane up",pull:"Pull out",rotate_360:"360° rotation",crane_down:"Crane down",dolly_out:"Dolly out"},shot:{medium:"Medium shot",over_shoulder:"Over-the-shoulder",extreme_wide:"Extreme wide",full:"Full shot",closeUp:"Close-up",medium_closeUp:"Medium close-up",first_person:"First-person POV"}},mentionUnavailableMode:"@ is only available in {{mode}} mode",mentionUnavailableModel:"@ is not supported by this model",suggestion:{packageDrilldown:{noNodes:"No nodes in this package"},teamSection:"Team library",noResults:"No results",showMoreResults:"{{count}} more results",linkedNodeSection:"Linked node",linkedNodeShortcutHint:"Type a number to select",directionSection:"Direction",myLibrarySection:"My library",pluginSection:"Apps",categoryDrilldown:{noAssets:"No assets in this category"},privateSection:"Private library",noMatchingAssetsInLibrary:"No matching assets in library"}},
  jaJP: {assetLimitExceeded:{audio:"このモデルは先頭 {{count}} 件の音声参照のみを認識します。",video:"このモデルは先頭 {{count}} 件の動画参照のみを認識します。",image:"このモデルは先頭 {{count}} 件の画像参照のみを認識します。"},skills:{duration:"Duration",cameraShot:"Camera shot",speedRamp:"Speed ramp",cameraMovement:"Camera movement"},chip:{removeAriaLabel:"参照を削除"},skillOptions:{speed:{gradual_acceleration:"Gradual acceleration",slow_motion:"Slow motion",auto:"Auto",flash_out:"Flash out",bullet_time:"Bullet time",hero_moment:"Hero moment",flash_in:"Flash in"},cam:{push:"Push in",pan_left:"Pan left",drone_aerial:"Drone aerial",truck_right:"Truck right",handheld:"Handheld",dolly_in:"Dolly in",truck_left:"Truck left",follow:"Follow shot",pan_right:"Pan right",static:"Static",tilt_up:"Tilt up",tilt_down:"Tilt down",orbit:"Orbit",crane_up:"Crane up",pull:"Pull out",rotate_360:"360° rotation",crane_down:"Crane down",dolly_out:"Dolly out"},shot:{medium:"Medium shot",over_shoulder:"Over-the-shoulder",extreme_wide:"Extreme wide",full:"Full shot",closeUp:"Close-up",medium_closeUp:"Medium close-up",first_person:"First-person POV"}},mentionUnavailableMode:"@ は{{mode}}モードでのみ利用可能です",mentionUnavailableModel:"このモデルは @ をサポートしていません",suggestion:{packageDrilldown:{noNodes:"このパッケージにノードがありません"},teamSection:"チームライブラリ",noResults:"結果なし",showMoreResults:"さらに {{count}} 件",linkedNodeSection:"リンクノード",linkedNodeShortcutHint:"番号でクイック選択",directionSection:"Direction",myLibrarySection:"マイライブラリ",pluginSection:"アプリ",categoryDrilldown:{noAssets:"このカテゴリにアセットがありません"},privateSection:"プライベート要素",noMatchingAssetsInLibrary:"ライブラリに一致するアセットがありません"}},
  koKR: {assetLimitExceeded:{audio:"이 모델은 처음 {{count}}개의 오디오 참조만 인식합니다.",video:"이 모델은 처음 {{count}}개의 비디오 참조만 인식합니다.",image:"이 모델은 처음 {{count}}개의 이미지 참조만 인식합니다."},skills:{duration:"Duration",cameraShot:"Camera shot",speedRamp:"Speed ramp",cameraMovement:"Camera movement"},chip:{removeAriaLabel:"참조 제거"},skillOptions:{speed:{gradual_acceleration:"Gradual acceleration",slow_motion:"Slow motion",auto:"Auto",flash_out:"Flash out",bullet_time:"Bullet time",hero_moment:"Hero moment",flash_in:"Flash in"},cam:{push:"Push in",pan_left:"Pan left",drone_aerial:"Drone aerial",truck_right:"Truck right",handheld:"Handheld",dolly_in:"Dolly in",truck_left:"Truck left",follow:"Follow shot",pan_right:"Pan right",static:"Static",tilt_up:"Tilt up",tilt_down:"Tilt down",orbit:"Orbit",crane_up:"Crane up",pull:"Pull out",rotate_360:"360° rotation",crane_down:"Crane down",dolly_out:"Dolly out"},shot:{medium:"Medium shot",over_shoulder:"Over-the-shoulder",extreme_wide:"Extreme wide",full:"Full shot",closeUp:"Close-up",medium_closeUp:"Medium close-up",first_person:"First-person POV"}},mentionUnavailableMode:"{{mode}} 모드에서만 @ 사용 가능",mentionUnavailableModel:"이 모델은 @를 지원하지 않습니다",suggestion:{packageDrilldown:{noNodes:"이 패키지에 노드가 없습니다"},teamSection:"팀 라이브러리",noResults:"결과 없음",showMoreResults:"{{count}}개 더 보기",linkedNodeSection:"연결된 노드",linkedNodeShortcutHint:"번호로 빠른 선택",directionSection:"Direction",myLibrarySection:"내 라이브러리",pluginSection:"앱",categoryDrilldown:{noAssets:"이 카테고리에 에셋이 없습니다"},privateSection:"비공개 요소",noMatchingAssetsInLibrary:"라이브러리에 일치하는 에셋이 없습니다"}},
  zhCN: {assetLimitExceeded:{audio:"此模型将仅识别前 {{count}} 个音频引用。",video:"此模型将仅识别前 {{count}} 个视频引用。",image:"此模型将仅识别前 {{count}} 个图片引用。"},skills:{duration:"时间",cameraShot:"镜头",speedRamp:"速度",cameraMovement:"运镜"},chip:{removeAriaLabel:"移除引用"},skillOptions:{speed:{gradual_acceleration:"逐渐加速",slow_motion:"慢动作",auto:"自动",flash_out:"闪出",bullet_time:"子弹时间",hero_moment:"英雄时刻",flash_in:"闪入"},cam:{push:"推镜头",pan_left:"向左平摇",drone_aerial:"无人机航拍",truck_right:"向右平移",handheld:"手持",dolly_in:"向前推进",truck_left:"向左平移",follow:"跟随镜头",pan_right:"向右平摇",static:"静止",tilt_up:"向上垂直摇",tilt_down:"向下垂直摇",orbit:"环绕镜头",crane_up:"摇臂上升",pull:"拉镜头",rotate_360:"360度旋转",crane_down:"摇臂下降",dolly_out:"向后拉远"},shot:{medium:"中景",over_shoulder:"过肩镜头",extreme_wide:"大远景",full:"全景",closeUp:"特写",medium_closeUp:"近景",first_person:"第一人称视角"}},mentionUnavailableMode:"@ 仅在{{mode}}模式下可用",mentionUnavailableModel:"当前模型不支持 @",suggestion:{packageDrilldown:{noNodes:"该资产包内暂无节点"},teamSection:"团队素材库",noResults:"暂无结果",showMoreResults:"还有 {{count}} 个结果",linkedNodeSection:"已连接节点",linkedNodeShortcutHint:"输入序号快选",directionSection:"指令",myLibrarySection:"我的素材库",pluginSection:"应用",categoryDrilldown:{noAssets:"该分类下暂无资产"},privateSection:"个人素材库",noMatchingAssetsInLibrary:"资产库中未找到匹配资产"}},
};

/** MTV `Locale` → 本表键。（与 `agentEventStrings.ts` 同一套映射。） */
const LOCALE_TABLE_KEY: Record<string, string> = {
  'zh-CN': 'zhCN', zhCN: 'zhCN', zh: 'zhCN',
  'en-US': 'enUS', enUS: 'enUS', en: 'enUS',
  'ja-JP': 'jaJP', jaJP: 'jaJP', ja: 'jaJP',
  'ko-KR': 'koKR', koKR: 'koKR', ko: 'koKR',
};

/** 官方 i18n 的 `{{name}}` 插值（官方 `C(key, {count})` 的第二参即是它）。 */
export function interpolateMentionString(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (
    params[key] === undefined || params[key] === null ? match : String(params[key])
  ));
}

export interface MentionStringOptions {
  /** MTV 语言（`'zh-CN'` 等）。 */
  locale?: string;
  /** 官方 `C(key, {count})` 的插值参数。 */
  params?: Record<string, string | number>;
  /** 官方 `C(key, "fallback")` 的第二参：命中不到时用它。 */
  fallback?: string;
}

/**
 * 取官方 `omniReference.<path>`（支持 `a.b.c` 路径；`omniReference.` 前缀可带可不带，
 * 与 `agentEventStrings.ts` 的「相对命名空间根」口径一致）。
 * 命中顺序与官方一致：当前语言 → 英文 → 调用方 `fallback` → 原样返回 `path`。
 */
export function mentionString(path: string, options: MentionStringOptions = {}): string {
  const { locale = 'zh-CN', params, fallback } = options;
  const relative = path.startsWith('omniReference.') ? path.slice('omniReference.'.length) : path;
  const read = (table: Record<string, unknown> | undefined): string | null => {
    let node: unknown = table;
    for (const part of relative.split('.')) {
      if (!node || typeof node !== 'object') return null;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === 'string' ? node : null;
  };
  const key = LOCALE_TABLE_KEY[locale] ?? 'zhCN';
  const text = read(MENTION_STRINGS[key]) ?? read(MENTION_STRINGS.enUS) ?? fallback ?? path;
  return interpolateMentionString(text, params);
}
