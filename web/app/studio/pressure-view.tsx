"use client";

import { useEffect, useId, useMemo, useState, type PointerEvent } from "react";
import type { Design } from "../../lib/inference/domain";
import {
  predictPressure,
  pressureAngles,
  pressureCoordinates,
  pressureFeatures,
  pressureReynolds,
  pressureUnavailable,
} from "../../lib/inference/pressure";
import type { Field } from "./design-fields";
import styles from "./pressure-view.module.css";

const sideNames = ["Upper", "Lower"] as const;
const plot = { left: 55, right: 534, top: 18, bottom: 190 };
const xMin = -0.008;
const xMax = 1.008;
const xAt = (x: number) => plot.left + ((x - xMin) * (plot.right - plot.left)) / (xMax - xMin);

type Profiles = Awaited<ReturnType<typeof predictPressure>>;

function PressurePlot({ design, profiles }: { design: Design; profiles: Profiles }) {
  const coordinates = useMemo(() => pressureCoordinates(design), [design]);
  const [inspection, setInspection] = useState({ branch: 0, station: 90 });
  const { branch, station } = inspection;
  const [x, y] = coordinates[branch][station];
  const cp = profiles[branch][station];
  const cpMin = Math.min(-1, Math.floor(Math.min(...profiles[0], ...profiles[1])));
  const cpMax = Math.max(1, Math.ceil(Math.max(...profiles[0], ...profiles[1])));
  const yAt = (cp: number) =>
    plot.top + ((cp - cpMin) * (plot.bottom - plot.top)) / (cpMax - cpMin);
  const yStep = Math.max(1, Math.ceil((cpMax - cpMin) / 6));
  const yTicks = Array.from(
    { length: Math.floor((cpMax - cpMin) / yStep) + 1 },
    (_, i) => cpMin + i * yStep,
  );

  function inspectPointer(event: PointerEvent<SVGSVGElement>) {
    const transform = event.currentTarget.getScreenCTM();
    if (!transform) return;
    const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      transform.inverse(),
    );
    if (x < plot.left || x > plot.right || y < plot.top || y > plot.bottom) return;
    let nearest = { branch: 0, station: 0 };
    let distance = Infinity;
    coordinates.forEach((points, branch) => {
      points.forEach(([pointX], station) => {
        const candidate = Math.hypot(xAt(pointX) - x, yAt(profiles[branch][station]) - y);
        if (candidate < distance) {
          distance = candidate;
          nearest = { branch, station };
        }
      });
    });
    setInspection(nearest);
  }

  return (
    <div data-pressure-plot>
      <svg
        className={styles.plot}
        viewBox="0 0 556 228"
        role="img"
        aria-label="Upper and lower surface pressure versus x over chord. More negative pressure coefficients are higher."
        onPointerMove={inspectPointer}
        onPointerDown={inspectPointer}
      >
        <rect
          x={plot.left}
          y={plot.top}
          width={plot.right - plot.left}
          height={plot.bottom - plot.top}
          className={styles.grid}
        />
        <text x="-104" y="17" textAnchor="middle" transform="rotate(-90)">
          Cp
        </text>
        {yTicks.map((tick) => (
          <g key={tick}>
            <path d={`M${plot.left} ${yAt(tick)}H${plot.right}`} className={styles.grid} />
            <text x={plot.left - 8} y={yAt(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <path d={`M${xAt(tick)} ${plot.top}V${plot.bottom}`} className={styles.grid} />
            <text x={xAt(tick)} y={plot.bottom + 15} textAnchor="middle">
              {tick}
            </text>
          </g>
        ))}
        <text x="294" y="224" textAnchor="middle">
          x/c
        </text>
        {coordinates.map((points, side) => (
          <polyline
            key={sideNames[side]}
            data-pressure-side={sideNames[side].toLowerCase()}
            className={side === 0 ? styles.upper : styles.lower}
            points={points.map(([x], index) => `${xAt(x)},${yAt(profiles[side][index])}`).join(" ")}
          />
        ))}
        <circle className={styles.marker} cx={xAt(x)} cy={yAt(cp)} r="4" />
      </svg>
      <div className={styles.inspection}>
        <div className={styles.branches} aria-label="Surface to inspect">
          {sideNames.map((side, index) => (
            <button
              type="button"
              key={side}
              className={`chip micro${branch === index ? " active" : ""}`}
              aria-pressed={branch === index}
              onClick={() => setInspection({ branch: index, station })}
            >
              <span className={index === 0 ? styles.swatchUpper : styles.swatchLower} />
              {side} surface
            </button>
          ))}
        </div>
        <label className={styles.station}>
          Surface station
          <input
            type="range"
            min={0}
            max={coordinates[branch].length - 1}
            value={station}
            aria-valuetext={`${sideNames[branch]} surface, x/c ${x.toFixed(4)}, Cp ${cp.toFixed(3)}`}
            onChange={(event) => setInspection({ branch, station: Number(event.target.value) })}
          />
        </label>
        <p className={styles.readout} data-pressure-readout>
          {sideNames[branch]} · x/c {x.toFixed(4)} · y/c {y.toFixed(4)} · Cp {cp.toFixed(3)}
        </p>
        <svg
          className={styles.section}
          viewBox="-.03 -.16 1.06 .32"
          role="img"
          aria-label="Matching point on unrotated airfoil section"
        >
          {coordinates.map((points, side) => (
            <polyline
              key={sideNames[side]}
              points={points.map(([x, y]) => `${x},${-y}`).join(" ")}
            />
          ))}
          <circle className={styles.marker} cx={x} cy={-y} r=".015" />
        </svg>
      </div>
    </div>
  );
}

function PressureResult({ design }: { design: Design }) {
  const [result, setResult] = useState<Profiles | "failed">();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    predictPressure(design).then(
      (profiles) => {
        if (current) setResult(profiles);
      },
      () => {
        if (current) setResult("failed");
      },
    );
    return () => {
      current = false;
    };
  }, [design, attempt]);
  if (result === "failed") {
    return (
      <div>
        <p role="status">Pressure unavailable. The model could not return a valid profile.</p>
        <button
          type="button"
          className="chip micro"
          onClick={() => {
            setResult(undefined);
            setAttempt(attempt + 1);
          }}
        >
          Retry pressure
        </button>
      </div>
    );
  }
  if (!result) return <p role="status">Calculating surface pressure…</p>;
  return <PressurePlot design={design} profiles={result} />;
}

export default function PressureView({
  design,
  invalid,
  onChange,
}: {
  design: Design;
  invalid: boolean;
  onChange: (field: Field, value: string) => void;
}) {
  const title = useId();
  const unavailable = invalid
    ? "Enter a valid design to view pressure."
    : pressureUnavailable(design);
  return (
    <section aria-labelledby={title} className={styles.panel}>
      <h2 id={title}>ML-predicted surface pressure coefficient</h2>
      <p className={styles.caption}>
        Dimensionless Cp from 2D viscous XFOIL training data. Local errors can be larger near the
        nose.
      </p>
      <div className={styles.controls}>
        <label>
          Pressure angle
          <select
            value={pressureAngles.includes(design.alpha) ? design.alpha : ""}
            onChange={(event) => onChange("alpha", event.target.value)}
          >
            <option value="" disabled>
              Choose angle
            </option>
            {pressureAngles.map((alpha) => (
              <option key={alpha} value={alpha}>
                {alpha}°
              </option>
            ))}
          </select>
        </label>
        <label>
          Pressure Reynolds number
          <select
            value={pressureReynolds.includes(design.re) ? design.re : ""}
            onChange={(event) => onChange("re", event.target.value)}
          >
            <option value="" disabled>
              Choose Reynolds number
            </option>
            {pressureReynolds.map((re) => (
              <option key={re} value={re}>
                {re.toLocaleString("en-US")}
              </option>
            ))}
          </select>
        </label>
      </div>
      {unavailable ? (
        <p role="status">{unavailable}</p>
      ) : (
        <PressureResult key={pressureFeatures(design).join("/")} design={design} />
      )}
      <p className={styles.caption}>
        Both curves share the nose value and end at their own trailing-edge coordinates.
      </p>
    </section>
  );
}
