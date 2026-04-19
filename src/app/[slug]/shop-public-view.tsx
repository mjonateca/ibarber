"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Star, Clock, Scissors } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Shop, Barber, Service } from "@/types/database";

interface BarberWithServices extends Barber {
  barber_services: Array<{ service_id: string }>;
}

interface ShopWithRelations extends Shop {
  barbers: BarberWithServices[];
  services: Service[];
}

interface Props {
  shop: ShopWithRelations;
}

export default function ShopPublicView({ shop }: Props) {
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);

  const activeServices = shop.services.filter((s) => s.is_active);
  const activeBarbers = shop.barbers;

  function getBarberServices(barber: BarberWithServices): Service[] {
    const serviceIds = new Set(barber.barber_services.map((bs) => bs.service_id));
    if (serviceIds.size === 0) return activeServices; // ofrece todos si no hay filtro
    return activeServices.filter((s) => serviceIds.has(s.id));
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header de la barbería */}
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-800 text-white">
        <div className="max-w-lg mx-auto px-4 pt-10 pb-8">
          <div className="flex items-start gap-4">
            {shop.logo_url ? (
              <Image
                src={shop.logo_url}
                alt={shop.name}
                width={72}
                height={72}
                className="rounded-2xl object-cover"
              />
            ) : (
              <div className="w-18 h-18 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Scissors className="h-8 w-8 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{shop.name}</h1>
              {shop.address && (
                <p className="flex items-center gap-1.5 text-sm text-zinc-300 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {shop.address}
                </p>
              )}
              {shop.phone && (
                <p className="flex items-center gap-1.5 text-sm text-zinc-300 mt-0.5">
                  <Phone className="h-3.5 w-3.5" />
                  {shop.phone}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Barberos */}
        {activeBarbers.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Nuestros barberos</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {activeBarbers.map((barber) => (
                <button
                  key={barber.id}
                  onClick={() =>
                    setSelectedBarber(
                      selectedBarber === barber.id ? null : barber.id
                    )
                  }
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    selectedBarber === barber.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3 overflow-hidden">
                    {barber.avatar_url ? (
                      <Image
                        src={barber.avatar_url}
                        alt={barber.display_name}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="text-xl font-bold text-muted-foreground">
                        {barber.display_name[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-sm leading-tight">
                    {barber.display_name}
                  </p>
                  {barber.rating > 0 && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {barber.rating.toFixed(1)}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Servicios */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Servicios</h2>
          <div className="space-y-2">
            {(selectedBarber
              ? getBarberServices(
                  activeBarbers.find((b) => b.id === selectedBarber)!
                )
              : activeServices
            ).map((service) => (
              <Card key={service.id} className="shadow-none">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                      <Clock className="h-3.5 w-3.5" />
                      {service.duration_min} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      {formatCurrency(service.price, service.currency)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Reservar */}
        <div className="pb-8">
          <Link
            href={
              selectedBarber
                ? `/${shop.slug}/reservar?barber=${selectedBarber}`
                : `/${shop.slug}/reservar`
            }
          >
            <Button size="lg" className="w-full text-base h-14 rounded-2xl shadow-lg">
              {selectedBarber ? "Reservar con este barbero" : "Reservar cita"}
            </Button>
          </Link>

          {shop.deposit_required && shop.deposit_amount > 0 && (
            <p className="text-xs text-center text-muted-foreground mt-3">
              Se requiere depósito de {formatCurrency(shop.deposit_amount, "DOP")} al reservar
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Powered by{" "}
        <Link href="/" className="text-primary font-medium">
          iBarber
        </Link>
      </footer>
    </div>
  );
}
