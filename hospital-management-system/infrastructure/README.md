# HMS Infrastructure

AWS Infrastructure as Code for the Hospital Management System.

## Architecture

Single EC2 instance running all services via Docker Compose:

```
Internet → ALB → EC2 (t3.small)
                   ├── Nginx (reverse proxy)
                   ├── Frontend (React)
                   ├── Backend (Node.js)
                   ├── AI Services (Python)
                   ├── PostgreSQL
                   └── Redis
```

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0 installed
3. **SSH Key Pair** created in AWS (for EC2 access)

## Quick Start

### 1. Configure Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:
- `key_name`: Your AWS SSH key pair name
- `db_password`: Strong database password
- `jwt_secret`: JWT signing key (32+ characters)
- `jwt_refresh_secret`: JWT refresh key (32+ characters)
- `allowed_ssh_cidrs`: Your IP for SSH access

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Review Plan

```bash
terraform plan
```

### 4. Deploy

```bash
terraform apply
```

### 5. Access Application

After deployment (~5-10 minutes for services to start):

```bash
# Get outputs
terraform output

# SSH into instance
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

# Check service status
sudo docker ps
sudo docker-compose logs -f
```

## Outputs

| Output | Description |
|--------|-------------|
| `ec2_public_ip` | EC2 Elastic IP address |
| `alb_dns_name` | Application Load Balancer DNS |
| `frontend_url` | Frontend application URL |
| `backend_url` | Backend API URL |
| `ssh_command` | SSH command to connect |

## Cost Estimate

| Resource | Monthly Cost |
|----------|-------------|
| EC2 t3.small | ~$15 |
| ALB | ~$20 |
| EBS 50GB | ~$5 |
| Data Transfer | ~$5-15 |
| **Total** | **~$45-55** |

## Scaling Up

To upgrade instance size:

1. Edit `terraform.tfvars`:
   ```hcl
   instance_type = "t3.medium"  # or t3.large
   ```

2. Apply changes:
   ```bash
   terraform apply
   ```

## Maintenance

### SSH Access

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

### View Logs

```bash
# All services
sudo docker-compose logs -f

# Specific service
sudo docker-compose logs -f backend
```

### Restart Services

```bash
cd /opt/hms/app
sudo docker-compose restart
```

### Update Application

```bash
cd /opt/hms/app
sudo git pull
sudo docker-compose up -d --build
```

### Database Backup

```bash
# Create backup
sudo docker exec hms-postgres pg_dump -U postgres hospital_db > backup.sql

# Restore backup
sudo docker exec -i hms-postgres psql -U postgres hospital_db < backup.sql
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

## Security Notes

1. **SSH Access**: Restrict `allowed_ssh_cidrs` to your IP only
2. **Secrets**: Use AWS Secrets Manager for production secrets
3. **SSL/TLS**: Configure ACM certificate for HTTPS
4. **Backups**: Set up automated EBS snapshots
5. **Monitoring**: Enable CloudWatch alarms

## Directory Structure

```
infrastructure/
├── terraform/
│   ├── main.tf              # Provider config
│   ├── variables.tf         # Input variables
│   ├── outputs.tf           # Output values
│   ├── vpc.tf               # VPC, subnets, SGs
│   ├── ec2.tf               # EC2, EBS, IAM
│   ├── alb.tf               # Load balancer
│   └── terraform.tfvars.example
├── scripts/
│   └── user-data.sh         # EC2 bootstrap
├── docker/
│   └── docker-compose.prod.yml
├── nginx/
│   └── nginx.conf
└── README.md
```
