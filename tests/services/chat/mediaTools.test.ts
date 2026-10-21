import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../../src/store/useAppStore';
import { registerMediaAgentTools } from '../../../src/services/chat/tools/mediaTools';
import { evaluateAgentToolPolicy } from '../../../src/services/chat/policyEngine';
import {
  clearAgentToolRegistryForTests,
  prepareAgentToolCall,
  type AgentToolContext,
} from '../../../src/services/chat/toolRegistry';

const context: Omit<AgentToolContext, 'signal'> = {
  taskId: 'task-media',
  projectId: 'project-1',
  conversationId: 'conversation-1',
  mode: 'collaborative',
};

beforeEach(() => {
  clearAgentToolRegistryForTests();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    currentProjectId: 'project-1',
    nodes: [{
      id: 'n1',
      type: 'source-image',
      position: { x: 0, y: 0 },
      data: { type: 'source-image', label: '首帧', imageUrl: 'asset://first-frame.png' },
    }],
    projects: [{
      id: 'project-1',
      name: '测试项目',
      createdAt: 1,
      updatedAt: 1,
      settings: {
        generation: {
          videoAspectRatio: '16:9',
          videoResolution: '1080p',
          videoDuration: 10,
        },
      },
    }],
  });
  registerMediaAgentTools();
});

describe('media_generate display parameters', () => {
  it('RunningHub 专属参数保持字符串，且不注入其他模型的视频默认值', () => {
    const id = 'minimax/h3-max-turbo/image-to-video';
    useAppStore.setState((state) => ({ config: { ...state.config, providers: { 'runninghub-model': { name: 'RH', apiKey: 'fake', selectedModels: [{ id, name: 'H3', provider: 'runninghub', category: 'video' }] } } } }));
    const prepared = prepareAgentToolCall({ callId: 'rh-params', toolId: 'media_generate', input: { kind: 'video', prompt: '镜头推进', modelRef: `runninghub/${id}`, deliveryMode: 'chat', modelParameters: [{ name: 'duration', value: '15' }] } }, context);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.prepared.input).toMatchObject({ modelParameters: [{ name: 'duration', value: '15' }] });
      expect(prepared.prepared.input).not.toHaveProperty('resolution');
      expect(prepared.prepared.input).not.toHaveProperty('duration');
    }
    const read = prepareAgentToolCall({ callId: 'rh-read', toolId: 'media_model_parameters', input: { modelRef: `runninghub/${id}` } }, { ...context, readOnly: true });
    expect(read.ok).toBe(true);
  });
  it('uses the project default media model when modelRef is omitted', () => {
    useAppStore.setState((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        settings: { ...project.settings, defaultModels: { video: 'general/video-default' } },
      })),
    }));
    const prepared = prepareAgentToolCall({
      callId: 'call-default',
      toolId: 'media_generate',
      input: { kind: 'video', prompt: '普通镜头', deliveryMode: 'chat' },
    }, context);

    expect(prepared).toMatchObject({ ok: true });
    if (prepared.ok) expect(prepared.prepared.input).toMatchObject({ modelRef: 'general/video-default' });
  });

  it('autonomous routing ranks user model descriptions and overrides the default', () => {
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        providers: {
          ...state.config.providers,
          custom: { name: '自定义', apiKey: 'secret', baseUrl: 'https://example.com' },
        },
        generalModels: [
          { id: 'video-default', name: '通用视频', modelId: 'video-a', category: 'video', providerConfigId: 'custom' },
          { id: 'video-anime', name: '动画专用', description: '擅长二次元动画与运镜', modelId: 'video-b', category: 'video', providerConfigId: 'custom' },
        ],
      },
      projects: state.projects.map((project) => ({
        ...project,
        settings: {
          ...project.settings,
          defaultModels: { video: 'general/video-default' },
          modelAutoRouting: true,
        },
      })),
    }));
    const prepared = prepareAgentToolCall({
      callId: 'call-auto',
      toolId: 'media_generate',
      input: { kind: 'video', prompt: '二次元 动画 运镜', deliveryMode: 'chat' },
    }, { ...context, mode: 'autonomous' });

    expect(prepared).toMatchObject({ ok: true });
    if (prepared.ok) expect(prepared.prepared.input).toMatchObject({ modelRef: 'general/video-anime' });
  });

  it('locks project video defaults before approval and exposes them in the display', () => {
    const prepared = prepareAgentToolCall({
      callId: 'call-1',
      toolId: 'media_generate',
      input: {
        kind: 'video',
        prompt: '基于 @{n1:首帧} 生成向前推进镜头',
        deliveryMode: 'canvas',
      },
    }, context);

    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) return;
    expect(prepared.prepared.input).toMatchObject({
      aspectRatio: '16:9',
      resolution: '1080p',
      duration: 10,
    });
    expect(prepared.prepared.definition.buildInputDisplay?.(
      prepared.prepared.input,
      context,
    )).toMatchObject({
      fields: expect.arrayContaining([
        { label: '画面比例', value: '16:9', source: 'resolved' },
        { label: '分辨率', value: '1080p', source: 'resolved' },
        { label: '时长', value: '10 秒', source: 'resolved' },
      ]),
      references: [{ kind: 'node', id: 'n1', label: '首帧', mediaKind: 'image' }],
    });
  });

  it('keeps explicit video parameters instead of replacing them with project defaults', () => {
    const prepared = prepareAgentToolCall({
      callId: 'call-2',
      toolId: 'media_generate',
      input: {
        kind: 'video',
        prompt: '竖屏人物镜头',
        deliveryMode: 'chat',
        aspectRatio: '9:16',
        resolution: '720p',
        duration: 6,
      },
    }, context);

    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) return;
    expect(prepared.prepared.input).toMatchObject({
      aspectRatio: '9:16',
      resolution: '720p',
      duration: 6,
    });
  });

  it('keeps omitted custom API video fields unspecified and accepts model-specific values', () => {
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        providers: {
          ...state.config.providers,
          custom: { name: '自定义', apiKey: '', baseUrl: 'https://gateway.example.com' },
        },
        generalModels: [{
          id: 'video-custom',
          name: '自定义视频',
          modelId: 'video-custom-upstream',
          category: 'video',
          providerConfigId: 'custom',
          videoCapability: {
            ratios: ['7:4'],
            resolutions: ['2K'],
            maxDuration: 30,
          },
        }],
      },
      projects: state.projects.map((project) => ({
        ...project,
        settings: { ...project.settings, defaultModels: { video: 'general/video-custom' } },
      })),
    }));

    const omitted = prepareAgentToolCall({
      callId: 'call-custom-default',
      toolId: 'media_generate',
      input: { kind: 'video', prompt: '自定义镜头', deliveryMode: 'chat' },
    }, context);
    expect(omitted).toMatchObject({ ok: true });
    if (omitted.ok) {
      expect(omitted.prepared.input).toMatchObject({ modelRef: 'general/video-custom' });
      expect(omitted.prepared.input).not.toHaveProperty('aspectRatio');
      expect(omitted.prepared.input).not.toHaveProperty('resolution');
      expect(omitted.prepared.input).not.toHaveProperty('duration');
    }

    const explicit = prepareAgentToolCall({
      callId: 'call-custom-explicit',
      toolId: 'media_generate',
      input: {
        kind: 'video',
        prompt: '自定义镜头',
        deliveryMode: 'chat',
        aspectRatio: '7:4',
        resolution: '2K',
        duration: 30,
      },
    }, context);
    expect(explicit).toMatchObject({ ok: true });
    if (explicit.ok) {
      expect(explicit.prepared.input).toMatchObject({
        aspectRatio: '7:4',
        resolution: '2K',
        duration: 30,
      });
    }
  });
});

/**
 * 真机现场：项目 **没有** `settings.generation` 时，视频 `media_generate` 在准备期被
 * `prepareAgentToolCall` 的第二次校验挡下，报
 * `工具有效参数无效: $.aspectRatio 必须是字符串；$.resolution 必须是字符串；$.duration 必须是有限数字`。
 * 根因：`resolveMediaToolInput` 无条件写入这三个键（值 `undefined`），
 * 而 `validateAgentToolInput` 用 `key in value` 判存在 ⇒ `undefined` 也撞类型校验。
 */
describe('media_generate 无项目视频默认参数时不得写 undefined 键', () => {
  beforeEach(() => {
    // 覆盖外层 beforeEach：项目存在，但 settings 里没有 generation。
    useAppStore.setState((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        settings: { defaultModels: {} },
      })),
    }));
  });

  it('① 无 generation + video + 非直连 + agent 不给三参数 ⇒ 不再失败，且载荷不含这三个键', () => {
    const prepared = prepareAgentToolCall({
      callId: 'call-no-generation',
      toolId: 'media_generate',
      input: { kind: 'video', prompt: '普通镜头', deliveryMode: 'chat' },
    }, context);

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.prepared.input).not.toHaveProperty('aspectRatio');
    expect(prepared.prepared.input).not.toHaveProperty('resolution');
    expect(prepared.prepared.input).not.toHaveProperty('duration');
    expect(Object.keys(prepared.prepared.input)).not.toContain('aspectRatio');
    expect(Object.keys(prepared.prepared.input)).not.toContain('resolution');
    expect(Object.keys(prepared.prepared.input)).not.toContain('duration');
  });

  it('①b 无 generation + canvas 投递同样不再失败', () => {
    const prepared = prepareAgentToolCall({
      callId: 'call-no-generation-canvas',
      toolId: 'media_generate',
      input: { kind: 'video', prompt: '普通镜头', deliveryMode: 'canvas' },
    }, context);
    expect(prepared).toMatchObject({ ok: true });
  });

  it('①c 无 generation + 只给了部分参数 ⇒ 只保留显式给的那个键', () => {
    const prepared = prepareAgentToolCall({
      callId: 'call-partial',
      toolId: 'media_generate',
      input: { kind: 'video', prompt: '普通镜头', deliveryMode: 'chat', duration: 8 },
    }, context);
    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) return;
    expect(prepared.prepared.input).toMatchObject({ duration: 8 });
    expect(prepared.prepared.input).not.toHaveProperty('aspectRatio');
    expect(prepared.prepared.input).not.toHaveProperty('resolution');
  });

  it('② 有 generation ⇒ 三个键照旧出现且值正确（行为不变）', () => {
    useAppStore.setState((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        settings: {
          defaultModels: {},
          generation: {
            videoAspectRatio: '16:9',
            videoResolution: '1080p',
            videoDuration: 10,
          },
        },
      })),
    }));
    const prepared = prepareAgentToolCall({
      callId: 'call-with-generation',
      toolId: 'media_generate',
      input: { kind: 'video', prompt: '普通镜头', deliveryMode: 'chat' },
    }, context);
    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) return;
    expect(prepared.prepared.input).toMatchObject({
      aspectRatio: '16:9',
      resolution: '1080p',
      duration: 10,
    });
  });

  it('③ agent 显式给参数 ⇒ 优先，且不受项目默认值影响', () => {
    useAppStore.setState((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        settings: {
          defaultModels: {},
          generation: {
            videoAspectRatio: '16:9',
            videoResolution: '1080p',
            videoDuration: 10,
          },
        },
      })),
    }));
    const prepared = prepareAgentToolCall({
      callId: 'call-explicit-wins',
      toolId: 'media_generate',
      input: {
        kind: 'video',
        prompt: '竖屏镜头',
        deliveryMode: 'chat',
        aspectRatio: '9:16',
        resolution: '720p',
        duration: 6,
      },
    }, context);
    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) return;
    expect(prepared.prepared.input).toMatchObject({
      aspectRatio: '9:16',
      resolution: '720p',
      duration: 6,
    });
  });
});

/**
 * **用户 2026-10-15 真机 P0**：用户输入「在画布上生成一只 3：4 的可爱的小猫」，
 * 结果正文是「当前媒体生成工具拒绝了图片的 3:4 比例参数，因此没有在画布上创建小猫」。
 *
 * 根因 = `mediaTools.ts` 的 `authorize` 把三个参数**合成一道门**：
 * `if (kind !== 'video' && (aspectRatio || resolution || duration)) ⇒ allowed:false`，
 * 而同日落地的图片比例链（`generationRuntime` 图片分支 + 工具描述）都要求
 * 「用户说了 3:4 就把 aspectRatio 写进入参」⇒ 模型照描述传 ⇒ 整次调用被拒。
 * **比修复前更糟**：修复前图片只是静默用 1:1，现在是彻底不出图。
 *
 * 本组用**与真机同一层**的调用顺序钉住它：
 * `prepareAgentToolCall`（= `resolveInput` + schema）→ `evaluateAgentToolPolicy`（= 真机
 * `agentRoundExecutor`/`agentToolExecution` 调的那个 `authorize` 入口）。
 */
describe('media_generate 参数门：图片可用 aspectRatio，resolution/duration 仍视频专属（P0）', () => {
  const policyContext = {
    mode: 'collaborative' as const,
    projectId: 'project-1',
    conversationId: 'conversation-1',
    taskId: 'task-media',
  };

  /** 真机同层：准备期 → 策略/授权期。返回 `authorize` 的判定与文案。 */
  function decide(input: Record<string, unknown>) {
    const prepared = prepareAgentToolCall({ callId: 'gate', toolId: 'media_generate', input }, context);
    if (!prepared.ok) {
      return { outcome: 'prepare_failed' as const, reason: prepared.result.summary };
    }
    const decision = evaluateAgentToolPolicy(
      prepared.prepared.definition,
      prepared.prepared.input,
      policyContext,
    );
    return { outcome: decision.outcome, reason: decision.reason };
  }

  /**
   * 期望值用 `'permit'`（= **不被拒**；协作模式下 `media_generation` 的正确结局是
   * `require_approval` —— 弹官方确认卡）与 `'deny'` 两态，避免把「放行」写死成 `allow`
   * 而误判了协作模式的审批语义。
   */
  const cases: Array<[string, Record<string, unknown>, 'permit' | 'deny']> = [
    ['图片 + aspectRatio 3:4 ⇒ 放行（用户现场这条必须是 permit）', { kind: 'image', prompt: '一只可爱的小猫', deliveryMode: 'canvas', aspectRatio: '3:4' }, 'permit'],
    ['图片 + aspectRatio 16:9 ⇒ 放行', { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', aspectRatio: '16:9' }, 'permit'],
    ['图片 + resolution ⇒ 拒绝（图片档位不走工具入参）', { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', resolution: '2K' }, 'deny'],
    ['图片 + duration ⇒ 拒绝', { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', duration: 5 }, 'deny'],
    ['音频 + aspectRatio ⇒ 拒绝', { kind: 'audio', prompt: '一段音乐', deliveryMode: 'chat', audioPurpose: 'music', aspectRatio: '3:4' }, 'deny'],
    ['视频 + 三者 ⇒ 放行', { kind: 'video', prompt: '镜头推进', deliveryMode: 'chat', aspectRatio: '9:16', resolution: '1080p', duration: 8 }, 'permit'],
  ];

  it.each(cases)('%s', (_title, input, expected) => {
    const result = decide(input);
    if (expected === 'deny') expect(result.outcome).toBe('deny');
    else expect(result.outcome).not.toBe('deny');
  });

  it('图片 + 3:4 在协作模式下的结局 = `require_approval`（即：弹官方确认卡，不是被挡回）', () => {
    expect(decide({ kind: 'image', prompt: '一只可爱的小猫', deliveryMode: 'canvas', aspectRatio: '3:4' }).outcome)
      .toBe('require_approval');
  });

  it('两条门的 reason 各自点名参数，且分辨率/时长与比例的文案**不是同一句**', () => {
    const ratioReject = decide({ kind: 'audio', prompt: '音乐', deliveryMode: 'chat', audioPurpose: 'music', aspectRatio: '3:4' });
    const resolutionReject = decide({ kind: 'image', prompt: '猫', deliveryMode: 'chat', resolution: '2K' });
    const durationReject = decide({ kind: 'image', prompt: '猫', deliveryMode: 'chat', duration: 5 });
    /* 让人一眼看出「是哪个参数被拒、为什么」——本次现场就是被模型转述成一句含糊的话。 */
    expect(ratioReject.reason).toContain('aspectRatio');
    expect(ratioReject.reason).toContain('图片与视频');
    expect(resolutionReject.reason).toContain('resolution');
    expect(resolutionReject.reason).toContain('只适用于视频');
    expect(durationReject.reason).toContain('duration');
    expect(durationReject.reason).toContain('只适用于视频');
    expect(ratioReject.reason).not.toBe(resolutionReject.reason);
    expect(resolutionReject.reason).not.toBe(durationReject.reason);
  });

  it('用户现场回归：图片 + 明确 3:4 必须**带着这个比例走进执行入参**（不是只到校验通过）', () => {
    const prepared = prepareAgentToolCall({
      callId: 'user-3-4',
      toolId: 'media_generate',
      input: { kind: 'image', prompt: '在画布上生成一只 3:4 的可爱的小猫', deliveryMode: 'canvas', aspectRatio: '3:4' },
    }, context);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    /* ① 授权层放行（P0 的那道门）；② 入参里比例**逐字**在（执行期读的就是它）。 */
    const decision = evaluateAgentToolPolicy(prepared.prepared.definition, prepared.prepared.input, policyContext);
    expect(decision.outcome).not.toBe('deny');
    expect(prepared.prepared.input.aspectRatio).toBe('3:4');
  });
});
