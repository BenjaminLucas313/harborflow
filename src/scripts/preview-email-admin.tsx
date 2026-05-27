import { render } from "@react-email/render";
import * as fs from "fs";
import * as path from "path";

import { EmailMensualAdmin } from "../emails/EmailMensualAdmin";

process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const mockProps = {
  mes:         "Abril 2026",
  companyName: "UABL Puerto Rosario",
  kpis: {
    totalViajes:        87,
    variacionViajes:    12,
    ocupacionPromedio:  0.72,
    variacionOcupacion: 5.3,
    totalPasajeros:     412,
    variacionPasajeros: 38,
    asientosLiquidados: 498.75,
  },
  departamentos: [
    { name: "Ingeniería",    viajes: 42, asientosUsados: 187, asientosVacios: 23.50, total: 210.50 },
    { name: "Logística",     viajes: 28, asientosUsados: 124, asientosVacios: 15.20, total: 139.20 },
    { name: "Mantenimiento", viajes: 17, asientosUsados: 101, asientosVacios: 12.50, total: 113.50 },
  ],
  destacados: {
    masViajes:      { name: "Ingeniería",    viajes: 42, asientos: 187 },
    mejorOcupacion: { name: "Mantenimiento", ocupacion: 89.0 },
  },
  operacion: {
    lanchasActivas: 5,
    conductores:    8,
    cancelaciones:  3,
  },
};

async function main() {
  const html    = await render(EmailMensualAdmin(mockProps));
  const outPath = path.join(process.cwd(), "preview-email-admin.html");
  fs.writeFileSync(outPath, html, "utf-8");

  console.log("[preview-email-admin] ✓ HTML generado en:", outPath);
  console.log("[preview-email-admin] Abrí el archivo en tu browser para ver el preview.");
}

main().catch((err: unknown) => {
  console.error("[preview-email-admin] ✗ Error:", err);
  process.exit(1);
});
