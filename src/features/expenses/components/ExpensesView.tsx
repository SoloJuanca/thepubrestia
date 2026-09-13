"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { createExpenseAction } from "@/features/finance/actions";

export type ExpenseListRow = {
  id: string;
  category: string;
  concept: string;
  amount: string;
  expenseDateLabel: string;
  supplierName: string | null;
};

type Props = {
  locationId: string;
  canCreate: boolean;
  expenses: ExpenseListRow[];
  suppliers: Array<{ id: string; name: string }>;
};

export function ExpensesView({
  locationId,
  canCreate,
  expenses,
  suppliers,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    category: "Operación",
    concept: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    supplierId: "",
    notes: "",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gastos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro y consulta de egresos de la sucursal.
        </p>
      </div>

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar gasto</CardTitle>
            <CardDescription>
              Quedará disponible también en Finanzas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Monto</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Concepto</Label>
                <Input
                  value={form.concept}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, concept: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expenseDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Proveedor</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={form.supplierId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, supplierId: e.target.value }))
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
              <div className="space-y-1 sm:col-span-2">
                <Label>Notas</Label>
                <Input
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
              <Button
                className="sm:col-span-2"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await createExpenseAction({
                      locationId,
                      category: form.category,
                      concept: form.concept,
                      amount: Number(form.amount) || 0,
                      expenseDate: form.expenseDate,
                      supplierId: form.supplierId || null,
                      recurrence: "NONE",
                      notes: form.notes || null,
                    });
                    if (!result.ok) toast.error(result.error);
                    else {
                      toast.success(result.message);
                      setForm((f) => ({
                        ...f,
                        concept: "",
                        amount: "",
                        notes: "",
                      }));
                    }
                  })
                }
              >
                Guardar gasto
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin gastos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.concept}</div>
                      {e.supplierName ? (
                        <div className="text-xs text-muted-foreground">
                          {e.supplierName}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell>{e.expenseDateLabel}</TableCell>
                    <TableCell className="text-right">${e.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
