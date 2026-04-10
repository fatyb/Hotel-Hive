"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Notification } from "@/types";
import {
  ClipboardList, Zap, CheckCircle, AlertTriangle, BedDouble, Clock, MessageCircle, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;
type TypeConfig = { Icon: IconComponent; iconBg: string; iconColor: string; linkColor: string };

const TYPE_CONFIG: Record<string, TypeConfig> = {
  task_assigned:  { Icon: ClipboardList, iconBg: "bg-blue-50",       iconColor: "text-blue-500",   linkColor: "text-blue-600"   },
  urgent:         { Icon: Zap,           iconBg: "bg-primary/10",    iconColor: "text-primary",    linkColor: "text-primary"    },
  completed:      { Icon: CheckCircle,   iconBg: "bg-green-50",      iconColor: "text-green-500",  linkColor: "text-green-600"  },
  issue_reported: { Icon: AlertTriangle, iconBg: "bg-amber-50",      iconColor: "text-amber-500",  linkColor: "text-amber-600"  },
  room_ready:     { Icon: BedDouble,     iconBg: "bg-sky-50",        iconColor: "text-sky-500",    linkColor: "text-sky-600"    },
  task_late:      { Icon: Clock,         iconBg: "bg-destructive/10",iconColor: "text-destructive",linkColor: "text-destructive"},
  note_added:     { Icon: MessageCircle, iconBg: "bg-purple-50",     iconColor: "text-purple-500", linkColor: "text-purple-600" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "À l'instant";
  if (mins  < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
}

function groupByDay(notifications: Notification[]) {
  const groups: Record<string, Notification[]> = {};
  const now       = new Date();
  const today     = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  for (const n of notifications) {
    const d   = new Date(n.created_at).toDateString();
    const key = d === today ? "Aujourd'hui" : d === yesterday ? "Hier" : "Plus tôt";
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  }
  return groups;
}

export default function AlertesPage() {
  const supabase = createClient();
  const router   = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("notifications")
        .select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      if (data) setNotifications(data);
      setLoading(false);
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    }
    load();
  }, []);

  async function handleClick(n: Notification) {
    if (n.data?.task_id) router.push(`/mes-taches/${n.data.task_id}`);
  }

  const groups = groupByDay(notifications);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-lg mx-auto px-4 pb-4">
      <header className="pt-6 pb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">Alertes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {unreadCount > 0 ? `${unreadCount} non lue(s)` : "Tout est à jour"}
        </p>
      </header>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Bell className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">Aucune alerte</p>
          <p className="text-xs text-muted-foreground mt-1">Vous êtes à jour !</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(groups).map(([day, items]) => (
            <div key={day}>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">{day}</p>
              <div className="flex flex-col gap-2">
                {items.map((n) => {
                  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.task_assigned;
                  const { Icon } = cfg;
                  return (
                    <Card
                      key={n.id}
                      className={cn(
                        "cursor-pointer transition-all active:scale-[.99]",
                        n.is_read ? "opacity-70" : "border-primary/20 shadow-sm"
                      )}
                      onClick={() => handleClick(n)}
                    >
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", cfg.iconBg)}>
                          <Icon className={cn("w-5 h-5", cfg.iconColor)} strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-sm font-bold leading-snug", n.is_read ? "text-muted-foreground" : "")}>
                              {n.title}
                            </p>
                            <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                          {n.data?.task_id && (
                            <p className={cn("text-[11px] font-semibold mt-1.5", cfg.linkColor)}>Voir la tâche →</p>
                          )}
                        </div>
                        {!n.is_read && (
                          <Badge className="w-2 h-2 p-0 rounded-full shrink-0 mt-1 bg-primary border-0" />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
