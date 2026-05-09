export type OrderStatus =
  | 'CREATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'AT_HUB'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'CANCELLED'

export type WebhookEventType =
  | 'order.created'
  | 'order.status_changed'
  | 'order.delivered'
  | 'order.return_initiated'
  | 'scan.recorded'
  | 'hub.assigned'
  | 'payout.completed'
  | 'worker.assigned'

export interface ApiEnvelope<T> {
  ok: true
  data: T
}

export interface ApiErrorBody {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type GeoPoint = { lat: number; lng: number }

export interface PriceQuoteInput {
  origin: GeoPoint
  destination: GeoPoint
  weightKg?: number
}

export interface PriceQuoteResult {
  currency: string
  amountCents: number
  ruleId: string | null
}

export interface OtpVerifyPayload {
  phone: string
  code: string
  purpose: 'delivery' | 'return' | 'seller_login'
}

export interface ScanPayload {
  qrPayload: string
  scanType: 'hub_inbound' | 'hub_outbound' | 'pickup' | 'delivery_attempt'
  hubId?: string
  meta?: Record<string, unknown>
}

export interface PhotoProofPayload {
  orderId: string
  urls: string[]
}

export interface HubDashboardSummary {
  hubId: string
  inboundToday: number
  outboundToday: number
  exceptions: number
}

export interface SellerDashboardSummary {
  sellerId: string
  openOrders: number
  deliveredThisWeek: number
  returnsPending: number
}
