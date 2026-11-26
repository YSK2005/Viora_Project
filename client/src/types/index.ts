export type NavigationKey =
  | 'dashboard'
  | 'invoices'
  | 'customers'
  | 'products'
  | 'payments'
  | 'reports'
  | 'settings'
  | 'credits'
  | 'statements'
  | 'recurring'
  | 'superadmin'
  | 'customer_portal'
  | 'pricing'
  | 'payment_success'
  | 'payment_failed';

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ACCOUNTANT' | 'VIEWER' | 'CUSTOMER';

export type PortalScope = 'CUSTOMER' | 'SUPER_ADMIN' | 'ADMIN' | 'API_LEGACY';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
}

export interface BusinessMembership {
  businessId: string;
  businessName: string;
  role: UserRole;
}

export interface PaginationMeta {
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

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
  allowAdminBilling?: boolean;
  ownerUserId?: string | null;
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
  creditedTotal?: number;
  refundDue?: number;
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
  isReversed?: boolean;
  reversedAt?: string | null;
  reversedReason?: string | null;
  reversedByUserId?: string | null;
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

export type SubscriptionStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'CANCELLED';
export type BillingCycle = 'MONTHLY' | 'YEARLY';

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  invoiceLimit: number;
  businessLimit: number;
  features: string[];
  isActive: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  businessId?: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  amountPaid: number;
  currency: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  receiptNumber: string;
  superAdminAccessCode?: string | null;
  superAdminCodeIssuedAt?: string | null;
  cancelledAt?: string;
  createdAt: string;
  business?: {
    id: string;
    name: string;
    allowAdminBilling: boolean;
    _count?: {
      products: number;
      adminAccessCodes: number;
      invoices: number;
    };
  };
}

export interface AdminAccessCode {
  id: string;
  businessId: string;
  code: string;
  label: string;
  assignedEmail?: string | null;
  role: UserRole;
  canGenerateBills: boolean;
  isActive: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface SuperAdminOverview {
  business: BusinessProfile;
  subscription: {
    id: string;
    planName: string;
    invoiceLimit: number;
    status: string;
    billingCycle: string;
    validUntil: string;
  } | null;
  stats: {
    activeProductsCount: number;
    totalProductsCount: number;
    activeAdminCodesCount: number;
    totalInvoicesCount: number;
    issuedInvoicesCount: number;
    totalBilledRevenue: number;
  };
  setupChecklist: {
    hasActiveSubscription: boolean;
    hasActiveProducts: boolean;
    hasActiveAdminCode: boolean;
    isAdminBillingAllowed: boolean;
  };
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    status: string;
    grandTotal: number;
    invoiceDate: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    details?: any;
    createdAt: string;
    user?: { name: string; email: string } | null;
  }>;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface PlatformStats {
  totalTenants: number;
  totalUsers: number;
  activeSubscriptionsCount: number;
  totalRevenue: number;
  totalInvoices: number;
  totalPayments: number;
  recentTenants: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    invoicesCount: number;
    customersCount: number;
    createdAt: string;
  }>;
}

export interface TenantItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gstin?: string;
  state?: string;
  invoicesCount: number;
  customersCount: number;
  productsCount: number;
  owners: Array<{ name: string; email: string }>;
  createdAt: string;
}

export interface SuperAdminUserItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  businesses: string[];
  activePlan: string;
  createdAt: string;
}

export interface PaymentReceiptData {
  receiptNumber: string;
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  planName: string;
  billingCycle: string;
  validUntil: string;
  superAdminAccessCode?: string | null;
  boundEmail?: string | null;
}

