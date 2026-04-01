import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("pageSubtitle")}
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-xl border border-border bg-card px-6 py-8 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
