"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Task, TaskComment, TaskStatus, UserProfile, Department } from "@/types";
import { ArrowLeft, MapPin, User, Clock, BedDouble, Pencil, Check, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  a_faire:  { label: "À faire",  className: "bg-secondary text-secondary-foreground border-border"    },
  en_cours: { label: "En cours", className: "bg-blue-50 text-blue-600 border-blue-200"               },
  terminee: { label: "Terminée", className: "bg-green-50 text-green-600 border-green-200"            },
  annulee:  { label: "Annulée",  className: "bg-secondary text-muted-foreground border-border"       },
};

const PRIORITY_CONFIG = {
  basse:   { label: "Basse",   className: "bg-secondary text-muted-foreground border-border"   },
  normale: { label: "Normale", className: "bg-yellow-50 text-yellow-600 border-yellow-200"    },
  haute:   { label: "Haute",   className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const DEPT_LABELS: Record<string, string> = {
  housekeeping: "Housekeeping", maintenance: "Maintenance", it: "IT", reception: "Réception",
};

const ROOM_STATUS_CONFIG: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  disponible:  { label: "Disponible",  dotClass: "bg-green-500",  badgeClass: "bg-green-100 text-green-700 border-green-200"  },
  occupee:     { label: "Occupée",     dotClass: "bg-blue-500",   badgeClass: "bg-blue-100 text-blue-700 border-blue-200"    },
  nettoyage:   { label: "Nettoyage",   dotClass: "bg-amber-500",  badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
  maintenance: { label: "Maintenance", dotClass: "bg-red-500",    badgeClass: "bg-red-100 text-red-700 border-red-200"       },
};

function formatDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

type RoomInfo = { number: string; status: string; floor: number; type: string };
type TaskWithAssignee = Task & { profiles?: { full_name: string }; rooms?: RoomInfo };

export default function ManagerTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [task,       setTask]       = useState<TaskWithAssignee | null>(null);
  const [comments,   setComments]   = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending,    setSending]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [userId,     setUserId]     = useState("");

  const [editing,    setEditing]    = useState(false);
  const [editTitle,  setEditTitle]  = useState("");
  const [editDesc,   setEditDesc]   = useState("");
  const [editPrio,   setEditPrio]   = useState<"basse" | "normale" | "haute">("normale");
  const [editDept,   setEditDept]   = useState<Department>("housekeeping");
  const [editAssign, setEditAssign] = useState("");
  const [staffList,  setStaffList]  = useState<UserProfile[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: row } = await supabase
        .from("tasks")
        .select("*, profiles:assigned_to(full_name), rooms(number, status, floor, type)")
        .eq("id", id).single();

      if (row) {
        const t = row as TaskWithAssignee;
        setTask(t);
        setEditTitle(t.title); setEditDesc(t.description ?? "");
        setEditPrio(t.priority); setEditDept(t.department); setEditAssign(t.assigned_to ?? "");
      }

      const { data: commentRows } = await supabase
        .from("task_comments").select("*, profiles(full_name)")
        .eq("task_id", id).order("created_at", { ascending: true });
      if (commentRows) setComments(commentRows);

      const { data: prof } = await supabase.from("profiles").select("hotel_id").eq("id", user.id).single();
      if (prof) {
        const { data: staff } = await supabase.from("profiles")
          .select("id, full_name, role, hotel_id, is_active")
          .eq("hotel_id", prof.hotel_id).neq("role", "manager").eq("is_active", true).order("full_name");
        setStaffList((staff as UserProfile[]) ?? []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleAddComment() {
    if (!newComment.trim() || !task) return;
    setSending(true);
    const { data } = await supabase.from("task_comments")
      .insert({ task_id: id, user_id: userId, content: newComment.trim() })
      .select("*, profiles(full_name)").single();
    if (data) {
      setComments((prev) => [...prev, data]);
      if (task.assigned_to && task.assigned_to !== userId) {
        await supabase.from("notifications").insert({
          hotel_id: task.hotel_id, user_id: task.assigned_to, type: "note_added",
          title: "Note ajoutée par le manager", message: newComment.trim(), data: { task_id: task.id },
        });
      }
    }
    setNewComment(""); setSending(false);
  }

  async function handleSaveEdit() {
    if (!task || !editTitle.trim()) return;
    setSaving(true); setSaveError("");
    const { error } = await supabase.from("tasks").update({
      title: editTitle.trim(), description: editDesc.trim(),
      priority: editPrio, department: editDept, assigned_to: editAssign || task.assigned_to,
    }).eq("id", id);
    if (error) { setSaveError(error.message); setSaving(false); return; }
    if (editAssign && editAssign !== task.assigned_to) {
      await supabase.from("notifications").insert({
        hotel_id: task.hotel_id, user_id: editAssign, type: "task_assigned",
        title: "Tâche récurrente mise à jour", message: editTitle.trim(), data: { task_id: task.id },
      });
    }
    const { data: updated } = await supabase.from("tasks")
      .select("*, profiles:assigned_to(full_name), rooms(number, status, floor, type)").eq("id", id).single();
    if (updated) setTask(updated as TaskWithAssignee);
    setEditing(false); setSaving(false);
  }

  if (loading || !task) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-8 w-3/4 rounded-full" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/taches" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground font-medium mb-6 hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        Retour aux tâches
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: task info */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card>
            <CardContent className="p-6">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-2">
                  {task.is_recurring && (
                    <Badge className="gap-1 text-[11px]">
                      <RefreshCw className="w-3 h-3" strokeWidth={2} />
                      Récurrente
                    </Badge>
                  )}
                  {task.type === "urgente" && (
                    <Badge className="text-[11px] uppercase tracking-wide">Urgent</Badge>
                  )}
                  <Badge variant="outline" className={cn("text-[11px]", STATUS_CONFIG[task.status].className)}>
                    {STATUS_CONFIG[task.status].label}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[11px]", PRIORITY_CONFIG[task.priority].className)}>
                    Priorité {PRIORITY_CONFIG[task.priority].label}
                  </Badge>
                  <Badge variant="secondary" className="text-[11px]">
                    {DEPT_LABELS[task.department] ?? task.department}
                  </Badge>
                </div>
                {task.is_recurring && !editing && (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setEditing(true)}>
                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Modifier
                  </Button>
                )}
              </div>

              {/* View mode */}
              {!editing && (
                <>
                  <h1 className="text-[22px] font-extrabold leading-tight">{task.title}</h1>
                  {task.description && (
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{task.description}</p>
                  )}
                  <Separator className="my-5" />
                  <div className="flex flex-col gap-2">
                    {task.profiles?.full_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        Assigné à <span className="font-semibold text-foreground">{task.profiles.full_name}</span>
                      </div>
                    )}
                    {task.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        {task.location}
                      </div>
                    )}
                    {task.due_at && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                        Échéance : {formatDate(task.due_at)}
                      </div>
                    )}
                  </div>

                  {/* Linked room */}
                  {task.rooms && (() => {
                    const rs = ROOM_STATUS_CONFIG[task.rooms.status] ?? ROOM_STATUS_CONFIG.disponible;
                    return (
                      <div className="mt-5 pt-4 border-t border-border">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Chambre liée</p>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center">
                              <BedDouble className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                            </div>
                            <div>
                              <p className="text-sm font-bold">Chambre {task.rooms.number}</p>
                              <p className="text-[11px] text-muted-foreground">Étage {task.rooms.floor} · {task.rooms.type.charAt(0).toUpperCase() + task.rooms.type.slice(1)}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn("text-[11px] gap-1.5", rs.badgeClass)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", rs.dotClass)} />
                            {rs.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Timeline */}
                  {(task.started_at || task.completed_at) && (
                    <div className="mt-4 pt-4 border-t border-border flex flex-col gap-1.5">
                      {task.started_at && (
                        <p className="text-xs text-muted-foreground">▶ Démarré le {formatDate(task.started_at)}</p>
                      )}
                      {task.completed_at && (
                        <p className="text-xs text-green-600">✓ Terminé le {formatDate(task.completed_at)}</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Edit mode */}
              {editing && (
                <div className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <Label>Titre</Label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="resize-none" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priorité</Label>
                    <div className="flex gap-2">
                      {(["basse", "normale", "haute"] as const).map((p) => (
                        <button
                          key={p} type="button" onClick={() => setEditPrio(p)}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors",
                            editPrio === p ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-muted-foreground"
                          )}
                        >
                          {PRIORITY_CONFIG[p].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Département</Label>
                    <Select value={editDept} onValueChange={(v) => setEditDept(v as Department)}>
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
                    <Label>Assigné à</Label>
                    <Select value={editAssign} onValueChange={(v) => setEditAssign(v ?? "")}>
                      <SelectTrigger><SelectValue placeholder="— Choisir un membre —" /></SelectTrigger>
                      <SelectContent>
                        {staffList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name} ({DEPT_LABELS[s.role] ?? s.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {saveError && <p className="text-xs text-destructive font-medium">{saveError}</p>}
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1 gap-2" onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}>
                      {saving
                        ? <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Enregistrement…</>
                        : <><Check className="w-4 h-4" strokeWidth={2} /> Enregistrer</>
                      }
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => { setEditing(false); setSaveError(""); }} disabled={saving}>
                      <X className="w-4 h-4" strokeWidth={2} />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photos */}
          {!editing && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px]">📸 Photos</CardTitle>
              </CardHeader>
              <CardContent>
                {!task.photos || task.photos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune photo ajoutée par le staff.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {task.photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full aspect-square object-cover rounded-xl border border-border hover:opacity-90 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: comments */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">💬 Notes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 flex-1">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune note pour le moment.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((c) => (
                  <div key={c.id} className="bg-muted/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{c.profiles?.full_name ?? "Inconnu"}</span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(c.created_at ?? undefined)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
            <Separator className="my-1" />
            <Textarea
              rows={3}
              placeholder="Ajouter une note..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="resize-none"
            />
            <Button
              className="w-full font-bold"
              onClick={handleAddComment}
              disabled={!newComment.trim() || sending}
            >
              {sending ? "Envoi…" : "Ajouter"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
