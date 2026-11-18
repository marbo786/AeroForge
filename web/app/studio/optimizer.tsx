"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  clampToModel,
  formatRe,
  modelBounds,
  type Bounds,
  type Design,
} from "../../lib/inference/domain";
import { exportRun, startSearch, type Run } from "../../lib/optimization/browser";
import {
  axes,
  objectives,
  policy,
  validateSettings,
  type Objective,
  type Settings,
} from "../../lib/optimization/search";
import { ShareCard } from "./share-card";
import { ShareDesign } from "./design-actions";
import { sharedDesignUrl } from "./shared-design";
import { useLivery } from "./livery";
import { download } from "./design-actions";
import { Drawer } from "./kit";
import { SectionPreview } from "./section-preview";
import "./optimizer.css";

const axisLabels = { m: "Camber", p: "Camber position", t: "Thickness", alpha: "Angle of attack" };
const axisScale = { m: 100, p: 100, t: 100, alpha: 1 };
const compactNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 8,
  useGrouping: false,
});
const number = (value: number) => compactNumber.format(value);
const metric = (objective: Objective, score: number) =>
  (objective === "drag" ? -score : score).toFixed(
    objective === "drag" ? 5 : objective === "lift" ? 4 : 2,
  );

function defaults(design: Design): Settings {
  const current = clampToModel(design);
  return {
    objective: "efficiency",
    algorithm: "differential-evolution",
    re: Math.round(current.re),
    ranges: { ...modelBounds, alpha: [current.alpha, current.alpha] },
    minimumLift: 0.7,
    evaluations: policy.default_evaluations,
    seed: 42,
  };
}

function OptimizationForm({
  initial,
  busy,
  onStart,
}: {
  initial: Settings;
  busy: boolean;
  onStart: (settings: Settings) => void;
}) {
  const [objective, setObjective] = useState(initial.objective);
  const [boundedAlpha, setBoundedAlpha] = useState(
    initial.ranges.alpha[0] !== initial.ranges.alpha[1],
  );
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const read = (key: string) => {
      const raw = values.get(key);
      return typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
    };
    const range = (axis: (typeof axes)[number]): Bounds => [
      read(`${axis}-min`) / axisScale[axis],
      read(`${axis}-max`) / axisScale[axis],
    ];
    const settings: Settings = {
      objective,
      algorithm: values.get("algorithm") as Settings["algorithm"],
      re: read("re"),
      ranges: {
        m: range("m"),
        p: range("p"),
        t: range("t"),
        alpha: boundedAlpha ? range("alpha") : [read("fixed-alpha"), read("fixed-alpha")],
      },
      minimumLift: objective === "drag" ? read("minimumLift") : initial.minimumLift,
      evaluations: read("evaluations"),
      seed: read("seed"),
    };
    try {
      validateSettings(settings);
      setError("");
      onStart(settings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the search inputs.");
    }
  }
  function rangeInput(axis: (typeof axes)[number]) {
    const label = axisLabels[axis];
    const unit = axis === "alpha" ? "°" : "% chord";
    const scale = axisScale[axis];
    return (
      <fieldset className="v3-range" key={axis}>
        <legend>
          {label} ({unit})
        </legend>
        {(["minimum", "maximum"] as const).map((edge, i) => (
          <label key={edge}>
            {i === 0 ? "Min" : "Max"}
            <input
              aria-label={`${label} ${edge}`}
              name={`${axis}-${i === 0 ? "min" : "max"}`}
              type="number"
              step="any"
              required
              min={modelBounds[axis][0] * scale}
              max={modelBounds[axis][1] * scale}
              defaultValue={number(
                (axis === "alpha" && initial.ranges.alpha[0] === initial.ranges.alpha[1]
                  ? modelBounds.alpha[i]
                  : initial.ranges[axis][i]) * scale,
              )}
            />
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <form onSubmit={submit} className="v3-search-form" noValidate>
      <fieldset disabled={busy}>
        <legend className="sr-only">Search settings</legend>
        <div className="v3-search-fields">
          <label>
            Objective
            <select
              name="objective"
              value={objective}
              onChange={(event) => setObjective(event.target.value as Objective)}
            >
              {Object.entries(objectives).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reynolds number
            <input
              name="re"
              type="number"
              step="1"
              min={modelBounds.re[0]}
              max={modelBounds.re[1]}
              defaultValue={initial.re}
              required
            />
          </label>
          <label>
            Angle mode
            <select
              name="angleMode"
              value={boundedAlpha ? "range" : "fixed"}
              onChange={(event) => setBoundedAlpha(event.target.value === "range")}
            >
              <option value="fixed">Fixed angle</option>
              <option value="range">Angle range</option>
            </select>
          </label>
          {boundedAlpha ? (
            rangeInput("alpha")
          ) : (
            <label>
              Fixed angle (°)
              <input
                name="fixed-alpha"
                type="number"
                step="any"
                min={modelBounds.alpha[0]}
                max={modelBounds.alpha[1]}
                defaultValue={number(initial.ranges.alpha[0])}
                required
              />
            </label>
          )}
          {objective === "drag" && (
            <label>
              Minimum lift coefficient
              <input
                name="minimumLift"
                type="number"
                step="any"
                min={policy.cl[0]}
                max={policy.cl[1]}
                defaultValue={initial.minimumLift}
                required
              />
            </label>
          )}
        </div>
        <details className="v3-search-settings">
          <summary>Geometry limits and search settings</summary>
          <div className="v3-search-fields">
            {axes.slice(0, 3).map(rangeInput)}
            <label>
              Candidate evaluation limit
              <input
                name="evaluations"
                type="number"
                min="1"
                max={policy.max_evaluations}
                step="1"
                defaultValue={initial.evaluations}
                required
              />
            </label>
            <label>
              Search algorithm
              <select name="algorithm" defaultValue={initial.algorithm}>
                <option value="differential-evolution">Differential evolution</option>
                <option value="random">Random search</option>
              </select>
            </label>
            <label>
              Random seed
              <input
                name="seed"
                type="number"
                min="0"
                max={0xffffffff}
                step="1"
                defaultValue={initial.seed}
                required
              />
            </label>
          </div>
        </details>
      </fieldset>
      {error && (
        <p role="alert" className="v3-search-warning">
          {error}
        </p>
      )}
      <button className="chip micro active" disabled={busy} type="submit">
        Start search
      </button>
    </form>
  );
}

function History({ run }: { run: Run }) {
  const { history, counts } = run.result;
  if (!history.length) return null;
  const low = history[0].score;
  const high = history[history.length - 1].score;
  const x = (rows: number) => 26 + (rows / run.settings.evaluations) * 408;
  const y = (score: number) => (low === high ? 44 : 72 - ((score - low) / (high - low)) * 54);
  let path = `M${x(history[0].evaluated)} ${y(low)}`;
  for (const point of history.slice(1)) path += `H${x(point.evaluated)}V${y(point.score)}`;
  path += `H${x(counts.completed)}`;
  return (
    <figure className="v3-search-history">
      <figcaption>Best objective by candidate evaluation</figcaption>
      <svg
        viewBox="0 0 460 94"
        role="img"
        aria-label={`Best score from ${metric(run.settings.objective, low)} to ${metric(run.settings.objective, high)} after ${counts.completed} candidate evaluations`}
      >
        <path d="M26 16V74H434" className="v3-history-axis" />
        <path d={path} className="v3-history-line" />
        <circle cx={x(counts.completed)} cy={y(high)} r="3" />
        <text x="26" y="88">
          0
        </text>
        <text x="434" y="88" textAnchor="end">
          {run.settings.evaluations}
        </text>
      </svg>
      <p>
        First {metric(run.settings.objective, low)} · Best {metric(run.settings.objective, high)}
      </p>
    </figure>
  );
}

export default function Optimizer({
  open,
  onClose,
  design,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  design: Design;
  onApply: (design: Design) => void;
}) {
  const [run, setRun] = useState<Run>();
  const [selected, setSelected] = useState(0);
  const { livery } = useLivery();
  const [track, setTrack] = useState("custom");
  const [undo, setUndo] = useState<Design>();
  const active = useRef<ReturnType<typeof startSearch>>(null);
  useEffect(() => () => active.current?.dispose(), []);
  const busy = run?.status === "running";
  const result = run?.result;
  const candidate = result?.shortlist[selected] ?? result?.shortlist[0];
  const baseline = result?.baseline;
  const baselineScore = baseline?.score ?? null;
  const counts = result?.counts;

  function close() {
    active.current?.cancel();
    onClose();
  }

  return (
    <Drawer open={open} onClose={close} title="Design optimization" className="v3-optimizer-panel">
      <div className="v3-search">
        <p>
          Search isolated NACA sections with the coefficient model. The search excludes limited
          training coverage and screens predicted lift and drag.
        </p>
        <label className="track-preset">
          Illustrative track brief
          <select value={track} disabled={busy} onChange={(event) => setTrack(event.target.value)}>
            <option value="custom">Custom section search</option>
            <option value="low-drag">Long straight / low drag</option>
            <option value="high-lift">Technical circuit / high downforce brief</option>
          </select>
        </label>
        <p className="track-limits">
          Illustrative presets only. Optimize isolated section coefficients; no track lap time or
          car downforce is predicted.
        </p>
        <OptimizationForm
          key={track}
          initial={
            track === "custom"
              ? (run?.settings ?? defaults(design))
              : {
                  ...defaults(design),
                  objective: track === "low-drag" ? "drag" : "lift",
                  ranges: {
                    ...defaults(design).ranges,
                    alpha: track === "low-drag" ? [2, 2] : [8, 8],
                  },
                  minimumLift: track === "low-drag" ? 0.35 : 1,
                }
          }
          busy={busy}
          onStart={(settings) => {
            setSelected(0);
            active.current = startSearch(settings, design, setRun);
          }}
        />
        {undo && (
          <button
            className="chip micro"
            onClick={() => {
              onApply(undo);
              setUndo(undefined);
              close();
            }}
          >
            Revert applied design
          </button>
        )}
        {run && counts && (
          <section className="v3-search-results" aria-label="Search results">
            <div className="v3-search-progress">
              <p role="status" aria-label="Search status">
                {run.status === "running"
                  ? "Search running"
                  : run.status === "finished"
                    ? "Search complete"
                    : run.status === "cancelled"
                      ? "Search cancelled"
                      : "Search failed"}
              </p>
              {busy && (
                <button className="chip micro" onClick={() => active.current?.cancel()}>
                  Cancel search
                </button>
              )}
              <progress
                aria-label="Candidate evaluation progress"
                max={run.settings.evaluations}
                value={counts.completed}
              />
              <p>
                {counts.completed} of {run.settings.evaluations} candidate evaluations completed
              </p>
            </div>
            <p className="v3-search-counts" data-testid="search-counts">
              {counts.attempted} proposed · {counts.sparse} sparse · {counts.duplicate} duplicates ·{" "}
              {counts.submitted} submitted · {counts.feasible} feasible · {counts.rejected} rejected
              after evaluation · {counts.baselineRows} baseline
            </p>
            {run.message && (
              <p role="alert" className="v3-search-warning">
                {run.message}
              </p>
            )}
            {!busy && counts.completed < run.settings.evaluations && run.status === "finished" && (
              <p>The search exhausted its proposal limit or the available unique designs.</p>
            )}
            {!candidate && !busy && <p>No feasible candidate was found.</p>}
            {candidate && (
              <div className="v3-search-comparison">
                <h3>Surrogate-predicted candidate</h3>
                {result.shortlist.length > 1 && (
                  <div
                    className="v3-search-shortlist"
                    role="group"
                    aria-label="Shortlisted candidates"
                  >
                    {result.shortlist.map((item, i) => (
                      <button
                        type="button"
                        key={i}
                        className="chip micro"
                        aria-pressed={selected === i}
                        onClick={() => setSelected(i)}
                      >
                        {i === 0 ? "Best" : `Candidate ${i + 1}`} ·{" "}
                        {metric(run.settings.objective, item.score)}
                      </button>
                    ))}
                  </div>
                )}
                <SectionPreview design={candidate.design} saved={run.original} invalid={false} />
                <p className="v3-search-legend">Candidate solid · Original dashed</p>
                <p>
                  Candidate CL {candidate.prediction.cl.toFixed(4)} · CD{" "}
                  {candidate.prediction.cd.toFixed(5)}
                  {" · "}L/D {(candidate.prediction.cl / candidate.prediction.cd).toFixed(2)}
                </p>
                {baseline?.prediction && (
                  <p>
                    Original geometry at {number(baseline.design.alpha)}° and Re{" "}
                    {formatRe(baseline.design.re)} · CL {baseline.prediction.cl.toFixed(4)} · CD{" "}
                    {baseline.prediction.cd.toFixed(5)}
                  </p>
                )}
                {baselineScore === null ? (
                  <p>The baseline is unavailable or fails a search constraint.</p>
                ) : (
                  <p>
                    Objective improvement{" "}
                    {metric(
                      run.settings.objective,
                      (candidate.score - baselineScore) *
                        (run.settings.objective === "drag" ? -1 : 1),
                    )}{" "}
                    {run.settings.objective === "drag"
                      ? "CD reduction"
                      : run.settings.objective === "lift"
                        ? "CL gain"
                        : "L/D gain"}
                  </p>
                )}
                <dl className="v3-search-deltas">
                  {axes.map((axis) => (
                    <div key={axis}>
                      <dt>
                        {axisLabels[axis]} {axis === "alpha" ? "(°)" : "(% chord)"}
                      </dt>
                      <dd>
                        {axis === "p" && (candidate.design.m === 0 || run.original.m === 0)
                          ? "—"
                          : `${number(run.original[axis] * axisScale[axis])} → ${(candidate.design[axis] * axisScale[axis]).toFixed(3)}`}
                      </dd>
                    </div>
                  ))}
                </dl>
                <History run={run} />
                {!busy && run.status === "finished" && (
                  <section className="optimizer-challenge" aria-label="Optimizer challenge card">
                    <h3>Optimizer challenge</h3>
                    <p>
                      Surrogate-selected result. Independently verify the shortlist before drawing
                      physical conclusions.
                    </p>
                    <ShareCard
                      design={candidate.design}
                      current={{
                        ...candidate.prediction,
                        ratio: candidate.prediction.cl / candidate.prediction.cd,
                      }}
                      title="Optimizer challenge"
                      subtitle={`Surrogate / ${objectives[run.settings.objective]} · ${baselineScore !== null && Math.abs(baselineScore) > 1e-8 ? `objective Δ ${(((candidate.score - baselineScore) / Math.abs(baselineScore)) * 100).toFixed(1)}%` : "baseline unavailable"} · seed ${run.settings.seed} · ${counts.completed} evaluations`}
                    />
                    <ShareDesign
                      url={sharedDesignUrl(
                        window.location.origin,
                        candidate.design,
                        "airfoil",
                        livery,
                      )}
                    />
                  </section>
                )}

                {!busy && (
                  <div className="v3-search-shortlist">
                    <button
                      className="chip micro active"
                      onClick={() => {
                        setUndo(design);
                        onApply(candidate.design);
                        close();
                      }}
                    >
                      Apply to Studio
                    </button>
                    <button
                      className="chip micro"
                      onClick={() =>
                        download(
                          new Blob([JSON.stringify(exportRun(run), null, 2) + "\n"], {
                            type: "application/json",
                          }),
                          "aeroforge-shortlist.json",
                        )
                      }
                    >
                      Export XFOIL shortlist
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </Drawer>
  );
}
