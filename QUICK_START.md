# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Run Database Migration (REQUIRED)

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/wghvermnyvppsgshgbmu/sql)
2. Copy the contents of `ADD_ESTIMATE_REQUIRED_COLUMN.sql`
3. Paste and click **Run**
4. Wait for success message

### Step 2: Verify Setup

```bash
cd medilegal-dashboard
npx tsx scripts/verify-setup.ts
```

Look for ✅ checkmarks. If you see ⚠️ warnings, follow the instructions.

### Step 3: Start Development

```bash
npm run dev
```

Visit http://localhost:3000

## ✨ What's New

### Estimate Required Feature
When creating a case, you'll now see:
- **Radio buttons**: "Do you require a cost estimate before work begins?"
- **Options**: Yes / No
- **Default**: No

### Fixed File Display
- Files now display correctly in case detail pages
- Input files show in "Input Files" section
- Output files show in "Output Files" section
- Download buttons work properly

### File Organization
Files are organized in S3:
```
cases/
  └── {caseId}/
      ├── input/     ← Client uploaded files
      └── output/    ← Generated deliverables
```

## 🧪 Quick Test

1. **Create a case**:
   - Go to `/dashboard/case/create`
   - Fill in title: "Test Case"
   - Select a service
   - Choose timeline
   - Select "Yes" for estimate required
   - Upload a test file
   - Submit

2. **View the case**:
   - You'll be redirected to case detail page
   - Verify services are listed
   - Verify file appears in "Input Files"
   - Click download button to test

3. **Check S3**:
   - Files should be in: `cases/{caseId}/input/`

## 📋 Checklist

- [ ] Database migration completed
- [ ] Verification script passed
- [ ] Development server running
- [ ] Test case created successfully
- [ ] Files display correctly
- [ ] File download works
- [ ] Estimate required option visible

## 🆘 Troubleshooting

**"estimate_required column not found"**
→ Run the database migration (Step 1)

**"Files not showing"**
→ Check S3 credentials in `.env`
→ Verify files uploaded to S3 bucket

**"Cannot download files"**
→ Check AWS credentials
→ Verify S3 bucket permissions

**"Services not loading"**
→ Check `/api/services` endpoint
→ Verify services exist in database

## 📚 Documentation

- **Full Details**: See `CHANGES_SUMMARY.md`
- **Deployment**: See `DEPLOYMENT_INSTRUCTIONS.md`
- **Migration SQL**: See `ADD_ESTIMATE_REQUIRED_COLUMN.sql`

## 🎯 Key Files Modified

- `components/create-case-form.tsx` - Added estimate required UI
- `app/actions/create-case.ts` - Added estimate required handling
- `app/dashboard/case/[id]/page.tsx` - Fixed file filtering
- `app/admin/case/[id]/page.tsx` - Fixed file filtering

## ✅ All Done!

Your application is now ready with:
- ✅ Estimate required feature
- ✅ Fixed file display
- ✅ Proper S3 organization
- ✅ Access control by role

Happy coding! 🎉
