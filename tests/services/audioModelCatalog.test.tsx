// @vitest-environment jsdom
/**
 * R73 官方音频 chip 控制器 `uie`（canvas @2317385..2324420）移植的**行为回归保险**。
 *
 * 官方事实（产物 `vendor-pkg-canvas-CvbAwZyy.js`，SHA-256 同批；+ `vendor-packages-DRvCmDjR.js`）：
 * - model chip 选项真源 = `GI`（canvas @2236212，**3 条**），逐项用 `H1`（vendor `_ue`@1086298）
 *   取 `nameKey`/`name`、用 `wg`+`wC`(`I2`@1085747) 取当前场景下的模型 id、用
 *   `Og("audio",…)`(`H1[].isFree`) 与 `Gp`(`supportsVideoInput`) 判 `disabled`；
 * - scene chip = `oe`（canvas @2320290 邻域，3 个 `Bo` 枚举值）+ 逐项 `disabled`；
 * - `confirmDisabled = b || !_e`，`_e = X || pe && me && he`（`pe`/`me`/`he` 逐字见 spec §73）；
 * - `Z`/`G1`/`wg`/`wC`/`Gp`/`Mre`/`Zh` 都是静态表 + 纯函数 ⇒ 已逐字搬进
 *   `src/services/ai/audioModelCatalog.ts`。
 *
 * 验证分级 = **(b) jsdom + 真 hook + 真目录数据**（无 mock；不触网）。
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  useAudioChipController,
  type AudioChipControllerInput,
} from '../../src/components/chat/generationChipController';
import {
  AUDIO_MODELS,
  AUDIO_MUSIC_MODELS,
  AUDIO_SCENE,
  AUDIO_SCENE_MODE,
  AUDIO_SOUND_MODELS,
  AUDIO_SPEECH_MODELS,
  AUDIO_VIRTUAL_MODELS,
  AUDIO_WIRE_DIRECTORY,
  AUDIO_WIRE_TABLE,
  audioModelDurations,
  audioModelForScene,
  audioModelForWireAndMode,
  audioModelIsFree,
  audioModelSupportsVideoInput,
  audioSceneOfModel,
  audioScenesOfVirtual,
  audioVirtualOfModel,
  audioWireOfModelEntity,
} from '../../src/services/ai/audioModelCatalog';

afterEach(() => cleanup());

const KNOWN = (id: string) => ({ status: 'known', id });
const SCENE = (scene: string) => ({ status: 'known', scene });

function renderAudio(overrides: Partial<AudioChipControllerInput> = {}) {
  const props: AudioChipControllerInput = {
    params: {
      prompt: 'a cat',
      model: KNOWN('sonilo-music'),
      audioScene: SCENE(AUDIO_SCENE.MUSIC_GENERATION),
      duration: 60,
    },
    presentFields: ['model', 'prompt', 'audioScene', 'duration'],
    paramControlsEditable: true,
    ...overrides,
  };
  return renderHook(() => useAudioChipController(props));
}

/* ------------------------------------------------------------------ *
 * A 组：静态表（官方 `zE` / `GI` / `I2` / `H1` / `lge` / `cge` / `Af` / `zet`）
 * ------------------------------------------------------------------ */

describe('A 组 官方音频静态表逐字', () => {
  it('A1 `GI` = `Object.entries(zE)` 的 3 条（wireName 顺序 = elevenlabs → sonilo → doubao-seed-audio）', () => {
    expect(AUDIO_WIRE_DIRECTORY).toEqual([
      { wireName: 'elevenlabs', virtual: 'elevenlabs-v3' },
      { wireName: 'sonilo', virtual: 'sonilo-music' },
      { wireName: 'doubao-seed-audio', virtual: 'seed-audio-1-0' },
    ]);
  });

  it('A2 `zE` 的 default/byMode/modes 逐字（doubao 无 byMode）', () => {
    expect(audioModelForWireAndMode('elevenlabs', 'speech')).toBe('eleven_v3');
    expect(audioModelForWireAndMode('elevenlabs', 'music')).toBe('music_v1');
    expect(audioModelForWireAndMode('elevenlabs', 'sound')).toBe('eleven_sound_effect');
    expect(audioModelForWireAndMode('sonilo', 'music')).toBe('sonilo-music');
    expect(audioModelForWireAndMode('sonilo', 'sound')).toBe('sonilo-sfx');
    expect(audioModelForWireAndMode('doubao-seed-audio', 'speech')).toBe('doubao-seed-audio-1-0');
    /* `modes` 之外 ⇒ `Fet` 返回 undefined（不补 default）。 */
    expect(audioModelForWireAndMode('doubao-seed-audio', 'music')).toBeUndefined();
    expect(audioModelForWireAndMode('sonilo', 'speech')).toBeUndefined();
  });

  it('A3 `H1` 8 条 + `isFree` 只有 mureka-v8 / mureka-o2 为 true；lyria 两条 isHidden', () => {
    expect(AUDIO_VIRTUAL_MODELS.map((m) => m.value)).toEqual([
      'seed-audio-1-0', 'minimax-music-26', 'elevenlabs-v3', 'mureka-v8',
      'mureka-o2', 'sonilo-music', 'lyria-3-clip', 'lyria-3-pro',
    ]);
    expect(AUDIO_VIRTUAL_MODELS.filter((m) => m.isFree).map((m) => m.value)).toEqual(['mureka-v8', 'mureka-o2']);
    expect(AUDIO_VIRTUAL_MODELS.filter((m) => m.isHidden).map((m) => m.value)).toEqual(['lyria-3-clip', 'lyria-3-pro']);
    expect(AUDIO_VIRTUAL_MODELS.find((m) => m.value === 'elevenlabs-v3')?.nameKey)
      .toBe('audio.virtualModel.elevenlabsV3.name');
  });

  it('A4 `lge`/`cge`/`Af` 成员（8 / 2 / 13）', () => {
    expect(AUDIO_MUSIC_MODELS).toHaveLength(8);
    expect(AUDIO_SOUND_MODELS).toHaveLength(2);
    expect(AUDIO_SPEECH_MODELS).toHaveLength(3);
    expect(AUDIO_MODELS).toHaveLength(13);
    /* `Af` = `[...UK,...BK,...HK]`，顺序逐字：语音在前。 */
    expect(AUDIO_MODELS.slice(0, 3)).toEqual(AUDIO_SPEECH_MODELS);
    expect(AUDIO_MODELS.slice(3, 11)).toEqual(AUDIO_MUSIC_MODELS);
    expect(AUDIO_MODELS.slice(11)).toEqual(AUDIO_SOUND_MODELS);
  });

  it('A5 `zet` 14 条（含 `selectable:!1` 的旧 wire 名）', () => {
    expect(AUDIO_WIRE_TABLE).toHaveLength(14);
    expect(AUDIO_WIRE_TABLE.filter((e) => e.selectable === false)).toHaveLength(8);
    expect(AUDIO_WIRE_TABLE.filter((e) => e.selectable !== false).map((e) => e.wireName)).toEqual([
      'doubao-seed-audio', 'eleven-v3', 'eleven-music-v1', 'eleven-sound-effect', 'sonilo-music', 'sonilo-sfx',
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * B 组：官方纯函数（`Mre` / `G1` / `wg` / `wC` / `Gp` / `Zh`）
 * ------------------------------------------------------------------ */

describe('B 组 官方纯函数', () => {
  it('B1 `Mre`：音乐 → Music、音效 → Sound、其余 Af 成员 → Text-to-Speech', () => {
    expect(audioSceneOfModel('music_v1')).toBe(AUDIO_SCENE.MUSIC_GENERATION);
    expect(audioSceneOfModel('sonilo-music')).toBe(AUDIO_SCENE.MUSIC_GENERATION);
    expect(audioSceneOfModel('eleven_sound_effect')).toBe(AUDIO_SCENE.SOUND_EFFECT);
    expect(audioSceneOfModel('sonilo-sfx')).toBe(AUDIO_SCENE.SOUND_EFFECT);
    expect(audioSceneOfModel('eleven_v3')).toBe(AUDIO_SCENE.TEXT_TO_SPEECH);
    expect(audioSceneOfModel('doubao-seed-audio-1-0')).toBe(AUDIO_SCENE.TEXT_TO_SPEECH);
    expect(audioSceneOfModel('not-a-model')).toBeUndefined();
    expect(audioSceneOfModel(undefined)).toBeUndefined();
  });

  it('B2 `G1`：modelId → 虚拟名；未命中回落到 `K7="mureka-v8"`', () => {
    expect(audioVirtualOfModel('doubao-seed-audio-1-0')).toBe('seed-audio-1-0');
    expect(audioVirtualOfModel('eleven_v3')).toBe('elevenlabs-v3');
    expect(audioVirtualOfModel('music_v1')).toBe('elevenlabs-v3');
    expect(audioVirtualOfModel('sonilo-sfx')).toBe('sonilo-music');
    expect(audioVirtualOfModel('eleven_multilingual_v2')).toBe('mureka-v8');
    expect(audioVirtualOfModel(undefined)).toBe('mureka-v8');
  });

  it('B3 `wg`：三个 wire 各自的可用场景（11 = speech/music/sound，sonilo = music/sound，doubao = speech）', () => {
    expect(audioScenesOfVirtual('elevenlabs-v3'))
      .toEqual([AUDIO_SCENE.TEXT_TO_SPEECH, AUDIO_SCENE.MUSIC_GENERATION, AUDIO_SCENE.SOUND_EFFECT]);
    expect(audioScenesOfVirtual('sonilo-music')).toEqual([AUDIO_SCENE.MUSIC_GENERATION, AUDIO_SCENE.SOUND_EFFECT]);
    expect(audioScenesOfVirtual('seed-audio-1-0')).toEqual([AUDIO_SCENE.TEXT_TO_SPEECH]);
    expect(audioScenesOfVirtual('mureka-v8')).toEqual([AUDIO_SCENE.MUSIC_GENERATION]);
    expect(audioScenesOfVirtual('unknown-virtual')).toEqual([]);
    expect(audioScenesOfVirtual(undefined)).toEqual([]);
  });

  it('B4 `wC`：虚拟 × 场景 → 模型 id（不支持的组合 ⇒ undefined，不抛）', () => {
    expect(audioModelForScene('elevenlabs-v3', AUDIO_SCENE.SOUND_EFFECT)).toBe('eleven_sound_effect');
    expect(audioModelForScene('sonilo-music', AUDIO_SCENE.MUSIC_GENERATION)).toBe('sonilo-music');
    expect(audioModelForScene('seed-audio-1-0', AUDIO_SCENE.MUSIC_GENERATION)).toBeUndefined();
    expect(audioModelForScene('mureka-v8', AUDIO_SCENE.SOUND_EFFECT)).toBeUndefined();
    expect(audioModelForScene(undefined, AUDIO_SCENE.SOUND_EFFECT)).toBeUndefined();
  });

  it('B5 `Gp`：只有 sonilo-music / sonilo-sfx 支持视频输入', () => {
    expect(audioModelSupportsVideoInput('sonilo-music')).toBe(true);
    expect(audioModelSupportsVideoInput('sonilo-sfx')).toBe(true);
    expect(audioModelSupportsVideoInput('eleven_v3')).toBe(false);
    expect(audioModelSupportsVideoInput('music_v1')).toBe(false);
    expect(audioModelSupportsVideoInput(undefined)).toBe(false);
  });

  it('B6 `Zh`：模型实体 → wire 名（`unknown` 返回 undefined）', () => {
    expect(audioWireOfModelEntity(KNOWN('sonilo-music'))).toBe('sonilo');
    expect(audioWireOfModelEntity(KNOWN('eleven_sound_effect'))).toBe('elevenlabs');
    expect(audioWireOfModelEntity(KNOWN('doubao-seed-audio-1-0'))).toBe('doubao-seed-audio');
    /* 不在 `zE` 的 default/byMode 里 ⇒ 走 `Tre("audio",e)` = `zet` 反查。 */
    expect(audioWireOfModelEntity(KNOWN('mureka-8'))).toBe('mureka-8');
    expect(audioWireOfModelEntity(KNOWN('eleven_multilingual_v2'))).toBe('eleven_multilingual_v2');
    expect(audioWireOfModelEntity({ status: 'unknown', displayName: 'x' })).toBeUndefined();
    expect(audioWireOfModelEntity(undefined)).toBeUndefined();
  });

  it('B7 `Og("audio",…)`：只有 mureka-v8 / mureka-o2 的虚拟模型 isFree', () => {
    expect(audioModelIsFree('sonilo', false)).toBe(false);
    expect(audioModelIsFree('elevenlabs', false)).toBe(false);
    expect(audioModelIsFree('doubao-seed-audio', false)).toBe(false);
    expect(audioModelIsFree('sonilo', true)).toBe(true);
    expect(audioModelIsFree(undefined, false)).toBe(false);
    /* ★ round 129：付费态**未知**（`null`，MTV 现状）⇒ 不阻断（官方 `Og` 的 `n` 求不出来）。 */
    expect(audioModelIsFree('sonilo', null)).toBe(true);
    expect(audioModelIsFree('elevenlabs', null)).toBe(true);
    expect(audioModelIsFree(undefined, null)).toBe(true);
  });

  it('B8 `WI().durations`：只有 sonilo-music=[30,60,120] / sonilo-sfx=[5,10,30]', () => {
    expect(audioModelDurations('sonilo-music')).toEqual([30, 60, 120]);
    expect(audioModelDurations('sonilo-sfx')).toEqual([5, 10, 30]);
    expect(audioModelDurations('music_v1')).toBeUndefined();
    expect(audioModelDurations('eleven_v3')).toBeUndefined();
    expect(audioModelDurations(undefined)).toBeUndefined();
  });

  it('B9 `Ket`：场景 → 虚拟面 mode（speech / music / sound）', () => {
    expect(AUDIO_SCENE_MODE[AUDIO_SCENE.MUSIC_GENERATION]).toBe('music');
    expect(AUDIO_SCENE_MODE[AUDIO_SCENE.SOUND_EFFECT]).toBe('sound');
    expect(AUDIO_SCENE_MODE[AUDIO_SCENE.TEXT_TO_SPEECH]).toBe('speech');
  });
});

/* ------------------------------------------------------------------ *
 * C 组：model chip（官方 `Y`）
 * ------------------------------------------------------------------ */

describe('C 组 model chip', () => {
  it('C1 默认（付费态**未知**）：`Xb` **不再**按订阅名单过滤，也不判受限（round 129 解冻第二个落点）', () => {
    const { result } = renderAudio();
    const c = result.current;
    expect(c.showModelChip).toBe(true);
    /* 官方 `Y = GI.filter(({virtual})=>Xb(virtual,u))`；`Xb` = `Dz(e,t)= t||!E2(e)`，
       `t` 就是 @2324104 的 `q` = **付费态**。官方 `jz`（88 项，vendor@976032）**含**
       `sonilo-music`/`sonilo-sfx`/`elevenlabs-v3` —— 修复前 MTV 拿自己折的 `false` 喂它，
       于是非付费态下 `elevenlabs`/`sonilo` 被整条滤掉（只剩 `doubao-seed-audio`）。
       round 129：未知 ⇒ 不过滤（反例见 C1b）。 */
    expect(c.modelOptions?.map((o) => o.value)).toEqual(['elevenlabs', 'sonilo', 'doubao-seed-audio']);
    expect(c.modelOptions?.map((o) => o.label))
      .toEqual(['ElevenLabs V3', 'Sonilo Music', 'Seed audio 1.0']);
    /* ★ round 129：官方 `ze = !!Ue && !Og("audio",Ue,_)` 的 `_` 是**付费态**；MTV 未知
       ⇒ 不再给「Subscription required」（修复前 doubleseed-audio 恒 `disabled:true` + 该文案）。 */
    expect(c.modelOptions?.map((o) => o.disabled)).toEqual([false, false, false]);
    expect(c.modelOptions?.map((o) => o.disabledReason)).toEqual([undefined, undefined, undefined]);
    /* 官方 `icon: Ue ? WI(Ue)?.icon : void 0`：MTV 未载入 `oe` 组件 ⇒ 不补。 */
    expect(c.modelOptions?.map((o) => o.icon)).toEqual([undefined, undefined, undefined]);
    /* `Xb("sonilo", u)`：`u` 为空数组（truthy）⇒ `t` 未知 ⇒ 不再过滤 ⇒ `ye = !r || !Xb(...)`：
       `r = true`（`paramControlsEditable` 默认试真）⇒ `ye = !true || false` = 假
       ⇒ `modelSelectedValue` 取第一个启用项 `be?.value` = "elevenlabs"。 */
    expect(c.modelSelectedValue).toBe('elevenlabs');
    expect(c.modelDisplayName).toBe('ElevenLabs V3');
  });

  it('C1b ★ round 129 反例：宿主明确 `isPayingCustomer:false` ⇒ 官方非付费分支原样保留（`Xb` 过滤 + `disabled` + 文案）', () => {
    const c = renderAudio({ isPayingCustomer: false }).result.current;
    expect(c.modelOptions?.map((o) => o.value)).toEqual(['doubao-seed-audio']);
    expect(c.modelOptions?.map((o) => o.disabled)).toEqual([true]);
    expect(c.modelOptions?.map((o) => o.disabledReason)).toEqual(['Subscription required']);
    /* `Xb("sonilo", false)` = `!E2("sonilo")` = `[]`（falsy）⇒ `ye` 真 ⇒ 取 `fe = Zh(p)` = "sonilo"，
       但 `Y` 已被滤成只剩 `doubao-seed-audio` ⇒ `modelDisplayName` 回落 `String(v??"")`。 */
    expect(c.modelSelectedValue).toBe('sonilo');
    expect(c.modelDisplayName).toBe('sonilo');
  });

  it('C2 付费：`Xb` 短路 ⇒ 三个 wire 全在，且全部可选', () => {
    const { result } = renderAudio({ isPayingCustomer: true });
    const c = result.current;
    expect(c.modelOptions?.map((o) => o.value)).toEqual(['elevenlabs', 'sonilo', 'doubao-seed-audio']);
    expect(c.modelOptions?.map((o) => o.label))
      .toEqual(['ElevenLabs V3', 'Sonilo Music', 'Seed audio 1.0']);
    expect(c.modelOptions?.map((o) => o.disabled)).toEqual([false, false, false]);
    expect(c.modelOptions?.map((o) => o.disabledReason)).toEqual([undefined, undefined, undefined]);
    /* 付费 ⇒ `Xb("sonilo", u)` 为真 ⇒ `ye = !r || !Xb` = `!true || false` = 假
       ⇒ `modelSelectedValue` 取 `be?.value`（第一个启用项 = "elevenlabs"），
       `modelDisplayName` 取 `be?.label` = "ElevenLabs V3"。 */
    expect(c.modelSelectedValue).toBe('elevenlabs');
    expect(c.modelDisplayName).toBe('ElevenLabs V3');
    expect(c.modelChipEditable).toBe(true);
  });

  it('C3 模型未知（`X`）⇒ `modelDisplayName` 用 displayName；`modelSelectedValue` 走 `be`', () => {
    const { result } = renderAudio({
      params: { prompt: 'x', model: { status: 'unknown', displayName: 'local/audio-1' } },
      presentFields: ['model', 'prompt'],
    });
    const c = result.current;
    expect(c.modelDisplayName).toBe('local/audio-1');
    /* 模型未知 ⇒ `v = IN(p)` 为 `undefined` ⇒ 无 `jz` 命中 ⇒ `Xb(undefined, ·)` 为真 ⇒ `ye` 假
       ⇒ `modelSelectedValue` 取第一个启用项 `be?.value`（round 129 后付费态未知 ⇒ 三项都在
       ⇒ 首项 = "elevenlabs"）；`modelDisplayName` 仍优先走官方第一分支 `p.displayName`。 */
    expect(c.modelSelectedValue).toBe('elevenlabs');
    expect(c.modelChipEditable).toBe(false);
  });

  it('C4 不可编辑（`r=false`）⇒ 取 `fe`（当前模型）；`ye = !r` 为真', () => {
    const { result } = renderAudio({ paramControlsEditable: false, isPayingCustomer: true });
    /* `paramControlsEditable:false` ⇒ `ye = !r || !Xb` = 真
       ⇒ `modelSelectedValue` 取 `fe = Zh(p)` = "sonilo"，
          `modelDisplayName` 取 `Y.find(value===fe)?.label` = "Sonilo Music"。 */
    expect(result.current.modelSelectedValue).toBe('sonilo');
    expect(result.current.modelDisplayName).toBe('Sonilo Music');
    expect(result.current.modelChipEditable).toBe(false);
  });

  it('C3b 模型未知 + 不可编辑 ⇒ `fe = Zh(p)` 为 `undefined` ⇒ 回落 `""`', () => {
    const { result } = renderAudio({
      params: { prompt: 'x', model: { status: 'unknown', displayName: 'local/audio-1' } },
      presentFields: ['model', 'prompt'],
      paramControlsEditable: false,
    });
    expect(result.current.modelSelectedValue).toBe('');
    expect(result.current.modelDisplayName).toBe('local/audio-1');
  });

  it('C5 `handleModelChange("elevenlabs")` ⇒ 切到该 wire 的当前场景分支（Music ⇒ music_v1）', () => {
    const { result } = renderAudio({ isPayingCustomer: true });
    act(() => result.current.handleModelChange?.('elevenlabs'));
    /* `$ = lot(f)` = Music 且 elevenlabs 的 `wg` 含 Music ⇒ `nt=$` ⇒ `wC('elevenlabs-v3','Music')='music_v1'`。 */
    expect(result.current.modelId).toBe('music_v1');
    expect(result.current.scene).toBe(AUDIO_SCENE.MUSIC_GENERATION);
    /* 官方 `Oe?.defaultDuration != null && x(Oe.defaultDuration)`：`WI('music_v1')` 的
       `defaultDuration` 取自 `A2/_2/U7/D7/…` 的 `defaultParams`，`A7`(=music_v1) 的
       `defaultParams` 只有 `force_instrumental/lyric_mode/lyrics` ⇒ `defaultDuration` 为
       `undefined` ⇒ 官方**不改** `duration`，保持原值 60。 */
    expect(result.current.editedDuration).toBe(60);
  });
});

/* ------------------------------------------------------------------ *
 * D 组：scene chip（官方 `oe`）
 * ------------------------------------------------------------------ */

describe('D 组 scene chip', () => {
  it('D1 三个场景选项固定顺序 Music → Sound effect → Text to speech（官方 `oe` 逐字顺序）', () => {
    const { result } = renderAudio({ isPayingCustomer: true });
    expect(result.current.sceneOptions?.map((o) => o.value))
      .toEqual([AUDIO_SCENE.MUSIC_GENERATION, AUDIO_SCENE.SOUND_EFFECT, AUDIO_SCENE.TEXT_TO_SPEECH]);
    expect(result.current.sceneOptions?.map((o) => o.label)).toEqual(['Music', 'Sound effect', 'Text to speech']);
  });

  it('D2 sonilo 模型：Speech 场景 disabled + sceneUnsupportedByModel，Music/Sound 可用', () => {
    const { result } = renderAudio({ isPayingCustomer: true });
    const options = result.current.sceneOptions ?? [];
    const byValue = Object.fromEntries(options.map((o) => [o.value, o]));
    expect(byValue[AUDIO_SCENE.TEXT_TO_SPEECH].disabled).toBe(true);
    /* `t()` 走 MTV 既有 zh 文案表 ⇒ 命中官方 key 对应的中文，而不是回落 key 本身。 */
    expect(byValue[AUDIO_SCENE.TEXT_TO_SPEECH].disabledReason)
      .toBe('该模型不提供这个类型，请先切换模型。');
    expect(byValue[AUDIO_SCENE.MUSIC_GENERATION].disabled).toBe(false);
    expect(byValue[AUDIO_SCENE.SOUND_EFFECT].disabled).toBe(false);
  });

  it('D3 doubao-seed-audio（只有 speech）⇒ 可用场景只有 1 个 ⇒ showSceneChip 为 false', () => {
    const { result } = renderAudio({
      params: { prompt: 'x', model: KNOWN('doubao-seed-audio-1-0'), audioScene: SCENE(AUDIO_SCENE.TEXT_TO_SPEECH) },
      presentFields: ['model', 'audioScene'],
      isPayingCustomer: true,
    });
    const c = result.current;
    expect(c.scene).toBe(AUDIO_SCENE.TEXT_TO_SPEECH);
    expect((c.sceneOptions ?? []).filter((o) => !o.disabled).length).toBe(1);
    /* 官方 `showSceneChip = n.has("audioScene") && !!f && oe.filter(!disabled).length > 1`。 */
    expect(c.showSceneChip).toBe(false);
    expect(c.sceneDisplayName).toBe('Text to speech');
  });

  it('D4 `audioScene` 不在 presentFields ⇒ showSceneChip 为 false（官方 `n.has("audioScene")`）', () => {
    const { result } = renderAudio({ presentFields: ['model', 'prompt'], isPayingCustomer: true });
    expect(result.current.showSceneChip).toBe(false);
  });

  it('D5 `handleSceneChange(Sound)`：sonilo wire 在 Sound 上换成 sonilo-sfx', () => {
    const { result } = renderAudio({ isPayingCustomer: true });
    act(() => result.current.handleSceneChange?.(AUDIO_SCENE.SOUND_EFFECT));
    expect(result.current.modelId).toBe('sonilo-sfx');
    expect(result.current.scene).toBe(AUDIO_SCENE.SOUND_EFFECT);
  });
});

/* ------------------------------------------------------------------ *
 * E 组：`confirmDisabled`（官方 `_e = X || pe && me && he`）
 * ------------------------------------------------------------------ */

describe('E 组 confirmDisabled 三态', () => {
  it('E1 默认（付费态**未知**）⇒ **不再**阻断（修复前：`Subscription required` 挡住「确认」）', () => {
    const c = renderAudio().result.current;
    expect(c.confirmDisabled).toBe(false);
    expect(c.confirmDisabledReason).toBeUndefined();
  });

  it('E1b ★ round 129 反例：宿主明确 `isPayingCustomer:false` ⇒ 官方非付费分支原样保留', () => {
    const c = renderAudio({ isPayingCustomer: false }).result.current;
    expect(c.confirmDisabled).toBe(true);
    expect(c.confirmDisabledReason).toBe('Subscription required');
  });

  it('E2 付费但场景与模型不匹配（`he` 假：`Mre(v) !== $`）⇒ 阻断，理由 modelInputIncompatible', () => {
    const c = renderAudio({
      params: { prompt: 'x', model: KNOWN('sonilo-music'), audioScene: SCENE(AUDIO_SCENE.TEXT_TO_SPEECH) },
      isPayingCustomer: true,
    }).result.current;
    expect(c.confirmDisabled).toBe(true);
    expect(c.confirmDisabledReason)
      .toBe('The selected audio model does not support this scene or these references');
  });

  it('E3 付费 + 场景匹配（`pe` 假、`he` 真、空引用 `me` 真）⇒ 放行', () => {
    const c = renderAudio({ isPayingCustomer: true }).result.current;
    expect(c.confirmDisabled).toBe(false);
    expect(c.confirmDisabledReason).toBeUndefined();
  });

  it('E4 模型未知（`X` 真）⇒ 放行（`_e = X || …`）', () => {
    const c = renderAudio({
      params: { prompt: 'x', model: { status: 'unknown', displayName: 'local/audio-1' } },
      presentFields: ['model', 'prompt'],
    }).result.current;
    expect(c.confirmDisabled).toBe(false);
  });

  it('E5 引用形状含未知项（`ee` 真、`J` 假）⇒ `me` 真、放行', () => {
    const c = renderAudio({
      isPayingCustomer: true,
      resolvedReferences: {
        shape: { imageCount: 0, videoCount: 0, audioCount: 0, unknownCount: 1, totalCount: 0 },
      },
    }).result.current;
    expect(c.confirmDisabled).toBe(false);
  });

  it('E6 引用形状含视频且模型不支持视频输入（`J` 真、`Gp` 假）⇒ modelOptions 加 disabled + modelInputIncompatible', () => {
    const c = renderAudio({
      isPayingCustomer: true,
      resolvedReferences: {
        shape: { imageCount: 0, videoCount: 1, audioCount: 0, unknownCount: 0, totalCount: 1 },
      },
    }).result.current;
    expect(c.isVideoAdaptive).toBe(true);
    /* doubao-seed-audio 只支持 speech，`ctt` 对 videoCount>0 判 false ⇒ `me` 假 ⇒ 阻断。 */
    expect(c.confirmDisabled).toBe(true);
    const doubao = (c.modelOptions ?? []).find((o) => o.value === 'doubao-seed-audio');
    expect(doubao?.disabled).toBe(true);
    expect(doubao?.disabledReason).toBe('The connected video source is not supported');
    /* sonilo 支持视频输入 ⇒ `Ee` 不触发（`ze` 在付费分支也不触发）。 */
    const sonilo = (c.modelOptions ?? []).find((o) => o.value === 'sonilo');
    expect(sonilo?.disabled).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * F 组：提交链路（`we` / `Le`）
 * ------------------------------------------------------------------ */

describe('F 组 buildChanges / buildModifications', () => {
  it('F1 prompt/duration 变化进 `buildChanges`；`buildModifications` 出 wire 键', () => {
    const { result } = renderAudio({ isPayingCustomer: true });
    act(() => result.current.setEditedDuration?.(90));
    let changes: Record<string, unknown> | undefined;
    act(() => {
      changes = result.current.buildChanges?.('a dog', {
        prompt: 'a cat',
        model: KNOWN('sonilo-music'),
        audioScene: SCENE(AUDIO_SCENE.MUSIC_GENERATION),
        duration: 60,
      });
    });
    expect(changes).toEqual({ prompt: 'a dog', duration: 90 });
    const mods = result.current.buildModifications?.('a dog', []);
    expect(mods).toEqual({ prompt: 'a dog', duration: 90 });
  });

  it('F2 无变化 ⇒ `buildChanges` 返回 undefined（官方 `Object.keys(Oe).length>0 ? Oe : void 0`）', () => {
    const { result } = renderAudio({ isPayingCustomer: true });
    expect(result.current.buildChanges?.('a cat')).toBeUndefined();
  });

  it('F3 模型变更：`model` 出**实体**（官方 `Oe.model = p`），wire 编码走 `Mv`', () => {
    const { result } = renderAudio({ isPayingCustomer: true });
    act(() => result.current.handleModelChange?.('elevenlabs'));
    const changes = result.current.buildChanges?.('a cat', {
      prompt: 'a cat',
      model: KNOWN('sonilo-music'),
      audioScene: SCENE(AUDIO_SCENE.MUSIC_GENERATION),
      duration: 60,
    });
    expect(changes?.model).toEqual({ status: 'known', id: 'music_v1' });
    /* `Mv("audio", …)`：`model` → `model_name`，模型实体编码走 `Are`（本仓目录为空 ⇒ 身份分支）。 */
    const mods = result.current.buildModifications?.('a cat', []);
    expect(mods).toEqual({ model_name: 'music_v1' });
  });

  it('F4 `sonilo-music` 的目录 `supportCustomLyrics=false` ⇒ `supportsLyrics` 假（官方 `mq`）', () => {
    const { result } = renderAudio({ isPayingCustomer: true });
    expect(result.current.supportsLyrics).toBe(false);
    /* `E=false` ⇒ 官方 `we`/`Le` 的 lyrics 两段都不执行 ⇒ `lyrics` 永不进 changes/cleared。 */
    const mods = result.current.buildModifications?.('a cat', []);
    expect(mods).toBeUndefined();
  });

  it('F5 `music_v1`（supportCustomLyrics=true）+ 非 custom 模式 + 有原歌词 ⇒ `lyrics` 进 cleared ⇒ wire `lyrics: null`', () => {
    const { result } = renderAudio({
      params: {
        prompt: 'a cat',
        model: KNOWN('music_v1'),
        audioScene: SCENE(AUDIO_SCENE.MUSIC_GENERATION),
        duration: 60,
        lyrics: 'la la',
        instrumental: true,
      },
      presentFields: ['model', 'prompt', 'audioScene', 'duration'],
      isPayingCustomer: true,
    });
    expect(result.current.supportsLyrics).toBe(true);
    /* `R = P ?? (L ? "instrumental" : j ? "custom" : "auto")`，`L=instrumental===true`。 */
    expect(result.current.lyricsMode).toBe('instrumental');
    const mods = result.current.buildModifications?.('a cat', []);
    expect(mods).toEqual({ lyrics: null });
  });
});
