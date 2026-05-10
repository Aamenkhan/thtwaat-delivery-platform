export const RAZORPAY_PLANS = {
  BASIC: { amountPaise: 9_900, label: 'Basic', periodDays: 30 },
  PRO: { amountPaise: 49_900, label: 'Pro', periodDays: 30 },
  ENTERPRISE: { amountPaise: 199_900, label: 'Enterprise', periodDays: 30 },
} as const

export type RazorpayPlanCode = keyof typeof RAZORPAY_PLANS

export function planAmountPaise(code: RazorpayPlanCode): number {
  return RAZORPAY_PLANS[code].amountPaise
}
