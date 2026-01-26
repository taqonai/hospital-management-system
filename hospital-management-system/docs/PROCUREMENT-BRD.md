# Procurement Module — Business Requirements Document (BRD)

**System:** Spetaar Hospital Management System (HMS)
**Module:** Procurement & Supply Chain Management
**Version:** 1.0
**Date:** 2025-07-13
**Status:** Draft — For Development Team Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Scope & Objectives](#2-project-scope--objectives)
3. [Stakeholders & User Roles](#3-stakeholders--user-roles)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [AI-Powered Features](#6-ai-powered-features)
7. [Data Model (Proposed Prisma Models)](#7-data-model-proposed-prisma-models)
8. [API Endpoints (Proposed Routes)](#8-api-endpoints-proposed-routes)
9. [UI/UX Requirements](#9-uiux-requirements)
10. [Integration Points with Existing Modules](#10-integration-points-with-existing-modules)
11. [Compliance & Regulatory](#11-compliance--regulatory)
12. [Implementation Phases](#12-implementation-phases)
13. [Success Metrics / KPIs](#13-success-metrics--kpis)
14. [Appendices](#14-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

The Spetaar HMS currently manages pharmacy inventory (`Drug`, `DrugInventory`), general inventory (`InventoryItem`), housekeeping supplies (`HousekeepingInventory`), and capital assets (`Asset`) — but lacks a unified procurement backbone. Supplier identifiers exist as loose `String` fields (`supplierId` on `DrugInventory` and `HousekeepingInventory`; `vendor` on `Asset`) with no master record. There is no purchase order lifecycle, no goods receipt workflow, no vendor comparison, and no approval chain.

This BRD defines a comprehensive **Procurement & Supply Chain Management** module that will:

- Introduce a centralized **Supplier/Vendor master** referenced by all inventory models.
- Implement the full **Procure-to-Pay (P2P)** cycle: Requisition → RFQ → Purchase Order → Goods Receipt → Invoice Matching → Payment.
- Add configurable **multi-level approval workflows** scoped per hospital tenant.
- Provide **AI-powered** demand forecasting, vendor scoring, anomaly detection, and automatic reorder triggers.
- Deliver a **Procurement Dashboard** with spend analytics, compliance metrics, and operational KPIs.

### 1.2 Business Justification

| Problem | Impact | Solution |
|---------|--------|----------|
| No vendor master — supplier data is duplicated/inconsistent | Data quality issues, no performance tracking | Centralized `Supplier` model with categories, ratings, documents |
| Manual procurement via spreadsheets/email | Slow cycle times (avg 7–14 days), errors | Digital P2P workflow with approval automation |
| No purchase order tracking | Over-ordering, budget overruns, audit failures | Full PO lifecycle with budget controls |
| No goods receipt verification | Shrinkage, quantity disputes, phantom inventory | GRN with 3-way matching (PO → GRN → Invoice) |
| Stockouts of critical items | Patient care disruption, emergency purchases at premium | AI-driven reorder automation using existing `reorderLevel` fields |
| No vendor performance visibility | Continued use of underperforming suppliers | Automated vendor scorecards and AI-powered ranking |

### 1.3 Estimated ROI

- **15–25% reduction** in procurement cycle time
- **10–15% cost savings** through competitive bidding and vendor comparison
- **90% reduction** in stockout incidents for tracked items
- **Full audit trail** for regulatory compliance (JCI, NABH, CBAHI)

---

## 2. Project Scope & Objectives

### 2.1 In Scope

| Area | Description |
|------|-------------|
| Supplier/Vendor Management | Master data, categorization, documents, performance tracking, blacklisting |
| Purchase Requisition (PR) | Creation from any department, auto-generation from reorder triggers |
| Request for Quotation (RFQ) | Multi-vendor solicitation, comparison matrix, award |
| Purchase Order (PO) | Generation from approved PR/RFQ, amendments, cancellations |
| Goods Receipt Note (GRN) | Receiving against PO, quality inspection, partial receipts |
| Invoice Matching | 3-way match (PO → GRN → Invoice), discrepancy handling |
| Returns & Credit Notes | Return to vendor, credit note tracking |
| Approval Workflows | Configurable multi-level approval chains per hospital |
| Contract Management | Rate contracts, AMC agreements, tender management |
| Reorder Automation | Rule-based and AI-driven automatic PR generation |
| Procurement Analytics | Dashboards, spend analysis, vendor performance reports |
| AI Features | Demand forecasting, vendor scoring, anomaly detection, auto-reorder |

### 2.2 Out of Scope (Phase 1)

- E-procurement portal for external vendors (vendor self-service)
- EDI/electronic invoice integration with government tax systems
- Warehouse management (bin locations, pick/pack/ship)
- Fleet/logistics management for deliveries
- Cross-hospital procurement consolidation (group purchasing)

### 2.3 Objectives

| # | Objective | Metric |
|---|-----------|--------|
| O1 | Digitize end-to-end procurement workflow | 100% of POs created in system |
| O2 | Reduce procurement cycle time | PR-to-delivery < 5 business days (non-emergency) |
| O3 | Achieve full spend visibility | 100% of purchases tracked with category, vendor, department |
| O4 | Eliminate stockouts for critical items | < 2% stockout rate on monitored SKUs |
| O5 | Enable audit compliance | Full trail for every transaction; 3-way match rate > 95% |
| O6 | Improve vendor management | All active vendors rated; bottom-10% reviewed quarterly |

---

## 3. Stakeholders & User Roles

### 3.1 Existing Roles (from `UserRole` enum)

The module will leverage existing roles and introduce new procurement-specific permissions via the `CustomRole` / `RolePermission` RBAC system.

| Role | Procurement Access |
|------|--------------------|
| `SUPER_ADMIN` | Full access to all procurement across all hospitals |
| `HOSPITAL_ADMIN` | Full access within their hospital; configure approval workflows, budgets |
| `ACCOUNTANT` | Invoice matching, payment processing, spend reports |
| `PHARMACIST` | Create PRs for drugs, view drug POs, receive drug GRNs |
| `LAB_TECHNICIAN` | Create PRs for lab consumables and reagents |
| `HOUSEKEEPING_MANAGER` | Create PRs for cleaning supplies, manage housekeeping inventory orders |
| `MAINTENANCE_STAFF` | Create PRs for spare parts, manage asset-related procurement |
| `NURSE` | Request supplies for ward/department (limited PR creation) |
| `DOCTOR` | Request specialized medical equipment/supplies |
| `DIETARY_STAFF` | Create PRs for food supplies and kitchen equipment |

### 3.2 New Procurement Permissions (via RBAC)

These permissions follow the existing `module:action` format used by `RolePermission`:

```
procurement:read                  — View procurement data
procurement:write                 — Create/edit PRs, POs
procurement:approve               — Approve PRs, POs within authority
procurement:admin                 — Configure workflows, budgets, vendor management
procurement:vendor_manage         — Full CRUD on vendor master
procurement:po_create             — Create purchase orders
procurement:po_approve            — Approve purchase orders
procurement:grn_create            — Create goods receipt notes
procurement:invoice_match         — Perform invoice matching
procurement:payment_process       — Process payments to vendors
procurement:reports               — Access procurement analytics
procurement:contract_manage       — Manage vendor contracts
procurement:rfq_manage            — Create and manage RFQs
```

### 3.3 Proposed New Role

| Role | Description |
|------|-------------|
| `PROCUREMENT_MANAGER` | New role to be added to `UserRole` enum — dedicated procurement officers with full P2P access |
| `STORE_KEEPER` | New role — manages physical receiving, GRN creation, inventory storage |

> **Implementation Note:** Add these to the `UserRole` enum in the Prisma schema. Until then, use `CustomRole` with the above permissions to avoid a migration-heavy change early on.

### 3.4 Stakeholder Matrix

| Stakeholder | Interest | Influence | Engagement |
|-------------|----------|-----------|------------|
| Hospital Admin | Budget control, compliance | High | Sponsor |
| Finance/Accounts | Payment accuracy, auditing | High | Key User |
| Pharmacy Head | Drug availability, cost | High | Key User |
| Lab Manager | Reagent/consumable supply | Medium | User |
| Housekeeping Manager | Cleaning supply availability | Medium | User |
| Maintenance Head | Spare parts, AMC management | Medium | User |
| Nursing Head | Ward supply availability | Medium | Requester |
| IT Department | System integration, performance | High | Technical |
| External Auditors | Compliance, trail integrity | Low | Reviewer |

---

## 4. Functional Requirements

### 4.1 Supplier/Vendor Management

#### FR-4.1.1 Vendor Master Data

| ID | Requirement | Priority |
|----|-------------|----------|
| SM-01 | Create, read, update, soft-delete vendor records | P0 |
| SM-02 | Vendor categories: PHARMACEUTICAL, MEDICAL_EQUIPMENT, LAB_SUPPLIES, HOUSEKEEPING, FOOD_SUPPLIES, IT_EQUIPMENT, GENERAL, MAINTENANCE, LINEN, STATIONERY, FURNITURE, CONSTRUCTION, CONSULTING | P0 |
| SM-03 | Multiple contact persons per vendor with roles (Sales, Support, Accounts) | P1 |
| SM-04 | Vendor addresses: billing address, shipping/warehouse address(es) | P0 |
| SM-05 | Tax registration: GST/VAT number, TIN, PAN (India) / CR, VAT (Saudi Arabia) | P0 |
| SM-06 | Banking details for payment: bank name, account number, IBAN, SWIFT | P1 |
| SM-07 | Document management: trade license, ISO certificates, drug license, SFDA registration, insurance certificates — with expiry tracking | P0 |
| SM-08 | Vendor status lifecycle: PENDING_APPROVAL → APPROVED → ACTIVE → SUSPENDED → BLACKLISTED | P0 |
| SM-09 | Vendor tagging/classification: LOCAL, INTERNATIONAL, MANUFACTURER, DISTRIBUTOR, WHOLESALER | P1 |
| SM-10 | Payment terms configuration per vendor: NET_30, NET_60, NET_90, ADVANCE, COD, INSTALLMENT | P0 |
| SM-11 | Currency support per vendor (default: hospital's currency) | P2 |
| SM-12 | Link existing `supplierId` fields in `DrugInventory`, `HousekeepingInventory`, and `vendor` in `Asset` to the new `Supplier` model via data migration | P0 |

#### FR-4.1.2 Vendor Performance Tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| VP-01 | Automated scorecard based on: delivery timeliness, quality rejection rate, price competitiveness, response time | P1 |
| VP-02 | Manual rating capability (1–5 stars) with comments by receiving staff | P1 |
| VP-03 | Composite vendor score (0–100) calculated from weighted metrics | P1 |
| VP-04 | Vendor comparison report: side-by-side for same category/product | P1 |
| VP-05 | Alert when vendor license/certificate is within 30 days of expiry | P1 |
| VP-06 | Blacklist workflow: reason capture, approval required, blocks all new POs | P1 |

---

### 4.2 Purchase Requisition (PR) Workflow

#### FR-4.2.1 PR Creation

| ID | Requirement | Priority |
|----|-------------|----------|
| PR-01 | Any authorized user can create a PR specifying items, quantities, required-by date, justification | P0 |
| PR-02 | PR number auto-generated: `PR-{hospitalCode}-{YYYYMMDD}-{sequence}` | P0 |
| PR-03 | PR line items reference either existing inventory items (`InventoryItem`, `Drug`, `HousekeepingInventory`) or free-text for new items | P0 |
| PR-04 | Priority levels: ROUTINE, URGENT, EMERGENCY | P0 |
| PR-05 | Attach supporting documents (PDF, images) to PR | P1 |
| PR-06 | PR templates for frequently ordered item bundles (e.g., "Monthly Ward Supplies", "Lab Reagent Kit") | P2 |
| PR-07 | Clone previous PR functionality | P2 |
| PR-08 | Estimated budget field with department budget validation | P1 |

#### FR-4.2.2 PR Status Lifecycle

```
DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED → PARTIALLY_ORDERED → FULLY_ORDERED → CLOSED
                                      → REJECTED → (may be revised and resubmitted)
                                      → CANCELLED
```

| ID | Requirement | Priority |
|----|-------------|----------|
| PR-09 | Save as draft before submission | P0 |
| PR-10 | Submit triggers approval workflow | P0 |
| PR-11 | Requester notified at each status change (in-app + optional email/SMS via `Notification` model) | P0 |
| PR-12 | Rejected PRs include rejection reason; requester can revise and resubmit | P0 |
| PR-13 | Auto-close PR when all lines are fully ordered | P1 |

#### FR-4.2.3 Automatic PR Generation (Reorder)

| ID | Requirement | Priority |
|----|-------------|----------|
| PR-14 | Scheduled job checks `Drug.reorderLevel`, `InventoryItem.reorderLevel`, `HousekeepingInventory.reorderLevel` against current stock | P0 |
| PR-15 | Auto-generate draft PR when stock falls below reorder level | P0 |
| PR-16 | Configurable reorder quantity: EOQ (Economic Order Quantity) or fixed multiple of `minQuantity` | P1 |
| PR-17 | Consolidate auto-generated PRs by vendor (if preferred vendor is set) | P2 |
| PR-18 | Dashboard alert for items at/below reorder level without pending PRs/POs | P0 |

---

### 4.3 Request for Quotation (RFQ) / Vendor Comparison

| ID | Requirement | Priority |
|----|-------------|----------|
| RFQ-01 | Create RFQ from approved PR, selecting 3+ vendors for each item category | P1 |
| RFQ-02 | RFQ number auto-generated: `RFQ-{hospitalCode}-{YYYYMMDD}-{sequence}` | P1 |
| RFQ-03 | RFQ document generation (PDF) with item specifications, quantities, delivery requirements | P1 |
| RFQ-04 | Record vendor quotations: unit price, total price, delivery lead time, validity period, terms | P1 |
| RFQ-05 | Comparison matrix: side-by-side view of all quotations with variance highlighting | P1 |
| RFQ-06 | Award decision with justification (lowest price, best value, sole source) | P1 |
| RFQ-07 | RFQ validity tracking and expiry alerts | P2 |
| RFQ-08 | Historical quotation lookup: last N prices from each vendor for the same item | P1 |
| RFQ-09 | RFQ status lifecycle: DRAFT → SENT → QUOTATIONS_RECEIVED → UNDER_EVALUATION → AWARDED → CLOSED | P1 |

---

### 4.4 Purchase Order (PO) Management

#### FR-4.4.1 PO Creation

| ID | Requirement | Priority |
|----|-------------|----------|
| PO-01 | Generate PO from approved PR (single vendor) or awarded RFQ | P0 |
| PO-02 | PO number auto-generated: `PO-{hospitalCode}-{YYYYMMDD}-{sequence}` | P0 |
| PO-03 | PO header: vendor, ship-to address, payment terms, delivery date, currency, notes | P0 |
| PO-04 | PO line items: item reference, description, UOM, quantity, unit price, tax rate, line total | P0 |
| PO-05 | PO totals: subtotal, discount, tax (VAT/GST), shipping, grand total | P0 |
| PO-06 | Link PO back to originating PR(s) — many-to-many (one PO may consolidate multiple PRs; one PR may spawn multiple POs for different vendors) | P0 |
| PO-07 | PO PDF generation for sending to vendor (branded with hospital logo) | P1 |
| PO-08 | PO amendment workflow: create amendment version with change log, requires re-approval if material change | P1 |

#### FR-4.4.2 PO Status Lifecycle

```
DRAFT → PENDING_APPROVAL → APPROVED → SENT_TO_VENDOR → ACKNOWLEDGED → 
  PARTIALLY_RECEIVED → FULLY_RECEIVED → INVOICED → CLOSED
→ CANCELLED (at any stage before FULLY_RECEIVED)
→ AMENDED (creates new version)
```

| ID | Requirement | Priority |
|----|-------------|----------|
| PO-09 | Submit PO triggers approval workflow (may differ from PR approval) | P0 |
| PO-10 | Track vendor acknowledgement | P1 |
| PO-11 | Automatic status update when GRN is created against PO | P0 |
| PO-12 | Overdue PO alerts: vendor hasn't delivered by expected date | P0 |
| PO-13 | PO history: full version trail with diffs for amendments | P1 |
| PO-14 | Budget impact: show remaining departmental budget after PO approval | P1 |

---

### 4.5 Goods Receipt Note (GRN) / Receiving

| ID | Requirement | Priority |
|----|-------------|----------|
| GRN-01 | Create GRN against a specific PO | P0 |
| GRN-02 | GRN number auto-generated: `GRN-{hospitalCode}-{YYYYMMDD}-{sequence}` | P0 |
| GRN-03 | Line-level receiving: received quantity, accepted quantity, rejected quantity, rejection reason | P0 |
| GRN-04 | Partial receiving: multiple GRNs per PO allowed | P0 |
| GRN-05 | Quality inspection checklist per item category (configurable) | P1 |
| GRN-06 | Capture batch number, manufacturing date, expiry date for pharmaceutical items (feeds into `DrugInventory`) | P0 |
| GRN-07 | Barcode/QR scan support for receiving verification | P2 |
| GRN-08 | Automatic inventory update on GRN approval: increment stock in `Drug`/`InventoryItem`/`HousekeepingInventory` | P0 |
| GRN-09 | Discrepancy handling: short receipt, excess receipt, damaged goods — with notification to procurement team | P0 |
| GRN-10 | GRN reversal capability (before invoice matching) with inventory rollback | P1 |
| GRN-11 | Photo/document attachment for delivery notes, inspection reports | P1 |
| GRN-12 | Temperature log capture for cold-chain pharmaceutical items | P2 |

#### GRN Status Lifecycle

```
DRAFT → PENDING_INSPECTION → INSPECTED → APPROVED → INVENTORY_UPDATED
→ REJECTED (full rejection)
→ PARTIALLY_ACCEPTED (partial rejection)
→ REVERSED
```

---

### 4.6 Invoice Matching (3-Way Match)

| ID | Requirement | Priority |
|----|-------------|----------|
| IM-01 | Record vendor invoices with: invoice number, date, amount, line items, tax breakdown | P0 |
| IM-02 | 3-way match: compare PO (ordered) ↔ GRN (received) ↔ Invoice (billed) at line level | P0 |
| IM-03 | Match tolerance configuration: percentage and absolute amount thresholds per hospital | P0 |
| IM-04 | Auto-match: when all three documents align within tolerance, auto-approve for payment | P1 |
| IM-05 | Exception handling: flag mismatches (price variance, quantity variance, missing GRN) for manual review | P0 |
| IM-06 | Match status: UNMATCHED, PARTIALLY_MATCHED, MATCHED, EXCEPTION, APPROVED_FOR_PAYMENT | P0 |
| IM-07 | Debit note generation for overcharges | P1 |
| IM-08 | Invoice aging report: overdue invoices by vendor, by age bucket (0–30, 31–60, 61–90, 90+) | P1 |
| IM-09 | Integration with existing `Invoice` and `Payment` models for payment processing | P1 |
| IM-10 | Duplicate invoice detection (same vendor + invoice number + amount) | P0 |

---

### 4.7 Returns & Credit Notes

| ID | Requirement | Priority |
|----|-------------|----------|
| RT-01 | Return to Vendor (RTV) workflow: create return request against GRN/PO with reason | P1 |
| RT-02 | Return reasons: DEFECTIVE, EXPIRED, WRONG_ITEM, EXCESS, RECALLED, QUALITY_FAILURE | P1 |
| RT-03 | RTV approval workflow (same engine as PR/PO approvals) | P1 |
| RT-04 | Credit note recording against RTV: vendor credit amount, date, reference | P1 |
| RT-05 | Inventory auto-decrement on approved return | P1 |
| RT-06 | Track return shipment status | P2 |
| RT-07 | Link returns to vendor performance scoring (quality rejection rate) | P1 |

---

### 4.8 Approval Workflows (Configurable Multi-Level)

| ID | Requirement | Priority |
|----|-------------|----------|
| AW-01 | Hospital admin configures approval chains per document type (PR, PO, RTV, Vendor Onboarding) | P0 |
| AW-02 | Approval levels based on: amount threshold, department, item category | P0 |
| AW-03 | Each level specifies: approver role(s) or specific user(s), required count (any 1, all, majority) | P0 |
| AW-04 | Sequential and parallel approval paths | P1 |
| AW-05 | Escalation: auto-escalate if not acted upon within configurable SLA (e.g., 24h for routine, 4h for urgent) | P1 |
| AW-06 | Delegation: approver can delegate to another user for a date range (vacation coverage) | P2 |
| AW-07 | Approval/rejection with mandatory comments | P0 |
| AW-08 | Approval history: full audit trail with timestamps, IP, comments | P0 |
| AW-09 | Emergency bypass: EMERGENCY priority PRs can skip intermediate approvals (requires post-facto approval within 48h) | P1 |
| AW-10 | Mobile-friendly approval interface (works via existing mobile app architecture) | P1 |
| AW-11 | Push notification to approvers when action is required | P0 |

**Example Approval Matrix:**

| Document | Amount Range | Approval Chain |
|----------|-------------|----------------|
| PR | < $500 | Department Head |
| PR | $500–$5,000 | Department Head → Procurement Manager |
| PR | > $5,000 | Department Head → Procurement Manager → Hospital Admin |
| PO | < $1,000 | Procurement Manager |
| PO | $1,000–$10,000 | Procurement Manager → Finance Head |
| PO | > $10,000 | Procurement Manager → Finance Head → Hospital Admin |
| Vendor Onboarding | All | Procurement Manager → Hospital Admin |

---

### 4.9 Contract Management

| ID | Requirement | Priority |
|----|-------------|----------|
| CM-01 | Rate contract: fixed prices for items over a period (annual, semi-annual) | P1 |
| CM-02 | Contract fields: vendor, start date, end date, terms, items with contracted rates, minimum/maximum quantities | P1 |
| CM-03 | Auto-populate PO prices from active rate contract | P1 |
| CM-04 | Contract expiry alerts (30, 60, 90 days before) | P1 |
| CM-05 | Contract renewal workflow | P2 |
| CM-06 | AMC contract management linking to `Asset` model (replace inline `amcVendor`/`amcStartDate`/`amcEndDate` fields) | P2 |
| CM-07 | Contract compliance tracking: actual vs. contracted quantities and prices | P2 |
| CM-08 | Contract document storage (signed PDF, terms & conditions) | P1 |

---

### 4.10 Integration with Existing Modules

#### 4.10.1 Pharmacy Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| INT-PH-01 | PR creation from pharmacy for drug orders, referencing `Drug` model | P0 |
| INT-PH-02 | GRN creates `DrugInventory` records with batch, expiry, cost/selling price, supplierId (now FK to `Supplier`) | P0 |
| INT-PH-03 | Reorder automation based on `Drug.reorderLevel` vs. aggregate `DrugInventory.quantity` | P0 |
| INT-PH-04 | Drug expiry tracking: flag items with < 90 days to expiry for return/disposal | P1 |
| INT-PH-05 | Pharmacy consumption data feeds into demand forecasting AI | P1 |

#### 4.10.2 Housekeeping Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| INT-HK-01 | PR creation from housekeeping module for cleaning supplies | P0 |
| INT-HK-02 | GRN updates `HousekeepingInventory.currentStock` and `lastRestocked` | P0 |
| INT-HK-03 | Reorder based on `HousekeepingInventory.reorderLevel` | P0 |
| INT-HK-04 | Usage data from `InventoryUsage` feeds into demand forecasting | P1 |

#### 4.10.3 Asset Management Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| INT-AS-01 | Capital expenditure PRs for new asset acquisition | P1 |
| INT-AS-02 | Asset creation on GRN for capital items: auto-populate `Asset` fields from PO data | P1 |
| INT-AS-03 | AMC/maintenance contract management linked to `Asset` and `AssetMaintenance` | P1 |
| INT-AS-04 | Spare parts procurement linked to `AssetMaintenance.partsReplaced` | P2 |
| INT-AS-05 | Migrate `Asset.vendor` field to reference `Supplier` model | P1 |

#### 4.10.4 Laboratory Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| INT-LB-01 | PR creation for lab reagents, consumables, and equipment | P1 |
| INT-LB-02 | Lab consumption tracking (test volumes × reagent usage) for demand forecasting | P2 |
| INT-LB-03 | Cold chain requirements flag on lab reagent POs | P2 |

#### 4.10.5 Billing/Finance Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| INT-BL-01 | Vendor payment processing via existing `Payment` model patterns | P1 |
| INT-BL-02 | Budget allocation per department per period | P1 |
| INT-BL-03 | Cost center tracking for procurement spend | P1 |
| INT-BL-04 | Tax handling aligned with existing `Invoice.tax` patterns | P1 |

#### 4.10.6 Dietary Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| INT-DT-01 | PR creation for food supplies, kitchen equipment | P1 |
| INT-DT-02 | Perishable item tracking with short expiry management | P2 |

#### 4.10.7 CSSD Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| INT-CS-01 | PR creation for sterilization supplies and equipment | P2 |
| INT-CS-02 | Chemical/consumable reorder based on sterilization cycle volumes | P2 |

---

### 4.11 Reorder Automation

| ID | Requirement | Priority |
|----|-------------|----------|
| RA-01 | Configurable reorder check frequency: real-time (on each stock movement), hourly, daily | P0 |
| RA-02 | Reorder triggers check all inventory models: `Drug`, `InventoryItem`, `HousekeepingInventory` | P0 |
| RA-03 | Reorder quantity calculation: `maxQuantity - currentQuantity` (fill to max) or configurable EOQ | P1 |
| RA-04 | Preferred vendor auto-assignment based on: active rate contract, best score, last purchase | P1 |
| RA-05 | Consolidation window: batch auto-generated PRs within a time window before submission | P1 |
| RA-06 | Emergency reorder: immediate notification to procurement team for critical items (controlled drugs, blood bank reagents) | P0 |
| RA-07 | Reorder exclusion list: items that should never auto-reorder (capital items, one-time purchases) | P1 |
| RA-08 | Seasonal adjustment: configurable multiplier for known demand spikes (e.g., flu season) | P2 |

---

### 4.12 Procurement Analytics & Dashboards

| ID | Requirement | Priority |
|----|-------------|----------|
| DA-01 | **Procurement Dashboard** (main landing page): open PRs, pending approvals, active POs, pending GRNs, matching exceptions | P0 |
| DA-02 | **Spend Analysis**: total spend by vendor, category, department, time period with drill-down | P1 |
| DA-03 | **Vendor Performance Dashboard**: scorecards, delivery compliance, quality metrics | P1 |
| DA-04 | **Budget vs. Actual**: departmental budget utilization, remaining budget, forecast | P1 |
| DA-05 | **Cycle Time Analytics**: average time per workflow stage (PR→approval, PO→delivery, GRN→payment) | P1 |
| DA-06 | **Inventory Health**: items below reorder level, expiring items, slow-moving stock, dead stock | P0 |
| DA-07 | **Approval Bottleneck**: pending approvals by approver, aging, SLA compliance | P1 |
| DA-08 | **Contract Utilization**: actual vs. contracted quantities, upcoming renewals | P2 |
| DA-09 | **Savings Report**: negotiated savings, cost avoidance, price trend analysis | P2 |
| DA-10 | **Export**: all reports exportable as PDF, Excel, CSV | P1 |
| DA-11 | **Scheduled Reports**: configurable email delivery of key reports (weekly/monthly) | P2 |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-P01 | API response time for list endpoints | < 500ms for up to 1,000 records with pagination |
| NFR-P02 | Dashboard load time | < 2 seconds initial load |
| NFR-P03 | PO PDF generation | < 3 seconds |
| NFR-P04 | Search across suppliers/POs/PRs | < 1 second with full-text search |
| NFR-P05 | Reorder check batch job | Process 10,000 SKUs in < 60 seconds |
| NFR-P06 | Concurrent users | Support 50+ simultaneous procurement users per hospital |

### 5.2 Security

| ID | Requirement |
|----|-------------|
| NFR-S01 | All endpoints protected by `authenticate` middleware (JWT) |
| NFR-S02 | Role-based access via `authorize()` and RBAC permission checks |
| NFR-S03 | Vendor banking details encrypted at rest (AES-256) |
| NFR-S04 | Document uploads scanned for malware before storage |
| NFR-S05 | API rate limiting on procurement endpoints (prevent bulk data extraction) |
| NFR-S06 | Sensitive actions (approve PO > threshold, blacklist vendor) require re-authentication |
| NFR-S07 | No direct database access for financial data — all through service layer |

### 5.3 Multi-Tenancy

| ID | Requirement |
|----|-------------|
| NFR-M01 | All procurement models include `hospitalId` with mandatory tenant isolation |
| NFR-M02 | Cross-tenant data access only for `SUPER_ADMIN` |
| NFR-M03 | `authorizeHospital` middleware applied to all procurement routes |
| NFR-M04 | Vendor data is hospital-scoped (same physical vendor may exist as separate records per hospital) |
| NFR-M05 | Sequence numbers (PR, PO, GRN, RFQ) are hospital-scoped |
| NFR-M06 | Approval workflows configured per hospital |

### 5.4 Audit & Compliance

| ID | Requirement |
|----|-------------|
| NFR-A01 | Every create, update, delete, approve, reject action logged to `AuditLog` model |
| NFR-A02 | Audit log includes: userId, action, entityType, entityId, oldValues, newValues, ipAddress, timestamp |
| NFR-A03 | Immutable audit trail — logs cannot be modified or deleted (even by admin) |
| NFR-A04 | Document version history (PO amendments, contract changes) |
| NFR-A05 | Data retention: procurement records retained for minimum 7 years (configurable per hospital) |
| NFR-A06 | Export audit trail for specific entity or date range (for auditors) |

### 5.5 Availability & Reliability

| ID | Requirement |
|----|-------------|
| NFR-R01 | 99.9% uptime for procurement APIs |
| NFR-R02 | Graceful degradation: if AI services are unavailable, manual workflows continue unaffected |
| NFR-R03 | Database transactions for inventory updates (GRN → stock increment must be atomic) |
| NFR-R04 | Idempotent API endpoints for critical operations (prevent duplicate POs from retry) |
| NFR-R05 | Background jobs (reorder checks, report generation) with retry logic and dead-letter handling |

---

## 6. AI-Powered Features

All AI features are implemented as Python FastAPI services (consistent with existing architecture) and accessed via backend proxy routes.

### 6.1 Demand Forecasting

| ID | Feature | Description |
|----|---------|-------------|
| AI-DF-01 | **Consumption-based forecasting** | Analyze historical consumption patterns (pharmacy dispensing, housekeeping usage, lab test volumes) to predict future demand per item |
| AI-DF-02 | **Seasonal adjustment** | Detect seasonal patterns (flu season, Ramadan fasting period, summer heat-related) and adjust forecasts |
| AI-DF-03 | **Event-based demand** | Factor in scheduled surgeries (from `Surgery` model), anticipated admissions, and campaign plans (from `CRM`) |
| AI-DF-04 | **Lead time prediction** | Predict actual vendor delivery time based on historical GRN data vs. PO expected date |
| AI-DF-05 | **Safety stock optimization** | Calculate optimal safety stock levels per item considering demand variability and lead time variability |
| AI-DF-06 | **Forecast accuracy tracking** | Compare predictions vs. actuals; retrain models when accuracy drops below threshold |

**Technical Approach:**
- Time series models (Prophet/ARIMA) for seasonal demand
- Feature engineering from: dispensing records, admission trends, surgery schedules, weather data
- Inference via `/api/v1/ai/procurement/demand-forecast` endpoint
- Model retraining: weekly batch job

### 6.2 AI Vendor Scoring

| ID | Feature | Description |
|----|---------|-------------|
| AI-VS-01 | **Automated vendor rating** | Calculate composite score from: on-time delivery %, quality acceptance rate, price competitiveness, responsiveness, contract compliance |
| AI-VS-02 | **Vendor recommendation** | When creating PO, suggest top-3 vendors for the item category based on score, price, and availability |
| AI-VS-03 | **Risk assessment** | Flag vendors with declining scores, financial instability indicators, or regulatory issues |
| AI-VS-04 | **Vendor clustering** | Group similar vendors by capability, geography, specialty for strategic sourcing |
| AI-VS-05 | **Natural language analysis** | Analyze return reasons, GRN comments, and quality inspection notes to detect vendor quality trends |

**Technical Approach:**
- Weighted scoring model with configurable weights per hospital
- NLP analysis of text fields using GPT-4o-mini
- Vendor risk model using logistic regression on historical data
- Inference via `/api/v1/ai/procurement/vendor-score` endpoint

### 6.3 Anomaly Detection

| ID | Feature | Description |
|----|---------|-------------|
| AI-AD-01 | **Price anomaly** | Flag PO line items where unit price deviates > 15% from historical average or contracted rate |
| AI-AD-02 | **Quantity anomaly** | Flag unusually large order quantities compared to historical patterns |
| AI-AD-03 | **Frequency anomaly** | Detect unusual ordering patterns (e.g., same item ordered multiple times in short period) |
| AI-AD-04 | **Maverick spend detection** | Identify purchases outside contracted vendors or without proper requisition |
| AI-AD-05 | **Invoice anomaly** | Flag invoices with unusual patterns (round numbers, duplicate amounts, weekend submissions) |
| AI-AD-06 | **Consumption spike detection** | Alert when department consumption of an item suddenly increases beyond expected variance |

**Technical Approach:**
- Statistical methods (Z-score, IQR) for price/quantity anomalies
- Isolation Forest for multi-dimensional anomaly detection
- Rule-based checks for maverick spend
- Real-time scoring on PO/invoice creation; batch analysis nightly
- Inference via `/api/v1/ai/procurement/anomaly-detect` endpoint

### 6.4 Smart Auto-Reorder

| ID | Feature | Description |
|----|---------|-------------|
| AI-AR-01 | **Predictive reorder point** | Use demand forecast + lead time prediction to calculate dynamic reorder points (replacing static `reorderLevel`) |
| AI-AR-02 | **Economic Order Quantity** | Calculate optimal order quantity considering holding cost, ordering cost, demand rate |
| AI-AR-03 | **Order consolidation** | Suggest consolidating orders to same vendor for better pricing/reduced shipping |
| AI-AR-04 | **Expiry-aware ordering** | For pharmaceuticals, factor in shelf life and current stock expiry dates to avoid waste |
| AI-AR-05 | **Budget-aware ordering** | Consider remaining departmental budget when suggesting reorder quantities |
| AI-AR-06 | **Auto-PR with confidence score** | Generate PRs automatically with AI confidence score; high-confidence auto-submit, low-confidence route to manual review |

**Technical Approach:**
- Combines demand forecasting output with inventory optimization algorithms
- Multi-objective optimization: minimize stockouts + minimize holding cost + minimize waste
- Scheduled job: runs every 6 hours (configurable)
- Inference via `/api/v1/ai/procurement/smart-reorder` endpoint

### 6.5 Procurement Chatbot / Copilot

| ID | Feature | Description |
|----|---------|-------------|
| AI-CP-01 | **Natural language queries** | "What's the status of PO-2025-001?", "Show me all pending approvals", "Who is our cheapest supplier for syringes?" |
| AI-CP-02 | **Guided PR creation** | Conversational interface to create purchase requisitions |
| AI-CP-03 | **Spend insights** | "How much did we spend on lab reagents last quarter?" — generates chart |
| AI-CP-04 | **Approval assistant** | Summarize PO details and vendor history for approvers to make quick decisions |

**Technical Approach:**
- Extend existing `ChatAI` service with procurement-specific tool/function calling
- RAG over procurement data using GPT-4o
- Accessible via existing chat interface and dedicated procurement copilot panel

---

## 7. Data Model (Proposed Prisma Models)

### 7.1 Core Models

```prisma
// ==================== PROCUREMENT ====================

// --- Supplier/Vendor Master ---

model Supplier {
  id              String          @id @default(uuid())
  hospitalId      String
  code            String          // SUP-{hospitalCode}-{sequence}
  name            String
  legalName       String?
  category        SupplierCategory
  type            SupplierType    @default(DISTRIBUTOR)

  // Contact
  email           String?
  phone           String?
  website         String?
  fax             String?

  // Address
  addressLine1    String?
  addressLine2    String?
  city            String?
  state           String?
  country         String?
  postalCode      String?

  // Tax & Registration
  taxNumber       String?         // GST/VAT number
  registrationNo  String?         // CR / Trade License
  licenseNumber   String?         // Drug license, SFDA registration

  // Payment
  paymentTerms    PaymentTerms    @default(NET_30)
  currency        String          @default("SAR")
  bankName        String?
  bankAccountNo   String?
  bankIBAN        String?
  bankSwiftCode   String?

  // Status & Rating
  status          SupplierStatus  @default(PENDING_APPROVAL)
  rating          Decimal?        @db.Decimal(3, 2)  // 0.00 - 5.00
  compositeScore  Decimal?        @db.Decimal(5, 2)  // 0.00 - 100.00

  // Metadata
  notes           String?
  tags            String[]        // e.g., ["LOCAL", "MANUFACTURER", "ISO_CERTIFIED"]
  isActive        Boolean         @default(true)
  approvedBy      String?
  approvedAt      DateTime?
  createdBy       String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // Relations
  hospital            Hospital              @relation(fields: [hospitalId], references: [id])
  contacts            SupplierContact[]
  documents           SupplierDocument[]
  purchaseOrders      PurchaseOrder[]
  quotations          RFQQuotation[]
  contracts           VendorContract[]
  performanceRecords  VendorPerformance[]
  returnRequests      ReturnToVendor[]
  catalogItems        SupplierCatalogItem[]

  @@unique([hospitalId, code])
  @@index([hospitalId, category])
  @@index([hospitalId, status])
  @@map("suppliers")
}

enum SupplierCategory {
  PHARMACEUTICAL
  MEDICAL_EQUIPMENT
  LAB_SUPPLIES
  HOUSEKEEPING
  FOOD_SUPPLIES
  IT_EQUIPMENT
  GENERAL
  MAINTENANCE
  LINEN
  STATIONERY
  FURNITURE
  CONSTRUCTION
  CONSULTING
  MEDICAL_GASES
  IMPLANTS
  DISPOSABLES
}

enum SupplierType {
  MANUFACTURER
  DISTRIBUTOR
  WHOLESALER
  RETAILER
  SERVICE_PROVIDER
  IMPORTER
}

enum SupplierStatus {
  PENDING_APPROVAL
  APPROVED
  ACTIVE
  SUSPENDED
  BLACKLISTED
  INACTIVE
}

enum PaymentTerms {
  IMMEDIATE
  COD
  NET_15
  NET_30
  NET_45
  NET_60
  NET_90
  ADVANCE
  INSTALLMENT
  CUSTOM
}

model SupplierContact {
  id          String   @id @default(uuid())
  supplierId  String
  name        String
  designation String?
  email       String?
  phone       String?
  mobile      String?
  isPrimary   Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  supplier Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)

  @@map("supplier_contacts")
}

model SupplierDocument {
  id          String    @id @default(uuid())
  supplierId  String
  type        String    // TRADE_LICENSE, ISO_CERTIFICATE, DRUG_LICENSE, INSURANCE, etc.
  name        String
  fileUrl     String
  fileSize    Int?
  mimeType    String?
  expiryDate  DateTime?
  isVerified  Boolean   @default(false)
  verifiedBy  String?
  verifiedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  supplier Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)

  @@map("supplier_documents")
}

model SupplierCatalogItem {
  id              String   @id @default(uuid())
  supplierId      String
  hospitalId      String
  itemCode        String          // Supplier's item code
  itemName        String
  itemDescription String?
  category        String
  unitPrice       Decimal  @db.Decimal(10, 2)
  currency        String   @default("SAR")
  uom             String          // Unit of Measure
  minOrderQty     Int?
  leadTimeDays    Int?
  isActive        Boolean  @default(true)
  lastUpdated     DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  supplier Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)

  @@unique([supplierId, itemCode])
  @@map("supplier_catalog_items")
}

// --- Purchase Requisition ---

model PurchaseRequisition {
  id              String          @id @default(uuid())
  hospitalId      String
  prNumber        String          // PR-{hospitalCode}-{YYYYMMDD}-{seq}
  requestedBy     String          // userId
  departmentId    String
  priority        ProcurementPriority @default(ROUTINE)
  status          PRStatus        @default(DRAFT)
  justification   String?
  requiredByDate  DateTime?
  estimatedTotal  Decimal?        @db.Decimal(12, 2)
  notes           String?
  
  // Source tracking
  sourceType      PRSourceType    @default(MANUAL)
  sourceId        String?         // e.g., reorder check job ID
  
  // Submission
  submittedAt     DateTime?
  
  // Closure
  closedAt        DateTime?
  closedReason    String?
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // Relations
  hospital        Hospital              @relation(fields: [hospitalId], references: [id])
  department      Department            @relation(fields: [departmentId], references: [id])
  requestedByUser User                  @relation("PRRequestedBy", fields: [requestedBy], references: [id])
  lineItems       PRLineItem[]
  approvals       ProcurementApproval[] @relation("PRApprovals")
  attachments     ProcurementAttachment[] @relation("PRAttachments")
  purchaseOrders  PORequisitionLink[]

  @@unique([hospitalId, prNumber])
  @@index([hospitalId, status])
  @@index([hospitalId, requestedBy])
  @@index([hospitalId, departmentId])
  @@map("purchase_requisitions")
}

enum PRStatus {
  DRAFT
  SUBMITTED
  PENDING_APPROVAL
  APPROVED
  PARTIALLY_ORDERED
  FULLY_ORDERED
  REJECTED
  CANCELLED
  CLOSED
}

enum ProcurementPriority {
  ROUTINE
  URGENT
  EMERGENCY
}

enum PRSourceType {
  MANUAL
  AUTO_REORDER
  AI_RECOMMENDED
  TEMPLATE
}

model PRLineItem {
  id                  String   @id @default(uuid())
  requisitionId       String
  lineNumber          Int
  
  // Item reference (polymorphic — one of these will be set)
  inventoryItemId     String?  // Reference to InventoryItem
  drugId              String?  // Reference to Drug
  housekeepingItemId  String?  // Reference to HousekeepingInventory
  
  // For new/non-catalog items
  itemDescription     String
  itemCategory        String
  
  // Quantity & pricing
  uom                 String   // Unit of Measure
  requestedQty        Int
  estimatedUnitPrice  Decimal? @db.Decimal(10, 2)
  estimatedTotal      Decimal? @db.Decimal(10, 2)
  
  // Order tracking
  orderedQty          Int      @default(0)
  
  // Preferences
  preferredSupplierId String?
  specifications      String?
  notes               String?
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  requisition       PurchaseRequisition @relation(fields: [requisitionId], references: [id], onDelete: Cascade)
  preferredSupplier Supplier?           @relation(fields: [preferredSupplierId], references: [id])

  @@map("pr_line_items")
}

// --- Request for Quotation ---

model RequestForQuotation {
  id              String        @id @default(uuid())
  hospitalId      String
  rfqNumber       String        // RFQ-{hospitalCode}-{YYYYMMDD}-{seq}
  title           String
  description     String?
  status          RFQStatus     @default(DRAFT)
  
  // Timeline
  issueDate       DateTime?
  responseDeadline DateTime?
  validityDays    Int           @default(30)
  
  // Decision
  awardedAt       DateTime?
  awardedBy       String?
  awardJustification String?
  
  createdBy       String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  hospital        Hospital          @relation(fields: [hospitalId], references: [id])
  lineItems       RFQLineItem[]
  quotations      RFQQuotation[]
  invitedVendors  RFQVendorInvite[]

  @@unique([hospitalId, rfqNumber])
  @@index([hospitalId, status])
  @@map("request_for_quotations")
}

enum RFQStatus {
  DRAFT
  SENT
  QUOTATIONS_RECEIVED
  UNDER_EVALUATION
  AWARDED
  CANCELLED
  CLOSED
  EXPIRED
}

model RFQLineItem {
  id              String   @id @default(uuid())
  rfqId           String
  lineNumber      Int
  itemDescription String
  itemCategory    String
  specifications  String?
  uom             String
  quantity        Int
  createdAt       DateTime @default(now())

  rfq             RequestForQuotation @relation(fields: [rfqId], references: [id], onDelete: Cascade)

  @@map("rfq_line_items")
}

model RFQVendorInvite {
  id          String    @id @default(uuid())
  rfqId       String
  supplierId  String
  sentAt      DateTime?
  respondedAt DateTime?
  status      String    @default("INVITED") // INVITED, SENT, RESPONDED, DECLINED

  rfq         RequestForQuotation @relation(fields: [rfqId], references: [id], onDelete: Cascade)

  @@unique([rfqId, supplierId])
  @@map("rfq_vendor_invites")
}

model RFQQuotation {
  id              String   @id @default(uuid())
  rfqId           String
  supplierId      String
  quotationRef    String?  // Vendor's quotation reference number
  quotationDate   DateTime?
  validUntil      DateTime?
  totalAmount     Decimal  @db.Decimal(12, 2)
  currency        String   @default("SAR")
  deliveryDays    Int?
  paymentTerms    String?
  notes           String?
  isAwarded       Boolean  @default(false)
  fileUrl         String?  // Uploaded quotation document
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  rfq             RequestForQuotation @relation(fields: [rfqId], references: [id], onDelete: Cascade)
  supplier        Supplier            @relation(fields: [supplierId], references: [id])
  lineItems       RFQQuotationItem[]

  @@unique([rfqId, supplierId])
  @@map("rfq_quotations")
}

model RFQQuotationItem {
  id              String   @id @default(uuid())
  quotationId     String
  rfqLineItemId   String?  // Links to RFQLineItem
  unitPrice       Decimal  @db.Decimal(10, 2)
  quantity        Int
  discount        Decimal  @default(0) @db.Decimal(5, 2) // Percentage
  totalPrice      Decimal  @db.Decimal(10, 2)
  leadTimeDays    Int?
  notes           String?
  createdAt       DateTime @default(now())

  quotation       RFQQuotation @relation(fields: [quotationId], references: [id], onDelete: Cascade)

  @@map("rfq_quotation_items")
}

// --- Purchase Order ---

model PurchaseOrder {
  id              String        @id @default(uuid())
  hospitalId      String
  poNumber        String        // PO-{hospitalCode}-{YYYYMMDD}-{seq}
  supplierId      String
  status          POStatus      @default(DRAFT)
  version         Int           @default(1)
  
  // Dates
  orderDate       DateTime      @default(now())
  expectedDelivery DateTime?
  
  // Address
  shipToAddress   String?
  billToAddress   String?
  
  // Financial
  currency        String        @default("SAR")
  subtotal        Decimal       @db.Decimal(12, 2)
  discountAmount  Decimal       @default(0) @db.Decimal(10, 2)
  discountPercent Decimal       @default(0) @db.Decimal(5, 2)
  taxAmount       Decimal       @default(0) @db.Decimal(10, 2)
  taxPercent      Decimal       @default(0) @db.Decimal(5, 2)
  shippingCost    Decimal       @default(0) @db.Decimal(10, 2)
  totalAmount     Decimal       @db.Decimal(12, 2)
  
  // Terms
  paymentTerms    PaymentTerms  @default(NET_30)
  deliveryTerms   String?
  
  // Source
  rfqId           String?       // If created from RFQ
  contractId      String?       // If under a rate contract
  
  // Vendor acknowledgement
  vendorAckAt     DateTime?
  vendorAckRef    String?
  
  // Notes
  notes           String?
  internalNotes   String?
  
  // Metadata
  createdBy       String
  sentToVendorAt  DateTime?
  closedAt        DateTime?
  cancelledAt     DateTime?
  cancelReason    String?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  hospital        Hospital              @relation(fields: [hospitalId], references: [id])
  supplier        Supplier              @relation(fields: [supplierId], references: [id])
  contract        VendorContract?       @relation(fields: [contractId], references: [id])
  lineItems       POLineItem[]
  requisitionLinks PORequisitionLink[]
  goodsReceipts   GoodsReceiptNote[]
  vendorInvoices  VendorInvoice[]
  approvals       ProcurementApproval[] @relation("POApprovals")
  amendments      POAmendment[]
  attachments     ProcurementAttachment[] @relation("POAttachments")

  @@unique([hospitalId, poNumber])
  @@index([hospitalId, status])
  @@index([hospitalId, supplierId])
  @@index([hospitalId, orderDate])
  @@map("purchase_orders")
}

enum POStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  SENT_TO_VENDOR
  ACKNOWLEDGED
  PARTIALLY_RECEIVED
  FULLY_RECEIVED
  INVOICED
  CLOSED
  CANCELLED
  AMENDED
}

model POLineItem {
  id              String   @id @default(uuid())
  purchaseOrderId String
  lineNumber      Int
  
  // Item reference
  inventoryItemId     String?
  drugId              String?
  housekeepingItemId  String?
  
  itemDescription String
  itemCode        String?
  itemCategory    String
  uom             String
  
  // Quantity
  orderedQty      Int
  receivedQty     Int      @default(0)
  invoicedQty     Int      @default(0)
  returnedQty     Int      @default(0)
  
  // Pricing
  unitPrice       Decimal  @db.Decimal(10, 2)
  discount        Decimal  @default(0) @db.Decimal(5, 2)
  taxRate         Decimal  @default(0) @db.Decimal(5, 2)
  lineTotal       Decimal  @db.Decimal(10, 2)
  
  // Specs
  specifications  String?
  notes           String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  grnLineItems    GRNLineItem[]

  @@map("po_line_items")
}

model PORequisitionLink {
  id              String @id @default(uuid())
  purchaseOrderId String
  requisitionId   String
  
  purchaseOrder   PurchaseOrder       @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  requisition     PurchaseRequisition @relation(fields: [requisitionId], references: [id])

  @@unique([purchaseOrderId, requisitionId])
  @@map("po_requisition_links")
}

model POAmendment {
  id              String   @id @default(uuid())
  purchaseOrderId String
  version         Int
  changeType      String   // QUANTITY_CHANGE, PRICE_CHANGE, ITEM_ADDED, ITEM_REMOVED, DELIVERY_DATE, TERMS
  changeSummary   String
  changedFields   Json     // { field: { old: x, new: y } }
  amendedBy       String
  approvedBy      String?
  approvedAt      DateTime?
  createdAt       DateTime @default(now())

  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)

  @@map("po_amendments")
}

// --- Goods Receipt Note ---

model GoodsReceiptNote {
  id              String        @id @default(uuid())
  hospitalId      String
  grnNumber       String        // GRN-{hospitalCode}-{YYYYMMDD}-{seq}
  purchaseOrderId String
  status          GRNStatus     @default(DRAFT)
  
  // Receipt details
  receivedDate    DateTime      @default(now())
  receivedBy      String        // userId
  deliveryNoteRef String?       // Vendor's delivery note number
  vehicleNumber   String?
  
  // Inspection
  inspectedBy     String?
  inspectedAt     DateTime?
  inspectionNotes String?
  
  // Summary
  totalAccepted   Int           @default(0)
  totalRejected   Int           @default(0)
  
  notes           String?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  hospital        Hospital              @relation(fields: [hospitalId], references: [id])
  purchaseOrder   PurchaseOrder         @relation(fields: [purchaseOrderId], references: [id])
  lineItems       GRNLineItem[]
  attachments     ProcurementAttachment[] @relation("GRNAttachments")

  @@unique([hospitalId, grnNumber])
  @@index([hospitalId, purchaseOrderId])
  @@index([hospitalId, receivedDate])
  @@map("goods_receipt_notes")
}

enum GRNStatus {
  DRAFT
  PENDING_INSPECTION
  INSPECTED
  APPROVED
  INVENTORY_UPDATED
  PARTIALLY_ACCEPTED
  REJECTED
  REVERSED
}

model GRNLineItem {
  id              String   @id @default(uuid())
  grnId           String
  poLineItemId    String
  lineNumber      Int
  
  // Quantities
  receivedQty     Int
  acceptedQty     Int
  rejectedQty     Int      @default(0)
  rejectionReason String?
  
  // Batch/Expiry (for pharmaceuticals)
  batchNumber     String?
  manufacturingDate DateTime?
  expiryDate      DateTime?
  
  // Quality
  qualityCheck    Boolean  @default(false)
  qualityNotes    String?
  
  // Storage
  storageLocation String?
  
  // Temperature (cold chain)
  temperatureOnReceipt Decimal? @db.Decimal(5, 2)
  coldChainIntact Boolean?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  grn             GoodsReceiptNote @relation(fields: [grnId], references: [id], onDelete: Cascade)
  poLineItem      POLineItem       @relation(fields: [poLineItemId], references: [id])

  @@map("grn_line_items")
}

// --- Vendor Invoice & Matching ---

model VendorInvoice {
  id              String              @id @default(uuid())
  hospitalId      String
  purchaseOrderId String
  supplierId      String
  
  invoiceNumber   String              // Vendor's invoice number
  invoiceDate     DateTime
  dueDate         DateTime?
  
  // Amounts
  subtotal        Decimal             @db.Decimal(12, 2)
  taxAmount       Decimal             @default(0) @db.Decimal(10, 2)
  totalAmount     Decimal             @db.Decimal(12, 2)
  paidAmount      Decimal             @default(0) @db.Decimal(12, 2)
  
  // Matching
  matchStatus     InvoiceMatchStatus  @default(UNMATCHED)
  matchedAt       DateTime?
  matchedBy       String?
  matchNotes      String?
  
  // Exceptions
  priceVariance   Decimal?            @db.Decimal(10, 2)
  quantityVariance Int?
  
  // Payment
  paymentStatus   VendorPaymentStatus @default(UNPAID)
  paymentDate     DateTime?
  paymentRef      String?
  
  // Document
  fileUrl         String?
  notes           String?
  
  createdBy       String
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  // Relations
  hospital        Hospital      @relation(fields: [hospitalId], references: [id])
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  lineItems       VendorInvoiceItem[]

  @@unique([hospitalId, supplierId, invoiceNumber])
  @@index([hospitalId, matchStatus])
  @@index([hospitalId, paymentStatus])
  @@map("vendor_invoices")
}

enum InvoiceMatchStatus {
  UNMATCHED
  PARTIALLY_MATCHED
  MATCHED
  EXCEPTION
  APPROVED_FOR_PAYMENT
}

enum VendorPaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID
  OVERDUE
  DISPUTED
}

model VendorInvoiceItem {
  id              String   @id @default(uuid())
  invoiceId       String
  lineNumber      Int
  itemDescription String
  uom             String
  quantity        Int
  unitPrice       Decimal  @db.Decimal(10, 2)
  taxRate         Decimal  @default(0) @db.Decimal(5, 2)
  lineTotal       Decimal  @db.Decimal(10, 2)
  
  // Match references
  poLineItemId    String?
  grnLineItemId   String?
  
  createdAt       DateTime @default(now())

  invoice         VendorInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@map("vendor_invoice_items")
}

// --- Returns ---

model ReturnToVendor {
  id              String          @id @default(uuid())
  hospitalId      String
  rtvNumber       String          // RTV-{hospitalCode}-{YYYYMMDD}-{seq}
  supplierId      String
  purchaseOrderId String?
  grnId           String?
  
  status          RTVStatus       @default(DRAFT)
  reason          ReturnReason
  reasonDetails   String?
  
  // Quantities & values
  totalItems      Int
  totalValue      Decimal         @db.Decimal(10, 2)
  
  // Credit note
  creditNoteRef   String?
  creditNoteDate  DateTime?
  creditAmount    Decimal?        @db.Decimal(10, 2)
  
  // Shipping
  shippedDate     DateTime?
  trackingNumber  String?
  
  requestedBy     String
  approvedBy      String?
  approvedAt      DateTime?
  
  notes           String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // Relations
  hospital        Hospital              @relation(fields: [hospitalId], references: [id])
  supplier        Supplier              @relation(fields: [supplierId], references: [id])
  lineItems       RTVLineItem[]
  approvals       ProcurementApproval[] @relation("RTVApprovals")

  @@unique([hospitalId, rtvNumber])
  @@index([hospitalId, status])
  @@map("return_to_vendor")
}

enum RTVStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  SHIPPED
  RECEIVED_BY_VENDOR
  CREDIT_RECEIVED
  CLOSED
  REJECTED
  CANCELLED
}

enum ReturnReason {
  DEFECTIVE
  EXPIRED
  WRONG_ITEM
  EXCESS
  RECALLED
  QUALITY_FAILURE
  DAMAGED_IN_TRANSIT
  NOT_AS_SPECIFIED
  OTHER
}

model RTVLineItem {
  id              String   @id @default(uuid())
  rtvId           String
  itemDescription String
  batchNumber     String?
  uom             String
  returnQty       Int
  unitPrice       Decimal  @db.Decimal(10, 2)
  lineTotal       Decimal  @db.Decimal(10, 2)
  reason          String?
  createdAt       DateTime @default(now())

  rtv             ReturnToVendor @relation(fields: [rtvId], references: [id], onDelete: Cascade)

  @@map("rtv_line_items")
}

// --- Approval Workflow ---

model ApprovalWorkflow {
  id              String   @id @default(uuid())
  hospitalId      String
  name            String
  documentType    ApprovalDocType
  isActive        Boolean  @default(true)
  description     String?
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  hospital        Hospital @relation(fields: [hospitalId], references: [id])
  rules           ApprovalRule[]

  @@unique([hospitalId, name])
  @@map("approval_workflows")
}

enum ApprovalDocType {
  PURCHASE_REQUISITION
  PURCHASE_ORDER
  RETURN_TO_VENDOR
  VENDOR_ONBOARDING
  CONTRACT
}

model ApprovalRule {
  id              String    @id @default(uuid())
  workflowId      String
  level           Int       // Sequence: 1, 2, 3...
  
  // Conditions (when does this rule apply?)
  minAmount       Decimal?  @db.Decimal(12, 2)
  maxAmount       Decimal?  @db.Decimal(12, 2)
  departmentId    String?   // Apply only to specific department
  category        String?   // Apply only to specific item category
  priority        ProcurementPriority? // Apply only for specific priority
  
  // Who approves?
  approverRole    String?   // UserRole or custom role name
  approverUserId  String?   // Specific user
  
  // Rules
  approvalType    ApprovalType @default(ANY_ONE)
  slaHours        Int       @default(24)  // Escalation time
  escalateTo      String?   // userId or role to escalate to
  
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  workflow        ApprovalWorkflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  @@map("approval_rules")
}

enum ApprovalType {
  ANY_ONE       // Any one approver at this level
  ALL           // All approvers at this level
  MAJORITY      // Majority of approvers
}

model ProcurementApproval {
  id              String          @id @default(uuid())
  hospitalId      String
  documentType    ApprovalDocType
  documentId      String          // FK to PR, PO, RTV, etc.
  level           Int
  
  // Approver
  approverId      String
  
  // Decision
  decision        ApprovalDecision?
  comments        String?
  decidedAt       DateTime?
  
  // SLA
  requestedAt     DateTime        @default(now())
  slaDeadline     DateTime?
  isEscalated     Boolean         @default(false)
  escalatedAt     DateTime?
  escalatedTo     String?
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // Polymorphic relations
  purchaseRequisition PurchaseRequisition? @relation("PRApprovals", fields: [documentId], references: [id])
  purchaseOrder       PurchaseOrder?       @relation("POApprovals", fields: [documentId], references: [id])
  returnToVendor      ReturnToVendor?      @relation("RTVApprovals", fields: [documentId], references: [id])

  @@index([hospitalId, documentType, documentId])
  @@index([approverId, decision])
  @@map("procurement_approvals")
}

enum ApprovalDecision {
  APPROVED
  REJECTED
  DEFERRED
  ESCALATED
}

// --- Contract Management ---

model VendorContract {
  id              String          @id @default(uuid())
  hospitalId      String
  supplierId      String
  contractNumber  String          // CON-{hospitalCode}-{YYYYMMDD}-{seq}
  title           String
  type            ContractType
  status          ContractStatus  @default(DRAFT)
  
  // Dates
  startDate       DateTime
  endDate         DateTime
  renewalDate     DateTime?
  
  // Financial
  totalValue      Decimal?        @db.Decimal(12, 2)
  currency        String          @default("SAR")
  paymentTerms    PaymentTerms?
  
  // Terms
  termsAndConditions String?
  penaltyClause   String?
  
  // Documents
  fileUrl         String?
  
  // Metadata
  createdBy       String
  approvedBy      String?
  approvedAt      DateTime?
  notes           String?
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // Relations
  hospital        Hospital          @relation(fields: [hospitalId], references: [id])
  supplier        Supplier          @relation(fields: [supplierId], references: [id])
  rateItems       ContractRateItem[]
  purchaseOrders  PurchaseOrder[]

  @@unique([hospitalId, contractNumber])
  @@index([hospitalId, status])
  @@index([hospitalId, endDate])
  @@map("vendor_contracts")
}

enum ContractType {
  RATE_CONTRACT
  AMC
  SERVICE_AGREEMENT
  FRAMEWORK_AGREEMENT
  TENDER
  ONE_TIME
}

enum ContractStatus {
  DRAFT
  PENDING_APPROVAL
  ACTIVE
  EXPIRED
  TERMINATED
  RENEWED
  SUSPENDED
}

model ContractRateItem {
  id              String   @id @default(uuid())
  contractId      String
  itemDescription String
  itemCode        String?
  uom             String
  contractedRate  Decimal  @db.Decimal(10, 2)
  minQuantity     Int?
  maxQuantity     Int?
  createdAt       DateTime @default(now())

  contract        VendorContract @relation(fields: [contractId], references: [id], onDelete: Cascade)

  @@map("contract_rate_items")
}

// --- Vendor Performance ---

model VendorPerformance {
  id              String   @id @default(uuid())
  hospitalId      String
  supplierId      String
  period          String   // e.g., "2025-Q1", "2025-06"
  
  // Delivery metrics
  totalOrders     Int      @default(0)
  onTimeDeliveries Int     @default(0)
  lateDeliveries  Int      @default(0)
  avgDeliveryDays Decimal? @db.Decimal(5, 1)
  
  // Quality metrics
  totalReceived   Int      @default(0)
  totalAccepted   Int      @default(0)
  totalRejected   Int      @default(0)
  qualityScore    Decimal? @db.Decimal(5, 2)
  
  // Price metrics
  avgPriceVariance Decimal? @db.Decimal(5, 2) // % vs market/last price
  priceScore      Decimal? @db.Decimal(5, 2)
  
  // Responsiveness
  avgResponseHours Decimal? @db.Decimal(5, 1)
  responseScore   Decimal? @db.Decimal(5, 2)
  
  // Composite
  compositeScore  Decimal? @db.Decimal(5, 2) // 0-100
  
  // Manual
  manualRating    Int?     // 1-5 stars
  comments        String?
  ratedBy         String?
  
  calculatedAt    DateTime @default(now())
  createdAt       DateTime @default(now())

  supplier        Supplier @relation(fields: [supplierId], references: [id])

  @@unique([hospitalId, supplierId, period])
  @@map("vendor_performance")
}

// --- Shared / Supporting ---

model ProcurementAttachment {
  id              String   @id @default(uuid())
  documentType    String   // PR, PO, GRN, RTV, CONTRACT
  documentId      String
  fileName        String
  fileUrl         String
  fileSize        Int?
  mimeType        String?
  uploadedBy      String
  createdAt       DateTime @default(now())

  // Polymorphic relations
  purchaseRequisition PurchaseRequisition? @relation("PRAttachments", fields: [documentId], references: [id])
  purchaseOrder       PurchaseOrder?       @relation("POAttachments", fields: [documentId], references: [id])
  goodsReceiptNote    GoodsReceiptNote?    @relation("GRNAttachments", fields: [documentId], references: [id])

  @@index([documentType, documentId])
  @@map("procurement_attachments")
}

model ProcurementSequence {
  id          String   @id @default(uuid())
  hospitalId  String
  prefix      String   // PR, PO, GRN, RFQ, RTV, CON, SUP
  year        Int
  month       Int
  lastNumber  Int      @default(0)
  updatedAt   DateTime @updatedAt

  @@unique([hospitalId, prefix, year, month])
  @@map("procurement_sequences")
}

// --- Budget ---

model DepartmentBudget {
  id              String    @id @default(uuid())
  hospitalId      String
  departmentId    String
  fiscalYear      Int
  fiscalMonth     Int?      // null = annual budget
  
  allocatedAmount Decimal   @db.Decimal(12, 2)
  spentAmount     Decimal   @default(0) @db.Decimal(12, 2)
  committedAmount Decimal   @default(0) @db.Decimal(12, 2) // Approved POs not yet invoiced
  remainingAmount Decimal   @db.Decimal(12, 2)
  
  notes           String?
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([hospitalId, departmentId, fiscalYear, fiscalMonth])
  @@map("department_budgets")
}

// --- AI Procurement ---

model ProcurementAILog {
  id              String   @id @default(uuid())
  hospitalId      String
  featureType     String   // DEMAND_FORECAST, VENDOR_SCORE, ANOMALY_DETECT, SMART_REORDER
  inputData       Json
  outputData      Json
  confidenceScore Decimal? @db.Decimal(5, 4) // 0.0000 - 1.0000
  wasAccepted     Boolean? // Did user accept AI recommendation?
  feedback        String?
  processedAt     DateTime @default(now())
  
  @@index([hospitalId, featureType, processedAt])
  @@map("procurement_ai_logs")
}
```

### 7.2 Required Modifications to Existing Models

```prisma
// ADD to Hospital model:
//   suppliers           Supplier[]
//   purchaseRequisitions PurchaseRequisition[]
//   purchaseOrders      PurchaseOrder[]
//   goodsReceipts       GoodsReceiptNote[]
//   vendorInvoices      VendorInvoice[]
//   returnToVendors     ReturnToVendor[]
//   rfqs                RequestForQuotation[]
//   vendorContracts     VendorContract[]
//   approvalWorkflows   ApprovalWorkflow[]
//   departmentBudgets   DepartmentBudget[]

// ADD to Department model:
//   purchaseRequisitions PurchaseRequisition[]

// ADD to User model:
//   requisitionsRequested PurchaseRequisition[] @relation("PRRequestedBy")

// ADD to UserRole enum:
//   PROCUREMENT_MANAGER
//   STORE_KEEPER

// MODIFY DrugInventory:
//   supplierId  String?  →  Add @relation to Supplier (optional, for backward compat)
//   supplier    Supplier? @relation(fields: [supplierId], references: [id])

// MODIFY HousekeepingInventory:
//   supplierId  String?  →  Add @relation to Supplier
//   supplier    Supplier? @relation(fields: [supplierId], references: [id])

// MODIFY Asset:
//   vendor      String?  →  Keep for backward compat; add supplierId String? with @relation
//   supplierId  String?
//   supplier    Supplier? @relation(fields: [supplierId], references: [id])
```

### 7.3 Entity Relationship Summary

```
Supplier ──1:N──> PurchaseOrder
Supplier ──1:N──> RFQQuotation
Supplier ──1:N──> VendorContract
Supplier ──1:N──> VendorPerformance
Supplier ──1:N──> ReturnToVendor
Supplier ──1:N──> SupplierContact
Supplier ──1:N──> SupplierDocument
Supplier ──1:N──> SupplierCatalogItem

PurchaseRequisition ──1:N──> PRLineItem
PurchaseRequisition ──M:N──> PurchaseOrder (via PORequisitionLink)

RequestForQuotation ──1:N──> RFQLineItem
RequestForQuotation ──1:N──> RFQQuotation
RFQQuotation ──1:N──> RFQQuotationItem

PurchaseOrder ──1:N──> POLineItem
PurchaseOrder ──1:N──> GoodsReceiptNote
PurchaseOrder ──1:N──> VendorInvoice
PurchaseOrder ──1:N──> POAmendment

GoodsReceiptNote ──1:N──> GRNLineItem
GRNLineItem ──N:1──> POLineItem

VendorInvoice ──1:N──> VendorInvoiceItem

ReturnToVendor ──1:N──> RTVLineItem

VendorContract ──1:N──> ContractRateItem
VendorContract ──1:N──> PurchaseOrder

ApprovalWorkflow ──1:N──> ApprovalRule
ProcurementApproval → links to PR, PO, RTV (polymorphic)
```

---

## 8. API Endpoints (Proposed Routes)

All endpoints prefixed with `/api/v1/procurement`. All require `authenticate` middleware. Role-specific access via `authorize()` or RBAC permission checks.

### 8.1 Supplier Management

```
GET    /suppliers                    — List suppliers (paginated, filterable by category, status, rating)
GET    /suppliers/:id                — Get supplier details (includes contacts, documents, performance summary)
POST   /suppliers                    — Create supplier (PENDING_APPROVAL status)
PUT    /suppliers/:id                — Update supplier
PATCH  /suppliers/:id/status         — Change supplier status (approve, suspend, blacklist)
DELETE /suppliers/:id                — Soft delete supplier

GET    /suppliers/:id/contacts       — List supplier contacts
POST   /suppliers/:id/contacts       — Add contact
PUT    /suppliers/:id/contacts/:cid  — Update contact
DELETE /suppliers/:id/contacts/:cid  — Remove contact

GET    /suppliers/:id/documents      — List supplier documents
POST   /suppliers/:id/documents      — Upload document
DELETE /suppliers/:id/documents/:did — Remove document

GET    /suppliers/:id/performance    — Get performance records
POST   /suppliers/:id/performance    — Record manual rating

GET    /suppliers/:id/catalog        — Get supplier catalog items
POST   /suppliers/:id/catalog        — Add catalog item
PUT    /suppliers/:id/catalog/:cid   — Update catalog item

GET    /suppliers/search             — Full-text search across suppliers
GET    /suppliers/expiring-documents — Documents expiring within N days
```

### 8.2 Purchase Requisitions

```
GET    /requisitions                 — List PRs (filterable by status, department, priority, date range)
GET    /requisitions/:id             — Get PR details with line items
POST   /requisitions                 — Create PR (draft)
PUT    /requisitions/:id             — Update PR (only in DRAFT status)
POST   /requisitions/:id/submit      — Submit PR for approval
POST   /requisitions/:id/cancel      — Cancel PR
DELETE /requisitions/:id             — Delete draft PR

GET    /requisitions/:id/line-items  — Get line items
POST   /requisitions/:id/line-items  — Add line item
PUT    /requisitions/:id/line-items/:lid — Update line item
DELETE /requisitions/:id/line-items/:lid — Remove line item

POST   /requisitions/:id/clone       — Clone existing PR as new draft
GET    /requisitions/templates        — List PR templates
POST   /requisitions/from-template/:tid — Create PR from template

GET    /requisitions/my-requests      — PRs created by current user
GET    /requisitions/pending-approval  — PRs pending current user's approval
```

### 8.3 Request for Quotation

```
GET    /rfqs                         — List RFQs
GET    /rfqs/:id                     — Get RFQ details with line items and quotations
POST   /rfqs                         — Create RFQ
PUT    /rfqs/:id                     — Update RFQ
POST   /rfqs/:id/send                — Send RFQ to invited vendors
POST   /rfqs/:id/close               — Close RFQ

POST   /rfqs/:id/quotations          — Record vendor quotation
PUT    /rfqs/:id/quotations/:qid     — Update quotation
GET    /rfqs/:id/comparison           — Get comparison matrix
POST   /rfqs/:id/award               — Award RFQ to selected vendor

GET    /rfqs/:id/generate-pdf         — Generate RFQ document PDF
```

### 8.4 Purchase Orders

```
GET    /purchase-orders              — List POs (filterable by status, vendor, date, amount range)
GET    /purchase-orders/:id          — Get PO details with line items, GRNs, invoices
POST   /purchase-orders              — Create PO (from PR or RFQ)
PUT    /purchase-orders/:id          — Update PO (draft/approved only)
POST   /purchase-orders/:id/submit   — Submit PO for approval
POST   /purchase-orders/:id/send     — Mark PO as sent to vendor
POST   /purchase-orders/:id/acknowledge — Record vendor acknowledgement
POST   /purchase-orders/:id/cancel   — Cancel PO
POST   /purchase-orders/:id/close    — Close PO

POST   /purchase-orders/:id/amend    — Create PO amendment
GET    /purchase-orders/:id/amendments — Get amendment history

GET    /purchase-orders/:id/line-items
POST   /purchase-orders/:id/line-items
PUT    /purchase-orders/:id/line-items/:lid
DELETE /purchase-orders/:id/line-items/:lid

GET    /purchase-orders/:id/generate-pdf — Generate PO document PDF
GET    /purchase-orders/overdue       — List overdue POs
GET    /purchase-orders/my-approvals  — POs pending current user's approval
```

### 8.5 Goods Receipt Notes

```
GET    /grn                          — List GRNs (filterable by PO, status, date)
GET    /grn/:id                      — Get GRN details
POST   /grn                          — Create GRN against a PO
PUT    /grn/:id                      — Update GRN (draft only)
POST   /grn/:id/inspect              — Record inspection results
POST   /grn/:id/approve              — Approve GRN and trigger inventory update
POST   /grn/:id/reverse              — Reverse approved GRN

GET    /grn/:id/line-items
PUT    /grn/:id/line-items/:lid

GET    /grn/pending                  — GRNs pending inspection/approval
GET    /grn/by-po/:poId              — All GRNs for a specific PO
```

### 8.6 Invoice Matching

```
GET    /invoices                     — List vendor invoices
GET    /invoices/:id                 — Get invoice details with match status
POST   /invoices                     — Record vendor invoice
PUT    /invoices/:id                 — Update invoice
POST   /invoices/:id/match           — Perform 3-way match
POST   /invoices/:id/approve-payment — Approve for payment
POST   /invoices/:id/dispute         — Flag invoice dispute

GET    /invoices/exceptions          — List matching exceptions
GET    /invoices/aging               — Invoice aging report
GET    /invoices/duplicate-check     — Check for duplicate invoice
```

### 8.7 Returns & Credit Notes

```
GET    /returns                      — List return requests
GET    /returns/:id                  — Get return details
POST   /returns                      — Create return request
PUT    /returns/:id                  — Update return request
POST   /returns/:id/submit           — Submit for approval
POST   /returns/:id/ship             — Record shipment
POST   /returns/:id/credit-note      — Record credit note received

GET    /returns/by-vendor/:vendorId  — Returns for specific vendor
```

### 8.8 Approval Workflows

```
GET    /workflows                    — List configured approval workflows
GET    /workflows/:id                — Get workflow details with rules
POST   /workflows                    — Create approval workflow
PUT    /workflows/:id                — Update workflow
DELETE /workflows/:id                — Deactivate workflow

GET    /workflows/:id/rules
POST   /workflows/:id/rules          — Add approval rule
PUT    /workflows/:id/rules/:rid     — Update rule
DELETE /workflows/:id/rules/:rid     — Remove rule

GET    /approvals/pending            — All pending approvals for current user
POST   /approvals/:id/approve        — Approve with comments
POST   /approvals/:id/reject         — Reject with comments
POST   /approvals/:id/delegate       — Delegate to another user
```

### 8.9 Contracts

```
GET    /contracts                    — List contracts (filterable by vendor, type, status)
GET    /contracts/:id                — Get contract details
POST   /contracts                    — Create contract
PUT    /contracts/:id                — Update contract
POST   /contracts/:id/activate       — Activate contract
POST   /contracts/:id/terminate      — Terminate contract

GET    /contracts/:id/rate-items     — Get rate items
POST   /contracts/:id/rate-items     — Add rate item
PUT    /contracts/:id/rate-items/:rid — Update rate item

GET    /contracts/expiring           — Contracts expiring within N days
GET    /contracts/active-for-item/:itemCode — Find active rate contract for item
```

### 8.10 Reorder Automation

```
GET    /reorder/status               — Current reorder status across all inventory
GET    /reorder/alerts               — Items at or below reorder level
POST   /reorder/check                — Trigger manual reorder check
PUT    /reorder/config               — Update reorder configuration
GET    /reorder/history              — Auto-reorder execution history
POST   /reorder/exclude              — Add item to exclusion list
DELETE /reorder/exclude/:itemId      — Remove item from exclusion list
```

### 8.11 Analytics & Dashboard

```
GET    /dashboard/summary            — Procurement dashboard KPIs
GET    /dashboard/pending-actions    — Counts of pending PRs, approvals, GRNs, matches
GET    /analytics/spend              — Spend analysis (by vendor, category, department, period)
GET    /analytics/vendor-performance — Vendor performance summary
GET    /analytics/budget             — Budget vs. actual by department
GET    /analytics/cycle-time         — Workflow cycle time metrics
GET    /analytics/savings            — Savings and cost avoidance report
GET    /analytics/inventory-health   — Reorder status, expiry alerts, slow-moving items

POST   /reports/generate             — Generate custom report (async, returns job ID)
GET    /reports/:id/download         — Download generated report (PDF/Excel/CSV)
```

### 8.12 AI Endpoints (Proxy to Python FastAPI)

```
POST   /ai/demand-forecast           — Get demand forecast for item(s)
POST   /ai/vendor-score              — Calculate/get AI vendor scores
POST   /ai/vendor-recommend          — Get vendor recommendations for item
POST   /ai/anomaly-detect            — Check for anomalies in PO/invoice
POST   /ai/smart-reorder             — Get smart reorder recommendations
POST   /ai/price-analysis            — Historical price trend analysis
POST   /ai/copilot/query             — Natural language procurement query
GET    /ai/logs                      — AI prediction logs with acceptance rates
```

---

## 9. UI/UX Requirements

### 9.1 Navigation Structure

Add "Procurement" as a top-level navigation item in the sidebar (between "Assets" and "Reports"):

```
Procurement/
├── Dashboard
├── Suppliers
│   ├── Supplier List
│   ├── Supplier Detail
│   └── Add/Edit Supplier
├── Requisitions
│   ├── PR List
│   ├── Create PR
│   └── PR Detail
├── RFQ
│   ├── RFQ List
│   ├── Create RFQ
│   ├── RFQ Detail
│   └── Comparison Matrix
├── Purchase Orders
│   ├── PO List
│   ├── Create PO
│   └── PO Detail
├── Receiving (GRN)
│   ├── GRN List
│   ├── Create GRN
│   └── GRN Detail
├── Invoices
│   ├── Invoice List
│   ├── Record Invoice
│   ├── Invoice Matching
│   └── Invoice Detail
├── Returns
│   ├── Return List
│   └── Create Return
├── Contracts
│   ├── Contract List
│   └── Contract Detail
├── Approvals (badge count)
├── Reports & Analytics
└── Settings
    ├── Approval Workflows
    ├── Reorder Config
    └── Budget Management
```

### 9.2 Key Screens

#### 9.2.1 Procurement Dashboard (Landing Page)

**Layout:** 4-column metric cards on top + 2-column content area below

**Top Metrics Cards:**
- Open PRs (count + trend arrow)
- Active POs (count + total value)
- Pending Approvals (count — highlighted if user has pending items)
- Matching Exceptions (count)

**Left Column:**
- My Pending Actions (personalized list: approvals, GRNs pending, overdue POs)
- Recent Activity feed (last 20 events)

**Right Column:**
- Inventory Alerts (items below reorder level — top 10)
- AI Recommendations (demand forecast alerts, anomaly warnings)
- Spend this month vs. budget (bar chart per department)

**Design Notes:**
- Follow existing dashboard patterns from `frontend/src/pages/Dashboard.tsx`
- Use TailwindCSS utility classes consistent with the design system
- Cards should be clickable, navigating to detail views
- Auto-refresh every 60 seconds (use TanStack Query polling)

#### 9.2.2 Supplier List

- Data table with: Code, Name, Category, Status (color badge), Rating (stars), Phone, Active POs count
- Filters: Category (multi-select), Status, Rating range, Search (name/code)
- Bulk actions: Export, Change status
- Quick add button
- Click row → Supplier Detail

#### 9.2.3 Supplier Detail

**Tabs:**
- **Overview:** Contact info, address, tax details, status badge, rating
- **Contacts:** List of contact persons with add/edit
- **Documents:** Upload/view with expiry badges (red < 30 days)
- **Purchase History:** POs/invoices with this vendor (table + chart)
- **Performance:** Scorecard with radar chart (delivery, quality, price, response)
- **Catalog:** Items this vendor supplies with prices
- **Contracts:** Active/expired contracts

#### 9.2.4 Create/Edit Purchase Requisition

**Form Layout:**
- Header: Department (auto-fill from user), Priority, Required By Date, Justification
- Line Items Table: Add row → select item (searchable dropdown from inventory models) or free text → UOM, Qty, Est. Price, Preferred Vendor (optional)
- Estimated Total (auto-calculated)
- Attachments section (drag-and-drop)
- Actions: Save Draft, Submit for Approval

**Smart Features:**
- Item search auto-completes from `Drug`, `InventoryItem`, `HousekeepingInventory`
- Shows current stock level and reorder level next to selected item
- AI suggestion: "Based on consumption, you may also need: [item list]"
- Budget warning if estimated total exceeds remaining department budget

#### 9.2.5 Purchase Order Detail

**Header Section:** PO Number, Status (progress stepper), Vendor info, Dates, Totals

**Tabs:**
- **Line Items:** Table with ordered/received/invoiced quantities + progress bars
- **GRNs:** List of goods receipts against this PO
- **Invoices:** Vendor invoices + match status
- **Approvals:** Approval history timeline
- **Amendments:** Version history with diffs
- **Documents:** Attached files

**Actions Bar (context-sensitive):**
- DRAFT: Edit, Submit, Delete
- PENDING_APPROVAL: (for approver) Approve, Reject
- APPROVED: Send to Vendor, Print PDF
- SENT_TO_VENDOR: Record Acknowledgement
- PARTIALLY_RECEIVED: Create GRN
- All: Amend, Cancel (with confirmation)

#### 9.2.6 GRN Creation

**Two-panel layout:**
- Left: PO summary (items ordered, previously received)
- Right: Receiving form

**Per Line Item:**
- Received Qty input
- Accepted Qty / Rejected Qty (auto-calculate)
- Rejection Reason dropdown (if rejected > 0)
- Batch Number, Mfg Date, Expiry Date (for pharma items)
- Quality inspection checkbox + notes
- Temperature reading (for cold chain)

**Pharmacy-specific:** When receiving drugs, show Drug name, generic name, controlled substance flag prominently. Require batch and expiry for all pharmaceutical GRNs.

#### 9.2.7 Invoice Matching Screen

**Three-panel layout (3-way match view):**
- Panel 1: PO details (ordered)
- Panel 2: GRN details (received)
- Panel 3: Invoice details (billed)

**Visual diff:** Highlight mismatches in red, matches in green, within-tolerance in yellow

**Per-line comparison:** Qty and price comparison with variance calculation

**Actions:** Auto-match (if within tolerance), Flag Exception, Approve for Payment

#### 9.2.8 Approval Queue

- Unified approval inbox for all procurement documents
- Sort by: Date, SLA remaining, Amount, Priority
- Quick action: Approve/Reject from list view (expandable row with details)
- Detail view: Full document summary + AI assessment (for POs: anomaly check, vendor score)
- SLA countdown badge (green/yellow/red)

#### 9.2.9 Analytics Dashboard

- Spend breakdown: Pie chart by category, bar chart by vendor (top 10), line chart by month
- Budget utilization: Horizontal bar chart per department
- Vendor performance: Ranked table with score sparklines
- Cycle time: Average days per stage with trend
- Date range picker + department filter + category filter

### 9.3 UI Technology Notes

- Build in `frontend/src/pages/Procurement/` directory
- Use existing component library (TailwindCSS, Headless UI patterns from other modules)
- State management: TanStack Query for server state (consistent with existing patterns)
- Forms: React Hook Form with Zod validation
- Tables: Existing table component patterns with sorting, filtering, pagination
- Charts: Recharts (already used in existing dashboards) or Chart.js
- PDF generation: Server-side with Puppeteer or pdfkit (consistent with existing report generation)
- File uploads: S3/MinIO (existing upload infrastructure)

---

## 10. Integration Points with Existing Modules

### 10.1 Integration Matrix

| Module | Direction | Integration Description | Trigger |
|--------|-----------|------------------------|---------|
| **Pharmacy** | Procurement ← Pharmacy | Auto-PR when drug stock hits reorder level | Stock movement event |
| **Pharmacy** | Procurement → Pharmacy | GRN creates `DrugInventory` records | GRN approval |
| **Pharmacy** | Procurement ← Pharmacy | Dispensing data feeds AI demand forecast | Nightly batch |
| **Housekeeping** | Procurement ← Housekeeping | Auto-PR when cleaning supply stock drops | Stock movement event |
| **Housekeeping** | Procurement → Housekeeping | GRN updates `HousekeepingInventory.currentStock` | GRN approval |
| **Housekeeping** | Procurement ← Housekeeping | Usage data from `InventoryUsage` feeds AI | Nightly batch |
| **Assets** | Procurement → Assets | GRN for capital items creates `Asset` record | GRN approval (capital items) |
| **Assets** | Procurement ← Assets | Maintenance-triggered spare part PR | Maintenance work order creation |
| **Assets** | Procurement ↔ Assets | AMC/vendor contract links to `AssetMaintenance` | Contract creation/renewal |
| **Laboratory** | Procurement ← Lab | PR creation for reagents and consumables | Manual / reorder trigger |
| **Billing** | Procurement → Billing | Vendor payment processing | Invoice approved for payment |
| **Billing** | Procurement ← Billing | Budget allocation data | Budget setup |
| **Dietary** | Procurement ← Dietary | PR creation for food supplies | Manual / scheduled |
| **CSSD** | Procurement ← CSSD | PR for sterilization consumables | Manual |
| **Notifications** | Procurement → Notifications | Approval requests, overdue alerts, reorder alerts | Various events |
| **Audit** | Procurement → AuditLog | All CRUD and workflow actions logged | Every mutation |
| **AI Services** | Procurement ↔ AI | Demand forecast, vendor scoring, anomaly detection | On-demand / scheduled |

### 10.2 Event-Driven Integration Pattern

Use an internal event bus (or simple function calls in the service layer) for cross-module triggers:

```typescript
// Example: After GRN approval for pharmacy items
async function onGRNApproved(grn: GoodsReceiptNote) {
  for (const lineItem of grn.lineItems) {
    if (lineItem.poLineItem.drugId) {
      // Create DrugInventory record
      await pharmacyService.createDrugInventoryFromGRN(lineItem);
    } else if (lineItem.poLineItem.housekeepingItemId) {
      // Update HousekeepingInventory stock
      await housekeepingService.updateStockFromGRN(lineItem);
    } else if (lineItem.poLineItem.inventoryItemId) {
      // Update InventoryItem quantity
      await inventoryService.updateStockFromGRN(lineItem);
    }
    
    // Check if this is a capital item → create Asset
    if (lineItem.poLineItem.itemCategory === 'CAPITAL_EQUIPMENT') {
      await assetService.createAssetFromGRN(lineItem);
    }
  }
  
  // Update PO received quantities
  await purchaseOrderService.updateReceivedQuantities(grn.purchaseOrderId);
  
  // Notify procurement team
  await notificationService.create({
    hospitalId: grn.hospitalId,
    userId: grn.purchaseOrder.createdBy,
    type: 'GRN_APPROVED',
    message: `GRN ${grn.grnNumber} approved and inventory updated`,
  });
}
```

### 10.3 Data Migration for Existing References

| Current Field | Current Type | Migration |
|---------------|-------------|-----------|
| `DrugInventory.supplierId` | `String?` (no FK) | Add optional FK to `Supplier`; create `Supplier` records for existing unique supplier IDs; back-fill FK |
| `HousekeepingInventory.supplierId` | `String?` (no FK) | Same as above |
| `Asset.vendor` | `String?` | Keep field for backward compat; add `supplierId` FK; create `Supplier` records for existing vendor names |
| `AssetMaintenance.vendorName` | `String?` | Keep field; add `supplierId` FK for structured reference |
| `AssetMaintenance.vendorContact` | `String?` | Migrate to `SupplierContact` records |

**Migration Strategy:**
1. Deploy new `Supplier` table with no FKs yet
2. Run data migration script: extract unique suppliers from existing data → create `Supplier` records
3. Add optional FK fields to existing models
4. Back-fill FK values
5. Update existing module services to use FK where available

---

## 11. Compliance & Regulatory

### 11.1 Healthcare Procurement Standards

| Standard | Relevance | Requirements |
|----------|-----------|-------------|
| **JCI (Joint Commission International)** | Hospital accreditation | Complete audit trail, supplier qualification, product traceability, recall management |
| **NABH (India)** | Hospital accreditation | Vendor evaluation, quality checks, expiry management, purchase committee approvals |
| **CBAHI (Saudi Arabia)** | Saudi hospital accreditation | Arabic language support, local supplier preference tracking, SFDA compliance for drugs |
| **SFDA (Saudi Food & Drug Authority)** | Drug procurement | Drug license verification for pharmaceutical suppliers, batch traceability, controlled substance tracking |
| **GMP (Good Manufacturing Practice)** | Drug quality | Supplier GMP certificate tracking, quality inspection on receipt |
| **ISO 13485** | Medical devices | Medical device supplier certification tracking, device traceability |
| **SOX (Sarbanes-Oxley)** | Financial controls | Segregation of duties, approval hierarchies, 3-way matching |

### 11.2 Compliance Features

| ID | Requirement | Priority |
|----|-------------|----------|
| COM-01 | **Segregation of duties**: User who creates PR cannot approve it; user who approves PO cannot create GRN | P0 |
| COM-02 | **Supplier qualification**: Mandatory documents before activation (trade license, tax certificate) | P0 |
| COM-03 | **Drug license verification**: Pharmaceutical suppliers must have valid drug license on file | P0 |
| COM-04 | **Batch traceability**: Full chain from PO → GRN → inventory for all pharmaceutical and medical device items | P0 |
| COM-05 | **Recall support**: Ability to trace all patients/locations affected by a recalled batch (via `DrugInventory.batchNumber`) | P1 |
| COM-06 | **Controlled substance tracking**: Enhanced approval and logging for controlled drug procurement | P0 |
| COM-07 | **Expiry management**: FEFO (First Expiry, First Out) enforcement; alert at 90/60/30 days before expiry | P0 |
| COM-08 | **Audit trail immutability**: Procurement audit logs stored separately, immutable, exportable | P0 |
| COM-09 | **Data retention**: All procurement records retained for minimum 7 years | P1 |
| COM-10 | **Arabic language support**: All generated documents (PO, GRN) available in Arabic + English | P2 |
| COM-11 | **VAT compliance**: Saudi VAT (15%) calculation on all procurement transactions | P0 |
| COM-12 | **Emergency procurement**: Fast-track process with mandatory post-audit within 48 hours | P1 |

### 11.3 Audit Requirements

Every procurement action generates an `AuditLog` entry with:

```typescript
{
  hospitalId: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'SUBMIT' | 'CANCEL' | 'RECEIVE' | 'MATCH' | 'RETURN';
  entityType: 'SUPPLIER' | 'PR' | 'RFQ' | 'PO' | 'GRN' | 'VENDOR_INVOICE' | 'RTV' | 'CONTRACT' | 'WORKFLOW';
  entityId: string;
  oldValues: object | null;
  newValues: object;
  ipAddress: string;
  userAgent: string;
}
```

---

## 12. Implementation Phases

### Phase 1: Foundation (Weeks 1–4)

**Goal:** Core data models + Supplier management + Basic PR/PO workflow

| Week | Deliverables |
|------|-------------|
| **Week 1** | Prisma schema: all new models + migration. `ProcurementSequence` utility. Supplier CRUD backend (routes + service). Supplier list/detail frontend pages. |
| **Week 2** | PR CRUD backend. PR creation frontend with item search (Drug, InventoryItem, HousekeepingInventory). PR list page. Basic status management (submit, cancel). |
| **Week 3** | PO CRUD backend. PO creation from PR. PO list/detail frontend. PO PDF generation. PO status management. |
| **Week 4** | Basic approval workflow: single-level approval for PR and PO. Approval queue page. Notification integration. Data migration for existing supplierId/vendor fields. |

**Exit Criteria:** Users can create suppliers, submit PRs, generate POs, and approve via single-level workflow.

### Phase 2: Receiving & Matching (Weeks 5–7)

| Week | Deliverables |
|------|-------------|
| **Week 5** | GRN backend + frontend. Receiving against PO. Inventory auto-update on GRN approval (Pharmacy, Housekeeping, General). Batch/expiry capture for drugs. |
| **Week 6** | Vendor Invoice recording. 3-way match engine (PO ↔ GRN ↔ Invoice). Match tolerance configuration. Exception handling UI. |
| **Week 7** | Returns (RTV) workflow. Credit note tracking. Procurement dashboard (basic version). |

**Exit Criteria:** Full P2P cycle works end-to-end. 3-way matching functional. Returns workflow operational.

### Phase 3: Advanced Workflows & RFQ (Weeks 8–10)

| Week | Deliverables |
|------|-------------|
| **Week 8** | Configurable multi-level approval workflows (workflow builder UI). Amount-based routing. SLA and escalation. |
| **Week 9** | RFQ creation, vendor invitation, quotation recording. Comparison matrix UI. Award workflow. |
| **Week 10** | Contract management (rate contracts, AMC). Contract rate auto-populate on PO. Expiry alerts. PO amendment workflow. Budget management (department budgets). |

**Exit Criteria:** Multi-level approvals work. RFQ/comparison available. Rate contracts linked to POs.

### Phase 4: Automation & Reorder (Weeks 11–12)

| Week | Deliverables |
|------|-------------|
| **Week 11** | Reorder automation engine (cron job). Check all inventory models against reorder levels. Auto-generate draft PRs. Consolidation logic. Emergency reorder alerts. |
| **Week 12** | Vendor performance calculation (scheduled job). Supplier scorecard UI. Vendor document expiry alerts. Cross-module integration testing. |

**Exit Criteria:** Auto-reorder runs reliably. Vendor performance scores calculated. All module integrations verified.

### Phase 5: AI Features (Weeks 13–16)

| Week | Deliverables |
|------|-------------|
| **Week 13** | AI demand forecasting service (Python FastAPI). Historical data pipeline. Forecast API + backend proxy. Forecast visualization on dashboard. |
| **Week 14** | AI vendor scoring model. AI anomaly detection (price, quantity, frequency). Anomaly alerts integrated into PO creation and invoice matching. |
| **Week 15** | Smart auto-reorder (AI-driven dynamic reorder points). EOQ optimization. Expiry-aware ordering for pharma. |
| **Week 16** | Procurement copilot (natural language queries via ChatAI extension). AI recommendation panel on dashboard. AI feedback loop (accept/reject tracking). |

**Exit Criteria:** AI features operational with measurable accuracy. Copilot answers procurement queries.

### Phase 6: Analytics & Polish (Weeks 17–18)

| Week | Deliverables |
|------|-------------|
| **Week 17** | Full analytics dashboard: spend analysis, budget vs. actual, cycle time, savings. Report generation (PDF/Excel). Scheduled report delivery. |
| **Week 18** | Mobile approval support. Arabic document templates. Performance optimization. End-to-end testing. Documentation. UAT support. |

**Exit Criteria:** Production-ready module with all P0 and P1 features. Analytics operational. Performance benchmarks met.

### Phase Summary

| Phase | Duration | Key Outcome |
|-------|----------|------------|
| Phase 1: Foundation | 4 weeks | Supplier + PR + PO + basic approval |
| Phase 2: Receiving & Matching | 3 weeks | GRN + 3-way match + returns |
| Phase 3: Advanced Workflows | 3 weeks | Multi-level approvals + RFQ + contracts |
| Phase 4: Automation | 2 weeks | Auto-reorder + vendor performance |
| Phase 5: AI Features | 4 weeks | Forecasting + scoring + anomaly + copilot |
| Phase 6: Analytics & Polish | 2 weeks | Dashboards + reports + UAT |
| **Total** | **18 weeks** | |

---

## 13. Success Metrics / KPIs

### 13.1 Operational KPIs

| KPI | Baseline (Pre-Module) | Target (6 months) | Target (12 months) |
|-----|----------------------|-------------------|---------------------|
| Average PR-to-PO cycle time | N/A (manual) | < 3 business days | < 2 business days |
| Average PO-to-delivery time | N/A | < 7 business days | < 5 business days |
| 3-way match success rate | N/A | > 85% | > 95% |
| Stockout rate (monitored items) | ~15% estimated | < 5% | < 2% |
| Emergency/unplanned purchases | ~30% estimated | < 15% | < 10% |
| PO compliance rate (via system) | 0% | > 80% | > 95% |
| Approval SLA compliance | N/A | > 75% | > 90% |

### 13.2 Financial KPIs

| KPI | Target |
|-----|--------|
| Cost savings from competitive bidding (RFQ) | > 10% on RFQ'd items |
| Budget variance (actual vs. allocated) | < 5% |
| Invoice processing cost reduction | > 50% (automation) |
| Duplicate payment prevention | 100% detection |
| Maverick spend (outside contracted vendors) | < 10% |

### 13.3 Quality KPIs

| KPI | Target |
|-----|--------|
| Vendor quality rejection rate | < 3% |
| GRN inspection compliance | 100% for pharmaceutical items |
| Expired stock incidents | Zero for monitored items |
| Supplier document compliance | 100% current licenses |

### 13.4 AI Feature KPIs

| KPI | Target |
|-----|--------|
| Demand forecast accuracy (MAPE) | < 20% |
| AI reorder recommendation acceptance rate | > 70% |
| Anomaly detection precision | > 80% |
| False positive rate (anomalies) | < 15% |
| Vendor score correlation with actual performance | > 0.7 |
| Copilot query resolution rate | > 60% without manual lookup |

### 13.5 User Adoption KPIs

| KPI | Target (3 months) |
|-----|-------------------|
| Active procurement users | > 80% of eligible staff |
| PRs created in system vs. manual | > 90% in system |
| Approval response time | < 4 hours average |
| Dashboard daily active users | > 50% of procurement team |

---

## 14. Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| **PR (Purchase Requisition)** | Internal request to purchase goods/services, initiated by a department |
| **PO (Purchase Order)** | Formal order sent to a vendor to supply specified goods/services |
| **GRN (Goods Receipt Note)** | Document confirming receipt and inspection of goods against a PO |
| **RFQ (Request for Quotation)** | Solicitation sent to multiple vendors to obtain competitive pricing |
| **3-Way Match** | Verification that PO, GRN, and vendor invoice agree on quantity and price |
| **RTV (Return to Vendor)** | Process of returning unacceptable goods to the supplier |
| **EOQ (Economic Order Quantity)** | Optimal order quantity that minimizes total inventory costs |
| **FEFO (First Expiry, First Out)** | Inventory management method prioritizing items closest to expiration |
| **AMC (Annual Maintenance Contract)** | Service agreement for ongoing maintenance of assets/equipment |
| **Maverick Spend** | Purchases made outside established contracts or approved vendors |
| **Lead Time** | Duration between placing an order and receiving the goods |
| **Safety Stock** | Extra inventory held to prevent stockouts from demand variability |

### Appendix B: Reference to Existing Codebase

| File/Path | Relevance |
|-----------|-----------|
| `backend/prisma/schema.prisma` | All existing models; ~5,900 lines, 80+ models |
| `backend/src/routes/index.ts` | Route registration pattern |
| `backend/src/routes/assetRoutes.ts` | Asset management routes (integration reference) |
| `backend/src/routes/housekeepingRoutes.ts` | Housekeeping routes (integration reference) |
| `backend/src/services/` | Service layer pattern |
| `frontend/src/pages/Assets/` | Asset UI pages (integration reference) |
| `frontend/src/pages/Housekeeping/` | Housekeeping UI pages (integration reference) |
| `frontend/src/pages/Dashboard.tsx` | Dashboard pattern reference |
| `ai-services/main.py` | AI service registration pattern |
| `CLAUDE.md` | Development patterns and architecture |
| `HMS_AI_COMPREHENSIVE_PLAN.md` | AI features roadmap |

### Appendix C: Assumptions & Constraints

**Assumptions:**
1. Hospital admin will configure approval workflows before go-live
2. Existing supplier data in `DrugInventory.supplierId` and `Asset.vendor` is extractable and deduplicated
3. Initial deployment targets single-currency per hospital (multi-currency is Phase 2+)
4. Vendor self-service portal is out of scope for initial release
5. E-signatures for PO/contract approval are not required (system approval suffices)

**Constraints:**
1. Must not break existing Pharmacy, Housekeeping, or Asset module functionality
2. Database migrations must be backward-compatible (add columns, don't remove)
3. All new models must include `hospitalId` for multi-tenant isolation
4. Must work within existing JWT + RBAC authentication framework
5. AI features depend on OpenAI API availability; must degrade gracefully
6. Total Prisma schema should remain manageable (new models add ~600 lines)

### Appendix D: Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should vendor data be globally shared across hospitals or fully isolated per tenant? | Product | **Decision: Isolated per tenant** (consistent with existing pattern) |
| 2 | What is the default VAT rate for Saudi hospitals? | Finance | Pending — defaulting to 15% |
| 3 | Is e-signature required for PO approval? | Legal | Pending — assuming system approval sufficient |
| 4 | Should the module support multi-currency in Phase 1? | Product | **Decision: No** — single currency per hospital |
| 5 | Integration with external ERP systems (SAP, Oracle) needed? | IT | Out of scope for initial release |
| 6 | What is the maximum number of concurrent procurement users expected per hospital? | Product | Assuming 50 — design for 100 |
| 7 | Should controlled substance procurement have a separate workflow? | Pharmacy | Pending — modeling as priority-based rule for now |

---

*Document prepared for Spetaar HMS Development Team*
*For questions or feedback, contact the Product & Architecture team*
