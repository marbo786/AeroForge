import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import assert from "node:assert/strict";

const cli = resolve(
  process.env.LIGHTHOUSE_CLI ?? ".wrangler/phase-f/node_modules/lighthouse/cli/index.js",
);
const version = JSON.parse(
  await readFile(resolve(dirname(cli), "../package.json"), "utf8"),
).version;
assert.equal(version, "13.6.0");
const folder = "../docs/polish/scroll/lighthouse";
await mkdir(folder, { recursive: true });
const servers = [];
const afterOnly = process.argv.includes("--after-only");
const reports = afterOnly
  ? JSON.parse(await readFile(`${folder}/summary.json`, "utf8")).runs.filter(
      (row) => row.stage === "before",
    )
  : [];
try {
  for (const [stage, script, port] of [
    ["before", ".wrangler/landing-baseline/scripts/serve-static.mjs", "4191"],
    ["after", "scripts/serve-static.mjs", "4192"],
  ]) {
    if (afterOnly && stage === "before") continue;
    const server = spawn(process.execPath, [script], {
      env: { ...process.env, PORT: port },
      stdio: "pipe",
      windowsHide: true,
    });
    servers.push(server);
    await new Promise((resolve) => server.stdout.once("data", resolve));
    for (let sample = 1; sample <= 2; sample++) {
      for (const profile of ["desktop", "mobile"]) {
        const file = `${folder}/${stage}-${profile}-${sample}.json`;
        const flags = profile === "desktop" ? ["--preset=desktop"] : [];
        await new Promise((resolveRun, reject) => {
          const child = spawn(
            process.execPath,
            [
              cli,
              `http://127.0.0.1:${port}/`,
              ...flags,
              "--chrome-flags=--headless=new --no-sandbox",
              "--throttling-method=simulate",
              "--output=json",
              `--output-path=${file}`,
              "--quiet",
            ],
            {
              env: {
                ...process.env,
                CHROME_PATH:
                  process.env.CHROME_PATH ??
                  "C:/Program Files/Google/Chrome/Application/chrome.exe",
              },
              stdio: "pipe",
              windowsHide: true,
            },
          );
          let errors = "";
          child.stderr.on("data", (data) => {
            errors += data;
          });
          child.once("error", reject);
          child.once("exit", (code) => (code === 0 ? resolveRun() : reject(new Error(errors))));
        });
        const report = JSON.parse(await readFile(file, "utf8"));
        assert(!report.runtimeError, JSON.stringify(report.runtimeError));
        const row = {
          stage,
          profile,
          sample,
          version,
          userAgent: report.userAgent,
          scores: Object.fromEntries(
            Object.entries(report.categories).map(([key, value]) => [
              key,
              Math.round(value.score * 100),
            ]),
          ),
          lcpMs: report.audits["largest-contentful-paint"].numericValue,
          tbtMs: report.audits["total-blocking-time"].numericValue,
          cls: report.audits["cumulative-layout-shift"].numericValue,
        };
        reports.push(row);
        console.log(row);
      }
    }
    server.kill();
  }
  await writeFile(
    `${folder}/summary.json`,
    JSON.stringify(
      {
        method:
          "Two cold-cache samples per profile and version, Lighthouse 13.6.0 simulated throttling. Both exports use the same local gzip server. Baseline snapshot provenance is retained separately. Lab results do not establish physical-phone or WebKit performance.",
        runs: reports,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  servers.forEach((server) => server.kill());
}
