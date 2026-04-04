import { handlers } from '@/auth'

export const { GET, POST } = handlers

// Configure dynamic rendering for NextAuth
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
