/**
 * 「模型映射」页 —— 厂商筛选下拉的选项（纯函数）。
 *
 * 为什么单独一个 `.ts`：`react-refresh/only-export-components` 是提交门禁，组件文件只能导出组件
 * （同目录的 `apiKeySettingsUtils.ts` / `modelProtocolTestRun.ts` 都是这个原因）。
 *
 * ★ 数据源 = 有映射数据的 `providerId` 集合（`rows` ← `listMappingRows()`），**再过一层**
 *   `isProviderSelectable()` —— 已下架的厂商从「新建连接」的选择框和这里**一起**消失。
 *   下架名单与判定**只有一份**，落在 `services/ai/providerCatalogService`
 *   （`HIDDEN_FROM_PROVIDER_PICKER_IDS` + `isProviderSelectable`）；本文件不持有名单、不复制常量。
 *
 * ⚠️ 只决定**下拉里显示什么**：调用方给的 `providerIds` 是只读输入，数据层（`rows`）不受影响 ——
 *    已下架厂商的映射数据仍然完整保留、仍然参与解析与调用，只是不再出现在筛选下拉里。
 */
import { isProviderSelectable } from '../../services/ai/providerCatalogService';

export function providerFilterOptions(providerIds: readonly string[]): string[] {
  return [...new Set(providerIds)].filter(isProviderSelectable).sort();
}
