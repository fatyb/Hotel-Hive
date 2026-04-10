"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UserProfile, UserRole } from "@/types";
import { Building2, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const ROLE_CONFIG: Record<UserRole, { label: string; icon: string; colorClass: string; bgClass: string }> = {
  housekeeping: { label: "Housekeeping", icon: "🧹", colorClass: "text-sky-600",    bgClass: "bg-sky-50"    },
  maintenance:  { label: "Maintenance",  icon: "🔧", colorClass: "text-amber-600",  bgClass: "bg-amber-50"  },
  it:           { label: "IT",           icon: "💻", colorClass: "text-purple-600", bgClass: "bg-purple-50" },
  manager:      { label: "Manager",      icon: "👔", colorClass: "text-primary",    bgClass: "bg-primary/10"},
  reception:    { label: "Réception",    icon: "🛎️", colorClass: "text-green-600",  bgClass: "bg-green-50"  },
};

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

type Stats = { total: number; doneToday: number; doneWeek: number };

export default function ProfilPage() {
  const supabase  = createClient();
  const router    = useRouter();

  const [profile,    setProfile]    = useState<UserProfile | null>(null);
  const [hotelName,  setHotelName]  = useState("");
  const [stats,      setStats]      = useState<Stats>({ total: 0, doneToday: 0, doneWeek: 0 });
  const [loading,    setLoading]    = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase.from("profiles").select("*, hotels(name)").eq("id", user.id).single();
      if (prof) {
        setProfile(prof as UserProfile);
        setHotelName((prof as { hotels?: { name: string } }).hotels?.name ?? "");
      }

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - 7);

      const [{ count: total }, { count: doneToday }, { count: doneWeek }] = await Promise.all([
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", user.id),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", user.id).eq("status", "terminee").gte("completed_at", todayStart.toISOString()),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", user.id).eq("status", "terminee").gte("completed_at", weekStart.toISOString()),
      ]);

      setStats({ total: total ?? 0, doneToday: doneToday ?? 0, doneWeek: doneWeek ?? 0 });
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading || !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 flex flex-col items-center gap-4">
        <Skeleton className="w-20 h-20 rounded-full" />
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-full" />
      </div>
    );
  }

  const roleConf = ROLE_CONFIG[profile.role];

  return (
    <div className="max-w-lg mx-auto px-4 pb-4">
      <header className="pt-6 pb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">Mon profil</h1>
      </header>

      {/* Profile card */}
      <Card>
        <CardContent className="p-6 flex flex-col items-center text-center">
          <Avatar className="w-20 h-20">
            <AvatarFallback className="text-[28px] font-extrabold bg-primary text-primary-foreground">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>

          <h2 className="mt-4 text-[20px] font-extrabold">{profile.full_name}</h2>

          <div className={cn("mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full", roleConf.bgClass)}>
            <span>{roleConf.icon}</span>
            <span className={cn("text-sm font-semibold", roleConf.colorClass)}>{roleConf.label}</span>
          </div>

          {hotelName && (
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              {hotelName}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { value: stats.doneToday, label: "Aujourd'hui",   colorClass: "text-primary"    },
          { value: stats.doneWeek,  label: "Cette semaine", colorClass: "text-blue-600"   },
          { value: stats.total,     label: "Au total",      colorClass: "text-foreground" },
        ].map(({ value, label, colorClass }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={cn("text-[26px] font-extrabold", colorClass)}>{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status */}
      <Card className="mt-4">
        <CardContent className="p-4 flex items-center justify-between">
          <span className="text-sm font-semibold">Statut du compte</span>
          <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 bg-green-50">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Actif
          </Badge>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <Button
        variant="outline"
        className="w-full gap-2 font-semibold"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        <LogOut className="w-4 h-4" strokeWidth={1.5} />
        {loggingOut ? "Déconnexion…" : "Se déconnecter"}
      </Button>
    </div>
  );
}
