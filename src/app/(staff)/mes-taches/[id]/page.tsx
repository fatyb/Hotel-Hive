"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Task, TaskComment, TaskStatus } from "@/types";
import { ArrowLeft, Plus, MapPin, Clock, AlertTriangle, X, Check } from "lucide-react";
import { notifyRoomStatusChange } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS_CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  a_faire:  { label: "À faire",  className: "bg-secondary text-secondary-foreground border-border"    },
  en_cours: { label: "En cours", className: "bg-blue-50 text-blue-600 border-blue-200"               },
  terminee: { label: "Terminé",  className: "bg-green-50 text-green-600 border-green-200"            },
  annulee:  { label: "Annulé",   className: "bg-secondary text-muted-foreground border-border"       },
};

const PRIORITY_CONFIG = {
  basse:   { label: "Basse",   className: "bg-secondary text-muted-foreground border-border"          },
  normale: { label: "Normale", className: "bg-yellow-50 text-yellow-600 border-yellow-200"           },
  haute:   { label: "Haute",   className: "bg-destructive/10 text-destructive border-destructive/20" },
};

function formatDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function ReportModal({ task, hotelId, userId, onClose }: { task: Task; hotelId: string; userId: string; onClose: () => void }) {
  const supabase = createClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  async function handleSubmit() {
    setSending(true);
    const { data: manager } = await supabase.from("profiles")
      .select("id").eq("hotel_id", hotelId).eq("role", "manager").single();
    if (manager) {
      await supabase.from("notifications").insert({
        hotel_id: hotelId, user_id: manager.id, type: "issue_reported",
        title: `Problème : ${task.title}`, message, data: { task_id: task.id },
      });
    }
    setSent(true);
    setTimeout(onClose, 1600);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        {sent ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-primary" strokeWidth={1.5} />
            </div>
            <p className="text-[15px] font-bold">Signalement envoyé</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Signaler un problème</DialogTitle>
            </DialogHeader>
            <Textarea
              rows={4}
              placeholder="Décrivez le problème en détail..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
            />
            <Button
              className="w-full font-bold"
              onClick={handleSubmit}
              disabled={!message.trim() || sending}
            >
              {sending ? "Envoi…" : "Envoyer le signalement"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function TaskDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const supabase = createClient();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [task,       setTask]       = useState<Task | null>(null);
  const [comments,   setComments]   = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending,    setSending]    = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [userId,     setUserId]     = useState("");
  const [hotelId,    setHotelId]    = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("hotel_id").eq("id", user.id).single();
      if (profile) setHotelId(profile.hotel_id);

      const { data: row } = await supabase.from("tasks").select("*, rooms(number)").eq("id", id).single();
      if (row) {
        setTask({ ...row, photos: row.photos ?? [], checklist: row.checklist ?? [], location: row.rooms ? `Chambre ${row.rooms.number}` : undefined });
      }

      const { data: commentRows } = await supabase.from("task_comments")
        .select("*, profiles(full_name)").eq("task_id", id).order("created_at", { ascending: true });
      if (commentRows) setComments(commentRows);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleStart() {
    if (!task) return;
    const now = new Date().toISOString();
    await supabase.from("tasks").update({ status: "en_cours", started_at: now }).eq("id", id);
    setTask((t) => t ? { ...t, status: "en_cours", started_at: now } : t);
  }

  async function handleDone() {
    if (!task) return;
    const now = new Date().toISOString();
    await supabase.from("tasks").update({ status: "terminee", completed_at: now }).eq("id", id);
    setTask((t) => t ? { ...t, status: "terminee", completed_at: now } : t);
    if (task.room_id) {
      const { data: room } = await supabase.from("rooms")
        .update({ status: "disponible", updated_at: now }).eq("id", task.room_id).select("number").single();
      if (room && hotelId) notifyRoomStatusChange(hotelId, room.number, "disponible", id);
    }
  }

  async function handleToggleChecklist(itemId: string) {
    if (!task) return;
    const updated = task.checklist.map((item) => item.id === itemId ? { ...item, done: !item.done } : item);
    setTask({ ...task, checklist: updated });
    await supabase.from("tasks").update({ checklist: updated }).eq("id", id);
  }

  async function handleAddComment() {
    if (!newComment.trim() || !task) return;
    setSending(true);
    const { data } = await supabase.from("task_comments")
      .insert({ task_id: id, user_id: userId, content: newComment.trim() })
      .select("*, profiles(full_name)").single();
    if (data) {
      setComments((prev) => [...prev, data]);
      const { data: managers } = await supabase.from("profiles")
        .select("id").eq("hotel_id", hotelId).eq("role", "manager");
      if (managers?.length) {
        const senderName = data.profiles?.full_name ?? "Un membre du staff";
        await supabase.from("notifications").insert(
          managers.map((m) => ({
            hotel_id: hotelId, user_id: m.id, type: "note_added",
            title: `Note sur : ${task.title}`,
            message: `${senderName} : ${newComment.trim()}`,
            data: { task_id: id }, is_read: false,
          }))
        );
      }
    }
    setNewComment(""); setSending(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    setUploading(true);
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("task-photos").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("task-photos").getPublicUrl(path);
      const newPhotos = [...task.photos, publicUrl];
      await supabase.from("tasks").update({ photos: newPhotos }).eq("id", id);
      setTask((t) => t ? { ...t, photos: newPhotos } : t);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (loading || !task) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 flex flex-col gap-4">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-8 w-3/4 rounded-full" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const isDone = task.status === "terminee" || task.status === "annulee";
  const checkedCount = task.checklist.filter((i) => i.done).length;

  return (
    <>
      {showReport && (
        <ReportModal task={task} hotelId={hotelId} userId={userId} onClose={() => setShowReport(false)} />
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />

      <div className="max-w-lg mx-auto px-4 pb-16">
        <Link href="/mes-taches" className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground font-medium hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Mes tâches
        </Link>

        {/* Task summary */}
        <Card className="mt-4">
          <CardContent className="p-5">
            <div className="flex flex-wrap gap-2 mb-3">
              {task.type === "urgente" && (
                <Badge className="gap-1 text-[11px] uppercase tracking-wide">
                  <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
                  Urgent
                </Badge>
              )}
              <Badge variant="outline" className={cn("text-[11px]", STATUS_CONFIG[task.status].className)}>
                {STATUS_CONFIG[task.status].label}
              </Badge>
              <Badge variant="outline" className={cn("text-[11px]", PRIORITY_CONFIG[task.priority].className)}>
                Priorité {PRIORITY_CONFIG[task.priority].label}
              </Badge>
            </div>

            <h1 className="text-[20px] font-extrabold leading-tight">{task.title}</h1>
            {task.description && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{task.description}</p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {task.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  {task.location}
                </div>
              )}
              {task.due_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  À faire avant {formatDate(task.due_at)}
                </div>
              )}
            </div>

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

            {!isDone && (
              <div className="mt-5">
                {task.status === "a_faire" && (
                  <Button variant="secondary" className="w-full font-bold" onClick={handleStart}>
                    Démarrer la tâche
                  </Button>
                )}
                {task.status === "en_cours" && (
                  <Button className="w-full font-bold gap-2" onClick={handleDone}>
                    <Check className="w-4 h-4" strokeWidth={2} />
                    Marquer comme terminé
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checklist */}
        {task.checklist.length > 0 && (
          <Card className="mt-4">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-bold">✅ Liste de tâches</h2>
                <span className="text-xs font-semibold text-muted-foreground">{checkedCount}/{task.checklist.length}</span>
              </div>
              <Progress value={(checkedCount / task.checklist.length) * 100} className="h-1.5 mb-4" />
              <div className="flex flex-col gap-2">
                {task.checklist.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => !isDone && handleToggleChecklist(item.id)}
                    disabled={isDone}
                    className={cn(
                      "flex items-center gap-3 w-full text-left p-3 rounded-xl transition-colors",
                      isDone ? "cursor-default" : "hover:bg-muted/50 active:scale-[.99]"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                      item.done ? "bg-primary border-primary" : "border-muted-foreground/40"
                    )}>
                      {item.done && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={1.5} />}
                    </div>
                    <span className={cn("text-sm font-medium transition-colors", item.done ? "line-through text-muted-foreground" : "")}>
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        <Card className="mt-4">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold">📸 Photos</h2>
              {!isDone && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-primary bg-primary/10 hover:bg-primary/20"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Envoi…" : <><Plus className="w-3.5 h-3.5" strokeWidth={1.5} />Ajouter</>}
                </Button>
              )}
            </div>

            {task.photos.length === 0 ? (
              <div
                onClick={() => !isDone && fileRef.current?.click()}
                className={cn(
                  "border-2 border-dashed border-border rounded-xl p-8 text-center",
                  !isDone && "cursor-pointer hover:border-primary/40"
                )}
              >
                <p className="text-sm text-muted-foreground">
                  {isDone ? "Aucune photo ajoutée" : "Appuyez pour ajouter une photo"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {task.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full aspect-square object-cover rounded-xl border border-border" />
                  </a>
                ))}
                {!isDone && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/40"
                  >
                    <Plus className="w-6 h-6" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes / Comments */}
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">💬 Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground mb-4">Aucune note pour le moment.</p>
            ) : (
              <div className="flex flex-col gap-3 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className="bg-muted/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{c.profiles?.full_name ?? "Inconnu"}</span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
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
                {sending ? "Envoi…" : "Ajouter la note"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report issue */}
        {!isDone && (
          <>
            <Separator className="my-4" />
            <Button
              variant="outline"
              className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setShowReport(true)}
            >
              <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
              Signaler un problème
            </Button>
          </>
        )}
      </div>
    </>
  );
}
