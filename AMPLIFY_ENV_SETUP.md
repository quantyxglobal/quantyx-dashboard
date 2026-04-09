# Amplify Environment Variables Setup

## Required Environment Variables for Email Functionality

To enable email notifications when creating admin/employee accounts, you need to configure these environment variables in AWS Amplify Console:

### 1. Postmark Configuration

Go to AWS Amplify Console → Your App → Environment variables

Add the following variables:

#### Postmark API Token
- **Variable name**: `POSTMARK_SERVER_TOKEN`
- **Value**: Your Postmark Server API token (from Postmark dashboard)
- **Description**: Required for sending emails via Postmark

#### Email Addresses
- **Variable name**: `POSTMARK_ADMIN_EMAIL`
- **Value**: `admin@quantyxg.com`
- **Description**: Admin email sender address

- **Variable name**: `POSTMARK_SUPPORT_EMAIL`
- **Value**: `support@quantyxg.com`
- **Description**: Support email sender address

#### Notification Recipients
- **Variable name**: `CASE_NOTIFICATION_EMAIL`
- **Value**: `info@quantyxg.com`
- **Description**: Email address to receive case notifications

- **Variable name**: `ACCOUNT_NOTIFICATION_EMAIL`
- **Value**: `support@quantyxg.com`
- **Description**: Email address to receive account creation notifications

### 2. Verify Sender Signatures in Postmark

Before emails can be sent, you must verify the sender email addresses in Postmark:

1. Log into your Postmark account
2. Go to **Sender Signatures**
3. Add and verify these email addresses:
   - `admin@quantyxg.com`
   - `support@quantyxg.com`
   - `noreply@quantyxg.com`
   - `info@quantyxg.com`

4. For each email:
   - Click "Add Sender Signature"
   - Enter the email address
   - Verify ownership (check your email inbox)
   - Confirm verification

### 3. Redeploy Your Application

After adding the environment variables:

1. Go to AWS Amplify Console
2. Click on your app
3. Click "Redeploy this version" or push a new commit to trigger a build

### 4. Test Email Functionality

After redeployment:

1. Log in as superadmin
2. Create a new admin or employee account
3. Check that:
   - `support@quantyxg.com` receives account creation notification with credentials
   - The new user receives a welcome email with login credentials

## Troubleshooting

### Emails Not Being Sent

1. **Check Amplify Build Logs**:
   - Look for `[POSTMARK]` log entries
   - Check for "POSTMARK_SERVER_TOKEN is not configured" errors

2. **Verify Environment Variables**:
   - In Amplify Console, check that all variables are set
   - Ensure no typos in variable names

3. **Check Postmark Dashboard**:
   - Go to Postmark → Activity
   - Look for failed sends or bounces
   - Verify sender signatures are confirmed

4. **Check Application Logs**:
   - Look for `[CREATE_ACCOUNT]` log entries
   - Check for email sending errors

### Common Issues

1. **"POSTMARK_SERVER_TOKEN is not configured"**
   - Solution: Add `POSTMARK_SERVER_TOKEN` environment variable in Amplify

2. **"Sender signature not verified"**
   - Solution: Verify all sender email addresses in Postmark dashboard

3. **Emails going to spam**
   - Solution: Set up SPF, DKIM, and DMARC records for your domain
   - Postmark provides these records in their dashboard

4. **Wrong sender email**
   - Solution: Verify `POSTMARK_ADMIN_EMAIL` and `POSTMARK_SUPPORT_EMAIL` are set correctly

## Current Configuration

The application is configured to send:

1. **Account Creation Notification** → `support@quantyxg.com` (or `ACCOUNT_NOTIFICATION_EMAIL`)
   - Includes user details and login credentials
   - Sent when superadmin creates admin/employee accounts

2. **Welcome Email** → New user's email address
   - Includes login credentials and dashboard link
   - Sent to the newly created user

3. **Case Notifications** → `info@quantyxg.com` (or `CASE_NOTIFICATION_EMAIL`)
   - Sent when cases are created or updated
