"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, XCircle, Clock, Users, ExternalLink, Loader2 } from "lucide-react";
import { createRawClient } from "@/lib/supabase/raw-client";
import { formatCurrency, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type { Shop, BookingStatus } from "@/types/database";

export interface BookingWithRelations {
  id: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  clients: { name: string; phone: string | null; whatsapp: string | null } | null;
  barbers: { display_name: string } | null;
  services: { name: string; duration_min: number; price: number } | null;
}

interface Props {
  shop: Shop;
  todayBookings: BookingWithRelations[];
  stats: { totalCompleted: number; upcomingConfirmed: number };
  todayStr: string;
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  no_show:   "No se presentó",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending:   "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  no_show:   "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function DashboardClient({ shop, todayBookings, stats, todayStr }: Props) {
  const [bookings, setBookings] = useState(todayBookings);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function updateStatus(bookingId: string, status: BookingStatus) {
    setUpdatingId(bookingId);
    const supabase = createRawClient();

    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", bookingId);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
      );
      toast({
        title: status === "completed" ? "¡Servicio completado!" : "Estado actualizado",
        description: STATUS_LABELS[status],
      });
    }

    setUpdatingId(null);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{shop.name}</h1>
            <p className="text-muted-foreground capitalize">{todayStr}</p>
          </div>
          <Link
            href={`/${shop.slug}`}
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
          >
            Ver página pública
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 rounded-xl p-2.5">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{bookings.length}</p>
                <p className="text-xs text-muted-foreground">Citas hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 rounded-xl p-2.5">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCompleted}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 rounded-xl p-2.5">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.upcomingConfirmed}</p>
                <p className="text-xs text-muted-foreground">Próximas reservas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Citas de hoy */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Citas de hoy</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No hay citas para hoy</p>
            </div>
          ) : (
            <div className="divide-y">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-4 flex items-start gap-4">
                  {/* Hora */}
                  <div className="min-w-[60px] text-center">
                    <p className="font-bold text-sm">
                      {formatTime(booking.start_time.slice(0, 5))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(booking.end_time.slice(0, 5))}
                    </p>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          {booking.clients?.name || "Cliente"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {booking.services?.name} · {booking.barbers?.display_name}
                        </p>
                        {booking.services && (
                          <p className="text-xs text-primary font-medium mt-0.5">
                            {formatCurrency(booking.services.price)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                          STATUS_COLORS[booking.status]
                        }`}
                      >
                        {STATUS_LABELS[booking.status]}
                      </span>
                    </div>

                    {/* Acciones */}
                    {booking.status === "confirmed" && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-green-500 text-green-600 hover:bg-green-50"
                          disabled={updatingId === booking.id}
                          onClick={() => updateStatus(booking.id, "completed")}
                        >
                          {updatingId === booking.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Completada</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-red-400 text-red-500 hover:bg-red-50"
                          disabled={updatingId === booking.id}
                          onClick={() => updateStatus(booking.id, "no_show")}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> No llegó
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link a página pública */}
      <div className="mt-6 rounded-2xl bg-primary/5 border border-primary/20 p-4">
        <p className="text-sm font-medium mb-1">Tu página de reservas</p>
        <p className="text-xs text-muted-foreground mb-3">
          Comparte este enlace con tus clientes para que puedan reservar directamente.
        </p>
        <Link href={`/${shop.slug}`} target="_blank">
          <Button variant="outline" size="sm" className="text-primary border-primary/30">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            ibarber.do/{shop.slug}
          </Button>
        </Link>
      </div>

      <Toaster />
    </div>
  );
}
