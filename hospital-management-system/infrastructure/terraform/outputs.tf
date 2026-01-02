# Output values

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.main.id
}

output "ec2_public_ip" {
  description = "EC2 Elastic IP"
  value       = aws_eip.main.public_ip
}

output "ec2_public_dns" {
  description = "EC2 public DNS"
  value       = aws_eip.main.public_dns
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = var.create_alb ? aws_lb.main[0].dns_name : null
}

output "alb_zone_id" {
  description = "ALB zone ID (for Route53)"
  value       = var.create_alb ? aws_lb.main[0].zone_id : null
}

output "frontend_url" {
  description = "Frontend URL"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : (var.create_alb ? "http://${aws_lb.main[0].dns_name}" : "http://${aws_eip.main.public_ip}:3000")
}

output "backend_url" {
  description = "Backend API URL"
  value       = var.domain_name != "" ? "https://${var.domain_name}/api/v1" : (var.create_alb ? "http://${aws_lb.main[0].dns_name}/api/v1" : "http://${aws_eip.main.public_ip}:3001/api/v1")
}

output "acm_certificate_arn" {
  description = "ACM Certificate ARN"
  value       = var.domain_name != "" ? aws_acm_certificate.main[0].arn : null
}

output "acm_certificate_validation" {
  description = "ACM Certificate DNS validation records (add these to your DNS)"
  value = var.domain_name != "" ? [
    for dvo in aws_acm_certificate.main[0].domain_validation_options : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ] : null
}

output "ai_services_url" {
  description = "AI Services URL"
  value       = "http://${aws_eip.main.public_ip}:8000"
}

output "ssh_command" {
  description = "SSH command to connect to EC2"
  value       = var.key_name != "" ? "ssh -i ${var.key_name}.pem ec2-user@${aws_eip.main.public_ip}" : "SSH key not configured"
}

output "security_group_id" {
  description = "EC2 Security Group ID"
  value       = aws_security_group.ec2.id
}
