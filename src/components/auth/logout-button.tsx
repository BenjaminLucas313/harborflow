"use client";

// Logout button — calls signOut from next-auth/react and redirects to /login.

import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const t = useTranslations("auth.logout");
  const [pending, setPending] = useState(false);

  const handleLogout = async () => {
    setPending(true);
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} disabled={pending}>
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4" aria-hidden="true" />
      )}
      {pending ? t("signingOut") : t("signOut")}
    </Button>
  );
}
