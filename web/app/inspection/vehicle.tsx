import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Group, type Material, Mesh, type Object3D, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { compactVehiclePath, vehiclePath, type RenderStats } from "./camera";
import { WingInteraction, WingPitch } from "./wing";

function disposeVehicle(object: Object3D) {
  const materials = new Set<Material>();
  object.traverse((part) => {
    if (!(part instanceof Mesh)) return;
    part.geometry.dispose();
    for (const material of Array.isArray(part.material) ? part.material : [part.material])
      materials.add(material);
  });
  materials.forEach((material) => material.dispose());
}

async function loadVehicle(
  folder: string,
  signal: AbortSignal,
  progress: (value: number | null) => void,
) {
  const url = folder + "car.glb";
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Vehicle download failed");
  const reader = response.body?.getReader();
  if (!reader) return new GLTFLoader().parseAsync(await response.arrayBuffer(), folder);
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0,
    previous = -1;
  // GLB declares decoded file length, including when HTTP compression is in use.
  let length = response.headers.get("content-encoding")
    ? 0
    : Number(response.headers.get("content-length"));
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
    if (!length && chunks[0].byteLength >= 12) {
      const header = new DataView(chunks[0].buffer, chunks[0].byteOffset, 12);
      if (header.getUint32(0, true) === 0x46546c67) length = header.getUint32(8, true);
    }
    if (length) {
      const percent = Math.min(95, Math.floor((total / length) * 20) * 5);
      if (percent !== previous) {
        progress(percent);
        previous = percent;
      }
    }
  }
  return new GLTFLoader().parseAsync(await new Blob(chunks).arrayBuffer(), folder);
}

type VehicleProps = {
  onProgress: (value: number | null) => void;
  onFailure: (kind: "failed" | "lost") => void;
  onReady: (stats: RenderStats) => void;
  wingSelected: boolean;
  onInspect?: () => void;
  compact: boolean;
  lightingSettled: boolean;
  alpha: number;
  onAnchor: (anchor: Vector3 | null) => void;
};

export function Vehicle({
  onProgress,
  onFailure,
  onReady,
  onAnchor,
  wingSelected,
  onInspect,
  compact,
  lightingSettled,
  alpha,
}: VehicleProps) {
  const { gl, invalidate } = useThree();
  const [loaded, setLoaded] = useState<{ model: Object3D; pivot: Group | null }>();
  const callbacks = useRef({ onProgress, onFailure, onReady, onAnchor });
  callbacks.current = { onProgress, onFailure, onReady, onAnchor };
  const ready = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let vehicle: Object3D | undefined;
    function onContextLost(event: Event) {
      event.preventDefault();
      callbacks.current.onFailure("lost");
    }
    gl.domElement.addEventListener("webglcontextlost", onContextLost);
    void loadVehicle(compact ? compactVehiclePath : vehiclePath, controller.signal, (value) =>
      callbacks.current.onProgress(value),
    )
      .then(({ scene }) => {
        if (controller.signal.aborted) {
          disposeVehicle(scene);
          return;
        }
        vehicle = scene;
        const anchor = scene.getObjectByName("Front_wing_inspection_anchor");
        const anchorPosition = anchor?.getWorldPosition(new Vector3()) ?? null;
        const wing = scene.getObjectByName("Front_wing");
        let pivot: Group | null = null;
        if (wing?.parent && anchorPosition) {
          const parent = wing.parent;
          pivot = new Group();
          pivot.position.copy(parent.worldToLocal(anchorPosition.clone()));
          parent.add(pivot);
          pivot.attach(wing);
        }
        callbacks.current.onAnchor(anchorPosition);
        setLoaded({ model: scene, pivot });
        invalidate();
      })
      .catch(() => {
        if (!controller.signal.aborted) callbacks.current.onFailure("failed");
      });
    return () => {
      gl.domElement.removeEventListener("webglcontextlost", onContextLost);
      controller.abort();
      if (vehicle) disposeVehicle(vehicle);
    };
  }, [gl, invalidate, compact]);

  const visible = lightingSettled ? loaded : undefined;
  useFrame(() => {
    if (!visible || ready.current) return;
    ready.current = true;
    // Read render counters after Fiber has submitted the first model frame.
    queueMicrotask(() => {
      const { calls, triangles } = gl.info.render;
      callbacks.current.onReady({ calls, triangles });
    });
  });
  return visible ? (
    <>
      <primitive object={visible.model} dispose={null} />
      {visible.pivot && <WingPitch pivot={visible.pivot} alpha={alpha} />}
      <WingInteraction model={visible.model} selected={wingSelected} onInspect={onInspect} />
    </>
  ) : null;
}
