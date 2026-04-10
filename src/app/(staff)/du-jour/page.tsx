"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Task, UserRole } from "@/types";
import TaskCard from "@/components/staff/TaskCard";
import { notifyRoomStatusChange } from "@/lib/notifications";
import { Brush, Wrench, Monitor, Star, BellRing, CalendarDays } from "lucide-react";

const todayLabel = new Date().toLocaleDateString("fr-FR", {
  weekday: "long", day: "numeric", month: "long",
});

// Midnight of today (local time) as ISO string
function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

type RoleConfig = {
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
  iconColor: string;
};

const ROLE_CONFIG: Record<string, RoleConfig> = {
  housekeeping: { label: "Housekeeping", Icon: Brush,    color: "text-sky-600",    iconColor: "text-sky-500"    },
  maintenance:  { label: "Maintenance",  Icon: Wrench,   color: "text-amber-600",  iconColor: "text-amber-500"  },
  it:           { label: "IT",           Icon: Monitor,  color: "text-purple-600", iconColor: "text-purple-500" },
  manager:      { label: "Manager",      Icon: Star,     color: "text-[#FA7866]",  iconColor: "text-[#FA7866]"  },
  reception:    { label: "Réception",    Icon: BellRing, color: "text-green-600",  iconColor: "text-green-500"  },
};

function ProgressBar({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  const done  = tasks.filter((t) => t.status === "terminee").length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[13px] font-semibold text-[#1E1E1E]">Progression du jour</span>
        <span className="text-[13px] font-bold text-[#FA7866]">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FA7866] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[12px] text-gray-400">
        {done} sur {total} tâche{total !== 1 ? "s" : ""} terminée{done !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("hotel_id, role")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserRole(profile.role as UserRole);
        setHotelId(profile.hotel_id);
      }

      // Fetch all recurring tasks for this user (not cancelled)
      const { data: rows } = await supabase
        .from("tasks")
        .select("*, rooms(number)")
        .eq("assigned_to", user.id)
        .eq("is_recurring", true)
        .neq("status", "annulee")
        .order("created_at", { ascending: true });

      if (!rows) { setLoading(false); return; }

      const start = todayStart();

      // Auto-reset: tasks completed before today → back to a_faire for the new day
      const toReset = rows.filter(
        (r) => r.status === "terminee" && r.completed_at && r.completed_at < start
      );

      if (toReset.length > 0) {
        await supabase
          .from("tasks")
          .update({ status: "a_faire", started_at: null, completed_at: null })
          .in("id", toReset.map((r) => r.id));
      }

      // Apply reset locally so UI reflects new state immediately
      const normalized = rows.map((row) => ({
        ...row,
        photos:       row.photos ?? [],
        location:     row.rooms ? `Chambre ${row.rooms.number}` : undefined,
        // If it was reset, reflect that in local state
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
    await supabase
      .from("tasks")
      .update({ status: "en_cours", started_at: new Date().toISOString() })
      .eq("id", id);
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "en_cours" } : t));
  }

  async function handleDone(id: string) {
    const now  = new Date().toISOString();
    const task = tasks.find((t) => t.id === id);

    await supabase.from("tasks").update({ status: "terminee", completed_at: now }).eq("id", id);

    if (task?.room_id) {
      const { data: room } = await supabase
        .from("rooms")
        .update({ status: "disponible", updated_at: now })
        .eq("id", task.room_id)
        .select("number")
        .single();
      if (room && hotelId) notifyRoomStatusChange(hotelId, room.number, "disponible", id);
    }

    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "terminee" } : t));
  }

  const roleConfig = ROLE_CONFIG[userRole] ?? ROLE_CONFIG.housekeeping;

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="h-5 w-32 bg-gray-200 rounded-full mb-2 animate-pulse" />
        <div className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 bg-white rounded-2xl border border-gray-100 animate-pulse mb-3" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-12">
      <header className="pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className={`w-4 h-4 ${roleConfig.iconColor}`} strokeWidth={1.5} />
          <p className="text-[12px] text-gray-400 capitalize font-medium">{todayLabel}</p>
        </div>
        <h1 className="text-[22px] font-extrabold text-[#1E1E1E] tracking-tight">Tâches du jour</h1>
        <p className={`text-[13px] font-semibold mt-0.5 ${roleConfig.color}`}>{roleConfig.label}</p>
      </header>

      <div className="mb-5">
        <ProgressBar tasks={tasks} />
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <CalendarDays className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
          </div>
          <p className="text-[14px] font-semibold text-gray-400">Aucune tâche pour aujourd&apos;hui</p>
          <p className="text-[12px] text-gray-300 mt-1">Profitez de votre journée !</p>
        </div>
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
