import { useId, useMemo } from "react";
import type { Design } from "../../lib/inference/domain";
import { pressureCoordinates } from "../../lib/inference/pressure";
import { cpColor } from "./flow-colors";
import type { FlowMode, usePressureProfile } from "./use-pressure-profile";

type PressureState = ReturnType<typeof usePressureProfile>;

export function FlowControls({
  mode,
  onMode,
}: {
  mode: FlowMode;
  onMode: (mode: FlowMode) => void;
}) {
  return (
    <div className="flow-controls" role="group" aria-label="Pressure visualization">
      {(
        [
          ["surface", "Surface Cp"],
          ["smoke", "Smoke lines"],
        ] as const
      ).map(([id, label]) => (
        <button
          className={`chip micro ${mode === id ? "active" : ""}`}
          aria-pressed={mode === id}
          key={id}
          onClick={() => onMode(mode === id ? "off" : id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function FlowStudy({
  design,
  mode,
  pressure,
}: {
  design: Design;
  mode: FlowMode;
  pressure: PressureState;
}) {
  const title = useId();
  const gradient = useId().replaceAll(":", "");
  const coordinates = useMemo(() => pressureCoordinates(design), [design]);
  const { profiles, message, failed, retry } = pressure;
  return (
    <section className="flow-study" aria-labelledby={title}>
      <h2 id={title}>Pressure-driven section study</h2>
      <p>
        ML-predicted surface Cp on the isolated section. Car and wing placement remain illustrative.
      </p>
      {profiles ? (
        <>
          <svg
            viewBox="0 0 900 320"
            role="img"
            aria-label={
              mode === "smoke"
                ? "Schematic wind-tunnel smoke lines colored by predicted surface pressure"
                : "Airfoil surface colored by ML-predicted pressure coefficient"
            }
            data-flow-visual={mode}
          >
            <defs>
              {[0, 1].map((side) => (
                <linearGradient
                  key={side}
                  id={`${gradient}-${side}`}
                  gradientUnits="userSpaceOnUse"
                  x1="120"
                  x2="760"
                >
                  {Array.from({ length: 17 }, (_, i) => (
                    <stop
                      key={i}
                      offset={`${Math.max(0, Math.min(1, coordinates[side][Math.round((i / 16) * 256)][0])) * 100}%`}
                      stopColor={cpColor(profiles[side][Math.round((i / 16) * 256)])}
                    />
                  ))}
                </linearGradient>
              ))}
            </defs>
            <g transform={`rotate(${design.alpha} 280 160)`}>
              {mode === "smoke" &&
                [-1, 1].flatMap((direction, side) =>
                  [36, 65, 100].map((offset) => {
                    const mean =
                      profiles[side].reduce((sum, value) => sum + Math.abs(value), 0) /
                      profiles[side].length;
                    const deflection = Math.min(55, mean * 18);
                    const y = 160 + direction * offset;
                    return (
                      <path
                        key={`${side}-${offset}`}
                        className="smoke-trace"
                        d={`M20 ${y} C200 ${y},220 ${y + direction * (45 + deflection)},450 ${y + direction * (30 + deflection)} S700 ${y},880 ${y}`}
                        stroke={`url(#${gradient}-${side})`}
                      />
                    );
                  }),
                )}
              <polygon
                className="flow-foil"
                points={[...coordinates[0], ...coordinates[1].slice().reverse()]
                  .map(([x, y]) => `${120 + x * 640},${160 - y * 640}`)
                  .join(" ")}
              />
              {coordinates.map((branch, side) =>
                branch
                  .slice(1)
                  .map(([x, y], i) => (
                    <path
                      key={`${side}-${i}`}
                      data-cp={profiles[side][i].toFixed(5)}
                      d={`M${120 + branch[i][0] * 640} ${160 - branch[i][1] * 640}L${120 + x * 640} ${160 - y * 640}`}
                      stroke={cpColor((profiles[side][i] + profiles[side][i + 1]) / 2)}
                      strokeWidth="5"
                      strokeLinecap="round"
                      fill="none"
                    />
                  )),
              )}
            </g>
          </svg>
          <div className="cp-scale">
            <span>Cp ≤ −3 · suction</span>
            <i aria-hidden="true" />
            <span>Cp ≥ +1</span>
          </div>
          <p>
            Colors saturate outside −3 to +1. Inspect exact values in Pressure. Cp repeats across
            the representative 3D wing span for illustration; no finite-wing pressure field is
            predicted.
          </p>
        </>
      ) : (
        <p role="status">{message}</p>
      )}
      {failed && (
        <button className="chip micro" onClick={retry}>
          Retry flow pressure
        </button>
      )}
      {mode === "smoke" && (
        <p className="flow-limit">
          Smoke paths and animation speed are schematic. Their colors use the pressure model; they
          are not predicted streamlines or a velocity field.
        </p>
      )}
      <p className="flow-limit">
        Pressure requires sampled angles −4, −2, 0, 2, 4, 6 or 8° and Re 100k, 250k or 500k. Known
        rejected cases stay unavailable. Positive CL follows the section convention, not car
        downforce.
      </p>
    </section>
  );
}
