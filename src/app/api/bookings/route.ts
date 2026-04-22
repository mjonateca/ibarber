import { NextResponse } from "next/server";
import { ensureAccountRecords } from "@/lib/account-repair";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createBookingSchema = z.object({
  barber_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  service_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

type OpeningHoursValue = Record<string, { open: string; close: string; closed: boolean }>;

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function weekdayKey(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][date.getDay()];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const account = await ensureAccountRecords(user);

  if (account.role !== "client") {
    return NextResponse.json(
      { error: "Solo una cuenta cliente puede crear reservas" },
      { status: 403 }
    );
  }

  const client = account.client;

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

  const [{ data: shop }, { data: barber }, { data: service }] = await Promise.all([
    admin
      .from("shops")
      .select("id, is_active, opening_hours")
      .eq("id", parsed.data.shop_id)
      .maybeSingle(),
    admin
      .from("barbers")
      .select("id, shop_id, is_active")
      .eq("id", parsed.data.barber_id)
      .maybeSingle(),
    admin
      .from("services")
      .select("id, shop_id, is_active, is_visible")
      .eq("id", parsed.data.service_id)
      .maybeSingle(),
  ]);

  if (!shop?.is_active) {
    return NextResponse.json({ error: "Barbería no disponible" }, { status: 404 });
  }

  if (!barber?.is_active || barber.shop_id !== parsed.data.shop_id) {
    return NextResponse.json(
      { error: "Barbero no disponible en esta barbería" },
      { status: 409 }
    );
  }

  if (!service?.is_active || service.is_visible === false || service.shop_id !== parsed.data.shop_id) {
    return NextResponse.json(
      { error: "Servicio no disponible en esta barbería" },
      { status: 409 }
    );
  }

  const { data: assignedServices } = await admin
    .from("barber_services")
    .select("service_id")
    .eq("barber_id", parsed.data.barber_id);

  const hasExplicitAssignments = Boolean(assignedServices?.length);
  const compatible = !hasExplicitAssignments ||
    assignedServices?.some((item) => item.service_id === parsed.data.service_id);

  if (!compatible) {
    return NextResponse.json(
      { error: "El barbero seleccionado no ofrece ese servicio" },
      { status: 409 }
    );
  }

  if (timeToMinutes(parsed.data.end_time) <= timeToMinutes(parsed.data.start_time)) {
    return NextResponse.json({ error: "Horario inválido" }, { status: 400 });
  }

  const openingHours = (shop.opening_hours || {}) as OpeningHoursValue;
  const daySchedule = openingHours[weekdayKey(parsed.data.date)];
  if (daySchedule?.closed) {
    return NextResponse.json({ error: "La barbería está cerrada ese día" }, { status: 409 });
  }

  if (
    daySchedule &&
    (timeToMinutes(parsed.data.start_time.slice(0, 5)) < timeToMinutes(daySchedule.open) ||
      timeToMinutes(parsed.data.end_time.slice(0, 5)) > timeToMinutes(daySchedule.close))
  ) {
    return NextResponse.json({ error: "La hora elegida está fuera del horario de la barbería" }, { status: 409 });
  }

  const { data: conflict } = await admin
    .from("bookings")
    .select("id")
    .eq("barber_id", parsed.data.barber_id)
    .eq("date", parsed.data.date)
    .not("status", "in", '("cancelled","no_show")')
    .or(`and(start_time.lt.${parsed.data.end_time},end_time.gt.${parsed.data.start_time})`)
    .limit(1)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json(
      { error: "El horario ya no está disponible" },
      { status: 409 }
    );
  }

  const { data: booking, error } = await admin
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
    const message = error.message.includes("no_overlap")
      ? "El horario ya no está disponible"
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
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
  const status = searchParams.get("status");
  const barberId = searchParams.get("barber_id");

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
  if (status) {
    query = query.eq("status", status);
  }
  if (barberId) {
    query = query.eq("barber_id", barberId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
