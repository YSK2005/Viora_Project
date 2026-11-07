import { prisma } from '../src/config/prisma';

async function resetDatabase() {
  console.log('🧹 Starting database cleanup & reset...');

  // 1. Delete transactions in dependency order
  const delPayments = await prisma.payment.deleteMany();
  console.log(`Deleted ${delPayments.count} payment records.`);

  const delItems = await prisma.invoiceItem.deleteMany();
  console.log(`Deleted ${delItems.count} invoice line items.`);

  const delInvoices = await prisma.invoice.deleteMany();
  console.log(`Deleted ${delInvoices.count} invoices.`);

  // 2. Delete catalog and client directory
  const delCustomers = await prisma.customer.deleteMany();
  console.log(`Deleted ${delCustomers.count} customers.`);

  const delProducts = await prisma.product.deleteMany();
  console.log(`Deleted ${delProducts.count} products.`);

  // 3. Reset Business nextInvoiceNumber counter
  const business = await prisma.business.findFirst();
  if (business) {
    await prisma.business.update({
      where: { id: business.id },
      data: { nextInvoiceNumber: 1001 },
    });
    console.log(`Reset business "${business.name}" nextInvoiceNumber to 1001.`);
  }

  console.log('✨ Complete reset successful! Database is now clean.');
}

resetDatabase()
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
