/**
 * Agent 模型选择器里的官方「模型信息 + Effort 档位」飞出面板内容。
 *
 * 结构 = 官方 `Cu`/`bye`（`ModelInfoPanel`）+ 官方 `Ys`/`NR`（`ThinkingControl embedded`，见 `ChatThinkingPanel`）。
 * 官方在 `dbe` 里写的是：
 *   `<cbe model={B} notice={Sq(B)} thinkingModel={b} thinkingSettings={...} onThinkingChange={...} />`
 *   → `cbe` 里 `<bye model notice>{thinkingModel ? <NR embedded model={thinkingModel} settings onChange /> : null}</bye>`
 *
 * ## 数据来源（逐字取证，见 `services/chat/officialModelInfo.ts` 头注释）
 *
 * | 这一屏的字段 | 官方来源 |
 * |---|---|
 * | 模型名 | 官方 `zv(model, t)` = 官方模型标签（MTV 侧由 `ModelSelector` 的展示名出口给出） |
 * | 简介 | 官方 `` t(`chatAdapter.modelOptions.info.models.${key}.description`, fye[key].description) `` |
 * | 速度/智能/成本三行 | 官方 `gye(fye[key])` —— **客户端常量表 `fye`**，不是目录项的 `speed/intelligence/cost` |
 * | 思考强度 | 官方 `model.thinking`（**服务端目录字段**） |
 *
 * ⚠️ `thinking` 在官方只来自**模型目录项**；官方在服务端目录拿不到时的兜底目录 `Tq` 同样**没有**该字段
 *    （`{default,auto,items:[…]}`，见 canvas chunk @89679）⇒ **官方那时不画档位控件**。
 *    MTV 按用户决定在这里**偏离一次**：`resolveThinkingMetaForModel()` 在 `thinking` 缺失时返回
 *    官方逐字档位词汇表（`['low','medium','high','xhigh','extra_high','max']`，见
 *    `modelPickerStrings.ts` 的 `MODEL_LEVEL_CODES`）⇒ 控件**一定画得出来**、一定可调。
 *    逐字声明与代价见 `services/chat/configuredModelThinking.ts` 头注释（★ 唯一偏离 ★）。
 */
import { useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { getLocale } from '../../i18n';
import type { ModelOption } from '../../types';
import type { ModelCapabilityScores } from '../../types/chat';
import type { ModelFlyoutInfo } from '../nodes/shared/ModelSelector';
import { ModelInfoPanel } from './ModelPickerFlyout';
import { ThinkingControl } from './ChatThinkingPanel';
import {
  officialCapabilityEntries,
  officialModelInfoDescription,
} from '../../services/chat/officialModelInfo';
import { resolveThinkingMetaForModel } from '../../services/chat/configuredModelThinking';

export default function AgentModelFlyout({ model, info }: { model: ModelOption; info: ModelFlyoutInfo }) {
  const thinkingSettings = useAppStore((state) => state.chatModelThinkingSettings);
  const setChatModelThinkingSettings = useAppStore((state) => state.setChatModelThinkingSettings);
  const settings = thinkingSettings[model.value] ?? null;
  const locale = getLocale();

  /* 官方 `yye(model)` → `{key, copy}`；能力评分取 `copy.capabilities`（`gye` 过滤 1..5 整数）。 */
  const official = officialModelInfoDescription({ id: model.value, label: model.label }, locale);
  const capabilityScores: ModelCapabilityScores = model.capabilityScores
    ?? Object.fromEntries(
      officialCapabilityEntries(official.copy).map((entry) => [entry.capability, entry.value]),
    );

  /* 官方 `model.thinking`：只从模型目录项来。MTV 侧先看 `ModelOption.thinking`，
     再看用户连接目录里同 id 的条目（透传通道），**都没有时走官方逐字档位词汇表兜底**
     （★ 本工程唯一偏离官方处：官方此处 `return null`，见 `configuredModelThinking.ts` 头注释）。 */
  const thinking = resolveThinkingMetaForModel(model);

  const handleThinkingChange = useCallback(
    (next: { enabled: boolean; level?: string }) => {
      setChatModelThinkingSettings(model.value, next);
    },
    [model.value, setChatModelThinkingSettings],
  );

  return (
    <ModelInfoPanel
      displayName={info.displayName}
      description={official.description ?? info.description}
      capabilityScores={capabilityScores}
      locale={locale}
    >
      <ThinkingControl
        embedded
        model={{ id: model.value, thinking }}
        settings={settings}
        onChange={handleThinkingChange}
      />
    </ModelInfoPanel>
  );
}
