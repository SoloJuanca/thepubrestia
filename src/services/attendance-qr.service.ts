import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export class AttendanceQrService {
  async getActiveToken(locationId: string) {
    const now = new Date();
    const existing = await prisma.attendanceQrToken.findFirst({
      where: {
        locationId,
        active: true,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
    return existing;
  }

  /** Ensure an active token exists; rotate if missing/expired. */
  async ensureActiveToken(locationId: string) {
    const current = await this.getActiveToken(locationId);
    if (current) return current;
    return this.rotateToken(locationId);
  }

  async rotateToken(locationId: string) {
    await prisma.attendanceQrToken.updateMany({
      where: { locationId, active: true },
      data: { active: false },
    });

    return prisma.attendanceQrToken.create({
      data: {
        locationId,
        token: randomBytes(24).toString("base64url"),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        active: true,
      },
    });
  }

  async validateToken(token: string, locationId?: string) {
    const row = await prisma.attendanceQrToken.findUnique({
      where: { token },
    });
    if (!row || !row.active) {
      throw new Error("Código QR inválido o desactivado.");
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new Error("El código QR expiró. Pide uno nuevo en el local.");
    }
    if (locationId && row.locationId !== locationId) {
      throw new Error("El QR no corresponde a tu sucursal.");
    }
    return row;
  }
}

export const attendanceQrService = new AttendanceQrService();
