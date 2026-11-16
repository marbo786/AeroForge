"use client";
import { useReducedPreference } from "./use-reduced-preference";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { model, type Design, type predict } from "../../lib/inference/surrogate";
import { generateGeometry, presetCodes } from "../../lib/geometry/naca4";
import { Module, Readout, Slider, Chip, StatusPill, Scrubber, Drawer } from "./kit";
import { Stage, type Display } from "./stage";
import { ChartPanel, useSweep, type SweepPoint } from "./charts";
import { sharedDesignUrl, views, type WorkspaceView } from "./shared-design";
import { VehicleViewport } from "../inspection/preview";
import type { Draft, Field } from "./studio";
import "./tokens.css";
import "./instrument.css";
import "../inspection/inspection.css";
import "./workspace.css";

type Result = Awaited<ReturnType<typeof predict>> & { key:string; alpha:number };
type SavedDesign = { design: Design; result: Result | null };
type StudioDrawer = "Details" | "Charts" | "Share design" | "Design parameters";
type Dock = "section" | "curves" | "comparison";
const viewLabels: Record<WorkspaceView,string> = {studio:"Studio",airfoil:"Airfoil",analysis:"Analysis"};
const dockLabels: Record<Dock,string> = {section:"Section",curves:"Lift & drag",comparison:"Comparison"};
const sweepHoldMs = 850;
export type InstrumentProps = {
  draft:Draft; design:Design; preset:string; view:WorkspaceView; invalid:boolean; domainError:string;
  onView:(view:WorkspaceView)=>void;
  errors:Partial<Record<Field,string>>; current:Result|null; result:Result|null; status:string; failure:string;
  onChange:(field:Field,value:string)=>void; onReset:()=>void; onPreset:(code:string)=>void;
  onRetry:()=>void;
  onRestore:(design:Design)=>void;
  urlReady: boolean; linkError: boolean; onDismissLinkError: () => void;
};
export function nameOf(design:Design) {
  if([design.m*100,design.p*10,design.t*100].every(v=>Math.abs(v-Math.round(v))<1e-8))return `NACA ${Math.round(design.m*100)}${Math.round(design.p*10)}${Math.round(design.t*100).toString().padStart(2,"0")}`;
  return "Custom section";
}

const compactQuery = "(max-width: 1120px)";
function subscribeCompact(changed:()=>void) {
  const query = matchMedia(compactQuery);
  query.addEventListener("change",changed);
  return () => query.removeEventListener("change",changed);
}

const sectionOutline = (design:Design) => generateGeometry(design).contour.map(([x,y]) => `${x} ${-y}`).join(" ");

function SectionPreview({design,invalid,wing=false,saved}:{design:Design; invalid:boolean; wing?:boolean; saved?:Design}) {
  return <figure className="v2-section-preview">
    <svg role="img" aria-label="Representative NACA section" viewBox={wing ? "-.06 -.17 1.12 .36" : "-.06 -.24 1.12 .48"}>
      <g transform={`rotate(${design.alpha} .25 0)`}>
        <polygon points={sectionOutline(design)}/>
        <path d="M0 0H1"/>
      </g>
      {saved && <polygon className="v2-saved-outline" transform={`rotate(${saved.alpha} .25 0)`}
        points={sectionOutline(saved)} aria-label="Saved section outline"/>}
    </svg>
    <figcaption>{nameOf(design)} · {design.alpha}° · Re {design.re.toLocaleString("en-US")}{invalid ? " · Last valid geometry" : ""}</figcaption>
  </figure>;
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
    <p>This link opens the current workspace view, geometry, angle of attack and Reynolds number.</p>
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
function ExportMenu({design,current,points,loading,invalid,open,onOpen,dataOnly=false}:{
  design:Design;current:Result|null;points:SweepPoint[];loading:boolean;invalid:boolean;
  open:boolean;onOpen:(open:boolean)=>void;dataOnly?:boolean;
}) {
  const [error,setError]=useState("");
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
      onOpen(false);
    } catch {setError("Export failed. Try SVG or JSON.");}
  }
  const formats=dataOnly ? ["csv","json"] : ["svg","png","csv","json"];
  return <div className="export-menu">
    <button className="chip micro" disabled={invalid} aria-expanded={open} onClick={()=>onOpen(!open)}>Export +</button>
    {open && !invalid && <div className="export-options" role="group" aria-label="Export formats">
      <div>{formats.map(format=><button className="chip micro" key={format} disabled={format==="csv"&&!points.length}
        onClick={()=>void save(format)}>{format}</button>)}</div>
      {loading && <span className="micro" role="status">Calculating CSV samples…</span>}
      {!loading && !points.length && <span className="micro">CSV samples unavailable</span>}
    </div>}
    {error&&<span role="alert">{error}</span>}
  </div>;
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
      <p>The model’s Reynolds number range of 100,000 to 500,000 is below typical full-scale Formula 1 front-wing conditions, so its predictions apply only to isolated airfoil sections.</p>
      <p>Evaluation measures agreement with XFOIL. Experimental accuracy, post-stall behavior and calibrated uncertainty remain unverified. Drag errors were higher at low Reynolds numbers, and high-camber sections were harder to predict.</p>
      <p>The model returns dimensionless lift and drag coefficients. The flow display is conceptual. The airfoil outline comes from the analytic NACA geometry.</p>
      <p>The isolated section model excludes 3D vehicle effects, ground effect and interactions between components.</p>
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
  const {design,draft,preset,view,invalid,domainError,current,result,status,failure,errors,onChange,onPreset,onReset,onRetry}=props;
  const [display,setDisplay]=useState<Display>({grid:false,camber:true,chord:true,labels:true,flow:false});
  const [drawer,setDrawer]=useState<StudioDrawer|null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [playing,setPlaying]=useState(false);
  const [saved,setSaved]=useState<SavedDesign|null>(null);
  const [inspectionAngle,setInspectionAngle]=useState<number|null>(null);
  const [exportOpen,setExportOpen]=useState(false);
  const [dock,setDock]=useState<Dock|null>(null);
  const [wingSelected,setWingSelected]=useState(false);
  const [morePresets,setMorePresets]=useState(false);
  const reduced=!!useReducedPreference();
  const latest=useRef(props);latest.current=props;
  const compact = useSyncExternalStore(subscribeCompact,()=>matchMedia(compactQuery).matches,()=>false);
  const dockId = useId();
  const wingTitle = useId();
  const viewHeading = useRef<HTMLHeadingElement>(null);
  const focusAirfoil = useRef(false);
  function inspectWing() {
    setPlaying(false);
    setWingSelected(true);
  }
  const reynolds = model.domain.sampled_reynolds;
  const supportsSweep = (value: Design) => value.re >= reynolds[0] && value.re <= reynolds[reynolds.length - 1];
  const chartsVisible = view === "analysis" || dock === "curves" || drawer === "Charts";
  const currentUnavailable = invalid ? "Correct the current section inputs to calculate its sweep." :
    !supportsSweep(design) ? "Current sweep requires Reynolds number from 100,000 to 500,000." :
    failure ? "Retry the prediction model to calculate the current sweep." : "";
  const savedUnavailable = saved && !supportsSweep(saved.design) ? "Saved Reynolds number is outside the prediction bounds." : "";
  const sweep = useSweep(design, (chartsVisible || exportOpen) && props.urlReady && !currentUnavailable);
  const comparison = useSweep(saved?.design ?? design, chartsVisible && !!saved && !savedUnavailable);
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
    setShareUrl(sharedDesignUrl(window.location.origin, design, view));
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
      if(view!=="airfoil"||event.code!=="Space"||event.repeat||reduced||document.querySelector("dialog[open]")||(event.target instanceof Element&&event.target.closest("input,button,a,select,textarea,[contenteditable=true],[role=slider]")))return;
      event.preventDefault();toggleSweep();
    };window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  },[reduced,toggleSweep,view]);
  const fields=[{key:"m",label:"Maximum camber",unit:"%",min:0,max:6,step:.1},{key:"p",label:"Camber position",unit:"%c",min:20,max:60,step:1},{key:"t",label:"Thickness",unit:"%",min:8,max:18,step:.1},{key:"alpha",label:"Angle of attack",unit:"°",min:-4,max:12,step:.1},{key:"re",label:"Reynolds number",unit:"Re",min:100000,max:1000000,step:1000}] as const;
  const control=(field:typeof fields[number])=><Slider key={field.key} id={field.key} label={field.label} unit={field.unit} min={field.min} max={field.max} step={field.step} value={field.key==="p"&&Number(draft.m)===0?"0":draft[field.key]} disabled={field.key==="p"&&Number(draft.m)===0} error={errors[field.key]} onChange={value=>changeField(field.key,value)}/>;
  function changeMode(next: WorkspaceView) {
    if (next === view) return;
    setPlaying(false);
    setExportOpen(false);
    props.onView(next);
  }
  useEffect(()=>{
    if (view !== "airfoil" || !focusAirfoil.current) return;
    focusAirfoil.current = false;
    viewHeading.current?.focus();
  },[view]);
  function saveDesign() {
    setSaved({design,result:current});
  }
  const cannotSave = !props.urlReady || invalid || pending;
  const parameters = <>
    <div className="v2-panel-heading"><h2>Section inputs</h2><span className="micro">{nameOf(design)}</span></div>
    <div className="v2-parameter-group">
      <label htmlFor="v2-preset">Airfoil preset</label>
      <select id="v2-preset" value={preset} onChange={event=>{setPlaying(false);onPreset(event.target.value);}}>
        <option value="" disabled>Custom section</option>
        {presetCodes.map(code=><option key={code} value={code}>NACA {code}</option>)}
      </select>
      <div className="v2-presets" aria-label="Quick presets">
        {(morePresets ? presetCodes : ["0012", "2412", "4412"]).map(code=>
          <Chip key={code} active={preset===code} onClick={()=>{setPlaying(false);onPreset(code);}}>{code}</Chip>)}
        <Chip active={morePresets} onClick={()=>setMorePresets(!morePresets)}>More</Chip>
      </div>
      {fields.slice(0,3).map(control)}
    </div>
    <div className="v2-parameter-group">
      <h3 className="micro">Flow conditions</h3>
      {fields.slice(3).map(control)}
    </div>
    <button className="chip micro v2-reset" onClick={()=>{setPlaying(false);onReset();}}>Reset</button>
  </>;

  const curves = <ChartPanel sweep={sweep} comparison={comparison} currentUnavailable={currentUnavailable}
    savedUnavailable={savedUnavailable} selected={inspectionAngle ?? design.alpha}
    following={inspectionAngle===null} onInspect={setInspectionAngle}/>;
  const dataExport = <ExportMenu design={design} current={current} points={sweep.points} loading={sweep.loading}
    invalid={!props.urlReady || invalid} open={exportOpen} onOpen={setExportOpen} dataOnly={view==="analysis"}/>;
  const comparisonPanel = saved ? <Comparison design={design} current={current} saved={saved}
    onRestore={()=>props.onRestore(saved.design)} onClear={()=>setSaved(null)}/> :
    <div className="v2-empty-comparison">
      <p>Save the current section to compare it with your next design.</p>
      <button className="chip micro" disabled={cannotSave} onClick={saveDesign}>Save design</button>
    </div>;

  const telemetryPanel = <aside className="v2-telemetry" aria-label="Predicted performance">
    <div className="v2-panel-heading"><h2>Predicted performance</h2><span className="micro">Isolated 2D section</span></div>
    <div className="v2-metrics">
      {([["Lift coefficient","CL","cl",4],["Drag coefficient","CD","cd",5],["Lift to drag","L/D","ratio",2]] as const)
        .map(([label,symbol,key,digits])=><div className="v2-metric" key={key}>
          <div className="v2-metric-label"><span>{label}</span><abbr title={label}>{symbol}</abbr></div>
          <Readout id={key} value={current?.[key]} previous={result?.[key]} pending={pending} sweeping={sweeping && inBounds} digits={digits}/>
        </div>)}
    </div>
    <div className="v2-model">
      <div className="v2-latency"><span>Inference</span><strong data-testid="latency">{latency}</strong></div>
      <p role="status" aria-label="Prediction status">{sweeping && inBounds ? "Alpha sweep playing" : statusText}</p>
      <button className="status-button" onClick={()=>openDrawer("Details")}><StatusPill state={inBounds?"valid":"warning"}>{domainLabel}</StatusPill></button>
      {domainError && !invalid && <p className="v2-warning">{domainError}</p>}
      {inBounds && !model.domain.sampled_reynolds.includes(design.re) && <p className="v2-note">Reynolds interpolation between sampled levels.</p>}
      <button className="chip micro details-button" onClick={()=>openDrawer("Details")}>Details / evidence</button>
      <span className="sr-only" data-testid="applicability">{domainError || "Finite evidence domain. XFOIL agreement on sampled cases. Continuous-domain and experimental accuracy are not established."}
        {!model.domain.sampled_reynolds.includes(design.re)&&" Reynolds interpolation between sampled levels."}</span>
    </div>
  </aside>;
  const analysisTelemetryFirst = compact && view==="analysis";

  return <div className="instrument v2-workspace">
    <header className="v2-header">
      <a href="/" className="v2-brand" aria-label="AeroForge home">
        <svg viewBox="0 0 32 24" width="28" height="24" aria-hidden="true"><path d="M2 18Q9 2 28 17Q16 21 2 18ZM3 18H29" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
        AeroForge
      </a>
      <nav className="v2-modes" aria-label="Workspace views">
        {views.map(mode=><button key={mode} aria-pressed={view===mode} onClick={()=>changeMode(mode)}>
          {viewLabels[mode]}
        </button>)}
      </nav>
      <div className="v2-header-actions">
        <a href="/model/" className="chip micro">Model evidence</a>
        <button className="chip micro" disabled={!props.urlReady || invalid} onClick={openShare}>Share</button>
      </div>
    </header>
    <main className="v2-main">
      <div className="v2-layout">
        {!compact && <aside className="v2-controls" aria-label="Design parameters">{parameters}</aside>}
        <div className="v2-center">
          <div className="v2-view-heading">
            <div><p className="micro">{view==="studio" ? "Vehicle studio" : view==="airfoil" ? "Representative NACA section" : "Isolated 2D section analysis"}</p>
              <h1 ref={viewHeading} tabIndex={-1}>{view==="studio" ? "AF–02" : nameOf(design)}</h1></div>
            {view==="studio" && <div className="v2-car-caption">
              <p>Illustrative car</p>
              <p>Wing pitch is illustrative, not a simulation.</p>
            </div>}
            <button className="chip micro v2-edit" aria-haspopup="dialog"
              onClick={()=>openDrawer("Design parameters")}>Edit parameters</button>
          </div>
          <VehicleViewport active={view==="studio"} initialized={props.urlReady} onAirfoil={()=>changeMode("airfoil")} alpha={design.alpha}
            wing={{selected:wingSelected,onInspect:inspectWing,onReturn:()=>setWingSelected(false)}}/>
          {view==="studio" && wingSelected && <section className="v2-wing-study" aria-labelledby={wingTitle}>
            <div className="v2-wing-copy">
              <div><p className="micro">Representative NACA section</p><h2 id={wingTitle}>Front wing</h2></div>
              <p>Predictions apply to this isolated profile.</p>
              <button type="button" className="chip micro" onClick={()=>{
                focusAirfoil.current = true;
                changeMode("airfoil");
              }}>Open Airfoil editor</button>
            </div>
            <SectionPreview design={design} invalid={invalid} wing/>
          </section>}
          {view==="airfoil" && <>
            <Stage design={design} saved={saved?.design} display={display} invalid={invalid} onChange={changeField}/>
            <div className="v2-airfoil-tools">
              <div className="display-chips" aria-label="Airfoil display">
                {([["grid","Grid"],["camber","Camber line"],["chord","Chord"],["labels","Labels"],["flow","Flow [conceptual]"]] as const)
                  .map(([key,label])=><Chip key={key} active={display[key]} onClick={()=>setDisplay({...display,[key]:!display[key]})}>{label}</Chip>)}
              </div>
              <Scrubber alpha={design.alpha} reduced={reduced} playing={sweeping}
                onPlay={toggleSweep} onChange={alpha=>changeField("alpha",String(alpha))}/>
              <div className="v2-actions">
                <button className="chip micro" onClick={()=>openDrawer("Charts")}>Charts +</button>
                {saved ? <button className="chip micro" onClick={()=>openDrawer("Charts")}>Compare</button> :
                  <button className="chip micro" disabled={cannotSave} onClick={saveDesign}>Save design</button>}
                {dataExport}
              </div>
            </div>
          </>}
          {analysisTelemetryFirst && telemetryPanel}
          {view==="analysis" && <section className="v2-analysis" aria-label="Section analysis">
            <div className="v2-analysis-summary">
              <SectionPreview design={design} invalid={invalid} saved={saved?.design}/>
              <div className="v2-analysis-actions">
                {!saved && <button className="chip micro" disabled={cannotSave} onClick={saveDesign}>Save design</button>}
                {dataExport}
              </div>
            </div>
            {curves}
            {saved && comparisonPanel}
          </section>}
        </div>
        {!analysisTelemetryFirst && telemetryPanel}
      </div>
      {view!=="analysis" && <div className="v2-dock">
        <nav aria-label="Analysis dock">
          {(Object.keys(dockLabels) as Dock[]).map(item=><button key={item} aria-expanded={dock===item} aria-controls={dockId}
            className="chip micro" onClick={()=>setDock(dock===item?null:item)}>{dockLabels[item]}</button>)}
          {dock && <button className="chip micro v2-collapse" onClick={()=>setDock(null)}>Collapse dock</button>}
        </nav>
        <div id={dockId} hidden={!dock} className="v2-dock-content">
          {dock==="section" && <SectionPreview design={design} invalid={invalid} saved={saved?.design}/>}
          {dock==="curves" && drawer!=="Charts" && curves}
          {dock==="comparison" && drawer!=="Charts" && comparisonPanel}
        </div>
      </div>}
    </main>
    {failure && inBounds && <div className="runtime-error" role="alert"><span>{failure}</span><button className="chip micro" onClick={onRetry}>Retry model</button></div>}
    <Drawer open={compact && drawer==="Design parameters"} onClose={()=>setDrawer(null)}
      className="v2-control-sheet" title="Design parameters">{compact && parameters}</Drawer>
    <Drawer open={drawer==="Details"} onClose={()=>setDrawer(null)} title="Details">
      {domainError && !invalid && <p className="chart-message">{domainError}</p>}
      <ModelDetails/>
    </Drawer>
    <Drawer open={drawer==="Charts"} onClose={()=>setDrawer(null)} title="Charts">
      {saved && comparisonPanel}{curves}
    </Drawer>
    <Drawer open={drawer==="Share design"} onClose={()=>setDrawer(null)} title="Share design"><ShareDesign url={shareUrl}/></Drawer>
    {props.linkError && <aside className="link-notice" aria-label="Invalid design link">
      <p role="alert">This design link is invalid. The studio opened with the default design.</p>
      <button className="chip micro" onClick={props.onDismissLinkError}>Dismiss</button>
    </aside>}
  </div>;
}
