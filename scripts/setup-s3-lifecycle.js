// Setup S3 Lifecycle Policy for Quote Request Files
// This script creates a lifecycle policy to automatically delete quote request files after 7 days

import { S3Client, PutBucketLifecycleConfigurationCommand, GetBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

async function setupLifecyclePolicy() {
  try {
    console.log('🗂️  Setting up S3 Lifecycle Policy for Quote Request Files...');
    console.log(`Bucket: ${BUCKET_NAME}`);
    
    // Check existing lifecycle configuration
    try {
      const existingConfig = await s3Client.send(
        new GetBucketLifecycleConfigurationCommand({ Bucket: BUCKET_NAME })
      );
      console.log('📋 Existing lifecycle rules:', existingConfig.Rules?.length || 0);
    } catch (error) {
      if (error.name !== 'NoSuchLifecycleConfiguration') {
        throw error;
      }
      console.log('📋 No existing lifecycle configuration found');
    }

    // Create lifecycle configuration
    const lifecycleConfig = {
      Bucket: BUCKET_NAME,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'DeleteQuoteRequestFiles',
            Status: 'Enabled',
            Filter: {
              Prefix: 'quote-requests/' // Only applies to quote request files
            },
            Expiration: {
              Days: 7 // Delete after 7 days
            }
          },
          {
            ID: 'DeleteIncompleteMultipartUploads',
            Status: 'Enabled',
            Filter: {
              Prefix: 'quote-requests/'
            },
            AbortIncompleteMultipartUpload: {
              DaysAfterInitiation: 1 // Clean up failed uploads after 1 day
            }
          }
        ]
      }
    };

    // Apply the lifecycle policy
    await s3Client.send(new PutBucketLifecycleConfigurationCommand(lifecycleConfig));
    
    console.log('✅ Lifecycle policy created successfully!');
    console.log('');
    console.log('📝 Policy Details:');
    console.log('   • Target: quote-requests/* files only');
    console.log('   • Retention: 7 days from creation');
    console.log('   • Cleanup: Failed uploads after 1 day');
    console.log('');
    console.log('🔄 Files will be automatically deleted by AWS S3');
    console.log('   • No manual intervention required');
    console.log('   • No additional costs for deletion');
    console.log('   • Database records remain intact');
    
  } catch (error) {
    console.error('❌ Failed to setup lifecycle policy:', error.message);
    
    if (error.name === 'AccessDenied') {
      console.log('');
      console.log('🔐 Permission Required:');
      console.log('   Your AWS credentials need s3:PutLifecycleConfiguration permission');
      console.log('   Add this policy to your IAM user/role:');
      console.log('   {');
      console.log('     "Effect": "Allow",');
      console.log('     "Action": "s3:PutLifecycleConfiguration",');
      console.log(`     "Resource": "arn:aws:s3:::${BUCKET_NAME}"`);
      console.log('   }');
    }
  }
}

async function verifyLifecyclePolicy() {
  try {
    console.log('\n🔍 Verifying Lifecycle Policy...');
    
    const config = await s3Client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: BUCKET_NAME })
    );
    
    console.log('✅ Current Lifecycle Rules:');
    config.Rules?.forEach((rule, index) => {
      console.log(`   ${index + 1}. ${rule.ID}`);
      console.log(`      Status: ${rule.Status}`);
      console.log(`      Prefix: ${rule.Filter?.Prefix || 'All files'}`);
      if (rule.Expiration?.Days) {
        console.log(`      Expiration: ${rule.Expiration.Days} days`);
      }
      if (rule.AbortIncompleteMultipartUpload?.DaysAfterInitiation) {
        console.log(`      Cleanup incomplete uploads: ${rule.AbortIncompleteMultipartUpload.DaysAfterInitiation} days`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Failed to verify lifecycle policy:', error.message);
  }
}

async function main() {
  await setupLifecyclePolicy();
  await verifyLifecyclePolicy();
}

main();