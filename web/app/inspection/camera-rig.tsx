import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import { MathUtils, OrthographicCamera, type PerspectiveCamera, Quaternion, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useReducedPreference } from "../studio/use-reduced-preference";
import type { CameraCommand, CameraPose, View } from "./camera";

const target = new Vector3(0, 0.54, 0);
const wingDirection = new Vector3(0.53, 0.43, 1).normalize();
export const initialCameraPosition = [6, 3.1, 7.4] as const;
const views: Record<View, { direction: [number, number, number]; height: number; width: number }> =
  {
    "Three-quarter": { direction: [0.94, 0.43, 1], height: 3.28, width: 5.85 },
    Front: { direction: [0, 0, 1], height: 2.35, width: 3.5 },
    Side: { direction: [1, 0, 0], height: 2.5, width: 6.75 },
    Top: { direction: [0, 1, 0.0001], height: 6.55, width: 3.5 },
  };
// Conservative envelope in model space, including the front/rear wings and slicks.
const corners = [-1.27, 1.27].flatMap((x) =>
  [0, 1.55].flatMap((y) => [-2.88, 2.94].map((z) => new Vector3(x, y, z).sub(target))),
);

function fitPerspective(direction: Vector3, slope: number, aspect: number) {
  const right = new Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right);
  return Math.max(
    ...corners.map((corner) => {
      const horizontal = Math.abs(corner.dot(right)) / (slope * aspect);
      const vertical = Math.abs(corner.dot(up)) / slope;
      return corner.dot(direction) + 1.11 * Math.max(horizontal, vertical);
    }),
  );
}

type CameraRigProps = {
  command: CameraCommand;
  pose: RefObject<CameraPose | null>;
  wingPose: RefObject<CameraPose | null>;
  wingSelected: boolean;
  anchor: Vector3 | null;
  cameraHelp: string;
};

export function CameraRig({
  command,
  pose,
  wingPose,
  wingSelected,
  anchor,
  cameraHelp,
}: CameraRigProps) {
  const { camera, gl, set, get, invalidate, size } = useThree();
  const [perspective] = useState(() => camera as PerspectiveCamera);
  const [orthographic] = useState(() =>
    Object.assign(new OrthographicCamera(-1, 1, 1, -1, 0.1, 80), { manual: true }),
  );
  const controls = useRef<OrbitControls>(null);
  const move = useRef<((now: number) => void) | null>(null);
  const first = useRef(true);
  const wasSelected = useRef(false);
  const returnCommand = useRef<CameraCommand>(null);
  const reduced = useReducedPreference();

  useEffect(() => {
    const orbit = new OrbitControls(perspective, gl.domElement);
    orbit.target.copy(target);
    orbit.enablePan = false;
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.17;
    orbit.minDistance = 3.2;
    orbit.maxDistance = 24;
    orbit.minZoom = 0.6;
    orbit.maxZoom = 2.2;
    orbit.maxPolarAngle = Math.PI * 0.495;
    const stop = () => {
      move.current = null;
    };
    const redraw = () => invalidate();
    const canvas = gl.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "group");
    canvas.setAttribute("aria-label", "AF–02 camera");
    canvas.setAttribute("aria-describedby", cameraHelp);
    const orbitStep = (event: KeyboardEvent) => {
      const step = Math.PI / 18;
      switch (event.key) {
        case "ArrowLeft":
          stop();
          orbit.rotateLeft(step);
          break;
        case "ArrowRight":
          stop();
          orbit.rotateLeft(-step);
          break;
        case "ArrowUp":
          stop();
          orbit.rotateUp(-step);
          break;
        case "ArrowDown":
          stop();
          orbit.rotateUp(step);
          break;
        default:
          return;
      }
      event.preventDefault();
      invalidate();
    };
    canvas.addEventListener("keydown", orbitStep);
    orbit.addEventListener("change", redraw);
    orbit.addEventListener("start", stop);
    controls.current = orbit;
    return () => {
      orbit.removeEventListener("change", redraw);
      orbit.removeEventListener("start", stop);
      canvas.removeEventListener("keydown", orbitStep);
      orbit.dispose();
      controls.current = null;
    };
  }, [gl, perspective, invalidate, cameraHelp]);
  useEffect(() => {
    if (controls.current) controls.current.enableDamping = !reduced;
  }, [reduced]);

  const lastCommand = useRef<CameraCommand>(null);
  useEffect(() => {
    if (!size.width || !size.height) return;
    orthographic.right = (orthographic.top * size.width) / size.height;
    orthographic.left = -orthographic.right;
    orthographic.updateProjectionMatrix();
    invalidate();
  }, [orthographic, size.width, size.height, invalidate]);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || !size.width || !size.height) return;
    if (wingSelected && !anchor) return;
    const aspect = size.width / size.height;
    const slope = Math.tan(MathUtils.degToRad(perspective.fov / 2));
    const resumed = first.current && (wingSelected ? wingPose.current : pose.current);

    function restore(saved: CameraPose) {
      const restored = saved.orthographic ? orthographic : perspective;
      orbit!.target.fromArray(saved.target);
      restored.position.fromArray(saved.position);
      if (restored instanceof OrthographicCamera) {
        const viewport = get().size;
        restored.top = saved.halfHeight;
        restored.bottom = -saved.halfHeight;
        restored.right = (saved.halfHeight * viewport.width) / viewport.height;
        restored.left = -restored.right;
        restored.zoom = saved.zoom;
        restored.updateProjectionMatrix();
      }
      restored.lookAt(orbit!.target);
      orbit!.object = restored;
      set({ camera: restored });
    }

    const selectionChanged = wasSelected.current !== wingSelected;
    wasSelected.current = wingSelected;
    orbit.minDistance = wingSelected ? 1.5 : 3.2;
    if (resumed) {
      lastCommand.current = command;
      first.current = false;
      restore(resumed);
      invalidate();
      return;
    }
    if ((wingSelected && anchor) || selectionChanged) {
      if (!selectionChanged) return;
      lastCommand.current = command;
      returnCommand.current = wingSelected ? null : command;
      const saved = wingSelected ? null : pose.current;
      const nextTarget =
        wingSelected && anchor ? anchor : saved ? new Vector3(...saved.target) : target;
      const distance = Math.max(1.5, 3.22 / aspect) / (2 * slope);
      const nextPosition = saved
        ? new Vector3(...saved.position)
        : nextTarget.clone().addScaledVector(wingDirection, distance);
      const fromTarget = orbit.target.clone();
      const previous = orbit.object;
      const fromOffset = previous.position.clone().sub(fromTarget);
      if (previous instanceof OrthographicCamera)
        fromOffset.setLength(previous.top / (previous.zoom * slope));
      const nextOffset = nextPosition.clone().sub(nextTarget);
      if (saved?.orthographic) nextOffset.setLength(saved.halfHeight / (saved.zoom * slope));
      const startDirection = fromOffset.clone().normalize();
      const rotation = new Quaternion().setFromUnitVectors(
        startDirection,
        nextOffset.clone().normalize(),
      );
      const identity = new Quaternion();
      const partial = new Quaternion();
      orbit.object = perspective;
      set({ camera: perspective });
      animate((t, finished) => {
        orbit.target.lerpVectors(fromTarget, nextTarget, t);
        perspective.position
          .copy(startDirection)
          .applyQuaternion(partial.slerpQuaternions(identity, rotation, t))
          .multiplyScalar(MathUtils.lerp(fromOffset.length(), nextOffset.length(), t))
          .add(orbit.target);
        perspective.lookAt(orbit.target);
        if (finished && saved) restore(saved);
      });
      return;
    }
    // The section panel changes the canvas height on return. Keep the restored framing.
    if (returnCommand.current === command) return;
    returnCommand.current = null;
    // Resize refits a preset without applying the same relative zoom twice.
    if ("zoom" in command && lastCommand.current === command) return;
    lastCommand.current = command;
    const view = "view" in command ? command.view : undefined;
    const spec = view && views[view];
    const activeCamera = orbit.object as PerspectiveCamera | OrthographicCamera;
    const fromTarget = orbit.target.clone();
    const from = activeCamera.position.clone().sub(fromTarget);
    if (activeCamera instanceof OrthographicCamera && !view) {
      const start = activeCamera.zoom;
      const end = MathUtils.clamp(
        start * ("zoom" in command && command.zoom === 1 ? 1.2 : 1 / 1.2),
        0.6,
        2.2,
      );
      animate((t) => {
        activeCamera.zoom = MathUtils.lerp(start, end, t);
        activeCamera.updateProjectionMatrix();
      });
      return;
    }
    if (activeCamera instanceof OrthographicCamera) {
      from.setLength((activeCamera.top - activeCamera.bottom) / (activeCamera.zoom * 2 * slope));
      orbit.object = perspective;
      set({ camera: perspective });
    }
    const height = spec ? Math.max(spec.height, spec.width / aspect) : 0;
    const direction = spec ? new Vector3(...spec.direction).normalize() : from.clone().normalize();
    const overviewFit = aspect >= 1.2 ? 0.9 : 1;
    const distance =
      view === "Three-quarter"
        ? fitPerspective(direction, slope, aspect) * overviewFit
        : spec
          ? height / (2 * slope)
          : MathUtils.clamp(
              from.length() * ("zoom" in command && command.zoom === 1 ? 1 / 1.2 : 1.2),
              3.2,
              24,
            );
    const fromDirection = from.clone().normalize();
    const rotation = new Quaternion().setFromUnitVectors(fromDirection, direction);
    const identity = new Quaternion();
    const partial = new Quaternion();
    animate((t, finished) => {
      orbit.target.lerpVectors(fromTarget, target, t);
      perspective.position
        .copy(fromDirection)
        .applyQuaternion(partial.slerpQuaternions(identity, rotation, t))
        .multiplyScalar(MathUtils.lerp(from.length(), distance, t))
        .add(orbit.target);
      perspective.lookAt(orbit.target);
      if (finished && view && view !== "Three-quarter") {
        orthographic.left = (-height * aspect) / 2;
        orthographic.right = (height * aspect) / 2;
        orthographic.top = height / 2;
        orthographic.bottom = -height / 2;
        orthographic.zoom = 1;
        orthographic.position.copy(perspective.position);
        orthographic.quaternion.copy(perspective.quaternion);
        orthographic.updateProjectionMatrix();
        orbit.object = orthographic;
        set({ camera: orthographic });
      }
    });

    function animate(update: (t: number, finished: boolean) => void) {
      const start = performance.now();
      const duration = first.current || reduced ? 0 : 440;
      first.current = false;
      move.current = (now) => {
        const fraction = duration ? Math.min((now - start) / duration, 1) : 1;
        update(fraction * fraction * (3 - 2 * fraction), fraction === 1);
        if (fraction === 1) move.current = null;
      };
      invalidate();
    }
  }, [
    command,
    size.width,
    size.height,
    reduced,
    perspective,
    orthographic,
    pose,
    wingPose,
    wingSelected,
    anchor,
    get,
    set,
    invalidate,
  ]);

  useFrame(() => {
    move.current?.(performance.now());
    if (move.current) invalidate();
    else controls.current?.update();
    const orbit = controls.current;
    const camera = orbit?.object;
    // Wait for the requested pose before a newly mounted canvas can replace it.
    if (
      camera &&
      !first.current &&
      wasSelected.current === wingSelected &&
      !move.current &&
      (!wingSelected || anchor)
    ) {
      const ortho = camera instanceof OrthographicCamera;
      const destination = wingSelected ? wingPose : pose;
      destination.current = {
        position: camera.position.toArray(),
        target: orbit.target.toArray(),
        orthographic: ortho,
        halfHeight: ortho ? camera.top : 0,
        zoom: ortho ? camera.zoom : 1,
      };
    }
  });
  return null;
}
