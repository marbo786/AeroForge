import { normalizeGeometry } from "../../lib/geometry/naca4";
import type { Design } from "../../lib/inference/surrogate";

const keys = ["m", "p", "t", "aoa", "re"] as const;
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
export const views = ["studio", "airfoil", "analysis"] as const;
export type WorkspaceView = (typeof views)[number];

export function readWorkspaceView(search: string): WorkspaceView {
  const view = new URLSearchParams(search).get("view");
  return view === "airfoil" || view === "analysis" ? view : "studio";
}

export function readSharedDesign(search: string): Design | null {
  const params = new URLSearchParams(search);
  if (!keys.some((key) => params.has(key))) return null;
  const [m, p, t, alpha, re] = keys.map((key) => {
    const values = params.getAll(key);
    if (values.length !== 1 || !decimal.test(values[0])) throw new Error("Invalid design link");
    const value = Number(values[0]);
    if (!Number.isFinite(value)) throw new Error("Invalid design link");
    return value;
  });
  return { ...normalizeGeometry({ m, p, t }), alpha, re };
}

export function sharedDesignUrl(origin: string, design: Design, view: WorkspaceView) {
  const url = new URL("/studio/", origin);
  const values = [design.m, design.p, design.t, design.alpha, design.re];
  keys.forEach((key, index) => url.searchParams.set(key, String(values[index])));
  if (view !== "studio") url.searchParams.set("view", view);
  return url.href;
}
