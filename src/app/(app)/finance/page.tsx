import { format } from "date-fns";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { financialService } from "@/services/financial.service";
import { FinanceAdminView } from "@/features/finance/components/FinanceAdminView";

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function FinancePage({ searchParams }: Props) {
  await requirePermission("finance", "read");
  const canExpenses =
    (await checkPermission("expenses", "create")) ||
    (await checkPermission("expenses", "update"));
  const canPayroll =
    (await checkPermission("payroll", "create")) ||
    (await checkPermission("payroll", "update"));

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal.</p>;
  }

  const params = await searchParams;
  const to = params.to
    ? new Date(`${params.to}T23:59:59`)
    : new Date();
  const from = params.from
    ? new Date(`${params.from}T00:00:00`)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [summary, expenses, payroll, employees, suppliers] = await Promise.all([
    financialService.periodReport(location.id, from, to),
    prisma.expense.findMany({
      where: {
        locationId: location.id,
        expenseDate: { gte: from, lte: to },
      },
      include: { supplier: true },
      orderBy: { expenseDate: "desc" },
      take: 50,
    }),
    prisma.payrollEntry.findMany({
      where: { locationId: location.id },
      include: { employee: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.employeeProfile.findMany({
      where: { locationId: location.id, active: true },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.supplier.findMany({
      where: { locationId: location.id, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <FinanceAdminView
      locationId={location.id}
      canExpenses={canExpenses}
      canPayroll={canPayroll}
      periodLabel={`${format(from, "dd/MM/yyyy")} – ${format(to, "dd/MM/yyyy")}`}
      summary={{
        salesTotal: summary.salesTotal.toFixed(2),
        cogs: summary.cogs.toFixed(2),
        grossMargin: summary.grossMargin.toFixed(2),
        expensesTotal: summary.expensesTotal.toFixed(2),
        payrollTotal: summary.payrollTotal.toFixed(2),
        wasteTotal: summary.wasteTotal.toFixed(2),
        operatingMargin: summary.operatingMargin.toFixed(2),
        inventoryValue: summary.inventoryValue.toFixed(2),
        tipsTotal: summary.tipsTotal.toFixed(2),
      }}
      expenses={expenses.map((e) => ({
        id: e.id,
        category: e.category,
        concept: e.concept,
        amount: Number(e.amount).toFixed(2),
        expenseDateLabel: format(e.expenseDate, "dd/MM/yyyy"),
        supplierName: e.supplier?.name ?? null,
      }))}
      payroll={payroll.map((p) => ({
        id: p.id,
        employeeName: p.employee.user.name ?? p.employee.user.email,
        periodLabel: `${format(p.periodStart, "dd/MM")} – ${format(p.periodEnd, "dd/MM")}`,
        totalCost: Number(p.totalCost).toFixed(2),
        status: p.status,
      }))}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.user.name ?? e.user.email,
      }))}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
