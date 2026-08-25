/**
 * Calibrated Score Calculator — LLM Universal Field Hydration
 *
 * Calculates a calibrated decision score (0-100) combining independent signals:
 * - Semantic Mapping Confidence
 * - Extraction Confidence
 * - Deterministic Validation Pass/Fail
 * - Cross-Document Corroboration Score
 */

export interface ScoreInput {
  extractionConfidence?: number;
  mappingConfidence?: number;
  validationScore?: number;
  corroborationScore?: number;
}

export function calculateCalibratedScore(input: ScoreInput): number {
  const mapConf = Math.min(100, Math.max(0, input.mappingConfidence ?? 90));
  const extConf = Math.min(100, Math.max(0, input.extractionConfidence ?? 90));
  const valScore = Math.min(100, Math.max(0, input.validationScore ?? 100));
  const corrScore = Math.min(100, Math.max(0, input.corroborationScore ?? 0));

  // Weighted score calculation
  const score = mapConf * 0.4 + extConf * 0.2 + valScore * 0.3 + corrScore * 0.1;

  return Number(score.toFixed(2));
}
