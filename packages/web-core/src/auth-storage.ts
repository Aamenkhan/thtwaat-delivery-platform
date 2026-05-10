const ACCESS = 'thtwaat_access_token'
const REFRESH = 'thtwaat_refresh_token'
const USER = 'thtwaat_user_json'

export type StoredUser = {
  id: string
  email: string
  role: string
}

export type StoredTokens = {
  accessToken: string
  refreshToken: string
}

export function readTokens(): StoredTokens | null {
  if (typeof window === 'undefined') return null
  const accessToken = localStorage.getItem(ACCESS)
  const refreshToken = localStorage.getItem(REFRESH)
  if (!accessToken || !refreshToken) return null
  return { accessToken, refreshToken }
}

export function writeTokens(tokens: StoredTokens | null) {
  if (typeof window === 'undefined') return
  if (!tokens) {
    localStorage.removeItem(ACCESS)
    localStorage.removeItem(REFRESH)
    localStorage.removeItem(USER)
    return
  }
  localStorage.setItem(ACCESS, tokens.accessToken)
  localStorage.setItem(REFRESH, tokens.refreshToken)
}

export function readUser(): StoredUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredUser
  } catch {
    return null
  }
}

export function writeUser(user: StoredUser | null) {
  if (typeof window === 'undefined') return
  if (!user) {
    localStorage.removeItem(USER)
    return
  }
  localStorage.setItem(USER, JSON.stringify(user))
}
