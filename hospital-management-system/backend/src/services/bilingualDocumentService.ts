/**
 * Bilingual Document Service
 * Generates DHA-compliant Arabic + English receipts and invoices
 * 
 * UAE Requirements:
 * - Arabic text RTL aligned
 * - English text LTR aligned
 * - VAT 5% breakdown with TRN
 * - Insurance copay details
 * - Hospital info in both languages
 */

import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';

// Arabic translations for common terms
const AR_TRANSLATIONS: Record<string, string> = {
  // Document headers
  'Payment Receipt': 'إيصال الدفع',
  'Tax Invoice': 'فاتورة ضريبية',
  'Invoice': 'فاتورة',
  
  // Hospital info
  'Hospital': 'مستشفى',
  'Clinic': 'عيادة',
  'Medical Center': 'مركز طبي',
  'Phone': 'هاتف',
  'Email': 'البريد الإلكتروني',
  'Address': 'العنوان',
  'TRN': 'رقم التسجيل الضريبي',
  
  // Receipt/Invoice info
  'Receipt Number': 'رقم الإيصال',
  'Invoice Number': 'رقم الفاتورة',
  'Date': 'التاريخ',
  'Time': 'الوقت',
  
  // Patient info
  'Patient Information': 'معلومات المريض',
  'Patient Name': 'اسم المريض',
  'MRN': 'رقم الملف الطبي',
  'Emirates ID': 'رقم الهوية الإماراتية',
  'Phone Number': 'رقم الهاتف',
  'Nationality': 'الجنسية',
  
  // Insurance info
  'Insurance Information': 'معلومات التأمين',
  'Insurance Provider': 'شركة التأمين',
  'Policy Number': 'رقم البوليصة',
  'Member ID': 'رقم العضوية',
  'Network': 'الشبكة',
  'In-Network': 'داخل الشبكة',
  'Out-of-Network': 'خارج الشبكة',
  
  // Service/Item details
  'Description': 'الوصف',
  'Service': 'الخدمة',
  'Category': 'الفئة',
  'Quantity': 'الكمية',
  'Unit Price': 'سعر الوحدة',
  'Total': 'المجموع',
  
  // Categories
  'Consultation': 'استشارة',
  'Laboratory': 'مختبر',
  'Radiology': 'أشعة',
  'Pharmacy': 'صيدلية',
  'Procedure': 'إجراء',
  'Room Charges': 'رسوم الغرفة',
  'Nursing': 'تمريض',
  'Emergency': 'طوارئ',
  
  // Amount breakdown
  'Subtotal': 'المجموع الفرعي',
  'Discount': 'الخصم',
  'VAT (5%)': 'ضريبة القيمة المضافة (5%)',
  'VAT Exempt': 'معفى من الضريبة',
  'Total Amount': 'المبلغ الإجمالي',
  'Insurance Coverage': 'تغطية التأمين',
  'Patient Copay': 'مساهمة المريض',
  'Amount Paid': 'المبلغ المدفوع',
  'Balance Due': 'الرصيد المستحق',
  'Paid': 'مدفوع',
  
  // Payment info
  'Payment Method': 'طريقة الدفع',
  'Cash': 'نقداً',
  'Card': 'بطاقة',
  'Bank Transfer': 'تحويل بنكي',
  'Insurance': 'تأمين',
  'Reference Number': 'الرقم المرجعي',
  
  // Footer
  'Thank you for your payment': 'شكراً لدفعكم',
  'This is an official receipt': 'هذا إيصال رسمي',
  'For inquiries': 'للاستفسارات',
  'Generated on': 'تم الإنشاء في',
};

// Translate English to Arabic
function translate(text: string): string {
  return AR_TRANSLATIONS[text] || text;
}

// Format currency with AED
function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `AED ${num.toFixed(2)}`;
}

// Format date in both languages
function formatDate(date: Date): { en: string; ar: string } {
  return {
    en: date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    ar: date.toLocaleDateString('ar-AE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}

interface HospitalSettings {
  nameAr?: string;
  addressAr?: string;
  vatTrn?: string;
  logoUrl?: string;
}

async function getHospitalSettings(hospitalId: string): Promise<HospitalSettings> {
  const settings = await prisma.hospitalSetting.findMany({
    where: {
      hospitalId,
      category: { in: ['GENERAL', 'BILLING', 'VAT'] },
    },
  });

  const result: HospitalSettings = {};
  
  for (const setting of settings) {
    try {
      const value = typeof setting.value === 'string' 
        ? JSON.parse(setting.value) 
        : setting.value;
      
      if (setting.key === 'hospital_name_ar') result.nameAr = value;
      if (setting.key === 'hospital_address_ar') result.addressAr = value;
      if (setting.key === 'vat_trn') result.vatTrn = value;
      if (setting.key === 'logo_url') result.logoUrl = value;
    } catch {
      // Use value as-is if not JSON
      if (setting.key === 'hospital_name_ar') result.nameAr = String(setting.value);
      if (setting.key === 'hospital_address_ar') result.addressAr = String(setting.value);
      if (setting.key === 'vat_trn') result.vatTrn = String(setting.value);
    }
  }

  return result;
}

export class BilingualDocumentService {
  
  /**
   * Generate bilingual (Arabic + English) payment receipt
   * DHA compliant format for UAE healthcare
   */
  async generateBilingualReceipt(paymentId: string, hospitalId: string): Promise<string> {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            patient: true,
            items: true,
            hospital: true,
            insuranceClaims: true,
          },
        },
      },
    });

    if (!payment || payment.invoice.hospitalId !== hospitalId) {
      throw new NotFoundError('Payment not found');
    }

    const invoice = payment.invoice;
    const patient = invoice.patient;
    const hospital = invoice.hospital;
    const settings = await getHospitalSettings(hospitalId);
    
    const receiptNumber = `RCP-${payment.id.substring(0, 8).toUpperCase()}`;
    const paymentDate = formatDate(payment.paymentDate);
    const generatedDate = formatDate(new Date());

    // Calculate VAT breakdown
    const subtotal = Number(invoice.subtotal);
    const vatAmount = Number(invoice.tax) || 0;
    const discount = Number(invoice.discount) || 0;
    const totalAmount = Number(invoice.totalAmount);
    const amountPaid = Number(payment.amount);
    const balanceDue = Number(invoice.balanceAmount);

    // Insurance info
    const insuranceClaim = invoice.insuranceClaims?.[0];
    const insuranceCoverage = insuranceClaim ? Number(insuranceClaim.approvedAmount || insuranceClaim.claimedAmount || 0) : 0;
    const patientCopay = totalAmount - insuranceCoverage;

    const html = `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt / إيصال الدفع - ${receiptNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #1f2937;
      background: #fff;
    }
    
    .rtl { direction: rtl; text-align: right; font-family: 'Noto Sans Arabic', sans-serif; }
    .ltr { direction: ltr; text-align: left; }
    
    /* Header */
    .header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      border-bottom: 3px solid #1e40af;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    
    .header-en { text-align: left; }
    .header-ar { text-align: right; direction: rtl; font-family: 'Noto Sans Arabic', sans-serif; }
    
    .hospital-name {
      font-size: 22px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 5px;
    }
    
    .hospital-details {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.6;
    }
    
    .trn-badge {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 8px;
    }
    
    /* Document Title */
    .doc-title {
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 25px;
    }
    
    .doc-title h1 {
      font-size: 20px;
      font-weight: 700;
    }
    
    .doc-title-ar h1 {
      font-family: 'Noto Sans Arabic', sans-serif;
      text-align: right;
      direction: rtl;
    }
    
    /* Info Sections */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 25px;
      margin-bottom: 25px;
    }
    
    .info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
    }
    
    .info-box h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .info-box-ar h3 {
      font-family: 'Noto Sans Arabic', sans-serif;
      text-align: right;
      direction: rtl;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 13px;
    }
    
    .info-row-ar {
      direction: rtl;
      font-family: 'Noto Sans Arabic', sans-serif;
    }
    
    .info-label { color: #64748b; }
    .info-value { font-weight: 600; color: #1f2937; }
    
    /* Items Table */
    .items-section { margin-bottom: 25px; }
    
    .items-header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin-bottom: 10px;
    }
    
    .items-header h3 {
      font-size: 14px;
      color: #374151;
    }
    
    .items-header-ar { text-align: right; font-family: 'Noto Sans Arabic', sans-serif; }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    
    table th {
      background: #f1f5f9;
      padding: 10px 8px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    
    table th.ar {
      text-align: right;
      font-family: 'Noto Sans Arabic', sans-serif;
    }
    
    table td {
      padding: 10px 8px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    
    table td.ar {
      text-align: right;
      font-family: 'Noto Sans Arabic', sans-serif;
      color: #6b7280;
      font-size: 11px;
    }
    
    .text-right { text-align: right; }
    
    /* Amount Section */
    .amount-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 25px;
    }
    
    .amount-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }
    
    .amount-col-ar {
      direction: rtl;
      font-family: 'Noto Sans Arabic', sans-serif;
    }
    
    .amount-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
    }
    
    .amount-row.total {
      border-top: 2px solid #e2e8f0;
      margin-top: 10px;
      padding-top: 10px;
      font-size: 16px;
      font-weight: 700;
    }
    
    .amount-row.paid {
      color: #059669;
      font-weight: 600;
    }
    
    .amount-row.due {
      color: #dc2626;
      font-weight: 600;
    }
    
    /* Insurance Box */
    .insurance-box {
      background: #ecfdf5;
      border: 1px solid #6ee7b7;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 25px;
    }
    
    .insurance-header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin-bottom: 10px;
    }
    
    .insurance-header h3 {
      font-size: 13px;
      color: #047857;
    }
    
    .insurance-header-ar {
      text-align: right;
      font-family: 'Noto Sans Arabic', sans-serif;
    }
    
    /* Payment Method */
    .payment-box {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      padding: 15px;
      margin-bottom: 25px;
    }
    
    .payment-box-ar {
      border-left: none;
      border-right: 4px solid #22c55e;
      text-align: right;
      font-family: 'Noto Sans Arabic', sans-serif;
    }
    
    /* Footer */
    .footer {
      border-top: 2px solid #e2e8f0;
      padding-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      font-size: 11px;
      color: #64748b;
    }
    
    .footer-ar {
      text-align: right;
      direction: rtl;
      font-family: 'Noto Sans Arabic', sans-serif;
    }
    
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <!-- Hospital Header -->
  <div class="header">
    <div class="header-en">
      <div class="hospital-name">${hospital.name}</div>
      <div class="hospital-details">
        ${hospital.address || ''}<br>
        Phone: ${hospital.phone || 'N/A'}<br>
        Email: ${hospital.email || 'N/A'}
      </div>
      ${settings.vatTrn ? `<div class="trn-badge">TRN: ${settings.vatTrn}</div>` : ''}
    </div>
    <div class="header-ar">
      <div class="hospital-name">${settings.nameAr || hospital.name}</div>
      <div class="hospital-details">
        ${settings.addressAr || hospital.address || ''}<br>
        ${translate('Phone')}: ${hospital.phone || 'N/A'}<br>
        ${translate('Email')}: ${hospital.email || 'N/A'}
      </div>
      ${settings.vatTrn ? `<div class="trn-badge">${translate('TRN')}: ${settings.vatTrn}</div>` : ''}
    </div>
  </div>

  <!-- Document Title -->
  <div class="doc-title">
    <div class="doc-title-en">
      <h1>Payment Receipt</h1>
    </div>
    <div class="doc-title-ar">
      <h1>${translate('Payment Receipt')}</h1>
    </div>
  </div>

  <!-- Receipt & Patient Info -->
  <div class="info-grid">
    <div class="info-box">
      <h3>Receipt Information</h3>
      <div class="info-row">
        <span class="info-label">Receipt No:</span>
        <span class="info-value">${receiptNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Date:</span>
        <span class="info-value">${paymentDate.en}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Invoice No:</span>
        <span class="info-value">${invoice.invoiceNumber}</span>
      </div>
    </div>
    <div class="info-box info-box-ar">
      <h3>${translate('Patient Information')}</h3>
      <div class="info-row info-row-ar">
        <span class="info-value">${patient.firstNameAr || ''} ${patient.lastNameAr || ''}</span>
        <span class="info-label">${translate('Patient Name')}:</span>
      </div>
      <div class="info-row info-row-ar">
        <span class="info-value">${patient.firstName} ${patient.lastName}</span>
        <span class="info-label">Name:</span>
      </div>
      <div class="info-row info-row-ar">
        <span class="info-value">${patient.mrn}</span>
        <span class="info-label">${translate('MRN')}:</span>
      </div>
      <div class="info-row info-row-ar">
        <span class="info-value">${patient.emiratesId || 'N/A'}</span>
        <span class="info-label">${translate('Emirates ID')}:</span>
      </div>
    </div>
  </div>

  <!-- Insurance Info (if applicable) -->
  ${insuranceClaim ? `
  <div class="insurance-box">
    <div class="insurance-header">
      <h3>🛡️ Insurance Coverage</h3>
      <h3 class="insurance-header-ar">${translate('Insurance Coverage')} 🛡️</h3>
    </div>
    <div class="info-grid" style="margin-bottom: 0;">
      <div>
        <div class="info-row">
          <span class="info-label">Provider:</span>
          <span class="info-value">${insuranceClaim.insuranceProvider}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Claim No:</span>
          <span class="info-value">${insuranceClaim.claimNumber}</span>
        </div>
      </div>
      <div style="text-align: right; font-family: 'Noto Sans Arabic', sans-serif;">
        <div class="info-row info-row-ar">
          <span class="info-value">${formatCurrency(insuranceCoverage)}</span>
          <span class="info-label">${translate('Insurance Coverage')}:</span>
        </div>
        <div class="info-row info-row-ar">
          <span class="info-value">${formatCurrency(patientCopay)}</span>
          <span class="info-label">${translate('Patient Copay')}:</span>
        </div>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- Items Table -->
  <div class="items-section">
    <div class="items-header">
      <h3>Invoice Items</h3>
      <h3 class="items-header-ar">بنود الفاتورة</h3>
    </div>
    <table>
      <thead>
        <tr>
          <th>Description / الوصف</th>
          <th>Category / الفئة</th>
          <th class="text-right">Qty / الكمية</th>
          <th class="text-right">Unit Price / السعر</th>
          <th class="text-right">Total / المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items.map((item: any) => `
        <tr>
          <td>
            ${item.description}
            ${item.descriptionAr ? `<br><span class="ar" style="direction: rtl; display: block;">${item.descriptionAr}</span>` : ''}
          </td>
          <td>
            ${item.category}
            <br><span class="ar">${translate(item.category) || item.category}</span>
          </td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.unitPrice)}</td>
          <td class="text-right">${formatCurrency(item.totalPrice)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- Amount Breakdown -->
  <div class="amount-section">
    <div class="amount-grid">
      <div>
        <div class="amount-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        ${discount > 0 ? `
        <div class="amount-row">
          <span>Discount:</span>
          <span>-${formatCurrency(discount)}</span>
        </div>
        ` : ''}
        ${vatAmount > 0 ? `
        <div class="amount-row">
          <span>VAT (5%):</span>
          <span>${formatCurrency(vatAmount)}</span>
        </div>
        ` : ''}
        <div class="amount-row total">
          <span>Total Amount:</span>
          <span>${formatCurrency(totalAmount)}</span>
        </div>
        <div class="amount-row paid">
          <span>✓ Amount Paid:</span>
          <span>${formatCurrency(amountPaid)}</span>
        </div>
        ${balanceDue > 0 ? `
        <div class="amount-row due">
          <span>Balance Due:</span>
          <span>${formatCurrency(balanceDue)}</span>
        </div>
        ` : ''}
      </div>
      <div class="amount-col-ar">
        <div class="amount-row">
          <span>${formatCurrency(subtotal)}</span>
          <span>${translate('Subtotal')}:</span>
        </div>
        ${discount > 0 ? `
        <div class="amount-row">
          <span>-${formatCurrency(discount)}</span>
          <span>${translate('Discount')}:</span>
        </div>
        ` : ''}
        ${vatAmount > 0 ? `
        <div class="amount-row">
          <span>${formatCurrency(vatAmount)}</span>
          <span>${translate('VAT (5%)')}:</span>
        </div>
        ` : ''}
        <div class="amount-row total">
          <span>${formatCurrency(totalAmount)}</span>
          <span>${translate('Total Amount')}:</span>
        </div>
        <div class="amount-row paid">
          <span>${formatCurrency(amountPaid)}</span>
          <span>✓ ${translate('Amount Paid')}:</span>
        </div>
        ${balanceDue > 0 ? `
        <div class="amount-row due">
          <span>${formatCurrency(balanceDue)}</span>
          <span>${translate('Balance Due')}:</span>
        </div>
        ` : ''}
      </div>
    </div>
  </div>

  <!-- Payment Method -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
    <div class="payment-box">
      <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
      ${payment.referenceNumber ? `<p><strong>Reference:</strong> ${payment.referenceNumber}</p>` : ''}
    </div>
    <div class="payment-box payment-box-ar">
      <p><strong>${translate('Payment Method')}:</strong> ${translate(payment.paymentMethod) || payment.paymentMethod}</p>
      ${payment.referenceNumber ? `<p><strong>${translate('Reference Number')}:</strong> ${payment.referenceNumber}</p>` : ''}
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>
      <p><strong>Thank you for your payment!</strong></p>
      <p>This is an official receipt for your records.</p>
      <p>Generated: ${generatedDate.en}</p>
    </div>
    <div class="footer-ar">
      <p><strong>${translate('Thank you for your payment')}!</strong></p>
      <p>${translate('This is an official receipt')}</p>
      <p>${translate('Generated on')}: ${generatedDate.ar}</p>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate bilingual tax invoice
   */
  async generateBilingualInvoice(invoiceId: string, hospitalId: string): Promise<string> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
      include: {
        patient: true,
        items: true,
        hospital: true,
        insuranceClaims: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const patient = invoice.patient;
    const hospital = invoice.hospital;
    const settings = await getHospitalSettings(hospitalId);
    
    const invoiceDate = formatDate(invoice.createdAt);
    const dueDate = formatDate(new Date(invoice.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000));

    // Calculate amounts
    const subtotal = Number(invoice.subtotal);
    const vatAmount = Number(invoice.tax) || 0;
    const discount = Number(invoice.discount) || 0;
    const totalAmount = Number(invoice.totalAmount);
    const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balanceDue = Number(invoice.balanceAmount);

    // Similar template structure as receipt but for invoices
    // ... (shortened for brevity - same bilingual layout)
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice / فاتورة ضريبية - ${invoice.invoiceNumber}</title>
  <style>
    /* Same styles as receipt with invoice-specific adjustments */
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .rtl { direction: rtl; text-align: right; font-family: 'Noto Sans Arabic', sans-serif; }
    .header { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 20px; }
    .hospital-name { font-size: 20px; font-weight: bold; color: #1e40af; }
    .trn { background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 11px; display: inline-block; margin-top: 8px; }
    .title { background: #1e40af; color: white; padding: 15px; border-radius: 8px; display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 20px; }
    .title h1 { font-size: 18px; margin: 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f1f5f9; padding: 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #eee; }
    .amounts { background: #f8fafc; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="hospital-name">${hospital.name}</div>
      <div>${hospital.address || ''}</div>
      ${settings.vatTrn ? `<div class="trn">TRN: ${settings.vatTrn}</div>` : ''}
    </div>
    <div class="rtl">
      <div class="hospital-name">${settings.nameAr || hospital.name}</div>
      <div>${settings.addressAr || ''}</div>
      ${settings.vatTrn ? `<div class="trn">${translate('TRN')}: ${settings.vatTrn}</div>` : ''}
    </div>
  </div>
  
  <div class="title">
    <h1>TAX INVOICE</h1>
    <h1 class="rtl">${translate('Tax Invoice')}</h1>
  </div>
  
  <!-- Invoice details, items table, amounts - similar to receipt -->
  <p>Invoice #: ${invoice.invoiceNumber} | Date: ${invoiceDate.en} | التاريخ: ${invoiceDate.ar}</p>
  <p>Patient: ${patient.firstName} ${patient.lastName} | المريض: ${patient.firstNameAr || ''} ${patient.lastNameAr || ''}</p>
  
  <table>
    <tr><th>Description / الوصف</th><th>Qty</th><th>Price</th><th>VAT</th><th>Total</th></tr>
    ${invoice.items.map((item: any) => `
    <tr>
      <td>${item.description}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.unitPrice)}</td>
      <td>${item.vatExempt ? 'Exempt' : '5%'}</td>
      <td>${formatCurrency(item.totalPrice)}</td>
    </tr>
    `).join('')}
  </table>
  
  <div class="amounts">
    <p>Subtotal / المجموع الفرعي: ${formatCurrency(subtotal)}</p>
    <p>VAT (5%) / ض.ق.م: ${formatCurrency(vatAmount)}</p>
    <p><strong>Total / المجموع: ${formatCurrency(totalAmount)}</strong></p>
    <p>Paid / المدفوع: ${formatCurrency(totalPaid)}</p>
    <p>Balance / المستحق: ${formatCurrency(balanceDue)}</p>
  </div>
</body>
</html>`;
  }
}

export const bilingualDocumentService = new BilingualDocumentService();
