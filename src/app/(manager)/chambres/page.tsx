"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Room, RoomStatus, UserProfile } from "@/types";
import {
  Search, LayoutGrid, List, Building2, CheckCircle2, Wrench, Sparkles,
  TrendingUp, Zap, UserCheck, ChevronLeft,
} from "lucide-react";
import { notifyRoomStatusChange } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_CONFIG: Record<RoomStatus, {
  label: string; dotClass: string; badgeClass: string; bgClass: string; icon: React.ReactNode;
}> = {
  disponible: {
    label: "Disponible",
    dotClass: "bg-green-500",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    bgClass: "bg-green-50",
    icon: <CheckCircle2 className="w-5 h-5 text-green-600" strokeWidth={1.5} />,
  },
  occupee: {
    label: "Occupée",
    dotClass: "bg-blue-500",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    bgClass: "bg-blue-50",
    icon: <Building2 className="w-5 h-5 text-blue-600" strokeWidth={1.5} />,
  },
  nettoyage: {
    label: "Nettoyage",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    bgClass: "bg-amber-50",
    icon: <Sparkles className="w-5 h-5 text-amber-600" strokeWidth={1.5} />,
  },
  maintenance: {
    label: "Maintenance",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    bgClass: "bg-red-50",
    icon: <Wrench className="w-5 h-5 text-red-600" strokeWidth={1.5} />,
  },
};

const TYPE_LABELS: Record<Room["type"], string> = {
  simple: "Simple",
  double: "Double",
  suite:  "Suite",
};

const TYPE_ICONS: Record<Room["type"], React.ReactNode> = {
  simple: <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
  double: <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
  suite:  <Sparkles  className="w-3.5 h-3.5" strokeWidth={1.5} />,
};

type FilterStatus = RoomStatus | "all";
type FilterFloor  = number | "all";

const STATUS_DEPARTMENT: Partial<Record<RoomStatus, { role: string; taskTitle: (r: Room) => string; taskDesc: (r: Room) => string }>> = {
  nettoyage: {
    role: "housekeeping",
    taskTitle: (r) => `Nettoyage chambre ${r.number}`,
    taskDesc:  (r) => `Nettoyage de la chambre ${r.number} (${TYPE_LABELS[r.type]}, étage ${r.floor}).`,
  },
  maintenance: {
    role: "maintenance",
    taskTitle: (r) => `Maintenance chambre ${r.number}`,
    taskDesc:  (r) => `Intervention de maintenance dans la chambre ${r.number} (${TYPE_LABELS[r.type]}, étage ${r.floor}).`,
  },
};

type CleanModal = {
  room: Room;
  targetStatus: "nettoyage" | "maintenance";
  step: "choose" | "manual";
  selectedStaff: string | null;
};

export default function ChambresPage() {
  const supabase = createClient();

  const [rooms,         setRooms]         = useState<Room[]>([]);
  const [hotelId,       setHotelId]       = useState("");
  const [loading,       setLoading]       = useState(true);
  const [updating,      setUpdating]      = useState<string | null>(null);
  const [filterStatus,  setFilterStatus]  = useState<FilterStatus>("all");
  const [filterFloor,   setFilterFloor]   = useState<FilterFloor>("all");
  const [filterType,    setFilterType]    = useState<Room["type"] | "all">("all");
  const [search,        setSearch]        = useState("");
  const [view,          setView]          = useState<"grid" | "list">("grid");

  const [cleanModal,   setCleanModal]   = useState<CleanModal | null>(null);
  const [staffList,    setStaffList]    = useState<UserProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [assigning,    setAssigning]    = useState(false);
  const [noStaffError, setNoStaffError] = useState(false);
  const [assignError,  setAssignError]  = useState("");

  useEffect(() => {
    const hotelIdRef = { current: "" };

    const channel = supabase
      .channel("rooms-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms" },
        (payload) => {
          const updated = payload.new as Room;
          if (hotelIdRef.current && updated.hotel_id !== hotelIdRef.current) return;
          setRooms((prev) => prev.map((r) => r.id === updated.id ? updated : r));
        }
      )
      .subscribe();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("hotel_id").eq("id", user.id).single();
      if (!prof) return;
      hotelIdRef.current = prof.hotel_id;
      setHotelId(prof.hotel_id);
      const { data } = await supabase.from("rooms").select("*").order("number");
      setRooms((data as Room[]) ?? []);
      setLoading(false);
    }
    load();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function setStatus(room: Room, next: RoomStatus) {
    setUpdating(room.id);
    await supabase.from("rooms").update({ status: next, updated_at: new Date().toISOString() }).eq("id", room.id);
    setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, status: next } : r));
    setUpdating(null);
    if (hotelId) notifyRoomStatusChange(hotelId, room.number, next);
  }

  function handleStatusChange(room: Room, next: RoomStatus) {
    if (next === "nettoyage" || next === "maintenance") { openAssignModal(room, next); return; }
    setStatus(room, next);
  }

  async function openAssignModal(room: Room, targetStatus: "nettoyage" | "maintenance") {
    setCleanModal({ room, targetStatus, step: "choose", selectedStaff: null });
    setNoStaffError(false);
    setAssignError("");
    const cfg = STATUS_DEPARTMENT[targetStatus]!;
    setStaffLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStaffLoading(false); return; }
    const { data: prof } = await supabase.from("profiles").select("hotel_id").eq("id", user.id).single();
    if (!prof) { setStaffLoading(false); return; }
    const { data: staff } = await supabase.from("profiles")
      .select("id, full_name, role, hotel_id, is_active")
      .eq("hotel_id", prof.hotel_id).eq("role", cfg.role).eq("is_active", true).order("full_name");
    setStaffList((staff as UserProfile[]) ?? []);
    setStaffLoading(false);
  }

  async function createRoomTask(room: Room, targetStatus: "nettoyage" | "maintenance", assignedTo: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: prof } = await supabase.from("profiles").select("hotel_id").eq("id", user.id).single();
    if (!prof) return false;
    const cfg = STATUS_DEPARTMENT[targetStatus]!;
    const now = new Date().toISOString();
    const { data: newTask, error: taskError } = await supabase.from("tasks").insert({
      hotel_id: prof.hotel_id, created_by: user.id, assigned_to: assignedTo, room_id: room.id,
      title: cfg.taskTitle(room), description: cfg.taskDesc(room), location: `Chambre ${room.number}`,
      type: "routine", status: "a_faire", priority: "normale",
      department: cfg.role as "housekeeping" | "maintenance",
      is_recurring: false, photos: [], checklist: [],
    }).select("id").single();
    if (taskError || !newTask) { setAssignError(taskError?.message ?? "Erreur lors de la création de la tâche."); return false; }
    await supabase.from("rooms").update({ status: targetStatus, updated_at: now }).eq("id", room.id);
    setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, status: targetStatus } : r));
    await supabase.from("notifications").insert({
      hotel_id: prof.hotel_id, user_id: assignedTo, type: "task_assigned",
      title: cfg.taskTitle(room), message: cfg.taskDesc(room), data: { task_id: newTask.id }, is_read: false,
    });
    notifyRoomStatusChange(prof.hotel_id, room.number, targetStatus, newTask.id);
    return true;
  }

  async function handleAutoAssign() {
    if (!cleanModal) return;
    setAssigning(true); setNoStaffError(false); setAssignError("");
    const { targetStatus } = cleanModal;
    const cfg = STATUS_DEPARTMENT[targetStatus]!;
    try {
      let staff = staffList;
      if (staff.length === 0 && !staffLoading) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: prof } = await supabase.from("profiles").select("hotel_id").eq("id", user.id).single();
        if (!prof) return;
        const { data } = await supabase.from("profiles")
          .select("id, full_name, role, hotel_id, is_active")
          .eq("hotel_id", prof.hotel_id).eq("role", cfg.role).eq("is_active", true);
        staff = (data as UserProfile[]) ?? [];
      }
      if (staff.length === 0) { setNoStaffError(true); return; }
      const taskCounts = await Promise.all(staff.map(async (s) => {
        const { count } = await supabase.from("tasks").select("*", { count: "exact", head: true })
          .eq("assigned_to", s.id).in("status", ["a_faire", "en_cours"]);
        return { id: s.id, count: count ?? 0 };
      }));
      const best = taskCounts.sort((a, b) => a.count - b.count)[0];
      const ok = await createRoomTask(cleanModal.room, targetStatus, best.id);
      if (ok) setCleanModal(null);
    } finally { setAssigning(false); }
  }

  async function handleManualAssign() {
    if (!cleanModal?.selectedStaff) return;
    setAssigning(true); setAssignError("");
    const ok = await createRoomTask(cleanModal.room, cleanModal.targetStatus, cleanModal.selectedStaff);
    if (ok) setCleanModal(null);
    setAssigning(false);
  }

  const counts = Object.fromEntries(
    (["disponible", "occupee", "nettoyage", "maintenance"] as RoomStatus[]).map((s) => [
      s, rooms.filter((r) => r.status === s).length,
    ])
  ) as Record<RoomStatus, number>;

  const occupancyRate = rooms.length > 0 ? Math.round((counts.occupee / rooms.length) * 100) : 0;
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);

  const filtered = rooms.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterFloor  !== "all" && r.floor  !== filterFloor)  return false;
    if (filterType   !== "all" && r.type   !== filterType)   return false;
    if (search && !r.number.includes(search)) return false;
    return true;
  });

  const byFloor: Record<number, Room[]> = {};
  for (const room of filtered) {
    if (!byFloor[room.floor]) byFloor[room.floor] = [];
    byFloor[room.floor].push(room);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Gestion des chambres</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vue complète de toutes les chambres avec mises à jour de statut en temps réel.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Occupancy */}
        <Card>
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" strokeWidth={1.5} />
              </div>
              <span className="text-[13px] font-extrabold text-primary">{occupancyRate}%</span>
            </div>
            <div>
              <p className="text-[30px] font-extrabold leading-none">{counts.occupee}</p>
              <p className="text-xs text-muted-foreground mt-1">Chambres occupées</p>
            </div>
            <Progress value={occupancyRate} className="mt-3 h-1.5" />
          </CardContent>
        </Card>

        {(["disponible", "nettoyage", "maintenance"] as RoomStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const pct = rooms.length > 0 ? Math.round((counts[s] / rooms.length) * 100) : 0;
          return (
            <Card
              key={s}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                filterStatus === s && "ring-2 ring-primary"
              )}
              onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", cfg.bgClass)}>
                    {cfg.icon}
                  </div>
                  <Badge variant="outline" className={cn("text-[11px]", cfg.badgeClass)}>{pct}%</Badge>
                </div>
                <p className="text-[30px] font-extrabold leading-none">{counts[s]}</p>
                <p className="text-xs text-muted-foreground mt-1">{cfg.label}</p>
                <div className={cn("mt-3 w-full h-1.5 rounded-full overflow-hidden", cfg.bgClass)}>
                  <div className={cn("h-full rounded-full", cfg.dotClass)} style={{ width: `${pct}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° de chambre..."
            className="pl-9 w-44"
          />
        </div>

        <div className="flex items-center bg-card border border-border rounded-xl p-1 gap-0.5">
          {([
            { key: "all",         label: "Toutes"      },
            { key: "disponible",  label: "Disponibles" },
            { key: "occupee",     label: "Occupées"    },
            { key: "nettoyage",   label: "Nettoyage"   },
            { key: "maintenance", label: "Maintenance" },
          ] as { key: FilterStatus; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors",
                filterStatus === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Select value={String(filterFloor)} onValueChange={(v) => setFilterFloor(v === "all" ? "all" : Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tous les étages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les étages</SelectItem>
            {floors.map((f) => (
              <SelectItem key={f} value={String(f)}>Étage {f}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={(v) => setFilterType(v as Room["type"] | "all")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="simple">Simple</SelectItem>
            <SelectItem value="double">Double</SelectItem>
            <SelectItem value="suite">Suite</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center bg-card border border-border rounded-xl p-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 rounded-lg", view === "grid" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="w-4 h-4" strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 rounded-lg", view === "list" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
            onClick={() => setView("list")}
          >
            <List className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {filtered.length} chambre{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""} · Cliquez sur un statut pour le modifier
      </p>

      {/* Room display */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-xl">🚪</div>
            <p className="text-sm font-semibold text-muted-foreground">Aucune chambre trouvée</p>
            <Button
              variant="link"
              className="mt-2 text-primary"
              onClick={() => { setFilterStatus("all"); setFilterFloor("all"); setFilterType("all"); setSearch(""); }}
            >
              Réinitialiser les filtres
            </Button>
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="flex flex-col gap-8">
          {Object.entries(byFloor)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([floor, floorRooms]) => (
              <div key={floor}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <span className="text-[13px] font-bold">Étage {floor}</span>
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{floorRooms.length} chambre{floorRooms.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {floorRooms.map((room) => {
                    const cfg = STATUS_CONFIG[room.status];
                    return (
                      <Card key={room.id} className={cn("overflow-hidden transition-all hover:shadow-md relative", updating === room.id && "opacity-60")}>
                        <div className={cn("h-1 w-full", cfg.dotClass)} />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-[22px] font-extrabold leading-none">{room.number}</p>
                              <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                                {TYPE_ICONS[room.type]}
                                <span className="text-[11px]">{TYPE_LABELS[room.type]}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide", cfg.badgeClass)}>
                              {cfg.label}
                            </Badge>
                          </div>
                          {room.notes && (
                            <p className="text-[11px] text-muted-foreground leading-snug mb-3 line-clamp-2">{room.notes}</p>
                          )}
                          <div className="flex items-center gap-1.5 mb-4">
                            <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dotClass)} />
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(room.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(["disponible", "occupee", "nettoyage", "maintenance"] as RoomStatus[])
                              .filter((s) => s !== room.status)
                              .map((s) => {
                                const c = STATUS_CONFIG[s];
                                return (
                                  <button
                                    key={s}
                                    onClick={() => handleStatusChange(room, s)}
                                    disabled={updating === room.id}
                                    className={cn(
                                      "text-[10px] font-semibold px-2 py-1 rounded-lg border hover:opacity-80 transition-opacity disabled:opacity-40",
                                      c.badgeClass
                                    )}
                                  >
                                    → {c.label}
                                  </button>
                                );
                              })}
                          </div>
                        </CardContent>
                        {updating === room.id && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-2xl">
                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {filtered.map((room) => {
              const cfg = STATUS_CONFIG[room.status];
              return (
                <div key={room.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors">
                  <div className={cn("w-1 h-10 rounded-full shrink-0", cfg.dotClass)} />
                  <div className="w-16 shrink-0">
                    <p className="text-[18px] font-extrabold">{room.number}</p>
                    <p className="text-[11px] text-muted-foreground">Étage {room.floor}</p>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground w-24 shrink-0">
                    {TYPE_ICONS[room.type]}
                    <span className="text-xs">{TYPE_LABELS[room.type]}</span>
                  </div>
                  <p className="flex-1 text-xs text-muted-foreground truncate">{room.notes || "—"}</p>
                  <p className="text-[11px] text-muted-foreground shrink-0 hidden lg:block">
                    {new Date(room.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={cn("text-[11px]", cfg.badgeClass)}>{cfg.label}</Badge>
                    <div className="flex gap-1">
                      {(["disponible", "occupee", "nettoyage", "maintenance"] as RoomStatus[])
                        .filter((s) => s !== room.status)
                        .map((s) => {
                          const c = STATUS_CONFIG[s];
                          return (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(room, s)}
                              disabled={updating === room.id}
                              className={cn(
                                "text-[10px] font-semibold px-2 py-1 rounded-lg border hover:opacity-80 transition-opacity disabled:opacity-40",
                                c.badgeClass
                              )}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                    </div>
                    {updating === room.id && (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Assignment Dialog */}
      <Dialog open={!!cleanModal} onOpenChange={(open) => { if (!open) setCleanModal(null); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          {cleanModal?.step === "choose" && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4">
                <DialogTitle className="text-[16px]">
                  {STATUS_CONFIG[cleanModal.targetStatus].label} · Chambre {cleanModal.room.number}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Comment voulez-vous assigner cette tâche ?</p>
              </DialogHeader>

              {noStaffError && (
                <p className="mx-6 mb-3 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">
                  Aucun membre {STATUS_DEPARTMENT[cleanModal.targetStatus]?.role} actif trouvé.
                </p>
              )}
              {assignError && (
                <p className="mx-6 mb-3 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{assignError}</p>
              )}

              <div className="px-6 pb-6 flex flex-col gap-3">
                <button
                  onClick={handleAutoAssign}
                  disabled={assigning}
                  className="flex items-center gap-4 p-4 rounded-2xl border-2 border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 hover:border-amber-400 transition-all text-left disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    {assigning
                      ? <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      : <Zap className="w-5 h-5 text-amber-600" strokeWidth={1.5} />
                    }
                  </div>
                  <div>
                    <p className="text-[13px] font-bold">Assignation automatique</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Attribuée au membre le moins chargé</p>
                  </div>
                </button>

                <button
                  onClick={() => setCleanModal({ ...cleanModal, step: "manual" })}
                  disabled={assigning}
                  className="flex items-center gap-4 p-4 rounded-2xl border-2 border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-left disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold">Assignation manuelle</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Choisir un membre de l&apos;équipe</p>
                  </div>
                </button>
              </div>
            </>
          )}

          {cleanModal?.step === "manual" && (
            <>
              <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setCleanModal({ ...cleanModal, step: "choose", selectedStaff: null })}
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-extrabold">Choisir un agent</p>
                  <p className="text-[11px] text-muted-foreground">
                    Chambre {cleanModal.room.number} · {STATUS_DEPARTMENT[cleanModal.targetStatus]?.role === "housekeeping" ? "Housekeeping" : "Maintenance"}
                  </p>
                </div>
              </div>

              <div className="px-4 py-3 max-h-64 overflow-y-auto">
                {staffLoading ? (
                  <div className="flex flex-col gap-2 py-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                  </div>
                ) : staffList.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Aucun agent actif trouvé</p>
                ) : (
                  <div className="flex flex-col gap-2 py-1">
                    {staffList.map((s) => {
                      const isSelected = cleanModal.selectedStaff === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setCleanModal({ ...cleanModal, selectedStaff: s.id })}
                          className={cn(
                            "flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-left transition-all",
                            isSelected ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:border-border"
                          )}
                        >
                          <Avatar className="w-9 h-9 shrink-0">
                            <AvatarFallback className={cn("text-[12px] font-bold", isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                              {s.full_name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-[13px] font-semibold truncate", isSelected ? "text-primary" : "")}>
                              {s.full_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {STATUS_DEPARTMENT[cleanModal.targetStatus]?.role === "housekeeping" ? "Housekeeping" : "Maintenance"}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="px-6 pb-6 pt-3 border-t border-border">
                <Button
                  className="w-full font-bold"
                  onClick={handleManualAssign}
                  disabled={!cleanModal.selectedStaff || assigning}
                >
                  {assigning ? (
                    <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" /> Assignation…</>
                  ) : "Confirmer l'assignation"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
