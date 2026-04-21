"use client";

import dynamic from "next/dynamic";
import type { LineWavesProps } from "./LineWaves";

const LineWaves = dynamic(() => import("./LineWaves"), { ssr: false });

export function LineWavesBackground(props: LineWavesProps) {
  return <LineWaves {...props} />;
}
