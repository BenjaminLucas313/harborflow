import { render } from "@react-email/render";
import * as fs from "fs";
import * as path from "path";

import { EmailMensualDepartamento } from "../emails/EmailMensualDepartamento";

process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const mockProps = {
  departamento:       "Ingeniería",
  mes:                "Abril 2026",
  totalViajes:        42,
  asientosUsados:     187,
  asientosVacios:     23.5,
  totalAsientos:      210.5,
  variacionAsientos:  15,
  companyName:        "UABL Puerto Rosario",
};

async function main() {
  const html = await render(EmailMensualDepartamento(mockProps));

  const outPath = path.join(process.cwd(), "preview-email-mensual.html");
  fs.writeFileSync(outPath, html, "utf-8");

  console.log("[preview-email-mensual] ✓ HTML generado en:", outPath);
  console.log("[preview-email-mensual] Abrí el archivo en tu browser para ver el preview.");
}

main().catch((err: unknown) => {
  console.error("[preview-email-mensual] ✗ Error:", err);
  process.exit(1);
});
