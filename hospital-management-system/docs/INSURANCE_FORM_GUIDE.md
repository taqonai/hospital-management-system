# Patient Insurance Form Guide
## Complete Field Reference for Adding & Updating Insurance

**Version:** 1.0  
**Date:** February 5, 2026  
**URL:** https://spetaar.ai/patient-portal/insurance

---

# Overview

The Insurance Information page allows patients and staff to manage health insurance policies. This page is critical for:
- UAE Health Insurance compliance
- Insurance verification at check-in
- Copay calculations
- Claims processing

---

# Page Layout

## Header Section
| Element | Description |
|---------|-------------|
| **"Insurance Information"** | Page title |
| **"Manage your health insurance policies"** | Subtitle |
| **"+ Add Insurance"** | Button to add new insurance (top right, green) |

## UAE Compliance Banner
- Blue info banner explaining UAE health insurance requirement
- Text: "All UAE residents are required to have valid health insurance. Adding your insurance information helps us verify coverage and process claims faster during your visits."

## Insurance Cards
Each insurance policy is displayed as a card showing all details.

## Tips Section
Helpful tips for managing insurance information.

---

# Insurance Card Display

When viewing an existing insurance policy, the following information is displayed:

## Card Header
| Element | Description | Example |
|---------|-------------|---------|
| **Provider Name** | Insurance company name | Orient Insurance |
| **Primary Badge** | Blue badge if this is primary insurance | "Primary" |
| **Verification Badge** | Status of insurance verification | ✅ Verified / ⏳ Pending / ❌ Rejected |
| **Edit Button** | Pencil icon to edit insurance | ✏️ |
| **Delete Button** | Trash icon to delete insurance | 🗑️ |

## Card Details
| Field | Description | Example |
|-------|-------------|---------|
| **Policy** | Policy number from insurance card | ORIENT-EXP-001 |
| **Group** | Group/employer policy number | GRP-ORIENT |
| **Subscriber** | Name on the insurance policy + relationship | Fatima Expired-Test (SELF) |
| **Coverage** | Type of coverage plan | Basic / Enhanced / VIP |
| **Valid** | Coverage period dates | 1/1/2024 - 1/31/2025 |
| **Network** | Network status | ✅ In-Network |
| **Fixed Copay** | Fixed copay amount for visits | AED 25 |

---

# Add Insurance Form - All Fields

## Required Fields (marked with *)

### 1. Insurance Provider *
| Property | Details |
|----------|---------|
| **Type** | Dropdown selection |
| **Options** | All UAE payers (Daman, ADNIC, Orient, AXA, etc.) |
| **Source** | Loaded from payers database |
| **Format** | "Company Name (Code)" |
| **Example** | "Daman (National Health Insurance Company) (DAMAN)" |

**Purpose:** Identifies which insurance company covers the patient.

---

### 2. Policy Number *
| Property | Details |
|----------|---------|
| **Type** | Text input |
| **Format** | Alphanumeric, varies by insurer |
| **Location** | Found on front of insurance card |
| **Example** | "POL-12345-2026" or "784199012345678" |

**Purpose:** Unique identifier for the patient's specific policy. Used for claim submission.

---

### 3. Subscriber Name *
| Property | Details |
|----------|---------|
| **Type** | Text input |
| **Description** | Name of the primary policyholder |
| **Example** | "Mohammed Ahmed Ali" |

**Purpose:** Identifies who owns the insurance policy. May be different from patient if patient is a dependent.

---

### 4. Subscriber ID *
| Property | Details |
|----------|---------|
| **Type** | Text input |
| **Description** | Unique ID of the policyholder |
| **Also Known As** | Member ID, Insured ID |
| **Example** | "MEM-2026-78419" or Emirates ID |

**Purpose:** Used to identify the subscriber when processing claims.

---

### 5. Relationship to Subscriber *
| Property | Details |
|----------|---------|
| **Type** | Dropdown selection |
| **Options** | Self, Spouse, Child, Other |
| **Default** | Self |

**Purpose:** Defines how the patient is related to the policyholder.

| Value | Meaning |
|-------|---------|
| **Self** | Patient is the policyholder |
| **Spouse** | Patient is married to policyholder |
| **Child** | Patient is child of policyholder |
| **Other** | Other dependent relationship |

---

### 6. Effective Date *
| Property | Details |
|----------|---------|
| **Type** | Date picker |
| **Format** | YYYY-MM-DD |
| **Description** | When the insurance coverage starts |
| **Example** | 2026-01-01 |

**Purpose:** System checks this date to determine if coverage is active.

---

### 7. Coverage Type *
| Property | Details |
|----------|---------|
| **Type** | Dropdown selection |
| **Options** | Basic, Enhanced, VIP, Comprehensive |
| **Default** | Basic |

**Coverage Types Explained:**

| Type | Description | Typical Coverage |
|------|-------------|-----------------|
| **Basic** | Standard coverage | 70-80% coverage, limited network |
| **Enhanced** | Better coverage | 80-90% coverage, wider network |
| **VIP** | Premium coverage | 90-100% coverage, private rooms |
| **Comprehensive** | Full coverage | 100% coverage, all services |

---

## Optional Fields

### 8. Group Number
| Property | Details |
|----------|---------|
| **Type** | Text input |
| **Description** | Employer/organization group policy number |
| **When Used** | Corporate/employer-provided insurance |
| **Example** | "GRP-TAQON-001" |

**Purpose:** Identifies the employer group for corporate insurance plans.

---

### 9. Expiry Date
| Property | Details |
|----------|---------|
| **Type** | Date picker |
| **Format** | YYYY-MM-DD |
| **Description** | When the insurance coverage ends |
| **Example** | 2026-12-31 |

**Purpose:** System shows expiry warnings and blocks check-in if expired.

**Important:** If insurance expires:
- Red "Insurance Expired" badge shown
- Patient prompted to convert to self-pay at check-in
- Claims cannot be submitted

---

### 10. Copay Amount (AED)
| Property | Details |
|----------|---------|
| **Type** | Number input |
| **Unit** | AED (UAE Dirhams) |
| **Description** | Fixed amount patient pays per visit |
| **Example** | 20.00 or 50.00 |

**Purpose:** Used to calculate patient's out-of-pocket cost at check-in.

**Common Copay Values:**
| Plan Type | Typical Copay |
|-----------|---------------|
| Basic | AED 20-50 |
| Enhanced | AED 10-30 |
| VIP | AED 0-20 |

---

### 11. Deductible (AED)
| Property | Details |
|----------|---------|
| **Type** | Number input |
| **Unit** | AED (UAE Dirhams) |
| **Description** | Annual amount patient must pay before insurance kicks in |
| **Example** | 500.00 or 1000.00 |

**Purpose:** System tracks deductible usage throughout the year.

**How Deductible Works:**
1. Patient visits hospital
2. Service cost: AED 200
3. If deductible not met: Patient pays full AED 200
4. Once deductible met: Insurance starts paying its share

---

### 12. Is Primary Insurance
| Property | Details |
|----------|---------|
| **Type** | Checkbox |
| **Default** | Checked if first insurance |
| **Description** | Designates this as the main insurance |

**Purpose:** For patients with multiple insurance policies (dual coverage), the primary insurance is billed first.

**Rules:**
- Only one policy can be primary
- Primary is always billed first
- Secondary covers what primary doesn't

---

# Verification Status

Insurance records have a verification status:

| Status | Badge Color | Meaning |
|--------|-------------|---------|
| **Pending** | 🟡 Yellow | Awaiting verification |
| **Verified** | 🟢 Green | Insurance confirmed active |
| **Rejected** | 🔴 Red | Insurance verification failed |

**Who Can Verify:**
- Hospital Admin
- Super Admin
- Automated DHA/DOH verification

---

# Network Status

| Status | Icon | Meaning |
|--------|------|---------|
| **In-Network** | ✅ Green checkmark | Hospital is in insurer's network - lower costs |
| **Out-of-Network** | ⚠️ Warning | Hospital not in network - may have higher costs |

---

# Tips for Insurance Information

These tips are displayed at the bottom of the page:

1. **Have your insurance card ready when adding new insurance**
2. **The policy number is usually on the front of your card**
3. **Set your most comprehensive plan as the primary insurance**
4. **Update your insurance before it expires to avoid coverage gaps**
5. **Staff will verify your insurance at check-in using your Emirates ID**

---

# Actions Available

## For Patients (Patient Portal)
| Action | How | Description |
|--------|-----|-------------|
| View Insurance | Automatic on page load | See all insurance policies |
| Add Insurance | Click "+ Add Insurance" | Add new policy |
| Edit Insurance | Click ✏️ pencil icon | Modify existing policy |
| Delete Insurance | Click 🗑️ trash icon | Remove policy |

## For Staff (Admin Portal)
| Action | How | Description |
|--------|-----|-------------|
| All patient actions | Same as above | Full CRUD access |
| Verify Insurance | Click ✅ shield icon | Mark as verified |
| Reject Insurance | Click ❌ shield icon | Mark as rejected |
| Reset Status | Click 🕐 clock icon | Reset to pending |

---

# UAE Insurance Providers (Pre-configured)

| Provider | Code | Type |
|----------|------|------|
| Daman | DAMAN | Government (Abu Dhabi) |
| Thiqa | THIQA | Government (Abu Dhabi - Nationals) |
| ADNIC | ADNIC | Private |
| AXA Gulf | AXA | Private |
| Orient Insurance | ORIENT | Private |
| Oman Insurance | OIC | Private |
| NAS | NAS | Private |
| Union Insurance | UNION | Private |
| Emirates Insurance | EIC | Private |
| Dubai Insurance | DIC | Private |

---

# Data Validation Rules

| Field | Validation |
|-------|------------|
| Policy Number | Required, unique per patient |
| Subscriber Name | Required, min 2 characters |
| Subscriber ID | Required |
| Effective Date | Required, valid date |
| Expiry Date | Must be after effective date |
| Copay | Positive number or empty |
| Deductible | Positive number or empty |

---

# Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Insurance provider is required" | No provider selected | Select from dropdown |
| "Policy number is required" | Empty policy number | Enter policy number |
| "Effective date is required" | No start date | Select effective date |
| "Expiry date must be after effective date" | Invalid date range | Fix dates |
| "Failed to add insurance" | Server error | Check all fields, retry |

---

# Integration with Other Modules

| Module | How Insurance is Used |
|--------|----------------------|
| **OPD Check-in** | Verifies insurance, calculates copay |
| **Billing** | Splits charges between insurance and patient |
| **Pharmacy** | Calculates drug copay |
| **Lab/Radiology** | Checks coverage for tests |
| **IPD** | Verifies coverage for admission, tracks expiry |
| **Claims** | Submits to DHA/DOH for reimbursement |

---

# Best Practices

1. **Always add insurance before first visit** - Avoids delays at check-in
2. **Keep expiry date updated** - Prevents coverage gaps
3. **Set most comprehensive plan as primary** - Maximizes coverage
4. **Verify policy number carefully** - Prevents claim rejections
5. **Update after job change** - Corporate plans change with employment

---

**Document End**

*Created by TeaBot ☕ for Taqon Team*  
*February 5, 2026*
