import { GoogleAuth } from "google-auth-library";

export interface SecretResolver {
  resolveSecret(secretRef: string): Promise<string>;
}

type GoogleRequestClient = {
  request<T>(options: { method: "GET"; url: string }): Promise<{ data: T }>;
};

interface SecretAccessResponse {
  payload?: { data?: string };
}

export function secretVersionResource(secretRef: string, projectId = process.env.GCP_PROJECT_ID): string {
  const normalized = secretRef.replace(/^gcp-secret:\/\//, "").replace(/^\//, "");
  if (/^projects\/[^/]+\/secrets\/[^/]+\/versions\/[^/]+$/.test(normalized)) {
    return normalized;
  }
  if (!projectId) {
    throw new Error("GCP_PROJECT_ID is required when a short Secret Manager reference is used.");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error("Secret Manager reference must be a secret ID or a full version resource name.");
  }
  return `projects/${projectId}/secrets/${normalized}/versions/latest`;
}

/** Resolve a database-stored Secret Manager pointer without exposing the value. */
export async function resolveGcpSecret(
  secretRef: string,
  options: { projectId?: string; client?: GoogleRequestClient } = {}
): Promise<string> {
  const resource = secretVersionResource(secretRef, options.projectId);
  let client = options.client;
  if (!client) {
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    client = (await auth.getClient()) as unknown as GoogleRequestClient;
  }
  const response = await client.request<SecretAccessResponse>({
    method: "GET",
    url: `https://secretmanager.googleapis.com/v1/${resource}:access`,
  });
  const encoded = response.data.payload?.data;
  if (!encoded) throw new Error(`Secret Manager returned no payload for "${resource}".`);
  return Buffer.from(encoded, "base64").toString("utf8");
}

export class GcpSecretResolver implements SecretResolver {
  async resolveSecret(secretRef: string): Promise<string> {
    return resolveGcpSecret(secretRef);
  }
}

export type DocumentProcessingExecutor = "cloud-run-job" | "in-process";

export function documentProcessingExecutor(): DocumentProcessingExecutor {
  return process.env.DOCUMENT_PROCESSING_EXECUTOR === "cloud-run-job"
    ? "cloud-run-job"
    : "in-process";
}

export async function triggerDocumentProcessingJob(): Promise<string | null> {
  if (documentProcessingExecutor() !== "cloud-run-job") return null;
  const project = process.env.GCP_PROJECT_ID;
  const region = process.env.GCP_REGION;
  const job = process.env.DOCUMENT_PROCESSING_JOB;
  if (!project || !region || !job) {
    throw new Error("GCP_PROJECT_ID, GCP_REGION, and DOCUMENT_PROCESSING_JOB are required.");
  }
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const url = `https://run.googleapis.com/v2/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(region)}/jobs/${encodeURIComponent(job)}:run`;
  const response = await client.request<{ name?: string }>({ method: "POST", url });
  return response.data.name ?? null;
}
