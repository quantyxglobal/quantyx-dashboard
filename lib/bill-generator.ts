/**
 * Bill Generator Service
 * Generates PDF invoices for cases with editable pricing
 */

export interface BillLineItem {
  serviceId: string
  serviceName: string
  description?: string
  hoursWorked: number
  ratePerHour: number
  quantity: number
  subtotal: number
}

export interface BillData {
  caseId: string
  caseNumber: string
  caseTitle: string
  clientName: string
  clientEmail: string
  firmName: string
  billDate: string
  dueDate?: string
  lineItems: BillLineItem[]
  subtotal: number
  discountPercent: number
  discountAmount: number
  surchargeAmount: number
  taxPercent: number
  taxAmount: number
  total: number
  notes?: string
  termsAndConditions?: string
}

export interface BillCalculation {
  subtotal: number
  discountAmount: number
  surchargeAmount: number
  taxAmount: number
  total: number
}

/**
 * Calculate bill totals based on line items, discount, surcharge, and tax
 */
export function calculateBillTotals(
  lineItems: BillLineItem[],
  discountPercent: number = 0,
  taxPercent: number = 0,
  surchargeAmount: number = 0
): BillCalculation {
  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0)
  const discountAmount = (subtotal * discountPercent) / 100
  const afterDiscount = subtotal - discountAmount
  const afterSurcharge = afterDiscount + surchargeAmount
  const taxAmount = (afterSurcharge * taxPercent) / 100
  const total = afterSurcharge + taxAmount

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    surchargeAmount: Number(surchargeAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    total: Number(total.toFixed(2))
  }
}

/**
 * Format currency for display (USD)
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Generate bill number based on case number and date
 */
export function generateBillNumber(caseNumber: string, date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `INV-${caseNumber}-${year}${month}${day}`
}
