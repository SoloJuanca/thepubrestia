import { prisma } from "@/lib/prisma";

export type PublicModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
};

export type PublicModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: PublicModifierOption[];
};

export type PublicMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  modifierGroups: PublicModifierGroup[];
};

export type PublicCategory = {
  id: string;
  name: string;
  items: PublicMenuItem[];
};

export async function loadPublicMenu() {
  const location = await prisma.location.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!location) return { locationName: null as string | null, categories: [] as PublicCategory[] };

  const categories = await prisma.menuCategory.findMany({
    where: { locationId: location.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: {
        where: { active: true, available: true },
        orderBy: { name: "asc" },
        include: {
          modifierGroups: {
            orderBy: { sortOrder: "asc" },
            include: {
              options: {
                where: { active: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  return {
    locationName: location.name,
    categories: categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        items: category.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: Number(item.price),
          imageUrl: item.imageUrl,
          modifierGroups: item.modifierGroups
            .filter((group) => group.options.length > 0)
            .map((group) => ({
              id: group.id,
              name: group.name,
              required: group.required,
              minSelections: group.minSelections,
              maxSelections: group.maxSelections,
              options: group.options.map((option) => ({
                id: option.id,
                name: option.name,
                priceDelta: Number(option.priceDelta),
              })),
            })),
        })),
      }))
      .filter((category) => category.items.length > 0),
  };
}

export const WEB_ORDER_STATUS: Record<string, string> = {
  OPEN: "Recibido",
  SENT_TO_KITCHEN: "En cocina",
  PREPARING: "Preparando",
  READY: "Listo para recoger",
  DELIVERED: "Listo para recoger",
  CLOSED: "Pagado",
  CANCELLED: "Cancelado",
};
