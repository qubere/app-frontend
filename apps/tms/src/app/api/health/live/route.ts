import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "qubere-tms-app",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
