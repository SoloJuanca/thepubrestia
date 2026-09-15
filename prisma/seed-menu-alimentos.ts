import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type MenuOption = { name: string; price_modifier: number };
type MenuOptionGroup = {
  name: string;
  required: boolean;
  min_selections: number;
  max_selections: number;
  options: MenuOption[];
};
type MenuProduct = {
  sku: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  option_groups: MenuOptionGroup[];
};
type MenuCategorySeed = {
  slug: string;
  name: string;
  sort_order: number;
  products: MenuProduct[];
};

export const MENU_ALIMENTOS: {
  name: string;
  currency: string;
  categories: MenuCategorySeed[];
} = {
  name: "Menú Alimentos - The Pub Game Store",
  currency: "MXN",
  categories: [
    {
      slug: "snacks-entradas",
      name: "Snacks & Entradas",
      sort_order: 1,
      products: [
        {
          sku: "SNK-PAPAS-FRANCESA",
          name: "Papas a la Francesa",
          description: "Papas a la francesa originales o sazonadas.",
          price: 70.0,
          active: true,
          option_groups: [
            {
              name: "Preparación",
              required: true,
              min_selections: 1,
              max_selections: 1,
              options: [
                { name: "Originales", price_modifier: 0 },
                { name: "Sazonadas", price_modifier: 0 },
              ],
            },
          ],
        },
        {
          sku: "SNK-NACHOS",
          name: "Nachos",
          description:
            "Tortilla frita con salsa pico de gallo, guacamole y queso amarillo.",
          price: 70.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "SNK-CAMOTE-FRIES",
          name: "Camote Fries",
          description: "Papas de camote a la francesa.",
          price: 120.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "SNK-BONELESS",
          name: "Boneless",
          description:
            "Boneless con salsa a elegir, acompañadas de ranch o blue cheese.",
          price: 185.0,
          active: true,
          option_groups: [
            {
              name: "Salsa",
              required: true,
              min_selections: 1,
              max_selections: 1,
              options: [
                { name: "Buffalo", price_modifier: 0 },
                { name: "BBQ", price_modifier: 0 },
                { name: "Hot BBQ", price_modifier: 0 },
                { name: "Mango Habanero", price_modifier: 0 },
              ],
            },
            {
              name: "Aderezo",
              required: true,
              min_selections: 1,
              max_selections: 1,
              options: [
                { name: "Ranch", price_modifier: 0 },
                { name: "Blue Cheese", price_modifier: 0 },
              ],
            },
          ],
        },
        {
          sku: "SNK-DEDOS-QUESO",
          name: "Dedos de Queso",
          description: "Servidos con pomodoro. 6 piezas.",
          price: 170.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "SNK-BUFFALO-FRIES",
          name: "Buffalo Fries",
          description:
            "Papas a la francesa sazonadas con lemon pepper, salsa búfalo y perejil seco, acompañadas con aderezo ranch.",
          price: 100.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "SNK-WRAP-CESAR",
          name: "Wrap Cesar",
          description:
            "Tortilla burrera, 140 g de pollo lemon pepper, lechuga, aderezo César y queso manchego.",
          price: 190.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "SNK-WRAP-BUFALO",
          name: "Wrap Bufalo",
          description:
            "Tortilla burrera, 140 g de pollo lemon pepper, lechuga, jitomate, pepino, cebolla morada y aderezo ranch, bañado con salsa búfalo.",
          price: 190.0,
          active: true,
          option_groups: [],
        },
      ],
    },
    {
      slug: "hamburguesas-especiales",
      name: "Hamburguesas & Especiales",
      sort_order: 2,
      products: [
        {
          sku: "BRG-RES",
          name: "Hamburguesa de Res",
          description:
            "Carne molida mixta (180 g), queso manchego, lechuga, jitomate, cebolla, mayonesa y pepinillos por separado, acompañada de papas a la francesa.",
          price: 220.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "BRG-BEEF-BACON",
          name: "Beef & Bacon Burger",
          description:
            "Carne molida mixta, tocino, cheddar, jitomate, aderezo de pepinillos y cebolla, acompañada de papas a la francesa.",
          price: 250.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "BRG-PULLED-PORK",
          name: "Pulled Pork Burger",
          description:
            "Pulled pork, queso provolone, salsa BBQ, aderezo de chipotle, cebolla frita y chile serrano, acompañada de camote fries.",
          price: 260.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "BRG-AMERICANA",
          name: "Hamburguesa Americana",
          description:
            "Smash burger de carne de res, queso cheddar, cebolla fileteada y aderezo de pepinillos, acompañada de papas a la francesa.",
          price: 200.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "BRG-BONELESS",
          name: "Hamburguesa Boneless",
          description:
            "Boneless con salsa a elegir, queso manchego, lechuga, jitomate, cebolla morada y mayonesa, acompañada de papas a la francesa.",
          price: 260.0,
          active: true,
          option_groups: [
            {
              name: "Salsa",
              required: true,
              min_selections: 1,
              max_selections: 1,
              options: [
                { name: "Buffalo", price_modifier: 0 },
                { name: "BBQ", price_modifier: 0 },
                { name: "Hot BBQ", price_modifier: 0 },
                { name: "Mango Habanero", price_modifier: 0 },
              ],
            },
          ],
        },
        {
          sku: "ESP-PHILLY",
          name: "Philly Cheesesteak",
          description:
            "Carne de res asada con cebolla caramelizada sobre baguette tostada y gratinada con queso provolone natural y queso amarillo, acompañada con papas a la francesa.",
          price: 230.0,
          active: true,
          option_groups: [],
        },
      ],
    },
    {
      slug: "especiales",
      name: "Especiales",
      sort_order: 3,
      products: [
        {
          sku: "ESP-TACOS-ARRACHERA",
          name: "Tacos Arrachera",
          description:
            "3 tacos gratinados con manchego, arrachera marinada cocinada con cebolla blanca y chile jalapeño, acompañados con guacamole.",
          price: 285.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "ESP-SAMPLER",
          name: "Sampler The Pub",
          description:
            "Dedos de queso (4 piezas), papas lemon pepper, salchichas envueltas en tortilla de harina frita y boneless con salsa a elegir, acompañado con queso amarillo, ranch y cátsup.",
          price: 285.0,
          active: true,
          option_groups: [
            {
              name: "Salsa Boneless",
              required: true,
              min_selections: 1,
              max_selections: 1,
              options: [
                { name: "Buffalo", price_modifier: 0 },
                { name: "BBQ", price_modifier: 0 },
                { name: "Hot BBQ", price_modifier: 0 },
                { name: "Mango Habanero", price_modifier: 0 },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "pastas",
      name: "Pastas",
      sort_order: 4,
      products: [
        {
          sku: "PST-LASAGNA-TOSCANA",
          name: "Lasagna Toscana",
          description: "Bolognese, mozzarella, bechamel, pomodoro y parmesano.",
          price: 270.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PST-LASAGNA-VEGETALES",
          name: "Lasagna Vegetales",
          description:
            "Vegetales frescos, queso mozzarella, parmesano, especias y pomodoro.",
          price: 270.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PST-CARBONARA",
          name: "Pasta Carbonara",
          description:
            "Spaghetti cremoso, panceta casera, servido con perejil y parmesano.",
          price: 230.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PST-THAI",
          name: "Pasta Thai",
          description:
            "Spaghetti con salsa thai, pechuga de pollo asada, vegetales, cacahuate, salsa sriracha y cebollín.",
          price: 230.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PST-MAC-CHEESE",
          name: "Mac & Cheese",
          description:
            "Coditos con salsa cremosa de mozzarella, parmesano, cheddar y queso amarillo, con salsa Sriracha y perejil seco.",
          price: 230.0,
          active: true,
          option_groups: [],
        },
      ],
    },
    {
      slug: "hot-pizza",
      name: "Hot Pizza",
      sort_order: 5,
      products: [
        {
          sku: "PZA-PEPPERONI",
          name: "Pizza Pepperoni",
          description: "Pomodoro, mozzarella, parmesano y pepperoni.",
          price: 230.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PZA-MARGHERITA",
          name: "Pizza Margherita",
          description: "Pomodoro, parmesano, mozzarella y albahaca.",
          price: 230.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PZA-NAPULE",
          name: "Pizza Napule",
          description: "Pomodoro, albahaca, mozzarella, salame y parmesano.",
          price: 250.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PZA-CUATRO-QUESOS",
          name: "Pizza Cuatro Quesos",
          description:
            "Queso mozzarella, parmesano, provolone ahumado y gorgonzola.",
          price: 250.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PZA-BN",
          name: "Pizza BN",
          description:
            "Pomodoro, arrachera, cebolla morada, parmesano, albahaca, queso mozzarella y guacamole.",
          price: 300.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PZA-MILANO",
          name: "Pizza Milano",
          description:
            "Salame, pepperoni, mozzarella, albahaca, cebolla caramelizada y queso Philadelphia.",
          price: 290.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PZA-ALFREDO",
          name: "Pizza Alfredo",
          description:
            "Crema Alfredo, pollo, cebolla, peperoncino, queso Pepper Jack, parmesano, mozzarella y albahaca.",
          price: 260.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "PZA-MEATLOVE",
          name: "Pizza Meatlove",
          description:
            "Pizza 4 carnes: pepperoni, salami, salchicha italiana, tocino, cebolla caramelizada y peperoncino.",
          price: 260.0,
          active: true,
          option_groups: [],
        },
      ],
    },
    {
      slug: "menu-ninos",
      name: "Menú de Niños",
      sort_order: 6,
      products: [
        {
          sku: "KID-QUESADILLA",
          name: "Quesadilla al Gusto",
          description: "2 piezas.",
          price: 90.0,
          active: true,
          option_groups: [
            {
              name: "Preparación",
              required: true,
              min_selections: 1,
              max_selections: 1,
              options: [
                { name: "Queso", price_modifier: 0 },
                { name: "Jamón con queso", price_modifier: 0 },
                { name: "Pollo con queso", price_modifier: 0 },
              ],
            },
          ],
        },
        {
          sku: "KID-PIZZETA",
          name: "Pizzeta",
          description: "Pizzeta individual.",
          price: 100.0,
          active: true,
          option_groups: [
            {
              name: "Sabor",
              required: true,
              min_selections: 1,
              max_selections: 1,
              options: [
                { name: "Margherita", price_modifier: 0 },
                { name: "Pepperoni", price_modifier: 0 },
                {
                  name: "Margherita con queso de cabra",
                  price_modifier: 0,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "postres",
      name: "Postres",
      sort_order: 7,
      products: [
        {
          sku: "DES-PANNA-COTTA",
          name: "Panna Cotta",
          description:
            "Suave gelatina de crema y vainilla fresca, acompañada de salsa de frutos rojos.",
          price: 120.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "DES-CANNOLO",
          name: "Cannolo",
          description:
            "Dulce italiano relleno de lechera, Philadelphia y crema Lyncott, con un toque de pistacho y miel. 2 piezas.",
          price: 120.0,
          active: true,
          option_groups: [],
        },
        {
          sku: "DES-BITES",
          name: "Bites",
          description:
            "Bites de pizza frita espolvoreados en azúcar con canela, terminados con 3 toppings a elegir.",
          price: 120.0,
          active: true,
          option_groups: [
            {
              name: "Toppings",
              required: true,
              min_selections: 3,
              max_selections: 3,
              options: [
                { name: "Plátano", price_modifier: 0 },
                { name: "Frutos rojos", price_modifier: 0 },
                { name: "Philadelphia", price_modifier: 0 },
                { name: "Mermelada de fresa", price_modifier: 0 },
                { name: "Mermelada de zarzamora", price_modifier: 0 },
                { name: "Chocolate Hershey's", price_modifier: 0 },
                { name: "Nutella", price_modifier: 0 },
                { name: "Cajeta", price_modifier: 0 },
                { name: "Lechera", price_modifier: 0 },
                { name: "Miel", price_modifier: 0 },
                { name: "Nuez", price_modifier: 0 },
                { name: "Pistache", price_modifier: 0 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export async function seedMenuAlimentos(locationId: string) {
  let categoriesUpserted = 0;
  let productsUpserted = 0;
  let groupsUpserted = 0;

  for (const cat of MENU_ALIMENTOS.categories) {
    let category = await prisma.menuCategory.findFirst({
      where: { locationId, name: cat.name },
    });

    if (category) {
      category = await prisma.menuCategory.update({
        where: { id: category.id },
        data: {
          name: cat.name,
          description: `slug:${cat.slug}`,
          sortOrder: cat.sort_order,
          active: true,
        },
      });
    } else {
      category = await prisma.menuCategory.create({
        data: {
          locationId,
          name: cat.name,
          description: `slug:${cat.slug}`,
          sortOrder: cat.sort_order,
          active: true,
        },
      });
    }
    categoriesUpserted += 1;

    for (const product of cat.products) {
      const item = await prisma.menuItem.upsert({
        where: {
          locationId_sku: { locationId, sku: product.sku },
        },
        create: {
          locationId,
          categoryId: category.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          price: product.price,
          taxRate: 0,
          available: true,
          requiresPrep: true,
          active: product.active,
          tags: [cat.slug],
        },
        update: {
          categoryId: category.id,
          name: product.name,
          description: product.description,
          price: product.price,
          available: true,
          requiresPrep: true,
          active: product.active,
          tags: [cat.slug],
        },
        include: { modifierGroups: { include: { options: true } } },
      });
      productsUpserted += 1;

      // Replace modifier groups to match catalog exactly
      if (item.modifierGroups.length > 0) {
        await prisma.modifierGroup.deleteMany({
          where: { menuItemId: item.id },
        });
      }

      for (const [gIdx, group] of product.option_groups.entries()) {
        await prisma.modifierGroup.create({
          data: {
            menuItemId: item.id,
            name: group.name,
            required: group.required,
            minSelections: group.min_selections,
            maxSelections: group.max_selections,
            sortOrder: gIdx,
            options: {
              create: group.options.map((opt, oIdx) => ({
                name: opt.name,
                priceDelta: opt.price_modifier,
                active: true,
                sortOrder: oIdx,
              })),
            },
          },
        });
        groupsUpserted += 1;
      }
    }
  }

  return { categoriesUpserted, productsUpserted, groupsUpserted };
}

async function main() {
  console.log(`Importando: ${MENU_ALIMENTOS.name} (${MENU_ALIMENTOS.currency})`);

  const location =
    (await prisma.location.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.location.create({
      data: {
        id: "seed-location-main",
        name: "The Pub GameStore",
        timezone: "America/Mexico_City",
        active: true,
      },
    }));

  const result = await seedMenuAlimentos(location.id);
  console.log(
    `Listo · categorías=${result.categoriesUpserted} productos=${result.productsUpserted} grupos=${result.groupsUpserted}`,
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
