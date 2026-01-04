# S3 Bucket for Medical Images

resource "aws_s3_bucket" "medical_images" {
  bucket = "${var.project_name}-${var.environment}-medical-images"

  tags = {
    Name        = "${var.project_name}-${var.environment}-medical-images"
    Environment = var.environment
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "medical_images" {
  bucket = aws_s3_bucket.medical_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for data protection
resource "aws_s3_bucket_versioning" "medical_images" {
  bucket = aws_s3_bucket.medical_images.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "medical_images" {
  bucket = aws_s3_bucket.medical_images.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle rules for cost management
resource "aws_s3_bucket_lifecycle_configuration" "medical_images" {
  bucket = aws_s3_bucket.medical_images.id

  rule {
    id     = "move-to-ia"
    status = "Enabled"

    filter {
      prefix = "" # Apply to all objects
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }
}

# CORS configuration for frontend access
resource "aws_s3_bucket_cors_configuration" "medical_images" {
  bucket = aws_s3_bucket.medical_images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["https://medint.taqon.ai", "http://localhost:3000"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Output the bucket name and ARN
output "s3_bucket_name" {
  value       = aws_s3_bucket.medical_images.id
  description = "Name of the S3 bucket for medical images"
}

output "s3_bucket_arn" {
  value       = aws_s3_bucket.medical_images.arn
  description = "ARN of the S3 bucket for medical images"
}

output "s3_bucket_region" {
  value       = var.aws_region
  description = "Region of the S3 bucket"
}
