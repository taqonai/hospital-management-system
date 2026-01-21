# CloudWatch Monitoring for Cron Job Health
# Monitors the NO_SHOW cron job and alerts on failures

# ============================================
# VARIABLES
# ============================================

variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
  default     = ""
}

variable "cron_api_key" {
  description = "API key for external cron trigger"
  type        = string
  sensitive   = true
  default     = ""
}

variable "backend_url" {
  description = "Backend API URL (e.g., https://spetaar.ai)"
  type        = string
  default     = "http://localhost:3001"
}

# ============================================
# SNS TOPIC FOR ALERTS
# ============================================

resource "aws_sns_topic" "cron_alerts" {
  name = "${var.project_name}-cron-alerts-${var.environment}"

  tags = {
    Name = "${var.project_name}-cron-alerts"
  }
}

resource "aws_sns_topic_subscription" "cron_alerts_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.cron_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ============================================
# IAM ROLE FOR LAMBDA
# ============================================

resource "aws_iam_role" "cron_health_lambda" {
  name = "${var.project_name}-cron-health-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-cron-health-lambda-role"
  }
}

resource "aws_iam_role_policy" "cron_health_lambda" {
  name = "${var.project_name}-cron-health-lambda-policy"
  role = aws_iam_role.cron_health_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.cron_alerts.arn
      }
    ]
  })
}

# ============================================
# LAMBDA FUNCTION
# ============================================

data "archive_file" "cron_health_lambda" {
  type        = "zip"
  output_path = "${path.module}/lambda/cron_health.zip"

  source {
    content  = <<-EOF
      const https = require('https');
      const http = require('http');

      exports.handler = async (event) => {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        const cronApiKey = process.env.CRON_API_KEY || '';
        const snsTopicArn = process.env.SNS_TOPIC_ARN || '';

        const healthUrl = `$${backendUrl}/api/v1/no-show/cron-health`;
        const triggerUrl = `$${backendUrl}/api/v1/no-show/external-trigger`;

        console.log('Checking cron health at:', healthUrl);

        try {
          // First, try to get health status (requires auth, so we use external trigger instead)
          // Call external trigger which also returns health info
          const result = await makeRequest(triggerUrl, 'POST', {
            'x-cron-api-key': cronApiKey,
            'Content-Type': 'application/json'
          });

          console.log('Health check result:', JSON.stringify(result));

          const isHealthy = result.success && result.data && result.data.success;
          const metricValue = isHealthy ? 1 : 0;

          // Put metric to CloudWatch
          const { CloudWatch } = require('@aws-sdk/client-cloudwatch');
          const cloudwatch = new CloudWatch();

          await cloudwatch.putMetricData({
            Namespace: 'HMS/CronJobs',
            MetricData: [
              {
                MetricName: 'CronHealthStatus',
                Value: metricValue,
                Unit: 'Count',
                Dimensions: [
                  { Name: 'JobName', Value: 'NO_SHOW_CHECK' },
                  { Name: 'Environment', Value: process.env.ENVIRONMENT || 'prod' }
                ]
              },
              {
                MetricName: 'CronExecutionDuration',
                Value: result.data?.duration || 0,
                Unit: 'Milliseconds',
                Dimensions: [
                  { Name: 'JobName', Value: 'NO_SHOW_CHECK' },
                  { Name: 'Environment', Value: process.env.ENVIRONMENT || 'prod' }
                ]
              }
            ]
          });

          console.log('Metrics published successfully');

          return {
            statusCode: 200,
            body: JSON.stringify({
              healthy: isHealthy,
              result: result
            })
          };

        } catch (error) {
          console.error('Health check failed:', error.message);

          // Put failure metric
          const { CloudWatch } = require('@aws-sdk/client-cloudwatch');
          const cloudwatch = new CloudWatch();

          await cloudwatch.putMetricData({
            Namespace: 'HMS/CronJobs',
            MetricData: [
              {
                MetricName: 'CronHealthStatus',
                Value: 0,
                Unit: 'Count',
                Dimensions: [
                  { Name: 'JobName', Value: 'NO_SHOW_CHECK' },
                  { Name: 'Environment', Value: process.env.ENVIRONMENT || 'prod' }
                ]
              }
            ]
          });

          // Send alert via SNS
          if (snsTopicArn) {
            const { SNS } = require('@aws-sdk/client-sns');
            const sns = new SNS();

            await sns.publish({
              TopicArn: snsTopicArn,
              Subject: '[ALERT] HMS Cron Health Check Failed',
              Message: `The HMS cron health check failed.

Error: $${error.message}
Time: $${new Date().toISOString()}
URL: $${healthUrl}

Please check the backend logs and health status.

Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=$${process.env.AWS_REGION}#metricsV2:graph=~()
              `
            });
          }

          return {
            statusCode: 500,
            body: JSON.stringify({
              healthy: false,
              error: error.message
            })
          };
        }
      };

      function makeRequest(url, method, headers) {
        return new Promise((resolve, reject) => {
          const parsedUrl = new URL(url);
          const protocol = parsedUrl.protocol === 'https:' ? https : http;

          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname,
            method: method,
            headers: headers,
            timeout: 30000
          };

          const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error(`Invalid JSON response: $${data}`));
              }
            });
          });

          req.on('error', reject);
          req.on('timeout', () => reject(new Error('Request timeout')));
          req.end();
        });
      }
    EOF
    filename = "index.js"
  }
}

resource "aws_lambda_function" "cron_health" {
  filename         = data.archive_file.cron_health_lambda.output_path
  function_name    = "${var.project_name}-cron-health-${var.environment}"
  role             = aws_iam_role.cron_health_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.cron_health_lambda.output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 60
  memory_size      = 128

  environment {
    variables = {
      BACKEND_URL   = var.backend_url
      CRON_API_KEY  = var.cron_api_key
      SNS_TOPIC_ARN = aws_sns_topic.cron_alerts.arn
      ENVIRONMENT   = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-cron-health-lambda"
  }
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "cron_health_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.cron_health.function_name}"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-cron-health-logs"
  }
}

# ============================================
# EVENTBRIDGE RULE (TRIGGER EVERY 5 MIN)
# ============================================

resource "aws_cloudwatch_event_rule" "cron_health_check" {
  name                = "${var.project_name}-cron-health-check-${var.environment}"
  description         = "Trigger cron health check every 5 minutes during working hours"
  schedule_expression = "rate(5 minutes)"

  tags = {
    Name = "${var.project_name}-cron-health-check-rule"
  }
}

resource "aws_cloudwatch_event_target" "cron_health_check" {
  rule      = aws_cloudwatch_event_rule.cron_health_check.name
  target_id = "cron-health-lambda"
  arn       = aws_lambda_function.cron_health.arn
}

resource "aws_lambda_permission" "cron_health_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cron_health.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cron_health_check.arn
}

# ============================================
# CLOUDWATCH ALARM
# ============================================

resource "aws_cloudwatch_metric_alarm" "cron_unhealthy" {
  alarm_name          = "${var.project_name}-cron-unhealthy-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CronHealthStatus"
  namespace           = "HMS/CronJobs"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Alarm when cron job health check fails for 2 consecutive periods"
  treat_missing_data  = "breaching"

  dimensions = {
    JobName     = "NO_SHOW_CHECK"
    Environment = var.environment
  }

  alarm_actions = [aws_sns_topic.cron_alerts.arn]
  ok_actions    = [aws_sns_topic.cron_alerts.arn]

  tags = {
    Name = "${var.project_name}-cron-unhealthy-alarm"
  }
}

# ============================================
# OUTPUTS
# ============================================

output "sns_topic_arn" {
  description = "ARN of the SNS topic for cron alerts"
  value       = aws_sns_topic.cron_alerts.arn
}

output "lambda_function_name" {
  description = "Name of the cron health Lambda function"
  value       = aws_lambda_function.cron_health.function_name
}

output "cloudwatch_alarm_name" {
  description = "Name of the CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.cron_unhealthy.alarm_name
}

output "eventbridge_rule_name" {
  description = "Name of the EventBridge rule"
  value       = aws_cloudwatch_event_rule.cron_health_check.name
}
