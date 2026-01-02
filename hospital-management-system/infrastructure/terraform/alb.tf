# Application Load Balancer Configuration

# ALB
resource "aws_lb" "main" {
  count = var.create_alb ? 1 : 0

  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb[0].id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

# ACM Certificate for HTTPS
resource "aws_acm_certificate" "main" {
  count = var.create_alb && var.domain_name != "" ? 1 : 0

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cert"
  }
}

# Target Group for Frontend
resource "aws_lb_target_group" "frontend" {
  count = var.create_alb ? 1 : 0

  name     = "${var.project_name}-${var.environment}-frontend-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-frontend-tg"
  }
}

# Target Group for Backend API
resource "aws_lb_target_group" "backend" {
  count = var.create_alb ? 1 : 0

  name     = "${var.project_name}-${var.environment}-backend-tg"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/v1/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backend-tg"
  }
}

# Target Group for AI Services
resource "aws_lb_target_group" "ai_services" {
  count = var.create_alb ? 1 : 0

  name     = "${var.project_name}-${var.environment}-ai-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ai-tg"
  }
}

# Register EC2 with Target Groups
resource "aws_lb_target_group_attachment" "frontend" {
  count = var.create_alb ? 1 : 0

  target_group_arn = aws_lb_target_group.frontend[0].arn
  target_id        = aws_instance.main.id
  port             = 3000
}

resource "aws_lb_target_group_attachment" "backend" {
  count = var.create_alb ? 1 : 0

  target_group_arn = aws_lb_target_group.backend[0].arn
  target_id        = aws_instance.main.id
  port             = 3001
}

resource "aws_lb_target_group_attachment" "ai_services" {
  count = var.create_alb ? 1 : 0

  target_group_arn = aws_lb_target_group.ai_services[0].arn
  target_id        = aws_instance.main.id
  port             = 8000
}

# HTTP Listener - Forward to frontend (HTTPS redirect enabled after certificate validation)
resource "aws_lb_listener" "http" {
  count = var.create_alb ? 1 : 0

  load_balancer_arn = aws_lb.main[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend[0].arn
  }
}

# HTTP to HTTPS Redirect Listener Rule (only after HTTPS is ready)
resource "aws_lb_listener_rule" "https_redirect" {
  count = var.create_alb && var.domain_name != "" ? 1 : 0

  listener_arn = aws_lb_listener.http[0].arn
  priority     = 1

  action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  depends_on = [aws_lb_listener.https]
}

# ACM Certificate Validation (waits for DNS validation)
resource "aws_acm_certificate_validation" "main" {
  count = var.create_alb && var.domain_name != "" ? 1 : 0

  certificate_arn = aws_acm_certificate.main[0].arn

  timeouts {
    create = "30m"
  }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  count = var.create_alb && var.domain_name != "" ? 1 : 0

  load_balancer_arn = aws_lb.main[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend[0].arn
  }
}

# Listener Rule for API (HTTP - always enabled)
resource "aws_lb_listener_rule" "api_http" {
  count = var.create_alb ? 1 : 0

  listener_arn = aws_lb_listener.http[0].arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend[0].arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# Listener Rule for API (HTTPS)
resource "aws_lb_listener_rule" "api_https" {
  count = var.create_alb && var.domain_name != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend[0].arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# Listener Rule for AI Services (HTTP - always enabled)
resource "aws_lb_listener_rule" "ai_http" {
  count = var.create_alb ? 1 : 0

  listener_arn = aws_lb_listener.http[0].arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ai_services[0].arn
  }

  condition {
    path_pattern {
      values = ["/ai/*"]
    }
  }
}

# Listener Rule for AI Services (HTTPS)
resource "aws_lb_listener_rule" "ai_https" {
  count = var.create_alb && var.domain_name != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ai_services[0].arn
  }

  condition {
    path_pattern {
      values = ["/ai/*"]
    }
  }
}
