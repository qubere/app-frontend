import { GoogleGenAI } from "@google/genai";

/**
 * Creates a GoogleGenAI client with automatic environment resolution:
 * 1. If `GEMINI_API_KEY` is present (e.g. local .env.local), uses the API key.
 * 2. In GCP Production (Cloud Run), falls back to IAM Application Default Credentials (Vertex AI).
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }

  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "qubere-demo";
  return new GoogleGenAI({
    vertexAI: true,
    project: projectId,
    location: process.env.VERTEX_AI_LOCATION || "us-central1",
  });
}
