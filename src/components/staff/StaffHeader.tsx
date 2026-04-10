"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

export default function StaffHeader() {
  const pathname = usePathname();
  const supabase = createClient();
  const [unread, setUnread] = useState(0);

  const isDetail = /^\/mes-taches\/.+/.test(pathname);

  useEffect(() => {
    if (isDetail) return;

    async function fetchUnread() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnread(count ?? 0);
    }
    fetchUnread();

    const userIdRef = { current: "" };
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      userIdRef.current = user.id;
    });

    const channel = supabase
      .channel("staff-header-notifs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        if (userIdRef.current && payload.new.user_id !== userIdRef.current) return;
        setUnread((n) => n + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isDetail]);

  if (isDetail) return null;

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center shadow-sm">
      <div className="flex items-center gap-2.5">
        <LogoMark size={30} />
        <span className="text-[15px] font-bold tracking-tight">HotelHive</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        asChild
        className="ml-auto relative"
        onClick={() => setUnread(0)}
      >
        <Link href="/alertes">
          <Bell className="w-5 h-5" strokeWidth={1.5} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </Button>
    </header>
  );
}
