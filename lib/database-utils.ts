/**
 * Database utility functions for performance monitoring and optimization
 */

import { prisma, withRetry, checkDatabaseConnection } from './prisma'

// Database health monitoring
export class DatabaseMonitor {
  private static instance: DatabaseMonitor
  private healthCheckInterval?: NodeJS.Timeout
  private isHealthy = true

  static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor()
    }
    return DatabaseMonitor.instance
  }

  startHealthCheck(intervalMs: number = 30000) {
    this.healthCheckInterval = setInterval(async () => {
      const wasHealthy = this.isHealthy
      this.isHealthy = await checkDatabaseConnection()
      
      if (wasHealthy && !this.isHealthy) {
        console.error('🔴 Database connection lost')
      } else if (!wasHealthy && this.isHealthy) {
        console.log('🟢 Database connection restored')
      }
    }, intervalMs)
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  getHealthStatus(): boolean {
    return this.isHealthy
  }
}

// Query performance utilities
export class QueryOptimizer {
  // Cache for frequently accessed data
  private static cache = new Map<string, { data: any; expires: number }>()

  static async getCached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 300000 // 5 minutes default
  ): Promise<T> {
    const cached = this.cache.get(key)
    
    if (cached && cached.expires > Date.now()) {
      return cached.data
    }

    const data = await fetcher()
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs
    })

    return data
  }

  static clearCache(key?: string) {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  // Batch operations for better performance
  static async batchCreate<T>(
    model: any,
    data: T[],
    batchSize: number = 100
  ): Promise<void> {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      await withRetry(() => model.createMany({ data: batch }))
    }
  }
}

// Common database operations with retry logic
export const dbOperations = {
  // Safe user lookup with caching
  async findUser(id: string) {
    return QueryOptimizer.getCached(
      `user:${id}`,
      () => withRetry(() => 
        prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            role: true,
            organization_id: true,
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })
      ),
      60000 // 1 minute cache
    )
  },

  // Optimized case listing
  async findCases(organizationId: string, options: {
    page?: number
    limit?: number
    status?: string
    search?: string
  } = {}) {
    const { page = 1, limit = 10, status, search } = options
    const skip = (page - 1) * limit

    const where: any = { organization_id: organizationId }
    
    if (status) where.status = status
    if (search) {
      where.OR = [
        { case_number: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } }
      ]
    }

    return withRetry(() => 
      Promise.all([
        prisma.case.findMany({
          where,
          select: {
            id: true,
            case_number: true,
            title: true,
            status: true,
            priority: true,
            created_at: true,
            due_date: true,
            client_name: true,
            estimated_cost: true,
            _count: {
              select: {
                files: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit
        }),
        prisma.case.count({ where })
      ])
    )
  },

  // Safe organization lookup
  async findOrganization(id: string) {
    return QueryOptimizer.getCached(
      `org:${id}`,
      () => withRetry(() =>
        prisma.organization.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            display_name: true,
            created_at: true,
            _count: {
              select: {
                users: true,
                cases: true
              }
            }
          }
        })
      ),
      300000 // 5 minutes cache
    )
  }
}

// Initialize database monitoring in development
if (process.env.NODE_ENV === 'development') {
  const monitor = DatabaseMonitor.getInstance()
  monitor.startHealthCheck()
  
  // Clean up on exit
  process.on('beforeExit', () => {
    monitor.stopHealthCheck()
  })
}