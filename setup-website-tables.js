const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function setupWebsiteTables() {
  try {
    console.log('Checking and creating website tables...')

    // Check if quote_requests table exists
    const quoteRequestsExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'quote_requests'
      );
    `
    
    if (!quoteRequestsExists[0].exists) {
      console.log('Creating quote_requests table...')
      await prisma.$executeRaw`
        CREATE TABLE "quote_requests" (
          "id" TEXT NOT NULL,
          "full_name" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "phone" TEXT NOT NULL,
          "firm_name" TEXT,
          "case_details" TEXT,
          "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "status" TEXT NOT NULL DEFAULT 'pending',
          "estimated_cost" DECIMAL(10,2),
          "quoted_at" TIMESTAMP(3),
          "quoted_by" TEXT,
          "converted_case_id" TEXT,
          "notes" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
        );
      `
      
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX "quote_requests_converted_case_id_key" ON "quote_requests"("converted_case_id");
      `
      
      await prisma.$executeRaw`
        CREATE INDEX "quote_requests_email_idx" ON "quote_requests"("email");
      `
      
      await prisma.$executeRaw`
        CREATE INDEX "quote_requests_status_idx" ON "quote_requests"("status");
      `
      
      await prisma.$executeRaw`
        CREATE INDEX "quote_requests_created_at_idx" ON "quote_requests"("created_at");
      `
    } else {
      console.log('quote_requests table already exists')
    }

    // Check if quote_request_files table exists
    const quoteFilesExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'quote_request_files'
      );
    `
    
    if (!quoteFilesExists[0].exists) {
      console.log('Creating quote_request_files table...')
      await prisma.$executeRaw`
        CREATE TABLE "quote_request_files" (
          "id" TEXT NOT NULL,
          "quote_request_id" TEXT NOT NULL,
          "filename" TEXT NOT NULL,
          "original_name" TEXT NOT NULL,
          "s3_key" TEXT NOT NULL,
          "file_size" BIGINT NOT NULL,
          "mime_type" TEXT NOT NULL,
          "download_url" TEXT,
          "download_expires_at" TIMESTAMP(3),
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "quote_request_files_pkey" PRIMARY KEY ("id")
        );
      `
      
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX "quote_request_files_s3_key_key" ON "quote_request_files"("s3_key");
      `
      
      await prisma.$executeRaw`
        CREATE INDEX "quote_request_files_quote_request_id_idx" ON "quote_request_files"("quote_request_id");
      `
      
      await prisma.$executeRaw`
        ALTER TABLE "quote_request_files" 
        ADD CONSTRAINT "quote_request_files_quote_request_id_fkey" 
        FOREIGN KEY ("quote_request_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `
    } else {
      console.log('quote_request_files table already exists')
    }

    // Check if contact_inquiries table exists
    const contactExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contact_inquiries'
      );
    `
    
    if (!contactExists[0].exists) {
      console.log('Creating contact_inquiries table...')
      await prisma.$executeRaw`
        CREATE TABLE "contact_inquiries" (
          "id" TEXT NOT NULL,
          "first_name" TEXT NOT NULL,
          "last_name" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "phone" TEXT NOT NULL,
          "company" TEXT,
          "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "message" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'new',
          "assigned_to" TEXT,
          "response_sent_at" TIMESTAMP(3),
          "notes" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "contact_inquiries_pkey" PRIMARY KEY ("id")
        );
      `
      
      await prisma.$executeRaw`
        CREATE INDEX "contact_inquiries_email_idx" ON "contact_inquiries"("email");
      `
      
      await prisma.$executeRaw`
        CREATE INDEX "contact_inquiries_status_idx" ON "contact_inquiries"("status");
      `
      
      await prisma.$executeRaw`
        CREATE INDEX "contact_inquiries_created_at_idx" ON "contact_inquiries"("created_at");
      `
    } else {
      console.log('contact_inquiries table already exists')
    }

    console.log('Website tables setup completed successfully!')

  } catch (error) {
    console.error('Error setting up website tables:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupWebsiteTables()