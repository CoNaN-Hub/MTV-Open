/**
 * useMediaModelDisplayName —— 媒体查看器「信息面板」模型名的 React 取值入口
 *
 * 纯解析逻辑见 `utils/mediaModelDisplayName.ts`（官方 `fye` @443097 的 MTV 实现）。
 * 这里只负责把 `config.generalModels` / `config.providers` 取出来喂给纯函数
 * （自定义连接 `general/<id>` 的 value 里没有官方模型名，必须靠这两张表还原可读名）。
 */
import { useMemo } from 'react';

import { useAppStore } from '../store/useAppStore';
import { resolveMediaModelDisplayName } from '../utils/mediaModelDisplayName';

export function useMediaModelDisplayName(
  modelId: string | undefined,
  mediaType: 'image' | 'video',
): string | undefined {
  const generalModels = useAppStore((state) => state.config.generalModels);
  const providers = useAppStore((state) => state.config.providers);
  const family = mediaType === 'video' ? 'video' : 'image';
  return useMemo(
    () => resolveMediaModelDisplayName({ modelId, family, generalModels, providers }),
    [modelId, family, generalModels, providers],
  );
}
