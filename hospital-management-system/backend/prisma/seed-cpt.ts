import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Common CPT codes used in UAE healthcare (DHA regulated)
const cptCodesData = [
  // Evaluation & Management (E&M) - 99201-99499
  { code: '99202', description: 'Office or other outpatient visit for the evaluation and management of a new patient (15-29 minutes)', shortDescription: 'New patient, low complexity', category: 'E&M', subcategory: 'Office Visit', basePrice: 150, dhaPrice: 145, cashPrice: 135, requiresPreAuth: false, workRVU: 0.93 },
  { code: '99203', description: 'Office or other outpatient visit for the evaluation and management of a new patient (30-44 minutes)', shortDescription: 'New patient, moderate complexity', category: 'E&M', subcategory: 'Office Visit', basePrice: 250, dhaPrice: 240, cashPrice: 225, requiresPreAuth: false, workRVU: 1.60 },
  { code: '99204', description: 'Office or other outpatient visit for the evaluation and management of a new patient (45-59 minutes)', shortDescription: 'New patient, moderate-high complexity', category: 'E&M', subcategory: 'Office Visit', basePrice: 350, dhaPrice: 340, cashPrice: 315, requiresPreAuth: false, workRVU: 2.60 },
  { code: '99205', description: 'Office or other outpatient visit for the evaluation and management of a new patient (60-74 minutes)', shortDescription: 'New patient, high complexity', category: 'E&M', subcategory: 'Office Visit', basePrice: 450, dhaPrice: 440, cashPrice: 405, requiresPreAuth: false, workRVU: 3.50 },
  { code: '99211', description: 'Office or other outpatient visit for the evaluation and management of an established patient (may not require physician presence)', shortDescription: 'Established patient, minimal', category: 'E&M', subcategory: 'Office Visit', basePrice: 50, dhaPrice: 45, cashPrice: 40, requiresPreAuth: false, workRVU: 0.18 },
  { code: '99212', description: 'Office or other outpatient visit for the evaluation and management of an established patient (10-19 minutes)', shortDescription: 'Established patient, straightforward', category: 'E&M', subcategory: 'Office Visit', basePrice: 100, dhaPrice: 95, cashPrice: 90, requiresPreAuth: false, workRVU: 0.70 },
  { code: '99213', description: 'Office or other outpatient visit for the evaluation and management of an established patient (20-29 minutes)', shortDescription: 'Established patient, low complexity', category: 'E&M', subcategory: 'Office Visit', basePrice: 150, dhaPrice: 145, cashPrice: 135, requiresPreAuth: false, workRVU: 1.30 },
  { code: '99214', description: 'Office or other outpatient visit for the evaluation and management of an established patient (30-39 minutes)', shortDescription: 'Established patient, moderate complexity', category: 'E&M', subcategory: 'Office Visit', basePrice: 200, dhaPrice: 195, cashPrice: 180, requiresPreAuth: false, workRVU: 1.92 },
  { code: '99215', description: 'Office or other outpatient visit for the evaluation and management of an established patient (40-54 minutes)', shortDescription: 'Established patient, high complexity', category: 'E&M', subcategory: 'Office Visit', basePrice: 300, dhaPrice: 290, cashPrice: 270, requiresPreAuth: false, workRVU: 2.80 },

  // Hospital E&M
  { code: '99221', description: 'Initial hospital care, per day (30 minutes)', shortDescription: 'Initial hospital care, low', category: 'E&M', subcategory: 'Hospital Inpatient', basePrice: 250, dhaPrice: 240, cashPrice: 225, requiresPreAuth: false, workRVU: 1.92 },
  { code: '99222', description: 'Initial hospital care, per day (50 minutes)', shortDescription: 'Initial hospital care, moderate', category: 'E&M', subcategory: 'Hospital Inpatient', basePrice: 350, dhaPrice: 340, cashPrice: 315, requiresPreAuth: false, workRVU: 2.61 },
  { code: '99223', description: 'Initial hospital care, per day (70 minutes)', shortDescription: 'Initial hospital care, high', category: 'E&M', subcategory: 'Hospital Inpatient', basePrice: 450, dhaPrice: 440, cashPrice: 405, requiresPreAuth: false, workRVU: 3.86 },
  { code: '99231', description: 'Subsequent hospital care, per day (15 minutes)', shortDescription: 'Subsequent hospital care, low', category: 'E&M', subcategory: 'Hospital Inpatient', basePrice: 100, dhaPrice: 95, cashPrice: 90, requiresPreAuth: false, workRVU: 0.76 },
  { code: '99232', description: 'Subsequent hospital care, per day (25 minutes)', shortDescription: 'Subsequent hospital care, moderate', category: 'E&M', subcategory: 'Hospital Inpatient', basePrice: 150, dhaPrice: 145, cashPrice: 135, requiresPreAuth: false, workRVU: 1.39 },
  { code: '99233', description: 'Subsequent hospital care, per day (35 minutes)', shortDescription: 'Subsequent hospital care, high', category: 'E&M', subcategory: 'Hospital Inpatient', basePrice: 200, dhaPrice: 195, cashPrice: 180, requiresPreAuth: false, workRVU: 2.00 },

  // Emergency E&M
  { code: '99281', description: 'Emergency department visit, minimal', shortDescription: 'ED visit, minimal', category: 'E&M', subcategory: 'Emergency', basePrice: 75, dhaPrice: 70, cashPrice: 65, requiresPreAuth: false, workRVU: 0.45 },
  { code: '99282', description: 'Emergency department visit, low', shortDescription: 'ED visit, low', category: 'E&M', subcategory: 'Emergency', basePrice: 150, dhaPrice: 145, cashPrice: 135, requiresPreAuth: false, workRVU: 0.93 },
  { code: '99283', description: 'Emergency department visit, moderate', shortDescription: 'ED visit, moderate', category: 'E&M', subcategory: 'Emergency', basePrice: 250, dhaPrice: 240, cashPrice: 225, requiresPreAuth: false, workRVU: 1.60 },
  { code: '99284', description: 'Emergency department visit, moderate-high', shortDescription: 'ED visit, moderate-high', category: 'E&M', subcategory: 'Emergency', basePrice: 400, dhaPrice: 390, cashPrice: 360, requiresPreAuth: false, workRVU: 2.74 },
  { code: '99285', description: 'Emergency department visit, high', shortDescription: 'ED visit, high', category: 'E&M', subcategory: 'Emergency', basePrice: 550, dhaPrice: 540, cashPrice: 495, requiresPreAuth: false, workRVU: 4.00 },

  // Consultations
  { code: '99241', description: 'Office consultation for a new or established patient (15 minutes)', shortDescription: 'Office consult, straightforward', category: 'E&M', subcategory: 'Consultation', basePrice: 150, dhaPrice: 145, cashPrice: 135, requiresPreAuth: false, workRVU: 0.64 },
  { code: '99242', description: 'Office consultation for a new or established patient (30 minutes)', shortDescription: 'Office consult, low', category: 'E&M', subcategory: 'Consultation', basePrice: 200, dhaPrice: 195, cashPrice: 180, requiresPreAuth: false, workRVU: 1.29 },
  { code: '99243', description: 'Office consultation for a new or established patient (40 minutes)', shortDescription: 'Office consult, moderate', category: 'E&M', subcategory: 'Consultation', basePrice: 250, dhaPrice: 240, cashPrice: 225, requiresPreAuth: false, workRVU: 1.72 },
  { code: '99244', description: 'Office consultation for a new or established patient (60 minutes)', shortDescription: 'Office consult, moderate-high', category: 'E&M', subcategory: 'Consultation', basePrice: 350, dhaPrice: 340, cashPrice: 315, requiresPreAuth: false, workRVU: 2.58 },
  { code: '99245', description: 'Office consultation for a new or established patient (80 minutes)', shortDescription: 'Office consult, high', category: 'E&M', subcategory: 'Consultation', basePrice: 450, dhaPrice: 440, cashPrice: 405, requiresPreAuth: false, workRVU: 3.40 },

  // Preventive Medicine
  { code: '99385', description: 'Initial comprehensive preventive medicine evaluation (18-39 years)', shortDescription: 'Preventive new patient 18-39', category: 'E&M', subcategory: 'Preventive', basePrice: 300, dhaPrice: 290, cashPrice: 270, requiresPreAuth: false, workRVU: 1.50 },
  { code: '99386', description: 'Initial comprehensive preventive medicine evaluation (40-64 years)', shortDescription: 'Preventive new patient 40-64', category: 'E&M', subcategory: 'Preventive', basePrice: 350, dhaPrice: 340, cashPrice: 315, requiresPreAuth: false, workRVU: 1.75 },
  { code: '99395', description: 'Periodic comprehensive preventive medicine re-evaluation (18-39 years)', shortDescription: 'Preventive est patient 18-39', category: 'E&M', subcategory: 'Preventive', basePrice: 250, dhaPrice: 240, cashPrice: 225, requiresPreAuth: false, workRVU: 1.30 },
  { code: '99396', description: 'Periodic comprehensive preventive medicine re-evaluation (40-64 years)', shortDescription: 'Preventive est patient 40-64', category: 'E&M', subcategory: 'Preventive', basePrice: 300, dhaPrice: 290, cashPrice: 270, requiresPreAuth: false, workRVU: 1.50 },

  // Laboratory - 80000-89999
  { code: '80048', description: 'Basic metabolic panel (Calcium, total)', shortDescription: 'BMP', category: 'Laboratory', subcategory: 'Chemistry', basePrice: 75, dhaPrice: 70, cashPrice: 65, requiresPreAuth: false },
  { code: '80053', description: 'Comprehensive metabolic panel', shortDescription: 'CMP', category: 'Laboratory', subcategory: 'Chemistry', basePrice: 100, dhaPrice: 95, cashPrice: 90, requiresPreAuth: false },
  { code: '80061', description: 'Lipid panel', shortDescription: 'Lipid panel', category: 'Laboratory', subcategory: 'Chemistry', basePrice: 60, dhaPrice: 55, cashPrice: 50, requiresPreAuth: false },
  { code: '82947', description: 'Glucose; quantitative, blood', shortDescription: 'Glucose', category: 'Laboratory', subcategory: 'Chemistry', basePrice: 25, dhaPrice: 22, cashPrice: 20, requiresPreAuth: false },
  { code: '83036', description: 'Hemoglobin; glycosylated (A1C)', shortDescription: 'HbA1c', category: 'Laboratory', subcategory: 'Chemistry', basePrice: 55, dhaPrice: 50, cashPrice: 45, requiresPreAuth: false },
  { code: '84443', description: 'Thyroid stimulating hormone (TSH)', shortDescription: 'TSH', category: 'Laboratory', subcategory: 'Endocrinology', basePrice: 60, dhaPrice: 55, cashPrice: 50, requiresPreAuth: false },
  { code: '85025', description: 'Blood count; complete (CBC), automated', shortDescription: 'CBC with diff', category: 'Laboratory', subcategory: 'Hematology', basePrice: 50, dhaPrice: 45, cashPrice: 40, requiresPreAuth: false },
  { code: '85610', description: 'Prothrombin time (PT)', shortDescription: 'PT', category: 'Laboratory', subcategory: 'Coagulation', basePrice: 35, dhaPrice: 32, cashPrice: 28, requiresPreAuth: false },
  { code: '85730', description: 'Partial thromboplastin time (PTT)', shortDescription: 'PTT', category: 'Laboratory', subcategory: 'Coagulation', basePrice: 40, dhaPrice: 38, cashPrice: 35, requiresPreAuth: false },
  { code: '81001', description: 'Urinalysis, by dip stick or tablet reagent', shortDescription: 'UA with micro', category: 'Laboratory', subcategory: 'Urinalysis', basePrice: 30, dhaPrice: 28, cashPrice: 25, requiresPreAuth: false },
  { code: '87086', description: 'Urine culture, quantitative', shortDescription: 'Urine culture', category: 'Laboratory', subcategory: 'Microbiology', basePrice: 65, dhaPrice: 60, cashPrice: 55, requiresPreAuth: false },

  // Radiology - 70000-79999
  { code: '71046', description: 'Radiologic examination, chest; 2 views', shortDescription: 'Chest X-ray 2 views', category: 'Radiology', subcategory: 'Diagnostic', basePrice: 120, dhaPrice: 115, cashPrice: 108, requiresPreAuth: false, professionalComponent: true, technicalComponent: true },
  { code: '73560', description: 'Radiologic examination, knee; 1 or 2 views', shortDescription: 'Knee X-ray', category: 'Radiology', subcategory: 'Diagnostic', basePrice: 100, dhaPrice: 95, cashPrice: 90, requiresPreAuth: false, professionalComponent: true, technicalComponent: true },
  { code: '73610', description: 'Radiologic examination, ankle; complete', shortDescription: 'Ankle X-ray', category: 'Radiology', subcategory: 'Diagnostic', basePrice: 100, dhaPrice: 95, cashPrice: 90, requiresPreAuth: false, professionalComponent: true, technicalComponent: true },
  { code: '73030', description: 'Radiologic examination, shoulder; complete', shortDescription: 'Shoulder X-ray', category: 'Radiology', subcategory: 'Diagnostic', basePrice: 100, dhaPrice: 95, cashPrice: 90, requiresPreAuth: false, professionalComponent: true, technicalComponent: true },
  { code: '72100', description: 'Radiologic examination, spine, lumbosacral; 2 or 3 views', shortDescription: 'L-spine X-ray', category: 'Radiology', subcategory: 'Diagnostic', basePrice: 120, dhaPrice: 115, cashPrice: 108, requiresPreAuth: false, professionalComponent: true, technicalComponent: true },
  { code: '74018', description: 'Radiologic examination, abdomen; 1 view', shortDescription: 'Abdomen X-ray', category: 'Radiology', subcategory: 'Diagnostic', basePrice: 100, dhaPrice: 95, cashPrice: 90, requiresPreAuth: false, professionalComponent: true, technicalComponent: true },

  // CT Scans
  { code: '70450', description: 'Computed tomography, head or brain; without contrast material', shortDescription: 'CT Head w/o contrast', category: 'Radiology', subcategory: 'CT', basePrice: 800, dhaPrice: 780, cashPrice: 720, requiresPreAuth: true, professionalComponent: true, technicalComponent: true },
  { code: '71250', description: 'Computed tomography, thorax; without contrast material', shortDescription: 'CT Chest w/o contrast', category: 'Radiology', subcategory: 'CT', basePrice: 900, dhaPrice: 880, cashPrice: 810, requiresPreAuth: true, professionalComponent: true, technicalComponent: true },
  { code: '74176', description: 'Computed tomography, abdomen and pelvis; without contrast material', shortDescription: 'CT Abd/Pelvis w/o contrast', category: 'Radiology', subcategory: 'CT', basePrice: 1100, dhaPrice: 1080, cashPrice: 990, requiresPreAuth: true, professionalComponent: true, technicalComponent: true },

  // MRI
  { code: '70553', description: 'Magnetic resonance imaging, brain; without contrast material, followed by contrast material(s) and further sequences', shortDescription: 'MRI Brain w/ and w/o contrast', category: 'Radiology', subcategory: 'MRI', basePrice: 1500, dhaPrice: 1450, cashPrice: 1350, requiresPreAuth: true, professionalComponent: true, technicalComponent: true },
  { code: '72148', description: 'Magnetic resonance imaging, spinal canal and contents, lumbar; without contrast material', shortDescription: 'MRI L-spine w/o contrast', category: 'Radiology', subcategory: 'MRI', basePrice: 1400, dhaPrice: 1350, cashPrice: 1260, requiresPreAuth: true, professionalComponent: true, technicalComponent: true },
  { code: '73721', description: 'Magnetic resonance imaging, any joint of lower extremity; without contrast material', shortDescription: 'MRI Knee w/o contrast', category: 'Radiology', subcategory: 'MRI', basePrice: 1200, dhaPrice: 1150, cashPrice: 1080, requiresPreAuth: true, professionalComponent: true, technicalComponent: true },

  // Ultrasound
  { code: '76700', description: 'Ultrasound, abdominal, real time with image documentation; complete', shortDescription: 'US Abdomen complete', category: 'Radiology', subcategory: 'Ultrasound', basePrice: 350, dhaPrice: 340, cashPrice: 315, requiresPreAuth: false, professionalComponent: true, technicalComponent: true },
  { code: '76856', description: 'Ultrasound, pelvic (nonobstetric), real time with image documentation; complete', shortDescription: 'US Pelvis complete', category: 'Radiology', subcategory: 'Ultrasound', basePrice: 300, dhaPrice: 290, cashPrice: 270, requiresPreAuth: false, professionalComponent: true, technicalComponent: true },
  { code: '93306', description: 'Echocardiography, transthoracic, real-time with image documentation; complete', shortDescription: 'Echo complete', category: 'Radiology', subcategory: 'Ultrasound', basePrice: 500, dhaPrice: 480, cashPrice: 450, requiresPreAuth: false, professionalComponent: true, technicalComponent: true },

  // Cardiology - 93000-93799
  { code: '93000', description: 'Electrocardiogram, routine ECG with at least 12 leads; with interpretation and report', shortDescription: 'ECG 12-lead', category: 'Cardiology', subcategory: 'Diagnostic', basePrice: 80, dhaPrice: 75, cashPrice: 70, requiresPreAuth: false },
  { code: '93015', description: 'Cardiovascular stress test using maximal or submaximal treadmill', shortDescription: 'Stress test', category: 'Cardiology', subcategory: 'Diagnostic', basePrice: 400, dhaPrice: 380, cashPrice: 360, requiresPreAuth: false },
  { code: '93224', description: 'External electrocardiographic recording up to 48 hours', shortDescription: 'Holter 48hr', category: 'Cardiology', subcategory: 'Monitoring', basePrice: 300, dhaPrice: 290, cashPrice: 270, requiresPreAuth: false },
  { code: '93880', description: 'Duplex scan of extracranial arteries; complete bilateral study', shortDescription: 'Carotid doppler bilateral', category: 'Cardiology', subcategory: 'Vascular', basePrice: 450, dhaPrice: 440, cashPrice: 405, requiresPreAuth: false },

  // Pulmonology
  { code: '94010', description: 'Spirometry, including graphic record, total and timed vital capacity', shortDescription: 'Spirometry', category: 'Pulmonology', subcategory: 'Diagnostic', basePrice: 150, dhaPrice: 145, cashPrice: 135, requiresPreAuth: false },
  { code: '94375', description: 'Respiratory flow volume loop', shortDescription: 'Flow volume loop', category: 'Pulmonology', subcategory: 'Diagnostic', basePrice: 100, dhaPrice: 95, cashPrice: 90, requiresPreAuth: false },
  { code: '94760', description: 'Noninvasive ear or pulse oximetry for oxygen saturation', shortDescription: 'Pulse oximetry', category: 'Pulmonology', subcategory: 'Monitoring', basePrice: 25, dhaPrice: 22, cashPrice: 20, requiresPreAuth: false },

  // Surgery - Minor procedures
  { code: '10060', description: 'Incision and drainage of abscess; simple or single', shortDescription: 'I&D abscess simple', category: 'Surgery', subcategory: 'Minor', basePrice: 250, dhaPrice: 240, cashPrice: 225, requiresPreAuth: false, globalPeriod: 10 },
  { code: '11042', description: 'Debridement, subcutaneous tissue', shortDescription: 'Debridement subQ', category: 'Surgery', subcategory: 'Minor', basePrice: 200, dhaPrice: 195, cashPrice: 180, requiresPreAuth: false, globalPeriod: 0 },
  { code: '12001', description: 'Simple repair of superficial wounds; 2.5 cm or less', shortDescription: 'Simple repair ≤2.5cm', category: 'Surgery', subcategory: 'Minor', basePrice: 200, dhaPrice: 195, cashPrice: 180, requiresPreAuth: false, globalPeriod: 10 },
  { code: '12002', description: 'Simple repair of superficial wounds; 2.6 cm to 7.5 cm', shortDescription: 'Simple repair 2.6-7.5cm', category: 'Surgery', subcategory: 'Minor', basePrice: 250, dhaPrice: 240, cashPrice: 225, requiresPreAuth: false, globalPeriod: 10 },
  { code: '17000', description: 'Destruction of premalignant lesions; first lesion', shortDescription: 'Destruct premalign 1st', category: 'Surgery', subcategory: 'Skin', basePrice: 150, dhaPrice: 145, cashPrice: 135, requiresPreAuth: false, globalPeriod: 10 },
  { code: '17110', description: 'Destruction of benign lesions; up to 14 lesions', shortDescription: 'Destruct benign ≤14', category: 'Surgery', subcategory: 'Skin', basePrice: 200, dhaPrice: 195, cashPrice: 180, requiresPreAuth: false, globalPeriod: 10 },

  // Injections/Infusions
  { code: '96372', description: 'Therapeutic, prophylactic, or diagnostic injection; subcutaneous or intramuscular', shortDescription: 'IM/SubQ injection', category: 'Injection', subcategory: 'Therapeutic', basePrice: 50, dhaPrice: 45, cashPrice: 40, requiresPreAuth: false },
  { code: '96374', description: 'Therapeutic, prophylactic, or diagnostic injection; intravenous push, single or initial substance/drug', shortDescription: 'IV push initial', category: 'Injection', subcategory: 'Therapeutic', basePrice: 100, dhaPrice: 95, cashPrice: 90, requiresPreAuth: false },
  { code: '96365', description: 'Intravenous infusion, for therapy, prophylaxis, or diagnosis; initial, up to 1 hour', shortDescription: 'IV infusion 1st hr', category: 'Injection', subcategory: 'Infusion', basePrice: 150, dhaPrice: 145, cashPrice: 135, requiresPreAuth: false },
  { code: '96366', description: 'Intravenous infusion; each additional hour', shortDescription: 'IV infusion add hr', category: 'Injection', subcategory: 'Infusion', basePrice: 75, dhaPrice: 70, cashPrice: 65, requiresPreAuth: false },
  { code: '90471', description: 'Immunization administration; 1 vaccine (single or combination)', shortDescription: 'Immunization admin 1st', category: 'Injection', subcategory: 'Immunization', basePrice: 35, dhaPrice: 32, cashPrice: 28, requiresPreAuth: false },
  { code: '90472', description: 'Immunization administration; each additional vaccine', shortDescription: 'Immunization admin addl', category: 'Injection', subcategory: 'Immunization', basePrice: 25, dhaPrice: 22, cashPrice: 20, requiresPreAuth: false },

  // Physical Therapy
  { code: '97110', description: 'Therapeutic exercises to develop strength and endurance', shortDescription: 'Therapeutic exercise', category: 'Physical Therapy', subcategory: 'Therapeutic', basePrice: 75, dhaPrice: 70, cashPrice: 65, requiresPreAuth: false },
  { code: '97140', description: 'Manual therapy techniques', shortDescription: 'Manual therapy', category: 'Physical Therapy', subcategory: 'Therapeutic', basePrice: 75, dhaPrice: 70, cashPrice: 65, requiresPreAuth: false },
  { code: '97530', description: 'Therapeutic activities, direct (one-on-one) patient contact', shortDescription: 'Therapeutic activities', category: 'Physical Therapy', subcategory: 'Therapeutic', basePrice: 75, dhaPrice: 70, cashPrice: 65, requiresPreAuth: false },
  { code: '97012', description: 'Application of a modality; traction, mechanical', shortDescription: 'Mech traction', category: 'Physical Therapy', subcategory: 'Modality', basePrice: 50, dhaPrice: 45, cashPrice: 40, requiresPreAuth: false },

  // Ophthalmology
  { code: '92004', description: 'Ophthalmological services: medical examination and evaluation, with initiation or continuation of diagnostic and treatment program; comprehensive, new patient', shortDescription: 'Comprehensive eye exam new', category: 'Ophthalmology', subcategory: 'Exam', basePrice: 200, dhaPrice: 195, cashPrice: 180, requiresPreAuth: false },
  { code: '92014', description: 'Ophthalmological services: medical examination and evaluation, with initiation or continuation of diagnostic and treatment program; comprehensive, established patient', shortDescription: 'Comprehensive eye exam est', category: 'Ophthalmology', subcategory: 'Exam', basePrice: 175, dhaPrice: 170, cashPrice: 158, requiresPreAuth: false },
  { code: '92083', description: 'Visual field examination, unilateral or bilateral, with interpretation and report', shortDescription: 'Visual field test', category: 'Ophthalmology', subcategory: 'Diagnostic', basePrice: 120, dhaPrice: 115, cashPrice: 108, requiresPreAuth: false },

  // ENT
  { code: '92557', description: 'Comprehensive audiometry threshold evaluation and speech recognition', shortDescription: 'Audiometry comprehensive', category: 'ENT', subcategory: 'Audiology', basePrice: 150, dhaPrice: 145, cashPrice: 135, requiresPreAuth: false },
  { code: '31231', description: 'Nasal endoscopy, diagnostic, unilateral or bilateral', shortDescription: 'Nasal endoscopy dx', category: 'ENT', subcategory: 'Endoscopy', basePrice: 250, dhaPrice: 240, cashPrice: 225, requiresPreAuth: false },

  // GI Procedures
  { code: '43239', description: 'Esophagogastroduodenoscopy, with biopsy', shortDescription: 'EGD with biopsy', category: 'GI', subcategory: 'Endoscopy', basePrice: 1500, dhaPrice: 1450, cashPrice: 1350, requiresPreAuth: true, globalPeriod: 0 },
  { code: '45378', description: 'Colonoscopy, flexible; diagnostic', shortDescription: 'Colonoscopy diagnostic', category: 'GI', subcategory: 'Endoscopy', basePrice: 1800, dhaPrice: 1750, cashPrice: 1620, requiresPreAuth: true, globalPeriod: 0 },
  { code: '45380', description: 'Colonoscopy with biopsy', shortDescription: 'Colonoscopy with biopsy', category: 'GI', subcategory: 'Endoscopy', basePrice: 2000, dhaPrice: 1950, cashPrice: 1800, requiresPreAuth: true, globalPeriod: 0 },
];

// CPT Modifiers
const modifiersData = [
  { code: '25', description: 'Significant, Separately Identifiable Evaluation and Management Service by the Same Physician on the Same Day of the Procedure or Other Service', priceImpact: 1.0 },
  { code: '26', description: 'Professional Component', priceImpact: 0.40 },
  { code: '50', description: 'Bilateral Procedure', priceImpact: 1.50 },
  { code: '51', description: 'Multiple Procedures', priceImpact: 0.50 },
  { code: '52', description: 'Reduced Services', priceImpact: 0.50 },
  { code: '59', description: 'Distinct Procedural Service', priceImpact: 1.0 },
  { code: '76', description: 'Repeat Procedure or Service by Same Physician', priceImpact: 1.0 },
  { code: '77', description: 'Repeat Procedure by Another Physician', priceImpact: 1.0 },
  { code: 'LT', description: 'Left Side', priceImpact: 1.0 },
  { code: 'RT', description: 'Right Side', priceImpact: 1.0 },
  { code: 'TC', description: 'Technical Component', priceImpact: 0.60 },
  { code: 'XE', description: 'Separate Encounter', priceImpact: 1.0 },
  { code: 'XP', description: 'Separate Practitioner', priceImpact: 1.0 },
  { code: 'XS', description: 'Separate Structure', priceImpact: 1.0 },
  { code: 'XU', description: 'Unusual Non-Overlapping Service', priceImpact: 1.0 },
  { code: 'GP', description: 'Services delivered under an outpatient physical therapy plan of care', priceImpact: 1.0 },
  { code: 'GO', description: 'Services delivered under an outpatient occupational therapy plan of care', priceImpact: 1.0 },
  { code: 'GN', description: 'Services delivered under an outpatient speech-language pathology plan of care', priceImpact: 1.0 },
];

async function seedCPTCodes() {
  console.log('🏥 Seeding CPT codes and modifiers...\n');

  // Find the hospital
  const hospital = await prisma.hospital.findFirst({
    where: { code: 'HMS001' },
  });

  if (!hospital) {
    console.error('❌ No hospital found. Run the main seed first.');
    return;
  }

  console.log(`Found hospital: ${hospital.name}\n`);

  // Seed CPT Codes
  let cptCreated = 0;
  let cptUpdated = 0;

  console.log('📋 Seeding CPT codes...');
  for (const codeData of cptCodesData) {
    try {
      const existing = await prisma.cPTCode.findFirst({
        where: { hospitalId: hospital.id, code: codeData.code },
      });

      if (existing) {
        await prisma.cPTCode.update({
          where: { id: existing.id },
          data: {
            description: codeData.description,
            shortDescription: codeData.shortDescription,
            category: codeData.category,
            subcategory: codeData.subcategory,
            basePrice: codeData.basePrice,
            dhaPrice: codeData.dhaPrice,
            cashPrice: codeData.cashPrice,
            requiresPreAuth: codeData.requiresPreAuth,
            workRVU: codeData.workRVU,
            globalPeriod: codeData.globalPeriod,
            professionalComponent: codeData.professionalComponent,
            technicalComponent: codeData.technicalComponent,
          },
        });
        cptUpdated++;
      } else {
        await prisma.cPTCode.create({
          data: {
            hospitalId: hospital.id,
            code: codeData.code,
            description: codeData.description,
            shortDescription: codeData.shortDescription,
            category: codeData.category,
            subcategory: codeData.subcategory,
            basePrice: codeData.basePrice,
            dhaPrice: codeData.dhaPrice,
            cashPrice: codeData.cashPrice,
            requiresPreAuth: codeData.requiresPreAuth ?? false,
            workRVU: codeData.workRVU,
            globalPeriod: codeData.globalPeriod,
            professionalComponent: codeData.professionalComponent ?? false,
            technicalComponent: codeData.technicalComponent ?? false,
          },
        });
        cptCreated++;
      }
    } catch (error) {
      console.error(`Failed to seed CPT code ${codeData.code}:`, error);
    }
  }

  console.log(`  ✓ Created ${cptCreated} CPT codes`);
  console.log(`  ✓ Updated ${cptUpdated} CPT codes`);

  // Seed Modifiers
  let modCreated = 0;
  let modUpdated = 0;

  console.log('\n📋 Seeding CPT modifiers...');
  for (const modData of modifiersData) {
    try {
      const existing = await prisma.cPTModifier.findFirst({
        where: { hospitalId: hospital.id, code: modData.code },
      });

      if (existing) {
        await prisma.cPTModifier.update({
          where: { id: existing.id },
          data: {
            description: modData.description,
            priceImpact: modData.priceImpact,
          },
        });
        modUpdated++;
      } else {
        await prisma.cPTModifier.create({
          data: {
            hospitalId: hospital.id,
            code: modData.code,
            description: modData.description,
            priceImpact: modData.priceImpact,
          },
        });
        modCreated++;
      }
    } catch (error) {
      console.error(`Failed to seed modifier ${modData.code}:`, error);
    }
  }

  console.log(`  ✓ Created ${modCreated} CPT modifiers`);
  console.log(`  ✓ Updated ${modUpdated} CPT modifiers`);

  console.log(`\n✅ CPT seeding complete! Total: ${cptCodesData.length} codes, ${modifiersData.length} modifiers`);
}

// Main execution
seedCPTCodes()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
