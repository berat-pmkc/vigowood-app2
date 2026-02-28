/**
 * Trendyol Query Layer — Server-only
 * DB'den veri okur, camelCase type'lara map eder.
 * Client component'ler DEĞİŞMEZ — aynı tip yapısını döndürür.
 */
import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Trendyol tables are not yet in generated types — use untyped client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUntypedClient(): Promise<SupabaseClient<any>> {
  return await createClient() as SupabaseClient<any>;
}
import type {
  TrendyolOrder,
  TrendyolOrderLine,
  TrendyolProduct,
  TrendyolQuestion,
  TrendyolAnswer,
  TrendyolSettlement,
  TrendyolPaginatedResponse,
  TrendyolOrderStatus,
  TrendyolQuestionStatus,
  TrendyolClaim,
  TrendyolClaimStatus,
  TrendyolClaimItem,
} from "./types";

// ─── Row Types (DB snake_case) ───────────────────────────

interface OrderRow {
  id: number;
  order_number: string;
  customer_id: number | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  gross_amount: number;
  total_discount: number;
  total_price: number;
  status: string;
  shipment_address: Record<string, unknown> | null;
  invoice_address: Record<string, unknown> | null;
  cargo_tracking_number: number | null;
  cargo_tracking_link: string | null;
  cargo_provider_name: string | null;
  cargo_sender_number: string | null;
  delivery_type: string | null;
  order_date: number;
  last_modified_date: number | null;
  package_histories: Array<{ createdDate: number; status: string }> | null;
  raw_data: Record<string, unknown> | null;
}

interface OrderLineRow {
  id: number;
  order_id: number;
  line_id: number | null;
  quantity: number;
  merchant_sku: string | null;
  sku: string | null;
  stock_code: string | null;
  product_name: string;
  barcode: string | null;
  amount: number;
  discount: number;
  currency_code: string;
  vat_base_amount: number;
  vat_rate: number | null;
  price: number;
  status_name: string | null;
  commission: number | null;
  product_size: string | null;
  product_color: string | null;
  image_url: string | null;
}

interface ProductRow {
  id: string;
  barcode: string;
  title: string;
  description: string | null;
  product_main_id: string | null;
  brand: string | null;
  brand_id: number | null;
  category_name: string | null;
  category_id: number | null;
  quantity: number;
  stock_code: string | null;
  dimensional_weight: number | null;
  list_price: number;
  sale_price: number;
  vat_rate: number | null;
  images: Array<{ url: string }> | null;
  attributes: Array<Record<string, unknown>> | null;
  approved: boolean;
  archived: boolean;
  on_sale: boolean;
  locked: boolean;
  rejected: boolean;
  blacklisted: boolean;
  create_date_time: number | null;
  last_update_date: number | null;
}

interface QuestionRow {
  id: number;
  text: string;
  status: string;
  creation_date: number;
  customer_id: number | null;
  user_name: string | null;
  product_name: string | null;
  product_main_id: string | null;
  image_url: string | null;
  public: boolean;
  answer_text: string | null;
  answer_date: number | null;
  rejected_answer_text: string | null;
  rejected_answer_reason: string | null;
  web_url: string | null;
}

interface SettlementRow {
  id: number;
  transaction_date: string | null;
  transaction_type: string;
  debt: number;
  credit: number;
  receipt_id: string | null;
  barcode: string | null;
  payment_order_id: string | null;
  payment_date: string | null;
  commission_rate: number | null;
  commission_amount: number | null;
  seller_revenue: number | null;
  order_number: string | null;
  affiliate: string | null;
  shipment_package_id: number | null;
}

// ─── Settlement Normalization ────────────────────────────
// Trendyol API returns Turkish transaction types — normalize to English
const TR_TO_EN_TYPE: Record<string, string> = {
  "Satış": "Sale",
  "İade": "Return",
  "İndirim": "Discount",
  "İndirimİptal": "DiscountCancel",
  "Kupon": "Coupon",
  "KuponİIptal": "CouponCancel",
  "KomisyonArtı": "CommissionPositive",
  "KomisyonEksi": "CommissionNegative",
  "TYİndirim": "TYDiscount",
  "TYİndirimİptal": "TYDiscountCancel",
  "SatıcıGelirArtı": "SellerRevenuePositive",
  "SatıcıGelirEksi": "SellerRevenueNegative",
};

/** Convert timestamp string (ms) to ISO date string */
function tsToISO(ts: string | null): string {
  if (!ts) return "";
  // If it looks like an ISO date (contains '-' or 'T'), return as-is
  if (ts.includes("-") || ts.includes("T")) return ts;
  const n = parseInt(ts, 10);
  if (isNaN(n)) return ts;
  return new Date(n).toISOString();
}

// ─── Mappers ─────────────────────────────────────────────

function mapLineRow(row: OrderLineRow): TrendyolOrderLine {
  return {
    id: row.id,
    lineId: row.line_id ?? undefined,
    quantity: row.quantity,
    merchantSku: row.merchant_sku || "",
    sku: row.sku ?? undefined,
    stockCode: row.stock_code ?? undefined,
    productName: row.product_name,
    barcode: row.barcode || "",
    amount: row.amount,
    discount: row.discount,
    currencyCode: row.currency_code,
    vatBaseAmount: row.vat_base_amount,
    vatRate: row.vat_rate ?? undefined,
    price: row.price,
    orderLineItemStatusName: row.status_name || "",
    commission: row.commission ?? undefined,
    productSize: row.product_size ?? undefined,
    productColor: row.product_color ?? undefined,
    imageUrl: row.image_url ?? undefined,
  };
}

function mapOrderRow(row: OrderRow, lines: OrderLineRow[]): TrendyolOrder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addr = (a: any) => a || {
    firstName: "", lastName: "", address1: "", city: "", cityCode: 0,
    district: "", postalCode: "", countryCode: "TR", fullAddress: "",
  };

  return {
    id: row.id,
    shipmentPackageId: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id || 0,
    customerFirstName: row.customer_first_name || "",
    customerLastName: row.customer_last_name || "",
    customerEmail: row.customer_email ?? undefined,
    grossAmount: row.gross_amount,
    totalDiscount: row.total_discount,
    totalPrice: row.total_price,
    status: row.status as TrendyolOrderStatus,
    shipmentAddress: addr(row.shipment_address),
    invoiceAddress: addr(row.invoice_address),
    cargoTrackingNumber: row.cargo_tracking_number ?? undefined,
    cargoTrackingLink: row.cargo_tracking_link ?? undefined,
    cargoProviderName: row.cargo_provider_name ?? undefined,
    cargoSenderNumber: row.cargo_sender_number ?? undefined,
    deliveryType: row.delivery_type ?? undefined,
    orderDate: row.order_date,
    shipmentPackageStatus: row.status,
    lastModifiedDate: row.last_modified_date || row.order_date,
    lines: lines.filter((l) => l.order_id === row.id).map(mapLineRow),
    packageHistories: row.package_histories ?? undefined,
  };
}

function mapProductRow(row: ProductRow): TrendyolProduct {
  return {
    id: row.id,
    barcode: row.barcode,
    title: row.title,
    description: row.description ?? undefined,
    productMainId: row.product_main_id ?? undefined,
    brand: row.brand ?? undefined,
    brandId: row.brand_id ?? undefined,
    categoryName: row.category_name ?? undefined,
    categoryId: row.category_id ?? undefined,
    quantity: row.quantity,
    stockCode: row.stock_code ?? undefined,
    dimensionalWeight: row.dimensional_weight ?? undefined,
    listPrice: row.list_price,
    salePrice: row.sale_price,
    vatRate: row.vat_rate ?? undefined,
    images: row.images ?? undefined,
    attributes: row.attributes as unknown as TrendyolProduct["attributes"],
    approved: row.approved,
    archived: row.archived,
    onSale: row.on_sale,
    locked: row.locked,
    rejected: row.rejected,
    blacklisted: row.blacklisted,
    createDateTime: row.create_date_time ?? undefined,
    lastUpdateDate: row.last_update_date ?? undefined,
  };
}

function mapQuestionRow(row: QuestionRow): TrendyolQuestion {
  let answer: TrendyolAnswer | undefined;
  if (row.answer_text) {
    answer = {
      id: 0,
      text: row.answer_text,
      creationDate: row.answer_date || 0,
    };
  }

  let rejectedAnswer: TrendyolQuestion["rejectedAnswer"];
  if (row.rejected_answer_text) {
    rejectedAnswer = {
      id: 0,
      text: row.rejected_answer_text,
      creationDate: 0,
      reason: row.rejected_answer_reason ?? undefined,
    };
  }

  return {
    id: row.id,
    text: row.text,
    status: row.status as TrendyolQuestionStatus,
    creationDate: row.creation_date,
    customerId: row.customer_id || 0,
    userName: row.user_name ?? undefined,
    productName: row.product_name ?? undefined,
    productMainId: row.product_main_id ?? undefined,
    imageUrl: row.image_url ?? undefined,
    public: row.public,
    answer,
    rejectedAnswer,
    webUrl: row.web_url ?? undefined,
  };
}

function mapSettlementRow(row: SettlementRow): TrendyolSettlement {
  // Normalize Turkish type → English
  const enType = TR_TO_EN_TYPE[row.transaction_type] || row.transaction_type;
  // Convert timestamp strings → ISO dates
  const txDate = tsToISO(row.transaction_date);
  const pmtDate = tsToISO(row.payment_date);

  return {
    id: row.id,
    transactionDate: txDate,
    transactionType: enType as TrendyolSettlement["transactionType"],
    debt: row.debt,
    credit: row.credit,
    receiptId: row.receipt_id ?? undefined,
    barcode: row.barcode ?? undefined,
    paymentOrderId: row.payment_order_id ?? undefined,
    paymentDate: pmtDate || undefined,
    commissionRate: row.commission_rate ?? undefined,
    commissionAmount: row.commission_amount ?? undefined,
    sellerRevenue: row.seller_revenue ?? undefined,
    orderNumber: row.order_number ?? undefined,
    affiliate: row.affiliate ?? undefined,
    shipmentPackageId: row.shipment_package_id ?? undefined,
  };
}

// ─── Query Functions ─────────────────────────────────────

interface OrderQueryParams {
  startDate?: number;
  endDate?: number;
  status?: TrendyolOrderStatus | "all";
  search?: string;
  page?: number;
  size?: number;
}

export async function getOrdersFromDB(
  params: OrderQueryParams = {}
): Promise<TrendyolPaginatedResponse<TrendyolOrder>> {
  const supabase = await getUntypedClient();
  const page = params.page || 0;
  const size = params.size || 50;
  const from = page * size;
  const to = from + size - 1;

  let query = supabase
    .from("trendyol_orders")
    .select("*", { count: "exact" });

  // Date filter (Trendyol timestamps are in ms)
  if (params.startDate) {
    query = query.gte("order_date", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("order_date", params.endDate);
  }

  // Status filter
  if (params.status && params.status !== "all") {
    if (params.status === "Cancelled") {
      // Include Cancelled, Returned, UnSupplied
      query = query.in("status", ["Cancelled", "Returned", "UnSupplied"]);
    } else {
      query = query.eq("status", params.status);
    }
  }

  // Search filter (order_number)
  if (params.search) {
    query = query.or(`order_number.ilike.%${params.search}%,customer_first_name.ilike.%${params.search}%,customer_last_name.ilike.%${params.search}%`);
  }

  query = query.order("order_date", { ascending: false }).range(from, to);

  const { data: orderRows, count, error } = await query;

  if (error || !orderRows) {
    console.error("[Trendyol DB] Orders query error:", error?.message);
    return { page, size, totalElements: 0, totalPages: 0, content: [] };
  }

  // Fetch order lines for these orders
  const orderIds = (orderRows as OrderRow[]).map((o) => o.id);
  let lineRows: OrderLineRow[] = [];

  if (orderIds.length > 0) {
    const { data: lines } = await supabase
      .from("trendyol_order_lines")
      .select("*")
      .in("order_id", orderIds);
    lineRows = (lines as OrderLineRow[]) || [];
  }

  const orders = (orderRows as OrderRow[]).map((row) =>
    mapOrderRow(row, lineRows)
  );

  const totalElements = count || 0;
  return {
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
    content: orders,
  };
}

interface ProductQueryParams {
  page?: number;
  size?: number;
  search?: string;
  approved?: boolean;
  onSale?: boolean;
}

export async function getProductsFromDB(
  params: ProductQueryParams = {}
): Promise<TrendyolPaginatedResponse<TrendyolProduct>> {
  const supabase = await getUntypedClient();
  const page = params.page || 0;
  const size = params.size || 50;
  const from = page * size;
  const to = from + size - 1;

  let query = supabase
    .from("trendyol_products")
    .select("*", { count: "exact" });

  if (params.approved !== undefined) {
    query = query.eq("approved", params.approved);
  }
  if (params.onSale !== undefined) {
    query = query.eq("on_sale", params.onSale);
  }
  if (params.search) {
    query = query.or(`title.ilike.%${params.search}%,barcode.ilike.%${params.search}%,stock_code.ilike.%${params.search}%`);
  }

  query = query.order("last_update_date", { ascending: false, nullsFirst: false }).range(from, to);

  const { data, count, error } = await query;

  if (error || !data) {
    console.error("[Trendyol DB] Products query error:", error?.message);
    return { page, size, totalElements: 0, totalPages: 0, content: [] };
  }

  const products = (data as ProductRow[]).map(mapProductRow);
  const totalElements = count || 0;

  return {
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
    content: products,
  };
}

interface QuestionQueryParams {
  page?: number;
  size?: number;
  status?: TrendyolQuestionStatus | "all";
}

export async function getQuestionsFromDB(
  params: QuestionQueryParams = {}
): Promise<TrendyolPaginatedResponse<TrendyolQuestion>> {
  const supabase = await getUntypedClient();
  const page = params.page || 0;
  const size = params.size || 50;
  const from = page * size;
  const to = from + size - 1;

  let query = supabase
    .from("trendyol_questions")
    .select("*", { count: "exact" });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  query = query.order("creation_date", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error || !data) {
    console.error("[Trendyol DB] Questions query error:", error?.message);
    return { page, size, totalElements: 0, totalPages: 0, content: [] };
  }

  const questions = (data as QuestionRow[]).map(mapQuestionRow);
  const totalElements = count || 0;

  return {
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
    content: questions,
  };
}

interface SettlementQueryParams {
  startDate?: number;
  endDate?: number;
  transactionType?: string;
  page?: number;
  size?: number;
}

export async function getSettlementsFromDB(
  params: SettlementQueryParams = {}
): Promise<TrendyolPaginatedResponse<TrendyolSettlement>> {
  const supabase = await getUntypedClient();
  const page = params.page || 0;
  const size = params.size || 500;
  const from = page * size;
  const to = from + size - 1;

  let query = supabase
    .from("trendyol_settlements")
    .select("*", { count: "exact" });

  // Date filter: transaction_date is stored as ms-timestamp string (e.g. "1770632955335")
  // Compare as strings — works for same-length 13-digit timestamps
  if (params.startDate) {
    query = query.gte("transaction_date", String(params.startDate));
  }
  if (params.endDate) {
    query = query.lte("transaction_date", String(params.endDate));
  }

  // transaction_type: DB has Turkish values (Satış, İade, etc.)
  // Don't filter — mapper normalizes Turkish→English, aggregation handles filtering

  query = query.order("transaction_date", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error || !data) {
    console.error("[Trendyol DB] Settlements query error:", error?.message);
    return { page, size, totalElements: 0, totalPages: 0, content: [] };
  }

  const settlements = (data as SettlementRow[]).map(mapSettlementRow);
  const totalElements = count || 0;

  return {
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
    content: settlements,
  };
}

// ─── Sync Status ─────────────────────────────────────────

export interface SyncStatus {
  entityType: string;
  lastSyncAt: string | null;
  status: string;
  recordsSynced: number;
  errorMessage: string | null;
}

export async function getLastSyncStatus(
  entityType?: string
): Promise<SyncStatus[]> {
  const supabase = await getUntypedClient();

  const entities = entityType
    ? [entityType]
    : ["orders", "products", "questions", "settlements"];

  const results: SyncStatus[] = [];

  for (const entity of entities) {
    const { data } = await supabase
      .from("trendyol_sync_log")
      .select("entity_type, status, completed_at, records_synced, error_message")
      .eq("entity_type", entity)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    results.push({
      entityType: entity,
      lastSyncAt: data?.completed_at || null,
      status: data?.status || "never",
      recordsSynced: data?.records_synced || 0,
      errorMessage: data?.error_message || null,
    });
  }

  return results;
}

/** Convenience: get the overall last sync time (most recent across all entities) */
export async function getOverallLastSyncAt(): Promise<string | null> {
  const supabase = await getUntypedClient();
  const { data } = await supabase
    .from("trendyol_sync_log")
    .select("completed_at")
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.completed_at || null;
}

/** Get last sync info including error message if failed */
export async function getLastSyncInfo(): Promise<{
  lastSuccessAt: string | null;
  lastErrorMsg: string | null;
  lastErrorAt: string | null;
}> {
  const supabase = await getUntypedClient();

  const [successRes, errorRes] = await Promise.all([
    supabase
      .from("trendyol_sync_log")
      .select("completed_at")
      .eq("status", "success")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("trendyol_sync_log")
      .select("completed_at, error_message, entity_type")
      .eq("status", "error")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lastSuccessAt = successRes.data?.completed_at || null;
  const lastErrorMsg = errorRes.data?.error_message || null;
  const lastErrorAt = errorRes.data?.completed_at || null;

  // Only surface the error if it happened AFTER the last success
  const errorIsRecent =
    lastErrorAt &&
    (!lastSuccessAt || new Date(lastErrorAt) > new Date(lastSuccessAt));

  return {
    lastSuccessAt,
    lastErrorMsg: errorIsRecent ? lastErrorMsg : null,
    lastErrorAt: errorIsRecent ? lastErrorAt : null,
  };
}

/** Check if DB has any data (at least 1 order synced) */
export async function hasAnyData(): Promise<boolean> {
  const supabase = await getUntypedClient();
  const { count } = await supabase
    .from("trendyol_orders")
    .select("id", { count: "exact", head: true });
  return (count || 0) > 0;
}

// ─── Claims ───────────────────────────────────────────────

interface ClaimRow {
  id: string;
  order_number: string;
  status: string;
  claim_date: number;
  shipment_package_id: number | null;
  cargo_tracking_number: string | null;
  items: TrendyolClaimItem[];
  created_at: string;
  updated_at: string;
}

function mapClaimRow(row: ClaimRow): TrendyolClaim {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status as TrendyolClaimStatus,
    claimDate: row.claim_date,
    shipmentPackageId: row.shipment_package_id ?? undefined,
    cargoTrackingNumber: row.cargo_tracking_number ?? undefined,
    items: row.items || [],
  };
}

interface ClaimQueryParams {
  startDate?: number;
  endDate?: number;
  status?: TrendyolClaimStatus | "all";
  search?: string;
  page?: number;
  size?: number;
}

export async function getClaimsFromDB(
  params: ClaimQueryParams = {}
): Promise<TrendyolPaginatedResponse<TrendyolClaim>> {
  const supabase = await getUntypedClient();
  const page = params.page || 0;
  const size = params.size || 50;
  const from = page * size;
  const to = from + size - 1;

  let query = supabase
    .from("trendyol_claims")
    .select("*", { count: "exact" });

  if (params.startDate) {
    query = query.gte("claim_date", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("claim_date", params.endDate);
  }
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.search) {
    query = query.or(`order_number.ilike.%${params.search}%,id.ilike.%${params.search}%`);
  }

  query = query.order("claim_date", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error || !data) {
    console.error("[Trendyol DB] Claims query error:", error?.message);
    return { page, size, totalElements: 0, totalPages: 0, content: [] };
  }

  const claims = (data as ClaimRow[]).map(mapClaimRow);
  const totalElements = count || 0;

  return {
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
    content: claims,
  };
}

/** Aktif (reddedilmemiş, iptal edilmemiş) claim sayısını döner — dashboard KPI için */
export async function getActiveClaimsCount(): Promise<number> {
  const supabase = await getUntypedClient();
  const { count } = await supabase
    .from("trendyol_claims")
    .select("id", { count: "exact", head: true })
    .not("status", "in", '("Rejected","Cancelled")');
  return count || 0;
}

// ─── Other Financials ────────────────────────────────────

export interface OtherFinancialRow {
  id: string;
  transaction_date: string | null;
  transaction_type: string;
  debt: number;
  credit: number;
  description: string | null;
  created_at: string;
}

export async function getOtherFinancialsFromDB(params?: {
  startDate?: number;
  endDate?: number;
  transactionType?: string;
  page?: number;
  size?: number;
}): Promise<{ data: OtherFinancialRow[]; count: number }> {
  const supabase = await getUntypedClient();
  const page = params?.page || 0;
  const size = params?.size || 500;
  const from = page * size;
  const to = from + size - 1;

  let query = supabase
    .from("trendyol_other_financials")
    .select("*", { count: "exact" });

  if (params?.startDate) {
    query = query.gte("transaction_date", String(params.startDate));
  }
  if (params?.endDate) {
    query = query.lte("transaction_date", String(params.endDate));
  }
  if (params?.transactionType) {
    query = query.eq("transaction_type", params.transactionType);
  }

  query = query.order("transaction_date", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error || !data) {
    console.error("[Trendyol DB] OtherFinancials query error:", error?.message);
    return { data: [], count: 0 };
  }

  return { data: data as OtherFinancialRow[], count: count || 0 };
}
