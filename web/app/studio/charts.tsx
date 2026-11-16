"use client";
import { useEffect, useState } from "react";
import { model, predictBatch, type Design } from "../../lib/inference/surrogate";

export type SweepPoint = { alpha: number; cl: number; cd: number; ratio: number };
const [minAlpha, maxAlpha] = model.domain.alpha_deg;
const angles = Array.from({ length: (maxAlpha - minAlpha) * 2 + 1 }, (_, index) => minAlpha + index / 2);

export function useSweep(design: Design, enabled: boolean) {
  const { m, p, t, re } = design;
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([m, p, t, re, attempt]);
  const [data, setData] = useState<{ key: string; points: SweepPoint[]; error?: string }>();
  const active = enabled && data?.key === key ? data : undefined;
  useEffect(() => {
    if (!enabled || active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void predictBatch(angles.map(alpha => ({ m, p, t, re, alpha }))).then(({ rows }) => {
        if (cancelled) return;
        const points = rows.flatMap((row, index) => row ? [{ alpha: angles[index], ...row }] : []);
        setData({ key, points, error: points.length ? undefined : "The model returned no usable sweep points." });
      }).catch(() => {
        if (!cancelled) setData({ key, points: [], error: "Sweep unavailable for these conditions." });
      });
    },180);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[key,enabled,active,m,p,t,re]);
  return { points: active?.points ?? [], loading: enabled && !active, error: active?.error,
    retry: () => setAttempt(value => value + 1) };
}

function trace(points: SweepPoint[], x: (v: number) => number, y: (v: number) => number, field: "cl" | "cd") {
  return points.map((point, index) => {
    const continuous = index > 0 && point.alpha - points[index - 1].alpha === .5;
    return `${continuous ? "L" : "M"}${x(point.alpha)},${y(point[field])}`;
  }).join(" ");
}
export function Sparkline({ points, field, current }: { points:SweepPoint[];field:"cl"|"cd";current?:{alpha:number;value:number} }) {
  const values=points.map((p)=>p[field]);
  const min=Math.min(...values), max=Math.max(...values);
  const x=(a:number)=>10+(a+4)/16*190;
  const y=(v:number)=>54-(v-min)/(max-min||1)*42;
  return <svg className="sparkline" viewBox="0 0 210 74" role="img" aria-label={`${field.toUpperCase()} versus alpha, real model sweep; predictions withheld above 8 degrees`}>
    <path d="M10 10V54H200M57.5 10V54M105 10V54M152.5 10V54" className="spark-grid"/>
    <rect x="152.5" y="10" width="47.5" height="44" className="missing-region"/>
    {points.length>0 && <path d={trace(points, x, y, field)} className="spark-line"/>}
    {points.length>0 && current && current.alpha<=8 && <circle cx={x(current.alpha)} cy={y(current.value)} r="2.5" className="spark-point"/>}
    <text x="10" y="70">−4°</text><text x="145" y="70">8°</text><text x="184" y="70">12°</text>
  </svg>;
}

type Sweep = ReturnType<typeof useSweep>;

export function ChartPanel({ sweep, comparison, currentUnavailable, savedUnavailable, selected, following, onInspect }: {
  sweep:Sweep; comparison:Sweep; currentUnavailable:string; savedUnavailable:string;
  selected:number; following:boolean; onInspect:(angle:number|null)=>void;
}) {
  const allPoints = [...sweep.points, ...comparison.points];
  return <>
    <div className="chart-legend micro">
      <span>Current / solid</span>
      {(comparison.loading || !!comparison.points.length) && <span>Saved / dashed</span>}
      <span className="muted">Above 8° withheld</span>
      <button className="chip micro chart-follow" type="button" aria-pressed={following} onClick={()=>onInspect(null)}>
        Follow design angle
      </button>
    </div>
    {sweep.loading && <p role="status" className="chart-message">Calculating current sweep…</p>}
    {comparison.loading && <p role="status" className="chart-message">Calculating saved sweep…</p>}
    {currentUnavailable && <p className="chart-message">{currentUnavailable}</p>}
    {savedUnavailable && <p className="chart-message">{savedUnavailable}</p>}
    {([["Current",sweep],["Saved",comparison]] as const).map(([label,source])=>source.error &&
      <div key={label} className="chart-sweep-error">
        <p role="alert" className="chart-message">{label} sweep. {source.error}</p>
        <button className="chip micro" type="button" onClick={source.retry}>Retry {label.toLowerCase()} sweep</button>
      </div>)}
    {!!allPoints.length && <div className="full-charts">
      <SweepChart title="Lift / angle of attack" field="cl" current={sweep.points} saved={comparison.points} selected={selected} onInspect={onInspect} />
      <SweepChart title="Drag / angle of attack" field="cd" current={sweep.points} saved={comparison.points} selected={selected} onInspect={onInspect} />
    </div>}
    <p className="drawer-caveat">The model samples every 0.5° from −4° to 8°, at each design’s Reynolds number. Missing values leave gaps. Select an angle on a chart to inspect its coefficients.</p>
  </>;
}

function SweepChart({ title, field, current, saved, selected, onInspect }: {
  title: string; field: "cl" | "cd"; current: SweepPoint[]; saved: SweepPoint[];
  selected: number; onInspect: (alpha: number) => void;
}) {
  const label = field.toUpperCase();
  const values = [...current, ...saved].map(point => point[field]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const x = (alpha: number) => 51 + (alpha + 4) / 16 * 289;
  const y = (value: number) => 139 - (value - min) / (max - min || 1) * 112;
  const selectedCurrent = current.find(point => point.alpha === selected);
  const selectedSaved = saved.find(point => point.alpha === selected);
  const digits = field === "cd" ? 5 : 4;
  function inspect(svg: SVGSVGElement, clientX: number, clientY: number) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    const alpha = Math.round(((point.x - 51) / 289 * 16 - 4) * 2) / 2;
    onInspect(Math.max(-4, Math.min(12, alpha)));
  }
  return <section className="plot">
    <h3 className="micro">{title}</h3>
    <svg viewBox="0 0 360 188" role="img" aria-label={title}
      onPointerMove={event => { if (event.pointerType === "mouse") inspect(event.currentTarget, event.clientX, event.clientY); }}
      onClick={event => inspect(event.currentTarget, event.clientX, event.clientY)}>
      <rect x={x(8)} y="27" width={x(12) - x(8)} height="112" className="missing-region"/>
      {[0, .25, .5, .75, 1].map(fraction => <g key={fraction}>
        <path d={`M51 ${139 - fraction * 112}H340`} className="plot-grid"/>
        <text x="45" y={143 - fraction * 112} textAnchor="end">
          {(min + (max - min) * fraction).toFixed(field === "cd" ? 3 : 2)}
        </text>
      </g>)}
      {[-4, 0, 4, 8, 12].map(angle => <text key={angle} x={x(angle)} y="158" textAnchor="middle">{angle}°</text>)}
      <text x="3" y="15">{label} (dimensionless)</text>
      <text x="196" y="180" textAnchor="middle">Angle of attack (degrees)</text>
      {!!current.length && <path d={trace(current, x, y, field)} className="chart-line"/>}
      {!!saved.length && <path d={trace(saved, x, y, field)} className="comparison-line"/>}
      <path d={`M${x(selected)} 27V139`} className="hover-line"/>
      {selectedCurrent && <circle cx={x(selected)} cy={y(selectedCurrent[field])} r="3" className="spark-point"/>}
      {selectedSaved && <circle cx={x(selected)} cy={y(selectedSaved[field])} r="3" className="saved-point"/>}
    </svg>
    <div className="chart-inspector micro">
      <label>Inspect angle <input type="number" min="-4" max="12" step=".5" value={selected}
        aria-label={`Inspect ${label} angle`} onChange={event => {
          const value = event.currentTarget.valueAsNumber;
          if (Number.isFinite(value)) onInspect(Math.max(-4, Math.min(12, value)));
        }}/></label>
      <output data-testid={`inspect-${field}`}>
        Current {selectedCurrent?.[field].toFixed(digits) ?? "—"}
        {!!saved.length && ` / Saved ${selectedSaved?.[field].toFixed(digits) ?? "—"}`}
      </output>
    </div>
  </section>;
}
