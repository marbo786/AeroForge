import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import {
  Box3,
  Color,
  type Material,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Raycaster,
  Vector2,
} from "three";
import { liveries, useLivery } from "../studio/livery";
import { useReducedPreference } from "../studio/use-reduced-preference";

export function WingPitch({ pivot, alpha }: { pivot: Object3D; alpha: number }) {
  const invalidate = useThree((state) => state.invalidate);
  const reduced = useReducedPreference();
  const initialized = useRef(false);
  // The car faces +Z, so a negative X rotation raises its leading edge.
  const pitch = MathUtils.degToRad(-MathUtils.clamp(alpha, -7, 7));
  useLayoutEffect(() => {
    if (!initialized.current || reduced) pivot.rotation.x = pitch;
    initialized.current = true;
    invalidate();
  }, [pivot, pitch, reduced, invalidate]);
  useFrame((_, delta) => {
    if (pivot.rotation.x === pitch) return;
    const next = MathUtils.damp(pivot.rotation.x, pitch, 18, Math.min(delta, 0.05));
    pivot.rotation.x = Math.abs(next - pitch) < 0.0001 ? pitch : next;
    if (pivot.rotation.x !== pitch) invalidate();
  });
  return null;
}

export function WingInteraction({
  model,
  selected,
  onInspect,
}: {
  model: Object3D;
  selected: boolean;
  onInspect?: () => void;
}) {
  const { livery } = useLivery();
  const { gl, invalidate, get } = useThree();
  const inspect = useRef(onInspect);
  inspect.current = onInspect;
  const enabled = !!onInspect;

  useLayoutEffect(() => {
    if (!enabled) return;
    const assembly = model.getObjectByName("Front_wing");
    if (!assembly) return;
    const wing = assembly;
    if (selected) {
      const originals = new Map<Mesh, MeshStandardMaterial>();
      wing.traverse((part) => {
        if (!(part instanceof Mesh) || !(part.material instanceof MeshStandardMaterial)) return;
        originals.set(part, part.material);
        const highlight = part.material.clone();
        highlight.color.lerp(new Color(liveries[livery].accent), 0.64);
        highlight.emissive.set(liveries[livery].paint);
        highlight.emissiveIntensity = 0.36;
        part.material = highlight;
      });
      invalidate();
      return () => {
        for (const [part, original] of originals) {
          (part.material as Material).dispose();
          part.material = original;
        }
        invalidate();
      };
    }

    const canvas = gl.domElement;
    const pickVolume = new Box3();
    const raycaster = new Raycaster();
    const point = new Vector2();
    const pointers = new Set<number>();
    let tap: { id: number; x: number; y: number } | null = null;
    function hitsWing(event: PointerEvent) {
      const box = canvas.getBoundingClientRect();
      point.set(
        (2 * (event.clientX - box.left)) / box.width - 1,
        1 - (2 * (event.clientY - box.top)) / box.height,
      );
      raycaster.setFromCamera(point, get().camera);
      wing.updateWorldMatrix(true, false);
      pickVolume.setFromObject(wing);
      if (!raycaster.ray.intersectsBox(pickVolume)) return false;
      const front = raycaster.intersectObject(model, true)[0];
      for (let part: Object3D | null = front?.object ?? null; part; part = part.parent)
        if (part === wing) return true;
      return false;
    }
    function down(event: PointerEvent) {
      pointers.add(event.pointerId);
      tap =
        pointers.size === 1 && event.button === 0 && hitsWing(event)
          ? { id: event.pointerId, x: event.clientX, y: event.clientY }
          : null;
      canvas.style.cursor = "";
    }
    function moved(event: PointerEvent) {
      if (
        tap?.id === event.pointerId &&
        Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8
      )
        tap = null;
      if (!pointers.size && event.pointerType === "mouse")
        canvas.style.cursor = hitsWing(event) ? "pointer" : "";
    }
    function end(event: PointerEvent) {
      const candidate = tap;
      tap = null;
      pointers.delete(event.pointerId);
      if (
        event.type === "pointerup" &&
        candidate?.id === event.pointerId &&
        Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) <= 8 &&
        hitsWing(event)
      )
        inspect.current?.();
    }
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", moved);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", moved);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", end);
      canvas.removeEventListener("lostpointercapture", end);
      canvas.style.cursor = "";
    };
  }, [enabled, get, gl, invalidate, model, selected, livery]);
  return null;
}
