import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { runRiskAgent } from "@/modules/agents/services/operationalAgents";

/**
 * POST /api/agents/risk/sweep
 *
 * Triggers the Risk Agent to sweep all active shipments and create
 * ExceptionItems for any LFD/promise risk crossing thresholds.
 */
export const POST = withAuthenticatedRoute(async ({ ctx }) => {
  const result = await runRiskAgent(ctx);

  return NextResponse.json({
    success: true,
    ...result,
    message: `Risk sweep complete. Evaluated ${result.evaluated} shipments, created ${result.exceptionsCreated} exception(s).`,
  });
}, { permission: "decisions.reevaluate", write: true });
