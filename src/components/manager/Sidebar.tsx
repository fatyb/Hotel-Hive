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
import { LayoutDashboard, ClipboardList, BedDouble, Users, BarChart3, Settings, LogOut, RefreshCcw, ConciergeBell } from "lucide-react";

const NAV = [
  { href: "/dashboard",    label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/taches",       label: "Tâches",          icon: ClipboardList  },
  { href: "/chambres",     label: "Chambres",         icon: BedDouble      },
  { href: "/equipe",       label: "Équipe",           icon: Users          },
  { href: "/templates",    label: "Templates",        icon: RefreshCcw     },
  { href: "/rapports",     label: "Rapports",         icon: BarChart3      },
  { href: "/hotel",        label: "Mon hôtel",        icon: Settings       },
];

const NAV_EXTERNAL = [
  { href: "/front-office", label: "Front Office",    icon: ConciergeBell  },
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
        setHotelName(((data as unknown) as { hotels?: { name: string } }).hotels?.name ?? "");
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
    <aside className="w-60 flex flex-col min-h-screen shrink-0" style={{ background: "#222222" }}>
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Logo width={130} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href}>
              <span className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                isActive
                  ? "bg-[#A4F5A6] text-[#222222]"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              )}>
                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Front Office link */}
      <div className="px-3 pb-2">
        <div className="mb-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: "8px", paddingTop: "8px" }} />
        {NAV_EXTERNAL.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <span className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-[#A4F5A6] hover:bg-[#A4F5A6]/10 transition-all cursor-pointer">
              <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
              {label}
            </span>
          </Link>
        ))}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />

      {/* User info + logout */}
      <div className="px-3 py-4 flex flex-col gap-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-[#A4F5A6] text-[#222222] text-[11px] font-bold">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-xs text-white/40 truncate">{hotelName}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/8 transition-all w-full text-left"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
