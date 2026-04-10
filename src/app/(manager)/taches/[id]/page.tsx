"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Task, TaskComment, TaskStatus, UserProfile, Department } from "@/types";
import { ArrowLeft, MapPin, User, Clock, BedDouble, Pencil, Check, X, RefreshCw } from "lucide-react";

const STATUS_LABEL: Record<TaskStatus, string> = {
  a_faire:  "À faire",
  en_cours: "En cours",
  terminee: "Terminée",
  annulee:  "Annulée",
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

const DEPT_LABELS: Record<string, string> = {
  housekeeping: "Housekeeping",
  maintenance:  "Maintenance",
  it:           "IT",
  reception:    "Réception",
};

function formatDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

type RoomInfo = { number: string; status: string; floor: number; type: string };
type TaskWithAssignee = Task & { profiles?: { full_name: string }; rooms?: RoomInfo };

const ROOM_STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; text: string }> = {
  disponible:  { label: "Disponible",  dot: "bg-green-500",  badge: "bg-green-100 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-400"  },
  occupee:     { label: "Occupée",     dot: "bg-blue-500",   badge: "bg-blue-100 dark:bg-blue-900/30",    text: "text-blue-700 dark:text-blue-400"    },
  nettoyage:   { label: "Nettoyage",   dot: "bg-amber-500",  badge: "bg-amber-100 dark:bg-amber-900/30",  text: "text-amber-700 dark:text-amber-400"  },
  maintenance: { label: "Maintenance", dot: "bg-red-500",    badge: "bg-red-100 dark:bg-red-900/30",      text: "text-red-700 dark:text-red-400"      },
};

export default function ManagerTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [task,       setTask]       = useState<TaskWithAssignee | null>(null);
  const [comments,   setComments]   = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending,    setSending]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [userId,     setUserId]     = useState("");

  // Edit state (recurring tasks only)
  const [editing,     setEditing]     = useState(false);
  const [editTitle,   setEditTitle]   = useState("");
  const [editDesc,    setEditDesc]    = useState("");
  const [editPrio,    setEditPrio]    = useState<"basse" | "normale" | "haute">("normale");
  const [editDept,    setEditDept]    = useState<Department>("housekeeping");
  const [editAssign,  setEditAssign]  = useState("");
  const [staffList,   setStaffList]   = useState<UserProfile[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: row } = await supabase
        .from("tasks")
        .select("*, profiles:assigned_to(full_name), rooms(number, status, floor, type)")
        .eq("id", id)
        .single();

      if (row) {
        const t = row as TaskWithAssignee;
        setTask(t);
        setEditTitle(t.title);
        setEditDesc(t.description ?? "");
        setEditPrio(t.priority);
        setEditDept(t.department);
        setEditAssign(t.assigned_to ?? "");
      }

      const { data: commentRows } = await supabase
        .from("task_comments")
        .select("*, profiles(full_name)")
        .eq("task_id", id)
        .order("created_at", { ascending: true });

      if (commentRows) setComments(commentRows);

      // Fetch all non-manager staff for reassignment
      const { data: prof } = await supabase
        .from("profiles").select("hotel_id").eq("id", user.id).single();
      if (prof) {
        const { data: staff } = await supabase
          .from("profiles")
          .select("id, full_name, role, hotel_id, is_active")
          .eq("hotel_id", prof.hotel_id)
          .neq("role", "manager")
          .eq("is_active", true)
          .order("full_name");
        setStaffList((staff as UserProfile[]) ?? []);
      }

      setLoading(false);
    }
    load();
  }, [id]);

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
      if (task.assigned_to && task.assigned_to !== userId) {
        await supabase.from("notifications").insert({
          hotel_id: task.hotel_id,
          user_id:  task.assigned_to,
          type:     "note_added",
          title:    "Note ajoutée par le manager",
          message:  newComment.trim(),
          data:     { task_id: task.id },
        });
      }
    }
    setNewComment("");
    setSending(false);
  }

  async function handleSaveEdit() {
    if (!task || !editTitle.trim()) return;
    setSaving(true);
    setSaveError("");

    const { error } = await supabase
      .from("tasks")
      .update({
        title:       editTitle.trim(),
        description: editDesc.trim(),
        priority:    editPrio,
        department:  editDept,
        assigned_to: editAssign || task.assigned_to,
      })
      .eq("id", id);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    // Notify new assignee if changed
    if (editAssign && editAssign !== task.assigned_to) {
      await supabase.from("notifications").insert({
        hotel_id: task.hotel_id,
        user_id:  editAssign,
        type:     "task_assigned",
        title:    "Tâche récurrente mise à jour",
        message:  editTitle.trim(),
        data:     { task_id: task.id },
      });
    }

    // Refresh task
    const { data: updated } = await supabase
      .from("tasks")
      .select("*, profiles:assigned_to(full_name), rooms(number, status, floor, type)")
      .eq("id", id)
      .single();

    if (updated) setTask(updated as TaskWithAssignee);
    setEditing(false);
    setSaving(false);
  }

  if (loading || !task) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        <div className="h-8 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        <div className="h-40 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/taches"
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 font-medium mb-6 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        Retour aux tâches
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: task info */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Task summary card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">

            {/* Header row: badges + edit button */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-2">
                {task.is_recurring && (
                  <span className="flex items-center gap-1 text-[11px] font-bold bg-[#FFF1EF] dark:bg-[#FA7866]/10 text-[#FA7866] px-2.5 py-1 rounded-full">
                    <RefreshCw className="w-3 h-3" strokeWidth={2} />
                    Récurrente
                  </span>
                )}
                {task.type === "urgente" && (
                  <span className="text-[11px] font-bold bg-[#FFF1EF] dark:bg-[#FA7866]/10 text-[#FA7866] px-2.5 py-1 rounded-full uppercase tracking-wide">
                    Urgent
                  </span>
                )}
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[task.status]}`}>
                  {STATUS_LABEL[task.status]}
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${PRIORITY_STYLE[task.priority]}`}>
                  Priorité {PRIORITY_LABEL[task.priority]}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  {DEPT_LABELS[task.department] ?? task.department}
                </span>
              </div>

              {/* Edit button — only for recurring tasks */}
              {task.is_recurring && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[12px] font-semibold text-gray-500 dark:text-gray-400 hover:border-[#FA7866]/40 hover:text-[#FA7866] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Modifier
                </button>
              )}
            </div>

            {/* ── View mode ── */}
            {!editing && (
              <>
                <h1 className="text-[22px] font-extrabold text-[#1E1E1E] dark:text-white leading-tight">{task.title}</h1>

                {task.description && (
                  <p className="mt-3 text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">{task.description}</p>
                )}

                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
                  {task.profiles?.full_name && (
                    <div className="flex items-center gap-2 text-[13px] text-gray-400">
                      <User className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                      Assigné à <span className="font-semibold text-[#1E1E1E] dark:text-white">{task.profiles.full_name}</span>
                    </div>
                  )}
                  {task.location && (
                    <div className="flex items-center gap-2 text-[13px] text-gray-400">
                      <MapPin className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                      {task.location}
                    </div>
                  )}
                  {task.due_at && (
                    <div className="flex items-center gap-2 text-[13px] text-gray-400">
                      <Clock className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                      Échéance : {formatDate(task.due_at)}
                    </div>
                  )}
                </div>

                {/* Room status */}
                {task.rooms && (() => {
                  const rs = ROOM_STATUS_CONFIG[task.rooms.status] ?? ROOM_STATUS_CONFIG.disponible;
                  return (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Chambre liée</p>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                            <BedDouble className="w-4 h-4 text-gray-500 dark:text-gray-400" strokeWidth={1.5} />
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-[#1E1E1E] dark:text-white">Chambre {task.rooms.number}</p>
                            <p className="text-[11px] text-gray-400">Étage {task.rooms.floor} · {task.rooms.type.charAt(0).toUpperCase() + task.rooms.type.slice(1)}</p>
                          </div>
                        </div>
                        <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${rs.badge} ${rs.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${rs.dot}`} />
                          {rs.label}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Timeline */}
                {(task.started_at || task.completed_at) && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-1.5">
                    {task.started_at && (
                      <p className="text-[12px] text-gray-400">▶ Démarré le {formatDate(task.started_at)}</p>
                    )}
                    {task.completed_at && (
                      <p className="text-[12px] text-green-500">✓ Terminé le {formatDate(task.completed_at)}</p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Edit mode (recurring only) ── */}
            {editing && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Titre</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[13px] text-[#1E1E1E] dark:text-white focus:outline-none focus:border-[#FA7866] focus:ring-1 focus:ring-[#FA7866]/30"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[13px] text-[#1E1E1E] dark:text-white resize-none focus:outline-none focus:border-[#FA7866] focus:ring-1 focus:ring-[#FA7866]/30"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Priorité</label>
                  <div className="flex gap-2">
                    {(["basse", "normale", "haute"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditPrio(p)}
                        className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
                          editPrio === p
                            ? "bg-[#FA7866] border-[#FA7866] text-white"
                            : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-[#FA7866]/40"
                        }`}
                      >
                        {PRIORITY_LABEL[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Département</label>
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value as Department)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[13px] text-[#1E1E1E] dark:text-white focus:outline-none focus:border-[#FA7866]"
                  >
                    <option value="housekeeping">Housekeeping</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="it">IT</option>
                    <option value="reception">Réception</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Assigné à</label>
                  <select
                    value={editAssign}
                    onChange={(e) => setEditAssign(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[13px] text-[#1E1E1E] dark:text-white focus:outline-none focus:border-[#FA7866]"
                  >
                    <option value="">— Choisir un membre —</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name} ({DEPT_LABELS[s.role] ?? s.role})</option>
                    ))}
                  </select>
                </div>

                {saveError && (
                  <p className="text-[12px] text-red-500 font-medium">{saveError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || !editTitle.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FA7866] hover:bg-[#E55C49] text-white text-[13px] font-bold transition-colors disabled:opacity-40"
                  >
                    {saving
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enregistrement…</>
                      : <><Check className="w-4 h-4" strokeWidth={2} /> Enregistrer</>
                    }
                  </button>
                  <button
                    onClick={() => { setEditing(false); setSaveError(""); }}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Photos */}
          {!editing && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
              <h2 className="text-[15px] font-bold text-[#1E1E1E] dark:text-white mb-4">📸 Photos</h2>
              {!task.photos || task.photos.length === 0 ? (
                <p className="text-[13px] text-gray-300 dark:text-gray-600">Aucune photo ajoutée par le staff.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {task.photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full aspect-square object-cover rounded-xl border border-gray-100 dark:border-gray-800 hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: comments */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 flex flex-col">
          <h2 className="text-[15px] font-bold text-[#1E1E1E] dark:text-white mb-4">💬 Notes</h2>

          <div className="flex-1 flex flex-col gap-3 mb-4">
            {comments.length === 0 ? (
              <p className="text-[13px] text-gray-300 dark:text-gray-600">Aucune note pour le moment.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-[#1E1E1E] dark:text-white">
                      {c.profiles?.full_name ?? "Inconnu"}
                    </span>
                    <span className="text-[11px] text-gray-400">{formatDate(c.created_at ?? undefined)}</span>
                  </div>
                  <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed">{c.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <textarea
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl p-3 text-[13px] text-[#1E1E1E] dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-[#FA7866]/40 placeholder:text-gray-300 dark:placeholder:text-gray-600"
              placeholder="Ajouter une note..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || sending}
              className="w-full py-2.5 rounded-xl bg-[#FA7866] text-white text-[13px] font-bold disabled:opacity-30 hover:bg-[#E55C49] transition-colors"
            >
              {sending ? "Envoi..." : "Ajouter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
