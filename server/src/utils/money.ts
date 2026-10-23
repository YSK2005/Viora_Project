import { Prisma } from '../generated/prisma-client';

export type DecimalLike = Prisma.Decimal | number | string;

export function toDecimal(val: DecimalLike): Prisma.Decimal {
  if (val instanceof Prisma.Decimal) return val;
  return new Prisma.Decimal(val || 0);
}

export function round2(dec: Prisma.Decimal): Prisma.Decimal {
  return dec.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export interface CalculatedLineItem {
  productId?: string | null;
  descriptionSnapshot: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export interface CalculatedInvoiceTotals {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  items: CalculatedLineItem[];
}

export function calculateLineItem(input: {
  productId?: string | null;
  descriptionSnapshot: string;
  quantity: DecimalLike;
  unitPrice: DecimalLike;
  discountAmount?: DecimalLike;
  taxRate?: DecimalLike;
}): CalculatedLineItem {
  const qty = round2(toDecimal(input.quantity));
  const price = round2(toDecimal(input.unitPrice));
  const discount = round2(toDecimal(input.discountAmount ?? 0));
  const taxRate = toDecimal(input.taxRate ?? 0);

  if (qty.lessThanOrEqualTo(0)) {
    throw new Error('Quantity must be greater than zero');
  }
  if (price.isNegative()) {
    throw new Error('Unit price cannot be negative');
  }
  if (discount.isNegative()) {
    throw new Error('Discount amount cannot be negative');
  }
  if (taxRate.isNegative() || taxRate.greaterThan(100)) {
    throw new Error('Tax rate must be between 0% and 100%');
  }

  const lineBase = round2(qty.times(price));
  if (discount.greaterThan(lineBase)) {
    throw new Error(`Discount amount (${discount.toString()}) cannot exceed item base total (${lineBase.toString()})`);
  }

  const taxableAmount = round2(lineBase.minus(discount));
  const taxAmount = round2(taxableAmount.times(taxRate.dividedBy(100)));
  const lineTotal = round2(taxableAmount.plus(taxAmount));

  return {
    productId: input.productId || null,
    descriptionSnapshot: input.descriptionSnapshot.trim(),
    quantity: qty,
    unitPrice: price,
    discountAmount: discount,
    taxRate,
    taxableAmount,
    taxAmount,
    lineTotal,
  };
}

export function calculateInvoiceTotals(itemsInput: Array<{
  productId?: string | null;
  descriptionSnapshot: string;
  quantity: DecimalLike;
  unitPrice: DecimalLike;
  discountAmount?: DecimalLike;
  taxRate?: DecimalLike;
}>): CalculatedInvoiceTotals {
  if (!itemsInput || itemsInput.length === 0) {
    throw new Error('Invoice must contain at least one item');
  }

  const calculatedItems = itemsInput.map(calculateLineItem);

  let subtotal = new Prisma.Decimal(0);
  let discountTotal = new Prisma.Decimal(0);
  let taxTotal = new Prisma.Decimal(0);
  let grandTotal = new Prisma.Decimal(0);

  for (const item of calculatedItems) {
    const lineBase = round2(item.quantity.times(item.unitPrice));
    subtotal = subtotal.plus(lineBase);
    discountTotal = discountTotal.plus(item.discountAmount);
    taxTotal = taxTotal.plus(item.taxAmount);
    grandTotal = grandTotal.plus(item.lineTotal);
  }

  return {
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    taxTotal: round2(taxTotal),
    grandTotal: round2(grandTotal),
    items: calculatedItems,
  };
}

export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export function derivePaymentStatus(
  grandTotal: DecimalLike,
  payments: Array<{ amount: DecimalLike }>
): {
  paymentStatus: PaymentStatus;
  totalPaid: Prisma.Decimal;
  balanceRemaining: Prisma.Decimal;
} {
  const total = round2(toDecimal(grandTotal));
  let totalPaid = new Prisma.Decimal(0);

  for (const p of payments) {
    totalPaid = totalPaid.plus(toDecimal(p.amount));
  }
  totalPaid = round2(totalPaid);

  const balance = round2(total.minus(totalPaid));
  const balanceRemaining = balance.isNegative() ? new Prisma.Decimal(0) : balance;

  let paymentStatus: PaymentStatus = 'UNPAID';
  if (totalPaid.greaterThanOrEqualTo(total) && total.greaterThan(0)) {
    paymentStatus = 'PAID';
  } else if (totalPaid.greaterThan(0)) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  return {
    paymentStatus,
    totalPaid,
    balanceRemaining,
  };
}
