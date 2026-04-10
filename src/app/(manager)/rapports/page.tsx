"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Task, UserProfile, Department } from "@/types";
import {
  CheckCircle, Clock, AlertTriangle, TrendingUp, Download,
  Users, ClipboardList, Calendar, Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ── Types ──────────────────────────────────────────────────────────────────

type TaskWithAssignee = Task & {
  profiles?: { full_name: string };
  created_at: string;
};

type Period = "7j" | "30j" | "90j";

type StaffStat = {
  id: string;
  name: string;
  role: string;
  total: number;
  done: number;
  inProgress: number;
  urgent: number;
  avgMinutes: number | null;
};

type DayStat = { date: string; label: string; total: number; done: number };

// ── Helpers ────────────────────────────────────────────────────────────────

const DEPT_LABELS: Record<Department, string> = {
  housekeeping: "Housekeeping",
  maintenance:  "Maintenance",
  it:           "IT",
  reception:    "Réception",
};

const DEPT_COLORS: Record<Department, string> = {
  housekeeping: "bg-sky-100 text-sky-700 border-sky-200",
  maintenance:  "bg-amber-100 text-amber-700 border-amber-200",
  it:           "bg-purple-100 text-purple-700 border-purple-200",
  reception:    "bg-green-100 text-green-700 border-green-200",
};

function periodStart(period: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "7j")  d.setDate(d.getDate() - 6);
  if (period === "30j") d.getDate() && d.setDate(d.getDate() - 29);
  if (period === "90j") d.setDate(d.getDate() - 89);
  return d;
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function fmtMinutes(mins: number | null) {
  if (mins === null) return "—";
  if (mins < 60) return `${Math.round(mins)} min`;
  return `${(mins / 60).toFixed(1)} h`;
}

// Generate day-by-day labels for the period
function buildDayStats(tasks: TaskWithAssignee[], period: Period): DayStat[] {
  const days = period === "7j" ? 7 : period === "30j" ? 30 : 90;
  const result: DayStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayTasks = tasks.filter((t) => (t.created_at ?? "").slice(0, 10) === dateStr);
    const doneTasks = tasks.filter((t) => t.status === "terminee" && (t.completed_at ?? "").slice(0, 10) === dateStr);
    result.push({
      date:  dateStr,
      label: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      total: dayTasks.length,
      done:  doneTasks.length,
    });
  }
  return result;
}

// ── Export CSV ─────────────────────────────────────────────────────────────

function exportCSV(tasks: TaskWithAssignee[], period: Period) {
  const headers = ["Titre", "Statut", "Type", "Priorité", "Département", "Assigné à", "Créée le", "Terminée le", "Durée (min)"];
  const rows = tasks.map((t) => {
    const created   = t.created_at ? new Date(t.created_at).toLocaleDateString("fr-FR") : "";
    const completed = t.completed_at ? new Date(t.completed_at).toLocaleDateString("fr-FR") : "";
    let duration = "";
    if (t.started_at && t.completed_at) {
      duration = String(Math.round((new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 60000));
    }
    return [
      `"${t.title.replace(/"/g, '""')}"`,
      t.status, t.type, t.priority,
      DEPT_LABELS[t.department] ?? t.department,
      `"${t.profiles?.full_name ?? ""}"`,
      created, completed, duration,
    ].join(",");
  });

  const csv  = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `hotelhive-rapports-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Mini bar chart ─────────────────────────────────────────────────────────

function BarChart({ data, period }: { data: DayStat[]; period: Period }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  // Show fewer labels to avoid overflow
  const step   = period === "7j" ? 1 : period === "30j" ? 5 : 15;

  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
            <div className="w-full flex flex-col justify-end gap-px" style={{ height: "100px" }}>
              {/* Done bar (stacked on top) */}
              <div
                className="w-full rounded-t bg-primary transition-all duration-500"
                style={{ height: `${(d.done / maxVal) * 100}px` }}
                title={`${d.done} terminées`}
              />
              {/* Remaining bar */}
              <div
                className="w-full bg-primary/15 transition-all duration-500"
                style={{ height: `${((d.total - d.done) / maxVal) * 100}px` }}
                title={`${d.total - d.done} en attente`}
              />
            </div>
            {i % step === 0 && (
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.label}</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <span className="text-xs text-muted-foreground">Terminées</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary/15" />
          <span className="text-xs text-muted-foreground">En attente / En cours</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function RapportsPage() {
  const supabase = createClient();

  const [period,   setPeriod]   = useState<Period>("7j");
  const [tasks,    setTasks]    = useState<TaskWithAssignee[]>([]);
  const [staff,    setStaff]    = useState<UserProfile[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase.from("profiles").select("hotel_id").eq("id", user.id).single();
      if (!prof) return;

      const since = periodStart(period).toISOString();

      const { data: taskRows } = await supabase
        .from("tasks")
        .select("*, profiles:assigned_to(full_name)")
        .eq("hotel_id", prof.hotel_id)
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      const { data: staffRows } = await supabase
        .from("profiles")
        .select("id, full_name, role, hotel_id, is_active")
        .eq("hotel_id", prof.hotel_id)
        .neq("role", "manager")
        .eq("is_active", true)
        .order("full_name");

      setTasks((taskRows as TaskWithAssignee[]) ?? []);
      setStaff((staffRows as UserProfile[]) ?? []);
      setLoading(false);
    }
    load();
  }, [period]);

  // ── Derived stats ──────────────────────────────────────────────────────

  const total       = tasks.length;
  const done        = tasks.filter((t) => t.status === "terminee").length;
  const inProgress  = tasks.filter((t) => t.status === "en_cours").length;
  const urgent      = tasks.filter((t) => t.type === "urgente").length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // Average completion time (minutes) for done tasks with both timestamps
  const completedWithTime = tasks.filter(
    (t) => t.status === "terminee" && t.started_at && t.completed_at
  );
  const avgTime = completedWithTime.length > 0
    ? completedWithTime.reduce((sum, t) => {
        return sum + (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60000;
      }, 0) / completedWithTime.length
    : null;

  // Per department
  const deptStats = (["housekeeping", "maintenance", "it", "reception"] as Department[]).map((dept) => {
    const dTasks = tasks.filter((t) => t.department === dept);
    return { dept, total: dTasks.length, done: dTasks.filter((t) => t.status === "terminee").length };
  }).filter((d) => d.total > 0);

  // Per staff member
  const staffStats: StaffStat[] = staff.map((s) => {
    const sTasks   = tasks.filter((t) => t.assigned_to === s.id);
    const sDone    = sTasks.filter((t) => t.status === "terminee");
    const withTime = sDone.filter((t) => t.started_at && t.completed_at);
    const avg      = withTime.length > 0
      ? withTime.reduce((sum, t) => sum + (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60000, 0) / withTime.length
      : null;
    return {
      id:          s.id,
      name:        s.full_name,
      role:        s.role,
      total:       sTasks.length,
      done:        sDone.length,
      inProgress:  sTasks.filter((t) => t.status === "en_cours").length,
      urgent:      sTasks.filter((t) => t.type === "urgente").length,
      avgMinutes:  avg,
    };
  }).filter((s) => s.total > 0).sort((a, b) => b.done - a.done);

  // Day-by-day chart data
  const dayStats = buildDayStats(tasks, period);

  // Top performer
  const topPerformer = staffStats[0] ?? null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Rapports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Analyse de performance de votre équipe et de vos opérations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center bg-card border border-border rounded-xl p-1 gap-0.5">
            {(["7j", "30j", "90j"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "7j" ? "7 jours" : p === "30j" ? "30 jours" : "90 jours"}
              </button>
            ))}
          </div>
          {/* Export */}
          <Button
            variant="outline"
            className="gap-2 font-semibold"
            onClick={() => exportCSV(tasks, period)}
            disabled={loading || tasks.length === 0}
          >
            <Download className="w-4 h-4" strokeWidth={1.5} />
            Exporter CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-500" strokeWidth={1.5} />
                  </div>
                  <Badge variant="outline" className="text-[11px] bg-green-50 text-green-600 border-green-200">
                    {completionRate}%
                  </Badge>
                </div>
                <p className="text-[30px] font-extrabold leading-none">{done}</p>
                <p className="text-xs text-muted-foreground mt-1">Tâches terminées</p>
                <Progress value={completionRate} className="mt-3 h-1.5" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
                  </div>
                  <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-600 border-blue-200">
                    Moy.
                  </Badge>
                </div>
                <p className="text-[30px] font-extrabold leading-none">{fmtMinutes(avgTime)}</p>
                <p className="text-xs text-muted-foreground mt-1">Temps moyen / tâche</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-primary" strokeWidth={1.5} />
                  </div>
                  <Badge className="text-[11px]">Urgent</Badge>
                </div>
                <p className="text-[30px] font-extrabold leading-none">{urgent}</p>
                <p className="text-xs text-muted-foreground mt-1">Tâches urgentes</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <Badge variant="secondary" className="text-[11px]">{inProgress} en cours</Badge>
                </div>
                <p className="text-[30px] font-extrabold leading-none">{total}</p>
                <p className="text-xs text-muted-foreground mt-1">Tâches au total</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="activite" className="space-y-6">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="activite" className="gap-2">
                <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
                Activité
              </TabsTrigger>
              <TabsTrigger value="equipe" className="gap-2">
                <Users className="w-4 h-4" strokeWidth={1.5} />
                Équipe
              </TabsTrigger>
              <TabsTrigger value="departements" className="gap-2">
                <Calendar className="w-4 h-4" strokeWidth={1.5} />
                Départements
              </TabsTrigger>
            </TabsList>

            {/* ── Activité tab ── */}
            <TabsContent value="activite" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-[15px]">Tâches créées vs terminées</CardTitle>
                  <p className="text-xs text-muted-foreground">Sur les {period === "7j" ? "7 derniers jours" : period === "30j" ? "30 derniers jours" : "90 derniers jours"}</p>
                </CardHeader>
                <CardContent>
                  {dayStats.every((d) => d.total === 0) ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <TrendingUp className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm text-muted-foreground">Aucune activité sur cette période</p>
                    </div>
                  ) : (
                    <BarChart data={dayStats} period={period} />
                  )}
                </CardContent>
              </Card>

              {/* Top performer */}
              {topPerformer && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5 text-primary" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Meilleure performance</p>
                      <p className="text-[15px] font-extrabold truncate">{topPerformer.name}</p>
                      <p className="text-xs text-muted-foreground">{topPerformer.done} tâches terminées · {fmtMinutes(topPerformer.avgMinutes)} en moyenne</p>
                    </div>
                    <Avatar className="w-12 h-12 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                        {getInitials(topPerformer.name)}
                      </AvatarFallback>
                    </Avatar>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Équipe tab ── */}
            <TabsContent value="equipe">
              {staffStats.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Users className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm text-muted-foreground">Aucune donnée d'équipe pour cette période</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {staffStats.map((s, rank) => {
                    const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                    return (
                      <Card key={s.id}>
                        <CardContent className="p-5">
                          <div className="flex items-center gap-4">
                            {/* Rank */}
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-extrabold",
                              rank === 0 ? "bg-amber-100 text-amber-700" :
                              rank === 1 ? "bg-gray-100 text-gray-600" :
                              rank === 2 ? "bg-orange-50 text-orange-700" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {rank + 1}
                            </div>

                            {/* Avatar */}
                            <Avatar className="w-10 h-10 shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                                {getInitials(s.name)}
                              </AvatarFallback>
                            </Avatar>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold truncate">{s.name}</p>
                                <Badge variant="outline" className={cn("text-[10px] shrink-0", DEPT_COLORS[s.role as Department] ?? "bg-secondary text-secondary-foreground")}>
                                  {DEPT_LABELS[s.role as Department] ?? s.role}
                                </Badge>
                              </div>
                              <Progress value={pct} className="h-1.5 mb-1" />
                              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                <span className="text-green-600 font-semibold">{s.done} terminées</span>
                                {s.inProgress > 0 && <span>{s.inProgress} en cours</span>}
                                {s.urgent > 0 && <span className="text-primary">{s.urgent} urgentes</span>}
                                <span className="ml-auto">{fmtMinutes(s.avgMinutes)}/tâche</span>
                              </div>
                            </div>

                            {/* % */}
                            <div className="shrink-0 text-right">
                              <p className="text-[22px] font-extrabold leading-none">{pct}%</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{s.total} tâches</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Départements tab ── */}
            <TabsContent value="departements">
              {deptStats.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <ClipboardList className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm text-muted-foreground">Aucune donnée pour cette période</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {deptStats.map(({ dept, total: dTotal, done: dDone }) => {
                    const pct = dTotal > 0 ? Math.round((dDone / dTotal) * 100) : 0;
                    return (
                      <Card key={dept}>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline" className={cn("text-xs", DEPT_COLORS[dept])}>
                              {DEPT_LABELS[dept]}
                            </Badge>
                            <span className="text-[13px] font-extrabold">{pct}%</span>
                          </div>
                          <div className="flex items-end gap-2 mb-2">
                            <p className="text-[30px] font-extrabold leading-none">{dDone}</p>
                            <p className="text-sm text-muted-foreground mb-1">/ {dTotal} terminées</p>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
