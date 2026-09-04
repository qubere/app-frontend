import { NextResponse } from "next/server";
import {
  ingestTrackingWebhook,
  recordTrackingWebhookFailure,
  TrackingWebhookError,
} from "../../../../modules/tracking/services/trackingWebhookIngestion";

function requestHeaders(request: Request): Record<string, string> {
  return Object.fromEntries([...request.headers.entries()].map(([key, value]) => [key.toLowerCase(), value]));
}

export async function handleTrackingWebhook(request: Request, connectionKey: string) {
  try {
    const result = await ingestTrackingWebhook({
      connectionKey,
      rawBody: await request.text(),
      headers: requestHeaders(request),
    });
    return NextResponse.json(result, { status: result.status === "DUPLICATE" ? 200 : 201 });
  } catch (error) {
    await recordTrackingWebhookFailure(connectionKey, error).catch((healthError) => {
      console.error("Tracking webhook health update failed", healthError);
    });
    if (error instanceof TrackingWebhookError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error("Tracking webhook ingestion failed", error);
    return NextResponse.json(
      { error: "TRACKING_INGESTION_FAILED", message: "Tracking webhook could not be processed." },
      { status: 500 }
    );
  }
}
