import { useState } from "react";
import Image from "next/image";
import { generateGeometry } from "../../lib/geometry/naca4";
import type { Design } from "../../lib/inference/domain";
import { download } from "./design-actions";
import { liveries, useLivery, type LiveryId } from "./livery";
import { nameOf, type Result } from "./section-design";

type Coefficients = Pick<Result, "cl" | "cd" | "ratio">;
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function cardSvg(
  design: Design,
  current: Coefficients,
  livery: LiveryId,
  title: string,
  subtitle: string,
) {
  const palette = liveries[livery];
  const path =
    generateGeometry(design)
      .contour.map(
        ([x, y], i) =>
          `${i ? "L" : "M"}${(140 + x * 900).toFixed(3)} ${(292 - y * 900).toFixed(3)}`,
      )
      .join(" ") + "Z";
  const metrics = [
    ["CL / lift", current.cl.toFixed(4)],
    ["CD / drag", current.cd.toFixed(5)],
    ["L/D / efficiency", current.ratio.toFixed(2)],
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
    <rect width="1200" height="675" fill="#101419"/><rect width="8" height="675" fill="${palette.accent}"/>
    <g font-family="Arial,sans-serif" fill="#eef1f4">
      <text x="54" y="62" font-size="24" font-weight="700">AEROFORGE / AF–02</text>
      <text x="1146" y="62" text-anchor="end" font-size="20" fill="${palette.accent}">${palette.name}</text>
      <text x="54" y="123" font-size="42" font-weight="700">${escape(title)}</text>
      <text x="1146" y="117" text-anchor="end" font-size="18" fill="#b0bcc6">${escape(nameOf(design))} · α ${Number(design.alpha.toFixed(2))}° · Re ${design.re.toLocaleString("en-US")}</text>
      <rect x="54" y="160" width="1092" height="250" rx="3" fill="#171f27" stroke="#43505b"/>
      <path d="M54 285H1146M365 160V410" stroke="#43505b" stroke-dasharray="4 8"/>
      <path d="${path}" transform="rotate(${design.alpha} 365 292)" fill="${palette.paint}" stroke="${palette.accent}" stroke-width="3"/>
      ${metrics.map(([label, value], i) => `<text x="${54 + i * 380}" y="458" font-size="18" fill="#b0bcc6">${label}</text><text x="${54 + i * 380}" y="518" font-family="monospace" font-size="50">${value}</text>`).join("")}
      <text x="54" y="559" font-size="17" fill="${palette.accent}">${escape(subtitle)}</text>
      <path d="M54 583H1146" stroke="#43505b"/>
      <text x="54" y="616" font-size="17" fill="#b0bcc6">Honest limits · isolated NACA section · α −4° to 8° · Re 100k–500k.</text>
      <text x="54" y="645" font-size="17" fill="#b0bcc6">Car and wing pitch are illustrative. No lap-time or full-car downforce prediction.</text>
    </g></svg>`;
}

export function ShareCard({
  design,
  current,
  title = "Section setup",
  subtitle = "Browser model prediction · verify independently",
}: {
  design: Design;
  current: Coefficients | null;
  title?: string;
  subtitle?: string;
}) {
  const { livery } = useLivery();
  const [error, setError] = useState("");
  if (!current) return <p role="status">A share card needs a current, in-domain prediction.</p>;
  const svg = cardSvg(design, current, livery, title, subtitle);
  async function exportCard() {
    setError("");
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = new window.Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 675;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG unavailable");
      download(
        blob,
        `aeroforge-${nameOf(design).toLowerCase().replaceAll(" ", "-")}-${title === "Optimizer challenge" ? "challenge" : "share"}.png`,
      );
    } catch {
      setError("The share card could not be generated. Try again.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return (
    <div className="share-card">
      <figure aria-label={`${title} card preview`}>
        <Image
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
          width={1200}
          height={675}
          alt={`AeroForge ${nameOf(design)} share card in ${liveries[livery].name} colors`}
          unoptimized
        />
        <figcaption>
          CL {current.cl.toFixed(4)} · CD {current.cd.toFixed(5)} · L/D {current.ratio.toFixed(2)}.
          Honest limits: isolated sections, α −4° to 8°, Re 100k–500k. Car and wing pitch are
          illustrative.
        </figcaption>
      </figure>
      <button className="chip micro active" onClick={() => void exportCard()}>
        Download share card PNG
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
