import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Anchor } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { LineWavesBackground } from "@/components/ui/LineWavesBackground";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <main
      className="relative flex min-h-svh items-center justify-center px-4 py-12"
      style={{ background: "#020009" }}
    >
      {/* Cubre las zonas de overscroll/safe-area de Safari */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, background: "#020009", zIndex: -1 }} />
      {/* LineWaves background — z:0 */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <LineWavesBackground
          speed={0.2}
          innerLineCount={32}
          outerLineCount={36}
          warpIntensity={1}
          rotation={-45}
          edgeFadeWidth={0}
          colorCycleSpeed={1}
          brightness={0.2}
          color1="#020009"
          color2="#01286d"
          color3="#367ed3"
          enableMouseInteraction={false}
          mouseInfluence={1}
        />

      </div>

      {/* Content — z:10 */}
      <div className="relative w-full max-w-sm space-y-6" style={{ zIndex: 10 }}>
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-primary p-3 shadow-sm">
              <Anchor className="size-7 text-primary-foreground" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: "0.04em" }}>
              HarborFlow
            </h1>
            <p className="mt-1 text-sm text-white/65">
              {t("pageSubtitle")}
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-7 shadow-xl backdrop-blur-md">
          <h2 className="text-[22px] font-semibold mb-6 text-white">
            {t("pageTitle")}
          </h2>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
