import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { includeDocument } from "@/modules/case/customsCaseDocumentService";

export const POST = withAuthenticatedRoute<{ id: string; documentId: string }>(
  async ({ req, ctx, params }) => {
    try {
      const resolvedParams = await params;
      const customsCaseId = resolvedParams.id;
      const documentId = resolvedParams.documentId;

      const body = await req.json().catch(() => ({}));
      const documentRole = body.documentRole;

      const result = await includeDocument({
        accountId: ctx.accountId,
        userId: ctx.userId,
        customsCaseId,
        documentId,
        documentRole,
      });

      return NextResponse.json({ ok: true, link: result });
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to include document in CustomsCase" },
        { status: 400 }
      );
    }
  },
  { permission: "documents.create", write: true }
);
