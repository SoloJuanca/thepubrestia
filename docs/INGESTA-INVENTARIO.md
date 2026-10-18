# Ingesta de inventario, recetas y producción

Guía para cargar el inventario físico del local y los recetarios sobre el modelo ya sembrado (`npm run db:seed:bebidas`).

## Qué ya deja el seed

- Menú **Bebidas** con precios y receta de venta `1 UNIT` por SKU
- Insumos empaquetados con `kind: PACKAGED`, stock en piezas y `packSize` informativo
- PREP de ejemplo: carnes hamburguesa, pomodoro, pico de gallo, guacamole, dedos de queso, cebolla caramelizada, salsa italiana, tocino cocido, nachos (totopo), salchichas de sampler, limonada, piñada
- FROZEN por nombre: boneless, papas, camote / McCain
- Salsas Custom Culinary (PACKAGED): BBQ, Buffalo, BBQ Hot, Mango Habanero, Ranch, Blue Cheese

## Archivos que necesitas del local

1. **Lista física de inventario** (Excel/PDF): nombre, unidad, stock actual, mínimo, costo unitario, tipo (crudo / prep / congelado / empaquetado)
2. **Recetario de venta**: platillo → insumos y cantidades (incluye PREP ya elaborados)
3. **Recetario de producción**: cómo se hace cada PREP (insumos crudos → salida teórica)

Sin costos unitarios ni conteo físico, el sistema puede operar con costo `0` y stock según lista; el margen y el teórico vs real serán aproximados.

## Mapeo a Prisma

| Columna lista física | Campo |
|----------------------|--------|
| Nombre               | `Ingredient.name` (upsert por nombre + location) |
| Tipo                 | `Ingredient.kind` = `RAW` \| `PREP` \| `FROZEN` \| `PACKAGED` |
| Unidad               | `Ingredient.baseUnit` |
| Pzas por caja        | `Ingredient.packSize` (solo informativo si stock ya está en piezas) |
| Stock / mín / costo  | `currentStock`, `minimumStock`, `averageCost` |
| Nota almacenamiento  | `storageNote` (ej. “congelado 100%”) |

| Receta venta | Campo |
|--------------|--------|
| Platillo     | `MenuItem` (sku o nombre) |
| Línea        | `RecipeItem` (ingredientId, quantity, unit) |
| Costo        | Se recalcula al guardar receta → `MenuItem.estimatedCost` |

| Receta producción | Campo |
|-------------------|--------|
| Producto terminado | `PrepRecipe.outputIngredientId` (debe ser `kind: PREP`) |
| Salida teórica     | `PrepRecipe.outputQuantity` |
| Insumos            | `PrepRecipeItem` |

## Proceso recomendado

1. `npx prisma migrate deploy` (migración `inventory_production_kinds`)
2. `npm run db:seed:bebidas` (idempotente)
3. Pegar filas del Excel en un script upsert (o cargar desde Inventario → Ingredientes)
4. Completar recetas PREP en Inventario → **Producción**
5. Completar recetas de venta en Inventario → **Recetas**
6. Registrar primer batch de producción y verificar stock PREP
7. Cobrar 1 Coca / Peñafielada / Limonada y confirmar movimiento `SALE_CONSUMPTION`

## Placeholders a completar con el recetario

Los PREP creados por el seed tienen receta vacía o solo nota “Completar insumos con recetario del local”. Hasta que cargues líneas de entrada, no se puede confirmar un batch.

Congelados (boneless, papas, camote) **no** se producen: solo compra, venta/consumo por receta y merma.
