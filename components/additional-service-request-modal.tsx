"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, AlertCircle, CheckCircle, X } from "lucide-react"
import { toast } from "sonner"

interface ServiceConfig {
  id: string
  name: string
  description?: string
}

interface AdditionalServiceRequestModalProps {
  isOpen: boolean
  onClose: () => void
  caseId: string
  existingServices: string[] // Services already selected for this case
  onSuccess?: () => void
}

export function AdditionalServiceRequestModal({ 
  isOpen,
  onClose,
  caseId, 
  existingServices, 
  onSuccess
}: AdditionalServiceRequestModalProps) {
  const [formData, setFormData] = useState({
    specificInstructions: "",
  })
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [availableServices, setAvailableServices] = useState<ServiceConfig[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>("")
  const [isLoadingServices, setIsLoadingServices] = useState(true)

  // Load services from API and filter out existing ones
  useEffect(() => {
    if (isOpen) {
      const loadServices = async () => {
        try {
          const response = await fetch('/api/services')
          if (response.ok) {
            const data = await response.json()
            
            // Filter out services already selected for this case
            const filteredServices = (data.services || []).filter(
              (service: ServiceConfig) => !existingServices.includes(service.id)
            )
            
            // Define custom service order
            const serviceOrder = [
              'medical-chronology',
              'narrative-summary',
              'demand-letter',
              'life-care-plan',
              'medical-opinion',
              'medical-expenses',
              'hyperlinks',
              'bookmarks',
              'med-a-word',
              'deposition-prep',
              'lcp-support'
            ]
            
            // Sort services by custom order
            const sortedServices = filteredServices.sort((a, b) => {
              const indexA = serviceOrder.indexOf(a.id)
              const indexB = serviceOrder.indexOf(b.id)
              
              // If both services are in the order list, sort by their position
              if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB
              }
              // If only one is in the list, prioritize it
              if (indexA !== -1) return -1
              if (indexB !== -1) return 1
              // If neither is in the list, maintain alphabetical order
              return a.name.localeCompare(b.name)
            })
            
            setAvailableServices(sortedServices)
          } else {
            setError("Failed to load services")
          }
        } catch (error) {
          console.error('Error loading services:', error)
          setError("Failed to load services")
        } finally {
          setIsLoadingServices(false)
        }
      }

      loadServices()
    }
  }, [existingServices, isOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({ specificInstructions: "" })
      setSelectedServices([])
      setError("")
      setIsSubmitting(false)
      setIsLoadingServices(true)
    }
  }, [isOpen])

  const handleServiceChange = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedServices([...selectedServices, serviceId])
    } else {
      setSelectedServices(selectedServices.filter(id => id !== serviceId))
    }
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (selectedServices.length === 0) {
      setError("Please select at least one additional service")
      return
    }

    setError("")
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/cases/${caseId}/additional-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          services: selectedServices,
          specific_instructions: formData.specificInstructions,
        }),
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        toast.success("Additional service request submitted successfully!")
        onClose()
        if (onSuccess) onSuccess()
        // Refresh the page to show updated services
        setTimeout(() => window.location.reload(), 500)
      } else {
        setError(result.error || "Failed to submit additional service request")
        setIsSubmitting(false)
      }
    } catch (error) {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  const renderContent = () => {
    if (isLoadingServices) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-muted-foreground">Loading services...</span>
        </div>
      )
    }

    if (availableServices.length === 0) {
      return (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
          <p className="text-lg font-medium mb-2">All Services Selected</p>
          <p className="text-muted-foreground">
            This case already includes all available services.
          </p>
        </div>
      )
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Services Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Available Services *</Label>
          <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-2">
            {availableServices.map((service) => (
              <div key={service.id} className="flex items-center space-x-2 p-3 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id={`service-${service.id}`}
                  checked={selectedServices.includes(service.id)}
                  onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                />
                <Label htmlFor={`service-${service.id}`} className="font-medium cursor-pointer flex-1">
                  {service.name}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Specific Instructions */}
        <div className="space-y-2">
          <Label htmlFor="serviceInstructions">Specific Instructions</Label>
          <Textarea
            id="serviceInstructions"
            placeholder="Any specific requirements or instructions for the additional services..."
            rows={4}
            value={formData.specificInstructions}
            onChange={(e) => setFormData({ ...formData, specificInstructions: e.target.value })}
            className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            type="submit"
            className="flex-1"
            variant="professional"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Request Services
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col shadow-elegant bg-card/95 backdrop-blur-sm">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Additional Services
          </DialogTitle>
          <DialogDescription>
            Select additional services to add to this case
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto min-h-0">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}