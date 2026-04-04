"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Upload, AlertCircle, CheckCircle, Building, ArrowLeft, Clock, X } from "lucide-react"
import { createCase } from "@/app/actions/create-case"
import { uploadFileInChunks, shouldUseChunkedUpload, formatFileSize as formatSize, validateFileSize } from "@/lib/chunked-upload"
import { toast } from "sonner"

interface ServiceConfig {
  id: string
  name: string
}

interface CreateCaseFormProps {
  user: {
    organization_id: string
    first_name: string
    last_name: string
    organization: {
      name: string
    } | null
  }
}

export function CreateCaseForm({ user }: CreateCaseFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    caseTitle: "",
    caseDescription: "",
    specificInstructions: "", // Updated from additionalRequests
    timeline: "NORMAL" as "SUPER_RUSH" | "EXPEDITE" | "NORMAL",
    estimateRequired: false,
  })
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [availableServices, setAvailableServices] = useState<ServiceConfig[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState<string>("")
  const [isLoadingServices, setIsLoadingServices] = useState(true)
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({}) // Track progress per file

  // Load services from API
  useEffect(() => {
    const loadServices = async () => {
      try {
        const response = await fetch('/api/services')
        if (response.ok) {
          const data = await response.json()
          console.log('[CREATE_CASE_FORM] Loaded services from API:', data.services)
          
          // Define custom service order matching the new services list
          const serviceOrder = [
            'medical-chronology',
            'narrative-summary',
            'demand-letter',
            'life-care-plan',
            'medical-opinion',
            'medical-expenses',
            'deposition-transcript',
            'med-a-word',
            'pressure-ulcer-matrix',
            'pain-medication-chart',
            'medical-illustration',
            'graphical-timeline',
            'comparison-chart',
            'case-facts-opinion',
            'hyperlinks',
            'bookmarks',
            'mass-tort-review'
          ]
          
          // Sort services by custom order
          const sortedServices = (data.services || []).sort((a: ServiceConfig, b: ServiceConfig) => {
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
          throw new Error('Failed to fetch services from API')
        }
      } catch (error) {
        console.error('Error loading services from API:', error)
        // Use fallback services in the correct order
        console.log('[CREATE_CASE_FORM] Using fallback hardcoded services')
        setAvailableServices([
          { id: "medical-chronology", name: "Medical Chronology" },
          { id: "narrative-summary", name: "Narrative Summary" },
          { id: "demand-letter", name: "Demand Letter" },
          { id: "life-care-plan", name: "Life Care Plan" },
          { id: "medical-opinion", name: "Medical Opinion" },
          { id: "medical-expenses", name: "Medical Expenses Summary" },
          { id: "deposition-transcript", name: "Deposition Transcript" },
          { id: "med-a-word", name: "Med-A-Word" },
          { id: "pressure-ulcer-matrix", name: "Pressure Ulcer Matrix" },
          { id: "pain-medication-chart", name: "Pain and Suffering and Pain Medication Chart" },
          { id: "medical-illustration", name: "Medical Illustration" },
          { id: "graphical-timeline", name: "Graphical Timeline Summary" },
          { id: "comparison-chart", name: "Comparison Chart" },
          { id: "case-facts-opinion", name: "Case Facts & Opinion" },
          { id: "hyperlinks", name: "Hyperlinks" },
          { id: "bookmarks", name: "Bookmarks" },
          { id: "mass-tort-review", name: "Mass-Tort Case Review" },
        ])
      } finally {
        setIsLoadingServices(false)
      }
    }

    loadServices()
  }, [])

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
      
      // Validate each file
      for (const file of newFiles) {
        const validation = validateFileSize(file.size)
        if (!validation.valid) {
          setError(validation.error || 'Invalid file size')
          return
        }
      }
      
      setFiles(prev => [...prev, ...newFiles])
      setError("")
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = formatSize // Use imported function

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Validation
    if (!formData.caseTitle.trim()) {
      setError("Please enter a case title")
      return
    }

    if (selectedServices.length === 0) {
      setError("Please select at least one service")
      return
    }

    if (files.length === 0) {
      setError("Please upload at least one file")
      return
    }

    setError("")
    setIsSubmitting(true)
    setIsUploading(files.length > 0)

    try {
      // First, create the case without files
      const submitFormData = new FormData()
      submitFormData.append('case_title', formData.caseTitle)
      submitFormData.append('description', formData.caseDescription)
      submitFormData.append('specific_instructions', formData.specificInstructions)
      submitFormData.append('timeline', formData.timeline)
      submitFormData.append('estimate_required', formData.estimateRequired.toString())
      submitFormData.append('services', JSON.stringify(selectedServices))
      submitFormData.append('file_count', '0') // Create case first, then upload files

      console.log('[CREATE_CASE_FORM] Creating case...')
      const result = await createCase(submitFormData)
      
      if (!result.success) {
        setError(result.error || "Failed to create case")
        setIsSubmitting(false)
        setIsUploading(false)
        return
      }

      console.log('[CREATE_CASE_FORM] Case created:', result.caseId)

      // Now handle file uploads if any
      if (files.length > 0) {
        console.log(`[CREATE_CASE_FORM] Uploading ${files.length} files...`)
        
        const uploadResults = await Promise.all(
          files.map(async (file) => {
            try {
              // Generate S3 key for this file using case number (not UUID)
              const timestamp = Date.now()
              const random = Math.random().toString(36).substring(2, 15)
              const s3Key = `cases/${result.generatedCaseId}/input/${timestamp}-${random}-${file.name}`

              console.log(`[CREATE_CASE_FORM] Uploading ${file.name} (${formatFileSize(file.size)}) to ${s3Key}`)
              
              // Use chunked upload for all files (consistent approach)
              const uploadResult = await uploadFileInChunks({
                file,
                s3Key,
                caseId: result.caseId,
                onProgress: (progress) => {
                  setUploadProgress(prev => ({
                    ...prev,
                    [file.name]: progress
                  }))
                },
                onChunkComplete: (chunk, total) => {
                  if (total > 1) {
                    console.log(`[CREATE_CASE_FORM] ${file.name}: Chunk ${chunk}/${total} complete`)
                  }
                }
              })

              if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'Upload failed')
              }

              // File record is created by assemble endpoint
              return { success: true, filename: file.name }
            } catch (error) {
              console.error(`[CREATE_CASE_FORM] Error uploading ${file.name}:`, error)
              return { 
                success: false, 
                filename: file.name, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              }
            }
          })
        )

        // Check if any uploads failed
        const failedUploads = uploadResults.filter(r => !r.success)
        if (failedUploads.length > 0) {
          console.warn('[CREATE_CASE_FORM] Some files failed to upload:', failedUploads)
          toast.warning(`Case created but ${failedUploads.length} file(s) failed to upload`)
        } else {
          console.log('[CREATE_CASE_FORM] All files uploaded successfully')
        }
      }

      setSubmitSuccess(true)
      toast.success(`Case created successfully! Case ID: ${result.generatedCaseId}`)
      
      // Redirect to the new case after a short delay
      setTimeout(() => {
        router.push(`/dashboard/case/${result.caseId}`)
      }, 2000)
      
    } catch (error) {
      console.error('[CREATE_CASE_FORM] Error:', error)
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
      setIsUploading(false)
    }
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-gradient-subtle relative">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <main className="container mx-auto px-4 py-16 relative z-10">
          <Card className="max-w-2xl mx-auto shadow-elegant bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-foreground">Case Created Successfully!</h2>
              <p className="text-lg text-muted-foreground mb-6">
                Your case &quot;{formData.caseTitle}&quot; has been created and is now ready for processing.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to your case details...
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-subtle relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Header Section */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4 hover:bg-primary/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <Image
                src="/quantyx-logo.png"
                alt="Quantyx Global"
                width={32}
                height={32}
                className="h-8 w-auto object-contain"
              />
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Create New <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Case</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Provide case details, select required services, and upload relevant documents to get started.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Case Information */}
            <Card className="shadow-elegant bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  Case Information
                </CardTitle>
                <CardDescription>
                  Basic details about your case for {user.organization?.name || 'your organization'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="caseTitle">Case Title *</Label>
                  <Input
                    id="caseTitle"
                    placeholder="Enter a descriptive case title"
                    value={formData.caseTitle}
                    onChange={(e) => setFormData({ ...formData, caseTitle: e.target.value })}
                    required
                    className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="caseDescription">Case Description</Label>
                  <Textarea
                    id="caseDescription"
                    placeholder="Provide a detailed description of the case, including relevant medical history, incident details, and any specific requirements..."
                    rows={6}
                    value={formData.caseDescription}
                    onChange={(e) => setFormData({ ...formData, caseDescription: e.target.value })}
                    className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specificInstructions">Specific Instructions</Label>
                  <Textarea
                    id="specificInstructions"
                    placeholder="Any specific requirements, deadlines, or instructions..."
                    rows={4}
                    value={formData.specificInstructions}
                    onChange={(e) => setFormData({ ...formData, specificInstructions: e.target.value })}
                    className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors"
                  />
                </div>

                {/* Timeline Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Timeline *
                  </Label>
                  <Select
                    value={formData.timeline}
                    onValueChange={(value: "SUPER_RUSH" | "EXPEDITE" | "NORMAL") => 
                      setFormData({ ...formData, timeline: value })
                    }
                  >
                    <SelectTrigger className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                      <SelectValue placeholder="Select delivery timeline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPER_RUSH">Super Rush (1–2 days)</SelectItem>
                      <SelectItem value="EXPEDITE">Expedite (3 days)</SelectItem>
                      <SelectItem value="NORMAL">Normal Delivery (1 week)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Estimate Required */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">
                    Do you require a cost estimate before work begins? *
                  </Label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, estimateRequired: true })}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        formData.estimateRequired
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border/50 hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          formData.estimateRequired ? 'border-primary' : 'border-border'
                        }`}>
                          {formData.estimateRequired && (
                            <div className="w-3 h-3 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="font-medium">Yes</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, estimateRequired: false })}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        !formData.estimateRequired
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border/50 hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          !formData.estimateRequired ? 'border-primary' : 'border-border'
                        }`}>
                          {!formData.estimateRequired && (
                            <div className="w-3 h-3 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="font-medium">No</span>
                      </div>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Services & Documents */}
            <div className="space-y-8">
              {/* Services Selection */}
              <Card className="shadow-elegant bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    Services Required *
                  </CardTitle>
                  <CardDescription>
                    Select the medilegal services you need for this case
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingServices ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="ml-2 text-muted-foreground">Loading services...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                      {availableServices.map((service) => (
                        <div key={service.id} className="flex items-center space-x-2 p-3 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors">
                          <Checkbox
                            id={service.id}
                            checked={selectedServices.includes(service.id)}
                            onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                          />
                          <Label htmlFor={service.id} className="font-medium cursor-pointer flex-1">
                            {service.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* File Upload Section */}
              <Card className="shadow-elegant bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" />
                    Case Documents *
                  </CardTitle>
                  <CardDescription>
                    Upload relevant medical records, reports, and other case documents (Required)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    files.length === 0 ? 'border-destructive/50 hover:border-destructive' : 'border-border/50 hover:border-primary/50'
                  }`}>
                    <Upload className={`w-12 h-12 mx-auto mb-4 ${files.length === 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {files.length === 0 ? 'Please upload at least one file *' : 'Drop files here or click to browse'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports all file types up to 15GB each. Large files will be uploaded in chunks.
                      </p>
                    </div>
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>

                  {files.length === 0 && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      <p className="text-sm text-destructive">At least one file is required to create a case</p>
                    </div>
                  )}

                  {/* File List */}
                  {files.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {files.map((file, index) => {
                        const progress = uploadProgress[file.name] || 0
                        const isUploading = progress > 0 && progress < 100
                        const isComplete = progress === 100
                        
                        return (
                          <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.size)}
                                  </p>
                                </div>
                              </div>
                              {!isSubmitting && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(index)}
                                  className="flex-shrink-0 h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                              {isComplete && (
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                              )}
                            </div>
                            
                            {/* Progress bar */}
                            {isSubmitting && progress > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    {isUploading ? 'Uploading...' : isComplete ? 'Complete' : 'Pending'}
                                  </span>
                                  <span className="font-medium">{Math.round(progress)}%</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {isUploading && (
                    <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Uploading files...
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Please don&apos;t close this page while files are uploading.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-6 flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg max-w-4xl mx-auto">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-8 max-w-4xl mx-auto">
            <Button
              type="submit"
              className="w-full h-12 text-lg shadow-elegant hover:shadow-glow transition-all duration-300"
              variant="professional"
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {isUploading ? "Uploading files and creating case..." : "Creating Case..."}
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Create Case
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-4">
              Your case will be created and ready for processing by our medical experts
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}