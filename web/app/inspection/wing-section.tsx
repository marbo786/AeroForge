import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, Color, DoubleSide } from "three";
import type { Design } from "../../lib/inference/domain";
import { pressureCoordinates } from "../../lib/inference/pressure";
import { cpColor } from "../studio/flow-colors";
import { liveries, useLivery } from "../studio/livery";
import type { PressureProfiles } from "../studio/use-pressure-profile";

export function WingSection({ design, profiles }: { design: Design; profiles?: PressureProfiles }) {
  const { livery } = useLivery();
  const invalidate = useThree((state) => state.invalidate);
  const { surface, cut } = useMemo(() => {
    const branches = pressureCoordinates(design);
    const positions: number[] = [],
      colors: number[] = [];
    const vertex = (span: number, side: number, station: number) => {
      const [x, y] = branches[side][station];
      positions.push(span, 0.08 + y * 0.74, 0.42 - x * 0.74);
      const color = new Color(
        profiles ? cpColor(profiles[side][station]) : liveries[livery].accent,
      );
      colors.push(color.r, color.g, color.b);
    };
    branches.forEach((branch, side) => {
      for (let i = 0; i < branch.length - 1; i++) {
        vertex(-1.1, side, i);
        vertex(1.1, side, i);
        vertex(1.1, side, i + 1);
        vertex(-1.1, side, i);
        vertex(1.1, side, i + 1);
        vertex(-1.1, side, i + 1);
      }
    });
    const surface = new BufferGeometry();
    surface.setAttribute("position", new Float32BufferAttribute(positions, 3));
    surface.setAttribute("color", new Float32BufferAttribute(colors, 3));
    surface.computeVertexNormals();
    const outline = [...branches[0], ...branches[1].slice().reverse()];
    const cut = new BufferGeometry();
    cut.setAttribute(
      "position",
      new Float32BufferAttribute(
        outline.flatMap(([x, y]) => [0.55, 0.085 + y * 0.74, 0.42 - x * 0.74]),
        3,
      ),
    );
    return { surface, cut };
  }, [design, profiles, livery]);
  useEffect(() => {
    invalidate();
    return () => {
      surface.dispose();
      cut.dispose();
    };
  }, [surface, cut, invalidate]);
  return (
    <group name="Live_representative_NACA_section">
      <mesh geometry={surface}>
        <meshBasicMaterial vertexColors side={DoubleSide} />
      </mesh>
      <lineLoop geometry={cut} renderOrder={2}>
        <lineBasicMaterial color="#ffffff" depthTest={false} />
      </lineLoop>
    </group>
  );
}
