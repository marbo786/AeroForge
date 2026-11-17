import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../../artifacts/reliability-v1/coverage-v1.json" with { type: "json" };
import type { CoverageIndex } from "../lib/inference/coverage.ts";
import { model, modelBounds, type Design } from "../lib/inference/domain.ts";
import {
  objectiveScore,
  policy,
  search,
  validateSettings,
  type Settings,
} from "../lib/optimization/search.ts";

const index = data as unknown as CoverageIndex;
const original = { m: 0.02, p: 0.4, t: 0.12, alpha: 4, re: 250000 };
const settings: Settings = {
  objective: "efficiency",
  algorithm: "differential-evolution",
  re: 250000,
  ranges: { ...modelBounds, alpha: [4, 4] },
  minimumLift: 0.7,
  evaluations: 80,
  seed: 42,
};
const evaluate = async (rows: Design[]) =>
  rows.map((row) => ({ cl: 0.65 + 5 * row.m, cd: 0.01 + row.t * 0.03 }));

test("optimizer objectives enforce plausible finite drag and minimum lift", () => {
  assert.equal(policy.model_sha256, model.model_sha256);
  const row = { cl: 0.8, cd: 0.01 };
  assert.equal(objectiveScore(settings, row), 80);
  assert.equal(objectiveScore({ ...settings, objective: "lift" }, row), 0.8);
  assert.equal(objectiveScore({ ...settings, objective: "drag" }, row), -0.01);
  assert.equal(objectiveScore({ ...settings, objective: "drag", minimumLift: 0.9 }, row), null);
  for (const invalid of [
    null,
    { ...row, cd: 1e-8 },
    { ...row, cd: Infinity },
    { ...row, cd: -0.01 },
    { ...row, cl: NaN },
    { ...row, cl: 1.71 },
  ])
    assert.equal(objectiveScore(settings, invalid), null);
  for (const invalid of [
    { re: 500001 },
    { evaluations: 4097 },
    { seed: -1 },
    { ranges: { ...settings.ranges, t: [0.16, 0.12] as const } },
  ])
    assert.throws(() => validateSettings({ ...settings, ...invalid }));
});

test("seeded search honors the candidate budget and fixed or bounded flow", async () => {
  const first = await search(settings, original, index, evaluate, () => {});
  assert.deepEqual(await search(settings, original, index, evaluate, () => {}), first);
  assert.equal(first.counts.submitted, 80);
  assert.equal(first.counts.completed, 80);
  assert.equal(first.counts.baselineRows, 1);
  assert.equal(
    first.counts.attempted,
    first.counts.submitted + first.counts.duplicate + first.counts.sparse,
  );
  assert.ok(first.shortlist.length > 1);
  assert.ok(first.history.every((row, i) => i === 0 || row.score > first.history[i - 1].score));
  assert.ok(first.shortlist.every(({ design }) => design.alpha === 4 && design.re === 250000));
  const varied: Settings = {
    ...settings,
    objective: "drag",
    algorithm: "random",
    re: 300000,
    ranges: { m: [0, 0.04], p: [0.3, 0.5], t: [0.1, 0.14], alpha: [-1, 3] },
  };
  const second = await search(varied, original, index, evaluate, () => {});
  assert.equal(second.counts.submitted, 80);
  assert.equal(second.baseline?.score, null);
  assert.ok(second.shortlist.length);
  for (const row of second.shortlist) {
    assert.equal(row.design.re, 300000);
    assert.ok(row.design.alpha >= -1 && row.design.alpha <= 3);
    assert.ok(row.design.t >= 0.1 && row.design.t <= 0.14);
    assert.ok(row.prediction.cl >= varied.minimumLift);
  }
});

test("symmetric duplicates, sparse regions and invalid coefficients produce accurate counts", async () => {
  const fixed: Settings = {
    ...settings,
    evaluations: 8,
    ranges: { m: [0, 0], p: [0.2, 0.6], t: [0.12, 0.12], alpha: [4, 4] },
  };
  const only = await search(fixed, original, index, evaluate, () => {});
  assert.equal(only.counts.submitted, 1);
  assert.equal(only.shortlist[0].design.p, 0);
  const sparse: Settings = {
    ...fixed,
    re: 160000,
    ranges: { m: [0.06, 0.06], p: [0.6, 0.6], t: [0.18, 0.18], alpha: [8, 8] },
  };
  const none = await search(sparse, original, index, evaluate, () => {});
  assert.equal(none.counts.sparse, 1);
  assert.equal(none.counts.submitted, 0);
  assert.deepEqual(none.shortlist, []);
  const rejected = await search(
    { ...settings, evaluations: 17 },
    original,
    index,
    async (rows) => rows.map(() => null),
    () => {},
  );
  assert.equal(rejected.counts.rejected, 17);
  assert.equal(rejected.counts.completed, 17);
  assert.equal(rejected.counts.feasible, 0);
});
