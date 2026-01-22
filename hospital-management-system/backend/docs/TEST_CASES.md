# HMS Slot & Appointment System - Test Cases

## Table of Contents
1. [Doctor Slot Configuration](#1-doctor-slot-configuration)
2. [Dynamic Slot Generation](#2-dynamic-slot-generation)
3. [Patient Online Booking](#3-patient-online-booking)
4. [Doctor Absence System](#4-doctor-absence-system)
5. [Auto NO_SHOW with Dynamic Timeout](#5-auto-no_show-with-dynamic-timeout)
6. [Stage Alerts](#6-stage-alerts)
7. [No-Show Blocking (Progressive)](#7-no-show-blocking-progressive)
8. [Hospital Holiday Calendar](#8-hospital-holiday-calendar)
9. [Doctor Resignation](#9-doctor-resignation)
10. [Consultation Completion](#10-consultation-completion)
11. [Multi-Doctor Visits](#11-multi-doctor-visits)
12. [Cron Jobs](#12-cron-jobs)
13. [Notifications](#13-notifications)
14. [Example Scenarios](#14-example-scenarios)

---

## 1. Doctor Slot Configuration

### TC-DSC-001: Create Doctor with Valid Slot Duration
**Description:** Create a new doctor with standard slot duration
**Precondition:** Admin logged in, hospital exists
**Test Data:**
```json
{
  "firstName": "Test",
  "lastName": "Doctor",
  "email": "test.doctor@hospital.com",
  "specialization": "General Medicine",
  "slotDuration": 30,
  "maxPatientsPerDay": 20
}
```
**Steps:**
1. POST `/api/v1/doctors` with test data
2. Verify doctor created with slotDuration=30

**Expected Result:** Doctor created, slotDuration=30 stored
**Status:** Manual/Automated

---

### TC-DSC-002: Create Doctor with Different Slot Durations
**Description:** Verify all valid slot durations (15, 20, 30, 45, 60)
**Test Data:**

| Slot Duration | Expected Slots (8hr day) |
|---------------|-------------------------|
| 15 minutes    | 32 slots               |
| 20 minutes    | 24 slots               |
| 30 minutes    | 16 slots               |
| 45 minutes    | 10 slots               |
| 60 minutes    | 8 slots                |

**Steps:**
1. Create doctor with each slot duration
2. Generate slots for an 8-hour work day
3. Count generated slots

**Expected Result:** Slots match expected count for each duration

---

### TC-DSC-003: Update Doctor Slot Duration
**Description:** Update existing doctor's slot duration
**Precondition:** Doctor exists with slotDuration=30
**Steps:**
1. PATCH `/api/v1/doctors/:id` with `{ "slotDuration": 20 }`
2. Regenerate slots
3. Verify new slot count

**Expected Result:** Future slots regenerated with new duration

---

### TC-DSC-004: Create Doctor Schedule
**Description:** Create weekly schedule for doctor
**Test Data:**
```json
{
  "schedules": [
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00", "breakStart": "13:00", "breakEnd": "14:00" },
    { "dayOfWeek": 2, "startTime": "09:00", "endTime": "17:00", "breakStart": "13:00", "breakEnd": "14:00" },
    { "dayOfWeek": 3, "startTime": "09:00", "endTime": "12:00" },
    { "dayOfWeek": 4, "startTime": "14:00", "endTime": "18:00" },
    { "dayOfWeek": 5, "startTime": "09:00", "endTime": "17:00" }
  ]
}
```
**Steps:**
1. POST `/api/v1/doctors/:id/schedules`
2. Verify schedules created for specified days

**Expected Result:** 5 schedule records created, weekends excluded

---

### TC-DSC-005: Validate Break Time Within Working Hours
**Description:** Ensure break time is within working hours
**Test Data:**
```json
{
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "breakStart": "18:00",
  "breakEnd": "19:00"
}
```
**Expected Result:** Validation error - break outside working hours

---

## 2. Dynamic Slot Generation

### TC-DSG-001: Generate Slots Based on Schedule
**Description:** Generate slots respecting doctor's schedule and break time
**Precondition:**
- Doctor with slotDuration=30
- Schedule: 09:00-17:00, break 13:00-14:00

**Steps:**
1. POST `/api/v1/slots/generate` for tomorrow
2. Query generated slots

**Expected Result:**
```
Morning:  09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30 (8 slots)
Afternoon: 14:00, 14:30, 15:00, 15:30, 16:00, 16:30 (6 slots)
Total: 14 slots
```

---

### TC-DSG-002: Generate Slots with 15-Minute Duration
**Description:** Verify 15-minute slot generation
**Precondition:** Doctor with slotDuration=15, schedule 09:00-12:00

**Steps:**
1. Generate slots
2. Count and verify times

**Expected Result:**
```
09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30, 10:45, 11:00, 11:15, 11:30, 11:45
Total: 12 slots
```

---

### TC-DSG-003: Generate Slots Skipping Holidays
**Description:** No slots generated for hospital holidays
**Precondition:**
- Doctor has schedule for Monday
- Hospital holiday exists for next Monday

**Steps:**
1. Generate slots for next Monday
2. Query slots for that date

**Expected Result:** No slots generated for holiday date

---

### TC-DSG-004: Generate Slots Respecting Absences
**Description:** No slots during doctor absence
**Precondition:**
- Doctor has absence for Jan 25-27
- Doctor has normal schedule

**Steps:**
1. Generate slots for Jan 24-28
2. Query slots

**Expected Result:** Slots only for Jan 24 and 28, none for 25-27

---

### TC-DSG-005: Slot Generation Idempotency
**Description:** Running generation twice doesn't duplicate slots
**Steps:**
1. Generate slots for tomorrow
2. Count slots
3. Generate slots for tomorrow again
4. Count slots

**Expected Result:** Same slot count after both generations

---

### TC-DSG-006: Generate Slots for Date Range
**Description:** Generate slots for multiple days
**Test Data:**
```json
{
  "startDate": "2026-01-25",
  "endDate": "2026-01-31",
  "doctorId": "uuid"
}
```
**Steps:**
1. POST `/api/v1/slots/generate-range`
2. Query slots for each day

**Expected Result:** Slots generated for all working days in range

---

## 3. Patient Online Booking

### TC-POB-001: Book Available Slot - Success
**Description:** Patient books an available slot
**Precondition:**
- Available slot exists
- Patient is ACTIVE status

**Test Data:**
```json
{
  "slotId": "uuid",
  "patientId": "uuid",
  "appointmentType": "CONSULTATION",
  "notes": "Regular checkup"
}
```
**Steps:**
1. POST `/api/v1/appointments/book`
2. Verify appointment created
3. Verify slot marked as booked

**Expected Result:**
- Appointment status: SCHEDULED
- Slot isAvailable: false

---

### TC-POB-002: Book Already Booked Slot - Fail
**Description:** Prevent double booking
**Precondition:** Slot already booked

**Steps:**
1. Attempt to book same slot for different patient

**Expected Result:** Error 400 - "Slot is not available"

---

### TC-POB-003: Book Blocked Slot - Fail
**Description:** Cannot book blocked slots
**Precondition:** Slot is blocked (isBlocked=true)

**Steps:**
1. Attempt to book blocked slot

**Expected Result:** Error 400 - "Slot is blocked"

---

### TC-POB-004: Blocked Patient Cannot Book
**Description:** Patient with BLOCKED status cannot book
**Precondition:**
- Patient status = BLOCKED
- Available slot exists

**Steps:**
1. POST `/api/v1/appointments/book` as blocked patient

**Expected Result:** Error 403 - "Patient is blocked from booking"

---

### TC-POB-005: Book on Holiday - Fail
**Description:** Cannot book on hospital holiday
**Precondition:** Date is a hospital holiday

**Steps:**
1. Attempt to book for holiday date

**Expected Result:** Error 400 - "Cannot book on hospital holiday"

---

### TC-POB-006: Book with Inactive Doctor - Fail
**Description:** Cannot book with disabled/inactive doctor
**Precondition:** Doctor user.isActive = false

**Steps:**
1. Attempt to book with inactive doctor

**Expected Result:** Error 400 - "Doctor is not available"

---

### TC-POB-007: Concurrent Booking Race Condition
**Description:** Handle simultaneous booking attempts
**Steps:**
1. Two patients attempt to book same slot simultaneously
2. Use transaction to ensure atomicity

**Expected Result:** Only one booking succeeds, other gets error

---

### TC-POB-008: Book Past Slot - Fail
**Description:** Cannot book slots in the past
**Precondition:** Slot time has already passed

**Steps:**
1. Attempt to book expired slot

**Expected Result:** Error 400 - "Cannot book past time slot"

---

## 4. Doctor Absence System

### TC-DAS-001: Create Full-Day Absence
**Description:** Doctor marks full day as unavailable
**Test Data:**
```json
{
  "startDate": "2026-02-01",
  "endDate": "2026-02-03",
  "reason": "Annual Leave",
  "isFullDay": true
}
```
**Steps:**
1. POST `/api/v1/doctors/:id/absences`
2. Verify absence created
3. Verify slots blocked for date range

**Expected Result:**
- DoctorAbsence created with ACTIVE status
- All slots for Feb 1-3 have isBlocked=true

---

### TC-DAS-002: Create Partial-Day Absence
**Description:** Doctor unavailable for specific hours
**Test Data:**
```json
{
  "startDate": "2026-02-05",
  "endDate": "2026-02-05",
  "reason": "Conference",
  "isFullDay": false,
  "startTime": "14:00",
  "endTime": "17:00"
}
```
**Steps:**
1. Create partial absence
2. Query slots for that day

**Expected Result:** Only afternoon slots blocked (14:00-17:00)

---

### TC-DAS-003: Cancel Absence
**Description:** Cancel absence unblocks slots
**Precondition:** Absence exists with blocked slots

**Steps:**
1. DELETE `/api/v1/doctors/:id/absences/:absenceId`
2. Verify absence status = CANCELLED
3. Verify slots unblocked

**Expected Result:** Slots have isBlocked=false

---

### TC-DAS-004: Absence With Existing Appointments - Warning
**Description:** Show warning when appointments exist
**Precondition:** Appointments exist in date range

**Steps:**
1. Create absence for dates with appointments
2. Verify warning returned

**Expected Result:**
- Warning: "X appointments exist in this period"
- Absence still created (Option A approach)

---

### TC-DAS-005: Overlapping Absence - Fail
**Description:** Cannot create overlapping absences
**Precondition:** Absence exists for Feb 10-15

**Test Data:**
```json
{
  "startDate": "2026-02-12",
  "endDate": "2026-02-18"
}
```
**Expected Result:** Error 400 - "Overlapping absence exists"

---

### TC-DAS-006: Past Date Absence - Fail
**Description:** Cannot create absence for past dates
**Test Data:**
```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-05"
}
```
**Expected Result:** Error 400 - "Cannot create absence for past dates"

---

## 5. Auto NO_SHOW with Dynamic Timeout

### TC-ANS-001: NO_SHOW After Dynamic Timeout (30-min slot)
**Description:** Mark as NO_SHOW after slot duration passes
**Precondition:**
- Appointment at 10:00
- Doctor slotDuration = 30
- Current time = 10:35

**Steps:**
1. Cron job runs at 10:35
2. Check: 10:35 > 10:00 + 30min = 10:30

**Expected Result:**
- Appointment status = NO_SHOW
- NoShowLog created
- Slot released (if rebookable time)

---

### TC-ANS-002: NO_SHOW After Dynamic Timeout (15-min slot)
**Description:** Shorter timeout for 15-min slots
**Precondition:**
- Appointment at 14:00
- Doctor slotDuration = 15
- Current time = 14:20

**Steps:**
1. Cron job runs at 14:20
2. Check: 14:20 > 14:00 + 15min = 14:15

**Expected Result:** Appointment marked as NO_SHOW

---

### TC-ANS-003: NO_SHOW After Dynamic Timeout (60-min slot)
**Description:** Longer timeout for 60-min slots
**Precondition:**
- Appointment at 09:00
- Doctor slotDuration = 60
- Current time = 09:55

**Steps:**
1. Cron job runs at 09:55
2. Check: 09:55 < 09:00 + 60min = 10:00

**Expected Result:** NOT marked as NO_SHOW yet (5 minutes remaining)

---

### TC-ANS-004: Not NO_SHOW Before Timeout
**Description:** Don't mark as NO_SHOW if time hasn't passed
**Precondition:**
- Appointment at 15:00
- Doctor slotDuration = 30
- Current time = 15:20

**Steps:**
1. Cron job runs at 15:20
2. Check: 15:20 < 15:00 + 30min = 15:30

**Expected Result:** Appointment remains CHECKED_IN or CONFIRMED

---

### TC-ANS-005: NO_SHOW Releases Slot (Rebookable)
**Description:** Slot released when rebooking possible
**Precondition:**
- Appointment at 10:00
- Marked NO_SHOW at 10:35
- More appointments possible today

**Steps:**
1. Mark as NO_SHOW
2. Check slot release

**Expected Result:**
- slotReleased = true in NoShowLog
- Slot isAvailable = true

---

### TC-ANS-006: NO_SHOW Does NOT Release Slot (End of Day)
**Description:** Don't release slot when no time for rebooking
**Precondition:**
- Last appointment of day at 16:30
- Marked NO_SHOW at 17:05
- No more slots available

**Steps:**
1. Mark as NO_SHOW
2. Check slot release

**Expected Result:**
- slotReleased = false in NoShowLog
- Slot remains isAvailable = false

---

### TC-ANS-007: Skip Already Processed Appointments
**Description:** Don't reprocess NO_SHOW appointments
**Precondition:** Appointment already marked NO_SHOW

**Steps:**
1. Cron job runs
2. Query for appointments to mark

**Expected Result:** Already NO_SHOW appointments excluded from query

---

## 6. Stage Alerts

### TC-SA-001: Alert When Patient Stuck at Vitals
**Description:** Alert if patient at vitals > threshold
**Precondition:**
- Appointment status = VITALS_TAKEN
- vitalsTakenAt = 30 minutes ago
- Threshold = 15 minutes

**Steps:**
1. Cron job checks stuck patients
2. Generate alert

**Expected Result:**
- Alert created: "Patient stuck at vitals for 30 minutes"
- Notification sent to receptionist

---

### TC-SA-002: Alert When Patient Waiting for Doctor
**Description:** Alert if waiting > threshold after vitals
**Precondition:**
- Appointment status = WITH_DOCTOR
- withDoctorAt = null (not yet called)
- vitalsTakenAt = 45 minutes ago

**Steps:**
1. Cron job checks waiting patients
2. Generate alert

**Expected Result:** Alert for long wait after vitals

---

### TC-SA-003: No Alert Within Threshold
**Description:** No alert if within acceptable time
**Precondition:**
- Patient at vitals for 10 minutes
- Threshold = 15 minutes

**Steps:**
1. Cron job checks

**Expected Result:** No alert generated

---

### TC-SA-004: Alert Escalation
**Description:** Escalate alert if not resolved
**Precondition:**
- Alert created 15 minutes ago
- Not acknowledged

**Steps:**
1. Cron job checks unresolved alerts
2. Escalate to higher priority

**Expected Result:** Alert priority increased, manager notified

---

## 7. No-Show Blocking (Progressive)

### TC-NSB-001: First No-Show - No Action
**Description:** First no-show has no consequences
**Precondition:** Patient noShowCount = 0

**Steps:**
1. Mark appointment as NO_SHOW
2. Check patient status

**Expected Result:**
- noShowCount = 1
- Patient status = ACTIVE

---

### TC-NSB-002: Third No-Show - Warning/Flagged
**Description:** Flag patient after 3 no-shows
**Precondition:** Patient noShowCount = 2

**Steps:**
1. Mark appointment as NO_SHOW
2. Check patient status

**Expected Result:**
- noShowCount = 3
- Patient status = FLAGGED
- Warning notification sent

---

### TC-NSB-003: Fifth No-Show - Advance Payment Required
**Description:** Require payment after 5 no-shows
**Precondition:** Patient noShowCount = 4

**Steps:**
1. Mark appointment as NO_SHOW
2. Check patient record

**Expected Result:**
- noShowCount = 5
- Patient status = FLAGGED
- requiresAdvancePayment flag set

---

### TC-NSB-004: Seventh No-Show - Blocked
**Description:** Block patient after 7+ no-shows
**Precondition:** Patient noShowCount = 6

**Steps:**
1. Mark appointment as NO_SHOW
2. Check patient status

**Expected Result:**
- noShowCount = 7
- Patient status = BLOCKED
- blockedAt = current timestamp
- blockedReason = "Excessive no-shows"

---

### TC-NSB-005: Blocked Patient Cannot Book
**Description:** Verify blocked patient booking prevention
**Precondition:** Patient status = BLOCKED

**Steps:**
1. Attempt to book new appointment

**Expected Result:** Error 403 - "Patient is blocked from booking"

---

### TC-NSB-006: Admin Unblocks Patient
**Description:** Admin can unblock patient
**Precondition:** Patient status = BLOCKED

**Steps:**
1. PATCH `/api/v1/patients/:id/unblock`
2. Verify status changed

**Expected Result:**
- Patient status = ACTIVE
- noShowCount reset to 0
- blockedAt = null

---

### TC-NSB-007: Flagged Patient Warning on Booking
**Description:** Show warning when FLAGGED patient books
**Precondition:** Patient status = FLAGGED

**Steps:**
1. Book new appointment
2. Check response

**Expected Result:**
- Booking succeeds
- Warning in response: "Patient has history of no-shows"

---

## 8. Hospital Holiday Calendar

### TC-HHC-001: Create Hospital Holiday
**Description:** Add new holiday to calendar
**Test Data:**
```json
{
  "name": "New Year's Day",
  "date": "2026-01-01",
  "isRecurring": true
}
```
**Steps:**
1. POST `/api/v1/hospitals/:id/holidays`
2. Verify holiday created

**Expected Result:** Holiday record created

---

### TC-HHC-002: Holiday Blocks All Doctor Slots
**Description:** Holiday affects all doctors in hospital
**Precondition:** Holiday created for Feb 10

**Steps:**
1. Generate slots for Feb 10 for multiple doctors
2. Query slots

**Expected Result:** No slots generated for any doctor on Feb 10

---

### TC-HHC-003: Check if Date is Holiday
**Description:** API to check holiday status
**Steps:**
1. GET `/api/v1/hospitals/:id/holidays/check?date=2026-01-01`

**Expected Result:**
```json
{
  "isHoliday": true,
  "holidayName": "New Year's Day"
}
```

---

### TC-HHC-004: Get Holidays in Date Range
**Description:** List holidays for planning
**Test Data:**
```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-12-31"
}
```
**Steps:**
1. GET `/api/v1/hospitals/:id/holidays?startDate=...&endDate=...`

**Expected Result:** Array of holidays in range

---

### TC-HHC-005: Delete Holiday
**Description:** Remove holiday from calendar
**Precondition:** Holiday exists

**Steps:**
1. DELETE `/api/v1/hospitals/:id/holidays/:holidayId`
2. Generate slots for that date
3. Verify slots now generated

**Expected Result:** Slots generated for previously blocked date

---

### TC-HHC-006: Recurring Holiday Auto-Creation
**Description:** Recurring holidays created for next year
**Precondition:** Holiday with isRecurring = true for 2026-01-01

**Steps:**
1. Run yearly holiday generation
2. Check 2027 holidays

**Expected Result:** 2027-01-01 holiday exists

---

### TC-HHC-007: Booking Validation Against Holiday
**Description:** Booking API checks holiday
**Steps:**
1. Manually create slot on holiday (edge case)
2. Attempt to book

**Expected Result:** Error - "Cannot book on hospital holiday"

---

## 9. Doctor Resignation

### TC-DR-001: Disable Doctor - Cancel Future Appointments
**Description:** Disabling doctor cancels all future appointments
**Precondition:**
- Doctor has 5 future appointments
- Doctor has 3 past completed appointments

**Steps:**
1. PATCH `/api/v1/doctors/:id` with `{ "isActive": false }`
2. Query doctor's appointments

**Expected Result:**
- All 5 future appointments status = CANCELLED
- 3 past appointments unchanged
- Slot release for cancelled appointments

---

### TC-DR-002: Disable Doctor - Release Slots
**Description:** All future slots released
**Precondition:** Doctor has 20 future slots (5 booked, 15 available)

**Steps:**
1. Disable doctor
2. Query slots

**Expected Result:**
- All slots have isAvailable = true
- All slots have isBlocked = true (prevent rebooking)

---

### TC-DR-003: Disable Doctor - Notify Patients
**Description:** All affected patients notified
**Precondition:** Doctor has appointments with 5 different patients

**Steps:**
1. Disable doctor
2. Check notification queue

**Expected Result:** 5 notification records created with cancellation message

---

### TC-DR-004: Re-enable Doctor
**Description:** Re-enabling doctor allows new bookings
**Precondition:** Doctor was disabled

**Steps:**
1. PATCH `/api/v1/doctors/:id` with `{ "isActive": true }`
2. Generate new slots
3. Attempt booking

**Expected Result:**
- New slots can be generated
- Bookings allowed

---

### TC-DR-005: Cannot Book with Disabled Doctor
**Description:** Booking validation checks doctor status
**Precondition:**
- Doctor is disabled
- Old slot still exists

**Steps:**
1. Attempt to book

**Expected Result:** Error - "Doctor is not available"

---

## 10. Consultation Completion

### TC-CC-001: Start Consultation
**Description:** Create consultation when doctor starts
**Precondition:** Appointment status = WITH_DOCTOR

**Test Data:**
```json
{
  "appointmentId": "uuid",
  "chiefComplaint": "Headache for 3 days"
}
```
**Steps:**
1. POST `/api/v1/consultations`
2. Verify consultation created

**Expected Result:**
- Consultation status = STARTED
- startedAt = current timestamp

---

### TC-CC-002: Update Consultation - Move to IN_PROGRESS
**Description:** First update moves status
**Precondition:** Consultation status = STARTED

**Steps:**
1. PATCH `/api/v1/consultations/:id` with diagnosis data
2. Check status

**Expected Result:** Status = IN_PROGRESS

---

### TC-CC-003: Complete Consultation - Success
**Description:** Mark consultation as complete with required fields
**Precondition:**
- Consultation has chiefComplaint
- Consultation has at least one diagnosis

**Steps:**
1. POST `/api/v1/consultations/:id/complete`
2. Verify status and appointment

**Expected Result:**
- Consultation status = COMPLETED
- completedAt = current timestamp
- Appointment status = COMPLETED

---

### TC-CC-004: Complete Consultation - Missing Diagnosis
**Description:** Cannot complete without diagnosis
**Precondition:** Consultation has no diagnosis

**Steps:**
1. POST `/api/v1/consultations/:id/complete`

**Expected Result:** Error 400 - "At least one diagnosis is required"

---

### TC-CC-005: Complete Consultation - Missing Chief Complaint
**Description:** Cannot complete without chief complaint
**Precondition:** chiefComplaint is empty

**Steps:**
1. POST `/api/v1/consultations/:id/complete`

**Expected Result:** Error 400 - "Chief complaint is required"

---

### TC-CC-006: Abandon Consultation
**Description:** Doctor abandons incomplete consultation
**Steps:**
1. POST `/api/v1/consultations/:id/abandon` with reason
2. Verify status

**Expected Result:**
- Consultation status = ABANDONED
- abandonedAt = current timestamp
- Reason recorded in notes

---

### TC-CC-007: Cannot Update Completed Consultation
**Description:** Completed consultations are immutable
**Precondition:** Consultation status = COMPLETED

**Steps:**
1. PATCH `/api/v1/consultations/:id` with updates

**Expected Result:** Error 400 - "Cannot update a completed consultation"

---

### TC-CC-008: Cannot Update Abandoned Consultation
**Description:** Abandoned consultations are immutable
**Precondition:** Consultation status = ABANDONED

**Steps:**
1. PATCH `/api/v1/consultations/:id` with updates

**Expected Result:** Error 400 - "Cannot update an abandoned consultation"

---

## 11. Multi-Doctor Visits

### TC-MDV-001: Add Consulting Doctor
**Description:** Primary doctor requests consultation
**Precondition:** Active consultation exists

**Test Data:**
```json
{
  "doctorId": "consulting-doctor-uuid",
  "role": "CONSULTING",
  "notes": "Need cardiology opinion"
}
```
**Steps:**
1. POST `/api/v1/consultations/:id/participants`
2. Verify participant added

**Expected Result:**
- ConsultationParticipant created
- joinedAt = current timestamp
- Consulting doctor notified

---

### TC-MDV-002: Add Assisting Doctor
**Description:** Add doctor in ASSISTING role
**Test Data:**
```json
{
  "doctorId": "assistant-doctor-uuid",
  "role": "ASSISTING"
}
```
**Expected Result:** Participant with role = ASSISTING created

---

### TC-MDV-003: Add Supervising Doctor
**Description:** Add supervisor for training case
**Test Data:**
```json
{
  "doctorId": "senior-doctor-uuid",
  "role": "SUPERVISING"
}
```
**Expected Result:** Participant with role = SUPERVISING created

---

### TC-MDV-004: Cannot Add Primary Doctor as Participant
**Description:** Primary doctor already part of consultation
**Precondition:** Consultation with doctorId = X

**Steps:**
1. Try to add doctor X as participant

**Expected Result:** Error 400 - "Primary doctor cannot be added as a participant"

---

### TC-MDV-005: Cannot Add Same Doctor Twice
**Description:** Prevent duplicate participants
**Precondition:** Doctor already added as participant

**Steps:**
1. Try to add same doctor again

**Expected Result:** Error 400 - "Doctor is already a participant"

---

### TC-MDV-006: Record Participant Departure
**Description:** Record when consulting doctor leaves
**Precondition:** Participant exists

**Steps:**
1. POST `/api/v1/consultations/:id/participants/:doctorId/leave`
2. Verify departure recorded

**Expected Result:**
- leftAt = current timestamp
- Optional notes recorded

---

### TC-MDV-007: Remove Participant
**Description:** Remove doctor from consultation
**Steps:**
1. DELETE `/api/v1/consultations/:id/participants/:doctorId`
2. Verify removal

**Expected Result:** Participant record deleted

---

### TC-MDV-008: Cannot Add Participant to Completed Consultation
**Description:** Closed consultations cannot have new participants
**Precondition:** Consultation status = COMPLETED

**Steps:**
1. Try to add participant

**Expected Result:** Error 400 - "Cannot add participant to a closed consultation"

---

### TC-MDV-009: List All Participants
**Description:** Get all doctors involved in consultation
**Precondition:** Consultation has 3 participants

**Steps:**
1. GET `/api/v1/consultations/:id/participants`
2. Verify all returned

**Expected Result:** Array of 3 participants with doctor details and roles

---

## 12. Cron Jobs

### TC-CJ-001: NO_SHOW Detection Cron Runs Every 5 Minutes
**Description:** Verify cron schedule
**Steps:**
1. Check cron configuration
2. Monitor execution logs

**Expected Result:** Cron executes every 5 minutes

---

### TC-CJ-002: NO_SHOW Cron Processes Correct Appointments
**Description:** Only processes eligible appointments
**Query Criteria:**
```
- status IN (SCHEDULED, CONFIRMED, CHECKED_IN)
- appointmentDate = today
- slotStartTime + doctor.slotDuration < now
```
**Steps:**
1. Create test appointments in various states
2. Run cron
3. Verify correct ones processed

**Expected Result:** Only matching appointments marked NO_SHOW

---

### TC-CJ-003: Slot Generation Cron (Daily)
**Description:** Auto-generate slots for future dates
**Schedule:** Daily at 00:00

**Steps:**
1. Verify cron runs
2. Check slots generated for next 14 days

**Expected Result:** Slots exist for all working days in range

---

### TC-CJ-004: Reminder Notification Cron
**Description:** Send appointment reminders
**Schedule:** Every hour

**Criteria:**
- Appointment within next 24 hours
- Reminder not yet sent

**Expected Result:** Notifications created for upcoming appointments

---

### TC-CJ-005: Stage Alert Cron
**Description:** Check for stuck patients
**Schedule:** Every 10 minutes

**Steps:**
1. Create appointment stuck at vitals > 15 mins
2. Run cron
3. Check alerts

**Expected Result:** Alert created for stuck patient

---

### TC-CJ-006: Cron Failure Recovery
**Description:** Handle cron failure gracefully
**Steps:**
1. Simulate cron failure
2. Check error logging
3. Verify retry mechanism

**Expected Result:**
- Error logged with details
- Retry attempted
- Alert sent to admin

---

### TC-CJ-007: Cron Idempotency
**Description:** Running cron twice doesn't cause issues
**Steps:**
1. Run NO_SHOW cron
2. Immediately run again
3. Check for duplicates

**Expected Result:** No duplicate NO_SHOW marks or logs

---

## 13. Notifications

### TC-NOT-001: Appointment Booked Notification
**Description:** Patient receives booking confirmation
**Trigger:** Appointment created

**Expected Result:**
- In-app notification created
- Email sent (if enabled)
- SMS sent (if enabled)

**Message:** "Your appointment with Dr. X is confirmed for [date] at [time]"

---

### TC-NOT-002: Appointment Cancelled Notification
**Description:** Patient notified of cancellation
**Trigger:** Appointment cancelled (by patient or system)

**Expected Result:** Notification with cancellation reason

---

### TC-NOT-003: NO_SHOW Notification
**Description:** Patient notified of no-show mark
**Trigger:** Appointment marked NO_SHOW

**Expected Result:**
- Notification sent
- Warning about no-show count

---

### TC-NOT-004: Doctor Resignation Notification
**Description:** Patients notified when doctor disabled
**Trigger:** Doctor disabled with future appointments

**Expected Result:** All affected patients receive notification

**Message:** "Your appointment with Dr. X on [date] has been cancelled. Please reschedule."

---

### TC-NOT-005: Consultation Request Notification
**Description:** Doctor notified of consultation request
**Trigger:** Added as participant

**Expected Result:** Doctor receives notification

**Message:** "Dr. X has requested your consultation for a patient."

---

### TC-NOT-006: Reminder Notification (24 hours)
**Description:** Reminder sent day before appointment
**Schedule:** 24 hours before

**Expected Result:** Reminder notification sent

---

### TC-NOT-007: Reminder Notification (1 hour)
**Description:** Reminder sent 1 hour before
**Schedule:** 1 hour before

**Expected Result:** Reminder notification sent

---

### TC-NOT-008: Patient Blocked Notification
**Description:** Patient notified when blocked
**Trigger:** Patient status changed to BLOCKED

**Expected Result:** Notification explaining block reason and appeal process

---

## 14. Example Scenarios

### Scenario 1: Happy Path - Complete Appointment Journey

**Setup:**
- Doctor: Dr. Smith, slotDuration=30, schedule 09:00-17:00
- Patient: John Doe, status=ACTIVE

**Flow:**
```
1. [Day-7] Slot generation cron creates slots for next week
   → Result: 16 slots/day for Dr. Smith

2. [Day-1] Patient books 10:00 appointment
   → POST /api/v1/appointments/book
   → Result: Appointment SCHEDULED, slot booked

3. [Day-1] Patient receives confirmation
   → Notification: "Appointment confirmed for tomorrow 10:00"

4. [Day-0, 09:00] Reminder notification sent
   → Notification: "Your appointment is in 1 hour"

5. [Day-0, 09:55] Patient arrives, checks in at kiosk
   → PATCH /api/v1/appointments/:id/checkin
   → Status: CHECKED_IN

6. [Day-0, 10:05] Nurse takes vitals
   → POST /api/v1/vitals
   → Status: VITALS_TAKEN

7. [Day-0, 10:15] Doctor calls patient
   → Status: WITH_DOCTOR

8. [Day-0, 10:15] Consultation started
   → POST /api/v1/consultations
   → Consultation status: STARTED

9. [Day-0, 10:30] Doctor adds diagnosis
   → PATCH /api/v1/consultations/:id
   → Consultation status: IN_PROGRESS

10. [Day-0, 10:40] Doctor completes consultation
    → POST /api/v1/consultations/:id/complete
    → Consultation: COMPLETED, Appointment: COMPLETED
```

**Verification:**
- Appointment status = COMPLETED
- Consultation has diagnosis and chief complaint
- No NO_SHOW log exists
- Patient noShowCount unchanged

---

### Scenario 2: NO_SHOW with Slot Release

**Setup:**
- Doctor: Dr. Johnson, slotDuration=20
- Patient: Jane Smith, appointment at 14:00
- Current time progression: 14:00 → 14:25

**Flow:**
```
1. [14:00] Appointment scheduled, patient hasn't arrived

2. [14:05] Cron runs
   → Check: 14:05 < 14:00 + 20min = 14:20
   → No action (within timeout)

3. [14:10] Cron runs
   → Check: 14:10 < 14:20
   → No action

4. [14:15] Cron runs
   → Check: 14:15 < 14:20
   → No action

5. [14:20] Cron runs
   → Check: 14:20 >= 14:20
   → Still in grace period (equal)

6. [14:25] Cron runs
   → Check: 14:25 > 14:20
   → Mark as NO_SHOW
   → Check rebookable: 14:25 within working hours
   → Release slot: isAvailable = true
   → Create NoShowLog with slotReleased = true
   → Increment patient noShowCount

7. [14:30] Another patient books released slot
   → Booking succeeds
```

**Verification:**
- Original appointment status = NO_SHOW
- NoShowLog.slotReleased = true
- Slot.isAvailable = true
- Patient.noShowCount = 1 (or incremented)
- New appointment created for slot

---

### Scenario 3: Emergency Doctor Leave

**Setup:**
- Doctor: Dr. Williams, has 8 appointments today
- Emergency: Doctor has to leave at 11:00

**Flow:**
```
1. [11:00] Admin marks doctor absence
   → POST /api/v1/doctors/:id/absences
   → Data: { startDate: today, startTime: "11:00", endTime: "17:00", isFullDay: false }

2. System blocks remaining slots
   → Slots from 11:00-17:00 marked isBlocked = true
   → 5 afternoon appointments affected

3. System notifies affected patients
   → 5 notifications created
   → "Your appointment has been cancelled due to emergency"

4. Appointments cancelled
   → Status = CANCELLED
   → CancellationReason = "Doctor emergency leave"

5. Patients can rebook
   → Released slots from other doctors shown
   → Or reschedule to different day
```

**Verification:**
- 5 appointments cancelled
- 5 notifications sent
- Slots blocked (not released to prevent rebooking with same doctor)
- Morning appointments (before 11:00) unaffected

---

### Scenario 4: Repeat No-Show Leading to Block

**Setup:**
- Patient: Mike Brown, noShowCount = 6
- Previous no-shows: 6 times over past 3 months

**Flow:**
```
1. [Previous] Patient no-shows recorded
   → noShowCount: 1 → 2 → 3 (FLAGGED) → 4 → 5 → 6

2. [Day-0] Patient books new appointment
   → Warning shown: "Patient has 6 no-shows"
   → Booking allowed (until 7+)

3. [Day-0] Patient doesn't show up

4. [Day-0 + timeout] Cron marks NO_SHOW
   → noShowCount incremented: 6 → 7

5. [Day-0] noShowCount >= 7 triggers block
   → Patient.status = BLOCKED
   → Patient.blockedAt = now
   → Patient.blockedReason = "Excessive no-shows (7)"

6. [Day-0] Patient notified of block
   → "Your account has been blocked due to repeated no-shows"
   → "Contact hospital administration to appeal"

7. [Day+1] Patient tries to book
   → Error: "Patient is blocked from booking"
```

**Verification:**
- Patient.status = BLOCKED
- Patient.noShowCount = 7
- Cannot create new appointments
- Block notification sent

---

### Scenario 5: Multi-Doctor Consultation

**Setup:**
- Primary: Dr. Anderson (General Medicine)
- Patient: Complex case requiring specialist input
- Specialists: Dr. Chen (Cardiology), Dr. Patel (Neurology)

**Flow:**
```
1. [10:00] Patient arrives for appointment with Dr. Anderson

2. [10:15] Dr. Anderson starts consultation
   → POST /api/v1/consultations
   → Status: STARTED

3. [10:20] Dr. Anderson identifies cardiac symptoms
   → Records preliminary findings
   → Status: IN_PROGRESS

4. [10:25] Dr. Anderson requests cardiology consultation
   → POST /api/v1/consultations/:id/participants
   → { doctorId: "dr-chen-id", role: "CONSULTING" }
   → Dr. Chen notified

5. [10:30] Dr. Chen joins consultation
   → Participant record has joinedAt

6. [10:35] Dr. Chen reviews, suggests neurology input
   → POST /api/v1/consultations/:id/participants
   → { doctorId: "dr-patel-id", role: "CONSULTING" }

7. [10:40] Dr. Patel joins

8. [10:50] Dr. Chen finishes, leaves
   → POST /participants/dr-chen-id/leave
   → leftAt recorded

9. [10:55] Dr. Patel finishes, leaves
   → leftAt recorded

10. [11:00] Dr. Anderson completes consultation
    → POST /consultations/:id/complete
    → Diagnosis includes inputs from all doctors
    → Status: COMPLETED
```

**Verification:**
- Consultation.status = COMPLETED
- 2 ConsultationParticipant records
- Dr. Chen: role=CONSULTING, joinedAt, leftAt set
- Dr. Patel: role=CONSULTING, joinedAt, leftAt set
- Combined diagnosis from all three doctors

---

### Scenario 6: Hospital Holiday Blocking

**Setup:**
- Hospital: General Hospital
- Holiday: National Day (Feb 15)
- Doctors: 10 active doctors

**Flow:**
```
1. [Jan 1] Admin adds holiday
   → POST /api/v1/hospitals/:id/holidays
   → { name: "National Day", date: "2026-02-15" }

2. [Jan 15] Slot generation cron runs for Feb 1-28
   → For each day:
   → Check: Is date a holiday?
   → Feb 15: Yes, skip slot generation
   → Other days: Generate normally

3. [Jan 20] Patient tries to book for Feb 15
   → GET available slots shows none for Feb 15
   → Patient cannot select that date

4. [Jan 25] Admin accidentally creates manual slot for Feb 15
   → Slot exists but booking validation checks holiday

5. [Jan 26] Patient finds the slot somehow (API direct)
   → POST /appointments/book for Feb 15 slot
   → Error: "Cannot book on hospital holiday: National Day"
```

**Verification:**
- No slots generated for Feb 15 for any doctor
- Booking validation prevents appointments on holiday
- Other dates unaffected

---

### Scenario 7: Doctor Resignation with Pending Appointments

**Setup:**
- Doctor: Dr. Martinez, leaving hospital
- Pending appointments: 15 over next 2 weeks
- Completed appointments: 200+ in past year

**Flow:**
```
1. [Day-0] Admin disables doctor
   → PATCH /api/v1/doctors/:id
   → { isActive: false }

2. System queries future appointments
   → 15 appointments found
   → Status IN (SCHEDULED, CONFIRMED)

3. Cascade cancellation begins (transaction)
   → FOR EACH appointment:
   →   Set status = CANCELLED
   →   Set cancellationReason = "Doctor no longer available"
   →   Release associated slot

4. Patient notifications queued
   → 15 notification records created
   → Type: APPOINTMENT_CANCELLED

5. Slots blocked (not released)
   → All future slots: isBlocked = true
   → Prevents rebooking with this doctor

6. Past appointments preserved
   → 200+ completed appointments unchanged
   → Medical history intact

7. Doctor cannot be selected for new bookings
   → API filters by user.isActive = true
   → Doctor doesn't appear in available doctors list
```

**Verification:**
- Doctor.user.isActive = false
- 15 appointments cancelled
- 15 patients notified
- All future slots blocked
- Past appointments/consultations intact
- Doctor not bookable

---

## Test Data Requirements

### Required Test Patients
| Name | MRN | Status | noShowCount |
|------|-----|--------|-------------|
| Active Patient | PAT001 | ACTIVE | 0 |
| Flagged Patient | PAT002 | FLAGGED | 3 |
| Payment Required | PAT003 | FLAGGED | 5 |
| Blocked Patient | PAT004 | BLOCKED | 7 |

### Required Test Doctors
| Name | Specialization | slotDuration | Schedule |
|------|---------------|--------------|----------|
| Dr. Quick | General | 15 | Mon-Fri 9-17 |
| Dr. Standard | Internal | 30 | Mon-Fri 9-17 |
| Dr. Long | Psychiatry | 60 | Mon-Wed 10-16 |
| Dr. Inactive | Surgery | 30 | - (disabled) |

### Required Test Holidays
| Name | Date | isRecurring |
|------|------|-------------|
| New Year | Jan 1 | Yes |
| Test Holiday | Feb 15 | No |

---

## Automated Test Commands

### Run All Tests
```bash
cd backend
npm test -- --testPathPattern="slot|appointment|noshow|consultation"
```

### Run Specific Test Suite
```bash
# Slot generation tests
npm test -- src/tests/slot.test.ts

# Booking tests
npm test -- src/tests/appointment.test.ts

# NO_SHOW tests
npm test -- src/tests/noshow.test.ts

# Consultation tests
npm test -- src/tests/consultation.test.ts
```

### Manual API Testing
```bash
# Set token
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"password123"}' | jq -r '.data.accessToken')

# Test booking
curl -X POST http://localhost:3001/api/v1/appointments/book \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slotId":"uuid","patientId":"uuid"}'

# Test consultation
curl -X POST http://localhost:3001/api/v1/consultations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"appointmentId":"uuid","chiefComplaint":"Test"}'
```

---

## Coverage Requirements

| Module | Target Coverage |
|--------|----------------|
| slotService | 90% |
| appointmentService | 90% |
| noShowService | 95% |
| consultationService | 90% |
| holidayService | 85% |
| doctorService (absence) | 85% |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-22 | System | Initial test cases documentation |
