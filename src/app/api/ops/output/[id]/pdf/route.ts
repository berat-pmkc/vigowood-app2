import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  // Rate limit: 5 req/dk
  const rl = rateLimit(getRateLimitKey(request, "ops-output-pdf"), {
    limit: 5,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const { id: outputId } = await params;
    const supabase = await createClient();

    const { data: output, error } = await supabase
      .from("ops_outputs")
      .select("*")
      .eq("id", outputId)
      .single();

    if (error || !output) {
      return NextResponse.json(
        { error: "Çıktı bulunamadı" },
        { status: 404 }
      );
    }

    if (!output.file_url) {
      return NextResponse.json(
        { error: "Bu çıktının dosya URL'i bulunamadı" },
        { status: 404 }
      );
    }

    // Supabase Storage'dan dosyayı proxy olarak çek
    const fileResponse = await fetch(output.file_url);

    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: "Dosya indirilemedi" },
        { status: 502 }
      );
    }

    const fileBuffer = await fileResponse.arrayBuffer();

    const safeName = output.file_name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9\u00C0-\u024F\u0130\u0131_-]/g, "_");

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("Output PDF proxy error:", err);
    return NextResponse.json(
      { error: "PDF indirilemedi" },
      { status: 500 }
    );
  }
}
