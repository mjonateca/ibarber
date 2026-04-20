"use client";

import { useState } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type { Shop, Barber, Service, Client } from "@/types/database";

interface ShopWithRelations extends Shop {
  barbers: Array<Barber & { barber_services?: Array<{ service_id: string }> }>;
  services: Service[];
}

interface Props {
  shop: ShopWithRelations;
  client: Client;
  preselectedBarberId?: string;
}

type Step = "barber" | "service" | "datetime" | "confirm" | "success";

const TIME_SLOTS = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","14:00","14:30","15:00",
  "15:30","16:00","16:30","17:00","17:30","18:00","18:30",
];

function generateDates(days = 14): Date[] {
  return Array.from({ length: days }, (_, i) => addDays(startOfDay(new Date()), i + 1));
}

export default function BookingFlow({ shop, client, preselectedBarberId }: Props) {
  const [step, setStep] = useState<Step>(preselectedBarberId ? "service" : "barber");
  const [selectedBarber, setSelectedBarber] = useState<ShopWithRelations["barbers"][number] | null>(
    preselectedBarberId
      ? shop.barbers.find((b) => b.id === preselectedBarberId) || null
      : null
  );
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const compatibleServiceIds = new Set(
    selectedBarber?.barber_services?.map((item: { service_id: string }) => item.service_id) || []
  );
  const activeServices = shop.services.filter(
    (s) =>
      s.is_active &&
      s.is_visible !== false &&
      (!selectedBarber || compatibleServiceIds.size === 0 || compatibleServiceIds.has(s.id))
  );
  const dates = generateDates(14);

  async function loadBookedSlots(barberId: string, date: Date) {
    setLoadingSlots(true);
    const supabase = createClient();
    const dateStr = format(date, "yyyy-MM-dd");

    const { data } = await supabase
      .from("bookings")
      .select("start_time")
      .eq("barber_id", barberId)
      .eq("date", dateStr)
      .not("status", "in", '("cancelled","no_show")');

    setBookedSlots((data || []).map((b) => b.start_time.slice(0, 5)));
    setLoadingSlots(false);
  }

  async function handleDateSelect(date: Date) {
    setSelectedDate(date);
    setSelectedTime(null);
    if (selectedBarber) {
      await loadBookedSlots(selectedBarber.id, date);
    }
    setStep("datetime");
  }

  async function handleConfirm() {
    if (!selectedBarber || !selectedService || !selectedDate || !selectedTime) return;
    setSubmitting(true);

    // Modo demo: simular guardado
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http")) {
      await new Promise((r) => setTimeout(r, 600));
      setStep("success");
      setSubmitting(false);
      return;
    }

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const [h, m] = selectedTime.split(":").map(Number);
    const endH = Math.floor((h * 60 + m + selectedService.duration_min) / 60);
    const endM = (h * 60 + m + selectedService.duration_min) % 60;
    const endTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: selectedBarber.id,
        shop_id: shop.id,
        service_id: selectedService.id,
        date: dateStr,
        start_time: selectedTime + ":00",
        end_time: endTime + ":00",
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Error al reservar" }));
      toast({
        variant: "destructive",
        title: "Error al reservar",
        description: String(payload.error || "").includes("overlap")
          ? "Ese horario ya no está disponible, elige otro."
          : payload.error || "No se pudo crear la reserva.",
      });
      setSubmitting(false);
      return;
    }

    setStep("success");
    setSubmitting(false);
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <CheckCircle2 className="h-20 w-20 text-green-500 mb-6" />
        <h1 className="text-2xl font-bold mb-2">¡Reserva confirmada!</h1>
        <p className="text-muted-foreground mb-2">
          <strong>{selectedService?.name}</strong> con{" "}
          <strong>{selectedBarber?.display_name}</strong>
        </p>
        <p className="text-muted-foreground mb-8">
          {selectedDate && format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}{" "}
          a las {selectedTime && formatTime(selectedTime)}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href={`/${shop.slug}`}>
            <Button variant="outline" className="w-full">
              Volver a {shop.name}
            </Button>
          </Link>
        </div>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-4 flex items-center gap-3">
        <Link href={`/${shop.slug}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <p className="font-semibold text-sm">{shop.name}</p>
          <p className="text-xs text-muted-foreground">
            {step === "barber" && "Elige tu barbero"}
            {step === "service" && "Elige el servicio"}
            {step === "datetime" && "Elige fecha y hora"}
            {step === "confirm" && "Confirmar reserva"}
          </p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Paso 1: Barbero */}
        {step === "barber" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">¿Con quién quieres tu cita?</h2>
            <div className="grid grid-cols-2 gap-3">
              {shop.barbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedBarber(b); setStep("service"); }}
                  className="rounded-2xl border p-4 text-left hover:border-primary transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3 text-xl font-bold text-muted-foreground">
                    {b.display_name[0]}
                  </div>
                  <p className="font-medium text-sm">{b.display_name}</p>
                  {b.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.bio}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Paso 2: Servicio */}
        {step === "service" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep("barber")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h2 className="text-lg font-semibold">¿Qué servicio quieres?</h2>
            </div>
            <div className="space-y-2">
              {activeServices.length === 0 && (
                <p className="rounded-xl border p-4 text-sm text-muted-foreground">
                  Este barbero aún no tiene servicios asignados.
                </p>
              )}
              {activeServices.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedService(s); }}
                  className={`w-full rounded-2xl border p-4 text-left flex items-center justify-between transition-all ${
                    selectedService?.id === s.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "hover:border-primary/40"
                  }`}
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                      <Clock className="h-3.5 w-3.5" />
                      {s.duration_min} min
                    </p>
                  </div>
                  <p className="font-semibold text-primary">
                    {formatCurrency(s.price, s.currency)}
                  </p>
                </button>
              ))}
            </div>
            {selectedService && (
              <Button
                className="w-full"
                onClick={() => setStep("datetime")}
              >
                Elegir fecha y hora →
              </Button>
            )}
          </div>
        )}

        {/* Paso 3: Fecha y hora */}
        {step === "datetime" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep("service")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h2 className="text-lg font-semibold">Elige fecha</h2>
            </div>

            {/* Selector de fecha horizontal */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {dates.map((date) => (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDateSelect(date)}
                  className={`flex-shrink-0 rounded-2xl border p-3 text-center min-w-[60px] transition-all ${
                    selectedDate?.toDateString() === date.toDateString()
                      ? "border-primary bg-primary text-white"
                      : "hover:border-primary/40"
                  }`}
                >
                  <p className="text-xs font-medium">
                    {format(date, "EEE", { locale: es })}
                  </p>
                  <p className="text-lg font-bold">{format(date, "d")}</p>
                  <p className="text-xs">{format(date, "MMM", { locale: es })}</p>
                </button>
              ))}
            </div>

            {/* Horarios disponibles */}
            {selectedDate && (
              <div>
                <h3 className="font-medium mb-3">Horarios disponibles</h3>
                {loadingSlots ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const taken = bookedSlots.includes(slot);
                      return (
                        <button
                          key={slot}
                          disabled={taken}
                          onClick={() => setSelectedTime(slot)}
                          className={`rounded-xl border py-2.5 text-sm font-medium transition-all ${
                            taken
                              ? "opacity-30 cursor-not-allowed bg-muted"
                              : selectedTime === slot
                              ? "border-primary bg-primary text-white"
                              : "hover:border-primary/40"
                          }`}
                        >
                          {formatTime(slot)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedDate && selectedTime && (
              <Button className="w-full" onClick={() => setStep("confirm")}>
                Confirmar horario →
              </Button>
            )}
          </div>
        )}

        {/* Paso 4: Confirmar */}
        {step === "confirm" && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">Confirmar reserva</h2>

            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Barbero</span>
                  <span className="font-medium">{selectedBarber?.display_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Servicio</span>
                  <span className="font-medium">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="font-medium">
                    {selectedDate &&
                      format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hora</span>
                  <span className="font-medium">
                    {selectedTime && formatTime(selectedTime)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duración</span>
                  <span className="font-medium">{selectedService?.duration_min} min</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary text-lg">
                    {selectedService &&
                      formatCurrency(selectedService.price, selectedService.currency)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("datetime")}
                className="flex-1"
              >
                ← Cambiar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reservando...</>
                ) : (
                  "Confirmar reserva"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Toaster />
    </div>
  );
}
