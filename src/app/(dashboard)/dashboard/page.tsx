import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import DashboardClient from "./dashboard-client";
import { IS_DEMO, demoShop, demoBookings } from "@/lib/demo-data";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const todayStr = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  // --- MODO DEMO ---
  if (IS_DEMO) {
    return (
      <DashboardClient
        shop={demoShop}
        todayBookings={demoBookings}
        stats={{ totalCompleted: 47, upcomingConfirmed: 8 }}
        todayStr={todayStr}
      />
    );
  }

  // --- MODO REAL ---
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shopData } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  const shop = shopData as import("@/types/database").Shop | null;
  if (!shop) redirect("/onboarding");

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayBookingsRaw } = await supabase
    .from("bookings")
    .select(`*, clients(name, phone, whatsapp), barbers(display_name), services(name, duration_min, price)`)
    .eq("shop_id", shop.id)
    .eq("date", today)
    .not("status", "in", '("cancelled","no_show")')
    .order("start_time");

  type BWR = import("./dashboard-client").BookingWithRelations;
  const todayBookings = (todayBookingsRaw || []) as unknown as BWR[];

  const { count: totalBookings } = await supabase
    .from("bookings").select("*", { count: "exact", head: true })
    .eq("shop_id", shop.id).eq("status", "completed");

  const { count: pendingBookings } = await supabase
    .from("bookings").select("*", { count: "exact", head: true })
    .eq("shop_id", shop.id).eq("status", "confirmed").gte("date", today);

  return (
    <DashboardClient
      shop={shop}
      todayBookings={todayBookings}
      stats={{ totalCompleted: totalBookings || 0, upcomingConfirmed: pendingBookings || 0 }}
      todayStr={todayStr}
    />
  );
}
