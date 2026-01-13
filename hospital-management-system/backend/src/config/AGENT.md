# AGENT.md - Backend Config Directory

## Purpose

This directory contains configuration management for the backend application, including environment variables, database connection, and service configuration.

## Directory Structure

```
config/
├── index.ts      # Main configuration - loads and exports all env vars
└── database.ts   # Prisma client initialization and connection
```

## File Details

### index.ts - Main Configuration

**Purpose:** Loads environment variables from `.env` and exports typed configuration object.

**Configuration Sections:**

```typescript
export const config = {
  // Application
  env: string,           // NODE_ENV: development | staging | production
  port: number,          // PORT: default 3001
  apiVersion: string,    // API_VERSION: default 'v1'

  // Database
  database: {
    url: string,         // DATABASE_URL: PostgreSQL connection string
  },

  // JWT Authentication
  jwt: {
    secret: string,          // JWT_SECRET
    refreshSecret: string,   // JWT_REFRESH_SECRET
    expiresIn: string,       // JWT_EXPIRES_IN: default '15m'
    refreshExpiresIn: string,// JWT_REFRESH_EXPIRES_IN: default '7d'
  },

  // Redis (caching/sessions)
  redis: {
    host: string,        // REDIS_HOST: default 'localhost'
    port: number,        // REDIS_PORT: default 6379
    password?: string,   // REDIS_PASSWORD
  },

  // AWS Services
  aws: {
    accessKeyId: string,
    secretAccessKey: string,
    region: string,          // AWS_REGION: default 'us-east-1'
    s3Bucket: string,        // AWS_S3_BUCKET: medical image storage
    ses: {
      region: string,
      accessKeyId: string,
      secretAccessKey: string,
      fromEmail: string,     // AWS_SES_FROM_EMAIL
    },
  },

  // Twilio (SMS/WhatsApp)
  twilio: {
    accountSid: string,      // TWILIO_ACCOUNT_SID
    authToken: string,       // TWILIO_AUTH_TOKEN
    phoneNumber: string,     // TWILIO_PHONE_NUMBER
    whatsappNumber: string,  // TWILIO_WHATSAPP_NUMBER
  },

  // Notification Toggles
  notifications: {
    emailEnabled: boolean,    // NOTIFICATIONS_EMAIL_ENABLED
    smsEnabled: boolean,      // NOTIFICATIONS_SMS_ENABLED
    whatsappEnabled: boolean, // NOTIFICATIONS_WHATSAPP_ENABLED
  },

  // SMTP Email (alternative to SES)
  email: {
    host: string,
    port: number,
    user: string,
    pass: string,
    from: string,
  },

  // AI Services
  ai: {
    serviceUrl: string,       // AI_SERVICE_URL: default 'http://localhost:8000'
    apiKey: string,           // AI_API_KEY
    symptomCheckerUrl: string,// SYMPTOM_CHECKER_URL
  },

  // Rate Limiting
  rateLimit: {
    windowMs: number,        // RATE_LIMIT_WINDOW_MS: default 900000 (15min)
    max: number,             // RATE_LIMIT_MAX: default 100
  },

  // Encryption
  encryption: {
    key: string,             // ENCRYPTION_KEY: 32-char key for AES
  },
};
```

**Usage:**
```typescript
import { config } from '../config';

// Access configuration
const port = config.port;
const jwtSecret = config.jwt.secret;
const aiUrl = config.ai.serviceUrl;
```

---

### database.ts - Prisma Client

**Purpose:** Initializes and exports Prisma client with environment-appropriate logging.

**Exports:**
```typescript
// Prisma client instance
export const prisma: PrismaClient;

// Connection management
export async function connectDatabase(): Promise<void>;
export async function disconnectDatabase(): Promise<void>;

// Default export
export default prisma;
```

**Logging Configuration:**
- **Development:** Query, info, warn, error logs
- **Production:** Error logs only

**Global Instance Pattern:**
```typescript
// Prevents multiple Prisma instances in development (hot reload)
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({ ... });

if (config.env !== 'production') {
  global.prisma = prisma;
}
```

**Usage:**
```typescript
import prisma from '../config/database';

// Direct usage
const patients = await prisma.patient.findMany();

// In services (preferred)
import prisma from '../config/database';

class PatientService {
  async findAll(hospitalId: string) {
    return prisma.patient.findMany({
      where: { hospitalId, isActive: true },
    });
  }
}
```

## Environment Variables Reference

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |

### Optional Variables (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment mode |
| `PORT` | 3001 | Server port |
| `AI_SERVICE_URL` | http://localhost:8000 | AI services endpoint |
| `REDIS_HOST` | localhost | Redis server host |
| `REDIS_PORT` | 6379 | Redis server port |

### External Service Variables

```bash
# AWS S3/SES
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=hospital-medical-images
AWS_SES_FROM_EMAIL=noreply@example.com

# Twilio SMS/WhatsApp
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Notification Toggles
NOTIFICATIONS_EMAIL_ENABLED=true
NOTIFICATIONS_SMS_ENABLED=false
NOTIFICATIONS_WHATSAPP_ENABLED=false
```

## Sample .env File

```bash
# Environment
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hospital_db

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-token-secret-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AI Services
AI_SERVICE_URL=http://localhost:8000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS (optional - use MinIO locally)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=hospital-medical-images

# Encryption
ENCRYPTION_KEY=32-character-encryption-key-here
```

## Dependencies

### Internal
- `.env` file in backend root

### External
- `dotenv` - Environment variable loading
- `@prisma/client` - Database ORM

## Common Operations

### Adding New Configuration

1. Add environment variable to `.env`:
```bash
NEW_SERVICE_URL=http://localhost:9000
```

2. Add to config object in `index.ts`:
```typescript
export const config = {
  // ... existing config
  newService: {
    url: process.env.NEW_SERVICE_URL || 'http://localhost:9000',
  },
};
```

3. Use in application:
```typescript
import { config } from '../config';
const url = config.newService.url;
```

### Database Connection Check

```typescript
import { connectDatabase } from '../config/database';

// In app.ts startup
async function bootstrap() {
  await connectDatabase();
  // ... start server
}
```

## Related Files

- `/.env` - Environment variables (not committed)
- `/.env.example` - Template for environment variables
- `/prisma/schema.prisma` - Database schema
- `/src/services/*` - Services that use config

## Common Issues and Solutions

### Issue: "DATABASE_URL is not defined"
- Ensure `.env` file exists in backend root
- Check `.env` has `DATABASE_URL` set
- Verify dotenv is loading (check path in config/index.ts)

### Issue: "Cannot connect to database"
- Verify PostgreSQL is running
- Check DATABASE_URL format: `postgresql://user:pass@host:port/dbname`
- Ensure database exists: `createdb hospital_db`

### Issue: "Prisma Client not generated"
- Run `npx prisma generate` after schema changes
- Ensure node_modules exists

### Issue: "JWT_SECRET too weak in production"
- Use strong random string (32+ characters)
- Generate with: `openssl rand -base64 32`
- Never use default values in production
