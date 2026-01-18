import { Router, Response, Request } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import crypto from 'crypto';

const router = Router();

// =============================================================================
// PATIENT-FACING GENOMIC ENDPOINTS
// =============================================================================

const uploadGenomicSchema = z.object({
  body: z.object({
    source: z.enum(['VCF', 'TWENTYTHREE_AND_ME', 'ANCESTRY_DNA', 'MANUAL']),
    fileContent: z.string().optional(), // Base64 encoded file content for direct upload
    fileUrl: z.string().url().optional(), // S3 URL for already uploaded files
    fileName: z.string().optional(),
    consentGranted: z.boolean(),
  }),
});

// Upload genomic file for processing
// POST /api/v1/genomics/upload
router.post(
  '/upload',
  patientAuthenticate,
  validate(uploadGenomicSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { source, fileContent, fileUrl, fileName, consentGranted } = req.body;
    const patient = req.patient!;

    if (!consentGranted) {
      return sendError(res, 'Consent must be granted for genomic analysis', 400);
    }

    // Get hospital ID from patient
    const patientRecord = await prisma.patient.findUnique({
      where: { id: patient.patientId },
      select: { hospitalId: true },
    });

    if (!patientRecord) {
      return sendError(res, 'Patient not found', 404);
    }

    // Check if patient already has a genomic profile
    const existingProfile = await prisma.genomicProfile.findUnique({
      where: { patientId: patient.patientId },
    });

    if (existingProfile) {
      return sendError(res, 'Genomic profile already exists. Delete existing profile first.', 409);
    }

    // Calculate file hash for deduplication
    const fileHash = fileContent
      ? crypto.createHash('sha256').update(fileContent).digest('hex')
      : crypto.createHash('sha256').update(fileUrl || Date.now().toString()).digest('hex');

    // Record consent
    await prisma.patientConsent.upsert({
      where: {
        patientId_consentType: {
          patientId: patient.patientId,
          consentType: 'GENOMIC_ANALYSIS',
        },
      },
      update: {
        granted: true,
        grantedAt: new Date(),
        revokedAt: null,
      },
      create: {
        patientId: patient.patientId,
        hospitalId: patientRecord.hospitalId,
        consentType: 'GENOMIC_ANALYSIS',
        granted: true,
        grantedAt: new Date(),
      },
    });

    // Create genomic profile
    const profile = await prisma.genomicProfile.create({
      data: {
        patientId: patient.patientId,
        hospitalId: patientRecord.hospitalId,
        source: source as any,
        fileName,
        fileHash,
        fileUrl: fileUrl || null,
        status: 'PENDING',
      },
    });

    // TODO: Queue file for AI processing
    // This would trigger the ai-services/genomic/ service to parse the file
    // and extract markers

    sendCreated(res, {
      id: profile.id,
      status: profile.status,
      message: 'Genomic file uploaded successfully. Processing will begin shortly.',
    }, 'Genomic profile created');
  })
);

// Get patient's genomic profile
// GET /api/v1/genomics/profile
router.get(
  '/profile',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patient = req.patient!;

    const profile = await prisma.genomicProfile.findUnique({
      where: { patientId: patient.patientId },
      include: {
        markers: {
          orderBy: { category: 'asc' },
        },
        riskScores: {
          orderBy: { riskLevel: 'desc' },
        },
      },
    });

    if (!profile) {
      return sendError(res, 'No genomic profile found', 404);
    }

    sendSuccess(res, profile, 'Genomic profile retrieved');
  })
);

// Get processed markers with interpretations
// GET /api/v1/genomics/markers
router.get(
  '/markers',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { category } = req.query;
    const patient = req.patient!;

    const profile = await prisma.genomicProfile.findUnique({
      where: { patientId: patient.patientId },
    });

    if (!profile) {
      return sendError(res, 'No genomic profile found', 404);
    }

    const where: any = { profileId: profile.id };
    if (category) {
      where.category = category;
    }

    const markers = await prisma.genomicMarker.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { confidence: 'desc' },
      ],
    });

    // Group markers by category
    const grouped = markers.reduce((acc: any, marker) => {
      if (!acc[marker.category]) {
        acc[marker.category] = [];
      }
      acc[marker.category].push(marker);
      return acc;
    }, {});

    sendSuccess(res, {
      markers,
      grouped,
      totalMarkers: markers.length,
      categories: Object.keys(grouped),
    }, 'Genomic markers retrieved');
  })
);

// Get risk scores
// GET /api/v1/genomics/risks
router.get(
  '/risks',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patient = req.patient!;

    const profile = await prisma.genomicProfile.findUnique({
      where: { patientId: patient.patientId },
    });

    if (!profile) {
      return sendError(res, 'No genomic profile found', 404);
    }

    const riskScores = await prisma.genomicRiskScore.findMany({
      where: { profileId: profile.id },
      orderBy: { percentile: 'desc' },
    });

    sendSuccess(res, {
      riskScores,
      totalConditions: riskScores.length,
    }, 'Risk scores retrieved');
  })
);

// Delete genomic data (GDPR compliance)
// DELETE /api/v1/genomics/profile
router.delete(
  '/profile',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patient = req.patient!;

    const profile = await prisma.genomicProfile.findUnique({
      where: { patientId: patient.patientId },
    });

    if (!profile) {
      return sendError(res, 'No genomic profile found', 404);
    }

    // Delete in order: markers, risk scores, then profile
    await prisma.genomicMarker.deleteMany({
      where: { profileId: profile.id },
    });

    await prisma.genomicRiskScore.deleteMany({
      where: { profileId: profile.id },
    });

    await prisma.genomicProfile.delete({
      where: { id: profile.id },
    });

    // Revoke consent
    await prisma.patientConsent.updateMany({
      where: {
        patientId: patient.patientId,
        consentType: 'GENOMIC_ANALYSIS',
      },
      data: {
        granted: false,
        revokedAt: new Date(),
      },
    });

    // TODO: Delete file from S3 if stored

    sendSuccess(res, null, 'Genomic profile and all associated data deleted');
  })
);

// =============================================================================
// CLINICIAN-FACING GENOMIC ENDPOINTS (requires staff authentication)
// =============================================================================

// Get patient's genomic profile (clinician view)
// GET /api/v1/genomics/patients/:patientId/profile
router.get(
  '/patients/:patientId/profile',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;

    // Verify patient belongs to same hospital
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        hospitalId: req.user!.hospitalId,
      },
    });

    if (!patient) {
      return sendError(res, 'Patient not found', 404);
    }

    const profile = await prisma.genomicProfile.findUnique({
      where: { patientId },
      include: {
        markers: {
          orderBy: { category: 'asc' },
        },
        riskScores: {
          orderBy: { riskLevel: 'desc' },
        },
      },
    });

    if (!profile) {
      return sendError(res, 'No genomic profile found for this patient', 404);
    }

    sendSuccess(res, profile, 'Patient genomic profile retrieved');
  })
);

// =============================================================================
// SUPPORTED MARKERS INFO (public reference data)
// =============================================================================

// Get list of supported genetic markers
// GET /api/v1/genomics/supported-markers
router.get(
  '/supported-markers',
  asyncHandler(async (req: Request, res: Response) => {
    // Return list of genetic markers supported by the platform
    const supportedMarkers = [
      {
        rsId: 'rs762551',
        gene: 'CYP1A2',
        category: 'METABOLISM',
        description: 'Caffeine metabolism',
        possiblePhenotypes: ['Fast caffeine metabolizer', 'Slow caffeine metabolizer'],
      },
      {
        rsId: 'rs1801133',
        gene: 'MTHFR',
        category: 'NUTRITION',
        description: 'Folate metabolism',
        possiblePhenotypes: ['Normal folate metabolism', 'Reduced folate metabolism'],
      },
      {
        rsId: 'rs4988235',
        gene: 'LCT',
        category: 'NUTRITION',
        description: 'Lactose tolerance',
        possiblePhenotypes: ['Lactose tolerant', 'Lactose intolerant'],
      },
      {
        rsId: 'rs1815739',
        gene: 'ACTN3',
        category: 'FITNESS',
        description: 'Muscle fiber type',
        possiblePhenotypes: ['Sprint/power optimized', 'Endurance optimized', 'Mixed'],
      },
      {
        rsId: 'rs1800497',
        gene: 'DRD2',
        category: 'MENTAL_HEALTH',
        description: 'Dopamine receptor',
        possiblePhenotypes: ['Normal dopamine signaling', 'Reduced dopamine signaling'],
      },
      {
        rsId: 'rs4680',
        gene: 'COMT',
        category: 'METABOLISM',
        description: 'Catechol-O-methyltransferase activity',
        possiblePhenotypes: ['Warrior (fast COMT)', 'Worrier (slow COMT)', 'Balanced'],
      },
      {
        rsId: 'rs9939609',
        gene: 'FTO',
        category: 'NUTRITION',
        description: 'Fat mass and obesity associated',
        possiblePhenotypes: ['Lower obesity risk', 'Moderate obesity risk', 'Higher obesity risk'],
      },
      {
        rsId: 'rs1229984',
        gene: 'ADH1B',
        category: 'METABOLISM',
        description: 'Alcohol metabolism',
        possiblePhenotypes: ['Fast alcohol metabolism', 'Slow alcohol metabolism'],
      },
      {
        rsId: 'rs12913832',
        gene: 'HERC2',
        category: 'DETOXIFICATION',
        description: 'Eye color gene (example trait)',
        possiblePhenotypes: ['Brown eyes likely', 'Blue eyes likely', 'Green/hazel likely'],
      },
      {
        rsId: 'rs5751876',
        gene: 'ADORA2A',
        category: 'SLEEP',
        description: 'Adenosine receptor - caffeine sensitivity for sleep',
        possiblePhenotypes: ['Caffeine sensitive (affects sleep)', 'Caffeine tolerant'],
      },
    ];

    sendSuccess(res, {
      markers: supportedMarkers,
      totalSupported: supportedMarkers.length,
      categories: ['METABOLISM', 'NUTRITION', 'FITNESS', 'SLEEP', 'MENTAL_HEALTH', 'CARDIOVASCULAR', 'INFLAMMATION', 'DETOXIFICATION'],
    }, 'Supported markers retrieved');
  })
);

export default router;
