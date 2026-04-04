import { handlers } from '@/auth'

// Export handlers directly - they're already wrapped to be lazy-loaded
export const GET = handlers.GET
export const POST = handlers.POST

// Configure dynamic rendering for NextAuth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
