"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Role } from "@/lib/api-types";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const BASE_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "Cases", icon: BookOpen },
];

/**
 * Role-aware navigation: parents browse the tutor directory; tutors manage their
 * own profile. With no role (e.g. isolated tests) both links are shown.
 */
function navFor(role?: Role): NavItem[] {
  const items = [...BASE_NAV];
  if (role !== "TUTOR") {
    items.push({ href: "/tutors", label: "Tutors", icon: Users });
  }
  if (role === "TUTOR" || role === undefined) {
    items.push({ href: "/profile", label: "Profile", icon: UserRound });
  }
  return items;
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => (
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

function UserFooter({ email, onLogout }: { email?: string; onLogout?: () => void }) {
  if (!email && !onLogout) {
    return null;
  }
  return (
    <div className="mt-auto flex flex-col gap-2 border-t pt-4">
      {email && <span className="truncate px-3 text-muted-foreground text-xs">{email}</span>}
      {onLogout && (
        <Button variant="ghost" size="sm" className="justify-start gap-3" onClick={onLogout}>
          <LogOut className="h-4 w-4 shrink-0" />
          Log out
        </Button>
      )}
    </div>
  );
}

export function DashboardShell({
  children,
  userRole,
  email,
  onLogout,
}: {
  children: React.ReactNode;
  userRole?: Role;
  email?: string;
  onLogout?: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navFor(userRole);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — hidden below 768px */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-background p-4 shrink-0">
        <SidebarBrand />
        <NavLinks items={items} />
        <UserFooter email={email} onLogout={onLogout} />
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
              <div className="flex min-h-[60vh] flex-col">
                <NavLinks items={items} onNavigate={() => setMobileOpen(false)} />
                <UserFooter email={email} onLogout={onLogout} />
              </div>
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
