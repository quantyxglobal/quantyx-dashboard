'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export function CreateCaseModal() {
  const router = useRouter()

  const handleCreateCase = () => {
    router.push('/dashboard/case/create')
  }

  return (
    <Button 
      onClick={handleCreateCase}
      variant="professional" 
      size="lg"
      className="shadow-elegant hover:shadow-glow transition-all duration-300"
    >
      <Plus className="h-5 w-5 mr-2" />
      Create New Case
    </Button>
  )
}