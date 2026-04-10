"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Task, UserRole } from "@/types";
import TaskCard from "@/components/staff/TaskCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Brush, Wrench, Monitor, Star, BellRing } from "lucide-react";
import { notifyRoomStatusChange } from "@/lib/notifications";

const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

const ROLE_CONFIG: Record<string, { label: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; color: string }> = {
  housekeeping: { label: "Housekeeping", Icon: Brush,    color: "text-sky-600"    },
  maintenance:  { label: "Maintenance",  Icon: Wrench,   color: "text-amber-600"  },
  it:           { label: "IT",           Icon: Monitor,  color: "text-purple-600" },
  manager:      { label: "Manager",      Icon: Star,     color: "text-primary"    },
  reception:    { label: "Réception",    Icon: BellRing, color: "text-green-600"  },
};

export default function MesTachesPage() {
  const supabase = createClient();
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("housekeeping");
  const [hotelId,  setHotelId]  = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("hotel_id, full_name, role").eq("id", user.id).single();
      if (profile) { setUserName(profile.full_name); setUserRole(profile.role as UserRole); setHotelId(profile.hotel_id); }
      const { data: rows } = await supabase
        .from("tasks").select("*, rooms(number)").eq("assigned_to", user.id).neq("status", "annulee")
        .order("type", { ascending: false }).order("created_at", { ascending: false });
      if (rows) setTasks(rows.map((row) => ({ ...row, photos: row.photos ?? [], location: row.rooms ? `Chambre ${row.rooms.number}` : undefined })));
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
      const { data: room } = await supabase.from("rooms").update({ status: "disponible", updated_at: now }).eq("id", task.room_id).select("number").single();
      if (room && hotelId) notifyRoomStatusChange(hotelId, room.number, "disponible", id);
    }
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "terminee" } : t));
  }

  const activeTasks    = tasks.filter((t) => t.status !== "terminee" && t.status !== "annulee").sort((a, b) => (a.type === "urgente" ? -1 : 1) - (b.type === "urgente" ? -1 : 1));
  const termineesTasks = tasks.filter((t) => t.status === "terminee");

  const roleConfig = ROLE_CONFIG[userRole] ?? ROLE_CONFIG.housekeeping;
  const { Icon: RoleIcon } = roleConfig;

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6">
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-7 w-48 mb-6" />
        {[1,2,3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl mb-3" />)}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-12">
      {/* Header */}
      <header className="pt-6 pb-4">
        <p className="text-xs text-muted-foreground capitalize font-medium">{today}</p>
        <h1 className="text-[22px] font-extrabold mt-0.5 tracking-tight flex items-center gap-2">
          Bonjour, {userName.split(" ")[0]}
          <RoleIcon className={`w-5 h-5 ${roleConfig.color}`} strokeWidth={1.5} />
        </h1>
        <p className={`text-sm font-semibold mt-0.5 ${roleConfig.color}`}>{roleConfig.label}</p>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1 gap-2">
            À faire
            <Badge variant="secondary" className="text-[11px] h-4 px-1.5">{activeTasks.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="terminee" className="flex-1 gap-2">
            Terminées
            <Badge variant="secondary" className="text-[11px] h-4 px-1.5">{termineesTasks.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 flex flex-col gap-3">
          {activeTasks.length === 0 ? (
            <p className="text-center py-16 text-sm text-muted-foreground">Aucune tâche en cours.</p>
          ) : (
            activeTasks.map((task) => (
              <TaskCard key={task.id} task={task} onStart={handleStart} onDone={handleDone} />
            ))
          )}
        </TabsContent>

        <TabsContent value="terminee" className="mt-4 flex flex-col gap-3">
          {termineesTasks.length === 0 ? (
            <p className="text-center py-16 text-sm text-muted-foreground">Aucune tâche terminée.</p>
          ) : (
            termineesTasks.map((task) => (
              <TaskCard key={task.id} task={task} onStart={handleStart} onDone={handleDone} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
