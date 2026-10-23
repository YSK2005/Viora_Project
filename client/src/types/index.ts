export type NavigationKey =
  | 'dashboard'
  | 'invoices'
  | 'customers'
  | 'products'
  | 'payments'
  | 'reports'
  | 'settings';

export interface NavItemConfig {
  key: NavigationKey;
  label: string;
  badge?: string;
}

export type InvoiceStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'DRAFT';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
  currency: string;
  isMock?: boolean;
}

export interface MetricCardData {
  title: string;
  value: string;
  subtext: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  accentColor: 'teal' | 'navy' | 'emerald' | 'amber';
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
