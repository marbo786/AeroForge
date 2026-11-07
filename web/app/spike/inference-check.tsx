"use client";
import { useState } from "react";
import { runFixture, runtimeVersion } from "../../lib/fixture";

export default function InferenceCheck() {
  const [input, setInput] = useState("3");
  const [status, setStatus] = useState("Ready to load");
  const [error, setError] = useState("");
  const [output, setOutput] = useState<number[] | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setError(""); setOutput(null); setDuration(null); setStatus("Loading runtime and running model");
    try {
      const parts = input.split(",").map((x) => x.trim());
      if (parts.some((x) => !x)) throw new Error("Enter one or more numbers separated by commas.");
      const result = await runFixture(parts.map(Number));
      setOutput(result.output); setDuration(result.durationMs); setStatus("Inference complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inference failed. Reload the page and retry.");
      setStatus("Inference failed");
    } finally { setBusy(false); }
  }
  return <main>
    <header><a href="/">AeroForge</a><span>Phase 1 feasibility test</span></header>
    <h1>Inference, in your browser.</h1>
    <p>A deterministic ONNX fixture computes <code>y = 2x + 1</code> using the WASM CPU runtime. This is an infrastructure check, not an aerodynamic prediction.</p>
    <section aria-labelledby="test-heading">
      <h2 id="test-heading">Run the fixture</h2>
      <form onSubmit={(event) => { event.preventDefault(); void run(); }}>
        <label htmlFor="input">Input values</label>
        <p id="input-help">Use commas for a batch, for example: 0, 3, -2</p>
        <input id="input" aria-describedby="input-help" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" />
        <button disabled={busy} type="submit">{busy ? "Running inference…" : "Run inference"}</button>
      </form>
      <p role="status">{status}</p>
      {error && <p role="alert">{error}</p>}
      {output && <dl><div><dt>Model output</dt><dd data-testid="output">{output.join(", ")}</dd></div>
        <div><dt>Session run time</dt><dd>{duration?.toFixed(2)} ms</dd></div></dl>}
    </section>
    <footer><p>ONNX Runtime Web {runtimeVersion} · WASM · one CPU thread</p>
      <p>Model and runtime assets load from this site. No inference backend is used.</p></footer>
  </main>;
}
