import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { ProductHelpRepository } from "@/modules/support/productHelp";
import { SUPPORT_ARTICLES } from "@/app/app/support/supportContent";

export const GET = withAuthenticatedRoute(async ({ req, requestId }) => {
  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ suggestions: [], requestId });

  try {
    const suggestions = await ProductHelpRepository.autocomplete(query, 8);
    return NextResponse.json({ suggestions, requestId });
  } catch (error) {
    console.warn("[product-help] autocomplete database unavailable; using code-owned corpus", error);
    const normalized = query.toLowerCase();
    const suggestions = SUPPORT_ARTICLES.filter((article) =>
      [article.question, ...article.tags].some((value) => value.toLowerCase().includes(normalized))
    )
      .slice(0, 8)
      .map(({ id, moduleId, question, href }) => ({ id, moduleId, question, href }));
    return NextResponse.json({ suggestions, requestId });
  }
});
