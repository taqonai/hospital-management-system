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

# HTTP Listener (redirects to HTTPS or serves directly)
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

# Listener Rule for API
resource "aws_lb_listener_rule" "api" {
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

# Listener Rule for AI Services
resource "aws_lb_listener_rule" "ai" {
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
