# CRM Module - Test Cases

## Overview

This document contains comprehensive test cases for the Hospital CRM module, covering functional, integration, UI/UX, and edge case testing.

---

## Test Environment

- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + Prisma
- **Database**: PostgreSQL 15
- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

## Table of Contents

1. [Lead Management Tests](#1-lead-management-tests)
2. [Communication Tests](#2-communication-tests)
3. [Task Management Tests](#3-task-management-tests)
4. [Campaign Tests](#4-campaign-tests)
5. [Survey Tests](#5-survey-tests)
6. [Template Tests](#6-template-tests)
7. [Dashboard & Reports Tests](#7-dashboard--reports-tests)
8. [Integration Tests](#8-integration-tests)
9. [Performance Tests](#9-performance-tests)
10. [Security Tests](#10-security-tests)

---

## 1. Lead Management Tests

### 1.1 Lead Creation

| Test ID | TC-LEAD-001 |
|---------|-------------|
| **Title** | Create new lead with required fields |
| **Priority** | High |
| **Preconditions** | User logged in as HOSPITAL_ADMIN or RECEPTIONIST |
| **Steps** | 1. Navigate to CRM > Leads<br>2. Click "+ New Lead"<br>3. Enter First Name: "Test"<br>4. Enter Last Name: "User"<br>5. Enter Phone: "+966551234567"<br>6. Select Source: "Website"<br>7. Click "Create Lead" |
| **Expected Result** | - Lead created successfully<br>- Toast notification: "Lead created"<br>- Lead appears in NEW column<br>- Lead number auto-generated |
| **Status** | |

| Test ID | TC-LEAD-002 |
|---------|-------------|
| **Title** | Create lead with all optional fields |
| **Priority** | Medium |
| **Preconditions** | User logged in |
| **Steps** | 1. Click "+ New Lead"<br>2. Fill all fields including optional: email, DOB, address, city, state, zip, alternate phone, interested in, preferred doctor, preferred date, notes<br>3. Submit |
| **Expected Result** | - Lead created with all data<br>- All fields visible in lead detail |
| **Status** | |

| Test ID | TC-LEAD-003 |
|---------|-------------|
| **Title** | Validation - Required fields missing |
| **Priority** | High |
| **Preconditions** | User on lead creation form |
| **Steps** | 1. Leave First Name empty<br>2. Leave Phone empty<br>3. Click "Create Lead" |
| **Expected Result** | - Form validation errors shown<br>- Lead not created<br>- Fields highlighted in red |
| **Status** | |

| Test ID | TC-LEAD-004 |
|---------|-------------|
| **Title** | Validation - Invalid phone format |
| **Priority** | Medium |
| **Preconditions** | User on lead creation form |
| **Steps** | 1. Enter Phone: "abc123"<br>2. Submit form |
| **Expected Result** | - Validation error for phone format<br>- Lead not created |
| **Status** | |

| Test ID | TC-LEAD-005 |
|---------|-------------|
| **Title** | Validation - Invalid email format |
| **Priority** | Medium |
| **Preconditions** | User on lead creation form |
| **Steps** | 1. Enter Email: "invalid-email"<br>2. Submit form |
| **Expected Result** | - Validation error for email<br>- Lead not created |
| **Status** | |

### 1.2 Lead Display & Filtering

| Test ID | TC-LEAD-006 |
|---------|-------------|
| **Title** | View leads in Kanban view |
| **Priority** | High |
| **Preconditions** | Multiple leads exist with different statuses |
| **Steps** | 1. Navigate to CRM > Leads<br>2. Ensure Kanban view is selected |
| **Expected Result** | - Leads displayed in columns by status<br>- Columns: NEW, CONTACTED, QUALIFIED, APPOINTMENT_SCHEDULED, CONVERTED, LOST<br>- Lead cards show name, phone, source, score |
| **Status** | |

| Test ID | TC-LEAD-007 |
|---------|-------------|
| **Title** | View leads in Table view |
| **Priority** | High |
| **Preconditions** | Leads exist |
| **Steps** | 1. Navigate to CRM > Leads<br>2. Click Table view icon |
| **Expected Result** | - Leads displayed in table format<br>- Columns: Lead#, Name, Phone, Source, Status, Score, Assigned To, Created |
| **Status** | |

| Test ID | TC-LEAD-008 |
|---------|-------------|
| **Title** | Search leads by name |
| **Priority** | High |
| **Preconditions** | Multiple leads exist |
| **Steps** | 1. Enter "Ahmed" in search box<br>2. Press Enter or wait for debounce |
| **Expected Result** | - Only leads matching "Ahmed" displayed<br>- Search works in both Kanban and Table views |
| **Status** | |

| Test ID | TC-LEAD-009 |
|---------|-------------|
| **Title** | Filter leads by status |
| **Priority** | Medium |
| **Preconditions** | Leads with various statuses exist |
| **Steps** | 1. Click Filters button<br>2. Select Status: "QUALIFIED"<br>3. Apply filter |
| **Expected Result** | - Only QUALIFIED leads shown<br>- Filter indicator visible |
| **Status** | |

| Test ID | TC-LEAD-010 |
|---------|-------------|
| **Title** | Filter leads by source |
| **Priority** | Medium |
| **Preconditions** | Leads from various sources exist |
| **Steps** | 1. Click Filters<br>2. Select Source: "Website"<br>3. Apply |
| **Expected Result** | - Only Website leads displayed |
| **Status** | |

| Test ID | TC-LEAD-011 |
|---------|-------------|
| **Title** | Filter leads by assigned user |
| **Priority** | Medium |
| **Preconditions** | Leads assigned to different users |
| **Steps** | 1. Click Filters<br>2. Select Assigned To: specific user<br>3. Apply |
| **Expected Result** | - Only leads assigned to selected user shown |
| **Status** | |

| Test ID | TC-LEAD-012 |
|---------|-------------|
| **Title** | Clear all filters |
| **Priority** | Low |
| **Preconditions** | Filters applied |
| **Steps** | 1. Click "Clear Filters" or remove filter chips |
| **Expected Result** | - All leads displayed<br>- Filter indicators removed |
| **Status** | |

### 1.3 Lead Status Management

| Test ID | TC-LEAD-013 |
|---------|-------------|
| **Title** | Drag lead to change status (Kanban) |
| **Priority** | High |
| **Preconditions** | Lead in NEW status |
| **Steps** | 1. Drag lead card from NEW column<br>2. Drop in CONTACTED column |
| **Expected Result** | - Lead moves to CONTACTED column<br>- Status updated in database<br>- Activity logged in timeline |
| **Status** | |

| Test ID | TC-LEAD-014 |
|---------|-------------|
| **Title** | Change status via detail modal |
| **Priority** | High |
| **Preconditions** | Lead exists |
| **Steps** | 1. Click lead card<br>2. In detail modal, click status dropdown<br>3. Select "QUALIFIED" |
| **Expected Result** | - Status changes to QUALIFIED<br>- Lead position updates in Kanban<br>- Activity logged |
| **Status** | |

| Test ID | TC-LEAD-015 |
|---------|-------------|
| **Title** | Mark lead as LOST with reason |
| **Priority** | High |
| **Preconditions** | Lead not in CONVERTED status |
| **Steps** | 1. Open lead detail<br>2. Change status to LOST<br>3. Enter reason: "Price too high"<br>4. Save |
| **Expected Result** | - Status changes to LOST<br>- Reason stored and visible<br>- Lead in LOST column (gray) |
| **Status** | |

### 1.4 Lead Assignment

| Test ID | TC-LEAD-016 |
|---------|-------------|
| **Title** | Assign lead to staff member |
| **Priority** | High |
| **Preconditions** | Unassigned lead exists |
| **Steps** | 1. Open lead detail<br>2. Click "Assign" dropdown<br>3. Select staff member<br>4. Confirm |
| **Expected Result** | - Lead assigned to selected user<br>- Assignee avatar shown on lead card<br>- Activity logged |
| **Status** | |

| Test ID | TC-LEAD-017 |
|---------|-------------|
| **Title** | Reassign lead to different user |
| **Priority** | Medium |
| **Preconditions** | Lead already assigned |
| **Steps** | 1. Open assigned lead<br>2. Change assignee to different user |
| **Expected Result** | - Lead reassigned<br>- Previous assignee notified (if notifications enabled)<br>- Activity logged |
| **Status** | |

### 1.5 Lead Conversion

| Test ID | TC-LEAD-018 |
|---------|-------------|
| **Title** | Convert lead to patient |
| **Priority** | Critical |
| **Preconditions** | Lead in QUALIFIED or APPOINTMENT_SCHEDULED status |
| **Steps** | 1. Open lead detail<br>2. Click "Convert to Patient"<br>3. Review patient information<br>4. Click "Convert" |
| **Expected Result** | - Patient record created<br>- Lead status: CONVERTED<br>- Lead linked to patient ID<br>- Success toast shown |
| **Status** | |

| Test ID | TC-LEAD-019 |
|---------|-------------|
| **Title** | Convert lead - duplicate phone check |
| **Priority** | High |
| **Preconditions** | Lead phone matches existing patient |
| **Steps** | 1. Attempt to convert lead<br>2. System detects existing patient |
| **Expected Result** | - Warning shown: "Patient with this phone exists"<br>- Option to link or create new |
| **Status** | |

| Test ID | TC-LEAD-020 |
|---------|-------------|
| **Title** | Edit converted lead information |
| **Priority** | Medium |
| **Preconditions** | Lead before conversion |
| **Steps** | 1. In conversion modal, edit email/address<br>2. Complete conversion |
| **Expected Result** | - Patient created with edited data |
| **Status** | |

### 1.6 Lead Deletion

| Test ID | TC-LEAD-021 |
|---------|-------------|
| **Title** | Delete lead (Admin only) |
| **Priority** | Medium |
| **Preconditions** | User is HOSPITAL_ADMIN |
| **Steps** | 1. Open lead detail<br>2. Click Delete button<br>3. Confirm deletion |
| **Expected Result** | - Confirmation dialog shown<br>- Lead deleted on confirm<br>- Lead removed from list |
| **Status** | |

| Test ID | TC-LEAD-022 |
|---------|-------------|
| **Title** | Delete lead - unauthorized user |
| **Priority** | Medium |
| **Preconditions** | User is RECEPTIONIST |
| **Steps** | 1. Open lead detail<br>2. Look for Delete button |
| **Expected Result** | - Delete button not visible<br>- Or error if API called directly |
| **Status** | |

---

## 2. Communication Tests

### 2.1 Communication Logging

| Test ID | TC-COMM-001 |
|---------|-------------|
| **Title** | Log phone call communication |
| **Priority** | High |
| **Preconditions** | Lead exists |
| **Steps** | 1. Navigate to Communications tab<br>2. Click "+ Log Communication"<br>3. Select Lead<br>4. Channel: Phone Call<br>5. Direction: Outbound<br>6. Enter notes<br>7. Save |
| **Expected Result** | - Communication logged<br>- Appears in communications list<br>- Linked to lead timeline |
| **Status** | |

| Test ID | TC-COMM-002 |
|---------|-------------|
| **Title** | Log email communication |
| **Priority** | High |
| **Preconditions** | Lead with email exists |
| **Steps** | 1. Log communication<br>2. Channel: Email<br>3. Enter subject and content<br>4. Save |
| **Expected Result** | - Email communication logged<br>- Subject visible in list |
| **Status** | |

| Test ID | TC-COMM-003 |
|---------|-------------|
| **Title** | Log WhatsApp communication |
| **Priority** | High |
| **Preconditions** | Lead exists |
| **Steps** | 1. Log communication<br>2. Channel: WhatsApp<br>3. Enter message content<br>4. Save |
| **Expected Result** | - WhatsApp communication logged |
| **Status** | |

| Test ID | TC-COMM-004 |
|---------|-------------|
| **Title** | View communication history for lead |
| **Priority** | High |
| **Preconditions** | Lead has multiple communications |
| **Steps** | 1. Open lead detail<br>2. View Timeline tab |
| **Expected Result** | - All communications shown chronologically<br>- Channel icons visible<br>- Timestamps accurate |
| **Status** | |

### 2.2 Communication with Templates

| Test ID | TC-COMM-005 |
|---------|-------------|
| **Title** | Send communication using template |
| **Priority** | High |
| **Preconditions** | Template exists for channel |
| **Steps** | 1. Log communication<br>2. Select channel (e.g., SMS)<br>3. Click "Use Template"<br>4. Select template<br>5. Variables auto-filled<br>6. Send |
| **Expected Result** | - Template content populated<br>- Variables replaced with lead data<br>- Communication sent/logged |
| **Status** | |

| Test ID | TC-COMM-006 |
|---------|-------------|
| **Title** | Edit template content before sending |
| **Priority** | Medium |
| **Preconditions** | Template selected |
| **Steps** | 1. After template selection<br>2. Modify content<br>3. Send |
| **Expected Result** | - Modified content sent<br>- Original template unchanged |
| **Status** | |

---

## 3. Task Management Tests

### 3.1 Task Creation

| Test ID | TC-TASK-001 |
|---------|-------------|
| **Title** | Create task with required fields |
| **Priority** | High |
| **Preconditions** | User logged in |
| **Steps** | 1. Navigate to Tasks tab<br>2. Click "+ New Task"<br>3. Title: "Follow up call"<br>4. Type: Follow-up Call<br>5. Due Date: Tomorrow<br>6. Assign to self<br>7. Save |
| **Expected Result** | - Task created<br>- Appears in task list<br>- Due date visible |
| **Status** | |

| Test ID | TC-TASK-002 |
|---------|-------------|
| **Title** | Create task linked to lead |
| **Priority** | High |
| **Preconditions** | Lead exists |
| **Steps** | 1. Create task<br>2. Select lead from dropdown<br>3. Save |
| **Expected Result** | - Task linked to lead<br>- Task visible in lead timeline |
| **Status** | |

| Test ID | TC-TASK-003 |
|---------|-------------|
| **Title** | Create task with reminder |
| **Priority** | Medium |
| **Preconditions** | None |
| **Steps** | 1. Create task<br>2. Set reminder: 1 hour before<br>3. Save |
| **Expected Result** | - Reminder scheduled<br>- Notification sent at reminder time |
| **Status** | |

### 3.2 Task Filtering

| Test ID | TC-TASK-004 |
|---------|-------------|
| **Title** | Filter - My Tasks |
| **Priority** | High |
| **Preconditions** | Tasks assigned to multiple users |
| **Steps** | 1. Click "My Tasks" filter |
| **Expected Result** | - Only tasks assigned to current user shown |
| **Status** | |

| Test ID | TC-TASK-005 |
|---------|-------------|
| **Title** | Filter - Overdue Tasks |
| **Priority** | High |
| **Preconditions** | Overdue tasks exist |
| **Steps** | 1. Click "Overdue" filter |
| **Expected Result** | - Only overdue tasks shown<br>- Tasks highlighted in red |
| **Status** | |

| Test ID | TC-TASK-006 |
|---------|-------------|
| **Title** | Filter - Due Today |
| **Priority** | High |
| **Preconditions** | Tasks due today exist |
| **Steps** | 1. Click "Due Today" filter |
| **Expected Result** | - Only tasks due today shown |
| **Status** | |

### 3.3 Task Status Updates

| Test ID | TC-TASK-007 |
|---------|-------------|
| **Title** | Start task (PENDING → IN_PROGRESS) |
| **Priority** | High |
| **Preconditions** | Task in PENDING status |
| **Steps** | 1. Click "Start" button on task |
| **Expected Result** | - Status changes to IN_PROGRESS<br>- UI updates immediately |
| **Status** | |

| Test ID | TC-TASK-008 |
|---------|-------------|
| **Title** | Complete task |
| **Priority** | High |
| **Preconditions** | Task in progress |
| **Steps** | 1. Click "Complete" button<br>2. Add completion notes (optional) |
| **Expected Result** | - Status changes to COMPLETED<br>- Completion timestamp recorded<br>- Task moved/hidden based on view |
| **Status** | |

| Test ID | TC-TASK-009 |
|---------|-------------|
| **Title** | Cancel task |
| **Priority** | Medium |
| **Preconditions** | Task not completed |
| **Steps** | 1. Click "Cancel" button<br>2. Confirm |
| **Expected Result** | - Status changes to CANCELLED<br>- Task grayed out or hidden |
| **Status** | |

---

## 4. Campaign Tests

### 4.1 Campaign Creation

| Test ID | TC-CAMP-001 |
|---------|-------------|
| **Title** | Create campaign with required fields |
| **Priority** | High |
| **Preconditions** | User is HOSPITAL_ADMIN |
| **Steps** | 1. Navigate to Campaigns<br>2. Click "+ New Campaign"<br>3. Name: "Test Campaign"<br>4. Type: Promotion<br>5. Channel: SMS<br>6. Target: All leads<br>7. Save as Draft |
| **Expected Result** | - Campaign created in DRAFT status<br>- Appears in campaign list |
| **Status** | |

| Test ID | TC-CAMP-002 |
|---------|-------------|
| **Title** | Create campaign with template |
| **Priority** | High |
| **Preconditions** | SMS template exists |
| **Steps** | 1. Create campaign<br>2. Select existing template<br>3. Content auto-filled<br>4. Save |
| **Expected Result** | - Campaign created with template content |
| **Status** | |

| Test ID | TC-CAMP-003 |
|---------|-------------|
| **Title** | Create scheduled campaign |
| **Priority** | High |
| **Preconditions** | None |
| **Steps** | 1. Create campaign<br>2. Set schedule: Future date/time<br>3. Save |
| **Expected Result** | - Campaign status: SCHEDULED<br>- Schedule time displayed |
| **Status** | |

### 4.2 Campaign Launch & Control

| Test ID | TC-CAMP-004 |
|---------|-------------|
| **Title** | Launch campaign immediately |
| **Priority** | Critical |
| **Preconditions** | Campaign in DRAFT status |
| **Steps** | 1. Open campaign detail<br>2. Click "Launch Campaign"<br>3. Confirm |
| **Expected Result** | - Campaign status: RUNNING<br>- Messages start sending<br>- Sent count incrementing |
| **Status** | |

| Test ID | TC-CAMP-005 |
|---------|-------------|
| **Title** | Pause running campaign |
| **Priority** | High |
| **Preconditions** | Campaign RUNNING |
| **Steps** | 1. Click "Pause Campaign"<br>2. Confirm |
| **Expected Result** | - Status: PAUSED<br>- Sending stops<br>- Can resume later |
| **Status** | |

| Test ID | TC-CAMP-006 |
|---------|-------------|
| **Title** | Resume paused campaign |
| **Priority** | High |
| **Preconditions** | Campaign PAUSED |
| **Steps** | 1. Click "Resume"<br>2. Confirm |
| **Expected Result** | - Status: RUNNING<br>- Sending continues from where paused |
| **Status** | |

### 4.3 Campaign Analytics

| Test ID | TC-CAMP-007 |
|---------|-------------|
| **Title** | View campaign metrics |
| **Priority** | High |
| **Preconditions** | Campaign has been sent |
| **Steps** | 1. Click on campaign<br>2. View detail modal |
| **Expected Result** | - Metrics displayed: Sent, Delivered, Opened, Clicked, Responded, Failed, Converted<br>- Percentages calculated correctly |
| **Status** | |

| Test ID | TC-CAMP-008 |
|---------|-------------|
| **Title** | View campaign progress bar |
| **Priority** | Medium |
| **Preconditions** | Campaign running |
| **Steps** | 1. View campaign card |
| **Expected Result** | - Progress bar shows sent/total<br>- Updates in real-time |
| **Status** | |

---

## 5. Survey Tests

### 5.1 Survey Creation

| Test ID | TC-SURV-001 |
|---------|-------------|
| **Title** | Create basic survey |
| **Priority** | High |
| **Preconditions** | User is HOSPITAL_ADMIN |
| **Steps** | 1. Navigate to Surveys<br>2. Click "+ New Survey"<br>3. Name: "Patient Feedback"<br>4. Type: Post Visit<br>5. Add questions<br>6. Save |
| **Expected Result** | - Survey created<br>- Status: Active by default |
| **Status** | |

| Test ID | TC-SURV-002 |
|---------|-------------|
| **Title** | Create NPS survey |
| **Priority** | High |
| **Preconditions** | None |
| **Steps** | 1. Create survey<br>2. Type: NPS<br>3. Add NPS question (0-10 scale)<br>4. Save |
| **Expected Result** | - Survey created with NPS type<br>- NPS scoring enabled |
| **Status** | |

| Test ID | TC-SURV-003 |
|---------|-------------|
| **Title** | Create anonymous survey |
| **Priority** | Medium |
| **Preconditions** | None |
| **Steps** | 1. Create survey<br>2. Toggle "Anonymous" ON<br>3. Save |
| **Expected Result** | - Survey marked as anonymous<br>- Responses don't show patient names |
| **Status** | |

### 5.2 Survey Response Viewing

| Test ID | TC-SURV-004 |
|---------|-------------|
| **Title** | View survey responses |
| **Priority** | High |
| **Preconditions** | Survey has responses |
| **Steps** | 1. Click on survey card<br>2. View Responses tab |
| **Expected Result** | - All responses listed<br>- Each shows: respondent, rating, NPS, feedback, timestamp |
| **Status** | |

| Test ID | TC-SURV-005 |
|---------|-------------|
| **Title** | View survey analytics |
| **Priority** | High |
| **Preconditions** | Survey has responses |
| **Steps** | 1. Open survey detail<br>2. Switch to Analytics view |
| **Expected Result** | - Key metrics displayed<br>- Rating distribution chart<br>- NPS breakdown (Promoters/Passives/Detractors)<br>- Sentiment analysis |
| **Status** | |

| Test ID | TC-SURV-006 |
|---------|-------------|
| **Title** | Filter responses requiring follow-up |
| **Priority** | Medium |
| **Preconditions** | Responses with follow-up flag exist |
| **Steps** | 1. View responses<br>2. Filter by "Requires Follow-up" |
| **Expected Result** | - Only flagged responses shown |
| **Status** | |

---

## 6. Template Tests

### 6.1 Template CRUD

| Test ID | TC-TEMP-001 |
|---------|-------------|
| **Title** | Create email template |
| **Priority** | High |
| **Preconditions** | None |
| **Steps** | 1. Navigate to Templates<br>2. Click "+ New Template"<br>3. Channel: Email<br>4. Name: "Appointment Reminder"<br>5. Subject: "Your Appointment"<br>6. Content with variables<br>7. Save |
| **Expected Result** | - Template created<br>- Variables detected and listed |
| **Status** | |

| Test ID | TC-TEMP-002 |
|---------|-------------|
| **Title** | Create SMS template |
| **Priority** | High |
| **Preconditions** | None |
| **Steps** | 1. Create template<br>2. Channel: SMS<br>3. No subject (SMS)<br>4. Short content<br>5. Save |
| **Expected Result** | - SMS template created<br>- Subject field hidden/disabled |
| **Status** | |

| Test ID | TC-TEMP-003 |
|---------|-------------|
| **Title** | Create WhatsApp template |
| **Priority** | High |
| **Preconditions** | None |
| **Steps** | 1. Create template<br>2. Channel: WhatsApp<br>3. Add WhatsApp Template ID (optional)<br>4. Save |
| **Expected Result** | - WhatsApp template created |
| **Status** | |

| Test ID | TC-TEMP-004 |
|---------|-------------|
| **Title** | Edit existing template |
| **Priority** | High |
| **Preconditions** | Template exists |
| **Steps** | 1. Click Edit on template<br>2. Modify content<br>3. Save |
| **Expected Result** | - Template updated<br>- Usage count preserved |
| **Status** | |

| Test ID | TC-TEMP-005 |
|---------|-------------|
| **Title** | Delete template |
| **Priority** | Medium |
| **Preconditions** | Template exists, not used in active campaign |
| **Steps** | 1. Click Delete on template<br>2. Confirm |
| **Expected Result** | - Template deleted<br>- Removed from list |
| **Status** | |

### 6.2 Template Preview

| Test ID | TC-TEMP-006 |
|---------|-------------|
| **Title** | Preview template with sample data |
| **Priority** | High |
| **Preconditions** | Template with variables exists |
| **Steps** | 1. Click Preview on template |
| **Expected Result** | - Preview modal opens<br>- Variables replaced with sample data<br>- Formatting preserved |
| **Status** | |

---

## 7. Dashboard & Reports Tests

### 7.1 Dashboard Metrics

| Test ID | TC-DASH-001 |
|---------|-------------|
| **Title** | Dashboard loads with correct metrics |
| **Priority** | Critical |
| **Preconditions** | CRM data exists |
| **Steps** | 1. Navigate to CRM > Dashboard |
| **Expected Result** | - All stat cards load<br>- Numbers match database<br>- No loading errors |
| **Status** | |

| Test ID | TC-DASH-002 |
|---------|-------------|
| **Title** | Pipeline funnel displays correctly |
| **Priority** | High |
| **Preconditions** | Leads in various statuses |
| **Steps** | 1. View Dashboard<br>2. Check Pipeline Funnel section |
| **Expected Result** | - All stages shown<br>- Counts accurate<br>- Percentages calculated<br>- Funnel visualization correct |
| **Status** | |

| Test ID | TC-DASH-003 |
|---------|-------------|
| **Title** | NPS gauge displays correctly |
| **Priority** | High |
| **Preconditions** | Survey responses with NPS exist |
| **Steps** | 1. View NPS card on Dashboard |
| **Expected Result** | - Circular gauge shows NPS score<br>- Color coding: Green (50+), Blue (0-49), Amber (-50 to -1), Red (<-50)<br>- Promoters/Passives/Detractors breakdown shown |
| **Status** | |

| Test ID | TC-DASH-004 |
|---------|-------------|
| **Title** | Leads by Source chart |
| **Priority** | High |
| **Preconditions** | Leads from multiple sources |
| **Steps** | 1. View "Leads by Source" on Dashboard |
| **Expected Result** | - All sources listed<br>- Counts and percentages shown<br>- Progress bars proportional |
| **Status** | |

| Test ID | TC-DASH-005 |
|---------|-------------|
| **Title** | Activity Overview metrics |
| **Priority** | Medium |
| **Preconditions** | Tasks and communications exist |
| **Steps** | 1. View Activity Overview card |
| **Expected Result** | - Open Tasks count<br>- Overdue Tasks count (highlighted if > 0)<br>- Completed Today count<br>- Communications Today count |
| **Status** | |

| Test ID | TC-DASH-006 |
|---------|-------------|
| **Title** | Recent Leads list |
| **Priority** | Medium |
| **Preconditions** | Recent leads exist |
| **Steps** | 1. View Recent Leads section |
| **Expected Result** | - Last 5 leads shown<br>- Name, source, status visible<br>- Most recent first |
| **Status** | |

| Test ID | TC-DASH-007 |
|---------|-------------|
| **Title** | Overdue Tasks warning |
| **Priority** | High |
| **Preconditions** | Overdue tasks exist |
| **Steps** | 1. View Overdue Tasks section |
| **Expected Result** | - Section highlighted in red/warning<br>- Overdue tasks listed<br>- Due dates shown |
| **Status** | |

### 7.2 Reports Tab

| Test ID | TC-REPT-001 |
|---------|-------------|
| **Title** | Reports tab loads correctly |
| **Priority** | High |
| **Preconditions** | CRM data exists |
| **Steps** | 1. Navigate to CRM > Reports |
| **Expected Result** | - Summary stats displayed<br>- Conversion trend chart renders<br>- Source performance shows<br>- Available reports listed |
| **Status** | |

| Test ID | TC-REPT-002 |
|---------|-------------|
| **Title** | Lead Conversion Trend chart |
| **Priority** | High |
| **Preconditions** | Lead data exists |
| **Steps** | 1. View conversion trend chart |
| **Expected Result** | - Monthly bars displayed<br>- Leads vs Converted comparison<br>- Legend visible<br>- Tooltips work |
| **Status** | |

| Test ID | TC-REPT-003 |
|---------|-------------|
| **Title** | Export report functionality |
| **Priority** | Medium |
| **Preconditions** | Report data available |
| **Steps** | 1. Click Export button on report |
| **Expected Result** | - Export options shown (PDF/Excel)<br>- File downloads successfully |
| **Status** | |

---

## 8. Integration Tests

### 8.1 Lead to Patient Conversion

| Test ID | TC-INT-001 |
|---------|-------------|
| **Title** | Converted lead creates patient record |
| **Priority** | Critical |
| **Preconditions** | Lead ready for conversion |
| **Steps** | 1. Convert lead to patient<br>2. Check Patients module |
| **Expected Result** | - Patient record exists<br>- Data matches lead info<br>- Lead linked via convertedToPatientId |
| **Status** | |

### 8.2 Communication Integration

| Test ID | TC-INT-002 |
|---------|-------------|
| **Title** | SMS sending via AWS SNS |
| **Priority** | High |
| **Preconditions** | AWS SNS configured |
| **Steps** | 1. Send SMS communication<br>2. Check delivery status |
| **Expected Result** | - SMS sent successfully<br>- Status updates to DELIVERED<br>- External message ID stored |
| **Status** | |

| Test ID | TC-INT-003 |
|---------|-------------|
| **Title** | Email sending via AWS SES |
| **Priority** | High |
| **Preconditions** | AWS SES configured |
| **Steps** | 1. Send email communication<br>2. Check delivery status |
| **Expected Result** | - Email sent successfully<br>- Delivery tracked |
| **Status** | |

| Test ID | TC-INT-004 |
|---------|-------------|
| **Title** | WhatsApp sending via Twilio |
| **Priority** | High |
| **Preconditions** | Twilio configured |
| **Steps** | 1. Send WhatsApp message<br>2. Check delivery |
| **Expected Result** | - Message sent via Twilio<br>- Status updates |
| **Status** | |

### 8.3 Appointment Integration

| Test ID | TC-INT-005 |
|---------|-------------|
| **Title** | Schedule appointment from lead |
| **Priority** | High |
| **Preconditions** | Lead exists, doctors available |
| **Steps** | 1. From lead detail, click Schedule Appointment<br>2. Complete booking |
| **Expected Result** | - Appointment created<br>- Lead status: APPOINTMENT_SCHEDULED<br>- Activity logged |
| **Status** | |

---

## 9. Performance Tests

| Test ID | TC-PERF-001 |
|---------|-------------|
| **Title** | Dashboard load time |
| **Priority** | High |
| **Preconditions** | 1000+ leads, 500+ tasks |
| **Steps** | 1. Navigate to Dashboard<br>2. Measure load time |
| **Expected Result** | - Page loads < 3 seconds<br>- No UI blocking |
| **Status** | |

| Test ID | TC-PERF-002 |
|---------|-------------|
| **Title** | Leads list with 500+ records |
| **Priority** | High |
| **Preconditions** | 500+ leads |
| **Steps** | 1. Load Leads tab<br>2. Scroll through list |
| **Expected Result** | - Pagination working<br>- No lag on scroll<br>- Kanban performs smoothly |
| **Status** | |

| Test ID | TC-PERF-003 |
|---------|-------------|
| **Title** | Search performance |
| **Priority** | Medium |
| **Preconditions** | Large dataset |
| **Steps** | 1. Enter search term<br>2. Measure response time |
| **Expected Result** | - Results appear < 500ms<br>- Debounce working |
| **Status** | |

| Test ID | TC-PERF-004 |
|---------|-------------|
| **Title** | Kanban drag performance |
| **Priority** | Medium |
| **Preconditions** | 50+ leads per column |
| **Steps** | 1. Drag card between columns<br>2. Observe performance |
| **Expected Result** | - Smooth drag animation<br>- No frame drops<br>- Instant status update |
| **Status** | |

---

## 10. Security Tests

| Test ID | TC-SEC-001 |
|---------|-------------|
| **Title** | Unauthorized access - No token |
| **Priority** | Critical |
| **Preconditions** | Not logged in |
| **Steps** | 1. Call CRM API without token |
| **Expected Result** | - 401 Unauthorized<br>- No data exposed |
| **Status** | |

| Test ID | TC-SEC-002 |
|---------|-------------|
| **Title** | Role-based access - Receptionist |
| **Priority** | High |
| **Preconditions** | Logged in as RECEPTIONIST |
| **Steps** | 1. Attempt to delete lead<br>2. Attempt to launch campaign |
| **Expected Result** | - Delete: Forbidden<br>- Campaign launch: Forbidden |
| **Status** | |

| Test ID | TC-SEC-003 |
|---------|-------------|
| **Title** | Hospital isolation (multi-tenant) |
| **Priority** | Critical |
| **Preconditions** | Two hospitals exist |
| **Steps** | 1. Login as Hospital A admin<br>2. Attempt to access Hospital B leads |
| **Expected Result** | - Only Hospital A data visible<br>- Hospital B data inaccessible |
| **Status** | |

| Test ID | TC-SEC-004 |
|---------|-------------|
| **Title** | XSS prevention in lead notes |
| **Priority** | High |
| **Preconditions** | None |
| **Steps** | 1. Create lead with script in notes: `<script>alert('xss')</script>`<br>2. View lead detail |
| **Expected Result** | - Script not executed<br>- Content escaped/sanitized |
| **Status** | |

| Test ID | TC-SEC-005 |
|---------|-------------|
| **Title** | SQL injection prevention |
| **Priority** | Critical |
| **Preconditions** | None |
| **Steps** | 1. Search with SQL injection: `' OR '1'='1`<br>2. Create lead with injection in fields |
| **Expected Result** | - No SQL injection<br>- Query properly parameterized |
| **Status** | |

---

## Test Summary Template

| Category | Total | Passed | Failed | Blocked | Not Run |
|----------|-------|--------|--------|---------|---------|
| Lead Management | 22 | | | | |
| Communication | 6 | | | | |
| Task Management | 9 | | | | |
| Campaign | 8 | | | | |
| Survey | 6 | | | | |
| Template | 6 | | | | |
| Dashboard & Reports | 10 | | | | |
| Integration | 5 | | | | |
| Performance | 4 | | | | |
| Security | 5 | | | | |
| **TOTAL** | **81** | | | | |

---

## Defect Tracking

| Defect ID | Test Case | Severity | Description | Status |
|-----------|-----------|----------|-------------|--------|
| | | | | |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Dev Lead | | | |
| Product Owner | | | |

---

*Document Version: 1.0*
*Last Updated: January 2024*
*Total Test Cases: 81*
