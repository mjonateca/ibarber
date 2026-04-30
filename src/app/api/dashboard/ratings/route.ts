import { NextResponse } from "next/server";
import { requireOwnedActiveShop } from "@/lib/server-authz";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const context = await requireOwnedActiveShop();
  if (context.response) return context.response;

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("barber_ratings")
    .select("*")
    .eq("shop_id", context.shop.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
