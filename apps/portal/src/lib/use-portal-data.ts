'use client';

import { useEffect, useState } from 'react';
import { portalResponseError } from './portal-response-error';

/** Component-local cache: tab switches reuse data, leaving the shipment drops it. */
export function usePortalData<T>(url: string, enabled = true) {
  const [cache, setCache] = useState<Record<string, T>>({});
  const [failure, setFailure] = useState<{ url: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const data = cache[url];
  useEffect(() => {
    if (!enabled || data !== undefined) return;
    const controller = new AbortController();
    setFailure(null);
    fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(await portalResponseError(response, 'Could not load this shipment information. Please try again.'));
        return response.json() as Promise<T>;
      })
      .then(value => { if (!controller.signal.aborted) setCache(previous => ({ ...previous, [url]: value })); })
      .catch(error => { if (!controller.signal.aborted) setFailure({ url, message: error.message }); });
    return () => controller.abort();
  }, [url, enabled, data, attempt]);
  return { data, error: failure?.url === url ? failure.message : '', retry: () => setAttempt(n => n + 1) };
}
