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
 * - Score 1-4 with single param = 3: MODERATE risk (urgent response, hourly)
 * - Score 5-6:   MODERATE risk (urgent response, hourly)
 * - Score >= 7:  CRITICAL risk (emergency response, continuous)
 *
 * Note: Backend uses 'MODERATE' while frontend uses 'MEDIUM' for the same risk level.
 * Use normalizeRiskLevel() for frontend compatibility.
 */

export type NEWS2RiskLevel = 'LOW' | 'MODERATE' | 'CRITICAL';

export interface NEWS2RiskConfig {
  label: string;
  monitoring: string;
  clinicalResponse: string;
  timeToReassessment: string;
}

export const NEWS2_RISK_LEVELS: Record<NEWS2RiskLevel, NEWS2RiskConfig> = {
  LOW: {
    label: 'Low',
    monitoring: '4-6 hourly',
    clinicalResponse: 'Continue routine monitoring - minimum 4-6 hourly observations',
    timeToReassessment: '4-6 hours',
  },
  MODERATE: {
    label: 'Moderate',
    monitoring: 'Hourly',
    clinicalResponse: 'Urgent response - increase monitoring to hourly minimum, urgent clinical review within 30 minutes',
    timeToReassessment: '1 hour',
  },
  CRITICAL: {
    label: 'Critical',
    monitoring: 'Continuous',
    clinicalResponse: 'Emergency response - continuous monitoring, immediate senior review, consider ICU/HDU',
    timeToReassessment: 'Continuous',
  },
} as const;

/**
 * Calculate NEWS2 risk level based on total score and extreme parameter detection.
 *
 * NHS Guidelines:
 * - Score 0-4 (no extreme): LOW risk
 * - Score 1-4 with any single parameter = 3: MODERATE risk (urgent response)
 * - Score 5-6: MODERATE risk
 * - Score >= 7: CRITICAL risk
 *
 * @param totalScore - The aggregate NEWS2 score (0-20)
 * @param hasExtremeScore - Whether any single parameter scored 3 (extreme value)
 * @returns The risk level classification
 */
export function calculateNEWS2RiskLevel(
  totalScore: number,
  hasExtremeScore: boolean = false
): NEWS2RiskLevel {
  if (totalScore >= 7) {
    return 'CRITICAL';
  }
  if (totalScore >= 5 || hasExtremeScore) {
    return 'MODERATE';
  }
  return 'LOW';
}

/**
 * Get clinical response guidance based on NEWS2 score and extreme parameter status.
 *
 * @param totalScore - The aggregate NEWS2 score (0-20)
 * @param hasExtremeScore - Whether any single parameter scored 3 (extreme value)
 * @returns Clinical response guidance string
 */
export function getNEWS2ClinicalResponse(
  totalScore: number,
  hasExtremeScore: boolean = false
): string {
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
 * Get the time to reassessment based on NEWS2 risk level.
 *
 * @param riskLevel - The NEWS2 risk level
 * @returns Time to reassessment string
 */
export function getNEWS2TimeToReassessment(riskLevel: NEWS2RiskLevel): string {
  return NEWS2_RISK_LEVELS[riskLevel].timeToReassessment;
}

/**
 * Get risk level configuration (label, monitoring frequency, clinical response).
 *
 * @param riskLevel - The NEWS2 risk level
 * @returns Risk configuration object
 */
export function getNEWS2RiskConfig(riskLevel: NEWS2RiskLevel): NEWS2RiskConfig {
  return NEWS2_RISK_LEVELS[riskLevel] || NEWS2_RISK_LEVELS.LOW;
}
