"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BookOpen, GraduationCap, LayoutDashboard, Menu, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "Cases", icon: BookOpen },
  { href: "/tutors", label: "Tutors", icon: Users },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 mb-4">
      <GraduationCap className="h-6 w-6 text-primary" />
      <span className="font-semibold text-base">Tuition</span>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — hidden below 768px */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-background p-4 shrink-0">
        <SidebarBrand />
        <NavLinks />
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Mobile topbar — visible below 768px */}
        <header className="flex md:hidden items-center gap-3 border-b px-4 py-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation menu"
                data-testid="mobile-menu-trigger"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader className="mb-4">
                <SheetTitle>
                  <SidebarBrand />
                </SheetTitle>
              </SheetHeader>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-sm">Tuition</span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
