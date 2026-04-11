"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/types";
import {
  Building2, Save, Plus, Trash2, Pencil, Check, X,
  BedDouble, Layers, Sparkles, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Types ──────────────────────────────────────────────────────────────────

type Hotel = {
  id: string;
  name: string;
  slug: string;
  plan: "basic" | "pro" | "enterprise";
  timezone: string;
};

type RoomEdit = {
  id?: string;       // undefined = new room
  number: string;
  floor: string;
  type: Room["type"];
  notes: string;
};

const EMPTY_ROOM: RoomEdit = { number: "", floor: "1", type: "double", notes: "" };

const TIMEZONES = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Tokyo",
  "Africa/Casablanca",
  "Africa/Tunis",
];

const PLAN_LABELS = { basic: "Basic", pro: "Pro", enterprise: "Enterprise" };
const PLAN_COLORS = {
  basic:      "bg-secondary text-secondary-foreground border-border",
  pro:        "bg-blue-50 text-blue-700 border-blue-200",
  enterprise: "bg-primary/10 text-primary border-primary/20",
};

const TYPE_ICONS = {
  simple: <BedDouble className="w-4 h-4" strokeWidth={1.5} />,
  double: <BedDouble className="w-4 h-4" strokeWidth={1.5} />,
  suite:  <Sparkles  className="w-4 h-4" strokeWidth={1.5} />,
};

const TYPE_LABELS = { simple: "Simple", double: "Double", suite: "Suite" };

// ── Bulk generator helper ──────────────────────────────────────────────────

type BulkConfig = {
  floors: string;
  perFloor: string;
  startNumber: string;
  type: Room["type"];
  prefix: string;
};

function generateBulkRooms(cfg: BulkConfig): RoomEdit[] {
  const floors    = parseInt(cfg.floors)      || 0;
  const perFloor  = parseInt(cfg.perFloor)    || 0;
  const start     = parseInt(cfg.startNumber) || 101;

  if (floors <= 0 || perFloor <= 0) return [];

  const rooms: RoomEdit[] = [];
  let counter = start;

  for (let f = 1; f <= floors; f++) {
    for (let r = 0; r < perFloor; r++) {
      rooms.push({
        number: cfg.prefix ? `${cfg.prefix}${counter}` : String(counter),
        floor:  String(f),
        type:   cfg.type,
        notes:  "",
      });
      counter++;
    }
  }
  return rooms;
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function HotelPage() {
  const supabase = createClient();

  // Hotel info
  const [hotel,        setHotel]        = useState<Hotel | null>(null);
  const [editName,     setEditName]     = useState("");
  const [editTimezone, setEditTimezone] = useState("Europe/Paris");
  const [savingHotel,  setSavingHotel]  = useState(false);
  const [hotelSaved,   setHotelSaved]   = useState(false);

  // Rooms
  const [rooms,       setRooms]       = useState<Room[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showRoomDlg, setShowRoomDlg] = useState(false);
  const [editRoom,    setEditRoom]    = useState<RoomEdit>(EMPTY_ROOM);
  const [savingRoom,  setSavingRoom]  = useState(false);
  const [roomError,   setRoomError]   = useState("");
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  // Bulk generator
  const [showBulk,   setShowBulk]   = useState(false);
  const [bulkCfg,    setBulkCfg]    = useState<BulkConfig>({
    floors: "3", perFloor: "10", startNumber: "101", type: "double", prefix: "",
  });
  const [bulkPreview, setBulkPreview] = useState<RoomEdit[]>([]);
  const [savingBulk,  setSavingBulk]  = useState(false);
  const [bulkError,   setBulkError]   = useState("");

  // Inline edit
  const [editingRoomId,  setEditingRoomId]  = useState<string | null>(null);
  const [inlineEdit,     setInlineEdit]     = useState<RoomEdit>(EMPTY_ROOM);
  const [savingInline,   setSavingInline]   = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles").select("hotel_id").eq("id", user.id).single();
      if (!prof) return;

      const { data: h } = await supabase
        .from("hotels").select("id, name, slug, plan, timezone").eq("id", prof.hotel_id).single();
      if (h) {
        setHotel(h as Hotel);
        setEditName(h.name);
        setEditTimezone(h.timezone);
      }

      const { data: r } = await supabase
        .from("rooms").select("*").eq("hotel_id", prof.hotel_id).order("floor").order("number");
      setRooms((r as Room[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // ── Save hotel info ──────────────────────────────────────────────────────

  async function handleSaveHotel() {
    if (!hotel || !editName.trim()) return;
    setSavingHotel(true);
    await supabase.from("hotels")
      .update({ name: editName.trim(), timezone: editTimezone })
      .eq("id", hotel.id);
    setHotel({ ...hotel, name: editName.trim(), timezone: editTimezone });
    setSavingHotel(false);
    setHotelSaved(true);
    setTimeout(() => setHotelSaved(false), 2000);
  }

  // ── Add / Edit single room ───────────────────────────────────────────────

  function openAddRoom() {
    setEditRoom(EMPTY_ROOM);
    setRoomError("");
    setShowRoomDlg(true);
  }

  function openEditRoom(room: Room) {
    setEditRoom({ id: room.id, number: room.number, floor: String(room.floor), type: room.type, notes: room.notes ?? "" });
    setRoomError("");
    setShowRoomDlg(true);
  }

  async function handleSaveRoom() {
    if (!hotel) return;
    if (!editRoom.number.trim()) { setRoomError("Le numéro de chambre est obligatoire."); return; }
    const floorNum = parseInt(editRoom.floor);
    if (isNaN(floorNum) || floorNum < 0) { setRoomError("Étage invalide."); return; }

    setSavingRoom(true);
    setRoomError("");

    if (editRoom.id) {
      // Update
      const { error } = await supabase.from("rooms").update({
        number: editRoom.number.trim(),
        floor:  floorNum,
        type:   editRoom.type,
        notes:  editRoom.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq("id", editRoom.id);

      if (error) { setRoomError(error.message); setSavingRoom(false); return; }
      setRooms((prev) => prev.map((r) =>
        r.id === editRoom.id
          ? { ...r, number: editRoom.number.trim(), floor: floorNum, type: editRoom.type, notes: editRoom.notes.trim() || undefined }
          : r
      ));
    } else {
      // Insert
      const { data, error } = await supabase.from("rooms").insert({
        hotel_id:   hotel.id,
        number:     editRoom.number.trim(),
        floor:      floorNum,
        type:       editRoom.type,
        notes:      editRoom.notes.trim() || null,
        status:     "disponible",
        is_occupied: false,
        updated_at: new Date().toISOString(),
      }).select("*").single();

      if (error) { setRoomError(error.message); setSavingRoom(false); return; }
      setRooms((prev) => [...prev, data as Room].sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number)));
    }

    setSavingRoom(false);
    setShowRoomDlg(false);
  }

  // ── Delete room ──────────────────────────────────────────────────────────

  async function handleDeleteRoom(id: string) {
    if (!confirm("Supprimer cette chambre ? Les tâches associées resteront.")) return;
    setDeletingId(id);
    await supabase.from("rooms").delete().eq("id", id);
    setRooms((prev) => prev.filter((r) => r.id !== id));
    setDeletingId(null);
  }

  // ── Inline edit ──────────────────────────────────────────────────────────

  function startInlineEdit(room: Room) {
    setEditingRoomId(room.id);
    setInlineEdit({ id: room.id, number: room.number, floor: String(room.floor), type: room.type, notes: room.notes ?? "" });
  }

  async function saveInlineEdit() {
    if (!inlineEdit.id) return;
    setSavingInline(true);
    const floorNum = parseInt(inlineEdit.floor) || 1;
    await supabase.from("rooms").update({
      number: inlineEdit.number.trim(),
      floor:  floorNum,
      type:   inlineEdit.type,
      notes:  inlineEdit.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", inlineEdit.id);
    setRooms((prev) => prev.map((r) =>
      r.id === inlineEdit.id
        ? { ...r, number: inlineEdit.number.trim(), floor: floorNum, type: inlineEdit.type, notes: inlineEdit.notes.trim() || undefined }
        : r
    ));
    setSavingInline(false);
    setEditingRoomId(null);
  }

  // ── Bulk generate ─────────────────────────────────────────────────────────

  useEffect(() => {
    setBulkPreview(generateBulkRooms(bulkCfg));
  }, [bulkCfg]);

  async function handleSaveBulk() {
    if (!hotel || bulkPreview.length === 0) return;
    setSavingBulk(true);
    setBulkError("");

    const rows = bulkPreview.map((r) => ({
      hotel_id:    hotel.id,
      number:      r.number,
      floor:       parseInt(r.floor) || 1,
      type:        r.type,
      status:      "disponible" as const,
      is_occupied: false,
      updated_at:  new Date().toISOString(),
    }));

    const { data, error } = await supabase.from("rooms").insert(rows).select("*");
    if (error) { setBulkError(error.message); setSavingBulk(false); return; }

    setRooms((prev) => [...prev, ...(data as Room[])].sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number)));
    setSavingBulk(false);
    setShowBulk(false);
  }

  // ── Grouped by floor ─────────────────────────────────────────────────────

  const byFloor: Record<number, Room[]> = {};
  for (const r of rooms) {
    if (!byFloor[r.floor]) byFloor[r.floor] = [];
    byFloor[r.floor].push(r);
  }

  const floors = Object.keys(byFloor).map(Number).sort((a, b) => a - b);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold tracking-tight">Mon hôtel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configurez les informations de votre établissement et gérez vos chambres.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* ── Hotel info card ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <CardTitle className="text-[16px]">Informations générales</CardTitle>
                    <CardDescription>Nom et fuseau horaire de votre hôtel</CardDescription>
                  </div>
                </div>
                {hotel && (
                  <Badge variant="outline" className={cn("text-xs", PLAN_COLORS[hotel.plan])}>
                    {PLAN_LABELS[hotel.plan]}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nom de l&apos;hôtel</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ex: Hôtel Belvédère"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fuseau horaire</Label>
                  <Select value={editTimezone} onValueChange={(v) => setEditTimezone(v ?? "")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hotel && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-xl">
                  <span className="font-semibold">Slug :</span>
                  <span className="font-mono">{hotel.slug}</span>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  className="gap-2 font-bold"
                  onClick={handleSaveHotel}
                  disabled={savingHotel}
                >
                  {hotelSaved
                    ? <><Check className="w-4 h-4" strokeWidth={2} /> Enregistré !</>
                    : savingHotel
                    ? "Enregistrement…"
                    : <><Save className="w-4 h-4" strokeWidth={1.5} /> Enregistrer</>
                  }
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Rooms management card ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <BedDouble className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
                  </div>
                  <div>
                    <CardTitle className="text-[16px]">Chambres</CardTitle>
                    <CardDescription>{rooms.length} chambre{rooms.length !== 1 ? "s" : ""} configurée{rooms.length !== 1 ? "s" : ""}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="gap-2 font-semibold" onClick={() => { setBulkError(""); setShowBulk(true); }}>
                    <Layers className="w-4 h-4" strokeWidth={1.5} />
                    Génération en masse
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
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-2xl">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                    <BedDouble className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">Aucune chambre configurée</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Ajoutez des chambres une à une ou utilisez la génération en masse.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setShowBulk(true)}>
                      <Layers className="w-4 h-4" strokeWidth={1.5} />
                      Génération en masse
                    </Button>
                    <Button className="gap-2" onClick={openAddRoom}>
                      <Plus className="w-4 h-4" strokeWidth={1.5} />
                      Ajouter une chambre
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {floors.map((floor) => (
                    <div key={floor}>
                      {/* Floor header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                          </div>
                          <span className="text-sm font-bold">Étage {floor}</span>
                        </div>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">{byFloor[floor].length} chambre{byFloor[floor].length !== 1 ? "s" : ""}</span>
                      </div>

                      {/* Room rows */}
                      <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
                        {byFloor[floor].map((room) => (
                          <div key={room.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                            {editingRoomId === room.id ? (
                              /* ── Inline edit row ── */
                              <div className="flex-1 flex items-center gap-3 flex-wrap">
                                <Input
                                  value={inlineEdit.number}
                                  onChange={(e) => setInlineEdit({ ...inlineEdit, number: e.target.value })}
                                  className="w-24 h-8 text-sm"
                                  placeholder="N°"
                                />
                                <Input
                                  value={inlineEdit.floor}
                                  onChange={(e) => setInlineEdit({ ...inlineEdit, floor: e.target.value })}
                                  className="w-20 h-8 text-sm"
                                  placeholder="Étage"
                                  type="number"
                                />
                                <Select value={inlineEdit.type} onValueChange={(v) => setInlineEdit({ ...inlineEdit, type: v as Room["type"] })}>
                                  <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="simple">Simple</SelectItem>
                                    <SelectItem value="double">Double</SelectItem>
                                    <SelectItem value="suite">Suite</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  value={inlineEdit.notes}
                                  onChange={(e) => setInlineEdit({ ...inlineEdit, notes: e.target.value })}
                                  className="flex-1 h-8 text-sm min-w-32"
                                  placeholder="Notes (optionnel)"
                                />
                                <div className="flex gap-1 ml-auto">
                                  <Button size="icon" className="h-8 w-8" onClick={saveInlineEdit} disabled={savingInline}>
                                    <Check className="w-4 h-4" strokeWidth={2} />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingRoomId(null)}>
                                    <X className="w-4 h-4" strokeWidth={2} />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              /* ── Display row ── */
                              <>
                                <div className="w-12 shrink-0">
                                  <p className="text-[16px] font-extrabold leading-none">{room.number}</p>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                                  {TYPE_ICONS[room.type]}
                                  <span className="text-xs">{TYPE_LABELS[room.type]}</span>
                                </div>
                                <p className="flex-1 text-xs text-muted-foreground truncate">{room.notes || "—"}</p>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => startInlineEdit(room)}
                                  >
                                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteRoom(room.id)}
                                    disabled={deletingId === room.id}
                                  >
                                    {deletingId === room.id
                                      ? <div className="w-3.5 h-3.5 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    }
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Danger zone ── */}
          <Card className="border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" strokeWidth={1.5} />
                </div>
                <div>
                  <CardTitle className="text-[16px] text-destructive">Zone dangereuse</CardTitle>
                  <CardDescription>Actions irréversibles sur votre établissement</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-xl border border-destructive/20 bg-destructive/5">
                <div>
                  <p className="text-sm font-semibold">Supprimer toutes les chambres</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Supprime toutes les chambres de l&apos;hôtel (les tâches restent).</p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    if (!hotel) return;
                    if (!confirm(`Supprimer les ${rooms.length} chambres ? Cette action est irréversible.`)) return;
                    await supabase.from("rooms").delete().eq("hotel_id", hotel.id);
                    setRooms([]);
                  }}
                  disabled={rooms.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  Tout supprimer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Add / Edit room dialog ── */}
      <Dialog open={showRoomDlg} onOpenChange={(open) => { if (!open) setShowRoomDlg(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editRoom.id ? "Modifier la chambre" : "Ajouter une chambre"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Numéro *</Label>
                <Input
                  value={editRoom.number}
                  onChange={(e) => setEditRoom({ ...editRoom, number: e.target.value })}
                  placeholder="Ex: 101"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Étage *</Label>
                <Input
                  type="number"
                  value={editRoom.floor}
                  onChange={(e) => setEditRoom({ ...editRoom, floor: e.target.value })}
                  placeholder="1"
                  min={0}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={editRoom.type} onValueChange={(v) => setEditRoom({ ...editRoom, type: v as Room["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                  <SelectItem value="suite">Suite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input
                value={editRoom.notes}
                onChange={(e) => setEditRoom({ ...editRoom, notes: e.target.value })}
                placeholder="Ex: Vue sur mer, PMR..."
              />
            </div>
            {roomError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{roomError}</p>
            )}
            <Button className="w-full font-bold gap-2" onClick={handleSaveRoom} disabled={savingRoom}>
              {savingRoom ? "Enregistrement…" : <><Check className="w-4 h-4" strokeWidth={2} /> {editRoom.id ? "Enregistrer" : "Ajouter la chambre"}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk generator dialog ── */}
      <Dialog open={showBulk} onOpenChange={(open) => { if (!open) setShowBulk(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Génération en masse</DialogTitle>
            <p className="text-sm text-muted-foreground">Créez plusieurs chambres automatiquement.</p>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre d&apos;étages</Label>
                <Input
                  type="number" min={1} max={50}
                  value={bulkCfg.floors}
                  onChange={(e) => setBulkCfg({ ...bulkCfg, floors: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Chambres par étage</Label>
                <Input
                  type="number" min={1} max={100}
                  value={bulkCfg.perFloor}
                  onChange={(e) => setBulkCfg({ ...bulkCfg, perFloor: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Numéro de départ</Label>
                <Input
                  type="number" min={1}
                  value={bulkCfg.startNumber}
                  onChange={(e) => setBulkCfg({ ...bulkCfg, startNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={bulkCfg.type} onValueChange={(v) => setBulkCfg({ ...bulkCfg, type: v as Room["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                    <SelectItem value="suite">Suite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Préfixe <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input
                value={bulkCfg.prefix}
                onChange={(e) => setBulkCfg({ ...bulkCfg, prefix: e.target.value })}
                placeholder="Ex: A pour A101, A102…"
              />
            </div>

            <Separator />

            {/* Preview */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                Aperçu — {bulkPreview.length} chambre{bulkPreview.length !== 1 ? "s" : ""}
              </p>
              {bulkPreview.length === 0 ? (
                <p className="text-xs text-muted-foreground">Configurez les paramètres ci-dessus.</p>
              ) : (
                <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5 p-3 bg-muted/50 rounded-xl border border-border">
                  {bulkPreview.slice(0, 60).map((r, i) => (
                    <Badge key={i} variant="secondary" className="text-[11px] font-mono">
                      {r.number}
                    </Badge>
                  ))}
                  {bulkPreview.length > 60 && (
                    <Badge variant="outline" className="text-[11px]">+{bulkPreview.length - 60} autres</Badge>
                  )}
                </div>
              )}
            </div>

            {bulkError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{bulkError}</p>
            )}

            <Button
              className="w-full font-bold gap-2"
              onClick={handleSaveBulk}
              disabled={savingBulk || bulkPreview.length === 0}
            >
              {savingBulk
                ? "Création en cours…"
                : <><Plus className="w-4 h-4" strokeWidth={1.5} /> Créer {bulkPreview.length} chambre{bulkPreview.length !== 1 ? "s" : ""}</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
