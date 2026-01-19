# CRM Module - Role-Based Flow

## Roles & Access

| Role | Primary Focus | CRM Access |
|------|---------------|------------|
| **Receptionist** | Lead capture & initial contact | Leads, Tasks, Communications |
| **Marketing** | Campaigns & engagement | Full CRM + Reports |
| **Hospital Admin** | Oversight & settings | Full CRM + Settings |

---

## Flow by Role

### 1. Receptionist Flow
```
Inquiry Received → Create Lead → Initial Contact → Log Communication → Update Status → Assign to Marketing/Self
```

**Daily Tasks:**
- Capture new leads (walk-in, phone, website)
- Make initial contact calls
- Log all communications
- Update lead status (NEW → CONTACTED)
- Schedule follow-ups
- Create tasks for self/others

---

### 2. Marketing Flow
```
Review Leads → Qualify Prospects → Run Campaigns → Collect Feedback → Analyze Results
```

**Key Activities:**

| Activity | Description |
|----------|-------------|
| **Lead Nurturing** | Follow up on qualified leads, move through pipeline |
| **Campaigns** | Create & launch WhatsApp/SMS/Email campaigns |
| **Surveys** | Design post-visit surveys, collect NPS feedback |
| **Templates** | Create reusable message templates |
| **Analytics** | Monitor conversion rates, campaign ROI, NPS scores |

**Workflow:**
1. Review leads assigned by Receptionist
2. Qualify leads (CONTACTED → QUALIFIED)
3. Create targeted campaigns for specific audiences
4. Launch campaigns and monitor delivery/response
5. Analyze results and adjust strategy
6. Create surveys for patient feedback
7. Generate reports for management

---

### 3. Hospital Admin Flow
```
Monitor Dashboard → Review Performance → Approve Campaigns → Configure Settings
```

**Responsibilities:**
- Overall CRM performance monitoring
- Staff performance review
- Campaign approval (optional)
- CRM settings configuration
- Lead conversion oversight

---

## Lead Pipeline (All Roles)

```
┌─────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│   NEW   │───▶│ CONTACTED │───▶│ QUALIFIED │───▶│ SCHEDULED │───▶│ CONVERTED │
└─────────┘    └───────────┘    └───────────┘    └───────────┘    └───────────┘
     │              │                │                 │
     │         Receptionist     Marketing          Doctor
     │                               │                 │
     └───────────────────────────────┴─────────────────┘
                                     │
                                     ▼
                               ┌──────────┐
                               │   LOST   │
                               └──────────┘
```

---

## Typical Day-to-Day

### Receptionist (Morning)
1. Check new inquiries
2. Create leads for walk-ins
3. Make follow-up calls
4. Log communications
5. Update statuses

### Marketing (Throughout Day)
1. Review qualified leads
2. Check campaign performance
3. Respond to survey feedback
4. Create new campaigns
5. Generate weekly reports

### Hospital Admin (Weekly)
1. Review dashboard metrics
2. Check conversion rates
3. Analyze staff performance
4. Review campaign ROI

---

## Quick Reference

| Action | Who Does It |
|--------|-------------|
| Create Lead | Receptionist |
| Initial Contact | Receptionist |
| Log Communication | All |
| Qualify Lead | Marketing |
| Create Campaign | Marketing |
| Launch Campaign | Marketing |
| Create Survey | Marketing |
| View Reports | Marketing, Admin |
| Convert to Patient | Receptionist, Admin |
| Configure Settings | Admin |

---

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Receptionist | receptionist@hospital.com | password123 |
| Marketing | marketing@hospital.com | password123 |
| Hospital Admin | admin@hospital.com | password123 |

---

*Color Theme: Purple/Violet Gradient*
