import { handleTrackingWebhook } from "../handler";

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionKey: string }> }
) {
  const { connectionKey } = await context.params;
  return handleTrackingWebhook(request, connectionKey);
}
