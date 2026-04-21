import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UpdateInfoSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido").max(60),
  lastName:  z.string().min(1, "El apellido es requerido").max(60),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateInfoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { firstName, lastName } = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { firstName, lastName },
  });

  return NextResponse.json({ ok: true, firstName, lastName });
}
