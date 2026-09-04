import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { ShipmentEventConsumer } from "@/modules/events/shipmentEventConsumer";

export const maxDuration = 60;

async function dispatch(requestId: string): Promise<Response> {
  const result = await ShipmentEventConsumer.dispatchOutboxEvents();
  return NextResponse.json({
    status: "OK",
    requestId,
    result,
  });
}

export const GET = withCronRoute(async ({ requestId }) => {
  return dispatch(requestId);
});

export const POST = withCronRoute(async ({ requestId }) => {
  return dispatch(requestId);
});
