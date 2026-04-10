"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Task, UserRole } from "@/types";
import TaskCard from "@/components/staff/TaskCard";
import { notifyRoomStatusChange } from "@/lib/notifications";
import { Brush, Wrench, Monitor, Star, BellRing, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const todayLabel = new Date().toLocaleDateString("fr-FR", {
  weekday: "long", day: "numeric", month: "long",
});

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

type RoleConfig = {
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  colorClass: string;
};

const ROLE_CONFIG: Record<string, RoleConfig> = {
  housekeeping: { label: "Housekeeping", Icon: Brush,    colorClass: "text-sky-600"    },
  maintenance:  { label: "Maintenance",  Icon: Wrench,   colorClass: "text-amber-600"  },
  it:           { label: "IT",           Icon: Monitor,  colorClass: "text-purple-600" },
  manager:      { label: "Manager",      Icon: Star,     colorClass: "text-primary"    },
  reception:    { label: "Réception",    Icon: BellRing, colorClass: "text-green-600"  },
};

export default function DuJourPage() {
  const supabase = createClient();

  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [userRole, setUserRole] = useState<UserRole>("housekeeping");
  const [hotelId,  setHotelId]  = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("hotel_id, role").eq("id", user.id).single();
      if (profile) { setUserRole(profile.role as UserRole); setHotelId(profile.hotel_id); }

      const { data: rows } = await supabase.from("tasks")
        .select("*, rooms(number)")
        .eq("assigned_to", user.id).eq("is_recurring", true).neq("status", "annulee")
        .order("created_at", { ascending: true });

      if (!rows) { setLoading(false); return; }

      const start = todayStart();
      const toReset = rows.filter((r) => r.status === "terminee" && r.completed_at && r.completed_at < start);
      if (toReset.length > 0) {
        await supabase.from("tasks").update({ status: "a_faire", started_at: null, completed_at: null })
          .in("id", toReset.map((r) => r.id));
      }

      const normalized = rows.map((row) => ({
        ...row,
        photos:       row.photos ?? [],
        location:     row.rooms ? `Chambre ${row.rooms.number}` : undefined,
        status:       toReset.some((r) => r.id === row.id) ? "a_faire" : row.status,
        started_at:   toReset.some((r) => r.id === row.id) ? null : row.started_at,
        completed_at: toReset.some((r) => r.id === row.id) ? null : row.completed_at,
      }));

      setTasks(normalized);
      setLoading(false);
    }
    load();
  }, []);

  async function handleStart(id: string) {
    await supabase.from("tasks").update({ status: "en_cours", started_at: new Date().toISOString() }).eq("id", id);
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "en_cours" } : t));
  }

  async function handleDone(id: string) {
    const now  = new Date().toISOString();
    const task = tasks.find((t) => t.id === id);
    await supabase.from("tasks").update({ status: "terminee", completed_at: now }).eq("id", id);
    if (task?.room_id) {
      const { data: room } = await supabase.from("rooms")
        .update({ status: "disponible", updated_at: now }).eq("id", task.room_id).select("number").single();
      if (room && hotelId) notifyRoomStatusChange(hotelId, room.number, "disponible", id);
    }
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "terminee" } : t));
  }

  const roleConfig = ROLE_CONFIG[userRole] ?? ROLE_CONFIG.housekeeping;
  const total = tasks.length;
  const done  = tasks.filter((t) => t.status === "terminee").length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6">
        <Skeleton className="h-5 w-32 rounded-full mb-2" />
        <Skeleton className="h-32 rounded-2xl mb-4" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl mb-3" />)}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-12">
      <header className="pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className={cn("w-4 h-4", roleConfig.colorClass)} strokeWidth={1.5} />
          <p className="text-xs text-muted-foreground capitalize font-medium">{todayLabel}</p>
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight">Tâches du jour</h1>
        <p className={cn("text-sm font-semibold mt-0.5", roleConfig.colorClass)}>{roleConfig.label}</p>
      </header>

      {/* Progress card */}
      <Card className="mb-5">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold">Progression du jour</span>
            <span className="text-sm font-bold text-primary">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {done} sur {total} tâche{total !== 1 ? "s" : ""} terminée{done !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <CalendarDays className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Aucune tâche pour aujourd&apos;hui</p>
            <p className="text-xs text-muted-foreground mt-1">Profitez de votre journée !</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onStart={handleStart} onDone={handleDone} />
          ))}
        </div>
      )}
    </div>
  );
}
