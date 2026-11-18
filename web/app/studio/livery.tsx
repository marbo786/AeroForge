"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  return (
    <div className="livery-picker">
      <label htmlFor="livery">Fictional colorway</label>
      <select
        id="livery"
        value={livery}
        onChange={(event) => {
          if (validLivery(event.target.value)) select(event.target.value);
        }}
      >
        {Object.entries(liveries).map(([id, item]) => (
          <option key={id} value={id}>
            {item.name}
          </option>
        ))}
      </select>
      <span>Original AF–02 finishes</span>
    </div>
  );
}
