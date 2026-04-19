import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IS_DEMO, demoShop, demoBarbers, demoServices, demoClient } from "@/lib/demo-data";
import BookingFlow from "./booking-flow";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ barber?: string }>;
}

export const metadata = { title: "Reservar cita" };

export default async function ReservarPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { barber: preselectedBarber } = await searchParams;

  if (IS_DEMO) {
    const shop = {
      ...demoShop,
      slug,
      barbers: demoBarbers,
      services: demoServices,
    };
    return (
      <BookingFlow
        shop={shop as Parameters<typeof BookingFlow>[0]["shop"]}
        client={demoClient}
        preselectedBarberId={preselectedBarber}
      />
    );
  }

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("*, barbers(*), services(*)")
    .eq("slug", slug)
    .eq("services.is_active", true)
    .single();

  if (!shop) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect(`/login?redirect=/${slug}/reservar${preselectedBarber ? `?barber=${preselectedBarber}` : ""}`);
  }

  let { data: client } = await supabase
    .from("clients").select("*").eq("user_id", user!.id).single();

  if (!client) {
    const { data: newClient } = await supabase
      .from("clients")
      .insert({ user_id: user!.id, name: user!.user_metadata?.full_name || user!.email || "Cliente" })
      .select().single();
    client = newClient;
  }

  if (!client) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }

  return (
    <BookingFlow
      shop={shop}
      client={client!}
      preselectedBarberId={preselectedBarber}
    />
  );
}
