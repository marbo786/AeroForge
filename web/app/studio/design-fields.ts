import { candidateBounds } from "../../lib/geometry/naca4";
import { modelBounds, type Bounds, type Design } from "../../lib/inference/domain";

export type Field = keyof Design;
export type Draft = Record<Field, string>;

export const explorationAlpha: Bounds = [-4, 12];
const percent = ([min, max]: readonly number[]): Bounds => [min * 100, max * 100];

export const fields = [
  {
    key: "m",
    label: "Maximum camber",
    unit: "%",
    bounds: percent(candidateBounds.m),
    supported: percent(modelBounds.m),
    step: 0.1,
  },
  {
    key: "p",
    label: "Camber position",
    unit: "%c",
    bounds: percent(candidateBounds.p),
    supported: percent(modelBounds.p),
    step: 1,
  },
  {
    key: "t",
    label: "Thickness",
    unit: "%",
    bounds: percent(candidateBounds.t),
    supported: percent(modelBounds.t),
    step: 0.1,
  },
  {
    key: "alpha",
    label: "Angle of attack",
    unit: "°",
    bounds: explorationAlpha,
    supported: modelBounds.alpha,
    step: 0.1,
  },
  {
    key: "re",
    label: "Reynolds number",
    unit: "Re",
    bounds: [100000, 1000000],
    supported: modelBounds.re,
    step: 1000,
  },
] as const;
