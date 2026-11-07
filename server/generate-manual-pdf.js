const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outputPath1 = 'C:\\Users\\ASUS\\Downloads\\Viora_Bills_User_Manual.pdf';
const outputPath2 = 'C:\\Users\\ASUS\\Downloads\\Viora_Project\\Viora_Bills_User_Manual.pdf';
const outputPath3 = 'C:\\Users\\ASUS\\Downloads\\Viora_Project\\Viora_Project\\Viora_Bills_User_Manual.pdf';

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 40, bottom: 40, left: 45, right: 45 },
  bufferPages: true
});

const writeStream1 = fs.createWriteStream(outputPath1);
doc.pipe(writeStream1);

// Colors
const PRIMARY = '#581C87'; // Deep purple
const ACCENT = '#7E22CE';  // Bright purple
const TEXT = '#1E293B';    // Slate 800
const MUTED = '#64748B';   // Slate 500
const BG_CARD = '#F8FAFC'; // Light background
const BORDER = '#E2E8F0';  // Light border
const SUCCESS = '#059669'; // Green

function header(title, subtitle) {
  doc.rect(45, doc.y, 505, 3).fill(ACCENT);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(PRIMARY).text(title);
  if (subtitle) {
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(subtitle);
  }
  doc.moveDown(0.6);
}

function subheader(title) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor(ACCENT).text(title);
  doc.moveDown(0.2);
}

function paragraph(text) {
  doc.font('Helvetica').fontSize(9.5).fillColor(TEXT).text(text, { lineGap: 2.5 });
  doc.moveDown(0.4);
}

function callout(title, text, type = 'info') {
  const boxTop = doc.y;
  const boxHeight = 44;
  doc.rect(45, boxTop, 505, boxHeight).fillAndStroke('#F5F3FF', '#DDD6FE');
  doc.rect(45, boxTop, 4, boxHeight).fill('#7C3AED');
  
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#6D28D9').text(title, 56, boxTop + 8);
  doc.font('Helvetica').fontSize(8.5).fillColor('#4C1D95').text(text, 56, boxTop + 22, { width: 480 });
  doc.y = boxTop + boxHeight + 8;
}

function codeBlock(code) {
  const lines = code.split('\n');
  const height = lines.length * 12 + 14;
  const boxTop = doc.y;
  
  doc.rect(45, boxTop, 505, height).fillAndStroke('#0F172A', '#334155');
  doc.font('Courier').fontSize(8.5).fillColor('#38BDF8');
  let currentY = boxTop + 7;
  lines.forEach(line => {
    doc.text(line, 55, currentY);
    currentY += 12;
  });
  doc.y = boxTop + height + 8;
}

function stepItem(number, title, desc) {
  const y = doc.y;
  doc.circle(55, y + 6, 8).fill(ACCENT);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF').text(number.toString(), 52, y + 2);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT).text(title, 70, y);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(desc, 70, doc.y + 2, { width: 475, lineGap: 1.5 });
  doc.moveDown(0.5);
}

// ================= PAGE 1: COVER & QUICK START =================
// Top Banner
doc.rect(45, 40, 505, 95).fill(PRIMARY);
doc.font('Helvetica-Bold').fontSize(24).fillColor('#FFFFFF').text('VIORA BILLS', 65, 58);
doc.font('Helvetica-Bold').fontSize(13).fillColor('#E9D5FF').text('Complete User & Operations Manual', 65, 86);
doc.font('Helvetica').fontSize(9).fillColor('#D8B4FE').text('Comprehensive Guide from Installation to GST Billing & Automated Dispatch', 65, 105);

doc.y = 150;

header('1. Executive Overview & System Architecture', 'Enterprise-grade billing application designed for Indian GST compliance');
paragraph('Viora Bills is a full-stack, web-based invoice management platform engineered specifically for Indian businesses. Built with TypeScript, React 18, Vite, Node.js, Express, and PostgreSQL with Prisma ORM, it provides precision GST calculations, immutable historical snapshots, automated sequential invoicing, PDF exports, and instant customer dispatch via WhatsApp and Gmail.');

callout('LATEST UPDATE — VERSION 1.1', 'Includes direct WhatsApp API & Gmail dispatch integration, 10-digit customer mobile validation, mandatory company credentials guardrail, and modern purple UI theme.');

header('2. Prerequisites & System Requirements');
doc.font('Helvetica-Bold').fontSize(9.5).fillColor(TEXT).text('• Node.js: ', { continued: true }).font('Helvetica').text('v18.0.0 or higher (v20+ recommended)');
doc.font('Helvetica-Bold').fontSize(9.5).fillColor(TEXT).text('• npm: ', { continued: true }).font('Helvetica').text('v9.0.0 or higher (packaged with Node.js)');
doc.font('Helvetica-Bold').fontSize(9.5).fillColor(TEXT).text('• PostgreSQL: ', { continued: true }).font('Helvetica').text('v14.0 or higher (port 5432 or 5433)');
doc.font('Helvetica-Bold').fontSize(9.5).fillColor(TEXT).text('• Supported Browsers: ', { continued: true }).font('Helvetica').text('Chrome, Edge, Firefox, Brave, Safari');
doc.moveDown(0.8);

header('3. Download & Setup Guide', 'Two methods to get the codebase onto your local environment');

subheader('Option A: If Downloaded as ZIP from GitHub');
paragraph('When downloading as a ZIP, dependencies and environment files are not included. Follow these 3 setup steps:');
codeBlock('cd Viora_Project-main\\Viora_Project-main\nnpm install\ncp server/.env.example server/.env\nnpm run dev');

subheader('Option B: If Cloning via Git');
codeBlock('git clone https://github.com/YSK2005/Viora_Project.git\ncd Viora_Project\nnpm install\ncp server/.env.example server/.env\nnpm run dev');

// ================= PAGE 2 =================
doc.addPage();

header('4. Environment & Database Configuration', 'Prisma Schema & PostgreSQL Connection');
paragraph('Ensure your server/.env file contains your PostgreSQL database credentials:');
codeBlock('PORT=5000\nNODE_ENV=development\nCLIENT_URL=http://localhost:5173\nDATABASE_URL="postgresql://postgres:your_password@127.0.0.1:5433/viora_bills?schema=public"');

paragraph('Initialize the database schema and sample data:');
codeBlock('npx prisma migrate dev --name init --schema=server/prisma/schema.prisma\nnpm run prisma:seed --workspace=server');

header('5. Step-by-Step Feature Usage Workflow', 'End-to-end lifecycle from settings to payments');

stepItem(1, 'Business Settings (Mandatory Setup)', 'Navigate to Settings. Enter your Business Name, 15-digit GSTIN, Address, State, Company Phone/WhatsApp, and Official Gmail. Note: The system will block invoice issuance until company phone and Gmail are saved.');

stepItem(2, 'Customer Onboarding', 'Go to Customers -> click "+ New Customer". Enter the customer name, state, and contact details. Phone must be exactly 10 digits (system prefixes +91 automatically). At least one contact method (phone or email) is strictly required.');

stepItem(3, 'Product & Service Catalog', 'Go to Products -> click "+ New Product". Specify the product name, optional HSN/SAC code, measurement unit (PCS, HRS, KG, MTR, BOX, SET), base unit price, and standard GST rate (0%, 5%, 12%, 18%, 28%).');

stepItem(4, 'Create & Issue Invoices', 'Go to Invoices -> click "+ Create Invoice". Choose your customer. Select Place of Supply (automatic CGST+SGST for intra-state, or IGST for inter-state). Add items and optional discounts. Click "Issue Invoice" to transition from DRAFT to immutable ISSUED status with sequential number (INV-YYYY-XXXXXX).');

stepItem(5, 'Automated WhatsApp & Gmail Dispatch', 'Upon issuance, the Dispatch Modal opens automatically. Click "Send via WhatsApp" to open WhatsApp web/app with pre-filled invoice breakdown and payment details. Click "Send via Gmail" to launch Google Mail with full invoice summary pre-filled.');

stepItem(6, 'Payment Tracking & PDF Downloads', 'Record partial or full payments (Cash, UPI, Bank Transfer, Cheque) against any issued invoice. Status transitions automatically (UNPAID -> PARTIALLY_PAID -> PAID). Click "Preview / PDF" to stream or print clean A4 documents.');

// ================= PAGE 3 =================
doc.addPage();

header('6. Troubleshooting & Diagnostics Reference', 'Quick solutions for common setup and operational questions');

const tableTop = doc.y;
const colX = [45, 170, 310, 550];

// Table Header
doc.rect(45, tableTop, 505, 20).fill('#EDE9FE');
doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PRIMARY);
doc.text('Issue / Error', 52, tableTop + 5);
doc.text('Root Cause', 178, tableTop + 5);
doc.text('Recommended Fix', 318, tableTop + 5);

const rows = [
  {
    issue: "'concurrently' is not recognized",
    cause: "Running npm run dev before npm install",
    solution: "Run 'npm install' in the project root first"
  },
  {
    issue: "ERR_COMPANY_CONTACT_MANDATORY",
    cause: "Settings lack company phone or Gmail",
    solution: "Open Settings and enter company WhatsApp & Gmail"
  },
  {
    issue: "P1001: Can't reach database",
    cause: "PostgreSQL service is not running or wrong port",
    solution: "Start PostgreSQL service and verify port in server/.env"
  },
  {
    issue: "Customer phone validation failed",
    cause: "Phone number is not exactly 10 digits",
    solution: "Enter 10-digit mobile number without +91 or dashes"
  },
  {
    issue: "Prisma client not found",
    cause: "Prisma schema not generated",
    solution: "Run 'npm run prisma:generate --workspace=server'"
  }
];

let currentY = tableTop + 20;
rows.forEach((r, idx) => {
  const rowHeight = 28;
  if (idx % 2 === 1) {
    doc.rect(45, currentY, 505, rowHeight).fill('#F8FAFC');
  }
  doc.rect(45, currentY, 505, rowHeight).stroke('#E2E8F0');
  
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT).text(r.issue, 52, currentY + 7, { width: 115 });
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(r.cause, 178, currentY + 7, { width: 125 });
  doc.font('Helvetica').fontSize(8).fillColor(TEXT).text(r.solution, 318, currentY + 7, { width: 220 });
  
  currentY += rowHeight;
});

doc.y = currentY + 15;

header('7. Verification & Production Commands');
doc.font('Helvetica').fontSize(9).fillColor(TEXT);
doc.text('Run these commands anytime to ensure the health of your installation:');
doc.moveDown(0.3);
codeBlock('# Run TypeScript compiler checks across frontend & backend\nnpm run type-check\n\n# Run the 36-scenario backend automated verification suite\nnpm run test:backend\n\n# Compile production bundles\nnpm run build');

doc.moveDown(0.5);
callout('ONLINE REPOSITORY', 'Official repository, issues, and continuous updates:\nhttps://github.com/YSK2005/Viora_Project', 'success');

// Footer for all pages
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.rect(45, 800, 505, 0.5).fill(BORDER);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    `Viora Bills Documentation  •  Page ${i + 1} of ${range.count}`,
    45, 808, { align: 'center', width: 505 }
  );
}

doc.end();

writeStream1.on('finish', () => {
  console.log('PDF 1 written to:', outputPath1);
  // Also copy to output 2 and 3
  try {
    fs.copyFileSync(outputPath1, outputPath2);
    console.log('PDF 2 written to:', outputPath2);
    fs.copyFileSync(outputPath1, outputPath3);
    console.log('PDF 3 written to:', outputPath3);
  } catch (e) {
    console.error('Copy error:', e);
  }
});
