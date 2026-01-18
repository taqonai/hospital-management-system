import { api } from './client';
import { ApiResponse } from '../../types';

// ==================== Genomic Types ====================

export type GenomicSource = 'VCF' | 'TWENTYTHREE_AND_ME' | 'ANCESTRY_DNA' | 'MANUAL';

export type MarkerCategory =
  | 'METABOLISM'
  | 'NUTRITION'
  | 'INFLAMMATION'
  | 'FITNESS'
  | 'SLEEP'
  | 'CARDIOVASCULAR'
  | 'MENTAL_HEALTH'
  | 'DETOXIFICATION';

export type GenomicProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type GenomicRiskLevel = 'LOW' | 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE' | 'HIGH';

export interface GenomicMarker {
  id?: string;
  rsId: string;
  gene: string;
  genotype: string;
  category: MarkerCategory;
  phenotype: string;
  confidence: number;
  recommendations: string[];
  riskModifier?: number;
}

export interface GenomicRiskScore {
  id?: string;
  category: MarkerCategory;
  riskLevel: GenomicRiskLevel;
  score: number;
  percentile?: number;
  contributingMarkers: string[];
  recommendations: string[];
}

export interface GenomicProfile {
  id: string;
  patientId: string;
  source: GenomicSource;
  fileName?: string;
  fileHash: string;
  uploadedAt: string;
  processedAt?: string;
  status: GenomicProcessingStatus;
  markers: GenomicMarker[];
  riskScores: GenomicRiskScore[];
}

export interface UploadGenomicFileData {
  fileContent: string; // Base64 encoded or raw text
  source?: GenomicSource;
  fileName?: string;
  consentGranted: boolean;
}

export interface GenomicUploadResponse {
  profileId: string;
  markers: GenomicMarker[];
  riskScores: GenomicRiskScore[];
  fileHash: string;
  source: GenomicSource;
  snpCount: number;
}

export interface SupportedMarker {
  rsId: string;
  gene: string;
  category: MarkerCategory;
  possibleGenotypes: string[];
}

export interface MarkerInterpretation {
  rsId: string;
  gene: string;
  genotype: string;
  normalizedGenotype: string;
  category: MarkerCategory;
  phenotype: string;
  recommendations: string[];
  riskModifier: number;
}

// ==================== Consent Types ====================

export type DataConsentType =
  | 'HEALTH_DATA_COLLECTION'
  | 'GENOMIC_ANALYSIS'
  | 'AI_RECOMMENDATIONS'
  | 'CLINICIAN_ACCESS'
  | 'DATA_SHARING_RESEARCH';

export interface PatientConsent {
  id: string;
  consentType: DataConsentType;
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
}

export interface GrantConsentData {
  consentType: DataConsentType;
  granted: boolean;
}

// ==================== API Service ====================

export const genomicsApi = {
  // ==================== Profile Management ====================

  /**
   * Get the patient's genomic profile
   */
  getProfile: () =>
    api.get<ApiResponse<GenomicProfile>>('/genomics/profile'),

  /**
   * Upload a genomic data file (VCF, 23andMe, AncestryDNA)
   */
  uploadFile: (data: UploadGenomicFileData) =>
    api.post<ApiResponse<GenomicUploadResponse>>('/genomics/upload', {
      fileContent: data.fileContent,
      source: data.source,
      fileName: data.fileName,
      consentGranted: data.consentGranted,
    }),

  /**
   * Delete the patient's genomic profile (GDPR right to erasure)
   */
  deleteProfile: () =>
    api.delete<ApiResponse<void>>('/genomics/profile'),

  // ==================== Markers ====================

  /**
   * Get all processed markers for the patient
   */
  getMarkers: (params?: { category?: MarkerCategory }) =>
    api.get<ApiResponse<GenomicMarker[]>>('/genomics/markers', { params }),

  /**
   * Get risk scores by category
   */
  getRiskScores: (params?: { category?: MarkerCategory }) =>
    api.get<ApiResponse<GenomicRiskScore[]>>('/genomics/risks', { params }),

  /**
   * Get list of all supported genetic markers
   */
  getSupportedMarkers: () =>
    api.get<ApiResponse<SupportedMarker[]>>('/genomics/supported-markers'),

  /**
   * Interpret a specific SNP (for manual entry)
   */
  interpretMarker: (rsId: string, genotype: string) =>
    api.post<ApiResponse<MarkerInterpretation>>('/genomics/interpret', {
      rsId,
      genotype,
    }),

  // ==================== Consent ====================

  /**
   * Get patient's consent status
   */
  getConsents: () =>
    api.get<ApiResponse<PatientConsent[]>>('/genomics/consents'),

  /**
   * Grant or revoke a specific consent
   */
  updateConsent: (data: GrantConsentData) =>
    api.post<ApiResponse<PatientConsent>>('/genomics/consents', {
      consentType: data.consentType,
      granted: data.granted,
    }),

  // ==================== Categories ====================

  /**
   * Get marker categories with descriptions
   */
  getCategories: () =>
    api.get<ApiResponse<{
      categories: Array<{
        name: MarkerCategory;
        description: string;
        markerCount: number;
      }>;
    }>>('/genomics/categories'),

  /**
   * Get markers grouped by category
   */
  getMarkersByCategory: () =>
    api.get<ApiResponse<Record<MarkerCategory, GenomicMarker[]>>>('/genomics/markers/by-category'),
};

export default genomicsApi;
