# IPD Module — Role-Wise Review
**Spetaar HMS | Updated: January 28, 2026**

---

## 1. DOCTOR

### Permissions
- `ipd:admissions:read` — View all admissions
- `ipd:admissions:write` — Create & update admissions
- `ipd:discharge` — Process patient discharge
- `ipd:rounds` — Conduct ward rounds

### What They Can Do
| Feature | Access | Notes |
|---------|--------|-------|
| View IPD Dashboard & Stats | ✅ | Total beds, occupancy, admissions |
| View Admissions List | ✅ | Filter by status, ward, patient |
| Create New Admission | ✅ | Assign patient, bed, diagnosis |
| View Admission Detail | ✅ | 6 tabs: Overview, Orders, Vitals, Notes, Medications, Discharge |
| Create Doctor's Orders | ✅ | Lab, imaging, medication, procedure, consultation, diet, activity, other |
| Cancel Doctor's Orders | ✅ | Own orders only |
| Update Order Status | ✅ | Mark in-progress / completed |
| Write Progress Notes | ✅ | SOAP / narrative notes with role tag |
| Record Vitals (NEWS2) | ✅ | Auto-calculates NEWS2 risk score |
| View NEWS2 Dashboard | ✅ | High-risk patients, deterioration alerts |
| Discharge Patient | ✅ | **Only role that can discharge** (+ Admin) |
| View Discharge Tab | ✅ | Tab visible only with `ipd:discharge` permission |
| Calculate NEWS2 (preview) | ✅ | Without saving |
| View High-Risk Patients | ✅ | Critical/high NEWS2 scores |
| Transfer Patient Bed | ❌ | Nurses & Admin only |
| Manage Beds (create/status) | ❌ | Not assigned |
| Add Nursing Notes | ❌ | Nurses only |

### Frontend Tabs Visible
Overview ✅ | Orders ✅ | Vitals ✅ | Notes ✅ | Medications ✅ | **Discharge ✅**

---

## 2. NURSE

### Permissions
- `ipd:admissions:read` — View all admissions
- `ipd:admissions:write` — Create & update admissions
- `ipd:beds:manage` — Manage bed allocation & status
- `ipd:nursing:notes` — Add nursing notes

### What They Can Do
| Feature | Access | Notes |
|---------|--------|-------|
| View IPD Dashboard & Stats | ✅ | Total beds, occupancy, admissions |
| View Admissions List | ✅ | Filter by status, ward, patient |
| Create New Admission | ✅ | Assign patient, bed, diagnosis |
| View Admission Detail | ✅ | 5 tabs (no Discharge tab) |
| Update Order Status | ✅ | Execute doctor's orders |
| Write Progress Notes | ✅ | Nursing progress notes with role tag |
| Add Nursing Notes | ✅ | **Only role with this permission** (+ Admin) |
| Record Vitals (NEWS2) | ✅ | Auto-calculates NEWS2 risk score |
| View NEWS2 Dashboard | ✅ | Monitor patient deterioration |
| Transfer Patient Bed | ✅ | Move patient to different bed/ward |
| Manage Beds | ✅ | Create beds, update bed status (available/maintenance/etc.) |
| Update Bed Status | ✅ | Mark beds available, occupied, maintenance |
| View High-Risk Patients | ✅ | Critical/high NEWS2 scores |
| Create Doctor's Orders | ❌ | Doctors & Admin only |
| Cancel Orders | ❌ | Doctors & Admin only |
| Discharge Patient | ❌ | Doctors & Admin only |

### Frontend Tabs Visible
Overview ✅ | Orders ✅ | Vitals ✅ | Notes ✅ | Medications ✅ | **Discharge ❌** (hidden)

---

## 3. RECEPTIONIST

### Permissions
- `ipd:admissions:read` — View all admissions
- `ipd:admissions:write` — Create & update admissions

### What They Can Do
| Feature | Access | Notes |
|---------|--------|-------|
| View IPD Dashboard & Stats | ✅ | Total beds, occupancy |
| View Admissions List | ✅ | All admissions with filters |
| Create New Admission | ✅ | Register patient admission |
| View Admission Detail | ✅ | Overview, Orders, Vitals, Notes, Medications |
| Update Admission | ✅ | Edit admission details |
| View Available Beds | ✅ | Check bed availability |
| Record Vitals | ❌ | Nurses & Doctors only |
| Write Progress Notes | ❌ | Nurses & Doctors only |
| Create Orders | ❌ | Doctors only |
| Transfer Bed | ❌ | Nurses & Admin only |
| Manage Beds | ❌ | Not assigned |
| Add Nursing Notes | ❌ | Nurses only |
| Discharge Patient | ❌ | Doctors only |

### Frontend Tabs Visible
Overview ✅ | Orders ✅ (read-only) | Vitals ✅ (read-only) | Notes ✅ (read-only) | Medications ✅ (read-only) | **Discharge ❌**

---

## 4. HOSPITAL_ADMIN / SUPER_ADMIN

### Permissions
- **All IPD permissions** — Full access

### What They Can Do
| Feature | Access | Notes |
|---------|--------|-------|
| Everything listed above | ✅ | Unrestricted IPD access |
| Create/Manage Wards | ✅ | Add new wards, configure capacity |
| Create/Manage Beds | ✅ | Add beds, set daily rates, change status |
| Create Admissions | ✅ | Full admission workflow |
| Create Doctor's Orders | ✅ | Can write orders |
| Cancel Orders | ✅ | Can cancel any order |
| Update Order Status | ✅ | Mark orders completed |
| Write Progress Notes | ✅ | Admin notes |
| Add Nursing Notes | ✅ | Access to nursing notes |
| Discharge Patient | ✅ | Full discharge authority |
| Transfer Bed | ✅ | Move patients between beds/wards |
| View All Dashboards | ✅ | Stats, NEWS2, deterioration, high-risk |
| Ward Rounds | ✅ | Via HOSPITAL_ADMIN inheriting all perms |

### Frontend Tabs Visible
Overview ✅ | Orders ✅ | Vitals ✅ | Notes ✅ | Medications ✅ | **Discharge ✅**

---

## 5. LAB_TECHNICIAN

### Permissions
- No direct IPD permissions

### What They Can Do
| Feature | Access | Notes |
|---------|--------|-------|
| Update Order Status | ✅ | Only for lab-type orders (execute lab orders placed by doctors) |
| View IPD Dashboard | ❌ | No IPD read access |
| View Admissions | ❌ | No access |

*Lab Technicians interact with IPD only through order status updates — they receive lab orders from doctors and mark them complete.*

---

## 6. HOUSEKEEPING_MANAGER

### Permissions
- `ipd:beds:manage` — Manage bed allocation

### What They Can Do
| Feature | Access | Notes |
|---------|--------|-------|
| Manage Bed Status | ✅ | Mark beds for cleaning, maintenance, available |
| View Beds & Wards | ✅ | See bed layout and occupancy |
| View Admissions | ❌ | No admission read access |
| All other IPD features | ❌ | Bed management only |

---

## 7. HOUSEKEEPING_STAFF

### Permissions
- `ipd:admissions:read` — View admissions (read-only)

### What They Can Do
| Feature | Access | Notes |
|---------|--------|-------|
| View Admissions | ✅ | Read-only — to know which beds are occupied |
| All other IPD features | ❌ | No write access |

---

## 8. DIETARY_STAFF

### Permissions
- `ipd:admissions:read` — View admissions (read-only)

### What They Can Do
| Feature | Access | Notes |
|---------|--------|-------|
| View Admissions | ✅ | Read-only — to know which patients need meals and dietary plans |
| All other IPD features | ❌ | No write access |

---

## 9. PHARMACIST / RADIOLOGIST / ACCOUNTANT / HR / SECURITY / PATIENT

### Permissions
- **No IPD permissions**

These roles have no direct access to the IPD module.

---

## Permission Matrix (Summary)

| Permission | Doctor | Nurse | Receptionist | Admin | Housekeeping Mgr | Housekeeping Staff | Dietary Staff |
|-----------|--------|-------|-------------|-------|-------------------|--------------------|--------------|
| `ipd:admissions:read` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `ipd:admissions:write` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `ipd:discharge` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `ipd:beds:manage` | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `ipd:rounds` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `ipd:nursing:notes` | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

---

## API Endpoints — Role Authorization

| Endpoint | Method | Authorized Roles |
|----------|--------|-----------------|
| `/ipd/wards` | GET | Any authenticated |
| `/ipd/wards` | POST | HOSPITAL_ADMIN |
| `/ipd/beds` | GET | Any authenticated |
| `/ipd/beds` | POST | HOSPITAL_ADMIN + `ipd:beds:manage` |
| `/ipd/beds/:id/status` | PATCH | HOSPITAL_ADMIN, NURSE + `ipd:beds:manage` |
| `/ipd/beds/available` | GET | Any authenticated |
| `/ipd/admissions` | GET | Any authenticated |
| `/ipd/admissions` | POST | HOSPITAL_ADMIN, DOCTOR, NURSE, RECEPTIONIST + `ipd:admissions:write` |
| `/ipd/admissions/:id` | GET | Any authenticated |
| `/ipd/admissions/:id/detail` | GET | Any authenticated |
| `/ipd/admissions/:id` | PUT | HOSPITAL_ADMIN, DOCTOR, NURSE + `ipd:admissions:write` |
| `/ipd/admissions/:id/transfer` | POST | HOSPITAL_ADMIN, NURSE + `ipd:admissions:write` |
| `/ipd/admissions/:id/nursing-notes` | POST | NURSE + `ipd:nursing:notes` |
| `/ipd/admissions/:id/discharge` | POST | DOCTOR + `ipd:discharge` |
| `/ipd/admissions/:id/orders` | POST | DOCTOR, HOSPITAL_ADMIN + `ipd:admissions:write` |
| `/ipd/admissions/:id/orders` | GET | Any authenticated |
| `/ipd/admissions/:id/orders/:orderId` | PATCH | DOCTOR, NURSE, LAB_TECHNICIAN, HOSPITAL_ADMIN + `ipd:admissions:write` |
| `/ipd/admissions/:id/orders/:orderId` | DELETE | DOCTOR, HOSPITAL_ADMIN + `ipd:admissions:write` |
| `/ipd/admissions/:id/notes` | POST | DOCTOR, NURSE + `ipd:admissions:write` |
| `/ipd/admissions/:id/notes` | GET | Any authenticated |
| `/ipd/admissions/:id/vitals` | POST | NURSE, DOCTOR + `ipd:admissions:write` |
| `/ipd/stats` | GET | Any authenticated |
| `/ipd/high-risk` | GET | Any authenticated |
| `/ipd/deterioration-dashboard` | GET | Any authenticated |
| `/ipd/calculate-news2` | POST | Any authenticated |

---

## Current Issues (as of Jan 28, 2026)

1. ~~Missing Beds tab in frontend~~ — Fixed in latest build
2. ~~New Admission modal overlay bug~~ — Fixed
3. ~~Admission Detail blank page~~ — Fixed (backend enrichment + TS interfaces)
4. **No test data** in dev DB — need seed script for patients, doctors, admissions
5. **No staff endpoint** — `/api/v1/staff?role=doctor` returns 404
6. Lab Orders integration gap — Smart Orders don't create LabOrder records

---

*Generated from codebase analysis: `rbacService.ts`, `ipdRoutes.ts`, `AdmissionDetail.tsx`*
