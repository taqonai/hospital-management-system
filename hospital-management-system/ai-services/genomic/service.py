"""
Genomic Profile Service for A'mad Precision Health

Parses and interprets genetic data from:
- VCF files (Variant Call Format)
- 23andMe raw data files
- AncestryDNA raw data files

Extracts SNP markers and provides health interpretations.
"""

import logging
import hashlib
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class GenomicSource(str, Enum):
    VCF = "VCF"
    TWENTYTHREE_AND_ME = "TWENTYTHREE_AND_ME"
    ANCESTRY_DNA = "ANCESTRY_DNA"
    MANUAL = "MANUAL"


class MarkerCategory(str, Enum):
    METABOLISM = "METABOLISM"
    NUTRITION = "NUTRITION"
    INFLAMMATION = "INFLAMMATION"
    FITNESS = "FITNESS"
    SLEEP = "SLEEP"
    CARDIOVASCULAR = "CARDIOVASCULAR"
    MENTAL_HEALTH = "MENTAL_HEALTH"
    DETOXIFICATION = "DETOXIFICATION"


class RiskLevel(str, Enum):
    LOW = "LOW"
    BELOW_AVERAGE = "BELOW_AVERAGE"
    AVERAGE = "AVERAGE"
    ABOVE_AVERAGE = "ABOVE_AVERAGE"
    HIGH = "HIGH"


@dataclass
class GenomicMarker:
    rsId: str
    gene: str
    genotype: str
    category: MarkerCategory
    phenotype: str
    confidence: float
    recommendations: List[str]
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class GenomicRiskScore:
    condition: str
    riskLevel: RiskLevel
    percentile: float
    confidenceScore: float
    contributingSnps: List[str]
    recommendations: List[str]


# SNP Knowledge Base - MVP markers with interpretations
SNP_DATABASE = {
    # Caffeine Metabolism - CYP1A2
    "rs762551": {
        "gene": "CYP1A2",
        "category": MarkerCategory.METABOLISM,
        "interpretations": {
            "AA": {
                "phenotype": "Fast caffeine metabolizer",
                "recommendations": [
                    "Caffeine is processed quickly by your body",
                    "Moderate coffee consumption (3-4 cups) is generally safe",
                    "May benefit from pre-workout caffeine"
                ],
                "risk_modifier": 0.8
            },
            "AC": {
                "phenotype": "Moderate caffeine metabolizer",
                "recommendations": [
                    "You process caffeine at a moderate rate",
                    "Limit caffeine to 2-3 cups of coffee daily",
                    "Avoid caffeine after 2 PM for better sleep"
                ],
                "risk_modifier": 1.0
            },
            "CC": {
                "phenotype": "Slow caffeine metabolizer",
                "recommendations": [
                    "Caffeine stays in your system longer",
                    "Limit to 1-2 cups of coffee daily",
                    "Avoid caffeine after noon",
                    "Higher cardiovascular risk with excess caffeine"
                ],
                "risk_modifier": 1.3
            }
        }
    },
    # Folate Metabolism - MTHFR
    "rs1801133": {
        "gene": "MTHFR",
        "category": MarkerCategory.NUTRITION,
        "interpretations": {
            "CC": {
                "phenotype": "Normal folate metabolism",
                "recommendations": [
                    "Standard folate intake is sufficient",
                    "Eat leafy greens, legumes, and fortified grains"
                ],
                "risk_modifier": 1.0
            },
            "CT": {
                "phenotype": "Slightly reduced folate metabolism",
                "recommendations": [
                    "Consider eating more folate-rich foods",
                    "Leafy greens, legumes, and liver are good sources",
                    "Methylfolate may be better absorbed than folic acid"
                ],
                "risk_modifier": 1.2
            },
            "TT": {
                "phenotype": "Significantly reduced folate metabolism",
                "recommendations": [
                    "Prioritize methylfolate over folic acid",
                    "Eat abundant leafy greens and legumes",
                    "Consider B12 supplementation as well",
                    "Discuss with doctor if planning pregnancy"
                ],
                "risk_modifier": 1.5
            }
        }
    },
    # Lactose Tolerance - LCT
    "rs4988235": {
        "gene": "LCT",
        "category": MarkerCategory.NUTRITION,
        "interpretations": {
            "TT": {
                "phenotype": "Lactose tolerant",
                "recommendations": [
                    "You can digest lactose normally",
                    "Dairy products are well tolerated"
                ],
                "risk_modifier": 0.5
            },
            "CT": {
                "phenotype": "Partial lactose tolerance",
                "recommendations": [
                    "You may have some lactose tolerance",
                    "Monitor dairy intake for symptoms",
                    "Fermented dairy (yogurt, cheese) may be better tolerated"
                ],
                "risk_modifier": 1.0
            },
            "CC": {
                "phenotype": "Lactose intolerant",
                "recommendations": [
                    "You likely have difficulty digesting lactose",
                    "Choose lactose-free dairy alternatives",
                    "Ensure adequate calcium from non-dairy sources",
                    "Lactase supplements may help if consuming dairy"
                ],
                "risk_modifier": 1.5
            }
        }
    },
    # Muscle Fiber Type - ACTN3
    "rs1815739": {
        "gene": "ACTN3",
        "category": MarkerCategory.FITNESS,
        "interpretations": {
            "CC": {
                "phenotype": "Sprint/power optimized",
                "recommendations": [
                    "You have genetic advantage for power sports",
                    "Focus on strength training and HIIT",
                    "Good potential for sprinting, weightlifting"
                ],
                "risk_modifier": 0.8
            },
            "CT": {
                "phenotype": "Mixed muscle fiber profile",
                "recommendations": [
                    "You have balanced muscle fiber composition",
                    "Can excel at both power and endurance sports",
                    "Vary training between strength and cardio"
                ],
                "risk_modifier": 1.0
            },
            "TT": {
                "phenotype": "Endurance optimized",
                "recommendations": [
                    "You have genetic advantage for endurance sports",
                    "Focus on aerobic training",
                    "Good potential for running, cycling, swimming"
                ],
                "risk_modifier": 1.0
            }
        }
    },
    # Vitamin D - VDR
    "rs2228570": {
        "gene": "VDR",
        "category": MarkerCategory.NUTRITION,
        "interpretations": {
            "CC": {
                "phenotype": "Normal vitamin D receptor activity",
                "recommendations": [
                    "Standard vitamin D requirements",
                    "Get 15-20 minutes of sun exposure daily",
                    "Eat vitamin D rich foods (fatty fish, eggs)"
                ],
                "risk_modifier": 1.0
            },
            "CT": {
                "phenotype": "Moderately reduced vitamin D receptor activity",
                "recommendations": [
                    "May need slightly more vitamin D",
                    "Consider vitamin D supplementation in winter",
                    "Get vitamin D levels tested annually"
                ],
                "risk_modifier": 1.2
            },
            "TT": {
                "phenotype": "Reduced vitamin D receptor activity",
                "recommendations": [
                    "Higher vitamin D requirements",
                    "Supplement with vitamin D3 (2000-4000 IU)",
                    "Get regular vitamin D blood tests",
                    "More sun exposure needed"
                ],
                "risk_modifier": 1.4
            }
        }
    },
    # COMT - Stress Response
    "rs4680": {
        "gene": "COMT",
        "category": MarkerCategory.MENTAL_HEALTH,
        "interpretations": {
            "GG": {
                "phenotype": "Warrior (fast COMT)",
                "recommendations": [
                    "You clear dopamine quickly",
                    "Better stress resilience under pressure",
                    "May need more stimulation to feel motivated",
                    "Moderate caffeine is usually well tolerated"
                ],
                "risk_modifier": 0.9
            },
            "AG": {
                "phenotype": "Balanced COMT activity",
                "recommendations": [
                    "Balanced dopamine clearance",
                    "Good cognitive flexibility",
                    "Moderate stress management practices recommended"
                ],
                "risk_modifier": 1.0
            },
            "AA": {
                "phenotype": "Worrier (slow COMT)",
                "recommendations": [
                    "You retain dopamine longer",
                    "May be more sensitive to stress",
                    "Benefit from meditation and relaxation",
                    "Limit caffeine and stimulants",
                    "Enhanced memory and attention to detail"
                ],
                "risk_modifier": 1.3
            }
        }
    },
    # FTO - Obesity Risk
    "rs9939609": {
        "gene": "FTO",
        "category": MarkerCategory.NUTRITION,
        "interpretations": {
            "TT": {
                "phenotype": "Lower obesity risk",
                "recommendations": [
                    "Lower genetic predisposition to obesity",
                    "Standard healthy diet is sufficient",
                    "Maintain regular physical activity"
                ],
                "risk_modifier": 0.8
            },
            "AT": {
                "phenotype": "Moderate obesity risk",
                "recommendations": [
                    "Some genetic tendency toward weight gain",
                    "Focus on portion control",
                    "Regular exercise is important",
                    "Monitor calorie intake"
                ],
                "risk_modifier": 1.2
            },
            "AA": {
                "phenotype": "Higher obesity risk",
                "recommendations": [
                    "Higher genetic predisposition to obesity",
                    "Strict portion control recommended",
                    "Regular exercise is essential",
                    "Consider Mediterranean or low-glycemic diet",
                    "Regular weight monitoring"
                ],
                "risk_modifier": 1.6
            }
        }
    },
    # Alcohol Metabolism - ADH1B
    "rs1229984": {
        "gene": "ADH1B",
        "category": MarkerCategory.METABOLISM,
        "interpretations": {
            "CC": {
                "phenotype": "Slow alcohol metabolism",
                "recommendations": [
                    "Alcohol is processed more slowly",
                    "May feel effects longer",
                    "Limit alcohol consumption",
                    "Allow more time between drinks"
                ],
                "risk_modifier": 1.0
            },
            "CT": {
                "phenotype": "Moderate alcohol metabolism",
                "recommendations": [
                    "Average alcohol processing",
                    "Follow standard drinking guidelines",
                    "Stay hydrated when drinking"
                ],
                "risk_modifier": 0.9
            },
            "TT": {
                "phenotype": "Fast alcohol metabolism",
                "recommendations": [
                    "Alcohol is processed quickly",
                    "May experience flushing reaction",
                    "This variant is protective against alcoholism",
                    "Still follow moderate drinking guidelines"
                ],
                "risk_modifier": 0.7
            }
        }
    },
    # Sleep - ADORA2A
    "rs5751876": {
        "gene": "ADORA2A",
        "category": MarkerCategory.SLEEP,
        "interpretations": {
            "CC": {
                "phenotype": "Caffeine tolerant for sleep",
                "recommendations": [
                    "Less sensitive to caffeine's sleep effects",
                    "Can tolerate later caffeine consumption",
                    "Still avoid caffeine close to bedtime"
                ],
                "risk_modifier": 0.8
            },
            "CT": {
                "phenotype": "Moderate caffeine sensitivity for sleep",
                "recommendations": [
                    "Moderate sensitivity to caffeine",
                    "Stop caffeine 6 hours before bed",
                    "Monitor sleep quality after caffeine"
                ],
                "risk_modifier": 1.0
            },
            "TT": {
                "phenotype": "Caffeine sensitive for sleep",
                "recommendations": [
                    "High sensitivity to caffeine's sleep effects",
                    "Stop caffeine 8-10 hours before bed",
                    "Consider decaf or caffeine-free options",
                    "Morning-only caffeine recommended"
                ],
                "risk_modifier": 1.4
            }
        }
    },
    # Inflammation - IL6
    "rs1800795": {
        "gene": "IL6",
        "category": MarkerCategory.INFLAMMATION,
        "interpretations": {
            "GG": {
                "phenotype": "Higher IL-6 production",
                "recommendations": [
                    "May have higher inflammatory response",
                    "Anti-inflammatory diet recommended",
                    "Omega-3 fatty acids are beneficial",
                    "Regular exercise helps manage inflammation"
                ],
                "risk_modifier": 1.3
            },
            "GC": {
                "phenotype": "Moderate IL-6 production",
                "recommendations": [
                    "Average inflammatory response",
                    "Balanced diet with omega-3s",
                    "Regular physical activity"
                ],
                "risk_modifier": 1.0
            },
            "CC": {
                "phenotype": "Lower IL-6 production",
                "recommendations": [
                    "Lower baseline inflammation",
                    "Standard healthy diet is sufficient",
                    "Maintain active lifestyle"
                ],
                "risk_modifier": 0.8
            }
        }
    }
}

# Disease Risk Calculations
DISEASE_RISK_SNPS = {
    "Type 2 Diabetes": {
        "snps": ["rs9939609", "rs1801133"],
        "base_risk": 10.0,  # Base population risk percentage
        "category": "metabolic"
    },
    "Cardiovascular Disease": {
        "snps": ["rs762551", "rs1800795"],
        "base_risk": 15.0,
        "category": "cardiovascular"
    },
    "Obesity": {
        "snps": ["rs9939609"],
        "base_risk": 30.0,
        "category": "metabolic"
    },
    "Lactose Intolerance": {
        "snps": ["rs4988235"],
        "base_risk": 65.0,  # High base rate globally
        "category": "digestive"
    }
}


class GenomicService:
    """
    Service for parsing and interpreting genomic data.
    """

    def __init__(self):
        self.snp_database = SNP_DATABASE
        self.disease_risks = DISEASE_RISK_SNPS
        logger.info("GenomicService initialized with %d SNPs in database", len(self.snp_database))

    def detect_file_format(self, content: str) -> GenomicSource:
        """Detect the format of the genomic data file."""
        lines = content.strip().split('\n')[:20]

        for line in lines:
            # VCF format detection
            if line.startswith('##fileformat=VCF'):
                return GenomicSource.VCF
            # 23andMe format detection
            if '23andMe' in line or (line.startswith('#') and 'rsid' in line.lower()):
                return GenomicSource.TWENTYTHREE_AND_ME
            # AncestryDNA format detection
            if 'AncestryDNA' in line or (line.startswith('#') and 'rsid' in line.lower() and 'chromosome' in line.lower()):
                return GenomicSource.ANCESTRY_DNA

        # Default to 23andMe format if has expected columns
        if any('\t' in line and 'rs' in line for line in lines):
            return GenomicSource.TWENTYTHREE_AND_ME

        return GenomicSource.MANUAL

    def parse_file(self, content: str, source: Optional[GenomicSource] = None) -> Dict[str, str]:
        """
        Parse genomic data file and extract SNP genotypes.

        Returns: Dict mapping rsId to genotype
        """
        if source is None:
            source = self.detect_file_format(content)

        if source == GenomicSource.VCF:
            return self._parse_vcf(content)
        elif source == GenomicSource.TWENTYTHREE_AND_ME:
            return self._parse_23andme(content)
        elif source == GenomicSource.ANCESTRY_DNA:
            return self._parse_ancestry(content)
        else:
            return {}

    def _parse_vcf(self, content: str) -> Dict[str, str]:
        """Parse VCF format file."""
        snps = {}
        lines = content.strip().split('\n')

        for line in lines:
            if line.startswith('#'):
                continue

            parts = line.split('\t')
            if len(parts) >= 10:
                chrom = parts[0]
                pos = parts[1]
                rsid = parts[2]
                ref = parts[3]
                alt = parts[4]
                format_field = parts[8] if len(parts) > 8 else ""
                sample = parts[9] if len(parts) > 9 else ""

                # Extract genotype from sample field
                if 'GT' in format_field:
                    gt_index = format_field.split(':').index('GT')
                    gt = sample.split(':')[gt_index] if ':' in sample else sample

                    # Convert to genotype
                    alleles = [ref] + alt.split(',')
                    if '/' in gt or '|' in gt:
                        sep = '/' if '/' in gt else '|'
                        indices = gt.split(sep)
                        try:
                            genotype = ''.join(alleles[int(i)] for i in indices)
                            if rsid.startswith('rs'):
                                snps[rsid] = genotype
                        except (ValueError, IndexError):
                            continue

        return snps

    def _parse_23andme(self, content: str) -> Dict[str, str]:
        """Parse 23andMe raw data format."""
        snps = {}
        lines = content.strip().split('\n')

        for line in lines:
            if line.startswith('#') or not line.strip():
                continue

            parts = line.split('\t')
            if len(parts) >= 4:
                rsid = parts[0]
                genotype = parts[3].strip()

                if rsid.startswith('rs') and genotype and genotype != '--':
                    snps[rsid] = genotype

        return snps

    def _parse_ancestry(self, content: str) -> Dict[str, str]:
        """Parse AncestryDNA raw data format."""
        snps = {}
        lines = content.strip().split('\n')

        for line in lines:
            if line.startswith('#') or not line.strip():
                continue

            parts = line.split('\t')
            if len(parts) >= 5:
                rsid = parts[0]
                allele1 = parts[3].strip()
                allele2 = parts[4].strip()

                if rsid.startswith('rs') and allele1 != '0' and allele2 != '0':
                    genotype = allele1 + allele2
                    snps[rsid] = genotype

        return snps

    def extract_markers(self, snp_data: Dict[str, str]) -> List[GenomicMarker]:
        """
        Extract and interpret markers from parsed SNP data.
        """
        markers = []

        for rsid, genotype in snp_data.items():
            if rsid in self.snp_database:
                snp_info = self.snp_database[rsid]

                # Normalize genotype (e.g., AC = CA)
                normalized_genotype = self._normalize_genotype(genotype)

                if normalized_genotype in snp_info["interpretations"]:
                    interp = snp_info["interpretations"][normalized_genotype]

                    marker = GenomicMarker(
                        rsId=rsid,
                        gene=snp_info["gene"],
                        genotype=genotype,
                        category=snp_info["category"],
                        phenotype=interp["phenotype"],
                        confidence=0.95,  # High confidence for known SNPs
                        recommendations=interp["recommendations"],
                        metadata={
                            "risk_modifier": interp.get("risk_modifier", 1.0)
                        }
                    )
                    markers.append(marker)

        return markers

    def _normalize_genotype(self, genotype: str) -> str:
        """Normalize genotype to standard form (sorted alphabetically)."""
        if len(genotype) == 2:
            return ''.join(sorted(genotype.upper()))
        return genotype.upper()

    def calculate_risk_scores(self, snp_data: Dict[str, str], markers: List[GenomicMarker]) -> List[GenomicRiskScore]:
        """
        Calculate disease risk scores based on SNP data.
        """
        risk_scores = []
        marker_dict = {m.rsId: m for m in markers}

        for condition, config in self.disease_risks.items():
            contributing_snps = []
            risk_modifier = 1.0
            confidence = 0.0
            snps_found = 0

            for rsid in config["snps"]:
                if rsid in marker_dict:
                    snps_found += 1
                    contributing_snps.append(rsid)
                    marker = marker_dict[rsid]
                    if marker.metadata and "risk_modifier" in marker.metadata:
                        risk_modifier *= marker.metadata["risk_modifier"]

            if snps_found == 0:
                continue

            # Calculate confidence based on SNPs found
            confidence = snps_found / len(config["snps"])

            # Calculate adjusted risk
            base_risk = config["base_risk"]
            adjusted_risk = base_risk * risk_modifier

            # Convert to percentile (simplified)
            if adjusted_risk < base_risk * 0.8:
                risk_level = RiskLevel.LOW
                percentile = 25.0
            elif adjusted_risk < base_risk:
                risk_level = RiskLevel.BELOW_AVERAGE
                percentile = 40.0
            elif adjusted_risk <= base_risk * 1.2:
                risk_level = RiskLevel.AVERAGE
                percentile = 50.0
            elif adjusted_risk <= base_risk * 1.5:
                risk_level = RiskLevel.ABOVE_AVERAGE
                percentile = 70.0
            else:
                risk_level = RiskLevel.HIGH
                percentile = 85.0

            # Generate recommendations based on risk
            recommendations = self._generate_risk_recommendations(condition, risk_level)

            risk_score = GenomicRiskScore(
                condition=condition,
                riskLevel=risk_level,
                percentile=percentile,
                confidenceScore=confidence,
                contributingSnps=contributing_snps,
                recommendations=recommendations
            )
            risk_scores.append(risk_score)

        return risk_scores

    def _generate_risk_recommendations(self, condition: str, risk_level: RiskLevel) -> List[str]:
        """Generate personalized recommendations based on condition and risk level."""
        recommendations = []

        if risk_level in [RiskLevel.ABOVE_AVERAGE, RiskLevel.HIGH]:
            if condition == "Type 2 Diabetes":
                recommendations = [
                    "Monitor blood glucose levels regularly",
                    "Maintain a low-glycemic diet",
                    "Regular exercise (150 min/week)",
                    "Maintain healthy weight",
                    "Annual HbA1c screening recommended"
                ]
            elif condition == "Cardiovascular Disease":
                recommendations = [
                    "Regular cardiovascular exercise",
                    "Heart-healthy diet (Mediterranean style)",
                    "Monitor blood pressure and cholesterol",
                    "Limit saturated fats",
                    "Regular cardiac checkups recommended"
                ]
            elif condition == "Obesity":
                recommendations = [
                    "Strict portion control",
                    "Daily physical activity essential",
                    "Track calorie intake",
                    "Focus on protein and fiber",
                    "Regular weight monitoring"
                ]
        else:
            recommendations = [
                f"Your genetic risk for {condition} is {risk_level.value.lower().replace('_', ' ')}",
                "Maintain healthy lifestyle practices",
                "Regular health checkups recommended"
            ]

        return recommendations

    def process_file(self, content: str, source: Optional[GenomicSource] = None) -> Dict[str, Any]:
        """
        Complete processing pipeline for a genomic data file.

        Returns dict with markers, risk_scores, and metadata.
        """
        try:
            # Parse file
            snp_data = self.parse_file(content, source)
            logger.info(f"Parsed {len(snp_data)} SNPs from file")

            # Extract markers
            markers = self.extract_markers(snp_data)
            logger.info(f"Extracted {len(markers)} interpretable markers")

            # Calculate risk scores
            risk_scores = self.calculate_risk_scores(snp_data, markers)
            logger.info(f"Calculated {len(risk_scores)} risk scores")

            return {
                "success": True,
                "markers": [
                    {
                        "rsId": m.rsId,
                        "gene": m.gene,
                        "genotype": m.genotype,
                        "category": m.category.value,
                        "phenotype": m.phenotype,
                        "confidence": m.confidence,
                        "recommendations": m.recommendations,
                        "metadata": m.metadata
                    }
                    for m in markers
                ],
                "riskScores": [
                    {
                        "condition": r.condition,
                        "riskLevel": r.riskLevel.value,
                        "percentile": r.percentile,
                        "confidenceScore": r.confidenceScore,
                        "contributingSnps": r.contributingSnps,
                        "recommendations": r.recommendations
                    }
                    for r in risk_scores
                ],
                "totalSnpsParsed": len(snp_data),
                "markersFound": len(markers),
                "riskScoresCalculated": len(risk_scores)
            }

        except Exception as e:
            logger.error(f"Error processing genomic file: {e}")
            return {
                "success": False,
                "error": str(e),
                "markers": [],
                "riskScores": []
            }

    def interpret_single_marker(self, rsid: str, genotype: str) -> Optional[Dict[str, Any]]:
        """Interpret a single SNP marker."""
        if rsid not in self.snp_database:
            return None

        snp_info = self.snp_database[rsid]
        normalized_genotype = self._normalize_genotype(genotype)

        if normalized_genotype not in snp_info["interpretations"]:
            return None

        interp = snp_info["interpretations"][normalized_genotype]

        return {
            "rsId": rsid,
            "gene": snp_info["gene"],
            "genotype": genotype,
            "normalizedGenotype": normalized_genotype,
            "category": snp_info["category"].value,
            "phenotype": interp["phenotype"],
            "recommendations": interp["recommendations"],
            "riskModifier": interp.get("risk_modifier", 1.0)
        }

    def get_supported_markers(self) -> List[Dict[str, Any]]:
        """Return list of all supported markers."""
        markers = []
        for rsid, info in self.snp_database.items():
            markers.append({
                "rsId": rsid,
                "gene": info["gene"],
                "category": info["category"].value,
                "possibleGenotypes": list(info["interpretations"].keys())
            })
        return markers


# Singleton instance
_genomic_service: Optional[GenomicService] = None


def get_genomic_service() -> GenomicService:
    """Get or create the genomic service singleton"""
    global _genomic_service
    if _genomic_service is None:
        _genomic_service = GenomicService()
    return _genomic_service


# Create default instance for backwards compatibility
genomic_service = get_genomic_service()
