export interface ImporterClientGateRow {
  id: string;
  name: string;
  clientId: string | null;
  legalEntityId: string | null;
  legalEntity: { clientId: string | null } | null;
}

export interface ImporterClientGateSummary {
  total: number;
  assigned: number;
  unassigned: Array<{ id: string; name: string }>;
  clientMismatches: Array<{
    id: string;
    name: string;
    importerClientId: string;
    legalEntityClientId: string;
  }>;
  readyForNotNull: boolean;
}

/** Pure release gate used by the dry-run report and its regression tests. */
export function summarizeImporterClientGate(rows: ImporterClientGateRow[]): ImporterClientGateSummary {
  const unassigned = rows
    .filter((row) => !row.clientId)
    .map(({ id, name }) => ({ id, name }));
  const clientMismatches = rows.flatMap((row) => {
    if (!row.clientId || !row.legalEntity?.clientId || row.clientId === row.legalEntity.clientId) return [];
    return [{
      id: row.id,
      name: row.name,
      importerClientId: row.clientId,
      legalEntityClientId: row.legalEntity.clientId,
    }];
  });

  return {
    total: rows.length,
    assigned: rows.length - unassigned.length,
    unassigned,
    clientMismatches,
    readyForNotNull: unassigned.length === 0 && clientMismatches.length === 0,
  };
}
