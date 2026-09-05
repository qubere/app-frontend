import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getGeminiClient } from "@/lib/ai/geminiClient";
import { GoogleGenAI } from "@google/genai";

const mockConstructor = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      config: any;
      constructor(config: any) {
        this.config = config;
        mockConstructor(config);
      }
      getGenerativeModel() {
        return { model: "gemini-3.6-flash" };
      }
    },
  };
});

describe("getGeminiClient Environment Fallback Matrix", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("Scenario 1: Local Dev — uses GEMINI_API_KEY when provided in environment", () => {
    process.env.GEMINI_API_KEY = "AIzaSyTestApiKeyLocal123";
    delete process.env.GCP_PROJECT_ID;

    const client = getGeminiClient();

    expect(mockConstructor).toHaveBeenCalledWith({
      apiKey: "AIzaSyTestApiKeyLocal123",
    });
    expect(client).toBeDefined();
  });

  it("Scenario 2: GCP Production IAM — falls back to keyless Vertex AI ADC when GEMINI_API_KEY is empty", () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GCP_PROJECT_ID = "qubere-demo";
    process.env.VERTEX_AI_LOCATION = "us-central1";

    const client = getGeminiClient();

    expect(mockConstructor).toHaveBeenCalledWith({
      vertexai: true,
      project: "qubere-demo",
      location: "us-central1",
    });
    expect(client).toBeDefined();
  });

  it("Scenario 3: GCP Production IAM — defaults to qubere-demo and us-central1 if project env unset", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GCP_PROJECT_ID;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.VERTEX_AI_LOCATION;

    const client = getGeminiClient();

    expect(mockConstructor).toHaveBeenCalledWith({
      vertexai: true,
      project: "qubere-demo",
      location: "us-central1",
    });
    expect(client).toBeDefined();
  });
});
