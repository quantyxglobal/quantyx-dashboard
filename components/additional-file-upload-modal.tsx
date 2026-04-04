"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Upload, FileText, AlertCircle, X } from "lucide-react"
import { toast } from "sonner"

interface ServiceConfig {
  id: string
  name: string
  description?: string
}

interface AdditionalFileUploadModalProps {
  isOpen: boolean
  onClose: () => void
  caseId: string
  existingServices: string[] // Services already selected for this case
  onSuccess?: () => void
}

export function AdditionalFileUploadModal({ 
  isOpen,
  onClose,
  caseId, 
  existingServices, 
  onSuccess
}: AdditionalFileUploadModalProps) {
  const [formData, setFormData] = useState({
    specificInstructions: "",
  })
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [availableServices, setAvailableServices] = useState<ServiceConfig[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>("")
  const [isLoadingServices, setIsLoadingServices] = useState(true)

  // Load services from API - show ALL services (no filtering)
  useEffect(() => {
    if (isOpen) {
      const loadServices = async () => {
        try {
          const response = await fetch('/api/services')
          if (response.ok) {
            const data = await response.json()
            // Show ALL services (removed filtering)
            const allServices = data.services || []
            
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
            const sortedServices = allServices.sort((a: ServiceConfig, b: ServiceConfig) => {
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
  }, [isOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({ specificInstructions: "" })
      setSelectedServices([])
      setFiles([])
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles(prev => [...prev, ...newFiles])
      setError("")
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('[MODAL] Form submitted - selectedServices:', selectedServices, 'files:', files.length)
    
    // Validation - services are required
    if (selectedServices.length === 0) {
      console.log('[MODAL] Validation failed: No services selected')
      setError("Please select at least one service")
      toast.error("Please select at least one service")
      return
    }
    
    // Validation - files are required
    if (files.length === 0) {
      console.log('[MODAL] Validation failed: No files uploaded')
      setError("Please upload at least one file")
      toast.error("Please upload at least one file")
      return
    }

    console.log('[MODAL] Validation passed, proceeding with upload')
    setError("")
    setIsSubmitting(true)

    try {
      // Check if any files are large enough to require chunked upload
      const largeFiles = files.filter(f => f.size > 100 * 1024 * 1024) // >100MB
      
      if (largeFiles.length > 0) {
        // For large files, we'll still use FormData but the server will handle chunking
        // In a future enhancement, we could implement client-side chunking
        toast.info(`Uploading ${largeFiles.length} large file(s). This may take a while...`)
      }

      // Create FormData for the API call
      const submitFormData = new FormData()
      submitFormData.append('case_id', caseId)
      submitFormData.append('specific_instructions', formData.specificInstructions)
      submitFormData.append('services', JSON.stringify(selectedServices))
      
      console.log('[MODAL] FormData created:', {
        case_id: caseId,
        specific_instructions: formData.specificInstructions,
        services: selectedServices,
        files_count: files.length
      })
      
      // Add files
      files.forEach((file) => {
        submitFormData.append(`files`, file)
      })

      const response = await fetch(`/api/cases/${caseId}/additional-files`, {
        method: 'POST',
        body: submitFormData,
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        toast.success("Additional files and services added successfully!")
        onClose()
        if (onSuccess) onSuccess()
        // Refresh the page to show new files
        setTimeout(() => window.location.reload(), 500)
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto shadow-elegant bg-card/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Upload Additional Files
          </DialogTitle>
          <DialogDescription>
            Add more files or request additional services for this case
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload Section */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Upload Files</Label>
              <div className="relative border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Drop files here or click to browse</p>
                  <p className="text-xs text-muted-foreground">
                    Supports all file types up to 15GB each
                  </p>
                </div>
                <Input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="flex-shrink-0 h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Additional Services Selection */}
            {!isLoadingServices && availableServices.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Additional Services <span className="text-destructive">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">Select at least one service for the additional files</p>
                <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-2">
                  {availableServices.map((service) => (
                    <div key={service.id} className="flex items-center space-x-2 p-3 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={`additional-${service.id}`}
                        checked={selectedServices.includes(service.id)}
                        onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                      />
                      <Label htmlFor={`additional-${service.id}`} className="font-medium cursor-pointer flex-1">
                        {service.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
        </div>
      </DialogContent>
    </Dialog>
  )
}