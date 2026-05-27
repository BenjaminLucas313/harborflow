import { sendEmailMensualAdmin } from "../services/email.service";

const email = process.argv[2];

if (!email) {
  console.error("Uso: npm run email:test:admin -- tuemail@gmail.com");
  process.exit(1);
}

const mockParams = {
  mes:          "Abril 2026",
  companyName:  "UABL Puerto Rosario",
  emailDestino: email,
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

console.log("[test-email-admin] Enviando email de prueba a:", email);
console.log("[test-email-admin] Datos mock:", JSON.stringify({ ...mockParams, emailDestino: email }, null, 2));

sendEmailMensualAdmin(mockParams)
  .then(() => {
    console.log("[test-email-admin] ✓ Email enviado exitosamente");
  })
  .catch((err: unknown) => {
    console.error("[test-email-admin] ✗ Error al enviar:", err);
    process.exit(1);
  });
