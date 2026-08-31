// Internal e-sign completion endpoint — called by the /sign/[token] page when
// the signer clicks "I agree and sign". No auth required (token is the secret).
import { NextResponse } from "next/server";
import { PoaService } from "@/modules/onboarding/poa.service";

export const POST = async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Invalid signing link" }, { status: 400 });
  }

  let body: { signerNameAttestation?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const signerName = (body.signerNameAttestation ?? "").trim();
  if (!signerName) {
    return NextResponse.json({ error: "signerNameAttestation is required" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  try {
    const result = await PoaService.completeInternalSign(token, signerName, ip);
    if ("alreadySigned" in result && result.alreadySigned) {
      return NextResponse.json({ alreadySigned: true });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Signing link not found or already used" }, { status: 404 });
    }
    return NextResponse.json({ error: err.message ?? "Signing failed" }, { status: 500 });
  }
};
