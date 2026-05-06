"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  screen1: React.ReactNode;
  screen2: React.ReactNode;
};

export function DashboardScrollContainer({ screen1, screen2 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // IntersectionObserver tracks which section is ≥50% visible inside the
  // scroll container, driving the nav-dot highlight.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const sections = el.querySelectorAll<HTMLElement>("[data-section]");
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            setActive(Number((entry.target as HTMLElement).dataset.section ?? 0));
          }
        }
      },
      { root: el, threshold: 0.5 },
    );

    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  const scrollTo = useCallback((idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    const sections = el.querySelectorAll<HTMLElement>("[data-section]");
    sections[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const DOT_LABELS = ["Dashboard principal", "Vista Kanban del día"];

  return (
    <div className="relative">

      {/*
        Desktop (md+): fixed-height scroll container with snap.
        Mobile: no height constraint — sections stack and scroll normally.

        data-snap-container is queried by KanbanViajes to scroll back to
        screen 1 without needing a cross-boundary callback prop.
      */}
      <div
        ref={containerRef}
        data-snap-container
        className="md:h-[calc(100dvh-3.5rem)] md:overflow-y-scroll md:snap-y md:snap-mandatory"
      >

        {/* ── Screen 1 — Dashboard ── */}
        <section
          data-section="0"
          className="relative md:h-[calc(100dvh-3.5rem)] md:snap-start md:overflow-y-auto"
        >
          {screen1}

          {/* Scroll hint — desktop only, fades out when Kanban is active */}
          <div
            className={`pointer-events-none hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 flex-col items-center gap-1 select-none transition-opacity duration-300 ${
              active === 1 ? "opacity-0" : "opacity-100 pointer-events-auto"
            }`}
            onClick={() => scrollTo(1)}
            role="button"
            aria-label="Ver vista Kanban del día"
            style={{ pointerEvents: active === 1 ? "none" : "auto" }}
          >
            <span className="text-xs text-muted-foreground">Vista kanban del día</span>
            <ChevronDown className="h-4 w-4 animate-bounce text-muted-foreground" aria-hidden="true" />
          </div>
        </section>

        {/* ── Screen 2 — Kanban ── */}
        <section
          data-section="1"
          className="md:h-[calc(100dvh-3.5rem)] md:snap-start md:overflow-y-auto"
        >
          {screen2}
        </section>

      </div>

      {/* ── Navigation dots — desktop only ── */}
      <nav
        className="hidden md:flex fixed right-4 top-1/2 z-30 -translate-y-1/2 flex-col gap-2.5"
        aria-label="Navegación de secciones"
      >
        {DOT_LABELS.map((label, idx) => (
          <button
            key={idx}
            onClick={() => scrollTo(idx)}
            aria-label={label}
            aria-current={active === idx ? "true" : undefined}
            className={`h-2 w-2 rounded-full transition-all duration-200 ${
              active === idx
                ? "scale-125 bg-foreground"
                : "bg-border hover:bg-muted-foreground"
            }`}
          />
        ))}
      </nav>

    </div>
  );
}
