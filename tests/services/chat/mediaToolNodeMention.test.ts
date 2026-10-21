/**
 * 媒体生成工具必须把「新建卡片的提及原文」交给模型。
 *
 * 事故（用户 2026 对照官方截图）：
 *   官方回复正文里带节点芯片 ——「已在画布上提交一张 3:4 可爱小猫图，目前正在生成：🖼可爱的小猫」，
 *   MTV 的正文里**一个 chip 都没有**。芯片 = 正文里的 `@{nodeId:label}` 提及 token 渲染的
 *   （渲染链路见 `tests/components/nodeMentionChipOfficial.test.tsx`），而模型手上没有可抄的 token。
 *
 * ⚠️ 我第一次只把 `mention` 加到了 `canvas_create_nodes`，结果**没生效**：对话生图走的是
 *   `media_generate`（它自己 `createMediaPlaceholder` 建占位节点），不是 `canvas_create_nodes`。
 *   这条测试把**三条会建节点的工具链**全部钉住，防止再漏。
 *
 * ⚠️ 这里断言的是**源码契约**而不是跑一次真生成：成功路径要真网络 + 落盘
 *   （`runMediaGeneration`），jsdom 里驱动不了。仓里同类「源码契约」测试有先例
 *   （`tests/components/videoInputBarFrameRow129.test.tsx`）。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');

const MEDIA = read('src/services/chat/tools/mediaTools.ts');
const COMFY = read('src/services/chat/tools/comfyTools.ts');
const CANVAS = read('src/services/chat/tools/canvasTools.ts');

describe('建节点/生成媒体工具 → 返回里带 `mention`', () => {
  it('`media_generate`（对话生图的实际链路）返回 `mention`', () => {
    expect(MEDIA).toContain('mention: `@{${targetNodeId}:${encodeURIComponent(String(');
    /* 占位卡不在了（`nodeCreated === false`）就不给 —— 那条 chip 点不开 */
    expect(MEDIA).toContain('...(targetNodeId && nodeCreated');
  });

  it('`comfyui_*`（ComfyUI 出图）返回 `mention`', () => {
    expect(COMFY).toContain('mention: `@{${targetNodeId}:${encodeURIComponent(String(');
  });

  it('`canvas_create_nodes` 返回 `mention`', () => {
    expect(CANVAS).toContain("mention: `@{${node.id}:${encodeURIComponent(String(node.data.label ?? ''))}}`");
  });

  it('三个工具的描述里都点名让模型**直接复制**该字段（不然模型不会用）', () => {
    expect(MEDIA).toContain('直接复制该字段');
    expect(CANVAS).toContain('直接复制返回结果里该节点的 mention 字段');
  });

  it('编码方式与 `store.ui.ts` 的提及写法一致（`ChatReferenceText.decodeLabel` 严格往返）', () => {
    /* 标签必须 URL 编码：`{}`/`:` 会破坏 `@{id:label}` 的 token 边界 */
    for (const src of [MEDIA, COMFY, CANVAS]) {
      expect(src).toMatch(/@\{\$\{[^}]*\}:\$\{encodeURIComponent\(/);
    }
  });
});
