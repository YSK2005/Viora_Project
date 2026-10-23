import React from 'react';
import { NavigationKey } from '../../types';
import {
  Users,
  Package,
  CreditCard,
  BarChart3,
  Settings,
  Layers,
  ArrowRight,
  Database,
} from 'lucide-react';

interface PlaceholderViewProps {
  navKey: NavigationKey;
  onNavigateToDashboard: () => void;
}

interface PageMeta {
  title: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  schemaModel: string;
  plannedFeatures: string[];
  mockCardLabel: string;
  mockStats: { label: string; value: string }[];
}

const PAGE_DEFINITIONS: Record<Exclude<NavigationKey, 'dashboard' | 'invoices'>, PageMeta> = {
  customers: {
    title: 'Customer Directory & Accounts',
    category: 'Client Relationship Management',
    icon: Users,
    description:
      'Manage client contacts, GSTIN tax identifiers, billing & shipping addresses, and ledger balances.',
    schemaModel: 'prisma.customer',
    plannedFeatures: [
      'Customer GSTIN validation with state code mapping',
      'Separate billing & shipping address books',
      'Client ledger statements & pending balances',
      'CSV / Excel bulk customer import',
    ],
    mockCardLabel: 'Customer Base Preview',
    mockStats: [
      { label: 'Active Clients', value: '48 accounts' },
      { label: 'GST Registered', value: '42 entities' },
      { label: 'Avg Payment Cycle', value: '18 days' },
    ],
  },
  products: {
    title: 'Products & Services Catalog',
    category: 'Inventory & Tax Rates',
    icon: Package,
    description:
      'Maintain item master records, SKU identifiers, HSN / SAC GST classification codes, and pricing rules.',
    schemaModel: 'prisma.product',
    plannedFeatures: [
      'HSN / SAC Code search & auto-tax calculation (5%, 12%, 18%, 28%)',
      'Unit of measurement (UOM) definitions: PCS, BOX, HRS, KGS',
      'Discount tiers and standard retail/wholesale rates',
      'Stock status indicators and price versioning',
    ],
    mockCardLabel: 'Catalog Overview',
    mockStats: [
      { label: 'Catalog Items', value: '94 SKUs' },
      { label: 'Default GST Rate', value: '18.0%' },
      { label: 'Service Units', value: '6 types' },
    ],
  },
  payments: {
    title: 'Payment Tracking & Settlement',
    category: 'Financial Ledger & Collections',
    icon: CreditCard,
    description:
      'Record incoming client payments across bank transfers (NEFT/RTGS/IMPS), UPI, cheques, and credit accounts.',
    schemaModel: 'prisma.payment',
    plannedFeatures: [
      'Link multiple payments to an invoice (partial payments)',
      'Transaction reference and bank UTR tracking',
      'Auto-calculation of invoice balance due',
      'Payment receipts generation and email dispatch',
    ],
    mockCardLabel: 'Receivables Status',
    mockStats: [
      { label: 'Monthly Inflow', value: '₹9,85,200' },
      { label: 'Unallocated Receipts', value: '0 pending' },
      { label: 'Direct UPI/Bank', value: '92% volume' },
    ],
  },
  reports: {
    title: 'Sales & GST Tax Reports',
    category: 'Business Intelligence & Compliance',
    icon: BarChart3,
    description:
      'Generate GSTR-1 outward supply summaries, monthly sales trends, and tax liability reports.',
    schemaModel: 'prisma.invoice + items',
    plannedFeatures: [
      'GSTR-1 B2B / B2C invoice schedule extraction',
      'CGST, SGST, and IGST breakup summaries',
      'Monthly sales comparison charts & margin analysis',
      'Export reports directly to Excel and PDF formats',
    ],
    mockCardLabel: 'Reporting Engine Preview',
    mockStats: [
      { label: 'GSTR-1 Status', value: 'Ready to File' },
      { label: 'Tax Output Liability', value: '₹2,24,730' },
      { label: 'Filing Period', value: 'October 2025' },
    ],
  },
  settings: {
    title: 'Business Profile & Tax Settings',
    category: 'Organization Configuration',
    icon: Settings,
    description:
      'Configure legal entity details, trade name, GSTIN, PAN, bank account coordinates, and invoice numbering sequence.',
    schemaModel: 'prisma.businessProfile',
    plannedFeatures: [
      'Company logo and invoice header customizer',
      'Bank coordinates and IFSC details for invoice footer',
      'Automated invoice numbering prefix (e.g. INV-2025-XXXX)',
      'Custom terms & conditions and payment notes',
    ],
    mockCardLabel: 'Profile Coordinates',
    mockStats: [
      { label: 'Company Name', value: 'Viora Tech Solutions' },
      { label: 'GSTIN Registered', value: '29ABCDE1234F1Z5' },
      { label: 'Invoice Prefix', value: 'INV-2025-' },
    ],
  },
};

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  navKey,
  onNavigateToDashboard,
}) => {
  if (navKey === 'dashboard' || navKey === 'invoices') {
    return null;
  }

  const meta = PAGE_DEFINITIONS[navKey];
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex-shrink-0">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                  {meta.category}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Phase 2 Blueprint
                </span>
              </div>
              <h2 className="text-xl font-bold text-navy-900 mt-1 tracking-tight">
                {meta.title}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                {meta.description}
              </p>
            </div>
          </div>

          <div className="flex-shrink-0">
            <button
              onClick={onNavigateToDashboard}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Back to Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Domain stats preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {meta.mockStats.map((stat, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card"
          >
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {stat.label}
            </div>
            <div className="text-lg font-bold text-navy-900 mt-1">{stat.value}</div>
            <div className="text-[10px] text-teal-700 mt-1 flex items-center gap-1">
              <span>●</span> Mock Preview Record
            </div>
          </div>
        ))}
      </div>

      {/* Planned Features & Database Schema Ready Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Planned Features */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-600" />
            Phase 2 Implementation Specifications
          </h3>
          <ul className="space-y-2.5">
            {meta.plannedFeatures.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className="w-5 h-5 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 border border-teal-200">
                  {idx + 1}
                </span>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Database Schema Entity Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-navy-800" />
            Database Model Prepared
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            The PostgreSQL schema has been pre-configured in <code className="text-teal-700 bg-teal-50 px-1 py-0.5 rounded font-mono">server/prisma/schema.prisma</code> ready for this section:
          </p>

          <div className="bg-slate-900 text-slate-200 p-3.5 rounded-lg text-xs font-mono overflow-x-auto">
            <div className="text-teal-400">// Model definition ready for migration:</div>
            <div className="text-yellow-300">model {meta.title.split(' ')[0]} &#123;</div>
            <div className="pl-4 text-slate-300">id String @id @default(uuid())</div>
            <div className="pl-4 text-slate-300">createdAt DateTime @default(now())</div>
            <div className="pl-4 text-slate-300">updatedAt DateTime @updatedAt</div>
            <div className="pl-4 text-slate-400">// Domain fields defined in Phase 1 schema</div>
            <div className="text-yellow-300">&#125;</div>
          </div>

          <div className="mt-3 text-[11px] text-slate-500">
            Target schema model: <span className="font-semibold text-slate-800">{meta.schemaModel}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
