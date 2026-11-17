import { useEffect, useMemo, useState } from "react";
import { loadCoverage, measureCoverage, type CoverageIndex } from "../../lib/inference/coverage";
import type { Design } from "../../lib/inference/domain";

type Distance = NonNullable<ReturnType<typeof measureCoverage>>;
export type TrainingCoverage =
  Distance | { status: "invalid" | "outside" | "checking" | "unavailable" };

export const coverageLabels: Record<TrainingCoverage["status"], string> = {
  invalid: "Correct the section inputs to assess coverage",
  outside: "Outside model bounds",
  checking: "Waiting for training coverage",
  unavailable: "Training coverage unavailable",
  nearby: "Nearby training examples",
  limited: "Limited nearby training coverage",
};

export function useTrainingCoverage(
  design: Design,
  domain: "invalid" | "outside" | "nominal",
  canLoad: boolean,
): TrainingCoverage {
  const [index, setIndex] = useState<CoverageIndex | null>();
  useEffect(() => {
    if (!canLoad || index !== undefined) return;
    let active = true;
    void loadCoverage().then(
      (value) => {
        if (active) setIndex(value);
      },
      () => {
        if (active) setIndex(null);
      },
    );
    return () => {
      active = false;
    };
  }, [index, canLoad]);

  return useMemo(() => {
    if (domain !== "nominal") return { status: domain };
    if (index === undefined) return { status: "checking" };
    return (index && measureCoverage(design, index)) || { status: "unavailable" };
  }, [design, domain, index]);
}
