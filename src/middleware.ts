import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/verify", "/forgot-password", "/review"];

/**
 * Auth.js issues `__Secure-authjs.session-token` on HTTPS.
 * getToken() defaults to the non-secure name unless secureCookie is true,
 * which made production always look logged-out while local (http) worked.
 */
async function readSessionToken(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const secure =
    request.nextUrl.protocol === "https:" || Boolean(process.env.VERCEL);

  const token = await getToken({
    req: request,
    secret,
    secureCookie: secure,
  });
  if (token) return token;

  // Fallback when AUTH_URL was http:// and cookie was issued without prefix
  if (secure) {
    return getToken({
      req: request,
      secret,
      secureCookie: false,
    });
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const token = await readSessionToken(request);

  if (!token && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (token && (pathname === "/login" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/finance") && token) {
    const roles = (token.roles as string[]) ?? [];
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
