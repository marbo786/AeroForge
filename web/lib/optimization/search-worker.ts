import type { CoverageIndex } from "../inference/coverage";
import type { Design } from "../inference/domain";
import { search, type Coefficients, type SearchResult, type Settings } from "./search";

export type ToWorker =
  | { type: "start"; settings: Settings; original: Design; index: CoverageIndex }
  | { type: "inference"; rows: (Coefficients | null)[] };
export type FromWorker =
  | { type: "evaluate"; designs: Design[]; baseline: boolean }
  | { type: "progress" | "done"; result: SearchResult }
  | { type: "error"; message: string };

const scope = globalThis as unknown as {
  postMessage: (message: FromWorker) => void;
  onmessage: (event: MessageEvent<ToWorker>) => void;
};
let deliver: ((rows: (Coefficients | null)[]) => void) | undefined;
scope.onmessage = ({ data }) => {
  if (data.type === "inference") {
    deliver?.(data.rows);
    deliver = undefined;
    return;
  }
  void search(
    data.settings,
    data.original,
    data.index,
    (designs, baseline) =>
      new Promise((resolve) => {
        deliver = resolve;
        scope.postMessage({ type: "evaluate", designs, baseline });
      }),
    (result) => scope.postMessage({ type: "progress", result }),
  ).then(
    (result) => scope.postMessage({ type: "done", result }),
    (error: unknown) =>
      scope.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Search failed.",
      }),
  );
};
