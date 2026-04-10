"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Task, Room, RoomStatus } from "@/types";
import {
  AlertTriangle, Clock, CheckCircle, BedDouble,
  Plus, X, StickyNote, ChevronRight, RefreshCcw, Zap,
  ClipboardCheck, PhoneIncoming, Wifi, Coffee, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

// ── Types ────────────────────────────────────────────────────────────────────
type UrgentTask = Task & { profiles?: { full_name: string } };

type ChecklistItem = { id: string; label: string; done: boolean };

const ROOM_STATUS_CONFIG: Record<RoomStatus, { label: string; className: string; dot: string }> = {
  disponible:  { label: "Libre",       className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",  dot: "bg-green-500" },
  occupee:     { label: "Occupée",     className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",       dot: "bg-blue-500" },
  nettoyage:   { label: "Nettoyage",   className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",  dot: "bg-amber-500" },
  maintenance: { label: "Maintenance", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",           dot: "bg-red-500" },
};

const STATUS_ORDER: RoomStatus[] = ["nettoyage", "maintenance", "disponible", "occupee"];

// ── Default daily checklist ───────────────────────────────────────────────────
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "1", label: "Lobby nettoyé et présentable",        done: false },
  { id: "2", label: "Petit-déjeuner prêt et approvisionné",done: false },
  { id: "3", label: "Liste des départs du jour vérifiée",  done: false },
  { id: "4", label: "Clés des chambres prêtes",            done: false },
  { id: "5", label: "Wifi et équipements vérifiés",        done: false },
  { id: "6", label: "Caisse et terminal de paiement OK",   done: false },
  { id: "7", label: "Messages et réservations vérifiés",   done: false },
];

const CHECKLIST_KEY = "reception_checklist_" + new Date().toDateString();

function loadChecklist(): ChecklistItem[] {
  if (typeof window === "undefined") return DEFAULT_CHECKLIST;
  try {
    const saved = localStorage.getItem(CHECKLIST_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_CHECKLIST;
  } catch {
    return DEFAULT_CHECKLIST;
  }
}

function saveChecklist(items: ChecklistItem[]) {
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(items));
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}

function nowHHMM() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReceptionPage() {
  const supabase = createClient();

  const [hotelId,       setHotelId]       = useState("");
  const [userId,        setUserId]        = useState("");
  const [userName,      setUserName]      = useState("");
  const [urgentTasks,   setUrgentTasks]   = useState<UrgentTask[]>([]);
  const [rooms,         setRooms]         = useState<Room[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [checklist,     setChecklist]     = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [time,          setTime]          = useState(nowHHMM());

  // Note modal
  const [noteRoom,      setNoteRoom]      = useState<Room | null>(null);
  const [noteText,      setNoteText]      = useState("");
  const [savingNote,    setSavingNote]    = useState(false);

  // Create urgent task modal
  const [createOpen,    setCreateOpen]    = useState(false);
  const [newTitle,      setNewTitle]      = useState("");
  const [newLocation,   setNewLocation]   = useState("");
  const [creating,      setCreating]      = useState(false);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setTime(nowHHMM()), 30000);
    return () => clearInterval(id);
  }, []);

  // Load checklist from localStorage
  useEffect(() => {
    setChecklist(loadChecklist());
  }, []);

  // ── Fetch data only (no channel setup) ────────────────────────────────────
  const fetchData = useCallback(async (hid: string) => {
    const [{ data: tasks }, { data: roomsData }] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, profiles:assigned_to(full_name)")
        .eq("hotel_id", hid)
        .eq("type", "urgente")
        .in("status", ["a_faire", "en_cours"])
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("rooms")
        .select("*")
        .eq("hotel_id", hid)
        .order("floor")
        .order("number"),
    ]);
    setUrgentTasks(tasks ?? []);
    setRooms(roomsData ?? []);
    setLoading(false);
  }, []);

  // ── Initial load — auth + profile, then data ───────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("hotel_id, full_name")
      .eq("id", user.id)
      .single();

    if (!profile?.hotel_id) return;
    setHotelId(profile.hotel_id);
    setUserName(profile.full_name?.split(" ")[0] ?? "");
    await fetchData(profile.hotel_id);
  }, [fetchData]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime — set up once when hotelId is known ──────────────────────────
  useEffect(() => {
    if (!hotelId) return;
    const channel = supabase
      .channel("reception-tasks-" + hotelId)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "tasks",
        filter: `hotel_id=eq.${hotelId}`,
      }, () => fetchData(hotelId))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "rooms",
        filter: `hotel_id=eq.${hotelId}`,
      }, () => fetchData(hotelId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hotelId, fetchData]);

  // ── Checklist toggle ───────────────────────────────────────────────────────
  function toggleCheck(id: string) {
    setChecklist(prev => {
      const next = prev.map(c => c.id === id ? { ...c, done: !c.done } : c);
      saveChecklist(next);
      return next;
    });
  }

  function resetChecklist() {
    const reset = DEFAULT_CHECKLIST.map(c => ({ ...c, done: false }));
    setChecklist(reset);
    saveChecklist(reset);
  }

  // ── Take urgent task ───────────────────────────────────────────────────────
  async function takeTask(task: UrgentTask) {
    await supabase.from("tasks").update({
      assigned_to: userId,
      status: "en_cours",
      started_at: new Date().toISOString(),
    }).eq("id", task.id);
    load();
  }

  // ── Save room note ─────────────────────────────────────────────────────────
  async function saveNote() {
    if (!noteRoom) return;
    setSavingNote(true);
    await supabase.from("rooms").update({ notes: noteText }).eq("id", noteRoom.id);
    setRooms(rs => rs.map(r => r.id === noteRoom.id ? { ...r, notes: noteText } : r));
    setSavingNote(false);
    setNoteRoom(null);
  }

  // ── Create urgent task ─────────────────────────────────────────────────────
  async function createUrgent() {
    if (!newTitle.trim() || !hotelId) return;
    setCreating(true);
    await supabase.from("tasks").insert({
      hotel_id:    hotelId,
      created_by:  userId,
      title:       newTitle.trim(),
      description: "",
      type:        "urgente",
      status:      "a_faire",
      priority:    "haute",
      department:  "reception",
      location:    newLocation.trim(),
      is_recurring: false,
      checklist:   [],
      photos:      [],
    });
    setCreating(false);
    setCreateOpen(false);
    setNewTitle("");
    setNewLocation("");
    load();
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const urgentCount = urgentTasks.filter(t => t.status === "a_faire").length;
  const cleanCount  = rooms.filter(r => r.status === "nettoyage").length;
  const doneItems   = checklist.filter(c => c.done).length;
  const sortedRooms = [...rooms].sort((a, b) => {
    const ao = STATUS_ORDER.indexOf(a.status);
    const bo = STATUS_ORDER.indexOf(b.status);
    return ao - bo || a.number.localeCompare(b.number);
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5 pb-6">

      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{time}</p>
          <h1 className="text-xl font-bold mt-0.5">
            Bonjour{userName ? ` ${userName}` : ""} 👋
          </h1>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchData(hotelId)}
          title="Actualiser"
        >
          <RefreshCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          [1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <Card className={cn("border-2", urgentCount > 0 ? "border-rose-300 dark:border-rose-700" : "border-border")}>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <AlertTriangle className={cn("w-4 h-4", urgentCount > 0 ? "text-rose-500" : "text-muted-foreground")} />
                </div>
                <p className={cn("text-2xl font-extrabold", urgentCount > 0 ? "text-rose-500" : "text-foreground")}>
                  {urgentCount}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Urgents</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <BedDouble className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl font-extrabold">{cleanCount}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Nettoyage</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <ClipboardCheck className={cn("w-4 h-4", doneItems === checklist.length ? "text-green-500" : "text-muted-foreground")} />
                </div>
                <p className="text-2xl font-extrabold">{doneItems}/{checklist.length}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Checklist</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Urgent tasks ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Demandes urgentes
          </h2>
          <Button
            size="sm"
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-2.5 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle urgence
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : urgentTasks.length === 0 ? (
          <Card>
            <CardContent className="py-8 flex flex-col items-center gap-2 text-center">
              <ShieldCheck className="w-8 h-8 text-green-500" />
              <p className="text-sm font-semibold">Aucune urgence</p>
              <p className="text-xs text-muted-foreground">Tout est calme pour l&apos;instant</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {urgentTasks.map(t => (
              <Card
                key={t.id}
                className={cn(
                  "border-l-4 transition-all",
                  t.status === "a_faire" ? "border-l-rose-500" : "border-l-blue-500"
                )}
              >
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{t.title}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 shrink-0",
                          t.status === "a_faire"
                            ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/30"
                            : "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30"
                        )}
                      >
                        {t.status === "a_faire" ? "En attente" : "En cours"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {t.location && (
                        <span className="text-xs text-muted-foreground">{t.location}</span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(t.created_at ?? "")}
                      </span>
                      {t.profiles?.full_name && (
                        <span className="text-xs text-muted-foreground">→ {t.profiles.full_name}</span>
                      )}
                    </div>
                  </div>
                  {t.status === "a_faire" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-7 px-2.5 text-xs gap-1 border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400"
                      onClick={() => takeTask(t)}
                    >
                      <Zap className="w-3 h-3" />
                      Prendre
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Daily checklist ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            Checklist du jour
          </h2>
          <button
            onClick={resetChecklist}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Réinitialiser
          </button>
        </div>

        <Card>
          <CardContent className="py-3 divide-y divide-border">
            {checklist.map((item, i) => {
              const Icon = [Coffee, Wifi, PhoneIncoming, ClipboardCheck, ShieldCheck, BedDouble, CheckCircle][i % 7];
              return (
                <button
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className="w-full flex items-center gap-3 py-3 first:pt-2 last:pb-2 text-left group"
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                    item.done
                      ? "bg-primary border-primary"
                      : "border-border group-hover:border-primary/50"
                  )}>
                    {item.done && <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />}
                  </div>
                  <Icon className={cn("w-4 h-4 shrink-0 transition-colors", item.done ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn(
                    "text-sm transition-colors flex-1",
                    item.done ? "line-through text-muted-foreground" : "text-foreground"
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* ── Room status ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
          <BedDouble className="w-4 h-4 text-primary" />
          Chambres
        </h2>

        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : rooms.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Aucune chambre configurée
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {sortedRooms.map(room => {
              const cfg = ROOM_STATUS_CONFIG[room.status];
              return (
                <button
                  key={room.id}
                  onClick={() => { setNoteRoom(room); setNoteText(room.notes ?? ""); }}
                  className={cn(
                    "rounded-xl p-3 text-left border transition-all hover:scale-[1.02] active:scale-95",
                    cfg.className,
                    "flex flex-col gap-1"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">#{room.number}</span>
                    <div className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                  </div>
                  <span className="text-[10px] font-semibold opacity-80">{cfg.label}</span>
                  {room.notes && (
                    <StickyNote className="w-3 h-3 opacity-60 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Note modal ──────────────────────────────────────────────────────── */}
      <Dialog open={!!noteRoom} onOpenChange={open => !open && setNoteRoom(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-primary" />
              Chambre {noteRoom?.number}
              {noteRoom && (
                <Badge variant="outline" className={cn("text-xs ml-1", ROOM_STATUS_CONFIG[noteRoom.status].className)}>
                  {ROOM_STATUS_CONFIG[noteRoom.status].label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Note interne</p>
              <Textarea
                placeholder="Ex: Client demande oreiller supplémentaire, réveil 7h..."
                rows={4}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNoteRoom(null)}>Annuler</Button>
              <Button
                onClick={saveNote}
                disabled={savingNote}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                {savingNote && <RefreshCcw className="w-3.5 h-3.5 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create urgent task modal ─────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Nouvelle urgence
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Titre *</p>
              <Input
                placeholder="Ex: Client bloqué en ascenseur"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createUrgent()}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Lieu</p>
              <Input
                placeholder="Ex: Hall, Chambre 203, Piscine..."
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button
                onClick={createUrgent}
                disabled={creating || !newTitle.trim()}
                className="bg-rose-500 hover:bg-rose-600 text-white gap-2"
              >
                {creating && <RefreshCcw className="w-3.5 h-3.5 animate-spin" />}
                <AlertTriangle className="w-3.5 h-3.5" />
                Signaler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
