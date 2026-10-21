/**
 * **宸ュ叿鍐呴儴瀛愭楠?*锛坄AgentToolContext.reportStep`锛夌殑鐪熷疄钀界洏绾緥銆? *
 * 鑳屾櫙锛氬畼鏂归偅鍑犺銆岀‘璁ゅ綋鍓嶅彲鐢ㄧ殑鍥惧儚鐢熸垚閫夐」 / 纭绔栧箙鐢婚潰鍜屽浘鍍忓昂瀵搁€夐」 / 鎻愪氦鈥﹀浘鍍忕敓鎴愩€? * 鍦ㄥ畼鏂规槸**鏈嶅姟绔?*鍒嗗埆鍙戝嚭鐨勭嫭绔?`tool_event`锛屽鎴风鍙寜 `content.tool` 鍒嗘《娓叉煋
 * 锛坄live-assets\vendor-pkg-canvas-ChpWx5JY.js` @2394514 `jE`銆丂2394546 `PF`銆丂2394689 `nie`锛? * 褰撳墠浜х墿 `live-assets-new\vendor-pkg-canvas-CvbAwZyy.js` @2433961 `sk`銆丂2433993 `CO`銆丂2434136 `Cae`锛夈€? * MTV 娌℃湁鏈嶅姟绔?鈬?鐢?MTV **鐜版湁 step 鏈哄埗**绛変环琛ㄨ揪锛堝畼鏂规湭寤烘ā璇ュ舰鎬侊級銆? *
 * 鏈枃浠堕拤浣忕殑鏄€岀瓑浠疯〃杈俱€嶅繀椤婚伒瀹堢殑涓夋潯鐪熷疄绾緥锛? *   鈶?鏃堕棿鎴崇湡瀹炰笖鍗曡皟锛坄createdAt` = 涓婃姤閭ｄ竴鍒伙紝`finishedAt` = 鏀跺熬閭ｄ竴鍒伙級锛? *   鈶?鐘舵€佺湡瀹炴帹杩涳紙running 鈫?succeeded / failed / stopped锛夛紱
 *   鈶?`callId` 涓庣埗姝ラ**涓嶅悓** 鈥斺€?瀹樻柟 `oie`锛坄agentToolLabels.dedupeByCallId`锛夋寜 id 鍘婚噸锛? *     鍚?id 浼氳浜掔浉鍚炴帀 鈬?鏈€鍚庡彧鍓╀竴鏉℃楠よ銆? */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createToolSubStepReporter } from '../../../src/services/chat/agentRoundExecutor';
import { dedupeToolItems } from '../../../src/services/chat/agentToolLabels';
import { stepToToolEvent } from '../../../src/services/chat/agentActivityItems';
import { useAppStore } from '../../../src/store/useAppStore';
import type { AgentStep, AgentTask } from '../../../src/types/agent';

const PARENT_CALL_ID = 'call_parent_0123456789';

function parentStep(): AgentStep {
  return {
    id: 'task-1-step-0-abcd',
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: '鐢熸垚濯掍綋鍐呭',
    status: 'running',
    createdAt: 1_000,
    updatedAt: 1_000,
    toolCall: {
      callId: PARENT_CALL_ID,
      toolId: 'media_generate',
      retryCount: 0,
      startedAt: 1_000,
      effect: 'media_generation',
    },
  } as AgentStep;
}

function seedTask(steps: AgentStep[]): void {
  const task = {
    id: 'task-1',
    projectId: 'p1',
    conversationId: 'c1',
    userMessageId: 'u1',
    mode: 'autonomous',
    goal: '鐢熸垚2鍙潪娲茶薄 9:16灏哄',
    status: 'running',
    steps,
    modelRounds: 1,
    toolCallCount: 1,
    budget: {},
    createdAt: 900,
    updatedAt: 900,
  } as unknown as AgentTask;
  useAppStore.setState({ agentTasks: [task] } as never);
}

function stepsOf(taskId = 'task-1'): AgentStep[] {
  return useAppStore.getState().agentTasks.find((task) => task.id === taskId)?.steps ?? [];
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('createToolSubStepReporter锛氱湡瀹為樁娈?鈫?鐪熷疄姝ラ', () => {
  it('鈶?涓婃姤鍗宠拷鍔犱竴鏉?running 姝ラ锛宍finish` 鎵嶅啓鐘舵€佷笌缁撴潫鏃堕棿', () => {
    seedTask([parentStep()]);
    const report = createToolSubStepReporter('task-1', parentStep(), PARENT_CALL_ID);

    const options = report({ title: '纭褰撳墠鍙敤鐨勫浘鍍忕敓鎴愰€夐」', inputSummary: '宸茶В鏋愭ā鍨嬶細閫氱敤鍥剧墖' });
    const appended = stepsOf();
    expect(appended).toHaveLength(2);
    const step = appended[1];
    expect(step.title).toBe('纭褰撳墠鍙敤鐨勫浘鍍忕敓鎴愰€夐」');
    expect(step.status).toBe('running');
    expect(step.kind).toBe('tool');
    /* `createdAt` 蹇呴』鏄?*鐪熷疄**鐨勪笂鎶ユ椂鍒伙紝涓嶆槸鐖舵楠ょ殑鏃堕棿銆?*/
    expect(step.createdAt).toBeGreaterThan(1_000);
    expect(step.toolCall?.startedAt).toBe(step.createdAt);
    expect(step.toolCall?.finishedAt).toBeUndefined();

    options.finish('succeeded', '鍙敤妯″瀷锛氶€氱敤鍥剧墖');
    const finished = stepsOf()[1];
    expect(finished.id).toBe(options.stepId);
    expect(finished.status).toBe('succeeded');
    expect(finished.toolCall?.finishedAt).toBeGreaterThanOrEqual(step.createdAt);
    expect(finished.outputSummary).toBe('鍙敤妯″瀷锛氶€氱敤鍥剧墖');
  });

  it('鈶?瀛愭楠?`callId` 涓庣埗姝ラ涓嶅悓 鈬?涓嶄細琚畼鏂?`oie` 鍘婚噸鍚炴帀', () => {
    seedTask([parentStep()]);
    const report = createToolSubStepReporter('task-1', parentStep(), PARENT_CALL_ID);
    report({ title: '纭褰撳墠鍙敤鐨勫浘鍍忕敓鎴愰€夐」' }).finish('succeeded');
    report({ title: '纭 9:16 鐢婚潰涓?2K 灏哄閫夐」' }).finish('succeeded');
    report({ title: '鎻愪氦 9:16 涓ゅ彧闈炴床璞?鍥惧儚鐢熸垚' }).finish('succeeded');

    const steps = stepsOf();
    expect(steps).toHaveLength(4);
    const callIds = new Set(steps.map((step) => step.toolCall?.callId));
    expect(callIds.size).toBe(4);
    expect(callIds.has(PARENT_CALL_ID)).toBe(true);

    /* 瀹樻柟 `oie(items)` 鐨勭瓑浠风墿锛? 鏉￠兘鍦紙涓€鏉￠兘涓嶈瑕嗙洊锛夈€?*/
    const items = steps.map(stepToToolEvent);
    expect(dedupeToolItems(items)).toHaveLength(4);
    /* 姣忔潯瀛愭楠ょ殑琛屾枃妗?= 鑷繁鐨?`title`锛堝畼鏂?`request.description` 璇诲彇鐐癸級銆?*/
    expect(items.slice(1).map((item) => (item.content as { request?: { description?: string } }).request?.description))
      .toEqual(['纭褰撳墠鍙敤鐨勫浘鍍忕敓鎴愰€夐」', '纭 9:16 鐢婚潰涓?2K 灏哄閫夐」', '鎻愪氦 9:16 涓ゅ彧闈炴床璞?鍥惧儚鐢熸垚']);
  });

  it('鈶?澶辫触 / 涓鏄湡瀹炵姸鎬侊紝涓嶄吉瑁呮垚鎴愬姛', () => {
    seedTask([parentStep()]);
    const report = createToolSubStepReporter('task-1', parentStep(), PARENT_CALL_ID);
    const failed = report({ title: '鎻愪氦 9:16 涓ゅ彧闈炴床璞?鍥惧儚鐢熸垚' });
    failed.finish('failed', '渚涘簲鍟嗚繑鍥?500');
    const stopped = report({ title: '鎻愪氦 9:16 涓ゅ彧闈炴床璞?鍥惧儚鐢熸垚' });
    stopped.finish('stopped', '鐢ㄦ埛鍋滄');

    const statuses = stepsOf().map((step) => step.status);
    expect(statuses).toEqual(['running', 'failed', 'stopped']);
    expect(stepsOf()[1].outputSummary).toBe('渚涘簲鍟嗚繑鍥?500');
  });

  it('鈶?鎸佷箙鍖栨憳瑕佽蛋鍚屼竴濂楄劚鏁忥紙鏈湴璺緞/瀵嗛挜涓嶈惤鐩橈級', () => {
    seedTask([parentStep()]);
    const report = createToolSubStepReporter('task-1', parentStep(), PARENT_CALL_ID);
    report({
      title: '鎻愪氦 9:16 C:\\Users\\me\\secret\\out.png 鍥惧儚鐢熸垚',
      inputSummary: 'sk-abcdefghijklmnop',
    }).finish('succeeded', '鍐欏叆 C:\\Users\\me\\secret\\out.png');

    const step = stepsOf()[1];
    expect(step.title).not.toContain('C:\\Users');
    expect(step.toolCall?.inputSummary).not.toContain('sk-abcdefghijklmnop');
    expect(step.outputSummary).not.toContain('C:\\Users');
  });
});
