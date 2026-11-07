"use client";
import { useEffect, useState } from "react";
import { predict, type Design } from "../../lib/inference/surrogate";

export type SweepPoint = { alpha: number; cl: number; cd: number; ratio: number };
export function useSweep(design: Design, enabled: boolean) {
  const key = JSON.stringify([design.m,design.p,design.t,design.re]);
  const [data,setData] = useState<{key:string; points:SweepPoint[]}>();
  const [error,setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setError("");
    const timer = setTimeout(() => {
      void (async () => {
        const points:SweepPoint[] = [];
        for(let alpha=-4;alpha<=8;alpha+=.5) {
          if(cancelled) return;
          try { const result=await predict({...design,alpha}); points.push({alpha,...result}); }
          catch { if(!cancelled)setError("Sweep unavailable for these conditions."); return; }
          if(points.length%4===0) await new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve()));
        }
        if(!cancelled)setData({key,points});
      })();
    },180);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[key,enabled]);
  return { points:data?.key===key?data.points:[], loading:enabled && data?.key!==key && !error,error };
}

export function Sparkline({ points, field, current }: { points:SweepPoint[];field:"cl"|"cd";current?:{alpha:number;value:number} }) {
  const values=points.map((p)=>p[field]);
  const min=Math.min(...values), max=Math.max(...values);
  const x=(a:number)=>10+(a+4)/16*190;
  const y=(v:number)=>54-(v-min)/(max-min||1)*42;
  return <svg className="sparkline" viewBox="0 0 210 74" role="img" aria-label={`${field.toUpperCase()} versus alpha, real model sweep; predictions withheld above 8 degrees`}>
    <path d="M10 10V54H200M57.5 10V54M105 10V54M152.5 10V54" className="spark-grid"/>
    <rect x="152.5" y="10" width="47.5" height="44" className="missing-region"/>
    {points.length>0 && <path d={`M${points.map((p)=>`${x(p.alpha)},${y(p[field])}`).join(" L")}`} className="spark-line"/>}
    {points.length>0 && current && current.alpha<=8 && <circle cx={x(current.alpha)} cy={y(current.value)} r="2.5" className="spark-point"/>}
    <text x="10" y="70">−4°</text><text x="145" y="70">8°</text><text x="184" y="70">12°</text>
  </svg>;
}

export function ChartPanel({ points, comparison, loading, error }: { points:SweepPoint[];comparison:SweepPoint[];loading:boolean;error:string }) {
  const [hover,setHover]=useState<number|null>(null);
  const charts:[string,keyof SweepPoint,keyof SweepPoint][]=[["Lift / angle of attack","alpha","cl"],["Drag / angle of attack","alpha","cd"],["Drag polar","cd","cl"],["Efficiency / angle of attack","alpha","ratio"]];
  if(error)return <p role="alert">{error}</p>;
  if(!points.length)return <p className="micro">{loading?"Calculating real model sweep…":"Set valid geometry and Reynolds conditions to load the sweep."}</p>;
  return <><div className="chart-legend micro"><span>Current</span>{comparison.length>0&&<span>Saved / dashed</span>}<span className="muted">8–12° withheld</span></div><div className="full-charts">{charts.map(([title,xKey,yKey])=>{
    const both=[...points,...comparison];
    const xMin=xKey==="alpha"?-4:Math.min(...both.map(p=>p[xKey]));
    const xMax=xKey==="alpha"?12:Math.max(...both.map(p=>p[xKey]));
    const yMin=Math.min(0,...both.map(p=>p[yKey])); const yMax=Math.max(...both.map(p=>p[yKey]));
    const x=(v:number)=>48+(v-xMin)/(xMax-xMin||1)*450;
    const y=(v:number)=>216-(v-yMin)/(yMax-yMin||1)*180;
    const path=(rows:SweepPoint[])=>`M${rows.map(p=>`${x(p[xKey])},${y(p[yKey])}`).join(" L")}`;
    const point=hover===null?null:points[hover];
    return <section className="plot" key={title}><h3 className="micro">{title}</h3><svg viewBox="0 0 540 270" role="img" aria-label={title} onPointerMove={(e)=>{const box=e.currentTarget.getBoundingClientRect(); const svgX=(e.clientX-box.left)/box.width*540; let nearest=0;points.forEach((p,i)=>{if(Math.abs(x(p[xKey])-svgX)<Math.abs(x(points[nearest][xKey])-svgX))nearest=i;});setHover(nearest);}} onPointerLeave={()=>setHover(null)}>
      {[0,.25,.5,.75,1].map((fraction)=><g key={fraction}><path d={`M48 ${216-fraction*180}H498`} className="plot-grid"/><text x="40" y={220-fraction*180} textAnchor="end">{(yMin+(yMax-yMin)*fraction).toFixed(yKey==="cd"?3:1)}</text><text x={48+fraction*450} y="238" textAnchor="middle">{(xMin+(xMax-xMin)*fraction).toFixed(xKey==="cd"?3:0)}</text></g>)}
      {xKey==="alpha"&&<rect x={x(8)} y="36" width={x(12)-x(8)} height="180" className="missing-region"/>}
      <path d={path(points)} className="chart-line"/>{comparison.length>0&&<path d={path(comparison)} className="comparison-line"/>}
      {point&&<g><path d={`M${x(point[xKey])} 36V216`} className="hover-line"/><circle cx={x(point[xKey])} cy={y(point[yKey])} r="4" className="spark-point"/><text x="498" y="22" textAnchor="end">α {point.alpha.toFixed(1)}° / {yKey.toUpperCase()} {point[yKey].toFixed(yKey==="cd"?5:3)}</text></g>}
      <text x="275" y="263" textAnchor="middle">{xKey==="alpha"?"Angle of attack (degrees)":"CD (dimensionless)"}</text>
    </svg></section>;
  })}</div><p className="drawer-caveat">Real surrogate outputs, not CFD or experimental measurements. Missing predictions are not interpolated. Hover a curve to inspect coefficients.</p></>;
}
