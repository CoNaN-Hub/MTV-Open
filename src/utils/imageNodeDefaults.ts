/**
 * imageNodeDefaults — **新图片卡的默认 比例/尺寸**（按模型给）
 *
 * 为什么要单独一个文件：`utils/imageModelCapabilities.ts` 是**纯表工具**（只依赖官方 JSON ✓），
 * 不引 store ✗；而自定义连接的模型值形如 `general/provider-custom-<hash>`，
 * **里面没有上游模型名** ✗ —— 必须去 `config.generalModels` 里按 id 找回 `modelId` / `name` 才能匹配官方表 ✓
 *   （与 `QualityRatioSelector` 收 `modelAliases` 是同一套口径 ✓）
 *
 * 规则与实测依据见 `imageModelCapabilities.imageNodeDefaultParams` 的注释 ✓
 */
import { useAppStore } from '../store/useAppStore';
import { imageNodeDefaultParams } from './imageModelCapabilities';

/** `general/provider-custom-<hash>` → `[value, 上游 modelId, 可读 name]`；非自定义值原样返回 */
export function imageModelAliases(modelValue?: string | null): string[] {
  if (!modelValue) return [];
  const keys: Array<string | undefined> = [modelValue];
  if (modelValue.startsWith('general/')) {
    try {
      const gmId = modelValue.replace(/^general\//, '');
      const gm = useAppStore.getState().config.generalModels?.find((m) => m.id === gmId);
      keys.push(gm?.modelId, gm?.name);
    } catch {
      /* store 还没就绪时退回只用 value 匹配 ✓（不编造 ✗） */
    }
  }
  return keys.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
}

/** 新图片卡的默认 比例/尺寸 —— 传**节点里会存的那个 model 值**即可 ✓ */
export function imageNodeDefaultParamsForModelValue(modelValue?: string | null): {
  aspectRatio: string;
  imageSize: string;
} {
  return imageNodeDefaultParams(imageModelAliases(modelValue));
}
