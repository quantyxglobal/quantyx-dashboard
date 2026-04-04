/**
 * Edge-compatible Prisma client for middleware and edge functions
 * This version doesn't include Node.js-specific features like process.on
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { 
  prismaEdge: PrismaClient | undefined 
}

// Simplified Prisma configuration for Edge Runtime
function createEdgePrismaClient() {
  return new PrismaClient({
    log: ['error'], // Minimal logging for edge
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    errorFormat: 'minimal', // Smaller bundle size
  })
}

// Create or reuse Prisma client instance for Edge Runtime
export const prismaEdge = globalForPrisma.prismaEdge ?? createEdgePrismaClient()

// Store in global for development hot reloading
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaEdge = prismaEdge
}

// Connection health check function for edge
export async function checkEdgeDatabaseConnection(): Promise<boolean> {
  try {
    await prismaEdge.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Edge database connection failed:', error)
    return false
  }
}