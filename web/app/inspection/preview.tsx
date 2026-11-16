"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useEffect, useState, type ReactNode } from "react";

const Scene = dynamic(() => import("./scene"), {ssr:false});
const views = ["Three-quarter", "Front", "Side", "Top"] as const;
export type View = typeof views[number];
export type CameraCommand = {view: View} | {zoom: -1 | 1};
export const vehiclePath = "/vehicle/af02-v1/";
export type RenderStats = {calls:number; triangles:number};

class GraphicsBoundary extends Component<{children:ReactNode; onFailure:()=>void}, {failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

type Status = "poster" | "loading" | "ready" | "unsupported" | "failed" | "lost";

export default function Preview() {
  const [status, setStatus] = useState<Status>("poster");
  const [progress, setProgress] = useState<number | null>(null);
  const [stats, setStats] = useState<RenderStats>();
  const [view, setView] = useState<View>("Three-quarter");
  const [command, setCommand] = useState<CameraCommand>({view:"Three-quarter"});

  function start() {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      if (!context) { setStatus("unsupported"); return; }
      context.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setStatus("unsupported");
      return;
    }
    setView("Three-quarter");
    setCommand({view:"Three-quarter"});
    setProgress(null);
    setStatus("loading");
  }

  useEffect(() => {
    if (matchMedia("(min-width: 741px)").matches) start();
  }, []);

  const active = status === "ready" || status === "loading";
  const message = {
    poster:"3D preview is optional on compact screens.",
    loading: progress === null ? "Preparing 3D preview…" : `Loading vehicle · ${progress}%`,
    ready:"Drag to orbit. Scroll or pinch to zoom.",
    unsupported:"3D is unavailable in this browser.",
    failed:"The 3D preview could not load.",
    lost:"The 3D graphics context was lost.",
  }[status];

  return <main className="inspection">
    <header className="inspection-header">
      <a href="/" className="inspection-brand">AeroForge <span>Design Lab</span></a>
      <a className="inspection-button" href="/studio/">Open Airfoil editor <span aria-hidden="true">↗</span></a>
    </header>
    <section className="inspection-sheet" aria-labelledby="vehicle-title">
      <div className="inspection-heading">
        <div><p className="inspection-kicker">Vehicle inspection</p><h1 id="vehicle-title">AF–02</h1></div>
        <p className="inspection-caption">Illustrative Formula-style car</p>
      </div>
      <div className="inspection-bay" data-render-status={status}
        data-triangles={stats?.triangles} data-draw-calls={stats?.calls}>
        {status !== "ready" && <Image className="inspection-poster" src={vehiclePath+"poster.webp"}
          width={1440} height={720} alt="AF–02 from the front three-quarter angle" unoptimized/>}
        {active && <GraphicsBoundary onFailure={() => setStatus("failed")}>
          <Scene command={command} onProgress={setProgress}
            onFailure={kind=>setStatus(kind)}
            onReady={value=>{setStats(value);setStatus("ready");}}/>
        </GraphicsBoundary>}
        <div className="inspection-state">
          <p role="status">{message}</p>
          {!active && status !== "unsupported" && <button className="inspection-button" onClick={start}>
            {status === "poster" ? "Enable 3D" : "Retry 3D"}
          </button>}
          {!active && status !== "poster" && <a className="inspection-button" href="/studio/">Continue in 2D</a>}
        </div>
      </div>
      <div className="inspection-controls">
        <div className="inspection-camera" role="group" aria-label="Camera views">
          {views.map(item=><button className="inspection-button" key={item} aria-pressed={view===item}
            disabled={status!=="ready"} onClick={()=>{setView(item);setCommand({view:item});}}>{item}</button>)}
        </div>
        <div className="inspection-camera" role="group" aria-label="Camera zoom">
          <button className="inspection-button zoom" aria-label="Zoom out" disabled={status!=="ready"} onClick={()=>setCommand({zoom:-1})}>−</button>
          <button className="inspection-button zoom" aria-label="Zoom in" disabled={status!=="ready"} onClick={()=>setCommand({zoom:1})}>+</button>
        </div>
      </div>
      <p className="inspection-scope">The 2D airfoil editor calculates isolated section lift and drag. The car is for inspection.</p>
    </section>
  </main>;
}
