import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PERSONA_LABELS,
  type HubPath,
  type RolePersona,
} from "@/lib/role-home";

export type HomeMetric = { title: string; value: string };
export type HomeAttention = { text: string; href: string };

type Props = {
  persona: RolePersona;
  locationName: string;
  paths: HubPath[];
  metrics: HomeMetric[];
  attention: HomeAttention[];
};

export function RoleHomeView({
  persona,
  locationName,
  paths,
  metrics,
  attention,
}: Props) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {PERSONA_LABELS[persona]}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          ¿Qué vas a hacer?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {locationName} · elige un camino
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {paths.map((path) => (
          <Link
            key={path.href + path.title}
            href={path.href}
            className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-[var(--pub-blue)]/50 hover:bg-accent/40"
          >
            <h2 className="text-lg font-semibold tracking-tight group-hover:text-[var(--pub-blue-dark)]">
              {path.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {path.description}
            </p>
            <span
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4 pointer-events-none",
              )}
            >
              Ir
            </span>
          </Link>
        ))}
      </section>

      {metrics.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Hoy
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {metrics.map((m) => (
              <Card key={m.title}>
                <CardHeader className="pb-2">
                  <CardDescription>{m.title}</CardDescription>
                  <CardTitle className="text-2xl">{m.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {attention.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Necesita atención
          </h2>
          <div className="space-y-2">
            {attention.map((a) => (
              <Link
                key={a.href + a.text}
                href={a.href}
                className="flex items-center justify-between rounded-xl border border-[var(--warning)]/40 bg-surface px-4 py-3 text-sm hover:bg-surface-secondary"
              >
                <span>{a.text}</span>
                <Badge variant="secondary">Ver</Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : metrics.length > 0 || paths.length > 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Nada urgente por ahora. Usa un camino de arriba.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
