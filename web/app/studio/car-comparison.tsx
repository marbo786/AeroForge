import type { Design } from "../../lib/inference/domain";
import { VehicleViewport } from "../inspection/preview";
import { SectionPreview } from "./section-preview";
import { nameOf, type Result, type SavedDesign } from "./section-design";

export function CarComparison({
  design,
  current,
  saved,
  invalid,
  onClose,
}: {
  design: Design;
  current: Result | null;
  saved: SavedDesign;
  invalid: boolean;
  onClose: () => void;
}) {
  return (
    <section className="car-comparison" aria-label="Side-by-side wing comparison">
      <div className="car-comparison-heading">
        <h2>Two sections. One reference car.</h2>
        <button className="chip micro" onClick={onClose}>
          Exit car compare
        </button>
      </div>
      <p>
        Geometry comparison on illustrative cars. Coefficients describe isolated sections; they do
        not predict car downforce. Each phone preview remains opt-in for 3D.
      </p>
      <div className="car-comparison-grid">
        {(
          [
            ["Current section", design, current, invalid],
            ["Saved baseline", saved.design, saved.result, false],
          ] as const
        ).map(([label, section, result, invalid]) => (
          <section className="car-comparison-item" aria-label={label} key={label}>
            <h3>
              {label} / {nameOf(section)}
            </h3>
            <VehicleViewport study design={section} alpha={section.alpha} />
            <SectionPreview design={section} invalid={invalid} />
            <p className="comparison-coefficients">
              CL {result?.cl.toFixed(4) ?? "—"} · CD {result?.cd.toFixed(5) ?? "—"} · L/D{" "}
              {result?.ratio.toFixed(2) ?? "—"}
            </p>
          </section>
        ))}
      </div>
    </section>
  );
}
