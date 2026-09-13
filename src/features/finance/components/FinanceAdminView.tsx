"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createExpenseAction,
  createPayrollAction,
  deleteExpenseAction,
  setPayrollStatusAction,
} from "@/features/finance/actions";

export type ExpenseRow = {
  id: string;
  category: string;
  concept: string;
  amount: string;
  expenseDateLabel: string;
  supplierName: string | null;
};

export type PayrollRow = {
  id: string;
  employeeName: string;
  periodLabel: string;
  totalCost: string;
  status: string;
};

export type FinanceSummary = {
  salesTotal: string;
  cogs: string;
  grossMargin: string;
  expensesTotal: string;
  payrollTotal: string;
  wasteTotal: string;
  operatingMargin: string;
  inventoryValue: string;
  tipsTotal: string;
};

type Props = {
  locationId: string;
  canExpenses: boolean;
  canPayroll: boolean;
  summary: FinanceSummary;
  expenses: ExpenseRow[];
  payroll: PayrollRow[];
  employees: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  periodLabel: string;
};

export function FinanceAdminView({
  locationId,
  canExpenses,
  canPayroll,
  summary,
  expenses,
  payroll,
  employees,
  suppliers,
  periodLabel,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [expense, setExpense] = useState({
    category: "Renta",
    concept: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    supplierId: "",
  });
  const [pay, setPay] = useState({
    employeeId: employees[0]?.id ?? "",
    periodStart: new Date().toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
    baseSalary: "",
    bonuses: "0",
    deductions: "0",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          COGS, gastos, nómina y márgenes · {periodLabel}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Ventas" value={`$${summary.salesTotal}`} />
        <Metric label="COGS" value={`$${summary.cogs}`} />
        <Metric label="Margen bruto" value={`$${summary.grossMargin}`} />
        <Metric label="Margen operativo" value={`$${summary.operatingMargin}`} />
        <Metric label="Gastos" value={`$${summary.expensesTotal}`} />
        <Metric label="Nómina" value={`$${summary.payrollTotal}`} />
        <Metric label="Merma" value={`$${summary.wasteTotal}`} />
        <Metric label="Inventario $" value={`$${summary.inventoryValue}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canExpenses ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Categoría</Label>
                  <Input
                    value={expense.category}
                    onChange={(e) =>
                      setExpense((f) => ({ ...f, category: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    value={expense.amount}
                    onChange={(e) =>
                      setExpense((f) => ({ ...f, amount: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Concepto</Label>
                  <Input
                    value={expense.concept}
                    onChange={(e) =>
                      setExpense((f) => ({ ...f, concept: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={expense.expenseDate}
                    onChange={(e) =>
                      setExpense((f) => ({
                        ...f,
                        expenseDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Proveedor</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={expense.supplierId}
                    onChange={(e) =>
                      setExpense((f) => ({
                        ...f,
                        supplierId: e.target.value,
                      }))
                    }
                  >
                    <option value="">—</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  className="sm:col-span-2"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await createExpenseAction({
                        locationId,
                        category: expense.category,
                        concept: expense.concept,
                        amount: Number(expense.amount) || 0,
                        expenseDate: expense.expenseDate,
                        supplierId: expense.supplierId || null,
                        recurrence: "NONE",
                      });
                      if (!result.ok) toast.error(result.error);
                      else {
                        toast.success(result.message);
                        setExpense((f) => ({
                          ...f,
                          concept: "",
                          amount: "",
                        }));
                      }
                    })
                  }
                >
                  Registrar gasto
                </Button>
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.concept}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.category} · {e.expenseDateLabel}
                      </div>
                    </TableCell>
                    <TableCell>${e.amount}</TableCell>
                    <TableCell>
                      {canExpenses ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await deleteExpenseAction({
                                id: e.id,
                              });
                              if (!result.ok) toast.error(result.error);
                              else toast.success(result.message);
                            })
                          }
                        >
                          Borrar
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nómina (costo)</CardTitle>
            <CardDescription>No es nómina fiscal completa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canPayroll ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Empleado</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={pay.employeeId}
                    onChange={(e) =>
                      setPay((f) => ({ ...f, employeeId: e.target.value }))
                    }
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Inicio</Label>
                  <Input
                    type="date"
                    value={pay.periodStart}
                    onChange={(e) =>
                      setPay((f) => ({ ...f, periodStart: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fin</Label>
                  <Input
                    type="date"
                    value={pay.periodEnd}
                    onChange={(e) =>
                      setPay((f) => ({ ...f, periodEnd: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Base</Label>
                  <Input
                    type="number"
                    value={pay.baseSalary}
                    onChange={(e) =>
                      setPay((f) => ({ ...f, baseSalary: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Bonos</Label>
                  <Input
                    type="number"
                    value={pay.bonuses}
                    onChange={(e) =>
                      setPay((f) => ({ ...f, bonuses: e.target.value }))
                    }
                  />
                </div>
                <Button
                  className="sm:col-span-2"
                  disabled={pending || !pay.employeeId}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await createPayrollAction({
                        locationId,
                        employeeId: pay.employeeId,
                        periodStart: pay.periodStart,
                        periodEnd: pay.periodEnd,
                        baseSalary: Number(pay.baseSalary) || 0,
                        bonuses: Number(pay.bonuses) || 0,
                        deductions: Number(pay.deductions) || 0,
                      });
                      if (!result.ok) toast.error(result.error);
                      else toast.success(result.message);
                    })
                  }
                >
                  Crear borrador
                </Button>
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payroll.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.employeeName}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.periodLabel}
                      </div>
                    </TableCell>
                    <TableCell>${p.totalCost}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{p.status}</Badge>
                        {canPayroll && p.status === "DRAFT" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                const result = await setPayrollStatusAction({
                                  id: p.id,
                                  status: "APPROVED",
                                });
                                if (!result.ok) toast.error(result.error);
                                else toast.success(result.message);
                              })
                            }
                          >
                            Aprobar
                          </Button>
                        ) : null}
                        {canPayroll && p.status === "APPROVED" ? (
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                const result = await setPayrollStatusAction({
                                  id: p.id,
                                  status: "PAID",
                                });
                                if (!result.ok) toast.error(result.error);
                                else toast.success(result.message);
                              })
                            }
                          >
                            Marcar pagada
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
