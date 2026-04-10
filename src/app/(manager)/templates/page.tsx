"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { TaskTemplate, Department, TaskType, TaskPriority, UserRole, ChecklistItem } from "@/types";
import {
  Plus, RefreshCcw, Pencil, Trash2, Play, Check, X,
  Clock, Calendar, ChevronDown, ChevronUp, GripVertical,
  ClipboardList, Zap, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Config ──────────────────────────────────────────────────────────────────
const DEPT_CONFIG: Record<Department, { label: string; className: string }> = {
  housekeeping: { label: "Housekeeping", className: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800" },
  maintenance:  { label: "Maintenance",  className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" },
  it:           { label: "IT",           className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800" },
  reception:    { label: "Réception",    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  basse:   { label: "Basse",   className: "bg-secondary text-secondary-foreground border-border" },
  normale: { label: "Normale", className: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
  haute:   { label: "Haute",   className: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800" },
};

const ROLE_LABELS: Record<UserRole, string> = {
  manager:      "Manager",
  reception:    "Réception",
  housekeeping: "Housekeeping",
  maintenance:  "Maintenance",
  it:           "IT",
};

const DAY_LABELS = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];
const ALL_DAYS   = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS   = [1, 2, 3, 4, 5];

// ── Empty template ───────────────────────────────────────────────────────────
type EditableTemplate = Omit<TaskTemplate, "id" | "hotel_id" | "created_at">;

const EMPTY: EditableTemplate = {
  title:        "",
  description:  "",
  department:   "housekeeping",
  type:         "routine",
  priority:     "normale",
  assigned_role: "housekeeping",
  checklist:    [],
  days_of_week: [1, 2, 3, 4, 5],
  time_of_day:  "08:00",
  is_active:    true,
};

// ── Generate today's tasks from templates ────────────────────────────────────
function todayDayOfWeek() {
  return new Date().getDay(); // 0=Sun
}

function isTodayInTemplate(t: TaskTemplate) {
  return t.is_active && t.days_of_week.includes(todayDayOfWeek());
}

// ── Main component ───────────────────────────────────────────────────────────
export default function TemplatesPage() {
  const supabase = createClient();

  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [hotelId,   setHotelId]   = useState("");

  // Dialog state
  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [form,          setForm]          = useState<EditableTemplate>(EMPTY);
  const [checklistInput, setChecklistInput] = useState("");
  const [saving,        setSaving]        = useState(false);

  // Generate state
  const [generating, setGenerating] = useState(false);
  const [generated,  setGenerated]  = useState<number | null>(null);

  // Expanded template details
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("hotel_id")
      .eq("id", user.id)
      .single();

    if (!profile?.hotel_id) return;
    setHotelId(profile.hotel_id);

    const { data } = await supabase
      .from("task_templates")
      .select("*")
      .eq("hotel_id", profile.hotel_id)
      .order("created_at", { ascending: false });

    setTemplates(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Dialog helpers ──────────────────────────────────────────────────────────
  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setChecklistInput("");
    setDialogOpen(true);
  }

  function openEdit(t: TaskTemplate) {
    setEditingId(t.id);
    setForm({
      title:         t.title,
      description:   t.description,
      department:    t.department,
      type:          t.type,
      priority:      t.priority,
      assigned_role: t.assigned_role,
      checklist:     t.checklist,
      days_of_week:  t.days_of_week,
      time_of_day:   t.time_of_day,
      is_active:     t.is_active,
    });
    setChecklistInput("");
    setDialogOpen(true);
  }

  function toggleDay(d: number) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter(x => x !== d)
        : [...f.days_of_week, d].sort(),
    }));
  }

  function setDayPreset(days: number[]) {
    setForm(f => ({ ...f, days_of_week: days }));
  }

  function addChecklistItem() {
    const text = checklistInput.trim();
    if (!text) return;
    setForm(f => ({
      ...f,
      checklist: [...f.checklist, { id: crypto.randomUUID(), text, done: false }],
    }));
    setChecklistInput("");
  }

  function removeChecklistItem(id: string) {
    setForm(f => ({ ...f, checklist: f.checklist.filter(c => c.id !== id) }));
  }

  async function handleSave() {
    if (!form.title.trim() || !hotelId) return;
    setSaving(true);

    if (editingId) {
      await supabase.from("task_templates").update(form).eq("id", editingId);
    } else {
      await supabase.from("task_templates").insert({ ...form, hotel_id: hotelId });
    }

    setSaving(false);
    setDialogOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce template ?")) return;
    await supabase.from("task_templates").delete().eq("id", id);
    setTemplates(ts => ts.filter(t => t.id !== id));
  }

  async function toggleActive(t: TaskTemplate) {
    await supabase.from("task_templates").update({ is_active: !t.is_active }).eq("id", t.id);
    setTemplates(ts => ts.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x));
  }

  // ── Generate today's tasks ───────────────────────────────────────────────────
  async function generateToday() {
    const todayTemplates = templates.filter(isTodayInTemplate);
    if (todayTemplates.length === 0) {
      alert("Aucun template actif prévu pour aujourd'hui.");
      return;
    }

    setGenerating(true);

    const today = new Date();
    const rows = todayTemplates.map(t => {
      const [h, m] = t.time_of_day.split(":").map(Number);
      const dueAt = new Date(today);
      dueAt.setHours(h, m, 0, 0);
      return {
        hotel_id:    hotelId,
        created_by:  hotelId, // fallback; ideally user.id
        assigned_to: null,
        title:       t.title,
        description: t.description,
        department:  t.department,
        type:        t.type,
        priority:    t.priority,
        status:      "a_faire",
        due_at:      dueAt.toISOString(),
        is_recurring: true,
        checklist:   t.checklist.map(c => ({ ...c, done: false })),
        photos:      [],
      };
    });

    const { error } = await supabase.from("tasks").insert(rows);
    setGenerating(false);

    if (error) {
      alert("Erreur lors de la génération : " + error.message);
    } else {
      setGenerated(rows.length);
      setTimeout(() => setGenerated(null), 4000);
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const activeCount  = templates.filter(t => t.is_active).length;
  const todayCount   = templates.filter(isTodayInTemplate).length;
  const totalCount   = templates.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Templates récurrents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Créez des modèles de tâches générés automatiquement chaque jour.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={generateToday}
            disabled={generating || todayCount === 0}
            className="gap-2"
          >
            {generating
              ? <RefreshCcw className="w-4 h-4 animate-spin" />
              : generated !== null
                ? <Check className="w-4 h-4 text-green-600" />
                : <Play className="w-4 h-4" />}
            {generated !== null
              ? `${generated} tâche${generated > 1 ? "s" : ""} créée${generated > 1 ? "s" : ""} !`
              : `Générer aujourd'hui (${todayCount})`}
          </Button>
          <Button onClick={openCreate} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            Nouveau template
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Templates actifs",       value: loading ? null : activeCount, icon: RefreshCcw, color: "text-primary" },
          { label: "Prévus aujourd'hui",     value: loading ? null : todayCount,  icon: Calendar,  color: "text-blue-500" },
          { label: "Templates au total",     value: loading ? null : totalCount,  icon: ClipboardList, color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4 flex items-center gap-4">
              <div className={cn("p-2 rounded-lg bg-muted", color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                {value === null
                  ? <Skeleton className="h-7 w-8 mb-1" />
                  : <p className="text-2xl font-bold">{value}</p>}
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Template list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : templates.length === 0 ? (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <RefreshCcw className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg">Aucun template encore</p>
            <p className="text-muted-foreground text-sm max-w-xs">
              Créez votre premier template pour automatiser la génération de tâches quotidiennes.
            </p>
            <Button onClick={openCreate} className="mt-2 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4" />
              Créer un template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map(t => {
            const dept = DEPT_CONFIG[t.department];
            const prio = PRIORITY_CONFIG[t.priority];
            const isExpanded = expandedId === t.id;
            const isToday = isTodayInTemplate(t);

            return (
              <Card
                key={t.id}
                className={cn(
                  "transition-all",
                  !t.is_active && "opacity-60"
                )}
              >
                <CardContent className="p-4">
                  {/* Main row */}
                  <div className="flex items-center gap-3">
                    {/* Active toggle */}
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={() => toggleActive(t)}
                      className="shrink-0"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{t.title}</span>
                        {isToday && (
                          <Badge className="bg-green-50 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 text-[10px] px-1.5 py-0">
                            Aujourd'hui
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={cn("text-xs", dept.className)}>
                          {dept.label}
                        </Badge>
                        <Badge variant="outline" className={cn("text-xs", prio.className)}>
                          {prio.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t.time_of_day}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {t.days_of_week.length === 7
                            ? "Tous les jours"
                            : t.days_of_week.length === 5 && WEEKDAYS.every(d => t.days_of_week.includes(d)) && !t.days_of_week.includes(0) && !t.days_of_week.includes(6)
                              ? "Lun–Ven"
                              : t.days_of_week.map(d => DAY_LABELS[d]).join(", ")}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8"
                        onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border space-y-3">
                      {t.description && (
                        <p className="text-sm text-muted-foreground">{t.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span>
                          <span className="text-muted-foreground">Rôle assigné : </span>
                          <span className="font-medium">{ROLE_LABELS[t.assigned_role]}</span>
                        </span>
                        <span>
                          <span className="text-muted-foreground">Type : </span>
                          <span className="font-medium">{t.type === "urgente" ? "Urgente" : "Routine"}</span>
                        </span>
                      </div>
                      {/* Day pills */}
                      <div className="flex gap-1">
                        {ALL_DAYS.map(d => (
                          <span
                            key={d}
                            className={cn(
                              "w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center",
                              t.days_of_week.includes(d)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {DAY_LABELS[d]}
                          </span>
                        ))}
                      </div>
                      {/* Checklist */}
                      {t.checklist.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Checklist ({t.checklist.length} étape{t.checklist.length > 1 ? "s" : ""})
                          </p>
                          {t.checklist.map((c) => (
                            <div key={c.id} className="flex items-center gap-2 text-sm">
                              <div className="w-4 h-4 rounded border border-border shrink-0" />
                              {c.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <DialogTitle className="text-lg font-bold">
              {editingId ? "Modifier le template" : "Nouveau template récurrent"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

            {/* Title */}
            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input
                placeholder="Ex: Nettoyage chambre du matin"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Instructions supplémentaires..."
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Dept + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Département</Label>
                <Select
                  value={form.department}
                  onValueChange={v => setForm(f => ({ ...f, department: v as Department, assigned_role: v as UserRole }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEPT_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={v => setForm(f => ({ ...f, type: v as TaskType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority + Role */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select
                  value={form.priority}
                  onValueChange={v => setForm(f => ({ ...f, priority: v as TaskPriority }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basse">Basse</SelectItem>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="haute">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rôle assigné</Label>
                <Select
                  value={form.assigned_role}
                  onValueChange={v => setForm(f => ({ ...f, assigned_role: v as UserRole }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Time of day */}
            <div className="space-y-1.5">
              <Label>Heure de création</Label>
              <Input
                type="time"
                value={form.time_of_day}
                onChange={e => setForm(f => ({ ...f, time_of_day: e.target.value }))}
                className="w-36"
              />
            </div>

            {/* Days of week */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Jours de répétition</Label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDayPreset(ALL_DAYS)}
                    className="text-xs text-primary hover:underline"
                  >
                    Tous
                  </button>
                  <span className="text-muted-foreground text-xs">·</span>
                  <button
                    type="button"
                    onClick={() => setDayPreset(WEEKDAYS)}
                    className="text-xs text-primary hover:underline"
                  >
                    Lun–Ven
                  </button>
                  <span className="text-muted-foreground text-xs">·</span>
                  <button
                    type="button"
                    onClick={() => setDayPreset([6, 0])}
                    className="text-xs text-primary hover:underline"
                  >
                    Week-end
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                {ALL_DAYS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={cn(
                      "w-9 h-9 rounded-full text-xs font-semibold transition-colors",
                      form.days_of_week.includes(d)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {DAY_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Checklist */}
            <div className="space-y-2">
              <Label>Checklist</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ajouter une étape..."
                  value={checklistInput}
                  onChange={e => setChecklistInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addChecklistItem())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addChecklistItem}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {form.checklist.length > 0 && (
                <div className="space-y-1 mt-2">
                  {form.checklist.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-muted group">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm">{c.text}</span>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(c.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Template actif</p>
                <p className="text-xs text-muted-foreground">Les templates inactifs ne génèrent pas de tâches</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 min-w-[100px]"
            >
              {saving && <RefreshCcw className="w-4 h-4 animate-spin" />}
              {editingId ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
