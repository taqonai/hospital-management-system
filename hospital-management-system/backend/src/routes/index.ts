import { Router } from 'express';
import authRoutes from './authRoutes';
import patientRoutes from './patientRoutes';
import appointmentRoutes from './appointmentRoutes';
import doctorRoutes from './doctorRoutes';
import slotRoutes from './slotRoutes';
import departmentRoutes from './departmentRoutes';
import aiRoutes from './aiRoutes';
import aiScribeRoutes from './aiScribeRoutes';
import laboratoryRoutes from './laboratoryRoutes';
import pharmacyRoutes from './pharmacyRoutes';
import ipdRoutes from './ipdRoutes';
import opdRoutes from './opdRoutes';
import emergencyRoutes from './emergencyRoutes';
import radiologyRoutes from './radiologyRoutes';
import surgeryRoutes from './surgeryRoutes';
import billingRoutes from './billingRoutes';
import publicRoutes from './publicRoutes';
import hrRoutes from './hrRoutes';
import housekeepingRoutes from './housekeepingRoutes';
// New module routes
import bloodBankRoutes from './bloodBankRoutes';
import medicalRecordsRoutes from './medicalRecordsRoutes';
import dietaryRoutes from './dietaryRoutes';
import assetRoutes from './assetRoutes';
import ambulanceRoutes from './ambulanceRoutes';
import cssdRoutes from './cssdRoutes';
import mortuaryRoutes from './mortuaryRoutes';
import telemedicineRoutes from './telemedicineRoutes';
import qualityRoutes from './qualityRoutes';
import reportsRoutes from './reportsRoutes';
import queueRoutes from './queueRoutes';
import kioskRoutes from './kioskRoutes';
import symptomCheckerRoutes from './symptomCheckerRoutes';
// Clinical Safety & AI modules
import earlyWarningRoutes from './earlyWarningRoutes';
import medSafetyRoutes from './medSafetyRoutes';
import smartOrderRoutes from './smartOrderRoutes';
import patientPortalRoutes from './patientPortalRoutes';
import aiConsultationRoutes from './aiConsultationRoutes';
import advancedPharmacyAIRoutes from './advancedPharmacyAIRoutes';
import pdfRoutes from './pdfRoutes';
import rbacRoutes from './rbacRoutes';
import patientAuthRoutes from './patientAuthRoutes';
import notificationRoutes from './notificationRoutes';
import wellnessRoutes from './wellnessRoutes';
import aiSettingsRoutes from './aiSettingsRoutes';
import insuranceCodingRoutes from './insuranceCodingRoutes';
// A'mad Precision Health Platform routes
import healthPlatformRoutes from './healthPlatformRoutes';
import genomicRoutes from './genomicRoutes';
import recommendationRoutes from './recommendationRoutes';
import clinicianRoutes from './clinicianRoutes';
import nutritionAiRoutes from './nutritionAiRoutes';
import crmRoutes from './crmRoutes';
import noShowRoutes from './noShowRoutes';
import referralRoutes from './referralRoutes';
import whatsappBotRoutes from './whatsappBotRoutes';
import procurementRoutes from './procurementRoutes';
import nurseRoutes from './nurseRoutes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Public routes (no authentication required)
router.use('/public', publicRoutes);
router.use('/kiosk', kioskRoutes);
router.use('/patient-auth', patientAuthRoutes);
router.use('/whatsapp-bot', whatsappBotRoutes);

// API routes (authentication required)
router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/doctors', doctorRoutes);
router.use('/slots', slotRoutes);
router.use('/departments', departmentRoutes);
router.use('/ai', aiRoutes);
router.use('/ai-scribe', aiScribeRoutes);
router.use('/laboratory', laboratoryRoutes);
router.use('/pharmacy', pharmacyRoutes);
router.use('/ipd', ipdRoutes);
router.use('/opd', opdRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/radiology', radiologyRoutes);
router.use('/surgery', surgeryRoutes);
router.use('/billing', billingRoutes);
router.use('/hr', hrRoutes);
router.use('/housekeeping', housekeepingRoutes);
// New module routes
router.use('/blood-bank', bloodBankRoutes);
router.use('/medical-records', medicalRecordsRoutes);
router.use('/dietary', dietaryRoutes);
router.use('/assets', assetRoutes);
router.use('/ambulance', ambulanceRoutes);
router.use('/cssd', cssdRoutes);
router.use('/mortuary', mortuaryRoutes);
router.use('/telemedicine', telemedicineRoutes);
router.use('/quality', qualityRoutes);
router.use('/reports', reportsRoutes);
router.use('/queue', queueRoutes);

// Symptom Checker (public access with optional auth)
router.use('/symptom-checker', symptomCheckerRoutes);

// Clinical Safety & AI modules
router.use('/early-warning', earlyWarningRoutes);
router.use('/med-safety', medSafetyRoutes);
router.use('/smart-orders', smartOrderRoutes);
router.use('/patient-portal', patientPortalRoutes);
router.use('/ai-consultation', aiConsultationRoutes);
router.use('/advanced-pharmacy-ai', advancedPharmacyAIRoutes);
router.use('/pdf', pdfRoutes);

// RBAC (Role-Based Access Control) routes
router.use('/rbac', rbacRoutes);

// Notification routes
router.use('/notifications', notificationRoutes);

// Wellness & Health Sync routes (Patient Portal)
router.use('/wellness', wellnessRoutes);

// AI Settings routes (Admin only)
router.use('/ai-settings', aiSettingsRoutes);

// Insurance Coding (ICD-10 / CPT) routes
router.use('/insurance-coding', insuranceCodingRoutes);

// A'mad Precision Health Platform routes
router.use('/health', healthPlatformRoutes);
router.use('/genomics', genomicRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/clinician', clinicianRoutes);
router.use('/nutrition-ai', nutritionAiRoutes);

// CRM Module
router.use('/crm', crmRoutes);

// NO_SHOW Management
router.use('/no-show', noShowRoutes);

// Consultant Referrals
router.use('/referrals', referralRoutes);

// Procurement Module
router.use('/procurement', procurementRoutes);

// Nursing Module
router.use('/nursing', nurseRoutes);

export default router;
