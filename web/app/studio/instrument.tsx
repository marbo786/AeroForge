"use client";
import { useReducedPreference } from "./use-reduced-preference";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { model, type Design, type predict } from "../../lib/inference/surrogate";
import { presetCodes } from "../../lib/geometry/naca4";
import { Module, Readout, Slider, Chip, StatusPill, Scrubber, Drawer } from "./kit";
import { Stage, type Display } from "./stage";
import { ChartPanel, Sparkline, useSweep, type SweepPoint } from "./charts";
import type { Draft, Field } from "./studio";
import "./tokens.css";
import "./instrument.css";

type Result = Awaited<ReturnType<typeof predict>> & { key:string };
export type InstrumentProps = {
  draft:Draft; design:Design; preset:string; expanded:boolean; invalid:boolean; domainError:string;
  errors:Partial<Record<Field,string>>; current:Result|null; result:Result|null; status:string; failure:string;
  onChange:(field:Field,value:string)=>void; onReset:()=>void; onPreset:(code:string)=>void;
  onExpanded:(value:boolean)=>void; onRetry:()=>void;
  onRestore:(design:Design)=>void;
};
export function nameOf(design:Design) {
  if([design.m*100,design.p*10,design.t*100].every(v=>Math.abs(v-Math.round(v))<1e-8))return `NACA ${Math.round(design.m*100)}${Math.round(design.p*10)}${Math.round(design.t*100).toString().padStart(2,"0")}`;
  return "Custom section";
}
function download(blob:Blob,name:string) {
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function svgSnapshot() {
  const original=document.querySelector<SVGSVGElement>(".airfoil-svg");
  if(!original)throw new Error("Section drawing unavailable.");
  const clone=original.cloneNode(true) as SVGSVGElement;
  const source=[original,...original.querySelectorAll("*")]; const copy=[clone,...clone.querySelectorAll("*")];
  source.forEach((node,i)=>{const style=getComputedStyle(node);copy[i].setAttribute("style",["fill","stroke","stroke-width","stroke-dasharray","opacity","font-family","font-size","font-weight","letter-spacing"].map(key=>`${key}:${style.getPropertyValue(key)}`).join(";"));});
  clone.querySelectorAll(".geometry-handle,.exact-contour").forEach(node=>node.remove());
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");clone.setAttribute("width","1600");clone.setAttribute("height","960");
  return new XMLSerializer().serializeToString(clone);
}
function ExportMenu({design,current,points}:{design:Design;current:Result|null;points:SweepPoint[]}) {
  const [open,setOpen]=useState(false),[error,setError]=useState("");
  async function save(format:string) {
    setError(""); const name=nameOf(design).toLowerCase().replaceAll(" ","-");
    try {
      if(format==="json")download(new Blob([JSON.stringify({design,model:model.version,coefficients:current?{cl:current.cl,cd:current.cd,ratio:current.ratio}:null,limitation:model.domain.warning},null,2)],{type:"application/json"}),`${name}.json`);
      if(format==="csv")download(new Blob(["alpha_deg,CL,CD,L_D\n"+points.map(p=>[p.alpha,p.cl,p.cd,p.ratio].join(",")).join("\n")],{type:"text/csv"}),`${name}.csv`);
      if(format==="svg")download(new Blob([svgSnapshot()],{type:"image/svg+xml"}),`${name}.svg`);
      if(format==="png") {
        const url=URL.createObjectURL(new Blob([svgSnapshot()],{type:"image/svg+xml"}));
        try { const image=new Image();image.src=url;await image.decode();const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=960;const context=canvas.getContext("2d");if(!context)throw new Error();context.fillStyle="#ecebe7";context.fillRect(0,0,1600,960);context.drawImage(image,0,0,1600,960);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));if(!blob)throw new Error();download(blob,`${name}.png`); }
        finally {URL.revokeObjectURL(url);}
      }
      setOpen(false);
    } catch {setError("Export failed. Try SVG or JSON.");}
  }
  return <div className="export-menu"><button className="chip micro" aria-expanded={open} onClick={()=>setOpen(!open)}>Export +</button>{open&&<div className="export-options" aria-label="Export formats">{["svg","png","csv","json"].map(format=><button className="chip micro" key={format} disabled={format==="csv"&&!points.length} onClick={()=>void save(format)}>{format}</button>)}</div>}{error&&<span role="alert">{error}</span>}</div>;
}

export function ModelDetails() {
  return <div className="model-details"><Module number="01" title="Evidence envelope"><div className="detail-grid"><span>Geometry m / p / t</span><strong>0–6 / 20–60 / 8–18 %c</strong><span>Angle of attack</span><strong>−4 to 8°</strong><span>Reynolds samples</span><strong>100k / 250k / 500k</strong></div><p>The status “In domain” means inside these input bounds only. Accuracy has been tested on a finite panel, not every combination. Intermediate Reynolds values are interpolation.</p></Module><Module number="02" title="Scientific limitations"><p>{model.domain.warning}</p><p>Low-Reynolds drag and high-camber cases are harder. No calibrated uncertainty, post-stall prediction, experimental validation or Reynolds support above 500,000 is claimed. Original coefficients are dimensionless. Geometry is analytic NACA, not a predicted flow field.</p></Module><Module number="03" title="Model provenance"><div className="detail-grid"><span>Version</span><strong>{model.version}</strong><span>Label source</span><strong>XFOIL 6.99 / viscous / Mach 0</strong><span>Final panel</span><strong>165 cases / 8 unseen geometries</strong><span>CL / CD MAE</span><strong>0.01484 / 0.000683</strong><span>Execution</span><strong>Local / one-thread WASM</strong></div><p>Latency measures model execution only, excluding initial model/runtime download. First execution can include warm-up overhead. The graph embeds all trained transforms; no server inference is used.</p></Module><div className="details-links"><a className="chip micro" href="/model/">Full model evidence</a><a className="chip micro" href="https://github.com/marbo786/AeroForge">Repository</a><a className="chip micro" href="/spike/">Open inference test</a></div></div>;
}

export default function Instrument(props:InstrumentProps) {
  const {design,draft,preset,expanded,invalid,domainError,current,result,status,failure,errors,onChange,onPreset,onReset,onExpanded,onRetry}=props;
  const [display,setDisplay]=useState<Display>({grid:false,camber:true,chord:true,labels:true,flow:false});
  const [drawer,setDrawer]=useState<"Details"|"Charts"|null>(null);
  const [playing,setPlaying]=useState(false);
  const [saved,setSaved]=useState<Design|null>(null);
  const [sheet,setSheet]=useState<"peek"|"half"|"full">("peek");
  const [morePresets,setMorePresets]=useState(false);
  const reduced=!!useReducedPreference();
  const latest=useRef(props);latest.current=props;
  const sheetStart=useRef(0);
  const sweep=useSweep(design,!!result);
  const comparison=useSweep(saved||design,!!saved&&!!result);
  const inBounds=!invalid&&!domainError;
  const pending=inBounds&&!current&&!failure;
  const domainLabel=invalid?"Invalid input":domainError?"Out of domain":"In domain";
  const statusText=invalid?"Check parameters":domainError?"Outside model bounds":current?"Prediction ready":status;
  useEffect(()=>{
    if(!playing||reduced)return;
    let frame=0,previous=0;
    function tick(now:number) {
      if(document.hidden){setPlaying(false);return;}
      if(now-previous>=140){previous=now;const alpha=latest.current.design.alpha;if(alpha>=12){setPlaying(false);return;}latest.current.onChange("alpha",String(Math.min(12,Number((alpha+.2).toFixed(1)))));}
      frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing,reduced]);
  useEffect(()=>{
    const key=(event:globalThis.KeyboardEvent)=>{
      if(event.code!=="Space"||reduced||document.querySelector("dialog[open]")||(event.target instanceof HTMLElement&&event.target.closest("input,button,select,textarea,[contenteditable=true]")))return;
      event.preventDefault();setPlaying(value=>!value);
    };window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  },[reduced]);
  const fields=[{key:"m",label:"Maximum camber",unit:"%",min:0,max:6,step:.1},{key:"p",label:"Camber position",unit:"%c",min:20,max:60,step:1},{key:"t",label:"Thickness",unit:"%",min:8,max:18,step:.1},{key:"alpha",label:"Angle of attack",unit:"°",min:-4,max:12,step:.1},{key:"re",label:"Reynolds number",unit:"Re",min:100000,max:1000000,step:1000}] as const;
  const control=(field:typeof fields[number])=><Slider key={field.key} id={field.key} label={field.label} unit={field.unit} min={field.min} max={field.max} step={field.step} value={field.key==="p"&&Number(draft.m)===0?"0":draft[field.key]} disabled={field.key==="p"&&Number(draft.m)===0} error={errors[field.key]} onChange={value=>onChange(field.key,value)}/>;
  function toggleSheet(){const next=!expanded;onExpanded(next);setSheet(next?"half":"peek");}
  const size=sheet==="peek"?"78px":sheet==="half"?"50dvh":"72dvh";
  return <div className="instrument" style={{"--sheet-height":size} as CSSProperties}>
    <header className="instrument-topbar"><a href="/" className="logo-tile" aria-label="AeroForge home"><svg viewBox="0 0 32 24" width="28" height="24" aria-hidden="true"><path d="M2 18Q9 2 28 17Q16 21 2 18ZM3 18H29" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg><span className="micro">AF—01</span></a><div className="project-title"><span className="micro muted">AeroForge / aerodynamic design studio</span><h1 className="display">{nameOf(design)} <span>/</span></h1><span className="micro muted">Design. Simulate. Optimize.</span></div><div className="top-status"><div><span className="micro muted">Model status</span><span className="micro">{statusText}</span></div><div><span className="micro muted">Domain status</span><button className="status-button" onClick={()=>setDrawer("Details")} title="Input bounds only; finite XFOIL evidence, not experimental validation"><StatusPill state={inBounds?"valid":"warning"}>{domainLabel}</StatusPill></button></div><div><span className="micro muted">Inference ms</span><strong data-testid="latency">{current?`${current.durationMs.toFixed(2)} ms`:"—"}</strong></div></div></header>
    <span className="sr-only" role="status">{statusText}</span><main className="instrument-workspace">
      <aside className="readout-column" aria-label="Predicted performance"><Module number="01" title="Lift CL"><Readout id="cl" value={current?.cl} previous={result?.cl} pending={pending} digits={4}><Sparkline points={sweep.points} field="cl" current={current?{alpha:design.alpha,value:current.cl}:undefined}/></Readout></Module><Module number="02" title="Drag CD"><Readout id="cd" value={current?.cd} previous={result?.cd} pending={pending} digits={5}><Sparkline points={sweep.points} field="cd" current={current?{alpha:design.alpha,value:current.cd}:undefined}/></Readout></Module><Module number="03" title="Efficiency L/D"><Readout id="ratio" value={current?.ratio} previous={result?.ratio} pending={pending} digits={2}/><div className="ratio-meter" title="L/D magnitude on a fixed 0–100 display scale"><span style={{width:`${Math.min(100,Math.abs(current?.ratio||0))}%`}}/></div><div className="meter-labels micro"><span>0</span><span>|L/D| / 100</span></div></Module></aside>
      <div className="hero-column"><Stage design={design} display={display} invalid={invalid} onChange={(field,value)=>onChange(field as Field,value)}/><div className="hero-state"><span className="micro muted">Section geometry / {invalid?"last valid":"live study"}</span><h2 className="display">{nameOf(design)}</h2><div className="micro hero-caption">Alpha {design.alpha.toFixed(1)}° / Re {(design.re/1000).toFixed(0)}k / <button onClick={()=>setDrawer("Details")} className="domain-inline">{domainLabel}</button></div></div><div className="preset-row"><span className="micro muted">Presets</span>{(morePresets?presetCodes:["0012","2412","4412"]).map(code=><Chip key={code} active={preset===code} onClick={()=>onPreset(code)}>{code}</Chip>)}<Chip onClick={()=>setMorePresets(!morePresets)} active={morePresets}>More</Chip>{saved&&<Chip onClick={()=>props.onRestore(saved)}>Saved</Chip>}<button className="chip micro" onClick={()=>setSaved({...design})}>Save design</button></div><div className="hero-dock"><Scrubber alpha={design.alpha} reduced={reduced} playing={playing&&!reduced} onPlay={()=>setPlaying(!playing)} onChange={alpha=>{setPlaying(false);onChange("alpha",String(alpha));}}/><div className="dock-actions"><button className="chip micro" onClick={()=>setDrawer("Charts")}>Charts +</button><ExportMenu design={design} current={current} points={sweep.points}/><button className="chip micro" onClick={onReset}>Reset</button><span className="micro muted">2D / equal axis scale</span></div></div></div>
      <aside className={`control-column sheet-${sheet} ${expanded?"is-expanded":""}`} aria-label="Design parameters"><div className="sheet-grab" onPointerDown={event=>{sheetStart.current=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={event=>{const delta=event.clientY-sheetStart.current;if(Math.abs(delta)>25){const next=delta<0?(sheet==="peek"?"half":"full"):(sheet==="full"?"half":"peek");setSheet(next);onExpanded(next!=="peek");}}}><span/></div><button className="sheet-toggle micro" aria-expanded={expanded} aria-controls="parameter-controls" onClick={toggleSheet}>{expanded?"Hide parameters":"Edit parameters"}<span aria-hidden="true">{expanded?"−":"+"}</span></button><div className="sheet-snaps">{["peek","half","full"].map(snap=><button key={snap} className={`micro ${sheet===snap?"selected":""}`} onClick={()=>{setSheet(snap as typeof sheet);onExpanded(snap!=="peek");}}>{snap}</button>)}</div><div id="parameter-controls" className="parameter-controls"><Module number="04" title="Geometry">{fields.slice(0,3).map(control)}</Module><Module number="05" title="Flow conditions">{fields.slice(3).map(control)}</Module><Module number="06" title="Display"><div className="display-chips">{([ ["grid","Grid"],["camber","Camber line"],["chord","Chord"],["labels","Labels"],["flow","Flow [conceptual]"] ] as const).map(([key,label])=><Chip key={key} active={display[key]} onClick={()=>setDisplay({...display,[key]:!display[key]})}>{label}</Chip>)}</div></Module><Module number="07" title="Model"><button className="status-button" onClick={()=>setDrawer("Details")}><StatusPill state={inBounds?"valid":"warning"}>{domainLabel}</StatusPill></button><div className="model-mini micro"><span>{model.version}</span><span>{current?`${current.durationMs.toFixed(2)} ms`:"—"}</span></div><button className="chip micro details-button" onClick={()=>setDrawer("Details")}>Details / evidence</button><span className="sr-only" data-testid="applicability">{domainError||"Finite evidence domain. XFOIL agreement on sampled cases. Continuous-domain and experimental accuracy are not established."}{!model.domain.sampled_reynolds.includes(design.re)&&" Reynolds interpolation between sampled levels."}</span></Module></div></aside>
    </main>
    {failure&&inBounds&&<div className="runtime-error" role="alert"><span>{failure}</span><button className="chip micro" onClick={onRetry}>Retry model</button></div>}
    <Drawer open={drawer==="Details"} onClose={()=>setDrawer(null)} title="Details"><ModelDetails/></Drawer><Drawer open={drawer==="Charts"} onClose={()=>setDrawer(null)} title="Charts"><ChartPanel points={sweep.points} comparison={comparison.points} loading={sweep.loading} error={sweep.error}/>{saved&&<button className="chip micro" onClick={()=>setSaved(null)}>Clear saved comparison</button>}</Drawer>
  </div>;
}
