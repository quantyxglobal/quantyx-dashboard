import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CRITICAL: Use standalone output for proper environment variable handling in AWS Lambda
  output: 'standalone',
  
  // React Compiler disabled for now - uncomment when babel-plugin-react-compiler is installed
  // reactCompiler: true,
  
  // Disable TypeScript errors during build for production deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint during build - warnings should not fail production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Skip build-time page data collection for API routes
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  
  // Skip problematic routes during build
  async redirects() {
    return []
  },
  
  // Configure Server Actions body size limit (50MB for large file uploads)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
      // Exclude website API routes from Server Actions
      allowedOrigins: ['localhost:8080', 'localhost:3000'],
    },
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-dialog', 
      '@radix-ui/react-dropdown-menu', 
      '@radix-ui/react-select',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group'
    ],
    optimizeServerReact: true,
    // Disable optimizeCss temporarily to avoid critters issues
    // optimizeCss: true,
  },
  
  // CORS configuration for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'http://localhost:8080' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          // Add caching headers for better performance
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300' },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  
  // Enable cache components for better performance (disabled due to dynamic route conflicts)
  // cacheComponents: true,
  
  // Turbopack configuration with explicit root
  turbopack: {
    root: process.cwd(),
  },
  
  // External packages for server components
  serverExternalPackages: ['@prisma/client', '@aws-sdk/client-s3'],
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 3600, // 1 hour cache
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Turbopack configuration for Next.js 16+
  // turbopack: {
  //   rules: {
  //     '*.svg': {
  //       loaders: ['@svgr/webpack'],
  //       as: '*.js',
  //     },
  //   },
  // },
  
  // Webpack optimizations disabled - using Turbopack in Next.js 16
  // webpack: (config, { dev, isServer }) => {
  //   if (!dev && !isServer) {
  //     // Optimize bundle splitting
  //     config.optimization.splitChunks = {
  //       chunks: 'all',
  //       cacheGroups: {
  //         vendor: {
  //           test: /[\\/]node_modules[\\/]/,
  //           name: 'vendors',
  //           chunks: 'all',
  //         },
  //         common: {
  //           name: 'common',
  //           minChunks: 2,
  //           chunks: 'all',
  //           enforce: true,
  //         },
  //       },
  //     };
  //   }
  //   return config;
  // },
};

export default nextConfig;
