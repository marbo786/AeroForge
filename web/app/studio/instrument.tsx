"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";

import { assessDomain, domainMessage, type Design } from "../../lib/inference/domain";
import { Drawer } from "./kit";
import { AirfoilEditor } from "./airfoil-editor";
import type { Display } from "./stage";
import { useSweepPlayback } from "./use-sweep-playback";
import { ChartPanel, useSweep } from "./charts";
import { sharedDesignUrl, views, type WorkspaceView } from "./shared-design";
import { VehicleViewport } from "../inspection/preview";
import type { Draft, Field } from "./design-fields";
import { nameOf, type Result, type SavedDesign } from "./section-design";
import { SectionPreview } from "./section-preview";
import { ExportMenu, ShareDesign } from "./design-actions";
import { Comparison } from "./comparison";
import { ModelDetails } from "./model-details";
import { DesignParameters } from "./design-parameters";
import { CarComparison } from "./car-comparison";
import { ShareCard } from "./share-card";
import { FlowControls, FlowStudy } from "./flow-study";
import { usePressureProfile, type FlowMode } from "./use-pressure-profile";
import { LiveryPicker, useLivery } from "./livery";
import { Tour } from "./tour";
import { ThemeToggle } from "./theme-toggle";
import { Telemetry } from "./telemetry";
import { useTrainingCoverage } from "./use-training-coverage";
import "./tokens.css";
import "./instrument.css";
import "../inspection/inspection.css";
import "./workspace.css";

const Optimizer = dynamic(() => import("./optimizer"), { ssr: false });
type StudioDrawer =
  "Details" | "Charts" | "Share design" | "Design parameters" | "Design optimization";
type Dock = "section" | "curves" | "comparison";
const viewLabels: Record<WorkspaceView, string> = {
  studio: "Studio",
  airfoil: "Airfoil",
  analysis: "Analysis",
};
const dockLabels: Record<Dock, string> = {
  section: "Section",
  curves: "Lift & drag",
  comparison: "Comparison",
};
export type InstrumentProps = {
  draft: Draft;
  design: Design;
  preset: string;
  view: WorkspaceView;
  invalid: boolean;
  domain: ReturnType<typeof assessDomain>;
  domainError: string;
  onView: (view: WorkspaceView) => void;
  errors: Partial<Record<Field, string>>;
  current: Result | null;
  status: string;
  failure: string;
  onChange: (field: Field, value: string) => void;
  onReset: () => void;
  onClamp: () => void;
  onPreset: (code: string) => void;
  onRetry: () => void;
  onRestore: (design: Design) => void;
  urlReady: boolean;
  linkError: boolean;
  onDismissLinkError: () => void;
};
const compactQuery = "(max-width: 1120px)";
function subscribeCompact(changed: () => void) {
  const query = matchMedia(compactQuery);
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
}

export default function Instrument(props: InstrumentProps) {
  const {
    design,
    draft,
    preset,
    view,
    invalid,
    domain,
    domainError,
    current,
    status,
    failure,
    errors,
    onChange,
    onPreset,
    onReset,
    onRetry,
  } = props;
  const { livery } = useLivery();
  const [display, setDisplay] = useState<Display>({
    grid: false,
    camber: true,
    chord: true,
    labels: true,
  });
  const [flowMode, setFlowMode] = useState<FlowMode>("off");
  const pressure = usePressureProfile(design, flowMode !== "off" && view !== "analysis", invalid);
  const [drawer, setDrawer] = useState<StudioDrawer | null>(null);
  const [optimizerOpened, setOptimizerOpened] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [compareCar, setCompareCar] = useState(false);
  const [saved, setSaved] = useState<SavedDesign | null>(null);
  const [inspectionAngle, setInspectionAngle] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [dock, setDock] = useState<Dock | null>(null);
  const [wingSelected, setWingSelected] = useState(false);
  const [morePresets, setMorePresets] = useState(false);
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => matchMedia(compactQuery).matches,
    () => false,
  );
  const dockId = useId();
  const wingTitle = useId();
  const analysisTitle = useId();
  const viewHeading = useRef<HTMLHeadingElement>(null);
  const focusAirfoil = useRef(false);
  function inspectWing() {
    pause();
    setWingSelected(true);
  }
  const chartsVisible = view === "analysis" || dock === "curves" || drawer === "Charts";
  const currentUnavailable = invalid
    ? "Correct the current section inputs to calculate its sweep."
    : !domain.sweepSupported
      ? domainMessage(domain.outside.filter((field) => field !== "alpha"))
      : failure
        ? "Retry the prediction model to calculate the current sweep."
        : "";
  const savedUnavailable = saved
    ? domainMessage(assessDomain(saved.design).outside.filter((field) => field !== "alpha"))
    : "";
  const sweep = useSweep(
    design,
    (chartsVisible || exportOpen) && props.urlReady && !currentUnavailable,
  );
  const comparison = useSweep(
    saved?.design ?? design,
    chartsVisible && !!saved && !savedUnavailable,
  );
  const inBounds = !invalid && !domainError;
  const coverage = useTrainingCoverage(
    design,
    invalid ? "invalid" : domainError ? "outside" : "nominal",
    current !== null || !!failure,
  );
  const pending = inBounds && !current && !failure;
  const domainLabel = invalid ? "Invalid input" : domainError ? "Out of bounds" : "Within bounds";
  const statusText = invalid ? "Check parameters" : domainError ? "Outside model bounds" : status;
  const { reduced, sweeping, toggleSweep, pause } = useSweepPlayback(props, pending);
  function returnToModelRange() {
    pause();
    props.onClamp();
  }
  function changeField(field: Field, value: string) {
    pause();
    onChange(field, value);
  }
  function openDrawer(next: StudioDrawer) {
    pause();
    setDrawer(next);
  }
  function openShare() {
    setShareUrl(sharedDesignUrl(window.location.origin, design, view, livery));
    openDrawer("Share design");
  }
  function changeMode(next: WorkspaceView) {
    if (next === view) return;
    pause();
    setExportOpen(false);
    props.onView(next);
  }
  useEffect(() => {
    if (view !== "airfoil" || !focusAirfoil.current) return;
    focusAirfoil.current = false;
    viewHeading.current?.focus();
  }, [view]);
  function saveDesign() {
    setSaved({ design, result: current });
  }
  const comparingCar = compareCar && saved !== null;
  const cannotSave = !props.urlReady || invalid || pending;
  const parameters = (
    <DesignParameters
      design={design}
      draft={draft}
      errors={errors}
      preset={preset}
      morePresets={morePresets}
      onTogglePresets={() => setMorePresets(!morePresets)}
      onChange={changeField}
      onPreset={(code) => {
        pause();
        onPreset(code);
      }}
      onReset={() => {
        pause();
        onReset();
      }}
    />
  );

  const curves = (
    <ChartPanel
      sweep={sweep}
      comparison={comparison}
      currentUnavailable={currentUnavailable}
      savedUnavailable={savedUnavailable}
      selected={inspectionAngle ?? design.alpha}
      following={inspectionAngle === null}
      onInspect={setInspectionAngle}
    />
  );
  const dataExport = (
    <ExportMenu
      design={design}
      current={current}
      points={sweep.points}
      loading={sweep.loading}
      invalid={!props.urlReady || invalid}
      open={exportOpen}
      onOpen={setExportOpen}
      dataOnly={view === "analysis"}
    />
  );
  const comparisonPanel = saved ? (
    <Comparison
      design={design}
      current={current}
      saved={saved}
      onRestore={() => props.onRestore(saved.design)}
      onClear={() => {
        setSaved(null);
        setCompareCar(false);
      }}
    />
  ) : (
    <div className="v2-empty-comparison">
      <p>Save the current section to compare it with your next design.</p>
      <button className="chip micro" disabled={cannotSave} onClick={saveDesign}>
        Save design
      </button>
    </div>
  );

  const telemetryPanel = (
    <Telemetry
      current={current}
      baseline={saved?.result ?? null}
      conditionKey={`${design.alpha}/${design.re}`}
      pending={pending}
      sweeping={sweeping}
      inBounds={inBounds}
      statusText={statusText}
      domainLabel={domainLabel}
      domainError={domainError}
      invalid={invalid}
      interpolatedRe={domain.interpolatedRe}
      coverage={coverage}
      onClamp={returnToModelRange}
      onDetails={() => openDrawer("Details")}
    />
  );

  return (
    <div className="instrument v2-workspace" data-view={view}>
      <header className="v2-header">
        <a href="/" className="v2-brand" aria-label="AeroForge home">
          <svg viewBox="0 0 32 24" width="28" height="24" aria-hidden="true">
            <path
              d="M2 18Q9 2 28 17Q16 21 2 18ZM3 18H29"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          AeroForge
        </a>
        <nav className="v2-modes" aria-label="Workspace views">
          {views.map((mode) => (
            <button key={mode} aria-pressed={view === mode} onClick={() => changeMode(mode)}>
              {viewLabels[mode]}
            </button>
          ))}
        </nav>
        <div className="v2-header-actions">
          <ThemeToggle />
          <Tour onView={changeMode} />
          <button
            className="chip micro"
            aria-haspopup="dialog"
            disabled={!props.urlReady || invalid}
            onClick={() => {
              setOptimizerOpened(true);
              openDrawer("Design optimization");
            }}
          >
            Optimize
          </button>
          <a href="/model/" className="chip micro">
            Model evidence
          </a>
          <button className="chip micro" disabled={!props.urlReady || invalid} onClick={openShare}>
            Share
          </button>
        </div>
      </header>
      <main className="v2-main">
        <div className="v2-layout">
          {!compact && (
            <aside className="v2-controls" aria-label="Design parameters">
              {parameters}
            </aside>
          )}
          <div className="v2-center">
            <LiveryPicker />
            {telemetryPanel}
            <div className="v2-view-heading">
              <div>
                <p className="micro">
                  {view === "studio"
                    ? "Vehicle studio"
                    : view === "airfoil"
                      ? "Representative NACA section"
                      : "Isolated 2D section analysis"}
                </p>
                <h1 ref={viewHeading} tabIndex={-1}>
                  {view === "studio" ? "AF–02" : nameOf(design)}
                </h1>
              </div>
              {view === "studio" && (
                <div className="v2-car-caption">
                  <p>Illustrative car</p>
                  <p>Wing pitch is illustrative, not a simulation.</p>
                </div>
              )}
              <button
                className="chip micro v2-edit"
                aria-haspopup="dialog"
                onClick={() => openDrawer("Design parameters")}
              >
                Edit parameters
              </button>
            </div>
            {view === "studio" && (
              <div className="car-compare-actions">
                {!saved && (
                  <button className="chip micro" disabled={cannotSave} onClick={saveDesign}>
                    Save baseline
                  </button>
                )}
                <button
                  className="chip micro"
                  disabled={!saved}
                  aria-pressed={comparingCar}
                  onClick={() => setCompareCar(!compareCar)}
                >
                  Compare on car
                </button>
                {!saved && <span>Save a baseline to inspect two sections side by side.</span>}
              </div>
            )}
            {view === "studio" && comparingCar && saved && (
              <CarComparison
                design={design}
                current={current}
                saved={saved}
                invalid={invalid}
                onClose={() => setCompareCar(false)}
              />
            )}
            <div
              className="v2-vehicle-workspace"
              hidden={view !== "studio" || comparingCar}
              data-section-open={wingSelected || undefined}
            >
              <VehicleViewport
                active={view === "studio" && !comparingCar}
                initialized={props.urlReady}
                onAirfoil={() => changeMode("airfoil")}
                alpha={design.alpha}
                design={design}
                profiles={pressure.profiles}
                wing={{
                  selected: wingSelected,
                  onInspect: inspectWing,
                  onReturn: () => setWingSelected(false),
                }}
              />
              {view === "studio" && wingSelected && (
                <section className="v2-wing-study" aria-labelledby={wingTitle}>
                  <div className="v2-wing-heading">
                    <h2 id={wingTitle}>Front wing</h2>
                    <p>Representative NACA section</p>
                  </div>
                  <SectionPreview design={design} invalid={invalid} wing />
                  <p className="live-cut-caption">
                    Live section cut. Representative NACA surface overlay; the surrounding car wing
                    is illustrative.
                  </p>
                  <FlowControls mode={flowMode} onMode={setFlowMode} />
                  <button
                    type="button"
                    className="chip micro"
                    onClick={() => {
                      focusAirfoil.current = true;
                      changeMode("airfoil");
                    }}
                  >
                    Open Airfoil editor
                  </button>
                </section>
              )}
              {view === "studio" && wingSelected && flowMode !== "off" && (
                <FlowStudy design={design} mode={flowMode} pressure={pressure} />
              )}
            </div>
            {view === "airfoil" && (
              <AirfoilEditor
                flowMode={flowMode}
                onFlowMode={setFlowMode}
                pressure={pressure}
                display={display}
                onDisplay={setDisplay}
                design={design}
                saved={saved?.design}
                invalid={invalid}
                reduced={reduced}
                sweeping={sweeping}
                cannotSave={cannotSave}
                dataExport={dataExport}
                onChange={changeField}
                onPlay={toggleSweep}
                onCharts={() => openDrawer("Charts")}
                onSave={saveDesign}
              />
            )}
            {view === "analysis" && (
              <section className="v2-analysis" aria-labelledby={analysisTitle}>
                <h2 className="sr-only" id={analysisTitle}>
                  Section analysis
                </h2>
                <div className="v2-analysis-summary">
                  <SectionPreview design={design} invalid={invalid} saved={saved?.design} />
                  <div className="v2-analysis-actions">
                    {!saved && (
                      <button className="chip micro" disabled={cannotSave} onClick={saveDesign}>
                        Save design
                      </button>
                    )}
                    {dataExport}
                  </div>
                </div>
                {curves}
                {saved && comparisonPanel}
              </section>
            )}
          </div>
        </div>
        {view !== "analysis" && (
          <div className="v2-dock">
            <nav aria-label="Analysis dock">
              {(Object.keys(dockLabels) as Dock[]).map((item) => (
                <button
                  key={item}
                  aria-expanded={dock === item}
                  aria-controls={dockId}
                  className="chip micro"
                  onClick={() => setDock(dock === item ? null : item)}
                >
                  {dockLabels[item]}
                </button>
              ))}
              {dock && (
                <button className="chip micro v2-collapse" onClick={() => setDock(null)}>
                  Collapse dock
                </button>
              )}
            </nav>
            <div id={dockId} hidden={!dock} className="v2-dock-content">
              {dock === "section" && (
                <SectionPreview design={design} invalid={invalid} saved={saved?.design} />
              )}
              {dock === "curves" && drawer !== "Charts" && curves}
              {dock === "comparison" && drawer !== "Charts" && comparisonPanel}
            </div>
          </div>
        )}
      </main>
      {failure && inBounds && (
        <div className="runtime-error" role="alert">
          <span>{failure}</span>
          <button className="chip micro" onClick={onRetry}>
            Retry model
          </button>
        </div>
      )}
      <Drawer
        open={compact && drawer === "Design parameters"}
        onClose={() => setDrawer(null)}
        className="v2-control-sheet"
        title="Design parameters"
        headerContent={
          view === "studio" && wingSelected ? (
            <div className="v2-sheet-section">
              <SectionPreview design={design} invalid={invalid} wing />
            </div>
          ) : undefined
        }
      >
        {compact && parameters}
        {domainError && !invalid && (
          <div className="v2-domain-action">
            <p className="v2-warning">{domainError}</p>
            <button className="chip micro v2-clamp" onClick={returnToModelRange}>
              Return to model range
            </button>
          </div>
        )}
      </Drawer>
      <Drawer open={drawer === "Details"} onClose={() => setDrawer(null)} title="Details">
        {domainError && !invalid && <p className="chart-message">{domainError}</p>}
        <ModelDetails coverage={coverage} interpolatedRe={inBounds && domain.interpolatedRe} />
      </Drawer>
      <Drawer open={drawer === "Charts"} onClose={() => setDrawer(null)} title="Charts">
        {saved && comparisonPanel}
        {curves}
      </Drawer>
      <Drawer open={drawer === "Share design"} onClose={() => setDrawer(null)} title="Share design">
        <ShareDesign url={shareUrl} />
        <ShareCard design={design} current={current} />
      </Drawer>
      {optimizerOpened && (
        <Optimizer
          open={drawer === "Design optimization"}
          design={design}
          onClose={() => setDrawer(null)}
          onApply={(candidate) => {
            props.onRestore(candidate);
            changeMode("studio");
          }}
        />
      )}
      {props.linkError && (
        <aside className="link-notice" aria-label="Invalid design link">
          <p role="alert">
            This design link is invalid. The studio opened with the default design.
          </p>
          <button className="chip micro" onClick={props.onDismissLinkError}>
            Dismiss
          </button>
        </aside>
      )}
    </div>
  );
}
