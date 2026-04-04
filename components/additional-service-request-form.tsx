"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle, Plus, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface ServiceConfig {
  id: string
  name: string
  description?: string
}

interface AdditionalServiceRequestFormProps {
  caseId: string
  existingServices: string[] // Services already selected for this case
  onSuccess?: () => void
  onCancel?: () => void
}

export function AdditionalServiceRequestForm({ 
  caseId, 
  existingServices, 
  onSuccess, 
  onCancel 
}: AdditionalServiceRequestFormProps) {
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
    const loadServices = async () => {
      try {
        const response = await fetch('/api/services')
        if (response.ok) {
          const data = await response.json()
          // Filter out services already selected for this case
          const filteredServices = (data.services || []).filter(
            (service: ServiceConfig) => !existingServices.includes(service.id)
          )
          setAvailableServices(filteredServices)
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
  }, [existingServices])

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
        // Refresh the page to show updated services
        if (onCancel) onCancel() // Close the form first
        setTimeout(() => window.location.reload(), 500) // Then refresh
      } else {
        setError(result.error || "Failed to submit additional service request")
        setIsSubmitting(false)
      }
    } catch (error) {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  if (isLoadingServices) {
    return (
      <Card className="shadow-elegant bg-card/80 backdrop-blur-sm">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-muted-foreground">Loading services...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (availableServices.length === 0) {
    return (
      <Card className="shadow-elegant bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Request Additional Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium mb-2">All Services Selected</p>
            <p className="text-muted-foreground">
              This case already includes all available services.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-elegant bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Request Additional Services
        </CardTitle>
        <CardDescription>
          Select additional services to add to this case
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                    {service.description && (
                      <span className="block text-xs text-muted-foreground mt-1">
                        {service.description}
                      </span>
                    )}
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
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}