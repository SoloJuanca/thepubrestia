import type { CompensationType, Weekday } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const WEEKDAYS: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export class EmployeeOpsService {
  async upsertSchedule(
    employeeId: string,
    days: Array<{
      weekday: Weekday;
      startTime?: string | null;
      endTime?: string | null;
      isDayOff?: boolean;
    }>,
  ) {
    await prisma.$transaction(
      days.map((d) =>
        prisma.employeeSchedule.upsert({
          where: {
            employeeId_weekday: {
              employeeId,
              weekday: d.weekday,
            },
          },
          create: {
            employeeId,
            weekday: d.weekday,
            startTime: d.isDayOff ? null : d.startTime ?? "09:00",
            endTime: d.isDayOff ? null : d.endTime ?? "17:00",
            isDayOff: Boolean(d.isDayOff),
          },
          update: {
            startTime: d.isDayOff ? null : d.startTime ?? "09:00",
            endTime: d.isDayOff ? null : d.endTime ?? "17:00",
            isDayOff: Boolean(d.isDayOff),
          },
        }),
      ),
    );
  }

  async upsertCompensation(params: {
    employeeId: string;
    type: CompensationType;
    amount: number;
    bonuses?: number;
    tipsNotes?: string | null;
    notes?: string | null;
  }) {
    return prisma.employeeCompensation.upsert({
      where: { employeeId: params.employeeId },
      create: {
        employeeId: params.employeeId,
        type: params.type,
        amount: params.amount,
        bonuses: params.bonuses ?? 0,
        tipsNotes: params.tipsNotes ?? null,
        notes: params.notes ?? null,
      },
      update: {
        type: params.type,
        amount: params.amount,
        bonuses: params.bonuses ?? 0,
        tipsNotes: params.tipsNotes ?? null,
        notes: params.notes ?? null,
      },
    });
  }

  defaultSchedule(): Array<{
    weekday: Weekday;
    startTime: string | null;
    endTime: string | null;
    isDayOff: boolean;
  }> {
    return WEEKDAYS.map((weekday) => ({
      weekday,
      startTime: weekday === "SUNDAY" ? null : "10:00",
      endTime: weekday === "SUNDAY" ? null : "18:00",
      isDayOff: weekday === "SUNDAY",
    }));
  }
}

export const employeeOpsService = new EmployeeOpsService();
export { WEEKDAYS };
