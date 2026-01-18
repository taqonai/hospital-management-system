import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { GenomicSource, GenomicProcessingStatus } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Genomic Service
 * Handles genomic profile management:
 * - File upload and parsing (VCF, 23andMe, AncestryDNA)
 * - Marker extraction and interpretation
 * - Risk score calculation
 * - GDPR-compliant data deletion
 */
export class GenomicService {
  /**
   * Create a new genomic profile from uploaded file
   */
  async createProfile(
    patientId: string,
    hospitalId: string,
    source: GenomicSource,
    fileContent: string | null,
    fileUrl: string | null,
    fileName?: string
  ) {
    // Check if profile already exists
    const existingProfile = await prisma.genomicProfile.findUnique({
      where: { patientId },
    });

    if (existingProfile) {
      throw new AppError('Genomic profile already exists. Delete existing profile first.', 409);
    }

    // Calculate file hash for deduplication
    const fileHash = fileContent
      ? crypto.createHash('sha256').update(fileContent).digest('hex')
      : crypto.createHash('sha256').update(fileUrl || Date.now().toString()).digest('hex');

    // Create profile
    const profile = await prisma.genomicProfile.create({
      data: {
        patientId,
        hospitalId,
        source,
        fileName,
        fileHash,
        fileUrl,
        status: 'PENDING',
      },
    });

    // Queue for AI processing
    await this.queueForProcessing(profile.id, fileContent, fileUrl, source);

    return profile;
  }

  /**
   * Queue genomic file for AI processing
   */
  private async queueForProcessing(
    profileId: string,
    fileContent: string | null,
    fileUrl: string | null,
    source: GenomicSource
  ) {
    try {
      // Update status to processing
      await prisma.genomicProfile.update({
        where: { id: profileId },
        data: { status: 'PROCESSING' },
      });

      // Call AI service to parse and interpret
      const response = await axios.post(`${AI_SERVICE_URL}/genomic/upload`, {
        profileId,
        fileContent,
        fileUrl,
        source,
      });

      if (response.data.success) {
        // Store extracted markers
        if (response.data.markers && response.data.markers.length > 0) {
          await prisma.genomicMarker.createMany({
            data: response.data.markers.map((marker: any) => ({
              profileId,
              rsId: marker.rsId,
              gene: marker.gene,
              genotype: marker.genotype,
              category: marker.category,
              phenotype: marker.phenotype,
              confidence: marker.confidence,
              recommendations: marker.recommendations || [],
              metadata: marker.metadata || null,
            })),
          });
        }

        // Store risk scores
        if (response.data.riskScores && response.data.riskScores.length > 0) {
          await prisma.genomicRiskScore.createMany({
            data: response.data.riskScores.map((score: any) => ({
              profileId,
              condition: score.condition,
              riskLevel: score.riskLevel,
              percentile: score.percentile,
              confidenceScore: score.confidenceScore,
              contributingSnps: score.contributingSnps || [],
              recommendations: score.recommendations || [],
            })),
          });
        }

        // Update profile status
        await prisma.genomicProfile.update({
          where: { id: profileId },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });
      } else {
        throw new Error(response.data.error || 'Processing failed');
      }
    } catch (error: any) {
      // Update profile with error
      await prisma.genomicProfile.update({
        where: { id: profileId },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Unknown error during processing',
        },
      });

      console.error('Genomic processing failed:', error);
    }
  }

  /**
   * Get genomic profile with markers and risk scores
   */
  async getProfile(patientId: string) {
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
      throw new NotFoundError('Genomic profile not found');
    }

    return profile;
  }

  /**
   * Get markers grouped by category
   */
  async getMarkersByCategory(patientId: string) {
    const profile = await prisma.genomicProfile.findUnique({
      where: { patientId },
    });

    if (!profile) {
      throw new NotFoundError('Genomic profile not found');
    }

    const markers = await prisma.genomicMarker.findMany({
      where: { profileId: profile.id },
      orderBy: [
        { category: 'asc' },
        { confidence: 'desc' },
      ],
    });

    // Group by category
    const grouped = markers.reduce((acc: Record<string, any[]>, marker) => {
      if (!acc[marker.category]) {
        acc[marker.category] = [];
      }
      acc[marker.category].push(marker);
      return acc;
    }, {});

    return {
      markers,
      grouped,
      totalMarkers: markers.length,
      categories: Object.keys(grouped),
    };
  }

  /**
   * Get risk scores
   */
  async getRiskScores(patientId: string) {
    const profile = await prisma.genomicProfile.findUnique({
      where: { patientId },
    });

    if (!profile) {
      throw new NotFoundError('Genomic profile not found');
    }

    const riskScores = await prisma.genomicRiskScore.findMany({
      where: { profileId: profile.id },
      orderBy: { percentile: 'desc' },
    });

    return {
      riskScores,
      totalConditions: riskScores.length,
    };
  }

  /**
   * Delete genomic profile and all associated data (GDPR compliance)
   */
  async deleteProfile(patientId: string) {
    const profile = await prisma.genomicProfile.findUnique({
      where: { patientId },
    });

    if (!profile) {
      throw new NotFoundError('Genomic profile not found');
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
        patientId,
        consentType: 'GENOMIC_ANALYSIS',
      },
      data: {
        granted: false,
        revokedAt: new Date(),
      },
    });

    // TODO: Delete file from S3 if stored

    return { deleted: true };
  }

  /**
   * Record consent for genomic analysis
   */
  async recordConsent(
    patientId: string,
    hospitalId: string,
    granted: boolean,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.patientConsent.upsert({
      where: {
        patientId_consentType: {
          patientId,
          consentType: 'GENOMIC_ANALYSIS',
        },
      },
      update: {
        granted,
        grantedAt: granted ? new Date() : null,
        revokedAt: granted ? null : new Date(),
        ipAddress,
        userAgent,
      },
      create: {
        patientId,
        hospitalId,
        consentType: 'GENOMIC_ANALYSIS',
        granted,
        grantedAt: granted ? new Date() : null,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Get interpretation for a specific marker
   */
  async interpretMarker(rsId: string, genotype: string) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/genomic/interpret`, {
        rsId,
        genotype,
      });

      return response.data;
    } catch (error) {
      console.error('Failed to interpret marker:', error);
      return null;
    }
  }
}

export const genomicService = new GenomicService();
