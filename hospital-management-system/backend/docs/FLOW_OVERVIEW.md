# HMS Slot & Appointment System - Flow Overview

> **Audited:** 2026-01-22 | Based on actual code implementation

## Table of Contents
1. [System Architecture](#1-system-architecture)
2. [Doctor Slot Configuration](#2-doctor-slot-configuration)
3. [Dynamic Slot Generation](#3-dynamic-slot-generation)
4. [Doctor Absence System](#4-doctor-absence-system)
5. [Hospital Holiday Calendar](#5-hospital-holiday-calendar)
6. [Booking Validations](#6-booking-validations)
7. [Auto NO_SHOW Detection](#7-auto-no_show-detection)
8. [Stage Alerts](#8-stage-alerts)
9. [No-Show Patient Blocking](#9-no-show-patient-blocking)
10. [Doctor Resignation/Unavailability](#10-doctor-resignationunavailability)
11. [Consultation Tracking](#11-consultation-tracking)
12. [Multi-Doctor Visits](#12-multi-doctor-visits)
13. [Cron Jobs](#13-cron-jobs)
14. [CloudWatch Monitoring (AWS)](#14-cloudwatch-monitoring-aws)
15. [API Reference](#15-api-reference)

---

## 1. System Architecture

### File Structure
```
backend/src/
├── services/
│   ├── slotService.ts          # Slot generation, booking, blocking
│   ├── appointmentService.ts   # Appointment CRUD, validations
│   ├── noShowService.ts        # NO_SHOW detection, stage alerts
│   ├── doctorService.ts        # Doctor CRUD, schedules, absences
│   ├── holidayService.ts       # Hospital holiday management
│   └── consultationService.ts  # Consultation lifecycle
├── routes/
│   ├── slotRoutes.ts           # /api/v1/slots/*
│   ├── appointmentRoutes.ts    # /api/v1/appointments/*
│   ├── noShowRoutes.ts         # /api/v1/no-show/*
│   └── doctorRoutes.ts         # /api/v1/doctors/*
├── jobs/
│   └── noShowCron.ts           # Cron job for NO_SHOW & alerts
└── prisma/schema.prisma        # Database models
```

### Database Models
| Model | File Location | Purpose |
|-------|---------------|---------|
| `Doctor` | schema.prisma | Doctor profile with slotDuration, maxPatientsPerDay |
| `DoctorSchedule` | schema.prisma | Weekly schedule (dayOfWeek, startTime, endTime, break) |
| `DoctorSlot` | schema.prisma | Individual bookable slots |
| `DoctorAbsence` | schema.prisma | Leave/absence periods |
| `HospitalHoliday` | schema.prisma | Hospital-wide holidays |
| `Appointment` | schema.prisma | Booked appointments |
| `Consultation` | schema.prisma | Consultation records with status tracking |
| `ConsultationParticipant` | schema.prisma | Multi-doctor support |
| `NoShowLog` | schema.prisma | NO_SHOW tracking records |
| `StageAlert` | schema.prisma | Alerts for waiting patients |
| `CronJobRun` | schema.prisma | Cron execution history |
| `Patient` | schema.prisma | Patient with noShowCount, status |

---

## 2. Doctor Slot Configuration

**File:** `backend/src/services/doctorService.ts:27-138`

### Doctor Model Fields
```typescript
{
  slotDuration: number;      // Minutes per slot (default: 30)
  maxPatientsPerDay: number; // Max appointments per day (default: 30)
  isAvailable: boolean;      // Can accept new appointments
}
```

### DoctorSchedule Model
```typescript
{
  doctorId: string;
  dayOfWeek: DayOfWeek;      // MONDAY, TUESDAY, etc.
  startTime: string;         // "09:00"
  endTime: string;           // "17:00"
  breakStart?: string;       // "13:00"
  breakEnd?: string;         // "14:00"
  isActive: boolean;
}
```

### Schedule Update Flow
```
Admin/Doctor updates schedule
         │
         ▼
┌────────────────────────────┐
│ Delete existing schedules  │  doctorService.ts:403-415
│ Create new schedules       │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ slotService.regenerateSlots()  slotService.ts:701-723
│ - Delete unbooked future slots
│ - Generate new slots       │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Find affected appointments │  doctorService.ts:365-400
│ (slots no longer valid)    │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Notify affected patients   │  doctorService.ts:428-456
│ Priority: HIGH             │
│ Channels: sms, in_app      │
└────────────────────────────┘
```

---

## 3. Dynamic Slot Generation

**File:** `backend/src/services/slotService.ts:93-240`

### Slot Generation Algorithm
```typescript
async generateSlotsForDoctor(doctorId, hospitalId, daysAhead = 30) {
  // 1. Get doctor with schedules
  // 2. Get active absences in date range
  // 3. Get hospital holidays in date range

  for (each day in range) {
    - Skip if holiday
    - Find schedule for day of week
    - Generate time slots based on schedule
    - Mark slots as blocked if in absence period
    - Upsert to avoid duplicates
  }
}
```

### Time Slot Calculation
**File:** `backend/src/services/slotService.ts:46-87`

```
Schedule: 09:00 - 17:00, Break: 13:00 - 14:00
Doctor slotDuration: 30 minutes

Morning Slots: 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30
Afternoon Slots: 14:00, 14:30, 15:00, 15:30, 16:00, 16:30
Total: 14 slots
```

### Slots by Duration
| Duration | 8hr Day (with 1hr break) |
|----------|-------------------------|
| 15 min   | 28 slots |
| 20 min   | 21 slots |
| 30 min   | 14 slots |
| 45 min   | 9 slots |
| 60 min   | 7 slots |

### On-Demand Generation
**File:** `backend/src/services/slotService.ts:369-412`

If no slots exist for a requested date, they are generated on-the-fly:
```
GET /slots/doctor/:doctorId/date/:date
         │
         ▼
    Slots exist?
    ├─ YES → Return slots
    └─ NO  → Generate slots for date → Return newly generated slots
```

---

## 4. Doctor Absence System

**File:** `backend/src/services/doctorService.ts:640-800`

### Absence Types (AbsenceType enum)
- `ANNUAL_LEAVE`
- `SICK_LEAVE`
- `CONFERENCE`
- `TRAINING`
- `PERSONAL`
- `EMERGENCY` - **Special handling** (see below)
- `OTHER`

### Absence Status
- `ACTIVE` - Currently in effect
- `CANCELLED` - No longer applies

### Create Absence Flow
```
POST /doctors/:id/absences
         │
         ▼
┌────────────────────────────┐
│ Validate dates             │  doctorService.ts:658-674
│ - endDate >= startDate     │
│ - startDate >= today       │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Check overlapping absences │  doctorService.ts:676-692
│ (error if overlap)         │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Find affected appointments │  doctorService.ts:694-710
│ Return warning count       │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Block slots in date range  │  slotService.ts:784-853
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Create DoctorAbsence       │
│ status: ACTIVE             │
└────────────────────────────┘
```

### Partial Day Absence
```typescript
{
  isFullDay: false,
  startDate: "2026-01-25",
  endDate: "2026-01-25",
  startTime: "14:00",  // Absence starts at 2 PM
  endTime: "17:00"     // Absence ends at 5 PM
}
// Only afternoon slots are blocked
```

### Emergency Leave (Special Handling)

**File:** `backend/src/services/doctorService.ts:758-820`

When `absenceType: 'EMERGENCY'`, the system performs additional actions:

```
POST /doctors/:id/absences { absenceType: 'EMERGENCY', ... }
         │
         ▼
┌────────────────────────────┐
│ Standard absence creation  │
│ (validate, block slots)    │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Is absenceType EMERGENCY?  │  doctorService.ts:758
└────────────────────────────┘
         │ YES
         ▼
┌────────────────────────────┐
│ For each affected appt:    │  doctorService.ts:767-783
│ • Update status → CANCELLED│
│ • Add note: "Auto-cancelled│
│   due to doctor emergency" │
│ • Release slot             │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Create HIGH priority       │  doctorService.ts:788-811
│ notification to patient:   │
│ • Title: "Appointment      │
│   Cancelled - Doctor       │
│   Emergency"               │
│ • priority: HIGH           │
└────────────────────────────┘
```

**Emergency vs Regular Leave Comparison:**

| Behavior | Regular Leave | Emergency Leave |
|----------|---------------|-----------------|
| Slots | Blocked | Blocked |
| Appointments | Remain active | **Auto-cancelled** |
| Slot after cancel | N/A | **Released for rebooking** |
| Notification | "Appointment Affected..." | **"Appointment Cancelled - Doctor Emergency"** |
| Priority | NORMAL | **HIGH** |
| Patient action | Must reschedule | Informed, can rebook |

---

## 5. Hospital Holiday Calendar

**File:** `backend/src/services/holidayService.ts`

### Holiday Model
```typescript
{
  hospitalId: string;
  name: string;           // "New Year's Day"
  date: Date;
  isRecurring: boolean;   // Repeats every year
  isActive: boolean;
  description?: string;
}
```

### Holiday Impact
1. **Slot Generation** (slotService.ts:173-185): Skips holiday dates
2. **Booking Validation** (appointmentService.ts:69-72): Prevents booking on holidays
3. **Recurring Holidays** (holidayService.ts:88-108): Matched by month/day across years

---

## 6. Booking Validations

**File:** `backend/src/services/appointmentService.ts:20-175`

### Validation Sequence
```
POST /appointments (create booking)
         │
         ▼
┌────────────────────────────┐
│ 1. Patient exists?         │  line 179-185
└────────────────────────────┘
         │ YES
         ▼
┌────────────────────────────┐
│ 2. Patient BLOCKED?        │  line 187-193
│    (status === 'BLOCKED')  │
└────────────────────────────┘
         │ NO
         ▼
┌────────────────────────────┐
│ 3. Patient duplicate?      │  line 203-227
│    (same date/time)        │
└────────────────────────────┘
         │ NO
         ▼
┌────────────────────────────┐
│ 4. Doctor exists?          │  line 28-35
└────────────────────────────┘
         │ YES
         ▼
┌────────────────────────────┐
│ 5. Doctor available?       │  line 37-40
│    (isAvailable=true)      │
└────────────────────────────┘
         │ YES
         ▼
┌────────────────────────────┐
│ 6. Doctor active?          │  line 42-45
│    (user.isActive=true)    │
└────────────────────────────┘
         │ YES
         ▼
┌────────────────────────────┐
│ 7. Date in past?           │  line 55-59
└────────────────────────────┘
         │ NO
         ▼
┌────────────────────────────┐
│ 8. Date > 30 days ahead?   │  line 61-66
└────────────────────────────┘
         │ NO
         ▼
┌────────────────────────────┐
│ 9. Hospital holiday?       │  line 68-72
└────────────────────────────┘
         │ NO
         ▼
┌────────────────────────────┐
│ 10. Doctor absence?        │  line 74-97
└────────────────────────────┘
         │ NO
         ▼
┌────────────────────────────┐
│ 11. Within schedule hours? │  line 108-119
└────────────────────────────┘
         │ YES
         ▼
┌────────────────────────────┐
│ 12. During break time?     │  line 121-131
└────────────────────────────┘
         │ NO
         ▼
┌────────────────────────────┐
│ 13. Slot already booked?   │  line 133-155
└────────────────────────────┘
         │ NO
         ▼
┌────────────────────────────┐
│ 14. Max patients reached?  │  line 157-172
└────────────────────────────┘
         │ NO
         ▼
     CREATE APPOINTMENT
```

### Race Condition Prevention
**File:** `backend/src/services/slotService.ts:579-649`

```typescript
await prisma.$transaction(async (tx) => {
  // Check slot availability within transaction
  // Book slot atomically
}, {
  isolationLevel: 'Serializable',
  timeout: 10000
});
```

---

## 7. Auto NO_SHOW Detection

**File:** `backend/src/services/noShowService.ts:74-244`

### Dynamic Timeout Calculation
```
NO_SHOW Threshold = Slot Start Time + Doctor's Slot Duration

Example:
- Appointment: 10:00
- Doctor slotDuration: 30 minutes
- Threshold: 10:30
- Current time: 10:35 → Mark as NO_SHOW
```

### NO_SHOW Detection Flow
```
Cron runs every 5 minutes (7 AM - 10 PM)
         │
         ▼
┌────────────────────────────────────────┐
│ Query appointments for today:          │  noShowService.ts:85-125
│ - status IN (SCHEDULED, CONFIRMED)     │
│ - appointmentDate = today              │
└────────────────────────────────────────┘
         │
         ▼
    For each appointment:
         │
         ▼
┌────────────────────────────────────────┐
│ currentTime >= slotStart + slotDuration?  line 128-133
└────────────────────────────────────────┘
         │
    ├─ NO  → Skip (within grace period)
    │
    └─ YES ▼
┌────────────────────────────────────────┐
│ 1. Update status = NO_SHOW             │  line 136-139
│ 2. Check if slot rebookable            │  line 142-152
│ 3. Create NoShowLog                    │  line 155-168
│ 4. Increment patient.noShowCount       │  line 171-178
│ 5. Block patient if count >= 3         │  line 180-191
│ 6. Send notification to patient        │  line 194-224
└────────────────────────────────────────┘
```

### Slot Release Logic
**File:** `backend/src/services/noShowService.ts:46-68`

```typescript
isSlotStillValid(appointmentDate, slotTime, bufferMinutes = 5) {
  - Future dates: Always valid for rebooking
  - Today: Valid if slotTime > currentTime + buffer
  - Past dates: Never valid
}
```

### NoShowLog Record
```typescript
{
  hospitalId: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  reason: 'AUTO_TIMEOUT' | 'MANUAL_STAFF' | 'MANUAL_DOCTOR' | 'PATIENT_CALLED';
  slotTime: string;
  timeoutMinutes: number;    // Doctor's slotDuration used as timeout
  slotReleased: boolean;
  slotReleasedAt?: Date;
  notificationSent: boolean;
  notes?: string;
  createdBy?: string;
}
```

---

## 8. Stage Alerts

**File:** `backend/src/services/noShowService.ts:251-436`

### Alert Thresholds
| Type | Trigger | Threshold |
|------|---------|-----------|
| `NO_VITALS` | Checked in, no vitals | slotDuration + 5 min |
| `NO_DOCTOR` | Vitals done, waiting | slotDuration + 10 min |

**File:** `noShowService.ts:7-8`
```typescript
const VITALS_ALERT_BUFFER = 5;   // Alert after slot interval + 5 mins
const DOCTOR_ALERT_BUFFER = 10;  // Alert after slot interval + 10 mins
```

### Stage Alert Flow
```
Patient checks in at 10:00
Doctor slotDuration: 30 min
         │
         ▼
┌────────────────────────────┐
│ Wait for vitals...         │
└────────────────────────────┘
         │
    10:35 (30 + 5 = 35 min elapsed)
         │
         ▼
┌────────────────────────────┐
│ status = CHECKED_IN        │  noShowService.ts:261-268
│ vitalsRecordedAt = null    │
│ Threshold exceeded!        │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Create StageAlert:         │  noShowService.ts:311-320
│ - alertType: NO_VITALS     │
│ - status: ACTIVE           │
│ - message: "Patient..."    │
└────────────────────────────┘
```

### Alert Lifecycle
```
ACTIVE → ACKNOWLEDGED → RESOLVED

acknowledgeAlert(): noShowService.ts:569-577
resolveAlert(): noShowService.ts:583-591
```

---

## 9. No-Show Patient Blocking

**File:** `backend/src/services/noShowService.ts:171-191`

### Blocking Threshold
```typescript
const NO_SHOW_BLOCK_THRESHOLD = 3;  // noShowService.ts:171
```

### Blocking Flow
```
Patient no-shows:
  1st → noShowCount = 1, status = ACTIVE
  2nd → noShowCount = 2, status = ACTIVE
  3rd → noShowCount = 3, status = BLOCKED ← Blocked immediately!
```

### Blocking Code
```typescript
// noShowService.ts:180-191
if (updatedPatient.noShowCount >= NO_SHOW_BLOCK_THRESHOLD
    && updatedPatient.status !== 'BLOCKED') {
  await prisma.patient.update({
    data: {
      status: 'BLOCKED',
      blockedAt: new Date(),
      blockedReason: `Blocked due to ${noShowCount} no-show appointments`
    }
  });
}
```

### Blocked Patient Impact
**File:** `appointmentService.ts:187-193`
```typescript
if (patient.status === 'BLOCKED') {
  throw new AppError(
    `Patient is blocked from booking appointments due to repeated no-shows...`,
    403
  );
}
```

---

## 10. Doctor Resignation/Unavailability

**File:** `backend/src/services/doctorService.ts:481-576`

### Toggle Availability Flow
```
PATCH /doctors/:id  { isAvailable: false }
         │
         ▼
┌────────────────────────────┐
│ Find all future appts:     │  doctorService.ts:499-508
│ - status: SCHEDULED/CONFIRMED
│ - appointmentDate >= today │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Cancel all appointments    │  doctorService.ts:511-523
│ status = CANCELLED         │
│ notes = "Doctor unavailable"
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Release all booked slots   │  doctorService.ts:526-537
│ isAvailable = true         │
│ appointmentId = null       │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Notify all patients:       │  doctorService.ts:540-561
│ Priority: HIGH             │
│ Channels: in_app, sms      │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Update doctor:             │  doctorService.ts:565-568
│ isAvailable = false        │
└────────────────────────────┘
```

### Response
```typescript
{
  ...doctor,
  cancelledAppointments: 5,
  notifiedPatients: 5,
  affectedAppointmentIds: ["uuid1", "uuid2", ...]
}
```

---

## 11. Consultation Tracking

**File:** `backend/src/services/consultationService.ts`

### Consultation Status Flow
```
    ┌─────────┐
    │ STARTED │ ← Created when doctor opens consultation
    └────┬────┘
         │ Update with diagnosis/notes
         ▼
   ┌────────────┐
   │ IN_PROGRESS│ ← consultationService.ts:97
   └─────┬──────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌──────────┐
│COMPLETED│ │ ABANDONED│
└─────────┘ └──────────┘
```

### Completion Validation
**File:** `consultationService.ts:147-158`
```typescript
// Required before completion:
if (!consultation.chiefComplaint) {
  errors.push('Chief complaint is required');
}
if (!consultation.diagnosis || consultation.diagnosis.length === 0) {
  errors.push('At least one diagnosis is required');
}
```

### Completion Transaction
**File:** `consultationService.ts:161-174`
```typescript
await prisma.$transaction([
  prisma.consultation.update({ status: 'COMPLETED', completedAt: new Date() }),
  prisma.appointment.update({ status: 'COMPLETED' }),
]);
```

---

## 12. Multi-Doctor Visits

**File:** `backend/src/services/consultationService.ts:245-412`

### Participant Roles (ParticipantRole enum)
| Role | Description |
|------|-------------|
| `PRIMARY` | Main attending doctor |
| `CONSULTING` | Specialist providing opinion |
| `ASSISTING` | Supporting the primary |
| `SUPERVISING` | Overseeing (training cases) |

### Add Participant Flow
```
POST /consultations/:id/participants
         │
         ▼
┌────────────────────────────┐
│ Validate consultation:     │  consultationService.ts:259-277
│ - Exists                   │
│ - Not COMPLETED/ABANDONED  │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Validate doctor:           │  consultationService.ts:280-296
│ - Not already participant  │
│ - Not the primary doctor   │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Create ConsultationParticipant  consultationService.ts:298-310
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Notify consulting doctor   │  consultationService.ts:313-333
│ "Dr. X has requested..."   │
│ Priority: HIGH             │
└────────────────────────────┘
```

---

## 13. Cron Jobs

**File:** `backend/src/jobs/noShowCron.ts`

### NO_SHOW Cron Configuration
```typescript
const JOB_NAME = 'NO_SHOW_CHECK';                    // line 21
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;        // line 22 (5 minutes)
const schedule = '*/5 7-22 * * *';                  // line 182 (every 5 min, 7AM-10PM)
```

### Cron Job Tasks
**File:** `noShowCron.ts:62-78`
```typescript
// 1. Process auto NO_SHOWs
const noShowResults = await noShowService.processAutoNoShows();

// 2. Process stage alerts
const alertResults = await noShowService.processStageAlerts();
```

### Health Monitoring
**File:** `noShowCron.ts:216-278`
```typescript
{
  jobName: "NO_SHOW_CHECK",
  isHealthy: boolean,
  healthMessage: string,
  isWorkingHours: boolean,
  lastRunTime: Date,
  lastRunStatus: "success" | "error",
  consecutiveFailures: number,
  lastSuccessfulRun: { id, startedAt, durationMs, itemsProcessed },
  recentRuns: [...],
  stats: { totalRuns, failedRuns, successRate }
}
```

### Timeout Protection
**File:** `noShowCron.ts:30-42`
```typescript
if (isProcessing && processingStartTime) {
  const elapsed = Date.now() - processingStartTime;
  if (elapsed > PROCESSING_TIMEOUT_MS) {
    console.error('Previous run stuck, resetting...');
    isProcessing = false;
    consecutiveFailures++;
  }
}
```

### Admin Alert on Failures
**File:** `noShowCron.ts:132-161`
```typescript
// After 3 consecutive failures
if (consecutiveFailures >= 3) {
  // Send notification to HOSPITAL_ADMIN users
  // Priority: HIGH
  // Channels: in_app, email
}
```

### External Trigger (Backup)
**File:** `noShowRoutes.ts:154-174`
```
POST /no-show/external-trigger
Header: x-cron-api-key: <CRON_API_KEY>

- Can be called by external scheduler (AWS CloudWatch, system cron)
- No JWT required, uses API key
- Acts as backup if internal cron fails
```

---

## 14. CloudWatch Monitoring (AWS)

**File:** `infrastructure/terraform/monitoring.tf`

### Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                        AWS CloudWatch                                │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐         ┌─────────────────────┐
│ EventBridge Rule    │────────▶│ Lambda Function     │
│ (every 5 minutes)   │         │ hms-cron-health-*   │
└─────────────────────┘         └─────────────────────┘
                                         │
                                         ▼
                                POST /no-show/external-trigger
                                Header: x-cron-api-key
                                         │
                       ┌─────────────────┴─────────────────┐
                       ▼                                   ▼
              ┌─────────────────┐                 ┌─────────────────┐
              │   SUCCESS       │                 │    FAILURE      │
              │                 │                 │                 │
              │ CronHealthStatus│                 │ CronHealthStatus│
              │      = 1        │                 │      = 0        │
              └─────────────────┘                 └─────────────────┘
                       │                                   │
                       ▼                                   ▼
              ┌─────────────────┐                 ┌─────────────────┐
              │ Alarm: OK       │                 │ Alarm: ALARM    │
              └─────────────────┘                 │ (after 2 fails) │
                                                  └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │ SNS → Email     │
                                                  │ Alert sent      │
                                                  └─────────────────┘
```

### Components

| Resource | Name Pattern | Purpose |
|----------|--------------|---------|
| Lambda | `{project}-cron-health-{env}` | Calls external trigger, publishes metrics |
| EventBridge | `{project}-cron-health-check-{env}` | Triggers Lambda every 5 min |
| CloudWatch Alarm | `{project}-cron-unhealthy-{env}` | Alerts after 2 consecutive failures |
| SNS Topic | `{project}-cron-alerts-{env}` | Email notifications |

### Metrics (Namespace: `HMS/CronJobs`)

| Metric | Description | Healthy Value |
|--------|-------------|---------------|
| `CronHealthStatus` | Health status (1=OK, 0=Failed) | 1 |
| `CronExecutionDuration` | Execution time in ms | < 30000 |

### Lambda Function Logic
**File:** `monitoring.tf:114-263`

1. Call `POST /api/v1/no-show/external-trigger` with API key
2. On success: Publish `CronHealthStatus=1` and duration
3. On failure: Publish `CronHealthStatus=0`, send SNS alert

### Alarm Configuration
**File:** `monitoring.tf:334-357`

```hcl
comparison_operator = "LessThanThreshold"
evaluation_periods  = 2        # Alert after 2 failures
period              = 300      # 5 minutes
threshold           = 1        # Healthy = 1
treat_missing_data  = "breaching"  # Missing = unhealthy
```

### Environment Variables
| Variable | Description |
|----------|-------------|
| `CRON_API_KEY` | API key for `/external-trigger` authentication |
| `BACKEND_URL` | Backend URL (e.g., https://spetaar.ai) |
| `alert_email` | Email for SNS notifications (Terraform var) |

### Failure Scenarios

**Scenario 1: Internal Cron Stopped**
```
Internal node-cron stops → Lambda still triggers external-trigger
                         → NO_SHOW check still runs (backup)
                         → CronHealthStatus = 1 (healthy from Lambda's view)
```

**Scenario 2: Backend Down**
```
Backend unreachable → Lambda POST fails
                    → CronHealthStatus = 0
                    → After 2 periods (10 min) → Alarm triggers
                    → SNS email to admin
```

---

## 15. API Reference

### Slot Routes (`/api/v1/slots`)
**File:** `backend/src/routes/slotRoutes.ts`

| Method | Endpoint | Auth | Line | Description |
|--------|----------|------|------|-------------|
| GET | `/doctor/:doctorId` | User | 27-38 | Get all future available slots |
| GET | `/doctor/:doctorId/date/:date` | User | 42-56 | Get slots for specific date |
| GET | `/doctor/:doctorId/range` | User | 59-80 | Get slots in date range |
| POST | `/generate/:doctorId` | Admin | 83-105 | Generate slots for N days |
| POST | `/regenerate/:doctorId` | Admin/Doctor | 108-121 | Regenerate future slots |
| PATCH | `/:slotId/block` | Admin/Doctor | 124-143 | Block/unblock a slot |

### NO_SHOW Routes (`/api/v1/no-show`)
**File:** `backend/src/routes/noShowRoutes.ts`

| Method | Endpoint | Auth | Line | Description |
|--------|----------|------|------|-------------|
| GET | `/logs` | Admin/Doctor/Receptionist | 24-48 | Get NO_SHOW logs |
| GET | `/stats` | Admin/Doctor | 55-74 | Get NO_SHOW statistics |
| GET | `/alerts` | Admin/Doctor/Nurse/Receptionist | 80-88 | Get active stage alerts |
| PUT | `/alerts/:alertId/acknowledge` | Admin/Doctor/Nurse | 94-104 | Acknowledge alert |
| PUT | `/alerts/:alertId/resolve` | Admin/Doctor/Nurse | 110-120 | Resolve alert |
| POST | `/trigger` | Admin | 126-134 | Manually trigger check |
| GET | `/cron-health` | Admin | 140-148 | Get cron health status |
| POST | `/external-trigger` | API Key | 155-174 | External backup trigger |
| POST | `/:appointmentId` | Staff | 181-206 | Manual NO_SHOW |

### Appointment Routes (`/api/v1/appointments`)
**File:** `backend/src/routes/appointmentRoutes.ts`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | User | Create appointment |
| GET | `/` | User | List appointments |
| GET | `/:id` | User | Get appointment details |
| PATCH | `/:id` | User | Update appointment |
| PATCH | `/:id/status` | User | Update status |
| DELETE | `/:id` | User | Cancel appointment |

### Doctor Routes (`/api/v1/doctors`)
**File:** `backend/src/routes/doctorRoutes.ts`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/:id/absences` | Doctor/Admin | Create absence |
| GET | `/:id/absences` | User | List absences |
| PATCH | `/:id/absences/:absenceId` | Doctor/Admin | Update absence |
| DELETE | `/:id/absences/:absenceId` | Doctor/Admin | Cancel absence |
| PUT | `/:id/schedules` | Doctor/Admin | Update schedules |
| PATCH | `/:id` | Admin | Update doctor (availability) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-22 | System | Initial documentation |
| 2.0 | 2026-01-22 | System | Complete rewrite based on code audit |
