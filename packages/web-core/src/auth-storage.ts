const USER_KEY = 'thtwaat_usr'

export type StoredUser = {
  id: string
  email: string
  role: string
  [key: string]: unknown
}

export function readUser(): StoredUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as StoredUser) : null
  } catch {
    return null
  }
}

export function writeUser(user: StoredUser | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!user) localStorage.removeItem(USER_KEY)
    else localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
}
