import Link from "next/link";
import { format } from "date-fns";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { financialService } from "@/services/financial.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function ReportsPage({ searchParams }: Props) {
  await requirePermission("reports", "read");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal.</p>;
  }

  const params = await searchParams;
  const to = params.to ? new Date(`${params.to}T23:59:59`) : new Date();
  const from = params.from
    ? new Date(`${params.from}T00:00:00`)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const summary = await financialService.periodReport(location.id, from, to);

  const rows = [
    { label: "Ventas", value: summary.salesTotal },
    { label: "Descuentos", value: summary.discountsTotal },
    { label: "Propinas", value: summary.tipsTotal },
    { label: "COGS (consumo)", value: summary.cogs },
    { label: "Merma", value: summary.wasteTotal },
    { label: "Gastos", value: summary.expensesTotal },
    { label: "Nómina", value: summary.payrollTotal },
    { label: "Margen bruto", value: summary.grossMargin },
    { label: "Margen operativo", value: summary.operatingMargin },
    { label: "Valor inventario", value: summary.inventoryValue },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(from, "dd/MM/yyyy")} – {format(to, "dd/MM/yyyy")} ·{" "}
            {summary.checkCount} cuentas cerradas
          </p>
        </div>
        <Link
          href="/finance"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Ir a finanzas
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Desde</label>
          <input
            type="date"
            name="from"
            defaultValue={format(from, "yyyy-MM-dd")}
            className="flex h-10 rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Hasta</label>
          <input
            type="date"
            name="to"
            defaultValue={format(to, "yyyy-MM-dd")}
            className="flex h-10 rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className={cn(buttonVariants({ size: "default" }))}
        >
          Filtrar
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.label}>
            <CardHeader className="pb-2">
              <CardDescription>{r.label}</CardDescription>
              <CardTitle className="text-xl">${r.value.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gastos por categoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {summary.expensesByCategory.length === 0 ? (
            <p className="text-muted-foreground">Sin gastos en el periodo.</p>
          ) : (
            summary.expensesByCategory.map((c) => (
              <div key={c.category} className="flex justify-between">
                <span>{c.category}</span>
                <span>${c.amount.toFixed(2)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
