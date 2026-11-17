import summary from "../../../artifacts/reliability-v1/summary.json" with { type: "json" };
import { assessDomain, model, modelBounds, type Bounds, type Design } from "./domain.ts";

export { summary as reliabilityEvidence };
export const coveragePath = `/models/${model.version}/${summary.coverage_file}`;

export type CoverageIndex = {
  version: string;
  model_sha256: string;
  training_sha256: string;
  threshold: number;
  groups: readonly (readonly [
    m: number,
    p: number,
    t: number,
    conditions: readonly (readonly [alpha: number, re: number])[],
  ])[];
};

const span = ([min, max]: Bounds) => max - min;
const spanM = span(modelBounds.m);
const spanP = span(modelBounds.p);
const spanT = span(modelBounds.t);
const spanAlpha = span(modelBounds.alpha);
const spanLogRe = Math.log10(modelBounds.re[1]) - Math.log10(modelBounds.re[0]);

export function measureCoverage(design: Design, index: CoverageIndex) {
  if (assessDomain(design).outside.length) return null;
  const logRe = Math.log10(design.re);
  let nearest = Infinity;
  for (const [m, p, t, conditions] of index.groups) {
    // Position is undefined for symmetric sections on either side of the comparison.
    const positionDistance = design.m === 0 || m === 0 ? 0 : (design.p - p) / spanP;
    const geometryDistance =
      ((design.m - m) / spanM) ** 2 + positionDistance ** 2 + ((design.t - t) / spanT) ** 2;
    if (geometryDistance >= nearest) continue;
    for (const [alpha, re] of conditions) {
      const distance =
        geometryDistance +
        ((design.alpha - alpha) / spanAlpha) ** 2 +
        ((logRe - Math.log10(re)) / spanLogRe) ** 2;
      nearest = Math.min(nearest, distance);
    }
  }
  if (!Number.isFinite(nearest)) return null;
  const distance = Math.sqrt(nearest);
  return {
    status: distance > index.threshold + 1e-12 ? ("limited" as const) : ("nearby" as const),
    distance,
    threshold: index.threshold,
  };
}

let coverageRequest: Promise<CoverageIndex> | undefined;

export function loadCoverage() {
  coverageRequest ??= fetch(coveragePath).then(async (response) => {
    if (!response.ok) throw new Error("Training coverage download failed");
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    if (hash !== summary.coverage_sha256) throw new Error("Training coverage hash mismatch");
    const index = JSON.parse(new TextDecoder().decode(bytes)) as CoverageIndex;
    if (
      index.version !== "coverage-v1" ||
      index.model_sha256 !== model.model_sha256 ||
      summary.model_sha256 !== model.model_sha256 ||
      index.training_sha256 !== summary.training_sha256
    ) {
      throw new Error("Training coverage provenance mismatch");
    }
    return index;
  });
  return coverageRequest;
}
