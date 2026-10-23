export type NavigationKey =
  | 'dashboard'
  | 'invoices'
  | 'customers'
  | 'products'
  | 'payments'
  | 'reports'
  | 'settings';

export type InvoiceLifecycleStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface BusinessProfile {
  id: string;
  name: string;
  logoUrl?: string | null;
  address: string;
  phone: string;
  email: string;
  gstin?: string | null;
  state?: string | null;
  invoicePrefix: string;
  nextInvoiceNumber: number;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email?: string | null;
  billingAddress: string;
  gstin?: string | null;
  state?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    invoices: number;
  };
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  unit: string;
  unitPrice: number;
  taxRate: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id?: string;
  productId?: string | null;
  descriptionSnapshot: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  grossAmount?: number;
  taxableAmount?: number;
  taxRate?: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  taxAmount?: number;
  lineTotal?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string | null;
  invoiceDate: string;
  dueDate: string;
  status: InvoiceLifecycleStatus;
  placeOfSupply?: string | null;
  isInterState?: boolean;
  subtotal: number;
  discountTotal: number;
  taxableAmount?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  taxTotal: number;
  grandTotal: number;
  paymentStatus: PaymentStatus;
  totalPaid: number;
  balanceRemaining: number;
  notes?: string | null;
  customerNameSnapshot?: string | null;
  customerEmailSnapshot?: string | null;
  customerAddressSnapshot?: string | null;
  customerPhoneSnapshot?: string | null;
  customerGstinSnapshot?: string | null;
  customerStateSnapshot?: string | null;
  businessNameSnapshot?: string | null;
  businessAddressSnapshot?: string | null;
  businessPhoneSnapshot?: string | null;
  businessEmailSnapshot?: string | null;
  businessGstinSnapshot?: string | null;
  businessStateSnapshot?: string | null;
  items?: InvoiceItem[];
  payments?: PaymentRecord[];
  createdAt?: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  customerName?: string;
  amount: number;
  paymentDate: string;
  method: string;
  reference?: string | null;
  requestKey: string;
  createdAt?: string;
}

export interface DashboardSummary {
  isMock: boolean;
  business?: {
    id: string;
    name: string;
  };
  metrics: {
    totalSales: {
      amount: number;
      currency: string;
      label: string;
    };
    totalInvoices: {
      count: number;
      draftCount: number;
      paidCount: number;
      partialCount: number;
      unpaidCount: number;
      label: string;
    };
    amountCollected: {
      amount: number;
      collectionRate: number;
      currency: string;
      label: string;
    };
    outstandingBalance: {
      amount: number;
      currency: string;
      label: string;
    };
  };
  counts: {
    customers: number;
    products: number;
  };
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'offline' | 'checking';
  service?: string;
  version?: string;
  environment?: string;
  database?: {
    status: string;
    message: string;
  };
}
