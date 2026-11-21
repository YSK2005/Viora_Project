# Viora Bills - Production Deployment & Operations Guide

This document defines the repeatable procedure for environment provisioning, database management, security configuration, readiness monitoring, backups, disaster recovery, and automated release verification for the **Viora Bills** invoice and billing platform.

---

## 1. System Requirements & Architecture

- **Node.js**: v24.x LTS
- **npm**: v10.x or higher
- **Database**: PostgreSQL 15, 16, 17, or 18
- **OS**: Linux (Ubuntu 22.04+ / Debian 12+), macOS, or Windows Server
- **Architecture**: Monorepo consisting of:
  - `client/`: React 18 + Vite + Tailwind CSS + Lucide Icons (SPA)
  - `server/`: Express + TypeScript + Prisma ORM + PostgreSQL + PDFKit

---

## 2. Environment Configuration

### Server Configuration (`server/.env`)

```env
# Application Environment
NODE_ENV=production
PORT=5000

# Client Application URL (Single origin or comma-separated list for CORS)
CLIENT_URL=https://billing.yourdomain.com

# PostgreSQL Connection String
DATABASE_URL="postgresql://viora_user:STRONG_SECURE_PASSWORD@127.0.0.1:5432/viora_bills?schema=public&sslmode=prefer"

# Session & Authentication Secret (Generate with: openssl rand -base64 32)
JWT_SECRET=c29tZS1zdXBlci1zZWNyZXQtc2Vzc2lvbi10b2tlbi1rZXk=

# Business & Timezone Configuration
TZ=Asia/Kolkata
```

### Client Configuration (`client/.env.production`)

```env
VITE_API_URL=https://billing.yourdomain.com/api
```

---

## 3. Clean Checkout & Installation Procedure

```bash
# 1. Clone repository
git clone https://github.com/your-org/viora-bills.git
cd viora-bills

# 2. Install monorepo dependencies
npm ci

# 3. Generate Prisma client
npm run prisma:generate --workspace=server
```

---

## 4. Database Setup & Migrations

```bash
# 1. Ensure PostgreSQL is active and create the database
# (e.g. createdb -U postgres -h localhost viora_bills)

# 2. Apply reviewed, versioned migrations
cd server
npx prisma migrate deploy

# 3. (Optional) Seed standard demonstration catalog and business settings
npm run prisma:seed
```

---

### Existing installations

Back up and test the migration against a restored copy before deployment. If a database
was previously managed with db push, compare its schema against the migration history
and baseline only migrations whose complete changes are already present. Do not blindly
mark migrations applied or use migrate reset on business data.

Public registration always creates an isolated business. An owner can add an existing
registered account by email; no shared or temporary password is generated. Linking an
unowned legacy business requires a trusted database administrator to verify ownership
and explicitly create the membership. Revoked users cannot regain membership by signing in.

Before exposing an existing installation, run the credential-remediation script below.
It invalidates the old shared password and revokes sessions for affected accounts.
Those users require an administrator-assisted password reset after identity verification;
the application does not yet provide an email invitation/password-reset service.

```bash
npx tsx server/scripts/revoke-default-credentials.ts
```

Serve frontend and API on the same site over HTTPS. Browser API calls use the HttpOnly
session cookie and X-Viora-Client header; CORS must allow only your frontend origin.

## 5. Performance Optimization & Indexes

The database schema includes high-performance composite indexes tailored for high-volume billing:

- **Invoices**:
  - `[businessId, invoiceNumber]` (Unique sequential invoice number per business)
  - `[businessId, status]` (Fast tab filtering: DRAFT, ISSUED, CANCELLED)
  - `[businessId, invoiceDate]` (IST date-boundary ranges and reports)
  - `[businessId, customerId]` (Customer ledger lookups)
- **Payments**:
  - `[invoiceId, isReversed]` (Reversal derivation & balance reconciliation)
  - `[paymentDate]` (Collection date reporting)
  - `[requestKey]` (Idempotency deduplication)
- **Customers & Products**:
  - `[businessId, isArchived]`, `[businessId, name]` (Server-side paginated directory search)
  - `[businessId, isActive, isArchived]` (Active catalog selection)
- **Audit Log**:
  - `[businessId, createdAt]` (Financial audit trail)
  - `[entityType, entityId]` (Entity revision tracking)

---

## 6. Production Build & Startup

```bash
# 1. Build client and server bundles
npm run build

# 2. Start the production backend server
npm run start --workspace=server

# 3. Serve client static assets with Nginx or Caddy
# Built assets reside in: client/dist/
```

### Process Management with PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start server process
pm2 start server/dist/index.js --name "viora-api" --max-memory-restart 500M -i max

# Save PM2 process list for automatic reboot recovery
pm2 save
pm2 startup
```

---

## 7. Reverse Proxy & HTTPS Configuration (Nginx)

```nginx
# /etc/nginx/sites-available/viora-bills.conf

server {
    listen 80;
    server_name billing.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name billing.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/billing.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/billing.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Client Static Assets
    location / {
        root /var/www/viora-bills/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Upload limits (supports up to 10MB logo images)
        client_max_body_size 10M;
    }
}
```

---

## 8. Health, Readiness & Monitoring

- **Health Check Endpoint**: `GET /api/health`
  - Returns `200 OK` when PostgreSQL database is responsive and operating normally.
  - Returns `503 Service Unavailable` if database connectivity is lost.
  - JSON payload:
    ```json
    {
      "status": "healthy",
      "service": "viora-bills-api",
      "version": "0.1.0",
      "uptimeSeconds": 3600,
      "timestamp": "2026-11-19T08:00:00.000Z",
      "database": {
        "status": "connected",
        "message": "Database query succeeded in 2ms"
      }
    }
    ```

---

## 9. Backup & Disaster Recovery Procedure

### Automated Backup

```bash
# Set timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/viora_bills"
mkdir -p "$BACKUP_DIR"

# Execute pg_dump
pg_dump -U postgres -h 127.0.0.1 -p 5432 -d viora_bills -F c -b -v -f "${BACKUP_DIR}/viora_bills_${TIMESTAMP}.dump"

# Keep last 30 days of backups
find "$BACKUP_DIR" -type f -name "viora_bills_*.dump" -mtime +30 -exec rm {} \;
```

### Verified Disaster Recovery / Restore Procedure

To restore a backup into a new or target database:

```bash
# 1. Create target database
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE viora_bills_recovery;"

# 2. Restore schema and data from custom format dump
pg_restore -U postgres -h 127.0.0.1 -d viora_bills_recovery -v "${BACKUP_DIR}/viora_bills_20261119.dump"

# Or if using plain SQL dump:
psql -U postgres -h 127.0.0.1 -d viora_bills_recovery -f backup.sql

# 3. Verify record counts
psql -U postgres -h 127.0.0.1 -d viora_bills_recovery -c "SELECT count(*) FROM invoices;"
```

---

## 10. Automated Release Check Pipeline

Before merging to master or deploying to production, execute the automated release verification suite:

```bash
npm run release:check
```

This single command runs:
1. `type-check`: Full TypeScript compilation across client and server workspaces.
2. `build`: Production bundling of frontend (Vite) and backend (Node.js).
3. `test:release`: Execution of the verification suites:
   - `test-p0.ts` (Authentication, tenant isolation, lifecycle guards, pagination)
   - `test-p1.ts` (Payment reversals, audit history, Asia/Kolkata timezone, omni-search)
   - `test-endpoints.ts` (Financial rounding, PDF streaming, CRUD operations)
   - `test-stabilization.ts` (Concurrent issuance, idempotency, GSTIN/phone validation)


## Roadmap release additions

Use Node 24 and npm ci. Run type-check, lint, build, test:unit, test:release, and test:e2e
against a dedicated test database. Apply migrations with prisma migrate deploy before starting the API.
The 2026-11-19 validation database is separate from the original port-5433 business database.

Docker: set POSTGRES_PASSWORD to a strong URL-safe secret, then docker compose up --build -d.
The local frontend is at http://localhost:8080. For production set APP_ENV=production and
CLIENT_URL to the HTTPS frontend origin and put TLS termination in front of the web container.
The API and PostgreSQL have no published host ports. Back up the postgres-data volume with pg_dump.
Container execution must be verified on a machine with a running Docker daemon.

Authentication limits use per-process memory. This Compose deployment runs one API instance;
before horizontal scaling use a shared limiter store at the proxy or application layer.
TRUST_PROXY_HOPS must match the actual trusted proxy chain; leave 0 for direct access.
Database retry is restricted to safe reads. Financial writes are never automatically retried.

Credit notes allocate tax and discounts from the original invoice using cumulative decimal
rounding, preserve the invoice, and cannot credit more than its original quantities. Issuance,
invoice balance update and audit entry are atomic. Credits may create a customer credit balance;
they do not claim a cash refund occurred. Original gross sales and period credit totals are
reported separately. Review tax filing treatment with your accounting process before filing.

Swagger reference: /api/docs; OpenAPI: /api/openapi.json. Interactive writes are disabled there.
The manifest supports standalone display; no service worker caches private billing data.
The private application uses noindex/nofollow rather than publishing account pages to search engines.
