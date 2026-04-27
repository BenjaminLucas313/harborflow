"use client";

import * as Sentry from "@sentry/nextjs";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export function SentryUserIdentifier() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user) {
      Sentry.setUser({
        id:       session.user.id,
        email:    session.user.email ?? undefined,
        username: `${session.user.firstName} ${session.user.lastName}`,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [session]);

  return null;
}
