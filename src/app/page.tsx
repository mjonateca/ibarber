import Link from "next/link";
import { Scissors } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-primary rounded-xl p-3">
            <Scissors className="h-8 w-8 text-white" />
          </div>
          <span className="text-3xl font-bold">iBarber</span>
        </div>

        <h1 className="text-4xl font-bold mb-4 leading-tight">
          Tu barbería,<br />siempre lista
        </h1>
        <p className="text-muted-foreground text-lg mb-10">
          Reserva citas en las mejores barberías de RD sin llamadas ni esperas.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl bg-primary text-white font-semibold px-8 py-3 text-base hover:bg-primary/90 transition-colors"
          >
            Registrar mi barbería
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-border font-semibold px-8 py-3 text-base hover:bg-accent transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>

      <footer className="absolute bottom-6 text-sm text-muted-foreground">
        © 2025 iBarber · República Dominicana
      </footer>
    </main>
  );
}
