"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { UserCheck, Loader2, X } from "lucide-react"
import { assignCaseToEmployees } from "@/app/actions/assign-case"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface AssignCaseDropdownProps {
  caseId: string
  currentAssigneeIds: string[]
  organizationId?: string
}

export function AssignCaseDropdown({ caseId, currentAssigneeIds, organizationId }: AssignCaseDropdownProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAssigning, setIsAssigning] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(currentAssigneeIds || [])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/admin/employees')
        if (response.ok) {
          const data = await response.json()
          setEmployees(data.employees || [])
        }
      } catch (error) {
        console.error('Error fetching employees:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEmployees()
  }, [])

  const handleToggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId)
      } else {
        return [...prev, employeeId]
      }
    })
  }

  const handleRemoveEmployee = (employeeId: string) => {
    setSelectedEmployeeIds(prev => prev.filter(id => id !== employeeId))
  }

  const handleApply = async () => {
    if (isAssigning) return

    setIsAssigning(true)

    try {
      const result = await assignCaseToEmployees(caseId, selectedEmployeeIds)
      
      if (result.success) {
        setIsOpen(false)
        toast.success(
          selectedEmployeeIds.length === 0 
            ? "All employees unassigned successfully" 
            : `Case assigned to ${selectedEmployeeIds.length} employee${selectedEmployeeIds.length > 1 ? 's' : ''}`
        )
      } else {
        toast.error(result.error || "Failed to assign case")
        // Revert selection on error
        setSelectedEmployeeIds(currentAssigneeIds || [])
      }
    } catch (error) {
      console.error('Error assigning case:', error)
      toast.error("An unexpected error occurred")
      setSelectedEmployeeIds(currentAssigneeIds || [])
    } finally {
      setIsAssigning(false)
    }
  }

  const getSelectedEmployees = () => {
    return employees.filter(emp => selectedEmployeeIds.includes(emp.id))
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading employees...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <UserCheck className="w-4 h-4" />
        Assign to Employees
      </Label>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
            disabled={isAssigning}
          >
            {selectedEmployeeIds.length === 0 ? (
              <span className="text-muted-foreground">Select employees...</span>
            ) : (
              <span>{selectedEmployeeIds.length} employee{selectedEmployeeIds.length > 1 ? 's' : ''} selected</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Select Employees</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees available</p>
                ) : (
                  employees.map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={employee.id}
                        checked={selectedEmployeeIds.includes(employee.id)}
                        onCheckedChange={() => handleToggleEmployee(employee.id)}
                      />
                      <label
                        htmlFor={employee.id}
                        className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {employee.first_name} {employee.last_name}
                        <span className="text-muted-foreground text-xs block">{employee.email}</span>
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={handleApply}
                disabled={isAssigning}
                className="flex-1"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedEmployeeIds(currentAssigneeIds || [])
                  setIsOpen(false)
                }}
                disabled={isAssigning}
              >
                Cancel
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Display selected employees as badges */}
      {selectedEmployeeIds.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {getSelectedEmployees().map((employee) => (
            <Badge key={employee.id} variant="secondary" className="gap-1">
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
      )}
    </div>
  )
}
