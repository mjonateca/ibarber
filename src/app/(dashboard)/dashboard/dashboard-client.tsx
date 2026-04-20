"use client";

import { FormEvent, useState } from "react";
import type { InputHTMLAttributes } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CheckCircle,
  Clock,
  ExternalLink,
  Loader2,
  Scissors,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { formatCurrency, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type { Barber, BookingStatus, NotificationEvent, Service, Shop } from "@/types/database";

export interface BookingWithRelations {
  id: string;
  client_id?: string;
  date?: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
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

interface Props {
  shop: Shop;
  todayBookings: BookingWithRelations[];
  services: Service[];
  barbers: BarberWithServices[];
  clients: ClientSummary[];
  notificationEvents: NotificationEvent[];
  stats: { totalCompleted: number; upcomingConfirmed: number };
  todayStr: string;
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

export default function DashboardClient({
  shop,
  todayBookings,
  services: initialServices,
  barbers: initialBarbers,
  clients,
  notificationEvents,
  stats,
  todayStr,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [bookings, setBookings] = useState(todayBookings);
  const [services, setServices] = useState(initialServices);
  const [barbers, setBarbers] = useState(initialBarbers);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function updateBooking(bookingId: string, status: BookingStatus) {
    setUpdatingId(bookingId);
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Error" }));
      toast({ variant: "destructive", title: "Error", description: payload.error });
    } else {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
      toast({ title: "Reserva actualizada", description: STATUS_LABELS[status] });
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
        shop_id: shop.id,
        name: form.get("name"),
        category: form.get("category"),
        description: form.get("description"),
        duration_min: Number(form.get("duration_min")),
        price: Number(form.get("price")),
      }),
    });
    const payload = await response.json();
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
    if (!response.ok) return;
    setServices((prev) =>
      prev.map((item) =>
        item.id === service.id
          ? { ...item, is_active: !item.is_active, is_visible: !item.is_active }
          : item
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
        shop_id: shop.id,
        display_name: form.get("display_name"),
        specialty: form.get("specialty"),
        bio: form.get("bio"),
        service_ids: serviceIds,
      }),
    });
    const payload = await response.json();
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
    if (!response.ok) return;
    setBarbers((prev) =>
      prev.map((item) => (item.id === barber.id ? { ...item, is_active: !item.is_active } : item))
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{shop.name}</h1>
          <p className="text-muted-foreground capitalize">
            {shop.city ? `${shop.city} · ` : ""}
            {todayStr}
          </p>
        </div>
        <Link href={`/${shop.slug}`} target="_blank" className="text-sm text-primary font-medium hover:underline">
          Ver página pública <ExternalLink className="inline h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`h-10 px-3 rounded-lg border text-sm font-medium whitespace-nowrap ${
              activeTab === tab.id ? "bg-primary text-white border-primary" : "bg-background"
            }`}
          >
            <tab.icon className="inline h-4 w-4 mr-1.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "summary" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Metric title="Citas hoy" value={bookings.length} icon={Clock} />
          <Metric title="Completadas" value={stats.totalCompleted} icon={CheckCircle} />
          <Metric title="Próximas confirmadas" value={stats.upcomingConfirmed} icon={Users} />
        </div>
      )}

      {activeTab === "bookings" && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Reservas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay citas para hoy.</p>
            ) : bookings.map((booking) => (
              <div key={booking.id} className="rounded-xl border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{booking.clients?.name || "Cliente"}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(booking.start_time.slice(0, 5))} · {booking.services?.name} · {booking.barbers?.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{STATUS_LABELS[booking.status]}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["confirmed", "completed", "cancelled"] as BookingStatus[]).map((status) => (
                    <Button key={status} size="sm" variant="outline" disabled={updatingId === booking.id} onClick={() => updateBooking(booking.id, status)}>
                      {updatingId === booking.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : STATUS_LABELS[status]}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "services" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="shadow-none">
            <CardHeader><CardTitle>Servicios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {services.map((service) => (
                <div key={service.id} className="rounded-xl border p-4 flex items-center justify-between gap-3">
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

      {activeTab === "barbers" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="shadow-none">
            <CardHeader><CardTitle>Barberos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {barbers.map((barber) => (
                <div key={barber.id} className="rounded-xl border p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{barber.display_name}</p>
                    <p className="text-sm text-muted-foreground">{barber.specialty || "Sin especialidad"}</p>
                    <p className="text-xs text-muted-foreground">
                      {barber.barber_services?.length || 0} servicios asignados
                    </p>
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

      {activeTab === "clients" && (
        <SimpleList title="Clientes" empty="Aún no hay clientes con reservas." items={clients.map((client) => ({
          title: client.name,
          detail: `${client.phone || client.whatsapp || "Sin teléfono"}${client.city ? ` · ${client.city}` : ""}`,
        }))} />
      )}

      {activeTab === "schedule" && (
        <SimpleList
          title="Horarios"
          empty="Configura horarios por barbero en la próxima iteración."
          items={barbers.map((barber) => ({
            title: barber.display_name,
            detail: "Disponible para reglas semanales, bloqueos y excepciones.",
          }))}
        />
      )}

      {activeTab === "whatsapp" && (
        <SimpleList
          title="WhatsApp / Notificaciones"
          empty="No hay notificaciones en cola."
          items={notificationEvents.map((event) => ({
            title: event.type.replaceAll("_", " "),
            detail: `${event.status}${event.scheduled_for ? ` · ${new Date(event.scheduled_for).toLocaleString()}` : ""}`,
          }))}
        />
      )}

      {activeTab === "settings" && (
        <Card className="shadow-none">
          <CardHeader><CardTitle>Ajustes</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{shop.name}</p>
            <p>{shop.address}</p>
            <p>{shop.city} · {shop.country_name}</p>
            <p>{shop.description || "Sin descripción pública."}</p>
          </CardContent>
        </Card>
      )}

      <Toaster />
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Clock }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="bg-primary/10 rounded-xl p-2.5">
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

function CreateServiceForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Card className="shadow-none">
      <CardHeader><CardTitle>Nuevo servicio</CardTitle></CardHeader>
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
          <Button type="submit" className="w-full">Crear servicio</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateBarberForm({ services, onSubmit }: { services: Service[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Card className="shadow-none">
      <CardHeader><CardTitle>Nuevo barbero</CardTitle></CardHeader>
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
          <Button type="submit" className="w-full">Crear barbero</Button>
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
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="rounded-xl border p-4">
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
