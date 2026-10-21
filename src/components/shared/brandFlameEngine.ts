/**
 * brandFlameEngine.ts —— 官方 artigine 火焰 Logo 的 WebGL 引擎（逐字移植）
 * ══════════════════════════════════════════════════════════════════════════
 * 来源：官方 `brand.DHZj_TbF.js` 里的引擎工厂 `$e`（= `render-fn.txt`）、
 * 着色器编译 `Te`、贴图上传 `ze`，以及片元着色器本体
 * （已原样落到 `src/assets/logo/brandFlame.frag.glsl`，346 行）。
 *
 * 逐条对齐的官方行为：
 * · 顶点：全屏三角形 `[-1,-1, 3,-1, -1,3]` + `attribute vec2 a_position`（无矩阵）
 * · 画布像素：`clientWidth/Height × min(devicePixelRatio, 2)`；`viewport(0,0,w,h)`
 * · 贴图：`u_tex` 固定 unit 0、`TEXTURE_MIN_FILTER=LINEAR` + `CLAMP_TO_EDGE`；
 *   **不设 `UNPACK_FLIP_Y_WEBGL`**（官方也没有，片元里按 uv 约定自己采样）
 * · `u_core` / `u_spread` 是**变体常量**，建程序时设一次；其余 16 个 uniform 每帧设
 * · `clearColor(0,0,0,0)` ⇒ 画布是透明的，火焰叠在按钮底色上
 * · 贴图未就绪时**不画**（官方 `v` 标志位，避免闪一下空白）
 */

const VERTEX_SHADER_SOURCE = [
  'attribute vec2 a_position;',
  'void main() {',
  '  gl_Position = vec4(a_position, 0.0, 1.0);',
  '}',
].join('\n');

/** 全屏三角形（官方逐字） */
const FULLSCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);

export interface FlameVariant {
  textureSrc: string;
  /** 左上象限亮核 uv（官方实测） */
  coreX: number;
  coreY: number;
  /** 羽流径向频带缩放（大号 = 1） */
  spread: number;
}

/** 每帧提交给引擎的量（对应官方 `h.render({...})` 的入参） */
export interface FlameFrame {
  time: number;
  phase: number;
  throttle: number;
  power: number;
  surge: number;
  burst: number;
  aim: number;
  pointerX: number;
  pointerY: number;
  stage: boolean;
  intensity: number;
  flickerAmount: number;
  noiseScale: number;
  smokeAmount: number;
  fusion: number;
  fault: number;
}

export interface FlameEngine {
  render(frame: FlameFrame): void;
  resize(): void;
  dispose(): void;
}

/** 官方 `ie`：参考贴图一律重采样到 1024×1024 再上传 */
const TEXTURE_RESAMPLE_SIZE = 1024;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * 建引擎。返回 `null` = 官方那条「WebGL 不可用 → 退回静态图」分支
 * （组件据此只渲染 `<img>`）。
 */
export function createFlameEngine(
  canvas: HTMLCanvasElement,
  variant: FlameVariant,
  fragmentSource: string,
  onContextLost: () => void,
  onTextureLoaded?: () => void,
): FlameEngine | null {
  /* ⚠️ 官方直接 `getContext` 不兜异常（浏览器里拿不到 `webgl` 只会返回 null）；
     某些非浏览器环境（jsdom）会**抛**「not implemented」⇒ 包一层，走静态图兜底。 */
  let gl: WebGLRenderingContext | null = null;
  try {
    gl =
      (canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      }) as WebGLRenderingContext | null) ?? null;
  } catch {
    gl = null;
  }
  if (!gl) return null;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertexShader || !fragmentShader || !program) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    if (program) gl.deleteProgram(program);
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE, gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);

  const texture = gl.createTexture();
  let textureReady = false;
  let disposed = false;
  if (texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    /* 先用 1×1 全透明占位（官方逐字），图片到了再 texImage2D 覆盖 */
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    /* 官方 `ze`：图片先**重采样到 1024×1024**（2D 画布 drawImage 铺满），
       再 `UNPACK_PREMULTIPLY_ALPHA_WEBGL = true` 上传 + `generateMipmap`，
       MIN_FILTER 用 `LINEAR_MIPMAP_LINEAR`。跳过这三步火焰会明显更「毛」。
       ⚠️ 官方还给 `crossOrigin='anonymous'`（它的贴图来自 CDN）；这里是**同源**
       打包资源（dev 走 vite，打包走 tauri 自定义协议），加 crossOrigin 反而会在
       没回 CORS 头的协议下直接加载失败 ⇒ 不加，其余逐条照抄。 */
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (disposed || textureReady || !texture || gl.isContextLost()) return;
      const scratch = document.createElement('canvas');
      scratch.width = TEXTURE_RESAMPLE_SIZE;
      scratch.height = TEXTURE_RESAMPLE_SIZE;
      const scratchCtx = scratch.getContext('2d');
      if (!scratchCtx) return;
      scratchCtx.drawImage(image, 0, 0, TEXTURE_RESAMPLE_SIZE, TEXTURE_RESAMPLE_SIZE);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      textureReady = true;
      onTextureLoaded?.();
    };
    image.src = variant.textureSrc;
  }

  gl.uniform1i(uniform('u_tex'), 0);
  gl.uniform2f(uniform('u_core'), variant.coreX, variant.coreY);
  gl.uniform1f(uniform('u_spread'), variant.spread);
  gl.activeTexture(gl.TEXTURE0);

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    onContextLost();
  };
  canvas.addEventListener('webglcontextlost', handleContextLost, false);

  const resize = () => {
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  };

  const render = (frame: FlameFrame) => {
    if (!textureReady || gl.isContextLost()) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform2f(uniform('u_resolution'), canvas.width, canvas.height);
    gl.uniform2f(uniform('u_pointer'), frame.pointerX, frame.pointerY);
    gl.uniform1f(uniform('u_time'), frame.time);
    gl.uniform1f(uniform('u_phase'), frame.phase);
    gl.uniform1f(uniform('u_throttle'), frame.throttle);
    gl.uniform1f(uniform('u_power'), frame.power);
    gl.uniform1f(uniform('u_surge'), frame.surge);
    gl.uniform1f(uniform('u_burst'), frame.burst);
    gl.uniform1f(uniform('u_aim'), frame.aim);
    gl.uniform1f(uniform('u_stage'), frame.stage ? 1 : 0);
    gl.uniform1f(uniform('u_intensity'), frame.intensity);
    gl.uniform1f(uniform('u_flickerAmount'), frame.flickerAmount);
    gl.uniform1f(uniform('u_noiseScale'), frame.noiseScale);
    gl.uniform1f(uniform('u_smokeAmount'), frame.smokeAmount);
    gl.uniform1f(uniform('u_fusion'), frame.fusion);
    gl.uniform1f(uniform('u_fault'), frame.fault);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', handleContextLost, false);
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  };

  resize();
  return { render, resize, dispose };
}
