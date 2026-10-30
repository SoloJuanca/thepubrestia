import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applyMenuExtras } from "../prisma/menu-extras";

const prisma = new PrismaClient();

applyMenuExtras(prisma)
  .then((result) => {
    console.log(
      `Listo · productos=${result.items} con aderezo=${result.sauces} quesadillas=${result.tortillas} mitad-mitad=${result.halfAndHalf}`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
