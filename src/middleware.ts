import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CUSTOMER_LOGIN_PATH, STAFF_LOGIN_PATH } from "@/lib/auth-paths";
import { homePathForRoles } from "@/lib/post-login";

const publicPaths = [
  CUSTOMER_LOGIN_PATH,
  STAFF_LOGIN_PATH,
  "/verify",
  "/forgot-password",
  "/review",
  "/pedir",
  "/cuenta",
];

function isCustomerArea(pathname: string) {
  return (
    pathname === "/pedir" ||
    pathname.startsWith("/pedir/") ||
    pathname === "/cuenta" ||
    pathname.startsWith("/cuenta/") ||
    pathname === "/review" ||
    pathname.startsWith("/review/")
  );
}

/**
 * Auth.js may issue `__Secure-authjs.session-token` (HTTPS) or
 * `authjs.session-token` (HTTP). Try both so a leftover secure cookie on
 * localhost (or vice versa) does not look like "logged out".
 */
async function readSessionToken(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;

  const primary = await getToken({
    req: request,
    secret,
    secureCookie: true,
  });
  if (primary) return primary;

  return getToken({
    req: request,
    secret,
    secureCookie: false,
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/live") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const token = await readSessionToken(request);
  const roles = (token?.roles as string[] | undefined) ?? [];
  const isCustomer = token?.type === "CUSTOMER";

  if (isCustomer) {
    const signingIn =
      pathname === CUSTOMER_LOGIN_PATH ||
      pathname === "/cuenta/entrar" ||
      pathname === "/cuenta/registro";
    if (!isCustomerArea(pathname) || signingIn || pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/pedir";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!token && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = STAFF_LOGIN_PATH;
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (
    token &&
    (pathname === STAFF_LOGIN_PATH ||
      pathname === CUSTOMER_LOGIN_PATH ||
      pathname === "/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRoles(roles);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/finance") && token) {
    const financeAllowed = roles.some((r) =>
      ["SUPER_ADMIN", "ADMIN"].includes(r),
    );
    if (!financeAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("error", "forbidden_finance");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
