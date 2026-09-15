import "dotenv/config";
import {
  PrismaClient,
  RoleCode,
  UnitType,
  PromotionType,
  Weekday,
  UserType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { allPermissionPairs, permissionsForRole } from "../src/lib/permissions";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

async function main() {
  console.log("Seeding The Pub GameStore...");

  // Permissions
  const pairs = allPermissionPairs();
  for (const pair of pairs) {
    await prisma.permission.upsert({
      where: {
        resource_action: { resource: pair.resource, action: pair.action },
      },
      create: {
        resource: pair.resource,
        action: pair.action,
        description: `${pair.action} ${pair.resource}`,
      },
      update: {},
    });
  }

  const roleDefs: Array<{ code: RoleCode; name: string; description: string }> =
    [
      {
        code: "SUPER_ADMIN",
        name: "Super Admin",
        description: "Acceso completo al sistema",
      },
      {
        code: "ADMIN",
        name: "Administrador",
        description: "Administración general",
      },
      {
        code: "MANAGER",
        name: "Manager",
        description: "Operación sin settings críticos",
      },
      { code: "WAITER", name: "Mesero", description: "POS y servicio" },
      { code: "CASHIER", name: "Cajero", description: "Cobros y cierres" },
      { code: "KITCHEN", name: "Cocina", description: "Cola de preparación" },
      {
        code: "INVENTORY",
        name: "Inventario",
        description: "Stock y compras",
      },
    ];

  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { code: def.code },
      create: def,
      update: { name: def.name, description: def.description },
    });

    const perms = permissionsForRole(def.code);
    for (const p of perms) {
      const permission = await prisma.permission.findUnique({
        where: {
          resource_action: { resource: p.resource, action: p.action },
        },
      });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

  const location = await prisma.location.upsert({
    where: { id: "seed-location-main" },
    create: {
      id: "seed-location-main",
      name: "The Pub GameStore",
      address: "Av. Principal 123, Ciudad",
      phone: "+52 55 0000 0000",
      timezone: "America/Mexico_City",
      active: true,
    },
    update: {
      name: "The Pub GameStore",
      active: true,
    },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const employees: Array<{
    email: string;
    name: string;
    role: RoleCode;
  }> = [
    {
      email: "superadmin@thepub.local",
      name: "Super Admin",
      role: "SUPER_ADMIN",
    },
    { email: "admin@thepub.local", name: "Admin Demo", role: "ADMIN" },
    { email: "manager@thepub.local", name: "Manager Demo", role: "MANAGER" },
    { email: "waiter@thepub.local", name: "Mesero Demo", role: "WAITER" },
    { email: "cashier@thepub.local", name: "Cajero Demo", role: "CASHIER" },
    { email: "kitchen@thepub.local", name: "Cocina Demo", role: "KITCHEN" },
    {
      email: "inventory@thepub.local",
      name: "Inventario Demo",
      role: "INVENTORY",
    },
  ];

  for (const emp of employees) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: emp.role },
    });

    const user = await prisma.user.upsert({
      where: { email: emp.email },
      create: {
        email: emp.email,
        name: emp.name,
        passwordHash,
        type: UserType.EMPLOYEE,
        active: true,
        emailVerified: new Date(),
        roles: { create: { roleId: role.id } },
        employeeProfile: {
          create: {
            locationId: location.id,
            phone: "+52 55 1111 0000",
            hireDate: new Date("2024-01-15"),
            active: true,
          },
        },
      },
      update: {
        name: emp.name,
        passwordHash,
        active: true,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });

    await prisma.employeeProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        locationId: location.id,
        active: true,
        hireDate: new Date("2024-01-15"),
      },
      update: { locationId: location.id, active: true },
    });
  }

  // Customers
  const customers = [
    { email: "juan@email.com", name: "Juan Pérez" },
    { email: "maria@email.com", name: "María López" },
    { email: "pedro@email.com", name: "Pedro García" },
  ];

  for (const c of customers) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      create: {
        email: c.email,
        name: c.name,
        type: UserType.CUSTOMER,
        emailVerified: new Date(),
        customerProfile: {
          create: { visits: 2, lifetimeSpend: 850 },
        },
      },
      update: { name: c.name },
    });

    await prisma.customerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, visits: 2, lifetimeSpend: 850 },
      update: {},
    });
  }

  // Categories
  const categoryNames = [
    { name: "Entradas", sortOrder: 1 },
    { name: "Hamburguesas", sortOrder: 2 },
    { name: "Alitas", sortOrder: 3 },
    { name: "Bebidas", sortOrder: 4 },
    { name: "Postres", sortOrder: 5 },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoryNames) {
    const existing = await prisma.menuCategory.findFirst({
      where: { locationId: location.id, name: cat.name },
    });
    const row =
      existing ??
      (await prisma.menuCategory.create({
        data: {
          locationId: location.id,
          name: cat.name,
          sortOrder: cat.sortOrder,
          active: true,
        },
      }));
    categories[cat.name] = row.id;
  }

  // Ingredients
  const ingredientDefs = [
    {
      name: "Pan",
      category: "Panadería",
      baseUnit: UnitType.UNIT,
      currentStock: 40,
      minimumStock: 20,
      targetStock: 80,
      averageCost: 8,
    },
    {
      name: "Carne",
      category: "Proteínas",
      baseUnit: UnitType.G,
      currentStock: 5000,
      minimumStock: 2000,
      targetStock: 10000,
      averageCost: 0.18,
    },
    {
      name: "Queso",
      category: "Lácteos",
      baseUnit: UnitType.G,
      currentStock: 1500,
      minimumStock: 800,
      targetStock: 3000,
      averageCost: 0.12,
    },
    {
      name: "Papas",
      category: "Vegetales",
      baseUnit: UnitType.KG,
      currentStock: 8,
      minimumStock: 5,
      targetStock: 20,
      averageCost: 25,
    },
    {
      name: "Aceite",
      category: "Aceites",
      baseUnit: UnitType.L,
      currentStock: 3,
      minimumStock: 4,
      targetStock: 10,
      averageCost: 45,
    },
    {
      name: "Salsa",
      category: "Salsas",
      baseUnit: UnitType.ML,
      currentStock: 2000,
      minimumStock: 1000,
      targetStock: 5000,
      averageCost: 0.05,
    },
    {
      name: "Refresco",
      category: "Bebidas",
      baseUnit: UnitType.UNIT,
      currentStock: 48,
      minimumStock: 24,
      targetStock: 96,
      averageCost: 12,
    },
  ];

  const ingredients: Record<string, string> = {};
  for (const ing of ingredientDefs) {
    const existing = await prisma.ingredient.findFirst({
      where: { locationId: location.id, name: ing.name },
    });
    const row =
      existing ??
      (await prisma.ingredient.create({
        data: { locationId: location.id, ...ing, active: true },
      }));
    ingredients[ing.name] = row.id;
  }

  // Menu items
  async function upsertMenuItem(data: {
    name: string;
    category: string;
    price: number;
    estimatedCost: number;
    sku: string;
    requiresPrep?: boolean;
  }) {
    const existing = await prisma.menuItem.findFirst({
      where: { locationId: location.id, sku: data.sku },
    });
    if (existing) return existing;
    return prisma.menuItem.create({
      data: {
        locationId: location.id,
        categoryId: categories[data.category],
        name: data.name,
        sku: data.sku,
        price: data.price,
        estimatedCost: data.estimatedCost,
        taxRate: 0.16,
        available: true,
        active: true,
        requiresPrep: data.requiresPrep ?? true,
        estimatedPrepMins: 12,
        tags: [],
      },
    });
  }

  const burger = await upsertMenuItem({
    name: "Hamburguesa clásica",
    category: "Hamburguesas",
    price: 149,
    estimatedCost: 55,
    sku: "BURGER-CLASSIC",
  });
  const fries = await upsertMenuItem({
    name: "Papas",
    category: "Entradas",
    price: 69,
    estimatedCost: 18,
    sku: "FRIES",
  });
  const wings = await upsertMenuItem({
    name: "Alitas",
    category: "Alitas",
    price: 129,
    estimatedCost: 45,
    sku: "WINGS",
  });
  const soda = await upsertMenuItem({
    name: "Refresco",
    category: "Bebidas",
    price: 35,
    estimatedCost: 12,
    sku: "SODA",
    requiresPrep: false,
  });

  // Modifiers for burger
  const existingGroup = await prisma.modifierGroup.findFirst({
    where: { menuItemId: burger.id, name: "Término" },
  });
  if (!existingGroup) {
    await prisma.modifierGroup.create({
      data: {
        menuItemId: burger.id,
        name: "Término",
        required: true,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 1,
        options: {
          create: [
            { name: "Bien cocida", priceDelta: 0, sortOrder: 1 },
            { name: "Término medio", priceDelta: 0, sortOrder: 2 },
          ],
        },
      },
    });

    await prisma.modifierGroup.create({
      data: {
        menuItemId: burger.id,
        name: "Quitar ingredientes",
        required: false,
        minSelections: 0,
        maxSelections: 3,
        sortOrder: 2,
        options: {
          create: [
            { name: "Sin cebolla", priceDelta: 0, sortOrder: 1 },
            { name: "Sin tomate", priceDelta: 0, sortOrder: 2 },
            { name: "Sin pepinillos", priceDelta: 0, sortOrder: 3 },
          ],
        },
      },
    });

    await prisma.modifierGroup.create({
      data: {
        menuItemId: burger.id,
        name: "Extras",
        required: false,
        minSelections: 0,
        maxSelections: 5,
        sortOrder: 3,
        options: {
          create: [
            { name: "Queso extra", priceDelta: 20, sortOrder: 1 },
            { name: "Tocino", priceDelta: 30, sortOrder: 2 },
            { name: "Carne extra", priceDelta: 60, sortOrder: 3 },
          ],
        },
      },
    });
  }

  // Recipes
  async function ensureRecipe(
    menuItemId: string,
    ingredientName: string,
    quantity: number,
    unit: UnitType,
  ) {
    const ingredientId = ingredients[ingredientName];
    await prisma.recipeItem.upsert({
      where: {
        menuItemId_ingredientId: { menuItemId, ingredientId },
      },
      create: { menuItemId, ingredientId, quantity, unit },
      update: { quantity, unit },
    });
  }

  await ensureRecipe(burger.id, "Pan", 1, UnitType.UNIT);
  await ensureRecipe(burger.id, "Carne", 180, UnitType.G);
  await ensureRecipe(burger.id, "Queso", 30, UnitType.G);
  await ensureRecipe(burger.id, "Salsa", 15, UnitType.ML);
  await ensureRecipe(fries.id, "Papas", 0.25, UnitType.KG);
  await ensureRecipe(fries.id, "Aceite", 0.05, UnitType.L);
  await ensureRecipe(wings.id, "Salsa", 40, UnitType.ML);
  await ensureRecipe(soda.id, "Refresco", 1, UnitType.UNIT);

  // Tables
  for (let i = 1; i <= 10; i++) {
    await prisma.restaurantTable.upsert({
      where: {
        locationId_name: {
          locationId: location.id,
          name: `Mesa ${i}`,
        },
      },
      create: {
        locationId: location.id,
        name: `Mesa ${i}`,
        capacity: i <= 6 ? 4 : 6,
        sortOrder: i,
        active: true,
      },
      update: { active: true },
    });
  }

  // Supplier
  const supplier =
    (await prisma.supplier.findFirst({
      where: { locationId: location.id, name: "Proveedor Demo" },
    })) ??
    (await prisma.supplier.create({
      data: {
        locationId: location.id,
        name: "Proveedor Demo",
        contact: "Luis Proveedor",
        phone: "+52 55 2222 3333",
        whatsapp: "+52 55 2222 3333",
        email: "proveedor@demo.local",
        notes: "Pedidos lunes y jueves",
        active: true,
        schedules: {
          create: [
            { orderDay: Weekday.MONDAY, deliveryDay: Weekday.TUESDAY },
            { orderDay: Weekday.THURSDAY, deliveryDay: Weekday.FRIDAY },
          ],
        },
      },
    }));

  for (const name of ["Pan", "Carne", "Queso", "Papas", "Aceite", "Refresco"]) {
    await prisma.supplierProduct.upsert({
      where: {
        supplierId_ingredientId: {
          supplierId: supplier.id,
          ingredientId: ingredients[name],
        },
      },
      create: {
        supplierId: supplier.id,
        ingredientId: ingredients[name],
        unit: ingredientDefs.find((i) => i.name === name)!.baseUnit,
        unitCost: ingredientDefs.find((i) => i.name === name)!.averageCost,
        active: true,
      },
      update: {},
    });
  }

  await prisma.ingredient.updateMany({
    where: { locationId: location.id },
    data: { preferredSupplierId: supplier.id },
  });

  // Promotions
  const promoPub =
    (await prisma.promotion.findFirst({
      where: { locationId: location.id, code: "PUB15" },
    })) ??
    (await prisma.promotion.create({
      data: {
        locationId: location.id,
        name: "15% en cuenta",
        description: "15% de descuento en toda la cuenta",
        code: "PUB15",
        type: PromotionType.PERCENTAGE,
        amount: 15,
        startsAt: new Date("2024-01-01"),
        endsAt: new Date("2030-12-31"),
        active: true,
        appliesToEntireCheck: true,
        perCustomerLimit: 5,
      },
    }));

  const promoBurger =
    (await prisma.promotion.findFirst({
      where: { locationId: location.id, code: "BURGER100" },
    })) ??
    (await prisma.promotion.create({
      data: {
        locationId: location.id,
        name: "$100 en hamburguesas",
        description: "$100 de descuento en hamburguesas seleccionadas",
        code: "BURGER100",
        type: PromotionType.FIXED_AMOUNT,
        amount: 100,
        startsAt: new Date("2024-01-01"),
        endsAt: new Date("2030-12-31"),
        active: true,
        products: { create: [{ menuItemId: burger.id }] },
      },
    }));

  void promoBurger;

  const welcome =
    (await prisma.promotion.findFirst({
      where: { locationId: location.id, code: "PUBWELCOME" },
    })) ??
    (await prisma.promotion.create({
      data: {
        locationId: location.id,
        name: "Bienvenida",
        code: "PUBWELCOME",
        type: PromotionType.PERCENTAGE,
        amount: 10,
        startsAt: new Date("2024-01-01"),
        active: true,
        appliesToEntireCheck: true,
      },
    }));

  const juan = await prisma.user.findUnique({
    where: { email: "juan@email.com" },
    include: { customerProfile: true },
  });

  if (juan?.customerProfile) {
    for (const promo of [promoPub, welcome]) {
      const exists = await prisma.customerPromotion.findFirst({
        where: {
          customerId: juan.customerProfile.id,
          promotionId: promo.id,
          used: false,
        },
      });
      if (!exists) {
        await prisma.customerPromotion.create({
          data: {
            customerId: juan.customerProfile.id,
            promotionId: promo.id,
            expiresAt: new Date("2030-12-31"),
          },
        });
      }
    }
  }

  // Sample expense + review for demos
  const expenseExists = await prisma.expense.findFirst({
    where: { locationId: location.id, concept: "Renta local demo" },
  });
  if (!expenseExists) {
    await prisma.expense.create({
      data: {
        locationId: location.id,
        category: "Renta",
        concept: "Renta local demo",
        amount: 25000,
        expenseDate: new Date(),
        recurrence: "MONTHLY",
        notes: "Seed Fase 9",
      },
    });
  }

  const reviewCount = await prisma.review.count({
    where: { locationId: location.id },
  });
  if (reviewCount === 0) {
    await prisma.review.create({
      data: {
        locationId: location.id,
        overallRating: 5,
        foodRating: 5,
        serviceRating: 4,
        ambienceRating: 5,
        comment: "Excelente ambiente y hamburguesas.",
        guestName: "Cliente demo",
      },
    });
  }

  const serviceCount = await prisma.service.count({
    where: { locationId: location.id },
  });
  if (serviceCount === 0) {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    await prisma.service.createMany({
      data: [
        {
          locationId: location.id,
          name: "Fumigación general",
          description: "Control de plagas en cocina y almacén",
          category: "Mantenimiento",
          expectedCost: 1800,
          recurrenceType: "MONTHLY",
          recurrenceInterval: 1,
          nextServiceDate: nextMonth,
          reminderDaysBefore: 7,
          notes: "Seed demo",
        },
        {
          locationId: location.id,
          name: "Revisión de extractores",
          description: "Limpieza y revisión de campanas",
          category: "Mantenimiento",
          expectedCost: 2500,
          recurrenceType: "QUARTERLY",
          recurrenceInterval: 1,
          nextServiceDate: nextWeek,
          reminderDaysBefore: 14,
          notes: "Seed demo",
        },
      ],
    });
  }

  const { seedMenuAlimentos } = await import("./seed-menu-alimentos");
  const menuResult = await seedMenuAlimentos(location.id);
  console.log(
    `Menú alimentos: ${menuResult.productsUpserted} productos en ${menuResult.categoriesUpserted} categorías`,
  );

  console.log("Seed complete.");
  console.log(`Demo password for all employees: ${DEMO_PASSWORD}`);
  console.log("Accounts: superadmin@thepub.local, admin@thepub.local, waiter@thepub.local, ...");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
