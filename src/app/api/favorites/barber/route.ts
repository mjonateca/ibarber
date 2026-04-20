import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/server-authz";

const schema = z.object({ barber_id: z.string().uuid() });

async function getClient(context: Awaited<ReturnType<typeof getAuthenticatedContext>>) {
  if (!context.user) return null;
  const { data } = await context.supabase
    .from("clients")
    .select("id")
    .eq("user_id", context.user.id)
    .single();
  return data;
}

export async function POST(request: Request) {
  const context = await getAuthenticatedContext();
  if (context.response) return context.response;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const client = await getClient(context);
  if (!client) return NextResponse.json({ error: "Perfil de cliente no encontrado" }, { status: 404 });

  const { error } = await context.supabase
    .from("favorite_barbers")
    .upsert({ client_id: client.id, barber_id: parsed.data.barber_id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const context = await getAuthenticatedContext();
  if (context.response) return context.response;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const client = await getClient(context);
  if (!client) return NextResponse.json({ error: "Perfil de cliente no encontrado" }, { status: 404 });

  const { error } = await context.supabase
    .from("favorite_barbers")
    .delete()
    .eq("client_id", client.id)
    .eq("barber_id", parsed.data.barber_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
