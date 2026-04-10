"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, CalendarDays, User, ConciergeBell } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/mes-taches", label: "Tâches",    Icon: ClipboardList  },
  { href: "/du-jour",    label: "Du jour",   Icon: CalendarDays   },
  { href: "/reception",  label: "Réception", Icon: ConciergeBell  },
  { href: "/profil",     label: "Profil",    Icon: User           },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  if (/^\/mes-taches\/.+/.test(pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-lg mx-auto flex items-stretch">
        {TABS.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href ||
            (href === "/mes-taches" && pathname.startsWith("/mes-taches"));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-3 relative transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <Icon className="w-6 h-6" strokeWidth={1.5} />
              <span className="text-[11px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
