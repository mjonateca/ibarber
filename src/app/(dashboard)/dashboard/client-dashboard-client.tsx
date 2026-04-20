"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CalendarDays, Heart, MapPin, Star, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type { BookingStatus, Client, Profile, Service, Shop } from "@/types/database";
import { formatTime } from "@/lib/utils";

type ListedShop = Shop & {
  barbers?: Array<{ id: string; display_name: string; rating: number | null }>;
  services?: Service[];
};

type ClientBooking = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  barber_id: string;
  shop_id: string;
  service_id: string;
  shops: { name: string; slug: string } | null;
  barbers: { display_name: string } | null;
  services: { name: string; price: number; currency: string } | null;
  reviews?: Array<{ id: string }>;
};

interface Props {
  profile: Profile;
  client: Client;
  shops: ListedShop[];
  favoriteShopIds: string[];
  favoriteBarberIds: string[];
  bookings: ClientBooking[];
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  rescheduled: "Reprogramada",
  completed: "Completada",
  no_show: "No se presentó",
  cancelled: "Cancelada",
};

export default function ClientDashboardClient({
  profile,
  client,
  shops,
  favoriteShopIds,
  favoriteBarberIds,
  bookings,
}: Props) {
  const [shopFavorites, setShopFavorites] = useState(new Set(favoriteShopIds));
  const [barberFavorites, setBarberFavorites] = useState(new Set(favoriteBarberIds));
  const [reviewedBookingIds, setReviewedBookingIds] = useState(
    new Set(bookings.filter((booking) => booking.reviews?.length).map((booking) => booking.id))
  );

  async function toggleFavorite(type: "shop" | "barber", id: string) {
    const current = type === "shop" ? shopFavorites : barberFavorites;
    const isFavorite = current.has(id);
    const response = await fetch(`/api/favorites/${type}`, {
      method: isFavorite ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(type === "shop" ? { shop_id: id } : { barber_id: id }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "No se pudo actualizar favorito" }));
      toast({ variant: "destructive", title: "Error", description: payload.error });
      return;
    }

    const next = new Set(current);
    if (isFavorite) next.delete(id);
    else next.add(id);
    if (type === "shop") setShopFavorites(next);
    else setBarberFavorites(next);
  }

  async function submitReview(event: FormEvent<HTMLFormElement>, booking: ClientBooking) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_id: booking.id,
        barber_id: booking.barber_id,
        rating: Number(form.get("rating")),
        comment: form.get("comment"),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ variant: "destructive", title: "No se guardó la reseña", description: payload.error });
      return;
    }

    setReviewedBookingIds((prev) => new Set(prev).add(booking.id));
    toast({ title: "Reseña guardada" });
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-7">
        <p className="text-sm text-muted-foreground">Vista cliente</p>
        <h1 className="text-2xl font-bold">{client.name || `${profile.first_name} ${profile.last_name || ""}`}</h1>
        <p className="text-muted-foreground">
          {profile.city} · {profile.country_name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Metric title="Reservas" value={bookings.length} />
        <Metric title="Barberías favoritas" value={shopFavorites.size} />
        <Metric title="Barberos favoritos" value={barberFavorites.size} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Barberías cerca de tu zona</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {shops.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay barberías activas en tu ciudad.</p>
            ) : (
              shops.map((shop) => (
                <div key={shop.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{shop.name}</h2>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {shop.city || "Sin ciudad"}
                      </p>
                    </div>
                    <button
                      aria-label="Favorito"
                      onClick={() => toggleFavorite("shop", shop.id)}
                      className="rounded-md border p-2"
                    >
                      <Heart className={`h-4 w-4 ${shopFavorites.has(shop.id) ? "fill-primary text-primary" : ""}`} />
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {shop.description || shop.address || "Agenda disponible."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/${shop.slug}/reservar`}>Reservar</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/${shop.slug}`}>Ver barbería</Link>
                    </Button>
                  </div>
                  {!!shop.barbers?.length && (
                    <div className="mt-3 space-y-2">
                      {shop.barbers.slice(0, 3).map((barber) => (
                        <button
                          key={barber.id}
                          onClick={() => toggleFavorite("barber", barber.id)}
                          className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <UserRound className="h-4 w-4" />
                            {barber.display_name}
                          </span>
                          <Heart className={`h-4 w-4 ${barberFavorites.has(barber.id) ? "fill-primary text-primary" : ""}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Mis reservas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tienes reservas.</p>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="rounded-lg border p-4">
                  <p className="font-medium">{booking.shops?.name || "Barbería"}</p>
                  <p className="text-sm text-muted-foreground">
                    <CalendarDays className="inline h-3.5 w-3.5 mr-1" />
                    {booking.date} · {formatTime(booking.start_time.slice(0, 5))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.services?.name} · {booking.barbers?.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{STATUS_LABELS[booking.status]}</p>

                  {booking.status === "completed" && !reviewedBookingIds.has(booking.id) && (
                    <form onSubmit={(event) => submitReview(event, booking)} className="mt-3 space-y-2">
                      <Label>Evaluar barbero</Label>
                      <select name="rating" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="5">
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <option key={rating} value={rating}>{rating} estrellas</option>
                        ))}
                      </select>
                      <textarea name="comment" className="min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Comentario opcional" />
                      <Button size="sm" type="submit">
                        <Star className="h-4 w-4 mr-1" />
                        Guardar reseña
                      </Button>
                    </form>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <Toaster />
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}
