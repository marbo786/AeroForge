import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Mesh, MeshStandardMaterial, type Object3D } from "three";
import { liveries, useLivery } from "../studio/livery";

export function LiveryPaint({ model }: { model: Object3D }) {
  const { livery } = useLivery();
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const palette = liveries[livery];
    model.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        if (material.name === "Turquoise livery") material.color.set(palette.accent);
        if (material.name === "Petrol anodized paint") material.color.set(palette.paint);
      }
    });
    invalidate();
  }, [model, livery, invalidate]);
  return null;
}
