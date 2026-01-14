# Hospital Admin Role - Module Access List

This document lists all modules accessible to the **HOSPITAL_ADMIN** role in the Hospital Management System, along with their associated icons.

> **Icon Library:** All icons are from [@heroicons/react/24/outline](https://heroicons.com/) (Heroicons v2.0, outline style)

---

## Main Modules

| Module | Route | Icon Component | Description |
|--------|-------|----------------|-------------|
| Dashboard | `/dashboard` | `Squares2X2Icon` | System overview and key metrics |
| Patients | `/patients` | `UsersIcon` | Patient registration and management |
| Appointments | `/appointments` | `CalendarDaysIcon` | Appointment booking and scheduling |
| Doctors | `/doctors` | `UserGroupIcon` | Doctor profiles and schedules |
| Departments | `/departments` | `BuildingOffice2Icon` | Department configuration |

---

## Clinical Modules

| Module | Route | Icon Component | Description |
|--------|-------|----------------|-------------|
| OPD (Outpatient) | `/opd` | `ClipboardDocumentListIcon` | Outpatient workflow and queue |
| IPD (Inpatient) | `/ipd` | `BuildingOffice2Icon` | Inpatient admission and beds |
| Emergency | `/emergency` | `ExclamationTriangleIcon` | Emergency department and triage |
| Early Warning | `/early-warning` | `BellIcon` | NEWS2 clinical alerts |
| Med Safety | `/medication-safety` | `ShieldCheckIcon` | Medication safety verification |
| Laboratory | `/laboratory` | `BeakerIcon` | Lab orders and results |
| Radiology | `/radiology` | `PhotoIcon` | Imaging orders and reports |
| Pharmacy | `/pharmacy` | `BuildingStorefrontIcon` | Drug inventory and dispensing |
| Surgery | `/surgery` | `HeartIcon` | Surgical scheduling |
| Blood Bank | `/blood-bank` | `HeartIcon` | Blood inventory and transfusions |

---

## AI Features

| Module | Route | Icon Component | Description |
|--------|-------|----------------|-------------|
| Diagnostic AI | `/diagnostic-assistant` | `SparklesIcon` | AI-powered symptom analysis |
| AI Scribe | `/ai-scribe` | `DocumentTextIcon` | Voice transcription and notes |
| Smart Orders | `/smart-orders` | `SparklesIcon` | AI order recommendations |
| Clinical Notes | `/clinical-notes` | `DocumentTextIcon` | SOAP note generation |
| Patient Risk | `/patient-risk` | `ShieldCheckIcon` | Risk prediction analytics |
| Drug Checker | `/drug-interactions` | `BeakerIcon` | Drug interaction analysis |
| Medical Imaging | `/medical-imaging` | `PhotoIcon` | AI image interpretation |
| PDF Analysis | `/pdf-analysis` | `DocumentMagnifyingGlassIcon` | Medical document extraction |
| Telemedicine | `/telemedicine` | `VideoCameraIcon` | Video consultations |
| Symptom Checker | `/symptom-checker` | `MagnifyingGlassIcon` | Interactive symptom assessment |

---

## Operations Modules

| Module | Route | Icon Component | Description |
|--------|-------|----------------|-------------|
| Billing | `/billing` | `CreditCardIcon` | Invoicing and payments |
| HR | `/hr` | `BriefcaseIcon` | Staff management and payroll |
| Housekeeping | `/housekeeping` | `HomeModernIcon` | Facility maintenance |
| Queue | `/queue` | `QueueListIcon` | Queue management |
| Kiosk | `/kiosk` | `ComputerDesktopIcon` | Self-service kiosk |
| Quality | `/quality` | `ClipboardDocumentCheckIcon` | QA audits and incidents |
| Assets | `/assets` | `WrenchScrewdriverIcon` | Equipment tracking |
| Dietary | `/dietary` | `CakeIcon` | Meal planning and nutrition |
| Access Control (RBAC) | `/rbac` | `ShieldCheckIcon` | Role and permission management |
| AI Settings | `/ai-settings` | `CpuChipIcon` | AI service configuration |

---

## Analytics Modules

| Module | Route | Icon Component | Description |
|--------|-------|----------------|-------------|
| Reports | `/reports` | `ChartBarIcon` | Analytics and dashboards |
| Risk Analytics | `/risk-analytics` | `PresentationChartLineIcon` | Risk trend analysis |

---

## Icon Reference

| Icon Component | Visual | Usage |
|----------------|--------|-------|
| `Squares2X2Icon` | Grid | Dashboard |
| `UsersIcon` | Multiple people | Patients |
| `CalendarDaysIcon` | Calendar | Appointments |
| `UserGroupIcon` | Group of people | Doctors |
| `BuildingOffice2Icon` | Office building | Departments, IPD |
| `ClipboardDocumentListIcon` | Clipboard with list | OPD |
| `ExclamationTriangleIcon` | Warning triangle | Emergency |
| `BellIcon` | Bell | Alerts, Early Warning |
| `ShieldCheckIcon` | Shield with check | Safety, Security, RBAC |
| `BeakerIcon` | Lab beaker | Laboratory, Drug Checker |
| `PhotoIcon` | Image | Radiology, Medical Imaging |
| `BuildingStorefrontIcon` | Storefront | Pharmacy |
| `HeartIcon` | Heart | Surgery, Blood Bank |
| `SparklesIcon` | Sparkles | AI Features |
| `DocumentTextIcon` | Document | Notes, AI Scribe |
| `DocumentMagnifyingGlassIcon` | Document with magnifier | PDF Analysis |
| `VideoCameraIcon` | Video camera | Telemedicine |
| `MagnifyingGlassIcon` | Magnifying glass | Search, Symptom Checker |
| `CreditCardIcon` | Credit card | Billing |
| `BriefcaseIcon` | Briefcase | HR |
| `HomeModernIcon` | Modern house | Housekeeping |
| `QueueListIcon` | Stacked lines | Queue |
| `ComputerDesktopIcon` | Desktop computer | Kiosk |
| `ClipboardDocumentCheckIcon` | Clipboard with check | Quality |
| `WrenchScrewdriverIcon` | Tools | Assets |
| `CakeIcon` | Cake | Dietary |
| `CpuChipIcon` | CPU chip | AI Settings |
| `ChartBarIcon` | Bar chart | Reports |
| `PresentationChartLineIcon` | Line chart | Risk Analytics |

---

## Usage Example

```tsx
import {
  Squares2X2Icon,
  UsersIcon,
  CalendarDaysIcon,
  // ... other icons
} from '@heroicons/react/24/outline';

// In navigation component
const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Squares2X2Icon },
  { name: 'Patients', href: '/patients', icon: UsersIcon },
  // ... other items
];
```

---

## Notes

- The HOSPITAL_ADMIN role has access to **all modules** in the system
- Access is configured in both frontend navigation (`MainLayout.tsx`) and backend route authorization
- Icons are 24x24 pixels (outline style) from the Heroicons library
- Some modules share icons based on functional similarity (e.g., Surgery and Blood Bank both use `HeartIcon`)
