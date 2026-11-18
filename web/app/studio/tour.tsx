import { useEffect, useState } from "react";
import { Drawer } from "./kit";
import type { WorkspaceView } from "./shared-design";
import "../landing.css";

const steps: { title: string; text: string; view: WorkspaceView }[] = [
  {
    title: "Meet the AF–02",
    text: "Orbit the illustrative car and inspect its front wing. On phones, the still preview is the starting point; Enable 3D is optional.",
    view: "studio",
  },
  {
    title: "Shape a section",
    text: "Use the geometry sliders or drag Airfoil handles. The NACA section is shared across the car workspace and editor. Edit parameters opens the controls on smaller screens.",
    view: "airfoil",
  },
  {
    title: "Read the response",
    text: "CL, CD and lift-to-drag come from the frozen browser model. Pending or unsupported inputs clear the readouts. Details / evidence explains applicability.",
    view: "airfoil",
  },
  {
    title: "Compare and search",
    text: "Save a design as your baseline, inspect its curves in Analysis, or open Optimize to search eligible isolated sections.",
    view: "analysis",
  },
  {
    title: "Know the limits",
    text: "Predictions describe isolated NACA sections at α −4° to 8° and Re 100k–500k. The car and wing pitch are illustrative. Pressure has its own sampled operating-point limits.",
    view: "studio",
  },
];

export function Tour({ onView }: { onView: (view: WorkspaceView) => void }) {
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("tour")) return;
    try {
      if (localStorage.getItem("aeroforge-tour") === "done") return;
    } catch {}
    setStep(0);
  }, []);
  function finish() {
    setStep(null);
    try {
      localStorage.setItem("aeroforge-tour", "done");
    } catch {}
    const url = new URL(location.href);
    url.searchParams.delete("tour");
    history.replaceState(null, "", url);
  }
  return (
    <>
      <button className="chip micro" aria-haspopup="dialog" onClick={() => setStep(0)}>
        Tour
      </button>
      <Drawer open={step !== null} onClose={finish} title="AeroForge tour">
        {step !== null && (
          <>
            <p className="micro tour-progress">
              Step {step + 1} of {steps.length}
            </p>
            <h3>{steps[step].title}</h3>
            <p className="tour-copy">{steps[step].text}</p>
            <div className="tour-actions">
              <button className="chip micro" onClick={finish}>
                Skip tour
              </button>
              <button
                className="chip micro active"
                onClick={() => {
                  if (step === steps.length - 1) {
                    onView("studio");
                    finish();
                  } else {
                    onView(steps[step + 1].view);
                    setStep(step + 1);
                  }
                }}
              >
                {step === steps.length - 1 ? "Start designing" : "Next step"}
              </button>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
