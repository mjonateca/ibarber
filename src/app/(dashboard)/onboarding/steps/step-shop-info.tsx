"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Store, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OnboardingData } from "../onboarding-wizard";

const schema = z.object({
  shopName: z.string().min(2, "Nombre requerido (mínimo 2 caracteres)"),
  slug: z
    .string()
    .min(3, "URL mínimo 3 caracteres")
    .max(50, "URL máximo 50 caracteres")
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  phone: z.string().min(7, "Teléfono requerido"),
  address: z.string().min(5, "Dirección requerida"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  data: Partial<OnboardingData>;
  onUpdate: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  userId: string;
}

export default function StepShopInfo({ data, onUpdate, onNext }: Props) {
  const [loading, setLoading] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      shopName: data.shopName || "",
      slug: data.slug || "",
      phone: data.phone || "",
      address: data.address || "",
    },
  });

  const shopName = watch("shopName");
  const slug = watch("slug");

  // Auto-generate slug from shop name
  useEffect(() => {
    if (shopName && !data.slug) {
      setValue("slug", slugify(shopName));
    }
  }, [shopName, setValue, data.slug]);

  // Check slug availability
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }
    const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http");
    if (isDemo) {
      setSlugAvailable(true);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingSlug(true);
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", slug)
        .single();
      setSlugAvailable(!existing);
      setCheckingSlug(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [slug]);

  async function onSubmit(formData: FormData) {
    if (slugAvailable === false) return;
    setLoading(true);
    onUpdate(formData);
    onNext();
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-primary/10 rounded-xl p-2.5">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Tu barbería</CardTitle>
            <CardDescription>Información básica de tu negocio</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="shopName">Nombre de la barbería *</Label>
            <Input
              id="shopName"
              placeholder="Ej: Barber King Santiago"
              {...register("shopName")}
            />
            {errors.shopName && (
              <p className="text-xs text-destructive">{errors.shopName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">
              <Globe className="inline h-3.5 w-3.5 mr-1" />
              URL de tu página *
            </Label>
            <div className="flex items-center gap-0">
              <span className="h-11 px-3 flex items-center text-sm text-muted-foreground bg-muted rounded-l-xl border border-r-0 border-input whitespace-nowrap">
                ibarber.do/
              </span>
              <Input
                id="slug"
                className="rounded-l-none"
                placeholder="tu-barberia"
                {...register("slug")}
                onChange={(e) => {
                  setValue("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
              />
            </div>
            {errors.slug && (
              <p className="text-xs text-destructive">{errors.slug.message}</p>
            )}
            {!errors.slug && slug && slug.length >= 3 && (
              <p className={`text-xs ${slugAvailable === true ? "text-green-600" : slugAvailable === false ? "text-destructive" : "text-muted-foreground"}`}>
                {checkingSlug
                  ? "Verificando disponibilidad..."
                  : slugAvailable === true
                  ? "✓ Disponible"
                  : slugAvailable === false
                  ? "✗ Ya está en uso, elige otro"
                  : ""}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono / WhatsApp *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 809-555-0100"
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección *</Label>
            <Input
              id="address"
              placeholder="Calle El Sol #45, Santiago, RD"
              {...register("address")}
            />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || slugAvailable === false || checkingSlug}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              "Continuar →"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
