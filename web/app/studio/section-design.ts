import type { Design, predict } from "../../lib/inference/surrogate";

export type Result = Awaited<ReturnType<typeof predict>> & { key: string; alpha: number };
export type SavedDesign = { design: Design; result: Result | null };

export function nameOf(design: Design) {
  if (
    [design.m * 100, design.p * 10, design.t * 100].every((v) => Math.abs(v - Math.round(v)) < 1e-8)
  )
    return `NACA ${Math.round(design.m * 100)}${Math.round(design.p * 10)}${Math.round(
      design.t * 100,
    )
      .toString()
      .padStart(2, "0")}`;
  return "Custom section";
}
