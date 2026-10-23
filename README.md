# Viora Bills — Phase 4: Payment Tracking, Dashboard Analytics & Sales Reports

A modern, web-based invoice and business billing application developed for the **Viora Tech** internship project.

This milestone completes **Phase 4: Payment Tracking, Dashboard Analytics and Sales Reports**, delivering ACID database transactional payment recording, row-level locking (`SELECT ... FOR UPDATE`), unique idempotency key enforcement, automated payment status calculation (`UNPAID`, `PARTIALLY_PAID`, `PAID`), real-time dashboard analytics with selectable reporting windows, and comprehensive daily/monthly sales vs. collections reports with a visual comparative chart.

---

## 🏛️ Monorepo Architecture

```text
viora-bills/
├── client/                     # Frontend Application (React, TypeScript, Vite, Tailwind CSS)
│   ├── public/                 # Static assets & favicon
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── common/         # Live database indicator banner
│   │   │   ├── dashboard/      # Stat cards, metrics grid, reporting window toolbar
│   │   │   ├── invoices/       # Invoice table, status badges & empty state
│   │   │   ├── layout/         # Collapsible sidebar, navbar & app layout
│   │   │   ├── modals/         # NewInvoiceModal, RecordPaymentModal, InvoicePreviewModal
│   │   │   └── pages/          # Invoices, Customers, Products, Payments, Reports, Settings
│   │   ├── services/api.ts     # Complete API client service & PDF downloader
│   │   ├── types/index.ts      # Strong TypeScript interfaces & enums
│   │   ├── App.tsx             # Root application state & router coordinator
│   │   ├── index.css           # Tailwind directives & @media print A4 stylesheet
│   │   └── main.tsx            # React root mount
│   ├── package.json            # Client scripts & dependencies
│   ├── tailwind.config.js      # Enterprise teal/navy palette
│   └── vite.config.ts          # Vite bundler & backend reverse-proxy
│
├── server/                     # Backend Application (Node.js, Express, TypeScript, Prisma, PDFKit)
│   ├── prisma/
│   │   ├── schema.prisma       # PostgreSQL schema with GST tax breakdown, Payment model & audit snapshots
│   │   ├── seed.ts             # Database seed script for initial master records
│   │   └── migrations/         # Prisma migration history
│   ├── src/
│   │   ├── config/             # Zod environment validator & Prisma singleton
│   │   ├── generated/          # Generated Prisma Client
│   │   ├── middlewares/        # Error handler & Zod validation middleware
│   │   ├── routes/             # REST routing & health endpoints
│   │   │   ├── health.route.ts # Health check: GET /api/health
│   │   │   ├── api.route.ts    # Aggregator router (/api/...)
│   │   │   └── v1/             # Business, Customers, Products, Invoices, Payments, Dashboard, Reports
│   │   ├── services/           # PDF Generation service (pdf.service.ts using PDFKit)
│   │   ├── utils/              # Decimal-safe math (money.ts), response envelope, business helper
│   │   ├── app.ts              # Express application factory
│   │   └── index.ts            # Server entrypoint with graceful shutdown
│   ├── test-endpoints.ts       # 31-scenario comprehensive automated verification test suite (Phase 3 + Phase 4)
│   ├── package.json            # Server scripts & dependencies
│   └── tsconfig.json           # Server TypeScript configuration
│
├── .gitignore                  # Git ignore rules (excludes .db_data, .env, dist, node_modules)
├── package.json                # Root orchestrator with npm workspaces
└── README.md                   # Complete documentation
```

---

## 💳 Payment Tracking & Concurrency Architecture

### 1. Payment Lifecycle & Derivation
Payment statuses are calculated server-side directly from persisted ledger transactions:
- **`UNPAID`**: Total paid is ₹0.
- **`PARTIALLY_PAID`**: $0 < \text{Total Paid} < \text{Invoice Grand Total}$.
- **`PAID`**: $\text{Total Paid} \ge \text{Invoice Grand Total}$ (or zero-value invoice).

### 2. Transaction Serialization & Row-Level Locking
To prevent concurrent requests from overpaying an invoice or double-crediting balances:
1. `SELECT id, "invoiceNumber", "grandTotal", status FROM "invoices" WHERE id = $1 FOR UPDATE` locks the invoice row inside an ACID transaction.
2. The current balance is recalculated inside the transaction from persisted payments.
3. The incoming payment amount is validated against the live remaining balance.
4. If valid, the payment record is inserted and the transaction commits.
5. If another request attempts to overpay concurrently, it is strictly rejected with `HTTP 400 ERR_OVERPAYMENT_REJECTED`.

### 3. Duplicate Prevention via Idempotency Keys
Every payment submission requires a stable `requestKey` with a unique database constraint:
- Duplicate submissions return `HTTP 409 ERR_DUPLICATE_PAYMENT_REQUEST`.
- Network retries never double-post payments or alter ledger balances.

---

## 📊 Dashboard Analytics & Sales Reports

### 1. Distinction Between Sales and Collections
- **Total Sales**: Sum of issued invoice grand totals grouped by **invoice date** (drafts and cancelled invoices strictly excluded).
- **Total Invoices**: Count of issued invoices in the reporting period.
- **Total Payments Collected**: Sum of recorded payments grouped by **payment date**.
- **Outstanding Payments**: Unsettled balances on issued invoices.
- **Business Timezone**: Aggregations use `Asia/Kolkata` (Indian Standard Time, UTC+5:30) to avoid off-by-one UTC day boundary errors.

### 2. Comparative Revenue Visualizations
The Sales Reports view provides a visual dual-timeline chart contrasting invoiced receivables against actual cash collected, supporting day and month grouping.

---

## 🧪 Automated Verification Suite (31 Scenarios)

The test suite runs against the live PostgreSQL database (`npm run test:backend`):

### Phase 3 Tests:
1. ✅ **Invoice totals calculation**: Spec item: Gross ₹1,000, Taxable ₹900, Tax ₹90, Grand Total ₹990.
2. ✅ **Multiple products in single invoice**: Subtotal ₹4,000, Tax ₹594, Grand Total ₹4,294.
3. ✅ **Intra-state GST tax split**: 50% CGST + 50% SGST with penny-safe rounding.
4. ✅ **Inter-state GST tax split**: 100% IGST applied.
5. ✅ **Zero-rate GST goods**: Tax ₹0.00, Grand Total ₹500.00.
6. ✅ **Max discount validation**: 100% discount produces Tax ₹0.00, Grand Total ₹0.00.
7. ✅ **Missing customer**: Rejected with `HTTP 404 ERR_CUSTOMER_NOT_FOUND`.
8. ✅ **Empty invoice**: Zero items rejected with `HTTP 400 ERR_VALIDATION_ERROR`.
9. ✅ **Invalid quantities**: Zero or negative quantities rejected with `HTTP 400`.
10. ✅ **Excessive discounts**: Discount exceeding gross amount rejected with `HTTP 400`.
11. ✅ **Unique invoice numbering**: Sequential format `INV-YYYY-XXXXXX` assigned upon issuance.
12. ✅ **Concurrent invoice issuance**: Atomic row update serialization guarantees zero collision or duplicate numbers under parallel issuance.
13. ✅ **Draft editing**: `PUT /api/invoices/:id` updates items and recomputes totals.
14. ✅ **Prevention of issued invoice modification**: Editing an `ISSUED` invoice strictly rejected with `HTTP 400 ERR_INVOICE_NOT_DRAFT`.
15. ✅ **PDF generation**: `GET /api/invoices/:id/pdf` returns valid binary stream starting with `%PDF-`.
16. ✅ **Historical snapshot integrity**: Stored item price on invoice remains unchanged even after catalog product price is modified.

### Phase 4 Tests:
17. ✅ **No payment produces UNPAID**: Total ₹1,000, Paid ₹0, Balance ₹1,000.
18. ✅ **Partial payment produces PARTIALLY_PAID**: Paid ₹400, Balance ₹600.
19. ✅ **Final payment produces PAID**: Paid ₹1,000, Balance ₹0.
20. ✅ **Outstanding balance arithmetic**: Reconciled as `grandTotal === totalPaid + balanceRemaining`.
21. ✅ **Zero, negative, and malformed payment amounts**: Strictly rejected with `HTTP 400`.
22. ✅ **Overpayment rejected**: Attempted ₹2,500 on ₹2,000 balance rejected with `HTTP 400 ERR_OVERPAYMENT_REJECTED`.
23. ✅ **Duplicate idempotency keys**: Re-submitting same `requestKey` returns `HTTP 409 Conflict` and prevents double-posting.
24. ✅ **Concurrent payment serialization**: Two simultaneous ₹1,000 requests on ₹1,500 balance accept exactly one and reject the other.
25. ✅ **Draft invoices cannot receive payments**: Rejected with `HTTP 400 ERR_INVALID_INVOICE_STATUS`.
26. ✅ **Dashboard sales exclude drafts**: Draft amounts excluded from total sales metric.
27. ✅ **Sales attributed by invoice date**: Sales reported under invoice date period.
28. ✅ **Collections attributed by payment date**: Payments reported under payment date period.
29. ✅ **Daily and monthly aggregates reconcile**: Timeline sums equal summary aggregates and match database records.
30. ✅ **Cross-boundary date filters**: Seamless filtering across month and year boundaries.
31. ✅ **Empty database periods**: Produces valid empty summaries (0 sales, 0 collections, 0 invoices, zero NaN).

---

## 🚀 How to Run Locally

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL 18 running on `127.0.0.1:5433` (database: `viora_bills`)

### 2. Installation
```bash
# Clone and install dependencies
npm install
```

### 3. Start Development Servers
```bash
# Concurrently starts Express (port 5000) and Vite (port 5173)
npm run dev

# Or run individually:
npm run dev:server   # Express API on http://localhost:5000
npm run dev:client   # Vite Frontend on http://localhost:5173
```

### 4. Run Verification Suite & Type Checks
```bash
# Run 31-scenario backend verification suite
npm run test:backend

# Run TypeScript type check across both workspaces
npm run type-check

# Run production build bundling
npm run build
```
