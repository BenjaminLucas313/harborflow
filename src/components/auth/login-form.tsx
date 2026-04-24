"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, getSession } from "next-auth/react";
import { dashboardForRole } from "@/lib/routes";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { LoginSchema, type LoginInput } from "@/modules/auth/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const t = useTranslations("auth.login");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    // Pre-check: verify company + user existence before calling signIn so we
    // can show a specific message instead of the generic "invalid credentials".
    const checkRes = await fetch(
      `/api/auth/check-account?email=${encodeURIComponent(data.email)}&companySlug=${encodeURIComponent(data.companySlug)}`,
    );
    if (checkRes.ok) {
      const check = await checkRes.json() as { found: boolean; reason?: string };
      if (!check.found) {
        if (check.reason === "NO_COMPANY") {
          setError("companySlug", { message: t("errors.companyNotFound") });
        } else {
          setError("email", { message: t("errors.userNotFound") });
        }
        return;
      }
    }

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      companySlug: data.companySlug,
      redirect: false,
    });

    if (!result?.ok) {
      setError("password", { message: t("errors.wrongPassword") });
      return;
    }

    // getSession() fetches /api/auth/session with the freshly-set JWT cookie.
    // If it races (returns null), we fall back to "/" and let middleware redirect.
    const session = await getSession();
    const role    = session?.user?.role;
    const dest    = role ? dashboardForRole(role) : "/";

    if (process.env.NODE_ENV === "development") {
      console.log("[login] signIn ok. session role:", role ?? "(null — middleware will redirect)");
      console.log("[login] → navigating to:", dest);
    }

    // Hard navigation so edge middleware runs and can redirect based on the JWT cookie.
    // router.push() is a soft (RSC) navigation that bypasses middleware, causing
    // authenticated users to land on "/" without being sent to their dashboard.
    window.location.replace(dest);
  };

  // These overrides apply only to the dark-background login card.
  // - text-white / placeholder:text-white/35 / caret-white: readable text on dark glass card.
  // - WebkitBoxShadow inset: overrides Chrome's autofill blue background.
  // - WebkitTextFillColor: overrides Chrome's autofill dark text fill.
  const darkInputClassName = "text-white placeholder:text-white/35 caret-white";
  const darkInputStyle: React.CSSProperties = {
    WebkitBoxShadow:    "0 0 0 1000px #1a3560 inset",
    WebkitTextFillColor: "#ffffff",
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Root-level auth error */}
      {errors.root && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive"
        >
          {errors.root.message}
        </div>
      )}

      {/* Organisation */}
      <div className="space-y-1.5">
        <Label htmlFor="companySlug" className="text-white/75 font-medium text-[13px]">{t("fields.organisation")}</Label>
        <Input
          id="companySlug"
          type="text"
          autoComplete="organization"
          placeholder={t("placeholders.organisation")}
          aria-invalid={!!errors.companySlug}
          aria-describedby={errors.companySlug ? "companySlug-error" : undefined}
          className={darkInputClassName}
          style={darkInputStyle}
          {...register("companySlug")}
        />
        {errors.companySlug && (
          <p id="companySlug-error" role="alert" className="text-sm text-destructive">
            {errors.companySlug.message}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-white/75 font-medium text-[13px]">{t("fields.email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={t("placeholders.email")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={darkInputClassName}
          style={darkInputStyle}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-white/75 font-medium text-[13px]">{t("fields.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          className={darkInputClassName}
          style={darkInputStyle}
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" role="alert" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            {t("actions.submitting")}
          </>
        ) : (
          t("actions.submit")
        )}
      </Button>

      {/* Forgot password */}
      <div className="text-center">
        <a
          href="/forgot-password"
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          ¿Olvidaste tu contraseña?
        </a>
      </div>
    </form>
  );
}
