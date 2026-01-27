# Emergency Department Module - Product Requirements Document

**Project:** Spetaar HMS - Emergency Department System  
**Version:** 1.0  
**Date:** January 2025  
**Status:** Draft for Review  
**Requested by:** Kamil (Team Member)

---

## Executive Summary

This document outlines the complete requirements for the Emergency Department (ED) module of Spetaar HMS. The ED module will provide comprehensive patient tracking, triage management, and clinical workflows for hospital emergency departments, replacing the current fragile JSON-based implementation with a proper relational data model.

### Goals
1. Replace fragile JSON-based data storage with proper Prisma models
2. Unify patient registration with existing OPD appointment flow (no duplicate registration)
3. Implement complete ESI (Emergency Severity Index) triage workflow
4. Provide real-time patient tracking and status updates
5. Integrate with existing ambulance module
6. Support trauma assessment (GCS, RTS)
7. Enable ED-specific orders (labs, imaging, medications)
8. Provide ED analytics and reporting

---

## 1. System Architecture

### 1.1 Data Model Design

#### Current Problems
- ESI level stored in `appointment.notes` as JSON string
- Triage data scattered and unreliable
- No proper emergency visit tracking
- No bed/bay management specific to ED
- Duplicate patient registration workflow

#### Proposed Solution: New EmergencyVisit Model

```prisma
model EmergencyVisit {
  id                    String                @id @default(uuid())
  hospitalId            String
  patientId             String
  appointmentId         String                @unique
  
  // Arrival Information
  arrivalMode           ArrivalMode
  arrivalTime           DateTime              @default(now())
  ambulanceTripId       String?               // Link to ambulance if arrived by ambulance
  
  // Triage Assessment
  esiLevel              Int                   // 1-5
  chiefComplaint        String
  triageNotes           String?
  triageById            String?               // User who performed triage
  triageTime            DateTime?
  
  // Vitals at Triage
  temperature           Decimal?              @db.Decimal(5, 2)
  bloodPressureSys      Int?
  bloodPressureDia      Int?
  heartRate             Int?
  respiratoryRate       Int?
  oxygenSaturation      Int?
  painScale             Int?                  // 0-10
  mentalStatus          MentalStatus?
  
  // Trauma Assessment (if applicable)
  glasgowComaScale      Int?                  // GCS: 3-15
  revisedTraumaScore    Decimal?              @db.Decimal(5, 2) // RTS: 0-7.84
  traumaNotes           String?
  isTrauma              Boolean               @default(false)
  
  // Treatment Area Assignment
  bedId                 String?               // ED bed/bay assignment
  assignedDoctorId      String?
  assignedNurseId       String?
  assignedTime          DateTime?
  
  // Clinical Status
  status                EDStatus              @default(REGISTERED)
  priority              EDPriority            // Calculated from ESI
  
  // Orders Placed from ED
  labOrdersPlaced       Boolean               @default(false)
  imagingOrdersPlaced   Boolean               @default(false)
  medicationsOrdered    Boolean               @default(false)
  
  // Disposition
  disposition           EDDisposition?
  dispositionTime       DateTime?
  dispositionNotes      String?
  admissionId           String?               // If admitted
  transferDestination   String?               // If transferred
  
  // Metrics
  doorToTriageMinutes   Int?                  // Time from arrival to triage
  doorToDoctorMinutes   Int?                  // Time from arrival to doctor seen
  totalEDMinutes        Int?                  // Total time in ED
  
  // Timestamps
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  
  // Relations
  hospital              Hospital              @relation(fields: [hospitalId], references: [id])
  patient               Patient               @relation(fields: [patientId], references: [id])
  appointment           Appointment           @relation(fields: [appointmentId], references: [id])
  ambulanceTrip         AmbulanceTrip?        @relation(fields: [ambulanceTripId], references: [id])
  bed                   Bed?                  @relation(fields: [bedId], references: [id])
  assignedDoctor        Doctor?               @relation("EDAssignedDoctor", fields: [assignedDoctorId], references: [id])
  triageBy              User?                 @relation("EDTriageBy", fields: [triageById], references: [id])
  admission             Admission?            @relation(fields: [admissionId], references: [id])
  
  @@map("emergency_visits")
}

enum ArrivalMode {
  WALK_IN
  AMBULANCE
  POLICE
  FIRE_RESCUE
  PRIVATE_VEHICLE
  TRANSFER
  HELICOPTER
  OTHER
}

enum MentalStatus {
  ALERT
  VOICE
  PAIN
  UNRESPONSIVE
}

enum EDStatus {
  REGISTERED          // Just arrived, awaiting triage
  TRIAGED             // Triage completed, awaiting bed/doctor
  IN_TREATMENT        // Assigned to doctor, in treatment
  AWAITING_RESULTS    // Waiting for lab/imaging results
  READY_FOR_DISPOSITION // Treatment complete, awaiting discharge/admit decision
  ADMITTED            // Being admitted to inpatient
  DISCHARGED          // Discharged home
  TRANSFERRED         // Transferred to another facility
  LEFT_AMA            // Left against medical advice
  DECEASED            // Expired in ED
}

enum EDPriority {
  CRITICAL            // ESI 1-2
  URGENT              // ESI 3
  LESS_URGENT         // ESI 4
  NON_URGENT          // ESI 5
}

enum EDDisposition {
  DISCHARGED_HOME
  ADMITTED_GENERAL
  ADMITTED_ICU
  ADMITTED_OBSERVATION
  TRANSFERRED_OUT
  LEFT_AMA
  DECEASED
  LEFT_WITHOUT_BEING_SEEN
}
```

#### ED Bed Management Model

```prisma
model EDBed {
  id                String            @id @default(uuid())
  hospitalId        String
  bedNumber         String
  location          String            // "Trauma Bay 1", "Resuscitation 1", "Room 5"
  type              EDBedType
  status            BedStatus         @default(AVAILABLE)
  currentPatientId  String?
  lastCleaned       DateTime?
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  
  hospital          Hospital          @relation(fields: [hospitalId], references: [id])
  currentPatient    Patient?          @relation(fields: [currentPatientId], references: [id])
  
  @@unique([hospitalId, bedNumber])
  @@map("ed_beds")
}

enum EDBedType {
  RESUSCITATION      // For ESI 1
  TRAUMA             // Trauma bay
  ACUTE              // Acute care bed
  FAST_TRACK         // For minor injuries/ESI 4-5
  OBSERVATION        // Short-stay observation
  ISOLATION          // Isolation room
  PEDIATRIC          // Pediatric-specific
  PSYCHIATRIC        // Psych hold
}
```

---

## 2. Core Features

### 2.1 Patient Registration & Arrival

#### Requirements
- **Unified with OPD**: Use existing patient lookup service (no duplicate registration)
- If patient exists in system, link to existing patient record
- If new patient, create minimal registration (can be completed later)
- Support all arrival modes (walk-in, ambulance, transfer, etc.)
- Auto-link ambulance trip if arrival mode is AMBULANCE

#### User Stories
- As a **ED Receptionist**, I want to quickly register arriving patients without duplicate entries
- As a **Paramedic**, I want the system to auto-link my ambulance trip to the ED visit
- As a **Triage Nurse**, I want to see all newly arrived patients awaiting triage

#### API Endpoints
```
POST /api/v1/emergency/register
Body: {
  // Option 1: Existing patient
  patientId: "uuid",
  
  // Option 2: New patient (minimal info)
  patient: {
    firstName: string,
    lastName: string,
    dateOfBirth?: date,
    gender?: enum,
    phone?: string
  },
  
  // ED-specific
  chiefComplaint: string,
  arrivalMode: enum,
  ambulanceTripId?: string,  // If arrived by ambulance
  preliminaryESI?: number     // Nurse's initial assessment
}
```

### 2.2 ESI Triage System

#### Requirements
- Implement complete ESI (Emergency Severity Index) algorithm
- 5-level acuity system (1 = Resuscitation, 5 = Non-Urgent)
- AI-assisted triage calculation based on:
  - Chief complaint
  - Vital signs (HR, RR, BP, SpO2, Temp)
  - Pain scale (0-10)
  - Mental status (AVPU)
  - Age
  - Pregnancy status
  - Specific symptoms/keywords
- Manual override capability
- Re-triage support (ESI level can change)
- Auto-prioritize by ESI level

#### Triage Decision Points (ESI Algorithm)

**Level 1 (Resuscitation):**
- Requires immediate life-saving intervention
- Examples: Cardiac arrest, severe respiratory distress, unresponsive, severe trauma

**Level 2 (Emergent):**
- High-risk situation, confusion/lethargy, severe pain/distress
- Abnormal vitals (SpO2 < 90%, HR < 40 or > 150, RR < 10 or > 30)
- Examples: Chest pain, stroke symptoms, severe bleeding, altered mental status

**Level 3 (Urgent):**
- Needs multiple resources (≥2)
- Stable but requires labs, imaging, IV fluids, procedures
- Examples: Moderate pain, fever with infection concerns, minor trauma

**Level 4 (Less Urgent):**
- Needs one resource
- Examples: Simple laceration, minor fracture (one X-ray)

**Level 5 (Non-Urgent):**
- No resources needed
- Examples: Cold, minor rash, prescription refill, chronic issue

#### User Stories
- As a **Triage Nurse**, I want AI to suggest ESI level based on patient presentation
- As a **Triage Nurse**, I want to override AI suggestion if clinically appropriate
- As a **ED Physician**, I want to re-triage patients if their condition changes
- As a **Charge Nurse**, I want to see all patients sorted by ESI priority

#### API Endpoints
```
POST /api/v1/emergency/calculate-esi
Body: {
  chiefComplaint: string,
  vitals: {...},
  painScale: number,
  mentalStatus: enum,
  age?: number,
  isPregnant?: boolean,
  symptoms?: string[]
}
Response: {
  esiLevel: number,
  category: string,
  reasoning: string[],
  recommendations: string[],
  estimatedResources: number
}

PATCH /api/v1/emergency/:id/triage
Body: {
  esiLevel: number,
  triageNotes?: string,
  vitals: {...}
}
```

### 2.3 Patient Tracking Board

#### Requirements
- Real-time view of all ED patients
- Color-coded by ESI level
- Filterable by:
  - ESI level
  - Status (Registered, Triaged, In Treatment, etc.)
  - Assigned doctor
  - Time in ED (> 2 hours, > 4 hours, etc.)
- Sortable by:
  - Arrival time
  - ESI level
  - Wait time
  - Status
- Show key metrics per patient:
  - Name, age, gender
  - Chief complaint
  - ESI level
  - Arrival time
  - Wait time (auto-calculating)
  - Current status
  - Assigned doctor/nurse
  - Bed/bay location
  - Latest vitals
  - Critical allergies (red flag)

#### Action Buttons (Context Menu)
Each patient card should have quick actions:
- **View Details** → Open patient detail slide-out panel
- **Assign Doctor** → Assign/reassign physician
- **Update Triage** → Change ESI level
- **Assign Bed** → Assign to ED bed/bay
- **Order Labs** → Place lab orders
- **Order Imaging** → Place imaging orders
- **Admit** → Initiate admission process
- **Discharge** → Discharge from ED
- **Transfer** → Transfer to another facility

#### User Stories
- As an **ED Charge Nurse**, I want to see all patients in the ED at a glance
- As an **ED Physician**, I want to quickly see which patients need my attention
- As a **Department Manager**, I want to identify patients with long wait times

#### API Endpoints
```
GET /api/v1/emergency/patients
Query: {
  esiLevel?: number,
  status?: EDStatus,
  doctorId?: string,
  minWaitTime?: number  // in minutes
}

GET /api/v1/emergency/:id/details
Response: {
  emergencyVisit: {...},
  patient: {...},
  vitals: [...],
  allergies: [...],
  labOrders: [...],
  imagingOrders: [...],
  medications: [...],
  clinicalNotes: [...]
}
```

### 2.4 Patient Detail Panel

#### Requirements
- Slide-out panel from right side
- Tabbed interface:
  1. **Overview** - Summary of visit, chief complaint, triage info
  2. **Vitals** - All vitals with timestamps, trending
  3. **Orders** - Labs, imaging, medications ordered
  4. **Clinical Notes** - Doctor/nurse notes
  5. **History** - Past visits, allergies, medications, conditions
  6. **Actions** - Quick action buttons

#### Overview Tab
- Patient demographics
- Chief complaint
- ESI level with reasoning
- Arrival mode and time
- Wait times (door-to-triage, door-to-doctor, total ED time)
- Current status
- Assigned staff (doctor, nurse)
- Bed/bay location

#### Actions Available
- Assign/reassign doctor
- Update triage level
- Record vitals
- Order labs
- Order imaging
- Prescribe medications
- Add clinical note
- Admit to inpatient
- Discharge
- Transfer
- Mark as left AMA

### 2.5 Waiting Room Management

#### Requirements
- Dedicated view for patients in REGISTERED or TRIAGED status
- Show estimated wait time per patient
- AI-powered wait time prediction based on:
  - Current ED census
  - ESI distribution
  - Available doctors
  - Time of day
  - Historical patterns
- Display board view (can be shown on TV in waiting room)

#### Features
- Call patient to triage
- Call patient to treatment room
- Update patient/family on wait time
- Send SMS notification when ready

#### User Stories
- As a **Receptionist**, I want to give patients realistic wait time estimates
- As a **Patient**, I want to know approximately how long I'll wait
- As a **Triage Nurse**, I want to call the next highest-priority patient

#### API Endpoints
```
GET /api/v1/emergency/waiting-room
Response: {
  patients: [...],
  avgWaitTime: number,
  estimatedWaitByESI: {
    1: 0,      // Immediate
    2: 5,
    3: 45,
    4: 120,
    5: 180
  }
}

POST /api/v1/emergency/:id/call-to-triage
POST /api/v1/emergency/:id/call-to-room
```

### 2.6 Vitals Monitoring

#### Requirements
- Record vitals at multiple timepoints:
  - At triage (initial)
  - During treatment (serial)
  - Before disposition (final)
- Support manual entry and device integration
- Automatic flagging of abnormal vitals
- Trending view (chart over time)
- Link to existing Vital model

#### Vital Parameters
- Temperature (°C/°F)
- Blood Pressure (systolic/diastolic)
- Heart Rate (bpm)
- Respiratory Rate (breaths/min)
- Oxygen Saturation (SpO2%)
- Pain Scale (0-10)
- Blood Glucose (if applicable)
- Level of Consciousness (AVPU/GCS)

#### User Stories
- As a **Nurse**, I want to quickly record vitals during treatment
- As a **Physician**, I want to see vital trends to assess response to treatment
- As a **System**, I want to alert staff when vitals are critically abnormal

#### API Endpoints
```
POST /api/v1/emergency/:id/vitals
Body: {
  temperature?: number,
  bloodPressureSys?: number,
  bloodPressureDia?: number,
  heartRate?: number,
  respiratoryRate?: number,
  oxygenSaturation?: number,
  painScale?: number,
  glasgowComaScale?: number,
  recordedBy: string
}

GET /api/v1/emergency/:id/vitals
Response: {
  vitals: [...],  // Sorted by time
  trends: {
    heartRate: [...],
    bloodPressure: [...]
  }
}
```

### 2.7 ED Bed/Bay Management

#### Requirements
- Track all ED beds/bays by type:
  - Resuscitation (for ESI 1)
  - Trauma bays
  - Acute care beds
  - Fast track (for ESI 4-5)
  - Observation beds
  - Isolation rooms
  - Pediatric
  - Psychiatric hold
- Real-time bed status:
  - Available
  - Occupied (show patient name)
  - Dirty (needs cleaning)
  - Blocked (out of service)
- Assign patient to bed
- Track bed turnover time
- Alert when resuscitation bay is occupied (capacity issue)

#### Bed Board View
- Visual grid of all ED beds
- Color-coded by status
- Click bed to see patient details
- Click bed to assign patient
- Track bed cleaning/turnover

#### User Stories
- As a **Charge Nurse**, I want to assign patients to appropriate beds based on acuity
- As a **Housekeeping**, I want to mark beds as clean when ready
- As a **Department Manager**, I want to track bed utilization and turnover

#### API Endpoints
```
GET /api/v1/emergency/beds
Response: {
  beds: [
    {
      id: string,
      bedNumber: string,
      type: EDBedType,
      status: BedStatus,
      currentPatient?: {...},
      lastCleaned?: datetime
    }
  ],
  occupancyRate: number,
  availableByType: {
    RESUSCITATION: 1,
    TRAUMA: 2,
    ACUTE: 5,
    ...
  }
}

PATCH /api/v1/emergency/beds/:bedId/assign
Body: {
  patientId: string
}

PATCH /api/v1/emergency/beds/:bedId/status
Body: {
  status: BedStatus
}
```

### 2.8 Resuscitation Room Dashboard

#### Requirements
- Dedicated view for ESI Level 1-2 patients (critical)
- Large display format (can be shown on wall monitor)
- Real-time updates
- Show:
  - Patient name/age
  - Chief complaint
  - Time since arrival
  - Assigned trauma team
  - Latest vitals (large display)
  - Active interventions
  - Blood products used
  - Labs/imaging ordered
- Support multiple simultaneous resuscitations
- Code status display

#### User Stories
- As a **Trauma Team Leader**, I want a dedicated view of critical patients
- As a **Resuscitation Team**, I want vitals displayed prominently
- As an **ED Physician**, I want to quickly see all critical patients needing attention

#### API Endpoints
```
GET /api/v1/emergency/resuscitation
Response: {
  patients: [
    {
      emergencyVisit: {...},
      patient: {...},
      timeSinceArrival: number,
      latestVitals: {...},
      activeMedications: [...],
      pendingOrders: [...]
    }
  ]
}
```

### 2.9 Orders from ED

#### Requirements
- Place orders directly from ED without full admission
- **Lab Orders**:
  - CBC, BMP, Troponin, Lactate, Liver panel, PT/INR, etc.
  - STAT labeling for urgent labs
  - Link to existing LabOrder model
- **Imaging Orders**:
  - X-ray, CT, MRI, Ultrasound
  - STAT vs Routine
  - Link to existing ImagingOrder model
- **Medication Orders**:
  - IV medications
  - Pain management
  - Emergency medications (epi, atropine, etc.)
  - Link to existing Pharmacy module
- Track order status (Ordered → In Progress → Completed)
- Receive results in ED tracking board

#### User Stories
- As an **ED Physician**, I want to order labs and imaging from the tracking board
- As a **Nurse**, I want to see pending medication orders
- As a **Lab Tech**, I want to see STAT ED orders prioritized

#### Integration Points
- Use existing `LabOrder` model, add `emergencyVisitId` field
- Use existing `ImagingOrder` model, add `emergencyVisitId` field
- Use existing medication/pharmacy system

### 2.10 Ambulance Integration

#### Requirements
- Auto-link ambulance trip to ED visit
- Display ambulance ETA on tracking board
- Show paramedic report when available
- Pre-arrival notification
- Vitals from paramedics pre-populate triage

#### Ambulance Module Already Has
- Trip tracking with status updates
- Location tracking
- Dispatch system
- ETA calculation

#### New Integration
- Add `emergencyVisitId` to `AmbulanceTrip` model
- When trip status changes to "AT_DESTINATION", create EmergencyVisit
- Copy vitals from ambulance trip to triage vitals
- Display ambulance info in patient detail panel

#### User Stories
- As an **ED Charge Nurse**, I want to see incoming ambulances and prepare
- As an **ED Physician**, I want to review paramedic report before patient arrival
- As a **Triage Nurse**, I want paramedic vitals auto-populated

#### API Endpoints
```
GET /api/v1/emergency/incoming-ambulances
Response: {
  trips: [
    {
      id: string,
      ambulance: {...},
      patient: {...},
      chiefComplaint: string,
      vitals: {...},
      eta: datetime,
      distance: number
    }
  ]
}

POST /api/v1/emergency/link-ambulance
Body: {
  emergencyVisitId: string,
  ambulanceTripId: string
}
```

### 2.11 Trauma Assessment

#### Requirements
- **Glasgow Coma Scale (GCS)**: 3-15
  - Eye opening (1-4)
  - Verbal response (1-5)
  - Motor response (1-6)
  - Total: 3-15 (3 = deep coma, 15 = fully alert)
- **Revised Trauma Score (RTS)**: 0-7.84
  - Based on: GCS, systolic BP, respiratory rate
  - Formula: RTS = 0.9368(GCS_coded) + 0.7326(SBP_coded) + 0.2908(RR_coded)
  - Used for trauma triage and outcomes
- Auto-calculate RTS from vitals and GCS
- Flag trauma patients requiring trauma team activation
- Store trauma-specific notes

#### Trauma Team Activation Criteria
- GCS ≤ 13
- SBP < 90 mmHg
- RR < 10 or > 29
- Penetrating injury to head, neck, torso, extremities proximal to elbow/knee
- Flail chest
- Fall > 20 feet
- High-speed MVC

#### User Stories
- As a **Trauma Nurse**, I want to quickly calculate GCS and RTS
- As a **Trauma Team**, I want to be notified when trauma activation criteria are met
- As an **ED Physician**, I want trauma scores included in assessment

#### API Endpoints
```
POST /api/v1/emergency/:id/trauma-assessment
Body: {
  glasgowComaScale: {
    eyeOpening: number,     // 1-4
    verbalResponse: number, // 1-5
    motorResponse: number   // 1-6
  },
  traumaNotes: string,
  mechanismOfInjury: string
}

GET /api/v1/emergency/:id/trauma-scores
Response: {
  gcs: number,              // 3-15
  rts: number,              // 0-7.84
  category: string,         // SEVERE, MODERATE, MINOR
  traumaTeamActivated: boolean
}
```

### 2.12 Disposition & Discharge

#### Requirements
- Disposition options:
  - Discharged home
  - Admitted to general ward
  - Admitted to ICU
  - Admitted to observation
  - Transferred to another facility
  - Left AMA (against medical advice)
  - Deceased
  - Left without being seen (LWBS)
- Generate discharge instructions
- Provide prescriptions
- Schedule follow-up
- Send discharge summary to patient's primary care physician
- Record final diagnosis (ICD-10)
- Calculate total ED time (door-to-discharge)

#### Admission from ED
- Select ward/bed for admission
- Transfer patient to Admission module
- Copy ED notes to admission record
- Link ED visit to admission

#### User Stories
- As an **ED Physician**, I want to admit a patient with one click
- As a **Discharge Planner**, I want to coordinate patient disposition
- As a **Patient**, I want to receive discharge instructions

#### API Endpoints
```
POST /api/v1/emergency/:id/admit
Body: {
  bedId: string,
  admittingDoctorId: string,
  admissionType: 'EMERGENCY',
  notes: string
}

POST /api/v1/emergency/:id/discharge
Body: {
  disposition: EDDisposition,
  dischargeInstructions: string,
  prescriptions: [...],
  followUpDays: number,
  finalDiagnosis: string,
  icd10Codes: string[]
}

POST /api/v1/emergency/:id/transfer
Body: {
  destination: string,
  reason: string,
  transferMode: string,  // Ambulance, helicopter, etc.
  receivingPhysician: string
}
```

### 2.13 Real-Time Updates

#### Requirements
- **WebSocket** or **Polling** for real-time board updates
- Update tracking board every 30 seconds
- Push notifications for:
  - New patient arrival
  - ESI 1-2 (critical) patient arrival
  - Lab/imaging results available
  - Bed assignment
  - Patient deterioration (vitals alert)
- Auto-refresh wait times
- Toast notifications for important events

#### Implementation Options
1. **Polling** (simpler): Frontend polls `/api/v1/emergency/patients` every 30 sec
2. **WebSocket** (better): Real-time push via Socket.IO

#### User Stories
- As an **ED Staff**, I want the board to update automatically without refresh
- As a **Charge Nurse**, I want alerts when critical patients arrive
- As an **ED Physician**, I want to be notified when my patient's labs are ready

#### Technical Implementation
```javascript
// Frontend polling example
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await emergencyApi.getPatients();
    setPatients(response.data.data);
  }, 30000); // 30 seconds
  
  return () => clearInterval(interval);
}, []);
```

### 2.14 ED Analytics & Reporting

#### Requirements
- **Dashboard Metrics**:
  - Total patients in ED (current)
  - Total visits today
  - Average wait time (door-to-doctor)
  - Average total ED time
  - Patients by ESI level (breakdown)
  - Critical count (ESI 1-2)
  - Admission rate
  - Discharge rate
  - Left without being seen (LWBS) rate
  - Bed occupancy rate
- **Historical Reports**:
  - Daily/weekly/monthly ED volume
  - Peak hours of day
  - ESI distribution over time
  - Average length of stay by ESI
  - Common chief complaints
  - Door-to-doctor times (target: < 30 min for ESI 1-2)
  - ED throughput metrics
- **Provider Performance**:
  - Patients seen per doctor
  - Average time per patient
  - Disposition patterns
- **Exportable** to CSV/PDF

#### User Stories
- As an **ED Director**, I want daily reports on ED performance
- As a **Quality Manager**, I want to track door-to-doctor times
- As a **Hospital Administrator**, I want monthly ED volume trends

#### API Endpoints
```
GET /api/v1/emergency/stats
Query: {
  startDate?: date,
  endDate?: date,
  groupBy?: 'day' | 'week' | 'month'
}
Response: {
  inDepartment: number,
  treatedToday: number,
  admitted: number,
  avgWaitTime: number,
  avgTotalTime: number,
  byESILevel: {
    1: number,
    2: number,
    ...
  },
  lwbsCount: number,
  lwbsRate: number
}

GET /api/v1/emergency/reports/volume
GET /api/v1/emergency/reports/wait-times
GET /api/v1/emergency/reports/chief-complaints
```

---

## 3. User Interface Design

### 3.1 Design System
- **Style**: Glassmorphism with red/rose accent colors (existing ED design)
- **Components**: TailwindCSS + Heroicons
- **Responsive**: Desktop-first (ED staff use workstations primarily)
- **Dark Mode**: Optional (consider night shift staff)

### 3.2 Main Views

#### 3.2.1 Patient Tracking Board (Main View)
```
┌─────────────────────────────────────────────────────────────┐
│  Emergency Department   [New Patient] [AI Triage] [Refresh] │
├─────────────────────────────────────────────────────────────┤
│  [!] 3 Critical Patients (ESI 1-2)                         │
├─────────────────────────────────────────────────────────────┤
│  ESI Summary:  [1: 2] [2: 3] [3: 8] [4: 5] [5: 2]         │
├─────────────────────────────────────────────────────────────┤
│  Tabs: [Tracking] [Triage] [Waiting] [Beds] [Resus]       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [1] John Doe, 45M - Chest Pain                      │  │
│  │ Arrived: 10:23 AM (32 min ago)                      │  │
│  │ Status: IN_TREATMENT | Bed: Room 3 | Dr. Smith     │  │
│  │ Vitals: BP 145/92, HR 98, SpO2 96%                  │  │
│  │ [View] [Vitals] [Orders] [Admit] [Discharge]       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [3] Jane Smith, 28F - Abdominal Pain               │  │
│  │ Arrived: 11:05 AM (18 min ago)                     │  │
│  │ Status: TRIAGED | Waiting for bed                   │  │
│  │ [Assign Bed] [Assign Doctor] [View Details]        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ...more patients...                                        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Stats: In ED: 20 | Avg Wait: 45 min | Treated: 58        │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2.2 Patient Detail Panel (Slide-out)
```
                    ┌─────────────────────────────────────┐
                    │ John Doe, 45M                  [X] │
                    │ MRN: 123456 | ESI: 1               │
                    ├─────────────────────────────────────┤
                    │ Tabs:                               │
                    │ [Overview][Vitals][Orders][Notes]   │
                    ├─────────────────────────────────────┤
                    │                                     │
                    │ Chief Complaint: Chest pain         │
                    │ Arrival: 10:23 AM via Ambulance     │
                    │ Time in ED: 45 minutes              │
                    │                                     │
                    │ ESI Level: 1 (Resuscitation)        │
                    │ Reasoning: Severe chest pain,       │
                    │ elevated troponin, EKG changes      │
                    │                                     │
                    │ Assigned: Dr. Smith, Nurse Johnson  │
                    │ Bed: Resus 1                        │
                    │                                     │
                    │ Latest Vitals:                      │
                    │ • BP: 145/92 mmHg (10:45 AM)       │
                    │ • HR: 98 bpm                        │
                    │ • SpO2: 96% on 2L O2               │
                    │                                     │
                    │ Actions:                            │
                    │ [Update Triage] [Record Vitals]     │
                    │ [Order Labs] [Order Imaging]        │
                    │ [Medications] [Admit] [Discharge]   │
                    │                                     │
                    └─────────────────────────────────────┘
```

#### 3.2.3 Triage Station View
```
┌──────────────────────────────────────────────────────────┐
│  AI Triage Assistant              [Calculate ESI]        │
├──────────────────────────────────────────────────────────┤
│  Chief Complaint: ________________________________       │
│                                                           │
│  Vitals:                                                  │
│  • BP: Sys [___] / Dia [___]                             │
│  • HR: [___] bpm                                          │
│  • RR: [___] breaths/min                                  │
│  • SpO2: [___] %                                          │
│  • Temp: [___] °C                                         │
│                                                           │
│  Pain Scale: [0]----[5]----[10]                          │
│                                                           │
│  Mental Status: [Alert] [Voice] [Pain] [Unresponsive]   │
│                                                           │
│  [☐] Patient is pregnant                                 │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ AI Result:                                         │ │
│  │                                                     │ │
│  │  ESI Level: 2 (Emergent)                          │ │
│  │                                                     │ │
│  │  Reasoning:                                        │ │
│  │  ✓ High-risk chest pain presentation               │ │
│  │  ✓ Elevated heart rate                            │ │
│  │                                                     │ │
│  │  Recommendations:                                   │ │
│  │  • Immediate physician evaluation                  │ │
│  │  • Continuous cardiac monitoring                   │ │
│  │  • Prepare for rapid intervention                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  [Assign ESI Level] [Save Triage] [Reset]               │
└──────────────────────────────────────────────────────────┘
```

#### 3.2.4 Bed Management View
```
┌──────────────────────────────────────────────────────────┐
│  ED Bed Management                      Occupancy: 75%   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Resuscitation:                                           │
│  [Resus 1: John Doe ●] [Resus 2: Available ○]           │
│                                                           │
│  Trauma Bays:                                             │
│  [Trauma 1: Available ○] [Trauma 2: Available ○]         │
│                                                           │
│  Acute Care:                                              │
│  [Room 1: Jane Smith ●] [Room 2: Available ○]            │
│  [Room 3: Bob Jones ●]  [Room 4: Dirty 🧹]               │
│  [Room 5: Available ○]  [Room 6: Sarah Lee ●]            │
│                                                           │
│  Fast Track:                                              │
│  [FT 1: Mike Brown ●] [FT 2: Available ○]                │
│                                                           │
│  Legend: ● Occupied | ○ Available | 🧹 Needs Cleaning   │
│                                                           │
│  Unassigned Patients (3):                                 │
│  • Jane Doe (ESI 3) - waiting 25 min                     │
│  • Tom Wilson (ESI 4) - waiting 15 min                   │
│  • Amy Chen (ESI 5) - waiting 45 min                     │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Technical Implementation

### 4.1 Backend Architecture

#### Technology Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Real-time**: Polling (30-second interval) or Socket.IO (future)

#### Service Layer Structure
```typescript
// emergencyService.ts
class EmergencyService {
  // Registration
  async registerPatient(hospitalId: string, data: RegisterEDPatientDto): Promise<EmergencyVisit>
  
  // Triage
  async calculateESI(data: ESICalculationDto): ESIResult
  async updateTriage(visitId: string, data: TriageUpdateDto): Promise<EmergencyVisit>
  
  // Patient Management
  async getActivePatients(hospitalId: string, filters?: EDFilters): Promise<EmergencyVisit[]>
  async getPatientDetails(visitId: string): Promise<EDPatientDetails>
  async assignDoctor(visitId: string, doctorId: string): Promise<EmergencyVisit>
  async assignBed(visitId: string, bedId: string): Promise<EmergencyVisit>
  
  // Vitals
  async recordVitals(visitId: string, vitals: VitalsDto): Promise<Vital>
  async getVitalsTrend(visitId: string): Promise<VitalsTrend>
  
  // Disposition
  async admitFromED(visitId: string, data: AdmitDto): Promise<Admission>
  async dischargeFromED(visitId: string, data: DischargeDto): Promise<EmergencyVisit>
  async transferPatient(visitId: string, data: TransferDto): Promise<EmergencyVisit>
  
  // Beds
  async getEDBeds(hospitalId: string): Promise<EDBed[]>
  async assignBed(bedId: string, patientId: string): Promise<EDBed>
  async updateBedStatus(bedId: string, status: BedStatus): Promise<EDBed>
  
  // Ambulance Integration
  async linkAmbulance(visitId: string, tripId: string): Promise<EmergencyVisit>
  async getIncomingAmbulances(hospitalId: string): Promise<AmbulanceTrip[]>
  
  // Trauma
  async recordTraumaAssessment(visitId: string, data: TraumaDto): Promise<EmergencyVisit>
  async calculateTraumaScores(visitId: string): Promise<TraumaScores>
  
  // Analytics
  async getEDStats(hospitalId: string, dateRange?: DateRange): Promise<EDStats>
  async getResuscitationDashboard(hospitalId: string): Promise<ResuscitationPatient[]>
  async getWaitingRoom(hospitalId: string): Promise<WaitingRoomData>
}
```

#### Database Migration Strategy
1. Create `EmergencyVisit` model
2. Create `EDBed` model
3. Add foreign keys to existing models:
   - `AmbulanceTrip.emergencyVisitId`
   - `LabOrder.emergencyVisitId`
   - `ImagingOrder.emergencyVisitId`
4. Migrate existing emergency appointments to EmergencyVisit records
5. Keep `appointment.notes` for backward compatibility (deprecated)

#### Data Migration Script
```typescript
// Migration: Convert existing emergency appointments to EmergencyVisit
async function migrateEmergencyAppointments() {
  const emergencyAppts = await prisma.appointment.findMany({
    where: { type: 'EMERGENCY' }
  });
  
  for (const appt of emergencyAppts) {
    const notes = appt.notes ? JSON.parse(appt.notes) : {};
    
    await prisma.emergencyVisit.create({
      data: {
        hospitalId: appt.hospitalId,
        patientId: appt.patientId,
        appointmentId: appt.id,
        arrivalMode: notes.arrivalMode || 'WALK_IN',
        arrivalTime: appt.createdAt,
        esiLevel: notes.esiLevel || 3,
        chiefComplaint: appt.reason || '',
        triageNotes: notes.triageNotes,
        status: mapAppointmentStatusToEDStatus(appt.status),
        priority: calculatePriority(notes.esiLevel || 3),
        assignedDoctorId: appt.doctorId
      }
    });
  }
}
```

### 4.2 Frontend Architecture

#### Technology Stack
- **Framework**: React 18 with TypeScript
- **Styling**: TailwindCSS (existing glassmorphism theme)
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router
- **Icons**: Heroicons
- **Notifications**: react-hot-toast
- **Forms**: React Hook Form + Zod validation

#### Component Structure
```
src/pages/Emergency/
├── index.tsx                    // Main tracking board
├── components/
│   ├── PatientCard.tsx          // Individual patient card
│   ├── PatientDetailPanel.tsx   // Slide-out details
│   ├── TriageStation.tsx        // AI triage interface
│   ├── WaitingRoom.tsx          // Waiting room view
│   ├── BedManagement.tsx        // Bed board
│   ├── ResuscitationDashboard.tsx // Critical patients
│   ├── EDStats.tsx              // Statistics cards
│   ├── NewPatientModal.tsx      // Registration modal
│   ├── VitalsChart.tsx          // Vitals trending
│   ├── OrdersPanel.tsx          // Labs/imaging/meds
│   └── DispositionModal.tsx     // Discharge/admit
└── hooks/
    ├── useEmergencyPatients.ts
    ├── useTriageCalculator.ts
    ├── useEDBeds.ts
    └── useEDStats.ts
```

#### API Client (api.ts)
```typescript
export const emergencyApi = {
  // Registration
  registerPatient: (data: RegisterPatientDto) =>
    axios.post('/api/v1/emergency/register', data),
  
  // Patients
  getPatients: (filters?: EDFilters) =>
    axios.get('/api/v1/emergency/patients', { params: filters }),
  
  getPatientDetails: (visitId: string) =>
    axios.get(`/api/v1/emergency/${visitId}/details`),
  
  // Triage
  calculateESI: (data: ESICalculationDto) =>
    axios.post('/api/v1/emergency/calculate-esi', data),
  
  updateTriage: (visitId: string, data: TriageUpdateDto) =>
    axios.patch(`/api/v1/emergency/${visitId}/triage`, data),
  
  // Actions
  assignDoctor: (visitId: string, doctorId: string) =>
    axios.patch(`/api/v1/emergency/${visitId}/assign-doctor`, { doctorId }),
  
  assignBed: (visitId: string, bedId: string) =>
    axios.patch(`/api/v1/emergency/${visitId}/assign-bed`, { bedId }),
  
  // Vitals
  recordVitals: (visitId: string, vitals: VitalsDto) =>
    axios.post(`/api/v1/emergency/${visitId}/vitals`, vitals),
  
  getVitals: (visitId: string) =>
    axios.get(`/api/v1/emergency/${visitId}/vitals`),
  
  // Disposition
  admitPatient: (visitId: string, data: AdmitDto) =>
    axios.post(`/api/v1/emergency/${visitId}/admit`, data),
  
  dischargePatient: (visitId: string, data: DischargeDto) =>
    axios.post(`/api/v1/emergency/${visitId}/discharge`, data),
  
  transferPatient: (visitId: string, data: TransferDto) =>
    axios.post(`/api/v1/emergency/${visitId}/transfer`, data),
  
  // Beds
  getBeds: (hospitalId: string) =>
    axios.get('/api/v1/emergency/beds', { params: { hospitalId } }),
  
  assignBed: (bedId: string, patientId: string) =>
    axios.patch(`/api/v1/emergency/beds/${bedId}/assign`, { patientId }),
  
  updateBedStatus: (bedId: string, status: BedStatus) =>
    axios.patch(`/api/v1/emergency/beds/${bedId}/status`, { status }),
  
  // Stats & Reports
  getStats: (filters?: DateRangeDto) =>
    axios.get('/api/v1/emergency/stats', { params: filters }),
  
  getResuscitation: (hospitalId: string) =>
    axios.get('/api/v1/emergency/resuscitation', { params: { hospitalId } }),
  
  getWaitingRoom: (hospitalId: string) =>
    axios.get('/api/v1/emergency/waiting-room', { params: { hospitalId } }),
  
  // Ambulance
  getIncomingAmbulances: (hospitalId: string) =>
    axios.get('/api/v1/emergency/incoming-ambulances', { params: { hospitalId } }),
  
  linkAmbulance: (visitId: string, tripId: string) =>
    axios.post('/api/v1/emergency/link-ambulance', { visitId, tripId }),
};
```

### 4.3 Deployment Strategy

#### Development Workflow
1. Develop feature locally with `ts-node-dev` (hot reload)
2. Test endpoints with Postman/Thunder Client
3. Test frontend with local backend
4. Commit changes to git

#### Production Deployment
```bash
# Backend deployment
ssh hms-ec2 "cd /home/ec2-user/hospital-management-system && \
  git pull && \
  cd hospital-management-system && \
  docker-compose build backend && \
  docker-compose up -d backend"

# Frontend deployment (if needed)
ssh hms-ec2 "cd /home/ec2-user/hospital-management-system/hospital-management-system && \
  docker-compose build frontend && \
  docker-compose up -d frontend"

# Database migration
ssh hms-ec2 "cd /home/ec2-user/hospital-management-system/backend && \
  npx prisma migrate deploy"
```

---

## 5. Known Issues & Fixes

### 5.1 Current Bugs

#### Bug #1: Patient Registration Error
**Problem**: POST /api/v1/emergency/register returns error when trying to create patient  
**Root Cause**: TBD (needs investigation)  
**Fix**: Review error logs, ensure patientLookupService is working correctly  
**Priority**: HIGH

#### Bug #2: Stats Field Mismatch
**Problem**: Frontend expects `inDepartment, treatedToday, admitted` but backend returns `totalToday, activePatients, completedToday`  
**Root Cause**: Field name mismatch between backend and frontend  
**Fix**: Update backend to return correct field names OR update frontend to map fields  
**Priority**: HIGH

#### Bug #3: "View Details" Button Does Nothing
**Problem**: Patient detail panel doesn't open when clicking "View Details"  
**Root Cause**: Missing click handler or state management  
**Fix**: Implement slide-out panel with patient details  
**Priority**: MEDIUM

#### Bug #4: Arrival Time Shows "Invalid Date"
**Problem**: `arrivalTime` field displays "Invalid Date"  
**Root Cause**: Likely using `appointment.createdAt` but format is wrong or field is null  
**Fix**: Ensure `arrivalTime` is properly set during registration and formatted correctly  
**Priority**: MEDIUM

#### Bug #5: avgWaitTime Hardcoded
**Problem**: Average wait time shows hardcoded value of 15 minutes  
**Root Cause**: Not calculated from real data  
**Fix**: Calculate from actual patient timestamps (door-to-doctor time)  
**Priority**: MEDIUM

#### Bug #6: "Update Wait Times" Button is Fake
**Problem**: Button doesn't actually recalculate wait times  
**Root Cause**: No backend logic for wait time prediction  
**Fix**: Implement wait time calculation based on current census and historical data  
**Priority**: LOW

---

## 6. Testing Plan

### 6.1 Unit Tests
- ESI calculation algorithm (all 5 levels)
- Trauma score calculations (GCS, RTS)
- Wait time calculations
- Data transformations

### 6.2 Integration Tests
- Patient registration flow (existing + new patient)
- Triage workflow
- Bed assignment
- Admit/discharge flow
- Ambulance linking

### 6.3 End-to-End Tests
- Complete patient journey: Arrival → Triage → Treatment → Disposition
- Resuscitation scenario (ESI 1)
- Multiple simultaneous patients

### 6.4 Performance Tests
- Load test: 50+ active patients
- Real-time polling performance
- Database query optimization

### 6.5 Manual Testing Checklist
- [ ] Register new patient (walk-in)
- [ ] Register existing patient
- [ ] Register patient from ambulance
- [ ] Calculate ESI using AI
- [ ] Override ESI level
- [ ] Assign doctor
- [ ] Assign bed
- [ ] Record vitals (multiple times)
- [ ] Order labs
- [ ] Order imaging
- [ ] Admit patient from ED
- [ ] Discharge patient
- [ ] Transfer patient
- [ ] View resuscitation dashboard
- [ ] Check waiting room view
- [ ] Verify stats accuracy
- [ ] Test auto-refresh

---

## 7. Success Metrics

### 7.1 Functional Metrics
- ✅ All patients use unified registration (no duplicates)
- ✅ ESI calculated correctly in >95% of cases
- ✅ Real-time board updates within 30 seconds
- ✅ Zero data loss during transitions

### 7.2 Performance Metrics
- Door-to-triage time: < 15 minutes
- Door-to-doctor time (ESI 1-2): < 10 minutes
- Door-to-doctor time (ESI 3): < 60 minutes
- Total ED length of stay: < 4 hours (average)
- LWBS rate: < 2%

### 7.3 User Satisfaction
- ED staff find system intuitive (>80% positive feedback)
- Reduces documentation time by 30%
- Improves patient throughput by 20%

---

## 8. Future Enhancements

### Phase 2 Features (Future)
- **Predictive Analytics**: ML model to predict ED surges
- **Capacity Management**: Auto-alerts when ED reaches capacity
- **Telemedicine Integration**: Virtual triage for lower-acuity patients
- **Patient Self-Check-In**: Kiosk for ESI 4-5 patients
- **Family Communication**: SMS updates to family members
- **Disaster Mode**: Mass casualty incident workflow
- **Pediatric-Specific**: Pediatric ESI and vitals
- **Behavioral Health**: Psychiatric emergency tracking
- **Billing Integration**: Auto-generate ED charges
- **Voice Commands**: Hands-free dictation for busy physicians

---

## 9. Appendices

### Appendix A: ESI Algorithm Reference
- Official ESI Implementation Handbook v4
- ACEP/ENA ESI Guidelines
- https://www.ahrq.gov/patient-safety/settings/emergency-dept/esi.html

### Appendix B: Glasgow Coma Scale
| Component | Response | Score |
|-----------|----------|-------|
| Eye Opening | Spontaneous | 4 |
| | To voice | 3 |
| | To pain | 2 |
| | None | 1 |
| Verbal Response | Oriented | 5 |
| | Confused | 4 |
| | Inappropriate words | 3 |
| | Incomprehensible | 2 |
| | None | 1 |
| Motor Response | Obeys commands | 6 |
| | Localizes pain | 5 |
| | Withdraws from pain | 4 |
| | Abnormal flexion | 3 |
| | Abnormal extension | 2 |
| | None | 1 |

### Appendix C: Revised Trauma Score
```
RTS = 0.9368 × GCS_coded + 0.7326 × SBP_coded + 0.2908 × RR_coded

Coded values:
GCS 13-15 = 4 | 9-12 = 3 | 6-8 = 2 | 4-5 = 1 | 3 = 0
SBP >89 = 4 | 76-89 = 3 | 50-75 = 2 | 1-49 = 1 | 0 = 0
RR 10-29 = 4 | >29 = 3 | 6-9 = 2 | 1-5 = 1 | 0 = 0
```

### Appendix D: Common Chief Complaints
- Chest pain / Cardiac symptoms
- Shortness of breath / Respiratory distress
- Abdominal pain
- Trauma / Injury
- Altered mental status / Confusion
- Stroke symptoms / Neurological deficit
- Severe allergic reaction
- Overdose / Poisoning
- Severe bleeding
- Seizure
- Fever / Infection concerns
- Headache (severe/sudden)
- Back pain
- Nausea/vomiting
- Laceration / Wound

---

## 10. Sign-off

**Prepared by:** AI Development Agent  
**Reviewed by:** Kamil (Team Member)  
**Approved by:** Project Manager  
**Date:** January 2025

**Next Steps:**
1. Review and approve PRD
2. Begin Phase 2: Testing existing features
3. Fix identified bugs (Phase 3)
4. Implement new features (Phase 4)
5. Deploy to production incrementally

---

**Document Version History:**
- v1.0 (2025-01-XX): Initial draft
