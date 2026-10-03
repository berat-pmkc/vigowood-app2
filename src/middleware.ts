import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Bakım modu: MAINTENANCE_MODE=1 ise tüm istekler /bakim sayfasına yönlenir (auth gerekmez)
  if (process.env.MAINTENANCE_MODE === "1") {
    const { pathname } = request.nextUrl;
    if (pathname !== "/bakim" && !pathname.startsWith("/bakim/")) {
      const url = request.nextUrl.clone();
      url.pathname = "/bakim";
      url.search = "";
      return NextResponse.rewrite(url, { status: 503 });
    }
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and API cron routes
    "/((?!_next/static|_next/image|favicon.ico|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
