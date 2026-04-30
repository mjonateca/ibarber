import { redirect } from "next/navigation";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import type { Metadata } from "next";
import type { Barber, BarberRating, Client, ClientPaymentMethod, EmailNotification, Profile, Service, Shop, ShopPaymentMethod, ShopSubscription } from "@/types/database";
import { ensureAccountRecords } from "@/lib/account-repair";
import { IS_DEMO, demoBookings, demoShop } from "@/lib/demo-data";
import { buildShopAnalytics } from "@/lib/shop-analytics";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import BarberDashboardClient from "./barber-dashboard-client";
import ClientDashboardClient from "./client-dashboard-client";
import DashboardClient from "./dashboard-client";

export const metadata: Metadata = { title: "Dashboard" };

type DashboardPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const todayStr = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const { tab } = await searchParams;
  const initialTab = tab || "summary";

  if (IS_DEMO) {
    return (
      <DashboardClient
        shop={demoShop}
        todayBookings={demoBookings}
        bookings={demoBookings}
        services={[]}
        barbers={[]}
        clients={[]}
        notificationEvents={[]}
        ratings={[]}
        emailNotifications={[]}
        subscription={null}
        paymentMethods={[]}
        analytics={{
          totalsByStatus: { total: demoBookings.length, confirmed: 8, pending: 2, cancelled: 1, completed: 47 },
          estimatedRevenue: 18500,
          realizedRevenue: 12600,
          avgServiceTime: 38,
          avgTicket: 520,
          recurrentClients: 9,
          topServices: [],
          topBarbers: [],
          bestBarbers: [],
          peakHours: [],
          peakWeekdays: [],
          evolutions: { day: [], week: [], month: [] },
          avgLeadMinutes: 38,
        }}
        stats={{ totalCompleted: 47, upcomingConfirmed: 8, expectedToday: 3250, expectedWeek: 18500 }}
        todayStr={todayStr}
        initialTab={initialTab}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const account = await ensureAccountRecords(user);
  const typedProfile = account.profile as Profile | null;
  const admin = await createAdminClient();

  if (typedProfile?.role === "client") {
    const client = account.client as Client | null;
    if (!client) redirect("/");

    const [{ data: shopsRaw }, { data: favShops }, { data: favBarbers }, { data: bookingsRaw }, { data: paymentMethodsRaw }] = await Promise.all([
      admin
        .from("shops")
        .select("*, barbers(id, display_name, rating), services(*)")
        .eq("is_active", true)
        .order("city")
        .order("name")
        .limit(40),
      admin.from("favorite_shops").select("shop_id").eq("client_id", client.id),
      admin.from("favorite_barbers").select("barber_id").eq("client_id", client.id),
      admin
        .from("bookings")
        .select("*, shops(name, slug), barbers(display_name), services(name, price, currency), reviews(id)")
        .eq("client_id", client.id)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(20),
      admin.from("client_payment_methods").select("*").eq("client_id", client.id).order("is_default", { ascending: false }),
    ]);

    const shops = ((shopsRaw || []) as Array<Shop & { barbers?: Barber[]; services?: Service[] }>)
      .filter((shop) => shop.country_code === typedProfile.country_code || !shop.country_code)
      .sort((a, b) => {
        const aCity = a.city?.toLowerCase() === typedProfile.city.toLowerCase() ? 0 : 1;
        const bCity = b.city?.toLowerCase() === typedProfile.city.toLowerCase() ? 0 : 1;
        return aCity - bCity;
      });

    return (
      <ClientDashboardClient
        profile={typedProfile}
        client={client}
        shops={shops}
        favoriteShopIds={(favShops || []).map((item) => item.shop_id)}
        favoriteBarberIds={(favBarbers || []).map((item) => item.barber_id)}
        bookings={(bookingsRaw || []) as never}
        paymentMethods={(paymentMethodsRaw || []) as ClientPaymentMethod[]}
        initialTab={initialTab}
      />
    );
  }

  if (typedProfile?.role === "barber") {
    const { data: barberData } = await admin
      .from("barbers")
      .select("*, shops(*), barber_services(service_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const barber = barberData as (Barber & { shops?: Shop | null; barber_services?: Array<{ service_id: string }> }) | null;
    if (!barber) redirect("/");

    const today = format(new Date(), "yyyy-MM-dd");
    const weekEnd = format(addDays(new Date(), 7), "yyyy-MM-dd");

    const [{ data: todayBookingsRaw }, { data: upcomingBookingsRaw }, { data: servicesRaw }] = await Promise.all([
      admin
        .from("bookings")
        .select("*, clients(name, phone, whatsapp), shops(name, slug), services(name, price, currency)")
        .eq("barber_id", barber.id)
        .eq("date", today)
        .not("status", "in", '("cancelled","no_show")')
        .order("start_time"),
      admin
        .from("bookings")
        .select("*, clients(name, phone, whatsapp), shops(name, slug), services(name, price, currency)")
        .eq("barber_id", barber.id)
        .gte("date", today)
        .lte("date", weekEnd)
        .not("status", "in", '("cancelled","no_show")')
        .order("date")
        .order("start_time"),
      barber.barber_services?.length
        ? admin.from("services").select("*").in("id", barber.barber_services.map((item) => item.service_id))
        : Promise.resolve({ data: [] }),
    ]);

    const todayBookings = (todayBookingsRaw || []) as Array<{ services?: { price?: number | null } | null }>;
    const expectedToday = todayBookings.reduce((sum, booking) => sum + Number(booking.services?.price || 0), 0);

    return (
      <BarberDashboardClient
        barber={barber}
        services={(servicesRaw || []) as Service[]}
        todayBookings={(todayBookingsRaw || []) as never}
        upcomingBookings={(upcomingBookingsRaw || []) as never}
        expectedToday={expectedToday}
        initialTab={initialTab}
      />
    );
  }

  const { data: shopData } = await admin.from("shops").select("*").eq("owner_id", user.id).single();
  const shop = shopData as Shop | null;
  if (!shop) redirect("/onboarding");

  const today = format(new Date(), "yyyy-MM-dd");
  const weekEnd = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const [
    { data: todayBookingsRaw },
    { data: bookingsRaw },
    { count: totalBookings },
    { count: pendingBookings },
    { data: weekBookingsRaw },
    { data: subscriptionRaw },
    { data: paymentMethodsRaw },
  ] =
    await Promise.all([
      admin
        .from("bookings")
        .select("*, clients(name, phone, whatsapp), barbers(display_name), services(name, duration_min, price)")
        .eq("shop_id", shop.id)
        .eq("date", today)
        .not("status", "in", '("cancelled","no_show")')
        .order("start_time"),
      admin
        .from("bookings")
        .select("*, clients(name, phone, whatsapp), barbers(display_name), services(name, duration_min, price)")
        .eq("shop_id", shop.id)
        .gte("date", today)
        .not("status", "in", '("cancelled","no_show")')
        .order("date")
        .order("start_time")
        .limit(100),
      admin.from("bookings").select("*", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "completed"),
      admin.from("bookings").select("*", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "confirmed").gte("date", today),
      admin
        .from("bookings")
        .select("date, services(price)")
        .eq("shop_id", shop.id)
        .gte("date", today)
        .lte("date", weekEnd)
        .not("status", "in", '("cancelled","no_show")'),
      admin.from("shop_subscriptions").select("*").eq("shop_id", shop.id).maybeSingle(),
      admin.from("shop_payment_methods").select("*").eq("shop_id", shop.id).order("is_default", { ascending: false }),
    ]);

  type BookingWithRelations = import("./dashboard-client").BookingWithRelations;
  const todayBookings = (todayBookingsRaw || []) as unknown as BookingWithRelations[];
  const bookings = (bookingsRaw || []) as unknown as BookingWithRelations[];
  const clientIds = [...new Set(bookings.map((booking) => booking.client_id).filter(Boolean))];

  const expectedToday = todayBookings.reduce((sum, booking) => sum + Number(booking.services?.price || 0), 0);
  const expectedWeek = ((weekBookingsRaw || []) as Array<{ services?: { price?: number | null } | null }>).reduce(
    (sum, booking) => sum + Number(booking.services?.price || 0),
    0
  );
  const analytics = buildShopAnalytics(bookings as never);

  const [{ data: services }, { data: barbers }, { data: clients }, { data: notificationEvents }, { data: ratingsRaw }, { data: emailNotificationsRaw }] = await Promise.all([
    admin.from("services").select("*").eq("shop_id", shop.id).order("sort_order").order("name"),
    admin.from("barbers").select("*, barber_services(service_id)").eq("shop_id", shop.id).order("display_name"),
    clientIds.length
      ? admin.from("clients").select("id,name,phone,whatsapp,city,country_name").in("id", clientIds).limit(100)
      : Promise.resolve({ data: [] }),
    admin.from("notification_events").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(20),
    admin.from("barber_ratings").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(200),
    admin.from("email_notifications").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <DashboardClient
      shop={shop}
      todayBookings={todayBookings}
      bookings={bookings}
      services={(services || []) as never}
      barbers={(barbers || []) as never}
      clients={(clients || []) as never}
      notificationEvents={(notificationEvents || []) as never}
      ratings={(ratingsRaw || []) as BarberRating[]}
      emailNotifications={(emailNotificationsRaw || []) as EmailNotification[]}
      subscription={subscriptionRaw as ShopSubscription | null}
      paymentMethods={(paymentMethodsRaw || []) as ShopPaymentMethod[]}
      analytics={analytics}
      stats={{
        totalCompleted: totalBookings || 0,
        upcomingConfirmed: pendingBookings || 0,
        expectedToday,
        expectedWeek,
      }}
      todayStr={todayStr}
      initialTab={initialTab}
    />
  );
}
