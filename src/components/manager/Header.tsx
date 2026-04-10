"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Search, Bell, Moon, Sun, Calendar,
  BedDouble, ClipboardList, CheckCircle, AlertTriangle, Clock, MessageCircle, Zap, X,
} from "lucide-react";
import { Notification } from "@/types";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Vue d'ensemble",
  "/taches":    "Tâches",
  "/chambres":  "Chambres",
  "/equipe":    "Équipe",
};

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;

const TYPE_CONFIG: Record<string, { Icon: IconComponent; iconColor: string; bg: string }> = {
  task_assigned:  { Icon: ClipboardList, iconColor: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-900/30"    },
  urgent:         { Icon: Zap,           iconColor: "text-primary",    bg: "bg-primary/10"                     },
  completed:      { Icon: CheckCircle,   iconColor: "text-green-500",  bg: "bg-green-50 dark:bg-green-900/30"  },
  issue_reported: { Icon: AlertTriangle, iconColor: "text-amber-500",  bg: "bg-amber-50 dark:bg-amber-900/30"  },
  room_ready:     { Icon: BedDouble,     iconColor: "text-sky-500",    bg: "bg-sky-50 dark:bg-sky-900/30"      },
  task_late:      { Icon: Clock,         iconColor: "text-red-500",    bg: "bg-red-50 dark:bg-red-900/30"      },
  note_added:     { Icon: MessageCircle, iconColor: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/30"},
};

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "À l'instant";
  if (mins  < 60) return `${mins} min`;
  if (hours < 24) return `${hours}h`;
  return `${days}j`;
}

export default function Header() {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();

  const [isDark,        setIsDark]        = useState(false);
  const [search,        setSearch]        = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open,          setOpen]          = useState(false);
  const [userId,        setUserId]        = useState("");

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const userIdRef = { current: "" };

    const channel = supabase
      .channel("notifs-manager-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const notif = payload.new as Notification;
        if (userIdRef.current && notif.user_id !== userIdRef.current) return;
        setNotifications((prev) => [notif, ...prev]);
      })
      .subscribe();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;
      setUserId(user.id);
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setNotifications(data as Notification[]);
    }
    load();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0 && userId) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    }
  }

  function handleNotifClick(n: Notification) {
    setOpen(false);
    if (n.data?.task_id) router.push(`/taches/${n.data.task_id}`);
  }

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  const title = PAGE_TITLES[pathname] ?? "Dashboard";
  const date  = new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" });

  return (
    <header className="h-16 px-6 bg-card border-b border-border flex items-center gap-4 sticky top-0 z-20 shrink-0 transition-colors">
      <h1 className="text-lg font-extrabold tracking-tight shrink-0">{title}</h1>

      {/* Search */}
      <div className="flex-1 max-w-xs relative ml-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="pl-9"
        />
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-1">
        {/* Dark mode toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} title={isDark ? "Mode clair" : "Mode sombre"}>
          {isDark
            ? <Sun  className="w-[18px] h-[18px]" strokeWidth={1.5} />
            : <Moon className="w-[18px] h-[18px]" strokeWidth={1.5} />
          }
        </Button>

        {/* Notification bell */}
        <DropdownMenu open={open} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}>
            <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-bold">Notifications</p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </Button>
            </div>
            <Separator />

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
              {notifications.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                    <Bell className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Aucune notification</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.task_assigned;
                  const { Icon } = cfg;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                        !n.is_read ? "bg-primary/5" : ""
                      } ${n.data?.task_id ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${cfg.iconColor}`} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-bold leading-snug ${n.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                        {n.data?.task_id && (
                          <p className="text-[11px] font-semibold text-primary mt-1">Voir la tâche →</p>
                        )}
                      </div>
                      {!n.is_read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date pill */}
        <div className="ml-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-muted-foreground capitalize whitespace-nowrap">{date}</span>
        </div>
      </div>
    </header>
  );
}
