import policy from "../../../shared/optimizer-v1.json" with { type: "json" };
import { measureCoverage, type CoverageIndex } from "../inference/coverage.ts";
import { assessDomain, modelBounds, type Bounds, type Design } from "../inference/domain.ts";

export { policy };
export const objectives = {
  efficiency: "Maximize lift to drag",
  drag: "Minimize drag at required lift",
  lift: "Maximize lift",
} as const;
export type Objective = keyof typeof objectives;
export type Algorithm = "differential-evolution" | "random";
export const axes = ["m", "p", "t", "alpha"] as const;
type Axis = (typeof axes)[number];
export type Settings = {
  objective: Objective;
  algorithm: Algorithm;
  re: number;
  ranges: Record<Axis, Bounds>;
  minimumLift: number;
  evaluations: number;
  seed: number;
};
export type Coefficients = { cl: number; cd: number };
export type Candidate = {
  design: Design;
  prediction: Coefficients;
  score: number;
  distance: number;
};
export type Baseline = { design: Design; prediction: Coefficients | null; score: number | null };
export type Counts = {
  attempted: number;
  duplicate: number;
  sparse: number;
  submitted: number;
  completed: number;
  rejected: number;
  feasible: number;
  baselineRows: number;
};
export type SearchResult = {
  baseline: Baseline | null;
  shortlist: Candidate[];
  counts: Counts;
  history: { evaluated: number; score: number }[];
};
export type Evaluate = (designs: Design[], baseline: boolean) => Promise<(Coefficients | null)[]>;

export function emptyResult(): SearchResult {
  return {
    baseline: null,
    shortlist: [],
    history: [],
    counts: {
      attempted: 0,
      duplicate: 0,
      sparse: 0,
      submitted: 0,
      completed: 0,
      rejected: 0,
      feasible: 0,
      baselineRows: 0,
    },
  };
}

const within = (x: number, [lo, hi]: readonly number[]) => Number.isFinite(x) && x >= lo && x <= hi;

export function validateSettings(settings: Settings) {
  if (!Object.hasOwn(objectives, settings.objective)) throw new Error("Choose a search objective.");
  if (settings.algorithm !== "differential-evolution" && settings.algorithm !== "random")
    throw new Error("Choose a search algorithm.");
  if (!within(settings.re, modelBounds.re) || !Number.isInteger(settings.re))
    throw new Error("Choose a whole Reynolds number within model bounds.");
  if (
    !Number.isInteger(settings.evaluations) ||
    !within(settings.evaluations, [1, policy.max_evaluations])
  )
    throw new Error(`Choose between 1 and ${policy.max_evaluations} candidate evaluations.`);
  if (!Number.isInteger(settings.seed) || !within(settings.seed, [0, 0xffffffff]))
    throw new Error("Choose a seed from 0 to 4,294,967,295.");
  if (settings.objective === "drag" && !within(settings.minimumLift, policy.cl))
    throw new Error(`Choose a minimum lift between ${policy.cl[0]} and ${policy.cl[1]}.`);
  for (const axis of axes) {
    const [lo, hi] = settings.ranges[axis];
    if (!within(lo, modelBounds[axis]) || !within(hi, modelBounds[axis]) || lo > hi)
      throw new Error("Each search range must be ordered and within the model bounds.");
  }
}

export function objectiveScore(settings: Settings, row: Coefficients | null) {
  if (!row || !within(row.cl, policy.cl) || !within(row.cd, policy.cd)) return null;
  if (settings.objective === "drag") return row.cl >= settings.minimumLift ? -row.cd : null;
  return settings.objective === "lift" ? row.cl : row.cl / row.cd;
}

function compareBaseline(original: Design, settings: Settings) {
  const [lo, hi] = settings.ranges.alpha;
  return { ...original, re: settings.re, alpha: lo === hi ? lo : original.alpha };
}

function matchesSearch(design: Design, settings: Settings) {
  return axes.every(
    (axis) => (axis === "p" && design.m === 0) || within(design[axis], settings.ranges[axis]),
  );
}

function randomSource(seed: number) {
  return () => {
    // Mulberry32 uses explicit 32-bit arithmetic for reproducibility.
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), seed | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

type Vector = number[];
type Member = { vector: Vector; score: number };

function evolver(random: () => number, algorithm: Algorithm) {
  const population: (Member | undefined)[] = Array(policy.batch_size).fill(undefined);
  let cursor = 0;
  return {
    propose() {
      const slot = cursor++ % population.length;
      const target = population[slot];
      const donors = population.filter((member, i): member is Member => i !== slot && !!member);
      if (algorithm === "random" || !target || donors.length < 3) {
        return { slot, vector: axes.map(() => random()) };
      }
      const [a, b, c] = Array.from(
        { length: 3 },
        () => donors.splice(Math.floor(random() * donors.length), 1)[0].vector,
      );
      const forced = Math.floor(random() * axes.length);
      const vector = target.vector.map((value, i) =>
        i === forced || random() < 0.9
          ? Math.max(0, Math.min(1, a[i] + 0.8 * (b[i] - c[i])))
          : value,
      );
      return { slot, vector };
    },
    accept(slot: number, member: Member) {
      if (!population[slot] || member.score >= population[slot].score) population[slot] = member;
    },
  };
}

function decode(vector: Vector, settings: Settings): Design {
  const value = (index: number) => {
    const [lo, hi] = settings.ranges[axes[index]];
    return Math.min(hi, lo + vector[index] * (hi - lo));
  };
  const m = value(0);
  return { m, p: m === 0 ? 0 : value(1), t: value(2), alpha: value(3), re: settings.re };
}

const designKey = (design: Design) =>
  JSON.stringify([design.m, design.p, design.t, design.alpha, design.re]);

function separated(a: Design, b: Design) {
  const delta = axes.map((axis) => {
    if (axis === "p" && (a.m === 0 || b.m === 0)) return 0;
    const [lo, hi] = modelBounds[axis];
    return (a[axis] - b[axis]) / (hi - lo);
  });
  return Math.hypot(...delta) >= policy.minimum_separation;
}

export async function search(
  settings: Settings,
  original: Design,
  index: CoverageIndex,
  evaluate: Evaluate,
  progress: (result: SearchResult) => void,
) {
  validateSettings(settings);
  const result = emptyResult();
  const { counts } = result;
  const baseline = compareBaseline(original, settings);
  let baselineRow = null;
  if (!assessDomain(baseline).outside.length) {
    counts.baselineRows++;
    [baselineRow] = await evaluate([baseline], true);
  }
  result.baseline = {
    design: baseline,
    prediction: baselineRow,
    score:
      matchesSearch(baseline, settings) && measureCoverage(baseline, index)?.status === "nearby"
        ? objectiveScore(settings, baselineRow)
        : null,
  };
  progress(result);
  const random = randomSource(settings.seed);
  const population = evolver(random, settings.algorithm);
  const seen = new Set<string>();
  const feasible: Candidate[] = [];
  const uniqueLimit =
    settings.ranges.m[1] === 0
      ? settings.ranges.t[0] === settings.ranges.t[1] &&
        settings.ranges.alpha[0] === settings.ranges.alpha[1]
      : axes.every((axis) => settings.ranges[axis][0] === settings.ranges[axis][1]);
  const attemptLimit = Math.max(policy.batch_size, settings.evaluations * 20);
  let best = -Infinity;

  while (counts.submitted < settings.evaluations && counts.attempted < attemptLimit) {
    const batch: { design: Design; vector: Vector; slot: number; distance: number }[] = [];
    const proposals = Math.min(
      uniqueLimit ? 1 : policy.batch_size,
      settings.evaluations - counts.submitted,
      attemptLimit - counts.attempted,
    );
    for (let i = 0; i < proposals; i++) {
      const { vector, slot } = population.propose();
      if (settings.ranges.m[0] === 0 && counts.attempted % 8 === 0) vector[0] = 0;
      const design = decode(vector, settings);
      const key = designKey(design);
      counts.attempted++;
      if (seen.has(key)) {
        counts.duplicate++;
        continue;
      }
      seen.add(key);
      const coverage = measureCoverage(design, index);
      if (!coverage || coverage.status !== "nearby") {
        counts.sparse++;
        continue;
      }
      batch.push({ design, vector, slot, distance: coverage.distance });
    }
    if (batch.length || counts.attempted % 128 === 0) progress(result);
    if (batch.length) {
      const rows = await evaluate(
        batch.map((item) => item.design),
        false,
      );
      if (rows.length !== batch.length)
        throw new Error("Inference batch length disagrees with the search.");
      counts.submitted += batch.length;
      batch.forEach(({ design, vector, slot, distance }, i) => {
        counts.completed++;
        const prediction = rows[i];
        const score = objectiveScore(settings, prediction);
        population.accept(slot, { vector, score: score ?? -Infinity });
        if (score === null || !prediction) {
          counts.rejected++;
          return;
        }
        counts.feasible++;
        feasible.push({ design, prediction, score, distance });
        if (score > best) {
          best = score;
          result.history.push({ evaluated: counts.completed, score });
        }
      });
      feasible.sort((a, b) => b.score - a.score);
      result.shortlist = [];
      for (const item of feasible) {
        if (result.shortlist.every((candidate) => separated(candidate.design, item.design)))
          result.shortlist.push(item);
        if (result.shortlist.length === policy.shortlist_size) break;
      }
      progress(result);
    }
    if (uniqueLimit) break;
  }
  return result;
}
