"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UserProfile, UserRole } from "@/types";
import { Building2, LogOut } from "lucide-react";

const ROLE_CONFIG: Record<UserRole, { label: string; icon: string; color: string; bg: string }> = {
  housekeeping: { label: "Housekeeping", icon: "🧹", color: "text-sky-600",    bg: "bg-sky-50"    },
  maintenance:  { label: "Maintenance",  icon: "🔧", color: "text-amber-600",  bg: "bg-amber-50"  },
  it:           { label: "IT",           icon: "💻", color: "text-purple-600", bg: "bg-purple-50" },
  manager:      { label: "Manager",      icon: "👔", color: "text-[#FA7866]",  bg: "bg-[#FFF1EF]" },
  reception:    { label: "Réception",    icon: "🛎️", color: "text-green-600",  bg: "bg-green-50"  },
};

function Initials({ name }: { name: string }) {
  const parts    = name.trim().split(" ");
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2);
  return (
    <div className="w-20 h-20 rounded-full bg-[#FA7866] flex items-center justify-center">
      <span className="text-white text-[28px] font-extrabold uppercase">{initials}</span>
    </div>
  );
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

      // Profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*, hotels(name)")
        .eq("id", user.id)
        .single();

      if (prof) {
        setProfile(prof as UserProfile);
        setHotelName((prof as { hotels?: { name: string } }).hotels?.name ?? "");
      }

      // Stats
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const [{ count: total }, { count: doneToday }, { count: doneWeek }] = await Promise.all([
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", user.id),
        supabase.from("tasks").select("*", { count: "exact", head: true })
          .eq("assigned_to", user.id).eq("status", "terminee").gte("completed_at", todayStart.toISOString()),
        supabase.from("tasks").select("*", { count: "exact", head: true })
          .eq("assigned_to", user.id).eq("status", "terminee").gte("completed_at", weekStart.toISOString()),
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
        <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
        <div className="h-6 w-40 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-4 w-24 bg-gray-200 rounded-full animate-pulse" />
      </div>
    );
  }

  const roleConf = ROLE_CONFIG[profile.role];

  return (
    <div className="max-w-lg mx-auto px-4 pb-4">
      <header className="pt-6 pb-4">
        <h1 className="text-[22px] font-extrabold text-[#1E1E1E] tracking-tight">Mon profil</h1>
      </header>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
        <Initials name={profile.full_name} />

        <h2 className="mt-4 text-[20px] font-extrabold text-[#1E1E1E]">{profile.full_name}</h2>

        {/* Role badge */}
        <div className={`mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full ${roleConf.bg}`}>
          <span>{roleConf.icon}</span>
          <span className={`text-[13px] font-semibold ${roleConf.color}`}>{roleConf.label}</span>
        </div>

        {/* Hotel */}
        {hotelName && (
          <p className="mt-2 text-[13px] text-gray-400 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            {hotelName}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { value: stats.doneToday, label: "Aujourd'hui", color: "text-[#FA7866]" },
          { value: stats.doneWeek,  label: "Cette semaine", color: "text-blue-600" },
          { value: stats.total,     label: "Au total", color: "text-gray-700" },
        ].map(({ value, label, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className={`text-[26px] font-extrabold ${color}`}>{value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#1E1E1E]">Statut du compte</span>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Actif
        </span>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="mt-6 w-full py-3.5 rounded-2xl border border-gray-200 text-[14px] font-semibold text-gray-500 flex items-center justify-center gap-2 active:scale-[.98] transition-transform disabled:opacity-40"
      >
        <LogOut className="w-4 h-4" strokeWidth={1.5} />
        {loggingOut ? "Déconnexion..." : "Se déconnecter"}
      </button>
    </div>
  );
}
