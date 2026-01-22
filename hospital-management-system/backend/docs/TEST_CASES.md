# HMS Slot & Appointment System - Test Cases

> **Audited:** 2026-01-22 | Based on actual code implementation

## Table of Contents
1. [Doctor Slot Configuration](#1-doctor-slot-configuration)
2. [Dynamic Slot Generation](#2-dynamic-slot-generation)
3. [Booking Validations](#3-booking-validations)
4. [Doctor Absence System](#4-doctor-absence-system)
5. [Hospital Holidays](#5-hospital-holidays)
6. [Auto NO_SHOW Detection](#6-auto-no_show-detection)
7. [Stage Alerts](#7-stage-alerts)
8. [No-Show Patient Blocking](#8-no-show-patient-blocking)
9. [Doctor Resignation](#9-doctor-resignation)
10. [Consultation Tracking](#10-consultation-tracking)
11. [Multi-Doctor Visits](#11-multi-doctor-visits)
12. [Cron Jobs](#12-cron-jobs)
13. [Example Scenarios](#13-example-scenarios)

---

## 1. Doctor Slot Configuration

**File:** `backend/src/services/doctorService.ts`

### TC-DSC-001: Create Doctor with Slot Duration
**API:** `POST /api/v1/doctors`
**File:** `doctorService.ts:27-138`

**Test Data:**
```json
{
  "firstName": "Test",
  "lastName": "Doctor",
  "email": "test.doctor@hospital.com",
  "departmentId": "uuid",
  "specialization": "General Medicine",
  "slotDuration": 30,
  "maxPatientsPerDay": 20
}
```

**Expected:** Doctor created with `slotDuration=30`, `maxPatientsPerDay=20`

---

### TC-DSC-002: Default Slot Duration
**Test:** Create doctor without specifying slotDuration
**File:** `doctorService.ts:94`

**Expected:** `slotDuration=30` (default), `maxPatientsPerDay=30` (default)

---

### TC-DSC-003: Create Doctor Schedule
**API:** `PUT /api/v1/doctors/:id/schedules`
**File:** `doctorService.ts:356-462`

**Test Data:**
```json
{
  "schedules": [
    { "dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "breakStart": "13:00", "breakEnd": "14:00" },
    { "dayOfWeek": "TUESDAY", "startTime": "09:00", "endTime": "17:00" }
  ]
}
```

**Expected:**
- Schedules created
- `slotService.regenerateSlots()` called
- Affected appointments notified

---

### TC-DSC-004: Schedule Update Affects Appointments
**Precondition:** Doctor has appointments outside new schedule hours

**Test:** Update schedule to smaller time range

**Expected:**
- Affected appointments identified
- Patients receive HIGH priority notification
- Message: "Schedule has changed..."

---

## 2. Dynamic Slot Generation

**File:** `backend/src/services/slotService.ts`

### TC-DSG-001: Generate Slots Based on Schedule
**API:** `POST /api/v1/slots/generate/:doctorId`
**File:** `slotService.ts:93-240`

**Precondition:**
- Doctor with slotDuration=30
- Schedule: 09:00-17:00, break 13:00-14:00

**Expected:**
```
Morning:  09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30
Afternoon: 14:00, 14:30, 15:00, 15:30, 16:00, 16:30
Total: 14 slots
```

---

### TC-DSG-002: Slots Skip Hospital Holidays
**File:** `slotService.ts:173-185`

**Precondition:** Hospital holiday on Jan 25

**Test:** Generate slots for Jan 24-26

**Expected:** No slots for Jan 25

---

### TC-DSG-003: Slots Block During Absence
**File:** `slotService.ts:132-161`

**Precondition:** Doctor absence Jan 25-27

**Test:** Generate slots for Jan 24-28

**Expected:**
- Slots for Jan 25-27 have `isBlocked=true`
- Slots for Jan 24, 28 have `isBlocked=false`

---

### TC-DSG-004: On-Demand Slot Generation
**API:** `GET /api/v1/slots/doctor/:doctorId/date/:date`
**File:** `slotService.ts:369-412`

**Precondition:** No slots exist for requested date

**Test:** Request slots for valid future date

**Expected:** Slots generated on-the-fly and returned

---

### TC-DSG-005: Slot Upsert (No Duplicates)
**File:** `slotService.ts:220-237`

**Test:** Run `generateSlotsForDoctor()` twice for same doctor/dates

**Expected:** Same slot count (no duplicates)

---

### TC-DSG-006: Filter Past Slots for Today
**File:** `slotService.ts:414-424`

**Precondition:** Current time 10:20

**Test:** Get slots for today

**Expected:** Slots before 10:35 (current + 15 buffer) not returned

---

## 3. Booking Validations

**File:** `backend/src/services/appointmentService.ts:20-175`

### TC-BV-001: Blocked Patient Cannot Book
**File:** `appointmentService.ts:187-193`

**Precondition:** Patient `status = 'BLOCKED'`

**Test:** Create appointment

**Expected:** Error 403: "Patient is blocked from booking appointments..."

---

### TC-BV-002: Patient Duplicate Booking
**File:** `appointmentService.ts:203-227`

**Precondition:** Patient has appointment at 10:00 on Jan 25

**Test:** Book same patient, same date/time, different doctor

**Expected:** Error 409: "Patient already has an appointment at 10:00..."

---

### TC-BV-003: Doctor Not Available
**File:** `appointmentService.ts:37-40`

**Precondition:** Doctor `isAvailable = false`

**Test:** Create appointment

**Expected:** Error 400: "Doctor is currently not available..."

---

### TC-BV-004: Doctor Not Active
**File:** `appointmentService.ts:42-45`

**Precondition:** Doctor `user.isActive = false`

**Test:** Create appointment

**Expected:** Error 400: "Doctor is no longer active..."

---

### TC-BV-005: Past Date Booking
**File:** `appointmentService.ts:55-59`

**Test:** Book for yesterday

**Expected:** Error 400: "Cannot book appointments in the past"

---

### TC-BV-006: Max Advance Booking (30 days)
**File:** `appointmentService.ts:61-66`

**Test:** Book for 35 days from now

**Expected:** Error 400: "Cannot book appointments more than 30 days in advance"

---

### TC-BV-007: Hospital Holiday
**File:** `appointmentService.ts:68-72`

**Precondition:** Jan 25 is hospital holiday

**Test:** Book for Jan 25

**Expected:** Error 400: "Cannot book appointments on [holiday name]..."

---

### TC-BV-008: Doctor Full Day Absence
**File:** `appointmentService.ts:74-87`

**Precondition:** Doctor has full-day absence on Jan 25

**Test:** Book for Jan 25

**Expected:** Error 400: "Doctor is on leave on this date"

---

### TC-BV-009: Doctor Partial Day Absence
**File:** `appointmentService.ts:88-97`

**Precondition:** Doctor absence 14:00-17:00 on Jan 25

**Test:** Book for Jan 25 at 15:00

**Expected:** Error 400: "Doctor is unavailable during this time"

---

### TC-BV-010: Outside Working Hours
**File:** `appointmentService.ts:108-119`

**Precondition:** Doctor schedule 09:00-17:00

**Test:** Book for 08:00

**Expected:** Error 400: "Selected time is outside doctor's working hours..."

---

### TC-BV-011: During Break Time
**File:** `appointmentService.ts:121-131`

**Precondition:** Doctor break 13:00-14:00

**Test:** Book for 13:30

**Expected:** Error 400: "Selected time falls during doctor's break..."

---

### TC-BV-012: Slot Already Booked
**File:** `appointmentService.ts:133-155`

**Precondition:** Slot at 10:00 already booked

**Test:** Book same slot

**Expected:** Error 409: "This time slot is already booked"

---

### TC-BV-013: Max Patients Per Day
**File:** `appointmentService.ts:157-172`

**Precondition:** Doctor has `maxPatientsPerDay=2`, 2 appointments already

**Test:** Book 3rd appointment

**Expected:** Error 400: "Doctor has reached maximum patients (2) for this day"

---

### TC-BV-014: Race Condition Prevention
**File:** `slotService.ts:579-649`

**Test:** Two concurrent booking requests for same slot

**Expected:** Only one succeeds, other gets conflict error

---

## 4. Doctor Absence System

**File:** `backend/src/services/doctorService.ts:640-800`

### TC-DA-001: Create Full Day Absence
**API:** `POST /api/v1/doctors/:id/absences`

**Test Data:**
```json
{
  "startDate": "2026-02-01",
  "endDate": "2026-02-03",
  "absenceType": "ANNUAL_LEAVE",
  "isFullDay": true
}
```

**Expected:**
- DoctorAbsence created with `status=ACTIVE`
- Slots for Feb 1-3 have `isBlocked=true`
- Response includes `slotsBlocked` count

---

### TC-DA-002: Create Partial Day Absence
**Test Data:**
```json
{
  "startDate": "2026-02-05",
  "endDate": "2026-02-05",
  "absenceType": "CONFERENCE",
  "isFullDay": false,
  "startTime": "14:00",
  "endTime": "17:00"
}
```

**Expected:** Only slots 14:00-17:00 blocked

---

### TC-DA-003: Overlapping Absence Rejected
**File:** `doctorService.ts:676-692`

**Precondition:** Absence exists Feb 10-15

**Test:** Create absence Feb 12-18

**Expected:** Error 400: "An absence already exists for this date range"

---

### TC-DA-004: Past Date Absence Rejected
**File:** `doctorService.ts:669-674`

**Test:** Create absence for yesterday

**Expected:** Error 400: "Cannot create absence in the past"

---

### TC-DA-005: Absence Returns Affected Appointments
**File:** `doctorService.ts:694-710`

**Precondition:** 3 appointments exist in date range

**Test:** Create absence

**Expected:** Response includes `affectedAppointments: 3`

---

### TC-DA-006: Cancel Absence Unblocks Slots
**API:** `DELETE /api/v1/doctors/:id/absences/:absenceId`
**File:** `slotService.ts:859-925`

**Test:** Cancel existing absence

**Expected:**
- Absence `status=CANCELLED`
- Previously blocked slots now `isBlocked=false`

---

### TC-DA-007: Emergency Leave Auto-Cancels Appointments
**API:** `POST /api/v1/doctors/:id/absences`
**File:** `doctorService.ts:758-783`

**Precondition:** Doctor has 3 booked appointments on Feb 10

**Test Data:**
```json
{
  "startDate": "2026-02-10",
  "endDate": "2026-02-10",
  "absenceType": "EMERGENCY",
  "reason": "Family emergency"
}
```

**Expected:**
- DoctorAbsence created with `absenceType=EMERGENCY`
- All 3 appointments updated to `status=CANCELLED`
- Appointment notes include: "Auto-cancelled due to doctor emergency leave"
- Slots released (available for rebooking by other doctors)
- Response includes `cancelledAppointments: 3`

---

### TC-DA-008: Emergency Leave Creates HIGH Priority Notifications
**File:** `doctorService.ts:788-811`

**Precondition:** Emergency absence cancels appointments for 2 patients

**Expected:**
- Notification created for each patient
- Notification `title`: "Appointment Cancelled - Doctor Emergency"
- Notification `data.priority`: "HIGH"
- Message explains cancellation and suggests rebooking

---

### TC-DA-009: Regular Leave Does NOT Auto-Cancel
**Precondition:** Doctor has appointments on Feb 15

**Test Data:**
```json
{
  "startDate": "2026-02-15",
  "endDate": "2026-02-15",
  "absenceType": "ANNUAL_LEAVE"
}
```

**Expected:**
- DoctorAbsence created
- Slots blocked
- Appointments remain `status=SCHEDULED` (NOT cancelled)
- Notifications sent with `priority=NORMAL`
- Message says "Appointment Affected..." (not cancelled)

---

### TC-DA-010: Emergency Leave Response Details
**File:** `doctorService.ts:822-836`

**Test:** Create emergency absence with affected appointments

**Expected Response Structure:**
```json
{
  "id": "absence-uuid",
  "absenceType": "EMERGENCY",
  "status": "ACTIVE",
  "blockedSlots": 8,
  "affectedAppointments": 3,
  "cancelledAppointments": 3,
  "notifiedPatients": 3,
  "affectedAppointmentDetails": [
    {
      "id": "apt-1",
      "date": "2026-02-10",
      "time": "09:00",
      "patientName": "John Doe",
      "patientPhone": "+1234567890",
      "wasCancelled": true
    }
  ]
}
```

---

## 5. Hospital Holidays

**File:** `backend/src/services/holidayService.ts`

### TC-HH-001: Create Hospital Holiday
**API:** `POST /api/v1/hospitals/:id/holidays`

**Test Data:**
```json
{
  "name": "New Year's Day",
  "date": "2026-01-01",
  "isRecurring": true
}
```

**Expected:** Holiday created, `isActive=true`

---

### TC-HH-002: Duplicate Holiday Rejected
**File:** `holidayService.ts:20-27`

**Precondition:** Holiday exists for Jan 1

**Test:** Create another holiday for Jan 1

**Expected:** Error 400: "A holiday already exists for this date"

---

### TC-HH-003: Check Date is Holiday
**File:** `holidayService.ts:73-108`

**Test:** `holidayService.isHoliday(hospitalId, date)`

**Expected:** `true` for holiday date, `false` otherwise

---

### TC-HH-004: Recurring Holiday Matches Across Years
**File:** `holidayService.ts:88-108`

**Precondition:** Holiday Jan 1 2026 with `isRecurring=true`

**Test:** Check Jan 1 2027

**Expected:** Returns `true` (matched by month/day)

---

### TC-HH-005: Get Holidays in Range
**API:** `GET /api/v1/hospitals/:id/holidays?startDate=...&endDate=...`
**File:** `holidayService.ts:210-253`

**Expected:** Returns array of holidays including recurring occurrences

---

## 6. Auto NO_SHOW Detection

**File:** `backend/src/services/noShowService.ts:74-244`

### TC-NS-001: NO_SHOW After Dynamic Timeout
**Cron:** `noShowCron.ts:62-78`

**Precondition:**
- Appointment at 10:00
- Doctor `slotDuration=30`
- Current time: 10:35

**Test:** Run cron

**Expected:**
- Appointment `status=NO_SHOW`
- NoShowLog created with `timeoutMinutes=30`
- Patient `noShowCount` incremented

---

### TC-NS-002: NOT NO_SHOW Before Timeout
**Precondition:**
- Appointment at 10:00
- Doctor `slotDuration=30`
- Current time: 10:25

**Test:** Run cron

**Expected:** Appointment NOT marked NO_SHOW (within grace period)

---

### TC-NS-003: Slot Released if Rebookable
**File:** `noShowService.ts:142-152`

**Precondition:**
- Appointment at 10:00
- Current time: 10:35
- Later slots still available today

**Test:** NO_SHOW processing

**Expected:**
- NoShowLog `slotReleased=true`
- Slot `isAvailable=true`

---

### TC-NS-004: Slot NOT Released End of Day
**File:** `noShowService.ts:46-68`

**Precondition:**
- Last slot at 16:30
- Current time: 17:05

**Test:** NO_SHOW processing

**Expected:** NoShowLog `slotReleased=false`

---

### TC-NS-005: Patient Notification Sent
**File:** `noShowService.ts:194-224`

**Precondition:** Patient has `oderId` (user account)

**Test:** NO_SHOW processing

**Expected:**
- Notification sent: "You missed your appointment..."
- NoShowLog `notificationSent=true`

---

### TC-NS-006: Manual NO_SHOW
**API:** `POST /api/v1/no-show/:appointmentId`
**File:** `noShowService.ts:441-564`

**Test Data:**
```json
{
  "reason": "MANUAL_STAFF",
  "notes": "Patient called to cancel"
}
```

**Expected:** Same flow as auto but `reason=MANUAL_STAFF`

---

## 7. Stage Alerts

**File:** `backend/src/services/noShowService.ts:251-436`

### TC-SA-001: NO_VITALS Alert
**File:** `noShowService.ts:261-335`

**Precondition:**
- Patient checked in at 10:00
- Doctor `slotDuration=30`
- Current time: 10:36 (30+5+1 = 36 min)
- `vitalsRecordedAt=null`

**Test:** Run cron

**Expected:**
- StageAlert created: `alertType=NO_VITALS`
- Message: "Patient ... checked in but vitals not recorded..."

---

### TC-SA-002: NO_DOCTOR Alert
**File:** `noShowService.ts:339-433`

**Precondition:**
- Patient has vitals
- Doctor `slotDuration=30`
- Current time: 10:41 (30+10+1 = 41 min)
- Still `status=CHECKED_IN`

**Test:** Run cron

**Expected:**
- StageAlert created: `alertType=NO_DOCTOR`
- Doctor receives notification

---

### TC-SA-003: Alert Not Duplicated
**File:** `noShowService.ts:306`

**Precondition:** Active alert already exists for appointment

**Test:** Run cron again

**Expected:** No new alert created

---

### TC-SA-004: Acknowledge Alert
**API:** `PUT /api/v1/no-show/alerts/:alertId/acknowledge`
**File:** `noShowService.ts:569-577`

**Expected:** Alert `status=ACKNOWLEDGED`, `acknowledgedAt=now`

---

### TC-SA-005: Resolve Alert
**API:** `PUT /api/v1/no-show/alerts/:alertId/resolve`
**File:** `noShowService.ts:583-591`

**Expected:** Alert `status=RESOLVED`, `resolvedAt=now`

---

## 8. No-Show Patient Blocking

**File:** `backend/src/services/noShowService.ts:171-191`

### TC-PB-001: 1st No-Show - No Block
**Test:** First NO_SHOW for patient

**Expected:**
- `noShowCount=1`
- `status=ACTIVE` (not blocked)

---

### TC-PB-002: 2nd No-Show - No Block
**Precondition:** `noShowCount=1`

**Test:** Second NO_SHOW

**Expected:**
- `noShowCount=2`
- `status=ACTIVE` (not blocked)

---

### TC-PB-003: 3rd No-Show - BLOCKED
**File:** `noShowService.ts:180-191`

**Precondition:** `noShowCount=2`

**Test:** Third NO_SHOW

**Expected:**
- `noShowCount=3`
- `status=BLOCKED`
- `blockedAt=now`
- `blockedReason="Blocked due to 3 no-show appointments"`

---

### TC-PB-004: Blocked Patient Cannot Book
**File:** `appointmentService.ts:187-193`

**Precondition:** Patient `status=BLOCKED`

**Test:** Attempt to create appointment

**Expected:** Error 403: "Patient is blocked from booking..."

---

## 9. Doctor Resignation

**File:** `backend/src/services/doctorService.ts:481-576`

### TC-DR-001: Disable Doctor Cancels Appointments
**API:** `PATCH /api/v1/doctors/:id`
**File:** `doctorService.ts:499-523`

**Precondition:** Doctor has 5 future appointments

**Test Data:** `{ "isAvailable": false }`

**Expected:**
- All 5 appointments `status=CANCELLED`
- Response: `cancelledAppointments: 5`

---

### TC-DR-002: Disable Doctor Releases Slots
**File:** `doctorService.ts:526-537`

**Precondition:** Doctor has 5 booked slots

**Test:** Disable doctor

**Expected:** All slots `isAvailable=true`, `appointmentId=null`

---

### TC-DR-003: Disable Doctor Notifies Patients
**File:** `doctorService.ts:540-561`

**Precondition:** Doctor has appointments with 5 patients

**Test:** Disable doctor

**Expected:**
- 5 notifications sent
- Priority: HIGH
- Message: "...appointment cancelled...doctor no longer available..."

---

### TC-DR-004: Re-enable Doctor
**Test:** `PATCH /api/v1/doctors/:id { "isAvailable": true }`

**Expected:**
- `isAvailable=true`
- No appointments cancelled (only applies when disabling)

---

## 10. Consultation Tracking

**File:** `backend/src/services/consultationService.ts`

### TC-CT-001: Create Consultation
**File:** `consultationService.ts:14-55`

**Test Data:**
```json
{
  "appointmentId": "uuid",
  "chiefComplaint": "Headache for 3 days"
}
```

**Expected:**
- Consultation `status=STARTED`
- `startedAt=now`

---

### TC-CT-002: Update Moves to IN_PROGRESS
**File:** `consultationService.ts:97`

**Precondition:** Consultation `status=STARTED`

**Test:** Update with diagnosis

**Expected:** `status=IN_PROGRESS`

---

### TC-CT-003: Complete Consultation - Success
**File:** `consultationService.ts:119-177`

**Precondition:**
- `chiefComplaint` not empty
- `diagnosis` array not empty

**Test:** Complete consultation

**Expected:**
- Consultation `status=COMPLETED`
- Appointment `status=COMPLETED`

---

### TC-CT-004: Complete Without Diagnosis - Fail
**File:** `consultationService.ts:152-154`

**Precondition:** `diagnosis=[]`

**Test:** Complete consultation

**Expected:** Error 400: "At least one diagnosis is required"

---

### TC-CT-005: Complete Without Chief Complaint - Fail
**File:** `consultationService.ts:149-151`

**Precondition:** `chiefComplaint` empty

**Test:** Complete consultation

**Expected:** Error 400: "Chief complaint is required"

---

### TC-CT-006: Abandon Consultation
**File:** `consultationService.ts:182-208`

**Test:** Abandon with reason

**Expected:**
- `status=ABANDONED`
- `abandonedAt=now`
- Reason in notes

---

### TC-CT-007: Cannot Update Completed
**File:** `consultationService.ts:88-90`

**Precondition:** `status=COMPLETED`

**Test:** Update consultation

**Expected:** Error 400: "Cannot update a completed consultation"

---

## 11. Multi-Doctor Visits

**File:** `backend/src/services/consultationService.ts:245-412`

### TC-MD-001: Add Consulting Doctor
**File:** `consultationService.ts:250-336`

**Test Data:**
```json
{
  "doctorId": "consulting-doctor-uuid",
  "role": "CONSULTING",
  "notes": "Need cardiology opinion"
}
```

**Expected:**
- ConsultationParticipant created
- Consulting doctor notified

---

### TC-MD-002: Cannot Add Primary Doctor
**File:** `consultationService.ts:293-296`

**Precondition:** Consultation `doctorId=X`

**Test:** Add doctor X as participant

**Expected:** Error 400: "Primary doctor cannot be added as a participant"

---

### TC-MD-003: Cannot Add Duplicate
**File:** `consultationService.ts:280-291`

**Precondition:** Doctor already a participant

**Test:** Add same doctor again

**Expected:** Error 400: "Doctor is already a participant"

---

### TC-MD-004: Cannot Add to Closed Consultation
**File:** `consultationService.ts:275-277`

**Precondition:** `status=COMPLETED`

**Test:** Add participant

**Expected:** Error 400: "Cannot add participant to a closed consultation"

---

### TC-MD-005: Participant Departure
**File:** `consultationService.ts:368-394`

**Test:** Record participant leaving

**Expected:**
- `leftAt=now`
- Notes recorded if provided

---

## 12. Cron Jobs

**File:** `backend/src/jobs/noShowCron.ts`

### TC-CJ-001: Cron Schedule
**File:** `noShowCron.ts:182`

**Expected:** Runs every 5 minutes, 7 AM - 10 PM
```
Schedule: */5 7-22 * * *
```

---

### TC-CJ-002: Cron Tasks
**File:** `noShowCron.ts:62-78`

**Test:** Run cron

**Expected:**
- `processAutoNoShows()` called
- `processStageAlerts()` called

---

### TC-CJ-003: Cron Run Logged
**File:** `noShowCron.ts:50-58`

**Test:** Run cron

**Expected:** CronJobRun record created with:
- `jobName="NO_SHOW_CHECK"`
- `status="RUNNING"` then `"COMPLETED"`
- `durationMs`, `itemsProcessed`

---

### TC-CJ-004: Timeout Protection
**File:** `noShowCron.ts:30-42`

**Precondition:** Previous run stuck > 5 minutes

**Test:** New cron trigger

**Expected:**
- `isProcessing` reset to `false`
- `consecutiveFailures` incremented
- Processing continues

---

### TC-CJ-005: Admin Alert After 3 Failures
**File:** `noShowCron.ts:132-161`

**Precondition:** `consecutiveFailures >= 3`

**Test:** Another failure

**Expected:** HOSPITAL_ADMIN users receive HIGH priority notification

---

### TC-CJ-006: External Trigger
**API:** `POST /api/v1/no-show/external-trigger`
**File:** `noShowRoutes.ts:154-174`

**Test:** Call with valid `x-cron-api-key` header

**Expected:** Same as internal cron trigger

---

### TC-CJ-007: External Trigger Invalid Key
**Test:** Call without API key or wrong key

**Expected:** 401 Unauthorized

---

### TC-CJ-008: Health Check
**API:** `GET /api/v1/no-show/cron-health`
**File:** `noShowCron.ts:216-278`

**Expected Response:**
```json
{
  "jobName": "NO_SHOW_CHECK",
  "isHealthy": true,
  "healthMessage": "OK",
  "isWorkingHours": true,
  "lastRunTime": "...",
  "lastRunStatus": "success",
  "consecutiveFailures": 0,
  "stats": { "totalRuns": 100, "failedRuns": 1, "successRate": "99.0%" }
}
```

---

## 13. Example Scenarios

### Scenario 1: Happy Path - Complete Appointment

**Setup:**
- Doctor: slotDuration=30, schedule 09:00-17:00

**Flow:**
```
1. Patient books 10:00 appointment
   → Appointment SCHEDULED, slot booked

2. Day of appointment, patient arrives 09:55
   → Check in at kiosk
   → Status: CHECKED_IN

3. Nurse takes vitals 10:05
   → vitalsRecordedAt set

4. Doctor sees patient 10:15
   → Consultation created, status: STARTED

5. Doctor adds diagnosis 10:30
   → Consultation status: IN_PROGRESS

6. Doctor completes 10:40
   → Consultation: COMPLETED
   → Appointment: COMPLETED
```

---

### Scenario 2: NO_SHOW with Slot Release

**Setup:**
- Appointment at 14:00
- Doctor slotDuration=20

**Flow:**
```
1. Appointment at 14:00, patient doesn't arrive

2. Cron runs at 14:20
   → 14:20 == 14:00 + 20 → Threshold reached
   → NOT yet NO_SHOW (equal, not exceeded)

3. Cron runs at 14:25
   → 14:25 > 14:00 + 20 → Mark NO_SHOW
   → Check rebookable: 14:25 < end of day → YES
   → Release slot: isAvailable=true
   → Create NoShowLog: slotReleased=true
   → Increment patient noShowCount

4. Another patient books released slot
   → Booking succeeds
```

---

### Scenario 3: Patient Blocked After 3 No-Shows

**Setup:**
- Patient with noShowCount=2

**Flow:**
```
1. Patient books and no-shows again

2. Auto NO_SHOW detection:
   → noShowCount incremented: 2 → 3
   → Check: 3 >= 3 (threshold)
   → Update patient:
     - status=BLOCKED
     - blockedAt=now
     - blockedReason="Blocked due to 3 no-show appointments"

3. Patient tries to book again
   → Error 403: "Patient is blocked..."
```

---

### Scenario 4: Doctor Emergency Leave

**Setup:**
- Doctor has 5 appointments today
- Emergency at 11:00

**Flow:**
```
1. Admin marks doctor unavailable
   → PATCH /doctors/:id { "isAvailable": false }

2. System processes:
   → Find 5 future appointments
   → Cancel all: status=CANCELLED
   → Release all slots
   → Notify 5 patients (HIGH priority)

3. Response:
   {
     "cancelledAppointments": 5,
     "notifiedPatients": 5,
     "affectedAppointmentIds": [...]
   }
```

---

### Scenario 5: Multi-Doctor Consultation

**Setup:**
- Primary: Dr. Anderson (General)
- Specialist: Dr. Chen (Cardiology)

**Flow:**
```
1. Patient with Dr. Anderson, consultation starts
   → status: STARTED

2. Dr. Anderson requests cardiology opinion
   → POST /consultations/:id/participants
   → { "doctorId": "dr-chen-id", "role": "CONSULTING" }

3. Dr. Chen notified
   → Notification: "Dr. Anderson has requested your consultation..."

4. Dr. Chen joins, provides input
   → joinedAt recorded

5. Dr. Chen finishes
   → POST /consultations/:id/participants/:dr-chen/leave
   → leftAt recorded

6. Dr. Anderson completes
   → Consultation: COMPLETED
   → Appointment: COMPLETED
```

---

## API Quick Reference

### Slots
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/slots/doctor/:doctorId` | Get future slots |
| GET | `/slots/doctor/:doctorId/date/:date` | Get slots by date |
| POST | `/slots/generate/:doctorId` | Generate slots |
| PATCH | `/slots/:slotId/block` | Block/unblock |

### NO_SHOW
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/no-show/logs` | Get logs |
| GET | `/no-show/stats` | Get statistics |
| GET | `/no-show/alerts` | Get active alerts |
| PUT | `/no-show/alerts/:id/acknowledge` | Acknowledge |
| PUT | `/no-show/alerts/:id/resolve` | Resolve |
| POST | `/no-show/trigger` | Manual trigger |
| GET | `/no-show/cron-health` | Health check |
| POST | `/no-show/external-trigger` | External trigger |
| POST | `/no-show/:appointmentId` | Manual NO_SHOW |

### Doctor Absences
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/doctors/:id/absences` | Create |
| GET | `/doctors/:id/absences` | List |
| DELETE | `/doctors/:id/absences/:absenceId` | Cancel |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-22 | System | Initial documentation |
| 2.0 | 2026-01-22 | System | Complete rewrite based on code audit |
