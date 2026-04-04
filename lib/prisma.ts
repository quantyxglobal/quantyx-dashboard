import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { 
  prisma: PrismaClient | undefined 
}

// Enhanced Prisma configuration with proper error handling
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [
          { emit: 'stdout', level: 'error' },
        ],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    // Connection optimization
    errorFormat: 'pretty',
  })
}

// Lazy-loaded Prisma client to avoid accessing process.env at module level during build
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
    
    // Enhanced logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Development mode: Query monitoring enabled')
    }
  }
  return globalForPrisma.prisma
}

// Export as getter to ensure lazy initialization
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    return getPrismaClient()[prop as keyof PrismaClient]
  }
})

// Connection health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = getPrismaClient()
    await client.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}

// Retry wrapper for database operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on certain errors
      if (
        error instanceof Error && 
        (error.message.includes('Unique constraint') ||
         error.message.includes('Foreign key constraint') ||
         error.message.includes('Invalid input'))
      ) {
        throw error
      }
      
      if (attempt === maxRetries) {
        break
      }
      
      console.log(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      delay *= 1.5 // Exponential backoff
    }
  }
  
  throw lastError!
}

// Graceful shutdown with timeout (only in Node.js runtime, not Edge)
async function gracefulShutdown() {
  console.log('Shutting down Prisma client...')
  try {
    const client = getPrismaClient()
    await Promise.race([
      client.$disconnect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Disconnect timeout')), 5000)
      )
    ])
    console.log('Prisma client disconnected successfully')
  } catch (error) {
    console.error('Error during Prisma disconnect:', error)
  }
}

// Register shutdown handlers only in Node.js runtime (not Edge Runtime)
if (typeof process !== 'undefined' && process.on && typeof window === 'undefined') {
  process.on('beforeExit', gracefulShutdown)
  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)
}
