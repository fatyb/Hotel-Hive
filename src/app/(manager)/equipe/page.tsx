"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserProfile, UserRole, ShiftType } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Search, Plus, Users, CheckCircle, Clock, Star,
  Brush, Wrench, Monitor, BellRing, Phone, Layers,
  Sun, Moon, Sunset, Coffee, Pencil, Copy, Check,
  Mail, Shield, TrendingUp, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Config ───────────────────────────────────────────────────────────────────
type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;

const ROLE_CONFIG: Record<UserRole, { label: string; Icon: IconComponent; color: string; bg: string }> = {
  housekeeping: { label: "Housekeeping", Icon: Brush,    color: "text-sky-600 dark:text-sky-400",    bg: "bg-sky-50 dark:bg-sky-900/30" },
  maintenance:  { label: "Maintenance",  Icon: Wrench,   color: "text-amber-600 dark:text-amber-400",bg: "bg-amber-50 dark:bg-amber-900/30" },
  it:           { label: "IT",           Icon: Monitor,  color: "text-purple-600 dark:text-purple-400",bg: "bg-purple-50 dark:bg-purple-900/30" },
  manager:      { label: "Manager",      Icon: Star,     color: "text-primary",                      bg: "bg-primary/10" },
  reception:    { label: "Réception",    Icon: BellRing, color: "text-emerald-600 dark:text-emerald-400",bg: "bg-emerald-50 dark:bg-emerald-900/30" },
};

const SHIFT_CONFIG: Record<ShiftType, { label: string; Icon: IconComponent; className: string }> = {
  matin:      { label: "Matin",       Icon: Sun,     className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" },
  "apres-midi":{ label: "Après-midi", Icon: Sunset,  className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400" },
  nuit:       { label: "Nuit",        Icon: Moon,    className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400" },
  repos:      { label: "Repos",       Icon: Coffee,  className: "bg-secondary text-secondary-foreground border-border" },
};

const DEPT_ROLES: UserRole[] = ["housekeeping", "maintenance", "it", "reception"];

// ── Types ─────────────────────────────────────────────────────────────────────
type StaffMember = UserProfile & {
  tasksDone: number;
  tasksInProgress: number;
  tasksTodo: number;
};

type InviteForm = {
  full_name: string;
  email: string;
  phone_number: string;
  role: UserRole;
  assigned_floor: string;
  shift_type: ShiftType;
  working_hours: string;
};

const EMPTY_FORM: InviteForm = {
  full_name: "", email: "", phone_number: "",
  role: "housekeeping", assigned_floor: "",
  shift_type: "matin", working_hours: "07:00–15:00",
};

// ── Avatar helper ─────────────────────────────────────────────────────────────
function MemberAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const parts = name.trim().split(" ");
  const init  = parts.length >= 2 ? parts[0][0] + parts[parts.length-1][0] : name.slice(0, 2);
  const sz    = { sm: "w-8 h-8 text-[10px]", md: "w-9 h-9 text-[12px]", lg: "w-12 h-12 text-[15px]" }[size];
  return (
    <Avatar className={sz}>
      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
        {init.toUpperCase() || "?"}
      </AvatarFallback>
    </Avatar>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EquipePage() {
  const supabase = createClient();

  const [members,    setMembers]    = useState<StaffMember[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filterRole, setFilterRole] = useState<UserRole | "all">("all");
  const [hotelId,    setHotelId]    = useState("");

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form,       setForm]       = useState<InviteForm>(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  // Success dialog (show PIN)
  const [pinDialog,  setPinDialog]  = useState<{ name: string; email: string; pin: string } | null>(null);

  // Edit dialog
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [editForm,   setEditForm]   = useState<Partial<InviteForm>>({});
  const [editSaving, setEditSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .neq("role", "manager")
      .order("full_name");

    if (!profiles) { setLoading(false); return; }

    const enriched = await Promise.all(
      (profiles as UserProfile[]).map(async (p) => {
        const [{ count: tasksDone }, { count: tasksInProgress }, { count: tasksTodo }] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", p.id).eq("status", "terminee"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", p.id).eq("status", "en_cours"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", p.id).eq("status", "a_faire"),
        ]);
        return { ...p, tasksDone: tasksDone ?? 0, tasksInProgress: tasksInProgress ?? 0, tasksTodo: tasksTodo ?? 0 };
      })
    );
    setMembers(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("hotel_id").eq("id", user.id).single();
      if (prof) setHotelId((prof as { hotel_id: string }).hotel_id);
      await loadMembers();
    }
    init();
  }, [loadMembers]);

  // ── Invite submit ─────────────────────────────────────────────────────────
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      setError("Nom et email sont obligatoires."); return;
    }
    setSaving(true); setError("");

    const res  = await fetch("/api/create-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, hotel_id: hotelId, assigned_floor: form.assigned_floor ? parseInt(form.assigned_floor) : null }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Erreur lors de l'invitation.");
    } else {
      setInviteOpen(false);
      setForm(EMPTY_FORM);
      setPinDialog({ name: form.full_name, email: form.email, pin: json.pin });
      setLoading(true);
      await loadMembers();
    }
    setSaving(false);
  }

  // ── Toggle active ─────────────────────────────────────────────────────────
  async function toggleActive(member: StaffMember) {
    await supabase.from("profiles").update({ is_active: !member.is_active }).eq("id", member.id);
    setMembers(ms => ms.map(m => m.id === member.id ? { ...m, is_active: !m.is_active } : m));
  }

  // ── Edit save ─────────────────────────────────────────────────────────────
  async function handleEditSave() {
    if (!editMember) return;
    setEditSaving(true);
    const payload = {
      id: editMember.id,
      full_name:      editForm.full_name     ?? editMember.full_name,
      phone_number:   editForm.phone_number  ?? editMember.phone_number,
      role:           editForm.role          ?? editMember.role,
      assigned_floor: editForm.assigned_floor != null ? (editForm.assigned_floor ? parseInt(editForm.assigned_floor) : null) : editMember.assigned_floor,
      shift_type:     editForm.shift_type    ?? editMember.shift_type,
      working_hours:  editForm.working_hours ?? editMember.working_hours,
    };
    const res = await fetch("/api/create-member", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setEditMember(null);
      await loadMembers();
    }
    setEditSaving(false);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeCount   = members.filter(m => m.is_active).length;
  const onShift       = members.filter(m => m.shift_type && m.shift_type !== "repos").length;
  const totalDone     = members.reduce((a, m) => a + m.tasksDone, 0);
  const topPerformer  = [...members].sort((a, b) => b.tasksDone - a.tasksDone)[0];

  const filtered = members.filter(m => {
    if (filterRole !== "all" && m.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.full_name.toLowerCase().includes(q) || m.phone_number?.includes(q);
    }
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Équipe</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} membre{members.length !== 1 ? "s" : ""} · {activeCount} actif{activeCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => { setInviteOpen(true); setError(""); }} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Mail className="w-4 h-4" />
          Inviter un membre
        </Button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: UserCheck, label: "Membres actifs",
            value: loading ? null : activeCount,
            sub: `${members.length} au total`,
            iconBg: "bg-primary/10", iconColor: "text-primary",
          },
          {
            icon: Sun, label: "En service aujourd'hui",
            value: loading ? null : onShift,
            sub: members.filter(m => m.shift_type === "repos").length + " en repos",
            iconBg: "bg-amber-50 dark:bg-amber-900/20", iconColor: "text-amber-600",
          },
          {
            icon: CheckCircle, label: "Tâches terminées",
            value: loading ? null : totalDone,
            sub: "toutes équipes confondues",
            iconBg: "bg-emerald-50 dark:bg-emerald-900/20", iconColor: "text-emerald-600",
          },
          {
            icon: TrendingUp, label: "Top performer",
            value: loading ? null : (topPerformer ? topPerformer.tasksDone : 0),
            sub: topPerformer ? topPerformer.full_name.split(" ")[0] : "—",
            iconBg: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-600",
          },
        ].map(({ icon: Icon, label, value, sub, iconBg, iconColor }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
                <Icon className={cn("w-5 h-5", iconColor)} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                {value === null
                  ? <Skeleton className="h-7 w-12 mb-1" />
                  : <p className="text-2xl font-extrabold leading-none">{value}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, téléphone..."
            className="pl-9 w-52 h-9"
          />
        </div>
        <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5">
          <Button size="sm" variant={filterRole === "all" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setFilterRole("all")}>
            Tous
          </Button>
          {DEPT_ROLES.map(role => {
            const { Icon, label } = ROLE_CONFIG[role];
            return (
              <Button key={role} size="sm" variant={filterRole === role ? "secondary" : "ghost"} className="h-7 text-xs gap-1.5" onClick={() => setFilterRole(filterRole === role ? "all" : role)}>
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="font-semibold text-muted-foreground">Aucun membre trouvé</p>
            {(search || filterRole !== "all") && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilterRole("all"); }}>
                Réinitialiser les filtres
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Table header */}
          <div className="overflow-x-auto">
            <div style={{ minWidth: 860 }}>
              <div className="px-4 py-2.5 bg-muted/50 border-b border-border grid items-center gap-3"
                style={{ gridTemplateColumns: "2.5fr 1.2fr 1.2fr 0.8fr 0.8fr 1fr 1fr 0.7fr 0.5fr" }}>
                {[
                  "Membre", "Téléphone", "Rôle", "Statut", "Étage", "Poste", "Horaires", "Tâches ✓", "",
                ].map((h, i) => (
                  <p key={i} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">{h}</p>
                ))}
              </div>

              {/* Rows */}
              <div className="divide-y divide-border">
                {filtered.map(m => {
                  const rc    = ROLE_CONFIG[m.role];
                  const { Icon: RoleIcon } = rc;
                  const shift = m.shift_type ? SHIFT_CONFIG[m.shift_type] : null;
                  const { Icon: ShiftIcon } = shift ?? { Icon: Coffee };
                  return (
                    <div
                      key={m.id}
                      className="px-4 py-3 grid items-center gap-3 hover:bg-muted/20 transition-colors group"
                      style={{ gridTemplateColumns: "2.5fr 1.2fr 1.2fr 0.8fr 0.8fr 1fr 1fr 0.7fr 0.5fr" }}
                    >
                      {/* Membre */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <MemberAvatar name={m.full_name} size="md" />
                          <span className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                            m.is_active ? "bg-emerald-400" : "bg-muted-foreground/30"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{m.full_name}</p>
                          {m.pin_code && (
                            <div className="flex items-center gap-0.5 mt-0.5">
                              <Shield className="w-2.5 h-2.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground font-mono">PIN {m.pin_code}</span>
                              <CopyButton value={m.pin_code} />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Téléphone */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        {m.phone_number ? (
                          <>
                            <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{m.phone_number}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>

                      {/* Rôle */}
                      <div>
                        <Badge variant="outline" className={cn("gap-1.5 text-xs", rc.bg, rc.color)}>
                          <RoleIcon className="w-3 h-3" strokeWidth={1.5} />
                          {rc.label}
                        </Badge>
                      </div>

                      {/* Statut */}
                      <div>
                        <Switch
                          checked={m.is_active}
                          onCheckedChange={() => toggleActive(m)}
                        />
                      </div>

                      {/* Étage */}
                      <div>
                        {m.assigned_floor != null ? (
                          <div className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm font-semibold">{m.assigned_floor}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>

                      {/* Poste (shift) */}
                      <div>
                        {shift ? (
                          <Badge variant="outline" className={cn("gap-1 text-[10px] px-1.5", shift.className)}>
                            <ShiftIcon className="w-2.5 h-2.5" strokeWidth={1.5} />
                            {shift.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>

                      {/* Horaires */}
                      <div>
                        {m.working_hours ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground">{m.working_hours}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>

                      {/* Tâches terminées */}
                      <div className="text-center">
                        <p className="text-base font-extrabold text-emerald-600">{m.tasksDone}</p>
                        {m.tasksInProgress > 0 && (
                          <p className="text-[9px] text-blue-500 font-semibold">{m.tasksInProgress} en cours</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7"
                          onClick={() => { setEditMember(m); setEditForm({}); }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ═══════ INVITE DIALOG ═══════ */}
      <Dialog open={inviteOpen} onOpenChange={o => { setInviteOpen(o); if (!o) setError(""); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Inviter un membre
            </DialogTitle>
            <DialogDescription>
              Un email d'invitation avec un lien d'accès sera envoyé automatiquement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>
            )}

            {/* Preview card */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <MemberAvatar name={form.full_name || "?"} size="lg" />
              <div>
                <p className="font-bold text-sm">{form.full_name || "Nom complet"}</p>
                <p className={cn("text-xs font-semibold flex items-center gap-1 mt-0.5", ROLE_CONFIG[form.role].color)}>
                  {(() => { const { Icon } = ROLE_CONFIG[form.role]; return <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />; })()}
                  {ROLE_CONFIG[form.role].label}
                  {form.shift_type && (
                    <span className="text-muted-foreground font-normal">· {SHIFT_CONFIG[form.shift_type].label}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Name + email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nom complet *</Label>
                <Input placeholder="Marie Dupont" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" placeholder="marie@hotel.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input placeholder="+33 6 12 34 56 78" value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label>Département *</Label>
              <div className="grid grid-cols-2 gap-2">
                {DEPT_ROLES.map(role => {
                  const { Icon, label, color, bg } = ROLE_CONFIG[role];
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, role }))}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                        form.role === role
                          ? cn("border-primary", bg, color)
                          : "border-border bg-card text-muted-foreground hover:border-border/80"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Floor + Shift + Hours */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Étage assigné</Label>
                <Select
                  value={form.assigned_floor || "__none__"}
                  onValueChange={(v) => setForm(f => ({ ...f, assigned_floor: (!v || v === "__none__") ? "" : v }))}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                      <SelectItem key={n} value={String(n)}>Étage {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Poste</Label>
                <Select value={form.shift_type} onValueChange={v => setForm(f => ({ ...f, shift_type: v as ShiftType }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SHIFT_CONFIG) as [ShiftType, typeof SHIFT_CONFIG[ShiftType]][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Horaires</Label>
                <Input
                  placeholder="07:00–15:00"
                  value={form.working_hours}
                  onChange={e => setForm(f => ({ ...f, working_hours: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                Un <strong>code PIN à 6 chiffres</strong> sera généré automatiquement et affiché après la création. Partagez-le avec le membre pour l'accès kiosk.
              </div>
            </div>
          </form>

          <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
            <Button variant="outline" type="button" onClick={() => setInviteOpen(false)}>Annuler</Button>
            <Button
              onClick={handleInvite}
              disabled={saving || !form.full_name.trim() || !form.email.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 min-w-[120px]"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />Envoi...</>
              ) : (
                <><Mail className="w-4 h-4" />Envoyer l'invitation</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════ PIN SUCCESS DIALOG ═══════ */}
      <Dialog open={!!pinDialog} onOpenChange={o => !o && setPinDialog(null)}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-lg">Invitation envoyée !</p>
              <p className="text-sm text-muted-foreground mt-1">
                Un email a été envoyé à <strong>{pinDialog?.email}</strong>
              </p>
            </div>

            <div className="w-full p-4 rounded-2xl bg-muted border border-border">
              <p className="text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Code PIN de {pinDialog?.name?.split(" ")[0]}
              </p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-4xl font-extrabold tracking-[0.3em] font-mono text-primary">
                  {pinDialog?.pin}
                </p>
                {pinDialog && <CopyButton value={pinDialog.pin} />}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Communiquez ce code au membre pour l'accès kiosk
              </p>
            </div>

            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setPinDialog(null)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════ EDIT DIALOG ═══════ */}
      <Dialog open={!!editMember} onOpenChange={o => !o && setEditMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Modifier — {editMember?.full_name}
            </DialogTitle>
          </DialogHeader>

          {editMember && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nom complet</Label>
                  <Input
                    defaultValue={editMember.full_name}
                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input
                    defaultValue={editMember.phone_number ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, phone_number: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Étage</Label>
                  <Select
                    defaultValue={editMember.assigned_floor != null ? String(editMember.assigned_floor) : "__none__"}
                    onValueChange={(v) => setEditForm(f => ({ ...f, assigned_floor: (!v || v === "__none__") ? "" : v }))}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                        <SelectItem key={n} value={String(n)}>Étage {n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Poste</Label>
                  <Select
                    defaultValue={editMember.shift_type ?? "matin"}
                    onValueChange={v => setEditForm(f => ({ ...f, shift_type: v as ShiftType }))}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(SHIFT_CONFIG) as [ShiftType, typeof SHIFT_CONFIG[ShiftType]][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Horaires</Label>
                  <Input
                    defaultValue={editMember.working_hours ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, working_hours: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Département</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DEPT_ROLES.map(role => {
                    const { Icon, label, color, bg } = ROLE_CONFIG[role];
                    const current = (editForm.role ?? editMember.role) === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setEditForm(f => ({ ...f, role }))}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all",
                          current ? cn("border-primary", bg, color) : "border-border bg-card text-muted-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setEditMember(null)}>Annuler</Button>
                <Button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                >
                  {editSaving && <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
