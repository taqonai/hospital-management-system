# NO_SHOW Cron Job - Complete Flow Documentation

## Table of Contents
1. [High-Level Architecture](#1-high-level-architecture)
2. [Internal Cron Job Flow](#2-internal-cron-job-flow-every-5-minutes)
3. [Auto NO_SHOW Detection Flow](#3-auto-no_show-detection-flow)
4. [Stage Alerts Flow](#4-stage-alerts-flow)
5. [CloudWatch Monitoring Flow](#5-cloudwatch-monitoring-flow-backup--alerting)
6. [Database Tables](#6-database-tables-involved)
7. [Timeline Example](#7-timeline-example)
8. [API Endpoints](#8-api-endpoints-summary)
9. [Failure Recovery](#9-failure-recovery-flow)
10. [Edge Case Handling](#10-edge-case-handling)
11. [Summary](#11-summary)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        CloudWatch Monitoring                              │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │   │
│  │  │ EventBridge  │───▶│    Lambda    │───▶│   Metrics    │               │   │
│  │  │ (5 min)      │    │ Health Check │    │ & Alarms     │               │   │
│  │  └──────────────┘    └──────┬───────┘    └──────┬───────┘               │   │
│  │                             │                    │                        │   │
│  │                             │                    ▼                        │   │
│  │                             │            ┌──────────────┐                │   │
│  │                             │            │  SNS Topic   │───▶ Email      │   │
│  │                             │            └──────────────┘                │   │
│  └─────────────────────────────┼────────────────────────────────────────────┘   │
│                                │                                                 │
│  ┌─────────────────────────────┼────────────────────────────────────────────┐   │
│  │                     EC2 Instance                                          │   │
│  │  ┌──────────────────────────┼─────────────────────────────────────────┐  │   │
│  │  │              Docker: hms-backend                                    │  │   │
│  │  │                          │                                          │  │   │
│  │  │  ┌───────────────────────▼────────────────────────────────────┐    │  │   │
│  │  │  │                    Node.js App                              │    │  │   │
│  │  │  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐ │    │  │   │
│  │  │  │  │ node-cron   │───▶│ noShowCron  │───▶│  noShowService  │ │    │  │   │
│  │  │  │  │ (5 min)     │    │             │    │                 │ │    │  │   │
│  │  │  │  └─────────────┘    └─────────────┘    └────────┬────────┘ │    │  │   │
│  │  │  │                                                  │          │    │  │   │
│  │  │  │  ┌─────────────┐    ┌─────────────┐             │          │    │  │   │
│  │  │  │  │ Express API │◀───│ /external-  │◀────────────┘          │    │  │   │
│  │  │  │  │             │    │  trigger    │                        │    │  │   │
│  │  │  │  └─────────────┘    └─────────────┘                        │    │  │   │
│  │  │  └────────────────────────────────────────────────────────────┘    │  │   │
│  │  └────────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                           │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │   │
│  │  │              Docker: hms-postgres                                   │  │   │
│  │  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐  │  │   │
│  │  │  │  appointments  │  │  no_show_logs  │  │   cron_job_runs      │  │  │   │
│  │  │  │  (status)      │  │  (history)     │  │   (health tracking)  │  │  │   │
│  │  │  └────────────────┘  └────────────────┘  └──────────────────────┘  │  │   │
│  │  │  ┌────────────────┐  ┌────────────────┐                            │  │   │
│  │  │  │  stage_alerts  │  │  doctor_slots  │                            │  │   │
│  │  │  │  (active)      │  │  (release)     │                            │  │   │
│  │  │  └────────────────┘  └────────────────┘                            │  │   │
│  │  └────────────────────────────────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Internal Cron Job Flow (Every 5 Minutes)

**File:** `backend/src/jobs/noShowCron.ts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         noShowCron.ts - processNoShows()                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │  1. Check if already processing │
                    │     (prevent duplicate runs)    │
                    └─────────────────────────────────┘
                                      │
                         isProcessing? ──Yes──▶ Skip & Return
                                      │
                                     No
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │  2. Log run start to database   │
                    │     INSERT INTO cron_job_runs   │
                    │     status = 'RUNNING'          │
                    └─────────────────────────────────┘
                                      │
                                      ▼
          ┌───────────────────────────────────────────────────────┐
          │                                                       │
          ▼                                                       ▼
┌─────────────────────┐                             ┌─────────────────────┐
│ 3. processAutoNoShows│                             │ 4. processStageAlerts│
│    (noShowService)   │                             │    (noShowService)   │
└─────────────────────┘                             └─────────────────────┘
          │                                                       │
          ▼                                                       ▼
┌─────────────────────┐                             ┌─────────────────────┐
│ Mark NO_SHOW        │                             │ Create alerts for   │
│ Release slots       │                             │ waiting patients    │
│ Send notifications  │                             │                     │
└─────────────────────┘                             └─────────────────────┘
          │                                                       │
          └───────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────────┐
                    │  5. Update run in database      │
                    │     status = 'COMPLETED'        │
                    │     durationMs, itemsProcessed  │
                    └─────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────────┐
                    │  6. Reset consecutiveFailures   │
                    │     isProcessing = false        │
                    └─────────────────────────────────┘
```

### Schedule Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Schedule | `*/5 7-22 * * *` | Every 5 minutes, 7 AM - 10 PM |
| Initial Run | 5 seconds after startup | Catch any missed NO_SHOWs |
| Duplicate Prevention | `isProcessing` flag | Prevents overlapping runs |

---

## 3. Auto NO_SHOW Detection Flow

**File:** `backend/src/services/noShowService.ts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    noShowService.processAutoNoShows()                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │  Query today's appointments where:       │
                    │  • status = 'SCHEDULED' or 'CONFIRMED'  │
                    │  • appointmentDate = TODAY              │
                    └─────────────────────────────────────────┘
                                      │
                                      ▼
                         For each appointment:
                                      │
                    ┌─────────────────────────────────────────┐
                    │  Calculate timeout threshold:           │
                    │                                         │
                    │  slotTime = "09:00"                     │
                    │  slotDuration = 15 (from doctor config) │
                    │  currentTime = "09:20"                  │
                    │                                         │
                    │  timeoutMinutes = slotTime + slotDuration│
                    │  = 09:00 + 15 = 09:15                   │
                    │                                         │
                    │  Is currentTime > timeoutMinutes?       │
                    │  09:20 > 09:15 = YES → Mark NO_SHOW     │
                    └─────────────────────────────────────────┘
                                      │
                              Should mark NO_SHOW?
                                      │
                         ┌────────────┴────────────┐
                        Yes                       No
                         │                         │
                         ▼                         ▼
          ┌──────────────────────────┐    ┌─────────────┐
          │ 1. Update appointment    │    │ Skip to     │
          │    status = 'NO_SHOW'    │    │ next appt   │
          │                          │    └─────────────┘
          │ 2. Create NoShowLog      │
          │    reason = 'AUTO_TIMEOUT'│
          │    timeoutMinutes = 15   │
          │                          │
          │ 3. Check slot release    │
          │    eligibility           │
          └──────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────┐
          │  Is slot still valid     │
          │  for rebooking?          │
          │                          │
          │  currentTime < slotEndTime?│
          │  09:20 < 09:15 = NO      │
          │  (too late to rebook)    │
          └──────────────────────────┘
                         │
                ┌────────┴────────┐
               Yes               No
                │                 │
                ▼                 ▼
    ┌───────────────────┐  ┌───────────────┐
    │ Release slot:     │  │ Don't release │
    │ isBlocked = false │  │ slot already  │
    │ isBooked = false  │  │ passed        │
    │ slotReleased=true │  └───────────────┘
    └───────────────────┘
                │
                ▼
    ┌───────────────────┐
    │ Send notification │
    │ to patient via    │
    │ SMS & in-app      │
    └───────────────────┘
```

### NO_SHOW Reasons

| Reason | Description | Created By |
|--------|-------------|------------|
| `AUTO_TIMEOUT` | Automatic - exceeded slot interval | System (cron) |
| `MANUAL_STAFF` | Manually marked by staff | Receptionist/Nurse |
| `MANUAL_DOCTOR` | Manually marked by doctor | Doctor |
| `PATIENT_CALLED` | Patient called to cancel late | Staff |

---

## 4. Stage Alerts Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    noShowService.processStageAlerts()                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
              ▼                                               ▼
┌──────────────────────────┐                    ┌──────────────────────────┐
│  NO_VITALS Alert         │                    │  NO_DOCTOR Alert         │
│                          │                    │                          │
│  Query appointments:     │                    │  Query appointments:     │
│  • status = 'CHECKED_IN' │                    │  • status = 'CHECKED_IN' │
│  • vitalsRecordedAt=NULL │                    │  • vitalsRecordedAt SET  │
│  • No existing alert     │                    │  • Not IN_PROGRESS       │
│                          │                    │  • No existing alert     │
└──────────────────────────┘                    └──────────────────────────┘
              │                                               │
              ▼                                               ▼
┌──────────────────────────┐                    ┌──────────────────────────┐
│  Check timing:           │                    │  Check timing:           │
│                          │                    │                          │
│  slotTime = 09:00        │                    │  slotTime = 09:00        │
│  slotDuration = 15       │                    │  slotDuration = 15       │
│  threshold = slot + 5min │                    │  threshold = slot + 10min│
│  = 09:20                 │                    │  = 09:25                 │
│                          │                    │                          │
│  currentTime > 09:20?    │                    │  currentTime > 09:25?    │
└──────────────────────────┘                    └──────────────────────────┘
              │                                               │
              ▼                                               ▼
┌──────────────────────────┐                    ┌──────────────────────────┐
│  Create StageAlert:      │                    │  Create StageAlert:      │
│                          │                    │                          │
│  alertType = 'NO_VITALS' │                    │  alertType = 'NO_DOCTOR' │
│  status = 'ACTIVE'       │                    │  status = 'ACTIVE'       │
│  message = "Patient X    │                    │  message = "Patient X    │
│   checked in but vitals  │                    │   vitals done but doctor │
│   not recorded"          │                    │   not seen patient"      │
└──────────────────────────┘                    └──────────────────────────┘
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │  Alerts visible in:                     │
                    │  • GET /api/v1/no-show/alerts           │
                    │  • Staff dashboard (real-time)          │
                    │                                         │
                    │  Staff can:                             │
                    │  • Acknowledge: PUT /alerts/:id/ack     │
                    │  • Resolve: PUT /alerts/:id/resolve     │
                    └─────────────────────────────────────────┘
```

### Alert Types

| Alert Type | Trigger Condition | Threshold | Target Staff |
|------------|-------------------|-----------|--------------|
| `NO_VITALS` | Checked in, no vitals | slot + 5 min | Nurse |
| `NO_DOCTOR` | Vitals done, not seen | slot + 10 min | Doctor |
| `WAITING_TOO_LONG` | General long wait | Configurable | All |

### Alert Status Flow

```
ACTIVE ──▶ ACKNOWLEDGED ──▶ RESOLVED
   │            │               │
   │            │               └── Staff resolved the issue
   │            └── Staff saw the alert
   └── Alert just created
```

---

## 5. CloudWatch Monitoring Flow (Backup & Alerting)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Every 5 Minutes                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │         AWS EventBridge                  │
                    │    Rule: rate(5 minutes)                 │
                    └─────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │      Lambda: hms-cron-health-prod        │
                    │                                          │
                    │  1. Call POST /external-trigger          │
                    │     with x-cron-api-key header          │
                    │                                          │
                    │  2. Backend executes NO_SHOW check      │
                    │     (acts as backup if internal failed) │
                    │                                          │
                    │  3. Get response with health status     │
                    └─────────────────────────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                    Success                    Failure
                         │                         │
                         ▼                         ▼
          ┌──────────────────────────┐  ┌──────────────────────────┐
          │ Publish to CloudWatch:   │  │ Publish to CloudWatch:   │
          │                          │  │                          │
          │ CronHealthStatus = 1     │  │ CronHealthStatus = 0     │
          │ CronExecutionDuration=Xms│  │                          │
          └──────────────────────────┘  │ Send SNS alert           │
                         │              └──────────────────────────┘
                         │                         │
                         ▼                         ▼
          ┌──────────────────────────┐  ┌──────────────────────────┐
          │ CloudWatch Alarm:        │  │ CloudWatch Alarm:        │
          │ State = OK               │  │ State = ALARM            │
          │                          │  │                          │
          │ (No notification)        │  │ Trigger SNS notification │
          └──────────────────────────┘  └──────────────────────────┘
                                                   │
                                                   ▼
                                      ┌──────────────────────────┐
                                      │ SNS → Email Alert        │
                                      │                          │
                                      │ Subject: [ALARM] HMS     │
                                      │ Cron Health Check Failed │
                                      │                          │
                                      │ - Error details          │
                                      │ - Timestamp              │
                                      │ - Dashboard link         │
                                      └──────────────────────────┘
```

### CloudWatch Resources

| Resource | Name | Purpose |
|----------|------|---------|
| Lambda Function | `hms-cron-health-prod` | Calls health check endpoint |
| EventBridge Rule | `hms-cron-health-check-prod` | Triggers Lambda every 5 min |
| CloudWatch Alarm | `hms-cron-unhealthy-prod` | Alerts on 2 consecutive failures |
| SNS Topic | `hms-cron-alerts-prod` | Sends email notifications |

### CloudWatch Metrics

| Metric | Namespace | Description |
|--------|-----------|-------------|
| `CronHealthStatus` | `HMS/CronJobs` | 1 = healthy, 0 = unhealthy |
| `CronExecutionDuration` | `HMS/CronJobs` | Execution time in ms |

---

## 6. Database Tables Involved

### appointments
```sql
CREATE TABLE appointments (
  id              UUID PRIMARY KEY,
  status          AppointmentStatus,  -- SCHEDULED, CONFIRMED, CHECKED_IN,
                                      -- IN_PROGRESS, COMPLETED, NO_SHOW, CANCELLED
  appointmentDate DATE,
  startTime       VARCHAR(5),         -- "09:00"
  checkedInAt     TIMESTAMP,          -- When patient checked in
  vitalsRecordedAt TIMESTAMP          -- When vitals were recorded
);
```

### no_show_logs
```sql
CREATE TABLE no_show_logs (
  id              UUID PRIMARY KEY,
  appointmentId   UUID REFERENCES appointments(id),
  reason          NoShowReason,       -- AUTO_TIMEOUT, MANUAL_STAFF,
                                      -- MANUAL_DOCTOR, PATIENT_CALLED
  slotTime        VARCHAR(5),         -- "09:00" (original slot time)
  timeoutMinutes  INTEGER,            -- 15 (doctor's slot duration used)
  triggeredAt     TIMESTAMP,          -- When NO_SHOW was triggered
  slotReleased    BOOLEAN,            -- true/false
  slotReleasedAt  TIMESTAMP,          -- When slot was released
  notificationSent BOOLEAN,           -- true/false
  createdBy       UUID                -- NULL (auto) or userId (manual)
);
```

### stage_alerts
```sql
CREATE TABLE stage_alerts (
  id              UUID PRIMARY KEY,
  appointmentId   UUID REFERENCES appointments(id),
  alertType       StageAlertType,     -- NO_VITALS, NO_DOCTOR, WAITING_TOO_LONG
  status          StageAlertStatus,   -- ACTIVE, ACKNOWLEDGED, RESOLVED
  message         TEXT,               -- Human-readable alert message
  triggeredAt     TIMESTAMP,          -- When alert was created
  acknowledgedAt  TIMESTAMP,          -- When staff acknowledged
  acknowledgedBy  UUID,               -- User who acknowledged
  resolvedAt      TIMESTAMP,          -- When resolved
  resolvedBy      UUID                -- User who resolved
);
```

### cron_job_runs
```sql
CREATE TABLE cron_job_runs (
  id              UUID PRIMARY KEY,
  jobName         VARCHAR(50),        -- "NO_SHOW_CHECK"
  status          CronJobStatus,      -- RUNNING, COMPLETED, FAILED
  startedAt       TIMESTAMP,          -- When cron started
  completedAt     TIMESTAMP,          -- When cron finished
  durationMs      INTEGER,            -- Execution time in milliseconds
  itemsProcessed  INTEGER,            -- Number of NO_SHOWs + alerts created
  errorMessage    TEXT,               -- Error details if failed
  metadata        JSONB               -- { source: "cron" | "manual" | "external" }
);
```

### doctor_slots
```sql
CREATE TABLE doctor_slots (
  id              UUID PRIMARY KEY,
  doctorId        UUID REFERENCES doctors(id),
  slotDate        DATE,
  startTime       VARCHAR(5),         -- "09:00"
  endTime         VARCHAR(5),         -- "09:15"
  isBooked        BOOLEAN,            -- Released when NO_SHOW if still valid
  isBlocked       BOOLEAN,
  appointmentId   UUID                -- Cleared on release
);
```

---

## 7. Timeline Example

### Scenario A: Patient No-Show

```
Time        Event                                    System Action
────────────────────────────────────────────────────────────────────────────────

08:00       Patient books 09:00 appointment          Slot marked isBooked=true
            with Dr. Smith (15-min slots)

09:00       Appointment time starts                  Cron checks: status=SCHEDULED
            Patient has not arrived                  Not yet past timeout (09:15)

09:05       Cron runs                                Still waiting, no action

09:10       Cron runs                                Still waiting, no action

09:15       Timeout threshold reached                Cron marks NO_SHOW
            (slotTime + slotDuration)                • status = NO_SHOW
                                                     • NoShowLog created
                                                     • Slot NOT released (past time)
                                                     • SMS sent to patient
```

### Scenario B: Patient Checks In Late

```
Time        Event                                    System Action
────────────────────────────────────────────────────────────────────────────────

08:00       Patient books 09:00 appointment

09:05       Patient checks in                        status = CHECKED_IN
                                                     checkedInAt = 09:05

09:10       Cron runs                                Checked in, no NO_SHOW
            No vitals recorded yet                   Creates NO_VITALS alert
                                                     (checked in > 5 min, no vitals)

09:12       Nurse records vitals                     vitalsRecordedAt = 09:12
                                                     NO_VITALS alert auto-resolves

09:20       Cron runs                                Vitals done, not with doctor
            Patient waiting for doctor               Creates NO_DOCTOR alert
                                                     (vitals > 10 min, not seen)

09:22       Doctor starts consultation               status = IN_PROGRESS
                                                     NO_DOCTOR alert auto-resolves

09:35       Consultation complete                    status = COMPLETED
```

### Scenario C: Slot Release for Rebooking

```
Time        Event                                    System Action
────────────────────────────────────────────────────────────────────────────────

08:00       Patient A books 10:00 appointment        Slot marked isBooked=true

09:50       Cron runs                                Still waiting, no action
            Patient A hasn't arrived

10:00       Cron runs                                Not yet past timeout (10:15)

10:05       Cron runs                                Still waiting

10:10       Staff manually marks NO_SHOW             • status = NO_SHOW
            (before automatic timeout)               • Slot IS released (still 5 min left)
                                                     • isBooked = false
                                                     • Patient B can now book 10:00 slot
```

---

## 8. API Endpoints Summary

### NO_SHOW Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/no-show/:appointmentId` | POST | JWT | Manual NO_SHOW marking |
| `/api/v1/no-show/logs` | GET | JWT | NO_SHOW history/reports |
| `/api/v1/no-show/stats` | GET | JWT | Statistics (NO_SHOW rate) |

### Stage Alerts

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/no-show/alerts` | GET | JWT | Active stage alerts |
| `/api/v1/no-show/alerts/:id/acknowledge` | PUT | JWT | Staff acknowledges alert |
| `/api/v1/no-show/alerts/:id/resolve` | PUT | JWT | Staff resolves alert |

### Cron Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/no-show/trigger` | POST | JWT (Admin) | Manual cron trigger |
| `/api/v1/no-show/cron-health` | GET | JWT (Admin) | Cron health status |
| `/api/v1/no-show/external-trigger` | POST | API Key | External backup trigger |

### Example Responses

**GET /api/v1/no-show/cron-health**
```json
{
  "success": true,
  "data": {
    "jobName": "NO_SHOW_CHECK",
    "isHealthy": true,
    "healthMessage": "OK",
    "isWorkingHours": true,
    "lastRunTime": "2026-01-21T21:16:00.877Z",
    "lastRunStatus": "success",
    "consecutiveFailures": 0,
    "lastSuccessfulRun": {
      "id": "6f4db44c-5daa-4a22-84cd-051c34715710",
      "startedAt": "2026-01-21T21:16:00.831Z",
      "durationMs": 49,
      "itemsProcessed": 0
    },
    "recentRuns": [...],
    "stats": {
      "totalRuns": 10,
      "failedRuns": 0,
      "successRate": "100.0%"
    }
  }
}
```

**GET /api/v1/no-show/alerts**
```json
{
  "success": true,
  "data": [
    {
      "id": "528ac988-3969-40d8-8f15-4f5804b88bc9",
      "alertType": "NO_VITALS",
      "status": "ACTIVE",
      "message": "Patient Roy Anindya (HMS001-MKEVX0F35AIU) checked in at 09:00 but vitals not recorded.",
      "triggeredAt": "2026-01-21T21:07:43.647Z",
      "patient": {
        "firstName": "Roy",
        "lastName": "Anindya",
        "mrn": "HMS001-MKEVX0F35AIU"
      },
      "doctor": {
        "user": {
          "firstName": "Anagha",
          "lastName": "Vijay"
        }
      }
    }
  ]
}
```

---

## 9. Failure Recovery Flow

### Scenario 1: Internal Cron Stops (Node.js crash/freeze)

```
  Internal Cron ──X──▶ (stopped)
                              │
                              │ CloudWatch Lambda still runs every 5 min
                              ▼
                    POST /external-trigger
                              │
                              ▼
                    Backend executes NO_SHOW check anyway
                    (Lambda acts as backup cron)
```

### Scenario 2: Backend Completely Down

```
  Lambda ──▶ POST /external-trigger ──X──▶ Connection refused
                              │
                              ▼
                    CronHealthStatus = 0 (unhealthy)
                              │
                              ▼
                    After 2 consecutive failures (10 min)
                              │
                              ▼
                    CloudWatch Alarm = ALARM
                              │
                              ▼
                    SNS ──▶ Email Alert to admin@spetaar.ai
```

### Scenario 3: Cron Job Throws Error

```
  Cron runs ──▶ Database error / Exception
                              │
                              ▼
                    consecutiveFailures++
                              │
                              ▼
                    If consecutiveFailures >= 3
                              │
                              ▼
                    Send in-app notification to all HOSPITAL_ADMINs
                              │
                              ▼
                    Log to cron_job_runs with status=FAILED, errorMessage
```

### Alert Channels

| Failure Type | Alert Channel | Recipients |
|--------------|---------------|------------|
| Backend down | Email (SNS) | admin@spetaar.ai |
| Cron error (3+ failures) | In-app notification | All Hospital Admins |
| Health check failure | CloudWatch Alarm | SNS subscribers |

---

## 10. Edge Case Handling

This section documents how the system handles various edge cases that can affect appointment slots and scheduling.

### 10.1 Cron Job Stuck Processing (Timeout Protection)

**File:** `backend/src/jobs/noShowCron.ts`

**Problem:** If a cron job run hangs due to database issues or network problems, subsequent runs would be skipped indefinitely (due to `isProcessing` flag).

**Solution:** Added 5-minute timeout mechanism that automatically resets the processing flag.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Timeout Protection Flow                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Cron job triggered (every 5m)  │
                   └─────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Check: isProcessing == true?   │
                   └─────────────────────────────────┘
                                     │
                        ┌────────────┴────────────┐
                       Yes                        No
                        │                          │
                        ▼                          ▼
          ┌──────────────────────────┐    ┌─────────────────┐
          │  Calculate elapsed time:  │    │ Proceed with    │
          │  elapsed = now - startTime│    │ normal execution│
          └──────────────────────────┘    └─────────────────┘
                        │
                        ▼
          ┌──────────────────────────┐
          │  Is elapsed > 5 minutes? │
          └──────────────────────────┘
                        │
               ┌────────┴────────┐
              Yes               No
               │                 │
               ▼                 ▼
    ┌───────────────────┐  ┌───────────────────┐
    │ TIMEOUT DETECTED: │  │ Skip: "Already    │
    │ • Reset isProcessing│  │ processing"      │
    │ • Reset startTime   │  │                   │
    │ • consecutiveFailures++│  └───────────────────┘
    │ • Log error         │
    │ • Continue execution│
    └───────────────────┘
```

**Example Scenario:**
```
Time        Event                                    System Action
────────────────────────────────────────────────────────────────────────────────
09:00       Cron run starts                          isProcessing = true
                                                     processingStartTime = 09:00

09:01       Database connection hangs                Query stuck waiting

09:05       Next cron triggered                      Check: isProcessing = true
            (processing for 5 min)                   Elapsed = 5 min
                                                     SKIP: "Already processing"

09:10       Next cron triggered                      Check: isProcessing = true
            (processing for 10 min)                  Elapsed = 10 min > 5 min TIMEOUT!
                                                     Reset flags, continue execution
                                                     consecutiveFailures++
```

---

### 10.2 Patient Cancels Last Minute

**File:** `backend/src/services/appointmentService.ts`

**Problem:** When a patient cancels within 24 hours of their appointment, the doctor may have blocked their schedule for that slot and needs to know immediately.

**Solution:** Added doctor notification with last-minute flag detection.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Patient Cancellation Flow                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Patient calls cancelAppointment│
                   └─────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Update: status = CANCELLED     │
                   │  Release slot (if applicable)   │
                   └─────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Calculate hours until appt:    │
                   │  hoursUntil = (apptDate - now)  │
                   │              / (1000 * 60 * 60) │
                   └─────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Is hoursUntil <= 24 hours      │
                   │  AND hoursUntil >= 0?           │
                   └─────────────────────────────────┘
                                     │
                        ┌────────────┴────────────┐
                       Yes                        No
                   (Last-minute)              (Advance notice)
                        │                         │
                        ▼                         ▼
          ┌──────────────────────────┐  ┌──────────────────────────┐
          │ Send HIGH priority       │  │ Send NORMAL priority     │
          │ notification to doctor:  │  │ notification to doctor:  │
          │                          │  │                          │
          │ Title: "Last-Minute      │  │ Title: "Appointment      │
          │         Cancellation"    │  │         Cancelled"       │
          │                          │  │                          │
          │ metadata.isLastMinute    │  │ metadata.isLastMinute    │
          │ = true                   │  │ = false                  │
          └──────────────────────────┘  └──────────────────────────┘
```

**Example Scenario:**
```
Time        Event                                    System Action
────────────────────────────────────────────────────────────────────────────────
Day 1
10:00       Patient books appointment                Appointment created
            for Day 2 at 09:00                       Slot booked

Day 2
07:30       Patient cancels (1.5 hours before)       • status = CANCELLED
            "Emergency came up"                      • Slot released
                                                     • hoursUntil = 1.5 (< 24)
                                                     • isLastMinute = true

            Doctor receives notification:            [HIGH PRIORITY]
            "Last-Minute Cancellation               Title: Last-Minute Cancellation
             John Smith cancelled their              Message: John Smith cancelled
             09:00 appointment on Jan 22"            their 09:00 appointment...
```

---

### 10.3 Doctor Takes Emergency Leave

**File:** `backend/src/services/doctorService.ts`

**Problem:** When a doctor takes emergency leave (e.g., personal emergency, sudden illness), patients with existing appointments need to be notified and slots should be released.

**Solution:** Auto-cancel appointments when absence type is `EMERGENCY` and notify affected patients.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Emergency Leave Flow                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Admin creates doctor absence   │
                   │  type = 'EMERGENCY'             │
                   │  dates = Jan 22 - Jan 24        │
                   └─────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Query existing appointments    │
                   │  in date range with status:     │
                   │  SCHEDULED, CONFIRMED, CHECKED_IN│
                   └─────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Is absenceType == 'EMERGENCY'? │
                   └─────────────────────────────────┘
                                     │
                        ┌────────────┴────────────┐
                       Yes                        No
                        │                          │
                        ▼                          ▼
          ┌──────────────────────────┐  ┌──────────────────────────┐
          │  For each appointment:   │  │  Only block slots        │
          │                          │  │  (appointments remain,   │
          │  1. Update status =      │  │   warn in response)      │
          │     CANCELLED            │  │                          │
          │                          │  └──────────────────────────┘
          │  2. Add note:            │
          │     "Auto-cancelled due  │
          │      to doctor emergency │
          │      leave"              │
          │                          │
          │  3. Release slot via     │
          │     slotService          │
          │                          │
          │  4. Create notification  │
          │     for patient          │
          └──────────────────────────┘
                        │
                        ▼
          ┌──────────────────────────┐
          │  Block all slots in      │
          │  date range              │
          └──────────────────────────┘
                        │
                        ▼
          ┌──────────────────────────┐
          │  Return response with:   │
          │  • absence record        │
          │  • slotsBlocked count    │
          │  • cancelledAppointments │
          │  • patientNotifications  │
          └──────────────────────────┘
```

**Example Scenario:**
```
Time        Event                                    System Action
────────────────────────────────────────────────────────────────────────────────
Day 1
09:00       3 patients have appointments             Appointments exist:
            with Dr. Smith on Day 2                  • Patient A - 09:00
                                                     • Patient B - 10:00
                                                     • Patient C - 11:00

18:00       Dr. Smith has family emergency           Admin creates absence:
            Admin marks emergency leave              • type = EMERGENCY
            for Day 2 - Day 3                        • startDate = Day 2
                                                     • endDate = Day 3

            System automatically:                    • 3 appointments CANCELLED
                                                     • Notes updated with reason
                                                     • 3 slots released
                                                     • 3 notifications sent

            Patient A receives:                      [HIGH PRIORITY]
            "Your appointment with Dr. Smith         "Appointment Cancelled -
             on Jan 22 at 09:00 has been             Doctor Unavailable"
             cancelled due to doctor
             unavailability. Please reschedule."

            Response to admin:                       {
                                                       absence: {...},
                                                       slotsBlocked: 24,
                                                       cancelledAppointments: 3,
                                                       patientNotifications: 3
                                                     }
```

---

### 10.4 Doctor Changes Working Hours

**File:** `backend/src/services/doctorService.ts`

**Problem:** When a doctor changes their working hours or available days, existing appointments might fall outside the new schedule.

**Solution:** Detect affected appointments and notify patients when schedule changes impact their bookings.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Schedule Change Flow                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Doctor/Admin updates schedule  │
                   │  (via updateSchedule endpoint)  │
                   └─────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Query future appointments      │
                   │  status: SCHEDULED, CONFIRMED   │
                   │  appointmentDate >= today       │
                   └─────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  For each appointment, check:   │
                   │                                 │
                   │  1. Is day still available?     │
                   │     (e.g., Tuesday removed)     │
                   │                                 │
                   │  2. Is time still valid?        │
                   │     (e.g., hours changed)       │
                   └─────────────────────────────────┘
                                     │
                                     ▼
                   ┌─────────────────────────────────┐
                   │  Collect affected appointments  │
                   └─────────────────────────────────┘
                                     │
                        ┌────────────┴────────────┐
                    Has affected               No affected
                    appointments               appointments
                        │                          │
                        ▼                          ▼
          ┌──────────────────────────┐  ┌──────────────────────────┐
          │  1. Include warning in   │  │  Update schedule         │
          │     response             │  │  normally                │
          │                          │  │                          │
          │  2. Send notification    │  └──────────────────────────┘
          │     to each affected     │
          │     patient              │
          │                          │
          │  3. Proceed with         │
          │     schedule update      │
          └──────────────────────────┘
```

**Example Scenario:**
```
Time        Event                                    System Action
────────────────────────────────────────────────────────────────────────────────
Day 1
Morning     Patient A books Tuesday 09:00            Appointment created for
            Patient B books Tuesday 14:00            next Tuesday

Day 2
Admin       Doctor removes Tuesday from              updateSchedule called with
            available days                           availableDays without Tuesday

            System checks future appointments:       Query finds:
                                                     • Patient A - Tuesday 09:00
                                                     • Patient B - Tuesday 14:00

            Both are affected (Tuesday removed)      affectedAppointments = [
                                                       { id: ..., date: Tuesday,
                                                         time: 09:00 },
                                                       { id: ..., date: Tuesday,
                                                         time: 14:00 }
                                                     ]

            Patients receive notifications:          [NORMAL PRIORITY]
            "Dr. Smith's schedule has changed.       "Schedule Change Notification"
             Your appointment on Tuesday at          Your appointment may be
             09:00 may be affected. Please           affected by a schedule change.
             contact the clinic to confirm           Please contact us to confirm.
             or reschedule."

            Response includes warning:               {
                                                       success: true,
                                                       data: { ...doctor },
                                                       warning: {
                                                         message: "2 existing
                                                           appointments affected",
                                                         affectedAppointments: [...]
                                                       }
                                                     }
```

---

### Edge Case Summary Table

| Edge Case | Handler Location | Action Taken | Notification |
|-----------|-----------------|--------------|--------------|
| Cron stuck > 5 min | `noShowCron.ts` | Reset flags, continue | Admin (3+ failures) |
| Patient cancels < 24h | `appointmentService.ts` | Release slot | Doctor (high priority) |
| Patient cancels > 24h | `appointmentService.ts` | Release slot | Doctor (normal priority) |
| Emergency leave | `doctorService.ts` | Auto-cancel appointments | Patients (high priority) |
| Planned leave | `doctorService.ts` | Block slots only | Warning in response |
| Schedule change | `doctorService.ts` | Detect affected | Patients (normal priority) |

---

## 11. Summary

### Components Overview

| Component | Frequency | Purpose |
|-----------|-----------|---------|
| **node-cron** | Every 5 min (7AM-10PM) | Primary NO_SHOW processor |
| **Timeout Protection** | Every cron run | Reset stuck processing after 5 min |
| **CloudWatch Lambda** | Every 5 min (24/7) | Backup trigger + health monitoring |
| **CloudWatch Alarm** | Continuous | Alert if unhealthy for 10 min |
| **Database Tracking** | Every run | Audit trail + debugging |
| **Admin Notifications** | On 3+ failures | Internal alerting |
| **Email Alerts** | On alarm trigger | External alerting |
| **Cancellation Notifications** | On patient cancel | Alert doctor (high priority if < 24h) |
| **Emergency Leave Handler** | On absence create | Auto-cancel appointments + notify patients |

### Key Files

| File | Purpose |
|------|---------|
| `backend/src/jobs/noShowCron.ts` | Cron job initialization, execution, timeout protection |
| `backend/src/services/noShowService.ts` | NO_SHOW and alert business logic |
| `backend/src/services/appointmentService.ts` | Appointment CRUD, cancellation notifications |
| `backend/src/services/doctorService.ts` | Doctor schedule, absence management, emergency handling |
| `backend/src/routes/noShowRoutes.ts` | API endpoints |
| `backend/prisma/schema.prisma` | Database models |
| `infrastructure/terraform/monitoring.tf` | CloudWatch infrastructure |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CRON_API_KEY` | API key for external trigger authentication |

### CloudWatch Dashboard Links

- **Metrics**: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2:namespace=HMS/CronJobs`
- **Alarms**: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:alarm/hms-cron-unhealthy-prod`
- **Lambda Logs**: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fhms-cron-health-prod`

---

## Appendix: Quick Reference

### Manual Cron Trigger (Testing)

```bash
# Via API (requires admin JWT)
curl -X POST https://spetaar.ai/api/v1/no-show/trigger \
  -H "Authorization: Bearer <JWT_TOKEN>"

# Via External Trigger (API Key)
curl -X POST https://spetaar.ai/api/v1/no-show/external-trigger \
  -H "x-cron-api-key: <CRON_API_KEY>"

# Via AWS Lambda (manual invoke)
aws lambda invoke --function-name hms-cron-health-prod /tmp/output.json
```

### Check Cron Health

```bash
# Via API
curl https://spetaar.ai/api/v1/no-show/cron-health \
  -H "Authorization: Bearer <JWT_TOKEN>"

# Via CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace "HMS/CronJobs" \
  --metric-name "CronHealthStatus" \
  --dimensions Name=JobName,Value=NO_SHOW_CHECK \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

### View Recent Logs

```bash
# Lambda logs
aws logs tail /aws/lambda/hms-cron-health-prod --since 1h

# Backend logs (on EC2)
ssh ec2-user@hms-ec2 "sudo docker logs hms-backend --tail=100 | grep CRON"
```
