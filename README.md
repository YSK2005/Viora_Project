# Viora Bills — Phase 3: Professional Invoice Generation, GST Calculations, PDF and Printing

A modern, web-based invoice and business billing application developed for the **Viora Tech** internship project.

This milestone completes **Phase 3: Professional Invoice Generation, GST Calculations, PDF and Printing**, delivering an enterprise-ready invoice generation workflow, dynamic line items, configurable Indian GST tax breakdown (CGST, SGST, IGST), downloadable A4 vector PDF generation, clean print stylesheets, and historical audit snapshots.

---

## 🏛️ Monorepo Architecture

```text
viora-bills/
├── client/                     # Frontend Application (React, TypeScript, Vite, Tailwind CSS)
│   ├── public/                 # Static assets & favicon
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── common/         # Live database indicator banner
│   │   │   ├── dashboard/      # Stat cards & PostgreSQL metrics grid
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
│   │   ├── schema.prisma       # PostgreSQL schema with GST tax breakdown & audit snapshots
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
│   ├── test-endpoints.ts       # 16-scenario comprehensive automated verification test suite
│   ├── package.json            # Server scripts & dependencies
│   └── tsconfig.json           # Server TypeScript configuration
│
├── .gitignore                  # Git ignore rules (excludes .db_data, .env, dist, node_modules)
├── package.json                # Root orchestrator with npm workspaces
└── README.md                   # Complete documentation
```

---

## 📐 GST Calculation Engine & Billing Rules

All calculations are executed server-side using PostgreSQL `NUMERIC(12, 2)` / `Prisma.Decimal` and `decimal.js`. JavaScript native floating-point math is never used.

### 1. Calculation Pipeline
1. **Prices are tax-exclusive**: Unit price reflects the base pre-tax rate.
2. **Gross Amount**: $\text{Gross} = \text{Quantity} \times \text{Unit Price}$.
3. **Discounts Applied Before Tax**: Each line allows a fixed discount amount ($\text{Discount} \le \text{Gross}$).
4. **Taxable Amount**: $\text{Taxable} = \text{Gross} - \text{Discount}$.
5. **Tax Amount**: $\text{Tax} = \text{Taxable} \times \frac{\text{Tax Rate}}{100}$, rounded to 2 decimal places using `ROUND_HALF_UP`.
6. **Line Total**: $\text{Line Total} = \text{Taxable} + \text{Tax}$.
7. **Invoice Grand Total**: Sum of all line totals.

### 2. Configurable Indian GST Tax Breakdowns
The engine dynamically determines the tax treatment based on Place of Supply comparison:
- **Intra-State Supply** ($\text{Place of Supply} = \text{Business State}$):
  - $\text{CGST Rate} = \frac{\text{Tax Rate}}{2}$
  - $\text{SGST Rate} = \frac{\text{Tax Rate}}{2}$
  - $\text{CGST Amount} = \text{round}_2\left(\frac{\text{Tax Amount}}{2}\right)$
  - $\text{SGST Amount} = \text{Tax Amount} - \text{CGST Amount}$ *(prevents 1-paisa rounding divergence)*
  - $\text{IGST} = 0$
- **Inter-State Supply** ($\text{Place of Supply} \ne \text{Business State}$):
  - $\text{IGST Rate} = \text{Tax Rate}$
  - $\text{IGST Amount} = \text{Tax Amount}$
  - $\text{CGST} = 0, \text{SGST} = 0$

### 3. Specification Test Example
- **Quantity**: 2
- **Unit price**: ₹500.00
- **Discount**: ₹100.00
- **Tax rate**: 10%
- **Computed**:
  - $\text{Gross} = 2 \times 500 = \text{₹1,000.00}$
  - $\text{Taxable} = 1000 - 100 = \text{₹900.00}$
  - $\text{Tax} = 900 \times 10\% = \text{₹90.00}$
  - $\text{Grand Total} = 900 + 90 = \text{₹990.00}$

---

## 🗄️ Database Models & Snapshots

Schema located in [`server/prisma/schema.prisma`](file:///c:/Users/Vipul_kumawat/Documents/DataThon/Viora_Project/server/prisma/schema.prisma):

1. **`Business`**: Name, logo, address, phone, email, GSTIN, state of origin, invoice prefix (`INV`), and sequence counter.
2. **`Customer`**: Name, phone, email, billing address, GSTIN, state, soft-deletion status (`isArchived`).
3. **`Product`**: Catalog item with name, description, unit (PCS, HRS, NOS, BOX, etc.), unit price, default tax rate, and active flag.
4. **`Invoice`**:
   - Lifecycle status: `DRAFT`, `ISSUED`, `CANCELLED`.
   - Payment status: `UNPAID`, `PARTIALLY_PAID`, `PAID`.
   - Place of supply and `isInterState` flag.
   - Financial totals: `subtotal`, `discountTotal`, `taxableAmount`, `cgstTotal`, `sgstTotal`, `igstTotal`, `taxTotal`, `grandTotal`.
   - **Immutable Snapshots**: Stores legal historical snapshots upon issuance (`customerNameSnapshot`, `customerAddressSnapshot`, `customerGstinSnapshot`, `customerStateSnapshot`, `businessNameSnapshot`, `businessGstinSnapshot`, `businessStateSnapshot`) so that editing master profiles never corrupts issued invoices.
5. **`InvoiceItem`**: Line item record with unit, quantity, unit price, discount amount, taxable amount, tax rate, CGST/SGST/IGST breakdown, and line total.
6. **`Payment`**: Immutable ledger entry with idempotency `requestKey` to prevent double-charging.

---

## 🖨️ PDF Generation & Print Support

1. **Server-Side PDF Generation (`GET /api/invoices/:id/pdf`)**:
   - Built with pure TypeScript `PDFKit` streaming vector engine.
   - Clean A4 layout with navy header, teal accent line, company details, customer card, itemized table with discount and GST columns, summary card with tax breakdown, payment history ledger, and dynamic multi-page numbering (`Page X of Y`).
   - Served with `Content-Type: application/pdf` and `Content-Disposition: inline; filename="invoice-INV-YYYY-XXXXXX.pdf"`.
2. **Print Support**:
   - Embedded `@media print` CSS stylesheet automatically hides application chrome, sidebars, buttons, and banners.
   - Formatted for crisp physical printing on A4 paper with proper page margins.

---

## 🌐 Complete REST API Reference

| Scope | Method | Route | Description |
|---|---|---|---|
| **Health** | `GET` | `/api/health` | Backend and PostgreSQL connectivity status |
| **Business** | `GET` | `/api/business` | Retrieve business profile and invoice numbering sequence |
| | `PUT` | `/api/business` | Update business name, address, GSTIN, state, and prefix |
| **Customers** | `GET` | `/api/customers` | Paginated search of customers with invoice counts |
| | `POST` | `/api/customers` | Register customer with GSTIN, billing address, and state |
| | `GET`, `PUT`, `DELETE` | `/api/customers/:id` | View, update, or soft-delete customer |
| **Products** | `GET` | `/api/products` | Search product catalog with units and tax rates |
| | `POST` | `/api/products` | Create product or service item |
| | `GET`, `PUT`, `DELETE` | `/api/products/:id` | View, update, or soft-delete product item |
| **Invoices** | `GET` | `/api/invoices` | List invoices with status, payment, search, and date filters |
| | `POST` | `/api/invoices` | Create draft invoice with server-side GST calculations |
| | `GET` | `/api/invoices/:id` | Fetch full invoice details, snapshots, items, and payments |
| | `PUT` | `/api/invoices/:id` | Edit draft invoice items *(Strictly rejected if ISSUED)* |
| | `POST` | `/api/invoices/:id/issue` | Atomically assign unique sequence number and lock snapshots |
| | `GET` | `/api/invoices/:id/pdf` | Download official printable A4 vector PDF document |
| | `POST` | `/api/invoices/:id/payments` | Record payment against invoice with overpayment guard |
| **Payments** | `GET` | `/api/payments` | Retrieve complete payment audit log |
| **Dashboard** | `GET` | `/api/dashboard/summary` | Real-time aggregate KPIs from PostgreSQL |
| **Reports** | `GET` | `/api/reports/sales` | Sales and collections timeline grouped by day or month |

---

## 🧪 Automated Verification Suite (16 Scenarios)

The test suite in [`server/test-endpoints.ts`](file:///c:/Users/Vipul_kumawat/Documents/DataThon/Viora_Project/server/test-endpoints.ts) rigorously verifies every business requirement:

```bash
npm run test:backend
```

### Verified Test Cases:
1. ✅ **Correct invoice totals**: 2 qty @ ₹500, ₹100 discount, 10% tax $\to$ Gross ₹1,000, Taxable ₹900, Tax ₹90, Grand Total ₹990.
2. ✅ **Multiple products**: Computes multiple line items with different quantities and prices.
3. ✅ **Mixed tax rates**: Validated across 0%, 5%, 18%, and 28% tax tiers.
4. ✅ **Fixed discounts**: Applied before tax without floating-point distortion.
5. ✅ **Fractional quantities**: 2.75 hours consulting @ ₹1,200.00 $\to$ exact ₹3,300 gross.
6. ✅ **Rounding edge cases**: 1 @ ₹33.33 @ 18% tax $\to$ ₹5.9994 correctly rounded to ₹6.00 via `ROUND_HALF_UP`.
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
# Run backend verification suite
npm run test:backend

# Run TypeScript type check across both workspaces
npm run type-check

# Run production build bundling
npm run build
```
