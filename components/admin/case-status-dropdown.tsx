'use client'

import { useState } from 'react'
import { CaseStatus } from '@prisma/client'
import { updateCaseStatus } from '@/app/actions/update-case-status'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'

interface CaseStatusDropdownProps {
  caseId: string
  currentStatus: CaseStatus
}

export function CaseStatusDropdown({ caseId, currentStatus }: CaseStatusDropdownProps) {
  const [status, setStatus] = useState<CaseStatus>(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<CaseStatus | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  
  const handleStatusChange = async (newStatus: CaseStatus) => {
    if (newStatus === status) return
    
    // Show confirmation dialog for status changes
    setPendingStatus(newStatus)
    setShowConfirmation(true)
  }
  
  const confirmStatusChange = async () => {
    if (!pendingStatus) return
    
    setIsUpdating(true)
    
    try {
      const result = await updateCaseStatus(caseId, pendingStatus)
      
      if (result.success) {
        setStatus(pendingStatus)
        toast.success('Case status updated successfully')
      } else {
        toast.error(result.error || 'Failed to update case status')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
      console.error('Status update error:', error)
    } finally {
      setIsUpdating(false)
      setPendingStatus(null)
    }
  }
  
  const cancelStatusChange = () => {
    setPendingStatus(null)
  }
  
  const getStatusColor = (status: CaseStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'UNDER_REVIEW':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'DELIVERED':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'ON_HOLD':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }
  
  const formatStatus = (status: CaseStatus) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }
  
  return (
    <>
      <Select
        value={status}
        onValueChange={(value) => handleStatusChange(value as CaseStatus)}
        disabled={isUpdating}
      >
        <SelectTrigger 
          className={`w-[140px] ${getStatusColor(status)} border font-medium text-xs`}
        >
          <SelectValue>
            {isUpdating ? 'Updating...' : formatStatus(status)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PENDING">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              Pending
            </span>
          </SelectItem>
          <SelectItem value="IN_PROGRESS">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              In Progress
            </span>
          </SelectItem>
          <SelectItem value="UNDER_REVIEW">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              Under Review
            </span>
          </SelectItem>
          <SelectItem value="COMPLETED">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Completed
            </span>
          </SelectItem>
          <SelectItem value="DELIVERED">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              Delivered
            </span>
          </SelectItem>
          <SelectItem value="ON_HOLD">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-500"></span>
              On Hold
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <ConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        title="Confirm Status Change"
        description={`Are you sure you want to change the case status from "${formatStatus(status)}" to "${pendingStatus ? formatStatus(pendingStatus) : ''}"? This action will update the case timeline and notify relevant users.`}
        confirmText="Update Status"
        cancelText="Cancel"
        onConfirm={confirmStatusChange}
        onCancel={cancelStatusChange}
      />
    </>
  )
}
