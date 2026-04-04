// Quote Request File Cleanup Service
// Automatically deletes quote request files and database records after 7 days

import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface CleanupResult {
  deletedFiles: number;
  deletedQuoteFiles: number;
  deletedQuoteRequests: number;
  errors: string[];
}

export class QuoteRequestCleanupService {
  private readonly RETENTION_DAYS = 7;
  private readonly BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

  /**
   * Clean up quote requests and files older than 7 days
   */
  async cleanupExpiredQuoteRequests(): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedFiles: 0,
      deletedQuoteFiles: 0,
      deletedQuoteRequests: 0,
      errors: [] as string[]
    };

    try {
      console.log(`🧹 Starting cleanup of quote requests older than ${this.RETENTION_DAYS} days...`);
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);
      
      console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);

      // Find expired quote requests
      const expiredQuoteRequests = await prisma.quoteRequest.findMany({
        where: {
          created_at: {
            lt: cutoffDate
          }
        },
        include: {
          files: true
        }
      });

      console.log(`📋 Found ${expiredQuoteRequests.length} expired quote requests`);

      // Process each expired quote request
      for (const quoteRequest of expiredQuoteRequests) {
        try {
          // Delete S3 files first
          for (const file of quoteRequest.files) {
            try {
              await s3Client.send(new DeleteObjectCommand({
                Bucket: this.BUCKET_NAME,
                Key: file.s3_key
              }));
              result.deletedFiles++;
              console.log(`🗑️  Deleted S3 file: ${file.s3_key}`);
            } catch (error: unknown) {
              const errorMsg = `Failed to delete S3 file ${file.s3_key}: ${error instanceof Error ? error.message : String(error)}`;
              result.errors.push(errorMsg);
              console.error(`❌ ${errorMsg}`);
            }
          }

          // Delete database records (files will be deleted by cascade)
          await prisma.quoteRequest.delete({
            where: { id: quoteRequest.id }
          });

          result.deletedQuoteFiles += quoteRequest.files.length;
          result.deletedQuoteRequests++;
          
          console.log(`✅ Deleted quote request: ${quoteRequest.id} (${quoteRequest.files.length} files)`);
          
        } catch (error: unknown) {
          const errorMsg = `Failed to delete quote request ${quoteRequest.id}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log('🎉 Cleanup completed!');
      console.log(`📊 Summary:`);
      console.log(`   • Quote requests deleted: ${result.deletedQuoteRequests}`);
      console.log(`   • Database file records deleted: ${result.deletedQuoteFiles}`);
      console.log(`   • S3 files deleted: ${result.deletedFiles}`);
      console.log(`   • Errors: ${result.errors.length}`);

      if (result.errors.length > 0) {
        console.log('❌ Errors encountered:');
        result.errors.forEach(error => console.log(`   • ${error}`));
      }

    } catch (error: unknown) {
      const errorMsg = `Cleanup service failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }

    return result;
  }

  /**
   * Clean up orphaned S3 files (files in S3 but not in database)
   */
  async cleanupOrphanedS3Files(): Promise<{ deletedFiles: number; errors: string[] }> {
    const result = { deletedFiles: 0, errors: [] as string[] };

    try {
      console.log('🔍 Checking for orphaned S3 files in quote-requests/...');

      // List all S3 objects with quote-requests prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: this.BUCKET_NAME,
        Prefix: 'quote-requests/'
      });

      const s3Objects = await s3Client.send(listCommand);
      
      if (!s3Objects.Contents || s3Objects.Contents.length === 0) {
        console.log('📂 No quote request files found in S3');
        return result;
      }

      console.log(`📂 Found ${s3Objects.Contents.length} files in S3`);

      // Get all S3 keys from database
      const dbFiles = await prisma.quoteFile.findMany({
        select: { s3_key: true }
      });
      
      const dbS3Keys = new Set(dbFiles.map(f => f.s3_key));
      console.log(`💾 Found ${dbS3Keys.size} files in database`);

      // Find orphaned files
      const orphanedFiles = s3Objects.Contents.filter(obj => 
        obj.Key && !dbS3Keys.has(obj.Key)
      );

      console.log(`🗑️  Found ${orphanedFiles.length} orphaned files`);

      // Delete orphaned files
      for (const file of orphanedFiles) {
        if (!file.Key) continue; // Skip files without keys
        
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: this.BUCKET_NAME,
            Key: file.Key
          }));
          result.deletedFiles++;
          console.log(`🗑️  Deleted orphaned file: ${file.Key}`);
        } catch (error: unknown) {
          const errorMsg = `Failed to delete orphaned file ${file.Key}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

    } catch (error: unknown) {
      const errorMsg = `Orphaned file cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }

    return result;
  }

  /**
   * Get statistics about quote request files
   */
  async getCleanupStats(): Promise<{
    totalQuoteRequests: number;
    expiredQuoteRequests: number;
    totalFiles: number;
    expiredFiles: number;
    totalStorageSize: bigint;
    expiredStorageSize: bigint;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

    const [totalQuoteRequests, expiredQuoteRequests, totalFiles, expiredFiles] = await Promise.all([
      prisma.quoteRequest.count(),
      prisma.quoteRequest.count({
        where: { created_at: { lt: cutoffDate } }
      }),
      prisma.quoteFile.count(),
      prisma.quoteFile.count({
        where: {
          quote_request: {
            created_at: { lt: cutoffDate }
          }
        }
      })
    ]);

    // Calculate storage sizes
    const allFiles = await prisma.quoteFile.findMany({
      select: { file_size: true, quote_request: { select: { created_at: true } } }
    });

    let totalStorageSize = BigInt(0);
    let expiredStorageSize = BigInt(0);

    for (const file of allFiles) {
      totalStorageSize += file.file_size;
      if (file.quote_request.created_at < cutoffDate) {
        expiredStorageSize += file.file_size;
      }
    }

    return {
      totalQuoteRequests,
      expiredQuoteRequests,
      totalFiles,
      expiredFiles,
      totalStorageSize,
      expiredStorageSize
    };
  }
}

// Lazy-loaded singleton instance
let _cleanupServiceInstance: QuoteRequestCleanupService | null = null

export const getCleanupService = (): QuoteRequestCleanupService => {
  if (!_cleanupServiceInstance) {
    _cleanupServiceInstance = new QuoteRequestCleanupService()
  }
  return _cleanupServiceInstance
}

export const cleanupService = new Proxy({} as QuoteRequestCleanupService, {
  get(target, prop) {
    return getCleanupService()[prop as keyof QuoteRequestCleanupService]
  }
});