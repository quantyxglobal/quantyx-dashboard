import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function Home() {
  const session = await auth()
  
  // Redirect authenticated users to their appropriate dashboard
  if (session?.user) {
    if (session.user.role === 'SUPER_ADMIN') {
      redirect('/superadmin')
    } else if (session.user.role === 'ADMIN') {
      redirect('/admin')
    } else if (session.user.role === 'EMPLOYEE') {
      redirect('/dashboard')
    } else {
      redirect('/dashboard')
    }
  }
  
  // Redirect unauthenticated users to login
  redirect('/login')
}
