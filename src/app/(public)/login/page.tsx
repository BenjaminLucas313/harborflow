import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Anchor } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/60 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-primary p-3 shadow-sm">
              <Anchor className="size-7 text-primary-foreground" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">HarborFlow</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("pageSubtitle")}
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-border bg-card px-6 py-7 shadow-sm">
          <h2 className="text-base font-semibold mb-6">{t("pageTitle")}</h2>
          <LoginForm />
        </div>

      </div>
    </main>
  );
}
