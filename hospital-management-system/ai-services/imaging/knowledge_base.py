"""
Radiology Knowledge Base for Medical Imaging AI
Comprehensive pathology database, findings patterns, and reporting templates
"""

from typing import Dict, List, Any
from dataclasses import dataclass
from enum import Enum


class Urgency(Enum):
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENT = "emergent"
    CRITICAL = "critical"


class Severity(Enum):
    NORMAL = "normal"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


# Comprehensive pathology database organized by modality and body part
PATHOLOGY_DATABASE: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
    "XRAY": {
        "chest": [
            {
                "id": "pneumonia",
                "name": "Pneumonia",
                "description": "Consolidation or infiltrate in lung parenchyma",
                "findings": [
                    "Airspace opacity", "Consolidation", "Air bronchograms",
                    "Lobar or segmental distribution", "Silhouette sign"
                ],
                "locations": ["right lower lobe", "left lower lobe", "right middle lobe", "lingula", "bilateral"],
                "severity_indicators": {
                    "mild": "Patchy opacity, single lobe",
                    "moderate": "Dense consolidation, single lobe with air bronchograms",
                    "severe": "Multilobar consolidation, bilateral involvement"
                },
                "urgency": Urgency.URGENT,
                "differential": ["Atelectasis", "Pulmonary edema", "Lung mass"],
                "recommendations": ["Clinical correlation", "Consider CT if not improving"]
            },
            {
                "id": "pneumothorax",
                "name": "Pneumothorax",
                "description": "Air in pleural space with lung collapse",
                "findings": [
                    "Visceral pleural line", "Absent lung markings beyond pleural line",
                    "Deep sulcus sign", "Hyperlucency"
                ],
                "locations": ["right apex", "left apex", "right hemithorax", "left hemithorax"],
                "severity_indicators": {
                    "mild": "< 20% lung collapse, apical",
                    "moderate": "20-50% lung collapse",
                    "severe": "> 50% collapse, tension pneumothorax signs"
                },
                "urgency": Urgency.EMERGENT,
                "differential": ["Skin fold artifact", "Bullous disease"],
                "recommendations": ["Immediate clinical assessment", "Consider chest tube if large"]
            },
            {
                "id": "pleural_effusion",
                "name": "Pleural Effusion",
                "description": "Fluid collection in pleural space",
                "findings": [
                    "Blunting of costophrenic angle", "Meniscus sign",
                    "Layering on lateral decubitus", "Opacification of hemithorax"
                ],
                "locations": ["right", "left", "bilateral"],
                "severity_indicators": {
                    "mild": "Small blunting of costophrenic angle",
                    "moderate": "Moderate effusion, partial opacification",
                    "severe": "Large effusion, near complete opacification"
                },
                "urgency": Urgency.URGENT,
                "differential": ["Pleural thickening", "Subpulmonic effusion"],
                "recommendations": ["Consider thoracentesis", "Ultrasound guidance recommended"]
            },
            {
                "id": "cardiomegaly",
                "name": "Cardiomegaly",
                "description": "Enlarged cardiac silhouette",
                "findings": [
                    "Cardiothoracic ratio > 0.5", "Enlarged cardiac borders",
                    "Boot-shaped heart", "Water bottle configuration"
                ],
                "locations": ["global", "left ventricle", "right ventricle", "left atrium"],
                "severity_indicators": {
                    "mild": "CTR 0.5-0.55",
                    "moderate": "CTR 0.55-0.65",
                    "severe": "CTR > 0.65"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Pericardial effusion", "Normal variant"],
                "recommendations": ["Echocardiogram recommended", "Clinical correlation"]
            },
            {
                "id": "pulmonary_nodule",
                "name": "Pulmonary Nodule",
                "description": "Focal rounded opacity in lung parenchyma",
                "findings": [
                    "Rounded opacity < 3cm", "Well or ill-defined margins",
                    "Calcification pattern", "Spiculated or smooth borders"
                ],
                "locations": ["right upper lobe", "right lower lobe", "left upper lobe", "left lower lobe"],
                "severity_indicators": {
                    "mild": "< 6mm, smooth margins, stable",
                    "moderate": "6-8mm, indeterminate features",
                    "severe": "> 8mm, spiculated, growing"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Granuloma", "Malignancy", "Metastasis"],
                "recommendations": ["CT chest for characterization", "Follow Fleischner criteria"]
            },
            {
                "id": "rib_fracture",
                "name": "Rib Fracture",
                "description": "Break in rib continuity",
                "findings": [
                    "Cortical discontinuity", "Step-off deformity",
                    "Callus formation", "Associated pleural abnormality"
                ],
                "locations": ["anterior", "lateral", "posterior", "multiple ribs"],
                "severity_indicators": {
                    "mild": "Single non-displaced fracture",
                    "moderate": "Multiple fractures, non-displaced",
                    "severe": "Flail segment, displaced fractures"
                },
                "urgency": Urgency.URGENT,
                "differential": ["Bone metastasis", "Pathologic fracture"],
                "recommendations": ["Pain management", "Rule out pneumothorax"]
            }
        ],
        "spine": [
            {
                "id": "compression_fracture",
                "name": "Vertebral Compression Fracture",
                "description": "Loss of vertebral body height",
                "findings": [
                    "Decreased vertebral body height", "Wedge deformity",
                    "Endplate depression", "Increased kyphosis"
                ],
                "locations": ["T12", "L1", "L2", "thoracic spine", "lumbar spine"],
                "severity_indicators": {
                    "mild": "< 25% height loss",
                    "moderate": "25-40% height loss",
                    "severe": "> 40% height loss, retropulsion"
                },
                "urgency": Urgency.URGENT,
                "differential": ["Pathologic fracture", "Schmorl's node"],
                "recommendations": ["MRI to assess acuity", "Bone density evaluation"]
            },
            {
                "id": "degenerative_changes",
                "name": "Degenerative Disc Disease",
                "description": "Age-related spinal degeneration",
                "findings": [
                    "Disc space narrowing", "Osteophyte formation",
                    "Endplate sclerosis", "Facet arthropathy"
                ],
                "locations": ["L4-L5", "L5-S1", "C5-C6", "C6-C7", "multilevel"],
                "severity_indicators": {
                    "mild": "Minimal disc space narrowing, small osteophytes",
                    "moderate": "Moderate narrowing, moderate osteophytes",
                    "severe": "Severe narrowing, large osteophytes, ankylosis"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Discitis", "Ankylosing spondylitis"],
                "recommendations": ["Clinical correlation with symptoms", "MRI if radiculopathy"]
            }
        ],
        "extremity": [
            {
                "id": "fracture",
                "name": "Fracture",
                "description": "Break in bone continuity",
                "findings": [
                    "Cortical disruption", "Fracture line",
                    "Displacement", "Angulation", "Comminution"
                ],
                "locations": ["distal radius", "proximal humerus", "ankle", "hip", "wrist"],
                "severity_indicators": {
                    "mild": "Non-displaced, simple fracture",
                    "moderate": "Minimally displaced, single fragment",
                    "severe": "Displaced, comminuted, intra-articular"
                },
                "urgency": Urgency.URGENT,
                "differential": ["Pathologic fracture", "Stress fracture"],
                "recommendations": ["Orthopedic consultation", "Immobilization"]
            },
            {
                "id": "osteoarthritis",
                "name": "Osteoarthritis",
                "description": "Degenerative joint disease",
                "findings": [
                    "Joint space narrowing", "Osteophytes",
                    "Subchondral sclerosis", "Subchondral cysts"
                ],
                "locations": ["knee", "hip", "hand", "shoulder"],
                "severity_indicators": {
                    "mild": "Minimal joint space narrowing",
                    "moderate": "Moderate narrowing with osteophytes",
                    "severe": "Bone-on-bone, large osteophytes"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Inflammatory arthritis", "CPPD"],
                "recommendations": ["Conservative management", "Consider arthroplasty if severe"]
            }
        ]
    },
    "CT": {
        "head": [
            {
                "id": "intracranial_hemorrhage",
                "name": "Intracranial Hemorrhage",
                "description": "Bleeding within the cranial cavity",
                "findings": [
                    "Hyperdense collection", "Mass effect",
                    "Midline shift", "Ventricular compression"
                ],
                "subtypes": ["epidural", "subdural", "subarachnoid", "intraparenchymal", "intraventricular"],
                "locations": ["frontal", "temporal", "parietal", "occipital", "posterior fossa"],
                "severity_indicators": {
                    "mild": "< 10mm, no midline shift",
                    "moderate": "10-20mm, < 5mm midline shift",
                    "severe": "> 20mm, > 5mm midline shift, herniation"
                },
                "urgency": Urgency.CRITICAL,
                "differential": ["Tumor", "Calcification"],
                "recommendations": ["STAT neurosurgery consultation", "Consider craniotomy"]
            },
            {
                "id": "acute_stroke",
                "name": "Acute Ischemic Stroke",
                "description": "Acute cerebral infarction",
                "findings": [
                    "Loss of gray-white differentiation", "Hypodense region",
                    "Insular ribbon sign", "Dense MCA sign", "Sulcal effacement"
                ],
                "locations": ["MCA territory", "ACA territory", "PCA territory", "watershed", "lacunar"],
                "severity_indicators": {
                    "mild": "Small lacunar infarct",
                    "moderate": "Partial territorial infarct",
                    "severe": "Large territorial infarct, mass effect"
                },
                "urgency": Urgency.CRITICAL,
                "differential": ["Tumor", "Encephalitis"],
                "recommendations": ["STAT neurology consultation", "Consider thrombolysis/thrombectomy"]
            },
            {
                "id": "brain_mass",
                "name": "Intracranial Mass",
                "description": "Space-occupying lesion in brain",
                "findings": [
                    "Enhancing mass", "Surrounding edema",
                    "Mass effect", "Midline shift"
                ],
                "locations": ["frontal lobe", "temporal lobe", "parietal lobe", "posterior fossa", "sellar region"],
                "severity_indicators": {
                    "mild": "< 2cm, no edema",
                    "moderate": "2-4cm, mild edema",
                    "severe": "> 4cm, significant edema, herniation risk"
                },
                "urgency": Urgency.URGENT,
                "differential": ["Primary tumor", "Metastasis", "Abscess"],
                "recommendations": ["MRI with contrast", "Neurosurgery consultation"]
            }
        ],
        "chest": [
            {
                "id": "pulmonary_embolism",
                "name": "Pulmonary Embolism",
                "description": "Thrombus in pulmonary arteries",
                "findings": [
                    "Filling defect in pulmonary artery", "Polo mint sign",
                    "Railway track sign", "RV enlargement", "Mosaic attenuation"
                ],
                "locations": ["main pulmonary artery", "lobar", "segmental", "subsegmental", "saddle"],
                "severity_indicators": {
                    "mild": "Subsegmental, unilateral",
                    "moderate": "Segmental, bilateral",
                    "severe": "Central/saddle PE, RV strain"
                },
                "urgency": Urgency.CRITICAL,
                "differential": ["Mucus plug", "Motion artifact"],
                "recommendations": ["Anticoagulation", "Consider thrombolysis if massive"]
            },
            {
                "id": "lung_mass",
                "name": "Lung Mass",
                "description": "Pulmonary mass > 3cm",
                "findings": [
                    "Solid mass > 3cm", "Spiculated margins",
                    "Lymphadenopathy", "Pleural involvement"
                ],
                "locations": ["right upper lobe", "right lower lobe", "left upper lobe", "left lower lobe", "central"],
                "severity_indicators": {
                    "mild": "3-4cm, well-defined",
                    "moderate": "4-6cm, spiculated, no invasion",
                    "severe": "> 6cm, invasion, lymphadenopathy"
                },
                "urgency": Urgency.URGENT,
                "differential": ["Primary lung cancer", "Metastasis", "Lymphoma"],
                "recommendations": ["PET-CT staging", "Tissue biopsy", "Oncology referral"]
            },
            {
                "id": "aortic_dissection",
                "name": "Aortic Dissection",
                "description": "Tear in aortic intima with false lumen",
                "findings": [
                    "Intimal flap", "True and false lumen",
                    "Aortic dilation", "Branch vessel involvement"
                ],
                "locations": ["ascending aorta", "aortic arch", "descending aorta", "Stanford A", "Stanford B"],
                "severity_indicators": {
                    "mild": "Limited descending dissection",
                    "moderate": "Extensive descending involvement",
                    "severe": "Ascending involvement, branch compromise"
                },
                "urgency": Urgency.CRITICAL,
                "differential": ["Intramural hematoma", "Penetrating ulcer"],
                "recommendations": ["STAT cardiothoracic surgery", "Blood pressure control"]
            }
        ],
        "abdomen": [
            {
                "id": "appendicitis",
                "name": "Acute Appendicitis",
                "description": "Inflammation of the appendix",
                "findings": [
                    "Appendix > 6mm diameter", "Periappendiceal fat stranding",
                    "Appendicolith", "Wall enhancement"
                ],
                "locations": ["right lower quadrant", "retrocecal", "pelvic"],
                "severity_indicators": {
                    "mild": "Uncomplicated, < 10mm",
                    "moderate": "Complicated, abscess formation",
                    "severe": "Perforated, peritonitis"
                },
                "urgency": Urgency.EMERGENT,
                "differential": ["Mesenteric adenitis", "Crohn's disease"],
                "recommendations": ["Surgical consultation", "NPO status"]
            },
            {
                "id": "bowel_obstruction",
                "name": "Bowel Obstruction",
                "description": "Mechanical obstruction of bowel",
                "findings": [
                    "Dilated bowel loops", "Air-fluid levels",
                    "Transition point", "Decompressed distal bowel"
                ],
                "locations": ["small bowel", "large bowel", "gastric outlet"],
                "severity_indicators": {
                    "mild": "Partial, no ischemia",
                    "moderate": "High-grade, some ischemia signs",
                    "severe": "Complete, closed loop, strangulation"
                },
                "urgency": Urgency.EMERGENT,
                "differential": ["Ileus", "Pseudo-obstruction"],
                "recommendations": ["Surgical consultation", "NGT decompression"]
            },
            {
                "id": "kidney_stone",
                "name": "Nephrolithiasis",
                "description": "Kidney or ureteral calculus",
                "findings": [
                    "Hyperdense focus in collecting system",
                    "Hydronephrosis", "Perinephric stranding", "Ureteral dilation"
                ],
                "locations": ["kidney", "proximal ureter", "mid ureter", "distal ureter", "UVJ"],
                "severity_indicators": {
                    "mild": "< 5mm, no hydronephrosis",
                    "moderate": "5-10mm, mild hydronephrosis",
                    "severe": "> 10mm, moderate/severe hydronephrosis"
                },
                "urgency": Urgency.URGENT,
                "differential": ["Phlebolith", "Vascular calcification"],
                "recommendations": ["Urology consultation", "Pain management", "Strain urine"]
            }
        ]
    },
    "MRI": {
        "brain": [
            {
                "id": "ms_lesions",
                "name": "Multiple Sclerosis Lesions",
                "description": "Demyelinating white matter lesions",
                "findings": [
                    "Periventricular lesions", "Dawson's fingers",
                    "Juxtacortical lesions", "Infratentorial lesions"
                ],
                "locations": ["periventricular", "corpus callosum", "juxtacortical", "brainstem", "cerebellum"],
                "severity_indicators": {
                    "mild": "Few lesions, no enhancement",
                    "moderate": "Multiple lesions, some enhancement",
                    "severe": "Numerous lesions, cord involvement, atrophy"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Small vessel disease", "ADEM", "NMO"],
                "recommendations": ["Neurology referral", "CSF analysis", "Spinal MRI"]
            },
            {
                "id": "brain_tumor",
                "name": "Brain Tumor",
                "description": "Primary or metastatic brain neoplasm",
                "findings": [
                    "Enhancing mass", "T2 hyperintense",
                    "Surrounding edema", "Mass effect"
                ],
                "locations": ["frontal", "temporal", "parietal", "occipital", "posterior fossa"],
                "severity_indicators": {
                    "mild": "< 2cm, minimal edema",
                    "moderate": "2-4cm, moderate edema",
                    "severe": "> 4cm, significant edema, herniation"
                },
                "urgency": Urgency.URGENT,
                "differential": ["GBM", "Metastasis", "Meningioma", "Abscess"],
                "recommendations": ["Neurosurgery consultation", "Consider biopsy/resection"]
            }
        ],
        "spine": [
            {
                "id": "disc_herniation",
                "name": "Disc Herniation",
                "description": "Disc material extending beyond annulus",
                "findings": [
                    "Disc protrusion/extrusion", "Neural impingement",
                    "Thecal sac compression", "Foraminal narrowing"
                ],
                "locations": ["L4-L5", "L5-S1", "L3-L4", "C5-C6", "C6-C7"],
                "severity_indicators": {
                    "mild": "Bulge without neural contact",
                    "moderate": "Protrusion with nerve contact",
                    "severe": "Extrusion with compression, cauda equina"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Synovial cyst", "Tumor"],
                "recommendations": ["Conservative management", "Surgery if severe/progressive"]
            },
            {
                "id": "spinal_stenosis",
                "name": "Spinal Stenosis",
                "description": "Narrowing of spinal canal",
                "findings": [
                    "Central canal narrowing", "Lateral recess stenosis",
                    "Ligamentum flavum hypertrophy", "Facet arthropathy"
                ],
                "locations": ["L4-L5", "L3-L4", "L5-S1", "cervical"],
                "severity_indicators": {
                    "mild": "< 25% canal narrowing",
                    "moderate": "25-50% canal narrowing",
                    "severe": "> 50% narrowing, cord signal change"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Tumor", "Epidural abscess"],
                "recommendations": ["Conservative management", "Surgery if myelopathy"]
            },
            {
                "id": "cord_compression",
                "name": "Spinal Cord Compression",
                "description": "Compression of spinal cord",
                "findings": [
                    "Cord deformity", "T2 signal change in cord",
                    "Effacement of CSF", "Canal compromise"
                ],
                "locations": ["cervical", "thoracic", "conus"],
                "severity_indicators": {
                    "mild": "CSF effacement, no cord signal change",
                    "moderate": "Cord deformity, early signal change",
                    "severe": "Severe compression, myelomalacia"
                },
                "urgency": Urgency.EMERGENT,
                "differential": ["Tumor", "Abscess", "Hematoma"],
                "recommendations": ["STAT neurosurgery consultation", "Consider steroids"]
            }
        ],
        "knee": [
            {
                "id": "acl_tear",
                "name": "ACL Tear",
                "description": "Anterior cruciate ligament injury",
                "findings": [
                    "Discontinuous ligament fibers", "Abnormal signal",
                    "Bone contusions", "Secondary signs"
                ],
                "locations": ["femoral attachment", "mid-substance", "tibial attachment"],
                "severity_indicators": {
                    "mild": "Partial tear, < 50%",
                    "moderate": "High-grade partial tear",
                    "severe": "Complete tear"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Mucoid degeneration", "Partial tear"],
                "recommendations": ["Orthopedic consultation", "Consider reconstruction"]
            },
            {
                "id": "meniscus_tear",
                "name": "Meniscal Tear",
                "description": "Tear of medial or lateral meniscus",
                "findings": [
                    "Linear signal reaching articular surface",
                    "Displaced fragment", "Abnormal morphology"
                ],
                "locations": ["medial meniscus posterior horn", "lateral meniscus", "anterior horn", "body"],
                "severity_indicators": {
                    "mild": "Horizontal tear, stable",
                    "moderate": "Complex tear, non-displaced",
                    "severe": "Bucket-handle, displaced"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Meniscal degeneration", "Artifact"],
                "recommendations": ["Conservative vs surgical management", "Orthopedic referral"]
            }
        ]
    },
    "ULTRASOUND": {
        "abdomen": [
            {
                "id": "gallstones",
                "name": "Cholelithiasis",
                "description": "Gallbladder stones",
                "findings": [
                    "Echogenic focus with posterior acoustic shadowing",
                    "Dependent position", "Movement with patient position"
                ],
                "locations": ["gallbladder fundus", "gallbladder body", "gallbladder neck", "CBD"],
                "severity_indicators": {
                    "mild": "Single small stone, no wall thickening",
                    "moderate": "Multiple stones, mild wall thickening",
                    "severe": "Impacted stone, cholecystitis signs"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Polyp", "Sludge"],
                "recommendations": ["Surgical consultation if symptomatic"]
            },
            {
                "id": "cholecystitis",
                "name": "Acute Cholecystitis",
                "description": "Gallbladder inflammation",
                "findings": [
                    "Wall thickening > 3mm", "Pericholecystic fluid",
                    "Sonographic Murphy's sign", "Gallstones"
                ],
                "locations": ["gallbladder"],
                "severity_indicators": {
                    "mild": "Wall thickening, positive Murphy's",
                    "moderate": "Pericholecystic fluid",
                    "severe": "Gangrenous changes, perforation"
                },
                "urgency": Urgency.EMERGENT,
                "differential": ["Hepatitis", "Cholangitis"],
                "recommendations": ["Surgical consultation", "Antibiotics"]
            },
            {
                "id": "hydronephrosis",
                "name": "Hydronephrosis",
                "description": "Dilation of renal collecting system",
                "findings": [
                    "Dilated renal pelvis", "Dilated calyces",
                    "Ureteral dilation", "Cortical thinning"
                ],
                "locations": ["right kidney", "left kidney", "bilateral"],
                "severity_indicators": {
                    "mild": "Mild pelvic dilation, normal calyces",
                    "moderate": "Calyceal dilation, preserved cortex",
                    "severe": "Severe dilation, cortical thinning"
                },
                "urgency": Urgency.URGENT,
                "differential": ["Parapelvic cyst", "Prior obstruction"],
                "recommendations": ["Identify cause", "CT if stone suspected"]
            }
        ],
        "pelvis": [
            {
                "id": "ovarian_cyst",
                "name": "Ovarian Cyst",
                "description": "Cystic lesion in ovary",
                "findings": [
                    "Anechoic lesion", "Thin wall",
                    "Posterior acoustic enhancement"
                ],
                "locations": ["right ovary", "left ovary"],
                "severity_indicators": {
                    "mild": "Simple cyst < 3cm",
                    "moderate": "Simple cyst 3-5cm",
                    "severe": "> 5cm or complex features"
                },
                "urgency": Urgency.ROUTINE,
                "differential": ["Paraovarian cyst", "Hydrosalpinx"],
                "recommendations": ["Follow-up ultrasound", "OB/GYN referral if complex"]
            },
            {
                "id": "ectopic_pregnancy",
                "name": "Ectopic Pregnancy",
                "description": "Pregnancy outside uterine cavity",
                "findings": [
                    "Adnexal mass", "Empty uterus with positive hCG",
                    "Ring of fire sign", "Free fluid"
                ],
                "locations": ["right adnexa", "left adnexa", "tubal"],
                "severity_indicators": {
                    "mild": "Small gestational sac, no free fluid",
                    "moderate": "Moderate size, small free fluid",
                    "severe": "Ruptured, large hemoperitoneum"
                },
                "urgency": Urgency.CRITICAL,
                "differential": ["Corpus luteum cyst", "Tubo-ovarian abscess"],
                "recommendations": ["STAT OB/GYN consultation", "Serial hCG", "Consider MTX or surgery"]
            }
        ]
    }
}

# Normal findings templates by modality and body part
NORMAL_FINDINGS_TEMPLATES: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
    "XRAY": {
        "chest": [
            {"region": "Lungs", "finding": "Clear lung fields bilaterally. No focal consolidation, effusion, or pneumothorax."},
            {"region": "Heart", "finding": "Normal cardiac silhouette. Cardiothoracic ratio within normal limits."},
            {"region": "Mediastinum", "finding": "Mediastinal contours are unremarkable. No widening."},
            {"region": "Bones", "finding": "Visualized osseous structures are intact. No acute fracture or dislocation."},
            {"region": "Soft Tissues", "finding": "Soft tissues are unremarkable."}
        ],
        "spine": [
            {"region": "Alignment", "finding": "Normal spinal alignment maintained."},
            {"region": "Vertebral Bodies", "finding": "Vertebral body heights are preserved. No compression deformity."},
            {"region": "Disc Spaces", "finding": "Intervertebral disc spaces are preserved."},
            {"region": "Pedicles", "finding": "Pedicles are intact bilaterally."}
        ],
        "extremity": [
            {"region": "Bones", "finding": "No acute fracture or dislocation identified."},
            {"region": "Joints", "finding": "Joint spaces are maintained. No significant degenerative changes."},
            {"region": "Soft Tissues", "finding": "Soft tissues are unremarkable. No foreign body."}
        ]
    },
    "CT": {
        "head": [
            {"region": "Brain Parenchyma", "finding": "No acute intracranial hemorrhage or mass."},
            {"region": "Ventricles", "finding": "Ventricles are normal in size and configuration."},
            {"region": "Midline", "finding": "No midline shift."},
            {"region": "Extra-axial Spaces", "finding": "No extra-axial collection."},
            {"region": "Bones", "finding": "Calvarium is intact. No fracture."}
        ],
        "chest": [
            {"region": "Lungs", "finding": "Lungs are clear. No nodules, masses, or consolidation."},
            {"region": "Pulmonary Arteries", "finding": "No filling defect to suggest pulmonary embolism."},
            {"region": "Mediastinum", "finding": "No lymphadenopathy. Mediastinal structures are normal."},
            {"region": "Heart/Pericardium", "finding": "Heart is normal in size. No pericardial effusion."},
            {"region": "Pleura", "finding": "No pleural effusion or pneumothorax."}
        ],
        "abdomen": [
            {"region": "Liver", "finding": "Liver is normal in size and attenuation. No focal lesion."},
            {"region": "Gallbladder", "finding": "Gallbladder is unremarkable. No stones or wall thickening."},
            {"region": "Pancreas", "finding": "Pancreas is normal in size and attenuation."},
            {"region": "Spleen", "finding": "Spleen is normal in size."},
            {"region": "Kidneys", "finding": "Kidneys are normal. No hydronephrosis or stones."},
            {"region": "Bowel", "finding": "Bowel gas pattern is unremarkable. No obstruction."}
        ]
    },
    "MRI": {
        "brain": [
            {"region": "Gray Matter", "finding": "Normal gray matter signal intensity."},
            {"region": "White Matter", "finding": "No abnormal white matter signal. No demyelination."},
            {"region": "Ventricles", "finding": "Ventricles are normal in size and configuration."},
            {"region": "Posterior Fossa", "finding": "Posterior fossa structures are unremarkable."},
            {"region": "Pituitary", "finding": "Pituitary gland is normal in size."}
        ],
        "spine": [
            {"region": "Vertebral Bodies", "finding": "Normal vertebral body marrow signal."},
            {"region": "Intervertebral Discs", "finding": "No significant disc herniation or protrusion."},
            {"region": "Spinal Cord", "finding": "Spinal cord is normal in caliber and signal."},
            {"region": "Neural Foramina", "finding": "Neural foramina are patent."}
        ],
        "knee": [
            {"region": "ACL", "finding": "Anterior cruciate ligament is intact."},
            {"region": "PCL", "finding": "Posterior cruciate ligament is intact."},
            {"region": "Menisci", "finding": "Medial and lateral menisci are intact. No tear."},
            {"region": "Cartilage", "finding": "Articular cartilage is preserved."},
            {"region": "Bone", "finding": "No bone marrow edema or fracture."}
        ]
    },
    "ULTRASOUND": {
        "abdomen": [
            {"region": "Liver", "finding": "Liver is normal in size and echotexture. No focal lesion."},
            {"region": "Gallbladder", "finding": "Gallbladder is normal. No stones, wall thickening, or pericholecystic fluid."},
            {"region": "CBD", "finding": "Common bile duct is normal in caliber."},
            {"region": "Pancreas", "finding": "Visualized pancreas is unremarkable."},
            {"region": "Kidneys", "finding": "Kidneys are normal in size and echotexture. No hydronephrosis."},
            {"region": "Spleen", "finding": "Spleen is normal in size."}
        ],
        "pelvis": [
            {"region": "Uterus", "finding": "Uterus is normal in size and echotexture."},
            {"region": "Endometrium", "finding": "Endometrial thickness is appropriate."},
            {"region": "Ovaries", "finding": "Ovaries are normal. No cyst or mass."},
            {"region": "Adnexa", "finding": "No adnexal abnormality."},
            {"region": "Free Fluid", "finding": "No free pelvic fluid."}
        ]
    }
}

# Structured reporting templates
REPORT_TEMPLATES = {
    "standard": {
        "sections": ["CLINICAL INDICATION", "TECHNIQUE", "COMPARISON", "FINDINGS", "IMPRESSION"],
        "format": "structured"
    },
    "emergency": {
        "sections": ["CRITICAL FINDING", "CLINICAL INDICATION", "FINDINGS", "IMPRESSION", "RECOMMENDATIONS"],
        "format": "urgent"
    }
}

# ACR appropriateness criteria (simplified)
ACR_APPROPRIATENESS = {
    "chest_pain": {
        "first_line": ["Chest X-ray", "ECG"],
        "if_abnormal": ["CT Chest with contrast", "CT Coronary Angiography"],
        "specialized": ["Cardiac MRI", "Nuclear stress test"]
    },
    "headache": {
        "first_line": ["Non-contrast CT Head"],
        "if_abnormal": ["MRI Brain with contrast"],
        "specialized": ["MRA/MRV", "CTA Head/Neck"]
    },
    "abdominal_pain": {
        "first_line": ["Abdominal X-ray", "Ultrasound"],
        "if_abnormal": ["CT Abdomen/Pelvis with contrast"],
        "specialized": ["MRI Abdomen", "MRCP"]
    }
}
