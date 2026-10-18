import type { NavItem } from "@/lib/permissions";
import {
  navPathKey,
  PRIMARY_NAV_HREFS,
  type RolePersona,
} from "@/lib/role-home";

export function splitNavByPersona(
  items: NavItem[],
  persona: RolePersona,
): { primary: NavItem[]; more: NavItem[] } {
  const primaryKeys = new Set(
    PRIMARY_NAV_HREFS[persona].map((h) => navPathKey(h)),
  );
  const primary: NavItem[] = [];
  const more: NavItem[] = [];
  for (const item of items) {
    if (primaryKeys.has(navPathKey(item.href))) primary.push(item);
    else more.push(item);
  }
  // Keep primary in persona order
  primary.sort((a, b) => {
    const ia = PRIMARY_NAV_HREFS[persona].findIndex(
      (h) => navPathKey(h) === navPathKey(a.href),
    );
    const ib = PRIMARY_NAV_HREFS[persona].findIndex(
      (h) => navPathKey(h) === navPathKey(b.href),
    );
    return ia - ib;
  });
  return { primary, more };
}

export function isNavActive(pathname: string, href: string): boolean {
  const key = navPathKey(href);
  if (pathname === key) return true;
  if (key !== "/" && pathname.startsWith(`${key}/`)) return true;
  return false;
}
