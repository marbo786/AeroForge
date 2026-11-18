import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { Design } from "../../lib/inference/surrogate";
import { FlowControls, FlowStudy } from "./flow-study";
import type { FlowMode, usePressureProfile } from "./use-pressure-profile";
import { Chip, Scrubber } from "./kit";
import { Stage, type Display } from "./stage";
import type { Field } from "./design-fields";

const PressureView = dynamic(() => import("./pressure-view"), {
  ssr: false,
  loading: () => <p role="status">Opening pressure view…</p>,
});

type AirfoilEditorProps = {
  design: Design;
  flowMode: FlowMode;
  onFlowMode: (mode: FlowMode) => void;
  pressure: ReturnType<typeof usePressureProfile>;
  display: Display;
  onDisplay: (display: Display) => void;
  saved?: Design;
  invalid: boolean;
  reduced: boolean;
  sweeping: boolean;
  cannotSave: boolean;
  dataExport: ReactNode;
  onChange: (field: Field, value: string) => void;
  onPlay: () => void;
  onCharts: () => void;
  onSave: () => void;
};

export function AirfoilEditor({
  design,
  flowMode,
  onFlowMode,
  pressure,
  display,
  onDisplay,
  saved,
  invalid,
  reduced,
  sweeping,
  cannotSave,
  dataExport,
  onChange,
  onPlay,
  onCharts,
  onSave,
}: AirfoilEditorProps) {
  const [pressureOpen, setPressureOpen] = useState(false);
  return (
    <>
      <Stage
        design={design}
        saved={saved}
        display={display}
        invalid={invalid}
        onChange={onChange}
      />
      <div className="v2-airfoil-tools">
        <div className="display-chips" aria-label="Airfoil display">
          {(
            [
              ["grid", "Grid"],
              ["camber", "Camber line"],
              ["chord", "Chord"],
              ["labels", "Labels"],
            ] as const
          ).map(([key, label]) => (
            <Chip
              key={key}
              active={display[key]}
              onClick={() => onDisplay({ ...display, [key]: !display[key] })}
            >
              {label}
            </Chip>
          ))}
          <Chip active={pressureOpen} onClick={() => setPressureOpen((open) => !open)}>
            Pressure
          </Chip>
        </div>
        <FlowControls mode={flowMode} onMode={onFlowMode} />
        <Scrubber
          alpha={design.alpha}
          reduced={reduced}
          playing={sweeping}
          onPlay={onPlay}
          onChange={(alpha) => onChange("alpha", String(alpha))}
        />
        <div className="v2-actions">
          <button className="chip micro" onClick={onCharts}>
            Charts +
          </button>
          {saved ? (
            <button className="chip micro" onClick={onCharts}>
              Compare
            </button>
          ) : (
            <button className="chip micro" disabled={cannotSave} onClick={onSave}>
              Save design
            </button>
          )}
          {dataExport}
        </div>
      </div>
      {flowMode !== "off" && <FlowStudy design={design} mode={flowMode} pressure={pressure} />}
      {pressureOpen && <PressureView design={design} invalid={invalid} onChange={onChange} />}
    </>
  );
}
