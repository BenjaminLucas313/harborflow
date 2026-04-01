"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { LoginSchema, type LoginInput } from "@/modules/auth/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      companySlug: data.companySlug,
      redirect: false,
    });

    if (!result?.ok) {
      setError("root", { message: t("errors.invalidCredentials") });
      return;
    }

    // Step 7 (route protection) will handle role-based destination logic.
    router.push("/");
    router.refresh();
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
          autoComplete="current-password"
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
    </form>
  );
}
