/**
 * NEWS2 (National Early Warning Score 2) Utility
 *
 * Implements NHS-compliant NEWS2 risk classification.
 * Reference: Royal College of Physicians NEWS2 guidelines
 * https://www.rcp.ac.uk/improving-care/resources/national-early-warning-score-news-2/
 *
 * Risk Classification:
 * - Score 0:     LOW risk (routine monitoring, 12 hourly)
 * - Score 1-4:   LOW risk (ward nurse assessment, 4-6 hourly)
 * - Score 1-4 with single param = 3: MEDIUM risk (urgent response, hourly)
 * - Score 5-6:   MEDIUM risk (urgent response, hourly)
 * - Score >= 7:  CRITICAL risk (emergency response, continuous)
 */

export type NEWS2RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface NEWS2RiskConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  monitoring: string;
  clinicalResponse: string;
}

export const NEWS2_RISK_LEVELS: Record<NEWS2RiskLevel, NEWS2RiskConfig> = {
  LOW: {
    label: 'Low',
    color: 'green',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-500',
    textColor: 'text-green-700',
    monitoring: '4-6 hourly',
    clinicalResponse: 'Continue routine monitoring - minimum 4-6 hourly observations',
  },
  MEDIUM: {
    label: 'Medium',
    color: 'amber',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-700',
    monitoring: 'Hourly',
    clinicalResponse: 'Urgent response - increase monitoring to hourly minimum, urgent clinical review within 30 minutes',
  },
  HIGH: {
    label: 'High',
    color: 'orange',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-700',
    monitoring: '30 min',
    clinicalResponse: 'Emergency response - continuous monitoring, urgent senior clinical review',
  },
  CRITICAL: {
    label: 'Critical',
    color: 'red',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-500',
    textColor: 'text-red-700',
    monitoring: 'Continuous',
    clinicalResponse: 'Emergency response - continuous monitoring, immediate senior review, consider ICU/HDU',
  },
} as const;

/**
 * Calculate NEWS2 risk level based on total score and extreme parameter detection.
 *
 * NHS Guidelines:
 * - Score 0-4 (no extreme): LOW risk
 * - Score 1-4 with any single parameter = 3: MEDIUM risk (urgent response)
 * - Score 5-6: MEDIUM risk
 * - Score >= 7: CRITICAL risk
 *
 * @param totalScore - The aggregate NEWS2 score (0-20)
 * @param hasExtremeScore - Whether any single parameter scored 3 (extreme value)
 * @returns The risk level classification
 */
export function calculateNEWS2RiskLevel(
  totalScore: number,
  hasExtremeScore: boolean
): NEWS2RiskLevel {
  if (totalScore >= 7) {
    return 'CRITICAL';
  }
  if (totalScore >= 5 || hasExtremeScore) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Get clinical response guidance based on NEWS2 risk level.
 */
export function getNEWS2ClinicalResponse(
  totalScore: number,
  hasExtremeScore: boolean
): string {
  const riskLevel = calculateNEWS2RiskLevel(totalScore, hasExtremeScore);

  // Provide more specific guidance based on exact score
  if (totalScore >= 7) {
    return 'Emergency response - continuous monitoring, immediate senior review, consider ICU/HDU';
  }
  if (totalScore >= 5) {
    return 'Urgent response - increase monitoring to at least hourly, urgent clinical review within 30 minutes';
  }
  if (hasExtremeScore) {
    return 'Urgent response - single extreme parameter detected, urgent clinical review within 30 minutes';
  }
  if (totalScore >= 1) {
    return 'Low-medium clinical risk - inform registered nurse, increase monitoring to 4-6 hourly';
  }
  return 'Routine monitoring - minimum 12 hourly observations';
}

/**
 * Get risk level display configuration (colors, labels, etc.)
 */
export function getNEWS2RiskConfig(riskLevel: NEWS2RiskLevel | string): NEWS2RiskConfig {
  const level = riskLevel?.toUpperCase() as NEWS2RiskLevel;
  return NEWS2_RISK_LEVELS[level] || NEWS2_RISK_LEVELS.LOW;
}

/**
 * Normalize backend risk level strings to standard NEWS2RiskLevel.
 * The backend may return: 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'
 * We normalize 'MODERATE' to 'MEDIUM' for consistency.
 */
export function normalizeRiskLevel(backendLevel: string): NEWS2RiskLevel {
  const level = backendLevel?.toUpperCase();
  switch (level) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'HIGH':
      return 'HIGH';
    case 'MODERATE':
    case 'MEDIUM':
      return 'MEDIUM';
    case 'LOW':
    default:
      return 'LOW';
  }
}

/**
 * Convert internal risk level to lowercase for component compatibility.
 * Some components expect lowercase: 'low', 'medium', 'high', 'critical'
 */
export function toLowercaseRiskLevel(riskLevel: NEWS2RiskLevel): 'low' | 'medium' | 'high' | 'critical' {
  return riskLevel.toLowerCase() as 'low' | 'medium' | 'high' | 'critical';
}
