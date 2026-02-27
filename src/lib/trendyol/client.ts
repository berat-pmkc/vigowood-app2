/**
 * Trendyol API Client — Server-only
 * Basic Auth, rate limit tracking, error handling.
 * No mock data — API hata verirse hata döner, sahte veri döndürmez.
 */
import "server-only";

import type {
  TrendyolPaginatedResponse,
  TrendyolOrder,
  TrendyolOrderParams,
  TrendyolProduct,
  TrendyolProductParams,
  TrendyolQuestion,
  TrendyolQuestionParams,
  TrendyolSettlement,
  TrendyolSettlementParams,
  TrendyolOtherFinancial,
  TrendyolStockPriceItem,
  TrendyolUpdatePackageParams,
  TrendyolUpdateTrackingParams,
  TrendyolClaim,
  TrendyolApiError,
} from "./types";

// ─── Config ──────────────────────────────────────────────
const BASE_URL = "https://apigw.trendyol.com/integration";

function getConfig() {
  const apiKey = process.env.TRENDYOL_API_KEY?.trim().replace(/^"|"$/g, "");
  const apiSecret = process.env.TRENDYOL_API_SECRET?.trim().replace(/^"|"$/g, "");
  const sellerId = process.env.TRENDYOL_SELLER_ID?.trim().replace(/^"|"$/g, "");

  if (!apiKey || !apiSecret || !sellerId) {
    throw new Error("Trendyol API credentials not configured. Check TRENDYOL_API_KEY, TRENDYOL_API_SECRET, TRENDYOL_SELLER_ID in .env.local");
  }

  return { apiKey, apiSecret, sellerId };
}

function getAuthHeader() {
  const { apiKey, apiSecret } = getConfig();
  const encoded = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

function getUserAgent() {
  const { sellerId } = getConfig();
  return `${sellerId} - SelfIntegration`;
}

// ─── Rate Limiting ───────────────────────────────────────
// Trendyol: max 1000 requests per minute (docs 2025)
// We cap at 80/10s = 480/min — well under the limit
const requestTimestamps: Map<string, number[]> = new Map();

function checkRateLimit(endpoint: string): boolean {
  const now = Date.now();
  const windowMs = 10_000; // 10 seconds
  const maxRequests = 80; // stay under 1000/min (= 166/10s)

  const timestamps = requestTimestamps.get(endpoint) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxRequests) {
    return false;
  }

  recent.push(now);
  requestTimestamps.set(endpoint, recent);
  return true;
}

// ─── Fetch Wrapper ───────────────────────────────────────
interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

async function trendyolFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = "GET", body, params } = options;

  // Rate limit check
  const endpointKey = path.split("?")[0];
  if (!checkRateLimit(endpointKey)) {
    throw new TrendyolError(429, "Rate limit exceeded. Try again in a few seconds.");
  }

  // Build URL with query params
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: getAuthHeader(),
    "User-Agent": getUserAgent(),
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    next: { revalidate: 0 }, // no cache
  };

  if (body && (method === "POST" || method === "PUT" || method === "DELETE")) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), fetchOptions);

  // Handle empty responses (204, some PUTs)
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T;
  }

  const text = await response.text();

  if (!response.ok) {
    let errorMessage = `Trendyol API Error: ${response.status}`;
    try {
      const errorBody = JSON.parse(text) as TrendyolApiError;
      errorMessage = errorBody.message || errorMessage;
    } catch {
      errorMessage = text || errorMessage;
    }
    throw new TrendyolError(response.status, errorMessage);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export class TrendyolError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TrendyolError";
    this.status = status;
  }
}

// ─── Orders ──────────────────────────────────────────────
export async function getOrders(
  params?: TrendyolOrderParams
): Promise<TrendyolPaginatedResponse<TrendyolOrder>> {
  const { sellerId } = getConfig();
  return trendyolFetch<TrendyolPaginatedResponse<TrendyolOrder>>(
    `/order/sellers/${sellerId}/orders`,
    {
      params: params as Record<string, string | number | boolean | undefined>,
    }
  );
}

export async function updatePackageStatus(
  packageId: number,
  body: TrendyolUpdatePackageParams
): Promise<void> {
  const { sellerId } = getConfig();
  await trendyolFetch(
    `/order/sellers/${sellerId}/shipment-packages/${packageId}`,
    { method: "PUT", body }
  );
}

/**
 * Kargo takip numarası güncelle.
 * Trendyol müşteriye tracking link gönderir.
 * Sadece Created/Picking/Invoiced durumdaki paketler için geçerlidir.
 * Ref: PUT /integration/order/sellers/{sellerId}/shipment-packages/{packageId}/tracking-details
 */
export async function updateTrackingNumber(
  packageId: number,
  body: TrendyolUpdateTrackingParams
): Promise<void> {
  const { sellerId } = getConfig();
  await trendyolFetch(
    `/order/sellers/${sellerId}/shipment-packages/${packageId}/tracking-details`,
    { method: "PUT", body }
  );
}

/**
 * Tek sipariş getir (sipariş numarasına göre).
 */
export async function getOrderByNumber(
  orderNumber: string
): Promise<TrendyolOrder | null> {
  const { sellerId } = getConfig();
  const result = await trendyolFetch<TrendyolPaginatedResponse<TrendyolOrder>>(
    `/order/sellers/${sellerId}/orders`,
    { params: { orderNumber, size: 1 } }
  );
  return result.content[0] ?? null;
}

// ─── Products ────────────────────────────────────────────
export async function getProducts(
  params?: TrendyolProductParams
): Promise<TrendyolPaginatedResponse<TrendyolProduct>> {
  const { sellerId } = getConfig();
  return trendyolFetch<TrendyolPaginatedResponse<TrendyolProduct>>(
    `/product/sellers/${sellerId}/products`,
    {
      params: params as Record<string, string | number | boolean | undefined>,
    }
  );
}

export async function updateStockAndPrice(
  items: TrendyolStockPriceItem[]
): Promise<{ batchRequestId: string }> {
  const { sellerId } = getConfig();
  return trendyolFetch<{ batchRequestId: string }>(
    `/inventory/sellers/${sellerId}/products/price-and-inventory`,
    { method: "POST", body: { items } }
  );
}

// ─── Questions ───────────────────────────────────────────
export async function getQuestions(
  params?: TrendyolQuestionParams
): Promise<TrendyolPaginatedResponse<TrendyolQuestion>> {
  const { sellerId } = getConfig();
  return trendyolFetch<TrendyolPaginatedResponse<TrendyolQuestion>>(
    `/qna/sellers/${sellerId}/questions/filter`,
    {
      params: {
        supplierId: sellerId,
        ...params,
      } as Record<string, string | number | boolean | undefined>,
    }
  );
}

export async function answerQuestion(
  questionId: number,
  text: string
): Promise<void> {
  const { sellerId } = getConfig();
  await trendyolFetch(
    `/qna/sellers/${sellerId}/questions/${questionId}/answers`,
    { method: "POST", body: { text } }
  );
}

// ─── Finance ─────────────────────────────────────────────
export async function getSettlements(
  params: TrendyolSettlementParams
): Promise<TrendyolPaginatedResponse<TrendyolSettlement>> {
  const { sellerId } = getConfig();
  const queryParams: Record<string, string | number | boolean | undefined> = {
    supplierId: sellerId,
    startDate: params.startDate,
    endDate: params.endDate,
    page: params.page,
    size: params.size ?? 500,
  };
  if (params.transactionType) {
    queryParams.transactionType = params.transactionType;
  }
  return trendyolFetch<TrendyolPaginatedResponse<TrendyolSettlement>>(
    `/finance/che/sellers/${sellerId}/settlements`,
    { params: queryParams }
  );
}

export async function getOtherFinancials(
  params: TrendyolSettlementParams
): Promise<TrendyolPaginatedResponse<TrendyolOtherFinancial>> {
  const { sellerId } = getConfig();
  const transactionType = params.transactionType || "CashAdvance,WireTransfer,IncomingTransfer,PaymentOrder,DeductionInvoices,ReturnInvoice,CommissionAgreementInvoice,FinancialItem,Stoppage";
  return trendyolFetch<TrendyolPaginatedResponse<TrendyolOtherFinancial>>(
    `/finance/che/sellers/${sellerId}/otherfinancials`,
    {
      params: {
        supplierId: sellerId,
        transactionTypes: transactionType,
        startDate: params.startDate,
        endDate: params.endDate,
        page: params.page,
        size: params.size ?? 500,
      },
    }
  );
}

// ─── Claims / Returns ────────────────────────────────────
export async function getClaims(params?: {
  startDate?: number;
  endDate?: number;
  page?: number;
  size?: number;
  orderNumber?: string;
  claimItemStatus?: string;
}): Promise<TrendyolPaginatedResponse<TrendyolClaim>> {
  const { sellerId } = getConfig();
  return trendyolFetch<TrendyolPaginatedResponse<TrendyolClaim>>(
    `/order/sellers/${sellerId}/claims`,
    {
      params: params as Record<string, string | number | boolean | undefined>,
    }
  );
}
