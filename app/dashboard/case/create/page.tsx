import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { CreateCaseForm } from '@/components/create-case-form'
import { DatabaseService } from '@/lib/database-service'

export default async function CreateCasePage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }
  
  try {
    // Get user's organization information using centralized service
    const user = await DatabaseService.getUserWithOrganization(session.user.id)
    
    if (!user?.organization_id) {
      console.error('[CREATE_CASE_PAGE] User has no organization:', session.user.id)
      redirect('/dashboard')
    }

    return <CreateCaseForm user={user} />
  } catch (error) {
    console.error('[CREATE_CASE_PAGE] Error loading page:', error)
    redirect('/dashboard')
  }
}