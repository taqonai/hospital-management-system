# AWS Cost Analysis: Hospital Management System

*Analysis Date: January 2026*

## Executive Summary

This document provides AWS cost estimates for deploying the Hospital Management System, with a focus on mid-size hospital deployments and per-user costing.

**Bottom Line**: For a mid-size hospital (400 users), expect **$200-250/month** in total costs, or approximately **$0.50-0.60 per user per month**.

---

## Current Deployment Architecture

### Infrastructure Overview

```
AWS VPC (10.0.0.0/16)
    |
    +-- Application Load Balancer (ALB)
    |   +-- HTTP (80) -> HTTPS redirect
    |   +-- HTTPS (443) -> Target Groups
    |       +-- /api/* -> Backend (3001)
    |       +-- /ai/* -> AI Services (8000)
    |       +-- /* -> Frontend (3000)
    |
    +-- EC2 Instance (t3.small default)
    |   +-- Docker Compose Stack
    |       +-- PostgreSQL 15 (Alpine)
    |       +-- Redis 7 (Alpine)
    |       +-- Backend API (Node.js 20)
    |       +-- Frontend (React + Nginx)
    |       +-- AI Services (Python/FastAPI)
    |       +-- Nginx Reverse Proxy
    |
    +-- EBS Volumes
    |   +-- Root: 30 GB (gp3, encrypted)
    |   +-- Data: 50 GB (gp3, encrypted)
    |
    +-- S3 Bucket (medical-images)
        +-- Lifecycle: Standard -> IA (90d) -> Glacier (365d)
```

### Key Infrastructure Files

| File | Purpose |
|------|---------|
| `infrastructure/terraform/` | AWS resource provisioning |
| `infrastructure/docker/docker-compose.prod.yml` | Production container stack |
| `infrastructure/nginx/nginx.conf` | Reverse proxy + rate limiting |
| `infrastructure/scripts/user-data.sh` | EC2 bootstrap automation |

---

## Hospital Size Definitions

### Small Hospital (50-100 beds)
| Metric | Value |
|--------|-------|
| Staff (clinical) | 50-150 |
| Staff (admin) | 20-50 |
| Daily outpatients | 50-150 |
| **Active users** | **100-200** |
| Concurrent users | 20-50 |

### Mid-Size Hospital (100-300 beds)
| Metric | Value |
|--------|-------|
| Staff (clinical) | 150-400 |
| Staff (admin) | 50-150 |
| Daily outpatients | 200-500 |
| **Active users** | **300-600** |
| Concurrent users | 50-150 |

### Large Hospital (300-600 beds)
| Metric | Value |
|--------|-------|
| Staff (clinical) | 400-1000 |
| Staff (admin) | 150-400 |
| Daily outpatients | 500-1500 |
| **Active users** | **600-1500** |
| Concurrent users | 150-400 |

**Reference for cost estimates: Mid-Size Hospital with 400 active users**

---

## Resource Requirements

### Memory by Service

| Service | Memory | CPU | Notes |
|---------|--------|-----|-------|
| PostgreSQL 15 | 512 MB - 1 GB | 1 core | Query caching |
| Redis 7 | 256 MB | 0.5 core | Session cache |
| Backend (Node.js) | 512 MB - 1 GB | 1 core | Express + Prisma |
| Frontend (Nginx) | 64 MB | 0.25 core | Static serving |
| **AI Services (Python)** | **2-4 GB** | **1-2 cores** | ML models |
| Nginx Proxy | 64 MB | 0.25 core | Reverse proxy |
| **TOTAL** | **4-7 GB** | **4-5 cores** | Minimum stable |

### Storage Requirements

| Data Type | Year 1 | Year 3 | Year 5 |
|-----------|--------|--------|--------|
| Database (PostgreSQL) | 10-20 GB | 30-60 GB | 50-100 GB |
| Medical Images (S3) | 50-100 GB | 150-300 GB | 250-500 GB |
| Audit Logs | 5-10 GB | 15-30 GB | 25-50 GB |
| **Total** | **~75 GB** | **~200 GB** | **~350 GB** |

---

## Cost Breakdown: Mid-Size Hospital (400 Users)

### Option A: Basic Deployment (Single EC2)

**Important**: The default t3.small (2 GB RAM) is insufficient. This estimate uses t3.large.

| Resource | Specification | Monthly Cost |
|----------|---------------|--------------|
| EC2 Instance | t3.large (2 vCPU, 8 GB) | $60.74 |
| EBS Root Volume | 30 GB gp3 | $2.40 |
| EBS Data Volume | 100 GB gp3 | $8.00 |
| Elastic IP | 1 static IP | $3.65 |
| ALB | Application Load Balancer | $16.20 |
| ALB LCUs | ~25 LCU-hours/month | $5.00 |
| S3 Storage | 100 GB (tiered) | $3.50 |
| S3 Requests | 100K requests | $0.50 |
| Data Transfer Out | 100 GB | $9.00 |
| CloudWatch | Basic logs + metrics | $10.00 |
| **AWS Subtotal** | | **$118.99** |

**External APIs:**

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| OpenAI Whisper (STT) | 500 min | $10.00 |
| OpenAI GPT-4o-mini | 5,000 calls | $15.00 |
| OpenAI GPT-4o Vision | 500 images | $12.50 |
| **API Subtotal** | | **$37.50** |

**Option A Total: $156.49/month**

---

### Option B: Production Deployment (Recommended)

Adds managed database, caching, and security features:

| Resource | Specification | Monthly Cost |
|----------|---------------|--------------|
| EC2 Instance | t3.large (8 GB) | $60.74 |
| EC2 Reserved (1-yr) | 40% discount | -$24.30 |
| RDS PostgreSQL | db.t3.medium (4 GB) | $49.42 |
| ElastiCache Redis | cache.t3.micro | $12.17 |
| EBS Root | 30 GB gp3 | $2.40 |
| ALB | Application Load Balancer | $16.20 |
| ALB LCUs | ~50 LCU-hours | $10.00 |
| S3 Storage | 100 GB (lifecycle) | $3.50 |
| S3 Requests | 200K/month | $1.00 |
| Data Transfer | 150 GB outbound | $13.50 |
| CloudWatch | Enhanced monitoring | $15.00 |
| Route 53 | Hosted zone + queries | $1.50 |
| ACM Certificate | Free (AWS managed) | $0.00 |
| AWS WAF | Basic protection | $5.00 |
| **AWS Subtotal** | | **$165.13** |

**Option B Total: $222.89/month** (including $37.50 API + 10% buffer)

---

## Per-User Cost Analysis

### Option A (Basic)

| Metric | Value |
|--------|-------|
| Monthly Cost | $156.49 |
| Active Users | 400 |
| **Cost per User/Month** | **$0.39** |
| **Cost per User/Year** | **$4.70** |

### Option B (Production)

| Metric | Value |
|--------|-------|
| Monthly Cost | $222.89 |
| Active Users | 400 |
| **Cost per User/Month** | **$0.56** |
| **Cost per User/Year** | **$6.69** |

---

## Scaling by Hospital Size

| Hospital Size | Beds | Users | Instance | Monthly Cost | Per User |
|---------------|------|-------|----------|--------------|----------|
| Small | 50-100 | 150 | t3.medium | $140 | $0.93 |
| **Mid-Size** | **100-300** | **400** | **t3.large** | **$223** | **$0.56** |
| Large | 300-600 | 800 | t3.xlarge | $380 | $0.48 |
| Enterprise | 600+ | 1,500 | m5.xlarge | $650 | $0.43 |

*Economies of scale reduce per-user costs at higher volumes*

---

## Annual Cost Projections

| Deployment | Monthly | Annual | 3-Year |
|------------|---------|--------|--------|
| Option A (Basic) | $156 | $1,878 | $5,634 |
| Option B (Production) | $223 | $2,675 | $8,025 |
| Option B + Reserved Instances | $175 | $2,100 | $6,300 |

---

## Critical Findings

### 1. Instance Sizing Issue

**Problem**: Default Terraform uses t3.small (2 GB RAM)
**Reality**: AI Services alone need 2-4 GB RAM
**Solution**: Change to t3.large minimum in `terraform.tfvars`

```hcl
instance_type = "t3.large"  # Not t3.small
```

### 2. No High Availability

**Current State**: Single EC2 instance = single point of failure
**Risk**: Full outage during instance failure or maintenance
**Mitigation**: Consider multi-AZ deployment for critical environments

### 3. Database on EC2

**Current State**: PostgreSQL runs in Docker on EC2
**Risks**: No automated backups, manual failover, data loss potential
**Recommendation**: Migrate to RDS for production (~$50/month additional)

### 4. S3 Lifecycle Optimization

**Current State**: Already configured with optimal tiering
- Standard (0-90 days)
- Standard-IA (90-365 days) - 40% cheaper
- Glacier (365+ days) - 80% cheaper

**Savings**: ~60% reduction in storage costs over 2 years

### 5. OpenAI API Usage

| Usage Level | Monthly API Cost | Notes |
|-------------|------------------|-------|
| Light | $20-40 | Basic symptom checking |
| Moderate | $50-80 | Regular AI diagnosis |
| Heavy | $100-200 | Extensive imaging analysis |

---

## Recommendations

### Immediate Actions (No Additional Cost)

1. Update `instance_type` to t3.large in Terraform
2. Configure CloudWatch alarms for CPU/memory
3. Restrict SSH access CIDR ranges
4. Enable EBS encryption (already configured)

### Short-Term (Improves Reliability)

| Change | Additional Cost | Benefit |
|--------|-----------------|---------|
| Migrate to RDS | +$50/month | Automated backups, failover |
| Add ElastiCache | +$12/month | Managed Redis, persistence |
| Enable WAF | +$5/month | DDoS protection |
| EBS Snapshots | +$5/month | Point-in-time recovery |

### Long-Term (Enterprise Scale)

| Change | Impact | Use Case |
|--------|--------|----------|
| ECS/Fargate migration | +30% cost | Auto-scaling, orchestration |
| Multi-AZ deployment | +50% cost | High availability |
| CloudFront CDN | +$50-100 | Global performance |
| AWS Bedrock | Replace OpenAI | Reduce API dependency |

---

## Cost Optimization Strategies

### Reserved Instances
- 1-year commitment: 40% savings on EC2
- 3-year commitment: 60% savings on EC2
- Apply to: EC2, RDS, ElastiCache

### Spot Instances (Dev/Test Only)
- Up to 90% savings for non-production
- Not suitable for production workloads

### Right-Sizing
- Monitor actual usage via CloudWatch
- Downsize if average CPU < 20%
- Upsize if CPU spikes > 80%

### Storage Optimization
- S3 Intelligent Tiering: Automatic cost optimization
- Delete unused EBS snapshots
- Compress database backups

---

## Summary Table

| Metric | Option A (Basic) | Option B (Production) |
|--------|------------------|----------------------|
| Monthly Cost | $156 | $223 |
| Annual Cost | $1,878 | $2,675 |
| Per User/Month | $0.39 | $0.56 |
| Per User/Year | $4.70 | $6.69 |
| Best For | Pilot/Dev | Production |
| Reliability | Low | Medium-High |
| Scalability | Limited | Good |

---

## Appendix: AWS Pricing References (US-East-1)

| Resource | Hourly/Monthly | Source |
|----------|----------------|--------|
| t3.small | $0.0208/hr (~$15/mo) | EC2 On-Demand |
| t3.medium | $0.0416/hr (~$30/mo) | EC2 On-Demand |
| t3.large | $0.0832/hr (~$61/mo) | EC2 On-Demand |
| t3.xlarge | $0.1664/hr (~$122/mo) | EC2 On-Demand |
| gp3 EBS | $0.08/GB/mo | EBS Pricing |
| ALB | $0.0225/hr (~$16/mo) | ELB Pricing |
| S3 Standard | $0.023/GB/mo | S3 Pricing |
| S3 IA | $0.0125/GB/mo | S3 Pricing |
| S3 Glacier | $0.004/GB/mo | S3 Pricing |
| RDS db.t3.medium | $0.068/hr (~$49/mo) | RDS Pricing |

*Prices as of January 2026. Verify at aws.amazon.com/pricing*
