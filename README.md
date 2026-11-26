# Viora Bills — Professional Invoice & Billing Management System

> **Internship Final Submission & Verification Milestone — Phase 5**  
> Developed for **Viora Tech** by the Engineering Team.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.18-2d3748.svg)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38b2ac.svg)](https://tailwindcss.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-44%20QA%20%2B%2034%20Stabilization%20Passing-success.svg)](#-automated-testing-results)

---

## 📋 Executive Overview

**Viora Bills** is an enterprise-grade, web-based invoicing, GST billing, payment tracking, and sales analytics platform. Engineered specifically to comply with Indian GST rules and modern financial accounting principles, it provides a complete end-to-end workflow from customer onboarding and item cataloging to automated sequential invoice issuance, live A4 PDF generation, ACID transactional payment reconciliation, and real-time sales reporting.

### 🌟 Key Feature Matrix (Phases 1–5)

| Functional Domain | Implemented Capabilities |
| :--- | :--- |
| **Customer Management** | Full CRUD, phone/email/GSTIN search, live state detection, unreferenced customer deletion, and soft-delete archiving (`isArchived: true`) for customers with historical invoices. |
| **Product & Service Catalog** | Full CRUD, multi-unit tracking (`PCS`, `HRS`, `MTR`, `KG`, `BOX`, `SET`), custom GST rates (0%, 5%, 12%, 18%, 28%), price precision, unreferenced deletion, and soft-delete archiving. |
| **GST Calculation Engine** | Decimal-safe arithmetic (via `decimal.js`), line-item discounts applied prior to tax, automatic Intra-State (50% CGST + 50% SGST) vs. Inter-State (100% IGST) tax determination, and banker's half-up paisa rounding (`ROUND_HALF_UP`). |
| **Invoice Lifecycle** | Two-tier lifecycle: editable `DRAFT` status and immutable `ISSUED` status. Sequential numbering (`INV-YYYY-XXXXXX`) assigned atomically upon issuance. |
| **Instant Dispatch** | Automated dispatch modal upon invoice issuance triggering one-click WhatsApp API chat (`https://api.whatsapp.com/send?phone=...`) and pre-filled Gmail compose window (`https://mail.google.com/mail/...`) with detailed line-item summary and payment links. |
| **Contact Validation & Guardrails** | Strict contact validation requiring either a valid 10-digit mobile number or email for every customer. Company WhatsApp and Gmail credentials strictly required in Settings before invoices can be issued. |
| **Snapshot Audit Integrity** | Customer information, GSTIN, business profile, item descriptions, and unit prices are permanently snapshotted at the moment of invoice issuance, guaranteeing that future catalog or client changes never corrupt historical financial statements. |
| **PDF Generation & Printing** | On-the-fly streaming PDF generation using `PDFKit` with clean corporate branding, GST tax breakdown tables, and payment status badges. Includes dedicated CSS `@media print` rules for flawless physical A4 printing. |
| **Payment Ledger & Concurrency** | ACID transaction payment recording with row-level locking (`SELECT ... FOR UPDATE`), idempotency key deduplication (`requestKey`), overpayment rejection, and real-time status transitions (`UNPAID` ➔ `PARTIALLY_PAID` ➔ `PAID`). |
| **Executive Dashboard** | Real-time metrics grid displaying Total Sales, Total Invoices, Payments Collected, and Outstanding Receivables. Strict exclusion of draft invoices from revenue figures. Filterable by customizable date ranges. |
| **Sales & Collection Analytics** | Dual-perspective reporting: **Sales** attributed by invoice issuance date vs. **Collections** attributed by payment settlement date. Comparative timeline chart with Day and Month grouping. |
| **Security & Reliability** | Multi-origin CORS support, production error masking (no stack trace leakage), database parameterization, input sanitization via Zod, and system health monitoring (`/api/health`). |

---

## 🏗️ Monorepo Architecture & Directory Structure

```text
viora-bills/
├── client/                         # Frontend Application (React 18 + Vite + TypeScript)
│   ├── public/                     # Static assets & favicon
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/             # Live database connectivity banner
│   │   │   ├── dashboard/          # Metric stat cards & reporting window toolbar
│   │   │   ├── invoices/           # Invoice tables, status badges, action controls
│   │   │   ├── layout/             # Collapsible sidebar, navigation bar, shell layout
│   │   │   ├── modals/             # NewInvoiceModal, RecordPaymentModal, InvoicePreviewModal
│   │   │   └── pages/              # InvoicesView, CustomersView, ProductsView, PaymentsView, ReportsView, SettingsView
│   │   ├── services/api.ts         # Centralized Axios/fetch API client & PDF stream handler
│   │   ├── types/index.ts          # Strong TypeScript contracts & enums
│   │   ├── App.tsx                 # Root application state & navigation router
│   │   ├── index.css               # Tailwind CSS directives & A4 @media print rules
│   │   └── main.tsx                # React DOM entrypoint
│   ├── .env.example                # Frontend environment template
│   ├── package.json                # Frontend build scripts & dependencies
│   ├── tailwind.config.js          # Corporate Teal/Navy design palette
│   ├── tsconfig.json               # TypeScript strict configuration
│   └── vite.config.ts              # Vite bundler & backend reverse-proxy
│
├── server/                         # Backend Application (Node.js + Express + Prisma ORM)
│   ├── prisma/
│   │   ├── schema.prisma           # Relational PostgreSQL schema with Decimal precision
│   │   ├── seed.ts                 # Master seed file (default business, sample customers & products)
│   │   └── migrations/             # Timestamped SQL migration history
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts              # Zod environment variable validation
│   │   │   └── prisma.ts           # Prisma singleton client instance
│   │   ├── generated/              # Prisma Client generated types
│   │   ├── middlewares/
│   │   │   ├── errorHandler.ts     # Global AppError handler & production stack mask
│   │   │   └── validate.ts         # Zod schema request validation middleware
│   │   ├── routes/
│   │   │   ├── health.route.ts     # System health & DB ping check (/api/health)
│   │   │   ├── api.route.ts        # Primary API aggregator router
│   │   │   └── v1/                 # Resource routers: business, customers, products, invoices, payments, dashboard, reports
│   │   ├── services/
│   │   │   └── pdf.service.ts      # Streaming vector PDF generator built with PDFKit
│   │   ├── utils/
│   │   │   ├── businessHelper.ts   # Default single-tenant business provider
│   │   │   ├── money.ts            # High-precision Decimal math & GST calculators
│   │   │   └── response.ts         # Standardized JSend-style API response envelopes
│   │   ├── app.ts                  # Express application factory with CORS & security headers
│   │   └── index.ts                # Server entrypoint with graceful shutdown traps
│   ├── .env.example                # Backend environment template
│   ├── test-endpoints.ts           # 36-scenario automated test suite (Phases 3, 4, and 5)
│   ├── package.json                # Server build scripts & dependencies
│   └── tsconfig.json               # Server TypeScript compiler configuration
│
├── .gitignore                      # Git ignore rules (strictly excludes .db_data, .env, dist, node_modules)
├── package.json                    # Workspace root runner (npm workspaces)
└── README.md                       # Comprehensive documentation
```

---

## 🗄️ Database Architecture & Entity Relationships

The relational model is designed using PostgreSQL and Prisma ORM. Financial figures (`unitPrice`, `taxRate`, `discountAmount`, `taxableAmount`, `cgstAmount`, `sgstAmount`, `igstAmount`, `lineTotal`, `grandTotal`, `amount`) are stored as high-precision `Decimal(12, 2)` types to avoid binary floating-point drift.

```mermaid
erDiagram
    BUSINESS ||--o{ CUSTOMER : owns
    BUSINESS ||--o{ PRODUCT : catalogs
    BUSINESS ||--o{ INVOICE : issues
    CUSTOMER ||--o{ INVOICE : receives
    INVOICE ||--|{ INVOICE_ITEM : contains
    PRODUCT ||--o{ INVOICE_ITEM : references
    INVOICE ||--o{ PAYMENT : settles

    BUSINESS {
        String id PK "UUID"
        String name "Company Trade Name"
        String gstin "15-digit GSTIN"
        String email
        String phone
        String address
        String state
        String stateCode
        DateTime createdAt
        DateTime updatedAt
    }

    CUSTOMER {
        String id PK "UUID"
        String businessId FK
        String name "Contact or Company Name"
        String phone
        String email
        String billingAddress
        String gstin "Optional GSTIN"
        String state
        Boolean isArchived "Soft delete flag"
        DateTime createdAt
        DateTime updatedAt
    }

    PRODUCT {
        String id PK "UUID"
        String businessId FK
        String name
        String description
        String unit "PCS, HRS, etc."
        Decimal unitPrice "12, 2"
        Decimal taxRate "e.g. 18.00"
        Boolean isActive
        Boolean isArchived "Soft delete flag"
        DateTime createdAt
        DateTime updatedAt
    }

    INVOICE {
        String id PK "UUID"
        String businessId FK
        String customerId FK
        String invoiceNumber UK "Unique: INV-YYYY-XXXXXX"
        DateTime invoiceDate
        DateTime dueDate
        String status "DRAFT | ISSUED | CANCELLED"
        String placeOfSupply
        Boolean isInterState
        Decimal subtotal "12, 2"
        Decimal discountTotal "12, 2"
        Decimal taxableTotal "12, 2"
        Decimal cgstTotal "12, 2"
        Decimal sgstTotal "12, 2"
        Decimal igstTotal "12, 2"
        Decimal taxTotal "12, 2"
        Decimal grandTotal "12, 2"
        Json customerSnapshot "Historical audit copy"
        Json businessSnapshot "Historical audit copy"
        DateTime createdAt
        DateTime updatedAt
    }

    INVOICE_ITEM {
        String id PK "UUID"
        String invoiceId FK
        String productId FK "Nullable if product deleted"
        String descriptionSnapshot "Immutable item description"
        Decimal quantity "12, 2"
        String unitSnapshot
        Decimal unitPrice "12, 2"
        Decimal discountAmount "12, 2"
        Decimal taxableAmount "12, 2"
        Decimal taxRate "12, 2"
        Decimal cgstAmount "12, 2"
        Decimal sgstAmount "12, 2"
        Decimal igstAmount "12, 2"
        Decimal lineTotal "12, 2"
        DateTime createdAt
    }

    PAYMENT {
        String id PK "UUID"
        String invoiceId FK
        Decimal amount "12, 2"
        DateTime paymentDate
        String paymentMethod "CASH | UPI | BANK_TRANSFER | CHEQUE | CARD"
        String referenceNumber "Txn reference or UTR"
        String notes
        String requestKey UK "Idempotency key"
        DateTime createdAt
    }
```

---

## 🔒 Security & Data Integrity Controls

### 1. Multi-Portal Access & Key Binding
> [!NOTE]
> **Strict 3-Portal Isolation**:
> - **Portal-Scoped Auth**: `customer` (`5174`), `superadmin` (`5175`), and `admin` (`5173`) use isolated `HttpOnly` session cookies and portal header checks (`X-Viora-Portal`).
> - **12-Digit Access Codes**: Super Admin login verifies an exact match between the purchaser email and subscription owner; Admin login verifies an active Super Admin-issued 12-digit code plus `allowAdminBilling` authorization.

### 2. Implemented Security Controls
1. **Secrets & Git Sanitization**:
   - Zero hardcoded API keys or database passwords exist in source files.
   - All real environment files (`.env`, `.env.local`), database files (`.db_data/`), and build artifacts are strictly ignored via root `.gitignore`.
   - Tracked templates (`.env.example`) contain only sanitized placeholder values.
2. **Production Error Masking**:
   - `errorHandler.ts` detects `NODE_ENV === 'production'`.
   - Unhandled 500 server errors return a generic message: `"An unexpected internal server error occurred"`.
   - Stack traces and raw database driver exceptions are completely suppressed in production client responses.
3. **CORS Hardening**:
   - `app.ts` dynamically parses single or comma-separated allowed origins from `CLIENT_URL`.
   - Normalizes trailing slashes to prevent cross-origin mismatches between hosting providers.
4. **SQL Injection Prevention**:
   - All database reads and writes execute via Prisma ORM parameterized queries.
   - Raw queries (`$queryRaw`) strictly use parameterized tagged template literals (`Prisma.sql`), preventing SQL injection attacks.
5. **Idempotency & Race Condition Defense**:
   - All payments require a unique `requestKey`. Re-submitting the same key returns `HTTP 409 ERR_DUPLICATE_PAYMENT_REQUEST`, guaranteeing no double-charges occur on network retries.
   - Concurrent payment allocations utilize PostgreSQL row-level locking (`SELECT ... FOR UPDATE`), serializing balance calculations and preventing overpayments under heavy parallel load.
6. **Financial Precision Integrity**:
   - Strict decimal arithmetic avoids IEEE-754 floating point imprecision (e.g., `0.1 + 0.2 = 0.30000000000000004`).
   - All currency values are rounded using the `ROUND_HALF_UP` algorithm to the nearest paisa.

---

## 🌐 Complete REST API Endpoint Summary

All responses follow a consistent JSend-style JSON envelope:
- **Success (2xx)**: `{ "success": true, "message": "...", "data": { ... }, "timestamp": "..." }`
- **Error (4xx/5xx)**: `{ "success": false, "error": { "code": "ERR_...", "message": "...", "details": [...] }, "timestamp": "..." }`

### 1. System Health
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service uptime, memory usage, and live PostgreSQL connection check. |

### 2. Business Profile
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/business` | Fetches active business profile, address, GSTIN, and state code. |
| `PUT` | `/api/business` | Updates business company name, GSTIN, contact details, and address. |

### 3. Customers
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/customers` | Paginated customer list with query filter (`?search=`, `?page=`, `?limit=`). |
| `GET` | `/api/customers/:id` | Customer details including total invoice history count. |
| `POST` | `/api/customers` | Creates new customer record with Zod phone/email/GSTIN validation. |
| `PUT` | `/api/customers/:id` | Updates customer contact and billing address information. |
| `DELETE` | `/api/customers/:id` | Permanently deletes unused customers; soft-archives (`isArchived: true`) customers with invoices. |

### 4. Products & Services
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/products` | Paginated product list with search and active status filter (`?search=`, `?isActive=`). |
| `GET` | `/api/products/:id` | Product details and current price/tax structure. |
| `POST` | `/api/products` | Adds product/service to catalog (validates positive price, tax $\le 100\%$). |
| `PUT` | `/api/products/:id` | Modifies catalog pricing, unit, tax rate, or active status. |
| `DELETE` | `/api/products/:id` | Deletes unused products; soft-archives (`isArchived: true`) products referenced in invoices. |

### 5. Invoices
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/invoices` | Paginated invoice list with search (`?search=`), status (`?status=`), and date filters. |
| `GET` | `/api/invoices/:id` | Full invoice details including line items, tax breakdown, and payments. |
| `POST` | `/api/invoices` | Creates a new invoice in `DRAFT` status with automatic GST calculations. |
| `PUT` | `/api/invoices/:id` | Edits draft invoice line items and details (blocked if invoice is already `ISSUED`). |
| `POST` | `/api/invoices/:id/issue`| Transitions `DRAFT` to `ISSUED`, assigns sequential `INV-YYYY-XXXXXX`, snapshots audit data. |
| `GET` | `/api/invoices/:id/pdf` | Streams generated vector A4 PDF invoice binary with `%PDF-` header. |
| `DELETE` | `/api/invoices/:id` | Deletes a draft invoice (issued invoices cannot be deleted). |

### 6. Payments
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/payments` | Paginated payment ledger with invoice details, method, and date filters. |
| `GET` | `/api/invoices/:id/payments` | Retrieves payment records and live remaining balance for a specific invoice. |
| `POST` | `/api/invoices/:id/payments` | Records payment against an issued invoice (serialized transaction, row-locking). |

### 7. Dashboard & Reports
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard/summary` | Real-time totals: Sales, Invoice Count, Collections, Receivables (`?startDate=`, `?endDate=`). |
| `GET` | `/api/reports/sales` | Aggregated timeline report contrasting Sales vs. Collections (`?groupBy=day\|month`). |

---

## 🧪 Automated Testing Results

The automated verification suite tests **44 comprehensive real-world scenarios** across Phase 3, 4, 5, and Master QA (A–H), plus a dedicated **34-test stabilization suite** for Bugs B1 through B23.

**Execution Commands:**
```bash
# Run Master End-to-End QA Test Suite (44 scenarios)
npm run test:backend

# Run Bug-Fix Stabilization Test Suite (34 tests covering B1-B23)
npm run test:backend --workspace=server -- test-stabilization.ts
```

**Real Execution Summary:**
```text
🧪 Phase 3 Financial Calculations & Integrity: 16 / 16 PASSED
🧪 Phase 4 Payments, Ledger, Idempotency & Reports: 15 / 15 PASSED
🧪 Phase 5 CRUD Lifecycle, Soft Delete & Health: 5 / 5 PASSED
🚀 Master QA Scenarios (TEST A through TEST H): 8 / 8 PASSED
=============================================================
🏆 ALL 44 BACKEND QA SCENARIOS FULLY PASSED!
=============================================================

🧪 Bug-Fix & Stabilization Suite (B1 - B23):
✅ B1: Concurrent Invoice Issuance (Row Locking)
✅ B2: 50 Parallel Draft Creations (Collision-safe IDs)
✅ B3: Quantity Precision (3 decimals: 0.125 preserved)
✅ B5 & B22: IST Timezone Boundaries & Receivables Split
✅ B6: 10-Digit Indian Phone Normalization & Rejection
✅ B7: PDF Pagination Margins (Single-page clean render)
✅ B8: Snapshot Freezing on Issuance
✅ B9: 15-character GSTIN Validation
✅ B11: Draft Deletion & Issued Cancellation
✅ B17: Duplicate Customer Rejection & Sub-Paisa Validation
✅ B20: Zero-Total Invoice Issue Blocking
======================================================
🎉 ALL 34 STABILIZATION TESTS PASSED!
======================================================
```

---

## 🚀 3-Portal SaaS Architecture & Access Flow

Viora Bills runs across **3 dedicated role portals** backed by a single Express + PostgreSQL engine (`http://localhost:5000`):

1. **Customer Purchase Portal (`http://localhost:5174`)**:
   - Exclusively for business buyers signing up and purchasing INR software subscriptions via Razorpay (UPI QR, UPI ID, Cards, NetBanking).
   - Generates a unique **12-digit Super Admin Access Code** bound strictly to the purchaser's email and provisions an isolated business workspace.
2. **Super Admin Control Panel (`http://localhost:5175`)**:
   - Login strictly requires **Purchasing Email + Password + 12-Digit Super Admin Code**.
   - Manages the master **Product & Service Catalog**, **Company & GST Settings**, generates/revokes **12-digit Admin Access Codes**, and toggles **Admin Billing Authorization** (`allowAdminBilling`).
3. **Billing Admin Desk (`http://localhost:5173`)**:
   - Staff login strictly requires **Email + Password + 12-Digit Admin Access Code**.
   - Views synced products in read-only mode and generates GST invoices, client statements, credit notes, recurring bills, and payment collections once authorized by the Super Admin.

---

## 💻 Local Installation & Setup Guide

### 1. Prerequisites
- **Node.js**: `v22.12.0` or higher (works with v20+)
- **npm**: `v9.0.0` or higher
- **PostgreSQL**: `v14.0` or higher (tested with PostgreSQL 18 on port `5433` or `5432`)

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/YSK2005/Viora_Project.git
cd Viora_Project

# Install dependencies across root, server, and client workspaces (generates Prisma client)
npm install
```

### 3. Environment Setup
Configure your environment files from the tracked templates:
```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

Update `server/.env` with your local PostgreSQL connection string and multi-portal CORS origins:
```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173,http://localhost:5174,http://localhost:5175
DATABASE_URL="postgresql://postgres:your_password@127.0.0.1:5433/viora_bills?schema=public"
```

### 4. Database Initialization & Seeding
```bash
# Push Prisma schema to PostgreSQL and generate client
cd server
npx prisma db push
npx prisma generate
cd ..

# Seed sample business data and SaaS INR plans + demo 12-digit access codes
npx tsx server/prisma/seed-plans.ts
```

### 5. Running All Three Portals Concurrently
```bash
# Starts API (5000), Admin Desk (5173), Customer Portal (5174), and Super Admin Panel (5175)
npm run dev
```
*(On Windows, you can also double-click `start-app.bat`.)*

### 6. Seeded Demo Credentials
| Portal | URL | Email | Password | 12-Digit Access Code |
| :--- | :--- | :--- | :--- | :--- |
| **Customer Portal** | `http://localhost:5174` | `customer@viora.test` | `Customer123!` | *Not required* |
| **Super Admin Panel** | `http://localhost:5175` | `customer@viora.test` | `Customer123!` | `123456789012` |
| **Billing Admin Desk** | `http://localhost:5173` | `admin@viora.test` | `AdminPassword123!` | `987654321098` |

### 7. Verification Commands
```bash
npm run test:unit
npm run type-check
npm run lint
npm run build
```

---

## 🚀 Production Deployment Readiness

### 1. Architecture Overview
- **Frontend Hosting**: Vercel, Netlify, or Cloudflare Pages.
- **Backend Hosting**: Render, Railway, AWS ECS, or DigitalOcean App Platform.
- **Database Hosting**: Managed PostgreSQL on Supabase, Neon, AWS RDS, or Render Postgres.

### 2. Environment Variables Checklist
| Component | Variable Name | Purpose | Example Value |
| :--- | :--- | :--- | :--- |
| **Server** | `NODE_ENV` | Enables production error masking | `production` |
| **Server** | `PORT` | HTTP port for Node.js process | `5000` |
| **Server** | `DATABASE_URL` | Pooled connection string to PostgreSQL | `postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| **Server** | `CLIENT_URL` | Allowed frontend origin for CORS | `https://viora-bills.vercel.app` |
| **Client** | `VITE_API_URL` | Deployed backend API base address | `https://api.viorabills.com/api` |

### 3. Production Build & Start Commands
- **Backend Build**: `npm run build` inside `server/` (compiles TypeScript to `server/dist/`).
- **Backend Start**: `node dist/index.js` (or `npm start` in `server/`).
- **Frontend Build**: `npm run build` inside `client/` (outputs static bundle to `client/dist/`).
- **Database Migration**: `npx prisma migrate deploy` in `server/` during deployment pipeline.

---

## 🎯 10-Step Internship Demonstration Script

Follow this script during your internship evaluation to demonstrate all core features in a clean, working sequence:

1. **Dashboard Overview**:
   - Open `http://localhost:5173`.
   - Point out the active database indicator banner and live metric cards (Total Sales, Invoices, Collections, Outstanding Receivables).
   - Show how the date window dropdown (All Time, This Month, Last 30 Days) recalculates metrics on the fly.
2. **Add a Customer**:
   - Navigate to **Customers** (`/customers`).
   - Click **+ New Customer**. Enter name `"Apex Innovations Pvt Ltd"`, phone `"+91 98765 43210"`, email `"billing@apex.in"`, address `"Plot 12, HITEC City, Hyderabad, Telangana"`, and GSTIN `"36AAACA1234A1Z5"`.
   - Save and show that the customer appears instantly in the search table.
3. **Add a Product**:
   - Navigate to **Products** (`/products`).
   - Click **+ New Product**. Enter name `"Cloud Security Audit"`, unit `"HRS"`, price `₹2,500.00`, tax rate `18%`.
   - Save and demonstrate the search bar filtering the catalog.
4. **Create an Invoice with Discount and Tax**:
   - Navigate to **Invoices** (`/invoices`) and click **+ Create Invoice**.
   - Select `"Apex Innovations Pvt Ltd"`. Notice the place of supply automatically detects Telangana (Inter-state or Intra-state depending on business state).
   - Add `"Cloud Security Audit"`, quantity `4` (Gross: ₹10,000.00).
   - Apply a fixed discount of `₹1,000.00`.
   - Show live calculation: Taxable `₹9,000.00`, 18% GST `₹1,620.00`, Grand Total `₹10,620.00`.
5. **Save and Issue Invoice**:
   - Click **Save as Draft**. Point out the `DRAFT` status badge and `#DRAFT` temporary indicator.
   - Click **Issue Invoice**. Confirm issuance.
   - Point out the newly generated unique sequential number (e.g. `INV-2026-000004`) and status change to `ISSUED`.
6. **Download and Print PDF**:
   - Click the **PDF** button to stream and download the vector PDF invoice. Open it to show the professional header, business details, tax tables, and payment status.
   - Click **Preview / Print**. Demonstrate the A4 preview modal and trigger print view to showcase the clean `@media print` styling without UI artifacts.
7. **Record a Partial Payment**:
   - Click **Record Payment** on the issued invoice.
   - Enter `₹5,000.00`, select method `UPI`, enter reference `"UPI-TXN-8839210"`.
   - Submit payment. Show the invoice status immediately transition to `PARTIALLY_PAID` with Remaining Balance `₹5,620.00`.
8. **Record the Remaining Payment**:
   - Open **Record Payment** again.
   - Notice the modal automatically defaults the amount to the exact remaining balance `₹5,620.00`.
   - Select `BANK_TRANSFER`, enter UTR `"HDFC99827361"`.
   - Submit payment. Show the invoice status automatically transition to `PAID` with Remaining Balance `₹0.00`.
9. **Show Updated Payment Ledger**:
   - Navigate to **Payments** (`/payments`).
   - Show both payment transactions logged with their respective methods, invoice links, timestamps, and reference numbers.
10. **Verify Dashboard & Sales Reports Reconciliation**:
    - Return to the **Dashboard** (`/`): Show the updated Total Sales and Collections reflecting the completed invoice and payments.
    - Navigate to **Sales Reports** (`/reports`): Toggle between **By Day** and **By Month** views to verify that invoiced sales and collected cash reconcile perfectly with the persisted database records.

---

## 👥 Team & Internship Contributions

| Team Member Name | Role & Core Area of Responsibility | Key Modules Delivered |
| :--- | :--- | :--- |
| **Vipul Kumawat** *(Lead Developer)* | Full-Stack Architecture, Database & Security | PostgreSQL Schema, Prisma ORM, Decimal Math Engine, Row-locking Payments, Verification Test Suite |
| **[Team Member 2 Name]** | Frontend Engineering & UX Design | Responsive Dashboard, Modal Forms, Print A4 Stylesheet, Status Badges |
| **[Team Member 3 Name]** | Backend Services & PDF Generation | PDFKit Service, Dynamic GST Split, Zod Validation, Health Monitoring |
| **[Team Member 4 Name]** | QA, Reporting & Deployment | Sales vs Collections Analytics, Idempotency Testing, End-to-End Verification |

---

## 📜 License & Compliance

Developed as part of the **Viora Tech Internship Program**. All intellectual property and codebase assets are maintained under the terms of the Viora Tech Internship Agreement.
