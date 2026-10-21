import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MockupCamera, MockupCapture, MockupDeviceId } from '../../../types/mockup';
import { createMockupDevice } from './createMockupDevice';
import { clampFoldAngle, mockupCrop, mockupDevice } from './mockupModel';

export interface MockupViewportHandle { capture: () => MockupCapture; reset: () => void; angle: () => number }
interface Props {
  deviceId: MockupDeviceId;
  imageUrl?: string;
  camera?: MockupCamera;
  angle: number;
  playing: boolean;
  interactive: boolean;
  onCapture: (capture: MockupCapture) => void;
  onCamera: (camera: MockupCamera) => void;
  onError: (message: string) => void;
}

function validCamera(camera: MockupCamera | undefined): camera is MockupCamera {
  return Boolean(camera && Array.isArray(camera.position) && camera.position.length === 3
    && Array.isArray(camera.target) && camera.target.length === 3
    && [...camera.position, ...camera.target].every((value) => Number.isFinite(value) && Math.abs(value) < 100));
}

const MockupViewport = forwardRef<MockupViewportHandle, Props>(function MockupViewport(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<{ capture: () => MockupCapture; reset: () => void; angle: () => number } | null>(null);
  const callbacks = useRef(props);
  useEffect(() => { callbacks.current = props; });
  useImperativeHandle(ref, () => ({
    capture: () => { if (!runtime.current) throw new Error('样机尚未准备好'); return runtime.current.capture(); },
    reset: () => runtime.current?.reset(),
    angle: () => runtime.current?.angle() ?? props.angle,
  }), [props.angle]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
    catch { queueMicrotask(() => callbacks.current.onError('此窗口无法启用 3D，请检查硬件加速后重试')); return; }
    let disposed = false;
    let visible = true;
    let frame = 0;
    let captureTimer = 0;
    let textureReady = false;
    let currentAngle = clampFoldAngle(props.angle);
    let lastPlaying = false;
    let playStarted = 0;
    let lastFrame = 0;
    let previousAngle = currentAngle;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    const model = createMockupDevice(props.deviceId);
    model.setAngle(currentAngle);
    scene.add(model.root);
    scene.add(new THREE.HemisphereLight(0xe7efff, 0x41404a, 2.8));
    const key = new THREE.DirectionalLight(0xffffff, 5);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcc9ff, 3.5);
    rim.position.set(-4, 2, -3);
    scene.add(rim);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-label', '样机 3D 预览');
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false; // Canvas wheel keeps its existing zoom behavior.
    controls.enableDamping = false;
    controls.minDistance = 4;
    controls.maxDistance = 18;
    const render = () => { if (!disposed && visible && !document.hidden) renderer.render(scene, camera); };
    const capture = (): MockupCapture => {
      if (!textureReady || disposed) throw new Error('样机画面尚未准备好');
      renderer.render(scene, camera);
      return { dataUrl: renderer.domElement.toDataURL('image/png'), width: renderer.domElement.width, height: renderer.domElement.height };
    };
    const scheduleCapture = () => {
      window.clearTimeout(captureTimer);
      captureTimer = window.setTimeout(() => {
        if (disposed || !textureReady || callbacks.current.playing) return;
        try { callbacks.current.onCapture(capture()); }
        catch { callbacks.current.onError('图片无法截图，请换成本地上传图片'); }
      }, 350);
    };
    const reset = () => {
      camera.position.set(props.deviceId === 'iphone-18-pro' ? 3.1 : 3.7, 2.2, 7.8);
      controls.target.set(0, 0, 0);
      controls.update();
      render();
    };
    reset();
    const restore = () => {
      if (validCamera(callbacks.current.camera)) {
        camera.position.fromArray(callbacks.current.camera.position);
        controls.target.fromArray(callbacks.current.camera.target);
        controls.update();
        render();
      }
    };
    restore();
    const cameraChanged = () => {
      callbacks.current.onCamera({ position: camera.position.toArray(), target: controls.target.toArray() });
      scheduleCapture();
    };
    controls.addEventListener('change', render);
    controls.addEventListener('end', cameraChanged);
    runtime.current = { capture, angle: () => currentAngle, reset: () => { reset(); cameraChanged(); } };
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1024 / Math.max(width, height)));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
      scheduleCapture();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) render(); });
    intersection.observe(container);
    const contextLost = (event: Event) => {
      event.preventDefault();
      callbacks.current.onError('3D 显存暂时不可用，请点击重试');
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    const viewport = mockupDevice(props.deviceId);
    const screenCanvas = document.createElement('canvas');
    const scale = 1024 / Math.max(viewport.width, viewport.height);
    screenCanvas.width = Math.round(viewport.width * scale);
    screenCanvas.height = Math.round(viewport.height * scale);
    const ctx = screenCanvas.getContext('2d');
    let image: HTMLImageElement | undefined;
    const installScreen = () => {
      model.setScreen(screenCanvas);
      textureReady = true;
      render();
      scheduleCapture();
    };
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, screenCanvas.width, screenCanvas.height);
      gradient.addColorStop(0, '#252b54'); gradient.addColorStop(0.5, '#b8a5ef'); gradient.addColorStop(1, '#d7eef5');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = `${Math.round(screenCanvas.width / 12)}px sans-serif`;
      ctx.fillText('MTV', screenCanvas.width / 2, screenCanvas.height / 2);
      installScreen();
      if (props.imageUrl) {
        textureReady = false;
        image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          if (disposed || !ctx || !image) return;
          const crop = mockupCrop(image.naturalWidth, image.naturalHeight, viewport.width, viewport.height);
          ctx.clearRect(0, 0, screenCanvas.width, screenCanvas.height);
          ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, screenCanvas.width, screenCanvas.height);
          installScreen();
        };
        image.onerror = () => { if (!disposed) callbacks.current.onError('图片加载失败，请换图或点击重试'); };
        image.src = props.imageUrl;
      }
    }
    let lastCameraKey = JSON.stringify(callbacks.current.camera);
    const tick = (now: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      if (now - lastFrame < 33) return;
      lastFrame = now;
      const active = callbacks.current;
      controls.enabled = active.interactive;
      const cameraKey = JSON.stringify(active.camera);
      if (cameraKey !== lastCameraKey) { lastCameraKey = cameraKey; restore(); }
      const playing = active.playing && props.deviceId === 'iphone-duo' && visible && !document.hidden;
      if (playing) {
        if (!lastPlaying) playStarted = now - (Math.acos(1 - currentAngle / 90) / (2 * Math.PI)) * 8600;
        currentAngle = 90 * (1 - Math.cos(((now - playStarted) / 8600) * 2 * Math.PI));
        model.setAngle(currentAngle);
        render();
      } else if (lastPlaying || previousAngle !== active.angle) {
        previousAngle = active.angle;
        currentAngle = clampFoldAngle(active.angle);
        model.setAngle(currentAngle); render(); scheduleCapture();
      }
      lastPlaying = playing;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      window.clearTimeout(captureTimer); cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      if (image) { image.onload = null; image.onerror = null; image.src = ''; }
      controls.dispose(); model.dispose(); renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove(); screenCanvas.width = 1; screenCanvas.height = 1;
      runtime.current = null;
    };
    // Camera/angle/playback updates use callbacks.current without rebuilding GPU resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.deviceId, props.imageUrl]);
  return <div ref={host} className="mockup-viewport" />;
});
export default MockupViewport;
