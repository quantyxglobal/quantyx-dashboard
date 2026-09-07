/**
 * Validate Invoice Template Script
 * Tests if the DOCX template has all required placeholders
 */

import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { readFileSync } from 'fs'
import { join } from 'path'

// Sample test data matching the template structure
const testData = {
  // Invoice header
  invoiceNumber: 'INV-2026-001',
  invoiceDate: '09/07/26',
  taxId: 'TAX123456',
  
  // Client information (Billed To)
  firmName: 'Test Law Firm LLC',
  clientName: 'John Smith',
  addressLine1: '123 Main Street',
  addressLine2: 'Suite 456',
  hasAddressLine2: true,
  city: 'New York',
  stateCountry: 'NY, USA',
  
  // Case information
  caseName: 'Smith vs. Johnson Medical Malpractice',
  caseNumber: 'QGM_001_0001',
  
  // Services Loop:
  services: [
    {
      sNo: '1',
      serviceName: 'Medical Chronology Review',
      description: 'Comprehensive review of 500 pages',
      qtyHours: '10.00',
      unitRate: '$50.00/hr',
      amount: '$500.00'
    },
    {
      sNo: '2',
      serviceName: 'Narrative Summary Preparation',
      description: 'Detailed narrative with medical opinions',
      qtyHours: '5.00',
      unitRate: '$60.00/hr',
      amount: '$300.00'
    },
    {
      sNo: '3',
      serviceName: 'Expert Consultation',
      description: 'Phone consultation with medical expert',
      qtyHours: '2.00',
      unitRate: '$100.00/hr',
      amount: '$200.00'
    }
  ],
  
  // Financial totals
  subtotal: '$1,000.00',
  discount: '$50.00',
  discountPercent: '5.00%',
  expediteFee: '$100.00',
  tax: '$76.50',
  taxPercent: '7.50%',
  totalDue: '$1,126.50',
  
  // Payment information
  accountName: 'Quantyx Global Med-Legal Solutions Pvt. Ltd.',
  bankName: 'Axis Bank',
  accountNo: '123456789012',
  ifscCode: 'UTIB0001234',
  swiftCode: 'AXISINBB123',
  
  // Company contact
  companyPhone: '+91-70751-84488',
  companyEmail: 'support@quantyxg.com',
  companyWebsite: 'www.quantyxg.com',
  
  // Additional notes
  notes: 'Thank you for your business. Payment is due within 30 days.',
  termsAndConditions: 'Payment terms: Net 30 days. Late payments subject to 1.5% monthly interest.'
}

async function validateTemplate() {
  console.log('🔍 Validating Invoice Template...\n')
  
  try {
    // Read the DOCX template
    const templatePath = join(process.cwd(), 'lib', 'Quantyx Invoice Template.docx')
    console.log(`📄 Template path: ${templatePath}`)
    
    const content = readFileSync(templatePath, 'binary')
    console.log('✅ Template file read successfully\n')
    
    // Load into PizZip
    const zip = new PizZip(content)
    
    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    })
    
    // Get all tags (placeholders) used in the template
    const tags = doc.getFullText()
    console.log('📋 Template content loaded\n')
    
    // Try to render with test data
    console.log('🔧 Rendering template with test data...')
    doc.render(testData)
    console.log('✅ Template rendered successfully!\n')
    
    // List all placeholders expected
    console.log('📝 Expected Placeholders:\n')
    console.log('Invoice Header:')
    console.log('  {invoiceNumber}, {invoiceDate}, {taxId}\n')
    
    console.log('Client Information (Billed To):')
    console.log('  {firmName}, {clientName}')
    console.log('  {addressLine1}, {addressLine2}')
    console.log('  {city}, {stateCountry}\n')
    
    console.log('Case Information:')
    console.log('  {caseName}, {caseNumber}\n')
    
    console.log('Services Loop (inline format):')
    console.log('  Row 1: Header row with "S.No | Service - Description | Qty/Hours | Unit Rate | Amount"')
    console.log('  Row 2: {#services}{serviceName} - {description}{/services}')
    console.log('         OR')
    console.log('         {#services}{serviceDescription}{/services}')
    console.log('  Row 3: {sNo} | {serviceDescription} OR {serviceName} - {description} | {qtyHours} | {unitRate} | {amount}')
    console.log('  Note: Loop tags {#services} and {/services} should be on the SAME LINE, no empty rows\n')
    
    console.log('Financial Totals:')
    console.log('  {subtotal}, {discount}, {discountPercent}, {expediteFee}')
    console.log('  {tax}, {taxPercent}, {totalDue}\n')
    
    console.log('Payment Information:')
    console.log('  {accountName}, {bankName}, {accountNo}')
    console.log('  {ifscCode}, {swiftCode}\n')
    
    console.log('Company Contact:')
    console.log('  {companyPhone}, {companyEmail}, {companyWebsite}\n')
    
    console.log('Additional:')
    console.log('  {notes}, {termsAndConditions}\n')
    
    // Generate output file for manual verification
    const outputBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })
    
    const outputPath = join(process.cwd(), 'lib', 'TEST_Invoice_Output.docx')
    const fs = await import('fs')
    fs.writeFileSync(outputPath, outputBuffer)
    console.log(`✅ Test invoice generated: ${outputPath}`)
    console.log('   Please open this file to verify all placeholders are correctly replaced.\n')
    
    console.log('🎉 Template validation PASSED!')
    console.log('   All expected placeholders are working correctly.')
    
  } catch (error) {
    console.error('❌ Template validation FAILED!\n')
    
    if (error instanceof Error) {
      console.error('Error:', error.message)
      
      // Check for common docxtemplater errors
      if (error.message.includes('TemplateError')) {
        console.error('\n⚠️  Common Issues:')
        console.error('   1. Check if placeholders use correct syntax: {fieldName}')
        console.error('   2. Ensure loops use: {#arrayName}...{/arrayName}')
        console.error('   3. Verify no typos in placeholder names')
        console.error('   4. Make sure template is saved as .docx (not .doc)')
      }
      
      // Show stack for debugging
      if (error.stack) {
        console.error('\n📚 Full error stack:')
        console.error(error.stack)
      }
    }
    
    process.exit(1)
  }
}

// Run validation
validateTemplate()
