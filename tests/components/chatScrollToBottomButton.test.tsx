// @vitest-environment jsdom
/**
 * 聊天消息列表「回到底部」圆钮 —— 官方 `KR`（`vendor-packages-jvPqKqU8.js`，导出名 `ga`，
 * 在消息列表里以 `Qfe` 渲染）的 1:1 回归。
 *
 * 官方逐字（全部来自 live bundle，见 `officialIcons.OfficialArrowDownIcon` 的注释）：
 * ```js
 * KR=({className:e,...t})=>{const{isAtBottom:n,scrollToBottom:s}=kg();   // kg = use-stick-to-bottom 上下文
 *   return !n&&jsx(Button,{  // shadcn Button：variant="outline" size="icon"
 *     className: cx("absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full", e),
 *     onClick:()=>s(), size:"icon", type:"button", variant:"outline", ...t,
 *     children:jsx(ArrowDown,{className:"size-4"})})}
 * ```
 * 调用点（同 bundle 的消息列表根）：`jsx(Qfe,{className:cx("z-20", "bottom-[calc(var(--todo-queue-sheet-height-px,_0px)_+_1rem)]")})`
 * ⇒ 官方按钮：**36×36 圆钮 + 只有一颗 16px lucide `arrow-down`**，无文字、无未读数字。
 *
 * ⚠️ MTV 曾经是「`mdi:arrow-down` + 『最新消息』文字 + 未读数字」的自造胶囊 —— 本文件把它钉死为官方形态。
 * 验证分级 = **(b) jsdom 真 DOM（图标） + (d) 源码级（按钮 class 契约）**。
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OfficialArrowDownIcon } from '../../src/components/chat/officialIcons';

afterEach(cleanup);

/* 本文件跑在 jsdom（`import.meta.url` 不是 file: 协议），故用 vitest 的 cwd（= 仓库根）读源码。 */
function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const MESSAGES_SOURCE = readSource('src/components/chat/ChatMessages.tsx');

describe('官方 `KR`：聊天消息列表的回到底部圆钮', () => {
  it('图标 = lucide `arrow-down`，两条 path 与官方 `EAa` 逐字一致，默认 16px（`size-4`）', () => {
    const { container } = render(<OfficialArrowDownIcon size={16} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('class')).toBe('lucide lucide-arrow-down');
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');
    const paths = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d'));
    /* 官方 `EAa=[["path",{d:"M12 5v14"}],["path",{d:"m19 12-7 7-7-7"}]]` */
    expect(paths).toEqual(['M12 5v14', 'm19 12-7 7-7-7']);
  });

  it('按钮 = 官方 shadcn `Button variant="outline" size="icon"` 的类串 + 官方定位串', () => {
    /* 官方基类 `vr` 的 `variant.outline` / `size.icon`（逐字自 vendor-packages 的 `vr`）。 */
    for (const token of [
      'inline-flex', 'items-center', 'justify-center', 'rounded-full',
      'border', 'border-input', 'bg-background', 'shadow-sm',
      'hover:bg-accent', 'hover:text-accent-foreground',
      'h-9', 'w-9',
    ]) {
      expect(MESSAGES_SOURCE).toContain(token);
    }
    /* 官方定位：`absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full` + 调用点的
       `z-20` 与 `bottom-[calc(var(--todo-queue-sheet-height-px,_0px)_+_1rem)]`
       （MTV 侧同一语义的变量名是 `--queued-sheet-height-px`）。 */
    expect(MESSAGES_SOURCE).toContain('absolute left-[50%] z-20');
    expect(MESSAGES_SOURCE).toContain('translate-x-[-50%]');
    expect(MESSAGES_SOURCE).toContain('bottom-[calc(var(--queued-sheet-height-px,_0px)_+_1rem)]');
  });

  it('按钮里只有图标：不残留 MTV 自造的「最新消息」文字 / 未读数字 / mdi 图标', () => {
    const button = MESSAGES_SOURCE.slice(
      MESSAGES_SOURCE.indexOf('{!isNearBottom && ('),
      MESSAGES_SOURCE.indexOf('</div>', MESSAGES_SOURCE.indexOf('{!isNearBottom && (')),
    );
    expect(button).toContain('<OfficialArrowDownIcon size={16} />');
    expect(button).not.toContain('mdi:arrow-down');
    expect(button).not.toContain("t('最新消息')");
    expect(button).not.toContain('min-w-4');
    expect(button).not.toContain('99+');
  });
});
