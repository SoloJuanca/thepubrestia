import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RoleCode } from "@prisma/client";
import { employeeOpsService } from "../src/services/employee-ops.service";

/**
 * Personal operativo The Pub Alena Sur.
 * Contraseña temporal inicial (cámbiala en Mi cuenta):
 *   ThePub2026!
 */

const prisma = new PrismaClient();

const TEMP_PASSWORD = "ThePub2026!";

const STAFF: Array<{
  email: string;
  name: string;
  role: RoleCode;
  jobTitle: string;
}> = [
  {
    email: "mer@thepubalenasur.com.mx",
    name: "Mer",
    role: "WAITER",
    jobTitle: "Mesera",
  },
  {
    email: "gabo@thepubalenasur.com.mx",
    name: "Gabo",
    role: "KITCHEN_ASSISTANT",
    jobTitle: "Auxiliar de cocina",
  },
  {
    email: "lazaro@thepubalenasur.com.mx",
    name: "Lázaro",
    role: "KITCHEN_COOK",
    jobTitle: "Cocinero",
  },
  {
    email: "juan@thepubalenasur.com.mx",
    name: "Juan",
    role: "ADMIN",
    jobTitle: "Administrador",
  },
  {
    email: "cesar@thepubalenasur.com.mx",
    name: "César",
    role: "ADMIN",
    jobTitle: "Administrador",
  },
  {
    email: "cocina@thepubalenasur.com.mx",
    name: "Cocina",
    role: "KITCHEN_LEAD",
    jobTitle: "Tablet de cocina",
  },
];

async function main() {
  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) throw new Error("No hay sucursal activa. Ejecuta db:seed primero.");

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);
  let created = 0;
  let updated = 0;

  for (const person of STAFF) {
    const role = await prisma.role.findUnique({ where: { code: person.role } });
    if (!role) {
      throw new Error(
        `Rol ${person.role} no existe. Ejecuta db:seed para sincronizar roles.`,
      );
    }

    const email = person.email.toLowerCase();
    let user = await prisma.user.findUnique({
      where: { email },
      include: { employeeProfile: true, roles: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: person.name,
          passwordHash,
          type: "EMPLOYEE",
          active: true,
          emailVerified: new Date(),
          roles: { create: { roleId: role.id } },
          employeeProfile: {
            create: {
              locationId: location.id,
              jobTitle: person.jobTitle,
              hireDate: new Date(),
              active: true,
            },
          },
        },
        include: { employeeProfile: true, roles: true },
      });
      await employeeOpsService.upsertSchedule(
        user.employeeProfile!.id,
        employeeOpsService.defaultSchedule(),
      );
      created += 1;
      console.log(`+ ${email} · ${person.role}`);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: person.name,
          active: true,
          type: "EMPLOYEE",
          emailVerified: user.emailVerified ?? new Date(),
        },
      });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      if (user.employeeProfile) {
        await prisma.employeeProfile.update({
          where: { id: user.employeeProfile.id },
          data: {
            jobTitle: person.jobTitle,
            locationId: location.id,
            active: true,
          },
        });
      } else {
        const profile = await prisma.employeeProfile.create({
          data: {
            userId: user.id,
            locationId: location.id,
            jobTitle: person.jobTitle,
            hireDate: new Date(),
            active: true,
          },
        });
        await employeeOpsService.upsertSchedule(
          profile.id,
          employeeOpsService.defaultSchedule(),
        );
      }
      updated += 1;
      console.log(`~ ${email} · ${person.role} (actualizado, contraseña intacta)`);
    }
  }

  console.log(
    `\nListo · nuevos=${created} actualizados=${updated}\nContraseña temporal de cuentas nuevas: ${TEMP_PASSWORD}\nLas cuentas que ya existían conservan su contraseña.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
