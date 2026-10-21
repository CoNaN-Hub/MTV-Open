/** Serializable mockup settings. WebGL objects and playback state stay in the viewer. */
export type MockupDeviceId = 'iphone-duo' | 'iphone-18-pro' | 'macbook-pro' | 'studio-display';
export interface MockupCamera {
  position: [number, number, number];
  target: [number, number, number];
}
export interface MockupSettings {
  mockupDeviceId?: MockupDeviceId;
  mockupFoldAngle?: number;
  mockupSourceNodeId?: string;
  mockupCamera?: MockupCamera;
  mockupSnapshotKey?: string;
}
export interface MockupCapture { dataUrl: string; width: number; height: number }
