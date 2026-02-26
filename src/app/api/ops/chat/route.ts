import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const maxDuration = 60; // Vercel Pro

// ─── Types ────────────────────────────────────────────────────
type AdminClient = SupabaseClient<Database>;

type ToolResult = Record<string, unknown> | Record<string, unknown>[] | string;

// ─── Department → Tool Mapping ────────────────────────────────

const COMMON_TOOLS = ["search_products", "get_tasks_summary"];

const DEPARTMENT_TOOLS: Record<string, string[]> = {
  stok: ["get_product_stock", "get_critical_stock", "get_stock_movements", "get_yari_mamul_summary"],
  uretim: ["get_daily_production", "get_cut_batches", "get_montaj_sessions", "get_pack_events"],
  sevkiyat: ["get_shipments", "get_shipment_detail"],
  muhasebe: ["get_cash_position", "get_pending_payments", "get_profitability"],
  pazaryeri: ["get_sales_summary", "get_ikas_orders"],
  genel: [
    "get_product_stock", "get_critical_stock", "get_stock_movements", "get_yari_mamul_summary",
    "get_daily_production", "get_cut_batches", "get_montaj_sessions", "get_pack_events",
    "get_shipments", "get_shipment_detail",
    "get_cash_position", "get_pending_payments", "get_profitability",
    "get_sales_summary", "get_ikas_orders",
  ],
};

// ─── Tool Definitions (Anthropic format) ─────────────────────

const ALL_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "search_products",
    description: "Ürün arar. SKU veya ürün adıyla arama yapar.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Aranacak kelime (SKU veya ürün adı)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_stock",
    description: "Mamül (bitmiş ürün) stok bilgilerini getirir. SKU belirtilirse tek ürün, belirtilmezse düşük stoktan başlayarak listeler.",
    input_schema: {
      type: "object" as const,
      properties: {
        sku: { type: "string", description: "Opsiyonel: belirli bir ürünün SKU kodu" },
      },
    },
  },
  {
    name: "get_critical_stock",
    description: "Kritik stok seviyesinin altındaki ürün ve parçaları getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["mamul", "yari_mamul", "hazir_eleman"], description: "Stok türü. mamul=bitmiş ürün, yari_mamul=kesilen parça, hazir_eleman=satın alınan aksesuar" },
      },
    },
  },
  {
    name: "get_stock_movements",
    description: "Mamül stok hareketlerini getirir. Giriş/çıkış kayıtları.",
    input_schema: {
      type: "object" as const,
      properties: {
        sku: { type: "string", description: "Opsiyonel: belirli bir SKU filtresi" },
        days: { type: "number", description: "Son kaç günün hareketleri (varsayılan: 7)" },
      },
    },
  },
  {
    name: "get_yari_mamul_summary",
    description: "Yarı mamül (kesilen parça) stok özetini getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        part_id: { type: "string", description: "Opsiyonel: belirli bir parça ID filtresi" },
      },
    },
  },
  {
    name: "get_daily_production",
    description: "Günlük üretim özetini getirir: kesim, montaj, paketleme sayıları.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Son kaç gün (varsayılan: 1)" },
      },
    },
  },
  {
    name: "get_cut_batches",
    description: "Kesim partilerini (batch) getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Son kaç gün (varsayılan: 7)" },
        status: { type: "string", enum: ["bekliyor", "kesiliyor", "tamamlandi"], description: "Opsiyonel durum filtresi" },
      },
    },
  },
  {
    name: "get_montaj_sessions",
    description: "Montaj seanslarını getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Son kaç gün (varsayılan: 7)" },
        status: { type: "string", enum: ["montajda", "tamamlandi"], description: "Opsiyonel durum filtresi" },
      },
    },
  },
  {
    name: "get_pack_events",
    description: "Paketleme olaylarını getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Son kaç gün (varsayılan: 7)" },
      },
    },
  },
  {
    name: "get_shipments",
    description: "Sevkiyat listesini getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["bekliyor", "hazirlaniyor", "yolda", "teslim_edildi", "iptal"], description: "Opsiyonel durum filtresi" },
      },
    },
  },
  {
    name: "get_shipment_detail",
    description: "Belirli bir sevkiyatın detayını (ürün kalemleri dahil) getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        sevkiyat_id: { type: "string", description: "Sevkiyat ID (ör: DE21, UK29)" },
      },
      required: ["sevkiyat_id"],
    },
  },
  {
    name: "get_cash_position",
    description: "Nakit pozisyonunu getirir: varlıklar, borçlar, net durum.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_pending_payments",
    description: "Bekleyen ödemeleri getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Önümüzdeki kaç gün içindeki ödemeler (varsayılan: 30)" },
      },
    },
  },
  {
    name: "get_profitability",
    description: "Kârlılık verilerini (gelir tablosu / P&L) getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: { type: "string", description: "Dönem kodu (ör: 2026_01). Belirtilmezse en son dönem." },
      },
    },
  },
  {
    name: "get_sales_summary",
    description: "Satış özetini getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Son kaç gün (varsayılan: 30)" },
      },
    },
  },
  {
    name: "get_ikas_orders",
    description: "İkas (vigowood.com) siparişlerini getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Son kaç gün (varsayılan: 7)" },
        status: { type: "string", description: "Opsiyonel durum filtresi" },
      },
    },
  },
  {
    name: "get_tasks_summary",
    description: "Ops Center görev özetini getirir.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["scheduled", "queue", "in_progress", "done"], description: "Opsiyonel durum filtresi" },
      },
    },
  },
];

// ─── Tool Executor Functions ─────────────────────────────────

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function executeTool(
  supabase: AdminClient,
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  switch (toolName) {
    case "search_products": {
      const q = String(input.query ?? "");
      const { data } = await supabase
        .from("products")
        .select("sku, urun_adi, kategori, stok_aktif, mamul_stok_kritik, aktif_mi")
        .or(`urun_adi.ilike.%${q}%,sku.ilike.%${q}%`)
        .limit(20);
      return data ?? [];
    }

    case "get_product_stock": {
      const sku = input.sku as string | undefined;
      let query = supabase
        .from("products")
        .select("sku, urun_adi, stok_aktif, mamul_stok_kritik, aktif_mi, kategori")
        .eq("aktif_mi", true);
      if (sku) {
        query = query.eq("sku", sku);
      } else {
        query = query.order("stok_aktif", { ascending: true }).limit(30);
      }
      const { data } = await query;
      return data ?? [];
    }

    case "get_critical_stock": {
      const type = input.type as string | undefined;

      if (!type || type === "mamul") {
        const { data } = await supabase.rpc("get_critical_mamul_stock" as never);
        if (data) return data as ToolResult;
        // Fallback: manual query
        const { data: products } = await supabase
          .from("products")
          .select("sku, urun_adi, stok_aktif, mamul_stok_kritik")
          .eq("aktif_mi", true)
          .not("mamul_stok_kritik", "is", null)
          .order("stok_aktif", { ascending: true })
          .limit(50);
        // Filter where stok_aktif < mamul_stok_kritik
        const critical = (products ?? []).filter(
          (p) => p.mamul_stok_kritik != null && (p.stok_aktif ?? 0) < p.mamul_stok_kritik
        );
        return critical;
      }

      if (type === "yari_mamul") {
        const { data } = await supabase
          .from("all_parts")
          .select("part_id, part_adi, yari_mamul_stok, hazir_eleman_kritik_stok, part_type")
          .eq("part_type", "YARIMAMUL")
          .not("hazir_eleman_kritik_stok", "is", null)
          .order("yari_mamul_stok", { ascending: true })
          .limit(50);
        const critical = (data ?? []).filter(
          (p) => p.hazir_eleman_kritik_stok != null && (p.yari_mamul_stok ?? 0) < p.hazir_eleman_kritik_stok
        );
        return critical;
      }

      if (type === "hazir_eleman") {
        const { data } = await supabase
          .from("all_parts")
          .select("part_id, part_adi, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok, part_type")
          .in("part_type", ["HAZIR", "KUTU", "KARTON"])
          .not("hazir_eleman_kritik_stok", "is", null)
          .order("hazir_eleman_aktif_stok", { ascending: true })
          .limit(50);
        const critical = (data ?? []).filter(
          (p) => p.hazir_eleman_kritik_stok != null && (p.hazir_eleman_aktif_stok ?? 0) < p.hazir_eleman_kritik_stok
        );
        return critical;
      }

      return "Geçersiz stok türü. mamul, yari_mamul veya hazir_eleman olmalı.";
    }

    case "get_stock_movements": {
      const sku = input.sku as string | undefined;
      const days = Number(input.days) || 7;
      let query = supabase
        .from("stock_movements")
        .select("mov_id, sku, qty, source, tarih, batch_id")
        .gte("tarih", daysAgo(days).split("T")[0])
        .order("tarih", { ascending: false })
        .limit(50);
      if (sku) {
        query = query.eq("sku", sku);
      }
      const { data } = await query;
      return data ?? [];
    }

    case "get_yari_mamul_summary": {
      const partId = input.part_id as string | undefined;
      let query = supabase
        .from("all_parts")
        .select("part_id, part_adi, yari_mamul_stok, part_type")
        .eq("part_type", "YARIMAMUL")
        .order("yari_mamul_stok", { ascending: true });
      if (partId) {
        query = query.eq("part_id", partId);
      } else {
        query = query.limit(40);
      }
      const { data } = await query;
      return data ?? [];
    }

    case "get_daily_production": {
      const days = Number(input.days) || 1;
      const since = daysAgo(days).split("T")[0];

      const [cutRes, montajRes, packRes] = await Promise.all([
        supabase
          .from("cut_batches")
          .select("cut_id, sku, adet, durum, tarih, makine_id")
          .gte("tarih", since)
          .order("tarih", { ascending: false })
          .limit(30),
        supabase
          .from("montaj_sessions")
          .select("session_id, sku, step_name, qty, durum, start_time")
          .gte("created_at", daysAgo(days))
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("pack_events")
          .select("session_id, sku, qty, durum, tarih")
          .gte("tarih", since)
          .order("tarih", { ascending: false })
          .limit(30),
      ]);

      return {
        kesim: { count: cutRes.data?.length ?? 0, items: cutRes.data ?? [] },
        montaj: { count: montajRes.data?.length ?? 0, items: montajRes.data ?? [] },
        paketleme: { count: packRes.data?.length ?? 0, items: packRes.data ?? [] },
      };
    }

    case "get_cut_batches": {
      const days = Number(input.days) || 7;
      const status = input.status as string | undefined;
      let query = supabase
        .from("cut_batches")
        .select("cut_id, sku, plaka_id, adet, durum, tarih, makine_id, baslama_zamani, bitis_zamani")
        .gte("tarih", daysAgo(days).split("T")[0])
        .order("tarih", { ascending: false })
        .limit(30);
      if (status) {
        query = query.eq("durum", status);
      }
      const { data } = await query;
      return data ?? [];
    }

    case "get_montaj_sessions": {
      const days = Number(input.days) || 7;
      const status = input.status as string | undefined;
      let query = supabase
        .from("montaj_sessions")
        .select("session_id, sku, step_name, qty, durum, operator_name, start_time, end_time, worker_count, is_final_step")
        .gte("created_at", daysAgo(days))
        .order("created_at", { ascending: false })
        .limit(30);
      if (status) {
        query = query.eq("durum", status);
      }
      const { data } = await query;
      return data ?? [];
    }

    case "get_pack_events": {
      const days = Number(input.days) || 7;
      const { data } = await supabase
        .from("pack_events")
        .select("session_id, sku, qty, durum, tarih, operator_name, start_time, end_time")
        .gte("tarih", daysAgo(days).split("T")[0])
        .order("tarih", { ascending: false })
        .limit(30);
      return data ?? [];
    }

    case "get_shipments": {
      const status = input.status as string | undefined;
      let query = supabase
        .from("sevkiyat")
        .select("sevkiyat_id, sevkiyat_adi, musteri, ulke, durum, planlanan_sevk_tarihi, konteyner_no, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (status) {
        query = query.eq("durum", status);
      }
      const { data } = await query;
      return data ?? [];
    }

    case "get_shipment_detail": {
      const sevkiyatId = String(input.sevkiyat_id);
      const { data } = await supabase
        .from("sevkiyat")
        .select("*, sevkiyat_items(*)")
        .eq("sevkiyat_id", sevkiyatId)
        .single();
      return data ?? "Sevkiyat bulunamadı";
    }

    case "get_cash_position": {
      const { data: donemler } = await supabase
        .from("nakit_donemler")
        .select("*")
        .order("bitis_tarihi", { ascending: false })
        .limit(1);

      if (!donemler || donemler.length === 0) return "Nakit dönem verisi bulunamadı.";

      const donem = donemler[0];
      return {
        donem_kodu: donem.donem_kodu,
        varlik_tl: donem.varlik_tl,
        varlik_usd: donem.varlik_usd,
        nakit_giris_tl: donem.nakit_giris_tl,
        nakit_cikis_tl: donem.nakit_cikis_tl,
        nakit_giris_usd: donem.nakit_giris_usd,
        nakit_cikis_usd: donem.nakit_cikis_usd,
        toplam_piyasa_borcu: donem.toplam_piyasa_borcu,
        toplam_kk_borc: donem.toplam_kk_borc,
        toplam_finansal_borc: donem.toplam_finansal_borc,
        toplam_varlik_tl: donem.toplam_varlik_tl,
        kur_bilgisi: donem.kur_bilgisi,
      };
    }

    case "get_pending_payments": {
      const days = Number(input.days) || 30;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const { data } = await supabase
        .from("odemeler")
        .select("id, tanimi, tutar, cinsi, tarih, turu, odeme_durum")
        .eq("odeme_durum", "BEKLİYOR")
        .lte("tarih", futureDate.toISOString().split("T")[0])
        .order("tarih", { ascending: true })
        .limit(50);
      return data ?? [];
    }

    case "get_profitability": {
      const period = input.period as string | undefined;
      let donemId = period;

      if (!donemId) {
        const { data: latest } = await supabase
          .from("karlilik_data")
          .select("donem_id")
          .order("created_at", { ascending: false })
          .limit(1);
        donemId = latest?.[0]?.donem_id ?? undefined;
      }

      if (!donemId) return "Kârlılık verisi bulunamadı.";

      const { data } = await supabase
        .from("karlilik_data")
        .select("kalem, kalem_turu, marka, tl, usd, sira")
        .eq("donem_id", donemId)
        .order("sira", { ascending: true })
        .limit(80);
      return data ?? [];
    }

    case "get_sales_summary": {
      const days = Number(input.days) || 30;
      // Try satis_giris for recent period data
      const { data } = await supabase
        .from("satis_giris")
        .select("marka, kanal, pazaryeri, tl_satislar, usd_satislar, donem_id")
        .order("created_at", { ascending: false })
        .limit(40);
      if (data && data.length > 0) return data;

      // Fallback: ikas_orders as sales proxy
      const { data: ikas } = await supabase
        .from("ikas_orders")
        .select("order_number, status, total_price, currency, ikas_created_at")
        .gte("ikas_created_at", daysAgo(days))
        .order("ikas_created_at", { ascending: false })
        .limit(30);
      return ikas ?? [];
    }

    case "get_ikas_orders": {
      const days = Number(input.days) || 7;
      const status = input.status as string | undefined;
      let query = supabase
        .from("ikas_orders")
        .select("order_number, status, total_price, currency, city, country, ikas_created_at")
        .gte("ikas_created_at", daysAgo(days))
        .order("ikas_created_at", { ascending: false })
        .limit(30);
      if (status) {
        query = query.eq("status", status);
      }
      const { data } = await query;
      return data ?? [];
    }

    case "get_tasks_summary": {
      const status = input.status as string | undefined;
      let query = supabase
        .from("tasks")
        .select("id, title, status, priority, department, assigned_to, due_date, is_blocked, is_waiting_approval")
        .order("created_at", { ascending: false })
        .limit(20);
      if (status) {
        query = query.eq("status", status as Database["public"]["Enums"]["task_status"]);
      }
      const { data } = await query;
      return data ?? [];
    }

    default:
      return `Bilinmeyen araç: ${toolName}`;
  }
}

// ─── Build Tools for Agent ───────────────────────────────────

function getToolsForAgent(department: string): Anthropic.Tool[] {
  const allowedNames = new Set([
    ...COMMON_TOOLS,
    ...(DEPARTMENT_TOOLS[department] ?? DEPARTMENT_TOOLS.genel),
  ]);
  return ALL_TOOL_DEFINITIONS.filter((t) => allowedNames.has(t.name));
}

// ─── System Prompt Builder ───────────────────────────────────

function buildSystemPrompt(agent: {
  name: string;
  department: string;
  description: string | null;
  capabilities: string[];
}): string {
  return `Sen ${agent.name} adında bir VigoWood iş asistanısın.
Departman: ${agent.department}
${agent.description ? `Görev: ${agent.description}` : ""}
${agent.capabilities.length > 0 ? `Yetenekler: ${agent.capabilities.join(", ")}` : ""}

## Kurallar
- Türkçe yanıt ver. Teknik terimleri olduğu gibi kullanabilirsin (SKU, batch, stok vb.)
- Kullanıcının sorusuna veritabanından gerçek veri çekerek yanıt ver. Tahmin YAPMA.
- Veri yoksa "Bu bilgiyi bulamadım" de, uydurma.
- Sayıları Türkçe formatta göster (1.234,56 gibi)
- Para birimlerini belirt (₺ veya $)
- Tarihleri GG.AA.YYYY formatında göster
- Yanıtlarını kısa ve öz tut. Tablo formatı kullanabilirsin.
- Kullanıcıya her zaman saygılı ve yardımsever ol.

## VigoWood Hakkında
- Ahşap mobilya üretim firması
- Markalar: VIGO WOOD (ana), HAS-MOB (kardeş firma)
- Üretim akışı: MDF Plaka → Kesim → Temizlik → Montaj → Paketleme → Sevkiyat
- Stok katmanları: Mamül (bitmiş ürün), Yarı Mamül (kesilen parça), Hazır Eleman (aksesuar), Kutu/Karton

Bugünün tarihi: ${new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}.`;
}

// ─── Cost Calculation ────────────────────────────────────────

function calculateCost(usage: { input_tokens: number; output_tokens: number }): number {
  // Claude Sonnet 4 pricing (approximate)
  const inputCost = (usage.input_tokens / 1_000_000) * 3;
  const outputCost = (usage.output_tokens / 1_000_000) * 15;
  return inputCost + outputCost;
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(request: Request) {
  // Rate limit: 10 msg/dk per IP
  const rl = rateLimit(getRateLimitKey(request, "ops-chat"), {
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Çok fazla istek. Lütfen biraz bekleyin." }, { status: 429 });
  }

  try {
    // Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const body = await request.json();
    const agentId = body.agentId as string;
    if (!agentId) {
      return NextResponse.json({ error: "agentId gerekli" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI servisi yapılandırılmamış" }, { status: 500 });
    }

    const supabase = createAdminClient();

    // Fetch agent profile
    const { data: agent } = await supabase
      .from("ops_agents")
      .select("id, name, code, department, description, capabilities")
      .eq("id", agentId)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Asistan bulunamadı" }, { status: 404 });
    }

    // Fetch recent messages (last 20)
    const { data: chatHistory } = await supabase
      .from("agent_chats")
      .select("role, content")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!chatHistory || chatHistory.length === 0) {
      return NextResponse.json({ error: "Mesaj bulunamadı" }, { status: 400 });
    }

    // Check last message is from user (prevent duplicate responses)
    const lastMsg = chatHistory[chatHistory.length - 1];
    if (lastMsg.role !== "user") {
      return NextResponse.json({ error: "Son mesaj zaten asistandan" }, { status: 400 });
    }

    // Build Claude messages
    const claudeMessages: Anthropic.MessageParam[] = chatHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Ensure first message is from user (Claude API requirement)
    if (claudeMessages[0]?.role !== "user") {
      claudeMessages.shift();
    }

    // Get tools for this agent's department
    const tools = getToolsForAgent(agent.department);
    const systemPrompt = buildSystemPrompt({
      name: agent.name,
      department: agent.department,
      description: agent.description,
      capabilities: Array.isArray(agent.capabilities) ? agent.capabilities as string[] : [],
    });

    // Create Anthropic client
    const anthropic = new Anthropic({ apiKey });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Initial Claude call
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages: claudeMessages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Tool use loop (max 3 iterations)
    let iterations = 0;
    const MAX_ITERATIONS = 3;

    while (response.stop_reason === "tool_use" && iterations < MAX_ITERATIONS) {
      iterations++;

      // Find tool use blocks
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

      if (toolUseBlocks.length === 0) break;

      // Execute all tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolBlock of toolUseBlocks) {
        if (toolBlock.type !== "tool_use") continue;
        const result = await executeTool(supabase, toolBlock.name, toolBlock.input as Record<string, unknown>);
        const resultStr = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        // Truncate if too long (prevent context overflow)
        const truncated = resultStr.length > 8000
          ? resultStr.slice(0, 8000) + "\n...[sonuç kısaltıldı]"
          : resultStr;
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: truncated,
        });
      }

      // Add assistant message + tool results to conversation
      claudeMessages.push({
        role: "assistant",
        content: response.content.map((b) => {
          if (b.type === "text") return { type: "text" as const, text: b.text };
          if (b.type === "tool_use") return { type: "tool_use" as const, id: b.id, name: b.name, input: b.input };
          return b as unknown as Anthropic.ContentBlockParam;
        }),
      });
      claudeMessages.push({
        role: "user",
        content: toolResults,
      });

      // Call Claude again with tool results
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages: claudeMessages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const finalText = textBlocks.map((b) => b.text).join("\n\n") || "Yanıt oluşturulamadı.";

    const totalTokens = totalInputTokens + totalOutputTokens;
    const costEstimate = calculateCost({ input_tokens: totalInputTokens, output_tokens: totalOutputTokens });

    // Insert assistant response
    await supabase.from("agent_chats").insert({
      agent_id: agentId,
      user_id: null,
      role: "assistant",
      content: finalText,
      metadata: {
        model: "claude-sonnet-4-20250514",
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        total_tokens: totalTokens,
        cost_estimate: costEstimate,
        tool_calls: iterations,
      },
    });

    // Log to agent_actions for usage tracking
    await supabase.from("agent_actions").insert({
      agent_id: agent.code,
      action_type: "chat_response",
      tokens_used: totalTokens,
      cost_estimate: costEstimate,
      duration_ms: null,
      result: "success",
      input: { user_message: lastMsg.content.slice(0, 200) },
      output: { response_length: finalText.length, tool_calls: iterations },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ops/chat] Error:", error);
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
