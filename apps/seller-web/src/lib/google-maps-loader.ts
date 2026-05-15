/** Loads Maps JS once; shared by pickup + delivery AddressInput. */
let mapsLoadPromise: Promise<void> | null = null

export function loadGoogleMapsPlaces(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.maps?.places) return Promise.resolve()
  if (mapsLoadPromise) return mapsLoadPromise

  mapsLoadPromise = new Promise((resolve, reject) => {
    const cbName = `__gmaps_places_${Math.random().toString(36).slice(2, 11)}`
    ;(window as unknown as Record<string, () => void>)[cbName] = () => {
      resolve()
      delete (window as unknown as Record<string, unknown>)[cbName]
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${cbName}`
    script.async = true
    script.onerror = () => {
      mapsLoadPromise = null
      reject(new Error('Google Maps script failed to load'))
    }
    document.head.appendChild(script)
  })

  return mapsLoadPromise
}
