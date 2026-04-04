"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { EnhancedFileUpload } from "@/components/ui/enhanced-file-upload"
import { Upload, FileText, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface ServiceConfig {
  id: string
  name: string
  description?: string
}

interface AdditionalFileUploadFormProps {
  caseId: string
  existingServices: string[] // Services already selected for this case
  onSuccess?: () => void
  onCancel?: () => void
}

export function AdditionalFileUploadForm({ 
  caseId, 
  existingServices, 
  onSuccess, 
  onCancel 
}: AdditionalFileUploadFormProps) {
  const [formData, setFormData] = useState({
    _specificInstructions: "",
  })
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [availableServices, setAvailableServices] = useState<ServiceConfig[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
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

  const handleFilesSelected = (files: File[]) => {
    setUploadedFiles(files)
    setError("")
  }

  const handleFileRemoved = (_fileId: string) => {
    // The enhanced file upload component handles file removal internally
    // We just need to clear any errors
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation - at least files or services must be selected
    if (uploadedFiles.length === 0 && selectedServices.length === 0) {
      setError("Please upload files or select additional services")
      return
    }

    setError("")
    setIsSubmitting(true)

    try {
      // Create FormData for the API call
      const submitFormData = new FormData()
      submitFormData.append('case_id', caseId)
      submitFormData.append('specific_instructions', formData.specificInstructions)
      submitFormData.append('services', JSON.stringify(selectedServices))
      
      // Add files
      uploadedFiles.forEach((file, index) => {
        submitFormData.append(`files`, file)
      })

      const response = await fetch(`/api/cases/${caseId}/additional-files`, {
        method: 'POST',
        body: submitFormData,
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        toast.success("Additional files and services added successfully!")
        // Refresh the page to show new files
        if (onCancel) onCancel() // Close the form first
        setTimeout(() => window.location.reload(), 500) // Then refresh
      } else {
        setError(result.error || "Failed to upload additional files")
        setIsSubmitting(false)
      }
    } catch (error) {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="shadow-elegant bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          Upload Additional Files
        </CardTitle>
        <CardDescription>
          Add more files or request additional services for this case
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Additional Services Selection */}
          {!isLoadingServices && availableServices.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Additional Services</Label>
              <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2">
                {availableServices.map((service) => (
                  <div key={service.id} className="flex items-center space-x-2 p-3 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id={`additional-${service.id}`}
                      checked={selectedServices.includes(service.id)}
                      onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                    />
                    <Label htmlFor={`additional-${service.id}`} className="font-medium cursor-pointer flex-1">
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
          )}

          {/* Enhanced File Upload */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Upload Files</Label>
            <EnhancedFileUpload
              onFilesSelected={handleFilesSelected}
              onFileRemoved={handleFileRemoved}
              maxFiles={10}
              multiple={true}
              showProgress={true}
              autoUpload={false}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.iso,.dcm,.dicom"
              className="w-full"
            />
          </div>

          {/* Specific Instructions */}
          <div className="space-y-2">
            <Label htmlFor="additionalInstructions">Specific Instructions</Label>
            <Textarea
              id="additionalInstructions"
              placeholder="Any specific requirements or instructions for the additional files or services..."
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
                  Uploading...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Add to Case
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