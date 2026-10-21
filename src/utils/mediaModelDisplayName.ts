/**
 * mediaModelDisplayName —— 官方媒体查看器「信息面板」里**模型名**的解析口径（逐字）
 *
 * 官方出处（`course-api-base-url-CGXqZmAy.js`）：
 *   · `gye` @443285（信息面板装配）：
 *     ```js
 *     const i = fye(model, t)
 *     i && f.push({ label: t("imagePreview.model"), value: i, loading: !1 })
 *     ```
 *   · `fye` @443097（模型名查表）：
 *     ```js
 *     function fye(e, t) { const n = e?.trim(); if (!n) return; const s = q3(n); return s ? t(s) : n }
 *     ```
 *   ⇒ 两条口径：
 *     1. **模型为空 ⇒ `fye` 返回 `undefined` ⇒ 整条「模型」不渲染**（不是渲染空值）；
 *     2. **查表命中 ⇒ 用可读名；查不到 ⇒ 回落原文**（`return s ? t(s) : n` 的 `: n`）。
 *
 * ★ 2026 改：名称查表统一走 `services/models/display`（多平台接入 / 官方名称展示）。
 *   原来这里自己拼了两层（`officialCardMeta` → `modelDisplayOverride`）+ 一层剥前缀，
 *   现在全部交给**唯一**的展示名出口：
 *     · 平台映射（含官方身份 / 平台策划名）→ 官方 Registry → 原始调用 id
 *   ⇒ 与 `ModelSelector`、媒体信息面板、历史卡片**同源同函数**，不会再各显各的名字。
 *
 * ⚠️ 自定义连接（`general/<id>`）的 value 里没有官方模型名 ⇒ 出口内部按 `cfg.modelId`
 *    （上游真实模型名）+ 连接信息（`catalogId` / `baseUrl`）归一化，规则只有那一处。
 */
import { displayNameOfModelRef } from '../services/models/display';
import type { GeneralModelConfig } from '../types';

/** 官方 `q3` 的 MTV 等价物的输入（纯数据，便于单测） */
export interface MediaModelDisplayInput {
  /** 历史记录 / 节点数据里的模型 id（官方 `resource.model`） */
  modelId?: string | null;
  /** 官方按媒体族取模型表：image / video（展示名出口不按族分表，保留参数兼容旧调用） */
  family?: string | null;
  /** `config.generalModels`（用户自建通用模型） */
  generalModels?: readonly GeneralModelConfig[];
  /** `config.providers`（连接配置：`catalogId` / `baseUrl` 决定平台归属） */
  providers?: Record<string, { name?: string; catalogId?: string; baseUrl?: string } | undefined>;
}

/**
 * 官方 `fye(model, t)` 的 MTV 实现。
 * 空 ⇒ `undefined`（调用方据此**整条不渲染**）；查不到 ⇒ 原文。
 */
export function resolveMediaModelDisplayName({
  modelId,
  generalModels,
  providers,
}: MediaModelDisplayInput): string | undefined {
  const raw = (modelId ?? '').trim();
  if (!raw) return undefined;

  const name = displayNameOfModelRef(raw, {
    generalModels: generalModels as Array<{ id: string; modelId?: string; name?: string; providerConfigId?: string }> | undefined,
    providers: providers as Record<string, { name?: string; catalogId?: string; baseUrl?: string }> | undefined,
  });
  return name || raw;
}
