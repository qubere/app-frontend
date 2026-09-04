export async function portalResponseError(response: Response, fallback: string) {
  if (response.status === 401) return 'Your session has expired. Sign in again.';
  if (response.status === 403 || response.status === 404) return 'This information is not available to your login. Ask your service provider to check your access and client assignment.';
  const body = await response.json().catch(() => null);
  return body?.error === 'PORTAL_SCHEMA_OUTDATED'
    ? 'This feature is unavailable until your service provider finishes updating the portal.'
    : fallback;
}
