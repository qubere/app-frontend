import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { ProductHelpRepository } from "@/modules/support/productHelp";
import {
  SUPPORT_MODULES,
  searchSupportArticles,
  type SupportModuleId,
} from "@/app/app/support/supportContent";

export const GET = withAuthenticatedRoute(async ({ req, requestId }) => {
  const params = new URL(req.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const requestedModule = params.get("module");
  const moduleId = SUPPORT_MODULES.some((item) => item.id === requestedModule)
    ? (requestedModule as SupportModuleId)
    : undefined;

  if (query.length < 2) {
    return NextResponse.json({ articles: [], requestId });
  }

  try {
    const articles = await ProductHelpRepository.search(query, { moduleId, limit: 12 });
    return NextResponse.json({ articles, requestId });
  } catch (error) {
    console.warn("[product-help] hybrid search database unavailable; using code-owned corpus", error);
    const articles = searchSupportArticles(query, moduleId ?? "all").slice(0, 12);
    return NextResponse.json({ articles, requestId });
  }
});
