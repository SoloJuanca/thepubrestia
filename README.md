# The Pub GameStore — Management System

Sistema de gestión integral (POS, inventario, compras, clientes, finanzas) para **The Pub GameStore**.

## Fase 1 — Foundation

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- PostgreSQL + Prisma (esquema completo de dominio)
- Auth.js (empleados: email/contraseña; clientes: Resend magic link cuando `RESEND_API_KEY` esté configurado)
- RBAC con roles y permisos en backend
- Layout con sidebar filtrada por permisos
- Dashboard operativo mínimo (datos reales de mesas/stock/reseñas)
- CRUD ligero de empleados
- Seed demo

## Fase 2 — Menú

- CRUD categorías (orden, imagen, activo)
- CRUD productos (precio, impuestos, SKU, disponibilidad, tags)
- Modificadores por producto (grupos + opciones con precio)
- Imágenes vía `StorageService` → Vercel Blob (`BLOB_READ_WRITE_TOKEN`) o URL manual
- Auditoría de altas/cambios de precio
- Recetas se muestran en detalle (edición de insumos en Fase 3)

## Fase 3 — Inventario

- CRUD ingredientes (unidad, mínimos, objetivo, costo, proveedor)
- Recetas producto ↔ insumos
- Ajustes y mermas con `InventoryMovement` (nunca stock silencioso)
- Alertas: por agotarse, agotados, pedido sugerido, POs pendientes
- Listado de movimientos auditados

## Fase 4 — POS

- Grid de mesas (tablet) con estados y totales
- Sesión por mesa: cuentas múltiples, menú, modificadores
- Envío a cocina y cola de cocina (preparar / listo / entregado)
- División: mover productos, partes iguales, montos personalizados
- Listado de órdenes abiertas

## Fase 5 — Cobros

- Cobro multi-método (efectivo / tarjeta / transferencia) + propinas
- Cierre de cuenta con `FOR UPDATE` (sin doble cobro)
- Consumo de inventario por receta (`SALE_CONSUMPTION`, idempotente por ítem)
- Ticket imprimible 58/80 mm (`PrinterService` → `window.print`)
- Cierre de día (preview + confirmación inmutable)

## Fase 6 — Proveedores

- CRUD proveedores (contacto, WhatsApp, notas, activo)
- Calendarios pedido/entrega + “pedidos de hoy”
- Catálogo proveedor ↔ insumos (SKU, costo, mín. pedido)
- Órdenes de compra (borrador → pendiente → pedida → parcial/recibida)
- Recepción parcial/total → `PURCHASE` + costo promedio ponderado
- Borradores sugeridos desde stock bajo

## Fase 7 — Clientes

- Perfil cliente (email, visitas, lifetime spend, wallet)
- Asignación de promociones al wallet
- CRUD promociones (código, vigencia, límites)
- Aplicar / quitar promo en POS; pricing vía `PromotionService`
- Métricas de cliente al cerrar cuenta

## Fase 8 — Reseñas

- Token opaco QR (`/review/[token]`) sin exponer orderId
- Formulario público + dashboard de promedios
- Generación de enlace desde Reseñas o ticket

## Fase 9 — Finanzas

- Gastos + nómina (borrador → aprobada → pagada)
- COGS desde movimientos `SALE_CONSUMPTION`
- Márgenes bruto/operativo, valor de inventario
- Reportes por rango de fechas (`/reports`)
- `/finance` restringido a SUPER_ADMIN / ADMIN (middleware)

## Fase 10 — QA

- Tests críticos (pricing, ventana de promo, RBAC finance)
- `npm test` (Vitest)
- Settings de sucursal (lectura)

## Requisitos

- Node.js 20+
- Docker Desktop (PostgreSQL local)
- npm

## Setup

### Base de datos

Este entorno detectó **PostgreSQL 18** como servicio Windows (`postgresql-x64-18`).
Docker Compose también está incluido, pero requiere **WSL2** para el engine de Linux.

Opción A — PostgreSQL local (recomendada aquí):

```bash
# Crear rol y base (ajusta la contraseña de superusuario)
psql -U postgres -c "CREATE USER thepub WITH PASSWORD 'thepub' CREATEDB;"
psql -U postgres -c "CREATE DATABASE thepub OWNER thepub;"
```

Luego en `.env`:

```
DATABASE_URL="postgresql://thepub:thepub@localhost:5432/thepub?schema=public"
```

Opción B — Docker (necesita WSL2 + Docker Desktop funcionando):

```bash
docker compose up -d
```

### App

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

## Cuentas demo

Contraseña para todos los empleados: `Password123!`

| Email | Rol |
|-------|-----|
| superadmin@thepub.local | SUPER_ADMIN |
| admin@thepub.local | ADMIN |
| manager@thepub.local | MANAGER |
| waiter@thepub.local | WAITER |
| cashier@thepub.local | CASHIER |
| kitchen@thepub.local | KITCHEN |
| inventory@thepub.local | INVENTORY |

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Tests críticos (Vitest) |
| `npm run db:migrate` | Migraciones (dev) |
| `npm run db:seed` | Seed |
| `npm run db:studio` | Prisma Studio |

## Estructura

```
src/app          # Rutas App Router
src/components   # UI + layout
src/features     # Features por dominio
src/lib          # auth, prisma, rbac, permissions
src/services     # Servicios de dominio (stubs en F1)
src/repositories # Acceso a datos
src/validations  # Zod
prisma/          # Schema, migrations, seed
```

## Seguridad

- Nunca commits de `.env`
- Permisos validados en Server Actions (`assertPermission`)
- Ruta `/finance` bloqueada en middleware salvo SUPER_ADMIN / ADMIN
- Contraseñas solo como hash bcrypt

## Próximas fases

Roadmap base completado (fases 1–10). Iteraciones futuras: magic link cliente, export CSV/PDF, ESC/POS hardware.
