"use client";

import { Anchor } from "lucide-react";

// Deterministic pseudorandom — avoids hydration mismatch from Math.random()
function pr(seed: number): number {
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 55 }, (_, i) => ({
  left:    pr(i * 3 + 11) * 100,
  top:     pr(i * 3 + 22) * 85,
  size:    pr(i * 3 + 33) * 2 + 1,
  opacity: pr(i * 5 + 7)  * 0.55 + 0.2,
  dur:     pr(i * 7 + 13) * 2   + 1.5,
  delay:   pr(i * 7 + 19) * 3,
}));

const DOT_DELAYS = ["0s", "0.16s", "0.32s", "0.48s", "0.64s"];

export function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden select-none"
      style={{ background: "radial-gradient(ellipse at 50% 45%, #0e2147 0%, #070f1f 70%)" }}
      role="status"
      aria-label="Cargando HarborFlow"
    >
      {/* Stars */}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{
            left:    `${s.left}%`,
            top:     `${s.top}%`,
            width:   `${s.size}px`,
            height:  `${s.size}px`,
            opacity: s.opacity,
            animation: `twinkle ${s.dur}s ${s.delay}s ease-in-out infinite`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Center cluster */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">

        {/* Ring + anchor */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: 120, height: 120 }}
        >
          {/* Glow halo */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width:  88,
              height: 88,
              background: "radial-gradient(circle, rgba(37,99,189,0.55) 0%, transparent 68%)",
              animation: "glow-pulse 2.6s ease-in-out infinite",
            }}
            aria-hidden="true"
          />

          {/* Spinning arc */}
          <svg
            width="112"
            height="112"
            viewBox="0 0 100 100"
            className="absolute pointer-events-none"
            style={{
              animation: "rotate-dash 1.8s linear infinite",
              transformOrigin: "50px 50px",
            }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ls-arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#1d4ed8" stopOpacity="0" />
                <stop offset="50%"  stopColor="#3b82f6" stopOpacity="1" />
                <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="url(#ls-arc-grad)"
              strokeWidth="3"
              strokeDasharray="60 220"
              strokeLinecap="round"
            />
          </svg>

          {/* Shine sweep */}
          <div
            className="absolute rounded-full overflow-hidden pointer-events-none"
            style={{ width: 88, height: 88 }}
            aria-hidden="true"
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: "45%",
                height: "100%",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
                animation: "shine-sweep 3s 1.2s ease-in-out infinite",
              }}
            />
          </div>

          {/* Anchor */}
          <div
            className="relative z-10"
            style={{ animation: "anchor-float 3s ease-in-out infinite" }}
          >
            <Anchor
              size={40}
              strokeWidth={1.5}
              className="text-white"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Brand name */}
        <p
          className="text-white text-3xl font-bold tracking-tight"
          style={{ animation: "loading-fade-up 500ms 200ms ease-out both" }}
        >
          HarborFlow
        </p>

        {/* Subtitle */}
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{
            color: "#90b8e0",
            animation: "loading-fade-up 500ms 380ms ease-out both",
          }}
        >
          Sistema portuario operativo
        </p>

        {/* Sequential dots */}
        <div
          className="flex gap-2 mt-1"
          style={{ animation: "loading-fade-up 500ms 520ms ease-out both" }}
          aria-hidden="true"
        >
          {DOT_DELAYS.map((delay, i) => (
            <span
              key={i}
              className="rounded-full bg-blue-400"
              style={{
                width:  6,
                height: 6,
                display: "block",
                animation: `dot-seq 1.3s ${delay} ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Wave layers */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: 90 }}
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            bottom: 0, left: 0,
            width: "200%", height: "100%",
            animation: "wave-move 7s linear infinite",
          }}
        >
          <path
            d="M0,45 C240,10 480,80 720,45 C960,10 1200,80 1440,45 L1440,90 L0,90 Z"
            fill="rgba(37,99,189,0.18)"
          />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            bottom: 0, left: 0,
            width: "200%", height: "100%",
            animation: "wave-move 10s linear infinite reverse",
          }}
        >
          <path
            d="M0,55 C240,20 480,80 720,55 C960,30 1200,80 1440,55 L1440,90 L0,90 Z"
            fill="rgba(37,99,189,0.10)"
          />
        </svg>
      </div>
    </div>
  );
}
