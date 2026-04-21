"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { RegisterSchema, type RegisterInput } from "@/modules/auth/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const t = useTranslations("auth.register");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push("/login");
      return;
    }

    const payload = await res.json().catch(() => ({}));
    const code: string = payload?.code ?? "";

    if (res.status === 409 && code === "EMAIL_ALREADY_REGISTERED") {
      setError("email", { message: t("errors.emailAlreadyRegistered") });
      return;
    }

    if (res.status === 404 && code === "COMPANY_NOT_FOUND") {
      setError("companySlug", { message: t("errors.companyNotFound") });
      return;
    }

    setError("root", { message: t("errors.unexpected") });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Root-level error */}
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
        <Label htmlFor="companySlug">{t("fields.organisation")}</Label>
        <Input
          id="companySlug"
          type="text"
          autoComplete="organization"
          placeholder={t("placeholders.organisation")}
          aria-invalid={!!errors.companySlug}
          aria-describedby={errors.companySlug ? "companySlug-error" : undefined}
          {...register("companySlug")}
        />
        {errors.companySlug && (
          <p id="companySlug-error" role="alert" className="text-sm text-destructive">
            {errors.companySlug.message}
          </p>
        )}
      </div>

      {/* First name + Last name — side by side on wider screens */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">{t("fields.firstName")}</Label>
          <Input
            id="firstName"
            type="text"
            autoComplete="given-name"
            placeholder={t("placeholders.firstName")}
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            {...register("firstName")}
          />
          {errors.firstName && (
            <p id="firstName-error" role="alert" className="text-sm text-destructive">
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lastName">{t("fields.lastName")}</Label>
          <Input
            id="lastName"
            type="text"
            autoComplete="family-name"
            placeholder={t("placeholders.lastName")}
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
            {...register("lastName")}
          />
          {errors.lastName && (
            <p id="lastName-error" role="alert" className="text-sm text-destructive">
              {errors.lastName.message}
            </p>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("fields.email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={t("placeholders.email")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
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
        <Label htmlFor="password">{t("fields.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
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

      {/* Footer link */}
      <p className="text-center text-sm text-muted-foreground">
        {t("footer.hasAccount")}{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("footer.signIn")}
        </Link>
      </p>
    </form>
  );
}
