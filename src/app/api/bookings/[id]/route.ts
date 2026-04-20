import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["pending", "confirmed", "rescheduled", "completed", "no_show", "cancelled"]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  // Solo el dueño del shop puede actualizar
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, barber_id, shop_id, date, start_time, end_time, shops!inner(owner_id)")
    .eq("id", id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const bookingShop = booking.shops as unknown as { owner_id: string } | Array<{ owner_id: string }> | null;
  const ownerId = Array.isArray(bookingShop) ? bookingShop[0]?.owner_id : bookingShop?.owner_id;
  if (ownerId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const nextDate = parsed.data.date || booking.date;
  const nextStart = parsed.data.start_time || booking.start_time;
  const nextEnd = parsed.data.end_time || booking.end_time;

  if (parsed.data.date || parsed.data.start_time || parsed.data.end_time) {
    const { data: conflict } = await supabase
      .from("bookings")
      .select("id")
      .eq("barber_id", booking.barber_id)
      .eq("date", nextDate)
      .neq("id", id)
      .not("status", "in", '("cancelled","no_show")')
      .or(`and(start_time.lt.${nextEnd},end_time.gt.${nextStart})`)
      .single();

    if (conflict) {
      return NextResponse.json({ error: "El horario ya está ocupado" }, { status: 409 });
    }
  }

  const patch = {
    ...parsed.data,
    status:
      parsed.data.status ||
      (parsed.data.date || parsed.data.start_time || parsed.data.end_time ? "rescheduled" : undefined),
  };

  const { error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
