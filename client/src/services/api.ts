import { Invoice, SystemHealth } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Fallback mock data if server isn't reached
export const FALLBACK_MOCK_INVOICES: Invoice[] = [
  {
    id: 'mock-inv-001',
    invoiceNumber: 'INV-2025-001',
    customerName: 'Acme Technologies Pvt Ltd',
    customerEmail: 'billing@acmetech.in',
    issueDate: '2025-10-15',
    dueDate: '2025-10-30',
    amount: 145000,
    status: 'PAID',
    currency: 'INR',
    isMock: true,
  },
  {
    id: 'mock-inv-002',
    invoiceNumber: 'INV-2025-002',
    customerName: 'NexGen Digital Solutions',
    customerEmail: 'accounts@nexgendigital.com',
    issueDate: '2025-10-18',
    dueDate: '2025-11-02',
    amount: 88500,
    status: 'PENDING',
    currency: 'INR',
    isMock: true,
  },
  {
    id: 'mock-inv-003',
    invoiceNumber: 'INV-2025-003',
    customerName: 'Horizon Global Logistics',
    customerEmail: 'finance@horizonglobal.com',
    issueDate: '2025-09-28',
    dueDate: '2025-10-12',
    amount: 215000,
    status: 'OVERDUE',
    currency: 'INR',
    isMock: true,
  },
  {
    id: 'mock-inv-004',
    invoiceNumber: 'INV-2025-004',
    customerName: 'Zenith Retail Corporation',
    customerEmail: 'payables@zenithretail.in',
    issueDate: '2025-10-20',
    dueDate: '2025-11-05',
    amount: 54000,
    status: 'PAID',
    currency: 'INR',
    isMock: true,
  },
  {
    id: 'mock-inv-005',
    invoiceNumber: 'INV-2025-005',
    customerName: 'BlueSky Cloud Services',
    customerEmail: 'admin@blueskycloud.io',
    issueDate: '2025-10-22',
    dueDate: '2025-11-06',
    amount: 120500,
    status: 'PENDING',
    currency: 'INR',
    isMock: true,
  },
  {
    id: 'mock-inv-006',
    invoiceNumber: 'INV-2025-006',
    customerName: 'Vertex AI Innovations',
    customerEmail: 'billing@vertexai.co',
    issueDate: '2025-10-23',
    dueDate: '2025-11-07',
    amount: 72000,
    status: 'DRAFT',
    currency: 'INR',
    isMock: true,
  },
];

export async function fetchHealth(): Promise<SystemHealth> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      return { status: 'unhealthy' };
    }
    const json = await res.json();
    return {
      status: json.data?.status === 'healthy' ? 'healthy' : 'unhealthy',
      service: json.data?.service,
      version: json.data?.version,
      environment: json.data?.environment,
      database: json.data?.database,
    };
  } catch {
    return { status: 'offline' };
  }
}

export async function fetchInvoices(): Promise<{ invoices: Invoice[]; isBackendConnected: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/v1/invoices`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error('API response not ok');
    const json = await res.json();
    return {
      invoices: json.data?.invoices || FALLBACK_MOCK_INVOICES,
      isBackendConnected: true,
    };
  } catch {
    // Graceful fallback to client mock records
    return {
      invoices: FALLBACK_MOCK_INVOICES,
      isBackendConnected: false,
    };
  }
}
