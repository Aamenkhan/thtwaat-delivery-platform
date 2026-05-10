import { Prisma } from '@prisma/client'

/**
 * Map unexpected errors to a safe, actionable client message (no stack traces).
 */
export function publicMessageForUnexpectedError(err: unknown): {
  status: number
  message: string
} | null {
  const raw = err instanceof Error ? err.message : String(err)

  if (raw.includes('JWT_SECRET is not set')) {
    return {
      status: 500,
      message:
        'Server is missing JWT_SECRET. Add a long random string in your host environment (e.g. Render → Environment).',
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      message:
        'Cannot connect to the database. Set DATABASE_URL on the API host and ensure the DB accepts SSL connections from Render.',
    }
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P1001' || err.code === 'P1000') {
      return {
        status: 503,
        message:
          `Database unreachable (${err.code}). Check DATABASE_URL, firewall, and that the database is running.`,
      }
    }
    if (err.code === 'P2021' || err.code === 'P2010' || err.code === 'P2022') {
      return {
        status: 503,
        message:
          `Database schema is missing or out of date (${err.code}). Run prisma migrate deploy against this DATABASE_URL.`,
      }
    }
  }

  if (
    raw.includes("Can't reach database server") ||
    raw.includes('Server has closed the connection') ||
    raw.includes('ECONNREFUSED')
  ) {
    return {
      status: 503,
      message:
        'Cannot reach the database. Verify DATABASE_URL and that your provider allows connections from Render.',
    }
  }

  return null
}
