import { model } from "../../lib/inference/surrogate";
import { Readout, StatusPill } from "./kit";
import type { Result } from "./section-design";

type TelemetryProps = {
  current: Result | null;
  result: Result | null;
  pending: boolean;
  sweeping: boolean;
  inBounds: boolean;
  statusText: string;
  domainLabel: string;
  domainError: string;
  invalid: boolean;
  re: number;
  latency: string;
  onDetails: () => void;
};

export function Telemetry({
  current,
  result,
  pending,
  sweeping,
  inBounds,
  statusText,
  domainLabel,
  domainError,
  invalid,
  re,
  latency,
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
              previous={result?.[key]}
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
          <strong data-testid="latency">{latency}</strong>
        </div>
        <p role="status" aria-label="Prediction status">
          {sweeping && inBounds ? "Alpha sweep playing" : statusText}
        </p>
        <button className="status-button" onClick={onDetails}>
          <StatusPill state={inBounds ? "valid" : "warning"}>{domainLabel}</StatusPill>
        </button>
        {domainError && !invalid && <p className="v2-warning">{domainError}</p>}
        {inBounds && !model.domain.sampled_reynolds.includes(re) && (
          <p className="v2-note">Reynolds interpolation between sampled levels.</p>
        )}
        <button className="chip micro details-button" onClick={onDetails}>
          Details / evidence
        </button>
        <span className="sr-only" data-testid="applicability">
          {domainError ||
            "Finite evidence domain. XFOIL agreement on sampled cases. Continuous-domain and experimental accuracy are not established."}
          {!model.domain.sampled_reynolds.includes(re) &&
            " Reynolds interpolation between sampled levels."}
        </span>
      </div>
    </aside>
  );
}
