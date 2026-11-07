import { test } from "node:test";
import assert from "node:assert/strict";
import { features } from "../lib/inference/surrogate.ts";

test("browser feature contract preserves raw ratios, degrees and log Reynolds without double scaling", () => {
  assert.deepEqual(features({ m: .02, p: .4, t: .12, alpha: 4, re: 100000 }), [.02, .4, .12, 4, 5]);
  assert.deepEqual(features({ m: 0, p: .6, t: .18, alpha: -4, re: 500000 }), [0, 0, .18, -4, Math.log10(500000)]);
  assert.equal(features({ m: .06, p: .2, t: .08, alpha: 8, re: 250000 }).length, 5);
});

test("browser rejects extrapolation and invalid inputs before loading the runtime", () => {
  const valid = { m: .02, p: .4, t: .12, alpha: 4, re: 250000 };
  for (const override of [{ alpha: 8.01 }, { alpha: -4.01 }, { re: 99999 }, { re: 500001 },
    { alpha: NaN }, { re: Infinity }, { m: .07 }, { t: .079 }, { p: .1 }])
    assert.throws(() => features({ ...valid, ...override }));
});
