import { useEffect, useState } from "react";
import { Readout, StatusPill } from "./kit";
import type { Result } from "./section-design";
import { coverageLabels, type TrainingCoverage } from "./use-training-coverage";

type TelemetryProps = {
  current: Result | null;
  baseline: Result | null;
  conditionKey: string;
  pending: boolean;
  sweeping: boolean;
  inBounds: boolean;
  statusText: string;
  domainLabel: string;
  domainError: string;
  invalid: boolean;
  interpolatedRe: boolean;
  coverage: TrainingCoverage;
  onClamp: () => void;
  onDetails: () => void;
};

export function Telemetry({
  current,
  baseline,
  conditionKey,
  pending,
  sweeping,
  inBounds,
  statusText,
  domainLabel,
  domainError,
  invalid,
  interpolatedRe,
  coverage,
  onClamp,
  onDetails,
}: TelemetryProps) {
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState<
    Record<string, { first: Result; best: Result; worst: Result }>
  >({});
  useEffect(() => {
    if (!current) return;
    setStarted(true);
    setHistory((previous) => {
      const prior = previous[conditionKey];
      return {
        ...previous,
        [conditionKey]: {
          first: prior?.first ?? current,
          best: {
            ...current,
            cl: Math.max(prior?.best.cl ?? -Infinity, current.cl),
            cd: Math.min(prior?.best.cd ?? Infinity, current.cd),
            ratio: Math.max(prior?.best.ratio ?? -Infinity, current.ratio),
          },
          worst: {
            ...current,
            cl: Math.min(prior?.worst.cl ?? Infinity, current.cl),
            cd: Math.max(prior?.worst.cd ?? -Infinity, current.cd),
            ratio: Math.min(prior?.worst.ratio ?? Infinity, current.ratio),
          },
        },
      };
    });
  }, [current, conditionKey]);
  const reference = baseline ?? history[conditionKey]?.first;
  function delta(key: "cl" | "cd" | "ratio", digits: number) {
    if (!current || !reference) return <span className="metric-delta">Δ —</span>;
    const change = current[key] - reference[key];
    const gain = change * (key === "cd" ? -1 : 1);
    const best = history[conditionKey]?.best[key];
    const isBest = gain > 1e-8 && best !== undefined && Math.abs(best - current[key]) < 1e-8;
    const state = isBest ? "best" : gain > 1e-8 ? "improved" : gain < -1e-8 ? "worse" : "neutral";
    const worst = history[conditionKey]?.worst[key];
    const span = best !== undefined && worst !== undefined ? best - worst : 0;
    const position =
      span && worst !== undefined
        ? Math.max(0, Math.min(100, ((current[key] - worst) / span) * 100))
        : 0;
    const symbol = key === "ratio" ? "L/D" : key.toUpperCase();
    return (
      <>
        <span className={`metric-delta delta-${state}`}>
          <span aria-hidden="true">{state === "neutral" ? "↔" : change > 0 ? "↑" : "↓"}</span>{" "}
          {change >= 0 ? "+" : ""}
          {change.toFixed(digits)} ·{" "}
          {isBest
            ? "Session best"
            : state === "neutral"
              ? "Baseline"
              : state === "improved"
                ? "Better"
                : "Worse"}
        </span>
        <div
          className={`sector-track delta-${state}`}
          role="meter"
          aria-label={`${symbol} session position`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          aria-valuetext={
            span
              ? `${Math.round(position)} percent from session worst toward best at this α / Re`
              : "One observed value at this α / Re"
          }
        >
          {Array.from({ length: 8 }, (_, index) => (
            <i
              key={index}
              aria-hidden="true"
              data-filled={span && index < Math.ceil(position / 12.5) ? "true" : undefined}
            />
          ))}
        </div>
        <div className="sector-caption">
          {span ? (
            <>
              <span>Worst</span>
              <span>Best</span>
            </>
          ) : (
            <span>One observed value</span>
          )}
        </div>
      </>
    );
  }
  return (
    <aside className="v2-telemetry" aria-label="Predicted performance">
      <div className="v2-panel-heading">
        <h2>Predicted performance</h2>
        <span className="micro">Pit wall / live telemetry</span>
        <span className="micro">Isolated 2D section</span>
      </div>
      <div className="v2-metrics">
        {(
          [
            ["Lift coefficient", "CL", "cl", 4],
            ["Drag coefficient", "CD", "cd", 5],
            ["Lift to drag", "L/D", "ratio", 2],
          ] as const
        ).map(([label, symbol, key, digits]) => (
          <div className="v2-metric" key={key}>
            <div className="v2-metric-label">
              <span>{label}</span>
              <abbr title={label}>{symbol}</abbr>
            </div>
            <Readout
              id={key}
              value={current?.[key]}
              pending={pending}
              sweeping={sweeping && inBounds}
              digits={digits}
            />
            {delta(key, digits)}
          </div>
        ))}
      </div>
      <p className="telemetry-baseline">
        {baseline ? "Against saved design" : "Against first section at this α / Re"}. Higher CL /
        L/D, lower CD. Best and observed-range bars are local to this session and operating point.
      </p>
      {pending && !started && (
        <div className="start-lights" role="status" aria-label="Initializing prediction model">
          <div aria-hidden="true">
            {[0, 1, 2, 3, 4].map((light) => (
              <i key={light} style={{ animationDelay: `${light * 180}ms` }} />
            ))}
          </div>
          <span>Initializing prediction model…</span>
        </div>
      )}
      <div className="v2-model">
        <div className="v2-latency">
          <span>Inference</span>
          <strong data-testid="latency">
            {current ? `${current.durationMs.toFixed(2)} ms` : "—"}
          </strong>
        </div>
        <p role="status" aria-label="Prediction status">
          {sweeping && current ? "Alpha sweep playing" : statusText}
        </p>
        <button className="status-button" onClick={onDetails}>
          <StatusPill state={inBounds ? "valid" : "warning"}>{domainLabel}</StatusPill>
        </button>
        {domainError && !invalid && (
          <div className="v2-domain-action">
            <p className="v2-warning">{domainError}</p>
            <button className="chip micro v2-clamp" onClick={onClamp}>
              Return to model range
            </button>
          </div>
        )}
        {inBounds && interpolatedRe && (
          <p className="v2-note">Reynolds interpolation between sampled levels.</p>
        )}
        {(coverage.status === "limited" || coverage.status === "unavailable") && (
          <p
            className={coverage.status === "limited" ? "v2-warning" : "v2-note"}
            role="status"
            aria-label="Training coverage status"
          >
            {coverageLabels[coverage.status]}
          </p>
        )}
        <button className="chip micro details-button" onClick={onDetails}>
          Details / evidence
        </button>
        <span className="sr-only" data-testid="applicability">
          {domainError ||
            "Finite evidence domain. XFOIL agreement on sampled cases. Continuous-domain and experimental accuracy are not established."}
          {inBounds && interpolatedRe && " Reynolds interpolation between sampled levels."}
          {inBounds && ` ${coverageLabels[coverage.status]}.`}
        </span>
      </div>
    </aside>
  );
}
