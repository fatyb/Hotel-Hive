"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Task, TaskStatus } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, CheckCircle, BedDouble, ChevronRight, Users, TrendingUp } from "lucide-react";

type Stats = {
  tasksTodo: number;
  tasksInProgress: number;
  tasksDone: number;
  tasksUrgent: number;
  roomsTotal: number;
  roomsOccupied: number;
  roomsDirty: number;
  roomsMaintenance: number;
  staffTotal: number;
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  a_faire:  "À faire",
  en_cours: "En cours",
  terminee: "Terminée",
  annulee:  "Annulée",
};

const DEPT_LABELS: Record<string, string> = {
  housekeeping: "Housekeeping",
  maintenance:  "Maintenance",
  it:           "IT",
  reception:    "Réception",
};

function OccupancyRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const r     = size / 2 - 8;
  const circ  = 2 * Math.PI * r;
  const dash  = (pct / 100) * circ;
  const dash2 = Math.min((pct / 100) * circ * 0.6, circ * 0.55);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" className="text-muted" strokeWidth={8} />
      {/* Purple secondary ring (inner) */}
      <circle cx={size/2} cy={size/2} r={r - 6} fill="none" stroke="#B3A0FF" strokeWidth={3}
        strokeDasharray={`${dash2} ${circ}`} strokeLinecap="round" opacity={0.5} />
      {/* Green primary ring */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#A4F5A6" strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const supabase = createClient();
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [hotelName,   setHotelName]   = useState("");
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase.from("profiles").select("hotels(name)").eq("id", user.id).single();
      if (prof) setHotelName(((prof as unknown) as { hotels?: { name: string } }).hotels?.name ?? "");

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        { count: tasksTodo }, { count: tasksInProgress }, { count: tasksDone }, { count: tasksUrgent },
        { count: roomsTotal }, { count: roomsOccupied }, { count: roomsDirty }, { count: roomsMaintenance },
        { count: staffTotal }, { data: recent },
      ] = await Promise.all([
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "a_faire"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "en_cours"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "terminee").gte("completed_at", today.toISOString()),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("type", "urgente").in("status", ["a_faire", "en_cours"]),
        supabase.from("rooms").select("*", { count: "exact", head: true }),
        supabase.from("rooms").select("*", { count: "exact", head: true }).eq("status", "occupee"),
        supabase.from("rooms").select("*", { count: "exact", head: true }).eq("status", "nettoyage"),
        supabase.from("rooms").select("*", { count: "exact", head: true }).eq("status", "maintenance"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).neq("role", "manager"),
        supabase.from("tasks").select("*").in("status", ["a_faire", "en_cours"]).order("created_at", { ascending: false }).limit(6),
      ]);

      setStats({
        tasksTodo: tasksTodo ?? 0, tasksInProgress: tasksInProgress ?? 0, tasksDone: tasksDone ?? 0,
        tasksUrgent: tasksUrgent ?? 0, roomsTotal: roomsTotal ?? 0, roomsOccupied: roomsOccupied ?? 0,
        roomsDirty: roomsDirty ?? 0, roomsMaintenance: roomsMaintenance ?? 0, staffTotal: staffTotal ?? 0,
      });
      setRecentTasks((recent as Task[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const occupancyPct   = stats.roomsTotal > 0 ? Math.round((stats.roomsOccupied / stats.roomsTotal) * 100) : 0;
  const roomsAvailable = Math.max(0, stats.roomsTotal - stats.roomsOccupied - stats.roomsDirty - stats.roomsMaintenance);

  const roomStatusRows = [
    { label: "Disponibles", count: roomsAvailable,         bg: "bg-[#A4F5A6]", bar: "#A4F5A6", text: "text-[#1E7B20]" },
    { label: "Occupées",    count: stats.roomsOccupied,    bg: "bg-[#B3A0FF]", bar: "#B3A0FF", text: "text-[#5B3FCC]" },
    { label: "Nettoyage",   count: stats.roomsDirty,       bg: "bg-amber-400", bar: "#FBBF24", text: "text-amber-600" },
    { label: "Maintenance", count: stats.roomsMaintenance, bg: "bg-red-400",   bar: "#F87171", text: "text-red-600"   },
  ];

  const statCards = [
    {
      value: stats.tasksUrgent,     label: "Tâches urgentes",
      icon: <AlertTriangle className="w-5 h-5" strokeWidth={1.5} style={{ color: "#A4F5A6" }} />,
      iconBg: "bg-[#A4F5A6]/20", valueClass: "text-[#1E7B20]",
    },
    {
      value: stats.tasksInProgress, label: "En cours",
      icon: <Clock className="w-5 h-5" strokeWidth={1.5} style={{ color: "#B3A0FF" }} />,
      iconBg: "bg-[#B3A0FF]/20",  valueClass: "text-[#5B3FCC]",
    },
    {
      value: stats.tasksDone,       label: "Terminées aujourd'hui",
      icon: <CheckCircle className="w-5 h-5 text-[#222222]" strokeWidth={1.5} />,
      iconBg: "bg-[#222222]/10",   valueClass: "text-[#222222]",
    },
    {
      value: stats.roomsDirty,      label: "Chambres à nettoyer",
      icon: <BedDouble className="w-5 h-5 text-amber-500" strokeWidth={1.5} />,
      iconBg: "bg-amber-50 dark:bg-amber-900/30", valueClass: "text-amber-600",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {hotelName && <p className="text-sm text-muted-foreground -mb-3">{hotelName}</p>}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ value, label, icon, iconBg, valueClass }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
                {icon}
              </div>
              <p className={`text-[32px] font-extrabold leading-none ${valueClass}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-2 font-medium">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Active tasks */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-[15px]">Tâches actives</CardTitle>
              <CardDescription>
                {stats.tasksTodo + stats.tasksInProgress} tâche{stats.tasksTodo + stats.tasksInProgress !== 1 ? "s" : ""} en attente
              </CardDescription>
            </div>
            <Link href="/taches" className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0 hover:underline">
              Voir tout <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </CardHeader>

          {recentTasks.length === 0 ? (
            <CardContent className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Aucune tâche active</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Tout est à jour !</p>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <div className="px-6 py-2.5 grid grid-cols-12 gap-3 border-b border-border">
                {["Tâche", "Département", "Lieu", "Statut"].map((h, i) => (
                  <p key={h} className={`${i === 0 ? "col-span-5" : i === 1 ? "col-span-3" : i === 2 ? "col-span-2" : "col-span-2 text-right"} text-[10px] font-bold text-muted-foreground uppercase tracking-wider`}>{h}</p>
                ))}
              </div>
              <div className="divide-y divide-border">
                {recentTasks.map((task) => (
                  <div key={task.id} className="px-6 py-3.5 grid grid-cols-12 gap-3 items-center hover:bg-muted/30 transition-colors">
                    <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                      <div className={`w-1.5 h-8 rounded-full shrink-0 ${task.type === "urgente" ? "bg-primary" : "bg-border"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{task.title}</p>
                        {task.type === "urgente" && <span className="text-[10px] font-bold text-primary">URGENT</span>}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <Badge variant="secondary" className="text-[11px] font-semibold">
                        {DEPT_LABELS[task.department] ?? task.department}
                      </Badge>
                    </div>
                    <p className="col-span-2 text-xs text-muted-foreground truncate">{task.location || "—"}</p>
                    <div className="col-span-2 flex justify-end">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                        task.status === "en_cours"
                          ? "text-[#5B3FCC]"
                          : "text-muted-foreground"
                      )} style={{
                        background: task.status === "en_cours" ? "#B3A0FF30" : undefined,
                      }}>
                        {STATUS_LABEL[task.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Room status */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-[15px]">Statut des chambres</CardTitle>
                <CardDescription>{stats.roomsTotal} chambres au total</CardDescription>
              </div>
              <Link href="/chambres" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "w-7 h-7")}>
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <OccupancyRing pct={occupancyPct} size={80} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-extrabold">{occupancyPct}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold">Taux d&apos;occupation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats.roomsOccupied} sur {stats.roomsTotal} chambres</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <TrendingUp className="w-3 h-3 text-primary" strokeWidth={2} />
                    <span className="text-[11px] font-semibold text-primary">En temps réel</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {roomStatusRows.map(({ label, count, bg, bar, text }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${bg}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: stats.roomsTotal > 0 ? `${(count / stats.roomsTotal) * 100}%` : "0%", background: bar }} />
                      </div>
                      <span className={`text-xs font-bold w-4 text-right ${text}`}>{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Team card */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-[15px]">Équipe</CardTitle>
              <Link href="/equipe" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "w-7 h-7")}>
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[36px] font-extrabold leading-none">{stats.staffTotal}</p>
                  <p className="text-xs text-muted-foreground mt-1">membres actifs</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ background: "#B3A0FF20" }}>
                  <p className="text-xl font-extrabold" style={{ color: "#5B3FCC" }}>{stats.tasksInProgress}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">En cours</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: "#A4F5A620" }}>
                  <p className="text-xl font-extrabold" style={{ color: "#1E7B20" }}>{stats.tasksDone}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Terminées</p>
                </div>
              </div>
              <Link href="/equipe" className={cn(buttonVariants({ variant: "outline" }), "w-full flex items-center justify-center gap-1.5")}>
                Voir l&apos;équipe <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
