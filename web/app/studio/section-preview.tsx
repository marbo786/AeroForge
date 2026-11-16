import type { Design } from "../../lib/inference/surrogate";
import { generateGeometry } from "../../lib/geometry/naca4";
import { nameOf } from "./section-design";

const sectionOutline = (design: Design) =>
  generateGeometry(design)
    .contour.map(([x, y]) => `${x} ${-y}`)
    .join(" ");

export function SectionPreview({
  design,
  invalid,
  wing = false,
  saved,
}: {
  design: Design;
  invalid: boolean;
  wing?: boolean;
  saved?: Design;
}) {
  return (
    <figure className="v2-section-preview">
      <svg
        role="img"
        aria-label="Representative NACA section"
        viewBox={wing ? "-.06 -.17 1.12 .36" : "-.06 -.24 1.12 .48"}
      >
        <g transform={`rotate(${design.alpha} .25 0)`}>
          <polygon points={sectionOutline(design)} />
          <path d="M0 0H1" />
        </g>
        {saved && (
          <polygon
            className="v2-saved-outline"
            transform={`rotate(${saved.alpha} .25 0)`}
            points={sectionOutline(saved)}
            aria-label="Saved section outline"
          />
        )}
      </svg>
      <figcaption>
        {nameOf(design)} · {design.alpha}° · Re {design.re.toLocaleString("en-US")}
        {invalid ? " · Last valid geometry" : ""}
      </figcaption>
    </figure>
  );
}
