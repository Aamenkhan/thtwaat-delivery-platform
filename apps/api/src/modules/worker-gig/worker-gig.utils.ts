export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length <= 4) return '****'
  return `${d.slice(0, 2)}XXXX${d.slice(-2)}`
}

export function randomSixDigitOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function regOrderId(workerId: string) {
  return `reg:${workerId}`
}
