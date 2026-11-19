"use client";

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";

import "./livery.css";

export const liveries = {
  ember: { name: "Ember Works", accent: "#ff9559", paint: "#8b321d" },
  ion: { name: "Ion Velocity", accent: "#86b8ff", paint: "#204a8c" },
  violet: { name: "Violet Apex", accent: "#c1a1ff", paint: "#59317f" },
} as const;
export type LiveryId = keyof typeof liveries;
export function validLivery(value: string | null): value is LiveryId {
  return value !== null && Object.hasOwn(liveries, value);
}
const LiveryContext = createContext<{ livery: LiveryId; select: (id: LiveryId) => void }>({
  livery: "ember",
  select: () => {},
});

export function LiveryProvider({ children }: { children: ReactNode }) {
  const [livery, setLivery] = useState<LiveryId>("ember");
  useEffect(() => {
    const shared = new URLSearchParams(location.search).get("livery");
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("aeroforge-livery");
    } catch {}
    const selected = validLivery(shared) ? shared : validLivery(saved) ? saved : "ember";
    setLivery(selected);
    document.documentElement.dataset.livery = selected;
  }, []);
  function select(id: LiveryId) {
    setLivery(id);
    document.documentElement.dataset.livery = id;
    try {
      localStorage.setItem("aeroforge-livery", id);
    } catch {}
    const url = new URL(location.href);
    url.searchParams.set("livery", id);
    history.replaceState(null, "", url);
  }
  return <LiveryContext.Provider value={{ livery, select }}>{children}</LiveryContext.Provider>;
}
export const useLivery = () => useContext(LiveryContext);

export function LiveryPicker() {
  const { livery, select } = useLivery();
  const group = useId();
  return (
    <div className="livery-picker" role="radiogroup" aria-label="Fictional colorway">
      <span className="livery-label">Fictional colorway</span>
      <div className="livery-swatches">
        {(Object.entries(liveries) as [LiveryId, (typeof liveries)[LiveryId]][]).map(
          ([id, item]) => (
            <label className="livery-chip" key={id}>
              <input
                type="radio"
                name={group}
                value={id}
                checked={livery === id}
                onChange={() => select(id)}
                aria-label={item.name}
              />
              <span
                className="livery-swatch"
                aria-hidden="true"
                style={{
                  background: `linear-gradient(135deg, ${item.accent} 50%, ${item.paint} 50%)`,
                }}
              />
              <span className="livery-name" aria-hidden="true">
                {item.name}
              </span>
            </label>
          ),
        )}
      </div>
      <span className="livery-caption">Original AF–02 finishes</span>
    </div>
  );
}
