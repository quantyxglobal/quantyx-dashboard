'use server'

import { signOut } from '@/auth'

export async function logout() {
  try {
    await signOut({ redirectTo: '/login' })
  } catch (error) {
    // Log error server-side
    console.error('Logout error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
    
    // Even if signOut fails, we should attempt to redirect
    throw error
  }
}
