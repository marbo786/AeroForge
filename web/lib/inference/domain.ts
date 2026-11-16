import model from "../../../artifacts/recovery-v1-complete/model.json" with { type: "json" };
import type { Parameters } from "../geometry/naca4.ts";

export { model };
export type Design = Parameters & { alpha: number; re: number };
export type Bounds = readonly [min: number, max: number];

const { domain } = model;
const pair = ([min, max]: number[]): Bounds => [min, max];

export const modelBounds = {
  m: pair(domain.m),
  p: pair(domain.cambered_p),
  t: pair(domain.t),
  alpha: pair(domain.alpha_deg),
  re: [Math.min(...domain.sampled_reynolds), Math.max(...domain.sampled_reynolds)],
} satisfies Record<keyof Design, Bounds>;

const fields = ["m", "p", "t", "alpha", "re"] as const;
export const formatRe = (value: number) => value.toLocaleString("en-US");

export function assessDomain(design: Design) {
  const outside = fields.filter((field) => {
    if (field === "p" && design.m === 0) return false;
    const [min, max] = modelBounds[field];
    const value = design[field];
    return !Number.isFinite(value) || value < min || value > max;
  });
  const sweepSupported = outside.every((field) => field === "alpha");
  return {
    outside,
    sweepSupported,
    interpolatedRe: sweepSupported && !domain.sampled_reynolds.includes(design.re),
  };
}

export function clampToModel(design: Design): Design {
  const clamp = (field: keyof Design) => {
    const [min, max] = modelBounds[field];
    return Math.min(max, Math.max(min, design[field]));
  };
  const m = clamp("m");
  return { m, p: m === 0 ? 0 : clamp("p"), t: clamp("t"), alpha: clamp("alpha"), re: clamp("re") };
}

const ranges = {
  m: `camber ${modelBounds.m[0] * 100}–${modelBounds.m[1] * 100}% chord`,
  p: `camber position ${modelBounds.p[0] * 100}–${modelBounds.p[1] * 100}% chord`,
  t: `thickness ${modelBounds.t[0] * 100}–${modelBounds.t[1] * 100}% chord`,
  alpha: `angle ${modelBounds.alpha[0]}° to ${modelBounds.alpha[1]}°`,
  re: `Reynolds number ${formatRe(modelBounds.re[0])}–${formatRe(modelBounds.re[1])}`,
};

export function domainMessage(outside: readonly (keyof Design)[]) {
  return outside.length
    ? `Prediction requires ${outside.map((field) => ranges[field]).join(", ")}.`
    : "";
}
