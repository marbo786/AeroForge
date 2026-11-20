import { useEffect, useId, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { Tour } from "./tour";
import type { WorkspaceView } from "./shared-design";

export function ViewMenu({ onView }: { onView: (view: WorkspaceView) => void }) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog:modal")) return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <>
      <div
        className="view-menu"
        ref={root}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <button
          ref={trigger}
          className="chip micro"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          View
        </button>
        <div
          id={id}
          className="view-popover"
          hidden={!open}
          role="group"
          aria-label="View preferences"
        >
          <ThemeToggle />
          <button
            className="chip micro"
            aria-haspopup="dialog"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
              setRequest((value) => value + 1);
            }}
          >
            Tour
          </button>
        </div>
      </div>
      <Tour onView={onView} request={request} showTrigger={false} />
    </>
  );
}
