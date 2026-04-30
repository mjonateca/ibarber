import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedActiveShop } from "@/lib/server-authz";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const context = await requireOwnedActiveShop();
  if (context.response) return context.response;

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("email_notifications")
    .select("*")
    .eq("shop_id", context.shop.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

const sendSchema = z.object({
  booking_id: z.string().uuid(),
  type: z.enum(["reminder", "confirmation", "cancellation"]).default("reminder"),
});

export async function POST(request: Request) {
  const context = await requireOwnedActiveShop();
  if (context.response) return context.response;

  const parsed = sendSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const admin = await createAdminClient();

  // Get booking + client email info
  const { data: booking } = await admin
    .from("bookings")
    .select("id, date, start_time, shop_id, client_id, clients(name, email:whatsapp), barbers(display_name), services(name)")
    .eq("id", parsed.data.booking_id)
    .eq("shop_id", context.shop.id)
    .single();

  if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

  // Get client profile email via user_id
  const { data: clientData } = await admin
    .from("clients")
    .select("id, name, user_id")
    .eq("id", booking.client_id)
    .single();

  let recipientEmail: string | null = null;
  let recipientName: string | null = null;

  if (clientData?.user_id) {
    const { data: userData } = await admin.auth.admin.getUserById(clientData.user_id);
    recipientEmail = userData?.user?.email || null;
    recipientName = clientData.name;
  }

  // Record the notification attempt
  const { data: notification, error: insertError } = await admin
    .from("email_notifications")
    .insert({
      shop_id: context.shop.id,
      booking_id: parsed.data.booking_id,
      client_id: booking.client_id,
      type: parsed.data.type,
      status: recipientEmail ? "sent" : "failed",
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      sent_at: recipientEmail ? new Date().toISOString() : null,
      error_message: recipientEmail ? null : "No se encontró email del cliente",
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // TODO: Integrate Resend/SendGrid here to actually send the email
  // Example: await resend.emails.send({ from: 'noreply@ibarber.app', to: recipientEmail, ... })

  return NextResponse.json({ success: true, notification, recipientEmail });
}
