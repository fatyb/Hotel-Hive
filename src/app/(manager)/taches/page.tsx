"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Task, TaskStatus, Department, UserProfile, ChecklistItem } from "@/types";
import { Plus, X, Search, List, Columns3, AlertTriangle, Clock, CheckCircle, ClipboardList, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DEPT_CONFIG: Record<Department, { label: string; className: string }> = {
  housekeeping: { label: "Housekeeping", className: "bg-sky-100 text-sky-700 border-sky-200"       },
  maintenance:  { label: "Maintenance",  className: "bg-amber-100 text-amber-700 border-amber-200" },
  it:           { label: "IT",           className: "bg-purple-100 text-purple-700 border-purple-200" },
  reception:    { label: "Réception",    className: "bg-green-100 text-green-700 border-green-200"  },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  a_faire:  { label: "À faire",  className: "bg-secondary text-secondary-foreground border-border"    },
  en_cours: { label: "En cours", className: "bg-blue-50 text-blue-600 border-blue-200"               },
  terminee: { label: "Terminée", className: "bg-green-50 text-green-600 border-green-200"            },
  annulee:  { label: "Annulée",  className: "bg-red-50 text-red-500 border-red-200"                  },
};

type TaskWithAssignee = Task & { profiles?: { full_name: string } };

type NewTask = {
  title: string;
  description: string;
  department: Department;
  type: "routine" | "urgente";
  priority: "basse" | "normale" | "haute";
  assigned_to: string;
  location: string;
  due_at: string;
  checklist: ChecklistItem[];
  is_recurring: boolean;
};

const EMPTY_TASK: NewTask = {
  title: "", description: "", department: "housekeeping", type: "routine",
  priority: "normale", assigned_to: "", location: "", due_at: "", checklist: [], is_recurring: false,
};

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "À l'instant";
  if (mins  < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function KanbanCard({ task }: { task: TaskWithAssignee }) {
  const checkedCount = task.checklist?.filter((i) => i.done).length ?? 0;
  const totalCount   = task.checklist?.length ?? 0;

  return (
    <Link href={`/taches/${task.id}`}>
      <Card className="hover:shadow-md transition-shadow group">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide", DEPT_CONFIG[task.department].className)}>
                {DEPT_CONFIG[task.department].label}
              </Badge>
              {task.type === "urgente" && (
                <Badge className="text-[10px] uppercase tracking-wide">Urgent</Badge>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">{timeAgo(task.created_at ?? "")}</span>
          </div>

          <div className="flex items-start gap-2 mb-2">
            <div className={cn(
              "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
              task.type === "urgente" ? "bg-primary/10" : "bg-muted"
            )}>
              <ClipboardList className={cn("w-3.5 h-3.5", task.type === "urgente" ? "text-primary" : "text-muted-foreground")} strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-bold leading-snug line-clamp-2">{task.title}</p>
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">{task.description}</p>
          )}

          {totalCount > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">{checkedCount}/{totalCount} étapes</span>
                <span className="text-[11px] font-semibold text-primary">
                  {Math.round((checkedCount / totalCount) * 100)}%
                </span>
              </div>
              <Progress value={(checkedCount / totalCount) * 100} className="h-1.5" />
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-3">
              {task.location && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="w-3 h-3" strokeWidth={1.5} />
                  {task.location}
                </div>
              )}
              {task.profiles?.full_name && (
                <div className="flex items-center gap-1.5">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[9px] font-bold bg-primary text-primary-foreground">
                      {getInitials(task.profiles.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] text-muted-foreground font-medium">{task.profiles.full_name}</span>
                </div>
              )}
            </div>
            <span className={cn(
              "text-[11px] font-bold group-hover:text-primary transition-colors",
              task.status === "a_faire" ? "text-muted-foreground" : "text-blue-500"
            )}>
              {task.status === "a_faire" ? "Assigner →" : "Mettre à jour"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ListRow({ task }: { task: TaskWithAssignee }) {
  return (
    <Link href={`/taches/${task.id}`} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
      <div className={cn("w-1.5 h-10 rounded-full shrink-0", task.type === "urgente" ? "bg-primary" : "bg-border")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[14px] font-semibold truncate">{task.title}</p>
          {task.type === "urgente" && (
            <Badge className="text-[10px] uppercase tracking-wide shrink-0">URGENT</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-[11px]", DEPT_CONFIG[task.department].className)}>
            {DEPT_CONFIG[task.department].label}
          </Badge>
          {task.location && <span className="text-[11px] text-muted-foreground">{task.location}</span>}
          {task.profiles?.full_name && (
            <span className="text-[11px] text-muted-foreground">→ {task.profiles.full_name}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={cn("text-[11px]", STATUS_CONFIG[task.status].className)}>
          {STATUS_CONFIG[task.status].label}
        </Badge>
        <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
      </div>
    </Link>
  );
}

export default function TachesPage() {
  const supabase = createClient();

  const [tasks,        setTasks]        = useState<TaskWithAssignee[]>([]);
  const [staff,        setStaff]        = useState<UserProfile[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [view,         setView]         = useState<"kanban" | "list">("kanban");
  const [search,       setSearch]       = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [newTask,      setNewTask]      = useState<NewTask>(EMPTY_TASK);
  const [newItemText,  setNewItemText]  = useState("");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const checklistInputRef = useRef<HTMLInputElement>(null);

  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*, profiles:assigned_to(full_name)")
      .order("created_at", { ascending: false })
      .limit(100);
    setTasks((data as TaskWithAssignee[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      await loadTasks();
      const { data } = await supabase.from("profiles").select("*").neq("role", "manager");
      setStaff((data as UserProfile[]) ?? []);
    }
    init();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.title.trim() || !newTask.assigned_to) {
      setError("Titre et assigné sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("hotel_id").eq("id", user!.id).single();
    const { data: inserted, error: err } = await supabase.from("tasks").insert({
      hotel_id:     (prof as { hotel_id: string }).hotel_id,
      created_by:   user!.id,
      assigned_to:  newTask.assigned_to,
      title:        newTask.title.trim(),
      description:  newTask.description.trim(),
      department:   newTask.department,
      type:         newTask.type,
      priority:     newTask.priority,
      location:     newTask.location.trim() || null,
      due_at:       newTask.due_at || null,
      status:       "a_faire",
      is_recurring: newTask.is_recurring,
      photos:       [],
      checklist:    newTask.checklist,
    }).select("id").single();
    if (err) {
      setError(err.message);
    } else {
      await supabase.from("notifications").insert({
        hotel_id: (prof as { hotel_id: string }).hotel_id,
        user_id:  newTask.assigned_to,
        type:     newTask.type === "urgente" ? "urgent" : "task_assigned",
        title:    newTask.type === "urgente" ? "Tâche urgente assignée" : "Nouvelle tâche assignée",
        message:  newTask.title.trim(),
        data:     inserted ? { task_id: (inserted as { id: string }).id } : {},
      });
      setShowForm(false);
      setNewTask(EMPTY_TASK);
      await loadTasks();
    }
    setSaving(false);
  }

  function addChecklistItem() {
    const text = newItemText.trim();
    if (!text) return;
    setNewTask({ ...newTask, checklist: [...newTask.checklist, { id: crypto.randomUUID(), text, done: false }] });
    setNewItemText("");
  }

  const filtered = tasks.filter((t) =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.location?.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const urgentCount     = tasks.filter((t) => t.type === "urgente" && ["a_faire", "en_cours"].includes(t.status)).length;
  const inProgressCount = tasks.filter((t) => t.status === "en_cours").length;
  const doneTodayCount  = tasks.filter((t) => t.status === "terminee" && t.completed_at && new Date(t.completed_at) >= today).length;
  const todoCount       = tasks.filter((t) => t.status === "a_faire").length;

  const todoTasks       = filtered.filter((t) => t.status === "a_faire");
  const inProgressTasks = filtered.filter((t) => t.status === "en_cours");
  const doneTasks       = filtered.filter((t) => t.status === "terminee");

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Gestion des tâches</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Coordonnez les demandes de nettoyage et de maintenance entre toutes les équipes.
          </p>
        </div>
        <Button onClick={() => { setShowForm(true); setError(""); }} className="shrink-0 font-bold gap-2">
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          Nouvelle tâche
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-primary" strokeWidth={1.5} />
              </div>
              <Badge className="text-[11px]">Urgent</Badge>
            </div>
            <p className="text-[30px] font-extrabold leading-none">{urgentCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Tâches urgentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
              </div>
              <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-600 border-blue-200">Actif</Badge>
            </div>
            <p className="text-[30px] font-extrabold leading-none">{inProgressCount}</p>
            <p className="text-xs text-muted-foreground mt-1">En cours</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" strokeWidth={1.5} />
              </div>
              <Badge variant="outline" className="text-[11px] bg-green-50 text-green-600 border-green-200">Aujourd&apos;hui</Badge>
            </div>
            <p className="text-[30px] font-extrabold leading-none">{doneTodayCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Terminées aujourd&apos;hui</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <Badge variant="secondary" className="text-[11px]">En attente</Badge>
            </div>
            <p className="text-[30px] font-extrabold leading-none">{todoCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Tâches à faire</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + view toggle */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher tâches, assignés, emplacements..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center bg-card border border-border rounded-xl p-1">
          <Button
            variant="ghost"
            size="icon"
            title="Vue kanban"
            className={cn("h-7 w-7 rounded-lg", view === "kanban" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
            onClick={() => setView("kanban")}
          >
            <Columns3 className="w-4 h-4" strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Vue liste"
            className={cn("h-7 w-7 rounded-lg", view === "list" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
            onClick={() => setView("list")}
          >
            <List className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-8 w-32 rounded-full" />
              {[1, 2, 3].map((j) => <Skeleton key={j} className="h-40 rounded-2xl" />)}
            </div>
          ))}
        </div>
      ) : view === "kanban" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: "calc(100vh - 340px)" }}>
          {[
            { label: "À faire",   tasks: todoTasks,       dotClass: "bg-muted-foreground",  countClass: "bg-secondary text-secondary-foreground" },
            { label: "En cours",  tasks: inProgressTasks, dotClass: "bg-blue-500",           countClass: "bg-blue-50 text-blue-600"               },
            { label: "Terminées", tasks: doneTasks,        dotClass: "bg-green-500",          countClass: "bg-green-50 text-green-600"             },
          ].map(({ label, tasks: colTasks, dotClass, countClass }) => (
            <div key={label} className="flex flex-col min-h-0">
              <div className="flex items-center gap-2.5 mb-4 shrink-0">
                <div className={cn("w-2.5 h-2.5 rounded-full", dotClass)} />
                <h2 className="text-[15px] font-bold">{label}</h2>
                <span className={cn("ml-auto text-[12px] font-bold px-2.5 py-0.5 rounded-full", countClass)}>
                  {colTasks.length} tâche{colTasks.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                {colTasks.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex items-center justify-center py-12">
                      <p className="text-sm text-muted-foreground">Aucune tâche</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-3 pb-2">
                    {colTasks.map((task) => <KanbanCard key={task.id} task={task} />)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-xl">📋</div>
            <p className="text-sm font-semibold text-muted-foreground">Aucune tâche</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {filtered.map((task) => <ListRow key={task.id} task={task} />)}
          </div>
        </Card>
      )}

      {/* Create task Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setNewTask(EMPTY_TASK); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 py-5 border-b border-border shrink-0">
            <DialogTitle className="text-[17px]">Nouvelle tâche</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="flex-1 overflow-y-auto flex flex-col px-6 py-5 gap-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{error}</p>
            )}

            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Ex: Nettoyer chambre 201"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Détails de la tâche..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Checklist */}
            {newTask.type === "routine" && (
              <div className="space-y-1.5">
                <Label>
                  Liste de tâches{" "}
                  <span className="text-muted-foreground font-normal">(optionnel)</span>
                </Label>

                {newTask.checklist.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-2">
                    {newTask.checklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 bg-muted px-3 py-2 rounded-xl">
                        <div className="w-4 h-4 rounded border border-border shrink-0" />
                        <span className="flex-1 text-sm">{item.text}</span>
                        <button
                          type="button"
                          onClick={() => setNewTask({ ...newTask, checklist: newTask.checklist.filter((i) => i.id !== item.id) })}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    ref={checklistInputRef}
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); checklistInputRef.current?.focus(); } }}
                    placeholder="Ajouter une étape… (Entrée pour confirmer)"
                  />
                  <Button type="button" size="icon" onClick={() => { addChecklistItem(); checklistInputRef.current?.focus(); }}>
                    <Plus className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Département</Label>
                <Select value={newTask.department} onValueChange={(v) => setNewTask({ ...newTask, department: v as Department })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="housekeeping">Housekeeping</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="it">IT</SelectItem>
                    <SelectItem value="reception">Réception</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={newTask.type} onValueChange={(v) => setNewTask({ ...newTask, type: v as "routine" | "urgente" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Priorité</Label>
              <div className="flex gap-2">
                {(["basse", "normale", "haute"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewTask({ ...newTask, priority: p })}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors",
                      newTask.priority === p
                        ? p === "haute"   ? "bg-primary text-primary-foreground border-primary"
                        : p === "normale" ? "bg-blue-500 text-white border-blue-500"
                                         : "bg-secondary text-secondary-foreground border-border"
                        : "bg-card text-muted-foreground border-border hover:border-muted-foreground"
                    )}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Assigné à *</Label>
              <Select value={newTask.assigned_to} onValueChange={(v) => setNewTask({ ...newTask, assigned_to: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Choisir un membre…" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name} — {DEPT_CONFIG[s.role as Department]?.label ?? s.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Emplacement</Label>
              <Input
                value={newTask.location}
                onChange={(e) => setNewTask({ ...newTask, location: e.target.value })}
                placeholder="Ex: Chambre 201, Couloir 3…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Échéance</Label>
              <Input
                type="datetime-local"
                value={newTask.due_at}
                onChange={(e) => setNewTask({ ...newTask, due_at: e.target.value })}
              />
            </div>

            {/* Recurring toggle */}
            <div className={cn(
              "flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all",
              newTask.is_recurring ? "border-primary bg-primary/5" : "border-border bg-card"
            )}>
              <div>
                <p className={cn("text-sm font-bold", newTask.is_recurring ? "text-primary" : "")}>
                  Tâche récurrente (Du jour)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Apparaît chaque jour dans l&apos;onglet &quot;Du jour&quot; du staff
                </p>
              </div>
              <Switch
                checked={newTask.is_recurring}
                onCheckedChange={(checked) => setNewTask({ ...newTask, is_recurring: checked })}
              />
            </div>

            <div className="mt-auto pt-4 border-t border-border">
              <Button type="submit" className="w-full font-bold" disabled={saving}>
                {saving ? "Création…" : "Créer la tâche"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
