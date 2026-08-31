import { handleTrackingWebhook } from "../route";

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionKey: string }> }
) {
  const { connectionKey } = await context.params;
  return handleTrackingWebhook(request, connectionKey);
}
