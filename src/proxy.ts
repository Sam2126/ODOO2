import { NextResponse, type NextRequest } from "next/server";

import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

/** Routes reachable while signed out. Everything else redirects to /login. */
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userId = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!userId && !isPublic(pathname)) {
    const url = new URL("/login", request.url);
    // Remember where they were headed so login can send them back.
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (userId && isPublic(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals, the favicon and static image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
