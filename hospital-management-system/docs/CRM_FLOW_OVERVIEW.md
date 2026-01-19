# CRM Module - Flow Overview

## Lead Pipeline Flow

```
┌─────────┐    ┌───────────┐    ┌───────────┐    ┌─────────────┐    ┌───────────┐
│   NEW   │───>│ CONTACTED │───>│ QUALIFIED │───>│  SCHEDULED  │───>│ CONVERTED │
└─────────┘    └───────────┘    └───────────┘    └─────────────┘    └───────────┘
     │              │                │                  │                  │
     │              │                │                  │                  │
     └──────────────┴────────────────┴──────────────────┴──────────────────┘
                                     │
                                     v
                               ┌──────────┐
                               │   LOST   │
                               └──────────┘
```

## Core Flow Summary

### 1. Lead Capture
**Sources**: Website, Phone, Walk-in, Referral, Social Media, Health Camp

```
Inquiry → Create Lead → Auto-assign Lead Number → Notify Staff
```

### 2. Lead Nurturing
```
Contact Lead → Log Communication → Update Status → Schedule Follow-up → Create Task
```

### 3. Conversion
```
Qualify Lead → Schedule Appointment → Complete Visit → Convert to Patient
```

### 4. Engagement
```
Send Campaign → Collect Survey → Analyze Feedback → Improve Service
```

---

## Module Interactions

```
                    ┌─────────────────┐
                    │    DASHBOARD    │
                    │  (Analytics)    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        v                    v                    v
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│     LEADS     │───>│    TASKS      │<───│   CAMPAIGNS   │
│  (Pipeline)   │    │  (Follow-up)  │    │  (Marketing)  │
└───────┬───────┘    └───────────────┘    └───────┬───────┘
        │                                         │
        v                                         v
┌───────────────┐                         ┌───────────────┐
│COMMUNICATIONS │                         │   TEMPLATES   │
│   (History)   │                         │  (Messages)   │
└───────────────┘                         └───────────────┘
        │                                         │
        └─────────────────┬───────────────────────┘
                          v
                  ┌───────────────┐
                  │    SURVEYS    │
                  │  (Feedback)   │
                  └───────────────┘
```

---

## Quick Reference

| Stage | Action | Outcome |
|-------|--------|---------|
| **Capture** | New inquiry received | Lead created (NEW) |
| **Contact** | First call/message | Status → CONTACTED |
| **Qualify** | Interest confirmed | Status → QUALIFIED |
| **Schedule** | Appointment booked | Status → SCHEDULED |
| **Convert** | Visit completed | Status → CONVERTED, Patient created |
| **Retain** | Campaign + Survey | Feedback collected, Re-engagement |

---

## Key Metrics

| Metric | Formula |
|--------|---------|
| Conversion Rate | (Converted / Total Leads) × 100 |
| NPS Score | % Promoters - % Detractors |
| Response Rate | (Responded / Sent) × 100 |
| Task Completion | (Completed / Total Tasks) × 100 |

---

## User Roles

| Role | Access |
|------|--------|
| **Hospital Admin** | Full access - all features |
| **Receptionist** | Leads, Tasks, Communications |
| **Marketing** | Campaigns, Surveys, Templates, Reports |

---

*Color Theme: Purple/Violet Gradient*
