import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { requireOwnedActiveShop } from "@/lib/server-authz";
import { createAdminClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

const LABELS: Record<string, string> = {
  reminder: "Recordatorio de cita",
  confirmation: "ConfirmaciÃÂÃÂ³n de reserva",
  cancellation: "CancelaciÃÂÃÂ³n de cita",
};

function buildEmailHtml({
  type,
  clientName,
  shopName,
  barberName,
  serviceName,
  date,
  startTime,
  shopSlug,
}: {
  type: string;
  clientName: string;
  shopName: string;
  barberName: string;
  serviceName: string;
  date: string;
  startTime: string;
  shopSlug: string;
}) {
  const formattedDate = format(new Date(date + "T12:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es });
  const formattedTime = startTime.slice(0, 5);
  const subject = LABELS[type] || "NotificaciÃÂÃÂ³n de iBarber";
  const isReminder = type === "reminder";
  const isCancellation = type === "cancellation";

  const color = isCancellation ? "#ef4444" : "#0d9488";
  const emoji = isCancellation ? "ÃÂ¢ÃÂÃÂ" : isReminder ? "ÃÂ¢ÃÂÃÂ°" : "ÃÂ¢ÃÂÃÂ";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <tr><td style="background:${color};padding:28px 32px;text-align:center">
          <p style="margin:0;font-size:32px">${emoji}</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:700">${subject}</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:14px">${shopName}</p>
        </td></tr>
        <tr><td style="padding:28px 32px">
          <p style="margin:0 0 20px;color:#374151;font-size:15px">Hola <strong>${clientName}</strong>,</p>
          ${isCancellation
            ? `<p style="margin:0 0 20px;color:#374151;font-size:15px">Tu cita ha sido cancelada. Si tienes preguntas, contÃÂÃÂ¡ctanos.</p>`
            : `<p style="margin:0 0 20px;color:#374151;font-size:15px">${isReminder ? "Te recordamos que tienes una cita prÃÂÃÂ³ximamente:" : "Tu reserva ha sido confirmada:"}</p>`
          }
          <table width="100%" style="background:#f9fafb;border-radius:8px;padding:16px" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0"><span style="color:#6b7280;font-size:13px">Barbero</span><br><strong style="color:#111827;font-size:15px">${barberName}</strong></td></tr>
            <tr><td style="padding:6px 0"><span style="color:#6b7280;font-size:13px">Servicio</span><br><strong style="color:#111827;font-size:15px">${serviceName}</strong></td></tr>
            <tr><td style="padding:6px 0"><span style="color:#6b7280;font-size:13px">Fecha</span><br><strong style="color:#111827;font-size:15px">${formattedDate}</strong></td></tr>
            <tr><td style="padding:6px 0"><span style="color:#6b7280;font-size:13px">Hora</span><br><strong style="color:#111827;font-size:15px">${formattedTime}</strong></td></tr>
          </table>
          ${!isCancellation ? `
          <div style="text-align:center;margin-top:24px">
            <a href="https://ibarber.app/${shopSlug}" style="background:${color};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Ver mi reserva</a>
          </div>` : ""}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center">
          <p style="margin:0;color:#9ca3af;font-size:12px">Powered by <a href="https://ibarber.app" style="color:#0d9488;text-decoration:none">iBarber</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
  const context = await requireOwnedActiveShop();
  if (context.response) return context.response;

  const parsed = sendSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos invÃÂÃÂ¡lidos" }, { status: 400 });

  const admin = await createAdminClient();

  const { data: booking } = await admin
    .from("bookings")
    .select("id, date, start_time, shop_id, client_id, barbers(display_name), services(name)")
    .eq("id", parsed.data.booking_id)
    .eq("shop_id", context.shop.id)
    .single();

  if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

  const { data: clientData } = await admin
    .from("clients")
    .select("id, name, user_id")
    .eq("id", booking.client_id)
    .single();

  let recipientEmail: string | null = null;
  const recipientName = clientData?.name || "Cliente";

  if (clientData?.user_id) {
    const { data: userData } = await admin.auth.admin.getUserById(clientData.user_id);
    recipientEmail = userData?.user?.email || null;
  }

  let status = "failed";
  let errorMessage: string | null = null;
  let sentAt: string | null = null;

  if (recipientEmail && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const barberName = (booking.barbers as unknown as { display_name: string } | null)?.display_name || "Tu barbero";
      const serviceName = (booking.services as unknown as { name: string } | null)?.name || "Servicio";
      const subject = LABELS[parsed.data.type] || "NotificaciÃÂÃÂ³n de iBarber";

      const html = buildEmailHtml({
        type: parsed.data.type,
        clientName: recipientName,
        shopName: (context.shop as unknown as { name: string }).name,
        barberName,
        serviceName,
        date: booking.date as string,
        startTime: booking.start_time as string,
        shopSlug: (context.shop as unknown as { name: string; slug: string }).slug,
      });

      const result = await resend.emails.send({
        from: `${(context.shop as unknown as { name: string; slug: string }).name} <onboarding@resend.dev>`,
        to: recipientEmail,
        subject,
        html,
      });

      if (result.error) throw new Error(result.error.message);
      status = "sent";
      sentAt = new Date().toISOString();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Error desconocido";
      status = "failed";
    }
  } else if (!recipientEmail) {
    errorMessage = "No se encontrÃÂÃÂ³ email del cliente";
  } else {
    errorMessage = "RESEND_API_KEY no configurada";
  }

  const { data: notification, error: insertError } = await admin
    .from("email_notifications")
    .insert({
      shop_id: context.shop.id,
      booking_id: parsed.data.booking_id,
      client_id: booking.client_id,
      type: parsed.data.type,
      status,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      sent_at: sentAt,
      error_message: errorMessage,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  if (status === "failed") {
    return NextResponse.json({ error: errorMessage, notification }, { status: 500 });
  }

  return NextResponse.json({ success: true, notification, recipientEmail });
}
