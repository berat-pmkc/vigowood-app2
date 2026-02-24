/**
 * İkas API Client — Server-only
 * OAuth2 Client Credentials, GraphQL, token caching, mock fallback
 */
import "server-only";

import type {
  IkasPaginatedResponse,
  IkasOrder,
  IkasOrderParams,
  IkasProduct,
  IkasProductParams,
  IkasCustomer,
  IkasCustomerParams,
  IkasStockUpdateInput,
  IkasVariantPriceInput,
  IkasStockLocation,
  IkasPriceList,
  IkasGraphQLError,
} from "./types";
import {
  LIST_ORDERS_QUERY,
  LIST_PRODUCTS_QUERY,
  LIST_CUSTOMERS_QUERY,
  LIST_CUSTOMER_ORDERS_QUERY,
  UPDATE_STOCK_MUTATION,
  UPDATE_PRICES_MUTATION,
  LIST_STOCK_LOCATIONS_QUERY,
  LIST_PRICE_LISTS_QUERY,
} from "./queries";
import {
  getMockOrders,
  getMockProducts,
  getMockCustomers,
} from "./mock-data";

// ─── Config ──────────────────────────────────────────────
const GRAPHQL_URL = "https://api.myikas.com/api/v1/admin/graphql";

function hasCredentials(): boolean {
  return !!(
    process.env.IKAS_CLIENT_ID &&
    process.env.IKAS_CLIENT_SECRET &&
    process.env.IKAS_STORE_NAME
  );
}

function getConfig() {
  const clientId = process.env.IKAS_CLIENT_ID;
  const clientSecret = process.env.IKAS_CLIENT_SECRET;
  const storeName = process.env.IKAS_STORE_NAME;

  if (!clientId || !clientSecret || !storeName) {
    throw new Error(
      "İkas API credentials not configured. Check IKAS_CLIENT_ID, IKAS_CLIENT_SECRET, IKAS_STORE_NAME in .env.local"
    );
  }

  return { clientId, clientSecret, storeName };
}

// ─── OAuth2 Token Management ────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  // Refresh 5 minutes before expiry
  if (cachedToken && tokenExpiresAt > now + 300_000) {
    return cachedToken;
  }

  const { clientId, clientSecret, storeName } = getConfig();
  const tokenUrl = `https://${storeName}.myikas.com/api/admin/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new IkasError(response.status, `Token alma hatası: ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in ?? 14400) * 1000;
  return cachedToken!;
}

// ─── GraphQL Fetch ──────────────────────────────────────
async function ikasGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new IkasError(response.status, `GraphQL hatası: ${text}`);
  }

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    const errors = json.errors as IkasGraphQLError[];
    throw new IkasError(400, errors.map((e) => e.message).join("; "));
  }

  return json.data as T;
}

export class IkasError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "IkasError";
    this.status = status;
  }
}

// ─── Mock Data Flag ─────────────────────────────────────
// NOT: Modül seviyesinde hasCredentials() çağırmıyoruz — Next.js'te
// process.env modül yüklenirken henüz hazır olmayabiliyor.
let forceMock = false;

function shouldUseMock(): boolean {
  if (forceMock) return true;
  return !hasCredentials();
}

async function tryFetchOrMock<T>(
  fetchFn: () => Promise<T>,
  mockFn: () => T
): Promise<T> {
  if (shouldUseMock()) return mockFn();
  try {
    return await fetchFn();
  } catch (err) {
    const isAuthError =
      err instanceof IkasError && (err.status === 401 || err.status === 403);
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[İkas] API error${isAuthError ? " (auth)" : ""}: ${errorMsg} — falling back to mock data`
    );
    forceMock = true;
    return mockFn();
  }
}

/** Check if currently using mock data */
export function isUsingMockData(): boolean {
  return shouldUseMock();
}

// ─── Orders ─────────────────────────────────────────────
export async function getOrders(
  params?: IkasOrderParams
): Promise<IkasPaginatedResponse<IkasOrder>> {
  return tryFetchOrMock(
    async () => {
      const variables: Record<string, unknown> = {
        pagination: { page: params?.page ?? 1, limit: params?.limit ?? 50 },
        sort: params?.sort ?? "orderedAt:desc",
      };

      if (params?.status) {
        variables.status = { eq: params.status };
      }
      if (params?.packageStatus) {
        variables.orderPackageStatus = { eq: params.packageStatus };
      }
      if (params?.startDate || params?.endDate) {
        const dateFilter: Record<string, string> = {};
        if (params?.startDate) dateFilter.gte = params.startDate;
        if (params?.endDate) dateFilter.lte = params.endDate;
        variables.orderedAt = dateFilter;
      }
      if (params?.search) {
        variables.search = params.search;
      }

      const data = await ikasGraphQL<{
        listOrder: IkasPaginatedResponse<IkasOrder>;
      }>(LIST_ORDERS_QUERY, variables);

      return data.listOrder;
    },
    () => getMockOrders(params)
  );
}

// ─── Products ───────────────────────────────────────────
export async function getProducts(
  params?: IkasProductParams
): Promise<IkasPaginatedResponse<IkasProduct>> {
  return tryFetchOrMock(
    async () => {
      const variables: Record<string, unknown> = {
        pagination: { page: params?.page ?? 1, limit: params?.limit ?? 50 },
        sort: params?.sort ?? "updatedAt:desc",
      };

      if (params?.search) {
        variables.name = { like: `%${params.search}%` };
      }

      const data = await ikasGraphQL<{
        listProduct: IkasPaginatedResponse<IkasProduct>;
      }>(LIST_PRODUCTS_QUERY, variables);

      return data.listProduct;
    },
    () => getMockProducts(params)
  );
}

// ─── Customers ──────────────────────────────────────────
export async function getCustomers(
  params?: IkasCustomerParams
): Promise<IkasPaginatedResponse<IkasCustomer>> {
  return tryFetchOrMock(
    async () => {
      const variables: Record<string, unknown> = {
        pagination: { page: params?.page ?? 1, limit: params?.limit ?? 50 },
        sort: params?.sort ?? "lastOrderDate:desc",
      };

      if (params?.search) {
        variables.search = params.search;
      }

      const data = await ikasGraphQL<{
        listCustomer: IkasPaginatedResponse<IkasCustomer>;
      }>(LIST_CUSTOMERS_QUERY, variables);

      return data.listCustomer;
    },
    () => getMockCustomers(params)
  );
}

// ─── Customer Orders ────────────────────────────────────
export async function getCustomerOrders(
  customerId: string,
  page = 1,
  limit = 20
): Promise<IkasPaginatedResponse<IkasOrder>> {
  if (shouldUseMock()) {
    const all = getMockOrders();
    const filtered = all.data.filter(
      (o) => o.customer.email.includes("mock") || true
    ).slice(0, 5);
    return { data: filtered, count: filtered.length, hasNext: false, page: 1, limit: 20 };
  }

  const data = await ikasGraphQL<{
    listOrder: IkasPaginatedResponse<IkasOrder>;
  }>(LIST_CUSTOMER_ORDERS_QUERY, {
    customerId: { eq: customerId },
    pagination: { page, limit },
    sort: "orderedAt:desc",
  });

  return data.listOrder;
}

// ─── Stock Update ───────────────────────────────────────
export async function updateStock(
  inputs: IkasStockUpdateInput[]
): Promise<boolean> {
  if (shouldUseMock()) return true;

  const data = await ikasGraphQL<{ saveProductStockLocations: boolean }>(
    UPDATE_STOCK_MUTATION,
    { input: { productStockLocationInputs: inputs } }
  );

  return data.saveProductStockLocations;
}

// ─── Price Update ───────────────────────────────────────
export async function updatePrice(
  priceListId: string,
  inputs: IkasVariantPriceInput[]
): Promise<boolean> {
  if (shouldUseMock()) return true;

  const data = await ikasGraphQL<{ saveVariantPrices: boolean }>(
    UPDATE_PRICES_MUTATION,
    { input: { priceListId, variantPriceInputs: inputs } }
  );

  return data.saveVariantPrices;
}

// ─── Stock Locations ────────────────────────────────────
export async function getStockLocations(): Promise<IkasStockLocation[]> {
  if (shouldUseMock()) {
    return [
      { id: "mock-ana-depo", name: "Ana Depo", description: null },
      { id: "mock-almanya", name: "Almanya Stok", description: null },
    ];
  }

  const data = await ikasGraphQL<{
    listStockLocation: IkasStockLocation[];
  }>(LIST_STOCK_LOCATIONS_QUERY);

  return data.listStockLocation;
}

// ─── Price Lists ────────────────────────────────────────
export async function getPriceLists(): Promise<IkasPriceList[]> {
  if (shouldUseMock()) {
    return [
      { id: "mock-tr", name: "TR Fiyat Listesi", currency: "TRY", currencyCode: "TRY", type: "MANUAL" },
    ];
  }

  const data = await ikasGraphQL<{
    listPriceList: IkasPriceList[];
  }>(LIST_PRICE_LISTS_QUERY);

  return data.listPriceList;
}
