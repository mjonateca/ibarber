import Link from "next/link";
import { MapPin, Scissors, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { IS_DEMO, demoShop } from "@/lib/demo-data";
import { COUNTRIES, getCitiesForCountry } from "@/lib/locations";
import { Button } from "@/components/ui/button";

interface Props {
  searchParams: Promise<{ country?: string; city?: string }>;
}

type ListedShop = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  description: string | null;
  is_active?: boolean | null;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedCountry = params.country || "DO";
  const selectedCity = params.city || "Santo Domingo";
  const cities = getCitiesForCountry(selectedCountry);

  let shops: ListedShop[] = [];

  if (IS_DEMO) {
    shops = [{ ...demoShop }];
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("shops")
      .select("*")
      .order("city", { ascending: true })
      .order("name", { ascending: true })
      .limit(24);

    const all = (data || []) as ListedShop[];
    const active = all.filter((shop) => shop.is_active !== false);
    const countryMatches = active.filter(
      (shop) => !shop.country_code || shop.country_code === selectedCountry
    );
    shops = [
      ...countryMatches.filter((shop) => shop.city?.toLowerCase() === selectedCity.toLowerCase()),
      ...countryMatches.filter((shop) => shop.city?.toLowerCase() !== selectedCity.toLowerCase()),
    ];
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="px-4 py-8 md:py-12 border-b">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className="bg-primary rounded-lg p-3">
                <Scissors className="h-7 w-7 text-white" />
              </div>
              <span className="text-3xl font-bold">iBarber</span>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link href="/login">Iniciar sesión</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Registrarse</Link>
              </Button>
            </div>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              Reserva tu corte cerca de ti
            </h1>
            <p className="text-muted-foreground text-lg mb-6">
              Encuentra barberías por ciudad, elige servicio, barbero y hora disponible.
            </p>
          </div>

          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] max-w-3xl">
            <select
              name="country"
              defaultValue={selectedCountry}
              className="h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <select
              name="city"
              defaultValue={selectedCity}
              className="h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <Button type="submit">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </form>
        </div>
      </section>

      <section className="px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-semibold">Barberías relevantes</h2>
              <p className="text-sm text-muted-foreground">
                Primero aparecen las barberías en {selectedCity}.
              </p>
            </div>
            <Link href="/register" className="text-sm font-medium text-primary hover:underline">
              Registrar cuenta
            </Link>
          </div>

          {shops.length === 0 ? (
            <div className="rounded-xl border p-8 text-center text-muted-foreground">
              Todavía no hay barberías activas en esta zona.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {shops.map((shop) => (
                <Link
                  key={shop.id}
                  href={`/${shop.slug}`}
                  className="rounded-xl border bg-card p-5 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-semibold">{shop.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {shop.city || "Ciudad"} · {shop.country_name || shop.country_code}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {shop.description || shop.address || "Agenda disponible para reservas."}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
