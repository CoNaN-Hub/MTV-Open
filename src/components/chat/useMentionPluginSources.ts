/**
 * `useMentionPluginSources` —— 把 MTV 的「已安装应用」（`store.plugins.ts` 的 `installedPlugins`）
 * 适配成官方 `Ub` 的「应用」分组行数据（`componentProps.plugins`，见
 * `services/chat/mentionPlugins.ts`）。
 *
 * 用法（官方 `MessageInputAreaV2` 的接线口径，canvas @2537631）：
 * ```tsx
 * const plugins = useMentionPluginSources();
 * <ChatMentionInput ... mentionPlugins={plugins} />
 * ```
 * ⚠️ 单独成文件的原因：只有真正要显示应用分组的宿主才需要拉 store
 * （官方 `qie` 的 `showPlugins` 是 `!1`，即 `AskQuestionSheet` 的自由文本输入**没有**应用分组）；
 * 把它放进 `ChatMentionInput` 会让所有调用方（含 jsdom 测试）都被迫加载 store 与其 Tauri / IndexedDB 依赖。
 */
import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  mentionPluginSourcesFromInstalled,
  type MentionPluginSource,
} from '../../services/chat/mentionPlugins';

export function useMentionPluginSources(): MentionPluginSource[] {
  const installedPlugins = useAppStore((state) => state.installedPlugins);
  return useMemo(() => mentionPluginSourcesFromInstalled(installedPlugins), [installedPlugins]);
}

export default useMentionPluginSources;
