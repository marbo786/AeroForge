"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    try {
      const selected = localStorage.getItem("aeroforge-theme") === "light";
      document.documentElement.dataset.theme = selected ? "light" : "dark";
      setLight(selected);
    } catch {}
  }, []);
  return (
    <button
      className="chip micro inspection-button"
      aria-label="Light theme"
      aria-pressed={light}
      onClick={() => {
        const next = !light;
        setLight(next);
        document.documentElement.dataset.theme = next ? "light" : "dark";
        try {
          localStorage.setItem("aeroforge-theme", next ? "light" : "dark");
        } catch {}
      }}
    >
      Light
    </button>
  );
}
