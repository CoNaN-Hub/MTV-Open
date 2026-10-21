/**
 * 输入区「官方对齐」源码守卫
 *
 * 背景（官方 ground truth，见 D:\DEEPSEEK\tapnow-agent-panel-ground-truth.md）：
 *   · 官方**有**「停止生成」：`size-8 rounded-full bg-foreground/15 text-foreground
 *     hover:bg-foreground/25 transition-all disabled:opacity-45`，图标 14px 实心方块，
 *     tooltip `chatAdapter.tooltips.stop`，且与发送键**二选一**。
 *   · 官方**没有**「中断 / 调整当前任务」：`interject` 在官方全树 0 命中。
 *
 * 这两条都属于「对齐官方」的硬约束，用源码断言锁住，避免回退。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

describe('输入区官方对齐', () => {
  it('存在官方样式的停止生成按钮，并与发送键二选一', () => {
    const source = read('src/components/chat/ChatInput.tsx');
    expect(source).toContain('bg-foreground/15 text-foreground hover:bg-foreground/25');
    expect(source).toContain('disabled:cursor-not-allowed disabled:opacity-45');
    /* 官方图标：14px、fill=currentColor、无描边 */
    expect(source).toContain('icon="lucide:square" width={14} height={14}');
    expect(source).toContain("t('停止')");
    /* 二选一：`hasActiveTask && onStopTask && !disabled ? <停止> : <发送>` */
    expect(source).toContain('hasActiveTask && onStopTask && !disabled');
  });

  it('已移除非官方的「中断 / 调整任务」入口', () => {
    for (const file of ['src/components/chat/ChatInput.tsx', 'src/components/chat/ChatPanel.tsx']) {
      const source = read(file);
      expect(source).not.toContain('onInterject');
      expect(source).not.toContain('git-branch-plus');
    }
  });
});
