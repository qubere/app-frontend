import { describe, expect, it } from "vitest";
import {
  BASE_SUPPORT_ARTICLES,
  SUPPORT_ARTICLES,
  SUPPORT_MODULES,
  mergeSupportArticles,
  searchSupportArticles,
} from "@/app/app/support/supportContent";
import { NAV_SECTIONS } from "@/lib/navigation";

describe("support center content", () => {
  it("keeps the reviewed corpus overlay deterministic", () => {
    expect(BASE_SUPPORT_ARTICLES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(SUPPORT_ARTICLES.map((article) => article.id)).size).toBe(SUPPORT_ARTICLES.length);
  });

  it("lets a reviewed generated overlay update, add, and archive guides by stable id", () => {
    const baseline = BASE_SUPPORT_ARTICLES.slice(0, 2);
    const replacement = { ...baseline[0], answer: "A reviewed replacement answer for this workflow." };
    const addition = { ...baseline[1], id: "generated-guide" };
    const merged = mergeSupportArticles(baseline, [replacement, addition], [baseline[1].id]);

    expect(merged.find((article) => article.id === replacement.id)?.answer).toBe(replacement.answer);
    expect(merged.map((article) => article.id)).toContain("generated-guide");
    expect(merged.map((article) => article.id)).not.toContain(baseline[1].id);
  });

  it("covers every support module with multiple task guides", () => {
    for (const supportModule of SUPPORT_MODULES) {
      const articles = SUPPORT_ARTICLES.filter((article) => article.moduleId === supportModule.id);
      expect(articles.length, `module ${supportModule.id} needs useful depth`).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps every article id unique and every app action link local", () => {
    expect(new Set(SUPPORT_ARTICLES.map((article) => article.id)).size).toBe(SUPPORT_ARTICLES.length);

    for (const article of SUPPORT_ARTICLES) {
      if (article.href) {
        expect(article.href.startsWith("/app/") || article.href === "/chat").toBe(true);
      }
    }
  });

  it("keeps every customer-facing navigation module covered by a guide", () => {
    const customerRoutes = NAV_SECTIONS.filter((section) => !section.hiddenFromSidebar)
      .flatMap((section) => section.items)
      .map((item) => item.href);

    for (const href of customerRoutes) {
      expect(
        SUPPORT_ARTICLES.some((article) =>
          article.href === href || article.href?.startsWith(`${href}/`) || article.href?.startsWith(`${href}?`)
        ),
        `${href} needs at least one product-help guide`
      ).toBe(true);
    }
  });
});

describe("support center search", () => {
  it("finds filing guidance by a form number", () => {
    expect(searchSupportArticles("7501").map((article) => article.id)).toContain("form-7501");
  });

  it("finds document guidance from task language", () => {
    const ids = searchSupportArticles("quarantined email").map((article) => article.id);
    expect(ids).toContain("quarantine-document");
  });

  it("requires every search token to match the article context", () => {
    const results = searchSupportArticles("restricted party hit");
    expect(results[0]?.id).toBe("screen-party");
    expect(results.every((article) => article.moduleId === "compliance")).toBe(true);
  });

  it("filters by module independently of search", () => {
    const results = searchSupportArticles("", "post-entry");
    expect(results.length).toBeGreaterThanOrEqual(4);
    expect(results.every((article) => article.moduleId === "post-entry")).toBe(true);
  });

  it("returns popular guidance first when browsing", () => {
    const results = searchSupportArticles("");
    const firstNonPopular = results.findIndex((article) => !article.popular);
    expect(firstNonPopular).toBeGreaterThan(0);
    expect(results.slice(0, firstNonPopular).every((article) => article.popular)).toBe(true);
  });

  it("returns an empty result for unrelated terms", () => {
    expect(searchSupportArticles("quantum submarine insurance")).toEqual([]);
  });
});
