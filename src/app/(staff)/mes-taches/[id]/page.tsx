"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Task, TaskComment, TaskStatus } from "@/types";
import { ArrowLeft, Plus, MapPin, Clock, AlertTriangle, X, Check } from "lucide-react";
import { notifyRoomStatusChange } from "@/lib/notifications";

// --- Helpers ---
const STATUS_LABEL: Record<TaskStatus, string> = {
  a_faire:  "À faire",
  en_cours: "En cours",
  terminee: "Terminé",
  annulee:  "Annulé",
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  a_faire:  "bg-gray-100 text-gray-500",
  en_cours: "bg-blue-50 text-blue-600",
  terminee: "bg-green-50 text-green-600",
  annulee:  "bg-gray-100 text-gray-400",
};

const PRIORITY_LABEL = { basse: "Basse", normale: "Normale", haute: "Haute" };
const PRIORITY_STYLE = {
  basse:   "bg-gray-100 text-gray-500",
  normale: "bg-yellow-50 text-yellow-600",
  haute:   "bg-red-50 text-red-500",
};

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

// --- Report Modal ---
function ReportModal({
  task, hotelId, userId, onClose,
}: {
  task: Task; hotelId: string; userId: string; onClose: () => void;
}) {
  const supabase = createClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  async function handleSubmit() {
    setSending(true);
    const { data: manager } = await supabase
      .from("profiles").select("id").eq("hotel_id", hotelId).eq("role", "manager").single();
    if (manager) {
      await supabase.from("notifications").insert({
        hotel_id: hotelId, user_id: manager.id,
        type: "issue_reported",
        title: `Problème : ${task.title}`,
        message, data: { task_id: task.id },
      });
    }
    setSent(true);
    setTimeout(onClose, 1600);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50">
      <div className="w-full bg-white rounded-t-3xl p-6 pb-10 shadow-xl">
        {sent ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#FFF1EF] flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-[#FA7866]" strokeWidth={1.5} />
            </div>
            <p className="text-[15px] font-bold text-[#1E1E1E]">Signalement envoyé</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-[#1E1E1E]">Signaler un problème</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <textarea
              rows={4}
              className="w-full border border-gray-200 rounded-xl p-3 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[#FA7866]/40 placeholder:text-gray-300"
              placeholder="Décrivez le problème en détail..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || sending}
              className="mt-4 w-full py-3 rounded-xl bg-[#FA7866] text-white text-[13px] font-bold disabled:opacity-30 active:scale-[.98] transition-transform"
            >
              {sending ? "Envoi..." : "Envoyer le signalement"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// --- Main Detail Page ---
export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [task,        setTask]        = useState<Task | null>(null);
  const [comments,    setComments]    = useState<TaskComment[]>([]);
  const [newComment,  setNewComment]  = useState("");
  const [sending,     setSending]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [showReport,  setShowReport]  = useState(false);
  const [userId,      setUserId]      = useState("");
  const [hotelId,     setHotelId]     = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles").select("hotel_id").eq("id", user.id).single();
      if (profile) setHotelId(profile.hotel_id);

      // Fetch task with room info
      const { data: row } = await supabase
        .from("tasks")
        .select("*, rooms(number)")
        .eq("id", id)
        .single();

      if (row) {
        setTask({ ...row, photos: row.photos ?? [], checklist: row.checklist ?? [], location: row.rooms ? `Chambre ${row.rooms.number}` : undefined });
      }

      // Fetch comments with author name
      const { data: commentRows } = await supabase
        .from("task_comments")
        .select("*, profiles(full_name)")
        .eq("task_id", id)
        .order("created_at", { ascending: true });

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

    // If task is linked to a room, mark it available and notify
    if (task.room_id) {
      const { data: room } = await supabase
        .from("rooms")
        .update({ status: "disponible", updated_at: now })
        .eq("id", task.room_id)
        .select("number")
        .single();

      if (room && hotelId) {
        notifyRoomStatusChange(hotelId, room.number, "disponible", id);
      }
    }
  }

  async function handleToggleChecklist(itemId: string) {
    if (!task) return;
    const updated = task.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    setTask({ ...task, checklist: updated });
    await supabase.from("tasks").update({ checklist: updated }).eq("id", id);
  }

  async function handleAddComment() {
    if (!newComment.trim() || !task) return;
    setSending(true);

    const { data } = await supabase
      .from("task_comments")
      .insert({ task_id: id, user_id: userId, content: newComment.trim() })
      .select("*, profiles(full_name)")
      .single();

    if (data) {
      setComments((prev) => [...prev, data]);

      // Notify all managers of this hotel
      const { data: managers } = await supabase
        .from("profiles")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("role", "manager");

      if (managers?.length) {
        const senderName = data.profiles?.full_name ?? "Un membre du staff";
        await supabase.from("notifications").insert(
          managers.map((m) => ({
            hotel_id: hotelId,
            user_id:  m.id,
            type:     "note_added",
            title:    `Note sur : ${task.title}`,
            message:  `${senderName} : ${newComment.trim()}`,
            data:     { task_id: id },
            is_read:  false,
          }))
        );
      }
    }

    setNewComment("");
    setSending(false);
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
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  }

  if (loading || !task) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 flex flex-col gap-4">
        <div className="h-5 w-24 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-8 w-3/4 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        <div className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />
      </div>
    );
  }

  const isDone = task.status === "terminee" || task.status === "annulee";

  return (
    <>
      {showReport && (
        <ReportModal
          task={task} hotelId={hotelId} userId={userId}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      <div className="max-w-lg mx-auto px-4 pb-16">

        {/* Back button — always goes to task list */}
        <Link
          href="/mes-taches"
          className="mt-5 flex items-center gap-1.5 text-[13px] text-gray-400 font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Mes tâches
        </Link>

        {/* ── TASK SUMMARY ── */}
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            {task.type === "urgente" && (
              <span className="text-[11px] font-semibold bg-[#FFF1EF] text-[#FA7866] px-2 py-0.5 rounded-full uppercase tracking-wide">
                Urgent
              </span>
            )}
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[task.status]}`}>
              {STATUS_LABEL[task.status]}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLE[task.priority]}`}>
              Priorité {PRIORITY_LABEL[task.priority]}
            </span>
          </div>

          <h1 className="text-[20px] font-extrabold text-[#1E1E1E] leading-tight">
            {task.title}
          </h1>

          <p className="mt-2 text-[14px] text-gray-500 leading-relaxed">
            {task.description}
          </p>

          {/* Meta */}
          <div className="mt-4 flex flex-col gap-2">
            {task.location && (
              <div className="flex items-center gap-2 text-[13px] text-gray-400">
                <MapPin className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                {task.location}
              </div>
            )}
            {task.due_at && (
              <div className="flex items-center gap-2 text-[13px] text-gray-400">
                <Clock className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                À faire avant {formatDate(task.due_at)}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-1.5">
            {task.started_at && (
              <p className="text-[12px] text-gray-400">
                ▶ Démarré le {formatDate(task.started_at)}
              </p>
            )}
            {task.completed_at && (
              <p className="text-[12px] text-green-500">
                ✓ Terminé le {formatDate(task.completed_at)}
              </p>
            )}
          </div>

          {/* Action button */}
          {!isDone && (
            <div className="mt-5">
              {task.status === "a_faire" && (
                <button
                  onClick={handleStart}
                  className="w-full py-3 rounded-xl bg-[#1E1E1E] text-white text-[13px] font-bold active:scale-[.98] transition-transform"
                >
                  Démarrer la tâche
                </button>
              )}
              {task.status === "en_cours" && (
                <button
                  onClick={handleDone}
                  className="w-full py-3 rounded-xl bg-[#FA7866] text-white text-[13px] font-bold active:scale-[.98] transition-transform"
                >
                  Marquer comme terminé ✓
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── CHECKLIST ── */}
        {task.checklist && task.checklist.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-[#1E1E1E]">✅ Liste de tâches</h2>
              <span className="text-[12px] font-semibold text-gray-400">
                {task.checklist.filter((i) => i.done).length}/{task.checklist.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-[#FA7866] rounded-full transition-all duration-300"
                style={{ width: `${(task.checklist.filter((i) => i.done).length / task.checklist.length) * 100}%` }}
              />
            </div>

            <div className="flex flex-col gap-2">
              {task.checklist.map((item) => (
                <button
                  key={item.id}
                  onClick={() => !isDone && handleToggleChecklist(item.id)}
                  disabled={isDone}
                  className={`flex items-center gap-3 w-full text-left p-3 rounded-xl transition-colors ${
                    isDone ? "cursor-default" : "hover:bg-gray-50 active:scale-[.99]"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    item.done ? "bg-[#FA7866] border-[#FA7866]" : "border-gray-300"
                  }`}>
                    {item.done && (
                      <Check className="w-3 h-3 text-white" strokeWidth={1.5} />
                    )}
                  </div>
                  <span className={`text-[13px] font-medium transition-colors ${
                    item.done ? "line-through text-gray-300" : "text-[#1E1E1E]"
                  }`}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PHOTOS ── */}
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-[#1E1E1E]">📸 Photos</h2>
            {!isDone && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-[#FA7866] bg-[#FFF1EF] px-3 py-1.5 rounded-full disabled:opacity-40"
              >
                {uploading ? "Envoi..." : (
                  <>
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Ajouter
                  </>
                )}
              </button>
            )}
          </div>

          {task.photos.length === 0 ? (
            <div
              onClick={() => !isDone && fileRef.current?.click()}
              className={`border-2 border-dashed border-gray-200 rounded-xl p-8 text-center ${!isDone ? "cursor-pointer hover:border-[#FA7866]/40" : ""}`}
            >
              <p className="text-[13px] text-gray-300">
                {isDone ? "Aucune photo ajoutée" : "Appuyez pour ajouter une photo"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {task.photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-xl border border-gray-100"
                  />
                </a>
              ))}
              {!isDone && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-[#FA7866]/40"
                >
                  <Plus className="w-6 h-6" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── NOTES & COMMENTS ── */}
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-[15px] font-bold text-[#1E1E1E] mb-3">💬 Notes</h2>

          {comments.length === 0 ? (
            <p className="text-[13px] text-gray-300 mb-4">Aucune note pour le moment.</p>
          ) : (
            <div className="flex flex-col gap-3 mb-4">
              {comments.map((c) => (
                <div key={c.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-[#1E1E1E]">
                      {c.profiles?.full_name ?? "Inconnu"}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-600 leading-relaxed">{c.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add note */}
          <div className="flex flex-col gap-2">
            <textarea
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-[13px] text-[#1E1E1E] resize-none focus:outline-none focus:ring-2 focus:ring-[#FA7866]/40 placeholder:text-gray-300"
              placeholder="Ajouter une note..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || sending}
              className="w-full py-2.5 rounded-xl bg-[#1E1E1E] text-white text-[13px] font-bold disabled:opacity-30 active:scale-[.98] transition-transform"
            >
              {sending ? "Envoi..." : "Ajouter la note"}
            </button>
          </div>
        </div>

        {/* ── REPORT ISSUE ── */}
        {!isDone && (
          <button
            onClick={() => setShowReport(true)}
            className="mt-4 w-full py-3 rounded-xl border border-[#FA7866]/40 text-[#FA7866] text-[13px] font-semibold active:scale-[.98] transition-transform"
          >
            Signaler un problème
          </button>
        )}
      </div>
    </>
  );
}
