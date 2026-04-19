import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createBookingSchema = z.object({
  barber_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  service_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Obtener perfil de cliente
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Perfil de cliente no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = createBookingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verificar disponibilidad
  const { data: conflict } = await supabase
    .from("bookings")
    .select("id")
    .eq("barber_id", parsed.data.barber_id)
    .eq("date", parsed.data.date)
    .not("status", "in", '("cancelled","no_show")')
    .or(
      `and(start_time.lte.${parsed.data.end_time},end_time.gt.${parsed.data.start_time})`
    )
    .single();

  if (conflict) {
    return NextResponse.json(
      { error: "El horario ya no está disponible" },
      { status: 409 }
    );
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      client_id: client.id,
      ...parsed.data,
      status: "confirmed",
      deposit_status: "none",
      deposit_amount: 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(booking, { status: 201 });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get("shop_id");
  const date = searchParams.get("date");

  if (!shopId) {
    return NextResponse.json({ error: "shop_id requerido" }, { status: 400 });
  }

  // Verificar que el usuario es dueño del shop
  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_id", user.id)
    .single();

  if (!shop) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let query = supabase
    .from("bookings")
    .select(`
      *,
      clients(name, phone, whatsapp),
      barbers(display_name),
      services(name, duration_min, price)
    `)
    .eq("shop_id", shopId)
    .order("date")
    .order("start_time");

  if (date) {
    query = query.eq("date", date);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
