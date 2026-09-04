import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parserConfigurationReport } from "@/modules/documents/parser/config";

/**
 * Document-parser configuration health. Read-only, contains no secrets.
 *
 * The Documents UI polls this to show a persistent warning when parsing is
 * degraded or running the mock provider — a mock result must never be mistaken
 * for real extracted evidence, so the state is surfaced rather than hidden.
 */
export const GET = withAuthenticatedRoute(async () => {
  const report = parserConfigurationReport();
  return NextResponse.json({
    provider: report.provider,
    configured: report.configured,
    isMock: report.mock,
    blocker: report.blocker,
  });
});
