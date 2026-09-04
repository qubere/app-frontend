import { NextResponse } from 'next/server';

export function isPortalSchemaOutdated(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (['P2021', 'P2022', 'PORTAL_SCHEMA_OUTDATED'].includes(code)) return true;
  // An older generated client rejects these new fields before contacting the DB.
  // Do not mislabel unrelated query validation/programming errors as schema drift.
  return error instanceof Error && error.name === 'PrismaClientValidationError' &&
    /Unknown (?:argument|field) `(?:customerActionable|customerLabel|activatedAt|clientDocuments|clientStakeholders|portalVisible)`/.test(error.message);
}

export function portalReadError(error: unknown) {
  const outdated = isPortalSchemaOutdated(error);
  if (outdated) {
    console.error('[portal] Database/client update required. Apply migrations, run npm --workspace @qubere/db run db:generate, and restart the portal.', error);
  } else {
    console.error('[portal] Request failed', error);
  }
  return NextResponse.json({
    error: outdated ? 'PORTAL_SCHEMA_OUTDATED' : 'PORTAL_UNAVAILABLE',
    message: outdated ? 'This feature is unavailable until your service provider finishes updating the portal.' : 'The portal could not load this information. Please try again.',
  }, { status: outdated ? 503 : 500, headers: { 'Cache-Control': 'no-store' } });
}
