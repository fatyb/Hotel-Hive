// HotelHive — Shared TypeScript types
// Field names match the Supabase DB schema

export type TaskStatus = "a_faire" | "en_cours" | "terminee" | "annulee";
export type TaskType = "routine" | "urgente";
export type TaskPriority = "basse" | "normale" | "haute";
export type Department = "housekeeping" | "maintenance" | "it" | "reception";
export type UserRole = "manager" | "reception" | "housekeeping" | "maintenance" | "it";
export type RoomStatus = "disponible" | "occupee" | "nettoyage" | "maintenance";
export type HotelPlan = "basic" | "pro" | "enterprise";

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Task = {
  id: string;
  hotel_id: string;
  created_by: string;
  assigned_to: string;
  room_id?: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  department: Department;
  due_at?: string;
  started_at?: string;
  completed_at?: string;
  is_recurring: boolean;
  photos: string[];
  checklist: ChecklistItem[];
  // UI helpers (not in DB)
  location?: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string };
};

export type Room = {
  id: string;
  hotel_id: string;
  number: string;
  floor: number;
  type: "simple" | "double" | "suite";
  status: RoomStatus;
  is_occupied: boolean;
  notes?: string;
  updated_at: string;
};

export type UserProfile = {
  id: string;
  hotel_id: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  push_token?: string;
};

export type Hotel = {
  id: string;
  name: string;
  slug: string;
  plan: HotelPlan;
  timezone: string;
  created_at: string;
};

export type Notification = {
  id: string;
  hotel_id: string;
  user_id: string;
  type: "task_assigned" | "urgent" | "completed" | "task_late" | "room_ready" | "issue_reported" | "note_added";
  title: string;
  message: string;
  data?: Record<string, string>;
  is_read: boolean;
  created_at: string;
};
