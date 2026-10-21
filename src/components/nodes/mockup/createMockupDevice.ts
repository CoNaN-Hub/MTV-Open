/** Independent procedural device shells; no Artigine model assets are bundled. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { MockupDeviceId } from '../../../types/mockup';
import { clampFoldAngle } from './mockupModel';

export function createMockupDevice(id: MockupDeviceId) {
  const root = new THREE.Group();
  const textures: THREE.Texture[] = [];
  const screens: THREE.MeshBasicMaterial[] = [];
  const metal = new THREE.MeshStandardMaterial({ color: 0xa9acb1, metalness: 0.88, roughness: 0.3 });
  const bezel = new THREE.MeshStandardMaterial({ color: 0x111215, metalness: 0.35, roughness: 0.28 });
  const keyboard = new THREE.MeshStandardMaterial({ color: 0x242529, roughness: 0.7 });
  const hinges: THREE.Group[] = [];
  const body = (parent: THREE.Group, w: number, h: number, d: number, radius: number, mat = metal) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), mat);
    parent.add(mesh);
    return mesh;
  };
  const screen = (parent: THREE.Group, w: number, h: number, depth: number, x = 0, y = 0) => {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, depth);
    parent.add(mesh);
    screens.push(material);
  };
  if (id === 'iphone-18-pro') {
    body(root, 1.48, 3.12, 0.16, 0.12);
    body(root, 1.42, 3.06, 0.035, 0.11, bezel).position.z = 0.087;
    screen(root, 1.32, 2.87, 0.11);
    body(root, 0.44, 0.105, 0.025, 0.04, bezel).position.set(0, 1.34, 0.13);
    const bump = body(root, 1.2, 0.74, 0.08, 0.1);
    bump.position.set(0, 1.04, -0.11);
    for (let i = 0; i < 3; i++) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 32), bezel);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(-0.39 + i * 0.39, 1.04, -0.18);
      root.add(lens);
    }
  } else if (id === 'iphone-duo') {
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group();
      root.add(hinge);
      hinges.push(hinge);
      const half = new THREE.Group();
      half.position.x = side * 0.81;
      hinge.add(half);
      body(half, 1.61, 2.4, 0.13, 0.065);
      body(half, 1.56, 2.35, 0.025, 0.05, bezel).position.z = 0.073;
      screen(half, 1.535, 2.16, 0.09);
    }
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.27, 24), metal);
    root.add(spine);
  } else if (id === 'macbook-pro') {
    const lid = new THREE.Group();
    lid.position.set(0, 0.43, -0.35);
    lid.rotation.x = -0.14;
    root.add(lid);
    body(lid, 3.4, 2.28, 0.1, 0.065);
    body(lid, 3.31, 2.19, 0.025, 0.055, bezel).position.z = 0.055;
    screen(lid, 3.17, 2.06, 0.073);
    body(lid, 0.4, 0.09, 0.02, 0.025, bezel).position.set(0, 0.99, 0.087);
    const deck = new THREE.Group();
    deck.position.set(0, -0.76, 0.57);
    deck.rotation.x = -Math.PI / 2;
    root.add(deck);
    body(deck, 3.43, 2.03, 0.095, 0.06);
    body(deck, 2.94, 0.85, 0.018, 0.035, keyboard).position.set(0, 0.38, 0.055);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 13; col++) {
      body(deck, 0.19, 0.16, 0.016, 0.015, bezel).position.set(-1.31 + col * 0.218, 0.67 - row * 0.2, 0.07);
    }
    body(deck, 1.34, 0.62, 0.012, 0.025).position.set(0, -0.48, 0.055);
  } else {
    body(root, 3.6, 2.13, 0.11, 0.055).position.y = 0.4;
    body(root, 3.53, 2.06, 0.026, 0.045, bezel).position.set(0, 0.4, 0.065);
    screen(root, 3.37, 1.895, 0.085, 0, 0.4);
    body(root, 0.38, 0.95, 0.12, 0.025).position.set(0, -0.88, -0.1);
    const stand = body(root, 1.3, 0.85, 0.07, 0.035);
    stand.rotation.x = -Math.PI / 2;
    stand.position.set(0, -1.33, 0.17);
  }
  return {
    root,
    setAngle(angle: number) {
      const fold = THREE.MathUtils.degToRad(180 - clampFoldAngle(angle)) / 2;
      hinges.forEach((hinge, index) => { hinge.rotation.y = index === 0 ? fold : -fold; });
    },
    setScreen(canvas: HTMLCanvasElement) {
      textures.splice(0).forEach((texture) => texture.dispose());
      screens.forEach((material, index) => {
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        if (id === 'iphone-duo') {
          texture.repeat.x = 0.5;
          texture.offset.x = index * 0.5;
        }
        textures.push(texture);
        material.map = texture;
        material.needsUpdate = true;
      });
    },
    dispose() {
      textures.forEach((texture) => texture.dispose());
      const materials = new Set<THREE.Material>([metal, bezel, keyboard]);
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m));
        }
      });
      materials.forEach((material) => material.dispose());
    },
  };
}
