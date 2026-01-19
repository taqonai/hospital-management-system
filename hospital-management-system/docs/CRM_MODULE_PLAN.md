# CRM Module Implementation Plan

## Hospital Management System - Customer Relationship Management

**Version:** 1.0
**Date:** January 2026
**Status:** Planned

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Module Overview](#module-overview)
3. [Features](#features)
4. [Database Schema](#database-schema)
5. [Backend Architecture](#backend-architecture)
6. [Frontend Architecture](#frontend-architecture)
7. [API Endpoints](#api-endpoints)
8. [Integration Points](#integration-points)
9. [Implementation Phases](#implementation-phases)
10. [Technical Specifications](#technical-specifications)

---

## Executive Summary

The CRM (Customer Relationship Management) module is a comprehensive solution for Hospital Admin users to manage patient relationships, track leads/inquiries, monitor communications, run marketing campaigns, and analyze engagement metrics.

### Key Objectives

- **Lead Management**: Track potential patients from inquiry to conversion
- **Communication Hub**: Centralized logging of all patient/lead interactions
- **Task Management**: Assign and track follow-up activities
- **Campaign Management**: Run targeted marketing campaigns
- **Survey & Feedback**: Collect patient feedback and NPS scores
- **Analytics**: Measure conversion rates, ROI, and engagement

### Access Roles

| Role | Access Level |
|------|--------------|
| SUPER_ADMIN | Full access |
| HOSPITAL_ADMIN | Full access |
| RECEPTIONIST | Lead management, communications, tasks |

---

## Module Overview

### Design Theme

- **Color Scheme**: Purple/Violet gradient (`from-purple-500 to-violet-600`)
- **UI Pattern**: Glassmorphism (consistent with existing modules)
- **Layout**: Tab-based interface with 6 main sections

### Navigation

The CRM module will be accessible from the sidebar under the **Operations** group.

```
Operations
├── Billing
├── Insurance Coding
├── CRM  ← New module
├── HR
└── ...
```

---

## Features

### 1. Lead Management

**Purpose**: Track potential patients from initial inquiry through conversion.

#### Lead Pipeline (Kanban Board)

```
┌──────────┐   ┌───────────┐   ┌───────────┐   ┌─────────────────────┐   ┌───────────┐   ┌────────┐
│   NEW    │ → │ CONTACTED │ → │ QUALIFIED │ → │ APPOINTMENT_SCHEDULED│ → │ CONVERTED │   │  LOST  │
│ (Purple) │   │  (Blue)   │   │  (Amber)  │   │       (Cyan)        │   │  (Green)  │   │ (Gray) │
└──────────┘   └───────────┘   └───────────┘   └─────────────────────┘   └───────────┘   └────────┘
```

#### Lead Card Information

- Name & Contact Details
- Lead Source (Website, Phone, Referral, etc.)
- Lead Score (0-100)
- Assigned Staff Member
- Next Follow-up Date
- Tags/Categories

#### Lead Sources

| Source | Description |
|--------|-------------|
| WEBSITE | Online inquiry form |
| PHONE_CALL | Telephone inquiry |
| WALK_IN | In-person visit |
| REFERRAL_PATIENT | Referred by existing patient |
| REFERRAL_DOCTOR | Referred by external doctor |
| SOCIAL_MEDIA | Facebook, Instagram, etc. |
| GOOGLE_ADS | Google advertising |
| WHATSAPP | WhatsApp inquiry |
| EMAIL_INQUIRY | Email inquiry |
| HEALTH_CAMP | Health camp registration |
| CORPORATE | Corporate partnership |
| OTHER | Other sources |

#### Lead Scoring Algorithm

```
Lead Score (0-100) = Source Quality + Engagement + Response Rate + Recency + Interest Signals

Source Quality (0-20):
  - Referral Doctor: 20
  - Referral Patient: 18
  - Website: 15
  - Phone Call: 12
  - Walk-in: 10
  - Social Media: 8
  - Other: 5

Engagement (0-30):
  - +3 points per communication (max 30)

Response Rate (0-20):
  - (Responded / Total Communications) × 20

Recency (0-15):
  - Last contact < 7 days: 15
  - Last contact < 14 days: 10
  - Last contact < 30 days: 5

Interest Signals (0-15):
  - Has interested services: +5
  - Has preferred doctor: +5
  - Has preferred date: +5
```

### 2. Communication Management

**Purpose**: Track all interactions with leads and patients.

#### Communication Channels

| Channel | Integration |
|---------|-------------|
| Phone Call | Manual logging |
| Email | AWS SES (existing) |
| SMS | AWS SNS (existing) |
| WhatsApp | Twilio (existing) |
| In-Person | Manual logging |
| Video Call | Manual logging |

#### Communication Features

- **Logging**: Record all inbound/outbound communications
- **Templates**: Pre-defined message templates for common scenarios
- **Scheduling**: Schedule future communications
- **Tracking**: Delivery status (Sent, Delivered, Read, Responded)

#### Template Categories

- Appointment Reminder
- Follow-up
- Welcome
- Feedback Request
- Promotion
- Health Tip
- Birthday Greeting
- Custom

### 3. Task Management

**Purpose**: Track follow-up activities and assignments.

#### Task Types

| Type | Description |
|------|-------------|
| FOLLOW_UP_CALL | Call the lead/patient |
| FOLLOW_UP_EMAIL | Send follow-up email |
| FOLLOW_UP_VISIT | Schedule in-person visit |
| APPOINTMENT_SCHEDULING | Book an appointment |
| DOCUMENT_COLLECTION | Collect required documents |
| FEEDBACK_COLLECTION | Request feedback |
| PAYMENT_REMINDER | Send payment reminder |
| CUSTOM | Custom task type |

#### Task Workflow

```
┌─────────┐   ┌─────────────┐   ┌───────────┐   ┌───────────┐
│ PENDING │ → │ IN_PROGRESS │ → │ COMPLETED │   │ CANCELLED │
└─────────┘   └─────────────┘   └───────────┘   └───────────┘
                    ↓
              ┌─────────┐
              │ OVERDUE │ (Auto-set when past due date)
              └─────────┘
```

#### Task Views

- **My Tasks**: Tasks assigned to current user
- **All Tasks**: All tasks (admin view)
- **Overdue Tasks**: Tasks past due date
- **Today's Tasks**: Tasks due today

### 4. Campaign Management

**Purpose**: Run targeted marketing campaigns.

#### Campaign Types

| Type | Use Case |
|------|----------|
| HEALTH_CAMP | Health camp promotions |
| PROMOTION | Discounts, offers |
| AWARENESS | Health awareness campaigns |
| SEASONAL | Flu shots, checkups |
| FOLLOW_UP | Re-engage inactive patients |
| RE_ENGAGEMENT | Win-back campaigns |
| BIRTHDAY | Birthday greetings |
| FEEDBACK | Feedback requests |

#### Campaign Workflow

```
┌───────┐   ┌───────────┐   ┌─────────┐   ┌───────────┐
│ DRAFT │ → │ SCHEDULED │ → │ RUNNING │ → │ COMPLETED │
└───────┘   └───────────┘   └─────────┘   └───────────┘
                 ↓               ↓
            ┌───────────┐   ┌────────┐
            │ CANCELLED │   │ PAUSED │
            └───────────┘   └────────┘
```

#### Campaign Metrics

- **Total Recipients**: Target audience size
- **Sent Count**: Messages sent
- **Delivered Count**: Messages delivered
- **Opened Count**: Messages opened (email)
- **Clicked Count**: Links clicked
- **Responded Count**: Responses received
- **Converted Count**: Leads converted
- **Failed Count**: Delivery failures

#### Audience Targeting

```json
{
  "contactTypes": ["PATIENT", "LEAD"],
  "ageRange": { "min": 30, "max": 60 },
  "gender": ["MALE", "FEMALE"],
  "lastVisit": { "within": 90 },
  "conditions": ["diabetes", "hypertension"],
  "departments": ["cardiology", "endocrinology"],
  "engagementScore": { "min": 50 },
  "tags": ["VIP", "Corporate"],
  "excludeTags": ["do-not-contact"],
  "doNotMarket": false
}
```

### 5. Survey & Feedback

**Purpose**: Collect patient feedback and measure satisfaction.

#### Survey Types

| Type | Trigger |
|------|---------|
| POST_VISIT | After OPD appointment |
| POST_DISCHARGE | After IPD discharge |
| NPS | Net Promoter Score |
| CSAT | Customer Satisfaction |
| SERVICE_QUALITY | Service quality assessment |
| DOCTOR_FEEDBACK | Doctor-specific feedback |

#### Survey Features

- **Question Types**: Rating, Multiple Choice, Text, NPS (0-10)
- **Auto-Trigger**: Automatically send after appointments
- **Anonymous Option**: Allow anonymous responses
- **Follow-up Tracking**: Flag responses requiring attention
- **Sentiment Analysis**: Categorize as Positive/Neutral/Negative

#### NPS Calculation

```
NPS = % Promoters (9-10) - % Detractors (0-6)

Promoters: Score 9-10 (Loyal enthusiasts)
Passives: Score 7-8 (Satisfied but unenthusiastic)
Detractors: Score 0-6 (Unhappy customers)
```

### 6. Analytics Dashboard

**Purpose**: Visualize CRM metrics and performance.

#### Dashboard Metrics

| Metric | Description |
|--------|-------------|
| Total Leads | All leads in pipeline |
| New Leads (This Month) | Leads created this month |
| Conversion Rate | Leads converted to patients |
| Avg. Lead Score | Average score of active leads |
| Open Tasks | Pending tasks |
| Overdue Tasks | Past-due tasks |
| Active Campaigns | Running campaigns |
| Avg. NPS Score | Net Promoter Score |

#### Charts & Visualizations

- **Lead Pipeline Funnel**: Conversion through stages
- **Leads by Source**: Pie chart of lead sources
- **Lead Trend**: Line chart of leads over time
- **Conversion by Source**: ROI analysis
- **Task Completion Rate**: Staff performance
- **NPS Trend**: NPS over time
- **Communication Volume**: Messages sent by channel

---

## Database Schema

### Entity Relationship Diagram

```
┌────────────────┐       ┌────────────────┐       ┌────────────────┐
│    Hospital    │       │     CRMLead    │       │    Patient     │
├────────────────┤       ├────────────────┤       ├────────────────┤
│ id             │◄──────│ hospitalId     │       │ id             │
│ name           │       │ leadNumber     │───────►│ name           │
└────────────────┘       │ status         │       └────────────────┘
        │                │ source         │               ▲
        │                │ assignedToId   │───────┐       │
        │                │ score          │       │       │
        │                └────────────────┘       │       │
        │                        │                │       │
        │                        │                │       │
        │                ┌───────▼────────┐       │       │
        │                │  CRMActivity   │       │       │
        │                ├────────────────┤       │       │
        │                │ leadId         │       │       │
        │                │ activityType   │       │       │
        │                │ performedById  │───────┼───────┤
        │                └────────────────┘       │       │
        │                                         │       │
        │                ┌────────────────┐       │       │
        │                │CRMCommunication│       │       │
        │                ├────────────────┤       │       │
        │                │ leadId         │       │       │
        │                │ patientId      │───────┼───────┘
        │                │ channel        │       │
        │                │ initiatedById  │───────┤
        │                │ campaignId     │───┐   │
        │                └────────────────┘   │   │
        │                                     │   │
        │                ┌────────────────┐   │   │
        │                │   CRMCampaign  │◄──┘   │
        │                ├────────────────┤       │
        │                │ hospitalId     │       │
        │                │ status         │       │
        │                │ createdById    │───────┤
        │                └────────────────┘       │
        │                                         │
        │                ┌────────────────┐       │
        │                │    CRMTask     │       │
        │                ├────────────────┤       │
        │                │ leadId         │       │
        │                │ assignedToId   │───────┤
        │                │ assignedById   │───────┘
        │                │ status         │
        │                └────────────────┘
        │
        │                ┌────────────────┐
        │                │   CRMSurvey    │
        │                ├────────────────┤
        └───────────────►│ hospitalId     │
                         │ surveyType     │
                         └────────────────┘
                                 │
                         ┌───────▼────────┐
                         │CRMSurveyResponse│
                         ├────────────────┤
                         │ surveyId       │
                         │ patientId      │
                         │ npsScore       │
                         └────────────────┘
```

### Models Summary

| Model | Purpose | Key Fields |
|-------|---------|------------|
| CRMLead | Lead/inquiry tracking | status, source, score, assignedToId |
| CRMCommunication | Communication logs | channel, direction, status, templateId |
| CRMTemplate | Message templates | channel, category, content, variables |
| CRMActivity | Activity timeline | activityType, performedById, leadId |
| CRMTask | Task management | taskType, status, assignedToId, dueDate |
| CRMCampaign | Marketing campaigns | campaignType, status, metrics |
| CRMSurvey | Feedback surveys | surveyType, questions, isActive |
| CRMSurveyResponse | Survey responses | answers, npsScore, sentiment |
| CRMTag | Categorization tags | name, color, category |
| CRMLeadTag | Lead-tag junction | leadId, tagId |
| CRMSettings | Module settings | autoAssignLeads, autoSurveyEnabled |

---

## Backend Architecture

### Directory Structure

```
backend/src/
├── routes/
│   └── crmRoutes.ts           # All CRM endpoints
├── services/
│   ├── crmLeadService.ts      # Lead business logic
│   ├── crmCommunicationService.ts  # Communication handling
│   ├── crmTaskService.ts      # Task management
│   ├── crmCampaignService.ts  # Campaign execution
│   ├── crmSurveyService.ts    # Survey management
│   └── crmReportsService.ts   # Analytics & reporting
└── validators/
    └── crmValidation.ts       # Zod schemas (optional)
```

### Service Layer Pattern

```typescript
// Example: crmLeadService.ts
import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';

export class CRMLeadService {
  // Generate unique lead number
  private generateLeadNumber(hospitalCode: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 4).toUpperCase();
    return `LD-${hospitalCode}-${timestamp}${random}`;
  }

  // Create new lead
  async create(hospitalId: string, data: CreateLeadDto) {
    const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    const leadNumber = this.generateLeadNumber(hospital?.code || 'HMS');

    return prisma.cRMLead.create({
      data: {
        hospitalId,
        leadNumber,
        ...data,
        score: this.calculateInitialScore(data.source),
      },
      include: { assignedTo: true, tags: { include: { tag: true } } },
    });
  }

  // List leads with filters
  async findAll(hospitalId: string, params: LeadSearchParams) {
    const { page = 1, limit = 20, status, source, assignedToId, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CRMLeadWhereInput = {
      hospitalId,
      ...(status && { status }),
      ...(source && { source }),
      ...(assignedToId && { assignedToId }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [leads, total] = await Promise.all([
      prisma.cRMLead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { assignedTo: true, tags: { include: { tag: true } } },
      }),
      prisma.cRMLead.count({ where }),
    ]);

    return { leads, page, limit, total };
  }

  // Update lead status
  async updateStatus(id: string, hospitalId: string, status: LeadStatus, reason?: string) {
    const lead = await this.findById(id, hospitalId);

    const updateData: any = { status };
    if (status === 'LOST' && reason) {
      updateData.lostReason = reason;
    }
    if (status === 'CONVERTED') {
      updateData.convertedAt = new Date();
    }

    const updated = await prisma.cRMLead.update({
      where: { id },
      data: updateData,
    });

    // Log activity
    await prisma.cRMActivity.create({
      data: {
        hospitalId,
        leadId: id,
        activityType: 'STATUS_CHANGED',
        title: `Status changed to ${status}`,
        description: reason,
        performedById: /* current user ID */,
      },
    });

    return updated;
  }

  // Convert lead to patient
  async convertToPatient(id: string, hospitalId: string, patientData: any) {
    const lead = await this.findById(id, hospitalId);

    // Create patient record
    const patient = await prisma.patient.create({
      data: {
        hospitalId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        dateOfBirth: lead.dateOfBirth,
        gender: lead.gender,
        address: lead.address,
        ...patientData,
      },
    });

    // Update lead
    await prisma.cRMLead.update({
      where: { id },
      data: {
        status: 'CONVERTED',
        convertedToPatientId: patient.id,
        convertedAt: new Date(),
      },
    });

    return patient;
  }
}

export const crmLeadService = new CRMLeadService();
```

---

## Frontend Architecture

### Directory Structure

```
frontend/src/pages/CRM/
└── index.tsx                  # Main CRM page with all tabs
```

### Component Structure

```typescript
// frontend/src/pages/CRM/index.tsx
import { useState, useEffect } from 'react';
import { crmApi } from '../../services/api';
import { toast } from 'react-hot-toast';

// Tab configuration
const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon },
  { id: 'leads', label: 'Leads', icon: UserPlusIcon },
  { id: 'tasks', label: 'Tasks', icon: ClipboardDocumentListIcon },
  { id: 'campaigns', label: 'Campaigns', icon: MegaphoneIcon },
  { id: 'surveys', label: 'Surveys', icon: ChatBubbleLeftRightIcon },
  { id: 'templates', label: 'Templates', icon: DocumentDuplicateIcon },
];

// Kanban columns for lead pipeline
const leadColumns = [
  { id: 'NEW', label: 'New', color: 'purple' },
  { id: 'CONTACTED', label: 'Contacted', color: 'blue' },
  { id: 'QUALIFIED', label: 'Qualified', color: 'amber' },
  { id: 'APPOINTMENT_SCHEDULED', label: 'Scheduled', color: 'cyan' },
  { id: 'CONVERTED', label: 'Converted', color: 'green' },
  { id: 'LOST', label: 'Lost', color: 'gray' },
];

export default function CRM() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  // ... more state

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'leads') fetchLeads();
    if (activeTab === 'tasks') fetchTasks();
    // ...
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-purple-700">
        {/* Header content */}
      </div>

      {/* Tab navigation */}
      <div className="flex space-x-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id
              ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
              : 'text-gray-600'
            }
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'leads' && <LeadsTab leads={leads} />}
      {activeTab === 'tasks' && <TasksTab tasks={tasks} />}
      {activeTab === 'campaigns' && <CampaignsTab campaigns={campaigns} />}
      {activeTab === 'surveys' && <SurveysTab />}
      {activeTab === 'templates' && <TemplatesTab />}
    </div>
  );
}
```

### Kanban Board Component

```typescript
// Leads Kanban Board
function LeadKanban({ leads, onStatusChange }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const leadId = result.draggableId;
    const newStatus = result.destination.droppableId;

    onStatusChange(leadId, newStatus);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {leadColumns.map(column => (
          <Droppable key={column.id} droppableId={column.id}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex-shrink-0 w-72 bg-gray-100 rounded-lg p-3"
              >
                <h3 className={`text-${column.color}-600 font-semibold mb-3`}>
                  {column.label} ({leads.filter(l => l.status === column.id).length})
                </h3>

                {leads
                  .filter(lead => lead.status === column.id)
                  .map((lead, index) => (
                    <Draggable key={lead.id} draggableId={lead.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="bg-white rounded-lg p-3 mb-2 shadow-sm"
                        >
                          <LeadCard lead={lead} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
```

---

## API Endpoints

### Lead Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/crm/leads` | List leads with filters |
| POST | `/api/v1/crm/leads` | Create new lead |
| GET | `/api/v1/crm/leads/stats` | Lead statistics |
| GET | `/api/v1/crm/leads/:id` | Get lead details |
| PUT | `/api/v1/crm/leads/:id` | Update lead |
| DELETE | `/api/v1/crm/leads/:id` | Delete lead |
| PATCH | `/api/v1/crm/leads/:id/status` | Update status |
| PATCH | `/api/v1/crm/leads/:id/assign` | Assign to staff |
| POST | `/api/v1/crm/leads/:id/convert` | Convert to patient |
| GET | `/api/v1/crm/leads/:id/timeline` | Activity timeline |

### Communication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/crm/communications` | List communications |
| POST | `/api/v1/crm/communications` | Log communication |
| POST | `/api/v1/crm/communications/send` | Send message |
| POST | `/api/v1/crm/communications/schedule` | Schedule message |
| GET | `/api/v1/crm/communications/stats` | Communication metrics |

### Template Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/crm/templates` | List templates |
| POST | `/api/v1/crm/templates` | Create template |
| PUT | `/api/v1/crm/templates/:id` | Update template |
| DELETE | `/api/v1/crm/templates/:id` | Delete template |
| POST | `/api/v1/crm/templates/:id/preview` | Preview with variables |

### Task Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/crm/tasks` | List tasks |
| POST | `/api/v1/crm/tasks` | Create task |
| PUT | `/api/v1/crm/tasks/:id` | Update task |
| PATCH | `/api/v1/crm/tasks/:id/status` | Update status |
| GET | `/api/v1/crm/tasks/my` | My assigned tasks |
| GET | `/api/v1/crm/tasks/overdue` | Overdue tasks |

### Campaign Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/crm/campaigns` | List campaigns |
| POST | `/api/v1/crm/campaigns` | Create campaign |
| GET | `/api/v1/crm/campaigns/:id` | Get campaign |
| PUT | `/api/v1/crm/campaigns/:id` | Update campaign |
| POST | `/api/v1/crm/campaigns/:id/launch` | Launch campaign |
| PATCH | `/api/v1/crm/campaigns/:id/pause` | Pause campaign |
| GET | `/api/v1/crm/campaigns/:id/analytics` | Campaign analytics |

### Survey Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/crm/surveys` | List surveys |
| POST | `/api/v1/crm/surveys` | Create survey |
| GET | `/api/v1/crm/surveys/:id` | Get survey |
| PUT | `/api/v1/crm/surveys/:id` | Update survey |
| GET | `/api/v1/crm/surveys/:id/responses` | Get responses |
| GET | `/api/v1/crm/surveys/:id/analytics` | Survey analytics |

### Report Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/crm/reports/dashboard` | Dashboard metrics |
| GET | `/api/v1/crm/reports/lead-conversion` | Conversion report |
| GET | `/api/v1/crm/reports/communication-metrics` | Comm analytics |
| GET | `/api/v1/crm/reports/staff-performance` | Staff performance |
| GET | `/api/v1/crm/reports/roi-by-source` | ROI by source |

### Settings Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/crm/settings` | Get settings |
| PUT | `/api/v1/crm/settings` | Update settings |

---

## Integration Points

### Existing Services

| Service | File | Integration |
|---------|------|-------------|
| Email | `emailService.ts` | Send CRM emails via AWS SES |
| SMS | `smsService.ts` | Send CRM SMS via AWS SNS |
| WhatsApp | `whatsappService.ts` | Send CRM WhatsApp via Twilio |
| Notification | `notificationService.ts` | In-app notifications |

### Data Integration

| Entity | Integration |
|--------|-------------|
| Patient | Convert leads to patients |
| Appointment | Track in lead timeline |
| Invoice | Calculate patient revenue |
| User | Staff assignment |

### Webhook Integration (Future)

- Email delivery status (AWS SES)
- SMS delivery status (AWS SNS)
- WhatsApp delivery status (Twilio)

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Set up database and basic infrastructure

- [ ] Add Prisma models to schema
- [ ] Run database migration
- [ ] Create route file structure
- [ ] Create service file structure
- [ ] Add frontend page skeleton
- [ ] Add navigation entry
- [ ] Add route in App.tsx

**Files to Create/Modify**:
- `backend/prisma/schema.prisma` - Add CRM models
- `backend/src/routes/crmRoutes.ts` - New file
- `backend/src/routes/index.ts` - Register routes
- `backend/src/services/crmLeadService.ts` - New file
- `frontend/src/pages/CRM/index.tsx` - New file
- `frontend/src/components/layout/MainLayout.tsx` - Add nav item
- `frontend/src/App.tsx` - Add route
- `frontend/src/services/api.ts` - Add CRM API

### Phase 2: Lead Management (Week 3-4)

**Goal**: Complete lead management functionality

- [ ] Lead CRUD operations
- [ ] Kanban board with drag-and-drop
- [ ] Lead detail modal
- [ ] Lead creation form
- [ ] Status updates
- [ ] Lead assignment
- [ ] Lead-to-Patient conversion
- [ ] Activity timeline
- [ ] Lead scoring
- [ ] Tags management
- [ ] Search and filters

### Phase 3: Communication (Week 5-6)

**Goal**: Communication tracking and sending

- [ ] Communication logging
- [ ] Template CRUD
- [ ] Email sending (SES integration)
- [ ] SMS sending (SNS integration)
- [ ] WhatsApp sending (Twilio integration)
- [ ] Scheduled communications
- [ ] Communication history view
- [ ] Template preview

### Phase 4: Tasks & Campaigns (Week 7-8)

**Goal**: Task management and campaign execution

- [ ] Task CRUD
- [ ] Task assignment
- [ ] My Tasks view
- [ ] Overdue tasks
- [ ] Task reminders
- [ ] Campaign builder
- [ ] Audience targeting
- [ ] Campaign launch
- [ ] Campaign metrics
- [ ] Campaign pause/resume

### Phase 5: Surveys & Analytics (Week 9-10)

**Goal**: Feedback collection and reporting

- [ ] Survey builder
- [ ] Question types
- [ ] Survey distribution
- [ ] Response collection
- [ ] NPS calculation
- [ ] Dashboard metrics
- [ ] Lead conversion report
- [ ] Communication metrics
- [ ] Staff performance
- [ ] ROI by source

---

## Technical Specifications

### Performance Requirements

| Metric | Target |
|--------|--------|
| API Response Time | < 200ms |
| Page Load Time | < 2s |
| Kanban Drag-Drop | < 100ms |
| Search Results | < 500ms |

### Security Requirements

- All endpoints require authentication
- Hospital-level data isolation (hospitalId filtering)
- Role-based access control
- Audit logging for sensitive operations
- Data encryption for communications

### Scalability Considerations

- Pagination on all list endpoints (default: 20, max: 100)
- Redis caching for dashboard metrics (5-minute TTL)
- Background jobs for bulk operations
- Webhook-based delivery tracking

### Dependencies

**Backend**:
- Prisma (existing)
- Express (existing)
- AWS SDK (existing - SES, SNS)
- Twilio (existing - WhatsApp)

**Frontend**:
- React (existing)
- TailwindCSS (existing)
- react-beautiful-dnd (new - for Kanban)
- recharts (existing - for charts)

---

## Verification Checklist

### Backend Testing

```bash
# Run migration
cd backend
npx prisma migrate dev --name add_crm_module

# Generate Prisma client
npx prisma generate

# Start server
npm run dev

# Test endpoints with curl
curl -X GET http://localhost:3001/api/v1/crm/leads \
  -H "Authorization: Bearer <token>"
```

### Frontend Testing

```bash
cd frontend
npm run dev

# Navigate to http://localhost:3000/crm
# Verify:
# - Page loads without errors
# - All tabs are visible
# - Kanban board renders
# - Lead creation works
# - Drag-and-drop works
```

### Integration Testing

1. Create a lead via UI
2. Assign lead to staff member
3. Log a communication
4. Send an email
5. Create and complete a task
6. Convert lead to patient
7. Verify patient record created
8. Create a campaign
9. Launch campaign
10. Check analytics dashboard

---

## Appendix

### Sample API Responses

**GET /api/v1/crm/leads**
```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": "uuid",
        "leadNumber": "LD-HMS-ABC123",
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+1234567890",
        "email": "john@example.com",
        "status": "QUALIFIED",
        "source": "WEBSITE",
        "score": 75,
        "assignedTo": {
          "id": "uuid",
          "firstName": "Jane",
          "lastName": "Smith"
        },
        "tags": [
          { "id": "uuid", "name": "VIP", "color": "#6366f1" }
        ],
        "nextFollowUpAt": "2026-01-25T10:00:00Z",
        "createdAt": "2026-01-15T08:30:00Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

**POST /api/v1/crm/leads**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "email": "john@example.com",
  "source": "WEBSITE",
  "interestedIn": ["Cardiology", "General Checkup"],
  "notes": "Inquiry about heart checkup packages"
}
```

---

*Document Version: 1.0*
*Last Updated: January 2026*
