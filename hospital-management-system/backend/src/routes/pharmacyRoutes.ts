import { Router, Response } from 'express';
import multer from 'multer';
import { pharmacyService } from '../services/pharmacyService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

const router = Router();

// ==================== Drug Management ====================

// Get all drugs
router.get(
  '/drugs',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search, category, isActive } = req.query;
    const drugs = await pharmacyService.getAllDrugs({
      search: search as string,
      category: category as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    sendSuccess(res, drugs);
  })
);

// Create drug
router.post(
  '/drugs',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'PHARMACIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const drug = await pharmacyService.createDrug(req.body);
    sendCreated(res, drug, 'Drug created successfully');
  })
);

// Get drug by ID
router.get(
  '/drugs/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const drug = await pharmacyService.getDrugById(req.params.id);
    sendSuccess(res, drug);
  })
);

// Update drug
router.put(
  '/drugs/:id',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'PHARMACIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const drug = await pharmacyService.updateDrug(req.params.id, req.body);
    sendSuccess(res, drug, 'Drug updated successfully');
  })
);

// ==================== Inventory ====================

// Add inventory
router.post(
  '/inventory',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'PHARMACIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const inventory = await pharmacyService.addInventory(req.body);
    sendCreated(res, inventory, 'Inventory added successfully');
  })
);

// Update inventory quantity
router.patch(
  '/inventory/:id/quantity',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'PHARMACIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const inventory = await pharmacyService.updateInventoryQuantity(req.params.id, req.body.quantity);
    sendSuccess(res, inventory, 'Inventory updated');
  })
);

// Get low stock drugs
router.get(
  '/low-stock',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const threshold = req.query.threshold ? Number(req.query.threshold) : undefined;
    const drugs = await pharmacyService.getLowStockDrugs(threshold);
    sendSuccess(res, drugs);
  })
);

// Get expiring drugs
router.get(
  '/expiring',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const days = req.query.days ? Number(req.query.days) : 30;
    const drugs = await pharmacyService.getExpiringDrugs(days);
    sendSuccess(res, drugs);
  })
);

// ==================== Prescriptions ====================

// Get pending prescriptions
router.get(
  '/prescriptions/pending',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const prescriptions = await pharmacyService.getPendingPrescriptions(req.user!.hospitalId);
    sendSuccess(res, prescriptions);
  })
);

// Dispense medication
router.post(
  '/dispense/:medicationId',
  authenticate,
  authorize('PHARMACIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await pharmacyService.dispenseMedication(req.params.medicationId, req.user!.userId);
    sendSuccess(res, result, 'Medication dispensed');
  })
);

// Dispense entire prescription
router.post(
  '/prescriptions/:prescriptionId/dispense',
  authenticate,
  authorize('PHARMACIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await pharmacyService.dispensePrescription(req.params.prescriptionId, req.user!.userId);
    sendSuccess(res, result, 'Prescription dispensed');
  })
);

// ==================== Drug Interactions ====================

// Check drug interactions by IDs
router.post(
  '/interactions/check',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const interactions = await pharmacyService.checkDrugInteractions(req.body.drugIds);
    sendSuccess(res, interactions);
  })
);

// Analyze drug interactions by names (AI-powered)
router.post(
  '/interactions/analyze',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { drugs } = req.body;
    const result = pharmacyService.analyzeDrugInteractions(drugs);
    sendSuccess(res, result);
  })
);

// ==================== Dosage Calculator ====================

// Calculate dosage with patient-specific adjustments
router.post(
  '/calculate-dosage',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = pharmacyService.calculateDosage(req.body);
    sendSuccess(res, result);
  })
);

// Get pharmacy stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await pharmacyService.getPharmacyStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

// ==================== Bulk Import ====================

// Download CSV template for drug import
router.get(
  '/drugs/csv-template',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'PHARMACIST'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const template = pharmacyService.getDrugCSVTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=drug-import-template.csv');
    res.send(template);
  })
);

// Bulk import drugs from CSV
router.post(
  '/drugs/bulk-import',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'PHARMACIST'),
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const result = await pharmacyService.bulkImportDrugs(csvContent);
    sendSuccess(res, result);
  })
);

export default router;
