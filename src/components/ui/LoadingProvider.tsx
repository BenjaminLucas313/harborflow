"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "./LoadingScreen";

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 1200));
    const ready = new Promise<void>((resolve) => {
      if (document.readyState === "complete") {
        resolve();
      } else {
        window.addEventListener("load", () => resolve(), { once: true });
      }
    });
    Promise.all([minDelay, ready]).then(() => setIsLoading(false));
  }, []);

  if (isLoading) return <LoadingScreen />;

  return <div className="app-fade-in">{children}</div>;
}
