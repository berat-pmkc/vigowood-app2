// Trendyol API Type Definitions

// ─── Pagination ──────────────────────────────────────────
export interface TrendyolPaginatedResponse<T> {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  content: T[];
}

// ─── Orders ──────────────────────────────────────────────
export type TrendyolOrderStatus =
  | "Created"
  | "Picking"
  | "Invoiced"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "UnSupplied"
  | "Returned"
  | "UnDelivered"
  | "UnPacked"
  | "AtCollectionPoint"
  | "Awaiting";

export interface TrendyolAddress {
  id?: number;
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  cityCode?: number;
  district: string;
  districtId?: number;
  countyId?: number;
  countyName?: string;
  postalCode: string;
  countryCode: string;
  neighborhoodId?: number;
  neighborhood?: string;
  fullName?: string;
  fullAddress: string;
  phone?: string;
  email?: string;
  taxOffice?: string;
  taxNumber?: string;
  latitude?: string;
  longitude?: string;
  eInvoiceAvailable?: boolean;
}

export interface TrendyolOrderLine {
  id: number;
  lineId?: number;
  quantity: number;
  salesCampaignId?: number;
  merchantSku: string;
  sku?: string;
  stockCode?: string;
  productName: string;
  productCode?: number;
  barcode: string;
  /** Net amount after discounts (what customer pays) */
  amount: number;
  /** Gross amount before discounts */
  lineGrossAmount?: number;
  lineUnitPrice?: number;
  discount: number;
  /** Total discount on this line */
  lineTotalDiscount?: number;
  /** Seller-funded discount */
  lineSellerDiscount?: number;
  /** Trendyol-funded discount */
  tyDiscount?: number;
  currencyCode: string;
  vatBaseAmount: number;
  vatRate?: number;
  price: number;
  orderLineItemStatusName: string;
  productCategoryId?: number;
  /** Commission rate (0–1 range, e.g. 0.15 = 15%) */
  commission?: number;
  /** Actual commission amount in currency */
  commissionAmount?: number;
  productSize?: string;
  productColor?: string;
  productOrigin?: string;
  contentId?: number;
  merchantId?: number;
  imageUrl?: string;
  cancelReason?: string;
  cancelReasonCode?: string;
  cancelledBy?: string;
  fastDeliveryOptions?: string[];
}

export interface TrendyolPackageHistory {
  createdDate: number;
  status: string;
}

export interface TrendyolOrder {
  id: number;
  shipmentPackageId: number;
  orderNumber: string;
  customerId: number;
  customerFirstName: string;
  customerLastName: string;
  customerEmail?: string;
  grossAmount: number;
  packageGrossAmount?: number;
  totalDiscount: number;
  totalTyDiscount?: number;
  shipmentAddress: TrendyolAddress;
  invoiceAddress: TrendyolAddress;
  cargoTrackingNumber?: number;
  cargoTrackingLink?: string;
  cargoProviderName?: string;
  cargoSenderNumber?: string;
  lines: TrendyolOrderLine[];
  orderDate: number;
  shipmentPackageStatus: string;
  status: TrendyolOrderStatus;
  deliveryType?: string;
  timeSlotId?: number;
  estimatedDeliveryStartDate?: number;
  estimatedDeliveryEndDate?: number;
  totalPrice: number;
  deliveryAddressType?: string;
  lastModifiedDate: number;
  commercial?: boolean;
  fastDelivery?: boolean;
  invoiceLink?: string;
  packageHistories?: TrendyolPackageHistory[];
  agreedDeliveryDate?: number;
  extendedDeliveryDate?: number;
  agreedDeliveryExtensionEndDate?: number;
}

// ─── Products ────────────────────────────────────────────
export interface TrendyolProductImage {
  url: string;
}

export interface TrendyolProductAttribute {
  attributeId: number;
  attributeName: string;
  attributeValue?: string;
  attributeValueId?: number;
}

export interface TrendyolProduct {
  id: string;
  productCode?: number;
  barcode: string;
  title: string;
  description?: string;
  productMainId?: string;
  brandId?: number;
  brand?: string;
  categoryName?: string;
  categoryId?: number;
  quantity: number;
  stockCode?: string;
  dimensionalWeight?: number;
  listPrice: number;
  salePrice: number;
  vatRate?: number;
  images?: TrendyolProductImage[];
  approved?: boolean;
  archived?: boolean;
  locked?: boolean;
  onSale?: boolean;
  onsale?: boolean;
  hasActiveCampaign?: boolean;
  createDateTime?: number;
  lastUpdateDate?: number;
  blacklisted?: boolean;
  rejected?: boolean;
  attributes?: TrendyolProductAttribute[];
  platformListingId?: string;
  stockUnitType?: string;
  gender?: string;
  color?: string;
  size?: string;
}

// ─── Q&A (Questions & Answers) ───────────────────────────
export type TrendyolQuestionStatus =
  | "WAITING_FOR_ANSWER"
  | "WAITING_FOR_APPROVE"
  | "ANSWERED"
  | "REPORTED"
  | "REJECTED";

export interface TrendyolAnswer {
  id: number;
  text: string;
  creationDate: number;
  hasPrivateInfo?: boolean;
}

export interface TrendyolRejectedAnswer {
  id: number;
  text: string;
  creationDate: number;
  reason?: string;
}

export interface TrendyolQuestion {
  id: number;
  text: string;
  status: TrendyolQuestionStatus;
  creationDate: number;
  customerId: number;
  userName?: string;
  showUserName?: boolean;
  productName?: string;
  imageUrl?: string;
  productMainId?: string;
  public?: boolean;
  answeredDateMessage?: string;
  answer?: TrendyolAnswer;
  rejectedAnswer?: TrendyolRejectedAnswer;
  webUrl?: string;
}

// ─── Finance / Settlements ───────────────────────────────
export type TrendyolSettlementTransactionType =
  | "Sale"
  | "Return"
  | "Discount"
  | "DiscountCancel"
  | "Coupon"
  | "CouponCancel"
  | "ProvisionPositive"
  | "ProvisionNegative"
  | "ManualRefund"
  | "ManualRefundCancel"
  | "TYDiscount"
  | "TYDiscountCancel"
  | "TYCoupon"
  | "TYCouponCancel"
  | "SellerRevenuePositive"
  | "SellerRevenueNegative"
  | "CommissionPositive"
  | "CommissionNegative";

export interface TrendyolSettlement {
  id: number;
  transactionDate: string;
  transactionType: TrendyolSettlementTransactionType;
  debt?: number;
  credit?: number;
  receiptId?: string;
  barcode?: string;
  paymentOrderId?: string;
  paymentDate?: string;
  commissionRate?: number;
  commissionAmount?: number;
  sellerRevenue?: number;
  orderNumber?: string;
  affiliate?: string;
  shipmentPackageId?: number;
}

export type TrendyolOtherFinancialType =
  | "CashAdvance"
  | "WireTransfer"
  | "IncomingTransfer"
  | "ReturnInvoice"
  | "CommissionAgreementInvoice"
  | "PaymentOrder"
  | "DeductionInvoices"
  | "FinancialItem"
  | "Stoppage";

export interface TrendyolOtherFinancial {
  id: number;
  transactionDate: string;
  transactionType: TrendyolOtherFinancialType;
  debt?: number;
  credit?: number;
  description?: string;
}

// ─── Claims / Returns ────────────────────────────────────
export type TrendyolClaimStatus =
  | "Created"
  | "WaitingInAction"
  | "WaitingFraudCheck"
  | "Accepted"
  | "Rejected"
  | "Unresolved"
  | "Cancelled"
  | "InAnalysis";

/**
 * Trendyol Claims API gerçek yapısı:
 * items[] → her biri { orderLine: {...}, claimItems: [{claimItemStatus: {name: "..."}, ...}] }
 */
export interface TrendyolClaimItemEntry {
  id: string;
  note?: string;
  resolved?: boolean;
  acceptDetail?: string | null;
  autoAccepted?: boolean | null;
  customerNote?: string;
  autoApproveDate?: number;
  claimItemStatus?: { name: string };
  orderLineItemId?: number;
  acceptedBySeller?: boolean | null;
  customerClaimItemReason?: { id: number; code: string; name: string };
  trendyolClaimItemReason?: { id: number; code: string; name: string };
}

export interface TrendyolClaimItem {
  orderLine?: {
    id: number;
    price?: number;
    barcode?: string;
    vatRate?: number;
    merchantSku?: string;
    productName?: string;
    productSize?: string;
    productColor?: string;
    productCategory?: string;
  };
  claimItems?: TrendyolClaimItemEntry[];
}

export interface TrendyolClaim {
  id: string;
  orderNumber: string;
  // Claim seviyesinde status yok; items[].claimItems[].claimItemStatus.name'den türetilir
  status?: TrendyolClaimStatus;
  claimDate: number;
  items: TrendyolClaimItem[];
  shipmentPackageId?: number;
  cargoTrackingNumber?: string;
}

// ─── API Request Params ──────────────────────────────────
export interface TrendyolOrderParams {
  startDate?: number;
  endDate?: number;
  page?: number;
  size?: number;
  status?: TrendyolOrderStatus;
  orderNumber?: string;
  orderByField?: "PackageLastModifiedDate" | "CreatedDate";
  orderByDirection?: "ASC" | "DESC";
  shipmentPackageIds?: number;
  /**
   * Hangi tarihe göre filtreleme yapılacağını belirler.
   * CREATED_DATE: orderDate bazlı (panel ile aynı sayım — tercih edilen)
   * LAST_MODIFIED_DATE: PackageLastModifiedDate bazlı (durum güncellemelerini yakalar)
   * Belirtilmezse API varsayılan olarak LAST_MODIFIED_DATE kullanır.
   */
  dateQueryType?: "CREATED_DATE" | "LAST_MODIFIED_DATE";
}

export interface TrendyolProductParams {
  approved?: boolean;
  barcode?: string;
  startDate?: number;
  endDate?: number;
  page?: number;
  size?: number;
  dateQueryType?: "CREATED_DATE" | "LAST_MODIFIED_DATE";
  stockCode?: string;
  archived?: boolean;
  productMainId?: string;
  onSale?: boolean;
  rejected?: boolean;
  blacklisted?: boolean;
  brandIds?: number[];
}

export interface TrendyolQuestionParams {
  barcode?: number;
  page?: number;
  size?: number;
  startDate?: number;
  endDate?: number;
  status?: TrendyolQuestionStatus;
  orderByField?: "LastModifiedDate" | "CreatedDate";
  orderByDirection?: "ASC" | "DESC";
}

export interface TrendyolSettlementParams {
  transactionType?: string;
  startDate: number;
  endDate: number;
  page?: number;
  size?: number;
}

export interface TrendyolStockPriceItem {
  barcode: string;
  quantity?: number;
  salePrice?: number;
  listPrice?: number;
}

export interface TrendyolUpdatePackageParams {
  lines: { lineId: number; quantity: number }[];
  params?: Record<string, string>;
  status: "Picking" | "Invoiced";
}

/**
 * Kargo takip numarası güncelleme parametreleri.
 * PUT /integration/order/sellers/{sellerId}/shipment-packages/{packageId}/tracking-details
 * Trendyol bu numarayı müşteriye SMS/email ile gönderir.
 */
export interface TrendyolUpdateTrackingParams {
  /** Kargo firmasının verdiği takip/gönderi numarası */
  cargoSenderNumber: string;
  /** Kargo firması kodu (ör. "YURTICI", "MNG", "ARAS", "PTT", "DHLMP") */
  providerCode: string;
  /** İade kargo takip numarası (opsiyonel) */
  returnTrackingNumber?: string;
}

// ─── API Error ───────────────────────────────────────────
export interface TrendyolApiError {
  status: number;
  message: string;
  timestamp?: string;
  path?: string;
}
