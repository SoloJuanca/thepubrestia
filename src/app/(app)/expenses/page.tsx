import { format } from "date-fns";
import { requirePermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ExpensesView } from "@/features/expenses/components/ExpensesView";

export default async function ExpensesPage() {
  await requirePermission("expenses", "read");
  const canCreate = await checkPermission("expenses", "create");

  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) {
    return <p className="text-sm text-muted-foreground">Sin sucursal.</p>;
  }

  const [expenses, suppliers] = await Promise.all([
    prisma.expense.findMany({
      where: { locationId: location.id },
      include: { supplier: true },
      orderBy: { expenseDate: "desc" },
      take: 100,
    }),
    prisma.supplier.findMany({
      where: { locationId: location.id, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <ExpensesView
      locationId={location.id}
      canCreate={canCreate}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      expenses={expenses.map((e) => ({
        id: e.id,
        category: e.category,
        concept: e.concept,
        amount: Number(e.amount).toFixed(2),
        expenseDateLabel: format(e.expenseDate, "dd/MM/yyyy"),
        supplierName: e.supplier?.name ?? null,
      }))}
    />
  );
}
