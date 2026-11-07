// Test-only stdin/stdout bridge: Python compares actual TypeScript execution.
import { generateGeometry, geometryId, normalizeGeometry, parseNaca, presetCodes, sectionAt } from "../lib/geometry/naca4.ts";
let source = "";
for await (const chunk of process.stdin) source += chunk;
const requests: { parameters: unknown; points: number }[] = JSON.parse(source);
console.log(JSON.stringify({ presets: presetCodes.map((code) => ({ code, parameters: parseNaca(code) })),
  cases: requests.map(({ parameters, points }) => ({
    ...generateGeometry(parameters, points),
    sections: [0, .0001, .1, .25, .4, .6, .75, 1].map((x) => sectionAt(parameters, x)),
    normalized: normalizeGeometry(parameters), geometryId: geometryId(parameters),
  })),
}));
