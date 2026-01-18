# A'mad - Precision Health Platform PRD

> **Purpose**: Implementation guide for adding precision health features to existing mobile app
> **Timeline**: 3 months (MVP)
> **Compliance**: HIPAA, ISO 27001

---

## Overview

A'mad transforms the existing app into a precision health platform by integrating genomic data, wearable biometrics, AI nutrition analysis, and lab results into a unified "digital health twin" for each user.

### Core Architecture Layers

| Layer | Purpose | Data Sources |
|-------|---------|--------------|
| **Genomic Core** | Genetic predispositions | VCF files, 23andMe, AncestryDNA |
| **Daily Inputs** | Real-time biometrics | Google/Apple/Samsung Health APIs |
| **AI Engine** | Personalized recommendations | Aggregated user data |
| **Medical Integration** | Clinical markers | HMS Lab Module, external labs (FHIR) |

---

## Feature Modules

### 1. Health Platform Integration

**Priority**: High | **Sprint**: 1-2

Integrate with platform health APIs instead of individual device SDKs.

#### 1.1 Google Health Connect (Android)

```kotlin
// Required permissions
val permissions = setOf(
    HealthPermission.getReadPermission(StepsRecord::class),
    HealthPermission.getReadPermission(SleepSessionRecord::class),
    HealthPermission.getReadPermission(HeartRateRecord::class),
    HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
    HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    HealthPermission.getReadPermission(NutritionRecord::class)
)
```

**Data types to sync**:
- Steps (daily aggregates + hourly)
- Sleep sessions (stages: awake, light, deep, REM)
- Heart rate (continuous + resting)
- HRV (RMSSD values)
- Workouts/Exercise sessions
- Nutrition (if available)

#### 1.2 Apple HealthKit (iOS)

```swift
let typesToRead: Set<HKObjectType> = [
    HKObjectType.quantityType(forIdentifier: .stepCount)!,
    HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
    HKObjectType.quantityType(forIdentifier: .heartRate)!,
    HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
    HKObjectType.workoutType(),
    HKObjectType.quantityType(forIdentifier: .dietaryEnergyConsumed)!
]
```

#### 1.3 Samsung Health (Android)

```kotlin
// Samsung Health SDK data types
val dataTypes = listOf(
    HealthConstants.StepCount.HEALTH_DATA_TYPE,
    HealthConstants.Sleep.HEALTH_DATA_TYPE,
    HealthConstants.HeartRate.HEALTH_DATA_TYPE,
    HealthConstants.Exercise.HEALTH_DATA_TYPE,
    HealthConstants.BloodOxygen.HEALTH_DATA_TYPE,
    HealthConstants.StressLevel.HEALTH_DATA_TYPE
)
```

#### 1.4 Unified Data Model

```typescript
interface HealthDataPoint {
  id: string;
  userId: string;
  source: 'google_health' | 'apple_health' | 'samsung_health';
  dataType: HealthDataType;
  value: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

type HealthDataType = 
  | 'steps'
  | 'sleep_duration'
  | 'sleep_stage'
  | 'heart_rate'
  | 'heart_rate_resting'
  | 'hrv'
  | 'workout'
  | 'calories_burned'
  | 'blood_oxygen'
  | 'stress_level';
```

#### Implementation Tasks

- [ ] Create `HealthPlatformService` abstraction layer
- [ ] Implement Google Health Connect adapter
- [ ] Implement Apple HealthKit adapter
- [ ] Implement Samsung Health adapter
- [ ] Build data normalization pipeline
- [ ] Add background sync with WorkManager/BGTaskScheduler
- [ ] Create health platform connection wizard UI
- [ ] Implement historical data import (up to 1 year)

---

### 2. Genomic Profile Management

**Priority**: High | **Sprint**: 2-3

#### 2.1 Supported Formats

| Format | Source | Parser |
|--------|--------|--------|
| VCF | Clinical labs | Standard VCF parser |
| 23andMe | Consumer | Tab-delimited, rsID mapping |
| AncestryDNA | Consumer | Tab-delimited, rsID mapping |

#### 2.2 Key Genetic Markers (MVP)

```typescript
interface GeneticMarker {
  rsId: string;
  gene: string;
  category: MarkerCategory;
  variants: string[];
  interpretation: string;
}

type MarkerCategory = 
  | 'metabolism'      // CYP1A2, ADRB2
  | 'nutrition'       // MTHFR, FUT2, LCT
  | 'inflammation'    // IL6, TNF, CRP
  | 'fitness'         // ACTN3, ACE
  | 'sleep'           // CLOCK, PER2
  | 'cardiovascular'; // APOE, LPA

const MVP_MARKERS: GeneticMarker[] = [
  { rsId: 'rs762551', gene: 'CYP1A2', category: 'metabolism', ... },  // Caffeine
  { rsId: 'rs1801133', gene: 'MTHFR', category: 'nutrition', ... },   // Folate
  { rsId: 'rs4988235', gene: 'LCT', category: 'nutrition', ... },     // Lactose
  { rsId: 'rs1815739', gene: 'ACTN3', category: 'fitness', ... },     // Muscle type
  { rsId: 'rs429358', gene: 'APOE', category: 'cardiovascular', ... }, // Lipid metabolism
  // ... expand based on clinical validation
];
```

#### 2.3 Data Model

```typescript
interface GenomicProfile {
  id: string;
  userId: string;
  uploadedAt: Date;
  source: 'vcf' | '23andme' | 'ancestrydna' | 'manual';
  markers: ProcessedMarker[];
  riskScores: RiskScore[];
}

interface ProcessedMarker {
  rsId: string;
  genotype: string;        // e.g., "AG", "CC"
  phenotype: string;       // e.g., "Fast caffeine metabolizer"
  confidence: number;      // 0-1
  recommendations: string[];
}

interface RiskScore {
  category: string;
  score: number;           // 0-100
  percentile: number;      // Population percentile
  factors: string[];       // Contributing markers
}
```

#### Implementation Tasks

- [ ] Create genomic file upload UI (with privacy consent)
- [ ] Implement VCF parser
- [ ] Implement 23andMe/AncestryDNA parsers
- [ ] Build SNP lookup database
- [ ] Create marker interpretation engine
- [ ] Design genomic profile display UI
- [ ] Add secure storage for genomic data (encrypted at rest)

---

### 3. AI Nutrition Analysis

**Priority**: High | **Sprint**: 3-4

#### 3.1 Meal Photo Analysis Pipeline

```
[Camera] → [Image Upload] → [Food Detection] → [Portion Estimation] → [Nutrition Lookup] → [User Confirmation] → [Storage]
```

#### 3.2 API Integration Options

**Option A: Cloud Vision + Nutrition API**
```typescript
interface MealAnalysisRequest {
  imageBase64: string;
  userId: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  timestamp: Date;
}

interface MealAnalysisResponse {
  foods: DetectedFood[];
  totalNutrition: NutritionSummary;
  confidence: number;
  needsUserConfirmation: boolean;
}

interface DetectedFood {
  name: string;
  nameAr?: string;           // Arabic name for regional foods
  portion: PortionEstimate;
  nutrition: NutritionData;
  confidence: number;
  alternatives?: string[];   // Similar foods for correction
}
```

**Option B: On-device ML (Privacy-focused)**
- TensorFlow Lite / Core ML model
- Offline capability
- ~50MB model size

#### 3.3 Regional Food Database

Include Gulf/Middle Eastern foods:
- Traditional dishes (Machboos, Harees, Thareed, etc.)
- Regional ingredients
- Local portion sizes
- Ramadan-specific meals

#### 3.4 Data Model

```typescript
interface MealLog {
  id: string;
  userId: string;
  timestamp: Date;
  mealType: MealType;
  imageUrl?: string;
  foods: FoodItem[];
  totalCalories: number;
  macros: Macronutrients;
  micros: Micronutrients;
  aiGenerated: boolean;
  userVerified: boolean;
}

interface Macronutrients {
  protein: number;      // grams
  carbs: number;
  fat: number;
  fiber: number;
}

interface Micronutrients {
  sodium: number;       // mg
  potassium: number;
  calcium: number;
  iron: number;
  vitaminD: number;
  vitaminB12: number;
  folate: number;
  // ... extend as needed
}
```

#### Implementation Tasks

- [ ] Integrate food recognition API/model
- [ ] Build meal photo capture UI
- [ ] Create food search/manual entry fallback
- [ ] Implement portion size selector
- [ ] Build regional food database
- [ ] Create daily nutrition summary view
- [ ] Add meal history and trends

---

### 4. Lab Results Integration

**Priority**: High | **Sprint**: 3-4

#### 4.1 HMS Lab Module Integration (Primary)

```typescript
// Internal API integration with HMS Lab Module
interface LabIntegrationConfig {
  endpoint: string;
  authType: 'api_key' | 'oauth2' | 'jwt';
  patientIdMapping: 'mrn' | 'national_id' | 'custom';
}

interface LabResult {
  id: string;
  patientId: string;
  testCode: string;
  testName: string;
  value: number | string;
  unit: string;
  referenceRange: ReferenceRange;
  status: 'normal' | 'low' | 'high' | 'critical';
  collectedAt: Date;
  reportedAt: Date;
  orderedBy?: string;
  notes?: string;
}

interface ReferenceRange {
  low?: number;
  high?: number;
  text?: string;
}
```

#### 4.2 Supported Lab Panels (MVP)

| Panel | Tests | Markers |
|-------|-------|---------|
| **Lipid Panel** | Total Cholesterol, LDL, HDL, Triglycerides | Cardiovascular risk |
| **Metabolic** | Glucose, HbA1c, Insulin | Diabetes risk |
| **Inflammation** | CRP, ESR, Ferritin | Chronic inflammation |
| **Thyroid** | TSH, T3, T4 | Metabolic function |
| **Vitamins** | D, B12, Folate, Iron | Nutritional status |
| **Kidney** | Creatinine, BUN, eGFR | Kidney function |
| **Liver** | ALT, AST, ALP, Bilirubin | Liver function |

#### 4.3 External Lab API (Phase 2)

```typescript
// HL7 FHIR R4 compliant interface
interface FHIRLabObservation {
  resourceType: 'Observation';
  id: string;
  status: 'final' | 'preliminary';
  code: {
    coding: [{
      system: 'http://loinc.org';
      code: string;
      display: string;
    }];
  };
  valueQuantity: {
    value: number;
    unit: string;
    system: 'http://unitsofmeasure.org';
  };
  referenceRange: [{
    low?: { value: number; unit: string };
    high?: { value: number; unit: string };
  }];
  effectiveDateTime: string;
}
```

#### Implementation Tasks

- [ ] Define HMS Lab Module integration interface
- [ ] Implement lab result polling/webhook receiver
- [ ] Build LOINC code mapping for test normalization
- [ ] Create lab results display UI with trends
- [ ] Add critical value push notifications
- [ ] Implement reference range visualization
- [ ] Design lab report PDF export

---

### 5. Recommendation Engine

**Priority**: High | **Sprint**: 4-5

#### 5.1 Recommendation Categories

```typescript
type RecommendationCategory = 
  | 'nutrition'      // What to eat/avoid
  | 'supplement'     // Vitamins, minerals
  | 'activity'       // Exercise suggestions
  | 'sleep'          // Sleep optimization
  | 'lifestyle'      // General wellness
  | 'medical';       // See a doctor alerts

interface Recommendation {
  id: string;
  userId: string;
  category: RecommendationCategory;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  reasoning: string[];           // Why this recommendation
  dataSources: DataSource[];     // What data informed it
  actionable: boolean;
  action?: RecommendedAction;
  validUntil: Date;
  dismissed: boolean;
}

interface DataSource {
  type: 'genomic' | 'wearable' | 'lab' | 'nutrition' | 'user_input';
  dataPoints: string[];
  weight: number;                // Contribution to recommendation
}
```

#### 5.2 Recommendation Rules (MVP)

```typescript
// Example rule structure
interface RecommendationRule {
  id: string;
  name: string;
  conditions: Condition[];
  recommendation: Partial<Recommendation>;
  priority: number;
}

const EXAMPLE_RULES: RecommendationRule[] = [
  {
    id: 'caffeine_slow_metabolizer',
    name: 'Caffeine Sensitivity',
    conditions: [
      { source: 'genomic', marker: 'CYP1A2', genotype: ['AC', 'CC'] }
    ],
    recommendation: {
      category: 'nutrition',
      title: 'Limit caffeine intake',
      description: 'Your genetics indicate slow caffeine metabolism. Consider limiting coffee to mornings only.',
      priority: 'medium'
    }
  },
  {
    id: 'vitamin_d_low',
    name: 'Low Vitamin D',
    conditions: [
      { source: 'lab', test: 'vitamin_d', comparator: '<', value: 30 }
    ],
    recommendation: {
      category: 'supplement',
      title: 'Consider Vitamin D supplementation',
      description: 'Your Vitamin D levels are below optimal. Discuss supplementation with your doctor.',
      priority: 'high'
    }
  },
  {
    id: 'poor_sleep_hrv',
    name: 'Sleep Quality Alert',
    conditions: [
      { source: 'wearable', metric: 'hrv_7day_avg', comparator: '<', percentile: 20 },
      { source: 'wearable', metric: 'sleep_efficiency', comparator: '<', value: 0.85 }
    ],
    recommendation: {
      category: 'sleep',
      title: 'Improve sleep quality',
      description: 'Your HRV and sleep data suggest poor recovery. Consider sleep hygiene improvements.',
      priority: 'medium'
    }
  }
];
```

#### 5.3 Daily Score Calculation

```typescript
interface DailyHealthScore {
  date: Date;
  overall: number;           // 0-100
  components: {
    sleep: number;
    activity: number;
    nutrition: number;
    recovery: number;        // HRV-based
    compliance: number;      // Following recommendations
  };
  trend: 'improving' | 'stable' | 'declining';
  insights: string[];
}
```

#### Implementation Tasks

- [ ] Design rule engine architecture
- [ ] Implement genomic-based rules
- [ ] Implement lab-based rules
- [ ] Implement wearable-based rules
- [ ] Build cross-source correlation logic
- [ ] Create daily health score calculator
- [ ] Design recommendation cards UI
- [ ] Add recommendation feedback loop
- [ ] Implement push notification triggers

---

### 6. Clinician Dashboard (Basic)

**Priority**: Medium | **Sprint**: 5-6

#### 6.1 Features (MVP)

- Patient roster with search
- Individual patient health summary view
- Recent lab results timeline
- Wearable data trends (7/30/90 days)
- Active recommendations list
- Critical value alerts
- Basic note-taking

#### 6.2 Access Control

```typescript
interface ClinicianAccess {
  clinicianId: string;
  role: 'physician' | 'nurse' | 'nutritionist' | 'admin';
  permissions: Permission[];
  patientAccess: 'all' | 'assigned' | 'department';
}

type Permission = 
  | 'view_demographics'
  | 'view_genomics'
  | 'view_wearables'
  | 'view_labs'
  | 'view_nutrition'
  | 'add_notes'
  | 'modify_recommendations'
  | 'export_reports';
```

#### Implementation Tasks

- [ ] Create clinician authentication flow
- [ ] Build patient roster with filters
- [ ] Design patient summary dashboard
- [ ] Implement data visualization components
- [ ] Add clinical notes functionality
- [ ] Create PDF report generator
- [ ] Implement role-based access control

---

## Security Requirements

### Data Protection

```typescript
// All PHI must be encrypted
interface SecurityConfig {
  encryption: {
    atRest: 'AES-256-GCM';
    inTransit: 'TLS 1.3';
    keys: 'AWS KMS' | 'Azure Key Vault' | 'HashiCorp Vault';
  };
  authentication: {
    method: 'OAuth 2.0 + OIDC';
    mfa: boolean;              // Required for clinicians
    sessionTimeout: number;    // Minutes
    biometric: boolean;        // Optional for patients
  };
  audit: {
    logAllPHIAccess: boolean;
    retentionDays: number;
    tamperProof: boolean;
  };
}
```

### HIPAA Checklist

- [ ] Implement audit logging for all PHI access
- [ ] Enable encryption at rest for all databases
- [ ] Configure TLS 1.3 for all API endpoints
- [ ] Implement role-based access control
- [ ] Add session timeout and auto-logout
- [ ] Create data export/deletion for patient rights
- [ ] Set up breach notification system
- [ ] Document all data flows

### ISO 27001 Controls

- [ ] Asset inventory and classification
- [ ] Access control policy enforcement
- [ ] Cryptographic controls
- [ ] Operations security
- [ ] Communications security
- [ ] Incident management procedures

---

## API Endpoints Summary

### Patient App APIs

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

GET    /api/v1/profile
PUT    /api/v1/profile

POST   /api/v1/health/connect/{platform}
DELETE /api/v1/health/disconnect/{platform}
GET    /api/v1/health/data?type={type}&from={date}&to={date}

POST   /api/v1/genomics/upload
GET    /api/v1/genomics/profile
GET    /api/v1/genomics/markers

POST   /api/v1/nutrition/analyze
GET    /api/v1/nutrition/meals?date={date}
POST   /api/v1/nutrition/meals
PUT    /api/v1/nutrition/meals/{id}

GET    /api/v1/labs/results
GET    /api/v1/labs/results/{id}

GET    /api/v1/recommendations
PUT    /api/v1/recommendations/{id}/dismiss
PUT    /api/v1/recommendations/{id}/complete

GET    /api/v1/dashboard/summary
GET    /api/v1/dashboard/score
```

### Clinician APIs

```
GET    /api/v1/clinician/patients
GET    /api/v1/clinician/patients/{id}/summary
GET    /api/v1/clinician/patients/{id}/timeline
POST   /api/v1/clinician/patients/{id}/notes
GET    /api/v1/clinician/alerts
POST   /api/v1/clinician/reports/generate
```

---

## Database Schema (Key Tables)

```sql
-- Core tables
users (id, email, phone, name, dob, gender, created_at)
user_profiles (user_id, height, weight, blood_type, allergies, conditions)
user_consents (user_id, consent_type, granted_at, expires_at)

-- Health data
health_connections (user_id, platform, access_token, refresh_token, connected_at)
health_data_points (id, user_id, source, data_type, value, unit, timestamp)

-- Genomics
genomic_profiles (id, user_id, source, file_hash, uploaded_at)
genomic_markers (profile_id, rs_id, genotype, chromosome, position)
genomic_interpretations (profile_id, marker_id, phenotype, recommendations)

-- Nutrition
meals (id, user_id, meal_type, image_url, timestamp, verified)
meal_foods (meal_id, food_id, portion_grams, nutrition_data)
foods (id, name, name_ar, category, nutrition_per_100g)

-- Labs
lab_results (id, user_id, test_code, test_name, value, unit, reference_range, collected_at)
lab_panels (id, user_id, panel_type, results, created_at)

-- Recommendations
recommendations (id, user_id, category, priority, title, content, valid_until, status)
recommendation_feedback (recommendation_id, user_id, action, timestamp)

-- Clinician
clinician_access (clinician_id, patient_id, granted_by, granted_at)
clinical_notes (id, clinician_id, patient_id, content, created_at)
```

---

## Testing Requirements

### Unit Tests
- [ ] Health platform adapters (mock API responses)
- [ ] Genomic file parsers
- [ ] Nutrition calculation logic
- [ ] Recommendation rule engine
- [ ] Data normalization functions

### Integration Tests
- [ ] Health platform OAuth flows
- [ ] Lab module API integration
- [ ] End-to-end data sync
- [ ] Push notification delivery

### Security Tests
- [ ] Authentication bypass attempts
- [ ] Authorization boundary tests
- [ ] Data encryption verification
- [ ] Audit log completeness

---

## Implementation Order

### Sprint 1-2: Foundation
1. Health platform integration layer
2. Google Health Connect implementation
3. Apple HealthKit implementation
4. Samsung Health implementation
5. Data normalization pipeline
6. Background sync setup

### Sprint 3-4: Core Features
1. Genomic file upload and parsing
2. AI nutrition analysis integration
3. HMS Lab Module integration
4. Basic recommendation engine

### Sprint 5-6: Polish & Launch
1. Daily health score
2. Recommendation UI
3. Clinician dashboard (basic)
4. Security hardening
5. Testing and bug fixes
6. MVP release

---

## Notes for Implementation

1. **Start with health platform integration** - it provides immediate value and validates the data pipeline.

2. **Use feature flags** - Enable gradual rollout of genomic and AI features.

3. **Design for offline** - Cache recommendations and recent data for offline access.

4. **Regional considerations** - Include Arabic language support and RTL layouts early.

5. **Privacy by design** - Always get explicit consent before accessing health data.

6. **Modular architecture** - Each feature module should be independently deployable.

---

*Last updated: January 2026*
*Version: 1.0-MVP*

