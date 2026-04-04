// Manual cleanup script for quote request files
// Run with: node scripts/cleanup-quote-files.js

import { cleanupService } from '../lib/cleanup-service.js';

async function runCleanup() {
  try {
    console.log('🚀 Starting Quote Request File Cleanup...\n');

    // Show current statistics
    console.log('📊 Current Statistics:');
    const stats = await cleanupService.getCleanupStats();
    
    console.log(`   Total quote requests: ${stats.totalQuoteRequests}`);
    console.log(`   Expired quote requests: ${stats.expiredQuoteRequests}`);
    console.log(`   Total files: ${stats.totalFiles}`);
    console.log(`   Expired files: ${stats.expiredFiles}`);
    console.log(`   Total storage: ${formatBytes(stats.totalStorageSize)}`);
    console.log(`   Expired storage: ${formatBytes(stats.expiredStorageSize)}`);
    console.log('');

    if (stats.expiredQuoteRequests === 0) {
      console.log('✨ No expired quote requests found. Nothing to clean up!');
      return;
    }

    // Run cleanup
    const result = await cleanupService.cleanupExpiredQuoteRequests();
    
    console.log('\n🎯 Cleanup Results:');
    console.log(`   Quote requests deleted: ${result.deletedQuoteRequests}`);
    console.log(`   Database records deleted: ${result.deletedQuoteFiles}`);
    console.log(`   S3 files deleted: ${result.deletedFiles}`);
    
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   • ${error}`));
    }

    // Clean up orphaned files
    console.log('\n🔍 Checking for orphaned S3 files...');
    const orphanResult = await cleanupService.cleanupOrphanedS3Files();
    
    if (orphanResult.deletedFiles > 0) {
      console.log(`✅ Deleted ${orphanResult.deletedFiles} orphaned files`);
    }
    
    if (orphanResult.errors.length > 0) {
      console.log('❌ Orphan cleanup errors:');
      orphanResult.errors.forEach(error => console.log(`   • ${error}`));
    }

    console.log('\n✅ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

function formatBytes(bytes) {
  if (typeof bytes === 'bigint') {
    bytes = Number(bytes);
  }
  
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the cleanup
runCleanup();