import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { getSystemCronJobs } from "@/lib/admin/cronData";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  if (!ctx.isPlatformAdmin) {
    return NextResponse.json({ error: "Platform Admin privileges required" }, { status: 403 });
  }

  try {
    const jobs = await getSystemCronJobs();
    return NextResponse.json({ jobs });
  } catch (err) {
    console.error("[Platform Admin Cron List Error]", err);
    return NextResponse.json({ error: "Failed to load cron job statuses" }, { status: 500 });
  }
});
