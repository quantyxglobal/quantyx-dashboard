'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { UserCheck, Loader2, X, Users, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
}

interface Assignment {
  user_id: string
  role: 'MANAGER' | 'EMPLOYEE'
}

interface MultiAssignCaseProps {
  caseId: string
  currentAssignments: Assignment[]
  organizationId?: string
}

export function MultiAssignCase({ caseId, currentAssignments, organizationId }: MultiAssignCaseProps) {
  const [managers, setManagers] = useState<User[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAssigning, setIsAssigning] = useState(false)
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>(
    currentAssignments.filter(a => a.role === 'MANAGER').map(a => a.user_id)
  )
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    currentAssignments.filter(a => a.role === 'EMPLOYEE').map(a => a.user_id)
  )
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true)
        
        // Fetch managers
        const managersResponse = await fetch('/api/users?role=MANAGER')
        if (managersResponse.ok) {
          const managersData = await managersResponse.json()
          setManagers(managersData.users || [])
        }

        // Fetch employees
        const employeesResponse = await fetch('/api/users?role=EMPLOYEE')
        if (employeesResponse.ok) {
          const employeesData = await employeesResponse.json()
          setEmployees(employeesData.users || [])
        }
      } catch (error) {
        console.error('Error fetching users:', error)
        toast.error('Failed to load users')
      } finally {
        setIsLoading(false)
      }
    }

    if (isOpen) {
      fetchUsers()
    }
  }, [isOpen])

  const handleToggleManager = (managerId: string) => {
    setSelectedManagerIds(prev => {
      if (prev.includes(managerId)) {
        return prev.filter(id => id !== managerId)
      } else {
        return [...prev, managerId]
      }
    })
  }

  const handleToggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId)
      } else {
        return [...prev, employeeId]
      }
    })
  }

  const handleRemoveManager = (managerId: string) => {
    setSelectedManagerIds(prev => prev.filter(id => id !== managerId))
  }

  const handleRemoveEmployee = (employeeId: string) => {
    setSelectedEmployeeIds(prev => prev.filter(id => id !== employeeId))
  }

  const handleApply = async () => {
    if (isAssigning) return

    setIsAssigning(true)

    try {
      const response = await fetch(`/api/cases/${caseId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerIds: selectedManagerIds,
          employeeIds: selectedEmployeeIds
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign case')
      }

      const totalAssigned = selectedManagerIds.length + selectedEmployeeIds.length
      
      setIsOpen(false)
      toast.success(
        totalAssigned === 0
          ? 'All assignments removed successfully'
          : `Case assigned to ${totalAssigned} user${totalAssigned > 1 ? 's' : ''} (${selectedManagerIds.length} manager${selectedManagerIds.length !== 1 ? 's' : ''}, ${selectedEmployeeIds.length} employee${selectedEmployeeIds.length !== 1 ? 's' : ''})`
      )
      
      // Refresh the page to show updated assignments
      window.location.reload()
    } catch (error) {
      console.error('Error assigning case:', error)
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred')
      
      // Revert selection on error
      setSelectedManagerIds(
        currentAssignments.filter(a => a.role === 'MANAGER').map(a => a.user_id)
      )
      setSelectedEmployeeIds(
        currentAssignments.filter(a => a.role === 'EMPLOYEE').map(a => a.user_id)
      )
    } finally {
      setIsAssigning(false)
    }
  }

  const getSelectedManagers = () => {
    return managers.filter(m => selectedManagerIds.includes(m.id))
  }

  const getSelectedEmployees = () => {
    return employees.filter(e => selectedEmployeeIds.includes(e.id))
  }

  const totalSelected = selectedManagerIds.length + selectedEmployeeIds.length

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <UserCheck className="w-4 h-4" />
        Assign Case
      </Label>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
            disabled={isAssigning}
          >
            {totalSelected === 0 ? (
              <span className="text-muted-foreground">Select users to assign...</span>
            ) : (
              <span>
                {totalSelected} user{totalSelected > 1 ? 's' : ''} assigned
                {selectedManagerIds.length > 0 && ` (${selectedManagerIds.length} manager${selectedManagerIds.length > 1 ? 's' : ''})`}
                {selectedEmployeeIds.length > 0 && ` (${selectedEmployeeIds.length} employee${selectedEmployeeIds.length > 1 ? 's' : ''})`}
              </span>
            )}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Case</DialogTitle>
            <DialogDescription>
              Assign this case to managers and/or employees. Managers can then delegate to their team members.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="managers" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="managers">
                  <Users className="w-4 h-4 mr-2" />
                  Managers ({selectedManagerIds.length})
                </TabsTrigger>
                <TabsTrigger value="employees">
                  <UserCircle className="w-4 h-4 mr-2" />
                  Employees ({selectedEmployeeIds.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="managers" className="space-y-4">
                <ScrollArea className="h-72 rounded-md border p-4">
                  {managers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No managers available
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {managers.map(manager => (
                        <div key={manager.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted">
                          <Checkbox
                            id={`manager-${manager.id}`}
                            checked={selectedManagerIds.includes(manager.id)}
                            onCheckedChange={() => handleToggleManager(manager.id)}
                          />
                          <label
                            htmlFor={`manager-${manager.id}`}
                            className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            {manager.first_name} {manager.last_name}
                            <span className="text-muted-foreground text-xs block">{manager.email}</span>
                          </label>
                          <Badge variant="secondary" className="text-xs">Manager</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="employees" className="space-y-4">
                <ScrollArea className="h-72 rounded-md border p-4">
                  {employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No employees available
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {employees.map(employee => (
                        <div key={employee.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted">
                          <Checkbox
                            id={`employee-${employee.id}`}
                            checked={selectedEmployeeIds.includes(employee.id)}
                            onCheckedChange={() => handleToggleEmployee(employee.id)}
                          />
                          <label
                            htmlFor={`employee-${employee.id}`}
                            className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            {employee.first_name} {employee.last_name}
                            <span className="text-muted-foreground text-xs block">{employee.email}</span>
                          </label>
                          <Badge variant="outline" className="text-xs">Employee</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedManagerIds(
                  currentAssignments.filter(a => a.role === 'MANAGER').map(a => a.user_id)
                )
                setSelectedEmployeeIds(
                  currentAssignments.filter(a => a.role === 'EMPLOYEE').map(a => a.user_id)
                )
                setIsOpen(false)
              }}
              disabled={isAssigning}
            >
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={isAssigning}>
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Apply Assignments'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Display selected users as badges */}
      {totalSelected > 0 && (
        <div className="space-y-2 mt-3">
          {selectedManagerIds.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Managers:</p>
              <div className="flex flex-wrap gap-2">
                {getSelectedManagers().map(manager => (
                  <Badge key={manager.id} variant="secondary" className="gap-1">
                    <Users className="w-3 h-3" />
                    {manager.first_name} {manager.last_name}
                    <button
                      onClick={() => handleRemoveManager(manager.id)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                      disabled={isAssigning}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {selectedEmployeeIds.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Employees:</p>
              <div className="flex flex-wrap gap-2">
                {getSelectedEmployees().map(employee => (
                  <Badge key={employee.id} variant="outline" className="gap-1">
                    <UserCircle className="w-3 h-3" />
                    {employee.first_name} {employee.last_name}
                    <button
                      onClick={() => handleRemoveEmployee(employee.id)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                      disabled={isAssigning}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
