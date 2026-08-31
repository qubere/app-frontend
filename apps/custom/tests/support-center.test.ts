import { describe, expect, it } from "vitest";
import {
  SUPPORT_ARTICLES,
  SUPPORT_MODULES,
  searchSupportArticles,
} from "@/app/app/support/supportContent";

describe("support center content", () => {
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
