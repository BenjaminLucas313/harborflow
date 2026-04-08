// HarborFlow — Email notification service.
//
// All notification functions are fire-and-forget: callers must wrap them in
// .catch(() => {}) and NEVER await them inside a transaction. Delivery failure
// must never roll back a booking or review action.
//
// Uses Resend (https://resend.com) for transactional email delivery.
// Set RESEND_API_KEY and NOTIFICATIONS_FROM_EMAIL in .env to enable.
// If RESEND_API_KEY is absent, notifications are silently skipped (dev mode).

import { prisma } from "@/lib/prisma";

// Lazy-initialize Resend to avoid crashes when the key is not set.
async function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const { Resend } = await import("resend");
  return new Resend(apiKey);
}

const FROM = process.env.NOTIFICATIONS_FROM_EMAIL ?? "HarborFlow <no-reply@harborflow.app>";

// ---------------------------------------------------------------------------
// notifySlotAssigned
// Called when an EMPRESA assigns a USUARIO to a PassengerSlot.
// ---------------------------------------------------------------------------

export async function notifySlotAssigned(params: {
  toEmail:      string;
  toName:       string;
  slotId:       string;
  tripId:       string;
  workTypeName: string;
}): Promise<void> {
  const resend = await getResend();
  if (!resend) return;

  // Fetch trip details for the email body.
  const trip = await prisma.trip.findUnique({
    where:  { id: params.tripId },
    select: { departureTime: true, boat: { select: { name: true } } },
  });
  if (!trip) return;

  const deptTime = formatDateTime(trip.departureTime);

  await resend.emails.send({
    from:    FROM,
    to:      params.toEmail,
    subject: `Fuiste asignado a un viaje el ${deptTime}`,
    html:    `
      <p>Hola <strong>${params.toName}</strong>,</p>
      <p>Una empresa te asignó a un viaje pendiente de confirmación:</p>
      <ul>
        <li><strong>Embarcación:</strong> ${trip.boat.name}</li>
        <li><strong>Salida:</strong> ${deptTime}</li>
        <li><strong>Tipo de trabajo:</strong> ${params.workTypeName}</li>
      </ul>
      <p>Tu asignación está pendiente de confirmación por UABL. Te notificaremos cuando sea confirmada o rechazada.</p>
    `,
  });
}

// ---------------------------------------------------------------------------
// notifySlotReviewed
// Called when UABL confirms or rejects a PassengerSlot.
// Notifies both the USUARIO and the EMPRESA user who created the booking.
// ---------------------------------------------------------------------------

export async function notifySlotReviewed(params: {
  slotId:        string;
  usuarioEmail:  string;
  usuarioName:   string;
  tripId:        string;
  workTypeName:  string;
  status:        "CONFIRMED" | "REJECTED";
  rejectionNote?: string;
  groupBookingId: string;
}): Promise<void> {
  const resend = await getResend();
  if (!resend) return;

  const trip = await prisma.trip.findUnique({
    where:  { id: params.tripId },
    select: { departureTime: true, boat: { select: { name: true } } },
  });
  if (!trip) return;

  const booking = await prisma.groupBooking.findUnique({
    where:  { id: params.groupBookingId },
    select: { bookedBy: { select: { email: true, firstName: true, lastName: true } } },
  });

  const deptTime = formatDateTime(trip.departureTime);
  const isConfirmed = params.status === "CONFIRMED";

  const usuarioSubject = isConfirmed
    ? `Tu asignación al viaje del ${deptTime} fue confirmada`
    : `Tu asignación al viaje del ${deptTime} fue rechazada`;

  const usuarioBody = isConfirmed
    ? `
      <p>Hola <strong>${params.usuarioName}</strong>,</p>
      <p>Tu asignación al siguiente viaje fue <strong>confirmada</strong> por UABL:</p>
      <ul>
        <li><strong>Embarcación:</strong> ${trip.boat.name}</li>
        <li><strong>Salida:</strong> ${deptTime}</li>
        <li><strong>Tipo de trabajo:</strong> ${params.workTypeName}</li>
      </ul>
    `
    : `
      <p>Hola <strong>${params.usuarioName}</strong>,</p>
      <p>Tu asignación al siguiente viaje fue <strong>rechazada</strong> por UABL:</p>
      <ul>
        <li><strong>Embarcación:</strong> ${trip.boat.name}</li>
        <li><strong>Salida:</strong> ${deptTime}</li>
        <li><strong>Tipo de trabajo:</strong> ${params.workTypeName}</li>
        ${params.rejectionNote ? `<li><strong>Motivo:</strong> ${params.rejectionNote}</li>` : ""}
      </ul>
    `;

  const emailPromises: Promise<unknown>[] = [
    resend.emails.send({
      from:    FROM,
      to:      params.usuarioEmail,
      subject: usuarioSubject,
      html:    usuarioBody,
    }),
  ];

  // Also notify the EMPRESA coordinator.
  if (booking?.bookedBy) {
    const empresaName = `${booking.bookedBy.firstName} ${booking.bookedBy.lastName}`;
    const passengerLabel = `${params.usuarioName} (${params.workTypeName})`;

    emailPromises.push(
      resend.emails.send({
        from:    FROM,
        to:      booking.bookedBy.email,
        subject: isConfirmed
          ? `Pasajero confirmado: ${passengerLabel}`
          : `Pasajero rechazado: ${passengerLabel}`,
        html: isConfirmed
          ? `
            <p>Hola <strong>${empresaName}</strong>,</p>
            <p>El pasajero <strong>${params.usuarioName}</strong> (${params.workTypeName}) fue <strong>confirmado</strong> por UABL para el viaje del ${deptTime} en ${trip.boat.name}.</p>
          `
          : `
            <p>Hola <strong>${empresaName}</strong>,</p>
            <p>El pasajero <strong>${params.usuarioName}</strong> (${params.workTypeName}) fue <strong>rechazado</strong> por UABL para el viaje del ${deptTime} en ${trip.boat.name}.</p>
            ${params.rejectionNote ? `<p><strong>Motivo:</strong> ${params.rejectionNote}</p>` : ""}
          `,
      }),
    );
  }

  await Promise.allSettled(emailPromises);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(date: Date): string {
  return date.toLocaleString("es-AR", {
    timeZone:    "America/Argentina/Buenos_Aires",
    weekday:     "long",
    day:         "numeric",
    month:       "long",
    year:        "numeric",
    hour:        "2-digit",
    minute:      "2-digit",
  });
}
