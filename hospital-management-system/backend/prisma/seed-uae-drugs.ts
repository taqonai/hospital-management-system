import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Common medicines available in UAE pharmacies (MOH registered)
const uaeDrugsData = [
  // Analgesics & Antipyretics
  { name: 'Panadol', genericName: 'Paracetamol', brandName: 'Panadol', code: 'UAE-PANADOL-500', category: 'ANALGESIC', dosageForm: 'TABLET', strength: '500mg', manufacturer: 'GSK', price: 12.50, reorderLevel: 100, requiresPrescription: false, isControlled: false, sideEffects: ['Nausea', 'Allergic reactions'], contraindications: ['Severe liver disease', 'Paracetamol allergy'], interactions: ['Warfarin', 'Alcohol'] },
  { name: 'Panadol Extra', genericName: 'Paracetamol + Caffeine', brandName: 'Panadol Extra', code: 'UAE-PANADOL-EX', category: 'ANALGESIC', dosageForm: 'TABLET', strength: '500mg/65mg', manufacturer: 'GSK', price: 18.00, reorderLevel: 80, requiresPrescription: false, isControlled: false, sideEffects: ['Insomnia', 'Nervousness', 'Nausea'], contraindications: ['Caffeine sensitivity', 'Liver disease'], interactions: ['Warfarin', 'MAOIs'] },
  { name: 'Brufen', genericName: 'Ibuprofen', brandName: 'Brufen', code: 'UAE-BRUFEN-400', category: 'NSAID', dosageForm: 'TABLET', strength: '400mg', manufacturer: 'Abbott', price: 15.00, reorderLevel: 80, requiresPrescription: false, isControlled: false, sideEffects: ['Stomach upset', 'Dizziness', 'Headache'], contraindications: ['Peptic ulcer', 'Aspirin allergy', 'Third trimester pregnancy'], interactions: ['Aspirin', 'Warfarin', 'ACE inhibitors'] },
  { name: 'Voltaren', genericName: 'Diclofenac', brandName: 'Voltaren', code: 'UAE-VOLT-50', category: 'NSAID', dosageForm: 'TABLET', strength: '50mg', manufacturer: 'Novartis', price: 22.00, reorderLevel: 60, requiresPrescription: true, isControlled: false, sideEffects: ['GI bleeding', 'Headache', 'Dizziness'], contraindications: ['Active GI bleed', 'Severe heart failure'], interactions: ['Lithium', 'Methotrexate', 'Warfarin'] },
  { name: 'Cataflam', genericName: 'Diclofenac Potassium', brandName: 'Cataflam', code: 'UAE-CATA-50', category: 'NSAID', dosageForm: 'TABLET', strength: '50mg', manufacturer: 'Novartis', price: 25.00, reorderLevel: 50, requiresPrescription: true, isControlled: false, sideEffects: ['Abdominal pain', 'Nausea', 'Headache'], contraindications: ['GI ulcer', 'Renal impairment'], interactions: ['Anticoagulants', 'Lithium'] },

  // Antibiotics
  { name: 'Augmentin', genericName: 'Amoxicillin + Clavulanic Acid', brandName: 'Augmentin', code: 'UAE-AUGM-625', category: 'ANTIBIOTIC', dosageForm: 'TABLET', strength: '625mg', manufacturer: 'GSK', price: 45.00, reorderLevel: 50, requiresPrescription: true, isControlled: false, sideEffects: ['Diarrhea', 'Nausea', 'Rash'], contraindications: ['Penicillin allergy', 'Jaundice history with Augmentin'], interactions: ['Warfarin', 'Methotrexate'] },
  { name: 'Augmentin', genericName: 'Amoxicillin + Clavulanic Acid', brandName: 'Augmentin', code: 'UAE-AUGM-1G', category: 'ANTIBIOTIC', dosageForm: 'TABLET', strength: '1g', manufacturer: 'GSK', price: 65.00, reorderLevel: 40, requiresPrescription: true, isControlled: false, sideEffects: ['Diarrhea', 'Nausea', 'Vomiting'], contraindications: ['Penicillin allergy'], interactions: ['Warfarin', 'Allopurinol'] },
  { name: 'Azithromycin', genericName: 'Azithromycin', brandName: 'Zithromax', code: 'UAE-AZITH-500', category: 'ANTIBIOTIC', dosageForm: 'TABLET', strength: '500mg', manufacturer: 'Pfizer', price: 55.00, reorderLevel: 40, requiresPrescription: true, isControlled: false, sideEffects: ['Diarrhea', 'Abdominal pain', 'Nausea'], contraindications: ['Macrolide allergy', 'QT prolongation'], interactions: ['Warfarin', 'Digoxin', 'Antacids'] },
  { name: 'Ciprobay', genericName: 'Ciprofloxacin', brandName: 'Ciprobay', code: 'UAE-CIPRO-500', category: 'ANTIBIOTIC', dosageForm: 'TABLET', strength: '500mg', manufacturer: 'Bayer', price: 48.00, reorderLevel: 40, requiresPrescription: true, isControlled: false, sideEffects: ['Tendinitis', 'Nausea', 'Diarrhea'], contraindications: ['Quinolone allergy', 'Myasthenia gravis'], interactions: ['Theophylline', 'Warfarin', 'Antacids'] },
  { name: 'Flagyl', genericName: 'Metronidazole', brandName: 'Flagyl', code: 'UAE-FLAG-500', category: 'ANTIBIOTIC', dosageForm: 'TABLET', strength: '500mg', manufacturer: 'Sanofi', price: 18.00, reorderLevel: 50, requiresPrescription: true, isControlled: false, sideEffects: ['Metallic taste', 'Nausea', 'Headache'], contraindications: ['First trimester pregnancy', 'Alcohol use'], interactions: ['Alcohol', 'Warfarin', 'Lithium'] },
  { name: 'Zinnat', genericName: 'Cefuroxime', brandName: 'Zinnat', code: 'UAE-ZINN-500', category: 'ANTIBIOTIC', dosageForm: 'TABLET', strength: '500mg', manufacturer: 'GSK', price: 52.00, reorderLevel: 40, requiresPrescription: true, isControlled: false, sideEffects: ['Diarrhea', 'Nausea', 'Headache'], contraindications: ['Cephalosporin allergy'], interactions: ['Probenecid', 'Aminoglycosides'] },

  // Cardiovascular
  { name: 'Concor', genericName: 'Bisoprolol', brandName: 'Concor', code: 'UAE-CONC-5', category: 'CARDIOVASCULAR', dosageForm: 'TABLET', strength: '5mg', manufacturer: 'Merck', price: 35.00, reorderLevel: 60, requiresPrescription: true, isControlled: false, sideEffects: ['Fatigue', 'Dizziness', 'Bradycardia'], contraindications: ['Severe bradycardia', 'Heart block', 'Severe asthma'], interactions: ['Calcium channel blockers', 'Clonidine'] },
  { name: 'Norvasc', genericName: 'Amlodipine', brandName: 'Norvasc', code: 'UAE-NORV-5', category: 'ANTIHYPERTENSIVE', dosageForm: 'TABLET', strength: '5mg', manufacturer: 'Pfizer', price: 38.00, reorderLevel: 60, requiresPrescription: true, isControlled: false, sideEffects: ['Ankle swelling', 'Flushing', 'Headache'], contraindications: ['Severe hypotension', 'Cardiogenic shock'], interactions: ['Simvastatin', 'Cyclosporine'] },
  { name: 'Norvasc', genericName: 'Amlodipine', brandName: 'Norvasc', code: 'UAE-NORV-10', category: 'ANTIHYPERTENSIVE', dosageForm: 'TABLET', strength: '10mg', manufacturer: 'Pfizer', price: 45.00, reorderLevel: 50, requiresPrescription: true, isControlled: false, sideEffects: ['Peripheral edema', 'Dizziness', 'Palpitations'], contraindications: ['Severe aortic stenosis'], interactions: ['CYP3A4 inhibitors'] },
  { name: 'Zestril', genericName: 'Lisinopril', brandName: 'Zestril', code: 'UAE-ZEST-10', category: 'ANTIHYPERTENSIVE', dosageForm: 'TABLET', strength: '10mg', manufacturer: 'AstraZeneca', price: 32.00, reorderLevel: 60, requiresPrescription: true, isControlled: false, sideEffects: ['Dry cough', 'Dizziness', 'Hyperkalemia'], contraindications: ['Angioedema history', 'Pregnancy'], interactions: ['Potassium supplements', 'NSAIDs', 'Lithium'] },
  { name: 'Cozaar', genericName: 'Losartan', brandName: 'Cozaar', code: 'UAE-COZA-50', category: 'ANTIHYPERTENSIVE', dosageForm: 'TABLET', strength: '50mg', manufacturer: 'MSD', price: 42.00, reorderLevel: 50, requiresPrescription: true, isControlled: false, sideEffects: ['Dizziness', 'Hyperkalemia', 'Fatigue'], contraindications: ['Pregnancy', 'Bilateral renal artery stenosis'], interactions: ['Potassium supplements', 'NSAIDs'] },
  { name: 'Plavix', genericName: 'Clopidogrel', brandName: 'Plavix', code: 'UAE-PLAV-75', category: 'ANTICOAGULANT', dosageForm: 'TABLET', strength: '75mg', manufacturer: 'Sanofi', price: 85.00, reorderLevel: 40, requiresPrescription: true, isControlled: false, sideEffects: ['Bleeding', 'Bruising', 'GI upset'], contraindications: ['Active bleeding', 'Severe liver disease'], interactions: ['PPIs', 'NSAIDs', 'Warfarin'] },
  { name: 'Aspirin Cardio', genericName: 'Aspirin', brandName: 'Aspirin Cardio', code: 'UAE-ASP-100', category: 'ANTICOAGULANT', dosageForm: 'TABLET', strength: '100mg', manufacturer: 'Bayer', price: 18.00, reorderLevel: 80, requiresPrescription: false, isControlled: false, sideEffects: ['GI bleeding', 'Bruising'], contraindications: ['Active peptic ulcer', 'Aspirin allergy'], interactions: ['Warfarin', 'NSAIDs', 'Methotrexate'] },

  // Diabetes
  { name: 'Glucophage', genericName: 'Metformin', brandName: 'Glucophage', code: 'UAE-GLUC-500', category: 'ANTIDIABETIC', dosageForm: 'TABLET', strength: '500mg', manufacturer: 'Merck', price: 22.00, reorderLevel: 80, requiresPrescription: true, isControlled: false, sideEffects: ['Nausea', 'Diarrhea', 'Lactic acidosis'], contraindications: ['Renal impairment', 'Contrast procedures'], interactions: ['Alcohol', 'Iodinated contrast'] },
  { name: 'Glucophage XR', genericName: 'Metformin Extended Release', brandName: 'Glucophage XR', code: 'UAE-GLUCXR-1000', category: 'ANTIDIABETIC', dosageForm: 'TABLET', strength: '1000mg', manufacturer: 'Merck', price: 45.00, reorderLevel: 60, requiresPrescription: true, isControlled: false, sideEffects: ['GI upset', 'Vitamin B12 deficiency'], contraindications: ['eGFR <30', 'Metabolic acidosis'], interactions: ['Contrast media', 'Alcohol'] },
  { name: 'Amaryl', genericName: 'Glimepiride', brandName: 'Amaryl', code: 'UAE-AMAR-2', category: 'ANTIDIABETIC', dosageForm: 'TABLET', strength: '2mg', manufacturer: 'Sanofi', price: 35.00, reorderLevel: 50, requiresPrescription: true, isControlled: false, sideEffects: ['Hypoglycemia', 'Weight gain', 'Nausea'], contraindications: ['Type 1 diabetes', 'Diabetic ketoacidosis'], interactions: ['Beta blockers', 'NSAIDs'] },
  { name: 'Januvia', genericName: 'Sitagliptin', brandName: 'Januvia', code: 'UAE-JANU-100', category: 'ANTIDIABETIC', dosageForm: 'TABLET', strength: '100mg', manufacturer: 'MSD', price: 120.00, reorderLevel: 40, requiresPrescription: true, isControlled: false, sideEffects: ['Headache', 'Nasopharyngitis', 'Pancreatitis'], contraindications: ['History of pancreatitis'], interactions: ['Digoxin'] },
  { name: 'Jardiance', genericName: 'Empagliflozin', brandName: 'Jardiance', code: 'UAE-JARD-10', category: 'ANTIDIABETIC', dosageForm: 'TABLET', strength: '10mg', manufacturer: 'Boehringer Ingelheim', price: 150.00, reorderLevel: 30, requiresPrescription: true, isControlled: false, sideEffects: ['UTI', 'Genital infections', 'Hypotension'], contraindications: ['eGFR <30', 'Type 1 diabetes'], interactions: ['Diuretics', 'Insulin'] },

  // Cholesterol
  { name: 'Lipitor', genericName: 'Atorvastatin', brandName: 'Lipitor', code: 'UAE-LIPI-20', category: 'STATIN', dosageForm: 'TABLET', strength: '20mg', manufacturer: 'Pfizer', price: 55.00, reorderLevel: 60, requiresPrescription: true, isControlled: false, sideEffects: ['Muscle pain', 'Liver enzyme elevation', 'Headache'], contraindications: ['Active liver disease', 'Pregnancy'], interactions: ['Grapefruit juice', 'Cyclosporine', 'Fibrates'] },
  { name: 'Crestor', genericName: 'Rosuvastatin', brandName: 'Crestor', code: 'UAE-CRES-10', category: 'STATIN', dosageForm: 'TABLET', strength: '10mg', manufacturer: 'AstraZeneca', price: 65.00, reorderLevel: 50, requiresPrescription: true, isControlled: false, sideEffects: ['Myalgia', 'Constipation', 'Nausea'], contraindications: ['Liver disease', 'Pregnancy'], interactions: ['Warfarin', 'Cyclosporine'] },

  // Gastrointestinal
  { name: 'Nexium', genericName: 'Esomeprazole', brandName: 'Nexium', code: 'UAE-NEXI-40', category: 'GASTROINTESTINAL', dosageForm: 'CAPSULE', strength: '40mg', manufacturer: 'AstraZeneca', price: 75.00, reorderLevel: 50, requiresPrescription: true, isControlled: false, sideEffects: ['Headache', 'Diarrhea', 'Nausea'], contraindications: ['PPI allergy'], interactions: ['Clopidogrel', 'Methotrexate'] },
  { name: 'Losec', genericName: 'Omeprazole', brandName: 'Losec', code: 'UAE-LOSE-20', category: 'GASTROINTESTINAL', dosageForm: 'CAPSULE', strength: '20mg', manufacturer: 'AstraZeneca', price: 45.00, reorderLevel: 60, requiresPrescription: false, isControlled: false, sideEffects: ['Headache', 'Abdominal pain', 'Nausea'], contraindications: ['PPI hypersensitivity'], interactions: ['Clopidogrel', 'Digoxin'] },
  { name: 'Motilium', genericName: 'Domperidone', brandName: 'Motilium', code: 'UAE-MOTI-10', category: 'GASTROINTESTINAL', dosageForm: 'TABLET', strength: '10mg', manufacturer: 'Janssen', price: 28.00, reorderLevel: 50, requiresPrescription: false, isControlled: false, sideEffects: ['Dry mouth', 'Headache', 'GI cramps'], contraindications: ['GI bleeding', 'Prolactinoma', 'QT prolongation'], interactions: ['Ketoconazole', 'Erythromycin'] },
  { name: 'Imodium', genericName: 'Loperamide', brandName: 'Imodium', code: 'UAE-IMOD-2', category: 'GASTROINTESTINAL', dosageForm: 'CAPSULE', strength: '2mg', manufacturer: 'Janssen', price: 22.00, reorderLevel: 40, requiresPrescription: false, isControlled: false, sideEffects: ['Constipation', 'Dizziness', 'Abdominal cramps'], contraindications: ['Bloody diarrhea', 'Acute ulcerative colitis'], interactions: ['Opioids', 'Quinidine'] },
  { name: 'Buscopan', genericName: 'Hyoscine Butylbromide', brandName: 'Buscopan', code: 'UAE-BUSC-10', category: 'GASTROINTESTINAL', dosageForm: 'TABLET', strength: '10mg', manufacturer: 'Boehringer Ingelheim', price: 25.00, reorderLevel: 50, requiresPrescription: false, isControlled: false, sideEffects: ['Dry mouth', 'Tachycardia', 'Constipation'], contraindications: ['Glaucoma', 'Myasthenia gravis', 'Megacolon'], interactions: ['Anticholinergics', 'Metoclopramide'] },

  // Respiratory
  { name: 'Ventolin', genericName: 'Salbutamol', brandName: 'Ventolin', code: 'UAE-VENT-INH', category: 'BRONCHODILATOR', dosageForm: 'INHALER', strength: '100mcg/dose', manufacturer: 'GSK', price: 35.00, reorderLevel: 40, requiresPrescription: true, isControlled: false, sideEffects: ['Tremor', 'Tachycardia', 'Headache'], contraindications: ['Hypersensitivity'], interactions: ['Beta blockers', 'MAOIs'] },
  { name: 'Seretide', genericName: 'Fluticasone + Salmeterol', brandName: 'Seretide', code: 'UAE-SERE-250', category: 'BRONCHODILATOR', dosageForm: 'INHALER', strength: '250/50mcg', manufacturer: 'GSK', price: 180.00, reorderLevel: 30, requiresPrescription: true, isControlled: false, sideEffects: ['Oral thrush', 'Hoarseness', 'Headache'], contraindications: ['Acute asthma attack'], interactions: ['Ritonavir', 'Ketoconazole'] },
  { name: 'Telfast', genericName: 'Fexofenadine', brandName: 'Telfast', code: 'UAE-TELF-180', category: 'ANTIHISTAMINE', dosageForm: 'TABLET', strength: '180mg', manufacturer: 'Sanofi', price: 42.00, reorderLevel: 50, requiresPrescription: false, isControlled: false, sideEffects: ['Headache', 'Drowsiness', 'Nausea'], contraindications: ['Fexofenadine allergy'], interactions: ['Antacids', 'Grapefruit juice'] },
  { name: 'Claritine', genericName: 'Loratadine', brandName: 'Claritine', code: 'UAE-CLAR-10', category: 'ANTIHISTAMINE', dosageForm: 'TABLET', strength: '10mg', manufacturer: 'Bayer', price: 32.00, reorderLevel: 60, requiresPrescription: false, isControlled: false, sideEffects: ['Headache', 'Fatigue', 'Dry mouth'], contraindications: ['Loratadine allergy'], interactions: ['Ketoconazole', 'Erythromycin'] },
  { name: 'Zyrtec', genericName: 'Cetirizine', brandName: 'Zyrtec', code: 'UAE-ZYRT-10', category: 'ANTIHISTAMINE', dosageForm: 'TABLET', strength: '10mg', manufacturer: 'UCB', price: 35.00, reorderLevel: 60, requiresPrescription: false, isControlled: false, sideEffects: ['Drowsiness', 'Dry mouth', 'Fatigue'], contraindications: ['Severe renal impairment'], interactions: ['CNS depressants', 'Alcohol'] },

  // Antidepressants & CNS
  { name: 'Lexapro', genericName: 'Escitalopram', brandName: 'Lexapro', code: 'UAE-LEXA-10', category: 'ANTIDEPRESSANT', dosageForm: 'TABLET', strength: '10mg', manufacturer: 'Lundbeck', price: 95.00, reorderLevel: 30, requiresPrescription: true, isControlled: false, sideEffects: ['Nausea', 'Insomnia', 'Sexual dysfunction'], contraindications: ['MAOIs use', 'QT prolongation'], interactions: ['MAOIs', 'Tramadol', 'NSAIDs'] },
  { name: 'Prozac', genericName: 'Fluoxetine', brandName: 'Prozac', code: 'UAE-PROZ-20', category: 'ANTIDEPRESSANT', dosageForm: 'CAPSULE', strength: '20mg', manufacturer: 'Eli Lilly', price: 85.00, reorderLevel: 30, requiresPrescription: true, isControlled: false, sideEffects: ['Nausea', 'Headache', 'Anxiety'], contraindications: ['MAOIs within 14 days'], interactions: ['MAOIs', 'Warfarin', 'Phenytoin'] },
  { name: 'Xanax', genericName: 'Alprazolam', brandName: 'Xanax', code: 'UAE-XANA-0.5', category: 'SEDATIVE', dosageForm: 'TABLET', strength: '0.5mg', manufacturer: 'Pfizer', price: 45.00, reorderLevel: 20, requiresPrescription: true, isControlled: true, sideEffects: ['Drowsiness', 'Dizziness', 'Memory impairment'], contraindications: ['Acute narrow-angle glaucoma', 'Severe respiratory depression'], interactions: ['Opioids', 'Alcohol', 'Ketoconazole'] },

  // Thyroid
  { name: 'Euthyrox', genericName: 'Levothyroxine', brandName: 'Euthyrox', code: 'UAE-EUTH-50', category: 'HORMONE', dosageForm: 'TABLET', strength: '50mcg', manufacturer: 'Merck', price: 28.00, reorderLevel: 50, requiresPrescription: true, isControlled: false, sideEffects: ['Palpitations', 'Weight loss', 'Tremor'], contraindications: ['Untreated adrenal insufficiency', 'Thyrotoxicosis'], interactions: ['Calcium supplements', 'Iron supplements', 'Antacids'] },
  { name: 'Euthyrox', genericName: 'Levothyroxine', brandName: 'Euthyrox', code: 'UAE-EUTH-100', category: 'HORMONE', dosageForm: 'TABLET', strength: '100mcg', manufacturer: 'Merck', price: 32.00, reorderLevel: 50, requiresPrescription: true, isControlled: false, sideEffects: ['Hyperthyroid symptoms', 'Chest pain', 'Heat intolerance'], contraindications: ['Acute MI', 'Untreated hyperthyroidism'], interactions: ['Warfarin', 'Digoxin', 'Antidiabetics'] },

  // Vitamins & Supplements
  { name: 'Centrum', genericName: 'Multivitamin', brandName: 'Centrum', code: 'UAE-CENT-MV', category: 'VITAMIN', dosageForm: 'TABLET', strength: 'Standard', manufacturer: 'Pfizer', price: 65.00, reorderLevel: 80, requiresPrescription: false, isControlled: false, sideEffects: ['GI upset', 'Nausea'], contraindications: ['Hypervitaminosis'], interactions: ['Warfarin', 'Levodopa'] },
  { name: 'Caltrate', genericName: 'Calcium + Vitamin D', brandName: 'Caltrate', code: 'UAE-CALT-600', category: 'VITAMIN', dosageForm: 'TABLET', strength: '600mg/400IU', manufacturer: 'Pfizer', price: 45.00, reorderLevel: 60, requiresPrescription: false, isControlled: false, sideEffects: ['Constipation', 'Bloating'], contraindications: ['Hypercalcemia', 'Renal stones'], interactions: ['Thyroid hormones', 'Bisphosphonates', 'Tetracyclines'] },
  { name: 'Vitamin D3', genericName: 'Cholecalciferol', brandName: 'Vi-De-3', code: 'UAE-VD3-50000', category: 'VITAMIN', dosageForm: 'CAPSULE', strength: '50000IU', manufacturer: 'Various', price: 35.00, reorderLevel: 80, requiresPrescription: false, isControlled: false, sideEffects: ['Hypercalcemia with overdose'], contraindications: ['Hypercalcemia', 'Hypervitaminosis D'], interactions: ['Thiazide diuretics', 'Digoxin'] },
  { name: 'Neurobion', genericName: 'Vitamin B Complex', brandName: 'Neurobion', code: 'UAE-NEUR-FORTE', category: 'VITAMIN', dosageForm: 'TABLET', strength: 'B1/B6/B12', manufacturer: 'Merck', price: 38.00, reorderLevel: 60, requiresPrescription: false, isControlled: false, sideEffects: ['Nausea', 'Flushing'], contraindications: ['B vitamin allergy'], interactions: ['Levodopa'] },
  { name: 'Ferrous Sulfate', genericName: 'Ferrous Sulfate', brandName: 'Fero-Gradumet', code: 'UAE-FERR-325', category: 'VITAMIN', dosageForm: 'TABLET', strength: '325mg', manufacturer: 'Abbott', price: 22.00, reorderLevel: 60, requiresPrescription: false, isControlled: false, sideEffects: ['Constipation', 'Dark stool', 'Nausea'], contraindications: ['Hemochromatosis', 'Iron overload'], interactions: ['Antacids', 'Tetracyclines', 'Quinolones'] },

  // Dermatological
  { name: 'Fucicort', genericName: 'Fusidic Acid + Betamethasone', brandName: 'Fucicort', code: 'UAE-FUCI-CRM', category: 'CORTICOSTEROID', dosageForm: 'CREAM', strength: '2%/0.1%', manufacturer: 'LEO Pharma', price: 42.00, reorderLevel: 40, requiresPrescription: true, isControlled: false, sideEffects: ['Skin thinning', 'Burning sensation'], contraindications: ['Viral skin infections', 'Rosacea'], interactions: [] },
  { name: 'Diprosone', genericName: 'Betamethasone', brandName: 'Diprosone', code: 'UAE-DIPR-CRM', category: 'CORTICOSTEROID', dosageForm: 'CREAM', strength: '0.05%', manufacturer: 'MSD', price: 35.00, reorderLevel: 40, requiresPrescription: true, isControlled: false, sideEffects: ['Skin atrophy', 'Striae', 'Telangiectasia'], contraindications: ['Skin infections', 'Perioral dermatitis'], interactions: [] },

  // Eye drops
  { name: 'Systane', genericName: 'Polyethylene Glycol', brandName: 'Systane', code: 'UAE-SYST-EYE', category: 'OTHER', dosageForm: 'DROPS', strength: '0.4%', manufacturer: 'Alcon', price: 48.00, reorderLevel: 40, requiresPrescription: false, isControlled: false, sideEffects: ['Temporary blurred vision', 'Eye irritation'], contraindications: ['Contact lens use'], interactions: [] },
  { name: 'Refresh Tears', genericName: 'Carboxymethylcellulose', brandName: 'Refresh Tears', code: 'UAE-REFR-EYE', category: 'OTHER', dosageForm: 'DROPS', strength: '0.5%', manufacturer: 'Allergan', price: 38.00, reorderLevel: 40, requiresPrescription: false, isControlled: false, sideEffects: ['Mild stinging'], contraindications: [], interactions: [] },

  // Common OTC
  { name: 'Strepsils', genericName: 'Amylmetacresol + Dichlorobenzyl alcohol', brandName: 'Strepsils', code: 'UAE-STREP-LOZ', category: 'OTHER', dosageForm: 'LOTION', strength: 'Standard', manufacturer: 'Reckitt', price: 18.00, reorderLevel: 80, requiresPrescription: false, isControlled: false, sideEffects: ['Mild irritation'], contraindications: [], interactions: [] },
  { name: 'Gaviscon', genericName: 'Sodium Alginate + Potassium Bicarbonate', brandName: 'Gaviscon', code: 'UAE-GAVIS-LIQ', category: 'GASTROINTESTINAL', dosageForm: 'SUSPENSION', strength: '500mg/267mg per 10ml', manufacturer: 'Reckitt', price: 35.00, reorderLevel: 50, requiresPrescription: false, isControlled: false, sideEffects: ['Constipation', 'Diarrhea'], contraindications: ['Severe renal impairment'], interactions: ['Other medications (separate by 2h)'] },
];

async function main() {
  console.log('Starting UAE drugs seed...');

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const drug of uaeDrugsData) {
    try {
      const existingDrug = await prisma.drug.findUnique({
        where: { code: drug.code },
      });

      if (existingDrug) {
        await prisma.drug.update({
          where: { code: drug.code },
          data: drug,
        });
        updated++;
        console.log(`Updated: ${drug.name} (${drug.code})`);
      } else {
        await prisma.drug.create({
          data: drug,
        });
        created++;
        console.log(`Created: ${drug.name} (${drug.code})`);
      }
    } catch (error: any) {
      errors++;
      console.error(`Error with ${drug.name}: ${error.message}`);
    }
  }

  console.log('\n--- UAE Drugs Seed Summary ---');
  console.log(`Total: ${uaeDrugsData.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
