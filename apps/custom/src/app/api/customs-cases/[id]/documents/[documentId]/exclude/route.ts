import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { excludeDocument } from "@/modules/case/customsCaseDocumentService";

export const POST = withAuthenticatedRoute<{ id: string; documentId: string }>(
  async ({ req, ctx, params }) => {
    try {
      const resolvedParams = await params;
      const customsCaseId = resolvedParams.id;
      const documentId = resolvedParams.documentId;

      const body = await req.json().catch(() => ({}));
      const reason = body.reason;

      const result = await excludeDocument({
        accountId: ctx.accountId,
        userId: ctx.userId,
        customsCaseId,
        documentId,
        reason,
      });

      return NextResponse.json({ ok: true, link: result });
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to exclude document from CustomsCase" },
        { status: 400 }
      );
    }
  },
  { permission: "documents.delete", write: true }
);
