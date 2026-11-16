import { test } from "node:test";
import assert from "node:assert/strict";
import { features } from "../lib/inference/surrogate.ts";

test("browser feature contract preserves raw ratios, degrees and log Reynolds without double scaling", () => {
  assert.deepEqual(
    features({ m: 0.02, p: 0.4, t: 0.12, alpha: 4, re: 100000 }),
    [0.02, 0.4, 0.12, 4, 5],
  );
  assert.deepEqual(features({ m: 0, p: 0.6, t: 0.18, alpha: -4, re: 500000 }), [
    0,
    0,
    0.18,
    -4,
    Math.log10(500000),
  ]);
  assert.equal(features({ m: 0.06, p: 0.2, t: 0.08, alpha: 8, re: 250000 }).length, 5);
});

test("browser rejects extrapolation and invalid inputs before loading the runtime", () => {
  const valid = { m: 0.02, p: 0.4, t: 0.12, alpha: 4, re: 250000 };
  for (const override of [
    { alpha: 8.01 },
    { alpha: -4.01 },
    { re: 99999 },
    { re: 500001 },
    { alpha: NaN },
    { re: Infinity },
    { m: 0.07 },
    { t: 0.079 },
    { p: 0.1 },
  ])
    assert.throws(() => features({ ...valid, ...override }));
});
