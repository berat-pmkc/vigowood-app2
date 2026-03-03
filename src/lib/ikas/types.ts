// İkas API Type Definitions

// ─── Pagination ──────────────────────────────────────────
export interface IkasPaginatedResponse<T> {
  data: T[];
  count: number;
  hasNext: boolean;
  page: number;
  limit: number;
}

// ─── Order Status Enums ─────────────────────────────────
export type IkasOrderStatus =
  | "CREATED"
  | "DRAFT"
  | "CANCELLED"
  | "PARTIALLY_CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "REFUND_REQUESTED"
  | "REFUND_REJECTED";

export type IkasPackageStatus =
  | "UNFULFILLED"
  | "FULFILLED"
  | "PARTIALLY_FULFILLED"
  | "READY_FOR_SHIPMENT"
  | "PARTIALLY_READY_FOR_SHIPMENT"
  | "DELIVERED"
  | "PARTIALLY_DELIVERED"
  | "CANCELLED"
  | "PARTIALLY_CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "REFUND_REQUESTED"
  | "REFUND_REJECTED"
  | "UNABLE_TO_DELIVER"
  | "REFUND_REQUEST_ACCEPTED"
  | "CANCEL_REQUESTED"
  | "CANCEL_REJECTED";

export type IkasPaymentStatus =
  | "PAID"
  | "PARTIALLY_PAID"
  | "WAITING"
  | "FAILED";

// ─── Order Types ────────────────────────────────────────
export interface IkasAddressCity {
  name: string;
  code: string;
}

export interface IkasAddressCountry {
  name: string;
  code: string;
}

export interface IkasAddress {
  addressLine1: string;
  city: IkasAddressCity;
  country: IkasAddressCountry;
}

export interface IkasOrderCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

export interface IkasOrderVariant {
  id: string;
  sku: string;
  name: string;
}

export interface IkasOrderLineItem {
  id: string;
  quantity: number;
  price: number;
  finalPrice: number;
  variant: IkasOrderVariant;
}

export interface IkasSalesChannel {
  id: string;
  name: string;
}

export interface IkasOrder {
  id: string;
  orderNumber: string;
  status: IkasOrderStatus;
  orderPaymentStatus: IkasPaymentStatus;
  orderPackageStatus: IkasPackageStatus;
  totalPrice: number;
  totalFinalPrice: number;
  currencyCode: string;
  orderedAt: number; // timestamp ms
  customer: IkasOrderCustomer;
  shippingAddress: IkasAddress;
  orderLineItems: IkasOrderLineItem[];
  salesChannel: IkasSalesChannel | null;
}

// ─── Product Types ──────────────────────────────────────
export interface IkasVariantPrice {
  sellPrice: number;
  discountPrice: number | null;
  currency: string | null;
}

export interface IkasVariantImage {
  imageId: string;
  isMain: boolean;
}

export interface IkasVariant {
  id: string;
  sku: string;
  isActive: boolean;
  barcodeList: string[];
  prices: IkasVariantPrice[];
  images: IkasVariantImage[];
}

export interface IkasProduct {
  id: string;
  name: string;
  type: string;
  totalStock: number;
  variants: IkasVariant[];
}

// ─── Customer Types ─────────────────────────────────────
export interface IkasCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  orderCount: number | null;
  totalOrderPrice: number | null;
  firstOrderDate: number | null;
  lastOrderDate: number | null;
}

// ─── Stock & Price Update Types ─────────────────────────
export interface IkasStockLocation {
  id: string;
  name: string;
  description: string | null;
}

export interface IkasPriceList {
  id: string;
  name: string;
  currency: string;
  currencyCode: string;
  type: string | null;
}

export interface IkasStockUpdateInput {
  productId: string;
  variantId: string;
  stockLocationId: string;
  stockCount: number;
}

export interface IkasVariantPriceInput {
  productId: string;
  variantId: string;
  price: {
    sellPrice: number;
    discountPrice?: number;
    currency?: string;
  };
}

// ─── Query Parameters ───────────────────────────────────
export interface IkasOrderParams {
  page?: number;
  limit?: number;
  sort?: string;
  status?: IkasOrderStatus;
  packageStatus?: IkasPackageStatus;
  paymentStatus?: IkasPaymentStatus;
  search?: string;
  startDate?: string; // ISO 8601
  endDate?: string;   // ISO 8601
}

export interface IkasProductParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
}

export interface IkasCustomerParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
}

// ─── GraphQL Error ──────────────────────────────────────
export interface IkasGraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  extensions?: { code: string };
}
