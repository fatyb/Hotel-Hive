"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Task, Room, RoomStatus, Department, RoomOrder, OrderStatus,
  TaskStatus, TaskType, TaskPriority, ChecklistItem,
} from "@/types";
import {
  BedDouble, ClipboardList, ShoppingCart, AlertTriangle, CheckCircle,
  Clock, Plus, X, Pencil, RefreshCcw, Zap, StickyNote, ChevronRight,
  LogOut, Settings, LayoutDashboard, Search, Bell, Users, Wifi,
  Coffee, PhoneIncoming, Package, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/ui/Logo";

// ── Config ───────────────────────────────────────────────────────────────────
const ROOM_CFG: Record<RoomStatus, { label: string; color: string; bg: string; ring: string; dot: string }> = {
  disponible:  { label: "Libre",       color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20",  ring: "ring-emerald-200 dark:ring-emerald-800",  dot: "bg-emerald-500" },
  occupee:     { label: "Occupée",     color: "text-blue-700 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20",        ring: "ring-blue-200 dark:ring-blue-800",        dot: "bg-blue-500" },
  nettoyage:   { label: "Nettoyage",   color: "text-amber-700 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20",      ring: "ring-amber-200 dark:ring-amber-800",      dot: "bg-amber-500" },
  maintenance: { label: "Maintenance", color: "text-red-700 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-900/20",          ring: "ring-red-200 dark:ring-red-800",          dot: "bg-red-500" },
};

const ORDER_CFG: Record<OrderStatus, { label: string; className: string }> = {
  en_attente: { label: "En attente", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" },
  en_cours:   { label: "En cours",   className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400"     },
  livree:     { label: "Livrée",     className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" },
  annulee:    { label: "Annulée",    className: "bg-secondary text-secondary-foreground border-border"                                },
};

const DEPT_CFG: Record<Department, { label: string; className: string }> = {
  housekeeping: { label: "Housekeeping", className: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400" },
  maintenance:  { label: "Maintenance",  className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" },
  it:           { label: "IT",           className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400" },
  reception:    { label: "Réception",    className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const TASK_STATUS_CFG: Record<TaskStatus, { label: string; className: string }> = {
  a_faire:  { label: "À faire",  className: "bg-secondary text-secondary-foreground border-border" },
  en_cours: { label: "En cours", className: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400" },
  terminee: { label: "Terminée", className: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" },
  annulee:  { label: "Annulée",  className: "bg-secondary text-muted-foreground border-border" },
};

const ORDER_ITEMS_SUGGESTIONS = [
  "Serviettes supplémentaires", "Oreillers supplémentaires", "Room service",
  "Bouteilles d'eau", "Petit-déjeuner en chambre", "Réveil demandé",
  "Taxi commandé", "Fer à repasser", "Chargeur de téléphone",
];

type Tab = "chambres" | "taches" | "commandes";
type RoomFilter = RoomStatus | "all";
type OrderFilter = OrderStatus | "all";

function nowTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function nowDate() {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `${m}min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

// ── Occupancy ring ───────────────────────────────────────────────────────────
function OccupancyRing({ pct, size = 88 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/30" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round" className="text-primary transition-all duration-700" />
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FrontOfficePage() {
  const supabase = createClient();

  // ── Auth & Hotel ────────────────────────────────────────────────────────────
  const [hotelId,    setHotelId]    = useState("");
  const [userId,     setUserId]     = useState("");
  const [userName,   setUserName]   = useState("");
  const [hotelName,  setHotelName]  = useState("");
  const [loading,    setLoading]    = useState(true);

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [rooms,       setRooms]       = useState<Room[]>([]);
  const [tasks,       setTasks]       = useState<(Task & { profiles?: { full_name: string } })[]>([]);
  const [orders,      setOrders]      = useState<RoomOrder[]>([]);
  const [urgents,     setUrgents]     = useState<Task[]>([]);

  // ── UI ────────────────────────────────────────────────────────────────────────
  const [tab,          setTab]          = useState<Tab>("chambres");
  const [roomFilter,   setRoomFilter]   = useState<RoomFilter>("all");
  const [taskFilter,   setTaskFilter]   = useState<TaskStatus | "all">("all");
  const [orderFilter,  setOrderFilter]  = useState<OrderFilter>("all");
  const [search,       setSearch]       = useState("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [noteText,     setNoteText]     = useState("");
  const [savingNote,   setSavingNote]   = useState(false);
  const [time,         setTime]         = useState(nowTime());
  const [shiftNote,    setShiftNote]    = useState(
    typeof window !== "undefined" ? localStorage.getItem("shift_note") ?? "" : ""
  );

  // ── Create Task Dialog ────────────────────────────────────────────────────────
  const [taskDialog,  setTaskDialog]  = useState(false);
  const [newTask,     setNewTask]     = useState({ title: "", dept: "reception" as Department, location: "", type: "routine" as TaskType, priority: "normale" as TaskPriority });
  const [creatingTask, setCreatingTask] = useState(false);

  // ── Create Order Dialog ───────────────────────────────────────────────────────
  const [orderDialog,  setOrderDialog]  = useState(false);
  const [newOrder,     setNewOrder]     = useState({ title: "", room_number: "", notes: "", priority: "normale" as "normale" | "urgente" });
  const [creatingOrder, setCreatingOrder] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Clock ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTime(nowTime()), 30000);
    return () => clearInterval(id);
  }, []);

  // ── Load ──────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("hotel_id, full_name, hotels(name)")
      .eq("id", user.id)
      .single();

    if (!profile?.hotel_id) return;
    setHotelId(profile.hotel_id);
    setUserName(profile.full_name ?? "");
    setHotelName(((profile as unknown) as { hotels?: { name: string } }).hotels?.name ?? "");

    const [{ data: roomsData }, { data: tasksData }, { data: ordersData }] = await Promise.all([
      supabase.from("rooms").select("*").eq("hotel_id", profile.hotel_id).order("floor").order("number"),
      supabase.from("tasks").select("*, profiles:assigned_to(full_name)")
        .eq("hotel_id", profile.hotel_id).in("status", ["a_faire", "en_cours"]).order("created_at", { ascending: false }),
      supabase.from("room_orders").select("*").eq("hotel_id", profile.hotel_id)
        .not("status", "eq", "annulee").order("created_at", { ascending: false }).limit(50),
    ]);

    setRooms(roomsData ?? []);
    setTasks(tasksData ?? []);
    setOrders(ordersData ?? []);
    setUrgents((tasksData ?? []).filter(t => t.type === "urgente" && t.status === "a_faire"));
    setLoading(false);

    // Realtime
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase.channel("fo-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks",      filter: `hotel_id=eq.${profile.hotel_id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms",      filter: `hotel_id=eq.${profile.hotel_id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_orders",filter: `hotel_id=eq.${profile.hotel_id}` }, () => load())
      .subscribe();
  }, []);

  useEffect(() => {
    load();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [load]);

  // ── Update room status ─────────────────────────────────────────────────────
  async function setRoomStatus(room: Room, status: RoomStatus) {
    await supabase.from("rooms").update({ status }).eq("id", room.id);
    setRooms(rs => rs.map(r => r.id === room.id ? { ...r, status } : r));
    if (selectedRoom?.id === room.id) setSelectedRoom(r => r ? { ...r, status } : r);
  }

  // ── Save room note ──────────────────────────────────────────────────────────
  async function saveNote() {
    if (!selectedRoom) return;
    setSavingNote(true);
    await supabase.from("rooms").update({ notes: noteText }).eq("id", selectedRoom.id);
    setRooms(rs => rs.map(r => r.id === selectedRoom.id ? { ...r, notes: noteText } : r));
    setSelectedRoom(r => r ? { ...r, notes: noteText } : r);
    setSavingNote(false);
  }

  // ── Create task ─────────────────────────────────────────────────────────────
  async function createTask() {
    if (!newTask.title.trim() || !hotelId) return;
    setCreatingTask(true);
    await supabase.from("tasks").insert({
      hotel_id: hotelId, created_by: userId,
      title: newTask.title.trim(), description: "",
      type: newTask.type, status: "a_faire",
      priority: newTask.priority, department: newTask.dept,
      location: newTask.location.trim(),
      is_recurring: false, checklist: [], photos: [],
    });
    setCreatingTask(false);
    setTaskDialog(false);
    setNewTask({ title: "", dept: "reception", location: "", type: "routine", priority: "normale" });
    load();
  }

  // ── Create order ────────────────────────────────────────────────────────────
  async function createOrder() {
    if (!newOrder.title.trim() || !hotelId) return;
    setCreatingOrder(true);
    const room = rooms.find(r => r.number === newOrder.room_number);
    await supabase.from("room_orders").insert({
      hotel_id: hotelId,
      room_id: room?.id ?? null,
      room_number: newOrder.room_number.trim(),
      title: newOrder.title.trim(),
      notes: newOrder.notes.trim(),
      priority: newOrder.priority,
      status: "en_attente",
    });
    setCreatingOrder(false);
    setOrderDialog(false);
    setNewOrder({ title: "", room_number: "", notes: "", priority: "normale" });
    load();
  }

  // ── Update order status ─────────────────────────────────────────────────────
  async function updateOrderStatus(id: string, status: OrderStatus) {
    await supabase.from("room_orders").update({ status }).eq("id", id);
    setOrders(os => os.map(o => o.id === id ? { ...o, status } : o));
  }

  // ── Take urgent task ────────────────────────────────────────────────────────
  async function takeTask(id: string) {
    await supabase.from("tasks").update({ assigned_to: userId, status: "en_cours", started_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const occupancyPct = rooms.length > 0 ? Math.round(rooms.filter(r => r.status === "occupee").length / rooms.length * 100) : 0;
  const pendingOrders = orders.filter(o => o.status === "en_attente").length;

  const filteredRooms = rooms.filter(r => {
    if (roomFilter !== "all" && r.status !== roomFilter) return false;
    if (search) return r.number.toLowerCase().includes(search.toLowerCase()) || r.type.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const filteredTasks = tasks.filter(t => {
    if (taskFilter !== "all" && t.status !== taskFilter) return false;
    if (search) return t.title.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const filteredOrders = orders.filter(o => {
    if (orderFilter !== "all" && o.status !== orderFilter) return false;
    if (search) return o.title.toLowerCase().includes(search.toLowerCase()) || o.room_number.includes(search);
    return true;
  });

  const roomTasks  = selectedRoom ? tasks.filter(t => t.room_id === selectedRoom.id) : [];
  const roomOrders = selectedRoom ? orders.filter(o => o.room_id === selectedRoom.id) : [];

  const initials = userName.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 border-b border-border bg-card flex items-center px-4 gap-4 shadow-sm z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 w-52 shrink-0">
          <Logo width={110} />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Front Office</span>
        </div>

        {/* Hotel + Date */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          <p className="text-sm font-bold">{hotelName}</p>
          <Separator orientation="vertical" className="h-4" />
          <p className="text-xs text-muted-foreground capitalize">{nowDate()}</p>
          <Separator orientation="vertical" className="h-4" />
          <p className="text-sm font-mono font-bold tabular-nums">{time}</p>
          {urgents.length > 0 && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1.5 text-rose-500">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-bold">{urgents.length} urgence{urgents.length > 1 ? "s" : ""}</span>
              </div>
            </>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 w-52 justify-end shrink-0">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))} title="Dashboard manager">
            <LayoutDashboard className="w-4 h-4" />
          </Link>
          <Avatar className="w-7 h-7 cursor-default">
            <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold hidden xl:block">{userName.split(" ")[0]}</span>
        </div>
      </header>

      {/* ── 3-Column Body ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ════════ LEFT PANEL ════════ */}
        <aside className="w-56 shrink-0 border-r border-border overflow-y-auto flex flex-col gap-4 p-4 bg-card/50">

          {/* Occupancy */}
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="relative">
              <OccupancyRing pct={occupancyPct} size={88} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-extrabold leading-none">{occupancyPct}%</span>
                <span className="text-[9px] text-muted-foreground font-medium mt-0.5">Occupation</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 w-full text-center">
              {Object.entries(ROOM_CFG).map(([status, cfg]) => {
                const count = rooms.filter(r => r.status === status).length;
                return (
                  <button
                    key={status}
                    onClick={() => { setTab("chambres"); setRoomFilter(status as RoomStatus); }}
                    className={cn("rounded-lg px-2 py-1.5 flex flex-col items-center gap-0.5 transition-all hover:scale-105 active:scale-95", cfg.bg)}
                  >
                    <span className={cn("text-lg font-extrabold leading-none", cfg.color)}>{count}</span>
                    <span className={cn("text-[9px] font-semibold", cfg.color)}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Pending orders stat */}
          <div
            onClick={() => { setTab("commandes"); setOrderFilter("en_attente"); }}
            className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <ShoppingCart className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xl font-extrabold text-amber-700 dark:text-amber-400 leading-none">{pendingOrders}</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold mt-0.5">Commandes en attente</p>
            </div>
          </div>

          <Separator />

          {/* Quick actions */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Actions rapides</p>
            <Button
              size="sm"
              className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setTaskDialog(true)}
            >
              <ClipboardList className="w-4 h-4" />
              Nouvelle tâche
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setOrderDialog(true)}
            >
              <ShoppingCart className="w-4 h-4" />
              Nouvelle commande
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2 border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
              onClick={() => { setNewTask(t => ({ ...t, type: "urgente", priority: "haute" })); setTaskDialog(true); }}
            >
              <AlertTriangle className="w-4 h-4" />
              Signaler urgence
            </Button>
          </div>

          <Separator />

          {/* Shift note */}
          <div className="flex flex-col gap-1.5 flex-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Note de poste</p>
            <Textarea
              placeholder="Infos à transmettre au prochain poste..."
              rows={5}
              value={shiftNote}
              onChange={e => { setShiftNote(e.target.value); localStorage.setItem("shift_note", e.target.value); }}
              className="text-xs resize-none flex-1"
            />
          </div>
        </aside>

        {/* ════════ CENTER PANEL ════════ */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">

          {/* Tab bar + Search */}
          <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {([
                { id: "chambres",  label: "Chambres",  icon: BedDouble,     badge: rooms.filter(r => r.status === "nettoyage" || r.status === "maintenance").length },
                { id: "taches",    label: "Tâches",    icon: ClipboardList, badge: tasks.filter(t => t.status === "a_faire").length },
                { id: "commandes", label: "Commandes", icon: ShoppingCart,  badge: pendingOrders },
              ] as { id: Tab; label: string; icon: React.ElementType; badge: number }[]).map(({ id, label, icon: Icon, badge }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all",
                    tab === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {badge > 0 && (
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      tab === id ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
                    )}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Filter chips by tab */}
            <div className="flex items-center gap-1">
              {tab === "chambres" && (
                <>
                  {(["all", "disponible", "occupee", "nettoyage", "maintenance"] as (RoomFilter)[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setRoomFilter(f)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold transition-colors border",
                        roomFilter === f
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-foreground/20"
                      )}
                    >
                      {f === "all" ? "Tout" : ROOM_CFG[f].label}
                    </button>
                  ))}
                </>
              )}
              {tab === "taches" && (
                <>
                  {(["all", "a_faire", "en_cours"] as (TaskStatus | "all")[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setTaskFilter(f)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold transition-colors border",
                        taskFilter === f
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-foreground/20"
                      )}
                    >
                      {f === "all" ? "Tout" : TASK_STATUS_CFG[f].label}
                    </button>
                  ))}
                </>
              )}
              {tab === "commandes" && (
                <>
                  {(["all", "en_attente", "en_cours", "livree"] as (OrderFilter)[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setOrderFilter(f)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold transition-colors border",
                        orderFilter === f
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-foreground/20"
                      )}
                    >
                      {f === "all" ? "Tout" : ORDER_CFG[f].label}
                    </button>
                  ))}
                </>
              )}
            </div>

            <Button size="sm" variant="ghost" onClick={load} className="gap-1.5 ml-auto shrink-0 h-8 text-xs">
              <RefreshCcw className="w-3.5 h-3.5" />
              Actualiser
            </Button>
          </div>

          {/* ── CHAMBRES TAB ── */}
          {tab === "chambres" && (
            <div className="p-4 flex-1">
              {loading ? (
                <div className="grid grid-cols-4 xl:grid-cols-5 gap-3">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20 text-center">
                  <BedDouble className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
                  <p className="text-muted-foreground">Aucune chambre trouvée</p>
                </div>
              ) : (
                <>
                  {/* Group by floor */}
                  {Array.from(new Set(filteredRooms.map(r => r.floor))).sort((a, b) => a - b).map(floor => (
                    <div key={floor} className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Étage {floor}</p>
                        <div className="flex-1 h-px bg-border" />
                        <p className="text-xs text-muted-foreground">{filteredRooms.filter(r => r.floor === floor).length} chambres</p>
                      </div>
                      <div className="grid grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                        {filteredRooms.filter(r => r.floor === floor).map(room => {
                          const cfg = ROOM_CFG[room.status];
                          const isSelected = selectedRoom?.id === room.id;
                          const roomTaskCount  = tasks.filter(t => t.room_id === room.id).length;
                          const roomOrderCount = orders.filter(o => o.room_id === room.id && o.status !== "livree").length;
                          return (
                            <button
                              key={room.id}
                              onClick={() => { setSelectedRoom(isSelected ? null : room); setNoteText(room.notes ?? ""); }}
                              className={cn(
                                "rounded-xl p-3 text-left ring-2 transition-all duration-200 flex flex-col gap-1.5 hover:scale-[1.03] active:scale-95",
                                cfg.bg,
                                isSelected ? cn(cfg.ring, "scale-[1.03] shadow-lg") : "ring-transparent"
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <span className={cn("text-xl font-extrabold leading-none", cfg.color)}>
                                  {room.number}
                                </span>
                                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0 mt-0.5", cfg.dot)} />
                              </div>
                              <span className={cn("text-[10px] font-semibold capitalize", cfg.color)}>
                                {cfg.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground capitalize">{room.type}</span>
                              <div className="flex items-center gap-1.5 mt-auto">
                                {room.notes && <StickyNote className="w-3 h-3 text-muted-foreground" />}
                                {roomTaskCount > 0  && <div className="flex items-center gap-0.5"><ClipboardList className="w-3 h-3 text-blue-500" /><span className="text-[9px] font-bold text-blue-600">{roomTaskCount}</span></div>}
                                {roomOrderCount > 0 && <div className="flex items-center gap-0.5"><ShoppingCart className="w-3 h-3 text-amber-500" /><span className="text-[9px] font-bold text-amber-600">{roomOrderCount}</span></div>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── TÂCHES TAB ── */}
          {tab === "taches" && (
            <div className="flex-1">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20 text-center">
                  <CheckCircle className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
                  <p className="text-muted-foreground">Aucune tâche active</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {/* Column headers */}
                  <div className="px-4 py-2 grid grid-cols-12 gap-3">
                    {["Tâche", "Département", "Lieu", "Assigné", "Statut", ""].map((h, i) => (
                      <p key={i} className={cn(
                        "text-[10px] font-bold text-muted-foreground uppercase tracking-wider",
                        i === 0 ? "col-span-4" : i === 1 ? "col-span-2" : i === 2 ? "col-span-2" : i === 3 ? "col-span-2" : i === 4 ? "col-span-1" : "col-span-1"
                      )}>{h}</p>
                    ))}
                  </div>
                  {filteredTasks.map(t => (
                    <div key={t.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center hover:bg-muted/30 transition-colors group">
                      <div className="col-span-4 flex items-center gap-2 min-w-0">
                        {t.type === "urgente" && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                        <span className="text-sm font-semibold truncate">{t.title}</span>
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline" className={cn("text-[10px]", DEPT_CFG[t.department].className)}>
                          {DEPT_CFG[t.department].label}
                        </Badge>
                      </div>
                      <p className="col-span-2 text-xs text-muted-foreground truncate">{t.location || "—"}</p>
                      <p className="col-span-2 text-xs text-muted-foreground truncate">
                        {(t as typeof t & { profiles?: { full_name: string } }).profiles?.full_name ?? "Non assigné"}
                      </p>
                      <div className="col-span-1">
                        <Badge variant="outline" className={cn("text-[10px]", TASK_STATUS_CFG[t.status].className)}>
                          {TASK_STATUS_CFG[t.status].label}
                        </Badge>
                      </div>
                      <div className="col-span-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/taches/${t.id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "w-7 h-7")} target="_blank">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── COMMANDES TAB ── */}
          {tab === "commandes" && (
            <div className="p-4 flex-1">
              {loading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20 text-center">
                  <Package className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
                  <p className="text-muted-foreground">Aucune commande</p>
                  <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setOrderDialog(true)}>
                    <Plus className="w-4 h-4" />
                    Nouvelle commande
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredOrders.map(o => {
                    const cfg = ORDER_CFG[o.status];
                    return (
                      <Card key={o.id} className={cn("border-l-4", o.priority === "urgente" ? "border-l-rose-500" : "border-l-border")}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold">{o.title}</span>
                                {o.priority === "urgente" && (
                                  <Badge className="bg-rose-50 text-rose-600 border-rose-200 text-[10px] px-1.5 py-0">Urgent</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground font-medium">Chambre {o.room_number || "—"}</span>
                                <span className="text-xs text-muted-foreground">{timeAgo(o.created_at)}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className={cn("text-[10px] shrink-0", cfg.className)}>{cfg.label}</Badge>
                          </div>
                          {o.notes && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{o.notes}</p>}
                          {/* Status progression */}
                          {o.status !== "livree" && o.status !== "annulee" && (
                            <div className="flex gap-1.5">
                              {o.status === "en_attente" && (
                                <Button
                                  size="sm"
                                  className="flex-1 h-7 text-xs gap-1 bg-blue-500 hover:bg-blue-600 text-white"
                                  onClick={() => updateOrderStatus(o.id, "en_cours")}
                                >
                                  <Zap className="w-3 h-3" />
                                  Prendre en charge
                                </Button>
                              )}
                              {o.status === "en_cours" && (
                                <Button
                                  size="sm"
                                  className="flex-1 h-7 text-xs gap-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                                  onClick={() => updateOrderStatus(o.id, "livree")}
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Marquer livrée
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() => updateOrderStatus(o.id, "annulee")}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ════════ RIGHT PANEL ════════ */}
        <aside className="w-72 shrink-0 border-l border-border overflow-y-auto flex flex-col bg-card/50">
          {selectedRoom ? (
            /* ── Room detail ── */
            <div className="flex flex-col gap-0">
              {/* Room header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-extrabold">#{selectedRoom.number}</span>
                      <Badge variant="outline" className={cn("text-xs", ROOM_CFG[selectedRoom.status].bg, ROOM_CFG[selectedRoom.status].color)}>
                        {ROOM_CFG[selectedRoom.status].label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {selectedRoom.type} · Étage {selectedRoom.floor}
                    </p>
                  </div>
                  <button onClick={() => setSelectedRoom(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Status changers */}
                <div className="grid grid-cols-2 gap-1.5 mt-4">
                  {(Object.entries(ROOM_CFG) as [RoomStatus, typeof ROOM_CFG[RoomStatus]][]).map(([status, cfg]) => (
                    <button
                      key={status}
                      onClick={() => setRoomStatus(selectedRoom, status)}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border-2 transition-all",
                        selectedRoom.status === status
                          ? cn(cfg.bg, cfg.color, cfg.ring)
                          : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="p-4 border-b border-border space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" />
                  Note interne
                </p>
                <Textarea
                  rows={3}
                  placeholder="Note client, demande spéciale..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onBlur={saveNote}
                  className="text-xs resize-none"
                />
                {savingNote && <p className="text-[10px] text-muted-foreground">Enregistrement...</p>}
              </div>

              {/* Room tasks */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5" />
                    Tâches ({roomTasks.length})
                  </p>
                  <button
                    onClick={() => { setNewTask(t => ({ ...t, location: `Chambre ${selectedRoom.number}` })); setTaskDialog(true); }}
                    className="text-primary hover:text-primary/80"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {roomTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune tâche active</p>
                ) : (
                  <div className="space-y-1.5">
                    {roomTasks.map(t => (
                      <div key={t.id} className="flex items-center gap-2 py-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                          t.status === "en_cours" ? "bg-blue-500" : "bg-muted-foreground/40")} />
                        <span className="text-xs flex-1 truncate">{t.title}</span>
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0", TASK_STATUS_CFG[t.status].className)}>
                          {TASK_STATUS_CFG[t.status].label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Room orders */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Commandes ({roomOrders.length})
                  </p>
                  <button
                    onClick={() => { setNewOrder(o => ({ ...o, room_number: selectedRoom.number })); setOrderDialog(true); }}
                    className="text-primary hover:text-primary/80"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {roomOrders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune commande</p>
                ) : (
                  <div className="space-y-1.5">
                    {roomOrders.map(o => (
                      <div key={o.id} className="flex items-center gap-2 py-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                          o.status === "en_cours" ? "bg-blue-500" : o.status === "livree" ? "bg-emerald-500" : "bg-amber-500")} />
                        <span className="text-xs flex-1 truncate">{o.title}</span>
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0", ORDER_CFG[o.status].className)}>
                          {ORDER_CFG[o.status].label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Live feed ── */
            <div className="flex flex-col gap-0">
              {/* Urgences */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Urgences en direct
                  </p>
                  {urgents.length > 0 && (
                    <span className="ml-auto text-xs font-bold text-rose-500">{urgents.length}</span>
                  )}
                </div>
                {urgents.length === 0 ? (
                  <div className="flex items-center gap-2 py-3 text-emerald-600">
                    <CheckCircle className="w-4 h-4" />
                    <p className="text-xs font-semibold">Tout est calme</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {urgents.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 truncate">{t.title}</p>
                          {t.location && <p className="text-[10px] text-rose-500/80 mt-0.5">{t.location}</p>}
                          <p className="text-[10px] text-rose-400 mt-0.5">{timeAgo(t.created_at ?? "")}</p>
                        </div>
                        <button
                          onClick={() => takeTask(t.id)}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-700 shrink-0 mt-0.5"
                        >
                          Prendre
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending orders */}
              <div className="p-4 border-b border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Commandes en attente
                </p>
                {orders.filter(o => o.status === "en_attente").length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune commande en attente</p>
                ) : (
                  <div className="space-y-2">
                    {orders.filter(o => o.status === "en_attente").slice(0, 5).map(o => (
                      <div key={o.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <ShoppingCart className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{o.title}</p>
                          <p className="text-[10px] text-muted-foreground">Ch. {o.room_number} · {timeAgo(o.created_at)}</p>
                        </div>
                        <button
                          onClick={() => updateOrderStatus(o.id, "en_cours")}
                          className="text-[10px] font-bold text-amber-600 hover:text-amber-700 shrink-0"
                        >
                          Prendre
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rooms needing attention */}
              <div className="p-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BedDouble className="w-3.5 h-3.5" />
                  Chambres à préparer
                </p>
                {rooms.filter(r => r.status === "nettoyage" || r.status === "maintenance").length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tout est prêt</p>
                ) : (
                  <div className="space-y-1.5">
                    {rooms.filter(r => r.status === "nettoyage" || r.status === "maintenance").map(r => {
                      const cfg = ROOM_CFG[r.status];
                      return (
                        <button
                          key={r.id}
                          onClick={() => { setSelectedRoom(r); setNoteText(r.notes ?? ""); }}
                          className={cn("w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-muted/50 transition-colors")}
                        >
                          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dot)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold">Chambre {r.number}</p>
                            <p className={cn("text-[10px] font-semibold", cfg.color)}>{cfg.label}</p>
                          </div>
                          {r.notes && <StickyNote className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Create Task Dialog ─────────────────────────────────────────────── */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {newTask.type === "urgente"
                ? <><AlertTriangle className="w-5 h-5 text-rose-500" />Signaler une urgence</>
                : <><ClipboardList className="w-5 h-5 text-primary" />Nouvelle tâche</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Titre *</p>
              <Input
                placeholder="Description de la tâche..."
                value={newTask.title}
                onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && createTask()}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Département</p>
                <Select value={newTask.dept} onValueChange={v => setNewTask(t => ({ ...t, dept: v as Department }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEPT_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Priorité</p>
                <Select value={newTask.priority} onValueChange={v => setNewTask(t => ({ ...t, priority: v as TaskPriority }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basse">Basse</SelectItem>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="haute">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Lieu</p>
              <Input
                placeholder="Chambre 205, Lobby, Piscine..."
                value={newTask.location}
                onChange={e => setNewTask(t => ({ ...t, location: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="urgent-toggle"
                checked={newTask.type === "urgente"}
                onChange={e => setNewTask(t => ({ ...t, type: e.target.checked ? "urgente" : "routine", priority: e.target.checked ? "haute" : "normale" }))}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="urgent-toggle" className="text-sm font-medium">Marquer comme urgente</label>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setTaskDialog(false)}>Annuler</Button>
              <Button
                onClick={createTask}
                disabled={creatingTask || !newTask.title.trim()}
                className={cn("gap-2", newTask.type === "urgente" ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                {creatingTask && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Créer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Order Dialog ────────────────────────────────────────────── */}
      <Dialog open={orderDialog} onOpenChange={setOrderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Nouvelle commande client
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Demande *</p>
              <Input
                placeholder="Ex: Serviettes supplémentaires, Room service..."
                value={newOrder.title}
                onChange={e => setNewOrder(o => ({ ...o, title: e.target.value }))}
              />
              {/* Suggestions */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ORDER_ITEMS_SUGGESTIONS.slice(0, 5).map(s => (
                  <button
                    key={s}
                    onClick={() => setNewOrder(o => ({ ...o, title: s }))}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors border border-border"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Chambre</p>
                <Select value={newOrder.room_number || "__none__"} onValueChange={(v) => setNewOrder(o => ({ ...o, room_number: v === "__none__" ? "" : (v ?? "") }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {rooms.map(r => <SelectItem key={r.id} value={r.number}>Ch. {r.number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Priorité</p>
                <Select value={newOrder.priority} onValueChange={v => setNewOrder(o => ({ ...o, priority: v as "normale" | "urgente" }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Notes</p>
              <Textarea
                placeholder="Détails supplémentaires..."
                rows={2}
                value={newOrder.notes}
                onChange={e => setNewOrder(o => ({ ...o, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setOrderDialog(false)}>Annuler</Button>
              <Button
                onClick={createOrder}
                disabled={creatingOrder || !newOrder.title.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                {creatingOrder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
