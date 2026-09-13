"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  CookingPot,
  BookOpen,
  Package,
  ShoppingCart,
  Truck,
  Users,
  BadgePercent,
  Star,
  UserCog,
  Wallet,
  BarChart3,
  Settings,
  CalendarCheck2,
  Clock3,
  Wrench,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type NavItem } from "@/lib/permissions";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/pos": UtensilsCrossed,
  "/orders": ClipboardList,
  "/kitchen": CookingPot,
  "/daily-close": CalendarCheck2,
  "/menu": BookOpen,
  "/inventory": Package,
  "/purchases": ShoppingCart,
  "/suppliers": Truck,
  "/customers": Users,
  "/promotions": BadgePercent,
  "/reviews": Star,
  "/employees": UserCog,
  "/attendance": Clock3,
  "/services": Wrench,
  "/expenses": Receipt,
  "/finance": Wallet,
  "/reports": BarChart3,
  "/settings": Settings,
};

type Props = {
  items: NavItem[];
  collapsed?: boolean;
};

export function AppSidebar({ items, collapsed = false }: Props) {
  const pathname = usePathname();

  const grouped = NAV_GROUPS.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <aside
      className={cn(
        "flex h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width]",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-5">
        {!collapsed ? (
          <>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--pub-blue-light)]"
              style={{ fontFamily: "var(--font-orbitron), var(--font-sans)" }}
            >
              The Pub
            </p>
            <h1 className="mt-1 text-base font-semibold tracking-tight text-white">
              GameStore
            </h1>
          </>
        ) : (
          <p className="text-center text-sm font-bold text-[var(--pub-blue-light)]">
            TP
          </p>
        )}
      </div>
      <nav
        className="flex-1 space-y-4 overflow-y-auto p-3"
        aria-label="Principal"
      >
        {grouped.map(({ group, items: groupItems }) => (
          <div key={group}>
            {!collapsed ? (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                {group}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {groupItems.map((item) => {
                const Icon = ICONS[item.href] ?? LayoutDashboard;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                      collapsed && "justify-center px-2",
                      active
                        ? "bg-[var(--pub-blue)] text-white"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                    {!collapsed ? <span>{item.title}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
