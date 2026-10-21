/**
 * RelightRig3D —— 官方打光「球灯架」的 three.js 逐字移植（对齐 `assets/index-TabNyQNQ.js`）
 * ══════════════════════════════════════════════════════════════════════════
 * 官方装配（逐字引用，行号见 `_off-relight.txt` 137..213）：
 *   · 场景 `Yt(host)`：`Scene` / `PerspectiveCamera(50,1,.1,100)` / `WebGLRenderer({antialias,alpha,powerPreference})`
 *       `setSize(le=256,le)`、`setPixelRatio(min(dpr,2))`、`shadowMap.enabled` + `PCFSoftShadowMap`
 *   · 球壳 `SphereGeometry(w*1.01, 64, 64)` + ShaderMaterial(`Ht`/`Kt`)：`baseColor #CCCCCC` / `shadowIntensity .85`
 *       / `centerAlpha .08`，`transparent depthWrite:false`
 *   · 经纬线：方位 8 条（`xe`）、仰角 5 条（`De`），每条约 `ne=64` 段；`Re()` 建带 `color`/`opacityAttr`
 *       属性的 Line（GL_LINE_STRIP，官方实测为连续曲线而非虚线）+ ShaderMaterial(`Xt`/`$t`, `globalOpacity`, AdditiveBlending)
 *   · 点阵：128×128 径向渐变 canvas → `CanvasTexture` → 5×8 个 Sprite（`scale .2`）
 *   · 目标板：`BoxGeometry(4,4,.2)` 六面材质（前后面 `#E0E0E0` roughness .5，其余 `#CCCCCC` roughness .7）
 *       + `AmbientLight(0xffffff,.8)`
 *   · 主光组：`PointLight(#F3F9FC, 6, 0)`（castShadow 1024², bias -.001）
 *       + `ConeGeometry(2.5, w=6, 128, 1, true)`（`rotation.x=-PI/2`、`z=w/2`，ShaderMaterial `ke`/`Ie`，DoubleSide + Additive）
 *       + `SphereGeometry(.4,48,48)`（ShaderMaterial `Ne`/`Te`，uniforms `rimPower:3 rimIntensity:1.5 glowIntensity:.3 lightDir`）
 *   · 轮廓光组：同结构，锥半径 2、灯泡半径 .3、`PointLight(W,3,0)`，默认 `visible:false`
 *   · `Le(state)` / `qt(state)`：`az=dispAz*PI/180, el=(90-dispEl)*PI/180` →
 *       `pos=(w·sin el·sin az, w·cos el, w·sin el·cos az)`、`lookAt(0,0,0)`、`bulb.uniforms.lightDir = pos.normalize()`
 *   · `Zt(state)`：逐帧 lerp 出壳/经纬线/点阵/光锥/灯泡/轮廓光的颜色与透明度（拖拽态与静止态两套目标值）
 *   · 交互：指针按下（轮廓光可见时对轮廓光灯泡做 1.5 半径球体射线拾取）→ 拖动（灵敏度 `Se=.8`，
 *       轮廓光方位锁 180、仰角 ±45）→ 抬起（主光吸附 `xe`/`De` 并 `bulbScale=1.5`，轮廓光吸附到 `ce` 预设）
 *   · 机位：`perspective {pos:(11,8,10)}` / `front {pos:(0,1,15)}`，`camera.position.lerp(camPos,.08)`
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { useT } from '../../../../i18n';
import {
  RELIGHT_AZIMUTH_STEPS,
  RELIGHT_ELEVATION_STEPS,
  RELIGHT_LIGHT_COLOR,
  RELIGHT_RIM_PRESETS,
  nearestRimPresetKey,
  relightIntensityFor,
  snapAzimuth,
  snapElevation,
} from '../../../../services/ai/relight';

/* ── 官方常量（逐字） ─────────────────────────────────────────────── */
const le = 256;                                    // 渲染边长
const w = 6;                                       // 灯架半径
const ne = 64;                                     // 经纬线段数
const Se = 0.8;                                    // 拖拽灵敏度
const Wt = 0.2;                                    // 拖动中 lerp 系数
const fe = 0.12;                                   // 静止时 lerp 系数
const xe = RELIGHT_AZIMUTH_STEPS;                  // 方位吸附网格
const De = RELIGHT_ELEVATION_STEPS;                // 仰角吸附网格
const LIGHT_COLOR = new THREE.Color(RELIGHT_LIGHT_COLOR);
const VIEW_PRESETS = {
  perspective: { pos: new THREE.Vector3(11, 8, 10), lookAt: new THREE.Vector3(0, 0, 0) },
  front: { pos: new THREE.Vector3(0, 1, 15), lookAt: new THREE.Vector3(0, 0, 0) },
} as const;

/* ── 官方 shader 原文（`Ht/Kt` 壳、`Xt/$t` 线、`ke/Ie` 锥、`Ne/Te` 灯泡） ── */
const SHELL_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const SHELL_FRAGMENT = `
  uniform vec3 baseColor;
  uniform float shadowIntensity;
  uniform float centerAlpha;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float nDotV = max(dot(vNormal, vViewDir), 0.0);
    float edge = pow(1.0 - nDotV, 2.0);
    vec3 col = mix(baseColor, vec3(0.0), edge * 0.5);
    float a = centerAlpha + edge * shadowIntensity;
    gl_FragColor = vec4(col, a);
  }
`;
const LINE_VERTEX = `
  attribute vec3 color;
  attribute float opacityAttr;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    vColor = color;
    vOpacity = opacityAttr;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const LINE_FRAGMENT = `
  uniform float globalOpacity;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    gl_FragColor = vec4(vColor, vOpacity * globalOpacity);
  }
`;
const CONE_VERTEX = `
  varying vec2 vUv;
  varying float vHeight;
  void main() {
    vUv = uv;
    vHeight = (position.y + ${(w / 2).toFixed(1)}) / ${w.toFixed(1)};
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const CONE_FRAGMENT = `
  uniform vec3 lightColor;
  uniform float opacity;
  uniform float time;
  varying vec2 vUv;
  varying float vHeight;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    float falloff = pow(vHeight, 2.5);
    float lat = abs(vUv.x - 0.5) * 2.0;
    float core = pow(1.0 - lat, 4.0);
    float fringe = pow(1.0 - lat, 0.8);
    float grain = hash(vUv + time * 0.05) * 0.12;
    vec3 base = mix(lightColor, vec3(1.0), pow(vHeight, 8.0) * 0.8);
    float a = (core * 2.0 + fringe * 2.0) * falloff * opacity;
    a *= (0.9 + grain);
    a *= smoothstep(0.0, 0.15, vHeight);
    gl_FragColor = vec4(base, a);
  }
`;
const BULB_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const BULB_FRAGMENT = `
  uniform vec3 lightColor;
  uniform float rimPower;
  uniform float rimIntensity;
  uniform float glowIntensity;
  uniform vec3 lightDir;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;

  void main() {
    float rim = 1.0 - max(0.0, dot(vNormal, vViewDir));
    rim = pow(rim, rimPower) * rimIntensity;
    float dotL = dot(vWorldNormal, -lightDir);
    float fg = pow(max(0.0, dotL), 1.5) * 1.5;
    float crescent = rim * max(0.0, dotL + 0.5);
    vec3 col = vec3(0.01) + lightColor * (fg + crescent);
    col += pow(max(0.0, dotL), 6.0) * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface RelightRig3DProps {
  imageSrc: string;
  azimuthDeg: number;
  elevationDeg: number;
  brightnessPercent: number;
  rimEnabled: boolean;
  rimAzimuthDeg: number;
  rimElevationDeg: number;
  viewMode: 'perspective' | 'front';
  onViewModeChange: (mode: 'perspective' | 'front') => void;
  lightColor?: string;
  disabled?: boolean;
  onAngleChange: (next: { azimuthDeg: number; elevationDeg: number }) => void;
  onRimPresetChange?: (preset: string) => void;
  onDragTargetChange?: (target: 'main' | 'rim') => void;
}

interface RigState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  shell: THREE.Mesh;
  mLines: Map<number, THREE.Line>;
  pLines: Map<number, THREE.Line>;
  dots: THREE.Sprite[];
  lightGroup: THREE.Group;
  bulb: THREE.Mesh;
  cone: THREE.Mesh;
  dotTexture: THREE.CanvasTexture;
  targetMesh: THREE.Mesh;
  targetFrontMat: THREE.MeshStandardMaterial;
  pointLight: THREE.PointLight;
  rimGroup: THREE.Group;
  rimBulb: THREE.Mesh;
  rimCone: THREE.Mesh;
  rimPointLight: THREE.PointLight;
  rimEnabled: boolean;
  rimDispAz: number;
  rimDispEl: number;
  rimTAz: number;
  rimTEl: number;
  rimOpacity: number;
  dragTarget: 'main' | 'rim';
  tColor: THREE.Color;
  dispColor: THREE.Color;
  tIntensity: number;
  dispIntensity: number;
  dispAz: number;
  dispEl: number;
  tAz: number;
  tEl: number;
  dragging: boolean;
  bulbScale: number;
  camPos: THREE.Vector3;
  camLook: THREE.Vector3;
}

/** 官方 `Le()`：由 `dispAz/dispEl` 写主光位置与 `lightDir` */
function applyLightPosition(state: RigState): void {
  const az = (state.dispAz * Math.PI) / 180;
  const el = ((90 - state.dispEl) * Math.PI) / 180;
  const x = w * Math.sin(el) * Math.sin(az);
  const y = w * Math.cos(el);
  const z = w * Math.sin(el) * Math.cos(az);
  state.lightGroup.position.set(x, y, z);
  state.lightGroup.lookAt(0, 0, 0);
  (state.bulb.material as THREE.ShaderMaterial).uniforms.lightDir.value.set(x, y, z).normalize();
  state.bulb.scale.setScalar(state.bulbScale);
}

/** 官方 `qt()`：轮廓光版本 */
function applyRimPosition(state: RigState): void {
  const az = (state.rimDispAz * Math.PI) / 180;
  const el = ((90 - state.rimDispEl) * Math.PI) / 180;
  const x = w * Math.sin(el) * Math.sin(az);
  const y = w * Math.cos(el);
  const z = w * Math.sin(el) * Math.cos(az);
  state.rimGroup.position.set(x, y, z);
  state.rimGroup.lookAt(0, 0, 0);
  (state.rimBulb.material as THREE.ShaderMaterial).uniforms.lightDir.value.set(x, y, z).normalize();
}

/** 官方 `Re()`：带 `color` / `opacityAttr` 两条属性的线几何 */
function createLine(points: THREE.Vector3[]): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const count = points.length;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('opacityAttr', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { globalOpacity: { value: 0 } },
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Line(geometry, material);
}

/** 官方 `re()`：按到灯位置的距离给线顶点着色 */
function paintLine(line: THREE.Line, lightPos: THREE.Vector3, hex: number, isMain: boolean): void {
  const points = line.userData.points as THREE.Vector3[];
  const colorAttr = line.geometry.attributes.color.array as Float32Array;
  const opacityAttr = line.geometry.attributes.opacityAttr.array as Float32Array;
  const color = new THREE.Color(hex);
  const range = isMain ? w * 1.2 : w * 1.5;
  const power = isMain ? 3 : 2;
  for (let i = 0; i < points.length; i += 1) {
    const h = Math.max(0, 1 - points[i].distanceTo(lightPos) / range) ** power;
    colorAttr[i * 3] = color.r * h;
    colorAttr[i * 3 + 1] = color.g * h;
    colorAttr[i * 3 + 2] = color.b * h;
    opacityAttr[i] = h;
  }
  line.geometry.attributes.color.needsUpdate = true;
  line.geometry.attributes.opacityAttr.needsUpdate = true;
}

/** 官方 `Yt(host)`：建整个球灯架场景（尺寸恒为 `le` × `le`） */
function createScene(host: HTMLDivElement): RigState {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.copy(VIEW_PRESETS.front.pos);
  camera.lookAt(VIEW_PRESETS.front.lookAt);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(le, le);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  /* 球壳 */
  const shellGeometry = new THREE.SphereGeometry(w * 1.01, 64, 64);
  const shellMaterial = new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(0xcccccc) },
      shadowIntensity: { value: 0.85 },
      centerAlpha: { value: 0.08 },
    },
    vertexShader: SHELL_VERTEX,
    fragmentShader: SHELL_FRAGMENT,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  scene.add(shell);

  /* 方位经纬线（xe 8 条） */
  const mLines = new Map<number, THREE.Line>();
  for (const azimuth of xe) {
    const points: THREE.Vector3[] = [];
    const u = (azimuth * Math.PI) / 180;
    for (let i = 0; i <= ne; i += 1) {
      const v = ((90 - (-90 + (i / ne) * 180)) * Math.PI) / 180;
      points.push(new THREE.Vector3(
        w * Math.sin(v) * Math.sin(u),
        w * Math.cos(v),
        w * Math.sin(v) * Math.cos(u),
      ));
    }
    const line = createLine(points);
    line.userData = { azimuth, points };
    scene.add(line);
    mLines.set(azimuth, line);
  }

  /* 仰角经纬线（De 5 条）：官方 `B=w*cos(U)` 是 y、`N=w*sin(U)` 是半径 */
  const pLines = new Map<number, THREE.Line>();
  for (const elevation of De) {
    const points: THREE.Vector3[] = [];
    const u = ((90 - elevation) * Math.PI) / 180;
    const y = w * Math.cos(u);
    const radius = w * Math.sin(u);
    for (let i = 0; i <= ne; i += 1) {
      const f = (i / ne) * Math.PI * 2;
      points.push(new THREE.Vector3(radius * Math.sin(f), y, radius * Math.cos(f)));
    }
    const line = createLine(points);
    line.userData = { elevation, points };
    scene.add(line);
    pLines.set(elevation, line);
  }

  /* 点阵 sprite（128×128 径向渐变贴图 + 5×8 个） */
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = 128;
  dotCanvas.height = 128;
  const ctx = dotCanvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const dotTexture = new THREE.CanvasTexture(dotCanvas);
  const dots: THREE.Sprite[] = [];
  for (const elevation of De) {
    const el = ((90 - elevation) * Math.PI) / 180;
    for (const azimuth of xe) {
      const az = (azimuth * Math.PI) / 180;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture, transparent: true, opacity: 0, depthWrite: false }));
      sprite.position.set(
        w * Math.sin(el) * Math.sin(az),
        w * Math.cos(el),
        w * Math.sin(el) * Math.cos(az),
      );
      sprite.scale.set(0.2, 0.2, 1);
      sprite.userData = { azimuth, elevation };
      scene.add(sprite);
      dots.push(sprite);
    }
  }

  /* 目标板 */
  const targetGeometry = new THREE.BoxGeometry(4, 4, 0.2);
  const targetFrontMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.5, metalness: 0.1 });
  const targetSideMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7, metalness: 0.05 });
  const targetMesh = new THREE.Mesh(targetGeometry, [targetSideMat, targetSideMat, targetSideMat, targetSideMat, targetFrontMat, targetFrontMat]);
  targetMesh.castShadow = true;
  targetMesh.receiveShadow = true;
  targetMesh.visible = false;
  scene.add(targetMesh);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  /* 主光组 */
  const lightGroup = new THREE.Group();
  const pointLight = new THREE.PointLight(LIGHT_COLOR.clone(), 6, 0);
  pointLight.color.setHex(LIGHT_COLOR.getHex());
  pointLight.castShadow = true;
  pointLight.shadow.mapSize.set(1024, 1024);
  pointLight.shadow.bias = -0.001;
  lightGroup.add(pointLight);

  const coneGeometry = new THREE.ConeGeometry(2.5, w, 128, 1, true);
  const coneMaterial = new THREE.ShaderMaterial({
    uniforms: {
      lightColor: { value: LIGHT_COLOR.clone() },
      opacity: { value: 0 },
      time: { value: 0 },
    },
    vertexShader: CONE_VERTEX,
    fragmentShader: CONE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.rotation.x = -Math.PI / 2;
  cone.position.z = w / 2;
  lightGroup.add(cone);

  const bulbGeometry = new THREE.SphereGeometry(0.4, 48, 48);
  const bulbMaterial = new THREE.ShaderMaterial({
    uniforms: {
      lightColor: { value: LIGHT_COLOR.clone() },
      rimPower: { value: 3 },
      rimIntensity: { value: 1.5 },
      glowIntensity: { value: 0.3 },
      lightDir: { value: new THREE.Vector3() },
    },
    vertexShader: BULB_VERTEX,
    fragmentShader: BULB_FRAGMENT,
    transparent: true,
    depthWrite: true,
  });
  const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
  lightGroup.add(bulb);
  scene.add(lightGroup);

  /* 轮廓光组 */
  const rimGroup = new THREE.Group();
  const rimPointLight = new THREE.PointLight(LIGHT_COLOR.clone(), 3, 0);
  rimPointLight.castShadow = false;
  rimGroup.add(rimPointLight);

  const rimConeGeometry = new THREE.ConeGeometry(2, w, 128, 1, true);
  const rimConeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      lightColor: { value: LIGHT_COLOR.clone() },
      opacity: { value: 0 },
      time: { value: 0 },
    },
    vertexShader: CONE_VERTEX,
    fragmentShader: CONE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const rimCone = new THREE.Mesh(rimConeGeometry, rimConeMaterial);
  rimCone.rotation.x = -Math.PI / 2;
  rimCone.position.z = w / 2;
  rimGroup.add(rimCone);

  const rimBulbGeometry = new THREE.SphereGeometry(0.3, 48, 48);
  const rimBulbMaterial = new THREE.ShaderMaterial({
    uniforms: {
      lightColor: { value: LIGHT_COLOR.clone() },
      rimPower: { value: 3 },
      rimIntensity: { value: 1.5 },
      glowIntensity: { value: 0.3 },
      lightDir: { value: new THREE.Vector3() },
    },
    vertexShader: BULB_VERTEX,
    fragmentShader: BULB_FRAGMENT,
    transparent: true,
    depthWrite: true,
  });
  const rimBulb = new THREE.Mesh(rimBulbGeometry, rimBulbMaterial);
  rimGroup.add(rimBulb);
  rimGroup.visible = false;
  scene.add(rimGroup);

  return {
    scene, camera, renderer, shell, mLines, pLines, dots,
    lightGroup, bulb, cone, dotTexture, targetMesh, targetFrontMat, pointLight,
    rimGroup, rimBulb, rimCone, rimPointLight,
    rimEnabled: false, rimDispAz: 180, rimDispEl: 0, rimTAz: 180, rimTEl: 0, rimOpacity: 0,
    dragTarget: 'main',
    tColor: LIGHT_COLOR.clone(), dispColor: LIGHT_COLOR.clone(),
    tIntensity: 1, dispIntensity: 1,
    dispAz: 0, dispEl: 0, tAz: 0, tEl: 0,
    dragging: false, bulbScale: 1,
    camPos: VIEW_PRESETS.front.pos.clone(),
    camLook: VIEW_PRESETS.front.lookAt.clone(),
  };
}

/** 官方 `Zt(e)`：逐帧目标的颜色 / 透明度推进 */
function stepMaterials(state: RigState): void {
  const lineAzimuth = snapAzimuth(state.tAz);
  const lineElevation = snapElevation(state.tEl);
  const lightPos = state.lightGroup.position;
  const hex = state.dispColor.getHex();
  const shellUniforms = (state.shell.material as THREE.ShaderMaterial).uniforms;
  if (state.dragging) {
    shellUniforms.shadowIntensity.value = THREE.MathUtils.lerp(shellUniforms.shadowIntensity.value, 0.3, 0.1);
    shellUniforms.centerAlpha.value = THREE.MathUtils.lerp(shellUniforms.centerAlpha.value, 0.05, 0.1);
    state.mLines.forEach((line, azimuth) => {
      const active = azimuth === lineAzimuth;
      const material = line.material as THREE.ShaderMaterial;
      material.uniforms.globalOpacity.value = THREE.MathUtils.lerp(material.uniforms.globalOpacity.value, active ? 1 : 0.3, 0.15);
      paintLine(line, lightPos, active ? hex : 0x444444, false);
    });
    state.pLines.forEach((line, elevation) => {
      const active = elevation === lineElevation;
      const material = line.material as THREE.ShaderMaterial;
      material.uniforms.globalOpacity.value = THREE.MathUtils.lerp(material.uniforms.globalOpacity.value, active ? 1 : 0.3, 0.15);
      paintLine(line, lightPos, active ? hex : 0x444444, false);
    });
    state.dots.forEach((sprite) => {
      const { azimuth, elevation } = sprite.userData as { azimuth: number; elevation: number };
      const active = azimuth === lineAzimuth && elevation === lineElevation;
      let opacity = active ? 1 : 0.35;
      if (sprite.position.z < 0) opacity *= 0.5;
      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity = THREE.MathUtils.lerp(material.opacity, opacity, 0.15);
      material.color.setHex(active ? hex : 0x777777);
    });
  } else {
    shellUniforms.shadowIntensity.value = THREE.MathUtils.lerp(shellUniforms.shadowIntensity.value, 0.45, 0.05);
    shellUniforms.centerAlpha.value = THREE.MathUtils.lerp(shellUniforms.centerAlpha.value, 0.08, 0.05);
    state.mLines.forEach((line, azimuth) => {
      const active = azimuth === lineAzimuth;
      const material = line.material as THREE.ShaderMaterial;
      material.uniforms.globalOpacity.value = THREE.MathUtils.lerp(material.uniforms.globalOpacity.value, active ? 0.7 : 0, 0.1);
      if (active) paintLine(line, lightPos, hex, true);
    });
    state.pLines.forEach((line, elevation) => {
      const active = elevation === lineElevation;
      const material = line.material as THREE.ShaderMaterial;
      material.uniforms.globalOpacity.value = THREE.MathUtils.lerp(material.uniforms.globalOpacity.value, active ? 0.7 : 0, 0.1);
      if (active) paintLine(line, lightPos, hex, true);
    });
    state.dots.forEach((sprite) => {
      const { azimuth, elevation } = sprite.userData as { azimuth: number; elevation: number };
      let opacity = azimuth === lineAzimuth || elevation === lineElevation ? 0.25 : 0;
      if (sprite.position.z < 0) opacity *= 0.5;
      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity = THREE.MathUtils.lerp(material.opacity, opacity, 0.1);
      material.color.setHex(0x999999);
    });
  }
  const coneUniforms = (state.cone.material as THREE.ShaderMaterial).uniforms;
  coneUniforms.opacity.value = THREE.MathUtils.lerp(coneUniforms.opacity.value, (state.dragging ? 0.7 : 0.45) * state.dispIntensity, 0.1);
  coneUniforms.time.value = performance.now() * 0.001;
  const bulbUniforms = (state.bulb.material as THREE.ShaderMaterial).uniforms;
  bulbUniforms.rimIntensity.value = THREE.MathUtils.lerp(bulbUniforms.rimIntensity.value, state.dragging ? 2.5 : 1.5, 0.15);
  bulbUniforms.glowIntensity.value = THREE.MathUtils.lerp(bulbUniforms.glowIntensity.value, state.dragging ? 0.6 : 0.3, 0.15);
  state.rimOpacity = THREE.MathUtils.lerp(state.rimOpacity, state.rimEnabled ? 1 : 0, 0.1);
  state.rimGroup.visible = state.rimOpacity > 0.01;
  if (state.rimGroup.visible) {
    const rimConeUniforms = (state.rimCone.material as THREE.ShaderMaterial).uniforms;
    rimConeUniforms.opacity.value = state.rimOpacity * 0.35;
    rimConeUniforms.time.value = performance.now() * 0.001;
    const rimBulbUniforms = (state.rimBulb.material as THREE.ShaderMaterial).uniforms;
    rimBulbUniforms.rimIntensity.value = 1.5 * state.rimOpacity;
    rimBulbUniforms.glowIntensity.value = 0.3 * state.rimOpacity;
    state.rimPointLight.intensity = 3 * state.rimOpacity;
  }
}

/** 官方 `Jt(e)`：彻底释放 */
function disposeScene(state: RigState): void {
  state.renderer.dispose();
  state.renderer.domElement.remove();
  state.dotTexture.dispose();
  state.scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
    if (object instanceof THREE.Sprite) object.material.dispose();
  });
}

export default function RelightRig3D({
  imageSrc,
  azimuthDeg,
  elevationDeg,
  brightnessPercent,
  rimEnabled,
  rimAzimuthDeg,
  rimElevationDeg,
  viewMode,
  onViewModeChange,
  lightColor = RELIGHT_LIGHT_COLOR,
  disabled = false,
  onAngleChange,
  onRimPresetChange,
  onDragTargetChange,
}: RelightRig3DProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<RigState | null>(null);
  const frameRef = useRef(0);
  const dragRef = useRef({ sx: 0, sy: 0, sAz: 0, sEl: 0 });
  const [dragging, setDragging] = useState(false);

  /* 最新 props 写进 ref，供 rAF 循环与 pointer 回调读取 */
  const propsRef = useRef({ disabled, onAngleChange, onRimPresetChange, onDragTargetChange });
  useEffect(() => {
    propsRef.current = { disabled, onAngleChange, onRimPresetChange, onDragTargetChange };
  }, [disabled, onAngleChange, onRimPresetChange, onDragTargetChange]);

  const rimPresets = useMemo(() => new Map(RELIGHT_RIM_PRESETS.map((item) => [item.key, item])), []);

  /* 建场景 + 渲染循环（只跑一次） */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const state = createScene(host);
    stateRef.current = state;
    state.tAz = azimuthDeg;
    state.tEl = elevationDeg;
    state.dispAz = azimuthDeg;
    state.dispEl = elevationDeg;
    applyLightPosition(state);

    const tick = () => {
      if (stateRef.current !== state) return;
      frameRef.current = requestAnimationFrame(tick);
      state.camera.position.lerp(state.camPos, 0.08);
      state.camera.lookAt(state.camLook);
      const ease = state.dragging ? Wt : fe;
      let dAz = state.tAz - state.dispAz;
      if (dAz > 180) dAz -= 360;
      if (dAz < -180) dAz += 360;
      state.dispAz += dAz * ease;
      state.dispEl += (state.tEl - state.dispEl) * ease;
      state.bulbScale += (1 - state.bulbScale) * 0.12;
      applyLightPosition(state);
      let rAz = state.rimTAz - state.rimDispAz;
      if (rAz > 180) rAz -= 360;
      if (rAz < -180) rAz += 360;
      state.rimDispAz += rAz * fe;
      state.rimDispEl += (state.rimTEl - state.rimDispEl) * fe;
      applyRimPosition(state);
      state.dispColor.lerp(state.tColor, 0.1);
      state.dispIntensity += (state.tIntensity - state.dispIntensity) * 0.1;

      const bulbUniforms = (state.bulb.material as THREE.ShaderMaterial).uniforms;
      bulbUniforms.lightColor.value.copy(state.dispColor);
      bulbUniforms.glowIntensity.value = 0.3 * state.dispIntensity;
      (state.cone.material as THREE.ShaderMaterial).uniforms.lightColor.value.copy(state.dispColor);
      state.pointLight.color.copy(state.dispColor);
      state.pointLight.intensity = 6 * state.dispIntensity;
      (state.rimBulb.material as THREE.ShaderMaterial).uniforms.lightColor.value.copy(state.dispColor);
      (state.rimCone.material as THREE.ShaderMaterial).uniforms.lightColor.value.copy(state.dispColor);
      state.rimPointLight.color.copy(state.dispColor);

      stepMaterials(state);
      state.renderer.render(state.scene, state.camera);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameRef.current);
      disposeScene(state);
      stateRef.current = null;
    };
    // 只建一次场景；后续全部由下方分项 effect 驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 目标角 → tAz/tEl（官方 `useEffect([azimuthDeg, elevationDeg])`） */
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    state.tAz = azimuthDeg;
    state.tEl = elevationDeg;
  }, [azimuthDeg, elevationDeg]);

  /* 灯色 */
  useEffect(() => {
    stateRef.current?.tColor.set(lightColor);
  }, [lightColor]);

  /* 亮度 → 强度（官方 `x<=10?.35:x>=100?2.2:x/50`） */
  useEffect(() => {
    const state = stateRef.current;
    if (state) state.tIntensity = relightIntensityFor(brightnessPercent);
  }, [brightnessPercent]);

  /* 机位切换 */
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const preset = VIEW_PRESETS[viewMode];
    state.camPos.copy(preset.pos);
    state.camLook.copy(preset.lookAt);
  }, [viewMode]);

  /* 轮廓光开关 / 预设 */
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    state.rimEnabled = rimEnabled;
    state.rimTAz = rimAzimuthDeg;
    state.rimTEl = rimElevationDeg;
  }, [rimEnabled, rimAzimuthDeg, rimElevationDeg]);

  /* 目标板贴图 */
  useEffect(() => {
    const state = stateRef.current;
    if (!state || !imageSrc) return;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    let disposed = false;
    loader.load(imageSrc, (texture) => {
      if (disposed || !stateRef.current) return;
      const current = stateRef.current;
      texture.colorSpace = THREE.SRGBColorSpace;
      current.targetFrontMat.map = texture;
      current.targetFrontMat.color.set(0xffffff);
      current.targetFrontMat.needsUpdate = true;
      const image = texture.image as { width: number; height: number };
      const ratio = image.width / image.height;
      if (ratio > 1) current.targetMesh.scale.set(1, 1 / ratio, 1);
      else current.targetMesh.scale.set(ratio, 1, 1);
      current.targetMesh.visible = true;
    });
    return () => {
      disposed = true;
      const current = stateRef.current;
      if (current?.targetFrontMat.map) {
        current.targetFrontMat.map.dispose();
        current.targetFrontMat.map = null;
        current.targetFrontMat.needsUpdate = true;
      }
    };
  }, [imageSrc]);

  /* 官方 `G`：按下（先做轮廓光灯泡的 1.5 半径拾取） */
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (propsRef.current.disabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const state = stateRef.current;
    if (!state) return;
    let target: 'main' | 'rim' = 'main';
    const host = hostRef.current;
    if (state.rimEnabled && state.rimGroup.visible && host) {
      const rect = host.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      state.camera.updateMatrixWorld();
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, state.camera);
      const rimPos = new THREE.Vector3();
      state.rimBulb.getWorldPosition(rimPos);
      if (raycaster.ray.intersectsSphere(new THREE.Sphere(rimPos, 1.5))) target = 'rim';
    }
    state.dragging = true;
    state.dragTarget = target;
    setDragging(true);
    propsRef.current.onDragTargetChange?.(target);
    dragRef.current = target === 'rim'
      ? { sx: event.clientX, sy: event.clientY, sAz: state.rimTAz, sEl: state.rimTEl }
      : { sx: event.clientX, sy: event.clientY, sAz: state.tAz, sEl: state.tEl };
  }, []);

  /* 官方 `S`：拖动 */
  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = stateRef.current;
    if (!state?.dragging) return;
    const start = dragRef.current;
    const azimuth = start.sAz + (event.clientX - start.sx) * Se;
    const elevation = Math.max(-90, Math.min(90, start.sEl - (event.clientY - start.sy) * Se));
    if (state.dragTarget === 'rim') {
      state.rimTAz = 180;
      state.rimTEl = Math.max(-45, Math.min(45, elevation));
    } else {
      state.tAz = azimuth;
      state.tEl = elevation;
    }
  }, []);

  /* 官方 `p`：抬起（吸附 + 回写） */
  const handlePointerUp = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.dragTarget === 'rim') {
      const key = nearestRimPresetKey(state.rimTAz, state.rimTEl);
      const preset = rimPresets.get(key) ?? RELIGHT_RIM_PRESETS[0];
      state.rimTAz = preset.azimuthDeg;
      state.rimTEl = preset.elevationDeg;
      propsRef.current.onRimPresetChange?.(key);
    } else {
      const azimuth = snapAzimuth(state.tAz);
      const elevation = snapElevation(state.tEl);
      state.tAz = azimuth;
      state.tEl = elevation;
      state.bulbScale = 1.5;
      propsRef.current.onAngleChange({ azimuthDeg: azimuth, elevationDeg: elevation });
    }
    state.dragging = false;
    setDragging(false);
  }, [rimPresets]);

  return (
    <div className="rl-rig-col">
      <div className="rl-view-switch">
        {(['perspective', 'front'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            data-state={viewMode === mode ? 'on' : 'off'}
            className="rl-view-option"
            data-testid={`image-relight-view-${mode}`}
            onClick={() => onViewModeChange(mode)}
          >
            {mode === 'perspective' ? t('透视') : t('正面')}
          </button>
        ))}
      </div>
      <div
        ref={hostRef}
        className="rl-rig"
        data-testid="image-relight-rig"
        style={{
          width: le,
          height: le,
          cursor: disabled ? 'not-allowed' : dragging ? 'grabbing' : 'crosshair',
          opacity: disabled ? 0.86 : 1,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
