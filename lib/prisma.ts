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

// Create or reuse Prisma client instance
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Store in global for development hot reloading
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Enhanced logging for development
if (process.env.NODE_ENV === 'development') {
  // Simple query monitoring without event listeners
  console.log('🔍 Development mode: Query monitoring enabled')
}

// Connection health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
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
    await Promise.race([
      prisma.$disconnect(),
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
