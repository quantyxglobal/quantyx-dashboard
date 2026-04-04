// API endpoint for cleaning up expired quote request files
// POST /api/admin/cleanup/quote-files

import { NextRequest, NextResponse } from 'next/server';
import { cleanupService } from '@/lib/cleanup-service';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin (adjust based on your auth system)
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { action } = await request.json();

    switch (action) {
      case 'cleanup':
        // Run the cleanup
        const result = await cleanupService.cleanupExpiredQuoteRequests();
        
        return NextResponse.json({
          success: true,
          message: 'Cleanup completed successfully',
          data: {
            deletedQuoteRequests: result.deletedQuoteRequests,
            deletedFiles: result.deletedFiles,
            deletedQuoteFiles: result.deletedQuoteFiles,
            errors: result.errors
          }
        });

      case 'stats':
        // Get cleanup statistics
        const stats = await cleanupService.getCleanupStats();
        
        return NextResponse.json({
          success: true,
          data: {
            totalQuoteRequests: stats.totalQuoteRequests,
            expiredQuoteRequests: stats.expiredQuoteRequests,
            totalFiles: stats.totalFiles,
            expiredFiles: stats.expiredFiles,
            totalStorageSize: stats.totalStorageSize.toString(),
            expiredStorageSize: stats.expiredStorageSize.toString()
          }
        });

      case 'orphaned':
        // Clean up orphaned S3 files
        const orphanResult = await cleanupService.cleanupOrphanedS3Files();
        
        return NextResponse.json({
          success: true,
          message: 'Orphaned file cleanup completed',
          data: {
            deletedFiles: orphanResult.deletedFiles,
            errors: orphanResult.errors
          }
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: cleanup, stats, or orphaned' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Cleanup API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Return cleanup statistics
    const stats = await cleanupService.getCleanupStats();
    
    return NextResponse.json({
      success: true,
      data: {
        totalQuoteRequests: stats.totalQuoteRequests,
        expiredQuoteRequests: stats.expiredQuoteRequests,
        totalFiles: stats.totalFiles,
        expiredFiles: stats.expiredFiles,
        totalStorageSize: stats.totalStorageSize.toString(),
        expiredStorageSize: stats.expiredStorageSize.toString(),
        retentionDays: 7
      }
    });

  } catch (error) {
    console.error('Cleanup stats API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get cleanup statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}