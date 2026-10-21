/**
 * 官方「节点搜索」面板（`Vxe` / 竖条入口 `Hxe`）词条 —— en-US。
 *
 * 官方出处：`E:\TapNow-0.4.66\resources\web\assets\index-BiTZf8mJ.js`
 *   · 资源表 `nodeSearch`（en）@char8511086：
 *     `{filters:{audio:"Audio",text:"Text",all:"All",group:"Group",video:"Video",image:"Image"},
 *       clear:"Clear",title:"Node search",noResults:"No matching nodes",
 *       description:"Search canvas nodes by title, prompt, or text.",
 *       empty:"No searchable nodes",noPrompt:"No prompt",placeholder:"Search nodes..."}`
 *
 * key = 官方 **zh 词典的原文**（MTV i18n 约定，见同目录 `officialModal.ts` 的同一套做法）；
 * 官方 zh 原文：title「节点搜索」· description「按标题、Prompt 或文本搜索画布节点。」
 *   · placeholder「搜索节点...」· clear「清除」· noResults「未找到匹配节点」
 *   · empty「暂无可搜索节点」· noPrompt「无 Prompt」
 *   · filters：all「全部」/ image「图片」/ video「视频」/ text「文本」/ audio「音频」/ group「分组」
 * ⚠️ `world` 项官方 **各语言词典里都没有词条** ⇒ 组件走 fallback 字面量 `World`，
 *    所以 MTV 侧也不给「World」建词条（各语言一律原样显示 `World`）✓
 */
const nodeSearch = {
  // ── 面板标题 / 说明 / 输入框 / 清除键 ──
  '节点搜索': 'Node search',
  '按标题、Prompt 或文本搜索画布节点。': 'Search canvas nodes by title, prompt, or text.',
  '搜索节点...': 'Search nodes...',
  '清除': 'Clear',
  // ── 空态与副标题 ──
  '未找到匹配节点': 'No matching nodes',
  '暂无可搜索节点': 'No searchable nodes',
  '无 Prompt': 'No prompt',
  // ── 筛选条（官方 `Axe`）──
  '全部': 'All',
  '图片': 'Image',
  '视频': 'Video',
  '文本': 'Text',
  '音频': 'Audio',
  '分组': 'Group',
};

export default nodeSearch;
