"use client";

import { useEffect, useState } from "react";
import { VehicleViewport } from "./inspection/preview";
import { ThemeToggle } from "./studio/theme-toggle";
import Studio from "./studio/studio";
import "./studio/tokens.css";
import "./inspection/inspection.css";
import "./landing.css";

export default function Landing() {
  const [legacy, setLegacy] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    setLegacy(["view", "m", "p", "t", "aoa", "re"].some((key) => query.has(key)));
  }, []);
  if (legacy) return <Studio />;
  return (
    <div className="instrument landing">
      <header className="landing-header">
        <a href="/" className="display">
          AeroForge
        </a>
        <ThemeToggle />
      </header>
      <main className="landing-main">
        <div className="landing-intro">
          <p className="landing-kicker">AF–02 / Aerodynamic design lab</p>
          <h1 className="display">Shape your aerodynamic instinct.</h1>
          <p>
            Start with a section. Change its shape. See lift, drag and pressure respond in your
            browser.
          </p>
          <a className="landing-cta" href="/studio/?tour=1">
            Enter design studio
          </a>
        </div>
        <div className="landing-scene inspection">
          <VehicleViewport />
          <p className="landing-scene-caption">AF–02 · Original illustrative car</p>
        </div>
        <aside className="landing-limits" aria-label="Honest limits">
          <h2>Honest limits</h2>
          <p>
            The car and wing pitch are illustrative. Predictions cover isolated NACA sections at α
            −4° to 8° and Re 100,000–500,000. Full-car downforce and lap time are not predicted.
          </p>
          <a href="/model/">Read the model evidence</a>
        </aside>
      </main>
    </div>
  );
}
