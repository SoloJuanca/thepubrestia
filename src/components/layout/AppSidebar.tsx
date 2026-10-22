"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
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
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/permissions";
import { isNavActive } from "@/lib/nav-split";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/pos": UtensilsCrossed,
  "/takeout": ShoppingBag,
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
  "/attendance/station": Clock3,
  "/services": Wrench,
  "/expenses": Receipt,
  "/finance": Wallet,
  "/reports": BarChart3,
  "/settings": Settings,
};

type Props = {
  primaryItems: NavItem[];
  moreItems: NavItem[];
  collapsed?: boolean;
};

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
}) {
  const key = item.href.split("?")[0] ?? item.href;
  const Icon = ICONS[key] ?? LayoutDashboard;
  const active = isNavActive(pathname, item.href);
  return (
    <Link
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
}

export function AppSidebar({
  primaryItems,
  moreItems,
  collapsed = false,
}: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(() =>
    moreItems.some((item) => isNavActive(pathname, item.href)),
  );

  return (
    <aside
      className={cn(
        "app-sidebar-desktop h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        collapsed && "w-[4.5rem]",
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-5">
        {!collapsed ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--pub-blue-light)]">
              The Pub
            </p>
            <h1 className="mt-1 text-base font-semibold tracking-tight text-white">
              Game Store Alena Sur
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
        <div>
          {!collapsed ? (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
              Tu camino
            </p>
          ) : null}
          <div className="space-y-0.5">
            {primaryItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>

        {moreItems.length > 0 ? (
          <div>
            {!collapsed ? (
              <button
                type="button"
                className="mb-1 flex w-full cursor-pointer items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45 hover:text-sidebar-foreground/70"
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
              >
                Más
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform",
                    moreOpen && "rotate-180",
                  )}
                />
              </button>
            ) : null}
            {(collapsed || moreOpen) && (
              <div className="space-y-0.5">
                {moreItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
