export interface HoldCodeEntry {
  agencyCode: string;
  holdCode: string;
  narrativeText: string;
  explanation: string;
  sourceUrl: string;
}
// No approved dictionary was supplied. Preserve the agency's original narrative
// rather than manufacture legal interpretations from an illustrative code.
export const PGA_HOLD_CODE_DICTIONARY_ROWS: readonly HoldCodeEntry[] = [];
export function getHoldCodeEntry(agencyCode: string, holdCode: string) {
  return PGA_HOLD_CODE_DICTIONARY_ROWS.find(row => row.agencyCode === agencyCode && row.holdCode === holdCode);
}
