# Security & Encryption Documentation
## Quantix Global Med-Legal Dashboard

**Document Version**: 1.0  
**Last Updated**: April 3, 2026  
**Classification**: Internal - Security Documentation

---

## Table of Contents
1. [Overview](#overview)
2. [Encryption Standards](#encryption-standards)
3. [Encryption Implementation by Layer](#encryption-implementation-by-layer)
4. [Data Flow Security](#data-flow-security)
5. [Key Management](#key-management)
6. [Compliance & Standards](#compliance--standards)
7. [Security Audit Trail](#security-audit-trail)

---

## Overview

The Quantix Global Med-Legal Dashboard implements multiple layers of encryption to protect sensitive medical and legal information throughout its lifecycle. This document details all encryption mechanisms, their implementation stages, and security protocols.

### Security Objectives
- **Confidentiality**: Protect sensitive data from unauthorized access
- **Integrity**: Ensure data is not tampered with during storage or transmission
- **Authentication**: Verify user identity before granting access
- **Non-repudiation**: Maintain audit trails of all data access and modifications

---

## Encryption Standards

### Primary Encryption Algorithms

#### 1. AES-256 (Advanced Encryption Standard)
- **Usage**: Sensitive data at rest, file encryption
- **Key Size**: 256-bit
- **Mode**: AES-256-GCM (Galois/Counter Mode) for authenticated encryption
- **Status**: ✅ IMPLEMENTED (via infrastructure providers)
- **Compliance**: FIPS 140-2, HIPAA compliant

#### 2. Bcrypt Password Hashing
- **Usage**: User password storage
- **Algorithm**: Bcrypt with adaptive hashing
- **Work Factor**: 12 rounds (2^12 iterations)
- **Salt**: Automatically generated per password (128-bit)
- **Status**: ✅ IMPLEMENTED
- **Compliance**: OWASP recommended, NIST approved

#### 3. TLS 1.3 (Transport Layer Security)
- **Usage**: All network communications
- **Cipher Suites**: TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256
- **Certificate**: SSL/TLS certificates from trusted CA
- **Status**: ✅ IMPLEMENTED
- **Compliance**: PCI DSS, HIPAA compliant

#### 4. JWT (JSON Web Tokens)
- **Usage**: Session management and authentication
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Secret Key**: 256-bit randomly generated secret
- **Expiration**: 24 hours
- **Status**: ✅ IMPLEMENTED
- **Compliance**: OAuth 2.0, OpenID Connect compatible

---

## Encryption Implementation by Layer

### Layer 1: Application Layer

#### 1.1 Password Storage
**Location**: `auth.config.ts`, `register.ts`, `change-password.ts`

```typescript
// Password Hashing Implementation
import bcrypt from 'bcryptjs'

// Registration/Password Creation
const passwordHash = await bcrypt.hash(password, 12)
// 12 rounds = 2^12 = 4,096 iterations
// Automatically generates unique salt per password

// Password Verification
const isValid = await bcrypt.compare(plainPassword, storedHash)
```

**Security Features**:
- ✅ Unique salt per password (prevents rainbow table attacks)
- ✅ Adaptive hashing (can increase rounds as hardware improves)
- ✅ Constant-time comparison (prevents timing attacks)
- ✅ No plain text passwords ever stored

**Encryption Flow**:
1. User enters password → 2. Bcrypt generates random salt → 3. Password + salt hashed 4,096 times → 4. Hash stored in database

#### 1.2 Session Management
**Location**: `auth.ts`, `auth.config.ts`

```typescript
// JWT Token Configuration
session: {
  strategy: 'jwt',
  maxAge: 24 * 60 * 60, // 24 hours
  updateAge: 60 * 60,   // Update every hour
}

// JWT Signing
secret: process.env.NEXTAUTH_SECRET // 256-bit secret key
```

**Security Features**:
- ✅ Signed tokens (prevents tampering)
- ✅ Encrypted payload (protects sensitive data)
- ✅ Automatic expiration (24-hour timeout)
- ✅ Secure cookie flags (httpOnly, sameSite, secure)

**Token Contents** (Encrypted):
- User ID
- Email
- Role (SUPER_ADMIN, ADMIN, EMPLOYEE, CLIENT)
- Organization ID
- Session start timestamp

#### 1.3 Password Reset Tokens
**Location**: `request-password-reset.ts`, `reset-password.ts`

```typescript
// Token Generation
import crypto from 'crypto'

const token = crypto.randomBytes(32).toString('hex')
// Generates cryptographically secure 256-bit random token
```

**Security Features**:
- ✅ Cryptographically secure random generation
- ✅ One-time use tokens
- ✅ 1-hour expiration
- ✅ Tokens deleted after use
- ✅ Email enumeration protection

**Token Lifecycle**:
1. User requests reset → 2. Generate 256-bit random token → 3. Store hashed token in DB → 4. Send token via email → 5. Verify and delete after use

---

### Layer 2: Transport Layer (Network)

#### 2.1 HTTPS/TLS Encryption
**Implementation**: All network communications

**Endpoints Using TLS**:
- ✅ Application frontend (https://yourdomain.com)
- ✅ API endpoints (https://yourdomain.com/api/*)
- ✅ Supabase database connections
- ✅ AWS S3 file transfers
- ✅ Email service (Postmark)

**TLS Configuration**:
```
Protocol: TLS 1.3 (minimum TLS 1.2)
Cipher Suites:
  - TLS_AES_256_GCM_SHA384
  - TLS_CHACHA20_POLY1305_SHA256
  - TLS_AES_128_GCM_SHA256
Certificate: Let's Encrypt / AWS Certificate Manager
Key Exchange: ECDHE (Elliptic Curve Diffie-Hellman Ephemeral)
```

**Security Features**:
- ✅ Perfect Forward Secrecy (PFS)
- ✅ Certificate pinning (production)
- ✅ HSTS (HTTP Strict Transport Security)
- ✅ Automatic certificate renewal

#### 2.2 Database Connections
**Provider**: Supabase PostgreSQL

```
Connection String: postgresql://...pooler.supabase.com:5432/postgres
Encryption: SSL/TLS enforced
Certificate Verification: Required
```

**Security Features**:
- ✅ Encrypted connections (SSL/TLS)
- ✅ Connection pooling with pgBouncer
- ✅ IP whitelisting (optional)
- ✅ Row Level Security (RLS) disabled for service role

#### 2.3 File Storage (AWS S3)
**Provider**: AWS S3 (ap-south-2 region)

```
Bucket: quantyx-global
Region: ap-south-2 (Hyderabad)
Access: IAM credentials with least privilege
Transfer: HTTPS only
```

**Security Features**:
- ✅ HTTPS-only transfers
- ✅ Server-side encryption (SSE-S3 or SSE-KMS)
- ✅ Bucket policies restrict public access
- ✅ IAM role-based access control
- ✅ Versioning enabled (optional)

---

### Layer 3: Data at Rest

#### 3.1 Database Encryption
**Provider**: Supabase (AWS RDS PostgreSQL)

**Encryption Details**:
- **Algorithm**: AES-256
- **Implementation**: AWS RDS encryption at rest
- **Key Management**: AWS KMS (Key Management Service)
- **Scope**: All database files, backups, snapshots, and replicas

**Encrypted Data**:
- ✅ User credentials (password hashes)
- ✅ Personal information (names, emails)
- ✅ Case details and metadata
- ✅ Audit logs
- ✅ Session data
- ✅ Password reset tokens

**Database Security**:
```sql
-- Password hashes stored as TEXT (bcrypt output)
password_hash TEXT NOT NULL

-- Sensitive fields
email TEXT NOT NULL
first_name TEXT NOT NULL
last_name TEXT NOT NULL
```

#### 3.2 File Storage Encryption
**Provider**: AWS S3

**Encryption Details**:
- **Algorithm**: AES-256
- **Implementation**: SSE-S3 (Server-Side Encryption with S3-managed keys)
- **Alternative**: SSE-KMS (with customer-managed keys)
- **Scope**: All uploaded files (input, output, additional files)

**File Structure**:
```
s3://quantyx-global/
├── cases/
│   ├── {caseNumber}/
│   │   ├── input/           [AES-256 encrypted]
│   │   ├── output/          [AES-256 encrypted]
│   │   └── additional files-MM-DD-YY/ [AES-256 encrypted]
```

**Security Features**:
- ✅ Automatic encryption on upload
- ✅ Encrypted at rest
- ✅ Encrypted in transit (HTTPS)
- ✅ Access logging enabled
- ✅ Versioning for audit trail

#### 3.3 Application Secrets
**Storage**: Environment variables (.env file)

**Secrets Management**:
```bash
# Encrypted in production via platform (Vercel/AWS)
NEXTAUTH_SECRET="[256-bit random string]"
SUPABASE_SERVICE_ROLE_KEY="[JWT token]"
AWS_SECRET_ACCESS_KEY="[AWS credential]"
POSTMARK_SERVER_TOKEN="[API token]"
```

**Security Features**:
- ✅ Never committed to version control (.gitignore)
- ✅ Encrypted at rest (platform-managed)
- ✅ Access restricted to deployment environment
- ✅ Rotated periodically
- ✅ Different keys per environment (dev/staging/prod)

---

## Data Flow Security

### User Authentication Flow

```
1. User Login
   ├─> [HTTPS/TLS] → Frontend receives credentials
   ├─> [Bcrypt] → Password compared with stored hash
   ├─> [JWT] → Session token generated and signed
   └─> [Secure Cookie] → Token stored in httpOnly cookie

2. Authenticated Request
   ├─> [HTTPS/TLS] → Request sent with session cookie
   ├─> [JWT Verification] → Token signature verified
   ├─> [Role Check] → User permissions validated
   └─> [Database Query] → Data retrieved via encrypted connection

3. Data Response
   ├─> [Database] → Data fetched via TLS connection
   ├─> [Application] → Data processed server-side
   ├─> [HTTPS/TLS] → Response encrypted in transit
   └─> [Frontend] → Data displayed to authorized user
```

### File Upload Flow

```
1. File Selection
   ├─> [Frontend] → User selects file
   └─> [Validation] → File type and size checked

2. Upload Process
   ├─> [HTTPS/TLS] → File transmitted to server
   ├─> [Server Processing] → File validated and processed
   ├─> [AWS S3 SDK] → File uploaded via HTTPS
   └─> [S3 Encryption] → File encrypted with AES-256 at rest

3. Storage
   ├─> [S3 Bucket] → File stored encrypted
   ├─> [Database] → Metadata stored (filename, path, size)
   └─> [Audit Log] → Upload action logged

4. File Download
   ├─> [Authorization] → User permission verified
   ├─> [S3 Presigned URL] → Temporary secure URL generated
   ├─> [HTTPS/TLS] → File downloaded encrypted
   └─> [Audit Log] → Download action logged
```

### Password Reset Flow

```
1. Reset Request
   ├─> [HTTPS/TLS] → User submits email
   ├─> [Crypto] → 256-bit random token generated
   ├─> [Database] → Token stored with 1-hour expiration
   └─> [Email] → Reset link sent via TLS

2. Token Verification
   ├─> [HTTPS/TLS] → User clicks reset link
   ├─> [Database] → Token validated and checked for expiration
   └─> [Authorization] → Reset form displayed if valid

3. Password Update
   ├─> [HTTPS/TLS] → New password submitted
   ├─> [Bcrypt] → Password hashed with 12 rounds
   ├─> [Database] → Hash stored, token deleted
   └─> [Session] → All existing sessions invalidated
```

---

## Key Management

### Encryption Keys Inventory

| Key Type | Algorithm | Size | Rotation | Storage | Purpose |
|----------|-----------|------|----------|---------|---------|
| NextAuth Secret | HMAC-SHA256 | 256-bit | Annually | Environment Variable | JWT signing |
| Supabase Service Key | JWT | N/A | On compromise | Environment Variable | Database access |
| AWS Access Key | AWS Signature | N/A | 90 days | Environment Variable | S3 access |
| Postmark API Token | API Key | N/A | On compromise | Environment Variable | Email service |
| Database Encryption Key | AES-256 | 256-bit | Managed by AWS | AWS KMS | Data at rest |
| S3 Encryption Key | AES-256 | 256-bit | Managed by AWS | AWS KMS/S3 | File storage |

### Key Rotation Policy

**Automatic Rotation**:
- Database encryption keys: Managed by AWS KMS (automatic)
- S3 encryption keys: Managed by AWS S3 (automatic)
- TLS certificates: Let's Encrypt (automatic 90-day renewal)

**Manual Rotation**:
- NextAuth Secret: Annually or on suspected compromise
- API Keys: 90 days or on suspected compromise
- AWS IAM credentials: 90 days

**Rotation Procedure**:
1. Generate new key/credential
2. Update environment variables in all environments
3. Deploy updated configuration
4. Verify functionality
5. Revoke old key/credential
6. Document rotation in security log

---

## Compliance & Standards

### Industry Standards Compliance

#### HIPAA (Health Insurance Portability and Accountability Act)
- ✅ Encryption in transit (TLS 1.3)
- ✅ Encryption at rest (AES-256)
- ✅ Access controls (role-based)
- ✅ Audit logging (all data access)
- ✅ Automatic session timeout (24 hours)
- ✅ Password complexity requirements
- ⚠️ MFA recommended (not yet implemented)

#### GDPR (General Data Protection Regulation)
- ✅ Data encryption (AES-256, TLS 1.3)
- ✅ Access controls and authentication
- ✅ Audit trails (who accessed what, when)
- ✅ Right to erasure (delete user data)
- ✅ Data minimization (only necessary data collected)
- ✅ Secure password storage (bcrypt)

#### OWASP Top 10 Protection
- ✅ A01: Broken Access Control → Role-based access control
- ✅ A02: Cryptographic Failures → AES-256, TLS 1.3, bcrypt
- ✅ A03: Injection → Parameterized queries, input validation
- ✅ A04: Insecure Design → Security by design principles
- ✅ A05: Security Misconfiguration → Secure defaults
- ✅ A06: Vulnerable Components → Regular dependency updates
- ✅ A07: Authentication Failures → Strong password policy, session management
- ⚠️ A08: Software and Data Integrity → Code signing recommended
- ✅ A09: Security Logging → Comprehensive audit logs
- ✅ A10: Server-Side Request Forgery → Input validation

#### NIST Cybersecurity Framework
- ✅ Identify: Asset inventory, risk assessment
- ✅ Protect: Encryption, access controls, secure development
- ✅ Detect: Audit logging, monitoring
- ⚠️ Respond: Incident response plan (to be documented)
- ⚠️ Recover: Backup and recovery procedures (to be documented)

---

## Security Audit Trail

### Logged Events

All security-relevant events are logged to the `audit_logs` table:

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,  -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
  entity_type TEXT,      -- user, case, file, etc.
  entity_id TEXT,
  organization_id TEXT,
  details TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Logged Actions**:
- ✅ User login/logout
- ✅ Password changes
- ✅ Password reset requests
- ✅ User creation/deletion
- ✅ Case creation/updates
- ✅ File uploads/downloads
- ✅ Role changes
- ✅ Permission changes
- ✅ Failed login attempts
- ✅ Session expirations

**Audit Log Retention**: 7 years (configurable)

---

## Encryption Verification Checklist

### Pre-Production Checklist

- [ ] All environment variables set and secured
- [ ] HTTPS enforced on all endpoints
- [ ] Database connections use SSL/TLS
- [ ] S3 bucket encryption enabled
- [ ] Password hashing uses bcrypt with 12+ rounds
- [ ] JWT secret is 256-bit random string
- [ ] Session cookies have secure flags
- [ ] HSTS header enabled
- [ ] CSP (Content Security Policy) configured
- [ ] Rate limiting enabled on auth endpoints
- [ ] Audit logging functional
- [ ] Backup encryption verified
- [ ] Key rotation schedule documented
- [ ] Incident response plan documented
- [ ] Security testing completed
- [ ] Penetration testing completed (recommended)

### Production Monitoring

- [ ] Monitor failed login attempts
- [ ] Monitor unusual data access patterns
- [ ] Monitor API rate limits
- [ ] Review audit logs weekly
- [ ] Verify backup encryption monthly
- [ ] Test disaster recovery quarterly
- [ ] Rotate credentials per schedule
- [ ] Update dependencies monthly
- [ ] Security scan automated (CI/CD)
- [ ] Certificate expiration monitoring

---

## Additional Security Recommendations

### Immediate Priorities (Not Yet Implemented)

1. **Multi-Factor Authentication (MFA)**
   - Status: ❌ Not implemented
   - Priority: HIGH
   - Recommendation: TOTP-based (Google Authenticator)
   - See: `MFA_IMPLEMENTATION_GUIDE.md`

2. **Email Verification**
   - Status: ❌ Not implemented
   - Priority: MEDIUM
   - Recommendation: Verify email on registration

3. **Rate Limiting**
   - Status: ⚠️ Partial (via Vercel/infrastructure)
   - Priority: HIGH
   - Recommendation: Implement application-level rate limiting

4. **Account Lockout**
   - Status: ❌ Not implemented
   - Priority: MEDIUM
   - Recommendation: Lock account after 5 failed login attempts

5. **IP Whitelisting**
   - Status: ❌ Not implemented
   - Priority: LOW
   - Recommendation: Optional for admin accounts
