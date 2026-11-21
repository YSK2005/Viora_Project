export type PortalRole = 'SUPER_ADMIN' | 'CUSTOMER' | 'ADMIN';

export interface PortalConfig {
  portal: PortalRole;
  port: number;
  title: string;
  subtitle: string;
  badge: string;
  headerGradient: string;
  iconBg: string;
  iconColor: string;
  submitButtonText: string;
  demoCredentials: {
    email: string;
    label: string;
    buttonClass: string;
  };
  allowedRoles: string[];
}

export function getActivePortal(): PortalRole {
  if (typeof window === 'undefined') return 'ADMIN';
  const port = window.location.port;
  if (port === '5175') return 'SUPER_ADMIN';
  if (port === '5174') return 'CUSTOMER';
  if (port === '5173') return 'ADMIN';

  // Fallback checks (e.g. query param ?portal=superadmin or pathname)
  const search = new URLSearchParams(window.location.search);
  const portalParam = search.get('portal')?.toUpperCase();
  if (portalParam === 'SUPER_ADMIN' || portalParam === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (portalParam === 'CUSTOMER') return 'CUSTOMER';

  const pathname = window.location.pathname.toLowerCase();
  if (pathname.startsWith('/superadmin')) return 'SUPER_ADMIN';
  if (pathname.startsWith('/customer')) return 'CUSTOMER';

  return 'ADMIN';
}

export function getPortalConfig(portal: PortalRole = getActivePortal()): PortalConfig {
  switch (portal) {
    case 'SUPER_ADMIN':
      return {
        portal: 'SUPER_ADMIN',
        port: 5175,
        title: 'Super Admin Sign In',
        subtitle: 'Master platform controls, system settings & Razorpay gateway keys',
        badge: '👑 Super Admin Control (Port 5175)',
        headerGradient: 'from-slate-900 via-indigo-950 to-slate-900',
        iconBg: 'bg-indigo-500/20 border border-indigo-400/30',
        iconColor: 'text-indigo-400',
        submitButtonText: 'Sign In to Super Admin',
        demoCredentials: {
          email: 'superadmin@viora.test',
          label: '👑 Super Admin Quick-Fill',
          buttonClass: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200',
        },
        allowedRoles: ['SUPER_ADMIN'],
      };
    case 'CUSTOMER':
      return {
        portal: 'CUSTOMER',
        port: 5174,
        title: 'Customer Portal Sign In',
        subtitle: 'Manage your software subscription license, plans & payment receipts',
        badge: '👤 SaaS Customer Portal (Port 5174)',
        headerGradient: 'from-blue-700 via-indigo-800 to-slate-900',
        iconBg: 'bg-blue-500/20 border border-blue-400/30',
        iconColor: 'text-blue-300',
        submitButtonText: 'Sign In to Customer Portal',
        demoCredentials: {
          email: 'customer@viora.test',
          label: '👤 Customer Quick-Fill',
          buttonClass: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
        },
        allowedRoles: ['CUSTOMER', 'SUPER_ADMIN'],
      };
    case 'ADMIN':
    default:
      return {
        portal: 'ADMIN',
        port: 5173,
        title: 'Sign in to Billing Suite',
        subtitle: 'Generate tax invoices, manage clients, and track payments',
        badge: '🏢 Billing Admin Suite (Port 5173)',
        headerGradient: 'from-teal-700 to-slate-900',
        iconBg: 'bg-teal-500/20 border border-teal-400/30',
        iconColor: 'text-teal-300',
        submitButtonText: 'Sign In to Billing Workspace',
        demoCredentials: {
          email: 'admin@viora.test',
          label: '🏢 Billing Admin Quick-Fill',
          buttonClass: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200',
        },
        allowedRoles: ['OWNER', 'ACCOUNTANT', 'VIEWER', 'SUPER_ADMIN'],
      };
  }
}
