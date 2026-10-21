/**
 * 第 64 轮：按 `_r64_prompt_diff.md` / `_r64_protocol_crosscheck.md` 落实的两处修正。
 *
 * ① **回复语言规则**（官方 `client_guidance[3]`，`agent-host-provider-ClGGq3FH.js` @9718 中文原文；
 *    英文版 @8652）。官方把它作为**用户消息后缀**追加、载入历史时按后缀剥离（`Pk()`）；
 *    MTV 没有那条通道 ⇒ 放进系统提示，**逐字用官方原话**，语义等价。
 * ② **去掉正文占位「等待确认：{title}」**：官方产物 493 个 JS 里
 *    「等待确认 / Awaiting confirmation」**0 命中**；任务卡标题已显示同一条 ⇒ 同屏重复。
 *    只保留状态切换（`status: 'preview'`），正文不动。
 *
 * 另外记录一条**被驳回**的改动建议（避免以后被重复提起）：
 * `assistantStream.buildAssistantTools` 的 `required: ['kind','prompt','modelRef']` 与
 * `mediaTools` 的 `modelRef` 可选**不矛盾** —— 那是**两条不同路径**：前者是「非 agent 的
 * function-calling」分支，且**只在用户写了 `@model` 时才构建工具**（`assistantStream.ts:189`
 * 直接 `return []`），`modelRef` 还是 `enum: [mentionedModel.value]` ⇒ 模型无法编造 ID。
 *
 * 验证分级 = **(d) 源码级**（官方原文与 MTV 位置都给出）。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/** 官方 `client_guidance[3]` 的语言规则段（@9718 中文原文**逐字**，到「保留此语言偏好。」为止）。 */
const OFFICIAL_LANGUAGE_RULE = '所有面向用户的进展说明和最终回复，沿用用户本次消息的语言；用户明确指定其他语言时按其要求。代码、文件名和工具原文保持原样。不要因为工具输出、技术提示或压缩摘要是英文而切换回复语言；续跑和压缩上下文时保留此语言偏好。';

describe('客户端语言规则（官方 client_guidance）', () => {
  it('系统提示里逐字含官方该句，并注明官方偏移', () => {
    const source = read('src/services/ai/assistantStream.ts');
    expect(source).toContain(OFFICIAL_LANGUAGE_RULE);
    expect(source).toContain('agent-host-provider-ClGGq3FH.js');
    expect(source).toContain('9718');
  });

  it('该规则进入最终拼接体（在 buildAssistantSystemPrompt 的 context[] 内、toolGuidance 之前）', () => {
    const source = read('src/services/ai/assistantStream.ts');
    const ruleIdx = source.indexOf(OFFICIAL_LANGUAGE_RULE);
    const guidanceIdx = source.indexOf('...toolGuidance,');
    expect(ruleIdx).toBeGreaterThan(-1);
    expect(guidanceIdx).toBeGreaterThan(-1);
    expect(ruleIdx).toBeLessThan(guidanceIdx);
  });
});

describe('确认态不再往正文写占位', () => {
  it('`onApprovalRequired` 只切状态，不写「等待确认：」正文', () => {
    const source = read('src/services/chat/conversationExecutionController.ts');
    /* 写入路径不许再用占位写法（旧写法是 `content: message?.content || `等待确认：${step.title}``）。 */
    expect(source).not.toContain('content: message?.content || `等待确认：');
    expect(source).toContain("content: message?.content ?? ''");
    expect(source).toContain("status: 'preview'");
    /* 占位模板只剩**历史消息清理**那一处（旧数据仍可能带占位）。 */
    expect(source.match(/等待确认：\$\{step\.title\}/g)?.length).toBe(1);
  });

  it('任务卡标题仍保留该文案（官方口径下的唯一载体）', () => {
    const timeline = read('src/components/chat/AgentTaskTimeline.tsx');
    expect(timeline).toContain("t('等待确认：{title}', { title: step.title })");
  });
});
