import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Common ICD-10 codes used in UAE healthcare (DHA approved)
const icd10CodesData = [
  // Respiratory (J00-J99)
  { code: 'J00', description: 'Acute nasopharyngitis [common cold]', category: 'Respiratory', subcategory: 'Upper Respiratory', dhaApproved: true, specificityLevel: 3, isUnspecified: false, isBillable: true },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified', category: 'Respiratory', subcategory: 'Upper Respiratory', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true, preferredCode: 'J02.0' },
  { code: 'J02.0', description: 'Streptococcal pharyngitis', category: 'Respiratory', subcategory: 'Upper Respiratory', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Respiratory', subcategory: 'Upper Respiratory', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism', category: 'Respiratory', subcategory: 'Lower Respiratory', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true, preferredCode: 'J18.1' },
  { code: 'J18.1', description: 'Lobar pneumonia, unspecified organism', category: 'Respiratory', subcategory: 'Lower Respiratory', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', category: 'Respiratory', subcategory: 'Lower Respiratory', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'J45.20', description: 'Mild intermittent asthma, uncomplicated', category: 'Respiratory', subcategory: 'Chronic Lower Respiratory', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'J45.30', description: 'Mild persistent asthma, uncomplicated', category: 'Respiratory', subcategory: 'Chronic Lower Respiratory', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'J45.40', description: 'Moderate persistent asthma, uncomplicated', category: 'Respiratory', subcategory: 'Chronic Lower Respiratory', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'J45.50', description: 'Severe persistent asthma, uncomplicated', category: 'Respiratory', subcategory: 'Chronic Lower Respiratory', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'J44.1', description: 'Chronic obstructive pulmonary disease with acute exacerbation', category: 'Respiratory', subcategory: 'Chronic Lower Respiratory', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },

  // Cardiovascular (I00-I99)
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Cardiovascular', subcategory: 'Hypertensive Diseases', dhaApproved: true, specificityLevel: 3, isUnspecified: false, isBillable: true },
  { code: 'I11.9', description: 'Hypertensive heart disease without heart failure', category: 'Cardiovascular', subcategory: 'Hypertensive Diseases', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'I20.9', description: 'Angina pectoris, unspecified', category: 'Cardiovascular', subcategory: 'Ischemic Heart Disease', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'I21.3', description: 'ST elevation (STEMI) myocardial infarction of unspecified site', category: 'Cardiovascular', subcategory: 'Ischemic Heart Disease', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris', category: 'Cardiovascular', subcategory: 'Ischemic Heart Disease', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'I48.91', description: 'Unspecified atrial fibrillation', category: 'Cardiovascular', subcategory: 'Arrhythmias', dhaApproved: true, specificityLevel: 5, isUnspecified: true, isBillable: true },
  { code: 'I50.9', description: 'Heart failure, unspecified', category: 'Cardiovascular', subcategory: 'Heart Failure', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true, preferredCode: 'I50.22' },
  { code: 'I50.22', description: 'Chronic systolic (congestive) heart failure', category: 'Cardiovascular', subcategory: 'Heart Failure', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },

  // Endocrine (E00-E89)
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine', subcategory: 'Diabetes', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', category: 'Endocrine', subcategory: 'Diabetes', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'E11.40', description: 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified', category: 'Endocrine', subcategory: 'Diabetes', dhaApproved: true, specificityLevel: 5, isUnspecified: true, isBillable: true },
  { code: 'E11.42', description: 'Type 2 diabetes mellitus with diabetic polyneuropathy', category: 'Endocrine', subcategory: 'Diabetes', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'E11.51', description: 'Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene', category: 'Endocrine', subcategory: 'Diabetes', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', category: 'Endocrine', subcategory: 'Diabetes', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'E03.9', description: 'Hypothyroidism, unspecified', category: 'Endocrine', subcategory: 'Thyroid', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'E05.90', description: 'Thyrotoxicosis, unspecified without thyrotoxic crisis or storm', category: 'Endocrine', subcategory: 'Thyroid', dhaApproved: true, specificityLevel: 5, isUnspecified: true, isBillable: true },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified', category: 'Endocrine', subcategory: 'Metabolic', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'E78.00', description: 'Pure hypercholesterolemia, unspecified', category: 'Endocrine', subcategory: 'Metabolic', dhaApproved: true, specificityLevel: 5, isUnspecified: true, isBillable: true },
  { code: 'E66.9', description: 'Obesity, unspecified', category: 'Endocrine', subcategory: 'Metabolic', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },

  // Gastrointestinal (K00-K95)
  { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis', category: 'Gastrointestinal', subcategory: 'Esophagus/Stomach', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'K25.9', description: 'Gastric ulcer, unspecified as acute or chronic, without hemorrhage or perforation', category: 'Gastrointestinal', subcategory: 'Esophagus/Stomach', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'K29.70', description: 'Gastritis, unspecified, without bleeding', category: 'Gastrointestinal', subcategory: 'Esophagus/Stomach', dhaApproved: true, specificityLevel: 5, isUnspecified: true, isBillable: true },
  { code: 'K52.9', description: 'Noninfective gastroenteritis and colitis, unspecified', category: 'Gastrointestinal', subcategory: 'Intestinal', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'K57.30', description: 'Diverticulosis of large intestine without perforation or abscess without bleeding', category: 'Gastrointestinal', subcategory: 'Intestinal', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'K76.0', description: 'Fatty (change of) liver, not elsewhere classified', category: 'Gastrointestinal', subcategory: 'Liver', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },

  // Musculoskeletal (M00-M99)
  { code: 'M54.5', description: 'Low back pain', category: 'Musculoskeletal', subcategory: 'Dorsopathies', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'M54.2', description: 'Cervicalgia', category: 'Musculoskeletal', subcategory: 'Dorsopathies', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'M79.3', description: 'Panniculitis, unspecified', category: 'Musculoskeletal', subcategory: 'Soft Tissue', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'M17.11', description: 'Primary osteoarthritis, right knee', category: 'Musculoskeletal', subcategory: 'Osteoarthritis', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'M17.12', description: 'Primary osteoarthritis, left knee', category: 'Musculoskeletal', subcategory: 'Osteoarthritis', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'M16.11', description: 'Primary osteoarthritis, right hip', category: 'Musculoskeletal', subcategory: 'Osteoarthritis', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'M25.511', description: 'Pain in right shoulder', category: 'Musculoskeletal', subcategory: 'Joint Pain', dhaApproved: true, specificityLevel: 6, isUnspecified: false, isBillable: true },
  { code: 'M25.512', description: 'Pain in left shoulder', category: 'Musculoskeletal', subcategory: 'Joint Pain', dhaApproved: true, specificityLevel: 6, isUnspecified: false, isBillable: true },

  // Genitourinary (N00-N99)
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', category: 'Genitourinary', subcategory: 'Urinary', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'N18.3', description: 'Chronic kidney disease, stage 3 (moderate)', category: 'Genitourinary', subcategory: 'Renal', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'N18.4', description: 'Chronic kidney disease, stage 4 (severe)', category: 'Genitourinary', subcategory: 'Renal', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'N40.0', description: 'Benign prostatic hyperplasia without lower urinary tract symptoms', category: 'Genitourinary', subcategory: 'Male Genital', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },

  // Mental/Behavioral (F00-F99)
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', category: 'Mental Health', subcategory: 'Mood Disorders', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'F32.1', description: 'Major depressive disorder, single episode, moderate', category: 'Mental Health', subcategory: 'Mood Disorders', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'F41.1', description: 'Generalized anxiety disorder', category: 'Mental Health', subcategory: 'Anxiety Disorders', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'F41.9', description: 'Anxiety disorder, unspecified', category: 'Mental Health', subcategory: 'Anxiety Disorders', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'F51.01', description: 'Primary insomnia', category: 'Mental Health', subcategory: 'Sleep Disorders', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },

  // Nervous System (G00-G99)
  { code: 'G43.909', description: 'Migraine, unspecified, not intractable, without status migrainosus', category: 'Nervous System', subcategory: 'Headache', dhaApproved: true, specificityLevel: 6, isUnspecified: true, isBillable: true },
  { code: 'G43.009', description: 'Migraine without aura, not intractable, without status migrainosus', category: 'Nervous System', subcategory: 'Headache', dhaApproved: true, specificityLevel: 6, isUnspecified: false, isBillable: true },
  { code: 'G47.33', description: 'Obstructive sleep apnea (adult) (pediatric)', category: 'Nervous System', subcategory: 'Sleep Disorders', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'G62.9', description: 'Polyneuropathy, unspecified', category: 'Nervous System', subcategory: 'Neuropathy', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },

  // Skin (L00-L99)
  { code: 'L30.9', description: 'Dermatitis, unspecified', category: 'Dermatology', subcategory: 'Dermatitis/Eczema', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'L20.9', description: 'Atopic dermatitis, unspecified', category: 'Dermatology', subcategory: 'Dermatitis/Eczema', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'L40.0', description: 'Psoriasis vulgaris', category: 'Dermatology', subcategory: 'Papulosquamous', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },
  { code: 'L70.0', description: 'Acne vulgaris', category: 'Dermatology', subcategory: 'Skin Appendages', dhaApproved: true, specificityLevel: 4, isUnspecified: false, isBillable: true },

  // Eye (H00-H59)
  { code: 'H10.9', description: 'Unspecified conjunctivitis', category: 'Ophthalmology', subcategory: 'Conjunctiva', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'H52.13', description: 'Myopia, bilateral', category: 'Ophthalmology', subcategory: 'Refractive', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'H40.10X0', description: 'Unspecified open-angle glaucoma, stage unspecified', category: 'Ophthalmology', subcategory: 'Glaucoma', dhaApproved: true, specificityLevel: 7, isUnspecified: true, isBillable: true },
  { code: 'H25.9', description: 'Unspecified age-related cataract', category: 'Ophthalmology', subcategory: 'Lens', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },

  // Ear (H60-H95)
  { code: 'H66.90', description: 'Otitis media, unspecified, unspecified ear', category: 'ENT', subcategory: 'Middle Ear', dhaApproved: true, specificityLevel: 5, isUnspecified: true, isBillable: true },
  { code: 'H60.90', description: 'Unspecified otitis externa, unspecified ear', category: 'ENT', subcategory: 'External Ear', dhaApproved: true, specificityLevel: 5, isUnspecified: true, isBillable: true },

  // Infectious (A00-B99)
  { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified', category: 'Infectious', subcategory: 'Intestinal', dhaApproved: true, specificityLevel: 3, isUnspecified: true, isBillable: true },
  { code: 'B34.9', description: 'Viral infection, unspecified', category: 'Infectious', subcategory: 'Viral', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },

  // Pregnancy (O00-O9A)
  { code: 'O80', description: 'Encounter for full-term uncomplicated delivery', category: 'Obstetrics', subcategory: 'Delivery', dhaApproved: true, specificityLevel: 3, isUnspecified: false, isBillable: true },
  { code: 'Z34.00', description: 'Encounter for supervision of normal first pregnancy, unspecified trimester', category: 'Obstetrics', subcategory: 'Prenatal', dhaApproved: true, specificityLevel: 5, isUnspecified: true, isBillable: true },

  // Injury (S00-T88)
  { code: 'S61.401A', description: 'Unspecified open wound of right hand, initial encounter', category: 'Injury', subcategory: 'Hand', dhaApproved: true, specificityLevel: 7, isUnspecified: true, isBillable: true },
  { code: 'S93.401A', description: 'Sprain of unspecified ligament of right ankle, initial encounter', category: 'Injury', subcategory: 'Ankle', dhaApproved: true, specificityLevel: 7, isUnspecified: true, isBillable: true },

  // Symptoms (R00-R99)
  { code: 'R05.9', description: 'Cough, unspecified', category: 'Symptoms', subcategory: 'Respiratory', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'R50.9', description: 'Fever, unspecified', category: 'Symptoms', subcategory: 'General', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'R51.9', description: 'Headache, unspecified', category: 'Symptoms', subcategory: 'Neurological', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'R10.9', description: 'Unspecified abdominal pain', category: 'Symptoms', subcategory: 'Gastrointestinal', dhaApproved: true, specificityLevel: 4, isUnspecified: true, isBillable: true },
  { code: 'R53.83', description: 'Other fatigue', category: 'Symptoms', subcategory: 'General', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'R42', description: 'Dizziness and giddiness', category: 'Symptoms', subcategory: 'Neurological', dhaApproved: true, specificityLevel: 3, isUnspecified: false, isBillable: true },

  // Factors (Z00-Z99)
  { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings', category: 'Factors', subcategory: 'Preventive', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'Z00.01', description: 'Encounter for general adult medical examination with abnormal findings', category: 'Factors', subcategory: 'Preventive', dhaApproved: true, specificityLevel: 5, isUnspecified: false, isBillable: true },
  { code: 'Z23', description: 'Encounter for immunization', category: 'Factors', subcategory: 'Preventive', dhaApproved: true, specificityLevel: 3, isUnspecified: false, isBillable: true },
  { code: 'Z87.891', description: 'Personal history of nicotine dependence', category: 'Factors', subcategory: 'History', dhaApproved: true, specificityLevel: 6, isUnspecified: false, isBillable: true },
];

async function seedICD10Codes() {
  console.log('🏥 Seeding ICD-10 codes...\n');

  // Find the hospital
  const hospital = await prisma.hospital.findFirst({
    where: { code: 'HMS001' },
  });

  if (!hospital) {
    console.error('❌ No hospital found. Run the main seed first.');
    return;
  }

  console.log(`Found hospital: ${hospital.name}\n`);

  let created = 0;
  let updated = 0;

  for (const codeData of icd10CodesData) {
    try {
      const existing = await prisma.iCD10Code.findFirst({
        where: { hospitalId: hospital.id, code: codeData.code },
      });

      if (existing) {
        await prisma.iCD10Code.update({
          where: { id: existing.id },
          data: {
            description: codeData.description,
            category: codeData.category,
            subcategory: codeData.subcategory,
            dhaApproved: codeData.dhaApproved,
            specificityLevel: codeData.specificityLevel,
            isUnspecified: codeData.isUnspecified,
            preferredCode: codeData.preferredCode,
            isBillable: codeData.isBillable,
          },
        });
        updated++;
      } else {
        await prisma.iCD10Code.create({
          data: {
            hospitalId: hospital.id,
            ...codeData,
          },
        });
        created++;
      }
    } catch (error) {
      console.error(`Failed to seed ICD-10 code ${codeData.code}:`, error);
    }
  }

  console.log(`✓ Created ${created} ICD-10 codes`);
  console.log(`✓ Updated ${updated} ICD-10 codes`);
  console.log(`\n✅ ICD-10 seeding complete! Total: ${icd10CodesData.length} codes`);
}

// Main execution
seedICD10Codes()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
