import { Router, Response, Request } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import crypto from 'crypto';

const router = Router();

// =============================================================================
// GENOMIC MARKER KNOWLEDGE BASE
// =============================================================================

interface MarkerInfo {
  gene: string;
  category: 'METABOLISM' | 'NUTRITION' | 'INFLAMMATION' | 'FITNESS' | 'SLEEP' | 'CARDIOVASCULAR' | 'MENTAL_HEALTH' | 'DETOXIFICATION';
  interpretations: Record<string, { phenotype: string; recommendations: string[]; riskModifier: number }>;
}

const MARKER_KNOWLEDGE_BASE: Record<string, MarkerInfo> = {
  rs762551: {
    gene: 'CYP1A2',
    category: 'METABOLISM',
    interpretations: {
      'AA': { phenotype: 'Fast caffeine metabolizer', recommendations: ['Caffeine is processed quickly', 'Moderate coffee consumption is generally safe'], riskModifier: -0.1 },
      'AC': { phenotype: 'Moderate caffeine metabolizer', recommendations: ['Limit caffeine to 2-3 cups daily', 'Avoid caffeine after 2pm for better sleep'], riskModifier: 0 },
      'CC': { phenotype: 'Slow caffeine metabolizer', recommendations: ['Limit caffeine intake', 'Caffeine may increase cardiovascular risk', 'Consider decaf alternatives'], riskModifier: 0.2 },
    },
  },
  rs1801133: {
    gene: 'MTHFR',
    category: 'NUTRITION',
    interpretations: {
      'CC': { phenotype: 'Normal folate metabolism', recommendations: ['Standard folate intake is sufficient'], riskModifier: -0.1 },
      'CT': { phenotype: 'Mildly reduced folate metabolism', recommendations: ['Consider methylfolate supplementation', 'Increase leafy green intake'], riskModifier: 0.1 },
      'TT': { phenotype: 'Significantly reduced folate metabolism', recommendations: ['Methylfolate supplementation recommended', 'Avoid folic acid supplements', 'Regular B12 monitoring'], riskModifier: 0.3 },
    },
  },
  rs4988235: {
    gene: 'LCT',
    category: 'NUTRITION',
    interpretations: {
      'GG': { phenotype: 'Lactose intolerant', recommendations: ['Avoid or limit dairy products', 'Consider lactase supplements', 'Choose lactose-free alternatives'], riskModifier: 0.1 },
      'GA': { phenotype: 'Lactose tolerant', recommendations: ['Dairy consumption is generally well tolerated'], riskModifier: 0 },
      'AA': { phenotype: 'Lactose tolerant', recommendations: ['Full dairy tolerance'], riskModifier: -0.1 },
    },
  },
  rs1815739: {
    gene: 'ACTN3',
    category: 'FITNESS',
    interpretations: {
      'CC': { phenotype: 'Power/sprint optimized muscles', recommendations: ['Suited for explosive activities', 'Consider strength training', 'Sprint and power sports may be advantageous'], riskModifier: 0 },
      'CT': { phenotype: 'Mixed muscle fiber type', recommendations: ['Balanced for both power and endurance', 'Versatile athletic potential'], riskModifier: 0 },
      'TT': { phenotype: 'Endurance optimized muscles', recommendations: ['Suited for endurance activities', 'Consider marathon, cycling, swimming', 'May need longer warm-up for explosive activities'], riskModifier: 0 },
    },
  },
  rs4680: {
    gene: 'COMT',
    category: 'MENTAL_HEALTH',
    interpretations: {
      'GG': { phenotype: 'Warrior - Fast stress hormone clearance', recommendations: ['Better performance under pressure', 'May need more stimulation', 'Lower pain sensitivity'], riskModifier: -0.1 },
      'AG': { phenotype: 'Balanced stress response', recommendations: ['Moderate stress adaptation', 'Balanced approach works well'], riskModifier: 0 },
      'AA': { phenotype: 'Worrier - Slow stress hormone clearance', recommendations: ['Better focus in calm environments', 'Practice stress management', 'May benefit from adaptogens'], riskModifier: 0.1 },
    },
  },
  rs53576: {
    gene: 'OXTR',
    category: 'MENTAL_HEALTH',
    interpretations: {
      'GG': { phenotype: 'Higher empathy and social sensitivity', recommendations: ['Strong social bonds are beneficial', 'May be more affected by social stress'], riskModifier: 0 },
      'AG': { phenotype: 'Moderate social sensitivity', recommendations: ['Balanced social responsiveness'], riskModifier: 0 },
      'AA': { phenotype: 'Lower social sensitivity', recommendations: ['May handle social stress better', 'Focus on building meaningful connections'], riskModifier: 0 },
    },
  },
  rs1800795: {
    gene: 'IL-6',
    category: 'INFLAMMATION',
    interpretations: {
      'GG': { phenotype: 'Higher inflammatory response', recommendations: ['Anti-inflammatory diet recommended', 'Regular omega-3 intake', 'Monitor CRP levels'], riskModifier: 0.2 },
      'GC': { phenotype: 'Moderate inflammatory response', recommendations: ['Balanced anti-inflammatory approach'], riskModifier: 0.1 },
      'CC': { phenotype: 'Lower inflammatory response', recommendations: ['Normal inflammatory regulation'], riskModifier: -0.1 },
    },
  },
  rs7903146: {
    gene: 'TCF7L2',
    category: 'METABOLISM',
    interpretations: {
      'CC': { phenotype: 'Lower type 2 diabetes risk', recommendations: ['Standard diabetes prevention measures'], riskModifier: -0.2 },
      'CT': { phenotype: 'Moderate type 2 diabetes risk', recommendations: ['Monitor blood sugar regularly', 'Maintain healthy weight', 'Regular exercise'], riskModifier: 0.1 },
      'TT': { phenotype: 'Higher type 2 diabetes risk', recommendations: ['Regular glucose monitoring', 'Low glycemic diet recommended', 'Weight management crucial'], riskModifier: 0.3 },
    },
  },
  rs1801282: {
    gene: 'PPARG',
    category: 'METABOLISM',
    interpretations: {
      'CC': { phenotype: 'Standard insulin sensitivity', recommendations: ['Normal metabolic response'], riskModifier: 0 },
      'CG': { phenotype: 'Improved insulin sensitivity', recommendations: ['May respond well to dietary fats', 'Lower diabetes risk'], riskModifier: -0.1 },
      'GG': { phenotype: 'Enhanced insulin sensitivity', recommendations: ['Favorable metabolic profile'], riskModifier: -0.2 },
    },
  },
  rs6265: {
    gene: 'BDNF',
    category: 'MENTAL_HEALTH',
    interpretations: {
      'CC': { phenotype: 'Normal BDNF levels', recommendations: ['Standard brain health maintenance'], riskModifier: 0 },
      'CT': { phenotype: 'Slightly reduced BDNF', recommendations: ['Regular exercise boosts BDNF', 'Consider brain-healthy activities'], riskModifier: 0.1 },
      'TT': { phenotype: 'Reduced BDNF production', recommendations: ['Prioritize regular exercise', 'Omega-3 supplementation may help', 'Cognitive training recommended'], riskModifier: 0.2 },
    },
  },
  rs1800629: {
    gene: 'TNF-α',
    category: 'INFLAMMATION',
    interpretations: {
      'GG': { phenotype: 'Normal TNF-alpha levels', recommendations: ['Standard inflammatory response'], riskModifier: 0 },
      'GA': { phenotype: 'Elevated TNF-alpha levels', recommendations: ['Anti-inflammatory lifestyle recommended', 'Monitor inflammatory markers'], riskModifier: 0.15 },
      'AA': { phenotype: 'High TNF-alpha levels', recommendations: ['Strong anti-inflammatory diet needed', 'Regular turmeric/curcumin may help', 'Avoid pro-inflammatory foods'], riskModifier: 0.3 },
    },
  },
  rs174546: {
    gene: 'FADS1',
    category: 'NUTRITION',
    interpretations: {
      'CC': { phenotype: 'Efficient omega-3 conversion', recommendations: ['Plant-based omega-3 sources are effective'], riskModifier: -0.1 },
      'CT': { phenotype: 'Moderate omega-3 conversion', recommendations: ['Mix of plant and fish omega-3 recommended'], riskModifier: 0 },
      'TT': { phenotype: 'Poor omega-3 conversion', recommendations: ['Direct EPA/DHA supplementation recommended', 'Prioritize fatty fish intake'], riskModifier: 0.1 },
    },
  },
};

// Parse genomic file content (23andMe or AncestryDNA format)
function parseGenomicFile(content: string, source: string): Array<{ rsId: string; genotype: string }> {
  const lines = content.split('\n');
  const snps: Array<{ rsId: string; genotype: string }> = [];

  for (const line of lines) {
    // Skip comments and headers
    if (line.startsWith('#') || line.trim() === '') continue;

    const parts = line.split('\t');
    if (parts.length >= 4) {
      const rsId = parts[0].trim().toLowerCase();

      // Only process known markers
      if (rsId.startsWith('rs') && MARKER_KNOWLEDGE_BASE[rsId]) {
        let genotype: string;

        if (source === 'ANCESTRY_DNA' && parts.length >= 5) {
          // AncestryDNA format: rsid, chromosome, position, allele1, allele2
          genotype = (parts[3] + parts[4]).toUpperCase();
        } else {
          // 23andMe format: rsid, chromosome, position, genotype
          genotype = parts[3].trim().toUpperCase();
        }

        if (genotype && genotype.length >= 2) {
          snps.push({ rsId, genotype });
        }
      }
    }
  }

  return snps;
}

// Normalize genotype (sort alleles alphabetically for consistent matching)
function normalizeGenotype(genotype: string): string {
  if (genotype.length !== 2) return genotype;
  const alleles = genotype.split('').sort();
  return alleles.join('');
}

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
        status: 'PROCESSING',
      },
    });

    // Parse the genomic file and extract markers
    const parsedSnps = fileContent ? parseGenomicFile(fileContent, source) : [];
    const createdMarkers: any[] = [];
    const categoryRisks: Record<string, { total: number; count: number }> = {};

    for (const snp of parsedSnps) {
      const markerInfo = MARKER_KNOWLEDGE_BASE[snp.rsId];
      if (!markerInfo) continue;

      // Try exact match first, then normalized
      const normalizedGenotype = normalizeGenotype(snp.genotype);
      const interpretation = markerInfo.interpretations[snp.genotype] ||
        markerInfo.interpretations[normalizedGenotype] ||
        Object.values(markerInfo.interpretations)[0]; // fallback to first interpretation

      if (interpretation) {
        const marker = await prisma.genomicMarker.create({
          data: {
            profileId: profile.id,
            rsId: snp.rsId,
            gene: markerInfo.gene,
            genotype: snp.genotype,
            category: markerInfo.category as any,
            phenotype: interpretation.phenotype,
            confidence: 0.95,
            recommendations: interpretation.recommendations,
            metadata: { riskModifier: interpretation.riskModifier },
          },
        });
        createdMarkers.push({ ...marker, riskModifier: interpretation.riskModifier });

        // Accumulate risk by category
        if (!categoryRisks[markerInfo.category]) {
          categoryRisks[markerInfo.category] = { total: 0, count: 0 };
        }
        categoryRisks[markerInfo.category].total += interpretation.riskModifier;
        categoryRisks[markerInfo.category].count += 1;
      }
    }

    // Create risk scores for each category
    const riskScores: any[] = [];
    for (const [category, data] of Object.entries(categoryRisks)) {
      const avgRisk = data.total / data.count;
      let riskLevel: string;
      let percentile: number;

      if (avgRisk <= -0.15) {
        riskLevel = 'LOW';
        percentile = 20;
      } else if (avgRisk <= -0.05) {
        riskLevel = 'BELOW_AVERAGE';
        percentile = 35;
      } else if (avgRisk <= 0.05) {
        riskLevel = 'AVERAGE';
        percentile = 50;
      } else if (avgRisk <= 0.15) {
        riskLevel = 'ABOVE_AVERAGE';
        percentile = 65;
      } else {
        riskLevel = 'HIGH';
        percentile = 80;
      }

      const riskScore = await prisma.genomicRiskScore.create({
        data: {
          profileId: profile.id,
          condition: category, // Using category as condition name
          riskLevel: riskLevel as any,
          percentile,
          confidenceScore: 0.85,
          contributingSnps: createdMarkers
            .filter(m => m.category === category)
            .map(m => m.rsId),
          recommendations: createdMarkers
            .filter(m => m.category === category)
            .flatMap(m => m.recommendations || [])
            .slice(0, 5),
        },
      });
      riskScores.push(riskScore);
    }

    // Update profile status to completed
    await prisma.genomicProfile.update({
      where: { id: profile.id },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });

    sendCreated(res, {
      id: profile.id,
      status: 'COMPLETED',
      markersFound: createdMarkers.length,
      riskCategories: Object.keys(categoryRisks),
      message: `Genomic file processed successfully. Found ${createdMarkers.length} genetic markers.`,
    }, 'Genomic profile created and processed');
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
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
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
