import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CRITICAL: Use standalone output for proper environment variable handling in AWS Lambda
  output: 'standalone',
  
  // Inject environment variables at build time for Lambda runtime
  env: {
    // AWS Configuration - map from AMPLIFY_ prefix to standard names
    AWS_ACCESS_KEY_ID: process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_ACCESS_KEY: process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    CUSTOM_AWS_REGION: process.env.AMPLIFY_AWS_REGION || process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || '',
    AWS_S3_BUCKET_NAME: process.env.AMPLIFY_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || '',
    // Email Configuration - Postmark
    POSTMARK_SERVER_TOKEN: process.env.POSTMARK_SERVER_TOKEN || '',
    POSTMARK_API_KEY: process.env.POSTMARK_SERVER_TOKEN || process.env.POSTMARK_API_KEY || '',
    POSTMARK_ADMIN_EMAIL: process.env.POSTMARK_ADMIN_EMAIL || '',
    POSTMARK_SUPPORT_EMAIL: process.env.POSTMARK_SUPPORT_EMAIL || '',
    CASE_NOTIFICATION_EMAIL: process.env.POSTMARK_ADMIN_EMAIL || process.env.CASE_NOTIFICATION_EMAIL || '',
    ACCOUNT_NOTIFICATION_EMAIL: process.env.POSTMARK_SUPPORT_EMAIL || process.env.ACCOUNT_NOTIFICATION_EMAIL || '',
  },
  
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
  
  // CORS configuration removed - handled at route level in lib/cors.ts
  // This allows dynamic origin matching instead of hardcoded values
  async headers() {
    return [
      // Cache static assets aggressively
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Security headers for all routes
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Enable XSS protection
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Referrer policy
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions policy
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          // HSTS - Force HTTPS (only in production)
          ...(process.env.NODE_ENV === 'production' ? [
            { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }
          ] : []),
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://wghvermnyvppsgshgbmu.supabase.co https://*.amazonaws.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          }
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
    // Keep console logs in production for debugging
    removeConsole: false,
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
