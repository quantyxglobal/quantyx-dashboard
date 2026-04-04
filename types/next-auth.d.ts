import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: 'admin' | 'client' | 'employee'
      organization_id?: string
    } & DefaultSession['user']
  }

  interface User {
    id: string
    email: string
    name: string
    role: 'admin' | 'client' | 'employee'
    organization_id?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'admin' | 'client' | 'employee'
    organization_id?: string
  }
}
