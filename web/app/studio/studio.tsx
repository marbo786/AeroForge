"use client";

import { useEffect, useState } from "react";
import { generateGeometry, normalizeGeometry, parseNaca, presetCodes, sectionAt, type Point } from "../../lib/geometry/naca4";
import { features, model, predict, type Design } from "../../lib/inference/surrogate";
import "./studio.css";

const initial = { m: "2", p: "40", t: "12", alpha: "4", re: "250000" };
type Field = keyof typeof initial;
type Draft = typeof initial;
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
function foilName(d: Design) {
  if ([d.m * 100, d.p * 10, d.t * 100].every((v) => Math.abs(v - Math.round(v)) < 1e-8))
    return `NACA ${Math.round(d.m * 100)}${Math.round(d.p * 10)}${Math.round(d.t * 100).toString().padStart(2, "0")}`;
  return "Custom section";
}

function Airfoil({ design, invalid }: { design: Design; invalid: boolean }) {
  const geometry = generateGeometry(design);
  const xy = ([x, y]: Point) => `${(120 + x * 560).toFixed(4)},${(240 - y * 560).toFixed(4)}`;
  const path = `M${geometry.contour.map(xy).join(" L")} Z`;
  const camber = geometry.x.map((x) => xy([x, sectionAt(design, x).camber])).join(" ");
  const angle = design.alpha;
  return <section className="drawing" aria-labelledby="drawing-title">
    <div className="drawing-heading"><div><span className="section-label">Section geometry</span><h2 id="drawing-title">{foilName(design)}</h2></div><span className="view-label">2D / chord-normalized</span></div>
    <svg className="airfoil-svg" viewBox="0 0 800 480" role="img" aria-labelledby="foil-title foil-description">
      <title id="foil-title">{`${foilName(design)} airfoil at ${design.alpha} degrees`}</title>
      <desc id="foil-description">{`Accurate NACA upper and lower surfaces with equal horizontal and vertical scale. Positive angle rotates the leading edge upward. ${invalid ? "Showing the last valid geometry." : ""}`}</desc>
      <defs><pattern id="small-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#1c2935" strokeWidth=".6"/></pattern><pattern id="grid" width="140" height="140" patternUnits="userSpaceOnUse"><rect width="140" height="140" fill="url(#small-grid)"/><path d="M140 0H0V140" fill="none" stroke="#2a3a49" strokeWidth=".8"/></pattern><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#8397aa"/></marker></defs>
      <rect width="800" height="480" fill="url(#grid)"/>
      <path d="M36 240H764 M120 54V400" className="axis"/>
      <g className="svg-label"><text x="42" y="222">y/c</text><text x="738" y="260">x/c</text><text x="107" y="261">0</text><text x="391" y="261">0.5</text><text x="672" y="261">1.0</text></g>
      <path d="M42 115H110" className="flow-direction" markerEnd="url(#arrow)"/><text x="42" y="99" className="svg-label">Freestream</text>
      <g transform={`rotate(${angle} 260 240)`} className="foil-rotation">
        <path d={path} style={{ d: `path("${path}")` }} className="foil-shape" data-testid="foil-path"/>
        <polyline points={camber} className="camber-line"/>
        <path d="M120 240H680" className="chord-line"/>
        <circle cx="120" cy="240" r="3" fill="#e8eef5"/><circle cx="680" cy="240" r="3" fill="#e8eef5"/>
        <path d="M120 252V315 M680 252V315 M120 306H680" className="dimension"/>
        <text x="400" y="326" textAnchor="middle" className="svg-label">Reference chord = 1.000</text>
        <text x="116" y="218" textAnchor="end" className="edge-label">LE</text><text x="690" y="205" className="edge-label">TE</text>
      </g>
      <circle cx="260" cy="240" r="4" className="quarter-chord"/>
      <path d={`M330 240 A70 70 0 0 ${design.alpha >= 0 ? 1 : 0} ${260 + 70 * Math.cos(design.alpha * Math.PI / 180)} ${240 + 70 * Math.sin(design.alpha * Math.PI / 180)}`} className="angle-arc"/>
      <text x="337" y="178" className="angle-label">α {design.alpha.toFixed(1)}°</text>
      <g className="svg-label"><text x="34" y="450">Equal axis scale</text><text x="766" y="450" textAnchor="end">Finite trailing edge</text></g>
    </svg>
    <div className="drawing-legend"><span><i className="legend-surface"/>Surface</span><span><i className="legend-camber"/>Mean camber</span><span><i className="legend-chord"/>Chord</span><span className="geometry-note">{invalid ? "Last valid geometry" : "Analytic NACA geometry"}</span></div>
  </section>;
}

export default function Studio() {
  const [draft, setDraft] = useState<Draft>(initial);
  const [design, setDesign] = useState<Design>(validate(initial).design!);
  const [preset, setPreset] = useState("2412");
  const [expanded, setExpanded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<(Awaited<ReturnType<typeof predict>> & { key: string }) | null>(null);
  const [status, setStatus] = useState("Loading model");
  const [failure, setFailure] = useState("");
  const validation = validate(draft);
  const invalid = !validation.design;
  const key = JSON.stringify(design);
  let domainError = "";
  try { features(design); } catch (e) { domainError = (e as Error).message; }
  const available = !invalid && !domainError;
  useEffect(() => {
    let cancelled = false;
    if (!available) return;
    setStatus("Loading / calculating"); setFailure("");
    const timer = setTimeout(() => {
      void predict(design).then((value) => {
        if (!cancelled) { setResult({ ...value, key }); setStatus("Prediction ready"); }
      }).catch(() => {
        if (!cancelled) { setFailure("The prediction model could not run. Check your connection and retry. If the runtime still fails, reload this page."); setStatus("Model unavailable"); }
      });
    }, 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, available, retry]); // A superseded request can never display stale coefficients.
  const current = available && result?.key === key && !failure ? result : null;
  function update(next: Draft) {
    setDraft(next);
    const valid = validate(next);
    if (valid.design) setDesign(valid.design);
  }
  function reset() { update(initial); setPreset("2412"); }
  function selectPreset(code: string) {
    const p = parseNaca(code);
    update({ ...draft, m: String(p.m * 100), p: String(p.m === 0 ? 40 : p.p * 100), t: String(p.t * 100) });
    setPreset(code);
  }
  return <div className="studio-shell">
    <header className="studio-header"><a href="/" className="brand" aria-label="AeroForge home"><svg width="30" height="28" viewBox="0 0 30 28" aria-hidden="true"><path d="M2 23L14 4L28 23H21L14 12L8 23Z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M2 23L27 17" stroke="#45c4d8" strokeWidth="2"/></svg>AeroForge<span className="brand-version">/ v1</span></a><nav aria-label="Main navigation"><a href="/studio/" aria-current="page">Design Studio</a><a href="#model-evidence">Model evidence</a></nav><a className="repository" href="https://github.com/marbo786/AeroForge">GitHub <span aria-hidden="true">↗</span></a></header>
    <main className="studio-main">
      <div className="workspace-heading"><div><div className="section-label">Aerodynamic workspace</div><h1>Shape meets performance.</h1><p>Edit a section. Evaluate lift and drag in your browser.</p></div><div className="workspace-tag"><span className="status-dot"/>Local inference<span className="tag-sub">NACA 4-digit / 2D</span></div></div>
      <div className="workbench">
        <aside className={`parameters ${expanded ? "is-expanded" : ""}`} aria-labelledby="parameter-title">
          <div className="panel-heading"><h2 id="parameter-title">Design parameters</h2><button className="reset-button" onClick={reset}>Reset</button></div>
          <button className="parameter-toggle" aria-expanded={expanded} aria-controls="parameter-controls" onClick={() => setExpanded(!expanded)}>{expanded ? "Hide parameters" : "Edit parameters"}<span aria-hidden="true">{expanded ? "−" : "+"}</span></button>
          <div className="parameter-controls" id="parameter-controls">
            <div className="preset-control"><label htmlFor="preset">Airfoil preset</label><select id="preset" value={preset} onChange={(e) => selectPreset(e.target.value)}><option value="" disabled>Custom section</option>{presetCodes.map((code) => <option key={code} value={code}>NACA {code}</option>)}</select><p>Standard four-digit family</p></div>
            {controls.map((c, index) => <div className={`parameter-control ${index === 3 ? "operating-start" : ""}`} key={c.key}>
              {index === 3 && <h3>Operating conditions</h3>}
              <div className="control-heading"><label htmlFor={`number-${c.key}`}>{c.label}</label><span className="control-unit">{c.unit}</span></div>
              <div className="control-value"><input id={`number-${c.key}`} type="number" min={c.min} max={c.max} step="any" inputMode="decimal" value={c.key === "p" && Number(draft.m) === 0 ? "0" : draft[c.key]} disabled={c.key === "p" && Number(draft.m) === 0} aria-invalid={!!validation.errors[c.key]} aria-describedby={validation.errors[c.key] ? `error-${c.key}` : undefined} onChange={(e) => { update({ ...draft, [c.key]: e.target.value }); if (["m", "p", "t"].includes(c.key)) setPreset(""); }}/><span>{c.key === "re" ? "Re" : c.key === "alpha" ? "α" : c.key === "t" ? "t/c" : c.key === "p" ? "p/c" : "m/c"}</span></div>
              <input aria-label={`${c.label} slider`} type="range" min={c.min} max={c.max} step={c.step} value={Number.isFinite(Number(draft[c.key])) ? Number(draft[c.key]) : c.min} disabled={c.key === "p" && Number(draft.m) === 0} onChange={(e) => { update({ ...draft, [c.key]: e.target.value }); if (["m", "p", "t"].includes(c.key)) setPreset(""); }}/>
              <div className="range-bounds"><span>{c.min.toLocaleString("en-US")}</span><span>{c.max.toLocaleString("en-US")}</span></div>
              {c.key === "p" && Number(draft.m) === 0 && <p className="control-help">Symmetric section; position is canonicalized to zero.</p>}
              {validation.errors[c.key] && <p className="input-error" id={`error-${c.key}`} role="alert">{validation.errors[c.key]}</p>}
            </div>)}
          </div>
        </aside>
        <div className="center-column"><Airfoil design={design} invalid={invalid}/><div className="section-strip"><div><span>Camber</span><strong>{(design.m * 100).toFixed(1)}<small>%</small></strong></div><div><span>Thickness</span><strong>{(design.t * 100).toFixed(1)}<small>%</small></strong></div><div><span>Incidence</span><strong>{design.alpha.toFixed(1)}<small>°</small></strong></div></div><div className="viewport-note"><span aria-hidden="true">↳</span><p>The drawing shows section geometry and incidence. Aerodynamic coefficients come from the trained surrogate.</p></div></div>
        <aside className="telemetry" aria-labelledby="telemetry-title"><div className="panel-heading"><h2 id="telemetry-title">Predicted performance</h2><span className="coefficient-label">CL / CD</span></div><div className="prediction-state" role="status"><span className={`status-dot ${!current ? "pending" : ""}`}/>{invalid ? "Check parameters" : domainError ? "Outside model bounds" : current ? "Prediction ready" : status}</div>
          <dl className="coefficient-list"><div className="lift-readout"><dt>Lift coefficient <span>C<sub>L</sub></span></dt><dd data-testid="cl">{current ? current.cl.toFixed(4) : "—"}</dd><p>Dimensionless</p></div><div><dt>Drag coefficient <span>C<sub>D</sub></span></dt><dd data-testid="cd">{current ? current.cd.toFixed(5) : "—"}</dd><p>Dimensionless</p></div><div><dt>Lift-to-drag ratio <span>L/D</span></dt><dd data-testid="ratio">{current ? current.ratio.toFixed(2) : "—"}</dd></div></dl>
          <div className="runtime-readout"><span>Inference time</span><strong data-testid="latency">{current ? `${current.durationMs.toFixed(2)} ms` : "—"}</strong><p>Model execution only; excludes initial download.</p></div>
          {failure && available && <div className="model-error" role="alert"><p>{failure}</p><button onClick={() => { setResult(null); setRetry(retry + 1); }}>Retry model</button></div>}
          <div className="applicability" data-testid="applicability"><span className="warning-label">{domainError ? "Prediction withheld" : "Finite evidence domain"}</span><p>{domainError || "XFOIL agreement on sampled cases. Continuous-domain and experimental accuracy are not established."}</p>{invalid && <p>Correct the highlighted inputs to calculate.</p>}{!domainError && design.re === 100000 && <p>Drag errors are higher at low Reynolds numbers.</p>}{!domainError && !model.domain.sampled_reynolds.includes(design.re) && <p>Reynolds interpolation between sampled levels.</p>}</div>
        </aside>
      </div>
      <section id="model-evidence" className="evidence-strip" aria-labelledby="evidence-title"><div className="evidence-intro"><span className="section-label">Model provenance</span><h2 id="evidence-title">Built on solver evidence.</h2><p>XFOIL 6.99 reference labels. No experimental validation or post-stall prediction.</p></div><div><span>Model version</span><strong>{model.version}</strong><p>Single-thread WASM / local execution</p></div><div><span>Sampled conditions</span><strong>−4 to 8° / Re 100k–500k</strong><p>Re levels: 100k, 250k, 500k</p></div><div><span>Independent final panel</span><strong>165 cases / 8 unseen geometries</strong><p>MAE: CL 0.01484 / CD 0.000683</p></div></section>
    </main><footer className="studio-footer"><span>AeroForge <span className="footer-divider">/</span> Design. Simulate. Optimize.</span><a href="/spike/">Open inference test</a><span>2D sections. Finite evidence. Informed design.</span></footer>
  </div>;
}
