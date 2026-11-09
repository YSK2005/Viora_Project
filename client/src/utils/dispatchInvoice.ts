import { Invoice, BusinessProfile, Customer } from '../types';

export interface DispatchUrls {
  whatsAppUrl: string | null;
  gmailUrl: string | null;
  mailtoUrl: string | null;
  customerPhone10: string | null;
  customerEmail: string | null;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatHumanDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [y, m, d] = clean.split('-');
  if (!y || !m || !d) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(m, 10) - 1;
  return `${parseInt(d, 10)} ${months[monthIdx] || m} ${y}`;
}

export function getInvoiceDispatchUrls(
  invoice: Invoice,
  customer?: Partial<Customer> | null,
  business?: Partial<BusinessProfile> | null
): DispatchUrls {
  const businessName =
    invoice.businessNameSnapshot || business?.name || 'Our Company';
  const businessPhone =
    invoice.businessPhoneSnapshot || business?.phone || '';
  const businessEmail =
    invoice.businessEmailSnapshot || business?.email || '';
  const businessAddress =
    invoice.businessAddressSnapshot || business?.address || '';

  const custName =
    invoice.customerNameSnapshot || invoice.customerName || customer?.name || 'Valued Customer';
  const custRawPhone =
    invoice.customerPhoneSnapshot || customer?.phone || '';
  const custEmail =
    invoice.customerEmailSnapshot || customer?.email || '';

  // Extract exactly 10 digits
  const digits = custRawPhone.replace(/\D/g, '');
  const customerPhone10 =
    digits.length >= 10 ? digits.slice(-10) : digits.length > 0 ? digits : null;

  // Format line items for text preview
  const itemsText = (invoice.items || [])
    .map(
      (it, idx) =>
        `${idx + 1}. ${it.descriptionSnapshot || 'Item'} - Qty: ${it.quantity} @ ${formatINR(Number(it.unitPrice))} = ${formatINR(Number(it.lineTotal))}`
    )
    .join('\n');

  // 1. Compose WhatsApp Message
  let whatsAppUrl: string | null = null;
  if (customerPhone10 && customerPhone10.length === 10) {
    const waText = `*TAX INVOICE FROM ${businessName.toUpperCase()}*

Dear ${custName},

Your invoice *#${invoice.invoiceNumber}* has been officially issued.

📄 *Invoice Details:*
• *Invoice Number:* ${invoice.invoiceNumber}
• *Invoice Date:* ${formatHumanDate(invoice.invoiceDate)}
• *Due Date:* ${formatHumanDate(invoice.dueDate)}
• *Total Amount:* ${formatINR(Number(invoice.grandTotal))}
• *Payment Status:* ${invoice.paymentStatus || 'UNPAID'}

${itemsText ? `📦 *Items:*\n${itemsText}\n` : ''}
${invoice.notes ? `📝 *Notes:* ${invoice.notes}\n` : ''}
For queries or payment coordination, please reply here or contact us:
📞 Phone/WhatsApp: ${businessPhone}
✉️ Email: ${businessEmail}

Thank you for choosing *${businessName}*!`;

    whatsAppUrl = `https://api.whatsapp.com/send?phone=91${customerPhone10}&text=${encodeURIComponent(
      waText
    )}`;
  }

  // 2. Compose Gmail / Email Message
  let gmailUrl: string | null = null;
  let mailtoUrl: string | null = null;
  const cleanEmail = custEmail ? custEmail.trim() : null;

  if (cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    const subject = `Tax Invoice #${invoice.invoiceNumber} from ${businessName}`;
    const emailBody = `Dear ${custName},

Thank you for your business. Please find below the details for Tax Invoice #${invoice.invoiceNumber}.

--------------------------------------------------
INVOICE SUMMARY
--------------------------------------------------
Invoice Number : ${invoice.invoiceNumber}
Invoice Date   : ${formatHumanDate(invoice.invoiceDate)}
Due Date       : ${formatHumanDate(invoice.dueDate)}
Grand Total    : ${formatINR(Number(invoice.grandTotal))}
Payment Status : ${invoice.paymentStatus || 'UNPAID'}
--------------------------------------------------

ITEMIZED BREAKDOWN:
${itemsText || 'Details as per invoice document.'}

${invoice.notes ? `\nNotes / Payment Terms:\n${invoice.notes}\n` : ''}
Please remit payment on or before ${invoice.dueDate}.

Best regards,
${businessName}
Contact: ${businessPhone} | ${businessEmail}
${businessAddress}
`;

    // Gmail Web Direct Compose
    gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      cleanEmail
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

    // System Mailto Fallback
    mailtoUrl = `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(emailBody)}`;
  }

  return {
    whatsAppUrl,
    gmailUrl,
    mailtoUrl,
    customerPhone10,
    customerEmail: cleanEmail,
  };
}

export function openWhatsAppDispatch(
  invoice: Invoice,
  customer?: Partial<Customer> | null,
  business?: Partial<BusinessProfile> | null
): boolean {
  const { whatsAppUrl } = getInvoiceDispatchUrls(invoice, customer, business);
  if (whatsAppUrl) {
    window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}

export function openGmailDispatch(
  invoice: Invoice,
  customer?: Partial<Customer> | null,
  business?: Partial<BusinessProfile> | null
): boolean {
  const { gmailUrl, mailtoUrl } = getInvoiceDispatchUrls(invoice, customer, business);
  if (gmailUrl) {
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    return true;
  }
  if (mailtoUrl) {
    window.location.href = mailtoUrl;
    return true;
  }
  return false;
}
