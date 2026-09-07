# Invoice Template Placeholder Guide

## ⚠️ Template Validation Error Found

**Error**: The template has `{/services}` (closing tag) without `{#services}` (opening tag).

**Solution**: You need to manually edit the DOCX template file and add the loop opening tag.

---

## Required Template Structure

### 1. **Invoice Header Section**
```
INVOICE

Invoice #: {invoiceNumber}
Date: {invoiceDate}
Tax ID: {taxId}
```

### 2. **Billed To Section**
```
BILLED TO:
{firmName}
{clientName}
{addressLine1}
{addressLine2}
{city}, {stateCountry}
```

### 3. **Case Information**
```
Case Name: {caseName}
Case Number: {caseNumber}
```

### 4. **Services Table** (⚠️ **CRITICAL - Loop Required**)
```
S.No | Service Description | Qty/Hours | Unit Rate | Amount
-----|---------------------|-----------|-----------|-------
{#services}
{sNo} | {serviceDescription} | {qtyHours} | {unitRate} | {amount}
{/services}
```

**Important**: 
- The `{#services}` line must appear BEFORE the first service data row
- The `{/services}` line must appear AFTER the last service data row
- Everything between these tags will repeat for each line item

### 5. **Totals Section**
```
Subtotal:           {subtotal}
Discount ({discountPercent}):  {discount}
Expedite Fee:       {expediteFee}
Tax ({taxPercent}):            {tax}
---------------------------------
TOTAL DUE:          {totalDue}
```

### 6. **Payment Information**
```
PAYMENT DETAILS:
Account Name:   {accountName}
Bank Name:      {bankName}
Account No:     {accountNo}
IFSC Code:      {ifscCode}
SWIFT Code:     {swiftCode}
```

### 7. **Contact Information**
```
Quantyx Global Med-Legal Solutions

Phone:   {companyPhone}
Email:   {companyEmail}
Website: {companyWebsite}
```

### 8. **Notes & Terms** (Optional)
```
Notes:
{notes}

Terms & Conditions:
{termsAndConditions}
```

---

## How to Fix the Template

### Step 1: Open the Template
1. Open `Quantyx Invoice Template.docx` in Microsoft Word
2. Enable "Show/Hide ¶" to see all formatting marks

### Step 2: Locate the Services Table
Find the table that contains invoice line items (services)

### Step 3: Add Loop Tags
**BEFORE the first data row** (the row with actual service data, not the header), add a new row or place on the same row:
```
{#services}
```

**AFTER the last data row**, add:
```
{/services}
```

**Example Structure:**
```
+------+---------------------+----------+-----------+--------+
| S.No | Service Description | Qty/Hrs  | Rate      | Amount |
+------+---------------------+----------+-----------+--------+
{#services}  ← ADD THIS BEFORE DATA ROW
| {sNo} | {serviceDescription} | {qtyHours} | {unitRate} | {amount} |
{/services}  ← ADD THIS AFTER DATA ROW
+------+---------------------+----------+-----------+--------+
```

### Step 4: Verify All Placeholders
Make sure these exact placeholder names are used (case-sensitive):

**Invoice Info:**
- `{invoiceNumber}` - Invoice number
- `{invoiceDate}` - Invoice date (MM/DD/YY format)
- `{taxId}` - Tax ID (optional)

**Client Info:**
- `{firmName}` - Law firm name
- `{clientName}` - Client contact name
- `{addressLine1}` - Street address
- `{addressLine2}` - Suite/Unit (optional)
- `{city}` - City
- `{stateCountry}` - State and Country combined

**Case Info:**
- `{caseName}` - Case title
- `{caseNumber}` - Case reference number

**Services (inside loop):**
- `{sNo}` - Serial number
- `{serviceDescription}` - Service name
- `{qtyHours}` - Hours worked
- `{unitRate}` - Rate per hour with currency
- `{amount}` - Line total with currency

**Totals:**
- `{subtotal}` - Sum before adjustments
- `{discount}` - Discount amount or "NA"
- `{discountPercent}` - Discount percentage
- `{expediteFee}` - Rush/expedite fee or "NA"
- `{tax}` - Tax amount or "NA"
- `{taxPercent}` - Tax percentage
- `{totalDue}` - Final total

**Payment:**
- `{accountName}` - Bank account name
- `{bankName}` - Bank name
- `{accountNo}` - Account number
- `{ifscCode}` - IFSC code (India)
- `{swiftCode}` - SWIFT code (International)

**Contact:**
- `{companyPhone}` - Support phone
- `{companyEmail}` - Support email
- `{companyWebsite}` - Company website

**Optional:**
- `{notes}` - Invoice notes
- `{termsAndConditions}` - Payment terms

---

## Testing After Fixing

After you fix the template, run this command to validate:

```bash
cd "f:\quantix global\medilegal-dashboard"
npx tsx scripts/validate-invoice-template.ts
```

If successful, you'll see:
```
✅ Template rendered successfully!
🎉 Template validation PASSED!
```

A test invoice file will be generated at:
```
f:\quantix global\medilegal-dashboard\lib\TEST_Invoice_Output.docx
```

Open it to verify all placeholders are correctly replaced with test data.

---

## Common Mistakes to Avoid

1. **Wrong bracket type**: Use `{field}` NOT `{{field}}` or `[field]`
2. **Typos**: Placeholders are case-sensitive - `{InvoiceNumber}` ≠ `{invoiceNumber}`
3. **Missing loop tags**: Every `{/services}` needs a matching `{#services}` before it
4. **Loop tags in wrong place**: Tags must be OUTSIDE the content they're looping
5. **Spaces in placeholders**: `{invoice Number}` is wrong - use `{invoiceNumber}`

---

## Sample Data for Testing

The validation script uses this test data:

- **Invoice**: INV-2026-001, dated 09/07/26
- **Client**: Test Law Firm LLC, John Smith
- **Address**: 123 Main Street, Suite 456, New York, NY, USA
- **Case**: Smith vs. Johnson Medical Malpractice (QGM_001_0001)
- **Services**: 3 line items totaling $1,000.00
- **After adjustments**: $1,126.50 total due

Check if these values appear correctly in `TEST_Invoice_Output.docx` after validation passes.

---

## Need Help?

If you continue to see errors:
1. Check the error message for the specific placeholder name
2. Search the template for that placeholder
3. Ensure it's spelled correctly and has proper syntax `{fieldName}`
4. For loop issues, verify both opening `{#array}` and closing `{/array}` tags exist
5. Make sure loop tags are on their own rows in the table

