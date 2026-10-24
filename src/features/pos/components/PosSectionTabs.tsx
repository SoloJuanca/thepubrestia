import Link from "next/link";
import { cn } from "@/lib/utils";

type Section = "mesas" | "individuales";

const TABS: Array<{ id: Section; href: string; label: string }> = [
  { id: "mesas", href: "/pos", label: "Mesas" },
  { id: "individuales", href: "/takeout", label: "Individuales" },
];

export function PosSectionTabs({ current }: { current: Section }) {
  return (
    <div
      role="tablist"
      aria-label="Pedidos"
      className="inline-flex rounded-lg bg-muted p-1"
    >
      {TABS.map((tab) => {
        const selected = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={selected}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              selected
                ? "bg-[var(--pub-blue)] text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
