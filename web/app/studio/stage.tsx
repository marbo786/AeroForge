"use client";
import { useReducedPreference } from "./use-reduced-preference";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from "react";
import { useSpring } from "motion/react";
import { generateGeometry, sectionAt, type Point } from "../../lib/geometry/naca4";
import type { Design } from "../../lib/inference/surrogate";
import { Callout } from "./kit";

export type Display = { grid: boolean; camber: boolean; chord: boolean; labels: boolean; flow: boolean };
type Handle = "camber" | "position" | "thickness" | "rotation";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Presentation-only interpolation: generate true NACA coordinates on every frame.
function useGeometryMotion(design: Design) {
  const reduced = useReducedPreference();
  const [visual, setVisual] = useState(design);
  const m = useSpring(design.m, { stiffness: 260, damping: 32 });
  const p = useSpring(design.p || .4, { stiffness: 260, damping: 32 });
  const t = useSpring(design.t, { stiffness: 260, damping: 32 });
  const alpha = useSpring(design.alpha, { stiffness: 260, damping: 32 });
  useEffect(() => {
    const values = [m, p, t, alpha];
    const targets = [design.m, design.p || .4, design.t, design.alpha];
    values.forEach((v, i) => reduced ? v.jump(targets[i]) : v.set(targets[i]));
    let frame = 0;
    const refresh = () => {
      const next = { m: clamp(m.get(), 0, .06), p: clamp(p.get(), .2, .6), t: clamp(t.get(), .08, .18), alpha: alpha.get(), re: design.re };
      setVisual({ ...next, p: next.m === 0 ? 0 : next.p });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(refresh); };
    const unsub = values.map((v) => v.on("change", schedule));
    schedule();
    return () => { unsub.forEach((fn) => fn()); cancelAnimationFrame(frame); };
  }, [design.m, design.p, design.t, design.alpha, design.re, reduced, m, p, t, alpha]);
  return reduced ? design : visual;
}

export function Stage({ design, display, onChange, invalid }: { design: Design; display: Display; onChange: (field: string, value: string) => void; invalid: boolean }) {
  const visual = useGeometryMotion(design);
  const svgRef = useRef<SVGSVGElement>(null);
  const foilRef = useRef<SVGGElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const active = useRef<{ kind: Handle | "pan"; x: number; y: number; viewX: number; viewY: number } | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const queued = useRef<{ field: string; value: string }[]>([]);
  const changeRef=useRef(onChange);changeRef.current=onChange;
  const frame = useRef(0);
  const lastCommit=useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    const svg=svgRef.current;
    if(!svg)return;
    const wheel=(event:WheelEvent)=>{event.preventDefault();setView(value=>({...value,scale:clamp(value.scale*Math.exp(-event.deltaY*.001),.6,3)}));};
    svg.addEventListener("wheel",wheel,{passive:false});
    return()=>svg.removeEventListener("wheel",wheel);
  },[]);
  function queue(field: string, value: number) {
    queued.current = queued.current.filter((v) => v.field !== field).concat({ field, value: String(Number(value.toFixed(3))) });
    if (!frame.current) {
      const flush=(now:number)=>{
        if(now-lastCommit.current<110){frame.current=requestAnimationFrame(flush);return;}
        frame.current=0;lastCommit.current=now;
        const updates=queued.current;queued.current=[];
        updates.forEach(value=>changeRef.current(value.field,value.value));
      };
      frame.current=requestAnimationFrame(flush);
    }
  }
  const geometry = generateGeometry(visual);
  const xy = ([x,y]: Point): Point => [120 + 560*x, 240 - 560*y];
  const path = `M${geometry.contour.map((pt) => xy(pt).map((v) => v.toFixed(4)).join(",")).join(" L")} Z`;
  const exact = generateGeometry(design);
  const exactPath = `M${exact.contour.map((pt) => xy(pt).map((v) => v.toFixed(4)).join(",")).join(" L")} Z`;
  const camberPoint = xy([visual.p || .4, visual.m]);
  const thickX = geometry.x.reduce((best,x) => sectionAt(visual,x).halfThickness > sectionAt(visual,best).halfThickness ? x : best, .3);
  const thicknessPoint = xy(sectionAt(visual, thickX).upper);
  const rotate = ([x,y]: Point): Point => {
    const angle = visual.alpha * Math.PI / 180;
    return [260 + (x-260)*Math.cos(angle) - (y-240)*Math.sin(angle), 240 + (x-260)*Math.sin(angle) + (y-240)*Math.cos(angle)];
  };
  const start = (event: ReactPointerEvent<SVGElement>, kind: Handle | "pan") => {
    if (kind === "position" && design.m === 0) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    active.current = { kind, x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y };
  };
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, [event.clientX,event.clientY]);
    if (pointers.current.size === 2 && pinch.current) {
      const [a,b] = [...pointers.current.values()];
      const distance = Math.hypot(a[0]-b[0],a[1]-b[1]);
      setView((v) => ({ ...v, scale: clamp(pinch.current!.scale*distance/pinch.current!.distance,.6,3) }));
      active.current = null; return;
    }
    if (!active.current) return;
    const activeDrag = active.current;
    if (activeDrag.kind === "pan") {
      const ratio = 800 / (svgRef.current?.getBoundingClientRect().width || 800);
      setView((v) => ({ ...v, x: activeDrag.viewX+(event.clientX-activeDrag.x)*ratio, y: activeDrag.viewY+(event.clientY-activeDrag.y)*ratio }));
      return;
    }
    const matrix = foilRef.current?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    if (activeDrag.kind === "camber") queue("m",clamp((240-point.y)/560*100,0,6));
    if (activeDrag.kind === "position") queue("p",clamp((point.x-120)/560*100,20,60));
    if (activeDrag.kind === "thickness") {
      const baseline = sectionAt({ ...design,t: 1/10 },thickX);
      const camber = baseline.camber;
      const desired = (240-point.y)/560-camber;
      queue("t",clamp(desired/(baseline.upper[1]-camber)*10,8,18));
    }
    if (activeDrag.kind === "rotation") {
      const stageMatrix = foilRef.current?.parentElement instanceof SVGGraphicsElement ? foilRef.current.parentElement.getScreenCTM() : null;
      if (!stageMatrix) return;
      const target = new DOMPoint(event.clientX,event.clientY).matrixTransform(stageMatrix.inverse());
      queue("alpha",clamp(Math.atan2(target.y-240,target.x-260)*180/Math.PI,-4,12));
    }
  }
  function end(event: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId); pinch.current = null; active.current = null;
    cancelAnimationFrame(frame.current);frame.current=0;
    const updates=queued.current;queued.current=[];lastCommit.current=performance.now();
    updates.forEach(value=>changeRef.current(value.field,value.value));
  }
  function keyboard(event: KeyboardEvent<SVGGElement>, kind: Handle) {
    if (!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const delta = ["ArrowUp","ArrowRight"].includes(event.key) ? 1 : -1;
    const coarse = event.shiftKey ? 5 : 1;
    const mapping = { camber: ["m",design.m*100,0,6,.1], position: ["p",(design.p||.4)*100,20,60,1], thickness: ["t",design.t*100,8,18,.1], rotation: ["alpha",design.alpha,-4,12,.1] } as const;
    const [field,value,min,max,step] = mapping[kind];
    queue(field,clamp(value+delta*coarse*step,min,max));
  }
  const handles: { kind: Handle; point: Point; label: string; value: number; min: number; max: number }[] = [
    { kind:"camber",point:camberPoint,label:"Drag maximum camber",value:design.m*100,min:0,max:6 },
    { kind:"position",point:xy([visual.p||.4,-.085]),label:"Drag camber position",value:design.p*100,min:20,max:60 },
    { kind:"thickness",point:thicknessPoint,label:"Drag thickness",value:design.t*100,min:8,max:18 },
    { kind:"rotation",point:[710,240],label:"Drag angle of attack",value:design.alpha,min:-4,max:12 },
  ];
  return <div className="stage-viewport">
    <div className="stage-ruler" aria-hidden="true"/><div className="stage-meta micro"><span>Section study / finite trailing edge</span><span>Chord c = 1.000</span></div>
    <svg ref={svgRef} className="airfoil-svg" viewBox="0 55 800 350" role="img" aria-labelledby="foil-title" aria-describedby="foil-description" onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      onPointerDown={(e) => { pointers.current.set(e.pointerId,[e.clientX,e.clientY]); if(pointers.current.size===2) { const [a,b]=[...pointers.current.values()]; pinch.current={distance:Math.hypot(a[0]-b[0],a[1]-b[1]),scale:view.scale}; } start(e,"pan"); }}>
      <title id="foil-title">{`Airfoil at ${design.alpha} degrees`}</title><desc id="foil-description">{`Accurate NACA upper and lower surfaces with equal horizontal and vertical scale. Positive angle rotates the leading edge upward. ${invalid ? "Showing last valid geometry." : "Drag the handles to edit geometry or incidence."}`}</desc>
      <defs><pattern id="paper-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#d9d7d0" strokeWidth=".6"/></pattern><pattern id="surface-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#c5c2b9" strokeWidth=".5"/></pattern></defs>
      {display.grid && <rect width="800" height="480" fill="url(#paper-grid)"/>}
      <g className="orbit-guides" aria-hidden="true"><ellipse cx="400" cy="300" rx="378" ry="155"/><ellipse cx="400" cy="300" rx="295" ry="120"/><path d="M0 300H800M400 80V470"/></g>
      <g transform={`translate(${view.x} ${view.y}) translate(400 240) scale(${view.scale}) translate(-400 -240)`}>
        <g className="foil-rotation" transform={`rotate(${visual.alpha} 260 240)`} ref={foilRef}>
          <path d={path} transform="translate(15 34)" className="offset-plane"/>
          <path d={path} className="foil-surface"/>
          <path d={path} fill="url(#surface-hatch)" opacity=".4"/>
          <path d={exactPath} data-testid="foil-path" className="exact-contour" aria-hidden="true"/>
          {display.camber && <polyline className="camber-line" points={geometry.x.map((x) => xy([x,sectionAt(visual,x).camber]).join(",")).join(" ")}/>}
          {display.chord && <path d="M120 240H680" className="chord-line"/>}
          <path d={`M${120+560*(visual.p||.4)} 240V287.6`} className="handle-stem"/>
          {display.flow && <g className="conceptual-flow" aria-label="Conceptual airflow, not a simulation"><path d="M30 170Q280 90 760 178M30 285Q350 350 760 275"/><text x="440" y="380">CONCEPTUAL / NOT SIMULATED</text></g>}
          {handles.map((handle) => <g key={handle.kind} className={`geometry-handle ${handle.kind}`} role="slider" tabIndex={handle.kind === "position" && design.m === 0 ? -1 : 0} aria-disabled={handle.kind === "position" && design.m === 0} aria-label={handle.label} aria-valuenow={handle.value} aria-valuemin={handle.min} aria-valuemax={handle.max} onPointerDown={(e) => start(e,handle.kind)} onKeyDown={(e) => keyboard(e,handle.kind)} transform={`translate(${handle.point[0]} ${handle.point[1]})`}><circle r="25" fill="transparent" className="handle-hit"/><circle r="6" className="handle-dot"/><path d="M-11 0H11M0 -11V11"/></g>)}
        </g>
        {display.labels && <g className="stage-callouts">
          <Callout {...{x:rotate([120,240])[0],y:rotate([120,240])[1]}} labelX={48} labelY={150} label="LEADING EDGE" value="x/c 0.000"/>
          <Callout {...{x:rotate([680,240])[0],y:rotate([680,240])[1]}} labelX={622} labelY={150} label="TRAILING EDGE" value="FINITE GAP"/>
          <Callout {...{x:rotate(camberPoint)[0],y:rotate(camberPoint)[1]}} labelX={265} labelY={99} label="MAX CAMBER" value={`${(design.m*100).toFixed(1)}% / ${(design.p*100).toFixed(0)}%c`}/>
          <Callout {...{x:rotate(thicknessPoint)[0],y:rotate(thicknessPoint)[1]}} labelX={80} labelY={365} label="MAX THICKNESS" value={`${(design.t*100).toFixed(1)}%c / x/c ${thickX.toFixed(3)}`}/>
          <Callout {...{x:rotate([520,240])[0],y:rotate([520,240])[1]}} labelX={545} labelY={375} label="REFERENCE CHORD" value="c = 1.000"/>
        </g>}
      </g>
    </svg>
    <div className="stage-tools micro"><span>{invalid ? "Last valid geometry" : "Drag handles / shift + arrows for coarse"}</span><button className="chip micro" onClick={() => setView({x:0,y:0,scale:1})}>Reset view</button></div>
  </div>;
}
