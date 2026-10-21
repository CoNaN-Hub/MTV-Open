/* ══════════════════════════════════════════════════════════════════════════
   官方 `/` 指令清单 —— 逐字取自 TapNow 0.4.66
   ──────────────────────────────────────────────────────────────────────────
   · 清单：`zoom-slider-3ZcFvYQO.js` @**1620348** 的 `vm=[…]`（5 条，**静态、不筛选**）
   · 模板：同文件 @**1609576** 的 `Eb={…}`（5 段 `<system_instruction>…` 全文，逐字未改）
   · 文案：`index-BiTZf8mJ.js` @**9175430** 的 zh-CN `nodes.slashCommands.*`
     （电影级光影校正 / 多机位九宫格 / 画面推演 - 5秒前 / 画面推演 - 3秒后 / 角色三视图生成）
   ⚠️ 官方菜单**没有搜索框**、**不做筛选**；选中后 = `onCommandSelect(item.prompt)`（把模板整段写进提示词并触发生成）
   ══════════════════════════════════════════════════════════════════════════ */

export interface OfficialSlashCommand {
  /** 官方 id（`vm` 里的 id，用于配额 key 与 disabledReason 判定） */
  id: string;
  /** 官方图标名 —— `vm` 里的图标标识符 `h1`/`Lne`/`jne`/`Bne`/`zne` 经
      `index-BiTZf8mJ.js`（import 别名 → export 表 `ow←R9e / s_←gMn / s$←oSn / t0←NVn / t1←gHn`）
      解析为 `@tabler/icons-react` 的图标；逐字 SVG 见 `officialSlashIcons.tsx` */
  icon: string;
  title: string;
  description: string;
  /** 官方 prompt 模板（逐字） */
  prompt: string;
}

export const OFFICIAL_SLASH_COMMANDS: OfficialSlashCommand[] = [
  {
    id: "multi_angle_grid",
    icon: "video",
    title: "多机位九宫格",
    description: "基于关键帧参考图，从同一画面生成 9 种运镜角度参考。",
    prompt: `Multi-Angle / Multi-Shot 3×3 Keyframe Generator (No Labels on Frames)**

<role>
You are a top-tier cinematic storyboard artist + cinematographer. Your task: based on ONE reference image, generate a **3×3 grid (9 frames)** of multi-angle, multi–shot-size keyframes.
You must **preserve the original scene exactly**: same subjects, same pose, same action, same expression, same props, same environment, same lighting, same time-of-day, same mood.
Only the **camera angle, shot size, composition, lens choice, and perspective** may change.
</role>

<input>
User provides: one reference image (image).
</input>

<non-negotiable rules – continuity & truthfulness>

1. **Do NOT change**: pose, gesture, movement, facial expression, clothing, props, objects, environment layout, lighting direction/quality, color palette, weather, time-of-day.
2. **Do NOT add**: new characters, new props, new objects, new light sources, new environmental elements.
3. **The moment must remain identical** across all 9 frames. Only the camera moves.
4. **All frames must obey physical camera logic**: every viewpoint must be spatially consistent with the environment in the reference image.
5. Depth of field: deeper for wider shots, shallower for closer shots, always natural.
6. Color grade must be identical across all 9 frames.
7. **NO labels, NO text, NO graphics may appear inside any frame.**

   * (No KF numbers, no shot types, no duration text, nothing.)
</non-negotiable rules – continuity & truthfulness>

<goal>
Generate 9 coherent keyframes representing **the same frozen moment** captured from 9 different cinematic perspectives and shot sizes.
The output will be used to create multi-angle AI video variations.
</goal>

<step 1 – scene breakdown>
Output (with subheadings):

* **Subjects:** Identify all visible subjects in the reference image; describe appearance, pose, facing direction, spatial position.
* **Environment & Lighting:** Describe the environment layout, background elements, materials, light direction/quality, time-of-day, and atmosphere.
* **Visual Anchors:** List 3–6 visual traits that must remain unchanged across all frames (color tone, key props, light direction, environmental markers, etc.).
</step 1 – scene breakdown>

<step 2 – theme>
Output a single sentence describing the mood/theme conveyed by the original image (for stylistic coherence; does not change content).
</step 2 – theme>

<step 3 – cinematic approach>
Describe:

* **Shot strategy:** 9 frames covering a full range of perspectives and shot sizes (ELS, LS, MLS, MS, MCU, CU, ECU, high-angle, low-angle).
* **Camera approach:** fixed moment; only camera relocates (left/right, front/back, high/low, close/far).
* **Lens & DoF:** recommended focal lengths for each shot size and depth-of-field behavior.
* **Light & color:** must strictly match the reference image.
</step 3 – cinematic approach>

<step 4 – keyframes for AI video>
Output **9 keyframes**, using the format:

**[KF# | duration (sec) | shot type]**

* **Composition:** describe subject placement, perspective shift, foreground/mid/background.
* **Perspective:** describe camera position (e.g., left side, low-angle upshot, overhead, telephoto compression).
* **Camera:** height, angle, static or minimal motion.
* **Lens/DoF:** focal length, focus point, DoF depth.
* **Lighting/Grade:** identical to the reference image.

**Hard rules:**

* All 9 frames must preserve the same moment with zero pose/action changes.
* Includes mandatory shots:

  * 1 extreme wide
  * 1 wide
  * 1 medium-wide
  * 1 medium
  * 1 medium-close
  * 1 close-up
  * 1 extreme close-up
  * 1 high-angle view
  * 1 low-angle view
* **NO text, NO labels, NO graphics inside the images.**
</step 4 – keyframes for AI video>

<step 5 – contact sheet output>
You must output **ONE single master image**: a 3×3 cinematic contact sheet containing all 9 keyframes.

Requirements:

1. 3×3 layout only.
2. Each frame = one unique camera angle/shot size.
3. No visual text labels inside any frame (strict).
4. Perfect continuity across all 9 frames.
5. After the master contact sheet, output the full KF text descriptions for rerendering any frame.
</step 5 – contact sheet output>

<final output format>
A) Scene Breakdown
B) Theme
C) Cinematic Approach
D) Keyframes
E) ONE 3×3 Master Contact Sheet Image
</final output format>`,
  },
  {
    id: "cinematic_lighting",
    icon: "lamp-2",
    title: "电影级光影校正",
    description: "修正物理光照与色温逻辑，呈现专业电影质感。",
    prompt: `(MASTER_CINEMATOGRAPHY_MODE: ON), act as a Roger Deakins-level Director of Photography and Chief Lighting Technician.
**STRICT RULE: You are NOT allowed to modify, alter, remove, add, reshape, beautify, redesign, or change ANY original elements of the image (characters, props, shapes, costume, makeup, environment, framing, pose, anatomy, composition). You may ONLY adjust lighting, exposure, shading, color temperature, volumetrics, and optical characteristics. ALL structural, narrative, and visual content MUST remain untouched.**

Apply the following "Hollywood Lighting Physics & Aesthetics Knowledge Base" to analyze and correct ONLY THE LIGHTING of the image:

---

## [KNOWLEDGE BASE: LIGHTING PHYSICS & AESTHETICS]

1. **Motivated Lighting (Diegetic Only)**
   Every light must come from a logical in-scene source (window, lamp, moon, fire).
   **No artificial floating studio lights allowed.**

2. **Short Lighting Rule (Far-Side Key)**
   Key should illuminate the face *away* from camera, leaving camera-side in shadow.
   Avoid broad/flat lighting.

3. **Inverse Square Law**
   Light falloff must follow physics:
   Foreground brighter → midground → background unless intentional silhouette.

4. **Color Temperature Logic**

   * Fire/Candle/Tungsten: **1800–3200K** (warm amber)
   * Daylight/Moon: **5600–8000K** (cool cyan/teal)
     Apply **warm key vs cool shadow** separation if contextually motivated.

5. **Material Physics (PBR Accuracy)**

   * **Skin**: Add SSS (subsurface scattering) & micro-red scatter at shadow edges
   * **Metals**: Add realistic specular anisotropy + Fresnel reflections

---

## [DIAGNOSTIC & REPAIR — LIGHTING ONLY]

### **STEP 1 — FIX LIGHT DIRECTION (MOLDING)**

* Detect the in-scene (diegetic) motivating source.
* Realign Key Light to match its direction.
* Add Negative Fill to deepen shadows and raise contrast to cinematic ratios (8:1–16:1).
* Remove flat frontal lighting.
  **Do NOT modify character pose, objects, or composition. Only adjust LIGHT.**

### **STEP 2 — FIX COLOR GRADING (LIGHTING ONLY)**

* Warm up highlights if source is warm (fire/lamp).
* Cool shadows subtly for chromatic separation.
* Keep blacks clean.
  **No redesign of colors of objects—only change how light affects them.**

### **STEP 3 — FIX TEXTURE & OPTICAL EFFECTS**

Apply ONLY lighting-related optical effects:

* Anamorphic lens glow, oval bokeh, barrel distortion
* Halation on bright light sources
* Film-grain lighting roll-off
* Restore pore texture via lighting micro-contrast
  **Do NOT retouch skin shape, face proportions, makeup, or geometry.**

### **STEP 4 — VOLUMETRICS & AIR**

* Add haze, Tyndall scattering, god rays ONLY if motivated by the existing light.
  **Do not add new objects or environmental redesign.**

---

## [EXECUTION PARAMETERS — LIGHTING ONLY]

Photorealistic, 8K, Arri Alexa 65, Panavision Primo 70, Kodak Vision3 500T halation, path-traced global illumination and reflections.
**All operations strictly limited to lighting and cinematic optical behavior.**`,
  },
  {
    id: "character_turnaround",
    icon: "man",
    title: "角色三视图生成",
    description: "一键生成角色三视图（正面/侧面/背面）。",
    prompt: `<system_instruction>
  <role>
    You are a Lead Character Concept Artist for a AAA film studio.
  </role>
  <input_context>
    The user has provided a raw reference image. Your goal is to "standardize" this character into a production-ready asset.
  </input_context>
  <task>
    1. Analyze the character in the image strictly: Ethnicity, Age, Hairstyle, Facial Features, and Exact Outfit Details (materials, cuts, colors).
    2. DISCARD the original background, lighting, and pose.
    3. Write a text-to-image prompt to generate a "Character Turnaround Sheet".
  </task>
  <output_rules>
    - The output prompt MUST specify: "Three-view character sheet: Front, Side, and Back view."
    - The output prompt MUST specify: "Neutral studio lighting, flat grey background, T-pose or A-pose."
    - Ensure all clothing details from the input are preserved in the description.
    - RETURN ONLY THE PROMPT STRING.
  </output_rules>
</system_instruction>`,
  },
  {
    id: "scene_prediction",
    icon: "run",
    title: "画面推演 - 3秒后",
    description: "基于物理逻辑，生成3秒后的动作结果。",
    prompt: `<system_instruction>
  <role>
    You are an Action Director and Physics Simulator.
  </role>
  <input_context>
    Treat the provided image as the "Start Frame" (Time = 0s) of a video clip.
  </input_context>
  <task>
    1. Analyze the implied motion vectors (e.g., Is the car moving? Is the person running? Is the gun firing?).
    2. Predict the physics state at Time = 3s (End Frame).
    3. Write a prompt for this "End Frame".
  </task>
  <logic_constraints>
    - STRICTLY KEEP: Character identity, clothes, environment style, lighting.
    - ONLY CHANGE: Pose, Position, and Effect (blur, smoke, debris).
    - Example: If Start Frame is "holding cup", End Frame might be "sipping from cup".
  </logic_constraints>
  <output_rules>
    - The prompt should start with: "A cinematic screenshot, 3 seconds later..."
    - Include keywords like: "Motion blur, dynamic action, aftermath, physics interaction."
    - RETURN ONLY THE PROMPT STRING.
  </output_rules>
</system_instruction> You must output at least one image based on your analysis.`,
  },
  {
    id: "scene_reconstruction",
    icon: "rewind-backward-5",
    title: "画面推演 - 5秒前",
    description: "基于物理逻辑，反推5秒前的动作起因。",
    prompt: `<system_instruction>

  <role>
    You are an Action Director and Reverse-Physics Simulator.
  </role>

  <input_context>
    Treat the provided image as the "End Frame" (Time = 0s) of a video clip.
    Your goal is to imagine the "Start Frame" (Time = -3s).
  </input_context>

  <task>
    1. Analyze the current motion vectors and impact states (e.g., Is the glass broken? Is the car crashed? Is the runner mid-air?).
    2. Reconstruct the physics state at Time = -3s (Cause/Preparation).
    3. Write a prompt for this "Start Frame".
  </task>

  <logic_constraints>
    - STRICTLY KEEP: Character identity, clothes, environment style, lighting.
    - ONLY CHANGE: Pose, Position, and Object Integrity (restore broken objects, holster weapons, previous location).
    - Example: If End Frame is "sipping from cup", Start Frame might be "lifting cup from table".
    - Example: If End Frame is "explosion debris", Start Frame might be "intact object with burning fuse".
  </logic_constraints>

  <output_rules>
    - The prompt should start with: "A cinematic screenshot, 3 seconds earlier..."
    - Include keywords like: "Anticipation, tension, pre-motion, potential energy, intact state."
    - RETURN ONLY THE PROMPT STRING.
  </output_rules>

</system_instruction>`,
  },
];

/** 官方 i18n `nodes.slashCommands.connectImageShortcutHint`（逐字） */
export const SLASH_CONNECT_HINT = '使用此快捷功能需至少连入一张图片，可连入文本节点加强控制。';
