"use client";
import { useReducedPreference } from "./use-reduced-preference";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useSpring } from "motion/react";

export function Module({ number, title, children, className = "" }: { number: string; title: string; children: ReactNode; className?: string }) {
  const reduced = useReducedPreference();
  return <motion.section className={`module ${className}`} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25, delay: Number(number) * .025 }} aria-label={title}>
    <h2 className="module-title micro"><span>{title}</span><span className="muted">{number}</span></h2>{children}
  </motion.section>;
}

function SpringNumber({ value, digits }: { value: number; digits: number }) {
  const reduced = useReducedPreference();
  const spring = useSpring(value, { stiffness: 190, damping: 30, restDelta: 10 ** (-digits - 2) });
  const [display, setDisplay] = useState(value);
  useMotionValueEvent(spring, "change", setDisplay);
  useEffect(() => { if (reduced) spring.jump(value); else spring.set(value); }, [value, spring, reduced]);
  return <span aria-hidden="true" title={`Animated transition to ${value.toFixed(digits)}`}>{(reduced ? value : display).toFixed(digits)}</span>;
}

export function Readout({ id, value, previous, digits, pending, children }: { id: string; value?: number; previous?: number; digits: number; pending: boolean; children?: ReactNode }) {
  const shown = value ?? (pending ? previous : undefined);
  return <div className={`readout ${pending ? "is-pending" : ""}`}>
    <span className="sr-only" data-testid={id}>{value === undefined ? "—" : value.toFixed(digits)}</span>
    <div className="readout-number" aria-hidden="true">{shown === undefined ? "—" : <SpringNumber value={shown} digits={digits}/>}</div>
    <div className="readout-caption micro">{pending ? "Previous / updating" : "Dimensionless"}{pending && <i className="loading-tick"/>}</div>{children}
  </div>;
}

export function Slider({ id, label, unit, value, min, max, step, disabled, error, onChange }: { id: string; label: string; unit: string; value: string; min: number; max: number; step: number; disabled?: boolean; error?: string; onChange: (value: string) => void }) {
  return <div className="instrument-slider" title={`${label}: ${min} to ${max} ${unit}${disabled ? "; symmetric position canonicalized to zero" : ""}`}>
    <div className="slider-caption"><label className="micro" htmlFor={`number-${id}`}>{label}</label><div className="inline-number"><input id={`number-${id}`} type="number" inputMode="decimal" min={min} max={max} step="any" value={value} disabled={disabled} aria-invalid={!!error} aria-describedby={error ? `error-${id}` : undefined} onChange={(e) => onChange(e.target.value)}/><span className="micro">{unit}</span></div></div>
    <input aria-label={`${label} slider`} type="range" min={min} max={max} step={step} value={Number.isFinite(Number(value)) ? Number(value) : min} disabled={disabled} onChange={(e) => onChange(e.target.value)}/>
    {error && <p className="field-error" id={`error-${id}`} role="alert">{error}</p>}
  </div>;
}
export function Chip({ active, children, onClick, title }: { active?: boolean; children: ReactNode; onClick: () => void; title?: string }) {
  return <button className={`chip micro ${active ? "active" : ""}`} aria-pressed={!!active} onClick={onClick} title={title}>{children}</button>;
}
export function StatusPill({ state, children }: { state: "valid" | "warning" | "inactive"; children: ReactNode }) {
  return <span className={`status-pill micro ${state}`}><i/>{children}</span>;
}
export function Callout({ x, y, labelX, labelY, label, value }: { x: number; y: number; labelX: number; labelY: number; label: string; value?: string }) {
  return <g className="callout"><path d={`M${x} ${y}L${labelX + 105} ${labelY}H${labelX}`}/><rect x={labelX - 12} y={labelY - 7} width="5" height="5"/><circle cx={x} cy={y} r="2.3"/><text x={labelX} y={labelY - 8}>{label}</text>{value && <text x={labelX} y={labelY + 9} className="callout-value">{value}</text>}</g>;
}
export function Scrubber({ alpha, playing, reduced, onChange, onPlay }: { alpha: number; playing: boolean; reduced: boolean; onChange: (alpha: number) => void; onPlay: () => void }) {
  return <section className="scrubber" aria-label="Alpha sweep scrubber"><button className="play-button" aria-label={playing ? "Pause alpha sweep" : "Play alpha sweep"} disabled={reduced} onClick={onPlay}>{playing ? "Ⅱ" : "▶"}</button><div className="scrubber-track"><div className="scrubber-heading micro"><span>Alpha sweep</span><strong>{alpha.toFixed(1)}°</strong><span className="muted">{reduced ? "Manual / reduced motion" : "Space / play-pause"}</span></div><input aria-label="Alpha sweep" type="range" min="-4" max="12" step="0.1" value={alpha} onChange={(e) => onChange(Number(e.target.value))}/><div className="scrubber-ticks micro">{[-4,0,4,8,12].map((v) => <span key={v}>{v}°</span>)}</div></div></section>;
}
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const reduced = useReducedPreference();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); if (open) trigger?.focus(); };
  }, [open]);
  return <dialog className="instrument-drawer" ref={ref} aria-label={title} onCancel={(e) => { e.preventDefault(); closeRef.current(); }} onClick={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}>
    {open && <motion.div className="drawer-body" initial={reduced ? false : { x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .26 }}><div className="drawer-heading"><h2 className="display">{title}</h2><button className="chip micro" onClick={onClose} aria-label={`Close ${title}`}>Close ×</button></div>{children}</motion.div>}
  </dialog>;
}
