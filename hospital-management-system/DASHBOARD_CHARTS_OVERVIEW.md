# Dashboard Charts Overview

This document provides a comprehensive overview of all charts and visualizations across the Hospital Management System dashboards.

---

## Table of Contents

1. [Admin Dashboard](#admin-dashboard)
2. [Doctor Dashboard](#doctor-dashboard)
3. [Nurse Dashboard](#nurse-dashboard)
4. [Receptionist Dashboard](#receptionist-dashboard)
5. [Lab Technician Dashboard](#lab-technician-dashboard)
6. [Pharmacist Dashboard](#pharmacist-dashboard)
7. [Radiologist Dashboard](#radiologist-dashboard)
8. [HR Dashboard](#hr-dashboard)
9. [Accountant Dashboard](#accountant-dashboard)
10. [Marketing Dashboard](#marketing-dashboard)

---

## Admin Dashboard

### KPI Cards (Top Row)

| Card | Data Source | Description |
|------|-------------|-------------|
| **Today's Appointments** | `appointmentApi.getDashboardStats()` | Total appointments scheduled for today with completed count |
| **Completed Visits** | `reportsApi.getExecutiveSummary()` | Number of completed appointments with completion rate % |
| **Pending Patients** | `reportsApi.getExecutiveSummary()` | Patients waiting for consultation |
| **No Shows** | `appointmentApi.getDashboardStats()` | Patients who missed appointments with trend indicator |

### Secondary Stats (Second Row)

| Card | Data Source | Description |
|------|-------------|-------------|
| **IPD Patients** | `reportsApi.getBedOccupancy()` | Current inpatient count |
| **Bed Occupancy** | `reportsApi.getBedOccupancy()` | Occupancy percentage across all wards |
| **Weekly Appointments** | `reportsApi.getPatientTrends('daily', 1)` | Total appointments for the week |
| **Total Beds** | `reportsApi.getBedOccupancy()` | Hospital bed capacity |

### Weekly Activity Bar Chart

- **Type:** Grouped Bar Chart
- **Data:** `reportsApi.getPatientTrends('daily', 1)`
- **X-Axis:** Days of the week (Mon-Sun)
- **Y-Axis:** Appointment count
- **Bars:**
  - Blue: Total appointments
  - Green: Completed appointments
- **Purpose:** Shows daily appointment volume and completion rate pattern to identify busy days

### Patient Distribution by Department (Pie Chart)

- **Type:** Doughnut Chart
- **Data:** `reportsApi.getDepartmentPerformance()`
- **Segments:** Top 5 departments by patient count
- **Colors:** Blue, Cyan, Indigo, Purple, Green
- **Purpose:** Visualizes which departments handle the most patients for resource allocation

### Appointment Trends (6 Months)

- **Type:** Line Chart
- **Data:** `reportsApi.getPatientTrends('monthly', 6)`
- **X-Axis:** Months (Jan-Jun)
- **Y-Axis:** Appointment count
- **Lines:**
  - Solid: Total appointments
  - Dashed: Completed appointments
- **Purpose:** Shows growth trends and seasonal patterns in patient volume

### Revenue Trends (12 Months)

- **Type:** Dual Line Chart
- **Data:** `reportsApi.getRevenueTrends(12)`
- **X-Axis:** Months
- **Y-Axis:** Revenue in currency (formatted as $K)
- **Lines:**
  - Blue: Billed amount
  - Green: Collected amount
- **Purpose:** Tracks financial performance and collection efficiency over time

### Department Performance Chart

- **Type:** Horizontal Bar Chart
- **Data:** `reportsApi.getDepartmentPerformance()`
- **Metrics per department:**
  - Patient count
  - Revenue generated
  - Average wait time
- **Purpose:** Compares department efficiency and revenue contribution

### Patient Demographics Charts

- **Type:** Two Doughnut Charts
- **Data:** `reportsApi.getPatientDemographics()`
- **Chart 1 - Age Distribution:**
  - 0-18, 19-30, 31-45, 46-60, 61-75, 75+
- **Chart 2 - Gender Distribution:**
  - Male, Female, Other
- **Purpose:** Understanding patient population for service planning

### Bed Occupancy by Ward (Gauge Charts)

- **Type:** Radial Gauge (up to 6 wards)
- **Data:** `reportsApi.getBedOccupancy()`
- **Metrics per ward:**
  - Occupancy percentage
  - Available beds
  - Total capacity
- **Color coding:**
  - Green: < 70% occupancy
  - Amber: 70-85% occupancy
  - Red: > 85% occupancy
- **Purpose:** Real-time bed availability monitoring for admissions

---

## Doctor Dashboard

### KPI Cards

| Card | Description |
|------|-------------|
| **Today's Appointments** | Doctor's scheduled appointments for today |
| **Pending Consultations** | Patients in queue waiting |
| **Monthly Consultations** | Total consultations this month |
| **Total Patients** | All-time unique patient count |

### Weekly Appointments Chart

- **Type:** Line Chart
- **Data:** `appointmentApi.getAll({ doctorId, last 7 days })`
- **X-Axis:** Days (Sun-Sat)
- **Y-Axis:** Appointment count
- **Purpose:** Shows weekly workload pattern

### Patient Queue Display

- **Type:** List View
- **Data:** `opdApi.getQueue(doctorId)`
- **Shows:** Token number, patient name, wait time
- **Max items:** 6 patients
- **Purpose:** Real-time view of waiting patients

### Today's Schedule Table

- **Type:** Data Table
- **Columns:** Time, Patient Name, Type, Status, Actions
- **Status badges:**
  - Green: COMPLETED
  - Blue: IN_PROGRESS
  - Amber: CHECKED_IN
  - Red: CANCELLED
- **Purpose:** Full day schedule with action buttons

---

## Nurse Dashboard

### KPI Cards

| Card | Description |
|------|-------------|
| **OPD Waiting** | Patients awaiting vitals recording |
| **Vitals Done Today** | Progress (completed/total) |
| **IPD High Risk** | Patients with NEWS2 score > 6 |
| **Vitals Overdue** | IPD patients needing monitoring |

### Vitals Progress Bar

- **Type:** Progress Bar
- **Calculation:** (Vitals completed / Total checked-in) × 100
- **Colors:** Green fill, gray background
- **Purpose:** Quick view of OPD vitals completion status

### Patient Risk Distribution Chart

- **Type:** Horizontal Bar Chart
- **Data:** IPD patients grouped by NEWS2 score
- **Risk Levels:**
  - Low (0-4): Green
  - Low-Medium (5-6): Amber
  - Medium (5-6 with clinical concern): Orange
  - High (≥7): Red
  - Critical (≥9): Dark Red
- **Purpose:** Prioritize patient monitoring based on deterioration risk

### Ward Occupancy Gauge

- **Type:** Radial Gauge
- **Shows:** IPD bed occupancy percentage
- **Purpose:** Quick capacity check

### Patient Trends Summary

- **Type:** Stat Cards (3)
- **Metrics:**
  - Improving (NEWS2 trending down)
  - Stable (no significant change)
  - Worsening (NEWS2 trending up)
- **Purpose:** Overview of patient condition trajectories

### High Risk Patients Table

- **Type:** Data Table
- **Columns:** Patient, Ward/Bed, NEWS2 Score, Risk Level, Trend, Last Vitals, Actions
- **Filtered:** Only HIGH and CRITICAL risk patients
- **Purpose:** Immediate attention list for clinical intervention

---

## Receptionist Dashboard

### KPI Cards

| Card | Description |
|------|-------------|
| **Waiting** | Patients in queue |
| **In Progress** | Currently being served |
| **Completed** | Today's finished visits |
| **No-Show Rate** | Percentage of no-shows today |

### Queue Status Board

- **Type:** Gradient Cards per Doctor
- **Shows:** Current token number being served
- **Max display:** 4 doctors
- **Purpose:** Public display-ready queue status

### Check-in Status Doughnut

- **Type:** Doughnut Chart
- **Segments:**
  - Checked In (Green)
  - Pending (Amber)
  - No Show (Red)
- **Purpose:** Today's check-in completion overview

### Appointment Distribution Chart

- **Type:** Bar Chart
- **X-Axis:** Hour slots (8:00 - 17:00)
- **Y-Axis:** Appointment count
- **Purpose:** Identify peak hours for staffing decisions

### Upcoming Appointments Card

- **Type:** List View
- **Shows:** SCHEDULED/CONFIRMED appointments
- **Actions:** Check-in button per patient
- **Max items:** 6 appointments
- **Purpose:** Quick check-in workflow

---

## Lab Technician Dashboard

### KPI Cards

| Card | Description |
|------|-------------|
| **Total Orders** | Today's lab order count |
| **Pending** | Awaiting sample collection/processing |
| **Completed** | Results delivered today |
| **Critical Results** | Abnormal values needing review |

### Critical Results Alert Section

- **Type:** Alert Cards
- **Shows:** Top 3 critical results
- **Info:** Test name, patient, abnormal value
- **Purpose:** Immediate flagging of concerning results

### Sample Status Doughnut

- **Type:** Doughnut Chart
- **Segments:**
  - Pending (Red)
  - Sample Collected (Amber)
  - Processing (Blue)
  - Completed (Green)
- **Purpose:** Pipeline visualization of lab workflow

### Today's Progress Gauge

- **Type:** Radial Gauge
- **Calculation:** (Completed orders / Total orders) × 100
- **Purpose:** Daily completion tracking

### Pending Orders Queue

- **Type:** List View
- **Shows:** Next 5 pending orders
- **Info:** Test name, patient name
- **Actions:** Collect Sample button
- **Purpose:** Worklist for sample collection

---

## Pharmacist Dashboard

### KPI Cards

| Card | Description |
|------|-------------|
| **Pending Rx** | Prescriptions awaiting dispensing |
| **Dispensed Today** | Completed dispensings |
| **Low Stock** | Items below minimum threshold |
| **Expiring Soon** | Items expiring within 30 days |

### Low Stock Alert Section

- **Type:** Alert Cards (Top 3)
- **Shows:** Drug name, current stock, minimum required
- **Badge:** "Reorder" for critical items
- **Purpose:** Inventory management alerts

### Expiring Alert Section

- **Type:** Alert Cards (Top 3)
- **Shows:** Drug name, batch number, expiry date
- **Purpose:** Prevent dispensing of expired medications

### Dispensing Progress Gauge

- **Type:** Radial Gauge
- **Calculation:** (Dispensed / Total Rx) × 100
- **Purpose:** Daily workload completion

### Pending Prescriptions Table

- **Type:** Data Table
- **Columns:** Patient Name, Medication Count, Doctor, Actions
- **Purpose:** Dispensing worklist with quick actions

---

## Radiologist Dashboard

### KPI Cards

| Card | Description |
|------|-------------|
| **Total Orders** | Today's imaging orders |
| **Pending Studies** | Awaiting imaging |
| **Pending Reports** | Images taken, report needed |
| **AI Analyzed** | Studies with AI assistance |

### Modality Distribution Doughnut

- **Type:** Doughnut Chart
- **Segments:** X-Ray, CT, MRI, Ultrasound, etc.
- **Purpose:** Workload distribution by imaging type

### Imaging Worklist Table

- **Type:** Data Table
- **Columns:** Patient, Study/Modality, Body Part, Priority, Status
- **Priority colors:**
  - STAT: Red
  - URGENT: Amber
  - ROUTINE: Gray
- **Purpose:** Prioritized imaging queue

### Pending Reports Grid

- **Type:** Card Grid (6 items)
- **Actions per card:**
  - Write Report
  - AI Analysis (if available)
- **Purpose:** Report writing worklist

---

## HR Dashboard

### KPI Cards

| Card | Description |
|------|-------------|
| **Total Employees** | Active employee count |
| **Present Today** | Checked-in employees with rate % |
| **Absent Today** | Not present count |
| **Pending Leaves** | Leave requests awaiting approval |

### Today's Attendance Doughnut

- **Type:** Doughnut Chart
- **Segments:**
  - Present (Green)
  - Absent (Red)
  - On Leave (Blue)
- **Purpose:** Daily attendance snapshot

### Attendance Rate Gauge

- **Type:** Radial Gauge
- **Calculation:** (Present / Total employees) × 100
- **Purpose:** Overall attendance metric

### Employee Type Distribution

- **Type:** Doughnut Chart
- **Segments:** Full-time, Part-time, Contract, etc.
- **Purpose:** Workforce composition analysis

### Department Distribution Bar Chart

- **Type:** Horizontal Bar Chart
- **X-Axis:** Employee count
- **Y-Axis:** Department names
- **Purpose:** Staffing levels per department

### Pending Leave Requests Table

- **Type:** Data Table
- **Columns:** Employee, Leave Type, Dates, Reason, Actions
- **Actions:** Approve / Reject buttons
- **Purpose:** Leave approval workflow

---

## Accountant Dashboard

### KPI Cards

| Card | Description |
|------|-------------|
| **Total Revenue** | This month's revenue |
| **Today's Revenue** | Collected today |
| **Pending Payments** | Outstanding amount |
| **Claims Submitted** | Insurance claims with denial count |

### Revenue Trends Line Chart

- **Type:** Dual Line Chart
- **Data:** 12-month history
- **Lines:**
  - Blue: Billed amount
  - Green: Collected amount
- **Y-Axis format:** $K (thousands)
- **Purpose:** Track billing vs collection efficiency

### Payment Status Doughnut

- **Type:** Doughnut Chart
- **Segments:**
  - Paid (Green)
  - Partial (Amber)
  - Pending (Gray)
  - Overdue (Red)
- **Purpose:** Receivables status overview

### Collection Rate Gauge

- **Type:** Radial Gauge
- **Calculation:** (Collected / Billed) × 100
- **Purpose:** Collection efficiency metric

### Outstanding Summary Cards

- **Type:** 3 Stat Cards
- **Categories:**
  - Pending (0-30 days) - Amber
  - Overdue (31-60 days) - Orange
  - Critical (60+ days) - Red
- **Purpose:** Aging analysis summary

### Outstanding Invoices Table

- **Type:** Data Table
- **Columns:** Invoice #, Patient, Amount, Due Date, Days Overdue, Actions
- **Purpose:** Collections follow-up worklist

---

## Marketing Dashboard

### KPI Cards

| Card | Description |
|------|-------------|
| **Total Leads** | All-time lead count |
| **New Today** | Fresh leads today |
| **Conversion Rate** | Leads converted to patients % |
| **Active Campaigns** | Running campaign count |

### Lead Funnel Bar Chart

- **Type:** Horizontal Funnel/Bar
- **Stages:**
  - New (Gray)
  - Contacted (Blue)
  - Qualified (Amber)
  - Converted (Green)
- **Shows drop-off between stages**
- **Purpose:** Sales pipeline visualization

### Lead Sources Doughnut

- **Type:** Doughnut Chart
- **Segments:** Website, Referral, Walk-in, Social Media, Phone
- **Purpose:** Identify most effective acquisition channels

### Recent Leads Table

- **Type:** Data Table
- **Columns:** Name, Source, Phone, Status Badge
- **Max items:** 6 leads
- **Purpose:** New lead follow-up list

### Active Campaigns Section

- **Type:** Card Grid
- **Metrics per campaign:**
  - Sent count
  - Opened count
  - Clicked count
- **Purpose:** Campaign performance tracking

### Overdue Tasks Alert

- **Type:** Alert Cards (Top 3)
- **Shows:** Task title, lead name, due date
- **Purpose:** Task management for follow-ups

---

## Color Coding Standards

| Context | Green | Amber/Yellow | Red |
|---------|-------|--------------|-----|
| **Completion** | > 80% | 50-80% | < 50% |
| **Risk Level** | Low | Medium | High/Critical |
| **Occupancy** | < 70% | 70-85% | > 85% |
| **Payment** | Paid | Partial | Overdue |
| **Priority** | Routine | Urgent | STAT |
| **Attendance** | Present | Late | Absent |

---

## Data Refresh Intervals

| Dashboard | Refresh Rate | Notes |
|-----------|--------------|-------|
| **Admin** | 60 seconds | Longer for historical data (5 min) |
| **Doctor** | 15-30 seconds | Queue updates frequently |
| **Nurse** | 30 seconds | Critical patient monitoring |
| **Receptionist** | 30 seconds | Queue management |
| **Lab** | 60 seconds | Result updates |
| **Pharmacy** | 60 seconds | Rx queue updates |
| **Radiology** | 60 seconds | Worklist updates |
| **HR** | 5 minutes | Less time-sensitive |
| **Accountant** | 5 minutes | Financial summaries |
| **Marketing** | 5 minutes | CRM updates |

---

## API Endpoints Summary

| Endpoint | Used By | Data Provided |
|----------|---------|---------------|
| `GET /reports/executive-summary` | Admin | KPIs, totals, rates |
| `GET /reports/patient-trends` | Admin | Time-series appointment data |
| `GET /reports/revenue-trends` | Admin, Accountant | Monthly revenue data |
| `GET /reports/department-performance` | Admin | Per-department metrics |
| `GET /reports/patient-demographics` | Admin | Age/gender distribution |
| `GET /reports/bed-occupancy` | Admin, Nurse | Ward-level bed status |
| `GET /doctors/:id/dashboard` | Doctor | Personal stats |
| `GET /opd/queue` | Doctor, Nurse, Receptionist | Live queue data |
| `GET /appointments` | All roles | Filtered appointment lists |
| `GET /laboratory/orders` | Lab | Order worklist |
| `GET /pharmacy/prescriptions` | Pharmacy | Rx worklist |
| `GET /radiology/orders` | Radiology | Imaging worklist |
| `GET /hr/attendance` | HR | Attendance records |
| `GET /billing/invoices` | Accountant | Financial records |
| `GET /crm/leads` | Marketing | Lead pipeline |
| `GET /crm/campaigns` | Marketing | Campaign metrics |

---

*Last Updated: January 2026*
