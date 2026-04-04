"use client"

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { toast } from 'sonner'

interface SessionTimeoutHandlerProps {
  sessionStartTime?: number
  maxAge?: number // in milliseconds
}

/**
 * Client-side component to handle automatic logout after session expiration
 * Shows a warning 5 minutes before expiration and automatically logs out when expired
 */
export function SessionTimeoutHandler({ 
  sessionStartTime, 
  maxAge = 24 * 60 * 60 * 1000 // 24 hours default
}: SessionTimeoutHandlerProps) {
  const router = useRouter()
  const warningShownRef = useRef(false)
  const logoutTimerRef = useRef<NodeJS.Timeout>()
  const warningTimerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!sessionStartTime) return

    const checkSessionExpiration = () => {
      const now = Date.now()
      const sessionAge = now - sessionStartTime
      const timeRemaining = maxAge - sessionAge

      // If session has expired, logout immediately
      if (timeRemaining <= 0) {
        console.log('[SESSION] Session expired, logging out')
        handleLogout('Your session has expired. Please log in again.')
        return
      }

      // Show warning 5 minutes before expiration
      const warningTime = 5 * 60 * 1000 // 5 minutes
      if (timeRemaining <= warningTime && !warningShownRef.current) {
        warningShownRef.current = true
        const minutesRemaining = Math.ceil(timeRemaining / 60000)
        toast.warning(`Your session will expire in ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}`, {
          duration: 10000,
        })
        console.log('[SESSION] Warning shown, session expires in', minutesRemaining, 'minutes')
      }

      // Set timer for warning (if not already shown)
      if (timeRemaining > warningTime && !warningShownRef.current) {
        const timeUntilWarning = timeRemaining - warningTime
        warningTimerRef.current = setTimeout(() => {
          warningShownRef.current = true
          const minutesRemaining = 5
          toast.warning(`Your session will expire in ${minutesRemaining} minutes`, {
            duration: 10000,
          })
          console.log('[SESSION] Warning shown, session expires in 5 minutes')
        }, timeUntilWarning)
      }

      // Set timer for automatic logout
      logoutTimerRef.current = setTimeout(() => {
        handleLogout('Your session has expired. Please log in again.')
      }, timeRemaining)
    }

    const handleLogout = async (message: string) => {
      toast.error(message)
      console.log('[SESSION] Logging out:', message)
      
      // Clear any existing timers
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      
      // Sign out and redirect to login
      await signOut({ redirect: false })
      router.push('/login?session=expired')
    }

    // Initial check
    checkSessionExpiration()

    // Cleanup on unmount
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    }
  }, [sessionStartTime, maxAge, router])

  return null // This component doesn't render anything
}
