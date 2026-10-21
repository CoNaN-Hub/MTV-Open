
precision highp float;

uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_time;
uniform float u_phase;
uniform float u_throttle;
uniform float u_power;
uniform float u_surge;
uniform float u_burst;
uniform float u_aim;
uniform float u_stage;
uniform float u_intensity;
uniform float u_flickerAmount;
uniform float u_noiseScale;
uniform float u_smokeAmount;
uniform float u_fusion;
/** 故障度 0..1：色温掉档 + 收紧（不改 alpha 结构） / fault level: cooler colour & tighter plumes */
uniform float u_fault;
// 变体配置：左上象限亮核 uv（实测）与羽流尺度（动效径向频带缩放；大号 = 1）
// Variant config: measured TL core uv and the plume scale that sizes the
// dynamic radial bands (large logo = 1)
uniform vec2 u_core;
uniform float u_spread;
// 舞台模式的双区域结构：logo 本体（"真正大小区域"）只占画布 0.52，四周各留 24%
// 的展示舞台。排版时按舞台（画布）尺寸占位，logo 视觉上是小的，但透视倾斜、弯折、
// 爆发、湍流全部在舞台内完成——最坏合成位移约 0.14 画布，远小于留白，任何布局
// 下都不会被裁。
// Two-region stage: the logo proper (its "true size") spans only 0.52 of the
// canvas, leaving a 24% display stage on every side. Layouts reserve the stage
// (canvas) box, the logo reads small, and every dynamic — perspective tilt,
// bend, burst, turbulence — plays out inside the stage: the worst combined
// excursion is ~0.14 canvas, far under the margins, so no layout ever clips it.
const float STAGE_SCALE = 0.5200;
const float STAGE_BOTTOM = 0.2400;

// 值噪声与 fbm（无纹理依赖） / value noise + fbm (texture-free)
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p = p * 2.03 + vec2(17.13, 9.71);
    amp *= 0.5;
  }
  return v;
}

// 光斑色场（luv = logo 空间 uv，y 向下） / flame color field in logo-space uv
//
// 所有位移与亮度场均为全局连续场（不按象限独立），火焰可以涌过十字缝隙互相搅动；
// 缝隙熔接场把缝两侧采样向对方牵引并加融合微光，相邻喷焰自然熔为一体。
// All displacement & luminance fields are globally continuous (not per-quadrant),
// so flames slosh across the cross seams; the fusion field pulls samples across
// the seams and adds a merge glow so adjacent plumes melt together.
vec4 flame(vec2 luv) {
  // hover 透视（2.5D）：沿指针方向做梯形透视——指针侧羽流放大（更近）、对侧
  // 缩小（更远），形成整体向指针倾斜的纵深感；爆发时透视减半，让位于全向膨胀。
  // 无 hover（u_aim=0）时为恒等变换，稳态锁定不受影响。
  // Hover perspective (2.5D): keystone warp along the pointer direction — plumes
  // swell toward the pointer (nearer) and recede on the far side, tilting the
  // whole logo toward the cursor; halved during bursts so the omnidirectional
  // swell dominates. Identity when not hovering (u_aim=0), so the steady lock holds.
  // 幅度定稿为克制档：logo 是品牌资产，hover 只要"轻微转向"的暗示，
  // 夸张形变会让人先注意到特效而不是 logo 本身。
  // Amplitude is deliberately restrained: the logo is a brand asset, so hover
  // only hints at a turn — an exaggerated warp makes the effect, not the logo,
  // the thing people notice.
  vec2 pc = (u_pointer - 0.5)
    * (u_aim * (0.20 + 0.15 * u_throttle) * (1.0 - 0.5 * u_burst));
  vec2 relC = luv - 0.5;
  luv = 0.5 + relC / (1.0 + dot(relC, pc));

  // 折叠坐标只用于"距最近亮核"的权重（对折连续） / folded coords only for
  // nearest-core weights (continuous by construction)
  vec2 qw = min(luv, 1.0 - luv);
  vec2 relW = qw - u_core;
  float d2 = dot(relW, relW);
  float dLen = sqrt(d2);
  // 归一化径向距离与权重：动效频带按变体羽流尺度缩放，同一套常数适配两版 logo
  // Normalized radial distance & weights: the dynamic bands scale with the
  // variant's plume size, so one set of constants fits both logos
  float dn = dLen / u_spread;
  float sp2 = u_spread * u_spread;
  float coreW = exp(-d2 / (0.02 * sp2));
  float blobW = exp(-d2 / (0.09 * sp2));

  // 全局湍流：向上舔动的连续场，零均值；burst 时增幅
  // Global turbulence licking upward, zero-mean; amplified during bursts
  vec2 np = luv * (u_noiseScale * 7.5) + vec2(0.0, u_phase * 0.35);
  vec2 wob = vec2(fbm(np), fbm(np + vec2(7.31, 3.7))) - 0.5;
  float amp = u_flickerAmount
    * (1.0 + 0.6 * u_throttle + 0.9 * u_surge + 1.4 * u_burst) * u_power * 0.014;

  // 鼠标喷射矢量：根部锚定亮核，越远弯得越多；hover 推油门时弯折进一步加大
  // Pointer vectoring anchored at the cores; bending deepens while throttling up
  vec2 lean = (u_pointer - 0.5) * (u_aim * (0.08 + 0.06 * u_throttle))
    * smoothstep(0.05, 0.32, dn);

  // 熔接强度：纯动态驱动——稳态严格保持参考图原貌（分界如原稿），推大节流阀 /
  // 点火爆发时羽流膨胀交汇、熔为一体（物理上流量越大羽流越易交汇）
  // Fusion strength: dynamics-only — the steady state keeps the exact reference
  // (seams as designed); plumes expand and merge only while throttling up or
  // during the ignition burst, as real exhaust plumes do
  float sx = (luv.x - 0.5) / 0.07;
  float sy = (luv.y - 0.5) / 0.07;
  // 门控到接近满功率：收缩/点火初期采样处于放大态，桥接采样会在缝上拉出光带
  // Gated to near-full power: while shrunk the sampling is magnified and the
  // bridge would smear light bands across the seams
  float fusion = u_fusion * (0.9 * u_throttle + 1.3 * u_burst + 0.5 * u_surge)
    * smoothstep(0.7, 1.0, u_power);

  // 摆动权重：根部稳、尾缘摆——真实喷焰的羽流尖端摆动最大，外圈紫焰因此可见地舔动
  // Displacement weight: stable root, flapping tail — real plume tips flap the
  // most, so the outer purple visibly licks
  float tipW = smoothstep(0.12, 0.3, dn);

  // 外焰湍流：伪卷曲场——径向 + 切向两支独立多尺度 fbm 合成，涡既外移也打旋；
  // 采样坐标随相位缓慢横漂（图案边行进边演化，不是冻结噪声在平移），幅度再乘一层
  // 慢变"阵风"间歇场（湍流有阵发有平静，不是持续匀速的波列）。全部零均值，
  // 稳态时间平均仍等于参考图；中心近旁屏蔽（方向场在中心翻转，避免十字缝撕裂）。
  // Outer-flame turbulence: a pseudo-curl field — independent multi-scale fbm
  // components along the radial and tangential directions, so eddies both drift
  // outward and swirl. Sample coords also creep laterally with phase (the
  // pattern evolves while advecting instead of frozen noise sliding), and the
  // amplitude is gated by a slow "gust" intermittency field (real turbulence
  // comes in irregular puffs, not a steady wave train). All zero-mean, so the
  // steady time-average stays the reference; masked near the logo center where
  // the direction field flips (avoids tearing at the cross seams).
  float turbR = fbm(vec2(dot(luv, vec2(5.3, 3.7)) + u_phase * 0.31, dn * 7.0 - u_phase * 0.9)) - 0.5;
  float turbT = fbm(vec2(dot(luv, vec2(-3.9, 5.1)) - u_phase * 0.23, dn * 9.0 - u_phase * 1.4)) - 0.5;
  float gust = 0.35 + 0.65 * fbm(luv * 1.7 + vec2(u_phase * 0.13, -u_phase * 0.11));
  float bandOuter = smoothstep(0.1, 0.24, dn) * (1.0 - smoothstep(0.34, 0.5, dn));
  vec2 relCtr = luv - 0.5;
  float ctrLen = length(relCtr);
  vec2 dirC = relCtr / max(ctrLen, 0.05);
  vec2 perpC = vec2(-dirC.y, dirC.x);
  float centerGuard = smoothstep(0.1, 0.22, ctrLen);
  float ripAmp = u_flickerAmount * u_power
    * (1.0 + 0.7 * u_throttle + 1.2 * u_burst + 0.6 * u_surge);
  vec2 ripple = (dirC * turbR + perpC * turbT)
    * (0.075 * bandOuter) * gust * centerGuard * ripAmp;

  vec2 luv2 = luv + wob * amp * (0.3 + 0.3 * blobW + 0.9 * tipW) - lean + ripple;

  // 折叠 + 以亮核为锚的功率/爆发缩放（对称映射，跨缝连续）
  // Fold + per-core power/burst scaling (symmetric map, continuous across seams)
  vec2 sgn = vec2(luv2.x < 0.5 ? 0.0 : 1.0, luv2.y < 0.5 ? 0.0 : 1.0);
  vec2 q = mix(luv2, 1.0 - luv2, sgn);
  // 尺寸呼吸：整团火焰随噪声微胀微缩（零均值，四象限同步以保持缝上连续），
  // 软紫外缘随之进退——外焰闪动的主视觉信号
  // Size breathing: the whole flame swells/shrinks with zero-mean noise (all four
  // quadrants in sync to stay seam-continuous); the soft purple edge moving in
  // and out is the main visual cue of outer-flame flicker
  float breathe = (vnoise(vec2(u_phase * 0.7, 5.1)) - 0.5) * 0.12 * u_flickerAmount;
  float radiusScale = (0.25 + 0.75 * u_power)
    * (1.0 + 0.06 * u_throttle + 0.04 * u_surge)
    * (1.0 + 0.06 * (u_intensity - 1.0))
    * (1.0 + 0.22 * u_burst)
    * (1.0 + breathe * u_power);
  // 缝隙连续性：缩放 ≠ 1 时（强度/呼吸/油门都会让它偏离 1），缝两侧的镜像采样
  // 会轻微错位（纹理并非完美镜像对称），在深色底上显成一条细分界线。因此接近
  // 折叠边界时把该轴的缩放羽化回 1——缝上恒为恒等映射，逐像素连续；羽化只在
  // 非深度收缩时启用，熄火/点火的大缩放仍走全量缩放 + 防万花筒钳制。
  // Seam continuity: whenever the scale strays from 1 (intensity / breathing /
  // throttle all do), the mirrored samples on either side of a seam misalign
  // (the texture is not perfectly mirror-symmetric), showing as a hairline on
  // dark backgrounds. Feather each axis's scale back to 1 near the fold
  // boundary — the map is identity on the seam, pixel-continuous. The feather
  // only applies outside deep shrink; extinguish/ignite keep the full scaling
  // plus the kaleidoscope clamp below.
  // 塌缩门控只看功率驱动的收缩：故障态是"点变小变红"，必须保持清晰，
  // 不能被熄火用的塌缩虚化误伤，因此故障收缩在门控算完之后再乘。
  // The collapse gate follows the power-driven shrink only. A fault makes the
  // points smaller and redder but must stay crisp, so its shrink is applied
  // after the gate rather than feeding it.
  float shrinkGate = 1.0 - smoothstep(0.75, 0.92, radiusScale);
  radiusScale *= 1.0 - 0.2 * u_fault;
  vec2 seamProx = smoothstep(vec2(0.4), vec2(0.5), q) * (1.0 - shrinkGate);
  vec2 rsV = mix(vec2(radiusScale), vec2(1.0), seamProx);
  vec2 qs = u_core + (q - u_core) / max(rsV, vec2(0.05));

  // 折回原象限并采样定稿纹理（premultiplied） / unfold & sample the locked texture
  // 收缩防穿帮：功率下降时采样被放大，折叠坐标会越过 0.5 采到邻焰纹理，镜像
  // 折回即出现"万花筒"穿帮。双保险：硬钳制到折叠边界（杜绝一切镜像回卷）+
  // 按越界量羽化衰减（消除钳制平台重复缝线纹理的残留）。羽化衰减按 shrinkGate
  // 门控——稳态缝上是恒等映射，越界恒为 0，不得再让钳制在缝上压出暗线。
  // Shrink guard: low-power magnified sampling pushes folded coords past 0.5 into
  // the neighbor's texels; unfolding mirrors them back as a kaleidoscope. Double
  // guard: hard-clamp at the fold boundary (no mirrored content ever) plus an
  // overshoot fade (removes the clamped plateau repeating seam texels). The fade
  // is gated by shrinkGate — at steady state the seam map is identity and the
  // overshoot is 0, so the clamp must never press a dark line onto the seams.
  float crossOver = max(qs.x - 0.5, 0.0) + max(qs.y - 0.5, 0.0);
  qs = min(qs, vec2(0.5));

  vec2 suv = mix(qs, 1.0 - qs, sgn);
  // 越界采样经 clamp 落在透明边缘素上，天然羽化收尾 / out-of-range samples clamp
  // to the transparent border texels, ending in the flame's own feather
  //
  // 熄火收缩软化：放大采样会把纹理羽化边在屏幕上等比压缩（缩到 1/4 = 边缘锐 4 倍），
  // 收缩末段的小火团因此显出硬边。随收缩加深提高 mip 偏置，让火焰收拢时逐渐
  // 弥散虚化，最后一点以柔软光晕淡出而非硬边小图章。
  // Collapse softening: magnified sampling compresses the texture's feather on
  // screen proportionally (1/4 size = 4× sharper edge), so the final small
  // flame shows a hard rim. Raise the mip bias as the shrink deepens so the
  // flame diffuses while it collapses, ending as a soft glow instead of a
  // hard-edged stamp.
  vec4 col = texture2D(u_tex, clamp(suv, 0.0, 1.0), shrinkGate * 2.5);
  col *= 1.0 - shrinkGate * smoothstep(0.0, 0.06, crossOver);

  // 亮度呼吸：全局连续的时空场（零均值）；外圈占比拉高，紫焰与芯部一起闪
  // Continuous zero-mean luminance breathing; outer share raised so the purple
  // flickers along with the core
  float jitter = (vnoise(vec2(u_phase * 2.1 + luv.x * 1.3, luv.y * 2.2 + 4.7)) - 0.5)
    * 0.16 * u_flickerAmount * (1.0 + u_throttle);
  col.rgb *= 1.0 + jitter * (0.55 + 0.45 * blobW);

  // 火焰强度/节流阀/喷发增益（聚焦光斑内部） / intensity, throttle & burst gain
  col.rgb *= 1.0 + (0.5 * (u_intensity - 1.0) + 0.2 * u_throttle + 0.15 * u_surge
    + 0.18 * u_burst) * blobW;

  // 缝隙发光桥接：火焰是发光体，相邻喷焰的熔合 = 光的叠加。在缝带内无条件采样
  // 缝两侧的尾焰并 screen 叠加，把缝隙填成连续的火光（无条件采样保持均匀控制流）
  // Seam glow bridging: flames are emissive, so merging = adding light. Sample both
  // flanking tails unconditionally inside the seam bands and screen-composite them,
  // filling the seams with continuous flame light (uniform control flow preserved)
  float wv = exp(-sx * sx);
  float wh = exp(-sy * sy);
  vec4 bridgeV = texture2D(u_tex, clamp(suv + vec2(0.04, 0.0), 0.0, 1.0))
    + texture2D(u_tex, clamp(suv - vec2(0.04, 0.0), 0.0, 1.0));
  vec4 bridgeH = texture2D(u_tex, clamp(suv + vec2(0.0, 0.04), 0.0, 1.0))
    + texture2D(u_tex, clamp(suv - vec2(0.0, 0.04), 0.0, 1.0));
  vec4 bridge = (bridgeV * wv + bridgeH * wh) * (0.45 * fusion);
  col = col + bridge - col * bridge;

  // 点火爆发光环：从亮核向外扩张的白热冲击波（burst 衰减时半径外推）
  // Ignition blast ring: a white-hot wave expanding from the core as the burst decays
  float blastR = mix(0.05, 0.55, 1.0 - u_burst);
  float blast = exp(-pow((dn - blastR) / 0.08, 2.0)) * u_burst;

  // 节流阀/冲击白热化（premultiplied 白 = alpha） / throttle & surge white-hot boost
  float whiteMix = min(0.28 * u_throttle + 0.32 * u_surge
    + 0.3 * max(0.0, u_intensity - 1.0) + 0.3 * min(u_burst, 1.0), 0.7);
  col.rgb = mix(col.rgb, vec3(col.a), min(whiteMix * coreW + 0.5 * blast, 0.85));

  // 故障降温：喷口失去热量 → 色温整体掉档。把定稿的黄白→粉→紫梯度重新映射到
  // 暗红域（外缘暗红、中层赤红、芯部余温橙），亮度层次原样保留，因此仍是有体积、
  // 有渐变的发光体，而不是"整块调低不透明度"。同时收掉外圈弥散，四团变成更小
  // 更结实的红点。
  // Fault cooling: the nozzles lose heat, so the colour temperature drops. The
  // locked yellow→pink→purple ramp is remapped into deep reds (dark red rim,
  // crimson mid, warm ember core) while every luminance step survives — it stays
  // a volumetric glow instead of a globally faded stamp. The outer halo is
  // trimmed at the same time, tightening the four plumes into denser red points.
  float faultL = clamp(dot(col.rgb / max(col.a, 0.0015), vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
  // 四段色阶而非单一淡化：暗紫红外缘 → 血红中层 → 橙红过渡 → 琥珀热芯，
  // 段与段之间留足对比，冷却的金属/余烬质感就来自这几道明确的分界。
  // Four graded steps instead of one fade: dark maroon rim → blood red mid →
  // orange transition → amber hot core. The contrast between the steps is what
  // reads as cooling metal rather than a flat red patch.
  vec3 faultRgb = mix(vec3(0.30, 0.02, 0.035), vec3(0.86, 0.10, 0.04),
    smoothstep(0.12, 0.62, faultL));
  faultRgb = mix(faultRgb, vec3(1.0, 0.38, 0.10), smoothstep(0.62, 0.9, faultL));
  faultRgb = mix(faultRgb, vec3(1.0, 0.74, 0.36), smoothstep(0.9, 1.0, faultL));
  faultRgb *= 0.7 + 0.3 * faultL;
  // 热芯锚定在实测亮核上：纯按亮度分级会让芯部糊成一团，几何权重把余温焊在
  // 每个喷口的正中心
  // The hot core is anchored to the measured core: luminance grading alone smears
  // it, the geometric weight welds the residual heat to each nozzle's centre
  faultRgb += vec3(0.34, 0.13, 0.02) * coreW * (0.6 + 0.4 * faultL);
  col.rgb = mix(col.rgb, faultRgb * col.a, u_fault);
  // 外圈收敛：核心保持结实，弥散的紫外缘按故障度削掉（premultiplied 整体缩放）
  // Halo trim: the core stays solid while the diffuse rim is cut back with the
  // fault level (scaling the premultiplied colour as a whole)
  col *= 1.0 - 0.42 * u_fault * (1.0 - blobW);

  // 熄火冷却：低功率时暖色回落成余烬色 / cooling toward ember tones at low power
  col.rgb = mix(col.rgb * vec3(0.8, 0.5, 0.55), col.rgb, 0.35 + 0.65 * smoothstep(0.0, 0.7, u_power));

  // 功率 alpha 包络（burst 时略增稠） / power alpha envelope, denser during burst
  return col * (pow(u_power, 1.6) * (1.0 + 0.12 * u_burst));
}

// 烟雾层（uv = 画布空间，premultiplied 纯图层，由 main 垫在火焰之下）：
// 烟只在火焰特别大的瞬间出现——点火爆发时涌出一大片，油门全开时带少量；
// 稳态不出烟，火苗熄了烟随功率立即消失（无火无烟）。
// Smoke layer (canvas-space uv, premultiplied, composited BENEATH the flame by
// main): smoke only appears while the flame is exceptionally large — a big surge
// on the ignition burst, a light veil at full throttle. No smoke at steady
// state, and it vanishes with the flame's power (no fire, no smoke).
vec4 smokeLayer(vec2 uv) {
  // 烟量严格随火焰当下的猛烈程度：爆发为主、油门为辅，并乘功率
  // Smoke mass strictly follows the flame's momentary violence: burst-led with a
  // throttle assist, multiplied by power
  float vigor = 1.2 * u_burst + 0.3 * u_throttle * u_throttle;
  float strength = u_stage * u_smokeAmount * u_power * vigor;
  // 舞台锚定：烟的几何全部由舞台常量导出，调整舞台比例时烟随 logo 等比跟随
  // Stage-anchored: all smoke geometry derives from the stage constants, so it
  // tracks the logo whenever the stage scale changes
  float stageTop = 1.0 - STAGE_SCALE - STAGE_BOTTOM;
  float rootY = stageTop + STAGE_SCALE * 0.66;
  float topY = max(stageTop - STAGE_SCALE * 0.42, 0.03);
  if (strength < 0.001 || uv.y > rootY + 0.1) {
    return vec4(0.0);
  }
  float xf = abs(uv.x - 0.5);
  // 上升坐标：0 = 烟根（下排光斑高度，即火焰簇中心带），1 = logo 上方舞台留白。
  // 烟以火焰簇为中心从中间喷出——垫在火后，从十字空隙与羽流四周透出，向上弥散
  // Rise: 0 at the roots (lower-blob level, i.e. the cluster's center band), 1 in
  // the stage headroom above the logo. Smoke sprays from the middle of the flame
  // cluster — behind the plumes, spilling out around them as it billows up
  float rise = 1.0 - smoothstep(topY, rootY, uv.y);
  // 摆动/絮状均为 uv.x 的连续场（不得按左右分支取种子——浓烟时中线会露出接缝）
  // Sway & wisps are continuous fields of uv.x (never branch a per-side seed —
  // dense smoke would expose a seam along the centerline)
  float sway = (fbm(vec2(uv.y * 2.2 + uv.x * 3.0, u_time * 0.12)) - 0.5)
    * STAGE_SCALE * (0.07 + 0.25 * rise);
  // 烟云必须比火焰轮廓更宽：垫在火下的烟只有从羽流四周与顶上溢出才可见
  // The cloud must be wider than the flame silhouette: smoke behind the flame is
  // only visible where it spills out around and above the plumes
  float width = STAGE_SCALE * (0.125 + 0.39 * rise);
  float dx = xf - (STAGE_SCALE * 0.169 * (1.0 - 0.55 * rise) + sway);
  float column = exp(-dx * dx / (2.0 * width * width));
  // 上升平流的絮状细节 / upward-advected wisps
  float wisps = fbm(vec2(uv.x * 7.0, uv.y * 9.0 + u_time * 0.55));
  float body = smoothstep(0.3, 0.68, wisps + 0.14 * rise);
  // 根部淡入 + 画布顶淡出 / fade in at the roots, out near the canvas top
  float vfade = smoothstep(0.0, 0.18, rise) * (1.0 - smoothstep(0.85, 1.0, rise));
  // 画布四缘软融出：烟幕必须在触到任何边缘之前自然消散，不允许有被裁切感
  // Soft dissolve near every canvas edge: the sheet must dissolve before touching
  // any border — it must never feel cropped
  float edgeFade = smoothstep(0.0, 0.14, uv.x) * smoothstep(0.0, 0.14, 1.0 - uv.x)
    * smoothstep(0.0, 0.09, uv.y);
  float density = column * body * vfade * edgeFade;
  float aS = min(density * strength * 0.3, 0.6);
  // 低处偏暖、升高转冷灰 / warm near the flame, cooling gray higher up
  vec3 smokeCol = mix(vec3(0.78, 0.72, 0.71), vec3(0.71, 0.7, 0.78), rise);
  return vec4(smokeCol * aS, aS);
}

void main() {
  // 画布内等比居中的正方形映射（图像坐标 y 向下） / square-contain mapping, image y down
  float side = min(u_resolution.x, u_resolution.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / side + 0.5;
  uv.y = 1.0 - uv.y;

  // 舞台变换：logo 靠下、顶部留烟雾空间；对比模式（u_stage=0）保持满幅对位
  // Stage transform: logo sits low with smoke headroom; compare mode keeps full-frame
  float ss = mix(1.0, STAGE_SCALE, u_stage);
  vec2 so = mix(vec2(0.0), vec2((1.0 - STAGE_SCALE) * 0.5, 1.0 - STAGE_SCALE - STAGE_BOTTOM), u_stage);
  vec2 luv = (uv - so) / ss;

  // 舞台矩形不做裁切：参考纹理四周本就透明（CLAMP_TO_EDGE 采到透明边缘素），
  // 火焰弯折/爆发时可自由伸进画布留白区，以自身羽化收尾，任何方向都不会被切；
  // 掩码一律用乘法而非分支，保持 texture2D 的均匀控制流
  // No stage-rect clipping: the reference texture borders are transparent (CLAMP
  // samples the transparent edge), so bent/bursting flames extend freely into the
  // canvas padding and end with their own feather — never cut. Masks stay
  // multiplicative (no branches) to keep texture2D control flow uniform
  float insideCanvas = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  // 层序：烟垫在火焰之下（烟从火后方涌起，被亮焰遮挡才真实）
  // Layer order: smoke sits beneath the flame — surging up behind it, occluded
  // by the bright plumes, which is what reads as real
  vec4 col = flame(luv);
  vec4 smk = smokeLayer(uv);
  col = col + smk * (1.0 - col.a);
  gl_FragColor = clamp(col * insideCanvas, 0.0, 1.0);
}
