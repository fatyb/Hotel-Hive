"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserProfile, UserRole } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Search, Plus, Eye, EyeOff,
  Brush, Wrench, Monitor, Star, BellRing,
  Users, Zap, ClipboardList, CheckCircle,
} from "lucide-react";

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;
type RoleConfig = { label: string; Icon: IconComponent; color: string; bg: string; badgeVariant: "default" | "secondary" | "outline" };

const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  housekeeping: { label: "Housekeeping", Icon: Brush,    color: "text-sky-600",    bg: "bg-sky-50",    badgeVariant: "secondary" },
  maintenance:  { label: "Maintenance",  Icon: Wrench,   color: "text-amber-600",  bg: "bg-amber-50",  badgeVariant: "secondary" },
  it:           { label: "IT",           Icon: Monitor,  color: "text-purple-600", bg: "bg-purple-50", badgeVariant: "secondary" },
  manager:      { label: "Manager",      Icon: Star,     color: "text-primary",    bg: "bg-primary/10",badgeVariant: "default"   },
  reception:    { label: "Réception",    Icon: BellRing, color: "text-green-600",  bg: "bg-green-50",  badgeVariant: "secondary" },
};

const DEPT_ROLES: UserRole[] = ["housekeeping", "maintenance", "it", "reception"];

type MemberWithStats = UserProfile & { tasksTodo: number; tasksInProgress: number; tasksDone: number };
type NewMember = { full_name: string; email: string; password: string; role: UserRole };
const EMPTY_MEMBER: NewMember = { full_name: "", email: "", password: "", role: "housekeeping" };

function MemberAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const parts = name.trim().split(" ");
  const init  = parts.length >= 2 ? parts[0][0] + parts[parts.length-1][0] : name.slice(0,2);
  const sz    = { sm: "w-8 h-8 text-[11px]", md: "w-10 h-10 text-[13px]", lg: "w-12 h-12 text-[15px]" }[size];
  return (
    <Avatar className={sz}>
      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
        {init.toUpperCase() || "?"}
      </AvatarFallback>
    </Avatar>
  );
}

export default function EquipePage() {
  const supabase = createClient();
  const [members,    setMembers]    = useState<MemberWithStats[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filterRole, setFilterRole] = useState<UserRole | "all">("all");
  const [showForm,   setShowForm]   = useState(false);
  const [newMember,  setNewMember]  = useState<NewMember>(EMPTY_MEMBER);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [hotelId,    setHotelId]    = useState("");

  async function loadMembers() {
    const { data: profiles } = await supabase.from("profiles").select("*").neq("role", "manager").order("full_name");
    if (!profiles) { setLoading(false); return; }
    const enriched = await Promise.all(
      (profiles as UserProfile[]).map(async (p) => {
        const [{ count: tasksTodo }, { count: tasksInProgress }, { count: tasksDone }] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", p.id).eq("status", "a_faire"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", p.id).eq("status", "en_cours"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assigned_to", p.id).eq("status", "terminee"),
        ]);
        return { ...p, tasksTodo: tasksTodo ?? 0, tasksInProgress: tasksInProgress ?? 0, tasksDone: tasksDone ?? 0 };
      })
    );
    setMembers(enriched);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("hotel_id").eq("id", user.id).single();
      if (prof) setHotelId((prof as { hotel_id: string }).hotel_id);
      await loadMembers();
    }
    init();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newMember.full_name.trim() || !newMember.email.trim() || !newMember.password.trim()) {
      setError("Tous les champs sont obligatoires."); return;
    }
    if (newMember.password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); return; }
    setSaving(true); setError("");
    const res  = await fetch("/api/create-member", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newMember, hotel_id: hotelId }) });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Erreur lors de la création."); }
    else { setShowForm(false); setNewMember(EMPTY_MEMBER); setLoading(true); await loadMembers(); }
    setSaving(false);
  }

  const totalActive     = members.filter((m) => m.is_active).length;
  const totalInProgress = members.reduce((a, m) => a + m.tasksInProgress, 0);
  const totalTodo       = members.reduce((a, m) => a + m.tasksTodo, 0);
  const totalDone       = members.reduce((a, m) => a + m.tasksDone, 0);

  const filtered = members.filter((m) => {
    if (filterRole !== "all" && m.role !== filterRole) return false;
    if (search && !m.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statCards = [
    { value: members.length,  label: "Membres total",    Icon: Users,         valueClass: "" },
    { value: totalInProgress, label: "Tâches en cours",  Icon: Zap,           valueClass: "text-blue-600" },
    { value: totalTodo,       label: "Tâches à faire",   Icon: ClipboardList, valueClass: "text-primary"  },
    { value: totalDone,       label: "Tâches terminées", Icon: CheckCircle,   valueClass: "text-green-600"},
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Gestion de l&apos;équipe</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} membre{members.length !== 1 ? "s" : ""} · {totalActive} actif{totalActive !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => { setShowForm(true); setError(""); }} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          Ajouter un membre
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(({ value, label, Icon, valueClass }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <Icon className="w-5 h-5 text-muted-foreground mb-3" strokeWidth={1.5} />
              <p className={`text-[30px] font-extrabold leading-none ${valueClass}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un membre..."
            className="pl-10 w-52"
          />
        </div>
        <div className="flex items-center bg-card border border-border rounded-xl p-1 gap-0.5 flex-wrap">
          <Button
            size="sm"
            variant={filterRole === "all" ? "default" : "ghost"}
            className="h-7 text-xs rounded-lg"
            onClick={() => setFilterRole("all")}
          >
            Tous
          </Button>
          {DEPT_ROLES.map((role) => {
            const rc = ROLE_CONFIG[role];
            const { Icon } = rc;
            return (
              <Button
                key={role}
                size="sm"
                variant={filterRole === role ? "default" : "ghost"}
                className="h-7 text-xs rounded-lg gap-1.5"
                onClick={() => setFilterRole(filterRole === role ? "all" : role)}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {rc.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Members list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Aucun membre trouvé</p>
            {(search || filterRole !== "all") && (
              <Button variant="link" className="mt-1 text-primary text-xs" onClick={() => { setSearch(""); setFilterRole("all"); }}>
                Réinitialiser les filtres
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          {/* Table header */}
          <div className="px-6 py-3 border-b border-border grid grid-cols-12 gap-4">
            {[
              { label: "Membre",      span: "col-span-4" },
              { label: "Département", span: "col-span-2" },
              { label: "À faire",     span: "col-span-2 text-center" },
              { label: "En cours",    span: "col-span-2 text-center" },
              { label: "Terminées",   span: "col-span-2 text-center" },
            ].map(({ label, span }) => (
              <p key={label} className={`${span} text-[11px] font-bold text-muted-foreground uppercase tracking-wider`}>{label}</p>
            ))}
          </div>
          <div className="divide-y divide-border">
            {filtered.map((member) => {
              const rc       = ROLE_CONFIG[member.role];
              const { Icon } = rc;
              const total    = member.tasksTodo + member.tasksInProgress + member.tasksDone;
              const progress = total > 0 ? Math.round((member.tasksDone / total) * 100) : 0;
              return (
                <div key={member.id} className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-muted/30 transition-colors">
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <MemberAvatar name={member.full_name} size="md" />
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${member.is_active ? "bg-green-400" : "bg-muted-foreground/40"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{member.full_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={progress} className="h-1 flex-1" />
                        <span className="text-[10px] text-muted-foreground shrink-0">{progress}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="secondary" className={`gap-1.5 ${rc.color}`}>
                      <Icon className="w-3 h-3" strokeWidth={1.5} />
                      {rc.label}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="text-lg font-extrabold text-primary">{member.tasksTodo}</p>
                    <p className="text-[10px] text-muted-foreground">tâches</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="text-lg font-extrabold text-blue-600">{member.tasksInProgress}</p>
                    <p className="text-[10px] text-muted-foreground">tâches</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="text-lg font-extrabold text-green-600">{member.tasksDone}</p>
                    <p className="text-[10px] text-muted-foreground">tâches</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Add member dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setError(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau membre</DialogTitle>
            <DialogDescription>Un email de connexion sera créé automatiquement.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="flex flex-col gap-4 mt-2">
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <MemberAvatar name={newMember.full_name || "?"} size="lg" />
              <div>
                <p className="text-sm font-bold">{newMember.full_name || "Nom complet"}</p>
                <p className={`text-xs font-semibold flex items-center gap-1 mt-0.5 ${ROLE_CONFIG[newMember.role].color}`}>
                  {(() => { const { Icon } = ROLE_CONFIG[newMember.role]; return <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />; })()}
                  {ROLE_CONFIG[newMember.role].label}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Nom complet *</Label>
              <Input value={newMember.full_name} onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })} placeholder="Ex: Marie Dupont" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Adresse email *</Label>
              <Input type="email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} placeholder="marie@hotel.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mot de passe *</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  placeholder="Min. 6 caractères"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Département *</Label>
              <div className="grid grid-cols-2 gap-2">
                {DEPT_ROLES.map((role) => {
                  const rc = ROLE_CONFIG[role];
                  const { Icon } = rc;
                  return (
                    <Button
                      key={role}
                      type="button"
                      variant={newMember.role === role ? "default" : "outline"}
                      className="justify-start gap-2"
                      onClick={() => setNewMember({ ...newMember, role })}
                    >
                      <Icon className="w-4 h-4" strokeWidth={1.5} />
                      {rc.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Button type="submit" disabled={saving} className="w-full mt-2">
              {saving ? "Création en cours..." : "Créer le compte"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Le membre pourra se connecter immédiatement avec cet email et ce mot de passe.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
