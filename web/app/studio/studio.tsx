"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeGeometry, parseNaca } from "../../lib/geometry/naca4";
import { features, predict, type Design } from "../../lib/inference/surrogate";
import Instrument from "./instrument";
import { readSharedDesign, readWorkspaceView, type WorkspaceView } from "./shared-design";

const initial = { m: "2", p: "40", t: "12", alpha: "4", re: "250000" };
export type Field = keyof typeof initial;
export type Draft = typeof initial;
const controls: { key: Field; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "m", label: "Maximum camber", unit: "% chord", min: 0, max: 6, step: .1 },
  { key: "p", label: "Camber position", unit: "% chord", min: 20, max: 60, step: 1 },
  { key: "t", label: "Thickness", unit: "% chord", min: 8, max: 18, step: .1 },
  { key: "alpha", label: "Angle of attack", unit: "deg", min: -4, max: 12, step: .1 },
  { key: "re", label: "Reynolds number", unit: "dimensionless", min: 100000, max: 1000000, step: 1000 },
];
function validate(draft: Draft): { design?: Design; errors: Partial<Record<Field, string>> } {
  const errors: Partial<Record<Field, string>> = {};
  for (const c of controls) {
    if (c.key === "p" && Number(draft.m) === 0) continue;
    const value = Number(draft[c.key]);
    if (!draft[c.key].trim() || !Number.isFinite(value) || value < c.min || value > c.max)
      errors[c.key] = `Enter a value from ${c.min.toLocaleString("en-US")} to ${c.max.toLocaleString("en-US")}.`;
  }
  if (Object.keys(errors).length) return { errors };
  return { errors, design: { ...normalizeGeometry({ m: Number(draft.m), p: Number(draft.p), t: Number(draft.t) }, "percent"), alpha: Number(draft.alpha), re: Number(draft.re) } };
}

function designDraft(design: Design): Draft {
  return {
    m: String(design.m * 100), p: String((design.p || .4) * 100), t: String(design.t * 100),
    alpha: String(design.alpha), re: String(design.re),
  };
}

export default function Studio() {
  const [draft, setDraft] = useState<Draft>(initial);
  const latestDraft = useRef<Draft>(initial);
  const [design, setDesign] = useState<Design>(validate(initial).design!);
  const [preset, setPreset] = useState("2412");
  const [view, setView] = useState<WorkspaceView>("studio");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<(Awaited<ReturnType<typeof predict>> & { key: string; alpha: number }) | null>(null);
  const [failedKey, setFailedKey] = useState<string|null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const [linkError, setLinkError] = useState(false);
  useEffect(() => {
    setView(readWorkspaceView(window.location.search));
    try {
      const shared = readSharedDesign(window.location.search);
      if (shared) {
        const next = designDraft(shared);
        if (!validate(next).design) throw new Error("Invalid design link");
        update(next,shared);
        setPreset("");
      }
    } catch {
      setLinkError(true);
    }
    setUrlReady(true);
  }, []);
  const validation = validate(draft);
  const invalid = !validation.design;
  const key = JSON.stringify(design);
  let domainError = "";
  try { features(design); } catch (e) { domainError = (e as Error).message; }
  const available = urlReady && !invalid && !domainError;
  const failure = available && failedKey === key ?
    "The prediction model could not run. Check your connection and retry. If the runtime still fails, reload this page." : "";
  useEffect(() => {
    let cancelled = false;
    if (!available) return;
    const timer = setTimeout(() => {
      void predict(design).then((value) => {
        if (!cancelled) {
          setResult({ ...value, key, alpha: design.alpha });
          setFailedKey(null);
        }
      }).catch(() => {
        if (!cancelled) setFailedKey(key);
      });
    }, 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, available, retry]); // A superseded request can never display stale coefficients.
  const current = available && result?.key === key && !failure ? result : null;
  const status = current ? "Prediction ready" : failure ? "Model unavailable" : urlReady ? "Loading / calculating" : "Loading model";
  function update(next: Draft, exactDesign?: Design) {
    latestDraft.current = next;
    setDraft(next);
    const valid = exactDesign ?? validate(next).design;
    if (valid) setDesign(valid);
  }
  function reset() { update(initial); setPreset("2412"); setLinkError(false); }
  function selectPreset(code: string) {
    const p = parseNaca(code);
    update({ ...latestDraft.current, m: String(p.m * 100), p: String(p.m === 0 ? 40 : p.p * 100), t: String(p.t * 100) });
    setPreset(code);
  }
  function selectView(next: WorkspaceView) {
    const url = new URL(window.location.href);
    if (next === "studio") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
    setView(next);
  }
  return <Instrument draft={draft} design={design} preset={preset} view={view} onView={selectView} invalid={invalid}
    urlReady={urlReady} linkError={linkError} onDismissLinkError={() => setLinkError(false)}
    domainError={domainError} errors={validation.errors} current={current} result={result} status={status} failure={failure}
    onChange={(field, value) => { update({ ...latestDraft.current, [field]: value }); if (["m", "p", "t"].includes(field)) setPreset(""); }}
    onReset={reset} onPreset={selectPreset}
    onRestore={(saved) => { update(designDraft(saved),saved); setPreset(""); }}
    onRetry={() => { setResult(null); setFailedKey(null); setRetry(value => value + 1); }}/>
}
