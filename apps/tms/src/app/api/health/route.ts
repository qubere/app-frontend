import { NextResponse } from "next/server";

export async function GET() {
  const commit =
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    process.env.CONTAINER_SHA ||
    process.env.K_REVISION ||
    "unknown";

  return NextResponse.json(
    {
      status: "ok",
      service: "qubere-tms-app",
      gitCommit: commit,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
