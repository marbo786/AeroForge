"use client";
import { useReducedPreference } from "./use-reduced-preference";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { model, type Design, type predict } from "../../lib/inference/surrogate";
import { presetCodes } from "../../lib/geometry/naca4";
import { Module, Readout, Slider, Chip, StatusPill, Scrubber, Drawer } from "./kit";
import { Stage, type Display } from "./stage";
import { ChartPanel, Sparkline, useSweep, type SweepPoint } from "./charts";
import { sharedDesignUrl } from "./shared-design";
import type { Draft, Field } from "./studio";
import "./tokens.css";
import "./instrument.css";

type Result = Awaited<ReturnType<typeof predict>> & { key:string; alpha:number };
type SavedDesign = { design: Design; result: Result | null };
type StudioDrawer = "Details" | "Charts" | "Share design";
const sweepHoldMs = 850;
export type InstrumentProps = {
  draft:Draft; design:Design; preset:string; expanded:boolean; invalid:boolean; domainError:string;
  errors:Partial<Record<Field,string>>; current:Result|null; result:Result|null; status:string; failure:string;
  onChange:(field:Field,value:string)=>void; onReset:()=>void; onPreset:(code:string)=>void;
  onExpanded:(value:boolean)=>void; onRetry:()=>void;
  onRestore:(design:Design)=>void;
  urlReady: boolean; linkError: boolean; onDismissLinkError: () => void;
};
export function nameOf(design:Design) {
  if([design.m*100,design.p*10,design.t*100].every(v=>Math.abs(v-Math.round(v))<1e-8))return `NACA ${Math.round(design.m*100)}${Math.round(design.p*10)}${Math.round(design.t*100).toString().padStart(2,"0")}`;
  return "Custom section";
}

function ShareDesign({ url }: { url: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Link copied.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setFeedback("Link selected. Use your device’s copy command.");
    }
  }
  return <div className="share-design">
    <p>Anyone with this link can open the current geometry, angle of attack and Reynolds number.</p>
    <label className="micro" htmlFor="share-url">Design URL</label>
    <input id="share-url" ref={input} value={url} readOnly onFocus={event => event.currentTarget.select()}/>
    <div className="comparison-actions">
      <button className="chip micro active" onClick={() => void copy()}>Copy link</button>
      <span role="status">{feedback}</span>
    </div>
  </div>;
}

function Comparison({ design, current, saved, onRestore, onClear }: {
  design: Design; current: Result | null; saved: SavedDesign; onRestore: () => void; onClear: () => void;
}) {
  const describe = (value: Design) => `${value.alpha}° / Re ${value.re.toLocaleString("en-US")}`;
  return <section className="comparison-panel" aria-label="Operating point comparison">
    <h3 className="micro">Operating point comparison</h3>
    <table>
      <thead><tr><th scope="col">Coefficient</th><th scope="col">Current</th><th scope="col">Saved</th></tr></thead>
      <tbody>
        <tr><th scope="row">Design</th><td>{nameOf(design)}</td><td>{nameOf(saved.design)}</td></tr>
        <tr><th scope="row">Condition</th><td>{describe(design)}</td><td>{describe(saved.design)}</td></tr>
        {([["CL", "cl", 4], ["CD", "cd", 5], ["L/D", "ratio", 2]] as const).map(([label, key, digits]) =>
          <tr key={key}><th scope="row">{label}</th><td>{current?.[key].toFixed(digits) ?? "—"}</td><td>{saved.result?.[key].toFixed(digits) ?? "—"}</td></tr>
        )}
      </tbody>
    </table>
    <div className="comparison-actions">
      <button className="chip micro" onClick={onRestore}>Restore saved design</button>
      <button className="chip micro" onClick={onClear}>Clear saved comparison</button>
    </div>
  </section>;
}
function download(blob:Blob,name:string) {
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const imageWidth = 1600;
const imageHeight = 700;

function svgSnapshot() {
  const original=document.querySelector<SVGSVGElement>(".airfoil-svg");
  if(!original)throw new Error("Section drawing unavailable.");
  const clone=original.cloneNode(true) as SVGSVGElement;
  const source=[original,...original.querySelectorAll("*")]; const copy=[clone,...clone.querySelectorAll("*")];
  source.forEach((node,i)=>{const style=getComputedStyle(node);copy[i].setAttribute("style",["display","fill","stroke","stroke-width","stroke-dasharray","opacity","font-family","font-size","font-weight","letter-spacing"].map(key=>`${key}:${style.getPropertyValue(key)}`).join(";"));});
  clone.querySelectorAll(".geometry-handle,.exact-contour").forEach(node=>node.remove());
  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  const bounds = original.viewBox.baseVal;
  for (const key of ["x", "y", "width", "height"] as const) background.setAttribute(key, String(bounds[key]));
  background.setAttribute("fill", getComputedStyle(original).getPropertyValue("--workspace").trim());
  clone.prepend(background);
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(imageWidth));
  clone.setAttribute("height", String(imageHeight));
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
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = imageWidth;
          canvas.height = imageHeight;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          context.drawImage(image, 0, 0);
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
          if (!blob) throw new Error("Image encoding failed");
          download(blob, `${name}.png`);
        }
        finally {URL.revokeObjectURL(url);}
      }
      setOpen(false);
    } catch {setError("Export failed. Try SVG or JSON.");}
  }
  return <div className="export-menu"><button className="chip micro" aria-expanded={open} onClick={()=>setOpen(!open)}>Export +</button>{open&&<div className="export-options" aria-label="Export formats">{["svg","png","csv","json"].map(format=><button className="chip micro" key={format} disabled={format==="csv"&&!points.length} onClick={()=>void save(format)}>{format}</button>)}</div>}{error&&<span role="alert">{error}</span>}</div>;
}

export function ModelDetails() {
  return <div className="model-details">
    <Module number="01" title="Prediction bounds">
      <div className="detail-grid">
        <span>Camber / position / thickness</span><strong>0–6% / 20–60% / 8–18% chord</strong>
        <span>Angle of attack</span><strong>−4° to 8°</strong>
        <span>Reynolds number</span><strong>100,000–500,000</strong>
        <span>Sampled Reynolds numbers</span><strong>100,000 / 250,000 / 500,000</strong>
      </div>
      <p>Symmetric sections use canonical camber position zero. Intermediate Reynolds numbers are interpolations. The “In domain” status checks input bounds. Evaluation covers a finite panel of conditions.</p>
    </Module>
    <Module number="02" title="Scientific limitations">
      <p>Evaluation measures agreement with XFOIL. Experimental accuracy, post-stall behavior and calibrated uncertainty remain unverified. Drag errors were higher at low Reynolds numbers, and high-camber sections were harder to predict.</p>
      <p>The model returns dimensionless lift and drag coefficients. The flow display is conceptual. The airfoil outline comes from the analytic NACA geometry.</p>
    </Module>
    <Module number="03" title="Model provenance">
      <div className="detail-grid">
        <span>Version</span><strong>{model.version}</strong>
        <span>Architecture</span><strong>Separate lift and drag neural networks</strong>
        <span>Label source</span><strong>XFOIL 6.99 / viscous / Mach 0</strong>
        <span>Independent evaluation</span><strong>165 cases / 8 unseen geometries</strong>
        <span>CL / CD mean absolute error</span><strong>0.01484 / 0.000683</strong>
        <span>Execution</span><strong>Local ONNX / one-thread WASM</strong>
      </div>
      <p>The graph embeds the fitted input transforms and output inversions. The latency readout includes the ONNX run and worker communication. The first run can take longer.</p>
    </Module>
    <div className="details-links">
      <a className="chip micro" href="/model/">Full model evidence</a>
      <a className="chip micro" href="https://github.com/marbo786/AeroForge">Repository</a>
      <a className="chip micro" href="/spike/">Open inference test</a>
    </div>
  </div>;
}

export default function Instrument(props:InstrumentProps) {
  const {design,draft,preset,expanded,invalid,domainError,current,result,status,failure,errors,onChange,onPreset,onReset,onExpanded,onRetry}=props;
  const [display,setDisplay]=useState<Display>({grid:false,camber:true,chord:true,labels:true,flow:false});
  const [drawer,setDrawer]=useState<StudioDrawer|null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [playing,setPlaying]=useState(false);
  const [saved,setSaved]=useState<SavedDesign|null>(null);
  const [sheet,setSheet]=useState<"peek"|"half"|"full">("peek");
  const [morePresets,setMorePresets]=useState(false);
  const reduced=!!useReducedPreference();
  const latest=useRef(props);latest.current=props;
  const sheetStart=useRef(0);
  const reynolds = model.domain.sampled_reynolds;
  const supportsSweep = (value: Design) => value.re >= reynolds[0] && value.re <= reynolds[reynolds.length - 1];
  const sweep = useSweep(design, props.urlReady && !invalid && !failure && supportsSweep(design) && (!!result || !!domainError));
  const comparison = useSweep(saved?.design ?? design, !!saved && supportsSweep(saved.design));
  const inBounds=!invalid&&!domainError;
  const pending=inBounds&&!current&&!failure;
  const domainLabel=invalid?"Invalid input":domainError?"Out of domain":"In domain";
  const statusText=invalid?"Check parameters":domainError?"Outside model bounds":current?"Prediction ready":pending&&status==="Prediction ready"?"Loading / calculating":status;
  const sweeping = playing && !reduced && !invalid && !failure;
  // Hold the last complete prediction and its chart markers together between sweep samples.
  const telemetry = current ?? (sweeping && pending ? result : null);
  const latency = telemetry ? `${telemetry.durationMs.toFixed(2)} ms` : "—";
  function changeField(field: Field, value: string) {
    setPlaying(false);
    onChange(field, value);
  }
  function openDrawer(next: StudioDrawer) {
    setPlaying(false);
    setDrawer(next);
  }
  function openShare() {
    setShareUrl(sharedDesignUrl(window.location.origin, design));
    openDrawer("Share design");
  }
  const toggleSweep = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const inputs = latest.current;
    if (reduced || !inputs.urlReady || inputs.invalid || inputs.failure) return;
    if (inputs.design.alpha >= 12) inputs.onChange("alpha", "-4");
    setPlaying(true);
  }, [playing, reduced]);
  useEffect(() => {
    // Give each completed prediction its full reading time, even on slow devices.
    if (!sweeping || pending) return;
    const timer = window.setTimeout(() => {
      const next = Math.min(12, Number((design.alpha + .5).toFixed(1)));
      latest.current.onChange("alpha", String(next));
      if (next === 12) setPlaying(false);
    }, sweepHoldMs);
    return () => window.clearTimeout(timer);
  }, [sweeping, pending, design.alpha]);
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);
  useEffect(()=>{
    const key=(event:globalThis.KeyboardEvent)=>{
      if(event.code!=="Space"||event.repeat||reduced||document.querySelector("dialog[open]")||(event.target instanceof Element&&event.target.closest("input,button,a,select,textarea,[contenteditable=true],[role=slider]")))return;
      event.preventDefault();toggleSweep();
    };window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  },[reduced,toggleSweep]);
  const fields=[{key:"m",label:"Maximum camber",unit:"%",min:0,max:6,step:.1},{key:"p",label:"Camber position",unit:"%c",min:20,max:60,step:1},{key:"t",label:"Thickness",unit:"%",min:8,max:18,step:.1},{key:"alpha",label:"Angle of attack",unit:"°",min:-4,max:12,step:.1},{key:"re",label:"Reynolds number",unit:"Re",min:100000,max:1000000,step:1000}] as const;
  const control=(field:typeof fields[number])=><Slider key={field.key} id={field.key} label={field.label} unit={field.unit} min={field.min} max={field.max} step={field.step} value={field.key==="p"&&Number(draft.m)===0?"0":draft[field.key]} disabled={field.key==="p"&&Number(draft.m)===0} error={errors[field.key]} onChange={value=>changeField(field.key,value)}/>;
  function toggleSheet(){const next=!expanded;onExpanded(next);setSheet(next?"half":"peek");}
  const size=sheet==="peek"?"78px":sheet==="half"?"50dvh":"72dvh";
  return <div className="instrument" style={{"--sheet-height":size} as CSSProperties}>
    <header className="instrument-topbar studio-topbar">
      <a href="/" className="logo-tile" aria-label="AF—01 AeroForge home"><svg viewBox="0 0 32 24" width="28" height="24" aria-hidden="true"><path d="M2 18Q9 2 28 17Q16 21 2 18ZM3 18H29" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg><span className="micro">AF—01</span></a>
      <div className="project-title"><span className="micro muted">AeroForge / design studio</span><h1 className="display">{nameOf(design)} <span>/</span></h1></div>
      <div className="header-latency"><span className="micro muted">Inference</span><strong data-testid="latency">{latency}</strong></div>
    </header>
    <span className="sr-only" role="status">{sweeping && inBounds ? "Alpha sweep playing" : statusText}</span>
    <main className="instrument-workspace">
      <aside className="readout-column" aria-label="Predicted performance">
        <Module number="01" title="Lift CL">
          <Readout id="cl" value={current?.cl} previous={result?.cl} pending={pending} sweeping={sweeping && inBounds} digits={4}>
            <Sparkline points={sweep.points} field="cl" current={telemetry ? {alpha:telemetry.alpha,value:telemetry.cl} : undefined}/>
          </Readout>
        </Module>
        <Module number="02" title="Drag CD">
          <Readout id="cd" value={current?.cd} previous={result?.cd} pending={pending} sweeping={sweeping && inBounds} digits={5}>
            <Sparkline points={sweep.points} field="cd" current={telemetry ? {alpha:telemetry.alpha,value:telemetry.cd} : undefined}/>
          </Readout>
        </Module>
        <Module number="03" title="Efficiency L/D">
          <Readout id="ratio" value={current?.ratio} previous={result?.ratio} pending={pending} sweeping={sweeping && inBounds} digits={2}/>
          <div className="ratio-meter" title="L/D magnitude on a fixed 0–100 display scale"><span style={{width:`${Math.min(100,Math.abs(telemetry?.ratio || 0))}%`}}/></div>
          <div className="meter-labels micro"><span>0</span><span>|L/D| / 100</span></div>
        </Module>
      </aside>
      <div className="hero-column">
        <Stage design={design} saved={saved?.design} display={display} invalid={invalid} onChange={changeField}/>
        <div className="hero-state">
          <span className="micro muted">Section geometry / {invalid ? "last valid" : "live study"}</span>
          <h2 className="display">{nameOf(design)}</h2>
          <div className="micro hero-caption">
            Alpha {design.alpha.toFixed(1)}° / Re {(design.re / 1000).toFixed(0)}k /{" "}
            <button onClick={() => openDrawer("Details")} className="domain-inline">{domainLabel}</button>
          </div>
        </div>
        <div className="preset-row">
          <span className="micro muted">Presets</span>
          {(morePresets ? presetCodes : ["0012", "2412", "4412"]).map(code =>
            <Chip key={code} active={preset === code} onClick={() => { setPlaying(false); onPreset(code); }}>{code}</Chip>
          )}
          <Chip onClick={() => setMorePresets(!morePresets)} active={morePresets}>More</Chip>
          {saved
            ? <button className="chip micro active" onClick={() => openDrawer("Charts")}>Compare</button>
            : <button className="chip micro" disabled={!props.urlReady || invalid || pending}
                onClick={() => setSaved({ design, result: current })}>Save design</button>}
        </div>
        <div className="hero-dock">
          <Scrubber alpha={design.alpha} reduced={reduced} playing={sweeping}
            onPlay={toggleSweep} onChange={alpha => changeField("alpha", String(alpha))}/>
          <div className="dock-actions">
            <button className="chip micro" onClick={() => openDrawer("Charts")}>Charts +</button>
            <ExportMenu design={design} current={current} points={sweep.points}/>
            <button className="chip micro" onClick={() => { setPlaying(false); onReset(); }}>Reset</button>
            <button className="chip micro share-action" disabled={!props.urlReady || invalid} onClick={openShare}>Share</button>
            <span className="micro muted">2D / equal axis scale</span>
          </div>
        </div>
      </div>
      <aside className={`control-column sheet-${sheet} ${expanded?"is-expanded":""}`} aria-label="Design parameters"><div className="sheet-grab" onPointerDown={event=>{sheetStart.current=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={event=>{const delta=event.clientY-sheetStart.current;if(Math.abs(delta)>25){const next=delta<0?(sheet==="peek"?"half":"full"):(sheet==="full"?"half":"peek");setSheet(next);onExpanded(next!=="peek");}}}><span/></div><button className="sheet-toggle micro" aria-expanded={expanded} aria-controls="parameter-controls" onClick={toggleSheet}>{expanded?"Hide parameters":"Edit parameters"}<span aria-hidden="true">{expanded?"−":"+"}</span></button><div className="sheet-snaps">{["peek","half","full"].map(snap=><button key={snap} className={`micro ${sheet===snap?"selected":""}`} onClick={()=>{setSheet(snap as typeof sheet);onExpanded(snap!=="peek");}}>{snap}</button>)}</div><div id="parameter-controls" className="parameter-controls"><Module number="04" title="Geometry">{fields.slice(0,3).map(control)}</Module><Module number="05" title="Flow conditions">{fields.slice(3).map(control)}</Module><Module number="06" title="Display"><div className="display-chips">{([ ["grid","Grid"],["camber","Camber line"],["chord","Chord"],["labels","Labels"],["flow","Flow [conceptual]"] ] as const).map(([key,label])=><Chip key={key} active={display[key]} onClick={()=>setDisplay({...display,[key]:!display[key]})}>{label}</Chip>)}</div></Module><Module number="07" title="Model"><button className="status-button" onClick={()=>setDrawer("Details")}><StatusPill state={inBounds?"valid":"warning"}>{domainLabel}</StatusPill></button><div className="model-mini micro"><span>{model.version}</span><span>{current?`${current.durationMs.toFixed(2)} ms`:"—"}</span></div><button className="chip micro details-button" onClick={()=>setDrawer("Details")}>Details / evidence</button><span className="sr-only" data-testid="applicability">{domainError||"Finite evidence domain. XFOIL agreement on sampled cases. Continuous-domain and experimental accuracy are not established."}{!model.domain.sampled_reynolds.includes(design.re)&&" Reynolds interpolation between sampled levels."}</span></Module></div></aside>
    </main>
    {failure&&inBounds&&<div className="runtime-error" role="alert"><span>{failure}</span><button className="chip micro" onClick={onRetry}>Retry model</button></div>}
    <Drawer open={drawer === "Details"} onClose={() => setDrawer(null)} title="Details">
      {domainError && !invalid && <p className="chart-message">{domainError}</p>}
      <ModelDetails/>
    </Drawer>
    <Drawer open={drawer === "Charts"} onClose={() => setDrawer(null)} title="Charts">
      {saved && <Comparison design={design} current={current} saved={saved}
        onRestore={() => props.onRestore(saved.design)} onClear={() => setSaved(null)}/>}
      <ChartPanel sweep={failure ? { ...sweep, error: failure } : sweep} comparison={comparison} comparing={!!saved} alpha={design.alpha}/>
    </Drawer>
    <Drawer open={drawer === "Share design"} onClose={() => setDrawer(null)} title="Share design">
      <ShareDesign url={shareUrl}/>
    </Drawer>
    {props.linkError && <aside className="link-notice" aria-label="Invalid design link">
      <p role="alert">This design link is invalid. The studio opened with the default design.</p>
      <button className="chip micro" onClick={props.onDismissLinkError}>Dismiss</button>
    </aside>}
  </div>;
}
