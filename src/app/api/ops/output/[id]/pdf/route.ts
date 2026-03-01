import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { OutputRaporDocument } from "@/lib/pdf/output-rapor-template";
import React from "react";

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

    const metadata = (output.metadata ?? {}) as Record<string, unknown>;
    const fullContent = metadata.full_content as string | undefined;

    if (!fullContent) {
      return NextResponse.json(
        { error: "Bu çıktının markdown içeriği bulunamadı" },
        { status: 400 }
      );
    }

    const title = output.description || output.file_name;
    const fileCode = output.file_name;
    const date = new Date(output.created_at).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const pdfBuffer = await renderToBuffer(
      React.createElement(OutputRaporDocument, {
        title,
        fileCode,
        date,
        markdown: fullContent,
      })
    );

    const safeName = output.file_name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9\u00C0-\u024F\u0130\u0131_-]/g, "_");

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("Output PDF generation error:", err);
    return NextResponse.json(
      { error: "PDF oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
