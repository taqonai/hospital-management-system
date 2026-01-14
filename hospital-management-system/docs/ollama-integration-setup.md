# Ollama Integration Setup for HMS

This document details the configuration changes made to connect the Hospital Management System (HMS) running on AWS EC2 to a local Ollama instance for AI inference.

## Overview

**Problem:** HMS on EC2 needed to use a local Ollama server (on 192.168.0.140) instead of OpenAI for AI features like the Diagnostic Analyzer.

**Solution:** SSH reverse tunnel + infrastructure configuration changes to route AI requests through the local Ollama server.

---

## Architecture

```
User Browser
    ↓
Cloudflare (spetaar.ai) ──→ For static frontend only
    ↓
AWS ALB (api.spetaar.ai) ──→ For API calls (bypasses Cloudflare)
    ↓
EC2 Instance (54.204.198.174)
    ├── Frontend (port 3000) - nginx serving React app
    ├── Backend (port 3001) - Node.js/Express
    └── AI Services (port 8000) - Python/FastAPI
            ↓
        Docker Gateway (172.18.0.1:11435)
            ↓
        socat forwarder (0.0.0.0:11435 → localhost:11434)
            ↓
        SSH Reverse Tunnel (localhost:11434)
            ↓
Local Ollama Server (192.168.0.140:11434)
```

---

## 1. SSH Reverse Tunnel Setup

### Purpose
Expose local Ollama (192.168.0.140:11434) to EC2 without opening firewall ports.

### Commands (run on local Ollama machine - 192.168.0.140)

```bash
# Push SSH key to EC2 (keys expire in 60 seconds)
aws ec2-instance-connect send-ssh-public-key \
  --region us-east-1 \
  --instance-id i-0bd4f7bc06e8cd8df \
  --instance-os-user ec2-user \
  --ssh-public-key "file://$HOME/.ssh/id_ed25519.pub"

# Create reverse tunnel (run immediately after above)
ssh -R 11434:localhost:11434 \
  -o StrictHostKeyChecking=no \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  ec2-user@54.204.198.174 -N -f
```

### Persistent Tunnel with Screen
```bash
screen -S ollama-tunnel
# Then run the two commands above
# Detach with Ctrl+A, D
```

---

## 2. socat Port Forwarder (on EC2)

### Purpose
The SSH tunnel binds to `localhost:11434` which isn't accessible from Docker containers. socat forwards from all interfaces to localhost.

### Setup (on EC2)
```bash
# Install socat
sudo yum install -y socat

# Create forwarder (port 11435 → 11434)
sudo nohup socat TCP-LISTEN:11435,fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:11434 > /tmp/socat.log 2>&1 &
```

### Verification
```bash
# From EC2 host
curl http://localhost:11434/api/tags

# From Docker container
curl http://172.18.0.1:11435/api/tags
```

---

## 3. Database Configuration

### Hospital AI Provider Settings
The Ollama endpoint is stored in the `hospitals` table in PostgreSQL.

```sql
-- View current settings
SELECT name, settings->'aiProvider' FROM hospitals WHERE name = 'City General Hospital';

-- Update Ollama endpoint (Docker gateway IP + socat port)
UPDATE hospitals
SET settings = jsonb_set(
    settings,
    '{aiProvider,ollamaEndpoint}',
    '"http://172.18.0.1:11435"'
)
WHERE name = 'City General Hospital';
```

### Current Configuration
```json
{
  "provider": "ollama",
  "ollamaEndpoint": "http://172.18.0.1:11435",
  "ollamaModels": {
    "simple": "spetaar:20b-128k",
    "complex": "spetaar:20b-128k"
  }
}
```

---

## 4. Code Changes for Ollama Support

### 4.1 AI Services (Python)

**File: `ai-services/main.py`**
- Added `hospitalConfig` field to `DiagnosisRequest` model
- Updated `/api/diagnose` endpoint to parse and pass `hospitalConfig`

```python
class DiagnosisRequest(BaseModel):
    symptoms: List[str]
    patientAge: int
    gender: str
    # ... other fields
    hospitalConfig: Optional[HospitalConfigModel] = None  # Added
```

**File: `ai-services/diagnostic/service.py`**
- Imported `HospitalAIConfig` from `shared.llm_provider`
- Updated `GPTDiagnosticAnalyzer` methods to accept `hospital_config` parameter
- Changed from `chat_completion_json()` to `chat_completion_json_with_config()`
- Updated `DiagnosticAI.analyze()` to pass `hospital_config` to all LLM calls

**File: `ai-services/shared/llm_provider.py`**
- Added 5-minute timeout to Ollama client initialization

```python
self._client = OpenAI(
    base_url=f"{self.base_url}/v1",
    api_key="ollama",
    timeout=300.0,  # 5 minutes for large model inference
)
```

### 4.2 Backend (Node.js)

**File: `backend/src/services/aiService.ts`**
- Increased axios timeout from 120s to 300s (5 minutes)

```typescript
private aiClient = axios.create({
  baseURL: config.ai.serviceUrl,
  timeout: 300000, // 5 minutes for Ollama AI operations
});
```

### 4.3 Frontend (React)

**File: `frontend/src/services/api.ts`**
- Increased AI diagnosis timeout from 60s to 300s

```typescript
analyzeDiagnosis: (data) => api.post('/ai/diagnose', data, { timeout: 300000 }),
```

---

## 5. AWS Infrastructure Changes

### 5.1 ALB Idle Timeout
Increased from 60 seconds to 300 seconds (5 minutes).

```bash
aws elbv2 modify-load-balancer-attributes \
  --region us-east-1 \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:842533680157:loadbalancer/app/hms-prod-alb/77e9bbf4b70a9510 \
  --attributes Key=idle_timeout.timeout_seconds,Value=300
```

### 5.2 Wildcard SSL Certificate
Created `*.spetaar.ai` certificate for API subdomain.

```bash
# Certificate ARN
arn:aws:acm:us-east-1:842533680157:certificate/c00891d6-e07f-45b9-ae4c-4633557b92f2
```

### 5.3 ALB Certificate Configuration
Added wildcard certificate to HTTPS listener (port 443).

```bash
aws elbv2 add-listener-certificates \
  --region us-east-1 \
  --listener-arn arn:aws:elasticloadbalancing:us-east-1:842533680157:listener/app/hms-prod-alb/77e9bbf4b70a9510/41f44b4af14247c0 \
  --certificates CertificateArn=arn:aws:acm:us-east-1:842533680157:certificate/c00891d6-e07f-45b9-ae4c-4633557b92f2
```

---

## 6. Cloudflare Configuration

### DNS Records Added

| Type | Name | Target | Proxy Status |
|------|------|--------|--------------|
| CNAME | `_36ee4b0d2a45675298fbcfcd3ea60752` | `_2f207dd149dbf2008372fc91dde1b9c0.jkddzztszm.acm-validations.aws.` | DNS only |
| CNAME | `api` | `hms-prod-alb-881016293.us-east-1.elb.amazonaws.com` | DNS only |

### Why API Subdomain?
Cloudflare's proxy has a **100-second timeout** (non-configurable on free/pro plans). By using DNS-only mode for `api.spetaar.ai`, API requests bypass Cloudflare and go directly to ALB with its 5-minute timeout.

---

## 7. Docker Compose Changes

**File: `docker-compose.yml`**

### Frontend API URL
```yaml
frontend:
  environment:
    VITE_API_URL: https://api.spetaar.ai/api/v1
```

### Backend Rate Limiting
```yaml
backend:
  environment:
    RATE_LIMIT_MAX: "5000"
    RATE_LIMIT_WINDOW_MS: "900000"
```

---

## 8. Timeout Chain Summary

| Layer | Timeout | Configuration Location |
|-------|---------|------------------------|
| Frontend (axios) | 5 min | `frontend/src/services/api.ts` |
| Cloudflare | Bypassed | DNS-only mode for api.spetaar.ai |
| AWS ALB | 5 min | ALB attributes |
| Backend (axios) | 5 min | `backend/src/services/aiService.ts` |
| AI Services (OpenAI client) | 5 min | `ai-services/shared/llm_provider.py` |

---

## 9. Troubleshooting

### Check SSH Tunnel Status (on Ollama machine)
```bash
ps aux | grep "ssh -R 11434" | grep -v grep
```

### Check socat Status (on EC2)
```bash
ps aux | grep socat | grep -v grep
```

### Test Ollama Connection (on EC2)
```bash
# Direct tunnel
curl http://localhost:11434/api/tags

# Via socat (as Docker sees it)
curl http://172.18.0.1:11435/api/tags
```

### Restart Tunnel
```bash
# On Ollama machine (192.168.0.140)
pkill -f "ssh -R 11434"

# Then re-run the SSH commands from Section 1
```

### View AI Service Logs
```bash
cd /opt/hms/app/hospital-management-system
sudo docker-compose logs --tail=50 ai-services | grep -i "diagnos\|ollama"
```

---

## 10. Key Information

| Item | Value |
|------|-------|
| EC2 Instance ID | i-0bd4f7bc06e8cd8df |
| EC2 Public IP | 54.204.198.174 |
| EC2 Private IP | 10.0.1.60 |
| ALB DNS | hms-prod-alb-881016293.us-east-1.elb.amazonaws.com |
| Ollama Machine | 192.168.0.140 (hostname: hulk) |
| Docker Gateway IP | 172.18.0.1 |
| Tunnel Port | 11434 (localhost) |
| socat Port | 11435 (all interfaces) |
| API URL | https://api.spetaar.ai/api/v1 |
| Frontend URL | https://spetaar.ai |

---

## 11. Files Modified

| File | Changes |
|------|---------|
| `ai-services/main.py` | Added hospitalConfig to DiagnosisRequest, updated /api/diagnose endpoint |
| `ai-services/diagnostic/service.py` | Added hospital_config support to all GPT methods |
| `ai-services/shared/llm_provider.py` | Added 5-minute timeout to Ollama client |
| `backend/src/services/aiService.ts` | Increased timeout to 5 minutes |
| `frontend/src/services/api.ts` | Increased AI diagnosis timeout to 5 minutes |
| `docker-compose.yml` | Updated VITE_API_URL, added rate limit config |

---

*Document created: 2026-01-14*
*Last updated: 2026-01-14*
