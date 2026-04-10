"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ClipboardList, BedDouble, Users, BarChart3, LogOut } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/taches",    label: "Tâches",          icon: ClipboardList  },
  { href: "/chambres",  label: "Chambres",         icon: BedDouble      },
  { href: "/equipe",    label: "Équipe",           icon: Users          },
  { href: "/rapports",  label: "Rapports",         icon: BarChart3      },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();

  const [userName,  setUserName]  = useState("");
  const [hotelName, setHotelName] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, hotels(name)")
        .eq("id", user.id)
        .single();
      if (data) {
        setUserName(data.full_name);
        setHotelName((data as { hotels?: { name: string } }).hotels?.name ?? "");
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = userName.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside className="w-60 bg-card border-r border-border flex flex-col min-h-screen shrink-0 transition-colors">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <Logo width={130} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 font-semibold",
                  isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                )}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
                {label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User info + logout */}
      <div className="px-3 py-4 flex flex-col gap-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{hotelName}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-muted-foreground"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          Déconnexion
        </Button>
      </div>
    </aside>
  );
}
