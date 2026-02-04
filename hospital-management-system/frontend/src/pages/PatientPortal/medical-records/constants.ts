// Shared constants and utility functions for the unified Medical Records page

export const visitTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  OPD: { label: 'Outpatient', color: 'text-blue-700', bg: 'bg-blue-100' },
  IPD: { label: 'Inpatient', color: 'text-purple-700', bg: 'bg-purple-100' },
  EMERGENCY: { label: 'Emergency', color: 'text-red-700', bg: 'bg-red-100' },
  TELEMEDICINE: { label: 'Telemedicine', color: 'text-green-700', bg: 'bg-green-100' },
  HOME_VISIT: { label: 'Home Visit', color: 'text-amber-700', bg: 'bg-amber-100' },
};

export const diagnosisTypeConfig: Record<string, { label: string; color: string }> = {
  PRIMARY: { label: 'Primary', color: 'bg-blue-500' },
  SECONDARY: { label: 'Secondary', color: 'bg-gray-400' },
  ADMITTING: { label: 'Admitting', color: 'bg-purple-500' },
};

export const ALLERGY_TYPES = [
  { value: 'DRUG', label: 'Drug/Medication' },
  { value: 'FOOD', label: 'Food' },
  { value: 'ENVIRONMENTAL', label: 'Environmental' },
  { value: 'OTHER', label: 'Other' },
];

export const SEVERITY_LEVELS = [
  { value: 'MILD', label: 'Mild', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'MODERATE', label: 'Moderate', color: 'bg-orange-100 text-orange-800' },
  { value: 'SEVERE', label: 'Severe', color: 'bg-red-100 text-red-800' },
  { value: 'LIFE_THREATENING', label: 'Life-Threatening', color: 'bg-red-200 text-red-900' },
];

export const COMMON_CONDITIONS = [
  'Diabetes Type 1', 'Diabetes Type 2', 'Hypertension', 'Asthma', 'COPD',
  'Heart Disease', 'Arthritis', 'Thyroid Disorder', 'High Cholesterol', 'Anxiety',
  'Depression', 'Migraine', 'Epilepsy', 'Cancer', 'Kidney Disease',
];

export const COMMON_ALLERGIES = {
  DRUG: ['Penicillin', 'Aspirin', 'Ibuprofen', 'Sulfa drugs', 'Codeine', 'Morphine'],
  FOOD: ['Peanuts', 'Tree nuts', 'Shellfish', 'Eggs', 'Milk', 'Wheat', 'Soy', 'Fish'],
  ENVIRONMENTAL: ['Pollen', 'Dust mites', 'Pet dander', 'Mold', 'Latex', 'Bee stings'],
};

// Mock data for visit history (used when API is unavailable)
export const mockRecords = [
  {
    id: '1',
    visitDate: '2024-12-20T10:30:00Z',
    visitType: 'OPD' as const,
    chiefComplaint: 'Persistent headache and mild fever for 3 days',
    historyOfPresentIllness: 'Patient reports gradual onset headache, mild fever (100.2F), and general malaise. No recent travel or sick contacts.',
    pastMedicalHistory: 'Hypertension - well controlled on medication. No known drug allergies.',
    allergies: ['Penicillin', 'Sulfa drugs'],
    medications: ['Lisinopril 10mg daily', 'Aspirin 81mg daily'],
    physicalExamination: 'Alert and oriented. Mild tenderness on frontal region. HEENT unremarkable. Lungs clear bilaterally.',
    vitalSigns: {
      bloodPressureSystolic: 128, bloodPressureDiastolic: 82, heartRate: 78,
      temperature: 100.2, respiratoryRate: 16, oxygenSaturation: 98,
      weight: 175, height: 70, bmi: 25.1,
    },
    diagnoses: [
      { id: 'd1', code: 'R51', description: 'Headache, unspecified', type: 'PRIMARY' as const, notes: 'Likely tension-type headache' },
      { id: 'd2', code: 'R50.9', description: 'Fever, unspecified', type: 'SECONDARY' as const, notes: 'Low-grade, likely viral' },
    ],
    treatmentPlan: 'Symptomatic treatment with rest, hydration, and OTC analgesics. Monitor temperature.',
    instructions: 'Take acetaminophen 500mg every 6 hours as needed. Drink plenty of fluids. Rest for 2-3 days. Return if symptoms worsen or fever persists beyond 5 days.',
    followUpDate: '2024-12-27',
    notes: 'Patient counseled on warning signs. Appears to understand instructions.',
    doctor: { id: 'doc1', specialization: 'Internal Medicine', user: { firstName: 'Sarah', lastName: 'Johnson' } },
    department: { id: 'dept1', name: 'General Medicine' },
    attachments: [{ id: 'att1', name: 'Lab Report - CBC', type: 'application/pdf', url: '/reports/cbc-123.pdf' }],
    createdAt: '2024-12-20T11:00:00Z',
  },
  {
    id: '2',
    visitDate: '2024-11-15T14:00:00Z',
    visitType: 'OPD' as const,
    chiefComplaint: 'Annual health checkup',
    historyOfPresentIllness: 'Patient here for routine annual physical examination. No acute complaints.',
    vitalSigns: {
      bloodPressureSystolic: 122, bloodPressureDiastolic: 78, heartRate: 72,
      temperature: 98.6, respiratoryRate: 14, oxygenSaturation: 99,
      weight: 170, height: 70, bmi: 24.4,
    },
    diagnoses: [
      { id: 'd3', code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings', type: 'PRIMARY' as const },
    ],
    procedures: [
      { id: 'p1', code: '36415', name: 'Venipuncture for blood collection', date: '2024-11-15' },
      { id: 'p2', code: '81001', name: 'Urinalysis', date: '2024-11-15' },
    ],
    treatmentPlan: 'Continue current medications. Follow up annually or as needed.',
    followUpDate: '2025-11-15',
    doctor: { id: 'doc1', specialization: 'Internal Medicine', user: { firstName: 'Sarah', lastName: 'Johnson' } },
    department: { id: 'dept1', name: 'General Medicine' },
    createdAt: '2024-11-15T15:30:00Z',
  },
  {
    id: '3',
    visitDate: '2024-10-05T09:00:00Z',
    visitType: 'EMERGENCY' as const,
    chiefComplaint: 'Severe chest pain radiating to left arm',
    historyOfPresentIllness: 'Patient presented with sudden onset severe chest pain, diaphoresis, and nausea. Pain described as crushing, 8/10 severity.',
    physicalExamination: 'Patient appears distressed. Diaphoretic. Cardiac exam: S1S2 regular, no murmurs. Lungs clear.',
    vitalSigns: {
      bloodPressureSystolic: 160, bloodPressureDiastolic: 95, heartRate: 102,
      temperature: 98.8, respiratoryRate: 22, oxygenSaturation: 95,
    },
    diagnoses: [
      { id: 'd4', code: 'I21.0', description: 'ST elevation myocardial infarction (STEMI) of anterior wall', type: 'PRIMARY' as const },
      { id: 'd5', code: 'I10', description: 'Essential hypertension', type: 'SECONDARY' as const },
    ],
    procedures: [
      { id: 'p3', code: '92941', name: 'Percutaneous transluminal coronary angioplasty with stent', date: '2024-10-05' },
    ],
    treatmentPlan: 'Emergency PCI performed. Post-procedure monitoring in CCU. Start dual antiplatelet therapy.',
    doctor: { id: 'doc2', specialization: 'Cardiology', user: { firstName: 'Michael', lastName: 'Chen' } },
    department: { id: 'dept2', name: 'Cardiology' },
    createdAt: '2024-10-05T12:00:00Z',
  },
];

// Utility functions

export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export const formatDisplayDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '-';
  }
};
