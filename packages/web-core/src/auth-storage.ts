const TOKENS_KEY = 'thtwaat_tks'
const USER_KEY = 'thtwaat_usr'

export type StoredTokens = {
  accessToken: string
  refreshToken: string
}

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

export function readTokens(): StoredTokens | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TOKENS_KEY)
    return raw ? (JSON.parse(raw) as StoredTokens) : null
  } catch {
    return null
  }
}

export function writeTokens(tokens: StoredTokens | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!tokens) localStorage.removeItem(TOKENS_KEY)
    else localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  } catch {
    /* ignore */
  }
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(TOKENS_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}
