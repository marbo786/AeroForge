import type { Design } from "../../lib/inference/surrogate";
import { presetCodes } from "../../lib/geometry/naca4";
import { Chip, Slider } from "./kit";
import { nameOf } from "./section-design";
import type { Draft, Field } from "./studio";

const fields = [
  { key: "m", label: "Maximum camber", unit: "%", min: 0, max: 6, step: 0.1 },
  { key: "p", label: "Camber position", unit: "%c", min: 20, max: 60, step: 1 },
  { key: "t", label: "Thickness", unit: "%", min: 8, max: 18, step: 0.1 },
  { key: "alpha", label: "Angle of attack", unit: "°", min: -4, max: 12, step: 0.1 },
  { key: "re", label: "Reynolds number", unit: "Re", min: 100000, max: 1000000, step: 1000 },
] as const;

type DesignParametersProps = {
  design: Design;
  draft: Draft;
  errors: Partial<Record<Field, string>>;
  preset: string;
  morePresets: boolean;
  onTogglePresets: () => void;
  onChange: (field: Field, value: string) => void;
  onPreset: (code: string) => void;
  onReset: () => void;
};

export function DesignParameters({
  design,
  draft,
  errors,
  preset,
  morePresets,
  onTogglePresets,
  onChange,
  onPreset,
  onReset,
}: DesignParametersProps) {
  const control = (field: (typeof fields)[number]) => (
    <Slider
      key={field.key}
      id={field.key}
      label={field.label}
      unit={field.unit}
      min={field.min}
      max={field.max}
      step={field.step}
      value={field.key === "p" && Number(draft.m) === 0 ? "0" : draft[field.key]}
      disabled={field.key === "p" && Number(draft.m) === 0}
      error={errors[field.key]}
      onChange={(value) => onChange(field.key, value)}
    />
  );
  return (
    <>
      <div className="v2-panel-heading">
        <h2>Section inputs</h2>
        <span className="micro">{nameOf(design)}</span>
      </div>
      <div className="v2-parameter-group">
        <label htmlFor="v2-preset">Airfoil preset</label>
        <select
          id="v2-preset"
          value={preset}
          onChange={(event) => {
            onPreset(event.target.value);
          }}
        >
          <option value="" disabled>
            Custom section
          </option>
          {presetCodes.map((code) => (
            <option key={code} value={code}>
              NACA {code}
            </option>
          ))}
        </select>
        <div className="v2-presets" aria-label="Quick presets">
          {(morePresets ? presetCodes : ["0012", "2412", "4412"]).map((code) => (
            <Chip
              key={code}
              active={preset === code}
              onClick={() => {
                onPreset(code);
              }}
            >
              {code}
            </Chip>
          ))}
          <Chip active={morePresets} onClick={onTogglePresets}>
            More
          </Chip>
        </div>
        {fields.slice(0, 3).map(control)}
      </div>
      <div className="v2-parameter-group">
        <h3 className="micro">Flow conditions</h3>
        {fields.slice(3).map(control)}
      </div>
      <button
        className="chip micro v2-reset"
        onClick={() => {
          onReset();
        }}
      >
        Reset
      </button>
    </>
  );
}
