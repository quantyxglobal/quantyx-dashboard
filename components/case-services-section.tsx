"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Settings, Plus, CheckCircle } from "lucide-react"
import { AdditionalServiceRequestModal } from "@/components/additional-service-request-modal"

interface Service {
  id: string
  name: string
  description?: string
}

interface CaseServicesSectionProps {
  caseId: string
  existingServices: string[]
  selectedServices: Service[]
  isClient: boolean
}

export function CaseServicesSection({ caseId, existingServices, selectedServices, isClient }: CaseServicesSectionProps) {
  const [showAddServicesModal, setShowAddServicesModal] = useState(false)

  if (selectedServices.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Services Requested
              </CardTitle>
              {isClient && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddServicesModal(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Services
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Settings className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No Services Selected</p>
              <p className="text-muted-foreground">
                No services have been requested for this case yet.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional Services Modal */}
        {isClient && (
          <AdditionalServiceRequestModal
            isOpen={showAddServicesModal}
            onClose={() => setShowAddServicesModal(false)}
            caseId={caseId}
            existingServices={existingServices}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Services Requested
            </CardTitle>
            {isClient && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddServicesModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Services
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedServices.map((service) => (
              <div
                key={service.id}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border/50"
              >
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{service.name}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Additional Services Modal */}
      {isClient && (
        <AdditionalServiceRequestModal
          isOpen={showAddServicesModal}
          onClose={() => setShowAddServicesModal(false)}
          caseId={caseId}
          existingServices={existingServices}
        />
      )}
    </div>
  )
}