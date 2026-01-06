/**
 * PDF Analysis Service
 * Proxies requests to the AI Python service for PDF document analysis
 */

import axios from 'axios';
import FormData from 'form-data';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export interface PDFAnalysisResult {
  success: boolean;
  summary?: string;
  documentDate?: string;
  keyFindings?: string[];
  diagnoses?: string[];
  medications?: string[];
  labResults?: Array<{
    test: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    abnormal?: boolean;
  }>;
  recommendations?: string[];
  urgentFindings?: string[];
  extractedEntities?: {
    conditions?: string[];
    procedures?: string[];
    anatomicalSites?: string[];
    clinicians?: string[];
  };
  confidence?: number;
  pageCount?: number;
  analysisMethod?: string;
  documentType?: string;
  modelVersion?: string;
  error?: string;
}

export interface AnalyzePDFOptions {
  documentType?: string;
  extractEntities?: boolean;
  patientAge?: number;
  patientGender?: string;
  patientConditions?: string[];
}

class PDFService {
  private aiServiceUrl: string;

  constructor() {
    this.aiServiceUrl = AI_SERVICE_URL;
    logger.info(`PDF Service initialized - AI Service URL: ${this.aiServiceUrl}`);
  }

  /**
   * Check PDF analysis service health
   */
  async checkHealth(): Promise<{ status: string; available: boolean }> {
    try {
      const response = await axios.get(`${this.aiServiceUrl}/health`, { timeout: 5000 });
      return {
        status: 'connected',
        available: response.data?.pdf_analyzer_available ?? true,
      };
    } catch (error) {
      logger.error('PDF service health check failed:', error);
      return { status: 'disconnected', available: false };
    }
  }

  /**
   * Analyze a PDF file
   */
  async analyzePDF(
    fileBuffer: Buffer,
    filename: string,
    options: AnalyzePDFOptions = {}
  ): Promise<PDFAnalysisResult> {
    try {
      logger.info('Analyzing PDF', { filename, documentType: options.documentType });

      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: filename,
        contentType: 'application/pdf',
      });
      formData.append('document_type', options.documentType || 'medical_report');
      formData.append('extract_entities', String(options.extractEntities !== false));

      if (options.patientAge) {
        formData.append('patient_age', String(options.patientAge));
      }
      if (options.patientGender) {
        formData.append('patient_gender', options.patientGender);
      }
      if (options.patientConditions?.length) {
        formData.append('patient_conditions', options.patientConditions.join(','));
      }

      const response = await axios.post(
        `${this.aiServiceUrl}/api/pdf/analyze`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 120000, // 2 minutes for PDF processing
        }
      );

      logger.info('PDF analysis completed', {
        filename,
        success: response.data.success,
        pageCount: response.data.pageCount,
      });

      return response.data;
    } catch (error: any) {
      logger.error('PDF analysis failed:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('PDF analysis service is not reachable', 503);
        }
        throw new AppError(
          `PDF analysis error: ${error.response?.data?.detail || error.message}`,
          error.response?.status || 500
        );
      }
      throw new AppError('PDF analysis failed', 500);
    }
  }

  /**
   * Analyze a PDF from URL
   */
  async analyzePDFFromURL(
    url: string,
    options: AnalyzePDFOptions = {}
  ): Promise<PDFAnalysisResult> {
    try {
      logger.info('Analyzing PDF from URL', { url, documentType: options.documentType });

      const response = await axios.post(
        `${this.aiServiceUrl}/api/pdf/analyze-url`,
        {
          url,
          document_type: options.documentType || 'medical_report',
          extract_entities: options.extractEntities !== false,
          patient_age: options.patientAge,
          patient_gender: options.patientGender,
          patient_conditions: options.patientConditions,
        },
        { timeout: 120000 }
      );

      return response.data;
    } catch (error: any) {
      logger.error('PDF URL analysis failed:', error);
      if (axios.isAxiosError(error)) {
        throw new AppError(
          `PDF analysis error: ${error.response?.data?.detail || error.message}`,
          error.response?.status || 500
        );
      }
      throw new AppError('PDF URL analysis failed', 500);
    }
  }

  /**
   * Get supported document types
   */
  getSupportedDocumentTypes(): string[] {
    return [
      'medical_report',
      'lab_result',
      'radiology_report',
      'prescription',
      'discharge_summary',
      'pathology_report',
      'consultation_note',
    ];
  }
}

export const pdfService = new PDFService();
