/**
 * Express + Socket.IO CORS: comma-separated origins in CORS_ORIGIN.
 * When unset, reflect the request Origin (suitable for many dev setups).
 */
export function resolveCorsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGIN?.trim()
  if (!raw) return true
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length > 0 ? list : true
}
