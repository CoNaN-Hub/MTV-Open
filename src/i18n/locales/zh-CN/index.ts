/**
 * zh-CN 词条（**官方词典路径**，非中文原文 key）。
 *
 * 为什么需要它：MTV 的 i18n 以中文原文为 key（zh 无字典），但官方 `chatAdapter.confirmMode.*`
 * 里存在**中文相同、其它语言不同**的键对（`confirmMode.ask` = 手动确认 / `askTitle` = 手动确认，
 * 而 en 是 "Ask" / "Ask before acting"）。要在 4 种语言下都逐字等于官方词典，只能用官方键路径。
 * 取值：官方产物 `index-*.js` 词典 `zh` 表**逐字**。
 */
const zhCN: Record<string, string> = {
  'chatAdapter.confirmMode.ask': '手动确认',
  'chatAdapter.confirmMode.askTitle': '手动确认',
  'chatAdapter.confirmMode.askDesc': 'Agent在执行生成前都会寻求您的确认',
  'chatAdapter.confirmMode.auto': '自动生成',
  'chatAdapter.confirmMode.autoTitle': '自动生成',
  'chatAdapter.confirmMode.autoDesc': 'Agent会自主规划生成任务并自动执行',
  'chatAdapter.localPermissionMenu.alwaysConfirmDescription': '生图、生视频和所有本地文件/目录操作均需每次确认。',
  'chatAdapter.localPermissionMenu.autoExceptDeleteDescription': '已挂载范围内生成与安全本地操作可自动执行；删除仍需确认。',
  'chatAdapter.localPermissionMenu.learnMore': '了解更多',
  /* ── 官方「素材库文件夹名」词条（官方 U1 走的点号 key）──
     官方 U1(name, t)（canvas @200033）：favorites→common.favorite、character/scene/item/style/sound
     → library.folders.*；eD(path, t) 按 / 分段调用。官方词典逐字：
     en@3691195 / ja@4040982 / ko@4178802 / zh@4304951（common.favorite：en@3621789 / ja@3988001 / ko@4125128 / zh index@840543）。
     library.folders.others 官方词典里有、但 U1 不映射，这里一并落库以保持命名空间完整。 */
  'common.favorite': '收藏',
  'library.folders.character': '角色',
  'library.folders.scene': '场景',
  'library.folders.item': '道具',
  'library.folders.style': '风格',
  'library.folders.sound': '音效',
  'library.folders.others': '其他',
  /* ── 官方 `Ub`（`@` 建议弹层）用到的点号 key（live bundle 逐字）──
     · `library.search`：canvas 词典 `library` 命名空间 @4306199（`title:"素材库",search:"搜索"`）
     · `common.back` / `common.retry`：应用级 `index-DQjoOgEC.js` @712620（`zA={back:"返回",…,retry:"重试"}`）
     · `elementLibrary.*`：canvas @4256550 / `index-DQjoOgEC.js` @836223（`mention:{teamSection:"团队主体",privateSection:"个人主体"}`、`errors.loadFailed:"主体详情加载失败"`）
     · `omniReference.suggestion.referenceCurrentFolder`：官方词典里**没有**该键，
       `Ub` 的 `C("…","Reference folder")` 直接回落英文兜底串 ⇒ 中文也用 "Reference folder"（逐字）。 */
  'library.search': '搜索',
  'common.back': '返回',
  'common.retry': '重试',
  'elementLibrary.errors.loadFailed': '主体详情加载失败',
  'elementLibrary.mention.privateSection': '个人主体',
  'elementLibrary.mention.teamSection': '团队主体',
  'omniReference.suggestion.referenceCurrentFolder': 'Reference folder',
  /* ── 官方「自动生成模式提示条」词条（官方点号 key，`tae`(`GenerationAutoModeTip`) 用）──
     官方词典（canvas chunk `vendor-pkg-canvas-ChpWx5JY.js`）：
     · `chatAdapter.generationConfirmation.autoModeTipMessage`：en @3513465 / fr @3714830 /
       ja @3922010 / ko @4058933 / zh @4196603
     · `chatAdapter.generationConfirmation.closeTip`：en @3513370 / fr @3714731 /
       ja @3921935 / ko @4058858 / zh @4196529
     此前四语言**都没有**这两个 key 落库 ⇒ 提示条会显示原始 key。 */
  'chatAdapter.generationConfirmation.autoModeTipMessage': '自动生成模式下，所有生成任务将自动扣除 Tapies。',
  'chatAdapter.generationConfirmation.closeTip': '关闭',
  /* ── 官方「fork」词条（官方点号 key，`JV`(@2583040) 与 `Xrt`(@2581826) 用）──
     官方词典（`vendor-pkg-canvas-ChpWx5JY.js`，四语言各自成块）：
     · `chatAdapter.fork.fromConversation`：en @3565668 / ja @3959473 / ko @4096662 / zh @4229891
     · `chatAdapter.fork.viewPreviousHistory`：en @3565510 / ja @3959364 / ko @4096555 / zh @4229795
     · `chatAdapter.fork.hidePreviousHistory`：en @3565587 / ja @3959418 / ko @4096618 / zh @4229827
     调用点默认值分别是 `"Continued from chat"` / `"View previous history"` / `"Hide previous history"`。 */
  'chatAdapter.fork.fromConversation': '延续自原对话',
  'chatAdapter.fork.viewPreviousHistory': '查看之前的历史',
  'chatAdapter.fork.hidePreviousHistory': '收起之前的历史',
  /* ── 官方「应用市场 / 插件域」点号 key（本轮「应用市场 · 插件域」补齐；取值逐字来自 live bundle）──
     官方词典 `zh` 块：`chatAdapter.context.addReference` @4215846 ·
     `chatAdapter.addMenu.plugins.{noSearchResults,errors.listFailed,installPlugin,byTapNow}` @4222700 ·
     `chatAdapter.addMenu.skills.managePluginDialogTitle` @4225362。 */
  'chatAdapter.context.addReference': '添加参考',
  'chatAdapter.addMenu.plugins.noSearchResults': '没有匹配的应用',
  'chatAdapter.addMenu.plugins.errors.listFailed': '应用加载失败',
  'chatAdapter.addMenu.plugins.installPlugin': '安装应用',
  'chatAdapter.addMenu.plugins.byTapNow': '由 TapNow 提供',
  'chatAdapter.addMenu.skills.managePluginDialogTitle': '管理应用',
  /* ── 官方**新版**「详细过程」(`progressDetails`) 词条（第 61 轮；新版 bundle `vendor-pkg-canvas-CvbAwZyy.js` @4281546 逐字）──
     这是官方 2026-10 线上构建新增的能力：工具行下方展示「结果 / 输出 / 错误输出 / 文件内容」。
     zh 取值逐字：title 详细过程 · description 保留执行步骤，展示工具已返回的结果。 ·
     summary 结果 · output 输出 · errors 错误输出 · file 文件内容 · truncated 当前为部分结果，可能还有未读取的内容。可继续读取，或缩小范围。 */
  'chatAdapter.progressDetails.title': '详细过程',
  'chatAdapter.progressDetails.description': '保留执行步骤，展示工具已返回的结果。',
  'chatAdapter.progressDetails.summary': '结果',
  'chatAdapter.progressDetails.output': '输出',
  'chatAdapter.progressDetails.errors': '错误输出',
  'chatAdapter.progressDetails.file': '文件内容',
  'chatAdapter.progressDetails.truncated': '当前为部分结果，可能还有未读取的内容。可继续读取，或缩小范围。',
  /* ── 「设置 → 模型映射」展开编辑区里两个**英文原文 key** 的中文注解（用户 2026 要求）──
     面板里这两个字段名以英文原文为 key（`ModelMappingSettings.tsx` @972/@982），
     按「中文原文为 key」的常规，zh 会**原样回落英文**（这正是用户看到的「两个纯英文」）。
     ⇒ 这里给 zh 补上「英文原名 + 中文注解」，英文原名保留在前、注解在后：
       · `Canonical ID` = 该平台模型归属的**官方规范模型身份**（`canonicalId`，小写 `vendor/slug`，
         内部稳定标识，≠ 展示名 ≠ Provider 调用 id）—— 见 `src/services/models/types.ts:39`；
       · `Display Name` = **产品界面唯一的主展示名**（`displayName`）—— 见
         `src/services/models/types.ts:11` 硬规则 1 / `src/services/models/normalize.ts:85`。
     en/ja/ko 的同名注解各自落在 `locales/<lang>/settings.ts` 对应词条里。 */
  'Canonical ID': 'Canonical ID（规范模型 ID，内部标识）',
  'Display Name': 'Display Name（显示名，界面唯一展示名）',
};

export default zhCN;
