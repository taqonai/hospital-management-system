#!/bin/bash
set -e

# HMS EC2 Bootstrap Script
# This script runs on first boot to set up the EC2 instance

exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting HMS setup at $(date)"

# Variables from Terraform
DB_PASSWORD="${db_password}"
JWT_SECRET="${jwt_secret}"
JWT_REFRESH_SECRET="${jwt_refresh_secret}"
ENVIRONMENT="${environment}"
AWS_REGION="${aws_region}"
S3_BUCKET="${s3_bucket}"

# Update system
echo "Updating system packages..."
dnf update -y

# Install Docker
echo "Installing Docker..."
dnf install -y docker
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Install Docker Compose
echo "Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Git
echo "Installing Git..."
dnf install -y git

# Create app directory
echo "Creating application directory..."
mkdir -p /opt/hms
cd /opt/hms

# Mount and format EBS volume if not already done
if [ -b /dev/xvdf ]; then
  if ! file -s /dev/xvdf | grep -q filesystem; then
    echo "Formatting EBS volume..."
    mkfs -t ext4 /dev/xvdf
  fi

  mkdir -p /opt/hms/data
  mount /dev/xvdf /opt/hms/data

  # Add to fstab for persistence
  if ! grep -q "/dev/xvdf" /etc/fstab; then
    echo "/dev/xvdf /opt/hms/data ext4 defaults,nofail 0 2" >> /etc/fstab
  fi
fi

# Create directories for data persistence
mkdir -p /opt/hms/data/postgres
mkdir -p /opt/hms/data/redis
mkdir -p /opt/hms/data/minio
mkdir -p /opt/hms/data/uploads
chown -R 1000:1000 /opt/hms/data

# Clone repository
echo "Cloning HMS repository..."
git clone https://github.com/taqonai/hospital-management-system.git /opt/hms/app || true

cd /opt/hms/app

# Create environment file
echo "Creating environment configuration..."
cat > /opt/hms/app/.env << EOF
# Application
NODE_ENV=production
ENVIRONMENT=$ENVIRONMENT

# Database
DATABASE_URL=postgresql://postgres:$DB_PASSWORD@postgres:5432/hospital_db?schema=public
DB_PASSWORD=$DB_PASSWORD

# JWT
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# AI Services
AI_SERVICE_URL=http://ai-services:8000

# AWS S3 for Medical Images
AWS_REGION=$AWS_REGION
AWS_S3_BUCKET=$S3_BUCKET

# Frontend
VITE_API_URL=/api/v1
EOF

# Copy production docker-compose if it exists
if [ -f /opt/hms/app/infrastructure/docker/docker-compose.prod.yml ]; then
  cp /opt/hms/app/infrastructure/docker/docker-compose.prod.yml /opt/hms/app/docker-compose.yml
fi

# Start services
echo "Starting HMS services..."
cd /opt/hms/app
docker-compose -f docker-compose.yml up -d --build

# Set up log rotation
cat > /etc/logrotate.d/hms << EOF
/var/log/hms/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
EOF

# Create systemd service for auto-start
cat > /etc/systemd/system/hms.service << EOF
[Unit]
Description=Hospital Management System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/hms/app
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable hms.service

echo "HMS setup completed at $(date)"
echo "Services should be available shortly..."
