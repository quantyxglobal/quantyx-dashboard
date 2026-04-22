/**
 * Test script to verify Postmark email service is working
 * Run with: npx tsx test-postmark-email.ts
 */

import 'dotenv/config'
import { postmarkEmailService } from './lib/postmark-email-service'

async function testPostmarkEmail() {
  console.log('🧪 Testing Postmark Email Service...\n')
  
  // Test 1: Simple test email
  console.log('Test 1: Sending test email to support@quantyxg.com')
  console.log('----------------------------------------')
  
  const testResult = await postmarkEmailService.sendEmail({
    to: 'support@quantyxg.com',
    subject: 'Postmark Test Email - Service Verification',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #262083;">✅ Postmark Email Service Test</h2>
        <p>This is a test email to verify that Postmark email service is working correctly.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>Service: Postmark</li>
            <li>From: quantyx Global Support</li>
            <li>Timestamp: ${new Date().toLocaleString()}</li>
          </ul>
        </div>
        <p>If you received this email, the Postmark integration is working successfully! 🎉</p>
      </div>
    `,
    textBody: `
Postmark Email Service Test

This is a test email to verify that Postmark email service is working correctly.

Test Details:
- Service: Postmark
- From: quantyx Global Support
- Timestamp: ${new Date().toLocaleString()}

If you received this email, the Postmark integration is working successfully!
    `.trim(),
    emailType: 'support'
  })

  if (testResult.success) {
    console.log('✅ Test email sent successfully!')
    console.log(`📧 Message ID: ${testResult.messageId}`)
    console.log('\nCheck your inbox at support@quantyxg.com\n')
  } else {
    console.error('❌ Failed to send test email')
    console.error(`Error: ${testResult.error}\n`)
    return false
  }

  // Test 2: Test different email types
  console.log('\nTest 2: Testing different sender configurations')
  console.log('----------------------------------------')
  
  const emailTypes = [
    { type: 'admin' as const, description: 'Admin email (admin@quantyxg.com)' },
    { type: 'support' as const, description: 'Support email (support@quantyxg.com)' },
    { type: 'noreply' as const, description: 'No-reply email (noreply@quantyxg.com)' }
  ]

  for (const { type, description } of emailTypes) {
    console.log(`\nTesting ${description}...`)
    
    const result = await postmarkEmailService.sendEmail({
      to: 'support@quantyxg.com',
      subject: `Postmark Test - ${type.toUpperCase()} Sender`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif;">
          <h3>Sender Type Test: ${type.toUpperCase()}</h3>
          <p>This email tests the ${description} sender configuration.</p>
          <p>Sent at: ${new Date().toLocaleString()}</p>
        </div>
      `,
      textBody: `Sender Type Test: ${type.toUpperCase()}\n\nThis email tests the ${description} sender configuration.\n\nSent at: ${new Date().toLocaleString()}`,
      emailType: type
    })

    if (result.success) {
      console.log(`  ✅ ${type} email sent (Message ID: ${result.messageId})`)
    } else {
      console.log(`  ❌ ${type} email failed: ${result.error}`)
    }
  }

  console.log('\n========================================')
  console.log('📊 Test Summary')
  console.log('========================================')
  console.log('✅ All tests completed!')
  console.log('\nNext steps:')
  console.log('1. Check your email inbox at support@quantyxg.com')
  console.log('2. Verify you received all test emails')
  console.log('3. Check Postmark dashboard for delivery status')
  console.log('4. If emails are not received, check:')
  console.log('   - Spam/junk folder')
  console.log('   - Postmark sender signature verification')
  console.log('   - Postmark activity log for errors')
  console.log('\n🔗 Postmark Dashboard: https://account.postmarkapp.com/servers')
  
  return true
}

// Run the test
testPostmarkEmail()
  .then(() => {
    console.log('\n✨ Test script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error)
    console.error('Error details:', error.message)
    process.exit(1)
  })
