# Viora Bills — Phase 1: Project Foundation

A web-based invoice and business billing application developed for the **Viora Tech** internship project.

This repository implements the production-grade architectural foundation for **Viora Bills**, structured to scale for upcoming phases including customer management, product catalogs, GST compliance, PDF generation, payment tracking, and sales analytics.

---

## 🏛️ Monorepo Architecture

```text
viora-bills/
├── client/                     # Frontend Application (React, TypeScript, Vite, Tailwind CSS)
│   ├── public/                 # Static assets & icons
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── common/         # Global alerts & mock data banners
│   │   │   ├── dashboard/      # Stat cards & metric grids
│   │   │   ├── invoices/       # Invoice table, badges & empty-state
│   │   │   ├── layout/         # Collapsible sidebar, navbar & app layout
│   │   │   ├── modals/         # Create invoice preview dialog
│   │   │   └── pages/          # Dashboard, Invoices & Phase 2 views
│   │   ├── services/           # API communication layer & resilience fallback
│   │   ├── types/              # Strong TypeScript definitions
│   │   ├── App.tsx             # Root application coordinator
│   │   ├── index.css           # Tailwind directives & design tokens
│   │   └── main.tsx            # React DOM mounting
│   ├── .env.example            # Client environment blueprint
│   ├── package.json            # Client scripts & dependencies
│   ├── tailwind.config.js      # Curated teal/navy design palette
│   └── vite.config.ts          # Vite bundler & backend reverse-proxy
│
├── server/                     # Backend Application (Node.js, Express, TypeScript, Prisma)
│   ├── prisma/
│   │   └── schema.prisma       # PostgreSQL data model schema
│   ├── src/
│   │   ├── config/             # Zod environment validator & Prisma singleton
│   │   ├── data/               # Strictly labelled Phase 1 preview data
│   │   ├── middlewares/        # Central error handler & Zod validation middleware
│   │   ├── routes/             # REST routing & health endpoints
│   │   │   ├── health.route.ts # Health check: GET /api/health
│   │   │   ├── api.route.ts    # Aggregator router
│   │   │   └── v1/             # Versioned REST endpoints (invoices, dashboard)
│   │   ├── utils/              # Standardized API response formatters
│   │   ├── app.ts              # Express application factory
│   │   └── index.ts            # Server entrypoint with graceful shutdown
│   ├── .env.example            # Server environment template
│   ├── package.json            # Server scripts & dependencies
│   └── tsconfig.json           # Server TypeScript configuration
│
├── .gitignore                  # Monorepo git ignore rules
├── package.json                # Root npm workspaces orchestrator
└── README.md                   # Project documentation
```

---

## 🚀 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Node.js, Express, TypeScript, Zod, Helmet, Morgan, CORS |
| **Database & ORM** | PostgreSQL (ready for Phase 2), Prisma ORM |
| **Architecture** | Monorepo with NPM Workspaces |
| **Design System** | Clean light mode, white surfaces, subtle borders, teal (`#0d9488`) / navy (`#0f172a`) palette |

---

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended, developed on v22.19.0)
- **NPM**: v9.0.0 or higher
- **PostgreSQL**: Required for Phase 2 database migrations (optional for Phase 1 preview)

---

## 🛠️ Getting Started

### 1. Clone & Install Dependencies

From the project root:

```bash
# Install all root, client, and server dependencies simultaneously
npm install
```

### 2. Environment Configuration

Copy the example environment files for both backend and frontend:

**Backend (`server/.env`):**
```bash
cp server/.env.example server/.env
```
Default values:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL="postgresql://postgres:password@localhost:5432/viora_bills?schema=public"
```

**Frontend (`client/.env`):**
```bash
cp client/.env.example client/.env
```
Default value:
```env
VITE_API_URL=/api
```

---

## 💻 Running the Application

### Option A: Run Both Client & Server Concurrently (Recommended)

From the root directory:
```bash
npm run dev
```
- Client runs on: `http://localhost:5173`
- Backend API runs on: `http://localhost:5000`

### Option B: Run Client & Server Independently

```bash
# In Terminal 1 (Backend API):
npm run dev:server

# In Terminal 2 (Frontend Client):
npm run dev:client
```

---

## 🩺 Health Check & REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | **Production health-check**: Uptime, service version, environment, and database readiness |
| `GET` | `/api/v1/dashboard/metrics` | Summary metrics: total sales, invoice count, collections, and receivables |
| `GET` | `/api/v1/invoices` | List invoices with optional `?status=PAID` and `?search=Acme` filters |
| `POST` | `/api/v1/invoices` | Zod-validated invoice ingestion endpoint |

### Health Check Response Example (`GET /api/health`):
```json
{
  "success": true,
  "message": "System is operating normally",
  "data": {
    "status": "healthy",
    "service": "viora-bills-api",
    "version": "0.1.0",
    "environment": "development",
    "uptimeSeconds": 42,
    "timestamp": "2025-10-23T16:45:00.000Z",
    "database": {
      "status": "standby_phase2",
      "message": "Database standby (Phase 2): PostgreSQL not yet provisioned"
    }
  },
  "timestamp": "2025-10-23T16:45:00.000Z"
}
```

---

## 🎨 Phase 1 UI Highlights

1. **Collapsible Left Sidebar**: Branded "Viora Bills", toggles between 256px expanded and 80px compact icon modes with animated transitions.
2. **Top Navigation Bar**: Page breadcrumbs, global search placeholder (`Ctrl + K`), dynamic backend status indicator badge, notification flyout, and profile menu.
3. **Dashboard Overview Cards**: 4 key financial metrics formatted in INR (`₹`):
   - Total Sales (`₹12,48,500`) with positive trend indicator
   - Total Invoices (`142` count with status breakdown)
   - Amount Collected (`₹9,85,200` with 78.9% collection rate)
   - Outstanding Payments (`₹2,63,300` with overdue indicator)
4. **Recent Invoices Table**: Displays invoice number, customer name, email, issue date, due date, amount, color-coded status badges, and action menus.
5. **Interactive Empty State**: Includes an interactive **"Simulate Empty State"** toggle button in the UI header to verify the zero-data empty state with its call-to-action button.
6. **Mobile & Tablet Responsive**: Responsive drawer on mobile viewports with backdrop overlay and responsive table columns.
7. **Mock Data Transparency**: Banner clearly identifies mock records so preview values are never misconstrued as real financial data.

---

## 🧪 Quality & Validation Commands

```bash
# Type-check both server and client
npm run type-check

# Build both applications for production
npm run build
```

---

## 🗺️ Roadmap to Phase 2

- [x] **Phase 1: Project Foundation** (Monorepo, Express REST API, React UI, Prisma Schema, Health check)
- [ ] **Phase 2: Database Persistence & Customers** (PostgreSQL live migration, Customer CRUD, Prisma seeders)
- [ ] **Phase 3: Product Catalog & GST Rates** (HSN/SAC codes, CGST/SGST/IGST tax calculation engine)
- [ ] **Phase 4: Invoice Engine & PDF Generation** (GST tax invoice generator, PDF download, print templates)
- [ ] **Phase 5: Payments & Sales Reports** (Payment reconciliation, GSTR-1 export, revenue analytics)
