import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui', '@repo/types', '@repo/web-core'],
}

export default nextConfig
