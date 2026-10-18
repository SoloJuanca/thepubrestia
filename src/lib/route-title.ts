/** Human titles for app header from pathname. */
export function titleForPathname(pathname: string): string {
  if (pathname.startsWith("/pos/tables/")) return "Sesión de mesa";
  if (pathname.startsWith("/inventory/") && pathname !== "/inventory") {
    return "Detalle de insumo";
  }
  if (pathname.startsWith("/employees/") && pathname !== "/employees") {
    return "Perfil de empleado";
  }
  if (pathname.startsWith("/menu/items/")) return "Producto";
  if (pathname.startsWith("/tickets/")) return "Ticket";
  if (pathname.startsWith("/attendance/station")) return "QR asistencia";
  if (pathname.startsWith("/attendance/scan")) return "Escanear asistencia";

  const exact: Record<string, string> = {
    "/dashboard": "Inicio",
    "/pos": "Mesas",
    "/orders": "Órdenes",
    "/kitchen": "Cocina",
    "/daily-close": "Cierre del día",
    "/menu": "Menú",
    "/inventory": "Inventario",
    "/purchases": "Pedidos a proveedor",
    "/suppliers": "Proveedores",
    "/customers": "Clientes",
    "/promotions": "Promociones",
    "/reviews": "Reseñas",
    "/employees": "Empleados",
    "/attendance": "Asistencia",
    "/services": "Servicios",
    "/expenses": "Gastos",
    "/finance": "Finanzas",
    "/reports": "Reportes",
    "/settings": "Configuración",
    "/account": "Mi cuenta",
  };

  return exact[pathname] ?? "The Pub";
}
