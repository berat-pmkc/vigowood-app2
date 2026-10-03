import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ortak auth (Hasmob HR ile paylaşılan) altında, VigoWood users tablosunda
 * karşılığı olmayan / pasif hesapları çıkış yaptırıp login'e gönderir.
 * Route handler içinde olduğu için cookie temizlenebilir (redirect döngüsü olmaz).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?error=erisim-yok";
  return NextResponse.redirect(url);
}
