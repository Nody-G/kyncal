"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Link from "next/link";
import { Clapperboard } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b px-4 py-3 md:px-6 bg-card">
      {/* Mobile logo + hamburger */}
      <div className="flex items-center gap-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Clapperboard className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">Kyncal</span>
        </Link>
      </div>

      <div className="hidden md:block" />

      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
