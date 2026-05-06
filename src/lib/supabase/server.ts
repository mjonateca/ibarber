import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookiesToSet = Array<{ name: string; value: string; options?: Record<string, unknown> }>;

const APP_BUSINESS_TYPE = "barber";

export async function createClient() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies set in middleware
          }
        },
      },
    }
  );

  return new Proxy(supabase, {
    get(target, prop, receiver) {
      if (prop !== "from") return Reflect.get(target, prop, receiver);

      return (relation: string) => {
        const query = target.from(relation);
        if (relation !== "shops") return query;

        return new Proxy(query, {
          get(queryTarget, queryProp, queryReceiver) {
            if (queryProp !== "select") return Reflect.get(queryTarget, queryProp, queryReceiver);

            return (...args: Parameters<typeof queryTarget.select>) =>
              queryTarget.select(...args).eq("business_type", APP_BUSINESS_TYPE);
          },
        });
      };
    },
  }) as typeof supabase;
}

export async function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  );
}
