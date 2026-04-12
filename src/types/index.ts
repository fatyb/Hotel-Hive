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
  created_at?: string;
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
  room_type_id?: string;
};

export type ShiftType = "matin" | "apres-midi" | "nuit" | "repos";

export type UserProfile = {
  id: string;
  hotel_id: string;
  full_name: string;
  email?: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  push_token?: string;
  phone_number?: string;
  assigned_floors?: string;  // comma-separated e.g. "1,2,3"
  shift_type?: ShiftType;
  working_hours?: string;
  pin_code?: string;
};

export type Hotel = {
  id: string;
  name: string;
  slug: string;
  plan: HotelPlan;
  timezone: string;
  created_at: string;
};

export type OrderStatus = "en_attente" | "en_cours" | "livree" | "annulee";

export type RoomOrder = {
  id: string;
  hotel_id: string;
  room_id?: string;
  room_number: string;
  title: string;
  notes: string;
  status: OrderStatus;
  priority: "normale" | "urgente";
  created_at: string;
  updated_at: string;
};

export type TaskTemplate = {
  id: string;
  hotel_id: string;
  title: string;
  description: string;
  department: Department;
  type: TaskType;
  priority: TaskPriority;
  assigned_role: UserRole;
  checklist: ChecklistItem[];
  days_of_week: number[]; // 0=Sun … 6=Sat
  time_of_day: string;    // "HH:MM"
  is_active: boolean;
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

export type RoomType = {
  id: string;
  hotel_id: string;
  name: string;
  icon: string;
  description?: string;
  capacity: number;
  base_price: number;
  amenities: string[];
  created_at: string;
};

export type HotelFull = Hotel & {
  address?: string;
  phone?: string;
  website?: string;
  currency: string;
  checkin_time: string;
  checkout_time: string;
  vat_rate: number;
  tourism_tax: number;
  extra_bed_price: number;
  cancellation_hours: number;
  logo_url?: string;
  brand_color: string;
  social_instagram?: string;
  social_facebook?: string;
};

export type HotelFacility = {
  id: string;
  hotel_id: string;
  name: string;
  icon: string;
  is_available: boolean;
};
