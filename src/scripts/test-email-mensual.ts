import { sendEmailMensualDepartamento } from "../services/email.service";

const email = process.argv[2];

if (!email) {
  console.error("Uso: npm run email:test -- tuemail@gmail.com");
  process.exit(1);
}

const mockParams = {
  departamento:       "Ingeniería",
  email,
  mes:                "Abril 2026",
  totalViajes:        42,
  asientosUsados:     187,
  asientosVacios:     23.5,
  totalAsientos:      210.5,
  variacionAsientos:  15,
  companyName:        "UABL Puerto Rosario",
};

console.log("[test-email-mensual] Enviando email de prueba a:", email);
console.log("[test-email-mensual] Datos mock:", JSON.stringify(mockParams, null, 2));

sendEmailMensualDepartamento(mockParams)
  .then(() => {
    console.log("[test-email-mensual] ✓ Email enviado exitosamente");
  })
  .catch((err: unknown) => {
    console.error("[test-email-mensual] ✗ Error al enviar:", err);
    process.exit(1);
  });
