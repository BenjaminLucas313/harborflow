"use client";

import { useEffect, useState } from "react";
import { Anchor } from "lucide-react";
import dynamic from "next/dynamic";

const MagicRings = dynamic(() => import("./MagicRings"), { ssr: false });

type Star = {
  left: number;
  top: number;
  width: number;
  opacity: number;
  duration: number;
  delay: number;
};

const DOT_DELAYS = ["0s", "0.16s", "0.32s", "0.48s", "0.64s"];

export function LoadingScreen() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 55 }, () => ({
        left:     Math.random() * 100,
        top:      Math.random() * 100,
        width:    Math.random() * 1.8 + 0.3,
        opacity:  Math.random() * 0.6 + 0.1,
        duration: 2 + Math.random() * 4,
        delay:    Math.random() * 4,
      }))
    );
  }, []);

  return (
    <div
      className="fixed inset-0 z-9999 overflow-hidden select-none"
      style={{ background: "radial-gradient(ellipse at 50% 45%, #0e2147 0%, #070f1f 70%)" }}
      role="status"
      aria-label="Cargando HarborFlow"
    >
      {/* MagicRings — z:1 */}
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        <MagicRings
          color="#201ca7"
          colorTwo="#6366F1"
          ringCount={6}
          speed={1}
          attenuation={10}
          lineThickness={2}
          baseRadius={0.35}
          radiusStep={0.1}
          scaleRate={0.1}
          opacity={1}
          blur={0}
          noiseAmount={0.1}
          rotation={0}
          ringGap={1.5}
          fadeIn={0.7}
          fadeOut={0.5}
          followMouse={false}
        />
      </div>

      {/* Stars — z:2 */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{
            zIndex:    2,
            left:      `${s.left}%`,
            top:       `${s.top}%`,
            width:     `${s.width}px`,
            height:    `${s.width}px`,
            opacity:   s.opacity,
            animation: `twinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Center content — z:10 */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4"
        style={{ zIndex: 10 }}
      >
        {/* Floating anchor */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width:      80,
            height:     80,
            background: "rgba(255,255,255,0.05)",
            border:     "1px solid rgba(255,255,255,0.1)",
            animation:  "anchor-float 3s ease-in-out infinite",
          }}
        >
          <Anchor size={38} strokeWidth={1.5} className="text-white" aria-hidden="true" />
        </div>

        {/* Brand name */}
        <p
          className="font-bold tracking-tight"
          style={{
            fontSize:  21,
            color:     "#f0f6ff",
            animation: "loading-fade-up 500ms 200ms ease-out both",
          }}
        >
          HarborFlow
        </p>

        {/* Subtitle */}
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{
            color:     "#90b8e0",
            animation: "loading-fade-up 500ms 380ms ease-out both",
          }}
        >
          Sistema portuario operativo
        </p>

        {/* Progress bar */}
        <div
          className="rounded-full overflow-hidden"
          style={{
            width:      110,
            height:     3,
            background: "rgba(255,255,255,0.12)",
            animation:  "loading-fade-up 500ms 440ms ease-out both",
          }}
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full"
            style={{
              width:      "45%",
              background: "linear-gradient(90deg, #3b82f6, #818cf8)",
              animation:  "progress-bar 2s ease-in-out infinite",
            }}
          />
        </div>

        {/* Sequential dots */}
        <div
          className="flex gap-2"
          style={{ animation: "loading-fade-up 500ms 520ms ease-out both" }}
          aria-hidden="true"
        >
          {DOT_DELAYS.map((delay, i) => (
            <span
              key={i}
              className="rounded-full bg-blue-400"
              style={{
                width:     6,
                height:    6,
                display:   "block",
                animation: `dot-seq 1.3s ${delay} ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Wave layers — z:2 */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: 90, zIndex: 2 }}
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          style={{
            position:  "absolute",
            bottom: 0, left: 0,
            width:     "200%",
            height:    "100%",
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
            position:  "absolute",
            bottom: 0, left: 0,
            width:     "200%",
            height:    "100%",
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
