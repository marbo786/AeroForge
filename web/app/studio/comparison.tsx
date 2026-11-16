import type { Design } from "../../lib/inference/surrogate";
import { nameOf, type Result, type SavedDesign } from "./section-design";

export function Comparison({
  design,
  current,
  saved,
  onRestore,
  onClear,
}: {
  design: Design;
  current: Result | null;
  saved: SavedDesign;
  onRestore: () => void;
  onClear: () => void;
}) {
  const describe = (value: Design) => `${value.alpha}° / Re ${value.re.toLocaleString("en-US")}`;
  return (
    <section className="comparison-panel" aria-label="Operating point comparison">
      <h3 className="micro">Operating point comparison</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">Coefficient</th>
            <th scope="col">Current</th>
            <th scope="col">Saved</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Design</th>
            <td>{nameOf(design)}</td>
            <td>{nameOf(saved.design)}</td>
          </tr>
          <tr>
            <th scope="row">Condition</th>
            <td>{describe(design)}</td>
            <td>{describe(saved.design)}</td>
          </tr>
          {(
            [
              ["CL", "cl", 4],
              ["CD", "cd", 5],
              ["L/D", "ratio", 2],
            ] as const
          ).map(([label, key, digits]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>{current?.[key].toFixed(digits) ?? "—"}</td>
              <td>{saved.result?.[key].toFixed(digits) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="comparison-actions">
        <button className="chip micro" onClick={onRestore}>
          Restore saved design
        </button>
        <button className="chip micro" onClick={onClear}>
          Clear saved comparison
        </button>
      </div>
    </section>
  );
}
