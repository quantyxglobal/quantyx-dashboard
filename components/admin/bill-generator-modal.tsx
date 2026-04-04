'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Plus, Trash2, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { calculateBillTotals, formatCurrency, generateBillNumber, type BillLineItem } from '@/lib/bill-generator'

interface BillGeneratorModalProps {
  caseId: string
  caseNumber: string
  caseTitle: string
  clientName: string
  clientEmail: string
  firmName: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  country?: string
  caseServices: Array<{
    service_id: string
    service: {
      id: string
      name: string
      description?: string | null
      slug?: string
      price_per_hour?: number
    }
  }>
}

export function BillGeneratorModal({
  caseId,
  caseNumber,
  caseTitle,
  clientName,
  clientEmail,
  firmName,
  addressLine1,
  addressLine2,
  city,
  state,
  country,
  caseServices
}: BillGeneratorModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [billNumber, setBillNumber] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [lineItems, setLineItems] = useState<BillLineItem[]>([])
  const [discountPercent, setDiscountPercent] = useState(0)
  const [surchargeAmount, setSurchargeAmount] = useState(0)
  const [taxPercent, setTaxPercent] = useState(0) // Default 0% for US billing
  const [notes, setNotes] = useState('')
  const [termsAndConditions, setTermsAndConditions] = useState(
    'Payment is due within 30 days of invoice date. Late payments may incur additional charges.'
  )

  // Initialize line items from case services
  useEffect(() => {
    if (open && caseServices.length > 0 && lineItems.length === 0) {
      const initialItems: BillLineItem[] = caseServices.map(cs => ({
        serviceId: cs.service.id,
        serviceName: cs.service.name,
        description: cs.service.description || '',
        hoursWorked: 0, // Start with 0, admin will enter actual hours
        ratePerHour: Number(cs.service.price_per_hour) || 100, // Default $100/hour if not set
        quantity: 1, // Always 1, not editable
        subtotal: 0
      }))
      setLineItems(initialItems)
      setBillNumber(generateBillNumber(caseNumber))
      
      // Set due date to 30 days from now
      const due = new Date()
      due.setDate(due.getDate() + 30)
      setDueDate(due.toISOString().split('T')[0])
    }
  }, [open, caseServices, lineItems.length, caseNumber])

  const updateLineItem = (index: number, field: keyof BillLineItem, value: any) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    
    // Recalculate subtotal when hours or rate changes (quantity is always 1)
    if (field === 'hoursWorked' || field === 'ratePerHour') {
      const item = updated[index]
      updated[index].subtotal = item.hoursWorked * item.ratePerHour
    }
    
    setLineItems(updated)
  }

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        serviceId: '',
        serviceName: 'Custom Service',
        description: '',
        hoursWorked: 0,
        ratePerHour: 100, // Default $100/hour
        quantity: 1,
        subtotal: 0
      }
    ])
  }

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const totals = calculateBillTotals(lineItems, discountPercent, taxPercent, surchargeAmount)

  const handleGeneratePDF = async () => {
    setLoading(true)
    try {
      const billData = {
        caseId,
        caseNumber,
        caseTitle,
        clientName,
        clientEmail,
        firmName,
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        billNumber,
        billDate,
        dueDate,
        lineItems,
        subtotal: totals.subtotal,
        discountPercent,
        discountAmount: totals.discountAmount,
        surchargeAmount,
        taxPercent,
        taxAmount: totals.taxAmount,
        total: totals.total,
        notes,
        termsAndConditions
      }

      const response = await fetch('/api/bills/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      })

      if (!response.ok) {
        throw new Error('Failed to generate bill')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${billNumber}.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Bill generated successfully')
    } catch (error) {
      console.error('Error generating bill:', error)
      toast.error('Failed to generate bill')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAndUpload = async () => {
    setLoading(true)
    try {
      const billData = {
        caseId,
        caseNumber,
        caseTitle,
        clientName,
        clientEmail,
        firmName,
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        billNumber,
        billDate,
        dueDate,
        lineItems,
        subtotal: totals.subtotal,
        discountPercent,
        discountAmount: totals.discountAmount,
        surchargeAmount,
        taxPercent,
        taxAmount: totals.taxAmount,
        total: totals.total,
        notes,
        termsAndConditions
      }

      const response = await fetch('/api/bills/generate-and-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      })

      if (!response.ok) {
        throw new Error('Failed to generate and upload bill')
      }

      const result = await response.json()
      
      toast.success('Bill generated and uploaded to output section')
      setOpen(false)
      
      // Refresh the page to show the new file
      window.location.reload()
    } catch (error) {
      console.error('Error generating and uploading bill:', error)
      toast.error('Failed to generate and upload bill')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Generate Bill
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Bill - {caseNumber}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            All services for this case are listed below. Enter the hours worked and rate per hour for each service. Billing is calculated in US Dollars ($).
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bill Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="billNumber">Bill Number</Label>
              <Input
                id="billNumber"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="billDate">Bill Date</Label>
              <Input
                id="billDate"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Client Info (Read-only) */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p><strong>Client:</strong> {clientName}</p>
            <p><strong>Email:</strong> {clientEmail}</p>
            <p><strong>Firm:</strong> {firmName}</p>
            <p><strong>Case:</strong> {caseTitle}</p>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label className="text-lg font-semibold">Services</Label>
              <Button onClick={addLineItem} variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div key={index} className="border p-4 rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <Label>Service Name</Label>
                        <Input
                          value={item.serviceName}
                          onChange={(e) => updateLineItem(index, 'serviceName', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => removeLineItem(index)}
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Hours Worked</Label>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        value={item.hoursWorked}
                        onChange={(e) => updateLineItem(index, 'hoursWorked', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label>Rate/Hour ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.ratePerHour}
                        onChange={(e) => updateLineItem(index, 'ratePerHour', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label>Subtotal ($)</Label>
                      <Input
                        type="text"
                        value={formatCurrency(item.subtotal)}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="discount">Discount (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="surcharge">Surcharge ($)</Label>
                <Input
                  id="surcharge"
                  type="number"
                  step="0.01"
                  min="0"
                  value={surchargeAmount}
                  onChange={(e) => setSurchargeAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="tax">Tax/GST (%)</Label>
                <Input
                  id="tax"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({discountPercent}%):</span>
                  <span>-{formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              {surchargeAmount > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Surcharge:</span>
                  <span>+{formatCurrency(surchargeAmount)}</span>
                </div>
              )}
              {taxPercent > 0 && (
                <div className="flex justify-between">
                  <span>Tax/GST ({taxPercent}%):</span>
                  <span>{formatCurrency(totals.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes and Terms */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes or comments"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="terms">Terms and Conditions</Label>
              <Textarea
                id="terms"
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button onClick={() => setOpen(false)} variant="outline" disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleGeneratePDF} variant="outline" disabled={loading} className="gap-2">
              <Download className="h-4 w-4" />
              Download DOCX
            </Button>
            <Button onClick={handleGenerateAndUpload} disabled={loading} className="gap-2">
              <Upload className="h-4 w-4" />
              Generate & Upload to Output
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
