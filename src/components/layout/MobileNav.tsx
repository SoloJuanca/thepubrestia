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
  Soup,
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
  Menu,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/permissions";
import { isNavActive } from "@/lib/nav-split";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/pos": UtensilsCrossed,
  "/takeout": ShoppingBag,
  "/comida-empleado": Soup,
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
};

function LinkRow({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const key = item.href.split("?")[0] ?? item.href;
  const Icon = ICONS[key] ?? LayoutDashboard;
  const active = isNavActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--pub-blue)] text-white"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{item.title}</span>
    </Link>
  );
}

export function MobileNav({ primaryItems, moreItems }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 shrink-0 md:hidden"
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[min(100vw-2rem,20rem)] gap-0 bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="border-b border-sidebar-border px-4 py-5">
            <SheetTitle className="text-left text-white">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--pub-blue-light)]">
                The Pub
              </span>
              <span className="mt-1 block text-base font-semibold tracking-tight">
                Game Store Alena Sur
              </span>
            </SheetTitle>
          </SheetHeader>

          <nav
            className="flex-1 space-y-4 overflow-y-auto p-3"
            aria-label="Móvil"
          >
            <div>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                Tu camino
              </p>
              <div className="space-y-0.5">
                {primaryItems.map((item) => (
                  <LinkRow
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
            </div>
            {moreItems.length > 0 ? (
              <div>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                  Más
                </p>
                <div className="space-y-0.5">
                  {moreItems.map((item) => (
                    <LinkRow
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
