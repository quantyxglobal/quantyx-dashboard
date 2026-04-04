import { PrismaClient } from '@prisma/client'

// Create a singleton pattern for Prisma client with better error handling
class DatabaseConnection {
  private static instance: PrismaClient | null = null
  private static isConnecting = false

  static async getInstance(): Promise<PrismaClient> {
    if (this.instance) {
      return this.instance
    }

    if (this.isConnecting) {
      // Wait for the connection to complete
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return this.instance!
    }

    this.isConnecting = true

    try {
      console.log('[DB] Creating new Prisma client instance...')
      
      this.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        datasources: {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      })

      // Test the connection
      await this.instance.$connect()
      console.log('[DB] Database connection established successfully')
      
      this.isConnecting = false
      return this.instance
    } catch (error) {
      this.isConnecting = false
      console.error('[DB] Failed to connect to database:', error)
      throw error
    }
  }

  static async disconnect() {
    if (this.instance) {
      await this.instance.$disconnect()
      this.instance = null
    }
  }
}

// Export a function that returns the singleton instance
export async function getPrismaClient(): Promise<PrismaClient> {
  return DatabaseConnection.getInstance()
}

// For backward compatibility, also export the traditional prisma instance
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma