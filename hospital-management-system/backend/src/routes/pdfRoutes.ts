/**
 * PDF Analysis Routes
 * Endpoints for analyzing medical PDF documents
 */

import { Router, Response } from 'express';
import multer from 'multer';
import { pdfService } from '../services/pdfService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Configure multer for PDF upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

/**
 * Health check
 * GET /api/v1/pdf/health
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const health = await pdfService.checkHealth();
    sendSuccess(res, health, 'PDF analysis service health');
  })
);

/**
 * Get supported document types
 * GET /api/v1/pdf/document-types
 */
router.get(
  '/document-types',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const types = pdfService.getSupportedDocumentTypes();
    sendSuccess(res, { documentTypes: types }, 'Supported document types');
  })
);

/**
 * Analyze uploaded PDF
 * POST /api/v1/pdf/analyze
 */
router.post(
  '/analyze',
  authenticate,
  authorizeWithPermission('medical_records:export', ['DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'RADIOLOGIST', 'HOSPITAL_ADMIN']),
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No PDF file provided',
      });
    }

    const {
      documentType,
      extractEntities,
      patientAge,
      patientGender,
      patientConditions,
    } = req.body;

    const result = await pdfService.analyzePDF(
      req.file.buffer,
      req.file.originalname,
      {
        documentType: documentType || 'medical_report',
        extractEntities: extractEntities !== 'false',
        patientAge: patientAge ? parseInt(patientAge) : undefined,
        patientGender,
        patientConditions: patientConditions ? patientConditions.split(',') : undefined,
      }
    );

    sendSuccess(res, result, 'PDF analyzed successfully');
  })
);

/**
 * Analyze PDF from URL
 * POST /api/v1/pdf/analyze-url
 */
router.post(
  '/analyze-url',
  authenticate,
  authorizeWithPermission('medical_records:export', ['DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'RADIOLOGIST', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { url, documentType, extractEntities, patientAge, patientGender, patientConditions } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'PDF URL is required',
      });
    }

    const result = await pdfService.analyzePDFFromURL(url, {
      documentType: documentType || 'medical_report',
      extractEntities: extractEntities !== false,
      patientAge,
      patientGender,
      patientConditions,
    });

    sendSuccess(res, result, 'PDF analyzed successfully');
  })
);

export default router;
