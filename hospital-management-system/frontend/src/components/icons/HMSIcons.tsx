import React from 'react';

// Icon component type
export interface IconProps {
  className?: string;
}

// 1. Hospital Building with AI Chip
export const HospitalAIIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h4m0 0V9m0 12h10m0 0V9m0 12h4M7 9V7a1 1 0 011-1h3V4a1 1 0 011-1h0a1 1 0 011 1v2h3a1 1 0 011 1v2m-10 4h2m-2 4h2m6-4h2m-2 4h2M9 9h6M10 13h4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 6h4v4h-4V6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7h2m-2 2h2m-1-1.5v1" />
    <text x="17" y="8.5" fontSize="2.5" fontWeight="bold" fill="currentColor" strokeWidth={0.3}>AI</text>
  </svg>
);

// 2. Stethoscope with AI Nodes
export const StethoscopeAIIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4a4 4 0 004 4 4 4 0 004-4V3M8 3a1 1 0 00-1 1v3M16 3a1 1 0 011 1v3M12 11v0a7 7 0 00-7 7v0a2 2 0 002 2h0a2 2 0 002-2v-2" />
    <circle cx="18" cy="14" r="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="20" cy="11" r="0.8" fill="currentColor" />
    <circle cx="22" cy="13" r="0.8" fill="currentColor" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 11l-2 3m2-3l2 2" strokeWidth={1} />
  </svg>
);

// 3. Hospital Bed with IV Stand
export const HospitalBedIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 14h18M3 14v4a1 1 0 001 1h0a1 1 0 001-1v-1m-2-3V9a2 2 0 012-2h12a2 2 0 012 2v5m-2 4v1a1 1 0 001 1h0a1 1 0 001-1v-4" />
    <circle cx="7" cy="10" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 5v9m0-9h-1.5m1.5 0h1.5M19 9h-1m1 0h1" />
    <circle cx="19" cy="3" r="1" fill="currentColor" />
  </svg>
);

// 4. Patient/Person Icon
export const PatientIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <circle cx="12" cy="7" r="3" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H11a4 4 0 00-4 4v2" />
    <circle cx="17" cy="18" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 5. Doctor with AI Badge
export const DoctorAIIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <circle cx="10" cy="7" r="3" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 21v-2a4 4 0 014-4h2a4 4 0 014 4v2M14 8a3 3 0 013-3" />
    <circle cx="18" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
    <text x="16.5" y="8.5" fontSize="3" fontWeight="bold" fill="currentColor" strokeWidth={0.2}>AI</text>
  </svg>
);

// 6. ECG Monitor with AI
export const ECGMonitorAIIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <rect x="2" y="4" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 11h3l1.5-3 2 6 1.5-3h3" strokeWidth={1.8} />
    <circle cx="19" cy="7" r="0.8" fill="currentColor" />
    <circle cx="20.5" cy="9" r="0.8" fill="currentColor" />
    <circle cx="17.5" cy="9" r="0.8" fill="currentColor" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7v2m-1.5 0l1.5-2m0 2l1.5-2" strokeWidth={0.8} />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 18v2m20-2v2" />
  </svg>
);

// 7. Rx Prescription with AI
export const PrescriptionIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h8l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
    <text x="7" y="13" fontSize="7" fontWeight="bold" fill="currentColor" strokeWidth={0.3}>Rx</text>
    <circle cx="19" cy="6" r="0.8" fill="currentColor" />
    <circle cx="20.5" cy="8" r="0.8" fill="currentColor" />
    <circle cx="17.5" cy="8" r="0.8" fill="currentColor" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 6v2m-1.5 0l1.5-2m0 2l1.5-2" strokeWidth={0.8} />
  </svg>
);

// 8. Ambulance
export const AmbulanceIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h10m0 0V8a1 1 0 011-1h4l3 4v2m-8 0h8M6 19a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h2m-1-1v2" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 13h8v4H3v-4h10" />
  </svg>
);

// 9. X-Ray / Chest Scan
export const XRayIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <rect x="4" y="3" width="16" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6M9 7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V9a2 2 0 00-2-2M9 7v8m6-8v8M10 11h4M10 13h4" />
    <circle cx="18" cy="6" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="6" r="0.5" fill="currentColor" />
  </svg>
);

// 10. Clinic/Hospital House
export const ClinicHouseIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V10l7-7 7 7v11M9 21v-6a1 1 0 011-1h4a1 1 0 011 1v6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8h0m0 0h1.5m-1.5 0h-1.5m1.5 0v1.5m0-1.5V6.5m0 3h-1.5m1.5 0h1.5m-1.5 1.5h0" strokeWidth={2} />
  </svg>
);

// 11. Medical Report Clipboard with AI
export const MedicalReportAIIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 2h6a1 1 0 011 1v1H8V3a1 1 0 011-1z" />
    <rect x="6" y="4" width="12" height="18" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h3m-3 3h6m-6 3h4" strokeWidth={1.3} />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 9h1.5m0 0h-1.5m1.5 0v1.5m0-1.5V7.5m1 1.5h0" strokeWidth={1.8} />
    <circle cx="16" cy="17" r="0.8" fill="currentColor" />
    <circle cx="14.5" cy="19" r="0.8" fill="currentColor" />
    <circle cx="17.5" cy="19" r="0.8" fill="currentColor" />
    <text x="13.5" y="18.5" fontSize="2" fontWeight="bold" fill="currentColor" strokeWidth={0.2}>AI</text>
  </svg>
);

// 12. Syringe
export const SyringeIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 4l-1-1-2 2M17 5l-9 9-2 2-2 4 4-2 2-2 9-9m0 0l2-2-1-1-2 2m0 0l-2-2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 12l2 2" strokeWidth={2} />
    <circle cx="21" cy="3" r="0.8" fill="currentColor" />
  </svg>
);

// 13. Surgical Tools
export const SurgicalToolsIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v7a1 1 0 001 1h0a1 1 0 001-1V3M6 3h2M6 10v10m2-10v10" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l5 9m0 0v7m0-7h2m-2 0h-2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 3v9a1 1 0 01-1 1h-2a1 1 0 01-1-1V3" strokeWidth={1.3} />
  </svg>
);

// 14. Wheelchair
export const WheelchairIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <circle cx="8" cy="6" r="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 8v5m0 0a5 5 0 105 5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h5l2-5" />
    <circle cx="17" cy="18" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 15. Notification Bell
export const NotificationBellIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    <circle cx="19" cy="5" r="0.8" fill="currentColor" />
    <circle cx="21" cy="6" r="0.8" fill="currentColor" />
  </svg>
);

// 16. IV Drip Bag
export const IVDripIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 2h4M12 2v3m-3 3h6a2 2 0 012 2v6a4 4 0 01-4 4H11a4 4 0 01-4-4v-6a2 2 0 012-2z" />
    <circle cx="12" cy="12" r="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 17v5m0 0h-1m1 0h1" />
    <circle cx="17" cy="9" r="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 17. DNA Helix with AI
export const DNAAIIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 3c0 4 2.5 8 5 8s5-4 5-8M7 21c0-4 2.5-8 5-8s5 4 5 8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6M9 12h6M9 17h6" strokeWidth={1} />
    <circle cx="19" cy="7" r="0.8" fill="currentColor" />
    <circle cx="20.5" cy="9" r="0.8" fill="currentColor" />
    <circle cx="17.5" cy="9" r="0.8" fill="currentColor" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7v2m-1.5 0l1.5-2m0 2l1.5-2" strokeWidth={0.8} />
  </svg>
);

// 18. Calendar with Money/Billing
export const CalendarBillingIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M7 3v4m10-4v4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h1.5m1.5 0h1.5M9 16h1.5m1.5 0h1.5M9 19h1.5m1.5 0h1.5" strokeWidth={1} />
    <text x="13.5" y="16.5" fontSize="4" fontWeight="bold" fill="currentColor" strokeWidth={0.3}>$</text>
  </svg>
);

// 19. Medical Records/Documents
export const MedicalRecordsIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6M9 11h6M9 15h4" strokeWidth={1.3} />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h2v2h-2v-2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 17v-1m1 1h-1" strokeWidth={0.8} />
  </svg>
);

// 20. Medical Cross with Heartbeat
export const MedicalCrossHeartbeatIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M2 12h20" strokeWidth={2.5} />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h3l1.5-3 2 6 1.5-3h3" strokeWidth={1.5} />
    <rect x="8" y="8" width="8" height="8" rx="1" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth={1.2} />
  </svg>
);

// 21. Heartbeat/Vital Signs Icon
export const HeartbeatIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h2l1.5-3 2 6 1.5-3h2" strokeWidth={1.8} />
  </svg>
);

// 22. Medical Shield/Protection Icon
export const MedicalShieldIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 0v2m0-2h2m-2 0h-2" strokeWidth={2} />
  </svg>
);

// Medical Clipboard with AI Chip (Vitals)
export const VitalsClipboardAIIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    {/* Clipboard clip at top */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.5h6a1 1 0 011 1v.5H8v-.5a1 1 0 011-1z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 2.5h2a.5.5 0 01.5.5v.5h-3V3a.5.5 0 01.5-.5z" />
    {/* Clipboard body */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 5h10a1.5 1.5 0 011.5 1.5v13a1.5 1.5 0 01-1.5 1.5H7a1.5 1.5 0 01-1.5-1.5v-13A1.5 1.5 0 017 5z" />
    {/* Medical cross */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 9v3M9 10.5h3" />
    {/* Document lines */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.5h4M9 16.5h3" />
    {/* AI chip bottom-right */}
    <rect x="14.5" y="15" width="4" height="4" rx="0.5" strokeLinecap="round" strokeLinejoin="round" />
    <text x="15.3" y="18.2" fill="currentColor" stroke="none" fontSize="3" fontWeight="bold" fontFamily="sans-serif">AI</text>
    {/* AI chip pins */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 15v-.7M17.5 15v-.7M19.5 16.5h-.7M19.5 17.5h-.7" />
  </svg>
);

// AI Doc Clipboard Icon (clipboard with cloud clip, medical cross, lines, and AI chip)
// Designed for crisp, thick, visible lines
export const AIDocClipboardIcon: React.FC<IconProps> = ({ className = 'h-6 w-6' }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    {/* Clipboard body */}
    <rect x="3" y="4" width="12" height="16" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Cloud clip at top */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4V3a2 2 0 012-2h0a2 2 0 012 2v1" />
    {/* Medical cross - thicker */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7v3M6 8.5h3" strokeWidth={2.5} />
    {/* Document lines - thicker */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 13h5M6 15.5h4M6 18h3" strokeWidth={2} />
    {/* AI Chip - bottom right */}
    <rect x="14" y="13" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <text x="15" y="18" fill="currentColor" stroke="none" fontSize="5" fontWeight="bold" fontFamily="sans-serif">AI</text>
    {/* Chip pins - thicker */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 13v-1.5M19 13v-1.5M14 15h-1.5M14 18h-1.5M16 20v1.5M19 20v1.5M21 15h1.5M21 18h1.5" strokeWidth={1.5} />
  </svg>
);

// Export all icons as a collection
export const HMSIcons = {
  AIDocClipboard: AIDocClipboardIcon,
  HospitalAI: HospitalAIIcon,
  StethoscopeAI: StethoscopeAIIcon,
  HospitalBed: HospitalBedIcon,
  Patient: PatientIcon,
  DoctorAI: DoctorAIIcon,
  ECGMonitorAI: ECGMonitorAIIcon,
  Prescription: PrescriptionIcon,
  Ambulance: AmbulanceIcon,
  XRay: XRayIcon,
  ClinicHouse: ClinicHouseIcon,
  MedicalReportAI: MedicalReportAIIcon,
  Syringe: SyringeIcon,
  SurgicalTools: SurgicalToolsIcon,
  Wheelchair: WheelchairIcon,
  NotificationBell: NotificationBellIcon,
  IVDrip: IVDripIcon,
  DNAAI: DNAAIIcon,
  CalendarBilling: CalendarBillingIcon,
  MedicalRecords: MedicalRecordsIcon,
  MedicalCrossHeartbeat: MedicalCrossHeartbeatIcon,
  Heartbeat: HeartbeatIcon,
  MedicalShield: MedicalShieldIcon,
  VitalsClipboardAI: VitalsClipboardAIIcon,
};

export default HMSIcons;
