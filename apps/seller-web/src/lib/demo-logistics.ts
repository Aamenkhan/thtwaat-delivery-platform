/** Static demo rows when API has no activity yet — keeps the dashboard feeling “alive”. */
export const DEMO_ACTIVITY = [
  { id: 'd1', title: 'BLR_CC hub accepted inbound', detail: 'Manifest MH-204 · 2h ago', tone: 'info' as const },
  { id: 'd2', title: 'COD reconciliation batch #48', detail: 'Scheduled 18:00 IST', tone: 'neutral' as const },
  { id: 'd3', title: 'SLA alert · 3 orders approaching OTP window', detail: 'Bengaluru last-mile', tone: 'warning' as const },
]

export const DEMO_KPI_HINTS = {
  open: 'vs last week',
  delivered: 'on-time 94%',
  returns: 'RTO review queue',
}
