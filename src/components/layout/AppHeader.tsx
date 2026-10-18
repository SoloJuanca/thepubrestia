"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/features/auth/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/MobileNav";
import type { NavItem } from "@/lib/permissions";
import { titleForPathname } from "@/lib/route-title";
import { cn } from "@/lib/utils";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  roles?: string[];
  primaryItems?: NavItem[];
  moreItems?: NavItem[];
};

export function AppHeader({
  userName,
  userEmail,
  roles,
  primaryItems = [],
  moreItems = [],
}: Props) {
  const pathname = usePathname();
  const title = titleForPathname(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNav primaryItems={primaryItems} moreItems={moreItems} />
        <h2 className="truncate text-base font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-none">
            {userName ?? userEmail}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(roles ?? []).join(" · ") || "Empleado"}
          </p>
        </div>
        <Link
          href="/account"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Mi cuenta
        </Link>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Salir
          </Button>
        </form>
      </div>
    </header>
  );
}
