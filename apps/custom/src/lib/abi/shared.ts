/**
 * Small helpers shared by the ABI `fromX` mappers (drawback/ebond/statement/
 * cargoRelease) to avoid each one re-deriving the same CATAIR idioms.
 */

/** Sorts by `sequence` ascending, then partitions into fixed-size chunks — the shape every CATAIR repeating-group record (e.g. 15 ITINs per Record 52, 5 fee lines per statement record) is built from. */
export function chunkBySequence<T extends { sequence: number }>(rows: T[], size: number): T[][] {
  const sorted = [...rows].sort((a, b) => a.sequence - b.sequence);
  const chunks: T[][] = [];
  for (let i = 0; i < sorted.length; i += size) {
    chunks.push(sorted.slice(i, i + size));
  }
  return chunks;
}
