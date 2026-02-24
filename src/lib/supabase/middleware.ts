import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const STATION_EMAILS = [
  "kesim@vigowood.com",
  "temizlik@vigowood.com",
  "montaj@vigowood.com",
  "montaj2@vigowood.com",
  "montaj3@vigowood.com",
  "paketleme@vigowood.com",
  "kutu@vigowood.com",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Capture existing cookie values to compare later
  const existingCookies = new Map<string, string>();
  for (const cookie of request.cookies.getAll()) {
    existingCookies.set(cookie.name, cookie.value);
  }

  let cookiesChanged = false;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Check if cookies actually changed
          const hasChanges = cookiesToSet.some(({ name, value }) => {
            return existingCookies.get(name) !== value;
          });

          if (!hasChanges) return;

          cookiesChanged = true;
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public paths — no auth required
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/select-operator");

  // If not logged in → redirect to login (except auth pages)
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If logged in and on /login → redirect away
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    if (user.email && STATION_EMAILS.includes(user.email)) {
      // Station account: check if operator selected
      const hasOperator = user.user_metadata?.selected_operator_id;
      url.pathname = hasOperator ? "/" : "/select-operator";
    } else {
      url.pathname = "/";
    }
    return NextResponse.redirect(url);
  }

  // Station accounts without operator selected → redirect to select-operator
  if (
    user &&
    user.email &&
    STATION_EMAILS.includes(user.email) &&
    !user.user_metadata?.selected_operator_id &&
    pathname !== "/select-operator"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/select-operator";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
