/**
 * GAP 3: Copay Receipt Generation Service
 *
 * Generates bilingual (Arabic + English) receipts for copay payments.
 * UAE VAT compliant with hospital TRN, patient EID, and 5% VAT calculation.
 *
 * Called AFTER collectCopay succeeds. If receipt generation fails,
 * copay collection still completes — receipt is best-effort.
 */
import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

export interface CopayReceiptData {
  receiptNumber: string;
  receiptHtml: string;
  vatAmount: number;
}

class ReceiptService {
  /**
   * Generate a copay receipt after payment collection.
   * Updates the CopayPayment record with receiptNumber and vatAmount.
   */
  async generateCopayReceipt(
    copayPaymentId: string,
    hospitalId: string,
    copayInfo?: {
      consultationFee?: number;
      coveragePercentage?: number;
      copayPercentage?: number;
      insuranceAmount?: number;
      patientAmount?: number;
      cobApplied?: boolean;
      secondaryBreakdown?: any;
    }
  ): Promise<CopayReceiptData> {
    // Fetch payment with related data
    const payment = await prisma.copayPayment.findUnique({
      where: { id: copayPaymentId },
      include: {
        patient: true,
        appointment: {
          include: {
            doctor: true,
          },
        },
      },
    });

    if (!payment) {
      throw new Error(`CopayPayment not found: ${copayPaymentId}`);
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new Error(`Hospital not found: ${hospitalId}`);
    }

    // Generate receipt number: RCP-{hospitalCode}-{YYYYMMDD}-{sequence}
    const receiptNumber = await this.generateReceiptNumber(hospital.code);

    // Calculate VAT (5% UAE standard)
    const paymentAmount = Number(payment.amount);
    // VAT is inclusive in the copay amount (amount = base + VAT)
    // base = amount / 1.05, VAT = amount - base
    const vatRate = 0.05;
    const baseAmount = Math.round((paymentAmount / (1 + vatRate)) * 100) / 100;
    const vatAmount = Math.round((paymentAmount - baseAmount) * 100) / 100;

    // Get hospital settings for TRN
    const trn = (hospital as any).taxRegistrationNo || '';

    // Build fee breakdown from copayInfo or defaults
    const consultationFee = copayInfo?.consultationFee || paymentAmount;
    const coveragePercentage = copayInfo?.coveragePercentage || 0;
    const copayPercentage = copayInfo?.copayPercentage || 100;
    const insuranceAmount = copayInfo?.insuranceAmount || 0;
    const patientAmount = copayInfo?.patientAmount || paymentAmount;

    // Format dates in Gulf Standard Time (UTC+4)
    const paymentDate = new Date(payment.paymentDate);
    const gstDate = new Date(paymentDate.getTime() + 4 * 60 * 60 * 1000);
    const dateStr = gstDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = gstDate.toISOString().split('T')[1].substring(0, 5); // HH:MM

    // QR code data (verification string)
    const qrData = JSON.stringify({
      rcpt: receiptNumber,
      hosp: hospital.code,
      trn: trn,
      amt: paymentAmount,
      vat: vatAmount,
      date: dateStr,
      pid: payment.patientId.substring(0, 8),
    });

    // Doctor info
    const doctorName = payment.appointment?.doctor
      ? `Dr. ${(payment.appointment.doctor as any).firstName || ''} ${(payment.appointment.doctor as any).lastName || ''}`.trim()
      : 'N/A';

    // Generate bilingual HTML receipt
    const receiptHtml = this.buildReceiptHtml({
      receiptNumber,
      hospital: {
        name: hospital.name,
        nameAr: (hospital as any).nameArabic || hospital.name,
        address: hospital.address,
        phone: hospital.phone,
        email: hospital.email,
        trn,
        licenseNumber: hospital.licenseNumber,
      },
      patient: {
        name: `${payment.patient.firstName} ${payment.patient.lastName}`,
        mrn: payment.patient.mrn,
        emiratesId: (payment.patient as any).emiratesId || 'N/A',
        phone: payment.patient.phone || 'N/A',
      },
      appointment: {
        date: dateStr,
        time: timeStr,
        doctor: doctorName,
        type: payment.appointment?.type || 'CONSULTATION',
      },
      insurance: {
        provider: payment.insuranceProvider || null,
        policyNumber: payment.policyNumber || null,
        coveragePercentage,
        copayPercentage,
        cobApplied: copayInfo?.cobApplied || false,
        secondaryProvider: (payment as any).secondaryInsuranceProvider || null,
      },
      fees: {
        consultationFee,
        insuranceAmount,
        patientAmount,
        baseAmount,
        vatAmount,
        vatRate: 5,
        totalWithVat: paymentAmount,
      },
      payment: {
        method: payment.paymentMethod,
        date: dateStr,
        time: timeStr,
      },
      qrData,
    });

    // Update CopayPayment with receipt info
    await prisma.copayPayment.update({
      where: { id: copayPaymentId },
      data: {
        receiptNumber,
        vatAmount: new Decimal(vatAmount),
      },
    });

    return {
      receiptNumber,
      receiptHtml,
      vatAmount,
    };
  }

  /**
   * Generate sequential receipt number: RCP-{hospitalCode}-{YYYYMMDD}-{sequence}
   */
  private async generateReceiptNumber(hospitalCode: string): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    const prefix = `RCP-${hospitalCode}-${dateStr}`;

    // Count existing receipts with this prefix today
    const todayCount = await prisma.copayPayment.count({
      where: {
        receiptNumber: { startsWith: prefix },
      },
    });

    const sequence = String(todayCount + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Build bilingual HTML receipt content
   */
  private buildReceiptHtml(data: {
    receiptNumber: string;
    hospital: {
      name: string;
      nameAr: string;
      address: string;
      phone: string;
      email: string;
      trn: string;
      licenseNumber: string;
    };
    patient: {
      name: string;
      mrn: string;
      emiratesId: string;
      phone: string;
    };
    appointment: {
      date: string;
      time: string;
      doctor: string;
      type: string;
    };
    insurance: {
      provider: string | null;
      policyNumber: string | null;
      coveragePercentage: number;
      copayPercentage: number;
      cobApplied: boolean;
      secondaryProvider: string | null;
    };
    fees: {
      consultationFee: number;
      insuranceAmount: number;
      patientAmount: number;
      baseAmount: number;
      vatAmount: number;
      vatRate: number;
      totalWithVat: number;
    };
    payment: {
      method: string;
      date: string;
      time: string;
    };
    qrData: string;
  }): string {
    const paymentMethodLabel: Record<string, string> = {
      CASH: 'Cash / نقدي',
      CREDIT_CARD: 'Credit Card / بطاقة ائتمان',
      DEBIT_CARD: 'Debit Card / بطاقة خصم',
      DEPOSIT: 'Patient Deposit / وديعة المريض',
      UPI: 'UPI',
    };

    const visitTypeLabel: Record<string, string> = {
      CONSULTATION: 'Consultation / استشارة',
      FOLLOW_UP: 'Follow-Up / متابعة',
      EMERGENCY: 'Emergency / طوارئ',
      TELEMEDICINE: 'Telemedicine / طب عن بعد',
      PROCEDURE: 'Procedure / إجراء',
    };

    return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Copay Receipt / إيصال المشاركة في الدفع - ${data.receiptNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1f2937; background: #fff; }
    .rtl { direction: rtl; text-align: right; font-family: 'Noto Sans Arabic', sans-serif; }
    .header { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
    .header-en { text-align: left; }
    .header-ar { text-align: right; direction: rtl; font-family: 'Noto Sans Arabic', sans-serif; }
    .hospital-name { font-size: 20px; font-weight: 700; color: #1e40af; margin-bottom: 4px; }
    .hospital-details { font-size: 11px; color: #6b7280; line-height: 1.5; }
    .trn-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-top: 6px; }
    .doc-title { display: grid; grid-template-columns: 1fr 1fr; background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; }
    .doc-title h2 { font-size: 16px; font-weight: 700; }
    .doc-title .receipt-no { font-size: 11px; opacity: 0.9; margin-top: 2px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .info-box h3 { font-size: 12px; font-weight: 600; color: #1e40af; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
    .info-label { color: #6b7280; }
    .info-value { font-weight: 500; color: #1f2937; }
    .fee-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .fee-table th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db; }
    .fee-table td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
    .fee-table .text-right { text-align: right; }
    .fee-table .total-row { background: #f0fdf4; font-weight: 700; }
    .fee-table .vat-row { color: #6b7280; font-size: 11px; }
    .payment-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0; }
    .payment-box strong { color: #16a34a; }
    .qr-section { text-align: center; margin: 20px 0; padding: 15px; border: 1px dashed #d1d5db; border-radius: 8px; }
    .qr-section p { font-size: 10px; color: #9ca3af; margin-top: 5px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; line-height: 1.6; }
    .footer .bilingual { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    @media print { body { padding: 10px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <!-- Header: Bilingual Hospital Info -->
  <div class="header">
    <div class="header-en">
      <div class="hospital-name">${data.hospital.name}</div>
      <div class="hospital-details">
        ${data.hospital.address}<br>
        Phone: ${data.hospital.phone} | Email: ${data.hospital.email}<br>
        License: ${data.hospital.licenseNumber}
      </div>
      ${data.hospital.trn ? `<div class="trn-badge">TRN: ${data.hospital.trn}</div>` : ''}
    </div>
    <div class="header-ar">
      <div class="hospital-name">${data.hospital.nameAr}</div>
      <div class="hospital-details" style="font-family: 'Noto Sans Arabic', sans-serif;">
        إيصال المشاركة في الدفع<br>
        الهاتف: ${data.hospital.phone}
      </div>
      ${data.hospital.trn ? `<div class="trn-badge">الرقم الضريبي: ${data.hospital.trn}</div>` : ''}
    </div>
  </div>

  <!-- Document Title -->
  <div class="doc-title">
    <div>
      <h2>COPAY RECEIPT</h2>
      <div class="receipt-no">${data.receiptNumber}</div>
    </div>
    <div style="text-align: right; direction: rtl; font-family: 'Noto Sans Arabic', sans-serif;">
      <h2>إيصال المشاركة</h2>
      <div class="receipt-no">${data.payment.date} | ${data.payment.time}</div>
    </div>
  </div>

  <!-- Patient & Appointment Info -->
  <div class="info-grid">
    <div class="info-box">
      <h3>Patient Information / معلومات المريض</h3>
      <div class="info-row"><span class="info-label">Name:</span><span class="info-value">${data.patient.name}</span></div>
      <div class="info-row"><span class="info-label">MRN:</span><span class="info-value">${data.patient.mrn}</span></div>
      <div class="info-row"><span class="info-label">Emirates ID:</span><span class="info-value">${data.patient.emiratesId}</span></div>
      <div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${data.patient.phone}</span></div>
    </div>
    <div class="info-box">
      <h3>Appointment / الموعد</h3>
      <div class="info-row"><span class="info-label">Date:</span><span class="info-value">${data.appointment.date}</span></div>
      <div class="info-row"><span class="info-label">Time:</span><span class="info-value">${data.appointment.time}</span></div>
      <div class="info-row"><span class="info-label">Doctor:</span><span class="info-value">${data.appointment.doctor}</span></div>
      <div class="info-row"><span class="info-label">Type:</span><span class="info-value">${visitTypeLabel[data.appointment.type] || data.appointment.type}</span></div>
    </div>
  </div>

  <!-- Insurance Info (if applicable) -->
  ${data.insurance.provider ? `
  <div class="info-box" style="margin-bottom: 20px;">
    <h3>Insurance / التأمين</h3>
    <div class="info-grid" style="margin-bottom: 0;">
      <div>
        <div class="info-row"><span class="info-label">Provider:</span><span class="info-value">${data.insurance.provider}</span></div>
        <div class="info-row"><span class="info-label">Policy #:</span><span class="info-value">${data.insurance.policyNumber || 'N/A'}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Coverage:</span><span class="info-value">${data.insurance.coveragePercentage}%</span></div>
        <div class="info-row"><span class="info-label">Copay:</span><span class="info-value">${data.insurance.copayPercentage}%</span></div>
      </div>
    </div>
    ${data.insurance.cobApplied && data.insurance.secondaryProvider ? `
    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
      <div class="info-row"><span class="info-label">Secondary Insurance:</span><span class="info-value">${data.insurance.secondaryProvider}</span></div>
      <div class="info-row"><span class="info-label">COB Applied:</span><span class="info-value" style="color: #16a34a;">Yes</span></div>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <!-- Fee Breakdown -->
  <table class="fee-table">
    <thead>
      <tr>
        <th>Description / الوصف</th>
        <th class="text-right">Amount (AED) / المبلغ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Consultation Fee / رسوم الاستشارة</td>
        <td class="text-right">${data.fees.consultationFee.toFixed(2)}</td>
      </tr>
      ${data.insurance.provider ? `
      <tr>
        <td>Insurance Coverage (${data.insurance.coveragePercentage}%) / تغطية التأمين</td>
        <td class="text-right" style="color: #16a34a;">-${data.fees.insuranceAmount.toFixed(2)}</td>
      </tr>
      ` : ''}
      <tr>
        <td>Patient Copay / المشاركة في الدفع</td>
        <td class="text-right">${data.fees.patientAmount.toFixed(2)}</td>
      </tr>
      <tr class="vat-row">
        <td style="padding-left: 20px;">Amount excl. VAT / المبلغ بدون ضريبة</td>
        <td class="text-right">${data.fees.baseAmount.toFixed(2)}</td>
      </tr>
      <tr class="vat-row">
        <td style="padding-left: 20px;">VAT (${data.fees.vatRate}%) / ضريبة القيمة المضافة</td>
        <td class="text-right">${data.fees.vatAmount.toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td>Total Paid / إجمالي المدفوع</td>
        <td class="text-right">${data.fees.totalWithVat.toFixed(2)} AED</td>
      </tr>
    </tbody>
  </table>

  <!-- Payment Method -->
  <div class="payment-box">
    <strong>Payment Method / طريقة الدفع:</strong> ${paymentMethodLabel[data.payment.method] || data.payment.method}<br>
    <span style="font-size: 11px; color: #6b7280;">Date: ${data.payment.date} at ${data.payment.time} GST</span>
  </div>

  <!-- QR Code Section -->
  <div class="qr-section">
    <div style="font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 5px;">Receipt Verification / التحقق من الإيصال</div>
    <div style="font-family: monospace; font-size: 9px; color: #6b7280; word-break: break-all; max-width: 400px; margin: 0 auto;">${data.qrData}</div>
    <p>Scan QR code or use verification data above to verify this receipt</p>
    <p style="font-family: 'Noto Sans Arabic', sans-serif;">امسح رمز الاستجابة السريعة أو استخدم البيانات أعلاه للتحقق من هذا الإيصال</p>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="bilingual">
      <div>
        <p>Thank you for your payment.</p>
        <p>This is an official copay receipt for your records.</p>
      </div>
      <div class="rtl">
        <p>شكراً لدفعتكم.</p>
        <p>هذا إيصال رسمي للمشاركة في الدفع لسجلاتكم.</p>
      </div>
    </div>
    <p>${data.receiptNumber} | Generated: ${data.payment.date} ${data.payment.time} GST</p>
  </div>
</body>
</html>`;
  }
}

export const receiptService = new ReceiptService();
