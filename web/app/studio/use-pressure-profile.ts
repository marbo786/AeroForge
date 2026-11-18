import { useEffect, useState } from "react";
import { assessDomain, domainMessage, type Design } from "../../lib/inference/domain";
import {
  predictPressure,
  pressureFeatures,
  pressureUnavailable,
} from "../../lib/inference/pressure";

export type PressureProfiles = Awaited<ReturnType<typeof predictPressure>>;
export type FlowMode = "off" | "surface" | "smoke";

export function usePressureProfile(design: Design, active: boolean, invalid: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    profiles?: PressureProfiles;
    failed?: boolean;
  }>();
  const reason = invalid
    ? "Enter a valid design to view pressure."
    : domainMessage(assessDomain(design).outside) || pressureUnavailable(design);
  const key = `${pressureFeatures(design).join("/")}/${attempt}`;
  useEffect(() => {
    if (!active || reason) return;
    let cancelled = false;
    void predictPressure(design).then(
      (profiles) => {
        if (!cancelled) setResult({ key, profiles });
      },
      () => {
        if (!cancelled) setResult({ key, failed: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, active, reason, design]);
  const current = active && !reason && result?.key === key ? result : undefined;
  return {
    profiles: current?.profiles,
    message:
      reason ||
      (current?.failed
        ? "Pressure unavailable. The model could not return a valid profile."
        : !current?.profiles
          ? "Calculating surface pressure…"
          : ""),
    failed: current?.failed,
    retry: () => setAttempt(attempt + 1),
  };
}
