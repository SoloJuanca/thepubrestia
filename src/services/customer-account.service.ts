import { prisma } from "@/lib/prisma";
import { WordpressError } from "@/lib/wordpress";
import {
  loginWithWordpress,
  registerWithWordpress,
  type WordpressCustomer,
} from "@/services/wordpress.service";

export async function upsertCustomerFromWordpress(profile: WordpressCustomer) {
  const email = profile.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.type === "EMPLOYEE") {
    throw new WordpressError(
      "Ese correo pertenece al personal del restaurante.",
      403,
    );
  }

  const linked = await prisma.customerProfile.findUnique({
    where: { wpUserId: profile.id },
  });
  if (linked && existing && linked.userId !== existing.id) {
    throw new WordpressError(
      "Esa cuenta de la tienda ya está ligada a otro correo.",
      409,
    );
  }

  const name = profile.name || email.split("@")[0];
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name, type: "CUSTOMER", active: true },
      })
    : await prisma.user.create({
        data: {
          email,
          name,
          type: "CUSTOMER",
          active: true,
        },
      });

  await prisma.customerProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      phone: profile.phone,
      wpUserId: profile.id,
    },
    update: {
      phone: profile.phone ?? undefined,
      wpUserId: profile.id,
    },
  });

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { customerProfile: true },
  });
}

export async function loginCustomerAccount(email: string, password: string) {
  const profile = await loginWithWordpress(email, password);
  return upsertCustomerFromWordpress(profile);
}

export async function registerCustomerAccount(params: {
  email: string;
  password: string;
  name: string;
  phone?: string | null;
}) {
  const email = params.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.type === "EMPLOYEE") {
    throw new WordpressError(
      "Ese correo pertenece al personal del restaurante.",
      403,
    );
  }

  const profile = await registerWithWordpress({ ...params, email });
  return upsertCustomerFromWordpress(profile);
}
