"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission, AuthorizationError } from "@/lib/rbac";
import { roundMoney } from "@/services/pricing.service";
import {
  createExpenseSchema,
  createPayrollSchema,
  deleteExpenseSchema,
  setPayrollStatusSchema,
  updateExpenseSchema,
} from "@/validations/crm-finance";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/expenses");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

function emptyToNull(v?: string | null) {
  if (v == null || v === "") return null;
  return v;
}

export async function createExpenseAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("expenses", "create");
    const data = createExpenseSchema.parse(raw);
    const expense = await prisma.expense.create({
      data: {
        locationId: data.locationId,
        category: data.category.trim(),
        concept: data.concept.trim(),
        amount: data.amount,
        expenseDate: new Date(data.expenseDate),
        supplierId: emptyToNull(data.supplierId),
        recurrence: data.recurrence,
        notes: emptyToNull(data.notes),
        receiptUrl: emptyToNull(data.receiptUrl),
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EXPENSE_CREATE",
        entity: "Expense",
        entityId: expense.id,
        after: { amount: data.amount, category: data.category },
      },
    });
    revalidateFinance();
    return { ok: true, message: "Gasto registrado.", id: expense.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear el gasto.",
    };
  }
}

export async function updateExpenseAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("expenses", "update");
    const data = updateExpenseSchema.parse(raw);
    const existing = await prisma.expense.findUnique({ where: { id: data.id } });
    if (!existing) return { ok: false, error: "Gasto no encontrado." };
    const updated = await prisma.expense.update({
      where: { id: data.id },
      data: {
        category: data.category?.trim(),
        concept: data.concept?.trim(),
        amount: data.amount,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
        supplierId:
          data.supplierId === undefined
            ? undefined
            : emptyToNull(data.supplierId),
        recurrence: data.recurrence,
        notes: data.notes === undefined ? undefined : emptyToNull(data.notes),
        receiptUrl:
          data.receiptUrl === undefined
            ? undefined
            : emptyToNull(data.receiptUrl),
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EXPENSE_UPDATE",
        entity: "Expense",
        entityId: updated.id,
        before: { amount: Number(existing.amount) },
        after: { amount: Number(updated.amount) },
      },
    });
    revalidateFinance();
    return { ok: true, message: "Gasto actualizado." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}

export async function deleteExpenseAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("expenses", "delete");
    const data = deleteExpenseSchema.parse(raw);
    await prisma.expense.delete({ where: { id: data.id } });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EXPENSE_DELETE",
        entity: "Expense",
        entityId: data.id,
      },
    });
    revalidateFinance();
    return { ok: true, message: "Gasto eliminado." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar.",
    };
  }
}

export async function createPayrollAction(raw: unknown): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("payroll", "create");
    const data = createPayrollSchema.parse(raw);
    const totalCost = roundMoney(
      data.baseSalary + (data.bonuses ?? 0) - (data.deductions ?? 0),
    );
    const entry = await prisma.payrollEntry.create({
      data: {
        locationId: data.locationId,
        employeeId: data.employeeId,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        baseSalary: data.baseSalary,
        hours: data.hours ?? null,
        bonuses: data.bonuses ?? 0,
        deductions: data.deductions ?? 0,
        totalCost,
        notes: emptyToNull(data.notes),
        status: "DRAFT",
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PAYROLL_CREATE",
        entity: "PayrollEntry",
        entityId: entry.id,
        after: { totalCost },
      },
    });
    revalidateFinance();
    return { ok: true, message: "Nómina registrada.", id: entry.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear nómina.",
    };
  }
}

export async function setPayrollStatusAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const { user } = await assertPermission("payroll", "update");
    const data = setPayrollStatusSchema.parse(raw);
    const existing = await prisma.payrollEntry.findUnique({
      where: { id: data.id },
    });
    if (!existing) return { ok: false, error: "Registro no encontrado." };

    const updated = await prisma.payrollEntry.update({
      where: { id: data.id },
      data: {
        status: data.status,
        paidAt: data.status === "PAID" ? new Date() : existing.paidAt,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PAYROLL_STATUS",
        entity: "PayrollEntry",
        entityId: updated.id,
        before: { status: existing.status },
        after: { status: updated.status },
      },
    });
    revalidateFinance();
    return { ok: true, message: `Estado: ${data.status}.` };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar.",
    };
  }
}
