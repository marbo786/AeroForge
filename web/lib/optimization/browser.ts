import { loadCoverage, reliabilityEvidence } from "../inference/coverage";
import { model, type Design } from "../inference/domain";
import { predictBatch } from "../inference/surrogate";
import { emptyResult, policy, type SearchResult, type Settings } from "./search";
import type { FromWorker, ToWorker } from "./search-worker";

export type SearchStatus = "running" | "finished" | "cancelled" | "failed";
export type Run = {
  settings: Settings;
  original: Design;
  result: SearchResult;
  status: SearchStatus;
  message?: string;
};

export function exportRun(run: Run) {
  return {
    schema: "aeroforge-optimizer-v1",
    model: { version: model.version, sha256: model.model_sha256 },
    coverage: { version: policy.coverage_version, sha256: reliabilityEvidence.coverage_sha256 },
    policy: policy.version,
    ...run,
  };
}

export function startSearch(settings: Settings, original: Design, update: (run: Run) => void) {
  let worker: Worker | undefined;
  let status: SearchStatus = "running";
  let result = emptyResult();
  let submitted = 0;
  let baselineRows = 0;
  const emit = (message?: string) =>
    update({
      settings,
      original,
      status,
      message,
      result: { ...result, counts: { ...result.counts, submitted, baselineRows } },
    });

  function finish(next: Exclude<SearchStatus, "running">, message?: string) {
    if (status !== "running") return;
    status = next;
    worker?.terminate();
    emit(message);
  }

  emit();
  void loadCoverage()
    .then((index) => {
      if (status !== "running") return;
      if (index.version !== policy.coverage_version || model.model_sha256 !== policy.model_sha256)
        throw new Error("Search coverage and the coefficient model must match.");
      worker = new Worker(new URL("./search-worker.ts", import.meta.url), {
        type: "module",
        name: "optimizer-worker",
      });
      const active = worker;
      const send = (data: ToWorker) => active.postMessage(data);
      active.onerror = () => finish("failed", "This browser could not start the search worker.");
      active.onmessageerror = () => finish("failed", "The search worker could not read a result.");
      active.onmessage = ({ data }: MessageEvent<FromWorker>) => {
        if (status !== "running") return;
        switch (data.type) {
          case "evaluate":
            if (data.baseline) baselineRows += data.designs.length;
            else submitted += data.designs.length;
            emit();
            void predictBatch(data.designs).then(
              ({ rows }) => {
                if (status === "running") send({ type: "inference", rows });
              },
              () =>
                finish(
                  "failed",
                  "The shared prediction model could not evaluate the search batch.",
                ),
            );
            break;
          case "progress":
            result = data.result;
            emit();
            break;
          case "done":
            result = data.result;
            finish("finished");
            break;
          case "error":
            finish("failed", data.message);
            break;
        }
      };
      send({ type: "start", settings, original, index });
    })
    .catch(() =>
      finish("failed", "Search requires a verified training coverage index and a worker."),
    );

  return {
    cancel: () => finish("cancelled"),
    dispose() {
      status = "cancelled";
      worker?.terminate();
    },
  };
}
