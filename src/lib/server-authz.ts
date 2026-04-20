import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  return { supabase, user, response: null };
}

export async function requireOwnedShop(shopId?: string | null) {
  const context = await getAuthenticatedContext();
  if (context.response) return { ...context, shop: null };

  let query = context.supabase
    .from("shops")
    .select("id, owner_id")
    .eq("owner_id", context.user.id);

  if (shopId) query = query.eq("id", shopId);

  const { data: shop, error } = await query.single();

  if (error || !shop) {
    return {
      ...context,
      shop: null,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }

  return { ...context, shop, response: null };
}
