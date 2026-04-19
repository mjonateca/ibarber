import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IS_DEMO } from "@/lib/demo-data";
import DashboardNav from "@/components/layout/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!IS_DEMO) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardNav userId="demo-user-1" />
      <main className="pb-20 md:pb-0 md:ml-60">
        {children}
      </main>
    </div>
  );
}
