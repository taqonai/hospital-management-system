# HMS Slot & Appointment System - Flow Overview

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Doctor Slot Configuration Flow](#2-doctor-slot-configuration-flow)
3. [Patient Online Booking Flow](#3-patient-online-booking-flow)
4. [Appointment Journey Flow](#4-appointment-journey-flow)
5. [NO_SHOW Detection Flow](#5-no_show-detection-flow)
6. [Slot Release Flow](#6-slot-release-flow)
7. [Doctor Absence Flow](#7-doctor-absence-flow)
8. [Hospital Holiday Flow](#8-hospital-holiday-flow)
9. [Multi-Doctor Visit Flow](#9-multi-doctor-visit-flow)
10. [Consultation Completion Flow](#10-consultation-completion-flow)
11. [No-Show Blocking Flow](#11-no-show-blocking-flow)
12. [Doctor Resignation Flow](#12-doctor-resignation-flow)
13. [Cron Job & Notification Flow](#13-cron-job--notification-flow)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              HMS SLOT & APPOINTMENT SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐      │
│   │   DOCTORS    │     │   PATIENTS   │     │    SLOTS     │     │ APPOINTMENTS │      │
│   ├──────────────┤     ├──────────────┤     ├──────────────┤     ├──────────────┤      │
│   │ • Schedules  │────▶│ • Booking    │────▶│ • Available  │────▶│ • Scheduled  │      │
│   │ • Absences   │     │ • Check-in   │     │ • Blocked    │     │ • Confirmed  │      │
│   │ • Holidays   │     │ • History    │     │ • Booked     │     │ • Checked-in │      │
│   └──────────────┘     └──────────────┘     └──────────────┘     │ • Completed  │      │
│                                                                   │ • NO_SHOW    │      │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     └──────────────┘      │
│   │  CRON JOBS   │     │NOTIFICATIONS │     │CONSULTATIONS │                           │
│   ├──────────────┤     ├──────────────┤     ├──────────────┤                           │
│   │ • NO_SHOW    │────▶│ • SMS        │     │ • Primary    │                           │
│   │ • Alerts     │     │ • Email      │     │ • Multi-doc  │                           │
│   │ • Reminders  │     │ • In-app     │     │ • Status     │                           │
│   └──────────────┘     └──────────────┘     └──────────────┘                           │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Entities & Relationships

```
Doctor ─────────────┬───────────────────┬──────────────────┬─────────────────┐
                    │                   │                  │                 │
                    ▼                   ▼                  ▼                 ▼
            DoctorSchedule        DoctorSlot         DoctorAbsence      Appointment
            (Working hours)    (Bookable slots)    (Leave/Absence)    (Patient visit)
                    │                   │                  │                 │
                    │                   ▼                  │                 ▼
                    │              SlotConfig              │           Consultation
                    │            (Duration, max)           │          (Clinical data)
                    │                   │                  │                 │
                    └───────────────────┴──────────────────┴─────────────────┘
                                        │
                                        ▼
                              Hospital (Multi-tenant)
                                        │
                                        ▼
                              HospitalHoliday
                             (System-wide holidays)
```

---

## 2. Doctor Slot Configuration Flow

### 2.1 Doctor Creation with Slot Config

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DOCTOR CREATION FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     Admin Creates Doctor      │
                    │                               │
                    │  • Name, Specialization       │
                    │  • Department                 │
                    │  • Slot Duration (15/20/30)   │
                    │  • Max Patients Per Day       │
                    │  • Consultation Fee           │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Create Doctor Schedules     │
                    │                               │
                    │  Per day of week:             │
                    │  • Start Time (e.g., 09:00)   │
                    │  • End Time (e.g., 17:00)     │
                    │  • Break Start (e.g., 13:00)  │
                    │  • Break End (e.g., 14:00)    │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Auto-Generate Slots         │
                    │                               │
                    │  For next 30 days:            │
                    │  • Check schedule for day     │
                    │  • Generate time slots        │
                    │  • Skip break times           │
                    │  • Skip holidays              │
                    │  • Mark blocked if absence    │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │       Slots Available         │
                    │       for Booking             │
                    └───────────────────────────────┘
```

### 2.2 Slot Generation Algorithm

```
INPUT: Doctor Schedule + Slot Duration + Date Range
OUTPUT: DoctorSlot records

ALGORITHM:
┌─────────────────────────────────────────────────────────────────────────────┐
│ FOR each day in next 30 days:                                                │
│   │                                                                          │
│   ├─► IF day is hospital holiday → SKIP                                      │
│   │                                                                          │
│   ├─► IF no schedule for this weekday → SKIP                                 │
│   │                                                                          │
│   ├─► GET schedule (startTime, endTime, breakStart, breakEnd)                │
│   │                                                                          │
│   ├─► SET currentTime = startTime                                            │
│   │                                                                          │
│   └─► WHILE currentTime + slotDuration <= endTime:                           │
│         │                                                                    │
│         ├─► IF currentTime overlaps break → SKIP to breakEnd                 │
│         │                                                                    │
│         ├─► CREATE slot:                                                     │
│         │     • slotDate = day                                               │
│         │     • startTime = currentTime                                      │
│         │     • endTime = currentTime + slotDuration                         │
│         │     • isAvailable = true                                           │
│         │     • isBlocked = (check doctor absence)                           │
│         │                                                                    │
│         └─► currentTime = currentTime + slotDuration                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Example Slot Generation

```
Doctor: Dr. Smith
Slot Duration: 30 minutes
Schedule: Monday 09:00-17:00, Break 13:00-14:00

Generated Slots for Monday:
┌──────────┬──────────┬───────────┬───────────┐
│   Slot   │  Start   │    End    │  Status   │
├──────────┼──────────┼───────────┼───────────┤
│    1     │  09:00   │   09:30   │ Available │
│    2     │  09:30   │   10:00   │ Available │
│    3     │  10:00   │   10:30   │ Available │
│    4     │  10:30   │   11:00   │ Available │
│    5     │  11:00   │   11:30   │ Available │
│    6     │  11:30   │   12:00   │ Available │
│    7     │  12:00   │   12:30   │ Available │
│    8     │  12:30   │   13:00   │ Available │
│  BREAK   │  13:00   │   14:00   │  SKIPPED  │
│    9     │  14:00   │   14:30   │ Available │
│   10     │  14:30   │   15:00   │ Available │
│   11     │  15:00   │   15:30   │ Available │
│   12     │  15:30   │   16:00   │ Available │
│   13     │  16:00   │   16:30   │ Available │
│   14     │  16:30   │   17:00   │ Available │
└──────────┴──────────┴───────────┴───────────┘
Total: 14 slots (excluding break)
```

---

## 3. Patient Online Booking Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PATIENT ONLINE BOOKING FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

     Patient                    System                         Database
        │                          │                              │
        │  1. Select Department    │                              │
        ├─────────────────────────▶│                              │
        │                          │  Query active doctors        │
        │                          ├─────────────────────────────▶│
        │                          │◀─────────────────────────────┤
        │◀─────────────────────────┤  Return doctor list          │
        │                          │                              │
        │  2. Select Doctor        │                              │
        ├─────────────────────────▶│                              │
        │                          │                              │
        │  3. Select Date          │                              │
        ├─────────────────────────▶│                              │
        │                          │  Validation Checks:          │
        │                          │  ┌────────────────────────┐  │
        │                          │  │ • Not past date        │  │
        │                          │  │ • Within 30 days       │  │
        │                          │  │ • Not hospital holiday │  │
        │                          │  │ • Not doctor absence   │  │
        │                          │  │ • Doctor is active     │  │
        │                          │  └────────────────────────┘  │
        │                          │                              │
        │                          │  Query available slots       │
        │                          ├─────────────────────────────▶│
        │                          │◀─────────────────────────────┤
        │◀─────────────────────────┤  Return slot list            │
        │                          │                              │
        │  4. Select Time Slot     │                              │
        ├─────────────────────────▶│                              │
        │                          │  Patient Validation:         │
        │                          │  ┌────────────────────────┐  │
        │                          │  │ • Not BLOCKED status   │  │
        │                          │  │ • No duplicate booking │  │
        │                          │  └────────────────────────┘  │
        │                          │                              │
        │                          │  Slot Validation:            │
        │                          │  ┌────────────────────────┐  │
        │                          │  │ • Slot is available    │  │
        │                          │  │ • Not blocked          │  │
        │                          │  │ • Max patients check   │  │
        │                          │  └────────────────────────┘  │
        │                          │                              │
        │                          │  Transaction (Serializable): │
        │                          │  ┌────────────────────────┐  │
        │                          │  │ 1. Lock slot           │  │
        │                          │  │ 2. Re-verify available │  │
        │                          │  │ 3. Create appointment  │  │
        │                          │  │ 4. Mark slot booked    │  │
        │                          │  │ 5. Assign token number │  │
        │                          │  └────────────────────────┘  │
        │                          │                              │
        │◀─────────────────────────┤  Booking Confirmed           │
        │                          │                              │
        │                          │  Send Notifications:         │
        │                          │  • SMS confirmation          │
        │                          │  • Email with details        │
        │                          │  • In-app notification       │
        │                          │                              │
```

### 3.1 Booking Validation Matrix

| Check | Condition | Error Message |
|-------|-----------|---------------|
| Past Date | `appointmentDate < today` | Cannot book appointments in the past |
| Max Advance | `appointmentDate > today + 30` | Cannot book more than 30 days in advance |
| Hospital Holiday | `isHoliday(date) = true` | Cannot book on {holidayName} (hospital holiday) |
| Doctor Absence | `hasAbsence(doctorId, date)` | Doctor is on leave on this date |
| Doctor Inactive | `doctor.isAvailable = false` | Doctor is currently not available |
| Doctor User Inactive | `doctor.user.isActive = false` | Doctor is no longer active in the system |
| Patient Blocked | `patient.status = BLOCKED` | Patient is blocked due to repeated no-shows |
| Slot Unavailable | `slot.isAvailable = false` | This time slot is already booked |
| Slot Blocked | `slot.isBlocked = true` | This time slot is blocked |
| Max Patients | `bookedToday >= maxPatientsPerDay` | Doctor has reached maximum patients for this day |
| Duplicate Booking | `existingAppointment(patient, date, time)` | Patient already has an appointment at this time |

---

## 4. Appointment Journey Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      APPOINTMENT STATUS JOURNEY                              │
└─────────────────────────────────────────────────────────────────────────────┘

  SCHEDULED ──────► CONFIRMED ──────► CHECKED_IN ──────► IN_PROGRESS ──────► COMPLETED
      │                 │                  │                  │
      │                 │                  │                  │
      ▼                 ▼                  ▼                  ▼
   CANCELLED         NO_SHOW           NO_SHOW           ABANDONED
   (by patient)    (auto/manual)    (left before       (left during
                                      vitals)          consultation)


┌─────────────────────────────────────────────────────────────────────────────┐
│                         DETAILED JOURNEY                                     │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────┐
  │ 1. SCHEDULED                                                          │
  │    • Patient books appointment online/receptionist                    │
  │    • Slot marked as booked                                           │
  │    • Token number assigned                                           │
  │    • Confirmation sent                                               │
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
  ┌─────────────────────────┐         ┌─────────────────────────┐
  │ 2. CONFIRMED            │         │ CANCELLED               │
  │    • Day-before reminder│         │ • Patient cancels       │
  │    • Patient confirms   │         │ • Slot released         │
  │                         │         │ • Doctor notified       │
  └─────────────────────────┘         └─────────────────────────┘
                    │
                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ 3. CHECKED_IN                                                         │
  │    • Patient arrives at clinic                                       │
  │    • Receptionist/Kiosk checks in                                    │
  │    • checkedInAt timestamp recorded                                  │
  │    • Added to doctor's queue                                         │
  │    • Timer starts for vitals alert (slotDuration + 5 min)            │
  └──────────────────────────────────────────────────────────────────────┘
                    │
                    ├──────────────────────────────────┐
                    ▼                                  ▼
  ┌─────────────────────────┐         ┌─────────────────────────────────┐
  │ VITALS RECORDED         │         │ NO_VITALS ALERT (if timeout)    │
  │ • Nurse records vitals  │         │ • Alert sent to nurse           │
  │ • vitalsRecordedAt set  │         │ • "Patient waiting for vitals"  │
  │ • Timer starts for      │         └─────────────────────────────────┘
  │   doctor alert          │
  └─────────────────────────┘
                    │
                    ├──────────────────────────────────┐
                    ▼                                  ▼
  ┌─────────────────────────┐         ┌─────────────────────────────────┐
  │ 4. IN_PROGRESS          │         │ NO_DOCTOR ALERT (if timeout)    │
  │    • Doctor calls patient│         │ • Alert sent to doctor          │
  │    • Consultation begins │         │ • "Patient waiting with vitals" │
  │    • Consultation record │         └─────────────────────────────────┘
  │      created (STARTED)   │
  └─────────────────────────┘
                    │
                    ├──────────────────────────────────┐
                    ▼                                  ▼
  ┌─────────────────────────┐         ┌─────────────────────────────────┐
  │ 5. COMPLETED            │         │ ABANDONED                       │
  │    • Diagnosis recorded │         │ • Consultation incomplete       │
  │    • Prescription given │         │ • Doctor left without finishing │
  │    • Consultation status│         │ • Needs follow-up               │
  │      = COMPLETED        │         └─────────────────────────────────┘
  │    • Lab orders if any  │
  │    • Follow-up scheduled│
  └─────────────────────────┘
```

### 4.1 Appointment Timeline Example

```
┌────────────────────────────────────────────────────────────────────────────┐
│ TIMELINE: Patient John's Appointment with Dr. Smith (30-min slots)         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  08:00  ┌─────────────────────────────────────────────────────────────┐   │
│         │ John books 09:00 appointment online                          │   │
│         │ Status: SCHEDULED, Token: #5                                 │   │
│         └─────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  08:50  ┌─────────────────────────────────────────────────────────────┐   │
│         │ John arrives, checks in at kiosk                             │   │
│         │ Status: CHECKED_IN, checkedInAt: 08:50                       │   │
│         └─────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  08:55  ┌─────────────────────────────────────────────────────────────┐   │
│         │ Nurse records vitals                                         │   │
│         │ vitalsRecordedAt: 08:55                                      │   │
│         │ BP: 120/80, Temp: 98.6°F, Weight: 75kg                       │   │
│         └─────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  09:05  ┌─────────────────────────────────────────────────────────────┐   │
│         │ Doctor calls John                                            │   │
│         │ Status: IN_PROGRESS                                          │   │
│         │ Consultation created (status: STARTED)                       │   │
│         └─────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  09:25  ┌─────────────────────────────────────────────────────────────┐   │
│         │ Doctor completes consultation                                │   │
│         │ Diagnosis: Common cold                                       │   │
│         │ Prescription: Paracetamol, Vitamin C                         │   │
│         │ Status: COMPLETED                                            │   │
│         │ Consultation status: COMPLETED                               │   │
│         └─────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. NO_SHOW Detection Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AUTO NO_SHOW DETECTION FLOW                             │
│                    (Dynamic Timeout Based on Slot Duration)                  │
└─────────────────────────────────────────────────────────────────────────────┘

                         Cron Job (Every 5 minutes, 7AM-10PM)
                                        │
                                        ▼
                    ┌───────────────────────────────────────┐
                    │  Query today's appointments where:     │
                    │  • status IN (SCHEDULED, CONFIRMED)   │
                    │  • appointmentDate = TODAY            │
                    └───────────────────────────────────────┘
                                        │
                                        ▼
                              For each appointment:
                                        │
                    ┌───────────────────────────────────────┐
                    │  Calculate Dynamic Timeout:            │
                    │                                        │
                    │  timeout = slotStartTime +             │
                    │            doctor.slotDuration         │
                    │                                        │
                    │  Example:                              │
                    │  • Slot: 09:00                         │
                    │  • Duration: 30 mins                   │
                    │  • Timeout: 09:30                      │
                    └───────────────────────────────────────┘
                                        │
                                        ▼
                    ┌───────────────────────────────────────┐
                    │  Is currentTime > timeout?            │
                    └───────────────────────────────────────┘
                                        │
                           ┌────────────┴────────────┐
                          YES                        NO
                           │                          │
                           ▼                          ▼
          ┌──────────────────────────┐    ┌────────────────┐
          │ Mark as NO_SHOW:         │    │ Skip, not yet  │
          │                          │    │ timed out      │
          │ 1. status = NO_SHOW      │    └────────────────┘
          │ 2. Create NoShowLog      │
          │ 3. Check slot release    │
          │ 4. Update patient count  │
          │ 5. Send notification     │
          └──────────────────────────┘
                           │
                           ▼
          ┌──────────────────────────┐
          │ Patient Blocking Check:  │
          │                          │
          │ noShowCount++            │
          │                          │
          │ IF count >= 3:           │
          │   status = BLOCKED       │
          │   blockedReason = "..."  │
          └──────────────────────────┘
```

### 5.1 Dynamic Timeout Examples

| Doctor | Slot Duration | Appointment Time | NO_SHOW After |
|--------|---------------|------------------|---------------|
| Dr. Smith | 15 mins | 09:00 | 09:15 |
| Dr. Jones | 20 mins | 10:00 | 10:20 |
| Dr. Brown | 30 mins | 11:00 | 11:30 |
| Dr. Wilson | 45 mins | 14:00 | 14:45 |
| Dr. Taylor | 60 mins | 15:00 | 16:00 |

---

## 6. Slot Release Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SLOT RELEASE FLOW                                    │
│           (Only releases if time hasn't passed for rebooking)               │
└─────────────────────────────────────────────────────────────────────────────┘

                    After NO_SHOW is marked:
                                │
                                ▼
                ┌───────────────────────────────────┐
                │  Check if slot can be released:   │
                │                                   │
                │  isSlotStillValid(                │
                │    appointmentDate,               │
                │    slotStartTime                  │
                │  )                                │
                └───────────────────────────────────┘
                                │
                                ▼
                ┌───────────────────────────────────┐
                │  LOGIC:                           │
                │                                   │
                │  IF appointmentDate > TODAY:      │
                │    → Always release (future date) │
                │                                   │
                │  IF appointmentDate == TODAY:     │
                │    currentTime < slotStartTime?   │
                │    → YES: Release for rebooking   │
                │    → NO: Don't release (passed)   │
                └───────────────────────────────────┘
                                │
                       ┌───────┴───────┐
                      YES              NO
                       │               │
                       ▼               ▼
          ┌────────────────────┐  ┌────────────────────┐
          │ RELEASE SLOT:      │  │ DON'T RELEASE:     │
          │                    │  │                    │
          │ • isAvailable=true │  │ • Slot time passed │
          │ • appointmentId=   │  │ • Cannot rebook    │
          │   null             │  │ • slotReleased=    │
          │ • slotReleased=    │  │   false            │
          │   true             │  │                    │
          │                    │  │                    │
          │ Now another patient│  │                    │
          │ can book this slot │  │                    │
          └────────────────────┘  └────────────────────┘
```

### 6.1 Slot Release Examples

```
Current Time: 10:30 AM, January 22, 2026

┌─────────────────────────────────────────────────────────────────────────────┐
│ SCENARIO 1: Future Date Appointment                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Appointment: January 25, 09:00 AM                                           │
│ NO_SHOW marked: January 22, 10:30 AM (manually by staff)                    │
│ Result: SLOT RELEASED                                                       │
│ Reason: Future date, plenty of time for someone else to book                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SCENARIO 2: Today's Appointment - Time Passed                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Appointment: January 22, 09:00 AM                                           │
│ NO_SHOW marked: January 22, 09:30 AM (auto timeout)                         │
│ Current time: 10:30 AM                                                      │
│ Result: SLOT NOT RELEASED                                                   │
│ Reason: 09:00 slot already passed, no one can use it                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SCENARIO 3: Today's Appointment - Time Not Passed                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Appointment: January 22, 11:00 AM                                           │
│ NO_SHOW marked: January 22, 10:30 AM (manually by staff, early mark)        │
│ Current time: 10:30 AM                                                      │
│ Result: SLOT RELEASED                                                       │
│ Reason: 11:00 hasn't passed yet, someone else could book it                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Doctor Absence Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCTOR ABSENCE FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                    Admin/Doctor Creates Absence
                                │
                                ▼
                ┌───────────────────────────────────┐
                │  Absence Details:                 │
                │  • Doctor ID                      │
                │  • Start Date                     │
                │  • End Date                       │
                │  • Type: ANNUAL/SICK/EMERGENCY/   │
                │          CONFERENCE/TRAINING/     │
                │          PERSONAL/OTHER           │
                │  • Full Day or Partial            │
                │  • Reason/Notes                   │
                └───────────────────────────────────┘
                                │
                                ▼
                ┌───────────────────────────────────┐
                │  Query existing appointments      │
                │  in the absence date range        │
                └───────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
          Has Appointments              No Appointments
                │                               │
                ▼                               ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │ Is EMERGENCY type?  │         │ Block slots only    │
    └─────────────────────┘         │ No notifications    │
                │                   └─────────────────────┘
        ┌───────┴───────┐
       YES              NO
        │               │
        ▼               ▼
┌──────────────────┐  ┌──────────────────┐
│ AUTO-CANCEL:     │  │ WARN ONLY:       │
│                  │  │                  │
│ 1. Cancel all    │  │ 1. Block slots   │
│    appointments  │  │ 2. Include in    │
│ 2. Release slots │  │    response:     │
│ 3. Notify all    │  │    "X affected   │
│    patients      │  │     appointments"│
│ 4. Block slots   │  │ 3. Notify        │
│                  │  │    patients to   │
│                  │  │    reschedule    │
└──────────────────┘  └──────────────────┘
```

### 7.1 Absence Types & Behavior

| Absence Type | Behavior | Patient Notification |
|--------------|----------|---------------------|
| EMERGENCY | Auto-cancel all appointments, release slots | "Appointment cancelled due to emergency" |
| SICK_LEAVE | Block slots, warn about affected | "Doctor unavailable, please reschedule" |
| ANNUAL_LEAVE | Block slots, warn about affected | "Doctor on leave, please reschedule" |
| CONFERENCE | Block slots, warn about affected | "Doctor at conference, please reschedule" |
| TRAINING | Block slots, warn about affected | "Doctor unavailable, please reschedule" |
| PERSONAL | Block slots, warn about affected | "Doctor unavailable, please reschedule" |

---

## 8. Hospital Holiday Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOSPITAL HOLIDAY FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

                    Admin Creates Holiday
                                │
                                ▼
                ┌───────────────────────────────────┐
                │  Holiday Details:                 │
                │  • Name (e.g., "Christmas")       │
                │  • Date                           │
                │  • Is Recurring (yearly)          │
                │  • Description                    │
                └───────────────────────────────────┘
                                │
                                ▼
          ┌─────────────────────────────────────────────────┐
          │                  IMPACTS                         │
          ├─────────────────────────────────────────────────┤
          │                                                  │
          │  1. SLOT GENERATION                              │
          │     • Holiday dates skipped during generation   │
          │     • No slots created for holiday              │
          │                                                  │
          │  2. BOOKING VALIDATION                           │
          │     • Booking on holiday blocked                │
          │     • Error: "Cannot book on {holidayName}"     │
          │                                                  │
          │  3. CALENDAR DISPLAY                             │
          │     • Holiday shown in booking calendar         │
          │     • Date marked as unavailable                │
          │                                                  │
          │  4. RECURRING HOLIDAYS                           │
          │     • Christmas, New Year, etc.                 │
          │     • Same date blocked every year              │
          │                                                  │
          └─────────────────────────────────────────────────┘
```

---

## 9. Multi-Doctor Visit Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-DOCTOR VISIT FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

     Patient books primary doctor
                │
                ▼
    ┌───────────────────────────────┐
    │ Appointment Created:          │
    │ • Primary Doctor: Dr. Smith   │
    │ • Status: SCHEDULED           │
    │ • Token: #5                   │
    └───────────────────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ Patient arrives & checks in   │
    │ Status: CHECKED_IN            │
    └───────────────────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ Vitals recorded once          │
    │ (Shared across all doctors)   │
    └───────────────────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ Primary consultation starts   │
    │ Dr. Smith: IN_PROGRESS        │
    │ Consultation created (STARTED)│
    └───────────────────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ Dr. Smith requests consult    │
    │ from Dr. Jones (Neurology)    │
    │                               │
    │ ConsultationParticipant:      │
    │ • consultationId: xxx         │
    │ • doctorId: Dr. Jones         │
    │ • role: CONSULTING            │
    │ • joinedAt: timestamp         │
    └───────────────────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ Dr. Jones adds notes          │
    │ • Examines patient            │
    │ • Records findings            │
    │ • leftAt: timestamp           │
    └───────────────────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ Dr. Smith completes consult   │
    │ Consultation: COMPLETED       │
    │ Appointment: COMPLETED        │
    └───────────────────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ Combined Billing:             │
    │ • Dr. Smith: $150             │
    │ • Dr. Jones (consult): $100   │
    │ • Total: $250                 │
    └───────────────────────────────┘
```

### 9.1 Participant Roles

| Role | Description | Billing |
|------|-------------|---------|
| PRIMARY | Main treating doctor | Full consultation fee |
| CONSULTING | Called for opinion | Consultation fee |
| ASSISTING | Helps during procedure | Procedure assist fee |
| SUPERVISING | Senior oversight | Supervisory fee |

---

## 10. Consultation Completion Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONSULTATION COMPLETION FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

                    Consultation Status Lifecycle
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
    STARTED              IN_PROGRESS              COMPLETED
   (Created)          (Being worked on)          (Finished)
        │                       │                       │
        │                       │                       │
        └───────────┬───────────┘                       │
                    │                                   │
                    ▼                                   │
                ABANDONED ◄─────────────────────────────┘
              (Incomplete)                      (If abandoned later)


┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETION VALIDATION                                     │
└─────────────────────────────────────────────────────────────────────────────┘

    Doctor attempts to complete consultation
                        │
                        ▼
            ┌───────────────────────────┐
            │  Required Field Checks:   │
            │                           │
            │  1. chiefComplaint        │
            │     - Must not be empty   │
            │                           │
            │  2. diagnosis[]           │
            │     - At least one entry  │
            │                           │
            └───────────────────────────┘
                        │
            ┌───────────┴───────────┐
           PASS                    FAIL
            │                       │
            ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │ COMPLETE:        │    │ ERROR:           │
    │                  │    │                  │
    │ • status =       │    │ "Cannot complete │
    │   COMPLETED      │    │  consultation:   │
    │ • completedAt =  │    │  - Chief         │
    │   NOW()          │    │    complaint     │
    │ • completedBy =  │    │    required      │
    │   doctorId       │    │  - Diagnosis     │
    │                  │    │    required"     │
    │ • Appointment    │    │                  │
    │   also marked    │    │                  │
    │   COMPLETED      │    │                  │
    └──────────────────┘    └──────────────────┘
```

---

## 11. No-Show Blocking Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PATIENT NO-SHOW BLOCKING FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

                    Patient marked as NO_SHOW
                                │
                                ▼
                ┌───────────────────────────────────┐
                │  Increment noShowCount            │
                │  Record lastNoShowAt              │
                └───────────────────────────────────┘
                                │
                                ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                   NO-SHOW THRESHOLD ACTIONS                    │
    ├───────────────────────────────────────────────────────────────┤
    │                                                                │
    │  Count: 1-2     │ No restriction                              │
    │                 │ Normal booking allowed                       │
    │─────────────────┼──────────────────────────────────────────── │
    │  Count: 3       │ WARNING                                      │
    │                 │ Patient notified: "Please attend or cancel"  │
    │                 │ status = FLAGGED                             │
    │─────────────────┼──────────────────────────────────────────── │
    │  Count: 5       │ ADVANCE PAYMENT REQUIRED                     │
    │                 │ Online booking requires deposit              │
    │                 │ Or book via receptionist                     │
    │─────────────────┼──────────────────────────────────────────── │
    │  Count: 7+      │ BLOCKED                                      │
    │                 │ Online booking disabled                      │
    │                 │ Only receptionist can book                   │
    │                 │ status = BLOCKED                             │
    │                 │ blockedAt = timestamp                        │
    │                 │ blockedReason = "Repeated no-shows"          │
    │                                                                │
    └───────────────────────────────────────────────────────────────┘
                                │
                                ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                   RESET AFTER GOOD BEHAVIOR                    │
    ├───────────────────────────────────────────────────────────────┤
    │                                                                │
    │  After 6 months with:                                          │
    │  • No additional no-shows                                      │
    │  • Successfully attended appointments                          │
    │                                                                │
    │  RESET:                                                        │
    │  • noShowCount = 0                                             │
    │  • status = ACTIVE                                             │
    │  • blockedAt = null                                            │
    │  • blockedReason = null                                        │
    │                                                                │
    └───────────────────────────────────────────────────────────────┘
```

---

## 12. Doctor Resignation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DOCTOR RESIGNATION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

            Admin deactivates doctor (isAvailable = false)
                                │
                                ▼
                ┌───────────────────────────────────┐
                │  Query future appointments        │
                │  • appointmentDate >= today       │
                │  • status IN (SCHEDULED,CONFIRMED)│
                └───────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
          Has Bookings                    No Bookings
                │                               │
                ▼                               ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │ CASCADE ACTIONS:    │         │ Simple deactivation │
    │                     │         │ isAvailable = false │
    │ 1. Cancel all       │         └─────────────────────┘
    │    appointments     │
    │    (status=CANCELLED│
    │    notes="Doctor    │
    │    unavailable")    │
    │                     │
    │ 2. Release all      │
    │    booked slots     │
    │    (isAvailable=true│
    │    appointmentId=   │
    │    null)            │
    │                     │
    │ 3. Notify patients  │
    │    via SMS + in-app │
    │    "Appointment     │
    │    cancelled,       │
    │    please rebook"   │
    │                     │
    │ 4. Return stats:    │
    │    cancelledCount   │
    │    notifiedPatients │
    └─────────────────────┘
```

---

## 13. Cron Job & Notification Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CRON JOB & NOTIFICATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │                    CRON JOB SCHEDULE                                 │
    ├─────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │  Job: NO_SHOW_CHECK                                                  │
    │  Schedule: */5 7-22 * * *  (Every 5 min, 7 AM - 10 PM)              │
    │                                                                      │
    │  Tasks:                                                              │
    │  1. Process auto NO_SHOWs (dynamic timeout)                         │
    │  2. Create stage alerts (NO_VITALS, NO_DOCTOR)                      │
    │  3. Log run to cron_job_runs table                                  │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    TIMEOUT PROTECTION                                │
    ├─────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │  • isProcessing flag prevents duplicate runs                        │
    │  • 5-minute timeout resets stuck processing                         │
    │  • consecutiveFailures tracked                                      │
    │  • Admin notified after 3+ failures                                 │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    NOTIFICATION CHANNELS                             │
    ├─────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
    │  │   SMS    │  │  Email   │  │  In-App  │  │ WhatsApp │            │
    │  │  (SNS)   │  │  (SES)   │  │          │  │          │            │
    │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
    │                                                                      │
    │  Usage by Event:                                                     │
    │  • NO_SHOW: SMS + In-App                                            │
    │  • Stage Alert: In-App (staff only)                                 │
    │  • Absence: SMS + In-App + Email                                    │
    │  • Booking Confirm: SMS + Email + In-App                            │
    │  • Cancellation: SMS + In-App                                       │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    FALLBACK MECHANISMS                               │
    ├─────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │  1. CloudWatch Lambda (external backup)                             │
    │     • Calls /external-trigger every 5 mins                          │
    │     • Acts as backup if internal cron fails                         │
    │                                                                      │
    │  2. Notification Retry                                               │
    │     • Exponential backoff: 2^retryCount * 1000ms                    │
    │     • Max 3 retries per notification                                │
    │     • Failures logged for admin review                              │
    │                                                                      │
    │  3. Health Monitoring                                                │
    │     • /cron-health endpoint for status                              │
    │     • CloudWatch alarm if unhealthy > 10 mins                       │
    │     • SNS alert to admin email                                      │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Status Transitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    APPOINTMENT STATUS MATRIX                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FROM ↓ / TO →   │ CONFIRMED │ CHECKED_IN │ IN_PROGRESS │ COMPLETED │ NO_SHOW │ CANCELLED │
│  ─────────────────┼───────────┼────────────┼─────────────┼───────────┼─────────┼───────────│
│  SCHEDULED        │     ✓     │     ✓      │      -      │     -     │    ✓    │     ✓     │
│  CONFIRMED        │     -     │     ✓      │      -      │     -     │    ✓    │     ✓     │
│  CHECKED_IN       │     -     │     -      │      ✓      │     -     │    ✓    │     -     │
│  IN_PROGRESS      │     -     │     -      │      -      │     ✓     │    -    │     -     │
│  COMPLETED        │     -     │     -      │      -      │     -     │    -    │     -     │
│  NO_SHOW          │     -     │     -      │      -      │     -     │    -    │     -     │
│  CANCELLED        │     -     │     -      │      -      │     -     │    -    │     -     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONSULTATION STATUS MATRIX                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FROM ↓ / TO →   │ IN_PROGRESS │ COMPLETED │ ABANDONED │
│  ─────────────────┼─────────────┼───────────┼───────────│
│  STARTED          │      ✓      │     ✓     │     ✓     │
│  IN_PROGRESS      │      -      │     ✓     │     ✓     │
│  COMPLETED        │      -      │     -     │     -     │
│  ABANDONED        │      -      │     -     │     -     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| Component | File | Description |
|-----------|------|-------------|
| Slot Generation | `slotService.ts` | Generate, book, release slots |
| Appointments | `appointmentService.ts` | CRUD, validation, booking |
| NO_SHOW | `noShowService.ts` | Auto detection, stage alerts |
| Cron Jobs | `noShowCron.ts` | Scheduled tasks, health monitoring |
| Holidays | `holidayService.ts` | Hospital-wide holiday management |
| Consultations | `consultationService.ts` | Status tracking, multi-doctor |
| Doctors | `doctorService.ts` | Schedules, absences, resignation |
| Notifications | `notificationService.ts` | SMS, email, in-app |
