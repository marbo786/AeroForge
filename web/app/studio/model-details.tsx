"use client";

import { model } from "../../lib/inference/surrogate";
import { Module } from "./kit";

export function ModelDetails() {
  return (
    <div className="model-details">
      <Module number="01" title="Prediction bounds">
        <div className="detail-grid">
          <span>Camber / position / thickness</span>
          <strong>0–6% / 20–60% / 8–18% chord</strong>
          <span>Angle of attack</span>
          <strong>−4° to 8°</strong>
          <span>Reynolds number</span>
          <strong>100,000–500,000</strong>
          <span>Sampled Reynolds numbers</span>
          <strong>100,000 / 250,000 / 500,000</strong>
        </div>
        <p>
          Symmetric sections use canonical camber position zero. Intermediate Reynolds numbers are
          interpolations. The “In domain” status checks input bounds. Evaluation covers a finite
          panel of conditions.
        </p>
      </Module>
      <Module number="02" title="Scientific limitations">
        <p>
          The model’s Reynolds number range of 100,000 to 500,000 is below typical full-scale
          Formula 1 front-wing conditions, so its predictions apply only to isolated airfoil
          sections.
        </p>
        <p>
          Evaluation measures agreement with XFOIL. Experimental accuracy, post-stall behavior and
          calibrated uncertainty remain unverified. Drag errors were higher at low Reynolds numbers,
          and high-camber sections were harder to predict.
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
      <Module number="03" title="Model provenance">
        <div className="detail-grid">
          <span>Version</span>
          <strong>{model.version}</strong>
          <span>Architecture</span>
          <strong>Separate lift and drag neural networks</strong>
          <span>Label source</span>
          <strong>XFOIL 6.99 / viscous / Mach 0</strong>
          <span>Independent evaluation</span>
          <strong>165 cases / 8 unseen geometries</strong>
          <span>CL / CD mean absolute error</span>
          <strong>0.01484 / 0.000683</strong>
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
