"use server";

import { auth }        from "@/lib/auth";
import { assertRole }  from "@/lib/permissions";

export async function ejecutarCierreMensual(mes: number, anio: number) {
  const session = await auth();
  if (!session) throw new Error("No autorizado.");

  assertRole(session.user.role, ["UABL"]);

  if (!session.user.isUablAdmin) {
    throw new Error("Solo UABL admin puede ejecutar el cierre.");
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/jobs/cierre-mensual`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Job-Secret": process.env.JOB_SECRET ?? "",
    },
    body: JSON.stringify({ mes, anio }),
  });

  return res.json() as Promise<
    | { data: {
        mes: number; anio: number; yaRealizado?: boolean;
        viajesLiquidados: number; snapshotsGenerados: number;
        informesGenerados: number; emailsEnviados: number;
        emailsOmitidos: number; emailsErrores: number;
        errores: string[];
      } }
    | { error: { code: string; message: string } }
  >;
}
