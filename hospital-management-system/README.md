# Hospital Management System (HMS)

A comprehensive Cloud SaaS Hospital Management System with AI-integrated modules for diagnostic assistance, predictive analytics, and medical imaging analysis.

## Features

### Core Modules
- **Patient Management** - Registration, EMR/EHR, medical history
- **Doctor/Staff Management** - Profiles, schedules, specializations
- **Appointment System** - Booking, scheduling, queue management
- **OPD/IPD Management** - Outpatient and inpatient care
- **Laboratory Information System** - Test ordering, results management
- **Radiology Information System** - Imaging orders, PACS integration
- **Pharmacy Management** - Drug inventory, prescriptions
- **Billing & Finance** - Invoicing, insurance claims
- **Emergency Department** - Triage, critical care

### AI-Integrated Modules
- **Diagnostic AI Assistant** - Symptom analysis, differential diagnosis
- **Predictive Analytics** - Readmission risk, length of stay prediction
- **Medical Imaging Analysis** - X-ray, CT, MRI interpretation
- **NLP Module** - Voice-to-text, medical entity extraction
- **Smart Scheduling** - Resource optimization

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript, TailwindCSS, Redux Toolkit |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL 15, Prisma ORM |
| AI Services | Python, FastAPI, TensorFlow, PyTorch |
| Cache | Redis |
| Storage | MinIO (S3-compatible) |
| Container | Docker, Docker Compose |

## Project Structure

```
hospital-management-system/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utilities
│   └── prisma/             # Database schema
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── store/          # Redux store
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
├── ai-services/            # Python AI microservices
│   ├── diagnostic/         # Diagnostic AI
│   ├── predictive/         # Predictive analytics
│   └── imaging/            # Medical imaging AI
└── docker-compose.yml      # Docker orchestration
```

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15 (or use Docker)

### Quick Start with Docker

```bash
# Clone the repository
cd hospital-management-system

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001/api/v1
# AI Services: http://localhost:8000
# MinIO Console: http://localhost:9001
```

### Manual Setup

#### Backend
```bash
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

#### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

#### AI Services
```bash
cd ai-services

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

## API Documentation

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/profile` - Get user profile

### Patients
- `GET /api/v1/patients` - List patients
- `POST /api/v1/patients` - Create patient
- `GET /api/v1/patients/:id` - Get patient details
- `PUT /api/v1/patients/:id` - Update patient
- `GET /api/v1/patients/:id/vitals` - Get patient vitals

### Appointments
- `GET /api/v1/appointments` - List appointments
- `POST /api/v1/appointments` - Create appointment
- `GET /api/v1/appointments/slots/:doctorId` - Get available slots
- `PATCH /api/v1/appointments/:id/status` - Update status

### AI Services
- `POST /api/v1/ai/diagnose` - Symptom analysis
- `POST /api/v1/ai/predict-risk` - Risk prediction
- `POST /api/v1/ai/analyze-image` - Image analysis
- `GET /api/v1/ai/insights/:patientId` - Patient AI insights

## Default Credentials

For development/demo purposes:

- **Email:** admin@hospital.com
- **Password:** password123

## Environment Variables

### Backend
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/hospital_db
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
REDIS_HOST=localhost
REDIS_PORT=6379
AI_SERVICE_URL=http://localhost:8000
```

### Frontend
```env
VITE_API_URL=http://localhost:3001/api/v1
```

## Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Data encryption at rest and in transit
- Audit logging
- Rate limiting
- HIPAA compliance ready

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue in the repository.
