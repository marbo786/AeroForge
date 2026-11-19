"use client";

import type { Design } from "../../lib/inference/domain";
import type { PressureProfiles } from "../studio/use-pressure-profile";
import { Canvas } from "@react-three/fiber";
import { useState, type RefObject } from "react";
import type { Vector3 } from "three";
import type { CameraCommand, CameraPose, RenderStats } from "./camera";
import { CameraRig, initialCameraPosition } from "./camera-rig";
import { Floor, Lighting } from "./environment";
import { Vehicle } from "./vehicle";
import type { ScrollCamera } from "./scroll-camera";

type SceneProps = {
  story?: ScrollCamera;
  command: CameraCommand;
  pose: RefObject<CameraPose | null>;
  wingPose: RefObject<CameraPose | null>;
  wingSelected: boolean;
  alpha: number;
  design?: Design;
  profiles?: PressureProfiles;
  compact: boolean;
  cameraHelp: string;
  onInspect?: () => void;
  onProgress: (value: number | null) => void;
  onFailure: (kind: "failed" | "lost") => void;
  onReady: (stats: RenderStats) => void;
};

export default function Scene({
  command,
  story,
  pose,
  wingPose,
  wingSelected,
  compact,
  cameraHelp,
  ...callbacks
}: SceneProps) {
  const [anchor, setAnchor] = useState<Vector3 | null>(null);
  const [lightingSettled, setLightingSettled] = useState(false);
  return (
    <div className="inspection-render">
      <Canvas
        frameloop="demand"
        dpr={[1, compact ? 1.25 : 1.5]}
        camera={{ position: [...initialCameraPosition], fov: 36, near: 0.1, far: 140 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
      >
        <color attach="background" args={["#151b20"]} />
        <Lighting onSettled={setLightingSettled} />
        <Floor />
        <Vehicle
          {...callbacks}
          onAnchor={setAnchor}
          wingSelected={wingSelected || !!story}
          compact={compact}
          lightingSettled={lightingSettled}
        />
        <CameraRig
          command={command}
          story={story}
          pose={pose}
          wingPose={wingPose}
          wingSelected={wingSelected}
          anchor={wingSelected || story ? anchor : null}
          cameraHelp={cameraHelp}
        />
      </Canvas>
    </div>
  );
}
