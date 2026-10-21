/**
 * 媒体模型可用性判定 —— 原 `detachedChatSyncController.ts` 的唯一在用途函数。
 * （独立窗口/镜像同步层官方没有 ⇒ 已整体删除；本函数与窗口无关，故原样搬到这里。）
 */
import { useAppStore } from '../../store/useAppStore';
import type { ApiProviderConfig, GeneralModelConfig } from '../../types';
import type { MediaModelOption } from '../../components/nodes/shared/defaultModels';

export function getMediaModelAvailability(
  options: MediaModelOption[],
  generalModels: GeneralModelConfig[],
  providers: Record<string, ApiProviderConfig>,
  dreaminaLoggedIn: boolean,
): Record<string, boolean> {
  return Object.fromEntries(options.map((option) => {
    // ponytail: 工作流没有 API Key 可查，服务地址缺失由生成入口报错，这里只管「可选」
    if (option.workflowId && option.provider === 'workflow-api') {
      const manifest = useAppStore.getState().workflows.find((workflow) => workflow.id === option.workflowId)?.workflowApi;
      const connection = providers[option.providerConfigId ?? ''];
      return [option.value, !!connection?.baseUrl && (!!connection.apiKey || (manifest?.version === 2 && manifest.protocol.auth?.type === 'none'))];
    }
    if (option.workflowId) return [option.value, option.provider !== 'runninghubwf' || !!providers[option.providerConfigId ?? 'runninghub']?.apiKey];
    if (option.provider === 'general') {
      const generalModel = generalModels.find(
        (model) => `general/${model.id}` === option.value,
      );
      const provider = generalModel ? providers[generalModel.providerConfigId] : undefined;
      return [option.value, !!provider?.baseUrl && !!generalModel?.modelId];
    }
    if (option.provider === 'dreamina') {
      return [option.value, dreaminaLoggedIn];
    }
    const providerConfigId = option.groupId === 'runninghub'
      ? 'runninghub-model'
      : option.groupId;
    return [option.value, !!providers[providerConfigId]?.apiKey];
  }));
}
