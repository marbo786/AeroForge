import { useRef, useState } from "react";
import { model, type Design } from "../../lib/inference/surrogate";
import type { SweepPoint } from "./charts";
import { nameOf, type Result } from "./section-design";

export function ShareDesign({ url }: { url: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Link copied.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setFeedback("Link selected. Use your device’s copy command.");
    }
  }
  return (
    <div className="share-design">
      <p>
        This link opens the current workspace view, geometry, angle of attack and Reynolds number.
      </p>
      <label className="micro" htmlFor="share-url">
        Design URL
      </label>
      <input
        id="share-url"
        ref={input}
        value={url}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="comparison-actions">
        <button className="chip micro active" onClick={() => void copy()}>
          Copy link
        </button>
        <span role="status">{feedback}</span>
      </div>
    </div>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const imageWidth = 1600;
const imageHeight = 700;

function svgSnapshot() {
  const original = document.querySelector<SVGSVGElement>(".airfoil-svg");
  if (!original) throw new Error("Section drawing unavailable.");
  const clone = original.cloneNode(true) as SVGSVGElement;
  const source = [original, ...original.querySelectorAll("*")];
  const copy = [clone, ...clone.querySelectorAll("*")];
  source.forEach((node, i) => {
    const style = getComputedStyle(node);
    copy[i].setAttribute(
      "style",
      [
        "display",
        "fill",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "opacity",
        "font-family",
        "font-size",
        "font-weight",
        "letter-spacing",
      ]
        .map((key) => `${key}:${style.getPropertyValue(key)}`)
        .join(";"),
    );
  });
  clone.querySelectorAll(".geometry-handle,.exact-contour").forEach((node) => node.remove());
  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  const bounds = original.viewBox.baseVal;
  for (const key of ["x", "y", "width", "height"] as const)
    background.setAttribute(key, String(bounds[key]));
  background.setAttribute(
    "fill",
    getComputedStyle(original).getPropertyValue("--workspace").trim(),
  );
  clone.prepend(background);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(imageWidth));
  clone.setAttribute("height", String(imageHeight));
  return new XMLSerializer().serializeToString(clone);
}
export function ExportMenu({
  design,
  current,
  points,
  loading,
  invalid,
  open,
  onOpen,
  dataOnly = false,
}: {
  design: Design;
  current: Result | null;
  points: SweepPoint[];
  loading: boolean;
  invalid: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  dataOnly?: boolean;
}) {
  const [error, setError] = useState("");
  async function save(format: string) {
    setError("");
    const name = nameOf(design).toLowerCase().replaceAll(" ", "-");
    try {
      if (format === "json")
        download(
          new Blob(
            [
              JSON.stringify(
                {
                  design,
                  model: model.version,
                  coefficients: current
                    ? { cl: current.cl, cd: current.cd, ratio: current.ratio }
                    : null,
                  limitation: model.domain.warning,
                },
                null,
                2,
              ),
            ],
            { type: "application/json" },
          ),
          `${name}.json`,
        );
      if (format === "csv")
        download(
          new Blob(
            [
              "alpha_deg,CL,CD,L_D\n" +
                points.map((p) => [p.alpha, p.cl, p.cd, p.ratio].join(",")).join("\n"),
            ],
            { type: "text/csv" },
          ),
          `${name}.csv`,
        );
      if (format === "svg")
        download(new Blob([svgSnapshot()], { type: "image/svg+xml" }), `${name}.svg`);
      if (format === "png") {
        const url = URL.createObjectURL(new Blob([svgSnapshot()], { type: "image/svg+xml" }));
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = imageWidth;
          canvas.height = imageHeight;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          context.drawImage(image, 0, 0);
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/png"),
          );
          if (!blob) throw new Error("Image encoding failed");
          download(blob, `${name}.png`);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      onOpen(false);
    } catch {
      setError("Export failed. Try SVG or JSON.");
    }
  }
  const formats = dataOnly ? ["csv", "json"] : ["svg", "png", "csv", "json"];
  return (
    <div className="export-menu">
      <button
        className="chip micro"
        disabled={invalid}
        aria-expanded={open}
        onClick={() => onOpen(!open)}
      >
        Export +
      </button>
      {open && !invalid && (
        <div className="export-options" role="group" aria-label="Export formats">
          <div>
            {formats.map((format) => (
              <button
                className="chip micro"
                key={format}
                disabled={format === "csv" && !points.length}
                onClick={() => void save(format)}
              >
                {format}
              </button>
            ))}
          </div>
          {loading && (
            <span className="micro" role="status">
              Calculating CSV samples…
            </span>
          )}
          {!loading && !points.length && <span className="micro">CSV samples unavailable</span>}
        </div>
      )}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
