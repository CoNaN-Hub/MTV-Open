/**
 * 官方**音频模型目录**（`uie` 音频 chip 的 options 真源）的 MTV 载具。
 *
 * ## 数据来源（逐字，未改写）
 *
 * | 官方符号（canvas 内名） | 官方源码位置 | 官方实体（vendor-packages 导出名） | 偏移 |
 * |---|---|---|---|
 * | `oa`（语音/对话模型 id 枚举） | canvas 导入 `dx as oa` | `mt` @1027444 | 逐字见下 |
 * | `mr`（音乐模型 id 枚举） | canvas 导入 `dt as mr` | `Pe` @1027579 | 逐字见下 |
 * | `rl`（音效模型 id 枚举） | canvas 导入 `e0 as rl` | `En` @1027836 | 逐字见下 |
 * | `Bo`（音频场景枚举） | canvas 导入 `e1 as Bo` | `xn` @1027926 | 逐字见下 |
 * | `bS`（虚拟模型 id 枚举） | canvas 导入 `ez as bS` | `FK` @1085481 | 逐字见下 |
 * | `zE`（wire↔虚拟 目录） | canvas 本模块内 @2235852 | （canvas 本地加场，无 vendor 对应） | @2235852 |
 * | `I2`（虚拟→场景→模型 id 表） | vendor 导入 `kg as I2` | `I2` @1085747 | 逐字见下 |
 * | `H1`（虚拟模型清单） | 导入 `eq as H1` | `_ue` @1086298 | 逐字见下 |
 * | `lge`（音乐模型清单） | 导入 `fO as lge` | `BK` @1088247 | `BK=[D7,G7,F7,V7,A7,B7,L7,j7]` |
 * | `cge`（音效模型清单） | 导入 `fP as cge` | `HK` @1088276 | `HK=[T7,H7]` |
 * | `Af`（**全部**音频模型清单） | 导入 `dZ as Af` | `kue` @1088392 | `kue=[...UK,...BK,...HK]`（`UK=[A2,_2,U7]`@1088240） |
 * | `GI`（`wC`/`wg`/model chip 的目录） | canvas 本模块内 @2236212 | — | @2236212 |
 * | `zet`（wireName→modelId 全表，含 `selectable:!1`） | canvas 本模块内 @2236713 | — | @2236713 |
 *
 * ## 官方逐字原文（本地名 → 真实字符串值）
 *
 * ```js
 * // vendor-packages-DRvCmDjR.js @1027444
 * oa = (e=>(e.ELEVEN_MULTILINGUAL_V2="eleven_multilingual_v2", e.ELEVEN_V3="eleven_v3",
 *           e.SEED_AUDIO_1_0="doubao-seed-audio-1-0", e))
 * // @1027579
 * mr = (e=>(e.MINIMAX_MUSIC_2_6="music-2.6", e.ELEVEN_MUSIC_V1="music_v1", e.MUREKA_7_6="mureka-7.6",
 *           e.MUREKA_O2="mureka-o2", e.MUREKA_8="mureka-8", e.SONILO_MUSIC="sonilo-music",
 *           e.LYRIA_3_CLIP="lyria-3-clip-preview", e.LYRIA_3_PRO="lyria-3-pro-preview", e))
 * // @1027836
 * rl = (e=>(e.ELEVEN_SOUND_EFFECT="eleven_sound_effect", e.SONILO_SFX="sonilo-sfx", e))
 * // @1027926
 * Bo = (e=>(e.TEXT_TO_SPEECH="Text-to-Speech", e.MUSIC_GENERATION="Music", e.SOUND_EFFECT="Sound", e))
 * // @1085481
 * bS = (e=>(e.SEED_AUDIO_1_0="seed-audio-1-0", e.MINIMAX_MUSIC_26="minimax-music-26",
 *           e.ELEVENLABS_V3="elevenlabs-v3", e.MUREKA_V8="mureka-v8", e.MUREKA_O2="mureka-o2",
 *           e.SONILO_MUSIC="sonilo-music", e.LYRIA_3_CLIP="lyria-3-clip",
 *           e.LYRIA_3_PRO="lyria-3-pro", e))
 * // canvas @2235852
 * zE = {elevenlabs:{default:oa.ELEVEN_V3, byMode:{music:mr.ELEVEN_MUSIC_V1, sound:rl.ELEVEN_SOUND_EFFECT},
 *                   modes:["speech","music","sound"], virtual:bS.ELEVENLABS_V3},
 *       sonilo:{default:mr.SONILO_MUSIC, byMode:{sound:rl.SONILO_SFX},
 *               modes:["music","sound"], virtual:bS.SONILO_MUSIC},
 *       "doubao-seed-audio":{default:oa.SEED_AUDIO_1_0, modes:["speech"], virtual:bS.SEED_AUDIO_1_0}}
 * // canvas @2236212
 * GI = Object.entries(zE).map(([e,t])=>({wireName:e, virtual:t.virtual}))
 * // vendor-packages @1085747（逐字，含全部 8 个虚拟模型）
 * I2 = {"seed-audio-1-0":{[Bo.TEXT_TO_SPEECH]:oa.SEED_AUDIO_1_0},
 *       "minimax-music-26":{[Bo.MUSIC_GENERATION]:mr.MINIMAX_MUSIC_2_6},
 *       "elevenlabs-v3":{[Bo.TEXT_TO_SPEECH]:oa.ELEVEN_V3, [Bo.MUSIC_GENERATION]:mr.ELEVEN_MUSIC_V1,
 *                        [Bo.SOUND_EFFECT]:rl.ELEVEN_SOUND_EFFECT},
 *       "mureka-v8":{[Bo.MUSIC_GENERATION]:mr.MUREKA_8},
 *       "mureka-o2":{[Bo.MUSIC_GENERATION]:mr.MUREKA_O2},
 *       "sonilo-music":{[Bo.MUSIC_GENERATION]:mr.SONILO_MUSIC, [Bo.SOUND_EFFECT]:rl.SONILO_SFX},
 *       "lyria-3-clip":{[Bo.MUSIC_GENERATION]:mr.LYRIA_3_CLIP},
 *       "lyria-3-pro":{[Bo.MUSIC_GENERATION]:mr.LYRIA_3_PRO}}
 * // vendor-packages @1086298
 * H1 = [{value:"seed-audio-1-0",name:"Seed audio 1.0",nameKey:"audio.virtualModel.seedAudio10.name",
 *        icon:oe.SEEDANCE,descriptionKey:"audio.virtualModel.seedAudio10.description",isNew:!0,isFree:!1},
 *       {value:"minimax-music-26",name:"MiniMax Music 2.6",nameKey:"audio.virtualModel.minimaxMusic26.name",
 *        icon:oe.MINIMAX,descriptionKey:"audio.virtualModel.minimaxMusic26.description",isNew:!0,isFree:!1},
 *       {value:"elevenlabs-v3",name:"ElevenLabs V3",nameKey:"audio.virtualModel.elevenlabsV3.name",
 *        icon:oe.ELEVENLAB,descriptionKey:"audio.virtualModel.elevenlabsV3.description",isNew:!0,isFree:!1},
 *       {value:"mureka-v8",name:"Mureka V8",nameKey:"audio.virtualModel.murekaV8.name",icon:oe.MUREKA,
 *        descriptionKey:"audio.virtualModel.murekaV8.description",isFree:!0,
 *        featureTags:[{icon:C6,labelKey:"audio.featureTag.emotional"}]},
 *       {value:"mureka-o2",name:"Mureka O2",nameKey:"audio.virtualModel.murekaO2.name",icon:oe.MUREKA,
 *        descriptionKey:"audio.virtualModel.murekaO2.description",isFree:!0,
 *        featureTags:[{icon:v6,labelKey:"audio.featureTag.professional"}]},
 *       {value:"sonilo-music",name:"Sonilo Music",nameKey:"audio.virtualModel.soniloMusic.name",
 *        icon:oe.SONILO,descriptionKey:"audio.virtualModel.soniloMusic.description",isNew:!0,isFree:!1},
 *       {value:"lyria-3-clip",name:"Lyria 3 Clip",icon:oe.GOOGLE,
 *        descriptionKey:"audio.model.lyria3Clip.description",isNew:!0,isFree:!1,isHidden:!0},
 *       {value:"lyria-3-pro",name:"Lyria 3 Pro",icon:oe.GOOGLE,
 *        descriptionKey:"audio.model.lyria3Pro.description",isNew:!0,isFree:!1,isHidden:!0}]
 * // vendor-packages @1087928 / @1088046 / @1088083
 * wC = (e,t) => { const s = I2[e]?.[t]; if(!s) throw new Error(`Virtual model ${e} does not support scene ${t}`); return s }
 * G1 = (e) => GK.get(e) ?? K7            // GK = Map(modelId → virtualName) 由 I2 反转，K7="mureka-v8"
 * wg = (e) => { const t = I2[e]; return t ? _W.map(n=>n.value).filter(n=>n in t) : [] }
 * ```
 *
 * ## 结构差异（与本仓既有 `hie` 移植同一纪律，见 `generationChipController.ts` 文件头）
 * - `H1[].icon` 是官方 `oe` 图标**组件**枚举（`oe={…,SEEDANCE:kf,…,ELEVENLAB:Bz,MUREKA:$z,SONILO:nW,MINIMAX:Zz,GOOGLE:Wz}`
 *   @1017688），是 React 组件而非字符串。MTV 参数目录 JSON 未载入该字段（`hie` 的 `icon: jt?.icon`
 *   同样未落地）⇒ 本表 `icon` 直接**省略**，不编造。
 * - `H1[].isHidden===true` 的两条（`lyria-3-clip` / `lyria-3-pro`）**保留在表里**：`GI` 只含
 *   `elevenlabs`/`sonilo`/`doubao-seed-audio` 三条，`Xb`/`wC` 仍会对它们求值（`G1` 的表反查也含它们）。
 *   官方 model chip 的候选集来自 `GI`（3 条），不是 `H1`（8 条）。
 */

/** 官方 `GI` / `zE`：wire 名 ↔ 虚拟名目录（3 条，顺序 = `Object.entries` 顺序）。 */
export interface AudioWireEntry {
  wireName: string;
  virtual: string;
  default: string;
  /**
   * 官方 `zE` 里只有 `elevenlabs` / `sonilo` 两条带 `byMode`；`doubao-seed-audio` **没有**该键
   * ⇒ 逐字保持「缺键」形态（`Fet` 的 `n.byMode?.[t] ?? n.default` 对缺键走 `default`）。
   */
  byMode?: Readonly<Record<string, string>>;
  modes: readonly string[];
}

export const AUDIO_WIRE_ENTRIES: readonly AudioWireEntry[] = [
  {
    wireName: 'elevenlabs',
    default: 'eleven_v3',
    byMode: { music: 'music_v1', sound: 'eleven_sound_effect' },
    modes: ['speech', 'music', 'sound'],
    virtual: 'elevenlabs-v3',
  },
  {
    wireName: 'sonilo',
    default: 'sonilo-music',
    byMode: { sound: 'sonilo-sfx' },
    modes: ['music', 'sound'],
    virtual: 'sonilo-music',
  },
  {
    wireName: 'doubao-seed-audio',
    default: 'doubao-seed-audio-1-0',
    modes: ['speech'],
    virtual: 'seed-audio-1-0',
  },
];

/** 官方 `GI = Object.entries(zE).map(([e,t])=>({wireName:e,virtual:t.virtual}))` @2236212（逐字）。 */
export const AUDIO_WIRE_DIRECTORY: readonly { wireName: string; virtual: string }[] =
  AUDIO_WIRE_ENTRIES.map(({ wireName, virtual }) => ({ wireName, virtual: String(virtual) }));

/* ------------------------------------------------------------------ *
 * 官方枚举（`oa` / `mr` / `rl` / `Bo` / `bS`）—— 逐字字符串值
 * ------------------------------------------------------------------ */

/** 官方 `oa`（语音/对话模型 id，vendor `mt` @1027444）。 */
export const AUDIO_SPEECH_MODEL_ID = {
  ELEVEN_MULTILINGUAL_V2: 'eleven_multilingual_v2',
  ELEVEN_V3: 'eleven_v3',
  SEED_AUDIO_1_0: 'doubao-seed-audio-1-0',
} as const;

/** 官方 `mr`（音乐模型 id，vendor `Pe` @1027579）。 */
export const AUDIO_MUSIC_MODEL_ID = {
  MINIMAX_MUSIC_2_6: 'music-2.6',
  ELEVEN_MUSIC_V1: 'music_v1',
  MUREKA_7_6: 'mureka-7.6',
  MUREKA_O2: 'mureka-o2',
  MUREKA_8: 'mureka-8',
  SONILO_MUSIC: 'sonilo-music',
  LYRIA_3_CLIP: 'lyria-3-clip-preview',
  LYRIA_3_PRO: 'lyria-3-pro-preview',
} as const;

/** 官方 `rl`（音效模型 id，vendor `En` @1027836）。 */
export const AUDIO_SOUND_MODEL_ID = {
  ELEVEN_SOUND_EFFECT: 'eleven_sound_effect',
  SONILO_SFX: 'sonilo-sfx',
} as const;

/** 官方 `Bo`（音频场景，vendor `xn` @1027926）。 */
export const AUDIO_SCENE = {
  TEXT_TO_SPEECH: 'Text-to-Speech',
  MUSIC_GENERATION: 'Music',
  SOUND_EFFECT: 'Sound',
} as const;

/** 官方 `bS`（虚拟模型 id，vendor `FK` @1085481）。 */
export const AUDIO_VIRTUAL_MODEL_ID = {
  SEED_AUDIO_1_0: 'seed-audio-1-0',
  MINIMAX_MUSIC_26: 'minimax-music-26',
  ELEVENLABS_V3: 'elevenlabs-v3',
  MUREKA_V8: 'mureka-v8',
  MUREKA_O2: 'mureka-o2',
  SONILO_MUSIC: 'sonilo-music',
  LYRIA_3_CLIP: 'lyria-3-clip',
  LYRIA_3_PRO: 'lyria-3-pro',
} as const;

/** 官方 `_W`（场景清单，vendor `_W` @1028036；`wg` 就是按它的顺序过滤）。 */
export const AUDIO_SCENE_ORDER: readonly string[] = [
  AUDIO_SCENE.TEXT_TO_SPEECH,
  AUDIO_SCENE.MUSIC_GENERATION,
  AUDIO_SCENE.SOUND_EFFECT,
];

/**
 * 官方 `Ket`（canvas @2240245，逐字）：
 * ```js
 * Ket={[Bo.TEXT_TO_SPEECH]:"speech",[Bo.MUSIC_GENERATION]:"music",[Bo.SOUND_EFFECT]:"sound"}
 * ```
 * 场景 ↔ **虚拟面 mode**（`zE[wire].modes` / `byMode` 用的就是这套）。
 * `Fet(e,t)` 的第二个参数 `t` 是它出的 mode（`uie` 的 `kre({status:"known",scene})` ⇒ `Ket[scene]`）。
 */
export const AUDIO_SCENE_MODE: Readonly<Record<string, string>> = {
  [AUDIO_SCENE.TEXT_TO_SPEECH]: 'speech',
  [AUDIO_SCENE.MUSIC_GENERATION]: 'music',
  [AUDIO_SCENE.SOUND_EFFECT]: 'sound',
};

/* ------------------------------------------------------------------ *
 * 官方 `I2`（虚拟 → 场景 → 模型 id；vendor @1085747，逐字）
 * ------------------------------------------------------------------ */

/** 官方 `I2`。 */
export const AUDIO_VIRTUAL_SCENE_MODEL: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'seed-audio-1-0': { [AUDIO_SCENE.TEXT_TO_SPEECH]: AUDIO_SPEECH_MODEL_ID.SEED_AUDIO_1_0 },
  'minimax-music-26': { [AUDIO_SCENE.MUSIC_GENERATION]: AUDIO_MUSIC_MODEL_ID.MINIMAX_MUSIC_2_6 },
  'elevenlabs-v3': {
    [AUDIO_SCENE.TEXT_TO_SPEECH]: AUDIO_SPEECH_MODEL_ID.ELEVEN_V3,
    [AUDIO_SCENE.MUSIC_GENERATION]: AUDIO_MUSIC_MODEL_ID.ELEVEN_MUSIC_V1,
    [AUDIO_SCENE.SOUND_EFFECT]: AUDIO_SOUND_MODEL_ID.ELEVEN_SOUND_EFFECT,
  },
  'mureka-v8': { [AUDIO_SCENE.MUSIC_GENERATION]: AUDIO_MUSIC_MODEL_ID.MUREKA_8 },
  'mureka-o2': { [AUDIO_SCENE.MUSIC_GENERATION]: AUDIO_MUSIC_MODEL_ID.MUREKA_O2 },
  'sonilo-music': {
    [AUDIO_SCENE.MUSIC_GENERATION]: AUDIO_MUSIC_MODEL_ID.SONILO_MUSIC,
    [AUDIO_SCENE.SOUND_EFFECT]: AUDIO_SOUND_MODEL_ID.SONILO_SFX,
  },
  'lyria-3-clip': { [AUDIO_SCENE.MUSIC_GENERATION]: AUDIO_MUSIC_MODEL_ID.LYRIA_3_CLIP },
  'lyria-3-pro': { [AUDIO_SCENE.MUSIC_GENERATION]: AUDIO_MUSIC_MODEL_ID.LYRIA_3_PRO },
};

/**
 * 官方 `GK`（vendor @1087810，逐字）：`const e=new Map; for(const[t,n]of Object.entries(I2)) for(const s of Object.values(n)) e.set(s,t)`。
 *
 * ⚠️ 官方 `I2` 里同一个 modelId 可映射到**两个**虚拟名：`music_v1` 同时出现在
 * `elevenlabs-v3[MUSIC_GENERATION]` 与（`zet` 里 `wireName:"music_v1"` 的旧 wire 名）——
 * `GK` 是 `Map`，后写覆盖 ⇒ 结果由 `I2` 的键顺序决定，本实现逐字保持 `Object.entries` 顺序。
 */
export const AUDIO_MODEL_TO_VIRTUAL: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [virtual, byScene] of Object.entries(AUDIO_VIRTUAL_SCENE_MODEL)) {
    for (const modelId of Object.values(byScene)) map.set(modelId, virtual);
  }
  return map;
})();

/** 官方 `K7`（vendor @1087795）。 */
export const AUDIO_DEFAULT_VIRTUAL = 'mureka-v8';

/* ------------------------------------------------------------------ *
 * 官方 `H1`（虚拟模型清单；vendor `_ue` @1086298）
 * ------------------------------------------------------------------ */

export interface AudioVirtualModel {
  value: string;
  name: string;
  nameKey?: string;
  /** 官方是 `oe.*` 图标组件（`oe`@1017688）；MTV 无载具 ⇒ 本表**不含**该字段（见文件头）。 */
  descriptionKey: string;
  isNew?: boolean;
  isFree: boolean;
  isHidden?: boolean;
}

/** 官方 `H1`（8 条，顺序逐字）。 */
export const AUDIO_VIRTUAL_MODELS: readonly AudioVirtualModel[] = [
  { value: 'seed-audio-1-0', name: 'Seed audio 1.0', nameKey: 'audio.virtualModel.seedAudio10.name', descriptionKey: 'audio.virtualModel.seedAudio10.description', isNew: true, isFree: false },
  { value: 'minimax-music-26', name: 'MiniMax Music 2.6', nameKey: 'audio.virtualModel.minimaxMusic26.name', descriptionKey: 'audio.virtualModel.minimaxMusic26.description', isNew: true, isFree: false },
  { value: 'elevenlabs-v3', name: 'ElevenLabs V3', nameKey: 'audio.virtualModel.elevenlabsV3.name', descriptionKey: 'audio.virtualModel.elevenlabsV3.description', isNew: true, isFree: false },
  { value: 'mureka-v8', name: 'Mureka V8', nameKey: 'audio.virtualModel.murekaV8.name', descriptionKey: 'audio.virtualModel.murekaV8.description', isFree: true },
  { value: 'mureka-o2', name: 'Mureka O2', nameKey: 'audio.virtualModel.murekaO2.name', descriptionKey: 'audio.virtualModel.murekaO2.description', isFree: true },
  { value: 'sonilo-music', name: 'Sonilo Music', nameKey: 'audio.virtualModel.soniloMusic.name', descriptionKey: 'audio.virtualModel.soniloMusic.description', isNew: true, isFree: false },
  { value: 'lyria-3-clip', name: 'Lyria 3 Clip', descriptionKey: 'audio.model.lyria3Clip.description', isNew: true, isFree: false, isHidden: true },
  { value: 'lyria-3-pro', name: 'Lyria 3 Pro', descriptionKey: 'audio.model.lyria3Pro.description', isNew: true, isFree: false, isHidden: true },
];

/* ------------------------------------------------------------------ *
 * 官方 `lge` / `cge` / `Af`（vendor `BK` / `HK` / `kue`）
 * ------------------------------------------------------------------ */

/** 官方 `BK`（音乐模型清单，vendor @1088247）：`[D7,G7,F7,V7,A7,B7,L7,j7]`。 */
export const AUDIO_MUSIC_MODELS: readonly string[] = [
  AUDIO_MUSIC_MODEL_ID.MINIMAX_MUSIC_2_6,
  AUDIO_MUSIC_MODEL_ID.MUREKA_8,
  AUDIO_MUSIC_MODEL_ID.MUREKA_O2,
  AUDIO_MUSIC_MODEL_ID.MUREKA_7_6,
  AUDIO_MUSIC_MODEL_ID.ELEVEN_MUSIC_V1,
  AUDIO_MUSIC_MODEL_ID.SONILO_MUSIC,
  AUDIO_MUSIC_MODEL_ID.LYRIA_3_CLIP,
  AUDIO_MUSIC_MODEL_ID.LYRIA_3_PRO,
];

/** 官方 `HK`（音效模型清单，vendor @1088276）：`[T7,H7]`。 */
export const AUDIO_SOUND_MODELS: readonly string[] = [
  AUDIO_SOUND_MODEL_ID.ELEVEN_SOUND_EFFECT,
  AUDIO_SOUND_MODEL_ID.SONILO_SFX,
];

/**
 * 官方 `UK = [A2,_2,U7]`（vendor @1088240）—— 三个 `moodSupport` 模型，即 `Af` 里的
 * **语音（TTS）** 成员。⚠️ **推断**：`Af`（`kue=[...UK,...BK,...HK]`）共 13 项，`lge` 8 项、
 * `cge` 2 项都是**成员身份**（不是索引）；`Mre` 只按 `model===e` 判定 ⇒ 剩 3 项只能是 `UK`，
 * 而 `UK` 三项正是 `oa.ELEVEN_MULTILINGUAL_V2` / `oa.ELEVEN_V3` / `oa.SEED_AUDIO_1_0`
 * （三者与 `oa` 枚举成员一一对应，`A2`/`_2`/`U7` 的 `model` 字段已逐字核对）。
 */
export const AUDIO_SPEECH_MODELS: readonly string[] = [
  AUDIO_SPEECH_MODEL_ID.ELEVEN_MULTILINGUAL_V2,
  AUDIO_SPEECH_MODEL_ID.ELEVEN_V3,
  AUDIO_SPEECH_MODEL_ID.SEED_AUDIO_1_0,
];

/** 官方 `Af`（vendor `kue @1088392`）：`[...UK,...BK,...HK]`。 */
export const AUDIO_MODELS: readonly string[] = [
  ...AUDIO_SPEECH_MODELS,
  ...AUDIO_MUSIC_MODELS,
  ...AUDIO_SOUND_MODELS,
];

/**
 * 官方 `Ar = [...z7,...W7,...jK]`（vendor @1084132）里**唯一**带 `supportsVideoInput` 的音频条目：
 * `B7`（`sonilo-music`，`supportsVideoInput:!0` @1072177）与
 * `H7`（`sonilo-sfx`，`supportsVideoInput:!0` @1075469）。
 * `P7`（Lyria 基类）显式 `supportsVideoInput:!1` @1057748，其余 10 个音频条目**根本没有该字段**。
 *
 * 官方 `Gp`（vendor `wue` @1084959，逐字）：
 * ```js
 * function wue(e){ const t=Ar.find(n=>n.model===e); return !t || !("supportsVideoInput" in t) ? !1 : t.supportsVideoInput || !1 }
 * ```
 * ⇒ 只有上面两条为 `true`（其余含「无该字段」一律 `false`）。MTV 参数目录 JSON 未载入该字段
 * ⇒ 单独落成这张逐字小表，**不补默认值**。
 */
export const AUDIO_MODEL_SUPPORTS_VIDEO_INPUT: ReadonlySet<string> = new Set([
  AUDIO_MUSIC_MODEL_ID.SONILO_MUSIC,
  AUDIO_SOUND_MODEL_ID.SONILO_SFX,
]);

/** 官方 `Gp`（vendor `wue` @1084959）的逐字等价：查不到条目或条目无该键 ⇒ `false`。 */
export function audioModelSupportsVideoInput(modelId: string | undefined | null): boolean {
  if (!modelId) return false;
  return AUDIO_MODEL_SUPPORTS_VIDEO_INPUT.has(modelId);
}

/**
 * 官方 `WI(e)`（canvas @2249668，逐字）里那两行 id 字面量（**本轮补上，此前被当作"省略"**）：
 * ```js
 * const l = e === "sonilo-music" ? [30,60,120] : e === "sonilo-sfx" ? [5,10,30] : void 0;
 * ```
 * `WI` 的返回值是 `{kind:"audio", nameKey, icon, audioScene: Mre(e), durations: l, defaultDuration: i}`，
 * 其中 `durations` 只对这两个 sonilo 模型有值（其余 `undefined`）。
 * `uie` 的 `de` 用它兜底：`return lO(q?.durations, g).map(Se=>({value:String(Se),label:`${Se}s`}))`。
 */
export function audioModelDurations(modelId: string | undefined | null): number[] | undefined {
  if (modelId === AUDIO_MUSIC_MODEL_ID.SONILO_MUSIC) return [30, 60, 120];
  if (modelId === AUDIO_SOUND_MODEL_ID.SONILO_SFX) return [5, 10, 30];
  return undefined;
}

/**
 * 官方 `Og("audio", t, n)`（canvas @2250212 邻域，逐字）：
 * ```js
 * function Og(e,t,n){
 *   if(n) return !0;
 *   switch(e){
 *     case "image": return qo[t]?.isFree === !0;
 *     case "video": return Hp(t)?.isFree === !0;
 *     case "audio": { const o = G1(t); return H1.find(r=>r.value===o)?.isFree === !0 }
 *     …
 * ```
 * 即：音频的「免费额度」查的是 **`H1` 虚拟模型**（`isFree===true` 的只有 `mureka-v8` / `mureka-o2`）。
 *
 * ⚠️ 本仓 `modelParamCatalog.ts` 的 `modelIsFree` 目前对 `kind==='audio'` **恒 `false`**
 * （那是第 63 轮「音频目录未提取」时的占位；该文件归其它代理，本轮按纪律**不修改**）。
 * 本函数是官方音频分支的**逐字落点**，音频 chip 一律用它。
 *
 * ★ round 129：与 `modelParamCatalog.modelIsFree` **同一处纪律、同一处修正** ——
 *   `isPayingCustomer` 收窄为「**已知的**付费态（`boolean | null`）」：官方 `Og(e,t,n)` 的 `n`
 *   在本仓没有数据源（MTV 无订阅/付费态；上游土豆的 `enable_groups`/`usable_group`
 *   既不是官方读的字段，也不声明本账号所属分组 —— 见 `modelParamCatalog.ts` 的 round 129 段）
 *   ⇒ 未知时**不阻断**；只有宿主明确传 `false`（已知没付过费）才维持官方受限判定。
 *   不加这一条，`H1` 里只有 `mureka-v8`/`mureka-o2` 两个 `isFree:true` 的虚拟模型能过，
 *   其余音频模型的 model option `disabledReason` 与 `confirmDisabledReason`
 *   （`generationChipController.ts` 的两处 `tx(t, 'video.modelRestricted', 'Subscription required')`）
 *   都会落到 `video.modelRestricted`（"Subscription required"）—— 同一个误报的另一半。
 */
export function audioModelIsFree(
  wireName: string | undefined | null,
  /** 见 `modelParamCatalog.modelIsFree` 第三参：`false` = 已知没付过费；`null`/`undefined` = 未知。 */
  isPayingCustomer: boolean | null,
): boolean {
  if (isPayingCustomer !== false) return true;
  if (!wireName) return false;
  const virtual = AUDIO_WIRE_DIRECTORY.find((entry) => entry.wireName === wireName)?.virtual;
  return AUDIO_VIRTUAL_MODELS.find((entry) => entry.value === virtual)?.isFree === true;
}

/* ------------------------------------------------------------------ *
 * 官方纯函数（逐字移植）
 * ------------------------------------------------------------------ */

/**
 * 官方 `Mre`（canvas @2249494，逐字）：
 * ```js
 * function Mre(e){
 *   if(lge.some(t=>t.model===e)) return Bo.MUSIC_GENERATION;
 *   if(cge.some(t=>t.model===e)) return Bo.SOUND_EFFECT;
 *   if(Af.some(t=>t.model===e)) return Bo.TEXT_TO_SPEECH
 * }
 * ```
 */
export function audioSceneOfModel(modelId: string | undefined | null): string | undefined {
  if (!modelId) return undefined;
  if (AUDIO_MUSIC_MODELS.includes(modelId)) return AUDIO_SCENE.MUSIC_GENERATION;
  if (AUDIO_SOUND_MODELS.includes(modelId)) return AUDIO_SCENE.SOUND_EFFECT;
  if (AUDIO_MODELS.includes(modelId)) return AUDIO_SCENE.TEXT_TO_SPEECH;
  return undefined;
}

/**
 * 官方 `G1`（vendor `Tue` @1088046，逐字）：
 * ```js
 * function Tue(e){ return GK.get(e) ?? K7 }   // GK 由 I2 反转，K7="mureka-v8"
 * ```
 */
export function audioVirtualOfModel(modelId: string | undefined | null): string {
  if (!modelId) return AUDIO_DEFAULT_VIRTUAL;
  return AUDIO_MODEL_TO_VIRTUAL.get(modelId) ?? AUDIO_DEFAULT_VIRTUAL;
}

/**
 * 官方 `wg`（vendor `Nue` @1088083，逐字）：
 * ```js
 * function Nue(e){ const t=I2[e]; return t ? _W.map(n=>n.value).filter(n=>n in t) : [] }
 * ```
 */
export function audioScenesOfVirtual(virtual: string | undefined | null): string[] {
  if (!virtual) return [];
  const table = AUDIO_VIRTUAL_SCENE_MODEL[virtual];
  if (!table) return [];
  return AUDIO_SCENE_ORDER.filter((scene) => scene in table);
}

/**
 * 官方 `wC`（vendor `Iue` @1087928，逐字）：
 * ```js
 * function Iue(e,t){ const s=I2[e]?.[t]; if(!s) throw new Error(`Virtual model ${e} does not support scene ${t}`); return s }
 * ```
 *
 * ⚠️ 官方**会抛异常**。MTV 侧调用点（model chip 的 `Ue = nt ? wC(Se,nt) : void 0`）里
 * `nt` 恒取自 `wg(Se)`，理论不可达；但 MTV 的 `scene` 来自 `params.audioScene`（任意载荷），
 * 可达 ⇒ MTV 不得崩溃：此处返回 `undefined`，并**不补任何模型 id**（调用点把它当 `Ue===void 0`，
 * 即官方 `nt` 为空时的同一分支）。偏差已登记 §73。
 */
export function audioModelForScene(
  virtual: string | undefined | null,
  scene: string | undefined | null,
): string | undefined {
  if (!virtual || !scene) return undefined;
  return AUDIO_VIRTUAL_SCENE_MODEL[virtual]?.[scene];
}

/**
 * 官方 `Fet`（canvas @2236282，逐字）：
 * ```js
 * function Fet(e,t){ if(!e||!t) return; const n=zE[e]; if(!(!n||!n.modes.includes(t))) return n.byMode?.[t] ?? n.default }
 * ```
 * 注意：参数 `t` 是 **wire 名**（`Z` 转出来的），`n.modes` 用的是**虚拟面场景名**（`speech`/`music`/`sound`）。
 */
export function audioModelForWireAndMode(
  wireName: string | undefined | null,
  mode: string | undefined | null,
): string | undefined {
  if (!wireName || !mode) return undefined;
  const entry = AUDIO_WIRE_ENTRIES.find((item) => item.wireName === wireName);
  if (!entry || !entry.modes.includes(mode)) return undefined;
  return entry.byMode?.[mode] ?? entry.default;
}

/**
 * 官方 `Zh`（canvas @2236510，逐字）：
 * ```js
 * function Zh(e){ if(e==null) return e; if(e.status!=="unknown"){
 *   for(const[t,n] of Object.entries(zE)) if(n.default===e.id || n.byMode && Object.values(n.byMode).includes(e.id)) return t;
 *   return Tre("audio",e) } }
 * ```
 * `Tre("audio", e)` 是 wire 名的反向目录（`zet`）：命中就返回该条的 `wireName`。
 */
export function audioWireOfModelEntity(
  entity: { status?: string; id?: string; displayName?: string } | null | undefined,
): string | undefined {
  if (entity == null) return undefined;
  if (entity.status === 'unknown') return undefined;
  const id = entity.id;
  for (const entry of AUDIO_WIRE_ENTRIES) {
    /* 官方 `n.byMode && Object.values(n.byMode).includes(e.id)` —— `byMode` 缺键时**短路**，
       不做任何「等价」处理。 */
    if (entry.default === id || (entry.byMode && Object.values(entry.byMode).includes(id as string))) {
      return entry.wireName;
    }
  }
  return AUDIO_WIRE_BY_MODEL_ID[id ?? '']?.wireName;
}

/**
 * 官方 `zet`（canvas @2236713 邻域，逐字全文；`Uet={image:Det,video:Let,audio:zet}` 的 audio 支）。
 *
 * ⚠️ 官方**不**从 `zet` 构造 `GI`；`GI` 只来自 `zE`（3 条）。`zet` 只在 `Zh` 的 `Tre("audio",e)`
 * 兜底里被查（14 条 wire 名，含旧名与 `selectable:!1` 的非上架条目，**全部逐字保留**）。
 * ```js
 * const zet=[{wireName:"doubao-seed-audio",modelId:oa.SEED_AUDIO_1_0},
 *            {wireName:"eleven-v3",modelId:oa.ELEVEN_V3},
 *            {wireName:"eleven-music-v1",modelId:mr.ELEVEN_MUSIC_V1},
 *            {wireName:"eleven-sound-effect",modelId:rl.ELEVEN_SOUND_EFFECT},
 *            {wireName:"music-2.6",modelId:mr.MINIMAX_MUSIC_2_6,selectable:!1},
 *            {wireName:"music_v1",modelId:mr.ELEVEN_MUSIC_V1,selectable:!1},
 *            {wireName:"mureka-8",modelId:mr.MUREKA_8,selectable:!1},
 *            {wireName:"mureka-o2",modelId:mr.MUREKA_O2,selectable:!1},
 *            {wireName:"sonilo-music",modelId:mr.SONILO_MUSIC},
 *            {wireName:"sonilo-sfx",modelId:rl.SONILO_SFX},
 *            {wireName:"eleven_v3",modelId:oa.ELEVEN_V3,selectable:!1},
 *            {wireName:"eleven_sound_effect",modelId:rl.ELEVEN_SOUND_EFFECT,selectable:!1},
 *            {wireName:"eleven_multilingual_v2",modelId:oa.ELEVEN_MULTILINGUAL_V2,selectable:!1},
 *            {wireName:"mureka-7.6",modelId:mr.MUREKA_7_6,selectable:!1}]
 * ```
 */
export interface AudioWireTableEntry {
  wireName: string;
  modelId: string;
  selectable?: false;
}

export const AUDIO_WIRE_TABLE: readonly AudioWireTableEntry[] = [
  { wireName: 'doubao-seed-audio', modelId: AUDIO_SPEECH_MODEL_ID.SEED_AUDIO_1_0 },
  { wireName: 'eleven-v3', modelId: AUDIO_SPEECH_MODEL_ID.ELEVEN_V3 },
  { wireName: 'eleven-music-v1', modelId: AUDIO_MUSIC_MODEL_ID.ELEVEN_MUSIC_V1 },
  { wireName: 'eleven-sound-effect', modelId: AUDIO_SOUND_MODEL_ID.ELEVEN_SOUND_EFFECT },
  { wireName: 'music-2.6', modelId: AUDIO_MUSIC_MODEL_ID.MINIMAX_MUSIC_2_6, selectable: false },
  { wireName: 'music_v1', modelId: AUDIO_MUSIC_MODEL_ID.ELEVEN_MUSIC_V1, selectable: false },
  { wireName: 'mureka-8', modelId: AUDIO_MUSIC_MODEL_ID.MUREKA_8, selectable: false },
  { wireName: 'mureka-o2', modelId: AUDIO_MUSIC_MODEL_ID.MUREKA_O2, selectable: false },
  { wireName: 'sonilo-music', modelId: AUDIO_MUSIC_MODEL_ID.SONILO_MUSIC },
  { wireName: 'sonilo-sfx', modelId: AUDIO_SOUND_MODEL_ID.SONILO_SFX },
  { wireName: 'eleven_v3', modelId: AUDIO_SPEECH_MODEL_ID.ELEVEN_V3, selectable: false },
  { wireName: 'eleven_sound_effect', modelId: AUDIO_SOUND_MODEL_ID.ELEVEN_SOUND_EFFECT, selectable: false },
  { wireName: 'eleven_multilingual_v2', modelId: AUDIO_SPEECH_MODEL_ID.ELEVEN_MULTILINGUAL_V2, selectable: false },
  { wireName: 'mureka-7.6', modelId: AUDIO_MUSIC_MODEL_ID.MUREKA_7_6, selectable: false },
];

/**
 * 官方 `zet` 的 `modelId → 首条命中` 反查（逐字按数组顺序 `find`，与官方一致：
 * 同一 `modelId` 有多条时取**第一条**，例 `ELEVEN_MUSIC_V1` ⇒ `"eleven-music-v1"`）。
 *
 * ⚠️ 官方 `Tre(kind, e)` 的确切实现未在 canvas / vendor-packages 中取到函数体
 * （`Tre` 不是 canvas 里的导入绑定，见 §73「确实取不到」清单）⇒ 这里只按 `zet` 数组
 * **顺序 find** 落地，不引入别的语义。
 */
export const AUDIO_WIRE_BY_MODEL_ID: Readonly<Record<string, AudioWireTableEntry>> = (() => {
  const map: Record<string, AudioWireTableEntry> = {};
  for (const entry of AUDIO_WIRE_TABLE) if (!(entry.modelId in map)) map[entry.modelId] = entry;
  return map;
})();
