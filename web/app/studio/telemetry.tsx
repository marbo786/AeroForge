import { Readout, StatusPill } from "./kit";
import type { Result } from "./section-design";
import { coverageLabels, type TrainingCoverage } from "./use-training-coverage";

type TelemetryProps = {
  current: Result | null;
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
  return (
    <aside className="v2-telemetry" aria-label="Predicted performance">
      <div className="v2-panel-heading">
        <h2>Predicted performance</h2>
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
          </div>
        ))}
      </div>
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
