"use client";

import { formatRe, model, modelBounds, type Bounds } from "../../lib/inference/domain";
import { Module } from "./kit";
import { reliabilityEvidence } from "../../lib/inference/coverage";
import { coverageLabels, type TrainingCoverage } from "./use-training-coverage";

export function ModelDetails({
  coverage,
  interpolatedRe,
}: {
  coverage?: TrainingCoverage;
  interpolatedRe?: boolean;
}) {
  const percent = ([min, max]: Bounds) => `${min * 100}–${max * 100}%`;
  const [minAlpha, maxAlpha] = modelBounds.alpha;
  const [minRe, maxRe] = modelBounds.re.map(formatRe);
  const evidence = reliabilityEvidence.final;
  const lowRe = Math.min(...model.domain.sampled_reynolds);
  return (
    <div className="model-details">
      {coverage && (
        <Module number="01" title="Training coverage">
          <p role="status" aria-label="Current design coverage">
            {coverageLabels[coverage.status]}
          </p>
          {interpolatedRe && <p>Reynolds interpolation between sampled levels.</p>}
          {"distance" in coverage && (
            <div className="detail-grid">
              <span>Nearest training distance</span>
              <strong>{coverage.distance.toFixed(3)}</strong>
              <span>Limited coverage threshold</span>
              <strong>{coverage.threshold.toFixed(3)}</strong>
            </div>
          )}
          <p>
            The index compares geometry, angle and Reynolds number with{" "}
            {reliabilityEvidence.training_rows} accepted training cases across{" "}
            {reliabilityEvidence.training_geometries} airfoils. Distance describes proximity to
            those examples. Prediction intervals require separate calibration.
          </p>
        </Module>
      )}
      <Module number={coverage ? "02" : "01"} title="Prediction bounds">
        <div className="detail-grid">
          <span>Camber / position / thickness</span>
          <strong>
            {[modelBounds.m, modelBounds.p, modelBounds.t].map(percent).join(" / ")} chord
          </strong>
          <span>Angle of attack</span>
          <strong>
            {minAlpha}° to {maxAlpha}°
          </strong>
          <span>Reynolds number</span>
          <strong>
            {minRe}–{maxRe}
          </strong>
          <span>Sampled Reynolds numbers</span>
          <strong>{model.domain.sampled_reynolds.map(formatRe).join(" / ")}</strong>
        </div>
        <p>
          Symmetric sections use canonical camber position zero. Intermediate Reynolds numbers are
          interpolations. The “Within bounds” status checks input bounds. Evaluation covers a finite
          panel of conditions.
        </p>
      </Module>
      <Module number={coverage ? "03" : "02"} title="Scientific limitations">
        <p>
          The model’s Reynolds number range of {minRe} to {maxRe} is below typical full-scale
          Formula 1 front-wing conditions, so its predictions apply only to isolated airfoil
          sections.
        </p>
        <p>
          Evaluation measures agreement with XFOIL. Experimental accuracy, post-stall behavior and
          calibrated uncertainty remain unverified. At Re {formatRe(lowRe)}, observed drag MAE was{" "}
          {evidence.cd_mae_by_re[String(lowRe) as keyof typeof evidence.cd_mae_by_re].toFixed(6)}.
          Errors also varied by geometry.
        </p>
        <p>
          The model returns dimensionless lift and drag coefficients. The flow display is
          conceptual. The airfoil outline comes from the analytic NACA geometry.
        </p>
        <p>
          The isolated section model excludes 3D vehicle effects, ground effect and interactions
          between components.
        </p>
      </Module>
      <Module number={coverage ? "04" : "03"} title="Model provenance">
        <div className="detail-grid">
          <span>Version</span>
          <strong>{model.version}</strong>
          <span>Architecture</span>
          <strong>Separate lift and drag neural networks</strong>
          <span>Label source</span>
          <strong>XFOIL 6.99 / viscous / Mach 0</strong>
          <span>Independent evaluation</span>
          <strong>
            {evidence.eligible} eligible cases / {evidence.geometries} unseen geometries (
            {evidence.attempted} attempted)
          </strong>
          <span>CL / CD mean absolute error</span>
          <strong>
            {evidence.mae.cl.toFixed(5)} / {evidence.mae.cd.toFixed(6)}
          </strong>
          <span>Execution</span>
          <strong>Local ONNX / one-thread WASM</strong>
        </div>
        <p>
          The graph embeds the fitted input transforms and output inversions. The latency readout
          includes the ONNX run and worker communication. The first run can take longer.
        </p>
      </Module>
      <div className="details-links">
        <a className="chip micro" href="/model/">
          Full model evidence
        </a>
        <a className="chip micro" href="https://github.com/marbo786/AeroForge">
          Repository
        </a>
        <a className="chip micro" href="/spike/">
          Open inference test
        </a>
      </div>
    </div>
  );
}
