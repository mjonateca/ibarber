"use client";

import { FormEvent, useMemo, useState } from "react";
import type { InputHTMLAttributes } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  CheckCircle,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  Scissors,
  Settings,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { formatCurrency, formatTime } from "@/lib/utils";
import type {
  Barber,
  BookingStatus,
  NotificationEvent,
  PaymentStatus,
  Service,
  Shop,
  ShopPaymentMethod,
  ShopSubscription,
  SubscriptionStatus,
} from "@/types/database";

export interface BookingWithRelations {
  id: string;
  client_id?: string;
  date?: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_required: boolean;
  payment_amount: number;
  payment_currency: string;
  clients: { name: string; phone: string | null; whatsapp: string | null } | null;
  barbers: { display_name: string } | null;
  services: { name: string; duration_min: number; price: number } | null;
}

type BarberWithServices = Barber & { barber_services?: Array<{ service_id: string }> };
type ClientSummary = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  city?: string | null;
  country_name?: string | null;
};

type OpeningHoursValue = Record<string, { open: string; close: string; closed: boolean }>;

type Analytics = {
  totalsByStatus: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    completed: number;
  };
  estimatedRevenue: number;
  realizedRevenue: number;
  avgServiceTime: number;
  avgTicket: number;
  recurrentClients: number;
  topServices: Array<{ name: string; count: number; revenue: number }>;
  topBarbers: Array<{ name: string; count: number; revenue: number; completed: number }>;
  bestBarbers: Array<{ name: string; count: number; revenue: number; completed: number; completionRate: number }>;
  peakHours: Array<{ slot: string; count: number }>;
  peakWeekdays: Array<{ day: string; count: number }>;
  evolutions: {
    day: Array<{ label: string; value: number }>;
    week: Array<{ label: string; value: number }>;
    month: Array<{ label: string; value: number }>;
  };
  avgLeadMinutes: number;
};

interface Props {
  shop: Shop;
  todayBookings: BookingWithRelations[];
  bookings: BookingWithRelations[];
  services: Service[];
  barbers: BarberWithServices[];
  clients: ClientSummary[];
  notificationEvents: NotificationEvent[];
  subscription: ShopSubscription | null;
  paymentMethods: ShopPaymentMethod[];
  analytics: Analytics;
  stats: { totalCompleted: number; upcomingConfirmed: number; expectedToday: number; expectedWeek: number };
  todayStr: string;
  initialTab?: string;
}

const tabs = [
  { id: "summary", label: "Resumen", icon: CheckCircle },
  { id: "bookings", label: "Reservas", icon: CalendarDays },
  { id: "services", label: "Servicios", icon: Scissors },
  { id: "barbers", label: "Barberos", icon: UserRound },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "schedule", label: "Horarios", icon: Clock },
  { id: "whatsapp", label: "WhatsApp", icon: Bell },
  { id: "settings", label: "Ajustes", icon: Settings },
] as const;

type TabId = (typeof tabs)[number]["id"];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  rescheduled: "Reprogramada",
  completed: "Completada",
  no_show: "No se presentó",
  cancelled: "Cancelada",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente de pago",
  paid: "Pagada",
  failed: "Pago fallido",
  refunded: "Reembolsada",
};

const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Prueba gratis",
  active: "Activa",
  past_due: "Pago pendiente",
  cancelled: "Cancelada",
  expired: "Vencida",
};

const WEEK_DAYS = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
] as const;

function defaultOpeningHours(): OpeningHoursValue {
  return {
    lunes: { open: "09:00", close: "19:00", closed: false },
    martes: { open: "09:00", close: "19:00", closed: false },
    miercoles: { open: "09:00", close: "19:00", closed: false },
    jueves: { open: "09:00", close: "19:00", closed: false },
    viernes: { open: "09:00", close: "19:00", closed: false },
    sabado: { open: "09:00", close: "17:00", closed: false },
    domingo: { open: "09:00", close: "13:00", closed: true },
  };
}

function normalizeOpeningHours(value: Shop["opening_hours"]): OpeningHoursValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultOpeningHours();
  }

  const fallback = defaultOpeningHours();
  const raw = value as Record<string, unknown>;
  const normalized: OpeningHoursValue = { ...fallback };

  for (const day of WEEK_DAYS) {
    const current = raw[day.key];
    if (current && typeof current === "object" && !Array.isArray(current)) {
      const dayValue = current as Record<string, unknown>;
      normalized[day.key] = {
        open: typeof dayValue.open === "string" ? dayValue.open : fallback[day.key].open,
        close: typeof dayValue.close === "string" ? dayValue.close : fallback[day.key].close,
        closed: typeof dayValue.closed === "boolean" ? dayValue.closed : fallback[day.key].closed,
      };
    }
  }

  return normalized;
}

function subscriptionTone(status?: SubscriptionStatus | null) {
  switch (status) {
    case "active":
    case "trial":
      return "text-emerald-600";
    case "past_due":
      return "text-amber-600";
    default:
      return "text-destructive";
  }
}

export default function DashboardClient({
  shop,
  todayBookings,
  bookings: initialBookings,
  services: initialServices,
  barbers: initialBarbers,
  clients,
  notificationEvents,
  subscription,
  paymentMethods,
  analytics,
  stats,
  todayStr,
  initialTab = "summary",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") || initialTab) as TabId;
  const [bookings, setBookings] = useState(initialBookings);
  const [services, setServices] = useState(initialServices);
  const [barbers, setBarbers] = useState(initialBarbers);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [shopState, setShopState] = useState(shop);
  const [openingHours, setOpeningHours] = useState<OpeningHoursValue>(() => normalizeOpeningHours(shop.opening_hours));
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [billingAction, setBillingAction] = useState<string | null>(null);

  const clientItems = useMemo(
    () =>
      clients.map((client) => ({
        title: client.name,
        detail: `${client.phone || client.whatsapp || "Sin teléfono"}${client.city ? ` · ${client.city}` : ""}`,
      })),
    [clients]
  );

  function goToTab(tab: TabId) {
    router.push(`/dashboard?tab=${tab}`);
  }

  function updateDay(day: keyof OpeningHoursValue, field: "open" | "close" | "closed", value: string | boolean) {
    setOpeningHours((current) => ({
      ...current,
      [day]: {
        ...current[day],
        [field]: value,
      },
    }));
  }

  async function updateBooking(bookingId: string, status: BookingStatus) {
    setUpdatingId(bookingId);
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const payload = await response.json().catch(() => ({ error: "Error inesperado" }));
    if (!response.ok) {
      toast({ variant: "destructive", title: "No se actualizó la reserva", description: payload.error });
    } else {
      setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking)));
      toast({ title: payload.message || "Reserva actualizada", description: STATUS_LABELS[status] });
    }

    setUpdatingId(null);
  }

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/dashboard/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shopState.id,
        name: form.get("name"),
        category: form.get("category"),
        description: form.get("description"),
        duration_min: Number(form.get("duration_min")),
        price: Number(form.get("price")),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ variant: "destructive", title: "No se creó el servicio", description: payload.error });
      return;
    }
    setServices((prev) => [...prev, payload]);
    event.currentTarget.reset();
    toast({ title: "Servicio creado" });
  }

  async function toggleService(service: Service) {
    const response = await fetch(`/api/dashboard/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !service.is_active, is_visible: !service.is_active }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({ variant: "destructive", title: "No se actualizó el servicio", description: payload.error });
      return;
    }
    setServices((prev) =>
      prev.map((item) =>
        item.id === service.id ? { ...item, is_active: !item.is_active, is_visible: !item.is_active } : item
      )
    );
  }

  async function createBarber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const serviceIds = form.getAll("service_ids").map(String);
    const response = await fetch("/api/dashboard/barbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shopState.id,
        display_name: form.get("display_name"),
        specialty: form.get("specialty"),
        bio: form.get("bio"),
        service_ids: serviceIds,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ variant: "destructive", title: "No se creó el barbero", description: payload.error });
      return;
    }
    setBarbers((prev) => [...prev, { ...payload, barber_services: serviceIds.map((id) => ({ service_id: id })) }]);
    event.currentTarget.reset();
    toast({ title: "Barbero creado" });
  }

  async function toggleBarber(barber: BarberWithServices) {
    const response = await fetch(`/api/dashboard/barbers/${barber.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !barber.is_active }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({ variant: "destructive", title: "No se actualizó el barbero", description: payload.error });
      return;
    }
    setBarbers((prev) => prev.map((item) => (item.id === barber.id ? { ...item, is_active: !item.is_active } : item)));
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSchedule(true);

    const invalidDay = WEEK_DAYS.find(({ key }) => {
      const day = openingHours[key];
      return !day.closed && day.open >= day.close;
    });

    if (invalidDay) {
      toast({
        variant: "destructive",
        title: "Horario inválido",
        description: `Revisa ${invalidDay.label}: la hora de apertura debe ser menor que la de cierre.`,
      });
      setSavingSchedule(false);
      return;
    }

    const response = await fetch("/api/dashboard/shop", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opening_hours: openingHours }),
    });

    const payload = await response.json().catch(() => ({}));
    setSavingSchedule(false);

    if (!response.ok) {
      toast({ variant: "destructive", title: "No se guardó el horario", description: payload.error || "Error inesperado" });
      return;
    }

    setShopState(payload);
    toast({ title: "Horario actualizado" });
  }

  async function openBillingCheckout() {
    setBillingAction("checkout");
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setBillingAction(null);
    if (!response.ok || !payload.url) {
      toast({ variant: "destructive", title: "No se pudo iniciar la suscripción", description: payload.error || "Error inesperado" });
      return;
    }
    window.location.href = payload.url;
  }

  async function openBillingPortal() {
    setBillingAction("portal");
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setBillingAction(null);
    if (!response.ok || !payload.url) {
      toast({ variant: "destructive", title: "No se pudo abrir billing", description: payload.error || "Error inesperado" });
      return;
    }
    window.location.href = payload.url;
  }

  return (
    <div className="max-w-6xl p-4 md:p-8">
      <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{shopState.name}</h1>
          <p className="text-muted-foreground capitalize">
            {shopState.city ? `${shopState.city} · ` : ""}
            {todayStr}
          </p>
          {subscription && (
            <p className={`mt-2 text-sm font-medium ${subscriptionTone(subscription.status)}`}>
              Suscripción: {SUBSCRIPTION_LABELS[subscription.status]}
              {subscription.trial_ends_at ? ` · Trial hasta ${new Date(subscription.trial_ends_at).toLocaleDateString()}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/">Inicio</Link>
          </Button>
          <Link href={`/${shopState.slug}`} target="_blank" className="text-sm font-medium text-primary hover:underline">
            Ver página pública <ExternalLink className="inline h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => goToTab(tab.id)}
            className={`h-10 rounded-lg border px-3 text-sm font-medium whitespace-nowrap ${
              currentTab === tab.id ? "border-primary bg-primary text-white" : "bg-background"
            }`}
          >
            <tab.icon className="mr-1.5 inline h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {currentTab === "summary" && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Metric title="Citas hoy" value={todayBookings.length} icon={Clock} />
            <Metric title="Esperado hoy" value={formatCurrency(stats.expectedToday)} icon={TrendingUp} />
            <Metric title="Esperado semana" value={formatCurrency(stats.expectedWeek)} icon={CalendarDays} />
            <Metric title="Total reservas" value={analytics.totalsByStatus.total} icon={CalendarDays} />
            <Metric title="Confirmadas" value={analytics.totalsByStatus.confirmed} icon={CheckCircle} />
            <Metric title="Pendientes" value={analytics.totalsByStatus.pending} icon={Clock} />
            <Metric title="Canceladas" value={analytics.totalsByStatus.cancelled} icon={Users} />
            <Metric title="Ingresos estimados" value={formatCurrency(analytics.estimatedRevenue)} icon={Scissors} />
            <Metric title="Ingresos cobrados" value={formatCurrency(analytics.realizedRevenue)} icon={TrendingUp} />
            <Metric title="Ticket medio" value={formatCurrency(analytics.avgTicket)} icon={CreditCard} />
            <Metric title="Tiempo medio servicio" value={`${analytics.avgServiceTime} min`} icon={Clock} />
            <Metric title="Clientes recurrentes" value={analytics.recurrentClients} icon={Users} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <InsightList
              title="Servicios más solicitados"
              items={analytics.topServices.map((item) => ({
                title: item.name,
                detail: `${item.count} reservas · ${formatCurrency(item.revenue)}`,
              }))}
            />
            <InsightList
              title="Barberos con más reservas"
              items={analytics.topBarbers.map((item) => ({
                title: item.name,
                detail: `${item.count} reservas · ${formatCurrency(item.revenue)}`,
              }))}
            />
            <InsightList
              title="Barberos con mejor rendimiento"
              items={analytics.bestBarbers.map((item) => ({
                title: item.name,
                detail: `${Math.round(item.completionRate * 100)}% completadas · ${formatCurrency(item.revenue)}`,
              }))}
            />
            <InsightList
              title="Franja horaria con más demanda"
              items={analytics.peakHours.map((item) => ({
                title: item.slot,
                detail: `${item.count} reservas`,
              }))}
            />
            <InsightList
              title="Días con más demanda"
              items={analytics.peakWeekdays.map((item) => ({
                title: item.day,
                detail: `${item.count} reservas`,
              }))}
            />
            <InsightList
              title="Evolución mensual"
              items={analytics.evolutions.month.slice(-6).map((item) => ({
                title: item.label,
                detail: `${item.value} reservas`,
              }))}
            />
          </div>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Suscripción y cobros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription ? (
                <>
                  <div className="rounded-xl border p-4">
                    <p className="font-medium">Estado actual: {SUBSCRIPTION_LABELS[subscription.status]}</p>
                    <p className="text-sm text-muted-foreground">
                      Importe: {formatCurrency(subscription.monthly_price, subscription.currency)} / mes
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Próximo corte: {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "Pendiente"}
                    </p>
                    {subscription.last_payment_error && (
                      <p className="mt-2 text-sm text-destructive">{subscription.last_payment_error}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={openBillingCheckout}>
                      {billingAction === "checkout" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activar / renovar plan"}
                    </Button>
                    <Button variant="outline" onClick={openBillingPortal}>
                      {billingAction === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gestionar método de pago"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Tarjetas registradas</p>
                    {paymentMethods.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Todavía no hay métodos de pago guardados para la barbería.</p>
                    ) : (
                      paymentMethods.map((paymentMethod) => (
                        <div key={paymentMethod.id} className="rounded-lg border p-3 text-sm">
                          {paymentMethod.brand?.toUpperCase() || "Tarjeta"} terminada en {paymentMethod.last4 || "****"}
                          {paymentMethod.is_default ? " · Predeterminada" : ""}
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">La suscripción de esta barbería todavía se está preparando.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentTab === "bookings" && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Reservas próximas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay reservas próximas.</p>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{booking.clients?.name || "Cliente"}</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.date} · {formatTime(booking.start_time.slice(0, 5))} · {booking.services?.name} · {booking.barbers?.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{STATUS_LABELS[booking.status]}</p>
                    <p className="text-xs text-muted-foreground">
                      {PAYMENT_STATUS_LABELS[booking.payment_status]}
                      {booking.payment_amount > 0 ? ` · ${formatCurrency(booking.payment_amount, booking.payment_currency)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["confirmed", "completed", "cancelled"] as BookingStatus[]).map((status) => (
                      <Button key={status} size="sm" variant="outline" disabled={updatingId === booking.id} onClick={() => updateBooking(booking.id, status)}>
                        {updatingId === booking.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : STATUS_LABELS[status]}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {currentTab === "services" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Servicios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-3 rounded-xl border p-4">
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.category || "General"} · {service.duration_min} min · {formatCurrency(service.price, service.currency)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggleService(service)}>
                    {service.is_active ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
          <CreateServiceForm onSubmit={createService} />
        </div>
      )}

      {currentTab === "barbers" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Barberos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {barbers.map((barber) => (
                <div key={barber.id} className="flex items-center justify-between gap-3 rounded-xl border p-4">
                  <div>
                    <p className="font-medium">{barber.display_name}</p>
                    <p className="text-sm text-muted-foreground">{barber.specialty || "Sin especialidad"}</p>
                    <p className="text-xs text-muted-foreground">{barber.barber_services?.length || 0} servicios asignados</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggleBarber(barber)}>
                    {barber.is_active ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
          <CreateBarberForm services={services.filter((service) => service.is_active)} onSubmit={createBarber} />
        </div>
      )}

      {currentTab === "clients" && <SimpleList title="Clientes" empty="Aún no hay clientes con reservas." items={clientItems} />}

      {currentTab === "schedule" && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Horario de funcionamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveSchedule} className="space-y-4">
              {WEEK_DAYS.map(({ key, label }) => (
                <div key={key} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[160px_1fr_1fr_auto] md:items-center">
                  <div className="font-medium">{label}</div>
                  <div className="space-y-1">
                    <Label htmlFor={`${key}-open`}>Abre</Label>
                    <Input
                      id={`${key}-open`}
                      type="time"
                      value={openingHours[key].open}
                      onChange={(event) => updateDay(key, "open", event.target.value)}
                      disabled={openingHours[key].closed}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${key}-close`}>Cierra</Label>
                    <Input
                      id={`${key}-close`}
                      type="time"
                      value={openingHours[key].close}
                      onChange={(event) => updateDay(key, "close", event.target.value)}
                      disabled={openingHours[key].closed}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={openingHours[key].closed} onChange={(event) => updateDay(key, "closed", event.target.checked)} />
                    Cerrado
                  </label>
                </div>
              ))}
              <Button type="submit" disabled={savingSchedule}>
                {savingSchedule ? "Guardando..." : "Guardar horario"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {currentTab === "whatsapp" && (
        <SimpleList
          title="WhatsApp / Notificaciones"
          empty="No hay notificaciones en cola."
          items={notificationEvents.map((event) => ({
            title: event.type.replaceAll("_", " "),
            detail: `${event.status}${event.scheduled_for ? ` · ${new Date(event.scheduled_for).toLocaleString()}` : ""}`,
          }))}
        />
      )}

      {currentTab === "settings" && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Ajustes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{shopState.name}</p>
            <p>{shopState.address}</p>
            <p>
              {shopState.city} · {shopState.country_name}
            </p>
            <p>{shopState.description || "Sin descripción pública."}</p>
            <p>Pagos online: {shopState.payments_enabled ? `Sí · modo ${shopState.online_payment_mode}` : "No activados"}</p>
          </CardContent>
        </Card>
      )}

      <Toaster />
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: number | string; icon: typeof Clock }) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightList({ title, items }: { title: string; items: Array<{ title: string; detail: string }> }) {
  return <SimpleList title={title} empty="No hay datos suficientes todavía." items={items} />;
}

function CreateServiceForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Nuevo servicio</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field name="name" label="Nombre" required />
          <Field name="category" label="Categoría" />
          <Field name="duration_min" label="Duración minutos" type="number" defaultValue="30" required />
          <Field name="price" label="Precio" type="number" defaultValue="500" required />
          <div className="space-y-1">
            <Label htmlFor="description">Descripción</Label>
            <textarea id="description" name="description" className="min-h-[76px] w-full rounded-xl border bg-background px-3 py-2 text-sm" />
          </div>
          <Button type="submit" className="w-full">
            Crear servicio
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateBarberForm({ services, onSubmit }: { services: Service[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Nuevo barbero</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field name="display_name" label="Nombre público" required />
          <Field name="specialty" label="Especialidad" />
          <div className="space-y-1">
            <Label htmlFor="bio">Bio</Label>
            <textarea id="bio" name="bio" className="min-h-[76px] w-full rounded-xl border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <Label>Servicios</Label>
            <div className="space-y-2 rounded-xl border p-3">
              {services.map((service) => (
                <label key={service.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="service_ids" value={service.id} />
                  {service.name}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full">
            Crear barbero
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}

function SimpleList({ title, empty, items }: { title: string; empty: string; items: Array<{ title: string; detail: string }> }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-xl border p-4">
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
