import { NextResponse } from "next/server";
import { handleTrackingWebhook } from "./handler";

/** Compatibility endpoint for providers that cannot put the connection key in the URL. */
export async function POST(request: Request) {
  const connectionKey = request.headers.get("x-qubere-tracking-connection");
  if (!connectionKey) {
    return NextResponse.json(
      {
        error: "CONNECTION_KEY_REQUIRED",
        message: "Use the connection-specific webhook URL or send x-qubere-tracking-connection.",
      },
      { status: 400 }
    );
  }
  return handleTrackingWebhook(request, connectionKey);
}
