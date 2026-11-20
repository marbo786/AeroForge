"use client";
import { useReducedPreference } from "./use-reduced-preference";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { motion } from "motion/react";
import { modelBounds, type Bounds } from "../../lib/inference/domain";
import { explorationAlpha } from "./design-fields";

export function Module({
  number,
  title,
  children,
  className = "",
}: {
  number: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`module ${className}`} aria-label={title}>
      <h2 className="module-title micro">
        <span>{title}</span>
        <span className="muted">{number}</span>
      </h2>
      {children}
    </section>
  );
}

export function Readout({
  id,
  value,
  digits,
  pending,
  sweeping,
}: {
  id: string;
  value?: number;
  digits: number;
  pending: boolean;
  sweeping?: boolean;
}) {
  const shown = value === undefined ? "—" : value.toFixed(digits);
  return (
    <div className={`readout ${pending ? "is-pending" : ""}`}>
      <div
        className={`readout-number ${value === undefined ? "" : "has-value"}`}
        key={shown}
        data-testid={id}
      >
        {shown}
      </div>
      <div className="readout-caption micro">
        {pending
          ? "Calculating"
          : sweeping && value !== undefined
            ? "Latest sample"
            : "Dimensionless"}
        {pending && <i className="loading-tick" />}
      </div>
    </div>
  );
}

export function Slider({
  id,
  label,
  unit,
  value,
  min,
  max,
  supported,
  step,
  disabled,
  error,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  min: number;
  max: number;
  supported: Bounds;
  step: number;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [low, high] = supported;
  const partial = !disabled && (low > min || high < max);
  const rangeHint = disabled
    ? "Symmetric sections use camber position zero."
    : `Model range ${low.toLocaleString("en-US")} to ${high.toLocaleString("en-US")}${unit === "Re" ? "" : unit}.`;
  const marker = (bound: number) => `${((bound - min) / (max - min)) * 100}%`;
  const descriptions = [`bounds-${id}`, error ? `error-${id}` : ""].filter(Boolean).join(" ");
  return (
    <div className="instrument-slider" title={rangeHint}>
      <div className="slider-caption">
        <label className="micro" htmlFor={`number-${id}`}>
          {label}
        </label>
        <div className="inline-number">
          <input
            id={`number-${id}`}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step="any"
            value={value}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={descriptions}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="micro">{unit}</span>
        </div>
      </div>
      <div className="parameter-track">
        <input
          aria-label={`${label} slider`}
          aria-describedby={descriptions}
          type="range"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(Number(value)) ? Number(value) : min}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {partial && (
          <span className="parameter-model-track" aria-hidden="true">
            {(low > min ? [low, high] : [high])
              .filter((value) => value !== max)
              .map((value) => (
                <i key={value} style={{ "--bound": marker(value) } as CSSProperties} />
              ))}
          </span>
        )}
      </div>
      <p id={`bounds-${id}`} className={partial ? "parameter-model-hint" : "sr-only"}>
        {rangeHint}
      </p>
      {error && (
        <p className="field-error" id={`error-${id}`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Chip({
  active,
  children,
  onClick,
  title,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      className={`chip micro ${active ? "active" : ""}`}
      aria-pressed={!!active}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
export function StatusPill({
  state,
  children,
}: {
  state: "valid" | "warning" | "inactive";
  children: ReactNode;
}) {
  return (
    <span className={`status-pill micro ${state}`}>
      <i />
      {children}
    </span>
  );
}
export function Callout({
  x,
  y,
  labelX,
  labelY,
  label,
  value,
}: {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  label: string;
  value?: string;
}) {
  return (
    <g className="callout">
      <path d={`M${x} ${y}L${labelX + 105} ${labelY}H${labelX}`} />
      <rect x={labelX - 12} y={labelY - 7} width="5" height="5" />
      <circle cx={x} cy={y} r="2.3" />
      <text x={labelX} y={labelY - 8}>
        {label}
      </text>
      {value && (
        <text x={labelX} y={labelY + 9} className="callout-value">
          {value}
        </text>
      )}
    </g>
  );
}
export function Scrubber({
  alpha,
  playing,
  reduced,
  onChange,
  onPlay,
}: {
  alpha: number;
  playing: boolean;
  reduced: boolean;
  onChange: (alpha: number) => void;
  onPlay: () => void;
}) {
  return (
    <section className="scrubber" aria-label="Alpha sweep scrubber">
      <button
        className="play-button"
        aria-label={playing ? "Pause alpha sweep" : "Play alpha sweep"}
        disabled={reduced}
        onClick={onPlay}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
      <div className="scrubber-track">
        <div className="scrubber-heading micro">
          <span>Alpha sweep</span>
          <strong>{alpha.toFixed(1)}°</strong>
          <span className="muted">
            {reduced ? "Manual / reduced motion" : "Space / play-pause"}
          </span>
        </div>
        <input
          aria-label="Alpha sweep"
          type="range"
          min={explorationAlpha[0]}
          max={explorationAlpha[1]}
          step="0.1"
          value={alpha}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="scrubber-ticks micro">
          {[...new Set([explorationAlpha[0], 0, 4, modelBounds.alpha[1], explorationAlpha[1]])]
            .sort((a, b) => a - b)
            .map((v) => (
              <span key={v}>{v}°</span>
            ))}
        </div>
      </div>
    </section>
  );
}
export function Drawer({
  open,
  onClose,
  title,
  children,
  headerContent,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  headerContent?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const reduced = useReducedPreference();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      if (open) trigger?.focus();
    };
  }, [open]);
  return (
    <dialog
      className={`instrument-drawer ${className}`}
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeRef.current();
      }}
    >
      {open && (
        <motion.div
          className="drawer-body"
          initial={reduced ? false : { x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.26 }}
        >
          <div className="drawer-header">
            <div className="drawer-heading">
              <h2 className="display">{title}</h2>
              <button className="chip micro" onClick={onClose} aria-label={`Close ${title}`}>
                Close ×
              </button>
            </div>
            {headerContent}
          </div>
          {children}
        </motion.div>
      )}
    </dialog>
  );
}
