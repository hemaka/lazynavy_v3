import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@lazynavy/types'],
  output: 'export',
}

export default nextConfig
