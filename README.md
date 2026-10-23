# Viora Bills — Phase 2: Database and Backend

A web-based invoice and business billing application developed for the **Viora Tech** internship project.

This milestone completes **Phase 2: Database and Backend**, implementing a PostgreSQL database, Prisma ORM data modeling, decimal-safe financial arithmetic, ACID transactions, and a validated REST API connected to the React + Tailwind frontend.

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
│   │   │   ├── modals/         # NewInvoiceModal & RecordPaymentModal
│   │   │   └── pages/          # CustomersView, ProductsView, PaymentsView, ReportsView, SettingsView
│   │   ├── services/api.ts     # Complete API client service
│   │   ├── types/index.ts      # Strong TypeScript interfaces & enums
│   │   ├── App.tsx             # Root application state & router coordinator
│   │   ├── index.css           # Tailwind directives & design tokens
│   │   └── main.tsx            # React root mount
│   ├── .env.example            # Client environment blueprint
│   ├── package.json            # Client scripts & dependencies
│   ├── tailwind.config.js      # Enterprise teal/navy palette
│   └── vite.config.ts          # Vite bundler & backend reverse-proxy
│
├── server/                     # Backend Application (Node.js, Express, TypeScript, Prisma)
│   ├── prisma/
│   │   ├── schema.prisma       # PostgreSQL schema (6 core relational models)
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
│   │   ├── utils/              # Decimal-safe math (money.ts), response envelope, business helper
│   │   ├── app.ts              # Express application factory
│   │   └── index.ts            # Server entrypoint with graceful shutdown
│   ├── test-endpoints.ts       # Automated 16-point integration test suite
│   ├── .env.example            # Server environment template
│   ├── package.json            # Server scripts & dependencies
│   └── tsconfig.json           # Server TypeScript configuration
│
├── .gitignore                  # Git ignore rules (excludes .db_data, .env, dist, node_modules)
├── package.json                # Root orchestrator with npm workspaces
└── README.md                   # Complete documentation
```

---

## 🗄️ Database Models & Schema Design

The application uses PostgreSQL with Prisma ORM. Financial values use PostgreSQL `NUMERIC(12, 2)` / `NUMERIC(5, 2)` to avoid floating-point inaccuracies.

### 1. `Business` (`businesses`)
- Stores company coordinates, contact info, GSTIN, and sequential invoice numbering prefix.
- Fields: `id`, `name`, `logoUrl`, `address`, `phone`, `email`, `gstin`, `invoicePrefix`, `nextInvoiceNumber`, timestamps.

### 2. `Customer` (`customers`)
- Manages client accounts, billing address, and tax identifiers.
- Supports soft deletion (`isArchived: true`) if referenced by historical invoices.
- Fields: `id`, `businessId`, `name`, `phone`, `email`, `billingAddress`, `gstin`, `isArchived`, timestamps.

### 3. `Product` (`products`)
- Catalog of goods and services with unit pricing and tax rate.
- Supports soft deletion (`isArchived: true`) if referenced by historical invoices.
- Fields: `id`, `businessId`, `name`, `description`, `unit`, `unitPrice` (`Decimal(12, 2)`), `taxRate` (`Decimal(5, 2)`), `isActive`, `isArchived`, timestamps.

### 4. `Invoice` (`invoices`)
- Main invoice header record.
- Strict lifecycle status: `DRAFT`, `ISSUED`, `CANCELLED`.
- Derived payment status: `UNPAID`, `PARTIALLY_PAID`, `PAID`.
- Stores permanent historical snapshots of customer and business coordinates so past invoices never change if master records are edited.
- Unique constraint: `[businessId, invoiceNumber]`.

### 5. `InvoiceItem` (`invoice_items`)
- Individual line items linked to invoice.
- Stores historical snapshot of item description, unit price, quantity, discount, tax rate, taxable amount, and line total.

### 6. `Payment` (`payments`)
- Records incoming client settlements against issued invoices.
- Unique idempotency constraint: `requestKey` to prevent duplicate submissions.
- Fields: `id`, `invoiceId`, `amount` (`Decimal(12, 2)`), `paymentDate`, `method`, `reference`, `requestKey`, `createdAt`.

---

## 📐 Business Rules & Financial Integrity

1. **Decimal-Safe Precision**:
   All financial arithmetic is computed using `Prisma.Decimal` and `decimal.js`. Calculations are rounded half-up to 2 decimal places. Floating-point arithmetic is never used for currency.
2. **Server-Side Verification**:
   All item totals, taxes, discounts, and invoice grand totals are strictly calculated on the server. Totals supplied by the client are ignored.
3. **Draft-Only Edits**:
   `PUT /api/invoices/:id` strictly allows editing only when the invoice status is `DRAFT`. Once issued (`ISSUED`), edits are rejected with `HTTP 400 Bad Request`.
4. **Atomic Transactions**:
   - `POST /api/invoices/:id/issue` runs in a transaction: generates the official sequential invoice number from the business counter, increments the counter, locks customer/business snapshots, and transitions status to `ISSUED`.
   - `POST /api/invoices/:id/payments` runs in a transaction with overpayment checks.
5. **Payment Safety**:
   - Payments are only accepted on `ISSUED` invoices.
   - Overpayments (`amount > balanceRemaining`) are rejected with `HTTP 400 Bad Request`.
   - Duplicate payment requests are blocked via the unique `requestKey` constraint (`HTTP 409 Conflict`).
6. **Separate Statuses**:
   Invoice lifecycle status (`DRAFT`, `ISSUED`, `CANCELLED`) is distinct from payment status (`UNPAID`, `PARTIALLY_PAID`, `PAID`), which is derived dynamically from recorded payments.
7. **Draft Exclusion from Sales Reports**:
   `GET /api/reports/sales` and `GET /api/dashboard/summary` strictly exclude `DRAFT` and `CANCELLED` invoices from total sales and receivables. Sales by invoice date are kept separate from collections by payment date.

---

## 📡 REST API Endpoints

### Business Profile
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/business` | Retrieve active business coordinates and invoice prefix |
| `PUT` | `/api/business` | Update legal entity name, address, email, phone, and GSTIN |

### Customers
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/customers` | List customers (supports `?search=`, `?page=`, `?limit=`) |
| `GET` | `/api/customers/:id` | Get customer profile with recent invoice history |
| `POST` | `/api/customers` | Register new customer with billing address and GSTIN |
| `PUT` | `/api/customers/:id` | Update customer details |
| `DELETE` | `/api/customers/:id` | Soft delete / archive customer (preserves invoice integrity) |

### Products & Services
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/products` | List catalog items (supports `?search=`, `?isActive=`) |
| `GET` | `/api/products/:id` | Get product details |
| `POST` | `/api/products` | Create catalog item with unit price and tax rate |
| `PUT` | `/api/products/:id` | Update product pricing or toggle active state |
| `DELETE` | `/api/products/:id` | Soft delete / archive product |

### Invoices
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/invoices` | List invoices (supports `?status=`, `?paymentStatus=`, `?search=`, `?page=`) |
| `GET` | `/api/invoices/:id` | Get full invoice with line items, snapshots, and payment history |
| `POST` | `/api/invoices` | Create a draft invoice with server-computed totals |
| `PUT` | `/api/invoices/:id` | Edit draft invoice (rejected if already ISSUED) |
| `POST` | `/api/invoices/:id/issue` | Officially issue draft: assign sequential number & lock snapshots |

### Payments
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/payments` | List payment audit log with date filters |
| `POST` | `/api/invoices/:id/payments` | Record payment against issued invoice (with duplicate & overpay checks) |

### Dashboard & Reports
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard/summary` | Real-time calculations: Total Sales, Invoices Count, Collections, and Outstanding |
| `GET` | `/api/reports/sales` | Sales and Collections timelines (supports `?startDate=`, `?endDate=`, `?groupBy=day\|month`) |

### System Health
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service uptime, version, and PostgreSQL connection status |

---

## 🛠️ Setup & Running

### 1. Environment Configuration

Backend configuration (`server/.env`):
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL="postgresql://postgres@127.0.0.1:5433/viora_bills?schema=public"
```

Frontend configuration (`client/.env`):
```env
VITE_API_URL=/api
```

### 2. Database Migrations & Seeding

```bash
# Run migrations to sync PostgreSQL schema
npm run prisma:migrate --workspace=server

# Seed master records (business, sample customers, products, sample invoice)
npm run prisma:seed --workspace=server
```

### 3. Run Automated Backend Integration Tests

Verify all 16 endpoint and validation rules live against the database:

```bash
npm run test:backend
```

### 4. Start the Application

```bash
# Run both Frontend & Backend concurrently:
npm run dev

# Or run independently:
npm run dev:server   # Express API on http://localhost:5000
npm run dev:client   # Vite Frontend on http://localhost:5173
```

---

## 🔒 Security & Prototype Access Limitations

- Database connection strings and environment variables are strictly loaded from `.env` and are never committed to version control.
- CORS is restricted to the local frontend client origin (`http://localhost:5173`).
- Request payloads are validated against Zod schemas before database execution.
- **Prototype Scope Notice**: Authentication and authorization (login, sessions, role-based access control) are intentionally not implemented in Phase 2 as per the internship milestone specification. The application currently operates with a default organization context. Real JWT / session-based multi-user authorization will be introduced in subsequent phases.
