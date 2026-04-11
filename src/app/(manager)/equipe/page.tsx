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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Search, Plus, Users, CheckCircle, Clock,
  Star, Brush, Wrench, Monitor, BellRing, Phone,
  Sun, Moon, Sunset, Coffee, Pencil, Copy, Check,
  Mail, Shield, TrendingUp, UserCheck, Eye, X,
  Layers, AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Config ────────────────────────────────────────────────────────────────────
type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;

const ROLE_CONFIG: Record<UserRole, { label: string; Icon: IconComponent; color: string; bg: string }> = {
  housekeeping: { label: "Housekeeping", Icon: Brush,    color: "text-sky-600 dark:text-sky-400",      bg: "bg-sky-50 dark:bg-sky-900/30"       },
  maintenance:  { label: "Maintenance",  Icon: Wrench,   color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/30"   },
  it:           { label: "IT",           Icon: Monitor,  color: "text-purple-600 dark:text-purple-400",bg: "bg-purple-50 dark:bg-purple-900/30" },
  manager:      { label: "Manager",      Icon: Star,     color: "text-primary",                        bg: "bg-primary/10"                      },
  reception:    { label: "Réception",    Icon: BellRing, color: "text-emerald-600 dark:text-emerald-400",bg:"bg-emerald-50 dark:bg-emerald-900/30"},
};

const SHIFT_CONFIG: Record<ShiftType, { label: string; Icon: IconComponent; className: string }> = {
  matin:       { label: "Matin",        Icon: Sun,    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400"     },
  "apres-midi":{ label: "Après-midi",   Icon: Sunset, className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400"},
  nuit:        { label: "Nuit",         Icon: Moon,   className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400" },
  repos:       { label: "Repos",        Icon: Coffee, className: "bg-secondary text-secondary-foreground border-border"                                      },
};

const DEPT_ROLES: UserRole[] = ["housekeeping", "maintenance", "it", "reception"];

const COUNTRY_CODES = [
  { code: "+33",  flag: "🇫🇷", name: "France"        },
  { code: "+212", flag: "🇲🇦", name: "Maroc"          },
  { code: "+213", flag: "🇩🇿", name: "Algérie"        },
  { code: "+216", flag: "🇹🇳", name: "Tunisie"        },
  { code: "+32",  flag: "🇧🇪", name: "Belgique"       },
  { code: "+41",  flag: "🇨🇭", name: "Suisse"         },
  { code: "+44",  flag: "🇬🇧", name: "Royaume-Uni"    },
  { code: "+1",   flag: "🇺🇸", name: "États-Unis"     },
  { code: "+221", flag: "🇸🇳", name: "Sénégal"        },
  { code: "+225", flag: "🇨🇮", name: "Côte d'Ivoire"  },
  { code: "+237", flag: "🇨🇲", name: "Cameroun"       },
  { code: "+243", flag: "🇨🇩", name: "Congo (RDC)"    },
];

const HOURS_OPTIONS = [
  "06:00 – 14:00",
  "07:00 – 15:00",
  "08:00 – 16:00",
  "09:00 – 17:00",
  "10:00 – 18:00",
  "14:00 – 22:00",
  "15:00 – 23:00",
  "16:00 – 00:00",
  "22:00 – 06:00",
];

const FLOORS = Array.from({ length: 15 }, (_, i) => i + 1);

// ── Types ─────────────────────────────────────────────────────────────────────
type StaffMember = UserProfile & {
  tasksDone: number;
  tasksInProgress: number;
  tasksTodo: number;
};

type InviteForm = {
  full_name: string;
  email: string;
  country_code: string;
  phone: string;
  role: UserRole;
  assigned_floors: number[];
  shift_type: ShiftType;
  working_hours: string;
  custom_hours: string;
};

const EMPTY_FORM: InviteForm = {
  full_name: "", email: "", country_code: "+33", phone: "",
  role: "housekeeping", assigned_floors: [],
  shift_type: "matin", working_hours: "07:00 – 15:00", custom_hours: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-muted-foreground hover:text-foreground transition-colors ml-1">
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function FloorsDisplay({ value }: { value?: string }) {
  if (!value) return <span className="text-xs text-muted-foreground/40">—</span>;
  const floors = value.split(",").map(f => f.trim()).filter(Boolean);
  if (floors.length === 0) return <span className="text-xs text-muted-foreground/40">—</span>;
  return (
    <div className="flex flex-wrap gap-0.5">
      {floors.map(f => (
        <span key={f} className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-[10px] font-bold text-foreground">
          {f}
        </span>
      ))}
    </div>
  );
}

// ── Floor picker component ────────────────────────────────────────────────────
function FloorPicker({ selected, onChange }: { selected: number[]; onChange: (f: number[]) => void }) {
  function toggle(f: number) {
    onChange(selected.includes(f) ? selected.filter(x => x !== f) : [...selected, f].sort((a, b) => a - b));
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {FLOORS.map(f => (
        <button
          key={f}
          type="button"
          onClick={() => toggle(f)}
          className={cn(
            "w-8 h-8 rounded-lg text-xs font-bold transition-all border",
            selected.includes(f)
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-transparent hover:border-border"
          )}
        >
          {f}
        </button>
      ))}
    </div>
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

  // PIN success dialog
  const [pinDialog, setPinDialog] = useState<{ name: string; email: string; pin: string; temp_password: string } | null>(null);

  // Details dialog
  const [detailMember, setDetailMember] = useState<StaffMember | null>(null);

  // Edit dialog
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [editForm,   setEditForm]   = useState<Partial<InviteForm>>({});
  const [editSaving, setEditSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from("profiles").select("*").neq("role", "manager").order("full_name");

    if (!profiles) { setLoading(false); return; }

    const enriched = await Promise.all(
      (profiles as UserProfile[]).map(async p => {
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

  // ── Invite ────────────────────────────────────────────────────────────────
  async function handleInvite(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      setError("Nom et email sont obligatoires.");
      return;
    }
    if (!hotelId) {
      setError("Impossible de récupérer l'hôtel. Rechargez la page.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const phone_number = form.phone ? `${form.country_code} ${form.phone}` : "";
      const assigned_floors = form.assigned_floors.join(",");
      const working_hours = form.working_hours === "custom" ? form.custom_hours : form.working_hours;

      const res  = await fetch("/api/create-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          hotel_id: hotelId,
          phone_number,
          assigned_floors,
          shift_type: form.shift_type,
          working_hours,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Erreur lors de l'invitation.");
      } else {
        setInviteOpen(false);
        setForm(EMPTY_FORM);
        setPinDialog({ name: form.full_name, email: form.email, pin: json.pin, temp_password: json.temp_password });
        setLoading(true);
        await loadMembers();
      }
    } catch (err) {
      setError("Erreur réseau. Vérifiez votre connexion.");
      console.error("handleInvite error:", err);
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active ─────────────────────────────────────────────────────────
  async function toggleActive(m: StaffMember) {
    await supabase.from("profiles").update({ is_active: !m.is_active }).eq("id", m.id);
    setMembers(ms => ms.map(x => x.id === m.id ? { ...x, is_active: !x.is_active } : x));
  }

  // ── Edit save ─────────────────────────────────────────────────────────────
  async function handleEditSave() {
    if (!editMember) return;
    setEditSaving(true);
    const phone_number = editForm.phone
      ? `${editForm.country_code ?? "+33"} ${editForm.phone}`
      : editMember.phone_number;
    const assigned_floors = editForm.assigned_floors
      ? editForm.assigned_floors.join(",")
      : editMember.assigned_floors;
    const working_hours = editForm.working_hours === "custom"
      ? (editForm.custom_hours ?? editMember.working_hours)
      : (editForm.working_hours ?? editMember.working_hours);

    const payload = {
      id: editMember.id,
      full_name:       editForm.full_name    ?? editMember.full_name,
      phone_number,
      role:            editForm.role         ?? editMember.role,
      assigned_floors: assigned_floors       ?? "",
      shift_type:      editForm.shift_type   ?? editMember.shift_type,
      working_hours,
    };
    const res = await fetch("/api/create-member", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setEditMember(null); await loadMembers(); }
    setEditSaving(false);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeCount  = members.filter(m => m.is_active).length;
  const onShift      = members.filter(m => m.shift_type && m.shift_type !== "repos").length;
  const totalDone    = members.reduce((a, m) => a + m.tasksDone, 0);
  const topPerformer = [...members].sort((a, b) => b.tasksDone - a.tasksDone)[0];

  const filtered = members.filter(m => {
    if (filterRole !== "all" && m.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.full_name.toLowerCase().includes(q)
        || m.email?.toLowerCase().includes(q)
        || m.phone_number?.includes(q);
    }
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Équipe</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} membre{members.length !== 1 ? "s" : ""} · {activeCount} actif{activeCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => { setInviteOpen(true); setError(""); setForm(EMPTY_FORM); }}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
          <Mail className="w-4 h-4" />
          Inviter un membre
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: UserCheck,   label: "Membres actifs",       value: loading ? null : activeCount,                  sub: `${members.length} au total`,                               iconBg: "bg-primary/10",                         iconColor: "text-primary"         },
          { icon: Sun,         label: "En service",           value: loading ? null : onShift,                      sub: `${members.filter(m=>m.shift_type==="repos").length} en repos`, iconBg: "bg-amber-50 dark:bg-amber-900/20",  iconColor: "text-amber-600"       },
          { icon: CheckCircle, label: "Tâches terminées",     value: loading ? null : totalDone,                    sub: "toutes équipes",                                           iconBg: "bg-emerald-50 dark:bg-emerald-900/20",  iconColor: "text-emerald-600"     },
          { icon: TrendingUp,  label: "Top performer",        value: loading ? null : (topPerformer?.tasksDone??0), sub: topPerformer?.full_name.split(" ")[0] ?? "—",               iconBg: "bg-purple-50 dark:bg-purple-900/20",    iconColor: "text-purple-600"      },
        ].map(({ icon: Icon, label, value, sub, iconBg, iconColor }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
                <Icon className={cn("w-5 h-5", iconColor)} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                {value === null ? <Skeleton className="h-7 w-10 mb-1" /> : <p className="text-2xl font-extrabold leading-none">{value}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, email, téléphone..." className="pl-9 w-56 h-9" />
        </div>

        {/* Role filter tabs — plain buttons so state updates are reflected */}
        <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5">
          <button
            onClick={() => setFilterRole("all")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              filterRole === "all" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Tous
            <span className={cn("w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center",
              filterRole === "all" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground")}>
              {members.length}
            </span>
          </button>
          {DEPT_ROLES.map(role => {
            const { Icon, label } = ROLE_CONFIG[role];
            const count = members.filter(m => m.role === role).length;
            const active = filterRole === role;
            return (
              <button
                key={role}
                onClick={() => setFilterRole(active ? "all" : role)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  active ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {label}
                {count > 0 && (
                  <span className={cn("w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center",
                    active ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
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
          <div className="overflow-x-auto">
            <div style={{ minWidth: 1050 }}>
              {/* Header row */}
              <div className="px-4 py-2.5 bg-muted/50 border-b border-border grid items-center gap-3"
                style={{ gridTemplateColumns: "2.2fr 1.6fr 1.2fr 1.1fr 0.6fr 0.9fr 0.9fr 0.9fr 0.7fr 0.55fr" }}>
                {["Membre", "Email", "Téléphone", "Rôle", "Statut", "Étages", "Poste", "Horaires", "Tâches ✓", ""].map((h, i) => (
                  <p key={i} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</p>
                ))}
              </div>

              {/* Data rows */}
              <div className="divide-y divide-border">
                {filtered.map(m => {
                  const rc    = ROLE_CONFIG[m.role];
                  const { Icon: RoleIcon } = rc;
                  const shift = m.shift_type ? SHIFT_CONFIG[m.shift_type] : null;
                  const { Icon: ShiftIcon } = shift ?? { Icon: Coffee };
                  const total    = m.tasksDone + m.tasksInProgress + m.tasksTodo;
                  const progress = total > 0 ? Math.round((m.tasksDone / total) * 100) : 0;

                  return (
                    <div key={m.id}
                      className="px-4 py-3 grid items-center gap-3 hover:bg-muted/20 transition-colors group"
                      style={{ gridTemplateColumns: "2.2fr 1.6fr 1.2fr 1.1fr 0.6fr 0.9fr 0.9fr 0.9fr 0.7fr 0.55fr" }}>

                      {/* Membre */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <MemberAvatar name={m.full_name} size="md" />
                          <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                            m.is_active ? "bg-emerald-400" : "bg-muted-foreground/30")} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{m.full_name}</p>
                          {m.pin_code && (
                            <div className="flex items-center gap-0.5 mt-0.5">
                              <Shield className="w-2.5 h-2.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground font-mono">PIN {m.pin_code}</span>
                              <CopyBtn value={m.pin_code} />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Email */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        {m.email ? (
                          <>
                            <AtSign className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{m.email}</span>
                          </>
                        ) : <span className="text-xs text-muted-foreground/40">—</span>}
                      </div>

                      {/* Téléphone */}
                      <div className="flex items-center gap-1 min-w-0">
                        {m.phone_number ? (
                          <>
                            <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{m.phone_number}</span>
                          </>
                        ) : <span className="text-xs text-muted-foreground/40">—</span>}
                      </div>

                      {/* Rôle */}
                      <div>
                        <Badge variant="outline" className={cn("gap-1 text-[10px] px-1.5", rc.bg, rc.color)}>
                          <RoleIcon className="w-3 h-3" strokeWidth={1.5} />
                          {rc.label}
                        </Badge>
                      </div>

                      {/* Statut */}
                      <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m)} />

                      {/* Étages */}
                      <FloorsDisplay value={m.assigned_floors} />

                      {/* Poste */}
                      <div>
                        {shift ? (
                          <Badge variant="outline" className={cn("gap-1 text-[10px] px-1.5", shift.className)}>
                            <ShiftIcon className="w-2.5 h-2.5" strokeWidth={1.5} />
                            {shift.label}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground/40">—</span>}
                      </div>

                      {/* Horaires */}
                      <div className="flex items-center gap-1 min-w-0">
                        {m.working_hours ? (
                          <>
                            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{m.working_hours}</span>
                          </>
                        ) : <span className="text-xs text-muted-foreground/40">—</span>}
                      </div>

                      {/* Tâches ✓ */}
                      <div>
                        <p className="text-sm font-extrabold text-emerald-600">{m.tasksDone}</p>
                        <Progress value={progress} className="h-1 mt-1 w-10" />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => setDetailMember(m)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setEditMember(m); setEditForm({ assigned_floors: m.assigned_floors ? m.assigned_floors.split(",").map(Number).filter(Boolean) : [] }); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
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
        <DialogContent className="max-w-lg max-h-[92vh] overflow-hidden flex flex-col p-0">
          <form onSubmit={handleInvite} className="flex flex-col min-h-0 flex-1">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" />Inviter un membre</DialogTitle>
            <DialogDescription>Un email avec un lien d'activation sera envoyé automatiquement.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <MemberAvatar name={form.full_name || "?"} size="lg" />
              <div>
                <p className="font-bold text-sm">{form.full_name || "Nom complet"}</p>
                <p className={cn("text-xs font-semibold flex items-center gap-1 mt-0.5", ROLE_CONFIG[form.role].color)}>
                  {(() => { const { Icon } = ROLE_CONFIG[form.role]; return <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />; })()}
                  {ROLE_CONFIG[form.role].label}
                  {form.shift_type && <span className="text-muted-foreground font-normal ml-1">· {SHIFT_CONFIG[form.shift_type].label}</span>}
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

            {/* Phone with country code */}
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <div className="flex gap-2">
                <Select value={form.country_code} onValueChange={v => setForm(f => ({ ...f, country_code: v ?? "+33" }))}>
                  <SelectTrigger className="w-32 h-9 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="6 12 34 56 78"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="h-9 flex-1"
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label>Département *</Label>
              <div className="grid grid-cols-2 gap-2">
                {DEPT_ROLES.map(role => {
                  const { Icon, label, color, bg } = ROLE_CONFIG[role];
                  return (
                    <button key={role} type="button" onClick={() => setForm(f => ({ ...f, role }))}
                      className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all text-left",
                        form.role === role ? cn("border-primary", bg, color) : "border-border bg-card text-muted-foreground hover:border-foreground/20")}>
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Floors */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Étages assignés</Label>
                {form.assigned_floors.length > 0 && (
                  <span className="text-xs text-primary font-semibold">
                    {form.assigned_floors.length} sélectionné{form.assigned_floors.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <FloorPicker
                selected={form.assigned_floors}
                onChange={floors => setForm(f => ({ ...f, assigned_floors: floors }))}
              />
            </div>

            {/* Shift + Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type de poste</Label>
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
                <Label>Horaires de travail</Label>
                <Select value={form.working_hours} onValueChange={v => setForm(f => ({ ...f, working_hours: v ?? "07:00 – 15:00" }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS_OPTIONS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    <SelectItem value="custom">Personnalisé…</SelectItem>
                  </SelectContent>
                </Select>
                {form.working_hours === "custom" && (
                  <Input placeholder="ex: 11:00 – 19:00" value={form.custom_hours}
                    onChange={e => setForm(f => ({ ...f, custom_hours: e.target.value }))} className="h-9 mt-1" />
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Un <strong>code PIN à 6 chiffres</strong> sera généré automatiquement après la création. Partagez-le avec le membre pour l'accès kiosk.
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border shrink-0 space-y-3">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg flex items-center gap-2">
                <X className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setInviteOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving || !form.full_name.trim() || !form.email.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 min-w-[130px]">
                {saving
                  ? <><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />Envoi...</>
                  : <><Mail className="w-4 h-4" />Envoyer l'invitation</>}
              </Button>
            </div>
          </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══════ PIN SUCCESS ═══════ */}
      <Dialog open={!!pinDialog} onOpenChange={o => !o && setPinDialog(null)}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-lg">Membre créé !</p>
              <p className="text-sm text-muted-foreground mt-1">
                Compte créé pour <strong>{pinDialog?.name}</strong>
              </p>
            </div>

            {/* Temp password */}
            <div className="w-full p-4 rounded-2xl bg-muted border border-border text-left space-y-1">
              <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Identifiants de connexion
              </p>
              <p className="text-xs text-muted-foreground">Email : <span className="font-mono font-bold text-foreground">{pinDialog?.email}</span></p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-xs text-muted-foreground">Mot de passe temporaire :</p>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold text-foreground text-sm tracking-wide">{pinDialog?.temp_password}</span>
                  {pinDialog && <CopyBtn value={pinDialog.temp_password} />}
                </div>
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <Shield className="w-3 h-3 shrink-0" />
                Communiquez ces identifiants en main propre au membre
              </p>
            </div>

            {/* PIN */}
            <div className="w-full p-4 rounded-2xl bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-primary" />
                Code PIN kiosk de {pinDialog?.name?.split(" ")[0]}
              </p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-4xl font-extrabold tracking-[0.3em] font-mono text-primary">{pinDialog?.pin}</p>
                {pinDialog && <CopyBtn value={pinDialog.pin} />}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Pour l'accès kiosk staff</p>
            </div>

            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setPinDialog(null)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════ DETAILS DIALOG ═══════ */}
      <Dialog open={!!detailMember} onOpenChange={o => !o && setDetailMember(null)}>
        {detailMember && (() => {
          const rc    = ROLE_CONFIG[detailMember.role];
          const { Icon: RoleIcon } = rc;
          const shift = detailMember.shift_type ? SHIFT_CONFIG[detailMember.shift_type] : null;
          const total    = detailMember.tasksDone + detailMember.tasksInProgress + detailMember.tasksTodo;
          const progress = total > 0 ? Math.round((detailMember.tasksDone / total) * 100) : 0;
          return (
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Détails du membre</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Identity */}
                <div className="flex items-center gap-3">
                  <MemberAvatar name={detailMember.full_name} size="lg" />
                  <div>
                    <p className="font-bold">{detailMember.full_name}</p>
                    <Badge variant="outline" className={cn("gap-1 text-xs mt-1", rc.bg, rc.color)}>
                      <RoleIcon className="w-3 h-3" strokeWidth={1.5} />
                      {rc.label}
                    </Badge>
                  </div>
                  <div className={cn("ml-auto flex items-center gap-1.5 text-xs font-semibold",
                    detailMember.is_active ? "text-emerald-600" : "text-muted-foreground")}>
                    <span className={cn("w-2 h-2 rounded-full", detailMember.is_active ? "bg-emerald-400" : "bg-muted-foreground/30")} />
                    {detailMember.is_active ? "Actif" : "Inactif"}
                  </div>
                </div>

                <Separator />

                {/* Contact */}
                <div className="space-y-2">
                  {detailMember.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <AtSign className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground truncate">{detailMember.email}</span>
                    </div>
                  )}
                  {detailMember.phone_number && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{detailMember.phone_number}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Schedule */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Poste</p>
                    {shift ? (
                      <Badge variant="outline" className={cn("gap-1 text-xs", shift.className)}>
                        {detailMember.shift_type && (() => { const { Icon: ShiftIcon } = SHIFT_CONFIG[detailMember.shift_type!]; return <ShiftIcon className="w-3 h-3" strokeWidth={1.5} />; })()}
                        {shift.label}
                      </Badge>
                    ) : <span className="text-sm text-muted-foreground">—</span>}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Horaires</p>
                    <p className="text-sm font-medium">{detailMember.working_hours || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Étages assignés</p>
                    <FloorsDisplay value={detailMember.assigned_floors} />
                  </div>
                </div>

                <Separator />

                {/* PIN */}
                {detailMember.pin_code && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Code PIN</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold tracking-widest text-sm">{detailMember.pin_code}</span>
                      <CopyBtn value={detailMember.pin_code} />
                    </div>
                  </div>
                )}

                {/* Task stats */}
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Performance</p>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-muted rounded-lg p-2">
                      <p className="text-lg font-extrabold text-primary">{detailMember.tasksTodo}</p>
                      <p className="text-[10px] text-muted-foreground">À faire</p>
                    </div>
                    <div className="bg-muted rounded-lg p-2">
                      <p className="text-lg font-extrabold text-blue-600">{detailMember.tasksInProgress}</p>
                      <p className="text-[10px] text-muted-foreground">En cours</p>
                    </div>
                    <div className="bg-muted rounded-lg p-2">
                      <p className="text-lg font-extrabold text-emerald-600">{detailMember.tasksDone}</p>
                      <p className="text-[10px] text-muted-foreground">Terminées</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="flex-1 h-2" />
                    <span className="text-xs font-bold text-muted-foreground w-8 text-right">{progress}%</span>
                  </div>
                </div>
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>

      {/* ═══════ EDIT DIALOG ═══════ */}
      <Dialog open={!!editMember} onOpenChange={o => !o && setEditMember(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                  <Input defaultValue={editMember.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <div className="flex gap-2">
                    <Select defaultValue="+33" onValueChange={v => setEditForm(f => ({ ...f, country_code: v ?? "+33" }))}>
                      <SelectTrigger className="w-24 h-9 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Numéro" defaultValue={editMember.phone_number?.replace(/^\+\d+\s/, "") ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="h-9" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Département</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DEPT_ROLES.map(role => {
                    const { Icon, label, color, bg } = ROLE_CONFIG[role];
                    const current = (editForm.role ?? editMember.role) === role;
                    return (
                      <button key={role} type="button" onClick={() => setEditForm(f => ({ ...f, role }))}
                        className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all",
                          current ? cn("border-primary", bg, color) : "border-border bg-card text-muted-foreground hover:border-foreground/20")}>
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Étages assignés</Label>
                <FloorPicker
                  selected={editForm.assigned_floors ?? (editMember.assigned_floors ? editMember.assigned_floors.split(",").map(Number).filter(Boolean) : [])}
                  onChange={floors => setEditForm(f => ({ ...f, assigned_floors: floors }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Poste</Label>
                  <Select defaultValue={editMember.shift_type ?? "matin"} onValueChange={v => setEditForm(f => ({ ...f, shift_type: v as ShiftType }))}>
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
                  <Select defaultValue={editMember.working_hours ?? "07:00 – 15:00"} onValueChange={v => setEditForm(f => ({ ...f, working_hours: v ?? "07:00 – 15:00" }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOURS_OPTIONS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      <SelectItem value="custom">Personnalisé…</SelectItem>
                    </SelectContent>
                  </Select>
                  {(editForm.working_hours ?? editMember.working_hours) === "custom" && (
                    <Input placeholder="ex: 11:00 – 19:00" value={editForm.custom_hours ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, custom_hours: e.target.value }))} className="h-9 mt-1" />
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setEditMember(null)}>Annuler</Button>
                <Button onClick={handleEditSave} disabled={editSaving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
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
