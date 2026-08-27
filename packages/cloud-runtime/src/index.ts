import { GoogleAuth } from "google-auth-library";

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
