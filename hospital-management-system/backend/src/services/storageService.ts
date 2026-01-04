import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';

// S3 Client Configuration
// Supports both AWS S3 (with IAM role or explicit credentials) and MinIO (S3-compatible)
const s3Config: any = {
  region: process.env.AWS_REGION || 'us-east-1',
};

// If using MinIO (local development)
if (process.env.MINIO_ENDPOINT) {
  s3Config.endpoint = process.env.MINIO_ENDPOINT;
  s3Config.forcePathStyle = true; // Required for MinIO
  s3Config.credentials = {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  };
} else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  // AWS S3 with explicit credentials
  s3Config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}
// Note: If no credentials are provided, AWS SDK will use the EC2 instance profile (IAM role)

const s3Client = new S3Client(s3Config);

const BUCKET_NAME = process.env.AWS_S3_BUCKET || process.env.MINIO_BUCKET || 'hospital-medical-images';

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  contentType: string;
}

export const storageService = {
  /**
   * Upload a file to S3/MinIO
   */
  async uploadFile(
    file: Buffer,
    options: {
      filename?: string;
      contentType?: string;
      folder?: string;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<UploadResult> {
    const {
      filename,
      contentType = 'application/octet-stream',
      folder = 'medical-images',
      metadata = {},
    } = options;

    // Generate unique key
    const ext = filename ? filename.split('.').pop() : 'bin';
    const key = `${folder}/${uuidv4()}.${ext}`;

    try {
      // Use Upload for larger files (multipart)
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: BUCKET_NAME,
          Key: key,
          Body: file,
          ContentType: contentType,
          Metadata: metadata,
        },
      });

      await upload.done();

      // Generate URL
      const url = this.getFileUrl(key);

      return {
        url,
        key,
        bucket: BUCKET_NAME,
        size: file.length,
        contentType,
      };
    } catch (error: any) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  /**
   * Upload medical image
   */
  async uploadMedicalImage(
    file: Buffer,
    options: {
      filename?: string;
      contentType?: string;
      patientId?: string;
      modality?: string;
      bodyPart?: string;
    } = {}
  ): Promise<UploadResult> {
    const metadata: Record<string, string> = {};
    if (options.patientId) metadata['patient-id'] = options.patientId;
    if (options.modality) metadata['modality'] = options.modality;
    if (options.bodyPart) metadata['body-part'] = options.bodyPart;

    return this.uploadFile(file, {
      filename: options.filename,
      contentType: options.contentType,
      folder: 'medical-images',
      metadata,
    });
  },

  /**
   * Get file URL
   */
  getFileUrl(key: string): string {
    // For MinIO or custom endpoint
    if (process.env.MINIO_ENDPOINT) {
      const endpoint = process.env.MINIO_ENDPOINT.replace(/\/$/, '');
      return `${endpoint}/${BUCKET_NAME}/${key}`;
    }

    // For AWS S3
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
  },

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        })
      );
    } catch (error: any) {
      console.error('S3 delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  },

  /**
   * Check if S3/MinIO is configured and accessible
   */
  async checkHealth(): Promise<{ configured: boolean; accessible: boolean; message: string }> {
    const isConfigured = !!(
      process.env.MINIO_ENDPOINT ||
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    );

    if (!isConfigured) {
      return {
        configured: false,
        accessible: false,
        message: 'S3/MinIO not configured. Files will be stored as base64.',
      };
    }

    try {
      // Try a simple operation to check accessibility
      await s3Client.send(
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: 'health-check-test',
        })
      );
      return {
        configured: true,
        accessible: true,
        message: 'S3/MinIO is configured and accessible',
      };
    } catch (error: any) {
      // NoSuchKey is expected - bucket is accessible
      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        return {
          configured: true,
          accessible: true,
          message: 'S3/MinIO is configured and accessible',
        };
      }
      return {
        configured: true,
        accessible: false,
        message: `S3/MinIO configured but not accessible: ${error.message}`,
      };
    }
  },

  /**
   * Check if storage is available (S3/MinIO configured)
   * Returns true if:
   * - MinIO endpoint is configured (local dev)
   * - AWS credentials are explicitly provided
   * - AWS S3 bucket is specified (assumes EC2 IAM role will provide credentials)
   */
  isStorageConfigured(): boolean {
    return !!(
      process.env.MINIO_ENDPOINT ||
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
      process.env.AWS_S3_BUCKET // EC2 with IAM role - bucket name is enough
    );
  },
};

export default storageService;
