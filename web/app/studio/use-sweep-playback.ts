import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedPreference } from "./use-reduced-preference";
import type { InstrumentProps } from "./instrument";

const sweepHoldMs = 850;
type SweepInputs = Pick<
  InstrumentProps,
  "design" | "failure" | "invalid" | "onChange" | "urlReady" | "view"
>;

export function useSweepPlayback(inputs: SweepInputs, pending: boolean) {
  const {
    design: { alpha },
    failure,
    invalid,
    view,
  } = inputs;
  const [playing, setPlaying] = useState(false);
  const reduced = !!useReducedPreference();
  const sweeping = playing && !reduced && !invalid && !failure;
  const latest = useRef(inputs);
  latest.current = inputs;

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
      const next = Math.min(12, Number((alpha + 0.5).toFixed(1)));
      latest.current.onChange("alpha", String(next));
      if (next === 12) setPlaying(false);
    }, sweepHoldMs);
    return () => window.clearTimeout(timer);
  }, [sweeping, pending, alpha]);
  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (
        view !== "airfoil" ||
        event.code !== "Space" ||
        event.repeat ||
        reduced ||
        document.querySelector("dialog[open]") ||
        (event.target instanceof Element &&
          event.target.closest(
            "input,button,a,select,textarea,[contenteditable=true],[role=slider]",
          ))
      )
        return;
      event.preventDefault();
      toggleSweep();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [reduced, toggleSweep, view]);

  return { reduced, sweeping, toggleSweep, pause: () => setPlaying(false) };
}
