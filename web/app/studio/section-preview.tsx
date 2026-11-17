import { useMemo } from "react";
import type { Design } from "../../lib/inference/surrogate";
import { generateGeometry, type Parameters } from "../../lib/geometry/naca4";
import { nameOf } from "./section-design";

const sectionOutline = (design: Parameters) =>
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
  const { m, p, t } = design;
  const savedM = saved?.m,
    savedP = saved?.p,
    savedT = saved?.t;
  const outline = useMemo(() => sectionOutline({ m, p, t }), [m, p, t]);
  const overlay = useMemo(
    () =>
      savedM === undefined || savedP === undefined || savedT === undefined
        ? undefined
        : sectionOutline({ m: savedM, p: savedP, t: savedT }),
    [savedM, savedP, savedT],
  );
  return (
    <figure className="v2-section-preview">
      <svg
        role="img"
        aria-label={
          saved
            ? "Representative NACA section with comparison outline"
            : "Representative NACA section"
        }
        viewBox={wing ? "-.06 -.17 1.12 .36" : "-.06 -.24 1.12 .48"}
      >
        <g transform={`rotate(${design.alpha} .25 0)`}>
          <polygon points={outline} />
          <path d="M0 0H1" />
        </g>
        {saved && (
          <polygon
            className="v2-saved-outline"
            transform={`rotate(${saved.alpha} .25 0)`}
            points={overlay}
          />
        )}
      </svg>
      <figcaption>
        {nameOf(design)} · {design.alpha.toLocaleString("en-US", { maximumFractionDigits: 3 })}° ·
        Re {design.re.toLocaleString("en-US")}
        {invalid ? " · Last valid geometry" : ""}
      </figcaption>
    </figure>
  );
}
