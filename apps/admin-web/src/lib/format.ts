/** Amounts stored as integer cents / paise in the API. */
export function formatInrFromMinorUnits(minor: number): string {
  return (minor / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
