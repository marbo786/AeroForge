"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { VehicleViewport } from "./inspection/preview";
import { createScrollCamera } from "./inspection/scroll-camera";
import { ThemeToggle } from "./studio/theme-toggle";
import { LiveryPicker, useLivery } from "./studio/livery";
import type { PressureProfiles } from "./studio/use-pressure-profile";
import "./studio/tokens.css";
import "./inspection/inspection.css";
import "./landing.css";
import "lenis/dist/lenis.css";

const Studio = dynamic(() => import("./studio/studio"));
const StoryLab = dynamic(() => import("./story-lab"));
const chapters = ["Start", "Shape", "Pressure", "Compare", "Evidence"];
const ids = ["start", "shape", "pressure", "compare", "evidence"];

function Deferred({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="story-lab" ref={ref}>
      {visible ? children : <p>Explore the section as you scroll.</p>}
    </div>
  );
}

function ScrollStory() {
  const { livery } = useLivery();
  const studioUrl = `/studio/?tour=1&livery=${livery}`;
  const progress = useRef<HTMLDivElement>(null);
  const [camera] = useState(createScrollCamera);
  const [animated, setAnimated] = useState(false);
  const [active, setActive] = useState(0);
  const [profiles, setProfiles] = useState<PressureProfiles>();
  useEffect(() => {
    const preference = matchMedia(
      "(prefers-reduced-motion: no-preference) and (min-width: 981px) and (pointer: fine)",
    );
    let cancelled = false;
    let generation = 0;
    let frame = 0;
    let lenis: import("lenis").default | undefined;
    const updatePreference = () => {
      const request = ++generation;
      lenis?.destroy();
      lenis = undefined;
      cancelAnimationFrame(frame);
      setAnimated(preference.matches);
      if (!preference.matches) return;
      void import("lenis").then(({ default: Lenis }) => {
        if (cancelled || request !== generation || !preference.matches) return;
        lenis = new Lenis({
          autoRaf: false,
          anchors: false,
          prevent: (node) => node.closest("dialog") !== null,
        });
        const raf = (time: number) => {
          lenis?.raf(time);
          frame = requestAnimationFrame(raf);
        };
        frame = requestAnimationFrame(raf);
      });
    };
    const focus = () => lenis?.scrollTo(window.scrollY, { immediate: true });
    const suspend = () => {
      generation++;
      lenis?.destroy();
      lenis = undefined;
      cancelAnimationFrame(frame);
    };
    const resume = (event: PageTransitionEvent) => {
      if (event.persisted) updatePreference();
    };
    const anchor = (event: MouseEvent) => {
      if (
        !lenis ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      const target = link && document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      history.pushState(null, "", link!.hash);
      lenis.scrollTo(target, {
        offset: -84,
        onComplete: () => target.focus({ preventScroll: true }),
      });
    };
    updatePreference();
    preference.addEventListener("change", updatePreference);
    document.addEventListener("focusin", focus);
    document.addEventListener("click", anchor);
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", resume);
    return () => {
      cancelled = true;
      lenis?.destroy();
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", updatePreference);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("click", anchor);
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", resume);
    };
  }, []);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const sections = ids.map((id) => document.getElementById(id)!);
      let chapter = 0;
      sections.forEach((section, i) => {
        if (section.getBoundingClientRect().top < innerHeight * 0.6) chapter = i;
      });
      setActive(chapter);
      const start = sections[0].offsetTop;
      const end = sections[3].offsetTop;
      camera.set(Math.max(0, Math.min(3, ((scrollY - start) / Math.max(1, end - start)) * 3)));
      if (progress.current)
        progress.current.style.transform = `scaleX(${scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)})`;
      frame = 0;
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("resize", scroll);
    return () => {
      removeEventListener("scroll", scroll);
      removeEventListener("resize", scroll);
      cancelAnimationFrame(frame);
    };
  }, [camera]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.entered = "true";
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    document
      .querySelectorAll(".story-step, .story-tiles > a")
      .forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  return (
    <div className="instrument landing" data-scroll-motion={animated ? "enabled" : "static"}>
      <div className="story-progress" ref={progress} aria-hidden="true" />
      <header className="landing-header">
        <a href="/" className="display">
          AeroForge
        </a>
        <div>
          <ThemeToggle />
          <a className="landing-cta" href={studioUrl}>
            Enter design studio
          </a>
        </div>
      </header>
      <nav className="story-nav" aria-label="Landing chapters">
        {chapters.map((name, i) => (
          <a key={name} href={`#${ids[i]}`} aria-current={active === i ? "location" : undefined}>
            <span className="micro">0{i + 1}</span> {name}
          </a>
        ))}
      </nav>
      <main className="landing-main">
        <div className="story-track">
          <div className="landing-scene inspection">
            <VehicleViewport
              story={animated ? camera : undefined}
              autoStart={animated}
              design={{ m: 0.02, p: 0.4, t: 0.12, alpha: 4, re: 250000 }}
              alpha={4}
              profiles={profiles}
            />
            <p className="landing-scene-caption">
              AF–02 · Original illustrative car. Wing pitch is illustrative.
            </p>
            <LiveryPicker />
          </div>
          <section className="story-step landing-intro" id="start" tabIndex={-1}>
            <p className="landing-kicker micro">01 / AF–02 aerodynamic design lab</p>
            <h1 className="display">Shape your aerodynamic instinct.</h1>
            <p>Change a section. See the science respond.</p>
            <a className="story-scroll" href="#shape">
              Scroll to explore ↓
            </a>
            <p className="story-limit-note">Honest limits: isolated sections, illustrative car.</p>
          </section>
          <section className="story-step" id="shape" tabIndex={-1}>
            <p className="landing-kicker micro">02 / Geometry</p>
            <h2 className="display">Shape the section.</h2>
            <p>
              A little camber changes the conversation. Try three NACA sections at the same
              operating point.
            </p>
            <Deferred>
              <StoryLab mode="shape" />
            </Deferred>
          </section>
          <section className="story-step" id="pressure" tabIndex={-1}>
            <p className="landing-kicker micro">03 / Surface pressure</p>
            <h2 className="display">See the pressure.</h2>
            <p>
              Follow the pressure around an isolated wing section. Every surface color comes from
              the existing pressure model.
            </p>
            <Deferred>
              <StoryLab mode="pressure" onPressure={setProfiles} />
            </Deferred>
          </section>
          <section className="story-step" id="compare" tabIndex={-1}>
            <p className="landing-kicker micro">04 / Your next iteration</p>
            <h2 className="display">Compare. Then share.</h2>
            <p>
              Save a baseline, place two sections on the reference car, and take the evidence with
              you.
            </p>
            <Deferred>
              <StoryLab mode="compare" />
            </Deferred>
            <a className="story-link" href={`/studio/?livery=${livery}`}>
              Compare on the illustrative car
            </a>
          </section>
        </div>
        <section className="story-evidence" id="evidence" tabIndex={-1}>
          <p className="landing-kicker micro">05 / Evidence before claims</p>
          <h2 className="display">Small models. Visible limits.</h2>
          <div className="story-tiles">
            <a href="https://github.com/marbo786/AeroForge/blob/main/docs/ML.md">
              <strong>0.01484</strong>
              <h3>Lift MAE</h3>
              <p>Frozen final-panel evidence for browser inference. Read the evaluation.</p>
            </a>
            <a href="https://github.com/marbo786/AeroForge/blob/main/docs/v3-5/README.md">
              <strong>35.7 ms</strong>
              <h3>Warm pressure p95</h3>
              <p>Recorded desktop lab measurement. Your device will vary.</p>
            </a>
            <a href="https://github.com/marbo786/AeroForge/blob/main/docs/ML.md">
              <strong>49,781 bytes</strong>
              <h3>One coefficient graph</h3>
              <p>
                The optimizer ranks candidates with this same compact graph. Read the search policy.
              </p>
            </a>
          </div>
        </section>
        <aside className="landing-limits" aria-label="Honest limits">
          <h2>Honest limits</h2>
          <p>
            The car and wing pitch are illustrative. Predictions cover isolated NACA sections at α
            −4° to 8° and Re 100,000–500,000. Full-car downforce and lap time are not predicted.
          </p>
          <a href="/model/">Read the model evidence</a>
        </aside>
        <div className="story-finish">
          <h2 className="display">Your section. Your next question.</h2>
          <a className="landing-cta" href={studioUrl}>
            Enter design studio
          </a>
        </div>
      </main>
    </div>
  );
}

export default function Landing() {
  const [legacy, setLegacy] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    setLegacy(["view", "m", "p", "t", "aoa", "re"].some((key) => query.has(key)));
  }, []);
  return legacy ? <Studio /> : <ScrollStory />;
}
