"use client";

import type { Design } from "../../lib/inference/domain";
import type { PressureProfiles } from "../studio/use-pressure-profile";
import type { ScrollCamera } from "./scroll-camera";
import dynamic from "next/dynamic";
import { ThemeToggle } from "../studio/theme-toggle";
import Image from "next/image";
import { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  cameraViews,
  vehiclePath,
  type View,
  type CameraCommand,
  type CameraPose,
  type RenderStats,
} from "./camera";

const Scene = dynamic(() => import("./scene"), { ssr: false });

class GraphicsBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Status = "poster" | "loading" | "ready" | "unsupported" | "failed" | "lost";

type WingInspection = { selected: boolean; onInspect: () => void; onReturn: () => void };

export function VehicleViewport({
  active = true,
  initialized = true,
  onAirfoil,
  wing,
  alpha = 0,
  design,
  profiles,
  study = false,
  story,
  autoStart = true,
}: {
  active?: boolean;
  initialized?: boolean;
  onAirfoil?: () => void;
  wing?: WingInspection;
  alpha?: number;
  design?: Design;
  profiles?: PressureProfiles;
  study?: boolean;
  story?: ScrollCamera;
  autoStart?: boolean;
}) {
  const [status, setStatus] = useState<Status>("poster");
  const [progress, setProgress] = useState<number | null>(null);
  const [compact, setCompact] = useState(false);
  const cameraHelp = useId();
  const [stats, setStats] = useState<RenderStats>();
  const [view, setView] = useState<View>("Three-quarter");
  const [command, setCommand] = useState<CameraCommand>({ view: "Three-quarter" });
  const pose = useRef<CameraPose>(null);
  const wingPose = useRef<CameraPose>(null);
  const wingAction = useRef<HTMLButtonElement>(null);

  function start() {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      if (!context) {
        setStatus("unsupported");
        return;
      }
      context.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setStatus("unsupported");
      return;
    }
    setView("Three-quarter");
    setCommand({ view: "Three-quarter" });
    pose.current = null;
    wingPose.current = null;
    setProgress(null);
    setCompact(matchMedia("(max-width: 740px)").matches);
    setStatus("loading");
  }

  useEffect(() => {
    if (!active && status === "ready") {
      setProgress(null);
      setStatus("loading");
    }
    if (
      !autoStart ||
      !initialized ||
      !active ||
      status !== "poster" ||
      !matchMedia("(min-width: 741px)").matches
    )
      return;
    if (typeof requestIdleCallback === "function") {
      const callback = requestIdleCallback(start, { timeout: 600 });
      return () => cancelIdleCallback(callback);
    }
    const timeout = window.setTimeout(start, 0);
    return () => window.clearTimeout(timeout);
  }, [active, initialized, status, autoStart]);

  if (!active) return null;
  const renderScene = active && (status === "ready" || status === "loading");
  const message = {
    poster: "Still preview · 3D is optional.",
    loading: "Loading 3D preview…",
    ready: "Drag to orbit. Scroll or pinch to zoom.",
    unsupported: "3D is unavailable in this browser.",
    failed: "The 3D preview could not load.",
    lost: "The 3D graphics context was lost.",
  }[status];

  const inspect = () => {
    wingPose.current = null;
    wing?.onInspect();
    wingAction.current?.focus({ preventScroll: true });
  };

  return (
    <div className="vehicle-viewport" data-wing-selected={wing?.selected || study || undefined}>
      <div
        className="inspection-bay"
        data-render-status={status}
        data-section-geometry={design ? [design.m, design.p, design.t].join("/") : undefined}
        data-pressure-surface={profiles ? "ready" : undefined}
        data-render-tier={renderScene ? (compact ? "compact" : "desktop") : undefined}
        data-triangles={stats?.triangles}
        data-draw-calls={stats?.calls}
      >
        {initialized && status !== "ready" && (
          <Image
            className="inspection-poster"
            src={vehiclePath + "poster.webp"}
            width={1440}
            height={720}
            alt="AF–02 from the front three-quarter angle"
            loading="eager"
            fetchPriority="high"
            unoptimized
          />
        )}
        {renderScene && (
          <GraphicsBoundary onFailure={() => setStatus("failed")}>
            <Scene
              command={command}
              story={story}
              pose={pose}
              wingPose={wingPose}
              wingSelected={!!wing?.selected || study}
              compact={compact}
              cameraHelp={cameraHelp}
              alpha={alpha}
              design={design}
              profiles={profiles}
              onInspect={wing ? inspect : undefined}
              onProgress={setProgress}
              onFailure={(kind) => setStatus(kind)}
              onReady={(value) => {
                setStats(value);
                setStatus("ready");
              }}
            />
          </GraphicsBoundary>
        )}
        <div className="inspection-state">
          <p role="status" aria-label="Graphics status">
            {message}
            {status === "loading" && progress !== null && (
              <span aria-hidden="true"> {progress}%</span>
            )}
          </p>
          {!renderScene && status !== "unsupported" && (
            <button className="inspection-button" disabled={!initialized} onClick={start}>
              {status === "poster" ? "Enable 3D" : "Retry 3D"}
            </button>
          )}
          {!renderScene &&
            status !== "poster" &&
            !wing?.selected &&
            (onAirfoil ? (
              <button className="inspection-button" onClick={onAirfoil}>
                Continue in 2D
              </button>
            ) : (
              <a className="inspection-button" href="/studio/?view=airfoil">
                Continue in 2D
              </a>
            ))}
        </div>
        {renderScene && (
          <span id={cameraHelp} hidden>
            Use the arrow keys to orbit the car.
          </span>
        )}
      </div>
      <div className="inspection-toolbar">
        {wing && (
          <>
            <button
              ref={wingAction}
              className="inspection-button inspection-wing-action"
              type="button"
              onClick={wing.selected ? wing.onReturn : inspect}
            >
              {wing.selected ? "Return to car" : "Inspect front wing"}
            </button>
            <span className="sr-only" role="status" aria-label="Component selection">
              {wing.selected
                ? "Front wing selected. The representative NACA section is ready to edit."
                : "Car overview"}
            </span>
          </>
        )}
        {!wing?.selected && (
          <div className="inspection-controls">
            <div className="inspection-camera" role="group" aria-label="Camera views">
              {cameraViews.map((item) => (
                <button
                  className="inspection-button"
                  key={item}
                  aria-pressed={view === item}
                  disabled={status !== "ready"}
                  onClick={() => {
                    setView(item);
                    setCommand({ view: item });
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="inspection-camera" role="group" aria-label="Camera zoom">
              <button
                className="inspection-button zoom"
                aria-label="Zoom out"
                disabled={status !== "ready"}
                onClick={() => setCommand({ zoom: -1 })}
              >
                −
              </button>
              <button
                className="inspection-button zoom"
                aria-label="Zoom in"
                disabled={status !== "ready"}
                onClick={() => setCommand({ zoom: 1 })}
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Preview() {
  return (
    <main className="inspection">
      <header className="inspection-header">
        <a href="/" className="inspection-brand">
          AeroForge <span>Design Lab</span>
        </a>
        <ThemeToggle />
        <a className="inspection-button" href="/studio/?view=airfoil">
          Open Airfoil editor <span aria-hidden="true">↗</span>
        </a>
      </header>
      <section className="inspection-sheet" aria-labelledby="vehicle-title">
        <div className="inspection-heading">
          <div>
            <p className="inspection-kicker">Vehicle inspection</p>
            <h1 id="vehicle-title">AF–02</h1>
          </div>
          <p className="inspection-caption">Illustrative Formula-style car</p>
        </div>
        <VehicleViewport />
        <p className="inspection-scope">
          The 2D airfoil editor calculates isolated section lift and drag. The car is for
          inspection.
        </p>
      </section>
    </main>
  );
}
