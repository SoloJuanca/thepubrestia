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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/permissions";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/pos": UtensilsCrossed,
  "/orders": ClipboardList,
  "/kitchen": CookingPot,
  "/menu": BookOpen,
  "/inventory": Package,
  "/purchases": ShoppingCart,
  "/suppliers": Truck,
  "/customers": Users,
  "/promotions": BadgePercent,
  "/reviews": Star,
  "/employees": UserCog,
  "/finance": Wallet,
  "/reports": BarChart3,
  "/settings": Settings,
};

type Props = {
  items: NavItem[];
};

export function AppSidebar({ items }: Props) {
  const pathname = usePathname();

  return (
    <aside className="flex h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Management
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">
          The Pub GameStore
        </h1>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Principal">
        {items.map((item) => {
          const Icon = ICONS[item.href] ?? LayoutDashboard;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
