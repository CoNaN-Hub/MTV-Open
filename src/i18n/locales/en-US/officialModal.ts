/**
 * 官方「通用对话框」（`ea`）相关词条 —— en-US。
 *
 * key = 源码里的**中文原文**（MTV i18n 约定），值是**官方 en-US 包的原文**（逐字）。
 * 官方出处：`E:\TapNow-0.4.66\resources\web\assets\index-BiTZf8mJ.js`
 *   · `common.runAll`            @char8512334 = "Run Group"
 *   · `workflow.groupRunConfirmation.*` @char8591123
 *   · `workflow.imageInputInvalid`      @char8592053
 * ⚠️ 占位符：官方 i18next 用 `{{amount}}`，MTV 用 `{amount}` ⇒ 这里按 MTV 语法写。
 */
const officialModal = {
  // ── 整组执行确认（官方 `workflow.groupRunConfirmation`）──
  '运行整组？': 'Run group?',
  '正在预估本次执行花费...': 'Estimating this run...',
  '本次执行预计花费约 {amount} Tapies。': 'This run is estimated to cost about {amount} Tapies.',
  '本次执行暂时无法预估花费。': "The cost of this run can't be estimated right now.",
  '部分图片节点的参考图输入不受当前模型支持。': 'Some image nodes have unsupported reference inputs.',
  // ── 官方 `common.runAll`（分组工具条上的按钮文案）──
  '整组执行': 'Run Group',
};

export default officialModal;
