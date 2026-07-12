"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users,
  Theater,
  CalendarDays,
  CalendarRange,
  Settings,
  Clapperboard,
  User,
  ShieldQuestion,
} from "lucide-react";

const navItems = [
  {
    title: "Tableau de bord",
    href: "/",
    icon: Clapperboard,
  },
  {
    title: "Cascadeurs",
    href: "/cascadeurs",
    icon: Users,
  },
  {
    title: "Spectacles",
    href: "/spectacles",
    icon: Theater,
  },
  {
    title: "Saisons",
    href: "/saisons",
    icon: CalendarRange,
  },
  {
    title: "Rôles",
    href: "/roles",
    icon: ShieldQuestion,
  },
  {
    title: "Planning",
    href: "/planning",
    icon: CalendarDays,
  },
  {
    title: "Vue Cascadeur",
    href: "/cascadeur-view",
    icon: User,
  },
  {
    title: "Paramètres",
    href: "/parametres",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <Clapperboard className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold tracking-tight">Kyncal</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t px-6 py-4">
        <p className="text-xs text-muted-foreground">
          Kyncal v1.0 — Gestion de plannings
        </p>
      </div>
    </aside>
  );
}
