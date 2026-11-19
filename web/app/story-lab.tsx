"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedPreference } from "./studio/use-reduced-preference";
import { predict, type Design } from "../lib/inference/surrogate";
import { SectionPreview } from "./studio/section-preview";
import { ShareCard } from "./studio/share-card";
import { FlowControls, FlowStudy } from "./studio/flow-study";
import { usePressureProfile, type FlowMode } from "./studio/use-pressure-profile";
import { useGeometryMotion } from "./studio/stage";
import type { PressureProfiles } from "./studio/use-pressure-profile";

const baseline: Design = { m: 0, p: 0, t: 0.12, alpha: 4, re: 250000 };
const example: Design = { ...baseline, m: 0.02, p: 0.4 };
function StoryNumber({ value, digits }: { value?: number; digits: number }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedPreference();
  useEffect(() => {
    if (reduced || value === undefined) return;
    let frame = 0;
    const start = performance.now();
    const update = (now: number) => {
      const fraction = Math.min(1, (now - start) / 280);
      if (ref.current)
        ref.current.textContent = (value * (1 - (1 - fraction) ** 3)).toFixed(digits);
      if (fraction < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [value, digits, reduced]);
  return <strong ref={ref}>{value?.toFixed(digits) ?? "—"}</strong>;
}
export default function StoryLab({
  mode,
  onPressure,
}: {
  mode: "shape" | "pressure" | "compare";
  onPressure?: (profiles: PressureProfiles | undefined) => void;
}) {
  const [design, setDesign] = useState(example);
  const [result, setResult] = useState<{
    design: Design;
    value: Awaited<ReturnType<typeof predict>>;
  }>();
  const [error, setError] = useState(false);
  const [flow, setFlow] = useState<FlowMode>("surface");
  const pressure = usePressureProfile(design, mode === "pressure" && flow !== "off", false);
  const visual = useGeometryMotion(design);
  useEffect(() => {
    if (mode === "pressure") onPressure?.(pressure.profiles);
  }, [mode, onPressure, pressure.profiles]);
  useEffect(() => {
    if (mode === "pressure") return;
    let cancelled = false;
    setError(false);
    void predict(design).then(
      (value) => {
        if (!cancelled) setResult({ design, value });
      },
      () => {
        if (!cancelled) setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [design, mode]);
  const current = result?.design === design ? result.value : null;
  if (mode === "pressure")
    return (
      <>
        <FlowControls mode={flow} onMode={setFlow} />
        {flow !== "off" && <FlowStudy design={design} mode={flow} pressure={pressure} />}
        <p className="story-source">
          Real browser pressure inference. Smoke lines are schematic, not a velocity solution.
        </p>
      </>
    );
  return (
    <>
      {mode === "shape" && (
        <div className="story-presets" role="group" aria-label="Story section presets">
          {[0, 0.02, 0.04].map((m) => (
            <button
              key={m}
              className="chip micro"
              aria-pressed={design.m === m}
              onClick={() => setDesign({ ...example, m, p: m ? 0.4 : 0 })}
            >
              {m === 0 ? "0012" : m === 0.02 ? "2412" : "4412"}
            </button>
          ))}
        </div>
      )}
      <SectionPreview
        design={visual}
        invalid={false}
        saved={mode === "compare" ? baseline : undefined}
      />
      {mode === "shape" ? (
        <div className="story-readouts" aria-label="Story predictions">
          <div>
            CL
            <StoryNumber value={current?.cl} digits={4} />
          </div>
          <div>
            CD
            <StoryNumber value={current?.cd} digits={5} />
          </div>
        </div>
      ) : (
        <ShareCard design={design} current={current} title="Your next iteration" />
      )}
      <p className="story-source" role="status">
        {error
          ? "Prediction unavailable. Try the studio to retry."
          : current
            ? "Real browser ONNX inference · α 4° · Re 250,000 · isolated section"
            : "Initializing browser inference…"}
      </p>
    </>
  );
}
