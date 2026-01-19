# CRM Module - User Journey Documentation

## Overview

This document outlines the complete user journeys for the Hospital CRM (Customer Relationship Management) module. The CRM helps hospital administrators and staff manage patient relationships, track leads, monitor communications, run marketing campaigns, and analyze engagement metrics.

---

## User Personas

### 1. Hospital Admin
- **Role**: HOSPITAL_ADMIN
- **Responsibilities**: Full CRM management, campaign approval, report analysis, settings configuration
- **Access**: All CRM features

### 2. Receptionist
- **Role**: RECEPTIONIST
- **Responsibilities**: Lead entry, communication logging, task management, basic reporting
- **Access**: Leads, Communications, Tasks, limited Campaigns

### 3. Marketing Staff
- **Role**: HOSPITAL_ADMIN (with marketing focus)
- **Responsibilities**: Campaign creation, survey management, analytics review
- **Access**: Campaigns, Surveys, Templates, Reports

---

## User Journey 1: Lead Management Lifecycle

### Scenario: Converting a Website Inquiry to Patient

**Actor**: Receptionist

#### Step 1: Lead Entry
1. Navigate to **CRM** from the sidebar menu
2. Click on the **Leads** tab
3. Click **+ New Lead** button
4. Fill in the lead form:
   - First Name: "Ahmed"
   - Last Name: "Al-Rashid"
   - Phone: "+966 55 123 4567"
   - Email: "ahmed@example.com"
   - Source: "Website"
   - Interested In: "Cardiology Consultation"
   - Priority: "High"
   - Notes: "Requested information about heart checkup packages"
5. Click **Create Lead**
6. System generates lead number (e.g., "LEAD-2024-0001")

#### Step 2: Initial Contact
1. Lead appears in **NEW** column on Kanban board
2. Click on lead card to open detail modal
3. Click **Log Communication** button
4. Select channel: "Phone Call"
5. Enter notes: "Called patient, discussed cardiology packages. Patient interested in comprehensive heart checkup."
6. Set outcome: "Interested"
7. Schedule follow-up: Tomorrow at 10:00 AM
8. Save communication
9. Lead score increases based on engagement

#### Step 3: Lead Qualification
1. Drag lead card from **NEW** to **CONTACTED** column
2. After positive follow-up, drag to **QUALIFIED** column
3. Create a task: "Schedule cardiology consultation"
4. Assign task to self
5. Set due date and priority

#### Step 4: Appointment Scheduling
1. From lead detail, click **Schedule Appointment**
2. Select department: Cardiology
3. Choose available doctor and time slot
4. Confirm booking
5. System automatically:
   - Updates lead status to **APPOINTMENT_SCHEDULED**
   - Logs activity in timeline
   - Sends confirmation SMS/WhatsApp to patient

#### Step 5: Lead Conversion
1. After successful consultation, open lead detail
2. Click **Convert to Patient** button
3. Review/edit patient information
4. Click **Convert**
5. System creates patient record
6. Lead status changes to **CONVERTED**
7. Lead card moves to green "Converted" column
8. Activity logged: "Lead converted to patient"

#### Expected Outcomes:
- New patient record created with linked history
- Lead timeline shows complete journey
- Conversion metrics updated on dashboard
- Source (Website) attributed for ROI tracking

---

## User Journey 2: Marketing Campaign Execution

### Scenario: Health Camp Promotion Campaign

**Actor**: Hospital Admin / Marketing Staff

#### Step 1: Campaign Planning
1. Navigate to **CRM > Campaigns** tab
2. Click **+ New Campaign**
3. Fill campaign details:
   - Name: "Summer Health Camp 2024"
   - Type: "Health Camp"
   - Description: "Free health checkup camp for senior citizens"
   - Channel: "WhatsApp"
   - Target Audience: Age 60+, Previous patients

#### Step 2: Template Selection
1. Go to **Templates** tab
2. Create or select existing template:
   - Name: "Health Camp Invitation"
   - Channel: WhatsApp
   - Content: "Dear {{patient_name}}, You're invited to our FREE Summer Health Camp on {{date}}. Services include: BP check, Sugar test, ECG. Reply YES to register."
   - Variables: patient_name, date
3. Preview template with sample data

#### Step 3: Audience Selection
1. Return to campaign creation
2. Define target criteria:
   - Age: 60 and above
   - Last visit: Within 12 months
   - Location: Within 20km radius
3. System calculates: "245 eligible recipients"
4. Review sample of recipients

#### Step 4: Campaign Review & Launch
1. Set budget (optional): SAR 500
2. Schedule: "Send immediately" or specific date/time
3. Click **Save as Draft**
4. Review campaign summary
5. Click **Launch Campaign**
6. Confirm launch

#### Step 5: Monitor Campaign
1. View campaign in list with status "RUNNING"
2. Click campaign to see real-time metrics:
   - Sent: 245
   - Delivered: 238 (97%)
   - Read: 189 (77%)
   - Responded: 67 (27%)
3. View response breakdown:
   - "YES" responses: 52
   - Questions: 15

#### Step 6: Analyze Results
1. After campaign completion, view analytics:
   - Total registrations: 52
   - Actual attendance: 45
   - Conversions (became patients): 12
   - ROI calculation
2. Export report for management

#### Expected Outcomes:
- 52 health camp registrations
- 12 new patient conversions
- Campaign ROI data for future planning
- Template effectiveness metrics

---

## User Journey 3: Patient Feedback Collection

### Scenario: Post-Visit Satisfaction Survey

**Actor**: Hospital Admin

#### Step 1: Survey Creation
1. Navigate to **CRM > Surveys** tab
2. Click **+ New Survey**
3. Configure survey:
   - Name: "Post-Visit Feedback"
   - Type: "Post Visit"
   - Anonymous: No
   - Trigger: "After appointment completion"
   - Delay: "2 hours after visit"

#### Step 2: Question Design
1. Add questions:
   - Q1: "How would you rate your overall experience?" (Rating 1-5)
   - Q2: "How likely are you to recommend us?" (NPS 0-10)
   - Q3: "What did you like most about your visit?" (Multiple choice)
   - Q4: "Any suggestions for improvement?" (Text)
2. Set required fields
3. Save survey

#### Step 3: Survey Activation
1. Toggle survey to **Active**
2. Survey automatically triggers after appointments
3. Patients receive WhatsApp/SMS with survey link

#### Step 4: Response Monitoring
1. View survey card showing:
   - Total responses: 156
   - Average rating: 4.3/5
   - NPS Score: 42
2. Click **View Responses**
3. Review individual responses
4. Flag responses requiring follow-up

#### Step 5: Analytics Review
1. Switch to **Analytics** view
2. Review metrics:
   - Rating distribution (5-star breakdown)
   - NPS breakdown (Promoters/Passives/Detractors)
   - Sentiment analysis (Positive/Neutral/Negative)
   - Common themes in feedback
3. Identify areas for improvement

#### Step 6: Follow-up Actions
1. Filter responses with "Follow-up Required"
2. For each:
   - Create task for staff to contact patient
   - Log resolution in system
   - Update follow-up status

#### Expected Outcomes:
- Continuous patient feedback collection
- NPS trend tracking over time
- Actionable insights for service improvement
- Patient concerns addressed promptly

---

## User Journey 4: Task & Follow-up Management

### Scenario: Managing Daily CRM Tasks

**Actor**: Receptionist

#### Step 1: Morning Review
1. Navigate to **CRM > Tasks** tab
2. View task filters:
   - **My Tasks**: 8 tasks assigned to me
   - **Due Today**: 3 tasks due today
   - **Overdue**: 1 overdue task
3. Click **Due Today** filter

#### Step 2: Process Overdue Task
1. Click on overdue task (highlighted in red)
2. Task: "Follow up with Mrs. Fatima about lab results"
3. Click **Start** to mark as in progress
4. Make phone call to patient
5. Log communication with outcome
6. Click **Complete** with notes: "Patient informed, scheduled follow-up appointment"

#### Step 3: Handle Today's Tasks
1. Task 1: "Send appointment reminder to Ahmed"
   - Click task to view details
   - Click **Send Reminder** (uses template)
   - Mark as complete

2. Task 2: "Collect feedback from yesterday's patients"
   - View list of patients
   - Send survey links
   - Mark as complete

3. Task 3: "Call back website inquiry"
   - View lead details
   - Make call and log outcome
   - Update lead status
   - Mark as complete

#### Step 4: Create New Tasks
1. Click **+ New Task**
2. Fill details:
   - Title: "Follow up on insurance query"
   - Type: "Follow-up Call"
   - Lead/Patient: Select from list
   - Due Date: Tomorrow
   - Priority: Medium
   - Assign to: Self or colleague
3. Save task

#### Step 5: End of Day Review
1. Check all tasks completed
2. View tomorrow's scheduled tasks
3. Review any auto-generated tasks from system

#### Expected Outcomes:
- All daily tasks completed and logged
- No follow-ups missed
- Patient communication history maintained
- Workload visible and manageable

---

## User Journey 5: CRM Analytics & Reporting

### Scenario: Monthly Performance Review

**Actor**: Hospital Admin

#### Step 1: Dashboard Overview
1. Navigate to **CRM > Dashboard**
2. Review key metrics:
   - Total Leads: 156
   - New This Month: 43
   - Conversion Rate: 28%
   - Avg NPS: 45

#### Step 2: Pipeline Analysis
1. View Lead Pipeline Funnel:
   - New: 25 leads
   - Contacted: 18 leads
   - Qualified: 12 leads
   - Scheduled: 8 leads
   - Converted: 5 leads
2. Identify bottlenecks (e.g., high drop-off at Qualified stage)

#### Step 3: Source Performance
1. Review "Leads by Source" chart:
   - Website: 45 leads (29%)
   - Referral: 38 leads (24%)
   - Walk-in: 28 leads (18%)
   - Social Media: 25 leads (16%)
   - Others: 20 leads (13%)
2. Note: Website has highest volume but lower conversion
3. Referrals have highest conversion rate

#### Step 4: Generate Reports
1. Go to **Reports** tab
2. View conversion trend chart (6-month trend)
3. Select "Lead Conversion Report"
4. Set date range: Last 30 days
5. Click **Generate Report**
6. Review detailed metrics:
   - Conversion by source
   - Avg time to convert
   - Staff performance
7. Export as PDF/Excel

#### Step 5: Actionable Insights
1. Review "Available Reports":
   - Staff Performance Report
   - ROI by Source Report
   - Survey Insights Report
2. Generate each for management meeting
3. Identify:
   - Top performing staff
   - Best ROI channels
   - Areas needing improvement

#### Step 6: Strategy Adjustments
1. Based on insights:
   - Increase referral program incentives
   - Improve website inquiry response time
   - Train staff on qualification process
2. Document decisions for follow-up

#### Expected Outcomes:
- Clear visibility into CRM performance
- Data-driven decisions for improvement
- ROI tracking by marketing channel
- Staff accountability metrics

---

## User Journey 6: Communication Template Management

### Scenario: Creating Multi-Channel Templates

**Actor**: Hospital Admin

#### Step 1: Template Audit
1. Navigate to **CRM > Templates**
2. Review existing templates by channel:
   - Email: 5 templates
   - SMS: 3 templates
   - WhatsApp: 4 templates
3. Identify gaps in communication flow

#### Step 2: Create New Template
1. Click **+ New Template**
2. Select channel: Email
3. Fill template details:
   - Name: "Appointment Confirmation"
   - Category: "Appointment Reminder"
   - Subject: "Your Appointment at {{hospital_name}}"
   - Content:
     ```
     Dear {{patient_name}},

     Your appointment has been confirmed:

     Date: {{appointment_date}}
     Time: {{appointment_time}}
     Doctor: {{doctor_name}}
     Department: {{department}}

     Please arrive 15 minutes early.

     For rescheduling, call: {{hospital_phone}}
     ```
4. Define variables: patient_name, hospital_name, appointment_date, etc.

#### Step 3: Preview & Test
1. Click **Preview** button
2. System shows template with sample data
3. Verify formatting and personalization
4. Send test email to self

#### Step 4: Activate Template
1. Toggle template to Active
2. Template available for:
   - Manual sending
   - Campaign selection
   - Automated triggers

#### Step 5: Monitor Usage
1. View template list
2. Check usage count per template
3. Identify underused templates
4. Archive outdated templates

#### Expected Outcomes:
- Consistent professional communication
- Reduced manual typing errors
- Faster response times
- Brand-consistent messaging

---

## Quick Reference: CRM Navigation

| Tab | Primary Actions | Key Features |
|-----|-----------------|--------------|
| Dashboard | View metrics, Monitor KPIs | Pipeline funnel, NPS gauge, Activity overview |
| Leads | Manage prospects | Kanban board, Table view, Lead scoring |
| Communications | Log interactions | Multi-channel logging, History view |
| Tasks | Manage follow-ups | Filters, Assignment, Status tracking |
| Campaigns | Run marketing | Launch, Pause, Analytics |
| Surveys | Collect feedback | Question builder, Response analytics |
| Templates | Manage messages | Multi-channel, Variables, Preview |
| Reports | Analyze performance | Charts, Export, ROI tracking |

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Lead | `N` then `L` |
| New Task | `N` then `T` |
| Search | `/` or `Ctrl+K` |
| Switch to Kanban | `K` |
| Switch to Table | `T` |
| Refresh Data | `R` |

---

## Best Practices

1. **Lead Management**
   - Respond to new leads within 1 hour
   - Update lead status after every interaction
   - Use tags for categorization
   - Set follow-up reminders

2. **Communication**
   - Always log communications immediately
   - Use templates for consistency
   - Personalize where possible
   - Track preferred contact channel

3. **Task Management**
   - Review tasks at start of day
   - Complete overdue tasks first
   - Set realistic due dates
   - Add detailed notes

4. **Campaigns**
   - A/B test message content
   - Segment audiences carefully
   - Monitor in real-time
   - Analyze results within 48 hours

5. **Surveys**
   - Keep surveys short (5 questions max)
   - Act on negative feedback within 24 hours
   - Track NPS trends monthly
   - Share insights with staff

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Lead not showing in Kanban | Check status filter, refresh page |
| Communication not sending | Verify channel credentials in settings |
| Survey not triggering | Check trigger conditions and delay settings |
| Campaign stuck in Draft | Ensure template is selected and audience defined |
| Reports not loading | Clear cache, check date range selection |

---

*Document Version: 1.0*
*Last Updated: January 2024*
*Module Version: Phase 5 Complete*
