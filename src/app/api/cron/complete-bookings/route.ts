import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createAdminClient();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);

  // Bookings from past days
  const { data: pastData } = await admin
    .from("bookings")
    .update({ status: "completed" })
    .in("status", ["confirmed", "pending"])
    .lt("date", todayStr)
    .select("id");

  // Today's bookings whose end_time has passed
  const { data: todayData } = await admin
    .from("bookings")
    .update({ status: "completed" })
    .in("status", ["confirmed", "pending"])
    .eq("date", todayStr)
    .lt("end_time", timeStr)
    .select("id");

  const total = (pastData?.length || 0) + (todayData?.length || 0);
  console.log(`[cron] Completed ${total} bookings`);
  return NextResponse.json({ completed: total });
}
