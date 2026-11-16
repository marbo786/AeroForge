export const cameraViews = ["Three-quarter", "Front", "Side", "Top"] as const;
export type View = (typeof cameraViews)[number];
export type CameraCommand = { view: View } | { zoom: -1 | 1 };
export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
  orthographic: boolean;
  halfHeight: number;
  zoom: number;
};
export type RenderStats = { calls: number; triangles: number };
export const vehiclePath = "/vehicle/af02-v1/";
export const compactVehiclePath = "/vehicle/af02-mobile-v1/";
