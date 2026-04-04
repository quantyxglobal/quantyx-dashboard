/**
 * PDF Generator for Bills/Invoices
 * Uses DOCX template to generate professional invoices
 */

import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { readFileSync } from 'fs'
import { join } from 'path'
// Removed unused import: formatCurrency

interface BillLineItem {
  serviceName: string
  description?: string
  hoursWorked: number
  ratePerHour: number
  quantity: number
  subtotal: number
}

interface BillData {
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
  billNumber: string
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

/**
 * Generate a bill using the DOCX template
 * Returns a DOCX buffer (not PDF yet - can be converted later if needed)
 */
export async function generateBillPDF(billData: BillData): Promise<Buffer> {
  try {
    // Read the DOCX template
    const templatePath = join(process.cwd(), 'lib', 'Quantyx Invoice Template.docx')
    const content = readFileSync(templatePath, 'binary')

    // Load the template into PizZip
    const zip = new PizZip(content)

    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    })

    // Format dates to MM/DD/YY
    const formatDate = (dateString: string) => {
      const date = new Date(dateString)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const year = String(date.getFullYear()).slice(-2)
      return `${month}/${day}/${year}`
    }

    // Prepare data for template based on the actual DOCX template structure
    const templateData = {
      // Invoice number and date
      invoiceNumber: billData.billNumber,
      invoiceDate: formatDate(billData.billDate),
      taxId: '', // Add if needed
      
      // Client/Firm information (Billed To section)
      firmName: billData.firmName,
      clientName: billData.clientName,
      addressLine1: billData.addressLine1 || '',
      addressLine2: billData.addressLine2 || '',
      hasAddressLine2: !!(billData.addressLine2 && billData.addressLine2.trim()), // Boolean flag for conditional rendering
      city: billData.city || '',
      stateCountry: billData.state && billData.country 
        ? `${billData.state}, ${billData.country}` 
        : billData.state || billData.country || '',
      
      // Case information
      caseName: billData.caseTitle,
      caseNumber: billData.caseNumber,
      
      // Line items (services table)
      services: billData.lineItems.map((item, index) => ({
        sNo: (index + 1).toString(),
        serviceDescription: item.serviceName, // Only service name
        qtyHours: item.hoursWorked.toFixed(2),
        unitRate: `$${item.ratePerHour.toFixed(2)}/hr`,
        amount: `$${item.subtotal.toFixed(2)}`
      })),
      
      // Financial totals
      subtotal: `$${billData.subtotal.toFixed(2)}`,
      discount: billData.discountPercent > 0 ? `$${billData.discountAmount.toFixed(2)}` : 'NA',
      discountPercent: billData.discountPercent > 0 ? `${billData.discountPercent.toFixed(2)}%` : '',
      expediteFee: billData.surchargeAmount > 0 ? `$${billData.surchargeAmount.toFixed(2)}` : 'NA',
      tax: billData.taxPercent > 0 ? `$${billData.taxAmount.toFixed(2)}` : 'NA',
      taxPercent: billData.taxPercent > 0 ? `${billData.taxPercent.toFixed(2)}%` : '',
      totalDue: `$${billData.total.toFixed(2)}`,
      
      // Payment information (static - update with actual bank details)
      accountName: 'Quantyx Global Med-Legal Solutions Pvt. Ltd.',
      bankName: 'Axis Bank',
      accountNo: '[Account Number]',
      ifscCode: '[IFSC Code]',
      swiftCode: '[SWIFT Code]',
      
      // Company contact information
      companyPhone: '+91-70751-84488',
      companyEmail: 'support@quantyxg.com',
      companyWebsite: 'www.quantyxg.com',
      
      // Additional fields
      notes: billData.notes || '',
      termsAndConditions: billData.termsAndConditions || ''
    }

    // Render the document (replace placeholders with data)
    doc.render(templateData)

    // Get the generated document as a buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })

    return buffer
  } catch (error) {
    console.error('[PDF_GENERATOR] Error generating bill from template:', error)
    if (error instanceof Error) {
      console.error('[PDF_GENERATOR] Error details:', error.message)
      console.error('[PDF_GENERATOR] Stack:', error.stack)
    }
    throw new Error(`Failed to generate bill: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * INSTRUCTIONS FOR TEMPLATE CUSTOMIZATION:
 * 
 * The DOCX template should use the following placeholder syntax:
 * 
 * 1. Simple fields: {fieldName}
 *    Example: Invoice Number: {billNumber}
 * 
 * 2. Loops (for line items): {#lineItems}...{/lineItems}
 *    Example:
 *    {#lineItems}
 *    {serviceName} | {hoursWorked} hrs | {ratePerHour} | {subtotal}
 *    {/lineItems}
 * 
 * 3. Conditionals: {#condition}...{/condition}
 *    Example:
 *    {#hasDiscount}
 *    Discount ({discountPercent}%): -{discountAmount}
 *    {/hasDiscount}
 * 
 * Available fields:
 * - billNumber, invoiceNumber, billDate, invoiceDate, dueDate
 * - clientName, clientEmail, firmName
 * - caseNumber, caseTitle
 * - lineItems[] (serviceName, description, hoursWorked, ratePerHour, subtotal)
 * - subtotal, discountPercent, discountAmount, surchargeAmount, taxPercent, taxAmount, total
 * - notes, termsAndConditions
 * - hasDiscount, hasSurcharge, hasTax, hasNotes (boolean flags)
 * - companyName, companyEmail, companyPhone, companyAddress
 */
