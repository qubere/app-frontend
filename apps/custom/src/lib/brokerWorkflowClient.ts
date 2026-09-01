export class WorkflowRequestError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
export async function workflowRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new WorkflowRequestError(body.error?.message ?? "The request failed. Please retry.", response.status, body.error?.code);
  return body as T;
}
