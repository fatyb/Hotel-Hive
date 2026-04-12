"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Room, RoomType, HotelFull, HotelFacility } from "@/types";
import {
  Building2, Save, Plus, Pencil, Check, Lock, Globe, Phone,
  Link2, Share2, Layers, BedDouble, Wifi, ParkingCircle,
  Waves, Dumbbell, Sparkles, UtensilsCrossed, Wine, ConciergeBell,
  WashingMachine, Users, Thermometer, PawPrint, ChevronDown,
  AlertTriangle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Progress, ProgressTrack, ProgressIndicator,
} from "@/components/ui/progress";

// ── Constants ──────────────────────────────────────────────────────────────

const TIMEZONES = [
  "Europe/Paris", "Europe/London", "Europe/Madrid", "Europe/Rome",
  "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Tokyo", "Africa/Casablanca", "Africa/Tunis",
];

const CURRENCIES = [
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — Dollar" },
  { value: "GBP", label: "GBP — Livre sterling" },
  { value: "MAD", label: "MAD — Dirham marocain" },
  { value: "TND", label: "TND — Dinar tunisien" },
  { value: "CHF", label: "CHF — Franc suisse" },
];

const PLAN_COLORS: Record<string, string> = {
  basic:      "bg-secondary text-secondary-foreground border-border",
  pro:        "bg-blue-50 text-blue-700 border-blue-200",
  enterprise: "bg-primary/10 text-primary border-primary/20",
};

const ROOM_TYPE_ICONS = ["simple", "double", "suite", "family", "deluxe", "penthouse"] as const;

const ROOM_TYPE_ICON_LABELS: Record<string, string> = {
  simple:    "Simple",
  double:    "Double",
  suite:     "Suite",
  family:    "Familiale",
  deluxe:    "Deluxe",
  penthouse: "Penthouse",
};

type Tab = "profil" | "infrastructure" | "politiques" | "equipements";

// ── Preset facilities ──────────────────────────────────────────────────────

type PresetFacility = { name: string; icon: string };

const PRESET_FACILITIES: PresetFacility[] = [
  { name: "WiFi",               icon: "wifi" },
  { name: "Parking",            icon: "parking" },
  { name: "Piscine",            icon: "pool" },
  { name: "Salle de sport",     icon: "gym" },
  { name: "Spa",                icon: "spa" },
  { name: "Restaurant",         icon: "restaurant" },
  { name: "Bar",                icon: "bar" },
  { name: "Room Service",       icon: "room_service" },
  { name: "Blanchisserie",      icon: "laundry" },
  { name: "Salle de conférence",icon: "conference" },
  { name: "Climatisation",      icon: "ac" },
  { name: "Animaux acceptés",   icon: "pets" },
];

function FacilityIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = cn("w-5 h-5", className);
  switch (icon) {
    case "wifi":       return <Wifi         className={cls} strokeWidth={1.5} />;
    case "parking":    return <ParkingCircle className={cls} strokeWidth={1.5} />;
    case "pool":       return <Waves        className={cls} strokeWidth={1.5} />;
    case "gym":        return <Dumbbell     className={cls} strokeWidth={1.5} />;
    case "spa":        return <Sparkles     className={cls} strokeWidth={1.5} />;
    case "restaurant": return <UtensilsCrossed className={cls} strokeWidth={1.5} />;
    case "bar":        return <Wine         className={cls} strokeWidth={1.5} />;
    case "room_service": return <ConciergeBell className={cls} strokeWidth={1.5} />;
    case "laundry":    return <WashingMachine className={cls} strokeWidth={1.5} />;
    case "conference": return <Users        className={cls} strokeWidth={1.5} />;
    case "ac":         return <Thermometer  className={cls} strokeWidth={1.5} />;
    case "pets":       return <PawPrint     className={cls} strokeWidth={1.5} />;
    default:           return <Building2    className={cls} strokeWidth={1.5} />;
  }
}

// ── Default hotel full ─────────────────────────────────────────────────────

function defaultHotelFull(h: HotelFull): HotelFull {
  return {
    ...h,
    currency:           h.currency           ?? "EUR",
    checkin_time:       h.checkin_time        ?? "14:00",
    checkout_time:      h.checkout_time       ?? "11:00",
    vat_rate:           h.vat_rate            ?? 0,
    tourism_tax:        h.tourism_tax         ?? 0,
    extra_bed_price:    h.extra_bed_price     ?? 0,
    cancellation_hours: h.cancellation_hours  ?? 24,
    brand_color:        h.brand_color         ?? "#A4F5A6",
  };
}

// ── Setup completion ───────────────────────────────────────────────────────

function computeSetup(
  hotel: HotelFull | null,
  roomTypes: RoomType[],
  facilities: HotelFacility[],
): { pct: number; missing: string[] } {
  if (!hotel) return { pct: 0, missing: [] };
  const checks: Array<[boolean, string]> = [
    [!!hotel.name,              "Nom de l'hôtel"],
    [!!hotel.timezone,          "Fuseau horaire"],
    [!!hotel.address,           "Adresse"],
    [roomTypes.length > 0,      "Au moins un type de chambre"],
    [true,                      "Horaires check-in / check-out"],
    [facilities.length > 0,     "Au moins un équipement"],
  ];
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  const pct = Math.round(((checks.length - missing.length) / checks.length) * 100);
  return { pct, missing };
}

// ── Room type edit form ────────────────────────────────────────────────────

type RoomTypeEdit = {
  id?: string;
  name: string;
  icon: string;
  capacity: string;
  base_price: string;
  description: string;
};
const EMPTY_RT: RoomTypeEdit = {
  name: "", icon: "double", capacity: "2", base_price: "0", description: "",
};

// ── Room edit form ─────────────────────────────────────────────────────────

type RoomEdit = {
  id?: string;
  number: string;
  floor: string;
  room_type_id: string;
  legacy_type: Room["type"];
  notes: string;
};
const EMPTY_ROOM_EDIT: RoomEdit = {
  number: "", floor: "1", room_type_id: "", legacy_type: "double", notes: "",
};

// ── Bulk form ──────────────────────────────────────────────────────────────

type BulkForm = {
  floor: string;
  from: string;
  to: string;
  room_type_id: string;
  legacy_type: Room["type"];
};
const EMPTY_BULK: BulkForm = {
  floor: "1", from: "101", to: "110", room_type_id: "", legacy_type: "double",
};

// ── Main component ─────────────────────────────────────────────────────────

export default function HotelPage() {
  const supabase = createClient();

  // Core state
  const [hotelId,    setHotelId]    = useState<string | null>(null);
  const [hotel,      setHotel]      = useState<HotelFull | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<Tab>("profil");

  // Tab 1 — Profil form state
  const [profil, setProfil] = useState({
    name: "", timezone: "Europe/Paris", currency: "EUR",
    address: "", phone: "", website: "", logo_url: "",
    social_instagram: "", social_facebook: "",
  });
  const [savingProfil,  setSavingProfil]  = useState(false);
  const [profilSaved,   setProfilSaved]   = useState(false);

  // Tab 2 — Infrastructure
  const [roomTypes,      setRoomTypes]      = useState<RoomType[]>([]);
  const [rooms,          setRooms]          = useState<Room[]>([]);
  const [floorFilter,    setFloorFilter]    = useState<number | null>(null);
  const [showRtDlg,      setShowRtDlg]      = useState(false);
  const [rtEdit,         setRtEdit]         = useState<RoomTypeEdit>(EMPTY_RT);
  const [savingRt,       setSavingRt]       = useState(false);
  const [rtError,        setRtError]        = useState("");
  const [showRoomDlg,    setShowRoomDlg]    = useState(false);
  const [roomEdit,       setRoomEdit]       = useState<RoomEdit>(EMPTY_ROOM_EDIT);
  const [savingRoom,     setSavingRoom]     = useState(false);
  const [roomError,      setRoomError]      = useState("");
  const [showBulkDlg,    setShowBulkDlg]    = useState(false);
  const [bulkForm,       setBulkForm]       = useState<BulkForm>(EMPTY_BULK);
  const [savingBulk,     setSavingBulk]     = useState(false);
  const [bulkError,      setBulkError]      = useState("");

  // Tab 3 — Politiques
  const [politiques, setPolitiques] = useState({
    checkin_time: "14:00", checkout_time: "11:00",
    cancellation_hours: "24", extra_bed_price: "0",
    vat_rate: "0", tourism_tax: "0",
  });
  const [savingPol,  setSavingPol]  = useState(false);
  const [polSaved,   setPolSaved]   = useState(false);

  // Tab 4 — Équipements
  const [facilities,     setFacilities]     = useState<HotelFacility[]>([]);
  const [savingFac,      setSavingFac]      = useState(false);
  const [facSaved,       setFacSaved]       = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles").select("hotel_id").eq("id", user.id).single();
      if (!prof) return;

      const hid = prof.hotel_id as string;
      setHotelId(hid);

      const { data: h } = await supabase
        .from("hotels").select("*").eq("id", hid).single();
      if (h) {
        const full = defaultHotelFull(h as HotelFull);
        setHotel(full);
        setProfil({
          name:             full.name             ?? "",
          timezone:         full.timezone         ?? "Europe/Paris",
          currency:         full.currency         ?? "EUR",
          address:          full.address          ?? "",
          phone:            full.phone            ?? "",
          website:          full.website          ?? "",
          logo_url:         full.logo_url         ?? "",
          social_instagram: full.social_instagram ?? "",
          social_facebook:  full.social_facebook  ?? "",
        });
        setPolitiques({
          checkin_time:       full.checkin_time        ?? "14:00",
          checkout_time:      full.checkout_time       ?? "11:00",
          cancellation_hours: String(full.cancellation_hours ?? 24),
          extra_bed_price:    String(full.extra_bed_price    ?? 0),
          vat_rate:           String(full.vat_rate           ?? 0),
          tourism_tax:        String(full.tourism_tax        ?? 0),
        });
      }

      const { data: rt } = await supabase
        .from("room_types").select("*").eq("hotel_id", hid).order("created_at");
      setRoomTypes((rt as RoomType[]) ?? []);

      const { data: r } = await supabase
        .from("rooms").select("*").eq("hotel_id", hid).order("floor").order("number");
      setRooms((r as Room[]) ?? []);

      const { data: fac } = await supabase
        .from("hotel_facilities").select("*").eq("hotel_id", hid);
      if (fac && fac.length > 0) {
        setFacilities(fac as HotelFacility[]);
      } else {
        // Populate from presets with is_available = false
        setFacilities(
          PRESET_FACILITIES.map((p) => ({
            id:           crypto.randomUUID(),
            hotel_id:     hid,
            name:         p.name,
            icon:         p.icon,
            is_available: false,
          }))
        );
      }

      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tab 1 — Save profil ──────────────────────────────────────────────────

  async function handleSaveProfil() {
    if (!hotelId || !profil.name.trim()) return;
    setSavingProfil(true);
    await supabase.from("hotels").update({
      name:             profil.name.trim(),
      timezone:         profil.timezone,
      currency:         profil.currency,
      address:          profil.address.trim()          || null,
      phone:            profil.phone.trim()            || null,
      website:          profil.website.trim()          || null,
      logo_url:         profil.logo_url.trim()         || null,
      social_instagram: profil.social_instagram.trim() || null,
      social_facebook:  profil.social_facebook.trim()  || null,
    }).eq("id", hotelId);
    setHotel((prev) => prev ? {
      ...prev,
      name:             profil.name.trim(),
      timezone:         profil.timezone,
      currency:         profil.currency,
      address:          profil.address.trim()          || undefined,
      phone:            profil.phone.trim()            || undefined,
      website:          profil.website.trim()          || undefined,
      logo_url:         profil.logo_url.trim()         || undefined,
      social_instagram: profil.social_instagram.trim() || undefined,
      social_facebook:  profil.social_facebook.trim()  || undefined,
    } : prev);
    setSavingProfil(false);
    setProfilSaved(true);
    setTimeout(() => setProfilSaved(false), 2500);
  }

  // ── Tab 2 — Room types CRUD ──────────────────────────────────────────────

  function openAddRt() {
    setRtEdit(EMPTY_RT);
    setRtError("");
    setShowRtDlg(true);
  }

  function openEditRt(rt: RoomType) {
    setRtEdit({
      id:          rt.id,
      name:        rt.name,
      icon:        rt.icon,
      capacity:    String(rt.capacity),
      base_price:  String(rt.base_price),
      description: rt.description ?? "",
    });
    setRtError("");
    setShowRtDlg(true);
  }

  async function handleSaveRt() {
    if (!hotelId) return;
    if (!rtEdit.name.trim()) { setRtError("Le nom est obligatoire."); return; }
    setSavingRt(true);
    setRtError("");
    const payload = {
      hotel_id:    hotelId,
      name:        rtEdit.name.trim(),
      icon:        rtEdit.icon,
      capacity:    parseInt(rtEdit.capacity) || 2,
      base_price:  parseFloat(rtEdit.base_price) || 0,
      description: rtEdit.description.trim() || null,
      amenities:   [],
    };
    if (rtEdit.id) {
      const { error } = await supabase.from("room_types").update(payload).eq("id", rtEdit.id);
      if (error) { setRtError(error.message); setSavingRt(false); return; }
      setRoomTypes((prev) => prev.map((r) =>
        r.id === rtEdit.id
          ? {
              ...r,
              name:        payload.name,
              icon:        payload.icon,
              capacity:    payload.capacity,
              base_price:  payload.base_price,
              description: payload.description ?? undefined,
              amenities:   [],
            }
          : r
      ));
    } else {
      const { data, error } = await supabase.from("room_types").insert(payload).select("*").single();
      if (error) { setRtError(error.message); setSavingRt(false); return; }
      setRoomTypes((prev) => [...prev, data as RoomType]);
    }
    setSavingRt(false);
    setShowRtDlg(false);
  }

  async function handleDeleteRt(id: string) {
    if (!confirm("Supprimer ce type de chambre ? Les chambres liées perdront leur type.")) return;
    await supabase.from("room_types").delete().eq("id", id);
    setRoomTypes((prev) => prev.filter((r) => r.id !== id));
  }

  // ── Tab 2 — Rooms CRUD ───────────────────────────────────────────────────

  function openAddRoom() {
    setRoomEdit(EMPTY_ROOM_EDIT);
    setRoomError("");
    setShowRoomDlg(true);
  }

  function openEditRoom(room: Room) {
    setRoomEdit({
      id:           room.id,
      number:       room.number,
      floor:        String(room.floor),
      room_type_id: room.room_type_id ?? "",
      legacy_type:  room.type,
      notes:        room.notes ?? "",
    });
    setRoomError("");
    setShowRoomDlg(true);
  }

  async function handleSaveRoom() {
    if (!hotelId) return;
    if (!roomEdit.number.trim()) { setRoomError("Le numéro est obligatoire."); return; }
    const floorNum = parseInt(roomEdit.floor);
    if (isNaN(floorNum) || floorNum < 0) { setRoomError("Étage invalide."); return; }
    setSavingRoom(true);
    setRoomError("");
    const payload = {
      hotel_id:     hotelId,
      number:       roomEdit.number.trim(),
      floor:        floorNum,
      type:         roomEdit.legacy_type,
      room_type_id: roomEdit.room_type_id || null,
      notes:        roomEdit.notes.trim() || null,
      updated_at:   new Date().toISOString(),
    };
    if (roomEdit.id) {
      const { error } = await supabase.from("rooms").update(payload).eq("id", roomEdit.id);
      if (error) { setRoomError(error.message); setSavingRoom(false); return; }
      setRooms((prev) => prev.map((r) =>
        r.id === roomEdit.id
          ? { ...r, ...payload, notes: payload.notes ?? undefined, room_type_id: payload.room_type_id ?? undefined }
          : r
      ));
    } else {
      const { data, error } = await supabase.from("rooms").insert({
        ...payload,
        status:      "disponible",
        is_occupied: false,
      }).select("*").single();
      if (error) { setRoomError(error.message); setSavingRoom(false); return; }
      setRooms((prev) => [...prev, data as Room].sort((a, b) =>
        a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true })
      ));
    }
    setSavingRoom(false);
    setShowRoomDlg(false);
  }

  async function handleDeleteRoom(id: string) {
    if (!confirm("Supprimer cette chambre ?")) return;
    await supabase.from("rooms").delete().eq("id", id);
    setRooms((prev) => prev.filter((r) => r.id !== id));
  }

  // ── Tab 2 — Bulk add ─────────────────────────────────────────────────────

  function bulkCount(): number {
    const from = parseInt(bulkForm.from) || 0;
    const to   = parseInt(bulkForm.to)   || 0;
    return to >= from ? to - from + 1 : 0;
  }

  async function handleSaveBulk() {
    if (!hotelId) return;
    const count = bulkCount();
    if (count <= 0) return;
    const floorNum = parseInt(bulkForm.floor) || 1;
    const from     = parseInt(bulkForm.from)  || 101;
    setSavingBulk(true);
    setBulkError("");
    const rows = Array.from({ length: count }, (_, i) => ({
      hotel_id:     hotelId,
      number:       String(from + i),
      floor:        floorNum,
      type:         bulkForm.legacy_type,
      room_type_id: bulkForm.room_type_id || null,
      status:       "disponible" as const,
      is_occupied:  false,
      updated_at:   new Date().toISOString(),
    }));
    const { data, error } = await supabase.from("rooms").insert(rows).select("*");
    if (error) { setBulkError(error.message); setSavingBulk(false); return; }
    setRooms((prev) =>
      [...prev, ...(data as Room[])].sort((a, b) =>
        a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true })
      )
    );
    setSavingBulk(false);
    setShowBulkDlg(false);
    setBulkForm(EMPTY_BULK);
  }

  // ── Tab 3 — Save politiques ──────────────────────────────────────────────

  async function handleSavePolitiques() {
    if (!hotelId) return;
    setSavingPol(true);
    await supabase.from("hotels").update({
      checkin_time:       politiques.checkin_time,
      checkout_time:      politiques.checkout_time,
      cancellation_hours: parseInt(politiques.cancellation_hours) || 24,
      extra_bed_price:    parseFloat(politiques.extra_bed_price)   || 0,
      vat_rate:           parseFloat(politiques.vat_rate)          || 0,
      tourism_tax:        parseFloat(politiques.tourism_tax)       || 0,
    }).eq("id", hotelId);
    setHotel((prev) => prev ? {
      ...prev,
      checkin_time:       politiques.checkin_time,
      checkout_time:      politiques.checkout_time,
      cancellation_hours: parseInt(politiques.cancellation_hours) || 24,
      extra_bed_price:    parseFloat(politiques.extra_bed_price)   || 0,
      vat_rate:           parseFloat(politiques.vat_rate)          || 0,
      tourism_tax:        parseFloat(politiques.tourism_tax)       || 0,
    } : prev);
    setSavingPol(false);
    setPolSaved(true);
    setTimeout(() => setPolSaved(false), 2500);
  }

  // ── Tab 4 — Save facilities ──────────────────────────────────────────────

  async function handleSaveFacilities() {
    if (!hotelId) return;
    setSavingFac(true);
    // Delete existing, then insert all current state
    await supabase.from("hotel_facilities").delete().eq("hotel_id", hotelId);
    if (facilities.length > 0) {
      const rows = facilities.map((f) => ({
        hotel_id:     hotelId,
        name:         f.name,
        icon:         f.icon,
        is_available: f.is_available,
      }));
      const { data } = await supabase.from("hotel_facilities").insert(rows).select("*");
      if (data) setFacilities(data as HotelFacility[]);
    }
    setSavingFac(false);
    setFacSaved(true);
    setTimeout(() => setFacSaved(false), 2500);
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const uniqueFloors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  const filteredRooms = floorFilter === null
    ? rooms
    : rooms.filter((r) => r.floor === floorFilter);
  const byFloor: Record<number, Room[]> = {};
  for (const r of filteredRooms) {
    if (!byFloor[r.floor]) byFloor[r.floor] = [];
    byFloor[r.floor].push(r);
  }
  const sortedFloors = Object.keys(byFloor).map(Number).sort((a, b) => a - b);

  const { pct, missing } = computeSetup(hotel, roomTypes, facilities);

  function getRoomTypeName(room: Room): string {
    if (room.room_type_id) {
      const rt = roomTypes.find((t) => t.id === room.room_type_id);
      if (rt) return rt.name;
    }
    const labels: Record<Room["type"], string> = { simple: "Simple", double: "Double", suite: "Suite" };
    return labels[room.type];
  }

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "profil",         label: "Profil" },
    { id: "infrastructure", label: "Infrastructure" },
    { id: "politiques",     label: "Politiques" },
    { id: "equipements",    label: "Équipements" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-10 w-96 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">Mon hôtel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configurez votre établissement, vos chambres et vos politiques.
        </p>
      </div>

      {/* ── Setup progress ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Configuration de l&apos;hôtel</p>
            <span className={cn("text-sm font-bold tabular-nums", pct === 100 ? "text-green-600" : "text-amber-500")}>
              {pct}%
            </span>
          </div>
          <Progress value={pct}>
            <ProgressTrack>
              <ProgressIndicator
                className={pct === 100 ? "bg-green-500" : "bg-amber-400"}
              />
            </ProgressTrack>
          </Progress>
          {missing.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {missing.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5"
                >
                  <AlertTriangle className="w-3 h-3" strokeWidth={2} />
                  {m}
                </span>
              ))}
            </div>
          )}
          {pct === 100 && (
            <p className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
              Votre hôtel est entièrement configuré.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-muted/60 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB 1 — PROFIL
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "profil" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <CardTitle className="text-[16px]">Profil de l&apos;hôtel</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Informations générales et réseaux sociaux</p>
                </div>
              </div>
              {hotel && (
                <Badge variant="outline" className={cn("text-xs capitalize", PLAN_COLORS[hotel.plan])}>
                  {hotel.plan}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">

            {/* Row 1: Name + Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nom de l&apos;hôtel *</Label>
                <Input
                  value={profil.name}
                  onChange={(e) => setProfil({ ...profil, name: e.target.value })}
                  placeholder="Ex: Hôtel Belvédère"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Identifiant (slug)</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    value={hotel?.slug ?? ""}
                    readOnly
                    className="pl-8 bg-muted/50 text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Timezone + Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fuseau horaire</Label>
                <Select value={profil.timezone} onValueChange={(v) => setProfil({ ...profil, timezone: v ?? "Europe/Paris" })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Devise</Label>
                <Select value={profil.currency} onValueChange={(v) => setProfil({ ...profil, currency: v ?? "EUR" })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Row 3: Address + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Adresse</Label>
                <Input
                  value={profil.address}
                  onChange={(e) => setProfil({ ...profil, address: e.target.value })}
                  placeholder="Ex: 12 rue de la Paix, Paris"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    value={profil.phone}
                    onChange={(e) => setProfil({ ...profil, phone: e.target.value })}
                    placeholder="+33 1 23 45 67 89"
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Website + Logo URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Site web</Label>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    value={profil.website}
                    onChange={(e) => setProfil({ ...profil, website: e.target.value })}
                    placeholder="https://monhotel.com"
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>URL du logo</Label>
                <Input
                  value={profil.logo_url}
                  onChange={(e) => setProfil({ ...profil, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <Separator />

            {/* Row 5: Instagram + Facebook */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Instagram</Label>
                <div className="relative">
                  <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    value={profil.social_instagram}
                    onChange={(e) => setProfil({ ...profil, social_instagram: e.target.value })}
                    placeholder="@monhotel"
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Facebook</Label>
                <div className="relative">
                  <Share2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    value={profil.social_facebook}
                    onChange={(e) => setProfil({ ...profil, social_facebook: e.target.value })}
                    placeholder="https://facebook.com/monhotel"
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <Button
              className="w-full font-bold gap-2"
              onClick={handleSaveProfil}
              disabled={savingProfil}
            >
              {profilSaved
                ? <><Check className="w-4 h-4" strokeWidth={2} /> Enregistré !</>
                : savingProfil
                ? "Enregistrement…"
                : <><Save className="w-4 h-4" strokeWidth={1.5} /> Enregistrer le profil</>
              }
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 2 — INFRASTRUCTURE
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "infrastructure" && (
        <div className="space-y-6">

          {/* ── Section A: Room Types ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[16px]">Types de chambres</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {roomTypes.length} type{roomTypes.length !== 1 ? "s" : ""} configuré{roomTypes.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button className="gap-2 font-bold" onClick={openAddRt}>
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  Ajouter un type
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {roomTypes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-border rounded-2xl">
                  <BedDouble className="w-8 h-8 text-muted-foreground mb-2" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-muted-foreground">Aucun type de chambre</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Créez des types pour mieux organiser vos chambres.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {roomTypes.map((rt) => {
                    const roomCount = rooms.filter((r) => r.room_type_id === rt.id).length;
                    return (
                      <div
                        key={rt.id}
                        className="relative border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <BedDouble className="w-4 h-4 text-primary" strokeWidth={1.5} />
                            </div>
                            <div>
                              <p className="text-sm font-bold leading-tight">{rt.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{ROOM_TYPE_ICON_LABELS[rt.icon] ?? rt.icon}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => openEditRt(rt)}
                            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Users className="w-3 h-3" strokeWidth={1.5} />
                            {rt.capacity} pers.
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {rt.base_price.toLocaleString()} {hotel?.currency ?? "EUR"}/nuit
                          </Badge>
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {roomCount} chambre{roomCount !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        {rt.description && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{rt.description}</p>
                        )}
                        <button
                          onClick={() => handleDeleteRt(rt.id)}
                          className="absolute bottom-3 right-3 p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X className="w-3 h-3" strokeWidth={2} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section B: Rooms ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-[16px]">Chambres</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rooms.length} chambre{rooms.length !== 1 ? "s" : ""} configurée{rooms.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="gap-2 font-semibold" onClick={() => { setBulkError(""); setShowBulkDlg(true); }}>
                    <Layers className="w-4 h-4" strokeWidth={1.5} />
                    Ajout en masse
                  </Button>
                  <Button className="gap-2 font-bold" onClick={openAddRoom}>
                    <Plus className="w-4 h-4" strokeWidth={1.5} />
                    Ajouter
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-2xl">
                  <BedDouble className="w-8 h-8 text-muted-foreground mb-2" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-muted-foreground">Aucune chambre configurée</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Ajoutez des chambres une à une ou utilisez l&apos;ajout en masse.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setShowBulkDlg(true)}>
                      <Layers className="w-4 h-4" strokeWidth={1.5} />
                      Ajout en masse
                    </Button>
                    <Button className="gap-2" onClick={openAddRoom}>
                      <Plus className="w-4 h-4" strokeWidth={1.5} />
                      Ajouter une chambre
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Floor filter pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setFloorFilter(null)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                        floorFilter === null
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      Tous ({rooms.length})
                    </button>
                    {uniqueFloors.map((f) => (
                      <button
                        key={f}
                        onClick={() => setFloorFilter(floorFilter === f ? null : f)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                          floorFilter === f
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        Étage {f} ({rooms.filter((r) => r.floor === f).length})
                      </button>
                    ))}
                  </div>

                  {/* Rooms by floor */}
                  {sortedFloors.map((floor) => (
                    <div key={floor}>
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                          Étage {floor}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">
                          {byFloor[floor].length} chambre{byFloor[floor].length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                        {byFloor[floor].map((room) => (
                          <div
                            key={room.id}
                            className="group relative border border-border rounded-lg p-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
                            onClick={() => openEditRoom(room)}
                          >
                            <p className="text-sm font-extrabold leading-none mb-1">{room.number}</p>
                            <p className="text-[10px] text-muted-foreground truncate leading-tight">
                              {getRoomTypeName(room)}
                            </p>
                            <div className={cn(
                              "absolute top-2 right-2 w-2 h-2 rounded-full",
                              room.status === "disponible"  ? "bg-green-400"  :
                              room.status === "occupee"     ? "bg-red-400"    :
                              room.status === "nettoyage"   ? "bg-amber-400"  :
                                                             "bg-gray-400"
                            )} />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 rounded-lg">
                              <Pencil className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 3 — POLITIQUES
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "politiques" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <ChevronDown className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
              </div>
              <div>
                <CardTitle className="text-[16px]">Politiques de l&apos;hôtel</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Horaires, taxes et règles de séjour</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">

            {/* Row 1: Check-in + Check-out */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Heure d&apos;arrivée (check-in)</Label>
                <Input
                  type="time"
                  value={politiques.checkin_time}
                  onChange={(e) => setPolitiques({ ...politiques, checkin_time: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Heure de départ (check-out)</Label>
                <Input
                  type="time"
                  value={politiques.checkout_time}
                  onChange={(e) => setPolitiques({ ...politiques, checkout_time: e.target.value })}
                />
              </div>
            </div>

            {/* Row 2: Cancellation + Extra bed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Délai d&apos;annulation (heures)</Label>
                <Input
                  type="number"
                  min={0}
                  value={politiques.cancellation_hours}
                  onChange={(e) => setPolitiques({ ...politiques, cancellation_hours: e.target.value })}
                  placeholder="24"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Lit supplémentaire ({hotel?.currency ?? "EUR"})</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={politiques.extra_bed_price}
                  onChange={(e) => setPolitiques({ ...politiques, extra_bed_price: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Row 3: VAT + Tourism tax */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>TVA (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={politiques.vat_rate}
                  onChange={(e) => setPolitiques({ ...politiques, vat_rate: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Taxe de séjour ({hotel?.currency ?? "EUR"}/nuit/pers.)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={politiques.tourism_tax}
                  onChange={(e) => setPolitiques({ ...politiques, tourism_tax: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <Button
              className="w-full font-bold gap-2"
              onClick={handleSavePolitiques}
              disabled={savingPol}
            >
              {polSaved
                ? <><Check className="w-4 h-4" strokeWidth={2} /> Enregistré !</>
                : savingPol
                ? "Enregistrement…"
                : <><Save className="w-4 h-4" strokeWidth={1.5} /> Enregistrer les politiques</>
              }
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 4 — ÉQUIPEMENTS
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "equipements" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <CardTitle className="text-[16px]">Équipements</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sélectionnez les équipements disponibles dans votre établissement
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {facilities.map((fac) => (
                <button
                  key={fac.id}
                  onClick={() =>
                    setFacilities((prev) =>
                      prev.map((f) =>
                        f.id === fac.id ? { ...f, is_available: !f.is_available } : f
                      )
                    )
                  }
                  className={cn(
                    "flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 text-center transition-all",
                    fac.is_available
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30"
                  )}
                >
                  <FacilityIcon
                    icon={fac.icon}
                    className={cn("w-5 h-5", fac.is_available ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="text-xs font-medium leading-tight">{fac.name}</span>
                  {fac.is_available && (
                    <span className="text-[10px] text-primary font-semibold">Disponible</span>
                  )}
                </button>
              ))}
            </div>

            <Button
              className="w-full font-bold gap-2"
              onClick={handleSaveFacilities}
              disabled={savingFac}
            >
              {facSaved
                ? <><Check className="w-4 h-4" strokeWidth={2} /> Enregistré !</>
                : savingFac
                ? "Enregistrement…"
                : <><Save className="w-4 h-4" strokeWidth={1.5} /> Sauvegarder les équipements</>
              }
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          DIALOGS
      ═══════════════════════════════════════════════════════════════════════ */}

      {/* ── Add / Edit Room Type ── */}
      <Dialog open={showRtDlg} onOpenChange={(open) => { if (!open) setShowRtDlg(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{rtEdit.id ? "Modifier le type" : "Nouveau type de chambre"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input
                value={rtEdit.name}
                onChange={(e) => setRtEdit({ ...rtEdit, name: e.target.value })}
                placeholder="Ex: Chambre Deluxe Vue Mer"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_TYPE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setRtEdit({ ...rtEdit, icon })}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      rtEdit.icon === icon
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {ROOM_TYPE_ICON_LABELS[icon]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Capacité (personnes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={rtEdit.capacity}
                  onChange={(e) => setRtEdit({ ...rtEdit, capacity: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prix de base ({hotel?.currency ?? "EUR"}/nuit)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={rtEdit.base_price}
                  onChange={(e) => setRtEdit({ ...rtEdit, base_price: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <textarea
                value={rtEdit.description}
                onChange={(e) => setRtEdit({ ...rtEdit, description: e.target.value })}
                placeholder="Décrivez ce type de chambre…"
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
              />
            </div>

            {rtError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{rtError}</p>
            )}

            <Button className="w-full font-bold gap-2" onClick={handleSaveRt} disabled={savingRt}>
              {savingRt
                ? "Enregistrement…"
                : <><Check className="w-4 h-4" strokeWidth={2} /> {rtEdit.id ? "Enregistrer" : "Créer le type"}</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Room ── */}
      <Dialog open={showRoomDlg} onOpenChange={(open) => { if (!open) setShowRoomDlg(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{roomEdit.id ? "Modifier la chambre" : "Ajouter une chambre"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Numéro *</Label>
                <Input
                  value={roomEdit.number}
                  onChange={(e) => setRoomEdit({ ...roomEdit, number: e.target.value })}
                  placeholder="Ex: 101"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Étage *</Label>
                <Input
                  type="number"
                  min={0}
                  value={roomEdit.floor}
                  onChange={(e) => setRoomEdit({ ...roomEdit, floor: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Type de chambre</Label>
              {roomTypes.length > 0 ? (
                <Select
                  value={roomEdit.room_type_id || "none"}
                  onValueChange={(v) => setRoomEdit({ ...roomEdit, room_type_id: v === "none" ? "" : (v ?? "") })}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun type</SelectItem>
                    {roomTypes.map((rt) => (
                      <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={roomEdit.legacy_type}
                  onValueChange={(v) => setRoomEdit({ ...roomEdit, legacy_type: (v ?? "double") as Room["type"] })}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                    <SelectItem value="suite">Suite</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input
                value={roomEdit.notes}
                onChange={(e) => setRoomEdit({ ...roomEdit, notes: e.target.value })}
                placeholder="Ex: Vue sur mer, PMR…"
              />
            </div>

            {roomError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{roomError}</p>
            )}

            <div className="flex gap-2">
              {roomEdit.id && (
                <button
                  onClick={() => { if (roomEdit.id) handleDeleteRoom(roomEdit.id); setShowRoomDlg(false); }}
                  className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
                >
                  Supprimer
                </button>
              )}
              <Button className="flex-1 font-bold gap-2" onClick={handleSaveRoom} disabled={savingRoom}>
                {savingRoom
                  ? "Enregistrement…"
                  : <><Check className="w-4 h-4" strokeWidth={2} /> {roomEdit.id ? "Enregistrer" : "Ajouter"}</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Add ── */}
      <Dialog open={showBulkDlg} onOpenChange={(open) => { if (!open) setShowBulkDlg(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajout en masse</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Étage</Label>
                <Input
                  type="number"
                  min={0}
                  value={bulkForm.floor}
                  onChange={(e) => setBulkForm({ ...bulkForm, floor: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>De</Label>
                <Input
                  type="number"
                  min={1}
                  value={bulkForm.from}
                  onChange={(e) => setBulkForm({ ...bulkForm, from: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>À</Label>
                <Input
                  type="number"
                  min={1}
                  value={bulkForm.to}
                  onChange={(e) => setBulkForm({ ...bulkForm, to: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Type de chambre</Label>
              {roomTypes.length > 0 ? (
                <Select
                  value={bulkForm.room_type_id || "none"}
                  onValueChange={(v) => setBulkForm({ ...bulkForm, room_type_id: v === "none" ? "" : (v ?? "") })}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun type</SelectItem>
                    {roomTypes.map((rt) => (
                      <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={bulkForm.legacy_type}
                  onValueChange={(v) => setBulkForm({ ...bulkForm, legacy_type: (v ?? "double") as Room["type"] })}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                    <SelectItem value="suite">Suite</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* Preview */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium",
              bulkCount() > 100
                ? "bg-destructive/10 text-destructive"
                : bulkCount() > 0
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}>
              {bulkCount() > 100 && <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />}
              {bulkCount() > 0
                ? `Cela créera ${bulkCount()} chambre${bulkCount() !== 1 ? "s" : ""} sur l'étage ${bulkForm.floor}`
                : "Configurez les numéros ci-dessus."
              }
              {bulkCount() > 100 && <span className="text-xs">(maximum recommandé : 100)</span>}
            </div>

            {bulkError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{bulkError}</p>
            )}

            <Button
              className="w-full font-bold gap-2"
              onClick={handleSaveBulk}
              disabled={savingBulk || bulkCount() <= 0 || bulkCount() > 100}
            >
              {savingBulk
                ? "Création en cours…"
                : <><Plus className="w-4 h-4" strokeWidth={1.5} /> Créer {bulkCount()} chambre{bulkCount() !== 1 ? "s" : ""}</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
