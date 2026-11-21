import {
  Invoice,
  SystemHealth,
  DashboardSummary,
  Customer,
  Product,
  PaymentRecord,
  BusinessProfile,
  User,
  UserRole,
  BusinessMembership,
  PaginationMeta,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

// -------------------------------------------------------------
// Auth & Session Management
// -------------------------------------------------------------
// Remove tokens left by earlier versions. Sessions now use HttpOnly cookies only.
try { localStorage.removeItem('viora_auth_token'); } catch { /* Storage may be disabled. */ }

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers || {});

  headers.set('X-Viora-Client', 'web');

  const controller = new AbortController();
  const cancel = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) cancel();
  init.signal?.addEventListener('abort', cancel, {once:true});
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {...init, headers, credentials:'include', signal:controller.signal});
    if (response.status >= 500 || response.status === 429) window.dispatchEvent(new CustomEvent('viora:network', {detail:response.status===429 ? 'Too many requests. Please wait before retrying.' : 'Server unavailable. Your changes may not have completed.'}));
    return response;
  } catch (error) {
    if (!init.signal?.aborted) window.dispatchEvent(new CustomEvent('viora:network', {detail:controller.signal.aborted ? 'Request timed out. Check your records before retrying a payment or invoice.' : 'Connection lost. Check your connection and retry.'}));
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort',cancel);
  }
}

export interface AuthResponse {
  user: User;
  business: BusinessProfile;
  role: UserRole;
  memberships: BusinessMembership[];
}

export async function registerUser(data: {
  email: string;
  password: string;
  name: string;
  businessName?: string;
}): Promise<AuthResponse> {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error?.message || 'Registration failed');
  }

  return json.data;
}

export async function loginUser(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error?.message || 'Invalid email or password');
  }

  return json.data;
}

export async function logoutUser(): Promise<void> {
  const res = await apiFetch('/auth/logout', { method: 'POST' });
  if (!res.ok) throw new Error('Sign out failed. Please try again.');
}

export async function fetchCurrentUser(): Promise<{
  user: User;
  business: BusinessProfile;
  role: UserRole;
  memberships: BusinessMembership[];
} | null> {
  try {
    const res = await apiFetch('/auth/me');
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function switchBusiness(businessId: string): Promise<any> {
  const res = await apiFetch('/auth/switch-business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error?.message || 'Failed to switch business');
  }
  return res.json();
}

export async function addBusinessMember(data: {
  email: string;
  role: UserRole;
  name?: string;
}): Promise<any> {
  const res = await apiFetch('/auth/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error?.message || 'Failed to add member');
  }
  return res.json();
}

// -------------------------------------------------------------
// System Health
// -------------------------------------------------------------
export async function fetchHealth(): Promise<SystemHealth> {
  try {
    const res = await apiFetch('/health', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { status: 'unhealthy' };
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

// -------------------------------------------------------------
// Dashboard & Reports API
// -------------------------------------------------------------
export async function fetchDashboardSummary(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<DashboardSummary | null> {
  try {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);

    const queryString = query.toString();
    const url = queryString ? `/dashboard/summary?${queryString}` : '/dashboard/summary';
    const res = await apiFetch(url);
    if (!res.ok) throw new Error('Failed to load dashboard summary');
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.warn('Dashboard summary fetch failed:', err);
    return null;
  }
}

export async function fetchSalesReport(params?: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'month';
}): Promise<any> {
  const query = new URLSearchParams();
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);
  if (params?.groupBy) query.append('groupBy', params.groupBy);

  const res = await apiFetch(`/reports/sales?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load sales report');
  const json = await res.json();
  return json.data;
}

// -------------------------------------------------------------
// Invoices API
// -------------------------------------------------------------
export async function fetchInvoices(params?: {
  status?: string;
  paymentStatus?: string;
  search?: string;
  customerId?: string;
  customerName?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
}): Promise<{ invoices: Invoice[]; totalCount: number; isBackendConnected: boolean; pagination?: PaginationMeta }> {
  try {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.paymentStatus && params.paymentStatus !== 'ALL') query.append('paymentStatus', params.paymentStatus);
    if (params?.search) query.append('search', params.search);
    if (params?.customerId) query.append('customerId', params.customerId);
    if (params?.customerName) query.append('customerName', params.customerName);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.page) query.append('page', String(params.page));

    const res = await apiFetch(`/invoices?${query.toString()}`);
    if (!res.ok) throw new Error('API response not ok');
    const json = await res.json();
    return {
      invoices: json.data?.invoices || [],
      totalCount: json.data?.pagination?.totalCount || 0,
      pagination: json.data?.pagination,
      isBackendConnected: true,
    };
  } catch (err) {
    console.warn('Invoices fetch failed', err);
    return {
      invoices: [],
      totalCount: 0,
      isBackendConnected: false,
    };
  }
}

export async function fetchInvoiceDetails(id: string): Promise<Invoice> {
  const res = await apiFetch(`/invoices/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function createInvoice(data: {
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  placeOfSupply?: string;
  isInterState?: boolean;
  notes?: string;
  items: Array<{
    productId?: string | null;
    descriptionSnapshot: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxRate?: number;
  }>;
}): Promise<Invoice> {
  const res = await apiFetch('/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function updateInvoice(
  id: string,
  data: {
    customerId: string;
    invoiceDate: string;
    dueDate: string;
    placeOfSupply?: string;
    isInterState?: boolean;
    notes?: string;
    items: Array<{
      productId?: string | null;
      descriptionSnapshot: string;
      unit?: string;
      quantity: number;
      unitPrice: number;
      discountAmount?: number;
      taxRate?: number;
    }>;
  }
): Promise<Invoice> {
  const res = await apiFetch(`/invoices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update invoice');
  }
  const json = await res.json();
  return json.data;
}

export const updateDraftInvoice = updateInvoice;

export async function issueInvoice(id: string): Promise<Invoice> {
  const res = await apiFetch(`/invoices/${id}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to issue invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function cancelInvoice(id: string): Promise<Invoice> {
  const res = await apiFetch(`/invoices/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to cancel invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function deleteDraftInvoice(id: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`/invoices/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete draft invoice');
  }
  return res.json();
}

export async function recordPayment(
  invoiceId: string,
  data: {
    amount: number;
    paymentDate?: string;
    method?: string;
    reference?: string;
    requestKey: string;
  }
): Promise<any> {
  const res = await apiFetch(`/invoices/${invoiceId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to record payment');
  }
  const json = await res.json();
  return json.data;
}

export const recordInvoicePayment = recordPayment;

export async function downloadInvoicePdf(id: string, invoiceNumber?: string): Promise<void> {
  const res = await apiFetch(`/invoices/${id}/pdf`, {
    headers: { Accept: 'application/pdf' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to download PDF');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice_${invoiceNumber || id}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// -------------------------------------------------------------
// Customers API
// -------------------------------------------------------------
export async function fetchCustomers(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ customers: Customer[]; totalCount: number; pagination?: PaginationMeta }> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  const res = await apiFetch(`/customers?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch customers');
  const json = await res.json();
  return {
    customers: json.data?.customers || [],
    totalCount: json.data?.pagination?.totalCount || 0,
    pagination: json.data?.pagination,
  };
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
  billingAddress: string;
  gstin?: string;
  state?: string;
}): Promise<Customer> {
  const res = await apiFetch('/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create customer');
  }
  const json = await res.json();
  return json.data;
}

export async function updateCustomer(
  id: string,
  data: Partial<{
    name: string;
    phone: string;
    email?: string;
    billingAddress: string;
    gstin?: string;
    state?: string;
  }>
): Promise<Customer> {
  const res = await apiFetch(`/customers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update customer');
  }
  const json = await res.json();
  return json.data;
}

export async function deleteCustomer(id: string): Promise<any> {
  const res = await apiFetch(`/customers/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete customer');
  }
  return res.json();
}

// -------------------------------------------------------------
// Products API
// -------------------------------------------------------------
export async function fetchProducts(params?: {
  search?: string;
  page?: number;
  limit?: number;
  isActive?: string;
}): Promise<{ products: Product[]; totalCount: number; pagination?: PaginationMeta }> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.isActive) query.append('isActive', params.isActive);

  const res = await apiFetch(`/products?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch products');
  const json = await res.json();
  return {
    products: json.data?.products || [],
    totalCount: json.data?.pagination?.totalCount || 0,
    pagination: json.data?.pagination,
  };
}

export async function createProduct(data: {
  name: string;
  description?: string;
  unit?: string;
  unitPrice: number;
  taxRate?: number;
  isActive?: boolean;
}): Promise<Product> {
  const res = await apiFetch('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create product');
  }
  const json = await res.json();
  return json.data;
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    unit: string;
    unitPrice: number;
    taxRate: number;
    isActive: boolean;
  }>
): Promise<Product> {
  const res = await apiFetch(`/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update product');
  }
  const json = await res.json();
  return json.data;
}

export async function deleteProduct(id: string): Promise<any> {
  const res = await apiFetch(`/products/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete product');
  }
  return res.json();
}

// -------------------------------------------------------------
// Payments API
// -------------------------------------------------------------
export async function fetchPayments(params?: {
  invoiceId?: string;
  customerId?: string;
  search?: string;
  method?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ payments: PaymentRecord[]; totalCount: number; pagination?: PaginationMeta }> {
  const query = new URLSearchParams();
  if (params?.invoiceId) query.append('invoiceId', params.invoiceId);
  if (params?.customerId) query.append('customerId', params.customerId);
  if (params?.search) query.append('search', params.search);
  if (params?.method && params.method !== 'ALL') query.append('method', params.method);
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  const res = await apiFetch(`/payments?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch payments');
  const json = await res.json();
  return {
    payments: json.data?.payments || [],
    totalCount: json.data?.pagination?.totalCount || 0,
    pagination: json.data?.pagination,
  };
}

export async function reversePayment(paymentId: string, reason: string): Promise<PaymentRecord> {
  const res = await apiFetch(`/payments/${paymentId}/reverse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to reverse payment');
  }
  const json = await res.json();
  return json.data;
}

// -------------------------------------------------------------
// Business Profile API
// -------------------------------------------------------------
export async function fetchBusiness(): Promise<BusinessProfile> {
  const res = await apiFetch('/business');
  if (!res.ok) throw new Error('Failed to fetch business details');
  const json = await res.json();
  return json.data;
}

export async function updateBusiness(data: Partial<BusinessProfile>): Promise<BusinessProfile> {
  const res = await apiFetch('/business', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update business');
  }
  const json = await res.json();
  return json.data;
}

// -------------------------------------------------------------
// Recurring Invoices API
// -------------------------------------------------------------
export interface RecurringSchedule {
  id: string;
  businessId: string;
  invoiceId: string;
  customerName: string;
  invoiceNumber: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  billingDay?: number;
  nextRunDate: string;
  lastRunAt?: string;
  status: 'ACTIVE' | 'PAUSED';
  grandTotal: number;
  itemsCount: number;
  createdAt: string;
}

export async function fetchRecurringSchedules(): Promise<RecurringSchedule[]> {
  const res = await apiFetch('/recurring');
  if (!res.ok) throw new Error('Failed to fetch recurring schedules');
  const json = await res.json();
  return json.data?.schedules || [];
}

export async function createRecurringSchedule(data: {
  invoiceId: string;
  frequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  startDate?: string;
}): Promise<RecurringSchedule> {
  const res = await apiFetch('/recurring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Failed to create recurring profile');
  }
  const json = await res.json();
  return json.data?.schedule;
}

export async function triggerRecurringSchedule(id: string): Promise<{ invoice: any; schedule: RecurringSchedule }> {
  const res = await apiFetch(`/recurring/${id}/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Failed to generate recurring invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function toggleRecurringSchedule(id: string): Promise<RecurringSchedule> {
  const res = await apiFetch(`/recurring/${id}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Failed to toggle recurring schedule');
  }
  const json = await res.json();
  return json.data?.schedule;
}

export async function deleteRecurringSchedule(id: string): Promise<void> {
  const res = await apiFetch(`/recurring/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || 'Failed to delete recurring schedule');
  }
}

