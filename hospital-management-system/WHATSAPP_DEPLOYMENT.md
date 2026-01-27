# WhatsApp Bot Production Deployment Guide

## Issue Identified

The WhatsApp bot webhook is receiving messages but not responding because **Twilio credentials are missing from the production environment**.

## Solution

### Step 1: Update Production Environment Variables

SSH into your production server and update the environment file:

```bash
ssh your-production-server
cd /opt/hms/app  # or your deployment directory
```

Edit the `.env.production` file (or create it if it doesn't exist):

```bash
nano .env.production
```

Add these lines to the file:

```bash
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

Save and exit (Ctrl+X, Y, Enter in nano).

### Step 2: Restart the Backend Service

Restart the backend container to pick up the new environment variables:

```bash
docker-compose -f infrastructure/docker/docker-compose.prod.yml restart backend
```

Or if using a different compose file:

```bash
docker-compose restart backend
```

### Step 3: Verify the Fix

Check backend logs to ensure Twilio is initialized:

```bash
docker logs hms-backend --tail 50
```

You should NOT see any errors about "Twilio credentials not configured".

### Step 4: Test WhatsApp Bot

1. Send "Hi" from WhatsApp (+971544403259) to +1 415 523 8886
2. You should receive the welcome message within 2-3 seconds

Expected response:
```
👋 Welcome to Spetaar HMS! I'm your AI health assistant.

Are you a new patient or do you already have an account?

1. New Patient
2. Existing Patient
```

## Verification Checklist

- [ ] Environment variables added to production .env file
- [ ] Backend container restarted
- [ ] No Twilio credential errors in logs
- [ ] WhatsApp test message received bot response
- [ ] Can complete full appointment booking flow

## Troubleshooting

### If bot still doesn't respond:

1. **Check backend logs:**
   ```bash
   docker logs hms-backend -f
   ```
   Look for errors when webhook is called.

2. **Verify Twilio webhook configuration:**
   - Go to: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
   - Confirm webhook URL is: `https://spetaar.ai/api/v1/whatsapp-bot/webhook`
   - Confirm method is: POST

3. **Test webhook directly:**
   ```bash
   curl -X POST https://spetaar.ai/api/v1/whatsapp-bot/webhook \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "From=whatsapp:+971544403259&Body=test&MessageSid=test123"
   ```
   Should return "OK" with status 200.

4. **Check Redis is running:**
   ```bash
   docker ps | grep redis
   docker logs hms-redis
   ```

5. **Check AI service is accessible:**
   ```bash
   docker ps | grep ai-services
   curl http://localhost:8000/health
   ```

## Security Note

The Twilio credentials in this file are for the sandbox environment. For production WhatsApp Business API:

1. Apply for Twilio WhatsApp Business Account
2. Get your own verified WhatsApp number
3. Update credentials in production environment
4. Update TWILIO_WHATSAPP_NUMBER to your business number

## Files Changed

- `infrastructure/docker/docker-compose.prod.yml` - Added Twilio env vars to backend service
- `infrastructure/.env.production.example` - Created example production env file
- `WHATSAPP_DEPLOYMENT.md` - This deployment guide
