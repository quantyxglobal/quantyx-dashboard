"use client"

import { SessionProvider } from 'next-auth/react'
import { SessionTimeoutHandler } from './session-timeout-handler'
import { useSession } from 'next-auth/react'

function SessionTimeoutWrapper() {
  const { data: session } = useSession()
  
  // Extract session start time from the session token
  // This will be passed from the JWT token
  const sessionStartTime = (session as any)?.sessionStart
  
  return <SessionTimeoutHandler sessionStartTime={sessionStartTime} />
}

export function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider 
      basePath="/api/auth"
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true}
    >
      {children}
      <SessionTimeoutWrapper />
    </SessionProvider>
  )
}
