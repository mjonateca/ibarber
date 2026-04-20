"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import type { OnboardingData } from "../onboarding-wizard";

const schema = z.object({
  barberName: z.string().min(2, "Nombre requerido"),
  barberBio: z.string().max(200, "Máximo 200 caracteres").optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  data: Partial<OnboardingData>;
  onUpdate: (d: Partial<OnboardingData>) => void;
  onBack: () => void;
  onComplete: (slug: string) => void;
  userId: string;
}

export default function StepBarber({ data, onBack, onComplete, userId }: Props) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      barberName: data.barberName || "",
      barberBio: data.barberBio || "",
    },
  });

  async function onSubmit(formData: FormData) {
    setLoading(true);

    // Modo demo: simular guardado y redirigir
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http")) {
      await new Promise((r) => setTimeout(r, 800));
      toast({ title: "¡Barbería creada! (demo)", description: "ibarber.do/barber-king ya está lista" });
      onComplete("barber-king");
      return;
    }

    const supabase = createClient();

    try {
      // 1. Crear el shop
      let { data: shop, error: shopError } = await supabase
        .from("shops")
        .insert({
          owner_id: userId,
          name: data.shopName!,
          slug: data.slug!,
          phone: data.phone || null,
          whatsapp: data.phone || null,
          address: data.address || null,
          country_code: data.countryCode || "DO",
          country_name: data.countryName || "República Dominicana",
          city: data.city || "Santo Domingo",
          description: data.description || null,
          opening_hours: {
            lunes:     { open: "09:00", close: "19:00", closed: false },
            martes:    { open: "09:00", close: "19:00", closed: false },
            miercoles: { open: "09:00", close: "19:00", closed: false },
            jueves:    { open: "09:00", close: "19:00", closed: false },
            viernes:   { open: "09:00", close: "19:00", closed: false },
            sabado:    { open: "09:00", close: "17:00", closed: false },
            domingo:   { open: "09:00", close: "13:00", closed: true },
          },
        })
        .select()
        .single();

      if (shopError && /country_code|country_name|city|description|whatsapp/.test(shopError.message)) {
        const fallback = await supabase
          .from("shops")
          .insert({
            owner_id: userId,
            name: data.shopName!,
            slug: data.slug!,
            phone: data.phone || null,
            address: data.address || null,
            opening_hours: {
              lunes:     { open: "09:00", close: "19:00", closed: false },
              martes:    { open: "09:00", close: "19:00", closed: false },
              miercoles: { open: "09:00", close: "19:00", closed: false },
              jueves:    { open: "09:00", close: "19:00", closed: false },
              viernes:   { open: "09:00", close: "19:00", closed: false },
              sabado:    { open: "09:00", close: "17:00", closed: false },
              domingo:   { open: "09:00", close: "13:00", closed: true },
            },
          })
          .select()
          .single();
        shop = fallback.data;
        shopError = fallback.error;
      }

      if (shopError) throw shopError;

      // 2. Crear los servicios
      if (data.services && data.services.length > 0) {
        let { error: svcError } = await supabase
          .from("services")
          .insert(
            data.services.map((s) => ({
              shop_id: shop.id,
              name: s.name,
              duration_min: s.duration_min,
              price: s.price,
              currency: "DOP",
              description: null,
              category: "General",
              is_visible: true,
            }))
          );
        if (svcError && /description|category|is_visible/.test(svcError.message)) {
          const fallback = await supabase
            .from("services")
            .insert(
              data.services.map((s) => ({
                shop_id: shop.id,
                name: s.name,
                duration_min: s.duration_min,
                price: s.price,
                currency: "DOP",
              }))
            );
          svcError = fallback.error;
        }
        if (svcError) throw svcError;
      }

      // 3. Crear el perfil de barbero del dueño
      let { error: barberError } = await supabase
        .from("barbers")
        .insert({
          user_id: userId,
          shop_id: shop.id,
          display_name: formData.barberName,
          bio: formData.barberBio || null,
          specialty: null,
          is_active: true,
          is_independent: false,
        });

      if (barberError && /specialty|is_active/.test(barberError.message)) {
        const fallback = await supabase
          .from("barbers")
          .insert({
            user_id: userId,
            shop_id: shop.id,
            display_name: formData.barberName,
            bio: formData.barberBio || null,
            is_independent: false,
          });
        barberError = fallback.error;
      }

      if (barberError) throw barberError;

      toast({
        title: "¡Barbería creada!",
        description: `ibarber.do/${shop.slug} ya está lista`,
      });

      onComplete(shop.slug);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast({
        variant: "destructive",
        title: "Error al crear la barbería",
        description: msg,
      });
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-primary/10 rounded-xl p-2.5">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Tu perfil de barbero</CardTitle>
            <CardDescription>Cómo te verán tus clientes</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="barberName">Tu nombre como barbero *</Label>
            <Input
              id="barberName"
              placeholder="Ej: Juan el Maestro"
              {...register("barberName")}
            />
            {errors.barberName && (
              <p className="text-xs text-destructive">{errors.barberName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="barberBio">
              Bio corta{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <textarea
              id="barberBio"
              className="flex min-h-[80px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="10 años de experiencia, especialista en cortes clásicos..."
              maxLength={200}
              {...register("barberBio")}
            />
            {errors.barberBio && (
              <p className="text-xs text-destructive">{errors.barberBio.message}</p>
            )}
          </div>

          {/* Resumen antes de crear */}
          <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Resumen
            </p>
            <p>
              <span className="text-muted-foreground">Barbería:</span>{" "}
              <strong>{data.shopName}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">URL:</span>{" "}
              <strong>ibarber.do/{data.slug}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Servicios:</span>{" "}
              <strong>{data.services?.length || 0} configurados</strong>
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" type="button" onClick={onBack} className="flex-1">
              ← Volver
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</>
              ) : (
                "🎉 Crear barbería"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
