'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { updateNextFirmId } from '@/app/actions/update-next-firm-id'

interface SuperAdminSettingsClientProps {
  currentNextFirmId: number
}

export default function SuperAdminSettingsClient({ currentNextFirmId }: SuperAdminSettingsClientProps) {
  const [nextFirmId, setNextFirmId] = useState(currentNextFirmId.toString())
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()

  const handleUpdate = async () => {
    const firmIdNumber = parseInt(nextFirmId)
    
    if (isNaN(firmIdNumber) || firmIdNumber < 1) {
      toast({
        title: 'Invalid Value',
        description: 'Firm ID must be a positive number',
        variant: 'destructive'
      })
      return
    }

    setIsUpdating(true)
    
    try {
      const result = await updateNextFirmId(firmIdNumber)
      
      if (result.success) {
        toast({
          title: 'Settings Updated',
          description: `Next firm ID set to ${firmIdNumber}`
        })
      } else {
        toast({
          title: 'Update Failed',
          description: result.error || 'Failed to update settings',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Firm ID Management</CardTitle>
          <CardDescription>
            Control the next firm ID that will be assigned when a new organization is created
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nextFirmId">Next Firm ID</Label>
            <div className="flex gap-4">
              <Input
                id="nextFirmId"
                type="number"
                min="1"
                value={nextFirmId}
                onChange={(e) => setNextFirmId(e.target.value)}
                className="max-w-xs"
              />
              <Button 
                onClick={handleUpdate} 
                disabled={isUpdating || nextFirmId === currentNextFirmId.toString()}
              >
                {isUpdating ? 'Updating...' : 'Update'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Current value: {currentNextFirmId}. The next organization created will be assigned firm ID {currentNextFirmId}.
            </p>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">How it works:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>When a new client registers and creates an organization, they are automatically assigned the next available firm ID</li>
              <li>The firm ID is used in case numbering (e.g., QGM_1000_0001)</li>
              <li>After each organization is created, the next firm ID automatically increments by 1</li>
              <li>You can manually set the next firm ID here to skip numbers or start from a specific value</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
