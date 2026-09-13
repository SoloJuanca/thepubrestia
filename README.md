# The Pub GameStore — Management System

Sistema de gestión integral (POS, inventario, compras, clientes, finanzas) para **The Pub GameStore**.

## Fase 1 — Foundation (actual)

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- PostgreSQL + Prisma (esquema completo de dominio)
- Auth.js (empleados: email/contraseña; clientes: Resend magic link cuando `RESEND_API_KEY` esté configurado)
- RBAC con roles y permisos en backend
- Layout con sidebar filtrada por permisos
- Dashboard operativo mínimo (datos reales de mesas/stock/reseñas)
- CRUD ligero de empleados
- Seed demo

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

2 Menú → 3 Inventario → 4 POS → 5 Cobros → 6 Proveedores → 7 Clientes → 8 Reseñas → 9 Finanzas → 10 QA
